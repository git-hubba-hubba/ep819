const fail = (status, message) => Object.assign(new Error(message), { status })
export function initializeTeam(db) {
  db.exec('CREATE TABLE IF NOT EXISTS team (id INTEGER PRIMARY KEY, data TEXT NOT NULL)')
}
function validate(body) {
  const fields = {}
  for (const [key, limit] of Object.entries({ name: 100, position: 120, email: 254 })) {
    if (typeof body[key] !== 'string' || !body[key].trim() || body[key].length > limit) throw fail(400, `Enter a valid ${key}.`)
    fields[key] = body[key].trim()
  }
  fields.email = fields.email.toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) throw fail(400, 'Enter a valid email address.')
  if (typeof body.image !== 'string') throw fail(400, 'Invalid image.')
  fields.image = body.image
  if (body.image) {
    const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(body.image)
    if (!match) throw fail(400, 'Upload a PNG, JPEG, or WebP image.')
    const bytes = Buffer.from(match[2], 'base64')
    if (bytes.length > 512 * 1024) throw fail(400, 'Image must be 512 KB or smaller.')
    const valid = match[1] === 'png' ? bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) : match[1] === 'jpeg' ? bytes.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex')) : bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP'
    if (!valid || bytes.toString('base64') !== match[2]) throw fail(400, 'Invalid image file.')
  }
  return fields
}
export async function handleTeam({ db, path, req, user, send, readBody }) {
  if (!path.startsWith('/api/team')) return false
  if (path === '/api/team' && req.method === 'GET') {
    send(200, { members: db.prepare('SELECT data FROM team ORDER BY id').all().map(row => JSON.parse(row.data)) }); return true
  }
  const match = /^\/api\/team\/(\d+)$/.exec(path)
  const create = path === '/api/team' && req.method === 'POST'
  if (!create && !(match && req.method === 'PATCH')) throw fail(404, 'Team endpoint not found.')
  if (user.role !== 'admin') throw fail(403, 'Only the administrator can add or edit team members.')
  const body = await readBody(req, 720000)
  const fields = validate(body)
  const members = db.prepare('SELECT data FROM team').all().map(row => JSON.parse(row.data))
  const previous = create ? null : members.find(m => m.id === Number(match[1]))
  if (!create && !previous) throw fail(404, 'Team member not found.')
  if (previous && previous.version !== body.version) throw fail(409, 'This person changed. Close the form and refresh before editing again.')
  if (members.some(m => m.id !== previous?.id && m.email === fields.email)) throw fail(409, 'A team member already has this email.')
  if (members.some(m => m.id !== previous?.id && m.name.toLowerCase() === fields.name.toLowerCase())) throw fail(409, 'Use a distinct name so ownership is unambiguous.')
  const id = previous?.id || Number(db.prepare('SELECT COALESCE(MAX(id),0)+1 AS id FROM team').get().id)
  const now = new Date().toISOString()
  const member = { ...fields, id, version: (previous?.version || 0) + 1, updatedAt: now }
  db.exec('BEGIN')
  try {
    if (create) db.prepare('INSERT INTO team VALUES (?,?)').run(id, JSON.stringify(member))
    else db.prepare('UPDATE team SET data=? WHERE id=?').run(JSON.stringify(member), id)
    if (previous && previous.name !== member.name) {
      for (const table of ['tickets', 'roadmap']) {
        for (const row of db.prepare(`SELECT data FROM ${table}`).all()) {
          const record = JSON.parse(row.data)
          if (record.owner.toLowerCase() === previous.name.toLowerCase()) {
            db.prepare(`UPDATE ${table} SET data=? WHERE id=?`).run(JSON.stringify({ ...record, owner: member.name, version: record.version + 1, updatedAt: now }), record.id)
          }
        }
      }
    }
    db.exec('COMMIT')
  } catch (error) { db.exec('ROLLBACK'); throw error }
  send(create ? 201 : 200, { member, tickets: db.prepare('SELECT data FROM tickets ORDER BY id DESC').all().map(r => JSON.parse(r.data)), items: db.prepare('SELECT data FROM roadmap ORDER BY id').all().map(r => JSON.parse(r.data)) })
  return true
}
