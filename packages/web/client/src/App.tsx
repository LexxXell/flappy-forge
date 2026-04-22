import { useCallback, useEffect, useRef, useState } from 'react'
import * as api from './api'
import { useAuth } from './AuthContext'
import { useI18n } from './i18n'
import type { BuildEvent, Manifest, ThemeMeta } from './types'
import Sidebar from './components/Sidebar'
import BasicSettings from './components/BasicSettings'
import AssetsPanel from './components/AssetsPanel'
import JsonEditorPanel from './components/JsonEditorPanel'
import PreviewPanel from './components/PreviewPanel'
import LoginPage from './LoginPage'
import UsersPanel from './UsersPanel'
import GamesGallery from './GamesGallery'

type Tab = 'basic' | 'assets' | 'json'

interface Toast { id: number; text: string; kind: 'success' | 'error' | 'info' }

let _toastId = 0

export default function App() {
  const { t, lang } = useI18n()
  const { user, logout } = useAuth()
  const canAccessEditor = Boolean(user && user.role !== 'user')

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
  const [showUsers, setShowUsers] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const stopBuildRef = useRef<(() => void) | null>(null)
  const prevAuthedRef = useRef(Boolean(user))

  const toast = useCallback((text: string, kind: Toast['kind'] = 'info') => {
    const id = ++_toastId
    setToasts(prev => [...prev, { id, text, kind }])
    setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), 3500)
  }, [])

  const loadThemes = useCallback(async () => {
    if (!canAccessEditor) return
    try { setThemes(await api.getThemes()) } catch {}
  }, [canAccessEditor])

  useEffect(() => { void loadThemes() }, [loadThemes])

  useEffect(() => {
    const isAuthed = Boolean(user)
    if (prevAuthedRef.current === isAuthed) return

    const rootPath = `/${lang}/`
    if (window.location.pathname !== rootPath) {
      history.replaceState(null, '', rootPath)
    }

    if (!isAuthed) {
      if (stopBuildRef.current) {
        stopBuildRef.current()
        stopBuildRef.current = null
      }
      setSelectedId(null)
      setManifest(null)
      setAssets([])
      setBuildLog([])
      setBuildStatus('idle')
      setShowUsers(false)
    }

    prevAuthedRef.current = isAuthed
  }, [lang, user])

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
      toast(t('toast.loadError', { msg: (e as Error).message }), 'error')
    }
  }, [t, toast])

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
      toast(t('toast.saved'), 'success')
      await loadThemes()
    } catch (e) {
      toast(t('toast.saveError', { msg: (e as Error).message }), 'error')
    } finally {
      setIsSaving(false)
    }
  }, [selectedId, manifest, t, toast, loadThemes])

  const handleBuild = useCallback(async () => {
    if (!selectedId || !manifest) return
    if (buildStatus === 'building') return

    if (isDirty) {
      setIsSaving(true)
      try {
        await api.saveManifest(selectedId, manifest)
        setIsDirty(false)
      } catch (e) {
        toast(t('toast.saveError', { msg: (e as Error).message }), 'error')
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
          toast(t('toast.buildDone'), 'success')
          void loadThemes()
        } else {
          setBuildStatus('error')
          toast(t('toast.buildError'), 'error')
        }
        stopBuildRef.current = null
      }
    })

    stopBuildRef.current = stop
  }, [selectedId, manifest, isDirty, buildStatus, t, toast, loadThemes])

  const handleAssetsChange = useCallback(async () => {
    if (!selectedId) return
    try { setAssets(await api.getAssets(selectedId)) } catch {}
  }, [selectedId])

  const selectedTheme = themes.find(th => th.id === selectedId)

  const TAB_LABELS: Record<Tab, string> = {
    basic: t('tab.settings'),
    assets: t('tab.assets'),
    json: t('tab.json'),
  }

  const canDownload = user?.role === 'owner' || user?.role === 'admin'

  if (!user || user.role === 'user') {
    return (
      <>
        <GamesGallery key={user?.sub ?? 'guest'} onShowLogin={() => setShowLogin(true)} />
        {showLogin && <LoginPage onClose={() => setShowLogin(false)} />}
      </>
    )
  }

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
          toast(t('toast.themeDeleted'), 'info')
        }}
        toast={toast}
        user={user}
        onLogout={logout}
        onShowUsers={() => setShowUsers(true)}
        onShowLogin={() => setShowLogin(true)}
      />

      <div className="main">
        {!selectedId || !manifest ? (
          <>
            <div className="editor-pane">
              <div className="empty-state">
                <div className="empty-icon">🎮</div>
                <h2>{t('app.empty.editorTitle')}</h2>
                <p>{t('app.empty.editorDesc')}</p>
              </div>
            </div>
            <div className="preview-pane">
              <div className="empty-state">
                <div className="empty-icon">🖥️</div>
                <h2>{t('app.empty.previewTitle')}</h2>
                <p>{t('app.empty.previewDesc')}</p>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="editor-pane">
              <div className="toolbar">
                <span className="toolbar-title">{selectedTheme?.title ?? selectedId}</span>
                {isDirty && <span className="dirty-dot" title={t('toolbar.unsaved')} />}
                <button className="btn btn-sm" onClick={handleSave} disabled={isSaving || !isDirty}>
                  {isSaving ? <><span className="spinner" />{t('toolbar.saving')}</> : t('toolbar.save')}
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleBuild}
                  disabled={buildStatus === 'building'}
                >
                  {buildStatus === 'building'
                    ? <><span className="spinner" />{t('toolbar.building')}</>
                    : t('toolbar.build')}
                </button>
              </div>

              <div className="tab-bar">
                {(['basic', 'assets', 'json'] as Tab[]).map(tabId => (
                  <button
                    key={tabId}
                    className={`tab-btn${tab === tabId ? ' active' : ''}`}
                    onClick={() => setTab(tabId)}
                  >
                    {TAB_LABELS[tabId]}
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

            <PreviewPanel
              themeId={selectedId}
              isBuilt={selectedTheme?.isBuilt ?? false}
              previewKey={previewKey}
              buildLog={buildLog}
              buildStatus={buildStatus}
              onBuild={handleBuild}
              canDownload={canDownload}
            />
          </>
        )}
      </div>

      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.kind}`}>{t.text}</div>
        ))}
      </div>

      {showUsers && <UsersPanel onClose={() => setShowUsers(false)} />}
      {showLogin && <LoginPage onClose={() => setShowLogin(false)} />}
    </div>
  )
}
