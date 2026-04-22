import { useCallback, useEffect, useState } from 'react'
import * as api from './api'
import { useI18n } from './i18n'

interface Game { id: string; title: string }

interface Props {
  onShowLogin: () => void
}

export default function GamesGallery({ onShowLogin }: Props) {
  const { t } = useI18n()
  const [games, setGames] = useState<Game[]>([])
  const [selected, setSelected] = useState<Game | null>(null)
  const [loadError, setLoadError] = useState('')

  const loadGames = useCallback(async () => {
    setLoadError('')
    try {
      const list = await api.getGames()
      setGames(list)
      if (selected && !list.some(g => g.id === selected.id)) setSelected(null)
    } catch {
      setLoadError(t('gallery.loadError'))
    }
  }, [selected, t])

  useEffect(() => {
    void loadGames()
  }, [loadGames])

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
          {loadError ? (
            <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="login-error" style={{ margin: 0 }}>{loadError}</div>
              <button className="btn btn-sm" onClick={() => void loadGames()}>
                {t('gallery.retry')}
              </button>
            </div>
          ) : games.length === 0 ? (
            <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text-2)', fontSize: 12 }}>
              <div>{t('gallery.noGames')}</div>
              <div style={{ marginTop: 8, fontSize: 11 }}>{t('gallery.noGamesHint')}</div>
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

        <div className="sidebar-footer">
          <button className="btn btn-sm" style={{ width: '100%' }} onClick={onShowLogin}>
            {t('auth.login')}
          </button>
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
