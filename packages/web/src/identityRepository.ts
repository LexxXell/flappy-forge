import fs from 'fs'
import path from 'path'
import sqlite3 from 'sqlite3'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '../data')
const DB_PATH = process.env.IDENTITY_DB_PATH ?? path.join(DATA_DIR, 'identity.sqlite')
const LEGACY_USERS_FILE = path.join(DATA_DIR, 'users.json')

export type DbRole = 'admin' | 'creator'

export interface IdentityUser {
  id: number
  username: string
  passwordHash: string
  role: DbRole
  createdBy: string
  createdAt: string
}

type PublicIdentityUser = Omit<IdentityUser, 'passwordHash'>

let dbPromise: Promise<sqlite3.Database> | null = null

function run(db: sqlite3.Database, sql: string, params: unknown[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, err => (err ? reject(err) : resolve()))
  })
}

function get<T>(db: sqlite3.Database, sql: string, params: unknown[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row as T | undefined)))
  })
}

function all<T>(db: sqlite3.Database, sql: string, params: unknown[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve((rows as T[]) ?? [])))
  })
}

async function migrateLegacyJsonIfNeeded(db: sqlite3.Database): Promise<void> {
  const countRow = await get<{ count: number }>(db, 'SELECT COUNT(1) AS count FROM users')
  if ((countRow?.count ?? 0) > 0) return
  if (!fs.existsSync(LEGACY_USERS_FILE)) return

  let parsed: unknown
  try {
    parsed = JSON.parse(fs.readFileSync(LEGACY_USERS_FILE, 'utf-8'))
  } catch {
    return
  }
  if (!Array.isArray(parsed)) return

  for (const row of parsed as Array<Partial<IdentityUser>>) {
    if (!row || typeof row !== 'object') continue
    if (typeof row.username !== 'string' || row.username.trim() === '') continue
    if (typeof row.passwordHash !== 'string' || row.passwordHash.trim() === '') continue
    if (row.role !== 'admin' && row.role !== 'creator') continue

    await run(
      db,
      'INSERT OR IGNORE INTO users (username, password_hash, role, created_by, created_at) VALUES (?, ?, ?, ?, ?)',
      [
        row.username,
        row.passwordHash,
        row.role,
        typeof row.createdBy === 'string' && row.createdBy.trim() ? row.createdBy : 'legacy-import',
        typeof row.createdAt === 'string' && row.createdAt.trim() ? row.createdAt : new Date().toISOString(),
      ],
    )
  }
}

async function openDb(): Promise<sqlite3.Database> {
  fs.mkdirSync(DATA_DIR, { recursive: true })

  const db = await new Promise<sqlite3.Database>((resolve, reject) => {
    let conn: sqlite3.Database
    conn = new sqlite3.Database(DB_PATH, err => (err ? reject(err) : resolve(conn)))
  })

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'creator')),
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
  )
  await run(db, 'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)')
  await migrateLegacyJsonIfNeeded(db)
  return db
}

async function getDb(): Promise<sqlite3.Database> {
  if (!dbPromise) dbPromise = openDb()
  return dbPromise
}

export async function findByUsername(username: string): Promise<IdentityUser | undefined> {
  const db = await getDb()
  const row = await get<{
    id: number
    username: string
    password_hash: string
    role: DbRole
    created_by: string
    created_at: string
  }>(
    db,
    'SELECT id, username, password_hash, role, created_by, created_at FROM users WHERE username = ? LIMIT 1',
    [username],
  )
  if (!row) return undefined
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    role: row.role,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }
}

export async function listUsers(): Promise<PublicIdentityUser[]> {
  const db = await getDb()
  const rows = await all<{
    id: number
    username: string
    role: DbRole
    created_by: string
    created_at: string
  }>(db, 'SELECT id, username, role, created_by, created_at FROM users ORDER BY id ASC')

  return rows.map(row => ({
    id: row.id,
    username: row.username,
    role: row.role,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }))
}

export async function addUser(
  username: string,
  passwordHash: string,
  role: DbRole,
  createdBy: string,
): Promise<IdentityUser> {
  const db = await getDb()
  const createdAt = new Date().toISOString()

  await run(
    db,
    'INSERT INTO users (username, password_hash, role, created_by, created_at) VALUES (?, ?, ?, ?, ?)',
    [username, passwordHash, role, createdBy, createdAt],
  )

  const created = await findByUsername(username)
  if (!created) throw new Error(`Failed to create user "${username}"`)
  return created
}

export async function removeUser(id: number): Promise<boolean> {
  const db = await getDb()
  const existing = await get<{ id: number }>(db, 'SELECT id FROM users WHERE id = ? LIMIT 1', [id])
  if (!existing) return false
  await run(db, 'DELETE FROM users WHERE id = ?', [id])
  return true
}
