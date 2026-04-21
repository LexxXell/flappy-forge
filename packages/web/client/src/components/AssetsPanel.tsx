import { useRef } from 'react'
import * as api from '../api'
import { useI18n } from '../i18n'

interface AssetSlot {
  labelKey: string
  key: string
  type: 'image' | 'audio'
  dir?: string
  accept: string
  required?: boolean
}

const SLOTS: AssetSlot[] = [
  { labelKey: 'assets.slot.bg',         key: 'bg.png',              type: 'image', accept: 'image/*', required: true },
  { labelKey: 'assets.slot.player',     key: 'player.png',          type: 'image', accept: 'image/*', required: true },
  { labelKey: 'assets.slot.pipeTop',    key: 'pipe-top.png',        type: 'image', accept: 'image/*', required: true },
  { labelKey: 'assets.slot.pipeBottom', key: 'pipe-bottom.png',     type: 'image', accept: 'image/*', required: true },
  { labelKey: 'assets.slot.coin',       key: 'coin.png',            type: 'image', accept: 'image/*' },
  { labelKey: 'assets.slot.music',      key: 'audio/music-loop.wav', type: 'audio', dir: 'audio', accept: 'audio/*' },
  { labelKey: 'assets.slot.jump',       key: 'audio/jump.wav',      type: 'audio', dir: 'audio', accept: 'audio/*' },
  { labelKey: 'assets.slot.hit',        key: 'audio/hit.wav',       type: 'audio', dir: 'audio', accept: 'audio/*' },
  { labelKey: 'assets.slot.click',      key: 'audio/click.wav',     type: 'audio', dir: 'audio', accept: 'audio/*' },
  { labelKey: 'assets.slot.coinSfx',    key: 'audio/coin.wav',      type: 'audio', dir: 'audio', accept: 'audio/*' },
  { labelKey: 'assets.slot.point',      key: 'audio/point.wav',     type: 'audio', dir: 'audio', accept: 'audio/*' },
  { labelKey: 'assets.slot.gameOver',   key: 'audio/game-over.wav', type: 'audio', dir: 'audio', accept: 'audio/*' },
]

interface Props {
  themeId: string
  assets: string[]
  onAssetsChange: () => void
  toast: (text: string, kind?: 'success' | 'error' | 'info') => void
}

export default function AssetsPanel({ themeId, assets, onAssetsChange, toast }: Props) {
  const { t } = useI18n()
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const assetSet = new Set(assets)

  async function handleUpload(slot: AssetSlot, file: File) {
    const label = t(slot.labelKey)
    const expectedName = slot.key.split('/').pop()!
    const renamedFile = new File([file], expectedName, { type: file.type })
    try {
      await api.uploadAsset(themeId, renamedFile, slot.dir)
      toast(t('assets.toast.uploaded', { label }), 'success')
      onAssetsChange()
    } catch (e) {
      toast(t('assets.toast.uploadError', { msg: (e as Error).message }), 'error')
    }
  }

  async function handleDelete(slot: AssetSlot) {
    const label = t(slot.labelKey)
    if (!confirm(t('assets.delete.confirm', { label }))) return
    try {
      await api.deleteAsset(themeId, slot.key)
      toast(t('assets.toast.deleted', { label }), 'info')
      onAssetsChange()
    } catch (e) {
      toast(t('assets.toast.deleteError', { msg: (e as Error).message }), 'error')
    }
  }

  return (
    <div className="form-scroll">
      <div className="form-section">
        <div className="form-section-title">{t('assets.section.images')}</div>
        <div className="assets-grid">
          {SLOTS.filter(s => s.type === 'image').map(slot => (
            <AssetCard key={slot.key} slot={slot} exists={assetSet.has(slot.key)}
              themeId={themeId} t={t}
              inputRef={el => { fileInputRefs.current[slot.key] = el }}
              onUpload={handleUpload} onDelete={handleDelete} />
          ))}
        </div>
      </div>

      <div className="form-section">
        <div className="form-section-title">{t('assets.section.audio')}</div>
        <div className="assets-grid">
          {SLOTS.filter(s => s.type === 'audio').map(slot => (
            <AssetCard key={slot.key} slot={slot} exists={assetSet.has(slot.key)}
              themeId={themeId} t={t}
              inputRef={el => { fileInputRefs.current[slot.key] = el }}
              onUpload={handleUpload} onDelete={handleDelete} />
          ))}
        </div>
      </div>

      <div className="form-section">
        <div className="form-section-title" style={{ marginBottom: 6 }}>{t('assets.section.all')}</div>
        {assets.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{t('assets.noFiles')}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {assets.map(f => (
              <div key={f} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)', padding: '2px 0' }}>
                {f}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface CardProps {
  slot: AssetSlot
  exists: boolean
  themeId: string
  t: (key: string, vars?: Record<string, string>) => string
  inputRef: (el: HTMLInputElement | null) => void
  onUpload: (slot: AssetSlot, file: File) => void
  onDelete: (slot: AssetSlot) => void
}

function AssetCard({ slot, exists, themeId, t, inputRef, onUpload, onDelete }: CardProps) {
  return (
    <div className="asset-card">
      <div className="asset-card-label">
        {t(slot.labelKey)}
        {slot.required && <span style={{ color: 'var(--accent)', marginLeft: 3 }}>*</span>}
      </div>

      {slot.type === 'image' ? (
        exists
          ? <img className="asset-preview"
              src={`/api/themes/${themeId}/asset-file?path=${encodeURIComponent(slot.key)}`}
              alt={slot.key}
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
            />
          : <div className="asset-no-file">{t('assets.noFile')}</div>
      ) : (
        <div className="asset-preview-audio">{exists ? '🎵' : '🔇'}</div>
      )}

      <div className="asset-filename">{exists ? slot.key.split('/').pop() : '—'}</div>

      <div className="asset-actions">
        <label className="btn btn-sm asset-upload-btn" style={{ flex: 1, justifyContent: 'center' }}>
          {exists ? t('assets.replace') : t('assets.upload')}
          <input type="file" accept={slot.accept} ref={inputRef}
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) void onUpload(slot, f)
              e.target.value = ''
            }}
          />
        </label>
        {exists && (
          <button className="btn btn-sm btn-red" title="Delete" onClick={() => void onDelete(slot)}>✕</button>
        )}
      </div>
    </div>
  )
}
