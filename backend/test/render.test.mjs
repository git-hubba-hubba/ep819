import test from 'node:test'
import assert from 'node:assert/strict'
import { createProductionApp } from '../render.mjs'

test('production server serves frontend and API while protecting private files', async () => {
  const server = await createProductionApp({ databasePath: ':memory:', origin: 'https://amethyst.example', adminEmail: 'admin@example.test', adminPassword: 'Production-test-password-123!' })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  try {
    const health = await fetch(base + '/healthz')
    assert.equal(health.status, 200)
    assert.deepEqual(await health.json(), { status: 'ok' })
    const home = await fetch(base)
    assert.match(home.headers.get('content-type'), /text\/html/)
    const html = await home.text()
    assert.match(html, /AmethystPlus/)
    const assetPath = /src="(\/assets\/[^\"]+\.js)"/.exec(html)?.[1]
    assert.ok(assetPath)
    const asset = await fetch(base + assetPath)
    assert.equal(asset.status, 200)
    assert.match(asset.headers.get('content-type'), /javascript/)
    assert.match(asset.headers.get('cache-control'), /immutable/)
    const head = await fetch(base, { method: 'HEAD' })
    assert.equal(head.status, 200)
    assert.equal(await head.text(), '')
    for (const path of ['/backend/.env', '/.env', '/backend/server.mjs', '/data/amethyst.sqlite', '/assets/missing.js', '/assets/%2e%2e%2f.env']) assert.equal((await fetch(base + path)).status, 404)
    assert.equal((await fetch(base + '/api/tickets')).status, 401)
    const body = JSON.stringify({ email: 'admin@example.test', password: 'Production-test-password-123!' })
    const denied = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://wrong.example' }, body })
    assert.equal(denied.status, 403)
    const login = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://amethyst.example' }, body })
    assert.equal(login.status, 200)
    assert.match(login.headers.get('set-cookie'), /; Secure/)
    assert.match(login.headers.get('set-cookie'), /HttpOnly/)
    const cookie = login.headers.get('set-cookie').split(';')[0]
    const tickets = await fetch(base + '/api/tickets', { headers: { Cookie: cookie } })
    assert.deepEqual((await tickets.json()).tickets, [])
  } finally { await new Promise(resolve => server.close(resolve)) }
})
