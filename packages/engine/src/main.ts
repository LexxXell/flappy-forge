import Phaser from 'phaser'
import config from './config'
import { MenuScene } from './scenes/MenuScene'
import { GameScene } from './scenes/GameScene'
import { LeaderboardScene } from './scenes/LeaderboardScene'
import { initYandex } from './yandex'
import { hydrateState } from './state'
import { colorToCss, numberOr, resolveAutoCenter, resolveScaleMode } from './ui'

document.title = config.meta.title

hydrateState()

// Non-blocking — initialises only when running on Yandex Games
initYandex()

const scenes: Phaser.Scene[] = []

if (config.menu) {
  scenes.push(new MenuScene(config))
}
scenes.push(new GameScene(config))
if (config.menu?.leaderboard) {
  scenes.push(new LeaderboardScene(config))
}

const canvas = config.canvas
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
