import { useEffect, useRef } from 'react'
import * as api from '../api'
import type { BuildEvent } from '../types'

interface Props {
  themeId: string
  isBuilt: boolean
  previewKey: number
  buildLog: BuildEvent[]
  buildStatus: 'idle' | 'building' | 'success' | 'error'
  onBuild: () => void
}

export default function PreviewPanel({ themeId, isBuilt, previewKey, buildLog, buildStatus, onBuild }: Props) {
  const logEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll log to bottom
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [buildLog.length])

  const dotClass =
    buildStatus === 'building' ? 'dot-building'
    : buildStatus === 'success' ? 'dot-success'
    : buildStatus === 'error' ? 'dot-error'
    : 'dot-idle'

  const statusLabel =
    buildStatus === 'building' ? 'Сборка…'
    : buildStatus === 'success' ? 'Готово'
    : buildStatus === 'error' ? 'Ошибка'
    : 'Ожидание'

  return (
    <div className="preview-pane">
      <div className="preview-toolbar">
        <span className="preview-toolbar-title">Предпросмотр</span>
        <button
          className="btn btn-green btn-sm"
          onClick={onBuild}
          disabled={buildStatus === 'building'}
        >
          {buildStatus === 'building'
            ? <><span className="spinner" /> Сборка…</>
            : isBuilt ? '🔄 Пересобрать' : '▶ Собрать и запустить'}
        </button>
        {isBuilt && (
          <a
            className="btn btn-sm"
            href={api.getDownloadUrl(themeId)}
            download={`${themeId}.zip`}
          >
            ⬇ Скачать ZIP
          </a>
        )}
      </div>

      <div className="preview-area">
        {/* Game iframe */}
        <div className="preview-iframe-wrap">
          {isBuilt ? (
            <iframe
              key={previewKey}
              src={api.getPreviewUrl(themeId)}
              title="Game Preview"
              style={{
                width: '100%',
                height: '100%',
                maxWidth: 480,
                maxHeight: 854,
                border: 'none',
              }}
              allow="autoplay"
            />
          ) : (
            <div className="preview-no-build">
              <div className="icon">🎮</div>
              <p>
                {buildStatus === 'building'
                  ? 'Сборка в процессе…'
                  : 'Нажмите «Собрать», чтобы запустить игру'}
              </p>
            </div>
          )}
        </div>

        {/* Build log */}
        <div className="build-log-panel">
          <div className="build-log-header">
            <div className={`build-status-dot ${dotClass}`} />
            Лог сборки — {statusLabel}
          </div>

          <div className="build-log-output">
            {buildLog.length === 0 ? (
              <span style={{ color: 'var(--text-2)' }}>Лог появится после запуска сборки</span>
            ) : (
              buildLog.map((evt, i) => {
                if (evt.type === 'start') {
                  return <div key={i} className="log-line log-start">{evt.text}</div>
                }
                if (evt.type === 'done') {
                  return (
                    <div key={i} className={`log-line ${evt.success ? 'log-success' : 'log-error'}`}>
                      {evt.success ? '✓ Сборка успешно завершена' : `✗ Сборка завершилась с кодом ${evt.code ?? '?'}`}
                    </div>
                  )
                }
                return (
                  <div key={i} className="log-line">
                    {evt.text}
                  </div>
                )
              })
            )}
            <div ref={logEndRef} />
          </div>

          <div className="build-log-footer">
            {isBuilt && buildStatus !== 'building' && (
              <a
                className="btn btn-sm"
                style={{ flex: 1, justifyContent: 'center' }}
                href={api.getDownloadUrl(themeId)}
                download={`${themeId}.zip`}
              >
                ⬇ Скачать для Yandex Games
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
