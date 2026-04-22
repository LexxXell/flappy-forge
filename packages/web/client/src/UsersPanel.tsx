import { useEffect, useState } from 'react'
import * as api from './api'
import { useI18n } from './i18n'
import type { UserInfo } from './types'

interface Props {
  onClose: () => void
}

export default function UsersPanel({ onClose }: Props) {
  const { t } = useI18n()
  const [users, setUsers] = useState<UserInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState<'admin' | 'creator'>('creator')
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState('')

  async function loadUsers() {
    setLoading(true)
    setError('')
    try {
      setUsers(await api.getUsers())
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadUsers() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    setCreating(true)
    try {
      await api.createUser(newUsername.trim(), newPassword, newRole)
      setNewUsername('')
      setNewPassword('')
      setNewRole('creator')
      await loadUsers()
    } catch (err) {
      setFormError((err as Error).message)
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: number, username: string) {
    if (!confirm(t('users.delete.confirm', { username }))) return
    try {
      await api.deleteUser(id)
      setUsers(prev => prev.filter(u => u.id !== id))
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('users.title')}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {error && <div className="login-error" style={{ marginBottom: 12 }}>{error}</div>}

          {loading ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-2)' }}>{t('users.loading')}</div>
          ) : (
            <table className="users-table">
              <thead>
                <tr>
                  <th>{t('users.col.username')}</th>
                  <th>{t('users.col.role')}</th>
                  <th>{t('users.col.createdBy')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-2)' }}>{t('users.empty')}</td></tr>
                )}
                {users.map(u => (
                  <tr key={u.id}>
                    <td>{u.username}</td>
                    <td><span className={`role-badge role-${u.role}`}>{u.role}</span></td>
                    <td style={{ color: 'var(--text-2)', fontSize: 12 }}>{u.createdBy}</td>
                    <td>
                      <button
                        className="btn btn-sm"
                        style={{ color: 'var(--red, #f85149)' }}
                        onClick={() => void handleDelete(u.id, u.username)}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <form className="user-create-form" onSubmit={(e) => void handleCreate(e)}>
            <h3>{t('users.create.title')}</h3>
            <div className="user-create-row">
              <input
                placeholder={t('users.create.username')}
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
                required
                minLength={2}
              />
              <input
                type="password"
                placeholder={t('users.create.password')}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
                minLength={4}
              />
              <select value={newRole} onChange={e => setNewRole(e.target.value as 'admin' | 'creator')}>
                <option value="creator">creator</option>
                <option value="admin">admin</option>
              </select>
              <button type="submit" className="btn btn-primary btn-sm" disabled={creating}>
                {creating ? t('users.create.creating') : t('users.create.add')}
              </button>
            </div>
            {formError && <div className="login-error" style={{ marginTop: 8 }}>{formError}</div>}
          </form>
        </div>
      </div>
    </div>
  )
}
