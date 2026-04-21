import Phaser from 'phaser'
import type {
  ButtonConfig,
  ButtonStyleConfig,
  GameConfig,
  GameContext,
  GameEvent,
  PanelBackgroundConfig,
  TextStyleConfig,
} from '../types'
import { ensureBackgroundMusic, playAudioBinding, preloadAudio } from '../audio'
import { state, updateBestScore } from '../state'
import { submitScore } from '../yandex'
import {
  clamp01,
  colorToNumber,
  mergeButtonStyles,
  mergeTextStyle,
  numberOr,
  resolveAxis,
  resolveSize,
} from '../ui'

const DEFAULT_DIFFICULTY = {
  intervalStep: 20,
  minInterval: 1100,
  gapShrinkPerPoint: 1.2,
  minGap: 120,
  speedStep: 1.6,
  maxSpeed: 320,
}

const DEFAULT_GAME_OVER = {
  title: 'GAME OVER',
  scoreLabel: 'Score',
  bestLabel: 'Best',
  newBestLabel: 'NEW BEST!',
  panelColor: 0x1b1b1b,
  panelAlpha: 0.95,
  panelStrokeColor: 0xffffff,
  panelStrokeAlpha: 0.2,
  panelStrokeWidth: 3,
  retryText: 'RETRY',
  menuText: 'MENU',
}

const DEFAULT_GAME_OVER_TITLE_STYLE: TextStyleConfig = {
  fontSize: 42,
  color: '#ffffff',
  stroke: '#000000',
  strokeThickness: 6,
  fontStyle: 'bold',
}

const DEFAULT_GAME_OVER_SCORE_STYLE: TextStyleConfig = {
  fontSize: 30,
  color: '#ffffff',
  stroke: '#000000',
  strokeThickness: 4,
}

const DEFAULT_GAME_OVER_BEST_STYLE: TextStyleConfig = {
  fontSize: 26,
  color: '#ffdd44',
  stroke: '#000000',
  strokeThickness: 3,
}

const DEFAULT_GAME_OVER_BADGE_STYLE: TextStyleConfig = {
  fontSize: 22,
  color: '#66ff88',
  stroke: '#000000',
  strokeThickness: 3,
  fontStyle: 'bold',
}

const DEFAULT_GAME_OVER_BUTTON_STYLE: TextStyleConfig = {
  fontSize: 30,
  color: '#ffffff',
  backgroundColor: '#444444',
  padding: { left: 24, right: 24, top: 12, bottom: 12 },
  stroke: '#000000',
  strokeThickness: 2,
}

const DEFAULT_GAME_OVER_BUTTON_HOVER_STYLE: TextStyleConfig = {
  backgroundColor: '#666666',
}

const DEFAULT_SCORE_HUD_STYLE: TextStyleConfig = {
  fontSize: 28,
  color: '#ffffff',
  stroke: '#000000',
  strokeThickness: 4,
}

export class GameScene extends Phaser.Scene {
  private cfg: GameConfig
  private player!: Phaser.Physics.Arcade.Sprite
  private pipes!: Phaser.Physics.Arcade.Group
  private coins!: Phaser.Physics.Arcade.Group
  private scoreText!: Phaser.GameObjects.Text
  private score = 0
  private taps = 0
  private alive = true
  private spawnTimer = 0
  private pairData: Array<{ pipe: Phaser.Physics.Arcade.Sprite; scored: boolean }> = []

  constructor(cfg: GameConfig) {
    super({ key: 'GameScene' })
    this.cfg = cfg
  }

  preload() {
    const { assets } = this.cfg
    this.load.image('bg', assets.bg)
    this.load.image('player', assets.player)
    this.load.image('pipeTop', assets.pipeTop)
    this.load.image('pipeBottom', assets.pipeBottom)
    if (assets.coin) this.load.image('coin', assets.coin)
    preloadAudio(this, this.cfg)

    const gameOver = this.cfg.gameOver
    if (gameOver?.retry?.image) this.load.image('btnGameOverRetry', gameOver.retry.image)
    if (gameOver?.menu?.image) this.load.image('btnGameOverMenu', gameOver.menu.image)
    const panelBgImage =
      this.cfg.ui?.screens?.gameOver?.panel?.background?.image ?? this.cfg.gameOver?.background?.image
    if (panelBgImage) this.load.image('gameOverPanelBg', panelBgImage)
  }

