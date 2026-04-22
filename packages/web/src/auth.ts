import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import type { Request, Response, NextFunction } from 'express'
import { findByUsername } from './users.js'

// ---------------------------------------------------------------------------
// Config (set via env; defaults are fine for local dev)
// ---------------------------------------------------------------------------

export const OWNER_USERNAME = process.env.OWNER_USERNAME ?? 'owner'
export const OWNER_PASSWORD = process.env.OWNER_PASSWORD ?? 'changeme'
export const JWT_SECRET     = process.env.JWT_SECRET     ?? 'dev-secret-change-in-production'

if (OWNER_PASSWORD === 'changeme') {
  console.warn('\n  ⚠  OWNER_PASSWORD is the default "changeme" — set OWNER_PASSWORD env var!\n')
}

// ---------------------------------------------------------------------------
// Role hierarchy
// ---------------------------------------------------------------------------

export type Role = 'owner' | 'admin' | 'creator' | 'user'

const RANK: Record<Role, number> = { owner: 4, admin: 3, creator: 2, user: 1 }

export function hasRole(actual: Role, required: Role): boolean {
  return RANK[actual] >= RANK[required]
}

// ---------------------------------------------------------------------------
// Token
// ---------------------------------------------------------------------------

export interface TokenPayload {
  sub: string   // username
  role: Role
  iat?: number
  exp?: number
}

function sign(username: string, role: Role): string {
  return jwt.sign({ sub: username, role } satisfies TokenPayload, JWT_SECRET, { expiresIn: '7d' })
}

export async function attemptLogin(username: string, password: string): Promise<string | null> {
  if (username === OWNER_USERNAME) {
    return password === OWNER_PASSWORD ? sign(username, 'owner') : null
  }
  const user = findByUsername(username)
  if (!user) return null
  const ok = await bcrypt.compare(password, user.passwordHash)
  return ok ? sign(username, user.role) : null
}

export function verifyToken(token: string): TokenPayload | null {
  try { return jwt.verify(token, JWT_SECRET) as TokenPayload }
  catch { return null }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

// ---------------------------------------------------------------------------
// Express middleware
// ---------------------------------------------------------------------------

export interface AuthReq extends Request {
  user?: TokenPayload
}

export function authenticate(req: AuthReq, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization
  // EventSource doesn't support headers — allow ?token= for SSE routes
  const raw = auth?.startsWith('Bearer ') ? auth.slice(7)
    : typeof (req.query as Record<string, unknown>).token === 'string'
      ? (req.query as Record<string, string>).token
      : null
  if (!raw) { res.status(401).json({ error: 'Unauthorized' }); return }
  const payload = verifyToken(raw)
  if (!payload) { res.status(401).json({ error: 'Invalid or expired token' }); return }
  req.user = payload
  next()
}

export function requireRole(role: Role) {
  return (req: AuthReq, res: Response, next: NextFunction): void => {
    if (!req.user || !hasRole(req.user.role, role)) {
      res.status(403).json({ error: 'Forbidden' }); return
    }
    next()
  }
}
