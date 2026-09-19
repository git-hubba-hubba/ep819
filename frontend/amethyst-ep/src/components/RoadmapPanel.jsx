import { useEffect, useRef, useState } from 'react'
import { roadmapPhases, roadmapStatuses, monthEnd } from '../data/roadmap'

export default function RoadmapPanel({ item, canEdit, owners, onClose, onSave, onExecute, onOpenTicket, initialDraft, importLabel, onCancelImport }) {
  const dialog = useRef(null)
  const [editing, setEditing] = useState(!item)
  const [draft, setDraft] = useState(item || { title: '', phase: '1.0', owner: '', startMonth: new Date().toISOString().slice(0, 7), endMonth: new Date().toISOString().slice(0, 7), status: 'Planned', keyMilestone: false, notes: '', ...initialDraft })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const previous = document.activeElement
    const element = dialog.current
    element.showModal()
    return () => { element.close(); previous?.focus() }
  }, [])
  const change = e => setDraft({ ...draft, [e.target.name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  async function run(operation) {
    setBusy(true); setError('')
    try { await operation(); onClose() } catch (error) { setError(error.message); setBusy(false) }
  }
  return <dialog ref={dialog} className="ticket-dialog roadmap-dialog" aria-labelledby="roadmap-panel-heading" onCancel={e => { e.preventDefault(); if (!busy) onClose() }}>
    <div className="panel-heading"><div><p className="eyebrow">{item ? `ROADMAP / RM-${String(item.id).padStart(3, '0')}` : 'NEW WORKSTREAM'}</p><h2 id="roadmap-panel-heading">{editing ? item ? 'Edit workstream' : importLabel ? 'Review imported workstream' : 'Plan a workstream' : 'Workstream details'}</h2></div><button className="icon-button" disabled={busy} onClick={onClose} aria-label="Close workstream">✕</button></div>
    {editing && canEdit ? <form onSubmit={e => { e.preventDefault(); void run(() => onSave(draft)) }}>
      {importLabel && <p className="import-review" role="status">{importLabel}</p>}
      <label>Workstream / milestone<input autoFocus name="title" required maxLength={300} value={draft.title} onChange={change} /></label>
      <div className="form-grid">
        <label>Phase<select name="phase" value={draft.phase} onChange={change}>{roadmapPhases.map(p => <option key={p.id} value={p.id}>{p.id} — {p.title}</option>)}</select></label>
        <label>Owner<input name="owner" value={draft.owner} onChange={change} list="roadmap-owners" required maxLength={100} /><datalist id="roadmap-owners">{owners.map(owner => <option key={owner} value={owner} />)}</datalist></label>
        <label>Start month<input type="month" name="startMonth" min="2020-01" max="2040-12" value={draft.startMonth} onChange={change} required /></label>
        <label>Target end month<input type="month" name="endMonth" min={draft.startMonth} max="2040-12" value={draft.endMonth} onChange={change} required /></label>
        <label>Status<select name="status" value={draft.status} onChange={change}>{roadmapStatuses.map(s => <option key={s}>{s}</option>)}</select></label>
      </div>
      <label className="milestone-check"><input name="keyMilestone" type="checkbox" checked={draft.keyMilestone} onChange={change} />Key milestone / target date <span aria-hidden="true">◆</span></label>
      <label>Execution notes<textarea name="notes" rows={4} maxLength={10000} value={draft.notes} onChange={change} placeholder="Define the outcome and next steps…" /></label>
      {item?.ticketId && <p className="muted">Saving also updates the linked ticket’s title, owner, status, and due date.</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="panel-actions">{onCancelImport && <button type="button" className="text-button" disabled={busy} onClick={onCancelImport}>Discard remaining</button>}<button className="secondary-button" type="button" onClick={onClose} disabled={busy}>{importLabel ? 'Skip item' : 'Cancel'}</button><button className="primary-button" disabled={busy}>{busy ? 'Saving…' : importLabel ? 'Approve & add workstream' : 'Save workstream'}</button></div>
    </form> : <div className="ticket-details">
      <h3>{item.title}</h3><div className="badge-row"><span className={`roadmap-status ${item.status.toLowerCase().replaceAll(' ', '-')}`}>{item.status}</span><span className="status-badge">Phase {item.phase}</span>{item.keyMilestone && <span className="milestone-label">◆ Key milestone</span>}</div>
      <dl className="detail-grid"><div><dt>Owner</dt><dd>{item.owner}</dd></div><div><dt>Target end</dt><dd>{item.endMonth}</dd></div><div><dt>Start</dt><dd>{item.startMonth}</dd></div><div><dt>Last update</dt><dd>{item.updatedAt ? new Date(item.updatedAt).toLocaleString() : 'Imported from roadmap'}</dd></div></dl>
      <h4>Execution notes</h4><p className="ticket-notes">{item.notes || 'No additional notes yet.'}</p>
      {item.ticketId && <button className="secondary-button" onClick={() => { onClose(); onOpenTicket(item.ticketId) }}>Open linked ticket AP-{String(item.ticketId).padStart(3, '0')} ↗</button>}
      {canEdit ? <><p className="execution-hint">Execution creates or updates one assigned ticket, due {monthEnd(item.endMonth)} (the end of the target month).</p><div className="roadmap-actions"><button className="secondary-button" disabled={busy} onClick={() => setEditing(true)}>Edit details</button>
        {(item.status === 'Planned' || (item.status === 'In Progress' && !item.ticketId)) && <button className="primary-button" disabled={busy} onClick={() => run(() => onExecute(item, 'start'))}>{busy ? 'Saving…' : item.ticketId ? 'Start workstream' : 'Start & create ticket'}</button>}
        {item.status === 'In Progress' && <button className="primary-button" disabled={busy} onClick={() => run(() => onExecute(item, 'complete'))}>Mark complete</button>}
        {item.status === 'Complete' && <button className="primary-button" disabled={busy} onClick={() => run(() => onExecute(item, 'reopen'))}>Reopen workstream</button>}
      </div></> : <p className="execution-hint">Read-only access · The administrator manages dates and execution.</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </div>}
  </dialog>
}
