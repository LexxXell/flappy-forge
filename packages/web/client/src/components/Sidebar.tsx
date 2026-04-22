import { useState } from 'react'
import * as api from '../api'
import { useI18n } from '../i18n'
import type { LangMeta } from '../i18n'
import type { ThemeMeta, TokenPayload } from '../types'

interface Props {
  themes: ThemeMeta[]
  selectedId: string | null
  onSelect: (id: string) => void
  onCreated: (id: string) => void
  onDeleted: (id: string) => void
  toast: (text: string, kind?: 'success' | 'error' | 'info') => void
  user: TokenPayload
  onLogout: () => void
  onShowUsers: () => void
}

export default function Sidebar({ themes, selectedId, onSelect, onCreated, onDeleted, toast, user, onLogout, onShowUsers }: Props) {
  const { t, lang, available, setLang } = useI18n()
  const [showForm, setShowForm] = useState(false)
  const [newId, setNewId] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [creating, setCreating] = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newId.trim()) return
    setCreating(true)
    try {
      const id = newId.trim().toLowerCase()
      await api.createTheme(id, newTitle.trim() || id)
      toast(t('sidebar.toast.created', { id }), 'success')
      setShowForm(false)
      setNewId('')
      setNewTitle('')
      onCreated(id)
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (!confirm(t('sidebar.delete.confirm', { id }))) return
    try {
      await api.deleteTheme(id)
      onDeleted(id)
    } catch (err) {
      toast((err as Error).message, 'error')
    }
  }

  function handleLangChange(code: string) {
    localStorage.setItem('lang', code)
    setLang(code)
  }

  const isOwner = user.role === 'owner'

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="logo">🐦</span>
        <div style={{ flex: 1 }}>
          <h1>Flappy Forge</h1>
          <small>Game Builder</small>
        </div>
        <LangSwitcher current={lang} available={available} onChange={handleLangChange} />
      </div>

      <div className="sidebar-body">
        {themes.length === 0 && (
          <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text-2)', fontSize: 12 }}>
            {t('sidebar.noThemes')}
          </div>
        )}
        {themes.map(theme => (
          <div
            key={theme.id}
            className={`theme-item${selectedId === theme.id ? ' active' : ''}`}
            onClick={() => onSelect(theme.id)}
          >
            <span className="theme-item-icon">{theme.isBuilt ? '🎮' : '📝'}</span>
            <div className="theme-item-info">
              <div className="theme-item-title">{theme.title}</div>
              <div className="theme-item-id">
                {theme.id}
                {theme.createdBy && <span className="theme-creator"> · {theme.createdBy}</span>}
              </div>
            </div>
            <span className={`theme-item-badge ${theme.isBuilt ? 'badge-built' : 'badge-draft'}`}>
              {theme.isBuilt ? t('sidebar.badge.ready') : t('sidebar.badge.draft')}
            </span>
            <button
              className="theme-item-del"
              title="Delete"
              onClick={(e) => void handleDelete(e, theme.id)}
            >
              ×
            </button>
          </div>
        ))}

        {showForm && (
          <form className="new-theme-form" onSubmit={(e) => void handleCreate(e)}>
            <input
              autoFocus
              placeholder={t('sidebar.form.idPlaceholder')}
              value={newId}
              onChange={e => setNewId(e.target.value)}
              pattern="[a-z0-9_-]+"
              title="Lowercase letters, numbers, hyphens only"
              required
            />
            <input
              placeholder={t('sidebar.form.titlePlaceholder')}
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
            />
            <div className="new-theme-actions">
              <button type="submit" className="btn btn-primary btn-sm" disabled={creating} style={{ flex: 1 }}>
                {creating ? t('sidebar.form.creating') : t('sidebar.form.create')}
              </button>
              <button type="button" className="btn btn-sm" onClick={() => { setShowForm(false); setNewId(''); setNewTitle('') }}>
                ✕
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="sidebar-footer">
        {!showForm && (
          <button className="btn btn-sm" style={{ width: '100%' }} onClick={() => setShowForm(true)}>
            {t('sidebar.newTheme')}
          </button>
        )}
        <div className="user-bar">
          <div className="user-bar-info">
            <span className="user-bar-name">{user.sub}</span>
            <span className={`role-badge role-${user.role}`}>{user.role}</span>
          </div>
          <div className="user-bar-actions">
            {isOwner && (
              <button className="btn btn-sm" onClick={onShowUsers} title={t('users.title')}>
                👥
              </button>
            )}
            <button className="btn btn-sm" onClick={onLogout} title={t('auth.logout')}>
              ↩
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}

function LangSwitcher({ current, available, onChange }: {
  current: string
  available: LangMeta[]
  onChange: (code: string) => void
}) {
  if (available.length <= 1) return null
  return (
    <div className="lang-switcher">
      {available.map(l => (
        <button
          key={l.code}
          className={`lang-btn${l.code === current ? ' active' : ''}`}
          onClick={() => onChange(l.code)}
          title={l.name}
        >
          {l.code.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
