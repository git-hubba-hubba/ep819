import { useState } from 'react'
import TeamMemberPanel from './TeamMemberPanel'

export default function TeamView({ tickets, members, canEdit, onSaveMember, onAssign, onOpen }) {
  const [selected, setSelected] = useState(null)
  const [panel, setPanel] = useState(null)
  const unlisted = [...new Set(tickets.map(t => t.owner))].filter(owner => !members.some(m => m.name.toLowerCase() === owner.toLowerCase())).sort()
  const people = [...members, ...unlisted.map(name => ({ name, id: `owner-${name}` }))]
  const assignedTo = name => tickets.filter(t => t.owner.toLowerCase() === name.toLowerCase())
  return <>
    <div className="page-heading"><div><p className="eyebrow">WORKSPACE / TEAM</p><h1>People & ownership<span className="heading-dot">.</span></h1><p className="muted">Your team, their roles, and the action items they own.</p></div>{canEdit && <button className="primary-button" onClick={() => setPanel('new')}>＋ Add person</button>}</div>
    <div className="team-grid">{people.map(person => {
      const assigned = assignedTo(person.name)
      const open = assigned.filter(t => t.status !== 'Completed').length
      return <article key={person.id} className={`team-card ${selected === person.name ? 'active' : ''}`}>
        <div className="member-card-heading">{person.image ? <img className="member-photo" src={person.image} alt={`${person.name} profile`} /> : <span className="avatar member-photo" aria-hidden="true">{person.name[0]}</span>}{canEdit && person.email && <button className="text-button" onClick={() => setPanel(person)} aria-label={`Edit ${person.name}`}>Edit</button>}</div>
        <h2>{person.name}</h2><p className="member-position">{person.position || 'Assigned owner'}</p>{person.email && <a className="member-email" href={`mailto:${person.email}`}>{person.email}</a>}
        <p>{open} open · {assigned.length - open} completed</p><div className="member-card-actions"><button className="text-button" onClick={() => setSelected(selected === person.name ? null : person.name)} aria-expanded={selected === person.name}>View action items ↗</button>{canEdit && <button className="secondary-button" onClick={() => onAssign(person.name)}>Assign ticket</button>}</div>
      </article>
    })}</div>
    {!people.length && <section className="view-card empty-state"><h2>Your team starts here.</h2><p>{canEdit ? 'Add a person with their role and contact details, then assign their first ticket.' : 'Team members will appear here when the administrator adds them.'}</p></section>}
    {selected && <section className="view-card"><h2>{selected}’s action items</h2>{assignedTo(selected).map(t => <button className="schedule-row" key={t.id} onClick={() => onOpen(t)}><span className={`priority priority-${t.priority.toLowerCase()}`}>{t.priority}</span><strong>{t.title}</strong><span>{t.status} ↗</span></button>)}{!assignedTo(selected).length && <p className="muted">No tickets assigned yet.</p>}</section>}
    {panel && canEdit && <TeamMemberPanel key={panel.id || 'new'} member={panel === 'new' ? null : panel} onClose={() => setPanel(null)} onSave={async draft => { await onSaveMember(draft); if (panel.name === selected) setSelected(draft.name.trim()) }} />}
  </>
}