  create() {
    const { width, height } = this.scale

    // Background
    this.add.image(width / 2, height / 2, 'bg').setDisplaySize(width, height)

    // Physics world gravity
    this.physics.world.gravity.y = this.cfg.physics.gravity

    // Player — setDisplaySize scales the sprite; Phaser auto-scales the
    // physics body via updateBounds(), so no manual setSize() is needed.
    this.player = this.physics.add.sprite(width * 0.25, height / 2, 'player')
    this.player.setDisplaySize(this.cfg.player.width, this.cfg.player.height)

    // Groups
    this.pipes = this.physics.add.group()
    this.coins = this.physics.add.group()

    // Reset state (scene.restart / scene.start calls create() again)
    this.score = 0
    this.taps = 0
    this.alive = true
    this.spawnTimer = 0
    this.pairData = []

    // HUD
    const gameScoreStyle = (
      this.cfg.ui?.screens as
        | {
            game?: {
              scoreStyle?: TextStyleConfig
            }
          }
        | undefined
    )?.game?.scoreStyle

    this.scoreText = this.add
      .text(
        16,
        16,
        'Score: 0',
        mergeTextStyle(DEFAULT_SCORE_HUD_STYLE, this.cfg.ui?.text, gameScoreStyle),
      )
      .setDepth(10)

    // Input
    this.input.on('pointerdown', this.jump, this)
    this.input.keyboard?.on('keydown-SPACE', this.jump, this)

    // Collisions
    this.physics.add.overlap(this.player, this.pipes, () => this.die(), undefined, this)
    this.physics.add.overlap(
      this.player,
      this.coins,
      (_p, coin) => {
        (coin as Phaser.GameObjects.GameObject).destroy()
        this.fire('coin:collected')
      },
      undefined,
      this,
    )

    // Sound — apply persisted mute state and keep legacy music behavior.
    this.sound.mute = state.muted
    ensureBackgroundMusic(this, this.cfg)

    this.fire('game:start')
  }

  update(_time: number, delta: number) {
    if (!this.alive) return

    // Tilt player based on vertical velocity
    const body = this.player.body as Phaser.Physics.Arcade.Body
    this.player.angle = Phaser.Math.Clamp(body.velocity.y * 0.08, -25, 85)

    // Kill if out of vertical bounds
    if (this.player.y > this.scale.height + 60 || this.player.y < -60) {
      this.die()
      return
    }

    // Pipe spawning
    this.spawnTimer += delta
    const spawnInterval = this.getCurrentSpawnInterval()
    while (this.spawnTimer >= spawnInterval) {
      this.spawnTimer -= spawnInterval
      this.spawnPipes()
    }

    // Score & cleanup for tracked pipe pairs.
    for (let i = this.pairData.length - 1; i >= 0; i--) {
      const pair = this.pairData[i]
      if (!pair.pipe.active) {
        this.pairData.splice(i, 1)
        continue
      }

      if (!pair.scored && pair.pipe.x < this.player.x) {
        pair.scored = true
        this.score++
        this.scoreText.setText(`Score: ${this.score}`)
        this.fire('obstacle:passed')
      }
    }

    // Off-screen cleanup (avoid per-frame temporary arrays).
    const pipeChildren = this.pipes.getChildren()
    for (let i = pipeChildren.length - 1; i >= 0; i--) {
      const pipe = pipeChildren[i] as Phaser.Physics.Arcade.Sprite
      if (pipe.x < -120) {
        pipe.destroy()
      }
    }

    const coinChildren = this.coins.getChildren()
    for (let i = coinChildren.length - 1; i >= 0; i--) {
      const coin = coinChildren[i] as Phaser.Physics.Arcade.Sprite
      if (coin.x < -120) {
        coin.destroy()
      }
    }

    this.fire('tick')
  }

  private jump() {
    if (!this.alive) return
    this.taps++
    ;(this.player.body as Phaser.Physics.Arcade.Body).setVelocityY(this.cfg.physics.jumpForce)
    this.fire('player:jump')
  }

