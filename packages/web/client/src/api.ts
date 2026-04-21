import type { BuildEvent, Manifest, ThemeMeta } from './types'

const BASE = '/api'

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((err as { error?: string }).error ?? res.statusText)
  }
  return res.json() as Promise<T>
}

export async function getThemes(): Promise<ThemeMeta[]> {
  return json(await fetch(`${BASE}/themes`))
}

export async function createTheme(id: string, title: string): Promise<{ id: string; title: string }> {
  return json(
    await fetch(`${BASE}/themes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, title }),
    }),
  )
}

export async function deleteTheme(id: string): Promise<void> {
  await json(await fetch(`${BASE}/themes/${id}`, { method: 'DELETE' }))
}

export async function getManifest(id: string): Promise<Manifest> {
  return json(await fetch(`${BASE}/themes/${id}/manifest`))
}

export async function saveManifest(id: string, manifest: Manifest): Promise<void> {
  await json(
    await fetch(`${BASE}/themes/${id}/manifest`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(manifest),
    }),
  )
}

export async function getAssets(id: string): Promise<string[]> {
  return json(await fetch(`${BASE}/themes/${id}/assets`))
}

export async function uploadAsset(themeId: string, file: File, dir?: string): Promise<{ path: string }> {
  const fd = new FormData()
  fd.append('file', file)
  const url = `${BASE}/themes/${themeId}/assets${dir ? `?dir=${encodeURIComponent(dir)}` : ''}`
  return json(await fetch(url, { method: 'POST', body: fd }))
}

export async function deleteAsset(themeId: string, relPath: string): Promise<void> {
  await json(
    await fetch(`${BASE}/themes/${themeId}/assets?path=${encodeURIComponent(relPath)}`, {
      method: 'DELETE',
    }),
  )
}

export function startBuild(id: string, onEvent: (e: BuildEvent) => void): () => void {
  const es = new EventSource(`${BASE}/themes/${id}/build`)
  let finished = false

  es.onmessage = (e) => {
    try {
      const evt = JSON.parse(e.data as string) as BuildEvent
      if (evt.type === 'done') finished = true
      onEvent(evt)
    } catch {}
  }
  // EventSource fires onerror both on real errors AND when server closes
  // the connection normally. Only report failure if we never got a done event.
  es.onerror = () => {
    if (!finished) onEvent({ type: 'done', code: -1, success: false })
    es.close()
  }
  return () => es.close()
}

export function getPreviewUrl(id: string): string {
  return `/preview/${id}/`
}

export function getDownloadUrl(id: string): string {
  return `${BASE}/themes/${id}/download`
}
