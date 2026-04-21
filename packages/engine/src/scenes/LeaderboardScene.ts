import Phaser from 'phaser'
import type { ButtonStyleConfig, GameConfig, PanelBackgroundConfig, StyledButtonConfig, TextStyleConfig } from '../types'
import { playAudioBinding, preloadAudio } from '../audio'
import { getLeaderboard, initYandex, isAvailable } from '../yandex'
import {
  clamp01,
  colorToNumber,
  mergeButtonStyles,
  mergeTextStyle,
  numberOr,
  resolveAxis,
  resolveSize,
} from '../ui'

const DEFAULT_TEXTS = {
  title: 'LEADERBOARD',
  back: 'BACK',
  loading: 'Connecting to platform...',
  unavailable: 'Leaderboard is available\non Yandex Games',
  empty: 'No entries yet',
  columnRank: '#',
  columnPlayer: 'Player',
  columnScore: 'Score',
}

const DEFAULT_TITLE_STYLE: TextStyleConfig = {
  fontSize: 36,
  color: '#ffffff',
  stroke: '#000000',
  strokeThickness: 5,
  fontStyle: 'bold',
}

const DEFAULT_BUTTON_STYLE: TextStyleConfig = {
  fontSize: 28,
  color: '#ffffff',
  backgroundColor: '#444444',
  padding: { left: 24, right: 24, top: 12, bottom: 12 },
  stroke: '#000000',
  strokeThickness: 2,
}

const DEFAULT_BUTTON_HOVER_STYLE: TextStyleConfig = {
  backgroundColor: '#666666',
}

const DEFAULT_LOADING_STYLE: TextStyleConfig = {
  fontSize: 24,
  color: '#ffffff',
}

const DEFAULT_MESSAGE_STYLE: TextStyleConfig = {
  fontSize: 22,
  color: '#cccccc',
  align: 'center',
}

const DEFAULT_HEADER_STYLE: TextStyleConfig = {
  fontSize: 20,
  color: '#aaaaaa',
}

const DEFAULT_RANK_STYLE: TextStyleConfig = {
  fontSize: 22,
  color: '#ffffff',
  stroke: '#000000',
  strokeThickness: 2,
}

const DEFAULT_NAME_STYLE: TextStyleConfig = {
  fontSize: 22,
  color: '#ffffff',
  stroke: '#000000',
  strokeThickness: 2,
}

const DEFAULT_SCORE_STYLE: TextStyleConfig = {
  fontSize: 22,
  color: '#ffdd44',
  stroke: '#000000',
  strokeThickness: 2,
}

const DEFAULT_PANEL_BG = {
  color: 0x1b1b1b,
  alpha: 0.92,
  strokeColor: 0xffffff,
  strokeAlpha: 0.2,
  strokeWidth: 2,
}

export class LeaderboardScene extends Phaser.Scene {
  private cfg: GameConfig
  private activeScene = false
  private contentBounds = new Phaser.Geom.Rectangle(0, 0, 480, 640)

  constructor(cfg: GameConfig) {
    super({ key: 'LeaderboardScene' })
    this.cfg = cfg
  }

  preload() {
    this.load.image('bg', this.cfg.assets.bg)
    preloadAudio(this, this.cfg)

    const lbUi = this.cfg.ui?.screens?.leaderboard
    if (lbUi?.backgroundImage) this.load.image('leaderboardBg', lbUi.backgroundImage)
    if (lbUi?.backButton?.image) this.load.image('btnLeaderboardBack', lbUi.backButton.image)
    if (lbUi?.panel?.background?.image) this.load.image('leaderboardPanelBg', lbUi.panel.background.image)
  }

