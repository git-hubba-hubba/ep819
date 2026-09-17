import { createServer } from 'node:http'
import { DatabaseSync } from 'node:sqlite'
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto'
import { promisify } from 'node:util'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { priorities, statuses, useCases } from '../frontend/amethyst-ep/src/data/tickets.js'
import { initializeRoadmap, handleRoadmap, syncRoadmapFromTicket } from './roadmap.mjs'
import { initializeTeam, handleTeam } from './team.mjs'

const scrypt = promisify(scryptCallback)
const digest = (value) => createHash('sha256').update(value).digest('hex')
const publicUser = ({ id, name, email, role }) => ({ id, name, email, role })
const fail = (status, message) => Object.assign(new Error(message), { status })
async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  return `${salt}:${(await scrypt(password, salt, 64)).toString('hex')}`
}
async function checkPassword(password, stored) {
  const [salt, hash] = stored.split(':')
  return timingSafeEqual(Buffer.from(hash, 'hex'), await scrypt(password, salt, 64))
}
function credentials(body) {
  const email = String(body.email || '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw fail(400, 'Enter a valid email address.')
  if (typeof body.password !== 'string' || body.password.length < 12 || body.password.length > 128) throw fail(400, 'Use a password between 12 and 128 characters.')
  return { email, password: body.password }
}
async function readBody(req, limit = 24000) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw fail(415, 'Expected JSON.')
  let content = ''
  for await (const chunk of req) {
    content += chunk
    if (Buffer.byteLength(content) > limit) throw fail(413, 'Request is too large.')
  }
  try {
    const data = JSON.parse(content)
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error()
    return data
  } catch { throw fail(400, 'Invalid JSON.') }
}
function validateTicket(body) {
  const result = {}
  for (const [field, limit] of Object.entries({ title: 300, owner: 100, notes: 10000, dueDate: 10 })) {
    if (typeof body[field] !== 'string' || body[field].length > limit) throw fail(400, `Invalid ${field}.`)
    result[field] = body[field].trim()
  }
  if (!result.title || !result.owner) throw fail(400, 'An action item and owner are required.')
  for (const [key, options] of Object.entries({ priority: priorities, status: statuses, useCase: useCases })) {
    if (!options.includes(body[key])) throw fail(400, `Invalid ${key}.`)
    result[key] = body[key]
  }
  if (result.dueDate && (!/^\d{4}-\d{2}-\d{2}$/.test(result.dueDate) || !Number.isFinite(Date.parse(result.dueDate)) || new Date(result.dueDate).toISOString().slice(0, 10) !== result.dueDate)) throw fail(400, 'Enter a valid due date.')
  return result
}

