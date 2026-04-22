import { spawn } from 'child_process'
import express from 'express'
import fs from 'fs'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import archiver from 'archiver'
import {
  authenticate, requireRole, attemptLogin, hashPassword,
  type AuthReq,
} from './auth.js'
import {
  listUsers, addUser, removeUser, findByUsername,
} from './users.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../../..')
const THEMES_DIR = path.join(ROOT, 'themes')
const BUILDS_DIR = path.join(ROOT, 'builds')

const app = express()
app.use(express.json({ limit: '10mb' }))

// CORS for Vite dev server
app.use((req, res, next) => {
  const origin = req.headers.origin
  if (origin === 'http://localhost:5173') {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  }
  if (req.method === 'OPTIONS') return res.sendStatus(200)
  next()
})

// ---------------------------------------------------------------------------
// Preview: serve built game files (public)
// ---------------------------------------------------------------------------

app.use('/preview/:theme', (req, res, next) => {
  const theme = sanitizeId(req.params.theme)
  if (!theme) return res.status(400).end()
  const buildDir = path.join(BUILDS_DIR, theme)
  if (!fs.existsSync(buildDir)) return res.status(404).end()
  express.static(buildDir)(req, res, next)
})

// ---------------------------------------------------------------------------
// Public: list of built games (for anonymous users)
// ---------------------------------------------------------------------------

app.get('/api/games', (_req, res) => {
  if (!fs.existsSync(THEMES_DIR)) return res.json([])
  const dirs = fs.readdirSync(THEMES_DIR).filter(d =>
    fs.statSync(path.join(THEMES_DIR, d)).isDirectory() &&
    fs.existsSync(path.join(BUILDS_DIR, d))
  )
  const result = dirs.map(id => {
    let title = id
    try {
      const m = JSON.parse(fs.readFileSync(path.join(THEMES_DIR, id, 'manifest.json'), 'utf-8'))
      title = m?.meta?.title ?? id
    } catch {}
    return { id, title }
  })
  res.json(result)
})

// ---------------------------------------------------------------------------
// Auth routes (public)
// ---------------------------------------------------------------------------

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string }
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password required' })
  }
  const token = await attemptLogin(username, password)
  if (!token) return res.status(401).json({ error: 'Invalid credentials' })
  res.json({ token })
})

app.get('/api/auth/me', authenticate, (req: AuthReq, res) => {
  res.json(req.user)
})

// ---------------------------------------------------------------------------
// User management (owner / admin)
// ---------------------------------------------------------------------------

app.get('/api/users', authenticate, requireRole('admin'), (_req, res) => {
  res.json(listUsers())
})

app.post('/api/users', authenticate, requireRole('admin'), async (req: AuthReq, res) => {
  const { username, password, role } = req.body as {
    username?: string; password?: string; role?: string
  }
  if (!username || !password || !role) {
    return res.status(400).json({ error: 'username, password, and role are required' })
  }
  if (role !== 'admin' && role !== 'creator') {
    return res.status(400).json({ error: 'role must be admin or creator' })
  }
  if (req.user!.role === 'admin' && role !== 'creator') {
    return res.status(403).json({ error: 'Admins can create only creator users' })
  }
  if (findByUsername(username)) {
    return res.status(409).json({ error: `User "${username}" already exists` })
  }
  try {
    const passwordHash = await hashPassword(password)
    const user = addUser(username, passwordHash, role, req.user!.sub)
    const { passwordHash: _pw, ...safe } = user
    res.status(201).json(safe)
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message })
  }
})

app.delete('/api/users/:id', authenticate, requireRole('owner'), (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' })
  const removed = removeUser(id)
  if (!removed) return res.status(404).json({ error: 'User not found' })
  res.json({ ok: true })
})

// ---------------------------------------------------------------------------
// API: themes list
// ---------------------------------------------------------------------------

app.get('/api/themes', authenticate, requireRole('creator'), (_req, res) => {
  if (!fs.existsSync(THEMES_DIR)) return res.json([])
  const dirs = fs.readdirSync(THEMES_DIR).filter(d =>
    fs.statSync(path.join(THEMES_DIR, d)).isDirectory()
  )
  const result = dirs.map(id => {
    const manifestPath = path.join(THEMES_DIR, id, 'manifest.json')
    let title = id
    try {
      const m = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
      title = m?.meta?.title ?? id
    } catch {}
    let createdBy: string | undefined
    try {
      const meta = JSON.parse(fs.readFileSync(path.join(THEMES_DIR, id, '_meta.json'), 'utf-8'))
      createdBy = meta?.createdBy
    } catch {}
    return {
      id,
      title,
      hasManifest: fs.existsSync(manifestPath),
      isBuilt: fs.existsSync(path.join(BUILDS_DIR, id)),
      createdBy,
    }
  })
  res.json(result)
})

// ---------------------------------------------------------------------------
// API: create theme
// ---------------------------------------------------------------------------

