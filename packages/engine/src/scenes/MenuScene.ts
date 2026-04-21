import Phaser from 'phaser'
import type { ButtonConfig, ButtonStyleConfig, CustomButtonDef, GameConfig, TextStyleConfig } from '../types'
import { playAudioBinding, preloadAudio } from '../audio'
import { ensureCustomButton, setMuted, state, toggleCustomButton } from '../state'
import { clamp01, colorToNumber, mergeButtonStyles, mergeTextStyle } from '../ui'

const DEFAULT_TITLE_STYLE: TextStyleConfig = {
  fontSize: 42,
  color: '#ffffff',
  stroke: '#000000',
  strokeThickness: 6,
  fontStyle: 'bold',
}

const DEFAULT_BUTTON_STYLE: TextStyleConfig = {
  fontSize: 30,
  color: '#ffffff',
  backgroundColor: '#444444',
  padding: { left: 24, right: 24, top: 12, bottom: 12 },
  stroke: '#000000',
  strokeThickness: 2,
}

const DEFAULT_BUTTON_HOVER_STYLE: TextStyleConfig = {
  backgroundColor: '#666666',
}

const DEFAULT_CUSTOM_BUTTON_STYLE: TextStyleConfig = {
  fontSize: 26,
  color: '#ffffff',
  backgroundColor: '#444444',
  padding: { left: 18, right: 18, top: 10, bottom: 10 },
  stroke: '#000000',
  strokeThickness: 2,
}

export class MenuScene extends Phaser.Scene {
  private cfg: GameConfig

  constructor(cfg: GameConfig) {
    super({ key: 'MenuScene' })
    this.cfg = cfg
  }

  preload() {
    // Game bg (shared texture key with GameScene — loaded once, cached)
    this.load.image('bg', this.cfg.assets.bg)
    preloadAudio(this, this.cfg)

    const menu = this.cfg.menu!
    if (menu.bg) this.load.image('menuBg', menu.bg)
    if (menu.start.image) this.load.image('btnStart', menu.start.image)
    if (menu.mute?.image) this.load.image('btnMute', menu.mute.image)
    if (menu.leaderboard?.image) this.load.image('btnLb', menu.leaderboard.image)
    menu.custom?.forEach(b => {
      if (b.image) this.load.image(`btn_${b.id}`, b.image)
    })
  }

  create() {
    const { width, height } = this.scale
    const menu = this.cfg.menu!
    const menuUi = this.cfg.ui?.screens?.menu
    this.sound.mute = state.muted

    // Background
    const bgKey = menu.bg && this.textures.exists('menuBg') ? 'menuBg' : 'bg'
    this.add.image(width / 2, height / 2, bgKey).setDisplaySize(width, height)

    // Semi-transparent overlay so buttons are readable over any bg
    this.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      colorToNumber(menuUi?.overlayColor, 0x000000),
      clamp01(menuUi?.overlayAlpha, 0.35),
    )

    // Title
    this.add
      .text(
        width / 2,
        height * 0.2,
        menu.title || this.cfg.meta.title,
        mergeTextStyle(DEFAULT_TITLE_STYLE, this.cfg.ui?.text, menuUi?.titleStyle),
      )
      .setOrigin(0.5)

    // Start (required)
    this.btn(menu.start, 0.5, 0.45, 'btnStart', () => {
      playAudioBinding(this, this.cfg, 'menu:start:click')
      this.scene.start('GameScene')
    }, menu.start.style)

    // Mute (optional)
    if (menu.mute) {
      this.muteBtn(menu.mute)
    }

    // Leaderboard (optional)
    if (menu.leaderboard) {
      this.btn(menu.leaderboard, 0.5, 0.7, 'btnLb', () => {
        playAudioBinding(this, this.cfg, 'menu:leaderboard:click')
        this.scene.start('LeaderboardScene')
      }, menu.leaderboard.style)
    }

