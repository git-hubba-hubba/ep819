import test from 'node:test'
import assert from 'node:assert/strict'
import { parseImport, MAX_IMPORT_BYTES } from '../../frontend/amethyst-ep/src/imports/parseImport.js'

test('CSV maps aliases, quoted commas, escaped quotes, multiline notes, and defaults', () => {
  const [draft] = parseImport('\uFEFFAction item,Assigned to,Description,Priority\r\n"Fix, then test",Rachel,"Use ""new"" flow\nCheck again",high', 'tasks.csv', 'tickets')
  assert.equal(draft.title, 'Fix, then test')
  assert.equal(draft.notes, 'Use "new" flow\nCheck again')
  assert.equal(draft.owner, 'Rachel')
  assert.equal(draft.priority, 'High')
  assert.equal(draft.status, 'AT&T Action Needed')
})

test('JSON imports only allowed create fields and never IDs or linked records', () => {
  const [draft] = parseImport(JSON.stringify({ tickets: [{ title: 'Review release', owner: 'Rachel', id: 99, roadmapId: 4, version: 1 }] }), 'tasks.json', 'tickets')
  assert.equal(draft.id, undefined)
  assert.equal(draft.roadmapId, undefined)
  assert.equal(draft.version, undefined)
})

test('labeled text creates separate review drafts and leaves missing required fields blank', () => {
  const drafts = parseImport('Title: Launch\nNotes: Check readiness\n\nWorkstream: Training\nOwner: Rachel\nStart month: 2026-09\nEnd month: 2026-10\nKey milestone: yes', 'plan.txt', 'roadmap')
  assert.equal(drafts.length, 2)
  assert.equal(drafts[0].owner, '')
  assert.equal(drafts[0].startMonth, '')
  assert.equal(drafts[1].keyMilestone, true)
})

test('rejects irrelevant, malformed, unsupported, and oversized files', () => {
  for (const [text, name] of [['name,email\nRachel,r@example.com', 'x.csv'], ['{"title":"Only a heading"}', 'x.json'], ['null', 'x.json'], ['{', 'x.json'], ['title,owner\n"unfinished,Rachel', 'x.csv'], ['title,owner\nTask,Rachel,extra', 'x.csv'], ['title,title\nA,B', 'x.csv'], ['some prose', 'x.txt'], ['anything', 'x.pdf'], ['', 'x.csv'], ['a'.repeat(MAX_IMPORT_BYTES + 1), 'x.txt']]) {
    assert.throws(() => parseImport(text, name, 'tickets'), undefined, name)
  }
})

test('rejects whole batch if any item is irrelevant or has invalid values', () => {
  const valid = { title: 'Fix issue', owner: 'Rachel' }
  for (const invalid of [{ unrelated: true }, { ...valid, dueDate: '2026-02-30' }, { ...valid, priority: 'critical' }, { ...valid, title: 'x'.repeat(301) }, { ...valid, owner: {} }]) {
    assert.throws(() => parseImport(JSON.stringify([valid, invalid]), 'tasks.json', 'tickets'), /Item 2:/)
  }
  assert.throws(() => parseImport(JSON.stringify(Array(101).fill(valid)), 'tasks.json', 'tickets'), /100 items/)
})

test('roadmap validates phase, timeline order, range, and milestone flags', () => {
  const valid = { title: 'Launch', owner: 'Rachel', startMonth: '2026-09', endMonth: '2026-10' }
  for (const invalid of [{ phase: '4.0' }, { endMonth: '2026-08' }, { startMonth: '2019-01' }, { keyMilestone: 'maybe' }]) {
    assert.throws(() => parseImport(JSON.stringify({ ...valid, ...invalid }), 'plan.json', 'roadmap'))
  }
  assert.equal(parseImport(JSON.stringify({ ...valid, keyMilestone: false }), 'plan.json', 'roadmap')[0].keyMilestone, false)
})
