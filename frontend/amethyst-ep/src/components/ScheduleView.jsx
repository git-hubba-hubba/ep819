export default function ScheduleView({ tickets, onOpen }) {
  const open = tickets.filter(t => t.status !== 'Completed')
  const scheduled = open.filter(t => t.dueDate).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const unassigned = open.filter(t => !t.dueDate)
  return <><div className="page-heading"><div><p className="eyebrow">WORKSPACE / SCHEDULE</p><h1>What’s coming up<span className="heading-dot">.</span></h1><p className="muted">A simple timeline of open action items and their deadlines.</p></div></div>
    <section className="view-card"><h2>Assigned deadlines <span className="count">{scheduled.length}</span></h2>{scheduled.length ? scheduled.map(t => <button className="schedule-row" key={t.id} onClick={() => onOpen(t)}><time dateTime={t.dueDate}>{t.dueDate}</time><strong>{t.title}</strong><span>{t.owner} ↗</span></button>) : <div className="empty-state"><h3>No deadlines assigned yet.</h3><p>The administrator can add a due date when creating or editing a ticket.</p></div>}</section>
    <section className="view-card"><h2>Needs a due date <span className="count">{unassigned.length}</span></h2>{unassigned.map(t => <button className="schedule-row" key={t.id} onClick={() => onOpen(t)}><span className="ticket-id">AP-{String(t.id).padStart(3, '0')}</span><strong>{t.title}</strong><span>{t.owner} ↗</span></button>)}{!unassigned.length && <p className="muted">All open action items have due dates.</p>}</section>
  </>
}
