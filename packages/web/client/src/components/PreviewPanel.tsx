import { useEffect, useMemo, useRef } from 'react'
import AnsiToHtml from 'ansi-to-html'
import * as api from '../api'
import type { BuildEvent } from '../types'

const ansiConverter = new AnsiToHtml({
  fg: '#c9d1d9',
  bg: '#161b22',
  newline: false,
  escapeXML: true,
})

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

  const renderedLog = useMemo(() =>
    buildLog.map((evt, i) => {
      if (evt.type === 'start') {
        return { i, cls: 'log-start', html: escapeHtml(evt.text ?? '') }
      }
      if (evt.type === 'done') {
        return {
          i,
          cls: evt.success ? 'log-success' : 'log-error',
          html: escapeHtml(
            evt.success
              ? '✓ Сборка успешно завершена'
              : `✗ Сборка завершилась с кодом ${evt.code ?? '?'}`,
          ),
        }
      }
      return { i, cls: '', html: ansiConverter.toHtml(evt.text ?? '') }
    }),
  [buildLog])

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
            {renderedLog.length === 0 ? (
              <span style={{ color: 'var(--text-2)' }}>Лог появится после запуска сборки</span>
            ) : (
              renderedLog.map(({ i, cls, html }) => (
                <div
                  key={i}
                  className={`log-line${cls ? ` ${cls}` : ''}`}
                  // ansi-to-html escapes XML by default; start/done use escapeHtml
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              ))
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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
