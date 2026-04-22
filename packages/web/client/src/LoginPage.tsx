import { useState } from 'react'
import { useAuth } from './AuthContext'
import { useI18n } from './i18n'

export default function LoginPage() {
  const { login } = useAuth()
  const { t } = useI18n()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-overlay">
      <form className="login-card" onSubmit={(e) => void handleSubmit(e)}>
        <div className="login-logo">
          <span>🐦</span>
          <h1>Flappy Forge</h1>
        </div>

        <div className="form-group">
          <label>{t('auth.username')}</label>
          <input
            type="text"
            autoComplete="username"
            autoFocus
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label>{t('auth.password')}</label>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
        </div>

        {error && <div className="login-error">{error}</div>}

        <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
          {loading ? t('auth.loggingIn') : t('auth.login')}
        </button>
      </form>
    </div>
  )
}
