import { useEffect, useRef, useState } from 'react'
import { priorities, statuses, owners, useCases } from '../data/tickets'

const empty = { title: '', priority: 'Medium', status: 'AT&T Action Needed', owner: '', dueDate: '', notes: '', useCase: 'Not specified' }
export default function TicketPanel({ ticket, canEdit, onClose, onSave, people, initialOwner = '' }) {
  const dialog = useRef(null)
  const [editing, setEditing] = useState(!ticket)
  const [draft, setDraft] = useState(ticket || { ...empty, owner: initialOwner })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    const previous = document.activeElement
    const element = dialog.current
    element.showModal()
    return () => { element.close(); previous?.focus() }
  }, [])
  const change = (event) => setDraft({ ...draft, [event.target.name]: event.target.value })
  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try { await onSave(draft); onClose() }
    catch (error) { setError(error.message); setSaving(false) }
  }
  return <dialog ref={dialog} className="ticket-dialog" onCancel={(event) => { event.preventDefault(); if (!saving) onClose() }} aria-labelledby="ticket-heading">
    <div className="panel-heading"><div><p className="eyebrow">{ticket ? `ACTION ITEM · AP-${String(ticket.id).padStart(3, '0')}` : 'NEW ACTION ITEM'}</p><h2 id="ticket-heading">{editing ? ticket ? 'Edit ticket' : 'Create a ticket' : 'Ticket details'}</h2></div><button className="icon-button" onClick={onClose} disabled={saving} aria-label="Close ticket">✕</button></div>
    {editing && canEdit ? <form onSubmit={submit}>
      <label>Action item<textarea name="title" value={draft.title} onChange={change} required maxLength={300} rows={3} autoFocus placeholder="What needs to happen?" /></label>
      <div className="form-grid">
        <label>Priority<select name="priority" value={draft.priority} onChange={change}>{priorities.map(p => <option key={p}>{p}</option>)}</select></label>
        <label>Status<select name="status" value={draft.status} onChange={change}>{statuses.map(s => <option key={s}>{s}</option>)}</select></label>
        <label>Assign owner<input name="owner" value={draft.owner} onChange={change} list="ticket-owners" required maxLength={100} placeholder="Choose or type a name" /><datalist id="ticket-owners">{[...new Set([...owners, ...people])].map(p => <option key={p} value={p} />)}</datalist></label>
        <label>Due date<input name="dueDate" type="date" value={draft.dueDate} onChange={change} /></label>
        <label>Use case needed<select name="useCase" value={draft.useCase} onChange={change}>{useCases.map(s => <option key={s}>{s}</option>)}</select></label>
      </div>
      <label>Notes<textarea name="notes" value={draft.notes} onChange={change} rows={6} maxLength={10000} placeholder="Context, next steps, and latest updates…" /></label>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="panel-actions"><button type="button" className="secondary-button" onClick={onClose} disabled={saving}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? 'Saving…' : ticket ? 'Save changes' : 'Create ticket'}</button></div>
    </form> : <div className="ticket-details">
      <h3>{ticket.title}</h3><div className="badge-row"><span className={`priority priority-${ticket.priority.toLowerCase()}`}>{ticket.priority}</span><span className="status-badge">{ticket.status}</span></div>
      <dl className="detail-grid"><div><dt>Owner</dt><dd>{ticket.owner}</dd></div><div><dt>Due date</dt><dd>{ticket.dueDate || 'Not assigned'}</dd></div><div><dt>Submitted by</dt><dd>{ticket.submitter}</dd></div><div><dt>Use case needed</dt><dd>{ticket.useCase}</dd></div><div><dt>Submitted</dt><dd>{ticket.submittedAt ? new Date(ticket.submittedAt).toLocaleDateString() : 'Imported example'}</dd></div><div><dt>Last updated</dt><dd>{ticket.updatedAt ? new Date(ticket.updatedAt).toLocaleString() : 'No recorded update'}</dd></div></dl>
      <h4>Notes & next steps</h4><p className="ticket-notes">{ticket.notes || 'No notes yet.'}</p>
      {canEdit ? <button className="primary-button" onClick={() => setEditing(true)}>Edit ticket</button> : <p className="muted">Read-only access · Contact the administrator for changes.</p>}
    </div>}
  </dialog>
}