export async function createApp({ databasePath = resolve('data/amethyst.sqlite'), adminEmail, adminPassword, adminName = 'Administrator', origin, secureCookies = false } = {}) {
  if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true })
  const db = new DatabaseSync(databasePath)
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','reader')));
    CREATE UNIQUE INDEX IF NOT EXISTS single_admin ON users(role) WHERE role='admin';
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER REFERENCES users(id), expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS tickets (id INTEGER PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);`)
  initializeRoadmap(db)
  initializeTeam(db)
  if (adminEmail || adminPassword) {
    const { email, password } = credentials({ email: adminEmail, password: adminPassword })
    const existing = db.prepare("SELECT * FROM users WHERE role='admin'").get()
    if (existing && existing.email !== email) throw new Error('An admin account already exists with a different email.')
    if (!existing) {
      if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) throw new Error('Admin email is already registered as a reader. Choose a separate admin email.')
      db.prepare('INSERT INTO users(name,email,password,role) VALUES (?,?,?,?)').run(adminName, email, await hashPassword(password), 'admin')
    }
  }
  const dummyPassword = await hashPassword(randomBytes(32).toString('hex'))
  const attempts = new Map()
  const cookie = (token, maxAge) => `amethyst_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secureCookies ? '; Secure' : ''}`
  const server = createServer(async (req, res) => {
    const send = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(data)) }
    try {
      const url = new URL(req.url, 'http://localhost')
      const path = url.pathname
      const mutation = !['GET', 'HEAD'].includes(req.method)
      if (mutation && req.headers.origin && req.headers.origin !== (origin || `http://${req.headers.host}`)) throw fail(403, 'Request origin is not allowed.')
      const token = /(?:^|;\s*)amethyst_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1]
      const user = token ? db.prepare('SELECT users.* FROM users JOIN sessions ON users.id=sessions.user_id WHERE sessions.token=? AND sessions.expires>?').get(digest(token), Date.now()) : null
      if (path === '/api/auth/me' && req.method === 'GET') return send(200, { user: user ? publicUser(user) : null })
      if (['/api/auth/signup', '/api/auth/login'].includes(path) && req.method === 'POST') {
        const now = Date.now()
        for (const [key, value] of attempts) if (value.until < now) attempts.delete(key)
        const key = req.socket.remoteAddress
        const attempt = attempts.get(key) || { count: 0, until: now + 15 * 60000 }
        if (++attempt.count > 25) throw fail(429, 'Too many attempts. Try again in 15 minutes.')
        attempts.set(key, attempt)
        const body = await readBody(req)
        const { email, password } = credentials(body)
        let account
        if (path.endsWith('signup')) {
          const name = typeof body.name === 'string' ? body.name.trim() : ''
          if (!name || name.length > 100) throw fail(400, 'Enter your name (up to 100 characters).')
          const passwordHash = await hashPassword(password)
          if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) throw fail(409, 'An account already exists for this email. Sign in instead.')
          const record = db.prepare('INSERT INTO users(name,email,password,role) VALUES (?,?,?,?)').run(name, email, passwordHash, 'reader')
          account = db.prepare('SELECT * FROM users WHERE id=?').get(record.lastInsertRowid)
        } else {
          account = db.prepare('SELECT * FROM users WHERE email=?').get(email)
          const valid = await checkPassword(password, account?.password || dummyPassword)
          if (!account || !valid) throw fail(401, 'Email or password is incorrect.')
        }
        const newToken = randomBytes(32).toString('hex')
        db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now())
        if (token) db.prepare('DELETE FROM sessions WHERE token=?').run(digest(token))
        db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(digest(newToken), account.id, Date.now() + 8 * 3600000)
        res.setHeader('Set-Cookie', cookie(newToken, 8 * 3600))
        return send(200, { user: publicUser(account) })
      }
      if (path === '/api/auth/logout' && req.method === 'POST') {
        if (token) db.prepare('DELETE FROM sessions WHERE token=?').run(digest(token))
        res.setHeader('Set-Cookie', cookie('', 0))
        return send(200, { ok: true })
      }
      if (!user) throw fail(401, 'Please sign in to view the workspace.')
      if (await handleTeam({ db, path, req, user, send, readBody })) return
      if (await handleRoadmap({ db, path, req, user, send, readBody })) return
      if (path === '/api/tickets' && req.method === 'GET') return send(200, { tickets: db.prepare('SELECT data FROM tickets ORDER BY id DESC').all().map(row => JSON.parse(row.data)) })
      if ((path === '/api/tickets' && req.method === 'POST') || (/^\/api\/tickets\/\d+$/.test(path) && req.method === 'PATCH')) {
        if (user.role !== 'admin') throw fail(403, 'Only the administrator can add or edit tickets.')
        const body = await readBody(req)
        const fields = validateTicket(body)
        const now = new Date().toISOString()
        let ticket
        let roadmapItem
        if (req.method === 'POST') {
          const id = Number(db.prepare('SELECT COALESCE(MAX(id),0)+1 AS id FROM tickets').get().id)
          ticket = { ...fields, id, submitter: user.name, submittedAt: now, updatedAt: now, version: 1 }
          db.prepare('INSERT INTO tickets VALUES (?,?)').run(id, JSON.stringify(ticket))
        } else {
          const id = Number(path.split('/').pop())
          const row = db.prepare('SELECT data FROM tickets WHERE id=?').get(id)
          if (!row) throw fail(404, 'Ticket not found.')
          const previous = JSON.parse(row.data)
          if (body.version !== previous.version) throw fail(409, 'This ticket changed elsewhere. Close this panel and refresh before editing again.')
          ticket = { ...previous, ...fields, updatedAt: now, version: previous.version + 1 }
          db.exec('BEGIN')
          try {
            db.prepare('UPDATE tickets SET data=? WHERE id=?').run(JSON.stringify(ticket), id)
            roadmapItem = syncRoadmapFromTicket(db, ticket)
            db.exec('COMMIT')
          } catch (error) { db.exec('ROLLBACK'); throw error }
        }
        return send(req.method === 'POST' ? 201 : 200, { ticket, roadmapItem })
      }
      throw fail(404, 'Not found.')
    } catch (error) {
      if (!error.status) console.error(error)
      send(error.status || 500, { error: error.status ? error.message : 'Unable to complete the request.' })
    }
  })
  server.on('close', () => db.close())
  return server
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = await createApp({ databasePath: process.env.DATABASE_PATH || fileURLToPath(new URL('./data/amethyst.sqlite', import.meta.url)), adminEmail: process.env.ADMIN_EMAIL, adminPassword: process.env.ADMIN_PASSWORD, adminName: process.env.ADMIN_NAME, origin: process.env.APP_ORIGIN || 'http://localhost:5173', secureCookies: process.env.NODE_ENV === 'production' })
  server.listen(Number(process.env.PORT || 3001), '127.0.0.1', () => console.log('AmethystPlus API listening on http://127.0.0.1:' + (process.env.PORT || 3001)))
}
