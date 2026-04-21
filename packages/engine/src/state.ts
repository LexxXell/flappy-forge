const STORAGE_KEY = 'flappy-forge:state:v1'

interface PersistedState {
  muted: boolean
  customButtons: Record<string, boolean>
  bestScore: number
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function sanitizeCustomButtons(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== 'object') return {}

  const out: Record<string, boolean> = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === 'boolean') {
      out[key] = raw
    }
  }
  return out
}

function loadPersistedState(): Partial<PersistedState> {
  if (!canUseStorage()) return {}

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}

    const parsed = JSON.parse(raw) as Record<string, unknown>
    return {
      muted: typeof parsed.muted === 'boolean' ? parsed.muted : undefined,
      customButtons: sanitizeCustomButtons(parsed.customButtons),
      bestScore:
        typeof parsed.bestScore === 'number' && Number.isFinite(parsed.bestScore) && parsed.bestScore >= 0
          ? Math.floor(parsed.bestScore)
          : undefined,
    }
  } catch {
    return {}
  }
}

function persistState(): void {
  if (!canUseStorage()) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage might be blocked by browser policy; keep in-memory state working.
  }
}

export const state: PersistedState = {
  muted: false,
  customButtons: {},
  bestScore: 0,
}

export function hydrateState(): void {
  const persisted = loadPersistedState()

  if (typeof persisted.muted === 'boolean') {
    state.muted = persisted.muted
  }
  if (persisted.customButtons) {
    state.customButtons = persisted.customButtons
  }
  if (typeof persisted.bestScore === 'number') {
    state.bestScore = persisted.bestScore
  }
}

export function setMuted(value: boolean): void {
  state.muted = value
  persistState()
}

export function ensureCustomButton(id: string): void {
  if (id in state.customButtons) return
  state.customButtons[id] = false
  persistState()
}

export function toggleCustomButton(id: string): boolean {
  const next = !state.customButtons[id]
  state.customButtons[id] = next
  persistState()
  return next
}

export function updateBestScore(score: number): boolean {
  const normalized = Math.max(0, Math.floor(score))
  if (normalized <= state.bestScore) return false
  state.bestScore = normalized
  persistState()
  return true
}
