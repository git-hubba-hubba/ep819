import { priorities, statuses, useCases } from '../data/tickets.js'
import { roadmapStatuses } from '../data/roadmap.js'

export const MAX_IMPORT_BYTES = 1024 * 1024
const normalize = value => value.toLowerCase().replace(/[^a-z0-9]/g, '')
const aliases = {
  title: ['title', 'action item', 'task', 'workstream', 'milestone'],
  owner: ['owner', 'assignee', 'assigned to'], notes: ['notes', 'description', 'execution notes'],
  priority: ['priority'], status: ['status'], dueDate: ['due date', 'due'], useCase: ['use case', 'use case needed'],
  phase: ['phase'], startMonth: ['start month', 'start date', 'start'], endMonth: ['end month', 'end date', 'target end month', 'target date'],
  keyMilestone: ['key milestone'],
}

function csv(text) {
  const rows = []; let row = []; let cell = ''; let quoted = false; let closed = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') { quoted = false; closed = true }
      else cell += c
    } else if (c === ',' || c === '\n' || c === '\r') {
      row.push(cell); cell = ''; closed = false
      if (c !== ',') { if (row.some(v => v.trim())) rows.push(row); row = []; if (c === '\r' && text[i + 1] === '\n') i++ }
    } else if (c === '"' && !cell && !closed) quoted = true
    else { if (closed || c === '"') throw new Error('Malformed CSV quoting.'); cell += c }
  }
  if (quoted) throw new Error('Unclosed CSV quote.')
  row.push(cell); if (row.some(v => v.trim())) rows.push(row)
  const headers = rows.shift() || []
  if (new Set(headers.map(normalize)).size !== headers.length) throw new Error('CSV column names must be unique.')
  return rows.map((values, index) => {
    if (values.length !== headers.length) throw new Error(`CSV row ${index + 2} has the wrong number of columns.`)
    return Object.fromEntries(headers.map((header, i) => [header, values[i]]))
  })
}

function labeledText(text) {
  return text.split(/\n\s*\n/).filter(s => s.trim()).map(block => {
    const record = {}; let previous
    for (const line of block.split('\n')) {
      const match = line.match(/^([^:]+):\s*(.*)$/)
      if (match) { previous = match[1]; record[previous] = match[2] }
      else if (previous && normalize(previous).includes('notes')) record[previous] += `\n${line}`
      else throw new Error('Text files need labeled fields, such as Title: and Owner:, with a blank line between items.')
    }
    return record
  })
}

export function parseImport(text, filename, kind) {
  if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) throw new Error('Choose a file smaller than 1 MB.')
  text = text.replace(/^\uFEFF/, '').trim()
  const extension = filename.split('.').pop().toLowerCase()
  let records
  if (extension === 'csv') records = csv(text)
  else if (extension === 'txt') records = labeledText(text)
  else if (extension === 'json') {
    let parsed
    try { parsed = JSON.parse(text) } catch { throw new Error('The file is not valid JSON.') }
    records = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.[kind]) ? parsed[kind] : [parsed]
  } else throw new Error('Use a CSV, JSON, or labeled TXT file.')
  if (!records.length || records.length > 100) throw new Error('Upload between 1 and 100 items per file.')
  return records.map((record, index) => {
    const fail = message => { throw new Error(`Item ${index + 1}: ${message} Nothing from this file was added.`) }
    if (!record || typeof record !== 'object' || Array.isArray(record)) fail('Expected an object with named fields.')
    const fields = {}
    const allowed = kind === 'tickets' ? ['title', 'owner', 'notes', 'priority', 'status', 'dueDate', 'useCase'] : ['title', 'owner', 'notes', 'phase', 'status', 'startMonth', 'endMonth', 'keyMilestone']
    for (const [key, value] of Object.entries(record)) {
      const field = allowed.find(field => aliases[field].some(alias => normalize(alias) === normalize(key)))
      if (!field) continue
      if (Object.hasOwn(fields, field)) fail(`Multiple columns map to ${field}.`)
      if (!['string', 'number', 'boolean'].includes(typeof value) && value !== null) fail(`Invalid ${field}.`)
      fields[field] = value == null ? '' : String(value).trim()
    }
    if (!fields.title || !Object.entries(fields).some(([key, value]) => key !== 'title' && value)) fail('No relevant data found. Include a title and at least one detail such as owner, notes, status, or dates.')
    const draft = kind === 'tickets'
      ? { title: '', owner: '', notes: '', priority: 'Medium', status: 'AT&T Action Needed', dueDate: '', useCase: 'Not specified', ...fields }
      : { title: '', owner: '', notes: '', phase: '1.0', status: 'Planned', startMonth: '', endMonth: '', keyMilestone: false, ...fields }
    const options = kind === 'tickets' ? { priority: priorities, status: statuses, useCase: useCases } : { phase: ['1.0', '2.0', '3.0'], status: roadmapStatuses }
    for (const [field, values] of Object.entries(options)) {
      const value = values.find(v => v.toLowerCase() === draft[field].toLowerCase())
      if (!value) fail(`Unrecognized ${field}: ${draft[field]}. Expected ${values.join(', ')}.`)
      draft[field] = value
    }
    for (const [field, max] of Object.entries({ title: 300, owner: 100, notes: 10000 })) if (draft[field].length > max) fail(`${field} exceeds ${max} characters.`)
    if (kind === 'tickets' && draft.dueDate && (!/^\d{4}-\d{2}-\d{2}$/.test(draft.dueDate) || !Number.isFinite(Date.parse(draft.dueDate)) || new Date(draft.dueDate).toISOString().slice(0, 10) !== draft.dueDate)) fail('Due date must be a valid YYYY-MM-DD date.')
    if (kind === 'roadmap') {
      for (const field of ['startMonth', 'endMonth']) {
        if (draft[field] && !/^20(?:2\d|3\d|40)-(0[1-9]|1[0-2])$/.test(draft[field])) fail(`${field} must use YYYY-MM, between 2020 and 2040.`)
      }
      if (draft.startMonth && draft.endMonth && draft.startMonth > draft.endMonth) fail('End month is before start month.')
      const milestone = String(draft.keyMilestone).toLowerCase()
      if (!['true', 'false', 'yes', 'no', '1', '0', ''].includes(milestone)) fail('Key milestone must be true or false.')
      draft.keyMilestone = ['true', 'yes', '1'].includes(milestone)
    }
    return draft
  })
}
