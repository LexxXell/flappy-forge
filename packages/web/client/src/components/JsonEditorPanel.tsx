import { useEffect, useState } from 'react'
import { useI18n } from '../i18n'
import type { Manifest } from '../types'

interface Props {
  manifest: Manifest
  onChange: (m: Manifest) => void
}

export default function JsonEditorPanel({ manifest, onChange }: Props) {
  const { t } = useI18n()
  const [text, setText] = useState(() => JSON.stringify(manifest, null, 2))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setText(JSON.stringify(manifest, null, 2))
    setError(null)
  }, [manifest.meta.id])

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
      setText(JSON.stringify(JSON.parse(text), null, 2))
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
        onChange={e => { setText(e.target.value); setError(null) }}
      />
      <div className="json-editor-footer">
        {error ? (
          <span className="json-error">⚠ {error}</span>
        ) : (
          <span style={{ flex: 1, fontSize: 12, color: 'var(--text-2)' }}>{t('json.hint')}</span>
        )}
        <button className="btn btn-sm" onClick={handleFormat}>{t('json.format')}</button>
        <button className="btn btn-primary btn-sm" onClick={handleApply}>{t('json.apply')}</button>
      </div>
    </div>
  )
}
