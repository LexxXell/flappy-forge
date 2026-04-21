export type GameEvent =
  | 'game:start'
  | 'game:over'
  | 'player:jump'
  | 'player:collision'
  | 'obstacle:passed'
  | 'coin:collected'
  | 'tick'

export type AudioBindingEvent =
  | GameEvent
  | 'menu:start:click'
  | 'menu:leaderboard:click'
  | 'menu:mute:toggle'
  | 'menu:custom:toggle'
  | 'game:retry:click'
  | 'game:menu:click'
  | 'leaderboard:back:click'

export type ColorValue = string | number

export interface AudioClipConfig {
  src: string
  volume?: number
  rate?: number
  loop?: boolean
}

export interface MusicConfig {
  src?: string
  volume?: number
  rate?: number
  loop?: boolean
  autoplay?: boolean
}

export interface AudioBindingConfig {
  clip: string | string[]
  volume?: number
  rate?: number
  loop?: boolean
}

export type AudioBindingTarget = string | string[] | AudioBindingConfig

export interface AudioConfig {
  music?: MusicConfig
  sfx?: Record<string, AudioClipConfig>
  bindings?: Partial<Record<AudioBindingEvent, AudioBindingTarget>>
}

export interface GameContext {
  score: number
  time: number
  taps: number
  customButtons: Record<string, boolean>
  addScore(value: number): void
  endGame(): void
  spawnCoin(): void
}

export interface ButtonConfig {
  text?: string
  image?: string
  x?: number // 0–1 fraction of screen width  (default 0.5)
  y?: number // 0–1 fraction of screen height
  style?: ButtonStyleConfig
}

export interface CustomButtonDef extends ButtonConfig {
  id: string
}

export interface PaddingConfig {
  left?: number
  right?: number
  top?: number
  bottom?: number
}

export interface TextStyleConfig {
  fontFamily?: string
  fontSize?: number | string
  color?: ColorValue
  backgroundColor?: ColorValue
  stroke?: ColorValue
  strokeThickness?: number
  fontStyle?: string
  align?: 'left' | 'center' | 'right'
  padding?: PaddingConfig
}

export interface ButtonStyleConfig {
  text?: TextStyleConfig
  hoverText?: TextStyleConfig
  imageHoverTint?: ColorValue
  imageHoverAlpha?: number
  disabledAlpha?: number
}

export interface StyledButtonConfig extends ButtonConfig {
  style?: ButtonStyleConfig
}

export interface PanelBackgroundConfig {
  image?: string
  color?: ColorValue
  alpha?: number
  strokeColor?: ColorValue
  strokeAlpha?: number
  strokeWidth?: number
}

export interface PanelLayoutConfig {
  x?: number
  y?: number
  width?: number // <= 1 means fraction of viewport, >1 means px
  height?: number // <= 1 means fraction of viewport, >1 means px
  padding?: number
  background?: PanelBackgroundConfig
}

export interface CanvasScaleConfig {
  mode?:
    | 'NONE'
    | 'FIT'
    | 'ENVELOP'
    | 'RESIZE'
    | 'WIDTH_CONTROLS_HEIGHT'
    | 'HEIGHT_CONTROLS_WIDTH'
  autoCenter?: 'NO_CENTER' | 'CENTER_BOTH' | 'CENTER_HORIZONTALLY' | 'CENTER_VERTICALLY'
  zoom?: number
}

export interface CanvasConfig {
  width?: number
  height?: number
  backgroundColor?: ColorValue
  scale?: CanvasScaleConfig
}

export interface MenuScreenUIConfig {
  overlayColor?: ColorValue
  overlayAlpha?: number
  titleStyle?: TextStyleConfig
  buttonStyle?: ButtonStyleConfig
  muteButtonStyle?: ButtonStyleConfig
  customButtonStyle?: ButtonStyleConfig
}

export interface GameOverScreenUIConfig {
  overlayColor?: ColorValue
  overlayAlpha?: number
  panel?: PanelLayoutConfig
  titleStyle?: TextStyleConfig
  scoreStyle?: TextStyleConfig
  bestStyle?: TextStyleConfig
  badgeStyle?: TextStyleConfig
  buttonStyle?: ButtonStyleConfig
}

export interface GameScreenUIConfig {
  scoreStyle?: TextStyleConfig
}

export interface LeaderboardTextsConfig {
  title?: string
  back?: string
  loading?: string
  unavailable?: string
  empty?: string
  columnRank?: string
  columnPlayer?: string
  columnScore?: string
}

export interface LeaderboardColumnsConfig {
  rankX?: number
  nameX?: number
  scoreX?: number
}

export interface LeaderboardScreenUIConfig {
  backgroundImage?: string
  overlayColor?: ColorValue
  overlayAlpha?: number
  panel?: PanelLayoutConfig
  texts?: LeaderboardTextsConfig
  titleStyle?: TextStyleConfig
  backButton?: StyledButtonConfig
  backButtonStyle?: ButtonStyleConfig
  loadingStyle?: TextStyleConfig
  messageStyle?: TextStyleConfig
  headerStyle?: TextStyleConfig
  rankStyle?: TextStyleConfig
  nameStyle?: TextStyleConfig
  scoreStyle?: TextStyleConfig
  rowHeight?: number
  startY?: number
  columns?: LeaderboardColumnsConfig
}

export interface UIConfig {
  text?: TextStyleConfig
  button?: ButtonStyleConfig
  screens?: {
    menu?: MenuScreenUIConfig
    game?: GameScreenUIConfig
    gameOver?: GameOverScreenUIConfig
    leaderboard?: LeaderboardScreenUIConfig
  }
}

export interface GameConfig {
  meta: {
    id: string
    title: string
  }
  physics: {
    gravity: number
    jumpForce: number
    speed: number
  }
  spawn: {
    interval: number
    gapMin: number
    gapMax: number
  }
  difficulty?: {
    intervalStep?: number
    minInterval?: number
    gapShrinkPerPoint?: number
    minGap?: number
    speedStep?: number
    maxSpeed?: number
  }
  assets: {
    bg: string
    player: string
    pipeTop: string
    pipeBottom: string
    coin?: string
    music?: string
  }
  audio?: AudioConfig
  player: {
    width: number
    height: number
  }
  canvas?: CanvasConfig
  ui?: UIConfig
  menu?: {
    bg?: string
    title?: string
    start: ButtonConfig
    mute?: ButtonConfig
    leaderboard?: ButtonConfig
    custom?: CustomButtonDef[]
  }
  gameOver?: {
    title?: string
    scoreLabel?: string
    bestLabel?: string
    newBestLabel?: string
    background?: PanelBackgroundConfig
    retry?: ButtonConfig
    menu?: ButtonConfig
  }
  leaderboard?: {
    name: string
  }
  events?: Partial<Record<GameEvent, (ctx: GameContext) => void>>
}
