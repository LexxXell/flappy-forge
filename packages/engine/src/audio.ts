import Phaser from 'phaser'
import type {
  AudioBindingConfig,
  AudioBindingEvent,
  AudioBindingTarget,
  AudioClipConfig,
  GameConfig,
  MusicConfig,
} from './types'

const MUSIC_ID = 'music'
const MUSIC_KEY = 'audio_music'
const SFX_PREFIX = 'audio_sfx_'

interface ResolvedAudioClip {
  id: string
  key: string
  src: string
  volume?: number
  rate?: number
  loop?: boolean
  autoplay?: boolean
}

interface PlayOverrides {
  volume?: number
  rate?: number
  loop?: boolean
}

function bindingContainsClip(target: AudioBindingTarget | undefined, clipId: string): boolean {
  if (!target) return false
  if (typeof target === 'string') return target === clipId
  if (Array.isArray(target)) return target.includes(clipId)

  const clip = target.clip
  if (typeof clip === 'string') return clip === clipId
  return clip.includes(clipId)
}

function sanitizeRate(value: number | undefined): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return Phaser.Math.Clamp(value, 0.1, 4)
}

function sanitizeVolume(value: number | undefined): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return Phaser.Math.Clamp(value, 0, 1)
}

function resolveMusic(cfg: GameConfig): ResolvedAudioClip | null {
  const music = cfg.audio?.music
  const src = music?.src ?? cfg.assets.music
  if (!src) return null

  return {
    id: MUSIC_ID,
    key: MUSIC_KEY,
    src,
    volume: music?.volume,
    rate: music?.rate,
    loop: music?.loop ?? true,
    autoplay: music?.autoplay,
  }
}

function resolveSfx(cfg: GameConfig): ResolvedAudioClip[] {
  const sfx = cfg.audio?.sfx
  if (!sfx) return []

  const out: ResolvedAudioClip[] = []
  for (const [id, clip] of Object.entries(sfx)) {
    if (!clip?.src) continue
    out.push({
      id,
      key: `${SFX_PREFIX}${encodeURIComponent(id)}`,
      src: clip.src,
      volume: clip.volume,
      rate: clip.rate,
      loop: clip.loop,
    })
  }
  return out
}

function resolveClipById(cfg: GameConfig, id: string): ResolvedAudioClip | null {
  if (id === MUSIC_ID) return resolveMusic(cfg)

  const clip = cfg.audio?.sfx?.[id]
  if (!clip?.src) return null

  return {
    id,
    key: `${SFX_PREFIX}${encodeURIComponent(id)}`,
    src: clip.src,
    volume: clip.volume,
    rate: clip.rate,
    loop: clip.loop,
  }
}

function toPlayConfig(base: AudioClipConfig | MusicConfig, overrides?: PlayOverrides): Phaser.Types.Sound.SoundConfig {
  const volume = sanitizeVolume(overrides?.volume ?? base.volume)
  const rate = sanitizeRate(overrides?.rate ?? base.rate)
  const loop = overrides?.loop ?? base.loop

  const config: Phaser.Types.Sound.SoundConfig = {}
  if (volume !== undefined) config.volume = volume
  if (rate !== undefined) config.rate = rate
  if (typeof loop === 'boolean') config.loop = loop
  return config
}

function normalizeBindingTarget(target: AudioBindingTarget): Array<{ id: string; overrides?: PlayOverrides }> {
  if (typeof target === 'string') {
    return [{ id: target }]
  }

  if (Array.isArray(target)) {
    return target.map(id => ({ id }))
  }

  const binding = target as AudioBindingConfig
  const ids = Array.isArray(binding.clip) ? binding.clip : [binding.clip]
  const overrides: PlayOverrides = {
    volume: binding.volume,
    rate: binding.rate,
    loop: binding.loop,
  }
  return ids.map(id => ({ id, overrides }))
}

function playClip(scene: Phaser.Scene, clip: ResolvedAudioClip, overrides?: PlayOverrides): boolean {
  if (!scene.cache.audio.exists(clip.key)) return false

  const playConfig = toPlayConfig(clip, overrides)
  const loop = playConfig.loop === true
  if (loop) {
    const existing = scene.sound.get(clip.key)
    if (existing?.isPlaying) return true
  }

  return scene.sound.play(clip.key, playConfig)
}

export function preloadAudio(scene: Phaser.Scene, cfg: GameConfig): void {
  const all: ResolvedAudioClip[] = []
  const music = resolveMusic(cfg)
  if (music) all.push(music)
  all.push(...resolveSfx(cfg))

  for (const clip of all) {
    if (scene.cache.audio.exists(clip.key)) continue
    scene.load.audio(clip.key, clip.src)
  }
}

export function ensureBackgroundMusic(scene: Phaser.Scene, cfg: GameConfig): void {
  const music = resolveMusic(cfg)
  if (!music) return
  const explicitAutoplay = music.autoplay
  if (explicitAutoplay === false) return
  if (explicitAutoplay === undefined && bindingContainsClip(cfg.audio?.bindings?.['game:start'], MUSIC_ID)) return
  if (!scene.cache.audio.exists(music.key)) return

  const existing = scene.sound.get(music.key)
  if (existing?.isPlaying) return

  scene.sound.stopByKey(music.key)
  scene.sound.play(music.key, toPlayConfig(music))
}

export function playAudioBinding(scene: Phaser.Scene, cfg: GameConfig, event: AudioBindingEvent): void {
  const target = cfg.audio?.bindings?.[event]
  if (!target) return

  const bindings = normalizeBindingTarget(target)
  for (const binding of bindings) {
    const clip = resolveClipById(cfg, binding.id)
    if (!clip) continue
    playClip(scene, clip, binding.overrides)
  }
}
