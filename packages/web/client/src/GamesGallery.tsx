import { useEffect, useState } from 'react'
import * as api from './api'
import { useI18n } from './i18n'

interface Game { id: string; title: string }

export default function GamesGallery() {
  const { t } = useI18n()
  const [games, setGames] = useState<Game[]>([])
  const [selected, setSelected] = useState<Game | null>(null)

  useEffect(() => {
    api.getGames().then(setGames).catch(() => {})
  }, [])

  return (
    <div className="gallery-layout">
      <aside className="gallery-sidebar">
        <div className="sidebar-header">
          <span className="logo">🐦</span>
          <div style={{ flex: 1 }}>
            <h1>Flappy Forge</h1>
            <small>Games</small>
          </div>
        </div>

        <div className="sidebar-body">
          {games.length === 0 ? (
            <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text-2)', fontSize: 12 }}>
              {t('gallery.noGames')}
            </div>
          ) : (
            games.map(g => (
              <div
                key={g.id}
                className={`theme-item${selected?.id === g.id ? ' active' : ''}`}
                onClick={() => setSelected(g)}
              >
                <span className="theme-item-icon">🎮</span>
                <div className="theme-item-info">
                  <div className="theme-item-title">{g.title}</div>
                  <div className="theme-item-id">{g.id}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      <div className="gallery-main">
        {selected ? (
          <iframe
            key={selected.id}
            src={api.getPreviewUrl(selected.id)}
            title={selected.title}
            className="gallery-iframe"
            allow="autoplay"
          />
        ) : (
          <div className="empty-state">
            <div className="empty-icon">🎮</div>
            <h2>{t('gallery.selectTitle')}</h2>
            <p>{t('gallery.selectDesc')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
