let ysdk: any = null
let lb: any = null
let initPromise: Promise<void> | null = null
let scriptPromise: Promise<void> | null = null

type YandexInitState = 'idle' | 'loading' | 'ready' | 'unavailable'
let initState: YandexInitState = 'idle'

function loadScript(src: string): Promise<void> {
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise(resolve => {
    if (typeof document === 'undefined') {
      resolve()
      return
    }

    const existing = Array.from(document.getElementsByTagName('script')).find(s => s.src === src)
    if (existing) {
      if (typeof (window as any).YaGames !== 'undefined') {
        resolve()
        return
      }
      const done = () => resolve()
      existing.addEventListener('load', done, { once: true })
      existing.addEventListener('error', done, { once: true })
      window.setTimeout(done, 5000)
      return
    }

    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => resolve() // silently continue without SDK
    document.head.appendChild(s)
  })

  return scriptPromise
}

export function initYandex(): Promise<void> {
  if (initPromise) return initPromise

  if (typeof window === 'undefined') {
    initState = 'unavailable'
    initPromise = Promise.resolve()
    return initPromise
  }

  initState = 'loading'

  initPromise = (async () => {
    try {
      if (typeof (window as any).YaGames === 'undefined') {
        await loadScript('https://yandex.ru/games/sdk/v2')
      }
      if (typeof (window as any).YaGames !== 'undefined') {
        ysdk = await (window as any).YaGames.init()
        lb = await ysdk.getLeaderboards()
        initState = 'ready'
        return
      }

      initState = 'unavailable'
    } catch (e) {
      initState = 'unavailable'
      ysdk = null
      lb = null
      console.warn('Yandex SDK init failed:', e)
    }
  })()

  return initPromise
}

export async function submitScore(name: string, score: number): Promise<void> {
  if (!lb) return
  try {
    await lb.setLeaderboardScore(name, score)
  } catch (e) {
    console.warn('Submit score failed:', e)
  }
}

export interface LeaderboardEntry {
  rank: number
  name: string
  score: number
}

export async function getLeaderboard(name: string): Promise<LeaderboardEntry[]> {
  if (!lb) return []
  try {
    const res = await lb.getLeaderboardEntries(name, { quantityTop: 10 })
    return res.entries.map((e: any) => ({
      rank: e.rank,
      name: e.player.publicName || 'Anonymous',
      score: e.score,
    }))
  } catch (e) {
    console.warn('Get leaderboard failed:', e)
    return []
  }
}

export function isAvailable(): boolean {
  return initState === 'ready'
}

export function getInitState(): YandexInitState {
  return initState
}