  create() {
    this.activeScene = true
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.activeScene = false
    })
    this.events.once(Phaser.Scenes.Events.DESTROY, () => {
      this.activeScene = false
    })

    const { width, height } = this.scale
    const lbUi = this.cfg.ui?.screens?.leaderboard
    const texts = { ...DEFAULT_TEXTS, ...(lbUi?.texts ?? {}) }

    const bgKey = lbUi?.backgroundImage && this.textures.exists('leaderboardBg') ? 'leaderboardBg' : 'bg'
    this.add.image(width / 2, height / 2, bgKey).setDisplaySize(width, height)
    this.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      colorToNumber(lbUi?.overlayColor, 0x000000),
      clamp01(lbUi?.overlayAlpha, 0.55),
    )

    if (lbUi?.panel) {
      const panelX = resolveAxis(lbUi.panel.x, width, 0.5)
      const panelY = resolveAxis(lbUi.panel.y, height, 0.5)
      const panelW = resolveSize(lbUi.panel.width, width, 0.9)
      const panelH = resolveSize(lbUi.panel.height, height, 0.84)
      const panel = this.createPanel(panelX, panelY, panelW, panelH, lbUi.panel.background)
      panel.objects.forEach(obj => {
        ;(obj as Phaser.GameObjects.GameObject & { setDepth?: (value: number) => unknown }).setDepth?.(1)
      })
      this.contentBounds = panel.bounds
    } else {
      this.contentBounds = new Phaser.Geom.Rectangle(0, 0, width, height)
    }

    const titleY = this.contentBounds.top + 42
    const titleStyle = mergeTextStyle(DEFAULT_TITLE_STYLE, this.cfg.ui?.text, lbUi?.titleStyle)
    this.add.text(width / 2, titleY, texts.title, titleStyle).setOrigin(0.5).setDepth(2)

    const backButton = this.createBackButton(texts.back)
    ;(backButton as Phaser.GameObjects.GameObject & { setDepth?: (value: number) => unknown }).setDepth?.(2)

    const loadingStyle = mergeTextStyle(DEFAULT_LOADING_STYLE, this.cfg.ui?.text, lbUi?.loadingStyle)
    const loading = this.add
      .text(width / 2, this.contentBounds.centerY, texts.loading, loadingStyle)
      .setOrigin(0.5)
      .setDepth(2)

    void this.loadLeaderboard(loading, texts)
  }

  private createBackButton(defaultText: string): Phaser.GameObjects.GameObject {
    const { width } = this.scale
    const lbUi = this.cfg.ui?.screens?.leaderboard
    const backCfg = lbUi?.backButton
    const style = mergeButtonStyles(this.cfg.ui?.button, lbUi?.backButtonStyle, backCfg?.style)
    const x = this.resolveCoord(backCfg?.x, width, width / 2)
    const y = this.resolveCoord(backCfg?.y, this.scale.height, this.contentBounds.bottom - 36)

    if (backCfg?.image && this.textures.exists('btnLeaderboardBack')) {
      const img = this.add.image(x, y, 'btnLeaderboardBack').setInteractive({ useHandCursor: true })
      const hoverTint = colorToNumber(style.imageHoverTint, 0xdddddd)
      const hoverAlpha = clamp01(style.imageHoverAlpha, 1)

      img.on('pointerover', () => {
        img.setTint(hoverTint)
        img.setAlpha(hoverAlpha)
      })
      img.on('pointerout', () => {
        img.clearTint()
        img.setAlpha(1)
      })
      img.on('pointerdown', () => {
        playAudioBinding(this, this.cfg, 'leaderboard:back:click')
        this.scene.start('MenuScene')
      })
      return img
    }

    const baseStyle = mergeTextStyle(DEFAULT_BUTTON_STYLE, this.cfg.ui?.text, style.text)
    const hoverStyle = mergeTextStyle(baseStyle, DEFAULT_BUTTON_HOVER_STYLE, style.hoverText)
    const label = backCfg?.text || defaultText
    const btn = this.add
      .text(x, y, label, baseStyle)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })

    btn.on('pointerover', () => btn.setStyle(hoverStyle))
    btn.on('pointerout', () => btn.setStyle(baseStyle))
    btn.on('pointerdown', () => {
      playAudioBinding(this, this.cfg, 'leaderboard:back:click')
      this.scene.start('MenuScene')
    })
    return btn
  }

  private async loadLeaderboard(
    loading: Phaser.GameObjects.Text,
    texts: typeof DEFAULT_TEXTS,
  ): Promise<void> {
    const { width } = this.scale
    const lbUi = this.cfg.ui?.screens?.leaderboard

    await initYandex()
    if (!this.activeScene) return

    const messageStyle = mergeTextStyle(DEFAULT_MESSAGE_STYLE, this.cfg.ui?.text, lbUi?.messageStyle)
    if (!isAvailable()) {
      loading.destroy()
      this.add
        .text(width / 2, this.contentBounds.centerY, texts.unavailable, messageStyle)
        .setOrigin(0.5)
        .setDepth(2)
      return
    }

    loading.setText(texts.loading)
    const lbName = this.cfg.leaderboard?.name || 'main'
    const entries = await getLeaderboard(lbName)

    if (!this.activeScene) return
    loading.destroy()

    if (entries.length === 0) {
      this.add
        .text(width / 2, this.contentBounds.centerY, texts.empty, messageStyle)
        .setOrigin(0.5)
        .setDepth(2)
      return
    }

    const startY = this.resolveCoord(lbUi?.startY, this.scale.height, this.contentBounds.top + 92)
    const rowH = Math.max(20, numberOr(lbUi?.rowHeight, 38))

    const rankX = this.resolveCoord(lbUi?.columns?.rankX, this.scale.width, this.contentBounds.left + 20)
    const nameX = this.resolveCoord(lbUi?.columns?.nameX, this.scale.width, this.contentBounds.left + 60)
    const scoreX = this.resolveCoord(lbUi?.columns?.scoreX, this.scale.width, this.contentBounds.right - 20)

    const headerStyle = mergeTextStyle(DEFAULT_HEADER_STYLE, this.cfg.ui?.text, lbUi?.headerStyle)
    const rankStyle = mergeTextStyle(DEFAULT_RANK_STYLE, this.cfg.ui?.text, lbUi?.rankStyle)
    const nameStyle = mergeTextStyle(DEFAULT_NAME_STYLE, this.cfg.ui?.text, lbUi?.nameStyle)
    const scoreStyle = mergeTextStyle(DEFAULT_SCORE_STYLE, this.cfg.ui?.text, lbUi?.scoreStyle)

    // Column headers
    this.add.text(rankX, startY, texts.columnRank, headerStyle).setOrigin(0, 0.5).setDepth(2)
    this.add.text(nameX, startY, texts.columnPlayer, headerStyle).setOrigin(0, 0.5).setDepth(2)
    this.add.text(scoreX, startY, texts.columnScore, headerStyle).setOrigin(1, 0.5).setDepth(2)

    entries.forEach((entry, i) => {
      const y = startY + (i + 1) * rowH

      this.add.text(rankX, y, `${entry.rank}`, rankStyle).setOrigin(0, 0.5).setDepth(2)
      this.add.text(nameX, y, entry.name, nameStyle).setOrigin(0, 0.5).setDepth(2)
      this.add.text(scoreX, y, `${entry.score}`, scoreStyle).setOrigin(1, 0.5).setDepth(2)
    })
  }

  private createPanel(
    x: number,
    y: number,
    width: number,
    height: number,
    cfg: PanelBackgroundConfig | undefined,
  ): {
    objects: Phaser.GameObjects.GameObject[]
    bounds: Phaser.Geom.Rectangle
  } {
    const source: PanelBackgroundConfig = cfg ?? DEFAULT_PANEL_BG
    const alpha = clamp01(source.alpha, DEFAULT_PANEL_BG.alpha)
    const strokeWidth = Math.max(0, Math.round(numberOr(source.strokeWidth, DEFAULT_PANEL_BG.strokeWidth)))
    const strokeColor = colorToNumber(source.strokeColor, DEFAULT_PANEL_BG.strokeColor)
    const strokeAlpha = clamp01(source.strokeAlpha, DEFAULT_PANEL_BG.strokeAlpha)

    const objects: Phaser.GameObjects.GameObject[] = []
    if (source.image && this.textures.exists('leaderboardPanelBg')) {
      const panelImage = this.add.image(x, y, 'leaderboardPanelBg').setDisplaySize(width, height).setAlpha(alpha)
      objects.push(panelImage)
    } else {
      const fillColor = colorToNumber(source.color, DEFAULT_PANEL_BG.color)
      objects.push(this.add.rectangle(x, y, width, height, fillColor, alpha))
    }

    if (strokeWidth > 0) {
      const frame = this.add.rectangle(x, y, width, height)
      frame.setFillStyle(0x000000, 0)
      frame.setStrokeStyle(strokeWidth, strokeColor, strokeAlpha)
      objects.push(frame)
    }

    return {
      objects,
      bounds: new Phaser.Geom.Rectangle(x - width / 2, y - height / 2, width, height),
    }
  }

  private resolveCoord(value: number | undefined, total: number, fallbackPx: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) return fallbackPx
    if (value <= 1) return total * value
    return value
  }
}