  private spawnPipes() {
    const { width, height } = this.scale
    const gapShrink = this.score * this.num(this.cfg.difficulty?.gapShrinkPerPoint, DEFAULT_DIFFICULTY.gapShrinkPerPoint)
    const minGap = Math.max(40, this.num(this.cfg.difficulty?.minGap, DEFAULT_DIFFICULTY.minGap))

    const dynamicGapMin = Math.max(minGap, this.cfg.spawn.gapMin - gapShrink)
    const dynamicGapMax = Math.max(dynamicGapMin, this.cfg.spawn.gapMax - gapShrink)
    const gap = Phaser.Math.Between(Math.round(dynamicGapMin), Math.round(dynamicGapMax))
    const gapCenter = Phaser.Math.Between(Math.round(height * 0.25), Math.round(height * 0.75))
    const x = width + 60
    const vx = -this.getCurrentSpeed()

    // Top pipe: origin at its bottom edge, flush against the gap top
    const top = this.pipes.create(x, gapCenter - gap / 2, 'pipeTop') as Phaser.Physics.Arcade.Sprite
    top.setOrigin(0.5, 1).setVelocityX(vx).setImmovable(true)
    ;(top.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)

    // Bottom pipe: origin at its top edge, flush against the gap bottom
    const bottom = this.pipes.create(x, gapCenter + gap / 2, 'pipeBottom') as Phaser.Physics.Arcade.Sprite
    bottom.setOrigin(0.5, 0).setVelocityX(vx).setImmovable(true)
    ;(bottom.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)

    this.pairData.push({ pipe: top, scored: false })
  }

  private spawnCoin() {
    if (!this.cfg.assets.coin) return
    const { width, height } = this.scale
    const coin = this.coins.create(
      width + 60,
      Phaser.Math.Between(Math.round(height * 0.2), Math.round(height * 0.8)),
      'coin',
    ) as Phaser.Physics.Arcade.Sprite
    coin.setVelocityX(-this.getCurrentSpeed())
    ;(coin.body as Phaser.Physics.Arcade.Body).setAllowGravity(false)
  }

  private die() {
    if (!this.alive) return
    this.alive = false
    this.player.setTint(0xff4444)
    this.player.setAngle(0)
    const body = this.player.body as Phaser.Physics.Arcade.Body
    body.setVelocity(0, 0)
    body.setAllowGravity(false)
    this.pipes.setVelocityX(0)
    this.coins.setVelocityX(0)

    this.fire('player:collision')
    this.fire('game:over')

    // Submit score to Yandex leaderboard (non-blocking, fire-and-forget)
    if (this.cfg.leaderboard) {
      submitScore(this.cfg.leaderboard.name, this.score)
    }

    const isNewBest = updateBestScore(this.score)
    this.showGameOver(state.bestScore, isNewBest)
  }

  private fire(event: GameEvent) {
    playAudioBinding(this, this.cfg, event)
    this.cfg.events?.[event]?.(this.makeCtx())
  }

  private makeCtx(): GameContext {
    return {
      score: this.score,
      time: this.time.now,
      taps: this.taps,
      customButtons: state.customButtons,
      addScore: v => {
        this.score += v
        this.scoreText.setText(`Score: ${this.score}`)
      },
      endGame: () => this.die(),
      spawnCoin: () => this.spawnCoin(),
    }
  }

  private num(value: number | undefined, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback
  }

  private getCurrentSpawnInterval(): number {
    const intervalStep = this.num(this.cfg.difficulty?.intervalStep, DEFAULT_DIFFICULTY.intervalStep)
    const configuredMin = this.num(this.cfg.difficulty?.minInterval, DEFAULT_DIFFICULTY.minInterval)
    const minInterval = Math.min(this.cfg.spawn.interval, Math.max(250, configuredMin))

    const interval = this.cfg.spawn.interval - this.score * intervalStep
    return Phaser.Math.Clamp(interval, minInterval, this.cfg.spawn.interval)
  }

  private getCurrentSpeed(): number {
    const speedStep = this.num(this.cfg.difficulty?.speedStep, DEFAULT_DIFFICULTY.speedStep)
    const configuredMax = this.num(this.cfg.difficulty?.maxSpeed, DEFAULT_DIFFICULTY.maxSpeed)
    const maxSpeed = Math.max(this.cfg.physics.speed, configuredMax)

    const speed = this.cfg.physics.speed + this.score * speedStep
    return Phaser.Math.Clamp(speed, this.cfg.physics.speed, maxSpeed)
  }

