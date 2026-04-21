import { useEffect, useState } from 'react'
import type { Manifest } from '../types'

interface Props {
  manifest: Manifest
  onChange: (m: Manifest) => void
}

export default function JsonEditorPanel({ manifest, onChange }: Props) {
  const [text, setText] = useState(() => JSON.stringify(manifest, null, 2))
  const [error, setError] = useState<string | null>(null)

  // Sync from parent when manifest changes externally (switching themes)
  useEffect(() => {
    setText(JSON.stringify(manifest, null, 2))
    setError(null)
  }, [manifest.meta.id]) // only reset when theme changes, not on every edit

  function handleApply() {
    try {
      const parsed = JSON.parse(text) as Manifest
      setError(null)
      onChange(parsed)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  function handleFormat() {
    try {
      const parsed = JSON.parse(text)
      setText(JSON.stringify(parsed, null, 2))
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="json-editor-wrap">
      <textarea
        spellCheck={false}
        value={text}
        onChange={e => {
          setText(e.target.value)
          setError(null)
        }}
      />
      <div className="json-editor-footer">
        {error ? (
          <span className="json-error">⚠ {error}</span>
        ) : (
          <span style={{ flex: 1, fontSize: 12, color: 'var(--text-2)' }}>
            Редактируйте JSON напрямую, затем нажмите «Применить»
          </span>
        )}
        <button className="btn btn-sm" onClick={handleFormat}>Форматировать</button>
        <button className="btn btn-primary btn-sm" onClick={handleApply}>Применить</button>
      </div>
    </div>
  )
}
