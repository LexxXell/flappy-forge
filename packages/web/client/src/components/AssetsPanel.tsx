import { useRef } from 'react'
import * as api from '../api'

interface AssetSlot {
  label: string
  key: string       // relative path in assets/
  type: 'image' | 'audio'
  dir?: string      // subdirectory (e.g. 'audio')
  accept: string
  required?: boolean
}

const SLOTS: AssetSlot[] = [
  { label: 'Фон', key: 'bg.png', type: 'image', accept: 'image/*', required: true },
  { label: 'Игрок', key: 'player.png', type: 'image', accept: 'image/*', required: true },
  { label: 'Труба (верх)', key: 'pipe-top.png', type: 'image', accept: 'image/*', required: true },
  { label: 'Труба (низ)', key: 'pipe-bottom.png', type: 'image', accept: 'image/*', required: true },
  { label: 'Монета', key: 'coin.png', type: 'image', accept: 'image/*' },
  { label: 'Музыка', key: 'audio/music-loop.wav', type: 'audio', dir: 'audio', accept: 'audio/*' },
  { label: 'Прыжок', key: 'audio/jump.wav', type: 'audio', dir: 'audio', accept: 'audio/*' },
  { label: 'Удар', key: 'audio/hit.wav', type: 'audio', dir: 'audio', accept: 'audio/*' },
  { label: 'Клик', key: 'audio/click.wav', type: 'audio', dir: 'audio', accept: 'audio/*' },
  { label: 'Монета (звук)', key: 'audio/coin.wav', type: 'audio', dir: 'audio', accept: 'audio/*' },
  { label: 'Очко', key: 'audio/point.wav', type: 'audio', dir: 'audio', accept: 'audio/*' },
  { label: 'Конец игры', key: 'audio/game-over.wav', type: 'audio', dir: 'audio', accept: 'audio/*' },
]

interface Props {
  themeId: string
  assets: string[]
  onAssetsChange: () => void
  toast: (text: string, kind?: 'success' | 'error' | 'info') => void
}

export default function AssetsPanel({ themeId, assets, onAssetsChange, toast }: Props) {
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  async function handleUpload(slot: AssetSlot, file: File) {
    // Rename uploaded file to the expected filename
    const expectedName = slot.key.split('/').pop()!
    const renamedFile = new File([file], expectedName, { type: file.type })

    try {
      await api.uploadAsset(themeId, renamedFile, slot.dir)
      toast(`${slot.label} загружен`, 'success')
      onAssetsChange()
    } catch (e) {
      toast(`Ошибка загрузки: ${(e as Error).message}`, 'error')
    }
  }

  async function handleDelete(slot: AssetSlot) {
    if (!confirm(`Удалить "${slot.label}"?`)) return
    try {
      await api.deleteAsset(themeId, slot.key)
      toast(`${slot.label} удалён`, 'info')
      onAssetsChange()
    } catch (e) {
      toast(`Ошибка: ${(e as Error).message}`, 'error')
    }
  }

  const assetSet = new Set(assets)

  return (
    <div className="form-scroll">
      <div className="form-section">
        <div className="form-section-title">Изображения</div>
        <div className="assets-grid">
          {SLOTS.filter(s => s.type === 'image').map(slot => (
            <AssetCard
              key={slot.key}
              slot={slot}
              exists={assetSet.has(slot.key)}
              themeId={themeId}
              inputRef={el => { fileInputRefs.current[slot.key] = el }}
              onUpload={handleUpload}
              onDelete={handleDelete}
            />
          ))}
        </div>
      </div>

      <div className="form-section">
        <div className="form-section-title">Аудио</div>
        <div className="assets-grid">
          {SLOTS.filter(s => s.type === 'audio').map(slot => (
            <AssetCard
              key={slot.key}
              slot={slot}
              exists={assetSet.has(slot.key)}
              themeId={themeId}
              inputRef={el => { fileInputRefs.current[slot.key] = el }}
              onUpload={handleUpload}
              onDelete={handleDelete}
            />
          ))}
        </div>
      </div>

      <div className="form-section">
        <div className="form-section-title" style={{ marginBottom: 6 }}>Все файлы темы</div>
        {assets.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-2)' }}>Нет загруженных файлов (будут созданы заглушки при сборке)</div>
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
  inputRef: (el: HTMLInputElement | null) => void
  onUpload: (slot: AssetSlot, file: File) => void
  onDelete: (slot: AssetSlot) => void
}

function AssetCard({ slot, exists, themeId, inputRef, onUpload, onDelete }: CardProps) {
  return (
    <div className="asset-card">
      <div className="asset-card-label">
        {slot.label}
        {slot.required && <span style={{ color: 'var(--accent)', marginLeft: 3 }}>*</span>}
      </div>

      {slot.type === 'image' ? (
        exists ? (
          <AssetImagePreview themeId={themeId} assetKey={slot.key} />
        ) : (
          <div className="asset-no-file">нет файла</div>
        )
      ) : (
        <div className="asset-preview-audio">
          {exists ? '🎵' : '🔇'}
        </div>
      )}

      <div className="asset-filename">{exists ? slot.key.split('/').pop() : '—'}</div>

      <div className="asset-actions">
        <label className="btn btn-sm asset-upload-btn" style={{ flex: 1, justifyContent: 'center' }}>
          {exists ? '🔄 Заменить' : '⬆ Загрузить'}
          <input
            type="file"
            accept={slot.accept}
            ref={inputRef}
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) { void onUpload(slot, f) }
              e.target.value = ''
            }}
          />
        </label>
        {exists && (
          <button className="btn btn-sm btn-red" title="Удалить" onClick={() => void onDelete(slot)}>
            ✕
          </button>
        )}
      </div>
    </div>
  )
}

// Show image preview by fetching asset from the server
function AssetImagePreview({ themeId, assetKey }: { themeId: string; assetKey: string }) {
  // We serve theme assets directly via a dedicated endpoint
  const src = `/api/themes/${themeId}/asset-file?path=${encodeURIComponent(assetKey)}`
  return (
    <img
      className="asset-preview"
      src={src}
      alt={assetKey}
      onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
    />
  )
}

