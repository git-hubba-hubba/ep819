import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp } from '../server.mjs'

test('admins grant access; legacy databases migrate and multiple admins survive restart', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'amethyst-admins-'))
  const databasePath = join(folder, 'test.sqlite')
  const options = { databasePath, adminEmail: 'admin@example.test', adminPassword: 'Admin-password-123!' }
  let server
  async function start() {
    server = await createApp(options)
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  }
  async function stop() { await new Promise(resolve => server.close(resolve)); server = null }
  async function request(path, body, cookie, origin) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, {
      method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...(origin ? { Origin: origin } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}),
    })
    return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] }
  }
  try {
    await start(); await stop()
    const db = new DatabaseSync(databasePath)
    db.exec("CREATE UNIQUE INDEX single_admin ON users(role) WHERE role='admin'")
    db.close()
    await start()
    const admin = await request('/auth/login', { email: options.adminEmail, password: options.adminPassword })
    const reader = await request('/auth/signup', { name: 'New admin', email: 'reader@example.test', password: 'Reader-password-123!', role: 'admin' })
    assert.equal(reader.body.user.role, 'reader')
    const target = { email: 'reader@example.test' }
    assert.equal((await request('/admins', target)).status, 401)
    assert.equal((await request('/admins', target, reader.cookie)).status, 403)
    assert.equal((await request('/admins', target, admin.cookie, 'https://untrusted.example')).status, 403)
    assert.equal((await request('/admins', { email: 'invalid' }, admin.cookie)).status, 400)
    assert.equal((await request('/admins', { email: 'unknown@example.test' }, admin.cookie)).status, 404)
    const promoted = await request('/admins', { email: ' READER@EXAMPLE.TEST ' }, admin.cookie)
    assert.equal(promoted.status, 200)
    assert.equal(promoted.body.user.role, 'admin')
    assert.deepEqual(Object.keys(promoted.body.user).sort(), ['email', 'id', 'name', 'role'])
    assert.equal((await request('/admins', target, admin.cookie)).status, 200)
    assert.equal((await request('/auth/me', null, reader.cookie)).body.user.role, 'admin')
    assert.equal((await request('/tickets', { title: 'Admin task', owner: 'New admin', priority: 'Medium', status: 'In Progress', notes: '', dueDate: '', useCase: 'Not specified' }, reader.cookie)).status, 201)
    const third = await request('/auth/signup', { name: 'Third', email: 'third@example.test', password: 'Third-password-123!' })
    assert.equal((await request('/admins', { email: third.body.user.email }, reader.cookie)).status, 200)
    await stop(); await start()
    assert.equal((await request('/auth/me', null, admin.cookie)).body.user.role, 'admin')
    assert.equal((await request('/auth/me', null, reader.cookie)).body.user.role, 'admin')
    assert.equal((await request('/auth/me', null, third.cookie)).body.user.role, 'admin')
  } finally { if (server) await stop(); rmSync(folder, { recursive: true, force: true }) }
})
