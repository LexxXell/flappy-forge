import { useState } from 'react'
import * as api from '../api'
import type { ThemeMeta } from '../types'

interface Props {
  themes: ThemeMeta[]
  selectedId: string | null
  onSelect: (id: string) => void
  onCreated: (id: string) => void
  onDeleted: (id: string) => void
  toast: (text: string, kind?: 'success' | 'error' | 'info') => void
}

export default function Sidebar({ themes, selectedId, onSelect, onCreated, onDeleted, toast }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [newId, setNewId] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [creating, setCreating] = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newId.trim()) return
    setCreating(true)
    try {
      await api.createTheme(newId.trim().toLowerCase(), newTitle.trim() || newId.trim())
      toast(`Тема "${newId}" создана`, 'success')
      setShowForm(false)
      setNewId('')
      setNewTitle('')
      onCreated(newId.trim().toLowerCase())
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (!confirm(`Удалить тему "${id}"? Это действие необратимо.`)) return
    try {
      await api.deleteTheme(id)
      onDeleted(id)
    } catch (err) {
      toast((err as Error).message, 'error')
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="logo">🐦</span>
        <div>
          <h1>Flappy Forge</h1>
          <small>Game Builder</small>
        </div>
      </div>

      <div className="sidebar-body">
        {themes.length === 0 && (
          <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text-2)', fontSize: 12 }}>
            Нет тем. Создайте первую!
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
              <div className="theme-item-id">{theme.id}</div>
            </div>
            <span className={`theme-item-badge ${theme.isBuilt ? 'badge-built' : 'badge-draft'}`}>
              {theme.isBuilt ? 'ready' : 'draft'}
            </span>
            <button
              className="theme-item-del"
              title="Удалить тему"
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
              placeholder="id (example-game)"
              value={newId}
              onChange={e => setNewId(e.target.value)}
              pattern="[a-z0-9_-]+"
              title="Только строчные буквы, цифры, дефис"
              required
            />
            <input
              placeholder="Название (необязательно)"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
            />
            <div className="new-theme-actions">
              <button type="submit" className="btn btn-primary btn-sm" disabled={creating} style={{ flex: 1 }}>
                {creating ? 'Создание…' : 'Создать'}
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
            + Новая тема
          </button>
        )}
      </div>
    </aside>
  )
}
