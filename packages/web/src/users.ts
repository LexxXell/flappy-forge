import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const DATA_DIR = path.join(__dirname, '../data')
const USERS_FILE = path.join(DATA_DIR, 'users.json')

export type DbRole = 'admin' | 'creator'

export interface User {
  id: number
  username: string
  passwordHash: string
  role: DbRole
  createdBy: string
  createdAt: string
}

// ---------------------------------------------------------------------------

function read(): User[] {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8')) as User[] }
  catch { return [] }
}

function write(users: User[]): void {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2))
}

// ---------------------------------------------------------------------------

export function findByUsername(username: string): User | undefined {
  return read().find(u => u.username === username)
}

export function listUsers(): Omit<User, 'passwordHash'>[] {
  return read().map(({ passwordHash: _pw, ...rest }) => rest)
}

export function addUser(
  username: string,
  passwordHash: string,
  role: DbRole,
  createdBy: string,
): User {
  const users = read()
  if (users.some(u => u.username === username)) {
    throw new Error(`User "${username}" already exists`)
  }
  const id = users.reduce((m, u) => Math.max(m, u.id), 0) + 1
  const user: User = { id, username, passwordHash, role, createdBy, createdAt: new Date().toISOString() }
  write([...users, user])
  return user
}

export function removeUser(id: number): boolean {
  const users = read()
  const next = users.filter(u => u.id !== id)
  if (next.length === users.length) return false
  write(next)
  return true
}