app.post('/api/themes', authenticate, requireRole('creator'), (req: AuthReq, res) => {
  const { id, title } = req.body as { id?: string; title?: string }
  if (!id || !sanitizeId(id)) {
    return res.status(400).json({ error: 'Недопустимый ID (только строчные буквы, цифры, дефис)' })
  }
  const themeDir = path.join(THEMES_DIR, id)
  if (fs.existsSync(themeDir)) {
    return res.status(409).json({ error: 'Тема с таким ID уже существует' })
  }
  fs.mkdirSync(path.join(themeDir, 'assets', 'audio'), { recursive: true })
  const manifest = defaultManifest(id, title || id)
  fs.writeFileSync(path.join(themeDir, 'manifest.json'), JSON.stringify(manifest, null, 2))
  fs.writeFileSync(
    path.join(themeDir, '_meta.json'),
    JSON.stringify({ createdBy: req.user!.sub, createdAt: new Date().toISOString() }, null, 2),
  )
  res.json({ id, title: title || id })
})

// ---------------------------------------------------------------------------
// API: delete theme
// ---------------------------------------------------------------------------

app.delete('/api/themes/:id', authenticate, requireRole('admin'), (req, res) => {
  const id = sanitizeId(req.params.id)
  if (!id) return res.status(400).json({ error: 'Invalid id' })
  const themeDir = path.join(THEMES_DIR, id)
  if (!fs.existsSync(themeDir)) return res.status(404).json({ error: 'Theme not found' })
  fs.rmSync(themeDir, { recursive: true, force: true })
  const buildDir = path.join(BUILDS_DIR, id)
  if (fs.existsSync(buildDir)) fs.rmSync(buildDir, { recursive: true, force: true })
  res.json({ ok: true })
})

// ---------------------------------------------------------------------------
// API: manifest CRUD
// ---------------------------------------------------------------------------

app.get('/api/themes/:id/manifest', authenticate, requireRole('creator'), (req, res) => {
  const id = sanitizeId(req.params.id)
  if (!id) return res.status(400).json({ error: 'Invalid id' })
  const manifestPath = path.join(THEMES_DIR, id, 'manifest.json')
  if (!fs.existsSync(manifestPath)) return res.status(404).json({ error: 'Manifest not found' })
  try {
    res.json(JSON.parse(fs.readFileSync(manifestPath, 'utf-8')))
  } catch {
    res.status(500).json({ error: 'Failed to parse manifest' })
  }
})

app.put('/api/themes/:id/manifest', authenticate, requireRole('creator'), (req, res) => {
  const id = sanitizeId(req.params.id)
  if (!id) return res.status(400).json({ error: 'Invalid id' })
  const themeDir = path.join(THEMES_DIR, id)
  if (!fs.existsSync(themeDir)) return res.status(404).json({ error: 'Theme not found' })
  try {
    fs.writeFileSync(path.join(themeDir, 'manifest.json'), JSON.stringify(req.body, null, 2))
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Failed to save manifest' })
  }
})

// ---------------------------------------------------------------------------
// API: assets
// ---------------------------------------------------------------------------

const upload = multer({
  storage: multer.diskStorage({
    destination(req, _file, cb) {
      const id = sanitizeId(req.params.id) ?? ''
      const subdir = sanitizeSubdir(req.query.dir as string | undefined)
      const dest = path.join(THEMES_DIR, id, 'assets', subdir)
      fs.mkdirSync(dest, { recursive: true })
      cb(null, dest)
    },
    filename(_req, file, cb) {
      cb(null, file.originalname)
    },
  }),
})

app.get('/api/themes/:id/assets', authenticate, requireRole('creator'), (req, res) => {
  const id = sanitizeId(req.params.id)
  if (!id) return res.status(400).json({ error: 'Invalid id' })
  const assetsDir = path.join(THEMES_DIR, id, 'assets')
  if (!fs.existsSync(assetsDir)) return res.json([])
  res.json(walkDir(assetsDir))
})

app.post('/api/themes/:id/assets', authenticate, requireRole('creator'), upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' })
  const subdir = sanitizeSubdir(req.query.dir as string | undefined)
  const relPath = subdir ? `${subdir}/${req.file.originalname}` : req.file.originalname
  res.json({ path: relPath })
})

app.delete('/api/themes/:id/assets', authenticate, requireRole('creator'), (req, res) => {
  const id = sanitizeId(req.params.id)
  if (!id) return res.status(400).json({ error: 'Invalid id' })
  const relPath = req.query.path as string
  if (!relPath) return res.status(400).json({ error: 'Missing path' })
  const full = path.resolve(path.join(THEMES_DIR, id, 'assets'), relPath)
  const base = path.resolve(path.join(THEMES_DIR, id, 'assets'))
  if (!full.startsWith(base)) return res.status(403).json({ error: 'Forbidden' })
  try {
    fs.unlinkSync(full)
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Failed to delete' })
  }
})

