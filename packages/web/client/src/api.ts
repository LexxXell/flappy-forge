import type { BuildEvent, Manifest, ThemeMeta, TokenPayload, UserInfo } from './types'

const BASE = '/api'

// ---------------------------------------------------------------------------
// Token storage
// ---------------------------------------------------------------------------

export function getToken(): string | null {
  return localStorage.getItem('token')
}

export function setToken(token: string): void {
  localStorage.setItem('token', token)
}

export function clearToken(): void {
  localStorage.removeItem('token')
}

export function decodeToken(token: string): TokenPayload | null {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(atob(payload)) as TokenPayload
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

type OnUnauthorized = () => void
let onUnauthorized: OnUnauthorized | null = null

export function registerUnauthorizedHandler(fn: OnUnauthorized): void {
  onUnauthorized = fn
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getToken()
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  }
}

async function json<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    onUnauthorized?.()
    throw new Error('Unauthorized')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((err as { error?: string }).error ?? res.statusText)
  }
  return res.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// Auth API
// ---------------------------------------------------------------------------

export async function login(username: string, password: string): Promise<string> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const data = await json<{ token: string }>(res)
  return data.token
}

export async function getMe(): Promise<TokenPayload> {
  return json(await fetch(`${BASE}/auth/me`, { headers: authHeaders() }))
}

// ---------------------------------------------------------------------------
// User management API
// ---------------------------------------------------------------------------

export async function getUsers(): Promise<UserInfo[]> {
  return json(await fetch(`${BASE}/users`, { headers: authHeaders() }))
}

export async function createUser(username: string, password: string, role: 'admin' | 'creator'): Promise<UserInfo> {
  return json(
    await fetch(`${BASE}/users`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ username, password, role }),
    }),
  )
}

export async function deleteUser(id: number): Promise<void> {
  await json(await fetch(`${BASE}/users/${id}`, { method: 'DELETE', headers: authHeaders() }))
}

// ---------------------------------------------------------------------------
// Theme API
// ---------------------------------------------------------------------------

export async function getThemes(): Promise<ThemeMeta[]> {
  return json(await fetch(`${BASE}/themes`, { headers: authHeaders() }))
}

export async function createTheme(id: string, title: string): Promise<{ id: string; title: string }> {
  return json(
    await fetch(`${BASE}/themes`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ id, title }),
    }),
  )
}

export async function deleteTheme(id: string): Promise<void> {
  await json(await fetch(`${BASE}/themes/${id}`, { method: 'DELETE', headers: authHeaders() }))
}

export async function getManifest(id: string): Promise<Manifest> {
  return json(await fetch(`${BASE}/themes/${id}/manifest`, { headers: authHeaders() }))
}

export async function saveManifest(id: string, manifest: Manifest): Promise<void> {
  await json(
    await fetch(`${BASE}/themes/${id}/manifest`, {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(manifest),
    }),
  )
}

export async function getAssets(id: string): Promise<string[]> {
  return json(await fetch(`${BASE}/themes/${id}/assets`, { headers: authHeaders() }))
}

export async function uploadAsset(themeId: string, file: File, dir?: string): Promise<{ path: string }> {
  const fd = new FormData()
  fd.append('file', file)
  const url = `${BASE}/themes/${themeId}/assets${dir ? `?dir=${encodeURIComponent(dir)}` : ''}`
  return json(await fetch(url, { method: 'POST', headers: authHeaders(), body: fd }))
}

export async function deleteAsset(themeId: string, relPath: string): Promise<void> {
  await json(
    await fetch(`${BASE}/themes/${themeId}/assets?path=${encodeURIComponent(relPath)}`, {
      method: 'DELETE',
      headers: authHeaders(),
    }),
  )
}

// ---------------------------------------------------------------------------
// Build (SSE) — passes token as query param since EventSource has no headers
// ---------------------------------------------------------------------------

export function startBuild(id: string, onEvent: (e: BuildEvent) => void): () => void {
  const token = getToken()
  const qs = token ? `?token=${encodeURIComponent(token)}` : ''
  const es = new EventSource(`${BASE}/themes/${id}/build${qs}`)
  let finished = false

  es.onmessage = (e) => {
    try {
      const evt = JSON.parse(e.data as string) as BuildEvent
      if (evt.type === 'done') finished = true
      onEvent(evt)
    } catch {}
  }
  es.onerror = () => {
    if (!finished) onEvent({ type: 'done', code: -1, success: false })
    es.close()
  }
  return () => es.close()
}

// ---------------------------------------------------------------------------
// URLs
// ---------------------------------------------------------------------------

export function getPreviewUrl(id: string): string {
  return `/preview/${id}/`
}

export function getDownloadUrl(id: string): string {
  const token = getToken()
  const qs = token ? `?token=${encodeURIComponent(token)}` : ''
  return `${BASE}/themes/${id}/download${qs}`
}
