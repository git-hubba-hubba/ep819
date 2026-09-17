import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp } from '../server.mjs'

const admin = { email: 'admin@example.test', password: 'Admin-test-password-123!' }
const action = { title: 'Review the updated call flow', owner: 'Shelby', priority: 'High', status: 'AT&T Action Needed', dueDate: '2026-10-01', notes: 'Confirm the final version.', useCase: 'Yes' }

test('authentication, authorization, validation, conflicts and persistence', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'amethyst-test-'))
  const databasePath = join(folder, 'test.sqlite')
  let server
  async function start(provision = false) {
    server = await createApp({ databasePath, ...(provision ? { adminEmail: admin.email, adminPassword: admin.password } : {}) })
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  }
  async function stop() { await new Promise(resolve => server.close(resolve)) }
  async function request(path, { method = 'GET', body, cookie, origin } = {}) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...(origin ? { Origin: origin } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
    return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0], headers: response.headers }
  }
  try {
    await start(true)
    assert.equal((await request('/tickets')).status, 401)
    const signup = await request('/auth/signup', { method: 'POST', body: { name: 'Reader', email: 'reader@example.test', password: 'Reader-test-password-123!', role: 'admin' } })
    assert.equal(signup.status, 200)
    assert.equal(signup.body.user.role, 'reader', 'Signup cannot elevate privileges')
    assert.match(signup.headers.get('set-cookie'), /HttpOnly/)
    const reader = signup.cookie
    assert.equal((await request('/tickets', { cookie: reader })).body.tickets.length, 0)
    assert.equal((await request('/tickets', { method: 'POST', body: action, cookie: reader })).status, 403)
    assert.equal((await request('/tickets/1', { method: 'PATCH', body: { ...action, version: 1 }, cookie: reader })).status, 403)
    assert.equal((await request('/tickets', { cookie: 'amethyst_session=' + 'a'.repeat(64) })).status, 401)
    assert.equal((await request('/auth/login', { method: 'POST', body: { ...admin, password: 'Incorrect-password-123!' } })).status, 401)
    const login = await request('/auth/login', { method: 'POST', body: admin })
    assert.equal(login.body.user.role, 'admin')
    const cookie = login.cookie
    assert.equal((await request('/tickets', { method: 'POST', body: action, cookie, origin: 'https://untrusted.example' })).status, 403)
    assert.equal((await request('/tickets', { method: 'POST', body: { ...action, dueDate: '2026-02-30' }, cookie })).status, 400)
    assert.equal((await request('/tickets', { method: 'POST', body: { ...action, title: '' }, cookie })).status, 400)
    const created = await request('/tickets', { method: 'POST', body: { ...action, submitter: 'Spoofed name' }, cookie })
    assert.equal(created.status, 201)
    assert.equal(created.body.ticket.submitter, 'Administrator')
    const id = created.body.ticket.id
    const updated = await request(`/tickets/${id}`, { method: 'PATCH', body: { ...action, status: 'Completed', version: 1 }, cookie })
    assert.equal(updated.status, 200)
    assert.equal(updated.body.ticket.version, 2)
    assert.equal((await request(`/tickets/${id}`, { method: 'PATCH', body: { ...action, version: 1 }, cookie })).status, 409)
    assert.equal((await request('/auth/me', { cookie })).body.user.role, 'admin')
    // Roadmap upgrades an existing workspace without changing existing tickets.
    assert.equal((await request('/roadmap')).status, 401)
    const seeded = await request('/roadmap', { cookie: reader })
    assert.equal(seeded.body.items.length, 0)
    const workstream = { title: 'Launch the next phase', owner: 'Rachel', phase: '3.0', startMonth: '2028-01', endMonth: '2028-02', status: 'Planned', keyMilestone: true, notes: 'Confirm launch readiness.' }
    assert.equal((await request('/roadmap', { method: 'POST', body: workstream, cookie: reader })).status, 403)
    assert.equal((await request('/roadmap/1', { method: 'PATCH', body: { ...workstream, version: 1 }, cookie: reader })).status, 403)
    assert.equal((await request('/roadmap/1/execute', { method: 'POST', body: { action: 'start', version: 1 }, cookie: reader })).status, 403)
    assert.equal((await request('/roadmap', { method: 'POST', body: { ...workstream, endMonth: '2027-12' }, cookie })).status, 400)
    assert.equal((await request('/roadmap', { method: 'POST', body: { ...workstream, startMonth: '2028-13' }, cookie })).status, 400)
    const planned = await request('/roadmap', { method: 'POST', body: { ...workstream, ticketId: 1 }, cookie })
    assert.equal(planned.status, 201)
    assert.equal(planned.body.item.ticketId, null, 'Cannot forge a ticket link')
    const roadId = planned.body.item.id
    assert.equal((await request(`/roadmap/${roadId}/execute`, { method: 'POST', body: { action: 'complete', version: 1 }, cookie })).status, 409)
    const started = await request(`/roadmap/${roadId}/execute`, { method: 'POST', body: { action: 'start', version: 1 }, cookie })
    assert.equal(started.status, 200)
    assert.equal(started.body.item.status, 'In Progress')
    assert.equal(started.body.ticket.dueDate, '2028-02-29')
    assert.equal(started.body.ticket.owner, 'Rachel')
    assert.equal(started.body.ticket.roadmapId, roadId)
    const linkedId = started.body.ticket.id
    assert.equal((await request(`/roadmap/${roadId}/execute`, { method: 'POST', body: { action: 'start', version: 1 }, cookie })).status, 409)
    assert.equal((await request(`/roadmap/${roadId}/execute`, { method: 'POST', body: { action: 'start', version: 2 }, cookie })).status, 409)
    const finished = await request(`/roadmap/${roadId}/execute`, { method: 'POST', body: { action: 'complete', version: 2 }, cookie })
    assert.equal(finished.body.item.status, 'Complete')
    assert.equal(finished.body.ticket.status, 'Completed')
    const reopened = await request(`/roadmap/${roadId}/execute`, { method: 'POST', body: { action: 'reopen', version: 3 }, cookie })
    assert.equal(reopened.body.ticket.id, linkedId, 'Reopening reuses the linked ticket')
    assert.equal(reopened.body.ticket.status, 'In Progress')
    const edited = await request(`/roadmap/${roadId}`, { method: 'PATCH', body: { ...workstream, owner: 'Jeri', status: 'In Progress', endMonth: '2028-03', version: 4 }, cookie })
    assert.equal(edited.body.ticket.owner, 'Jeri')
    assert.equal(edited.body.ticket.dueDate, '2028-03-31')
    assert.equal((await request(`/roadmap/${roadId}`, { method: 'PATCH', body: { ...workstream, version: 4 }, cookie })).status, 409)
    const ticketComplete = await request(`/tickets/${linkedId}`, { method: 'PATCH', body: { ...edited.body.ticket, status: 'Completed' }, cookie })
    assert.equal(ticketComplete.body.roadmapItem.status, 'Complete', 'Ticket completion updates the roadmap')
    assert.equal(ticketComplete.body.roadmapItem.version, 6)
    assert.equal((await request('/team')).status, 401)
    assert.deepEqual((await request('/team', { cookie: reader })).body.members, [])
    const person = { name: 'Jeri', position: 'Program Lead', email: 'jeri@example.test', image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=' }
    assert.equal((await request('/team', { method: 'POST', body: person, cookie: reader })).status, 403)
    assert.equal((await request('/team', { method: 'POST', body: { ...person, image: 'data:image/svg+xml;base64,PHN2Zz4=' }, cookie })).status, 400)
    assert.equal((await request('/team', { method: 'POST', body: { ...person, email: 'invalid' }, cookie })).status, 400)
    const addedPerson = await request('/team', { method: 'POST', body: person, cookie })
    assert.equal(addedPerson.status, 201)
    const personId = addedPerson.body.member.id
    assert.equal(addedPerson.body.member.image, person.image)
    assert.equal((await request('/team', { method: 'POST', body: person, cookie })).status, 409)
    assert.equal((await request(`/team/${personId}`, { method: 'PATCH', body: { ...person, version: 1 }, cookie: reader })).status, 403)
    const renamed = await request(`/team/${personId}`, { method: 'PATCH', body: { ...person, name: 'Jeri Smith', version: 1 }, cookie })
    assert.equal(renamed.status, 200)
    assert.equal(renamed.body.tickets.find(t => t.id === linkedId).owner, 'Jeri Smith')
    assert.equal(renamed.body.items.find(i => i.id === roadId).owner, 'Jeri Smith')
    assert.equal((await request(`/team/${personId}`, { method: 'PATCH', body: { ...person, version: 1 }, cookie })).status, 409)
    assert.equal((await request('/team', { cookie: reader })).body.members[0].position, person.position)
    await stop()
    await start()
    const persisted = await request('/tickets', { cookie: reader })
    assert.equal(persisted.body.tickets.find(t => t.id === id).status, 'Completed')
    assert.equal(persisted.body.tickets.length, 2, 'Execution creates exactly one additional ticket')
    const persistedRoadmap = await request('/roadmap', { cookie: reader })
    assert.equal(persistedRoadmap.body.items.length, 1)
    assert.equal(persistedRoadmap.body.items.find(i => i.id === roadId).status, 'Complete')
    assert.equal(persistedRoadmap.body.items.find(i => i.id === roadId).ticketId, linkedId)
    const persistedTeam = await request('/team', { cookie: reader })
    assert.equal(persistedTeam.body.members.length, 1)
    assert.equal(persistedTeam.body.members[0].name, 'Jeri Smith')
    assert.equal(persistedTeam.body.members[0].image, person.image)
    await request('/auth/logout', { method: 'POST', cookie })
    assert.equal((await request('/tickets', { cookie })).status, 401)
    assert.equal((await request('/auth/signup', { method: 'POST', body: { name: 'Duplicate', ...admin } })).status, 409)
  } finally {
    if (server?.listening) await stop()
    rmSync(folder, { recursive: true, force: true })
  }
})
