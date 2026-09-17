import { useState } from 'react'
import { priorities, statuses } from '../data/tickets'

const day = () => new Date().toLocaleDateString('en-CA')
function isOverdue(ticket) { return ticket.dueDate && ticket.dueDate < day() && ticket.status !== 'Completed' }
const age = (date) => date ? Math.max(0, Math.floor((Date.now() - Date.parse(date)) / 86400000)) : null

export default function TicketDashboard({ tickets, canEdit, onOpen, onCreate }) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('All statuses')
  const [priority, setPriority] = useState('All priorities')
  const [owner, setOwner] = useState('All owners')
  const [scope, setScope] = useState('all')
  const [sort, setSort] = useState('priority')
  const rank = { High: 0, Tejas: 1, Medium: 2, Low: 3 }
  const filtered = tickets.filter(t =>
    (!search || [t.title, t.notes, t.owner, t.submitter, `AP-${String(t.id).padStart(3, '0')}`].some(v => v.toLowerCase().includes(search.toLowerCase()))) &&
    (status === 'All statuses' || t.status === status) && (priority === 'All priorities' || t.priority === priority) && (owner === 'All owners' || t.owner === owner) &&
    (scope === 'all' || (scope === 'open' && t.status !== 'Completed') || (scope === 'urgent' && ['High', 'Tejas'].includes(t.priority) && t.status !== 'Completed') || (scope === 'overdue' && isOverdue(t)))
  ).sort((a, b) => sort === 'priority' ? rank[a.priority] - rank[b.priority] || b.id - a.id : sort === 'due' ? (a.dueDate || '9999').localeCompare(b.dueDate || '9999') : b.id - a.id)
  function reset() { setSearch(''); setStatus('All statuses'); setPriority('All priorities'); setOwner('All owners'); setScope('all') }
  const stats = [ ['all', 'Total tickets', tickets.length], ['open', 'Open action items', tickets.filter(t => t.status !== 'Completed').length], ['urgent', 'High priority / Tejas', tickets.filter(t => ['High', 'Tejas'].includes(t.priority) && t.status !== 'Completed').length], ['overdue', 'Past due', tickets.filter(isOverdue).length] ]
  return <>
    <div className="page-heading"><div><p className="eyebrow">WORKSPACE / ACTION ITEMS</p><h1>Ticketing dashboard<span className="heading-dot">.</span></h1><p className="muted">Clear ownership. Fewer loose ends. Everything in one place.</p></div>{canEdit && <button className="primary-button" onClick={onCreate}>＋ New ticket</button>}</div>
    <div className="stats-grid">{stats.map(([key, label, count]) => <button key={key} className={`stat-card ${scope === key ? 'active' : ''}`} aria-pressed={scope === key} onClick={() => setScope(key)}><span>{label}</span><strong>{count.toString().padStart(2, '0')}</strong><span className="stat-caption">{key === 'all' ? 'Across the workspace' : key === 'open' ? 'Awaiting completion' : key === 'urgent' ? 'Needs attention' : 'With an assigned due date'}</span></button>)}</div>
    <section className="ticket-board" aria-label="Tickets">
      <div className="board-title"><h2>Action register <span>{filtered.length}</span></h2><span className="muted">{canEdit ? 'Admin editing enabled' : 'Read-only workspace'}</span></div>
      <div className="filters">
        <label className="search-field"><span className="sr-only">Search tickets</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search actions, owners, notes…" type="search" /></label>
        <label><span className="sr-only">Filter by status</span><select value={status} onChange={e => setStatus(e.target.value)}>{['All statuses', ...statuses].map(v => <option key={v}>{v}</option>)}</select></label>
        <label><span className="sr-only">Filter by priority</span><select value={priority} onChange={e => setPriority(e.target.value)}>{['All priorities', ...priorities].map(v => <option key={v}>{v}</option>)}</select></label>
        <label><span className="sr-only">Filter by owner</span><select value={owner} onChange={e => setOwner(e.target.value)}>{['All owners', ...new Set(tickets.map(t => t.owner).sort())].map(v => <option key={v}>{v}</option>)}</select></label>
        <label><span className="sr-only">Sort tickets</span><select value={sort} onChange={e => setSort(e.target.value)}><option value="priority">Priority first</option><option value="due">Due date first</option><option value="newest">Newest first</option></select></label>
      </div>
      <div className="table-scroll"><table><thead><tr><th>Action item</th><th>Priority</th><th>Status</th><th>Owner</th><th>Due date</th><th>Last update</th><th>Use case</th></tr></thead><tbody>
        {filtered.map(t => <tr key={t.id}><td><button className="ticket-link" onClick={() => onOpen(t)}><span className="ticket-id">AP-{String(t.id).padStart(3, '0')}</span><strong>{t.title}</strong></button><p className="row-note">{t.notes || 'No notes yet'}</p></td><td><span className={`priority priority-${t.priority.toLowerCase()}`}>{t.priority}</span></td><td><span className={`status-badge ${t.status === 'Completed' ? 'completed' : t.status.startsWith('ChatR') ? 'chatr' : t.status.startsWith('Val') ? 'val' : ''}`}>{t.status}</span></td><td><span className="owner-cell"><span className="avatar" aria-hidden="true">{t.owner.slice(0, 1)}</span>{t.owner}</span></td><td className={isOverdue(t) ? 'overdue' : ''}>{t.dueDate || 'Unassigned'}{isOverdue(t) && <small>Past due</small>}</td><td>{age(t.updatedAt) === null ? <span className="muted">Not recorded</span> : age(t.updatedAt) === 0 ? 'Today' : `${age(t.updatedAt)}d ago`}</td><td>{t.useCase === 'Not specified' ? '—' : t.useCase}</td></tr>)}
      </tbody></table></div>
      {!filtered.length && <div className="empty-state"><h3>{tickets.length ? 'No tickets match this view.' : 'Your action register is ready.'}</h3><p>{tickets.length ? 'Try another search or clear your filters.' : canEdit ? 'Create your first ticket to assign an action item.' : 'Tickets will appear here when the administrator adds them.'}</p>{tickets.length > 0 && <button className="secondary-button" onClick={reset}>Clear filters</button>}</div>}
      <div className="board-footer"><span>{filtered.length} of {tickets.length} tickets</span><button className="text-button" onClick={reset}>Reset filters</button></div>
    </section>
    <p className="data-note">Select a ticket to view its notes, ownership, and progress.</p>
  </>
}
