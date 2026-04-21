import { useCallback, useEffect, useRef, useState } from 'react'
import * as api from './api'
import type { BuildEvent, Manifest, ThemeMeta } from './types'
import Sidebar from './components/Sidebar'
import BasicSettings from './components/BasicSettings'
import AssetsPanel from './components/AssetsPanel'
import JsonEditorPanel from './components/JsonEditorPanel'
import PreviewPanel from './components/PreviewPanel'

type Tab = 'basic' | 'assets' | 'json'

interface Toast { id: number; text: string; kind: 'success' | 'error' | 'info' }

let _toastId = 0

export default function App() {
  const [themes, setThemes] = useState<ThemeMeta[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [manifest, setManifest] = useState<Manifest | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [assets, setAssets] = useState<string[]>([])
  const [tab, setTab] = useState<Tab>('basic')
  const [isSaving, setIsSaving] = useState(false)
  const [buildLog, setBuildLog] = useState<BuildEvent[]>([])
  const [buildStatus, setBuildStatus] = useState<'idle' | 'building' | 'success' | 'error'>('idle')
  const [previewKey, setPreviewKey] = useState(0)
  const [toasts, setToasts] = useState<Toast[]>([])
  const stopBuildRef = useRef<(() => void) | null>(null)

  const toast = useCallback((text: string, kind: Toast['kind'] = 'info') => {
    const id = ++_toastId
    setToasts(t => [...t, { id, text, kind }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
  }, [])

  const loadThemes = useCallback(async () => {
    try { setThemes(await api.getThemes()) } catch {}
  }, [])

  useEffect(() => { void loadThemes() }, [loadThemes])

  const selectTheme = useCallback(async (id: string) => {
    if (stopBuildRef.current) { stopBuildRef.current(); stopBuildRef.current = null }
    setSelectedId(id)
    setManifest(null)
    setIsDirty(false)
    setAssets([])
    setBuildLog([])
    setBuildStatus('idle')
    try {
      const [m, a] = await Promise.all([api.getManifest(id), api.getAssets(id)])
      setManifest(m)
      setAssets(a)
    } catch (e) {
      toast(`Ошибка загрузки: ${(e as Error).message}`, 'error')
    }
  }, [toast])

  const handleManifestChange = useCallback((m: Manifest) => {
    setManifest(m)
    setIsDirty(true)
  }, [])

  const handleSave = useCallback(async () => {
    if (!selectedId || !manifest) return
    setIsSaving(true)
    try {
      await api.saveManifest(selectedId, manifest)
      setIsDirty(false)
      toast('Манифест сохранён', 'success')
      await loadThemes()
    } catch (e) {
      toast(`Ошибка сохранения: ${(e as Error).message}`, 'error')
    } finally {
      setIsSaving(false)
    }
  }, [selectedId, manifest, toast, loadThemes])

  const handleBuild = useCallback(async () => {
    if (!selectedId || !manifest) return
    if (buildStatus === 'building') return

    // Save first if dirty
    if (isDirty) {
      setIsSaving(true)
      try {
        await api.saveManifest(selectedId, manifest)
        setIsDirty(false)
      } catch (e) {
        toast(`Ошибка сохранения: ${(e as Error).message}`, 'error')
        setIsSaving(false)
        return
      }
      setIsSaving(false)
    }

    setBuildLog([])
    setBuildStatus('building')

    const stop = api.startBuild(selectedId, (evt) => {
      setBuildLog(prev => [...prev, evt])
      if (evt.type === 'done') {
        if (evt.success) {
          setBuildStatus('success')
          setPreviewKey(k => k + 1)
          toast('Сборка завершена!', 'success')
          void loadThemes()
        } else {
          setBuildStatus('error')
          toast('Сборка завершилась с ошибкой', 'error')
        }
        stopBuildRef.current = null
      }
    })

    stopBuildRef.current = stop
  }, [selectedId, manifest, isDirty, buildStatus, toast, loadThemes])

  const handleAssetsChange = useCallback(async () => {
    if (!selectedId) return
    try { setAssets(await api.getAssets(selectedId)) } catch {}
  }, [selectedId])

  const selectedTheme = themes.find(t => t.id === selectedId)

  return (
    <div className="app">
      <Sidebar
        themes={themes}
        selectedId={selectedId}
        onSelect={selectTheme}
        onCreated={async (id) => { await loadThemes(); await selectTheme(id) }}
        onDeleted={async (id) => {
          if (selectedId === id) {
            setSelectedId(null)
            setManifest(null)
            setAssets([])
          }
          await loadThemes()
          toast('Тема удалена', 'info')
        }}
        toast={toast}
      />

      <div className="main">
        {!selectedId || !manifest ? (
          <>
            <div className="editor-pane">
              <div className="empty-state">
                <div className="empty-icon">🎮</div>
                <h2>Flappy Forge</h2>
                <p>Выберите тему из списка или создайте новую, чтобы начать</p>
              </div>
            </div>
            <div className="preview-pane">
              <div className="empty-state">
                <div className="empty-icon">🖥️</div>
                <h2>Предпросмотр</h2>
                <p>Здесь появится игра после сборки</p>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Editor pane */}
            <div className="editor-pane">
              <div className="toolbar">
                <span className="toolbar-title">
                  {selectedTheme?.title ?? selectedId}
                </span>
                {isDirty && <span className="dirty-dot" title="Есть несохранённые изменения" />}
                <button className="btn btn-sm" onClick={handleSave} disabled={isSaving || !isDirty}>
                  {isSaving ? <><span className="spinner" />Сохранение…</> : 'Сохранить'}
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleBuild}
                  disabled={buildStatus === 'building'}
                >
                  {buildStatus === 'building'
                    ? <><span className="spinner" />Сборка…</>
                    : '▶ Собрать'}
                </button>
              </div>

              <div className="tab-bar">
                {(['basic', 'assets', 'json'] as Tab[]).map(t => (
                  <button
                    key={t}
                    className={`tab-btn${tab === t ? ' active' : ''}`}
                    onClick={() => setTab(t)}
                  >
                    {t === 'basic' ? '⚙ Настройки' : t === 'assets' ? '🖼 Ассеты' : '{ } JSON'}
                  </button>
                ))}
              </div>

              {tab === 'basic' && (
                <BasicSettings manifest={manifest} onChange={handleManifestChange} />
              )}
              {tab === 'assets' && selectedId && (
                <AssetsPanel
                  themeId={selectedId}
                  assets={assets}
                  onAssetsChange={handleAssetsChange}
                  toast={toast}
                />
              )}
              {tab === 'json' && (
                <JsonEditorPanel manifest={manifest} onChange={handleManifestChange} />
              )}
            </div>

            {/* Preview pane */}
            <PreviewPanel
              themeId={selectedId}
              isBuilt={selectedTheme?.isBuilt ?? false}
              previewKey={previewKey}
              buildLog={buildLog}
              buildStatus={buildStatus}
              onBuild={handleBuild}
            />
          </>
        )}
      </div>

      {/* Toast notifications */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.kind}`}>{t.text}</div>
        ))}
      </div>
    </div>
  )
}