    // Custom buttons
    menu.custom?.forEach(def => this.customBtn(def))
  }

  private resolveButtonStyle(override?: ButtonStyleConfig): ButtonStyleConfig {
    return mergeButtonStyles(this.cfg.ui?.button, this.cfg.ui?.screens?.menu?.buttonStyle, override)
  }

  private btn(
    cfg: ButtonConfig,
    defaultX: number,
    defaultY: number,
    imageKey: string,
    onClick: () => void,
    styleOverride?: ButtonStyleConfig,
  ): Phaser.GameObjects.GameObject {
    const { width, height } = this.scale
    const bx = width * (cfg.x ?? defaultX)
    const by = height * (cfg.y ?? defaultY)
    const style = this.resolveButtonStyle(styleOverride)

    // Image button
    if (cfg.image && this.textures.exists(imageKey)) {
      const img = this.add.image(bx, by, imageKey).setInteractive({ useHandCursor: true })
      this.applyImageButtonHover(img, style, () => 1)
      img.on('pointerdown', onClick)
      return img
    }

    // Text button
    return this.textBtn(bx, by, cfg.text || 'BUTTON', onClick, style, DEFAULT_BUTTON_STYLE)
  }

  private textBtn(
    x: number,
    y: number,
    label: string,
    onClick: () => void,
    style: ButtonStyleConfig,
    defaultTextStyle: TextStyleConfig,
  ): Phaser.GameObjects.Text {
    const baseStyle = mergeTextStyle(defaultTextStyle, this.cfg.ui?.text, style.text)
    const hoverStyle = mergeTextStyle(baseStyle, DEFAULT_BUTTON_HOVER_STYLE, style.hoverText)

    const t = this.add
      .text(x, y, label, baseStyle)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })

    t.on('pointerover', () => t.setStyle(hoverStyle))
    t.on('pointerout', () => t.setStyle(baseStyle))
    t.on('pointerdown', onClick)
    return t
  }

  private applyImageButtonHover(
    img: Phaser.GameObjects.Image,
    style: ButtonStyleConfig,
    getBaseAlpha: () => number,
  ) {
    const hoverTint = colorToNumber(style.imageHoverTint, 0xdddddd)

    img.on('pointerover', () => {
      img.setTint(hoverTint)
      img.setAlpha(clamp01(style.imageHoverAlpha, getBaseAlpha()))
    })
    img.on('pointerout', () => {
      img.clearTint()
      img.setAlpha(getBaseAlpha())
    })
  }

  private muteBtn(cfg: ButtonConfig) {
    const { width, height } = this.scale
    const bx = width * (cfg.x ?? 0.5)
    const by = height * (cfg.y ?? 0.58)
    const style = this.resolveButtonStyle(this.cfg.ui?.screens?.menu?.muteButtonStyle)
    const finalStyle = mergeButtonStyles(style, cfg.style)
    const disabledAlpha = clamp01(finalStyle.disabledAlpha, 0.5)

    const muteLabel = () =>
      state.muted
        ? cfg.text ? `${cfg.text}: OFF` : 'SOUND: OFF'
        : cfg.text ? `${cfg.text}: ON` : 'SOUND: ON'

    // Image variant
    if (cfg.image && this.textures.exists('btnMute')) {
      const img = this.add.image(bx, by, 'btnMute').setInteractive({ useHandCursor: true })
      const currentAlpha = () => (state.muted ? disabledAlpha : 1)
      img.setAlpha(currentAlpha())
      this.applyImageButtonHover(img, finalStyle, currentAlpha)
      img.on('pointerdown', () => {
        playAudioBinding(this, this.cfg, 'menu:mute:toggle')
        setMuted(!state.muted)
        this.sound.mute = state.muted
        img.setAlpha(currentAlpha())
      })
      return
    }

    // Text variant
    let t!: Phaser.GameObjects.Text
    t = this.textBtn(bx, by, muteLabel(), () => {
      playAudioBinding(this, this.cfg, 'menu:mute:toggle')
      setMuted(!state.muted)
      this.sound.mute = state.muted
      t.setText(muteLabel())
    }, finalStyle, DEFAULT_BUTTON_STYLE)
  }

  private customBtn(def: CustomButtonDef) {
    const { width, height } = this.scale
    const bx = width * (def.x ?? 0.5)
    const by = height * (def.y ?? 0.85)
    const style = this.resolveButtonStyle(this.cfg.ui?.screens?.menu?.customButtonStyle)
    const finalStyle = mergeButtonStyles(style, def.style)
    const disabledAlpha = clamp01(finalStyle.disabledAlpha, 0.5)

    ensureCustomButton(def.id)

    const imageKey = `btn_${def.id}`

    // Image variant
    if (def.image && this.textures.exists(imageKey)) {
      const img = this.add.image(bx, by, imageKey).setInteractive({ useHandCursor: true })
      const currentAlpha = () => (state.customButtons[def.id] ? 1 : disabledAlpha)
      img.setAlpha(currentAlpha())
      this.applyImageButtonHover(img, finalStyle, currentAlpha)
      img.on('pointerdown', () => {
        playAudioBinding(this, this.cfg, 'menu:custom:toggle')
        toggleCustomButton(def.id)
        img.setAlpha(currentAlpha())
      })
      return
    }

    // Text variant
    const label = () => {
      const name = def.text || def.id
      return state.customButtons[def.id] ? `${name}: ON` : `${name}: OFF`
    }
    let t!: Phaser.GameObjects.Text
    t = this.textBtn(bx, by, label(), () => {
      playAudioBinding(this, this.cfg, 'menu:custom:toggle')
      toggleCustomButton(def.id)
      t.setText(label())
    }, finalStyle, DEFAULT_CUSTOM_BUTTON_STYLE)
  }
}
