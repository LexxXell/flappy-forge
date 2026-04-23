import { useEffect, useMemo, useRef } from 'react'
import AnsiToHtml from 'ansi-to-html'
import * as api from '../api'
import { useI18n } from '../i18n'
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
  canDownload: boolean
}

export default function PreviewPanel({ themeId, isBuilt, previewKey, buildLog, buildStatus, onBuild, canDownload }: Props) {
  const { t } = useI18n()
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [buildLog.length])

  const dotClass =
    buildStatus === 'building' ? 'dot-building'
    : buildStatus === 'success' ? 'dot-success'
    : buildStatus === 'error'   ? 'dot-error'
    : 'dot-idle'

  const statusLabel =
    buildStatus === 'building' ? t('preview.log.status.building')
    : buildStatus === 'success' ? t('preview.log.status.success')
    : buildStatus === 'error'   ? t('preview.log.status.error')
    : t('preview.log.status.idle')

  // ansi-to-html conversion is memoised; t() changes trigger re-render automatically
  const renderedLog = useMemo(() =>
    buildLog.map((evt, i) => {
      if (evt.type === 'start') {
        return { i, cls: 'log-start', html: escapeHtml(evt.text ?? '') }
      }
      if (evt.type === 'done') {
        const msg = evt.success
          ? t('preview.log.success')
          : t('preview.log.failed', { code: String(evt.code ?? '?') })
        return { i, cls: evt.success ? 'log-success' : 'log-error', html: escapeHtml(msg) }
      }
      return { i, cls: '', html: ansiConverter.toHtml(evt.text ?? '') }
    }),
  // t is stable per lang — including it invalidates memo only on lang change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [buildLog, t])

  return (
    <div className="preview-pane">
      <div className="preview-toolbar">
        <span className="preview-toolbar-title">{t('preview.title')}</span>
        <button className="btn btn-green btn-sm" onClick={onBuild} disabled={buildStatus === 'building'}>
          {buildStatus === 'building'
            ? <><span className="spinner" />{t('preview.log.status.building')}</>
            : isBuilt ? t('preview.rebuildBtn') : t('preview.buildBtn')}
        </button>
        {isBuilt && canDownload && (
          <a className="btn btn-sm" href={api.getDownloadUrl(themeId)} download={`${themeId}.zip`}>
            {t('preview.download')}
          </a>
        )}
      </div>

      <div className="preview-area">
        {/* Game iframe */}
        <div className="preview-iframe-wrap">
          {isBuilt ? (
            <iframe
              key={previewKey}
              src={api.getLivePreviewUrl(themeId, previewKey)}
              title="Game Preview"
              style={{ width: '100%', height: '100%', maxWidth: 480, maxHeight: 854, border: 'none' }}
              allow="autoplay"
            />
          ) : (
            <div className="preview-no-build">
              <div className="icon">🎮</div>
              <p>{buildStatus === 'building' ? t('preview.building') : t('preview.noBuild')}</p>
            </div>
          )}
        </div>

        {/* Build log */}
        <div className="build-log-panel">
          <div className="build-log-header">
            <div className={`build-status-dot ${dotClass}`} />
            {t('preview.log.title')} — {statusLabel}
          </div>

          <div className="build-log-output">
            {renderedLog.length === 0 ? (
              <span style={{ color: 'var(--text-2)' }}>{t('preview.log.empty')}</span>
            ) : (
              renderedLog.map(({ i, cls, html }) => (
                <div key={i} className={`log-line${cls ? ` ${cls}` : ''}`}
                  dangerouslySetInnerHTML={{ __html: html }} />
              ))
            )}
            <div ref={logEndRef} />
          </div>

          <div className="build-log-footer">
            {isBuilt && canDownload && buildStatus !== 'building' && (
              <a className="btn btn-sm" style={{ flex: 1, justifyContent: 'center' }}
                href={api.getDownloadUrl(themeId)} download={`${themeId}.zip`}>
                {t('preview.downloadYandex')}
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