  private showGameOver(bestScore: number, isNewBest: boolean) {
    const { width, height } = this.scale
    const gameOver = this.cfg.gameOver
    const gameOverUi = this.cfg.ui?.screens?.gameOver
    const retryCfg = gameOver?.retry
    const menuCfg = gameOver?.menu
    const panelCfg = gameOverUi?.panel
    const backgroundCfg = panelCfg?.background ?? gameOver?.background
    const panelWidth = resolveSize(panelCfg?.width, width, 0.78)
    const panelHeight = resolveSize(panelCfg?.height, height, 0.6)
    const panelX = resolveAxis(panelCfg?.x, width, 0.5)
    const panelY = resolveAxis(panelCfg?.y, height, 0.5)
    const panelPadding = Math.max(0, numberOr(panelCfg?.padding, 12))
    const gameOverButtonStyle = mergeButtonStyles(this.cfg.ui?.button, gameOverUi?.buttonStyle)

    const overlay = this.add.container(0, 0).setDepth(20)
    const shade = this.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      colorToNumber(gameOverUi?.overlayColor, 0x000000),
      clamp01(gameOverUi?.overlayAlpha, 0.65),
    )
    const panel = this.createGameOverPanel(panelX, panelY, panelWidth, panelHeight, backgroundCfg)
    const titleY = panelY - panelHeight * 0.28
    const badgeY = titleY - panelHeight * 0.12
    const scoreY = panelY - panelHeight * 0.05
    const bestY = panelY + panelHeight * 0.06

    const title = this.add
      .text(
        panelX,
        titleY,
        gameOver?.title || DEFAULT_GAME_OVER.title,
        mergeTextStyle(DEFAULT_GAME_OVER_TITLE_STYLE, this.cfg.ui?.text, gameOverUi?.titleStyle),
      )
      .setOrigin(0.5)

    const scoreText = this.add
      .text(
        panelX,
        scoreY,
        `${gameOver?.scoreLabel || DEFAULT_GAME_OVER.scoreLabel}: ${this.score}`,
        mergeTextStyle(DEFAULT_GAME_OVER_SCORE_STYLE, this.cfg.ui?.text, gameOverUi?.scoreStyle),
      )
      .setOrigin(0.5)

    const bestText = this.add
      .text(
        panelX,
        bestY,
        `${gameOver?.bestLabel || DEFAULT_GAME_OVER.bestLabel}: ${bestScore}`,
        mergeTextStyle(DEFAULT_GAME_OVER_BEST_STYLE, this.cfg.ui?.text, gameOverUi?.bestStyle),
      )
      .setOrigin(0.5)

    const badge = isNewBest
      ? this.add
          .text(
            panelX,
            badgeY,
            gameOver?.newBestLabel || DEFAULT_GAME_OVER.newBestLabel,
            mergeTextStyle(DEFAULT_GAME_OVER_BADGE_STYLE, this.cfg.ui?.text, gameOverUi?.badgeStyle),
          )
          .setOrigin(0.5)
      : null

    const retry = this.createGameOverButton(
      retryCfg,
      0.5,
      0.62,
      'btnGameOverRetry',
      DEFAULT_GAME_OVER.retryText,
      () => {
        playAudioBinding(this, this.cfg, 'game:retry:click')
        this.scene.restart()
      },
      gameOverButtonStyle,
    )
    const menu = this.createGameOverButton(
      menuCfg,
      0.5,
      0.72,
      'btnGameOverMenu',
      DEFAULT_GAME_OVER.menuText,
      () => {
        playAudioBinding(this, this.cfg, 'game:menu:click')
        this.scene.start(this.cfg.menu ? 'MenuScene' : 'GameScene')
      },
      gameOverButtonStyle,
    )
    this.clampInsidePanelY(retry, panel.clampTarget, panelPadding)
    this.clampInsidePanelY(menu, panel.clampTarget, panelPadding)

