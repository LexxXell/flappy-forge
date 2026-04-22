export interface ThemeMeta {
  id: string
  title: string
  hasManifest: boolean
  isBuilt: boolean
  createdBy?: string
}

export interface UserInfo {
  id: number
  username: string
  role: 'admin' | 'creator'
  createdBy: string
  createdAt: string
}

export interface TokenPayload {
  sub: string
  role: 'owner' | 'admin' | 'creator' | 'user'
  iat?: number
  exp?: number
}

export interface BuildEvent {
  type: 'start' | 'log' | 'done'
  text?: string
  code?: number
  success?: boolean
}

export interface Manifest {
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
  assets: {
    bg: string
    player: string
    pipeTop: string
    pipeBottom: string
    coin?: string
    music?: string
  }
  audio?: {
    music?: {
      src?: string
      volume?: number
      rate?: number
      loop?: boolean
      autoplay?: boolean
    }
    sfx?: Record<string, { src: string; volume?: number; rate?: number }>
    bindings?: Record<string, string | string[]>
  }
  player: {
    width: number
    height: number
  }
  canvas?: {
    width?: number
    height?: number
    backgroundColor?: string
    scale?: {
      mode?: string
      autoCenter?: string
      zoom?: number
    }
  }
  menu?: {
    start?: { text?: string; y?: number }
    mute?: { text?: string; y?: number }
    leaderboard?: { text?: string; y?: number }
  }
  gameOver?: {
    title?: string
    scoreLabel?: string
    bestLabel?: string
    newBestLabel?: string
    background?: {
      color?: string
      alpha?: number
      strokeColor?: string
      strokeAlpha?: number
      strokeWidth?: number
    }
    retry?: { text?: string }
    menu?: { text?: string }
  }
  difficulty?: {
    intervalStep?: number
    minInterval?: number
    gapShrinkPerPoint?: number
    minGap?: number
    speedStep?: number
    maxSpeed?: number
  }
  leaderboard?: {
    name?: string
  }
  ui?: unknown
}
