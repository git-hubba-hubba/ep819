import { useRef, useState } from 'react'
import { monthIndex, monthFromIndex, roadmapPhases, roadmapStatuses } from '../data/roadmap'
import RoadmapPanel from './RoadmapPanel'
import './Roadmap.css'

const shortMonth = month => new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
export default function RoadmapView({ items, people = [], canEdit, onSave, onExecute, onOpenTicket }) {
  const [search, setSearch] = useState('')
  const [phase, setPhase] = useState('all')
  const [status, setStatus] = useState('all')
  const [owner, setOwner] = useState('all')
  const [year, setYear] = useState('all')
  const [collapsed, setCollapsed] = useState([])
  const [panel, setPanel] = useState(null)
  const scroll = useRef(null)
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const first = items.length ? Math.min(...items.map(i => monthIndex(i.startMonth))) : now.getFullYear() * 12
  const last = items.length ? Math.max(...items.map(i => monthIndex(i.endMonth))) : now.getFullYear() * 12 + 11
  const years = Array.from({ length: Math.floor(last / 12) - Math.floor(first / 12) + 1 }, (_, i) => Math.floor(first / 12) + i)
  const start = year === 'all' ? first : Number(year) * 12
  const end = year === 'all' ? last : Number(year) * 12 + 11
  const months = Array.from({ length: end - start + 1 }, (_, i) => monthFromIndex(start + i))
  const yearGroups = [...new Set(months.map(m => m.slice(0, 4)))].map(y => ({ year: y, count: months.filter(m => m.startsWith(y)).length }))
  const ownerOptions = [...new Set([...people, ...items.map(i => i.owner)])].sort()
  const filtered = items.filter(i => (phase === 'all' || i.phase === phase) && (status === 'all' || i.status === status) && (owner === 'all' || i.owner === owner) && [i.title, i.owner, i.notes].some(s => s.toLowerCase().includes(search.toLowerCase())) && monthIndex(i.startMonth) <= end && monthIndex(i.endMonth) >= start)
  const complete = items.filter(i => i.status === 'Complete').length
  const target = items.length ? items.reduce((latest, i) => i.endMonth > latest ? i.endMonth : latest, items[0].endMonth) : null
  function reset() { setSearch(''); setPhase('all'); setStatus('all'); setOwner('all'); setYear('all'); setCollapsed([]) }
  return <>
    <div className="page-heading"><div><p className="eyebrow">WORKSPACE / PROGRAM ROADMAP</p><h1>From plan to progress<span className="heading-dot">.</span></h1><p className="muted">AmethystPlus 1.0 · 2.0 · 3.0 <span className="roadmap-heading-separator">/</span> Target completion: {target ? `${shortMonth(target)} ${target.slice(0, 4)}` : 'Not set'}</p></div>{canEdit && <button className="primary-button" onClick={() => setPanel('new')}>＋ New workstream</button>}</div>
    <div className="roadmap-overview"><div><strong>{complete}<span> / {items.length}</span></strong><p>workstreams complete</p></div><div className="program-progress"><div className="progress-caption"><span>Program delivery</span><strong>{items.length ? Math.round(complete / items.length * 100) : 0}%</strong></div><progress aria-label="Program completion" value={complete} max={items.length || 1} /></div><span className="roadmap-live-label">{items.filter(i => i.status === 'In Progress').length} in progress <span aria-hidden="true">↗</span></span></div>
    <div className="phase-cards">{roadmapPhases.map(p => { const group = items.filter(i => i.phase === p.id); const done = group.filter(i => i.status === 'Complete').length; return <button key={p.id} style={{ '--phase-color': p.color, '--phase-ink': p.id === '2.0' ? 'var(--brand-green-ink)' : p.color, '--phase-bar-ink': p.id === '2.0' ? 'var(--brand-charcoal)' : 'var(--brand-surface)' }} className={`phase-card ${phase === p.id ? 'selected' : ''}`} aria-pressed={phase === p.id} onClick={() => setPhase(phase === p.id ? 'all' : p.id)}><span className="phase-number">{p.id}</span><div><h2>{p.title}</h2><p>{done} of {group.length} complete · {group.filter(i => i.status === 'In Progress').length} active</p></div><span aria-hidden="true">↗</span></button> })}</div>
    <section className="ticket-board roadmap-board" aria-label="Program roadmap">
      <div className="board-title"><h2>Delivery timeline <span>{filtered.length}</span></h2><div className="timeline-controls"><label><span className="sr-only">Timeline year</span><select value={year} onChange={e => setYear(e.target.value)}><option value="all">Full roadmap</option>{years.map(y => <option key={y}>{y}</option>)}</select></label><button className="text-button" disabled={monthIndex(today) < start || monthIndex(today) > end} onClick={() => { const cell = scroll.current?.querySelector('[data-current-month]'); if (cell) scroll.current.scrollLeft = Math.max(0, cell.offsetLeft - 720) }}>Current month</button></div></div>
      <div className="filters"><label className="search-field"><span className="sr-only">Search roadmap</span><input type="search" placeholder="Search workstreams, owners, notes…" value={search} onChange={e => setSearch(e.target.value)} /></label><label><span className="sr-only">Filter phase</span><select value={phase} onChange={e => setPhase(e.target.value)}><option value="all">All phases</option>{roadmapPhases.map(p => <option key={p.id} value={p.id}>Phase {p.id}</option>)}</select></label><label><span className="sr-only">Filter status</span><select value={status} onChange={e => setStatus(e.target.value)}><option value="all">All statuses</option>{roadmapStatuses.map(s => <option key={s}>{s}</option>)}</select></label><label><span className="sr-only">Filter owner</span><select value={owner} onChange={e => setOwner(e.target.value)}><option value="all">All owners</option>{ownerOptions.map(p => <option key={p}>{p}</option>)}</select></label></div>
      <div className="roadmap-scroll" ref={scroll} tabIndex={0} role="region" aria-label="Monthly roadmap timeline; scroll horizontally for more months">
        <table className="roadmap-table" style={{ '--month-count': months.length, '--timeline-width': `${months.length * 38}px` }}><thead><tr><th className="roadmap-title-cell">Workstream / milestone</th><th>Owner</th><th>Start → target</th><th>Status</th><th className="timeline-heading"><div className="timeline-years">{yearGroups.map(g => <span key={g.year} style={{ flex: g.count }}>{g.year}</span>)}</div><div className="timeline-months">{months.map(m => <span key={m} className={m === today ? 'current-month' : ''} data-current-month={m === today ? true : undefined}>{shortMonth(m)}</span>)}</div></th></tr></thead>
          {roadmapPhases.map(p => { const group = filtered.filter(i => i.phase === p.id); if (!group.length) return null; return <tbody key={p.id} style={{ '--phase-color': p.color, '--phase-ink': p.id === '2.0' ? 'var(--brand-green-ink)' : p.color, '--phase-bar-ink': p.id === '2.0' ? 'var(--brand-charcoal)' : 'var(--brand-surface)' }}><tr className="phase-divider"><th colSpan={5}><button onClick={() => setCollapsed(collapsed.includes(p.id) ? collapsed.filter(id => id !== p.id) : [...collapsed, p.id])} aria-expanded={!collapsed.includes(p.id)}><span aria-hidden="true">{collapsed.includes(p.id) ? '▸' : '▾'}</span> {p.id} <span>{p.title}</span><small>{group.length} workstreams</small></button></th></tr>
            {!collapsed.includes(p.id) && group.map(item => { const left = Math.max(start, monthIndex(item.startMonth)); const right = Math.min(end, monthIndex(item.endMonth)); const milestoneVisible = item.keyMilestone && monthIndex(item.endMonth) >= start && monthIndex(item.endMonth) <= end; return <tr key={item.id}><td className="roadmap-title-cell"><button className="roadmap-item-title" onClick={() => setPanel(item)}><span className="ticket-id">RM-{String(item.id).padStart(3, '0')}{item.ticketId ? ' · LINKED TICKET' : ''}</span>{item.title}</button></td><td>{item.owner}</td><td className="roadmap-dates">{shortMonth(item.startMonth)} {item.startMonth.slice(2, 4)}<span>→ {shortMonth(item.endMonth)} {item.endMonth.slice(2, 4)}</span></td><td><span className={`roadmap-status ${item.status.toLowerCase().replaceAll(' ', '-')}`}>{item.status}</span></td><td className="timeline-cell"><div className="timeline-track">
              {monthIndex(today) >= start && monthIndex(today) <= end && <span className="today-line" style={{ left: `${(monthIndex(today) - start + .5) / months.length * 100}%` }} />}
              <button className={`timeline-bar ${item.status === 'Complete' ? 'is-complete' : ''}`} style={{ left: `${(left - start) / months.length * 100}%`, width: `${(right - left + 1) / months.length * 100}%` }} onClick={() => setPanel(item)} aria-label={`${item.title}, ${item.startMonth} to ${item.endMonth}, ${item.status}`} title={`${item.title} · ${item.startMonth} → ${item.endMonth}`}><span>{item.status === 'Complete' ? '✓' : ''}</span>{milestoneVisible && <span className="milestone-diamond" aria-hidden="true">◆</span>}</button>
            </div></td></tr> })}</tbody> })}
        </table>
      </div>
      {!filtered.length && <div className="empty-state"><h3>{items.length ? 'No workstreams match your filters.' : 'Your roadmap is ready for its first workstream.'}</h3><button className="secondary-button" onClick={reset}>Reset filters</button></div>}
      <div className="board-footer"><div className="roadmap-legend">{roadmapPhases.map(p => <span key={p.id}><i style={{ background: p.color }} />Phase {p.id}</span>)}<span className="milestone-label">◆ Key milestone</span><span>Dashed line: current month</span></div><button className="text-button" onClick={reset}>Reset view</button></div>
    </section>
    <p className="data-note">Add workstreams to build your timeline. Select a workstream or timeline bar to inspect or execute it.</p>
    {panel && <RoadmapPanel key={panel === 'new' ? 'new' : panel.id} item={panel === 'new' ? null : panel} canEdit={canEdit} owners={ownerOptions} onClose={() => setPanel(null)} onSave={onSave} onExecute={onExecute} onOpenTicket={onOpenTicket} />}
  </>
}