// ---------------------------------------------------------------------------
// API: serve individual asset file (for preview in web UI)
// ---------------------------------------------------------------------------

app.get('/api/themes/:id/asset-file', authenticate, requireRole('creator'), (req, res) => {
  const id = sanitizeId(req.params.id)
  if (!id) return res.status(400).end()
  const relPath = req.query.path as string
  if (!relPath) return res.status(400).end()
  const full = path.resolve(path.join(THEMES_DIR, id, 'assets'), relPath)
  const base = path.resolve(path.join(THEMES_DIR, id, 'assets'))
  if (!full.startsWith(base)) return res.status(403).end()
  if (!fs.existsSync(full)) return res.status(404).end()
  res.sendFile(full)
})

// ---------------------------------------------------------------------------
// API: build (SSE streaming)
// ---------------------------------------------------------------------------

app.get('/api/themes/:id/build', authenticate, requireRole('creator'), (req, res) => {
  const id = sanitizeId(req.params.id)
  if (!id) return res.status(400).end()
  const themeDir = path.join(THEMES_DIR, id)
  if (!fs.existsSync(themeDir)) return res.status(404).end()

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const send = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  send({ type: 'start', text: `Сборка темы: ${id}` })

  const proc = spawn('tsx', ['packages/builder/src/index.ts', `--theme=${id}`], {
    cwd: ROOT,
    shell: false,
  })

  proc.stdout.on('data', (chunk: Buffer) => send({ type: 'log', text: chunk.toString() }))
  proc.stderr.on('data', (chunk: Buffer) => send({ type: 'log', text: chunk.toString() }))
  proc.on('close', (code: number | null) => {
    send({ type: 'done', code, success: code === 0 })
    res.end()
  })

  req.on('close', () => { try { proc.kill() } catch {} })
})

// ---------------------------------------------------------------------------
// API: download zip (admin+)
// ---------------------------------------------------------------------------

app.get('/api/themes/:id/download', authenticate, requireRole('admin'), (req, res) => {
  const id = sanitizeId(req.params.id)
  if (!id) return res.status(400).json({ error: 'Invalid id' })
  const buildDir = path.join(BUILDS_DIR, id)
  if (!fs.existsSync(buildDir)) {
    return res.status(404).json({ error: 'Сборка не найдена. Сначала соберите тему.' })
  }
  res.setHeader('Content-Type', 'application/zip')
  res.setHeader('Content-Disposition', `attachment; filename="${id}.zip"`)
  const arc = archiver('zip', { zlib: { level: 9 } })
  arc.on('error', err => { console.error('archiver error', err); res.destroy() })
  arc.pipe(res)
  arc.directory(buildDir, false)
  arc.finalize()
})

// ---------------------------------------------------------------------------
// SPA fallback (production)
// ---------------------------------------------------------------------------

const clientDist = path.join(__dirname, '../client/dist')
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist))
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')))
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitizeId(raw: string | undefined): string | null {
  if (!raw) return null
  const s = raw.trim()
  return /^[a-z0-9_-]+$/i.test(s) ? s : null
}

function sanitizeSubdir(raw: string | undefined): string {
  if (!raw) return ''
  const parts = raw.split(/[/\\]/).filter(p => p && p !== '..' && p !== '.')
  return parts.join('/')
}

function walkDir(dir: string, base = ''): string[] {
  const out: string[] = []
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry)
    const rel = base ? `${base}/${entry}` : entry
    if (fs.statSync(full).isDirectory()) out.push(...walkDir(full, rel))
    else out.push(rel)
  }
  return out
}

function defaultManifest(id: string, title: string) {
  return {
    meta: { id, title },
    physics: { gravity: 900, jumpForce: -380, speed: 210 },
    spawn: { interval: 1800, gapMin: 140, gapMax: 220 },
    assets: {
      bg: 'assets/bg.png',
      player: 'assets/player.png',
      pipeTop: 'assets/pipe-top.png',
      pipeBottom: 'assets/pipe-bottom.png',
    },
    player: { width: 44, height: 32 },
    canvas: {
      width: 540,
      height: 960,
      backgroundColor: '#1e3c56',
      scale: { mode: 'FIT', autoCenter: 'CENTER_BOTH', zoom: 1 },
    },
    menu: {
      start: { text: 'START' },
      mute: { text: 'SOUND' },
      leaderboard: { text: 'LEADERBOARD' },
    },
    gameOver: {
      title: 'GAME OVER',
      scoreLabel: 'SCORE',
      bestLabel: 'BEST',
      newBestLabel: 'NEW RECORD',
    },
    leaderboard: { name: 'main' },
  }
}

const PORT = Number(process.env.PORT) || 3000
app.listen(PORT, () => {
  console.log(`\n  Flappy Forge Web UI`)
  console.log(`  http://localhost:${PORT}\n`)
})