    const objects: Phaser.GameObjects.GameObject[] = [shade, ...panel.objects, title, scoreText, bestText, retry, menu]
    if (badge) objects.push(badge)
    overlay.add(objects)
  }

  private createGameOverPanel(
    x: number,
    y: number,
    width: number,
    height: number,
    cfg: PanelBackgroundConfig | undefined,
  ): {
    objects: Phaser.GameObjects.GameObject[]
    clampTarget: Phaser.GameObjects.GameObject
  } {
    const alpha = clamp01(cfg?.alpha, DEFAULT_GAME_OVER.panelAlpha)
    const strokeWidth = Math.max(0, Math.round(numberOr(cfg?.strokeWidth, DEFAULT_GAME_OVER.panelStrokeWidth)))
    const strokeColor = colorToNumber(cfg?.strokeColor, DEFAULT_GAME_OVER.panelStrokeColor)
    const strokeAlpha = clamp01(cfg?.strokeAlpha, DEFAULT_GAME_OVER.panelStrokeAlpha)

    const objects: Phaser.GameObjects.GameObject[] = []
    let clampTarget: Phaser.GameObjects.GameObject

    if (cfg?.image && this.textures.exists('gameOverPanelBg')) {
      const panelImage = this.add.image(x, y, 'gameOverPanelBg').setDisplaySize(width, height).setAlpha(alpha)
      objects.push(panelImage)
      clampTarget = panelImage
    } else {
      const fillColor = colorToNumber(cfg?.color, DEFAULT_GAME_OVER.panelColor)
      const panelRect = this.add.rectangle(x, y, width, height, fillColor, alpha)
      objects.push(panelRect)
      clampTarget = panelRect
    }

    if (strokeWidth > 0) {
      const frame = this.add.rectangle(x, y, width, height)
      frame.setFillStyle(0x000000, 0)
      frame.setStrokeStyle(strokeWidth, strokeColor, strokeAlpha)
      objects.push(frame)
    }

    return { objects, clampTarget }
  }

  private createGameOverButton(
    cfg: ButtonConfig | undefined,
    defaultX: number,
    defaultY: number,
    imageKey: string,
    fallbackLabel: string,
    onClick: () => void,
    style: ButtonStyleConfig,
  ): Phaser.GameObjects.GameObject {
    const { width, height } = this.scale
    const x = width * (cfg?.x ?? defaultX)
    const y = height * (cfg?.y ?? defaultY)
    const buttonStyleOverride = (cfg as { style?: ButtonStyleConfig } | undefined)?.style
    const finalStyle = mergeButtonStyles(style, buttonStyleOverride)

    if (cfg?.image && this.textures.exists(imageKey)) {
      const img = this.add.image(x, y, imageKey).setInteractive({ useHandCursor: true })
      const hoverTint = colorToNumber(finalStyle.imageHoverTint, 0xdddddd)
      const hoverAlpha = clamp01(finalStyle.imageHoverAlpha, 1)
      img.on('pointerover', () => {
        img.setTint(hoverTint)
        img.setAlpha(hoverAlpha)
      })
      img.on('pointerout', () => {
        img.clearTint()
        img.setAlpha(1)
      })
      img.on('pointerdown', onClick)
      return img
    }

    return this.createOverlayButton(x, y, cfg?.text || fallbackLabel, onClick, finalStyle)
  }

  private createOverlayButton(
    x: number,
    y: number,
    label: string,
    onClick: () => void,
    style: ButtonStyleConfig,
  ): Phaser.GameObjects.Text {
    const baseStyle = mergeTextStyle(DEFAULT_GAME_OVER_BUTTON_STYLE, this.cfg.ui?.text, style.text)
    const hoverStyle = mergeTextStyle(baseStyle, DEFAULT_GAME_OVER_BUTTON_HOVER_STYLE, style.hoverText)

    const btn = this.add
      .text(x, y, label, baseStyle)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })

    btn.on('pointerover', () => btn.setStyle(hoverStyle))
    btn.on('pointerout', () => btn.setStyle(baseStyle))
    btn.on('pointerdown', onClick)
    return btn
  }

  private clampInsidePanelY(
    obj: Phaser.GameObjects.GameObject,
    panel: Phaser.GameObjects.GameObject,
    padding: number,
  ): void {
    const boundedObj = obj as Phaser.GameObjects.GameObject & {
      y: number
      getBounds?: () => Phaser.Geom.Rectangle
    }
    const boundedPanel = panel as Phaser.GameObjects.GameObject & {
      y: number
      getBounds?: () => Phaser.Geom.Rectangle
    }
    if (typeof boundedObj.getBounds !== 'function' || typeof boundedPanel.getBounds !== 'function') return

    const bounds = boundedObj.getBounds()
    const panelBounds = boundedPanel.getBounds()
    const halfHeight = bounds.height / 2
    const minY = panelBounds.top + padding + halfHeight
    const maxY = panelBounds.bottom - padding - halfHeight

    if (minY > maxY) {
      boundedObj.y = boundedPanel.y
      return
    }

    boundedObj.y = Phaser.Math.Clamp(boundedObj.y, minY, maxY)
  }
}
