import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import zlib from 'zlib'

// ---------------------------------------------------------------------------
// Minimal PNG generator (no deps, Node built-ins only)
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[i] = c
  }
  return t
})()

function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function pngChunk(type: string, data: Buffer): Buffer {
  const t = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0)
  return Buffer.concat([len, t, data, crc])
}

function makePNG(w: number, h: number, r: number, g: number, b: number): Buffer {
  // Build raw scanlines: 1 filter byte + RGB pixels per row
  const raw = Buffer.alloc((1 + w * 3) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0 // filter: None
    for (let x = 0; x < w; x++) {
      const i = y * (1 + w * 3) + 1 + x * 3
      raw[i] = r
      raw[i + 1] = g
      raw[i + 2] = b
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8  // bit depth
  ihdr[9] = 2  // color type: RGB
  // bytes 10-12: compression=0, filter=0, interlace=0

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

// ---------------------------------------------------------------------------
// Placeholder assets (generated if not present in theme)
// ---------------------------------------------------------------------------

const PLACEHOLDERS: Array<{ file: string; w: number; h: number; rgb: [number, number, number] }> = [
  { file: 'bg.png',          w: 480, h: 640, rgb: [80, 160, 220] },
  { file: 'player.png',      w: 44,  h: 32,  rgb: [255, 210, 30] },
  { file: 'pipe-top.png',    w: 64,  h: 640, rgb: [50, 168, 82]  },
  { file: 'pipe-bottom.png', w: 64,  h: 640, rgb: [50, 168, 82]  },
]

function ensurePlaceholders(assetsDir: string) {
  fs.mkdirSync(assetsDir, { recursive: true })
  for (const { file, w, h, rgb } of PLACEHOLDERS) {
    const fp = path.join(assetsDir, file)
    if (!fs.existsSync(fp)) {
      fs.writeFileSync(fp, makePNG(w, h, rgb[0], rgb[1], rgb[2]))
      console.log(`  generated placeholder: ${file}`)
    }
  }
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

const ROOT = process.cwd()
const THEMES_DIR = path.join(ROOT, 'themes')
const ENGINE_DIR = path.join(ROOT, 'packages/engine')
const BUILDS_DIR = path.join(ROOT, 'builds')

interface Manifest {
  meta: { id: string; title: string }
  physics: { gravity: number; jumpForce: number; speed: number }
  spawn: { interval: number; gapMin: number; gapMax: number }
  assets: { bg: string; player: string; pipeTop: string; pipeBottom: string; coin?: string; music?: string }
  audio?: {
    music?: { src?: string; volume?: number; rate?: number; loop?: boolean; autoplay?: boolean }
    sfx?: Record<string, { src: string; volume?: number; rate?: number; loop?: boolean }>
    bindings?: Record<string, unknown>
  }
  player: { width: number; height: number }
}

type AnyRecord = Record<string, unknown>

const AUDIO_BINDING_EVENTS = new Set([
  'game:start',
  'game:over',
  'player:jump',
  'player:collision',
  'obstacle:passed',
  'coin:collected',
  'tick',
  'menu:start:click',
  'menu:leaderboard:click',
  'menu:mute:toggle',
  'menu:custom:toggle',
  'game:retry:click',
  'game:menu:click',
  'leaderboard:back:click',
])

function isRecord(value: unknown): value is AnyRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function fail(theme: string, path: string, message: string): never {
  throw new Error(`[${theme}] ${path}: ${message}`)
}

function assertObject(
  value: unknown,
  path: string,
  theme: string,
  required: boolean = true,
): AnyRecord | undefined {
  if (value === undefined || value === null) {
    if (!required) return undefined
    fail(theme, path, 'is required')
  }
  if (!isRecord(value)) {
    fail(theme, path, 'must be an object')
  }
  return value
}

function assertString(
  value: unknown,
  path: string,
  theme: string,
  required: boolean = true,
): string | undefined {
  if (value === undefined || value === null) {
    if (!required) return undefined
    fail(theme, path, 'is required')
  }
  if (typeof value !== 'string') {
    fail(theme, path, 'must be a string')
  }
  if (required && value.trim().length === 0) {
    fail(theme, path, 'must be a non-empty string')
  }
  return value
}

function assertNumber(
  value: unknown,
  path: string,
  theme: string,
  options: { required?: boolean; min?: number; max?: number } = {},
): number | undefined {
  const { required = true, min, max } = options
  if (value === undefined || value === null) {
    if (!required) return undefined
    fail(theme, path, 'is required')
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(theme, path, 'must be a finite number')
  }

  if (min !== undefined && value < min) {
    fail(theme, path, `must be >= ${min}`)
  }
  if (max !== undefined && value > max) {
    fail(theme, path, `must be <= ${max}`)
  }
  return value
}

function assertBoolean(value: unknown, path: string, theme: string, required = false): boolean | undefined {
  if (value === undefined || value === null) {
    if (!required) return undefined
    fail(theme, path, 'is required')
  }
  if (typeof value !== 'boolean') {
    fail(theme, path, 'must be a boolean')
  }
  return value
}

function isColorValue(value: unknown): boolean {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value >= 0 && value <= 0xffffff
  }
  if (typeof value !== 'string') return false
  const hex = value.trim().replace(/^#/, '').replace(/^0x/i, '')
  return /^[0-9a-fA-F]{6}$/.test(hex)
}

function assertColor(value: unknown, path: string, theme: string, required = false): void {
  if (value === undefined || value === null) {
    if (!required) return
    fail(theme, path, 'is required')
  }
  if (!isColorValue(value)) {
    fail(theme, path, 'must be a hex string (#RRGGBB / 0xRRGGBB) or number in range 0..0xFFFFFF')
  }
}

function assertButtonConfig(value: unknown, path: string, theme: string, required = false): void {
  const obj = assertObject(value, path, theme, required)
  if (!obj) return

  assertString(obj.text, `${path}.text`, theme, false)
  assertString(obj.image, `${path}.image`, theme, false)
  assertNumber(obj.x, `${path}.x`, theme, { required: false, min: 0 })
  assertNumber(obj.y, `${path}.y`, theme, { required: false, min: 0 })
  assertButtonStyleConfig(obj.style, `${path}.style`, theme)
}

function assertPaddingConfig(value: unknown, path: string, theme: string): void {
  const obj = assertObject(value, path, theme, false)
  if (!obj) return
  assertNumber(obj.left, `${path}.left`, theme, { required: false, min: 0 })
  assertNumber(obj.right, `${path}.right`, theme, { required: false, min: 0 })
  assertNumber(obj.top, `${path}.top`, theme, { required: false, min: 0 })
  assertNumber(obj.bottom, `${path}.bottom`, theme, { required: false, min: 0 })
}

function assertTextStyleConfig(value: unknown, path: string, theme: string): void {
  const obj = assertObject(value, path, theme, false)
  if (!obj) return

  assertString(obj.fontFamily, `${path}.fontFamily`, theme, false)
  if (obj.fontSize !== undefined) {
    if (typeof obj.fontSize !== 'number' && typeof obj.fontSize !== 'string') {
      fail(theme, `${path}.fontSize`, 'must be number or string')
    }
    if (typeof obj.fontSize === 'number' && obj.fontSize <= 0) {
      fail(theme, `${path}.fontSize`, 'must be > 0')
    }
  }
  assertColor(obj.color, `${path}.color`, theme, false)
  assertColor(obj.backgroundColor, `${path}.backgroundColor`, theme, false)
  assertColor(obj.stroke, `${path}.stroke`, theme, false)
  assertNumber(obj.strokeThickness, `${path}.strokeThickness`, theme, { required: false, min: 0 })
  assertString(obj.fontStyle, `${path}.fontStyle`, theme, false)
  if (obj.align !== undefined && obj.align !== 'left' && obj.align !== 'center' && obj.align !== 'right') {
    fail(theme, `${path}.align`, 'must be one of: left, center, right')
  }
  assertPaddingConfig(obj.padding, `${path}.padding`, theme)
}

function assertButtonStyleConfig(value: unknown, path: string, theme: string): void {
  const obj = assertObject(value, path, theme, false)
  if (!obj) return

  assertTextStyleConfig(obj.text, `${path}.text`, theme)
  assertTextStyleConfig(obj.hoverText, `${path}.hoverText`, theme)
  assertColor(obj.imageHoverTint, `${path}.imageHoverTint`, theme, false)
  assertNumber(obj.imageHoverAlpha, `${path}.imageHoverAlpha`, theme, { required: false, min: 0, max: 1 })
  assertNumber(obj.disabledAlpha, `${path}.disabledAlpha`, theme, { required: false, min: 0, max: 1 })
}

function assertPanelBackgroundConfig(value: unknown, path: string, theme: string): void {
  const obj = assertObject(value, path, theme, false)
  if (!obj) return

  assertString(obj.image, `${path}.image`, theme, false)
  assertColor(obj.color, `${path}.color`, theme, false)
  assertNumber(obj.alpha, `${path}.alpha`, theme, { required: false, min: 0, max: 1 })
  assertColor(obj.strokeColor, `${path}.strokeColor`, theme, false)
  assertNumber(obj.strokeAlpha, `${path}.strokeAlpha`, theme, { required: false, min: 0, max: 1 })
  assertNumber(obj.strokeWidth, `${path}.strokeWidth`, theme, { required: false, min: 0 })
}

function assertPanelLayoutConfig(value: unknown, path: string, theme: string): void {
  const obj = assertObject(value, path, theme, false)
  if (!obj) return

  assertNumber(obj.x, `${path}.x`, theme, { required: false })
  assertNumber(obj.y, `${path}.y`, theme, { required: false })
  assertNumber(obj.width, `${path}.width`, theme, { required: false, min: 0.01 })
  assertNumber(obj.height, `${path}.height`, theme, { required: false, min: 0.01 })
  assertNumber(obj.padding, `${path}.padding`, theme, { required: false, min: 0 })
  assertPanelBackgroundConfig(obj.background, `${path}.background`, theme)
}

function assertStyledButtonConfig(value: unknown, path: string, theme: string): void {
  const obj = assertObject(value, path, theme, false)
  if (!obj) return
  assertButtonConfig(obj, path, theme, false)
  assertButtonStyleConfig(obj.style, `${path}.style`, theme)
}

function assertAudioClipConfig(
  value: unknown,
  path: string,
  theme: string,
  options: { requiredSrc: boolean; allowAutoplay: boolean },
): void {
  const obj = assertObject(value, path, theme, false)
  if (!obj) return

  assertString(obj.src, `${path}.src`, theme, options.requiredSrc)
  assertNumber(obj.volume, `${path}.volume`, theme, { required: false, min: 0, max: 1 })
  assertNumber(obj.rate, `${path}.rate`, theme, { required: false, min: 0.1, max: 4 })
  assertBoolean(obj.loop, `${path}.loop`, theme, false)

  if (options.allowAutoplay) {
    assertBoolean(obj.autoplay, `${path}.autoplay`, theme, false)
  } else if (obj.autoplay !== undefined) {
    fail(theme, `${path}.autoplay`, 'is only allowed in audio.music')
  }
}

function assertAudioBindingTarget(value: unknown, path: string, theme: string): string[] {
  if (typeof value === 'string') {
    assertString(value, path, theme, true)
    return [value]
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      fail(theme, path, 'must not be an empty array')
    }

    const out: string[] = []
    value.forEach((entry, idx) => {
      const clipId = assertString(entry, `${path}[${idx}]`, theme, true)!
      out.push(clipId)
    })
    return out
  }

  const obj = assertObject(value, path, theme, true)!
  const clipPath = `${path}.clip`
  if (typeof obj.clip === 'string') {
    assertString(obj.clip, clipPath, theme, true)
  } else if (Array.isArray(obj.clip)) {
    if (obj.clip.length === 0) {
      fail(theme, clipPath, 'must not be an empty array')
    }
    obj.clip.forEach((entry, idx) => {
      assertString(entry, `${clipPath}[${idx}]`, theme, true)
    })
  } else {
    fail(theme, clipPath, 'must be a string or array of strings')
  }

  assertNumber(obj.volume, `${path}.volume`, theme, { required: false, min: 0, max: 1 })
  assertNumber(obj.rate, `${path}.rate`, theme, { required: false, min: 0.1, max: 4 })
  assertBoolean(obj.loop, `${path}.loop`, theme, false)

  return Array.isArray(obj.clip) ? (obj.clip as string[]) : [obj.clip as string]
}

function validate(manifest: AnyRecord, theme: string): asserts manifest is Manifest & AnyRecord {
  const meta = assertObject(manifest.meta, 'meta', theme)!
  assertString(meta.id, 'meta.id', theme)
  assertString(meta.title, 'meta.title', theme)

  const physics = assertObject(manifest.physics, 'physics', theme)!
  assertNumber(physics.gravity, 'physics.gravity', theme)
  assertNumber(physics.jumpForce, 'physics.jumpForce', theme)
  assertNumber(physics.speed, 'physics.speed', theme, { min: 1 })

  const spawn = assertObject(manifest.spawn, 'spawn', theme)!
  const gapMin = assertNumber(spawn.gapMin, 'spawn.gapMin', theme, { min: 1 })!
  const gapMax = assertNumber(spawn.gapMax, 'spawn.gapMax', theme, { min: 1 })!
  if (gapMax < gapMin) {
    fail(theme, 'spawn.gapMax', 'must be >= spawn.gapMin')
  }
  assertNumber(spawn.interval, 'spawn.interval', theme, { min: 1 })

  const assets = assertObject(manifest.assets, 'assets', theme)!
  assertString(assets.bg, 'assets.bg', theme)
  assertString(assets.player, 'assets.player', theme)
  assertString(assets.pipeTop, 'assets.pipeTop', theme)
  assertString(assets.pipeBottom, 'assets.pipeBottom', theme)
  assertString(assets.coin, 'assets.coin', theme, false)
  assertString(assets.music, 'assets.music', theme, false)

  const audio = assertObject(manifest.audio, 'audio', theme, false)
  if (audio) {
    const availableClipIds = new Set<string>()
    const music = assertObject(audio.music, 'audio.music', theme, false)
    if (music) {
      assertAudioClipConfig(music, 'audio.music', theme, { requiredSrc: false, allowAutoplay: true })
    }

    const hasMusicSrc = typeof music?.src === 'string' && music.src.trim().length > 0
    if (hasMusicSrc || (typeof assets.music === 'string' && assets.music.trim().length > 0)) {
      availableClipIds.add('music')
    }

    const sfx = assertObject(audio.sfx, 'audio.sfx', theme, false)
    if (sfx) {
      for (const [id, entry] of Object.entries(sfx)) {
        if (id.trim().length === 0) {
          fail(theme, 'audio.sfx', 'contains an empty clip id')
        }
        assertAudioClipConfig(entry, `audio.sfx.${id}`, theme, { requiredSrc: true, allowAutoplay: false })
        availableClipIds.add(id)
      }
    }

    const bindings = assertObject(audio.bindings, 'audio.bindings', theme, false)
    if (bindings) {
      for (const [eventName, target] of Object.entries(bindings)) {
        if (!AUDIO_BINDING_EVENTS.has(eventName)) {
          fail(
            theme,
            `audio.bindings.${eventName}`,
            `unsupported event, expected one of: ${Array.from(AUDIO_BINDING_EVENTS).join(', ')}`,
          )
        }

        const clipIds = assertAudioBindingTarget(target, `audio.bindings.${eventName}`, theme)
        for (const clipId of clipIds) {
          if (!availableClipIds.has(clipId)) {
            fail(theme, `audio.bindings.${eventName}`, `references unknown clip "${clipId}"`)
          }
        }
      }
    }
  }

  const player = assertObject(manifest.player, 'player', theme)!
  assertNumber(player.width, 'player.width', theme, { min: 1 })
  assertNumber(player.height, 'player.height', theme, { min: 1 })

  const menu = assertObject(manifest.menu, 'menu', theme, false)
  if (menu) {
    assertString(menu.bg, 'menu.bg', theme, false)
    assertString(menu.title, 'menu.title', theme, false)
    assertButtonConfig(menu.start, 'menu.start', theme, true)
    assertButtonConfig(menu.mute, 'menu.mute', theme, false)
    assertButtonConfig(menu.leaderboard, 'menu.leaderboard', theme, false)

    if (menu.custom !== undefined) {
      if (!Array.isArray(menu.custom)) {
        fail(theme, 'menu.custom', 'must be an array')
      }
      menu.custom.forEach((entry, idx) => {
        const obj = assertObject(entry, `menu.custom[${idx}]`, theme, true)!
        assertString(obj.id, `menu.custom[${idx}].id`, theme, true)
        assertButtonConfig(obj, `menu.custom[${idx}]`, theme, false)
      })
    }
  }

  const gameOver = assertObject(manifest.gameOver, 'gameOver', theme, false)
  if (gameOver) {
    assertString(gameOver.title, 'gameOver.title', theme, false)
    assertString(gameOver.scoreLabel, 'gameOver.scoreLabel', theme, false)
    assertString(gameOver.bestLabel, 'gameOver.bestLabel', theme, false)
    assertString(gameOver.newBestLabel, 'gameOver.newBestLabel', theme, false)
    assertPanelBackgroundConfig(gameOver.background, 'gameOver.background', theme)
    assertButtonConfig(gameOver.retry, 'gameOver.retry', theme, false)
    assertButtonConfig(gameOver.menu, 'gameOver.menu', theme, false)
  }

  const leaderboard = assertObject(manifest.leaderboard, 'leaderboard', theme, false)
  if (leaderboard) {
    assertString(leaderboard.name, 'leaderboard.name', theme, true)
  }

  const difficulty = assertObject(manifest.difficulty, 'difficulty', theme, false)
  if (difficulty) {
    assertNumber(difficulty.intervalStep, 'difficulty.intervalStep', theme, { required: false, min: 0 })
    assertNumber(difficulty.minInterval, 'difficulty.minInterval', theme, { required: false, min: 1 })
    assertNumber(difficulty.gapShrinkPerPoint, 'difficulty.gapShrinkPerPoint', theme, { required: false, min: 0 })
    assertNumber(difficulty.minGap, 'difficulty.minGap', theme, { required: false, min: 1 })
    assertNumber(difficulty.speedStep, 'difficulty.speedStep', theme, { required: false, min: 0 })
    assertNumber(difficulty.maxSpeed, 'difficulty.maxSpeed', theme, { required: false, min: 1 })
  }

  const canvas = assertObject(manifest.canvas, 'canvas', theme, false)
  if (canvas) {
    assertNumber(canvas.width, 'canvas.width', theme, { required: false, min: 1 })
    assertNumber(canvas.height, 'canvas.height', theme, { required: false, min: 1 })
    assertColor(canvas.backgroundColor, 'canvas.backgroundColor', theme, false)

    const scale = assertObject(canvas.scale, 'canvas.scale', theme, false)
    if (scale) {
      if (
        scale.mode !== undefined &&
        !['NONE', 'FIT', 'ENVELOP', 'RESIZE', 'WIDTH_CONTROLS_HEIGHT', 'HEIGHT_CONTROLS_WIDTH'].includes(
          String(scale.mode),
        )
      ) {
        fail(
          theme,
          'canvas.scale.mode',
          'must be one of: NONE, FIT, ENVELOP, RESIZE, WIDTH_CONTROLS_HEIGHT, HEIGHT_CONTROLS_WIDTH',
        )
      }
      if (
        scale.autoCenter !== undefined &&
        !['NO_CENTER', 'CENTER_BOTH', 'CENTER_HORIZONTALLY', 'CENTER_VERTICALLY'].includes(
          String(scale.autoCenter),
        )
      ) {
        fail(
          theme,
          'canvas.scale.autoCenter',
          'must be one of: NO_CENTER, CENTER_BOTH, CENTER_HORIZONTALLY, CENTER_VERTICALLY',
        )
      }
      assertNumber(scale.zoom, 'canvas.scale.zoom', theme, { required: false, min: 0.01 })
    }
  }

  const ui = assertObject(manifest.ui, 'ui', theme, false)
  if (ui) {
    assertTextStyleConfig(ui.text, 'ui.text', theme)
    assertButtonStyleConfig(ui.button, 'ui.button', theme)

    const screens = assertObject(ui.screens, 'ui.screens', theme, false)
    if (screens) {
      const menuUi = assertObject(screens.menu, 'ui.screens.menu', theme, false)
      if (menuUi) {
        assertColor(menuUi.overlayColor, 'ui.screens.menu.overlayColor', theme, false)
        assertNumber(menuUi.overlayAlpha, 'ui.screens.menu.overlayAlpha', theme, {
          required: false,
          min: 0,
          max: 1,
        })
        assertTextStyleConfig(menuUi.titleStyle, 'ui.screens.menu.titleStyle', theme)
        assertButtonStyleConfig(menuUi.buttonStyle, 'ui.screens.menu.buttonStyle', theme)
        assertButtonStyleConfig(menuUi.muteButtonStyle, 'ui.screens.menu.muteButtonStyle', theme)
        assertButtonStyleConfig(menuUi.customButtonStyle, 'ui.screens.menu.customButtonStyle', theme)
      }

      const gameUi = assertObject(screens.game, 'ui.screens.game', theme, false)
      if (gameUi) {
        assertTextStyleConfig(gameUi.scoreStyle, 'ui.screens.game.scoreStyle', theme)
      }

      const gameOverUi = assertObject(screens.gameOver, 'ui.screens.gameOver', theme, false)
      if (gameOverUi) {
        assertColor(gameOverUi.overlayColor, 'ui.screens.gameOver.overlayColor', theme, false)
        assertNumber(gameOverUi.overlayAlpha, 'ui.screens.gameOver.overlayAlpha', theme, {
          required: false,
          min: 0,
          max: 1,
        })
        assertPanelLayoutConfig(gameOverUi.panel, 'ui.screens.gameOver.panel', theme)
        assertTextStyleConfig(gameOverUi.titleStyle, 'ui.screens.gameOver.titleStyle', theme)
        assertTextStyleConfig(gameOverUi.scoreStyle, 'ui.screens.gameOver.scoreStyle', theme)
        assertTextStyleConfig(gameOverUi.bestStyle, 'ui.screens.gameOver.bestStyle', theme)
        assertTextStyleConfig(gameOverUi.badgeStyle, 'ui.screens.gameOver.badgeStyle', theme)
        assertButtonStyleConfig(gameOverUi.buttonStyle, 'ui.screens.gameOver.buttonStyle', theme)
      }

      const leaderboardUi = assertObject(screens.leaderboard, 'ui.screens.leaderboard', theme, false)
      if (leaderboardUi) {
        assertString(leaderboardUi.backgroundImage, 'ui.screens.leaderboard.backgroundImage', theme, false)
        assertColor(leaderboardUi.overlayColor, 'ui.screens.leaderboard.overlayColor', theme, false)
        assertNumber(leaderboardUi.overlayAlpha, 'ui.screens.leaderboard.overlayAlpha', theme, {
          required: false,
          min: 0,
          max: 1,
        })
        assertPanelLayoutConfig(leaderboardUi.panel, 'ui.screens.leaderboard.panel', theme)

        const texts = assertObject(leaderboardUi.texts, 'ui.screens.leaderboard.texts', theme, false)
        if (texts) {
          assertString(texts.title, 'ui.screens.leaderboard.texts.title', theme, false)
          assertString(texts.back, 'ui.screens.leaderboard.texts.back', theme, false)
          assertString(texts.loading, 'ui.screens.leaderboard.texts.loading', theme, false)
          assertString(texts.unavailable, 'ui.screens.leaderboard.texts.unavailable', theme, false)
          assertString(texts.empty, 'ui.screens.leaderboard.texts.empty', theme, false)
          assertString(texts.columnRank, 'ui.screens.leaderboard.texts.columnRank', theme, false)
          assertString(texts.columnPlayer, 'ui.screens.leaderboard.texts.columnPlayer', theme, false)
          assertString(texts.columnScore, 'ui.screens.leaderboard.texts.columnScore', theme, false)
        }

        assertTextStyleConfig(leaderboardUi.titleStyle, 'ui.screens.leaderboard.titleStyle', theme)
        assertStyledButtonConfig(leaderboardUi.backButton, 'ui.screens.leaderboard.backButton', theme)
        assertButtonStyleConfig(leaderboardUi.backButtonStyle, 'ui.screens.leaderboard.backButtonStyle', theme)
        assertTextStyleConfig(leaderboardUi.loadingStyle, 'ui.screens.leaderboard.loadingStyle', theme)
        assertTextStyleConfig(leaderboardUi.messageStyle, 'ui.screens.leaderboard.messageStyle', theme)
        assertTextStyleConfig(leaderboardUi.headerStyle, 'ui.screens.leaderboard.headerStyle', theme)
        assertTextStyleConfig(leaderboardUi.rankStyle, 'ui.screens.leaderboard.rankStyle', theme)
        assertTextStyleConfig(leaderboardUi.nameStyle, 'ui.screens.leaderboard.nameStyle', theme)
        assertTextStyleConfig(leaderboardUi.scoreStyle, 'ui.screens.leaderboard.scoreStyle', theme)
        assertNumber(leaderboardUi.rowHeight, 'ui.screens.leaderboard.rowHeight', theme, {
          required: false,
          min: 1,
        })
        assertNumber(leaderboardUi.startY, 'ui.screens.leaderboard.startY', theme, { required: false })

        const columns = assertObject(leaderboardUi.columns, 'ui.screens.leaderboard.columns', theme, false)
        if (columns) {
          assertNumber(columns.rankX, 'ui.screens.leaderboard.columns.rankX', theme, { required: false })
          assertNumber(columns.nameX, 'ui.screens.leaderboard.columns.nameX', theme, { required: false })
          assertNumber(columns.scoreX, 'ui.screens.leaderboard.columns.scoreX', theme, { required: false })
        }
      }
    }
  }
}

function buildTheme(theme: string) {
  console.log(`\nBuilding theme: ${theme}`)

  const themePath = path.join(THEMES_DIR, theme)
  const manifestPath = path.join(themePath, 'manifest.json')

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Theme "${theme}" not found — expected: ${manifestPath}`)
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as Record<string, unknown>
  validate(manifest, theme)

  // 1. Ensure placeholder assets exist for any missing files
  const themeAssetsDir = path.join(themePath, 'assets')
  ensurePlaceholders(themeAssetsDir)

  // 2. Copy assets into engine/public/assets/
  const publicAssetsDir = path.join(ENGINE_DIR, 'public', 'assets')
  if (fs.existsSync(publicAssetsDir)) fs.rmSync(publicAssetsDir, { recursive: true })
  fs.cpSync(themeAssetsDir, publicAssetsDir, { recursive: true })
  console.log('  copied assets')

  // 3. Generate engine/src/config.ts from manifest
  const configTs = [
    `import type { GameConfig } from './types'`,
    ``,
    `const config: GameConfig = ${JSON.stringify(manifest, null, 2)}`,
    ``,
    `export default config`,
    ``,
  ].join('\n')
  fs.writeFileSync(path.join(ENGINE_DIR, 'src', 'config.ts'), configTs)
  console.log('  generated config.ts')

  // 4. Run Vite build
  const outDir = path.join(BUILDS_DIR, theme)
  fs.mkdirSync(outDir, { recursive: true })

  execSync(
    `npx vite build --outDir "${outDir}" --emptyOutDir`,
    { cwd: ENGINE_DIR, stdio: 'inherit' }
  )

  console.log(`\nDone — output: builds/${theme}/`)
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const args = process.argv.slice(2)
const themeArg = args.find(a => a.startsWith('--theme='))
const allFlag = args.includes('--all')

if (allFlag) {
  const themes = fs
    .readdirSync(THEMES_DIR)
    .filter(d => fs.statSync(path.join(THEMES_DIR, d)).isDirectory())

  if (themes.length === 0) {
    console.error('No themes found in /themes/')
    process.exit(1)
  }

  for (const t of themes) buildTheme(t)
} else if (themeArg) {
  buildTheme(themeArg.replace('--theme=', ''))
} else {
  console.error('Usage:')
  console.error('  npm run build:theme -- --theme=<name>')
  console.error('  npm run build:all')
  process.exit(1)
}
