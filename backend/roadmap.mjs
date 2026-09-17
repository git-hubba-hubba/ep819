import { roadmapPhases, roadmapStatuses, monthEnd } from '../frontend/amethyst-ep/src/data/roadmap.js'
const fail = (status, message) => Object.assign(new Error(message), { status })
export function initializeRoadmap(db) {
  db.exec('CREATE TABLE IF NOT EXISTS roadmap (id INTEGER PRIMARY KEY, data TEXT NOT NULL)')

}
function validate(body) {
  const fields = {}
  for (const [name, limit] of Object.entries({ title: 300, owner: 100, notes: 10000 })) {
    if (typeof body[name] !== 'string' || body[name].length > limit) throw fail(400, `Invalid ${name}.`)
    fields[name] = body[name].trim()
  }
  if (!fields.title || !fields.owner) throw fail(400, 'A workstream and owner are required.')
  if (!roadmapPhases.some(p => p.id === body.phase)) throw fail(400, 'Select a valid phase.')
  if (!roadmapStatuses.includes(body.status)) throw fail(400, 'Select a valid status.')
  for (const key of ['startMonth', 'endMonth']) {
    if (typeof body[key] !== 'string' || !/^20(?:2\d|3\d|40)-(0[1-9]|1[0-2])$/.test(body[key])) throw fail(400, 'Choose a month between 2020 and 2040.')
    fields[key] = body[key]
  }
  if (fields.startMonth > fields.endMonth) throw fail(400, 'Target end must be on or after the start month.')
  if (typeof body.keyMilestone !== 'boolean') throw fail(400, 'Invalid milestone flag.')
  return { ...fields, phase: body.phase, status: body.status, keyMilestone: body.keyMilestone }
}

// Called inside the same transaction as a linked ticket edit.
export function syncRoadmapFromTicket(db, ticket) {
  if (!ticket.roadmapId) return
  const row = db.prepare('SELECT data FROM roadmap WHERE id=?').get(ticket.roadmapId)
  if (!row) return
  const item = JSON.parse(row.data)
  if (item.ticketId !== ticket.id) return
  const updated = { ...item, status: ticket.status === 'Completed' ? 'Complete' : ticket.status === 'AT&T Action Needed' ? 'Planned' : 'In Progress', owner: ticket.owner, updatedAt: ticket.updatedAt, version: item.version + 1 }
  db.prepare('UPDATE roadmap SET data=? WHERE id=?').run(JSON.stringify(updated), item.id)
  return updated
}

export async function handleRoadmap({ db, path, req, user, send, readBody }) {
  if (!path.startsWith('/api/roadmap')) return false
  if (path === '/api/roadmap' && req.method === 'GET') {
    send(200, { items: db.prepare('SELECT data FROM roadmap ORDER BY id').all().map(row => JSON.parse(row.data)) }); return true
  }
  const match = /^\/api\/roadmap\/(\d+)(?:\/(execute))?$/.exec(path)
  const create = path === '/api/roadmap' && req.method === 'POST'
  const execute = match?.[2] === 'execute' && req.method === 'POST'
  const edit = match && !match[2] && req.method === 'PATCH'
  if (!create && !execute && !edit) throw fail(404, 'Roadmap endpoint not found.')
  if (user.role !== 'admin') throw fail(403, 'Only the administrator can edit or execute the roadmap.')
  const body = await readBody(req)
  const row = !create ? db.prepare('SELECT data FROM roadmap WHERE id=?').get(Number(match[1])) : null
  if (!create && !row) throw fail(404, 'Workstream not found.')
  const previous = row ? JSON.parse(row.data) : null
  if (previous && previous.version !== body.version) throw fail(409, 'This workstream changed. Close this panel and refresh before trying again.')
  let fields
  if (execute) {
    if (!['start', 'complete', 'reopen'].includes(body.action)) throw fail(400, 'Invalid execution action.')
    if (body.action === 'complete' && previous.status !== 'In Progress') throw fail(409, 'Start this workstream before completing it.')
    if (body.action === 'reopen' && previous.status !== 'Complete') throw fail(409, 'Only completed workstreams can be reopened.')
    if (body.action === 'start' && (previous.status === 'Complete' || (previous.ticketId && previous.status === 'In Progress'))) throw fail(409, 'This workstream has already been started. Open its linked ticket or reopen it.')
    fields = { ...previous, status: body.action === 'complete' ? 'Complete' : 'In Progress' }
  } else fields = validate(body)
  const now = new Date().toISOString()
  const id = previous?.id || Number(db.prepare('SELECT COALESCE(MAX(id),0)+1 AS id FROM roadmap').get().id)
  const item = { ...previous, ...fields, id, ticketId: previous?.ticketId || null, updatedAt: now, version: (previous?.version || 0) + 1 }
  let ticket = item.ticketId ? JSON.parse(db.prepare('SELECT data FROM tickets WHERE id=?').get(item.ticketId).data) : null
  db.exec('BEGIN')
  try {
    if (execute && !ticket) {
      const ticketId = Number(db.prepare('SELECT COALESCE(MAX(id),0)+1 AS id FROM tickets').get().id)
      ticket = { id: ticketId, roadmapId: id, title: item.title, owner: item.owner, priority: 'Medium', status: item.status === 'Complete' ? 'Completed' : 'In Progress', dueDate: monthEnd(item.endMonth), notes: item.notes, useCase: 'Not specified', submitter: user.name, submittedAt: now, updatedAt: now, version: 1 }
      db.prepare('INSERT INTO tickets VALUES (?,?)').run(ticketId, JSON.stringify(ticket))
      item.ticketId = ticketId
    } else if (ticket) {
      ticket = { ...ticket, title: item.title, owner: item.owner, dueDate: monthEnd(item.endMonth), status: item.status === 'Complete' ? 'Completed' : item.status === 'Planned' ? 'AT&T Action Needed' : 'In Progress', updatedAt: now, version: ticket.version + 1 }
      db.prepare('UPDATE tickets SET data=? WHERE id=?').run(JSON.stringify(ticket), ticket.id)
    }
    if (create) db.prepare('INSERT INTO roadmap VALUES (?,?)').run(id, JSON.stringify(item))
    else db.prepare('UPDATE roadmap SET data=? WHERE id=?').run(JSON.stringify(item), id)
    db.exec('COMMIT')
  } catch (error) { db.exec('ROLLBACK'); throw error }
  send(create ? 201 : 200, { item, ticket })
  return true
}
