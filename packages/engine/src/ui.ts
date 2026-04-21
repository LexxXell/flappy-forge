import Phaser from 'phaser'
import type {
  ButtonStyleConfig,
  CanvasScaleConfig,
  ColorValue,
  PaddingConfig,
  TextStyleConfig,
} from './types'

export function numberOr(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function clamp01(value: number | undefined, fallback: number): number {
  return Phaser.Math.Clamp(numberOr(value, fallback), 0, 1)
}

function normalizeHex(input: string): string | null {
  const value = input.trim().replace(/^#/, '').replace(/^0x/i, '')
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return null
  return value.toLowerCase()
}

export function colorToCss(value: ColorValue | undefined, fallback: string): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const normalized = Phaser.Math.Clamp(Math.floor(value), 0, 0xffffff)
    return `#${normalized.toString(16).padStart(6, '0')}`
  }

  if (typeof value !== 'string') return fallback
  const hex = normalizeHex(value)
  if (hex) return `#${hex}`

  // Allow non-hex CSS colors if caller wants them.
  return value
}

export function colorToNumber(value: ColorValue | undefined, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Phaser.Math.Clamp(Math.floor(value), 0, 0xffffff)
  }

  if (typeof value !== 'string') return fallback
  const hex = normalizeHex(value)
  if (!hex) return fallback

  const parsed = Number.parseInt(hex, 16)
  return Number.isFinite(parsed) ? parsed : fallback
}

function toFontSize(value: string | number | undefined): string | number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return `${value}px`
  return value
}

function mergePadding(
  base: Phaser.Types.GameObjects.Text.TextPadding | undefined,
  patch: PaddingConfig | undefined,
): Phaser.Types.GameObjects.Text.TextPadding | undefined {
  if (!patch) return base
  return {
    left: patch.left ?? base?.left ?? 0,
    right: patch.right ?? base?.right ?? 0,
    top: patch.top ?? base?.top ?? 0,
    bottom: patch.bottom ?? base?.bottom ?? 0,
  }
}

export function mergeTextStyle(
  ...styles: Array<TextStyleConfig | Phaser.Types.GameObjects.Text.TextStyle | undefined>
): Phaser.Types.GameObjects.Text.TextStyle {
  const out: Phaser.Types.GameObjects.Text.TextStyle = {}

  for (const style of styles) {
    if (!style) continue
    const s = style as TextStyleConfig

    if (s.fontFamily !== undefined) out.fontFamily = s.fontFamily
    if (s.fontSize !== undefined) out.fontSize = toFontSize(s.fontSize)
    if (s.color !== undefined) {
      out.color = colorToCss(s.color, typeof out.color === 'string' ? out.color : '#ffffff')
    }
    if (s.backgroundColor !== undefined) {
      out.backgroundColor = colorToCss(
        s.backgroundColor,
        typeof out.backgroundColor === 'string' ? out.backgroundColor : '#000000',
      )
    }
    if (s.stroke !== undefined) {
      out.stroke = colorToCss(s.stroke, typeof out.stroke === 'string' ? out.stroke : '#000000')
    }
    if (s.strokeThickness !== undefined && Number.isFinite(s.strokeThickness)) {
      out.strokeThickness = s.strokeThickness
    }
    if (s.fontStyle !== undefined) out.fontStyle = s.fontStyle
    if (s.align !== undefined) out.align = s.align

    const padding = (s as TextStyleConfig).padding as PaddingConfig | undefined
    out.padding = mergePadding(out.padding, padding)
  }

  return out
}

function mergeOneTextStyle(a: TextStyleConfig | undefined, b: TextStyleConfig | undefined): TextStyleConfig | undefined {
  if (!a) return b
  if (!b) return a
  return {
    ...a,
    ...b,
    padding: {
      left: b.padding?.left ?? a.padding?.left,
      right: b.padding?.right ?? a.padding?.right,
      top: b.padding?.top ?? a.padding?.top,
      bottom: b.padding?.bottom ?? a.padding?.bottom,
    },
  }
}

export function mergeButtonStyles(...styles: Array<ButtonStyleConfig | undefined>): ButtonStyleConfig {
  const out: ButtonStyleConfig = {}

  for (const style of styles) {
    if (!style) continue
    out.text = mergeOneTextStyle(out.text, style.text)
    out.hoverText = mergeOneTextStyle(out.hoverText, style.hoverText)

    if (style.imageHoverTint !== undefined) out.imageHoverTint = style.imageHoverTint
    if (style.imageHoverAlpha !== undefined) out.imageHoverAlpha = style.imageHoverAlpha
    if (style.disabledAlpha !== undefined) out.disabledAlpha = style.disabledAlpha
  }

  return out
}

export function resolveSize(value: number | undefined, total: number, fallbackFraction: number): number {
  const v = numberOr(value, fallbackFraction)
  if (v <= 1) return Math.max(1, total * v)
  return Math.max(1, v)
}

export function resolveAxis(value: number | undefined, total: number, fallbackFraction: number): number {
  const v = numberOr(value, fallbackFraction)
  if (v <= 1) return total * v
  return v
}

export function resolveScaleMode(mode: CanvasScaleConfig['mode'] | undefined): number {
  switch (mode) {
    case 'NONE':
      return Phaser.Scale.NONE
    case 'ENVELOP':
      return Phaser.Scale.ENVELOP
    case 'RESIZE':
      return Phaser.Scale.RESIZE
    case 'WIDTH_CONTROLS_HEIGHT':
      return Phaser.Scale.WIDTH_CONTROLS_HEIGHT
    case 'HEIGHT_CONTROLS_WIDTH':
      return Phaser.Scale.HEIGHT_CONTROLS_WIDTH
    case 'FIT':
    default:
      return Phaser.Scale.FIT
  }
}

export function resolveAutoCenter(value: CanvasScaleConfig['autoCenter'] | undefined): number {
  switch (value) {
    case 'NO_CENTER':
      return Phaser.Scale.NO_CENTER
    case 'CENTER_HORIZONTALLY':
      return Phaser.Scale.CENTER_HORIZONTALLY
    case 'CENTER_VERTICALLY':
      return Phaser.Scale.CENTER_VERTICALLY
    case 'CENTER_BOTH':
    default:
      return Phaser.Scale.CENTER_BOTH
  }
}
