import Phaser from 'phaser'
import config from './config'
import type { GameConfig } from './types'
import { MenuScene } from './scenes/MenuScene'
import { GameScene } from './scenes/GameScene'
import { LeaderboardScene } from './scenes/LeaderboardScene'
import { initYandex } from './yandex'
import { hydrateState } from './state'
import { colorToCss, numberOr, resolveAutoCenter, resolveScaleMode } from './ui'

hydrateState()

// Non-blocking — initialises only when running on Yandex Games
initYandex()

const ASSET_EXT_RE = /\.(png|jpe?g|gif|webp|svg|bmp|ico|wav|mp3|ogg|m4a|aac|flac)$/i

interface LivePreviewContext {
  enabled: boolean
  themeId: string | null
  token: string | null
  version: string | null
}

function parseLivePreviewContext(): LivePreviewContext {
  const params = new URLSearchParams(window.location.search)
  const enabled = params.get('live') === '1'
  const token = params.get('token')
  const version = params.get('livev')
  const match = window.location.pathname.match(/^\/preview\/([^/]+)(?:\/|$)/)
  let themeId: string | null = null
  if (match) {
    try {
      themeId = decodeURIComponent(match[1])
    } catch {
      themeId = match[1]
    }
  }

  return {
    enabled,
    themeId,
    token,
    version,
  }
}

function isAssetReference(value: string): boolean {
  const trimmed = value.trim()
  if (!ASSET_EXT_RE.test(trimmed)) return false
  if (/^(?:https?:)?\/\//i.test(trimmed)) return false
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return false
  if (trimmed.startsWith('/')) return false
  return true
}

function normalizeAssetPath(value: string): string {
  const [withoutQuery] = value.split(/[?#]/, 1)
  const withoutDotPrefix = withoutQuery.replace(/^\.?\//, '')
  return withoutDotPrefix.startsWith('assets/') ? withoutDotPrefix.slice('assets/'.length) : withoutDotPrefix
}

function buildThemeAssetUrl(themeId: string, ref: string, token: string | null, version: string | null): string {
  const params = new URLSearchParams({
    path: normalizeAssetPath(ref),
  })
  if (token) params.set('token', token)
  if (version) params.set('v', version)
  return `/api/themes/${encodeURIComponent(themeId)}/asset-file?${params.toString()}`
}

function rewriteAssetReferences(value: unknown, ctx: LivePreviewContext): unknown {
  if (typeof value === 'string') {
    if (!ctx.themeId || !isAssetReference(value)) return value
    return buildThemeAssetUrl(ctx.themeId, value, ctx.token, ctx.version)
  }

  if (Array.isArray(value)) {
    return value.map(item => rewriteAssetReferences(item, ctx))
  }

  if (!value || typeof value !== 'object') return value

  const out: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    out[key] = rewriteAssetReferences(child, ctx)
  }
  return out
}

async function resolveRuntimeConfig(): Promise<GameConfig> {
  const live = parseLivePreviewContext()
  if (!live.enabled || !live.themeId) return config

  try {
    const params = new URLSearchParams()
    if (live.token) params.set('token', live.token)
    params.set('_', live.version ?? String(Date.now()))

    const res = await fetch(`/api/themes/${encodeURIComponent(live.themeId)}/manifest?${params.toString()}`)
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }

    const manifest = (await res.json()) as GameConfig
    return rewriteAssetReferences(manifest, live) as GameConfig
  } catch (err) {
    console.warn('Live preview config fetch failed, fallback to bundled config:', err)
    return config
  }
}

function createGame(runtimeConfig: GameConfig): void {
  document.title = runtimeConfig.meta.title

  const scenes: Phaser.Scene[] = []

  if (runtimeConfig.menu) {
    scenes.push(new MenuScene(runtimeConfig))
  }
  scenes.push(new GameScene(runtimeConfig))
  if (runtimeConfig.menu?.leaderboard) {
    scenes.push(new LeaderboardScene(runtimeConfig))
  }

  const canvas = runtimeConfig.canvas
  const canvasWidth = Math.max(1, Math.floor(numberOr(canvas?.width, 480)))
  const canvasHeight = Math.max(1, Math.floor(numberOr(canvas?.height, 640)))
  const canvasBg = colorToCss(canvas?.backgroundColor, '#87CEEB')
  const scaleZoom = Math.max(0.1, numberOr(canvas?.scale?.zoom, 1))

  new Phaser.Game({
    type: Phaser.AUTO,
    width: canvasWidth,
    height: canvasHeight,
    backgroundColor: canvasBg,
    physics: {
      default: 'arcade',
      arcade: { debug: false },
    },
    scene: scenes,
    parent: 'app',
    scale: {
      mode: resolveScaleMode(canvas?.scale?.mode),
      autoCenter: resolveAutoCenter(canvas?.scale?.autoCenter),
      zoom: scaleZoom,
    },
  })
}

async function bootstrap(): Promise<void> {
  const runtimeConfig = await resolveRuntimeConfig()
  createGame(runtimeConfig)
}

void bootstrap()
