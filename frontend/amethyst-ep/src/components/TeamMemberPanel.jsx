import { useEffect, useRef, useState } from 'react'

export default function TeamMemberPanel({ member, onClose, onSave }) {
  const dialog = useRef(null)
  const [draft, setDraft] = useState(member || { name: '', position: '', email: '', image: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [reading, setReading] = useState(false)
  useEffect(() => {
    const previous = document.activeElement
    const element = dialog.current
    element.showModal()
    return () => { element.close(); previous?.focus() }
  }, [])
  function change(e) { setDraft({ ...draft, [e.target.name]: e.target.value }) }
  async function selectImage(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError('')
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 512 * 1024) { setError('Choose a PNG, JPEG, or WebP image up to 512 KB.'); return }
    setReading(true)
    try {
      const image = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('Could not read the image.')); reader.readAsDataURL(file) })
      await new Promise((resolve, reject) => { const preview = new Image(); preview.onload = resolve; preview.onerror = () => reject(new Error('This image could not be opened. Choose another file.')); preview.src = image })
      setDraft(previous => ({ ...previous, image }))
    } catch (error) { setError(error.message) }
    finally { setReading(false) }
  }
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('')
    try { await onSave(draft); onClose() } catch (error) { setError(error.message); setBusy(false) }
  }
  return <dialog ref={dialog} className="ticket-dialog" aria-labelledby="member-heading" onCancel={e => { e.preventDefault(); if (!busy && !reading) onClose() }}>
    <div className="panel-heading"><div><p className="eyebrow">PEOPLE & OWNERSHIP</p><h2 id="member-heading">{member ? 'Edit team member' : 'Add a person'}</h2></div><button className="icon-button" onClick={onClose} disabled={busy || reading} aria-label="Close person form">✕</button></div>
    <form onSubmit={submit}>
      <div className="member-image-field">{draft.image ? <img className="member-photo" src={draft.image} alt="Profile preview" /> : <span className="avatar member-photo" aria-hidden="true">{draft.name[0] || '+'}</span>}<div><label>Image (optional)<input type="file" accept="image/png,image/jpeg,image/webp" onChange={selectImage} disabled={busy || reading} /></label><small className="muted">PNG, JPEG, or WebP · up to 512 KB</small>{draft.image && <button className="text-button" type="button" disabled={busy || reading} onClick={() => setDraft({ ...draft, image: '' })}>Remove image</button>}</div></div>
      <label>Name<input name="name" autoFocus required maxLength={100} autoComplete="name" value={draft.name} onChange={change} /></label>
      <label>Position<input name="position" required maxLength={120} autoComplete="organization-title" placeholder="e.g. Program Manager" value={draft.position} onChange={change} /></label>
      <label>Email<input name="email" type="email" required maxLength={254} autoComplete="email" value={draft.email} onChange={change} /></label>
      <p className="execution-hint">This profile is available for ticket and roadmap ownership. Adding a person does not create a login or send an invitation.</p>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="panel-actions"><button type="button" className="secondary-button" onClick={onClose} disabled={busy || reading}>Cancel</button><button className="primary-button" disabled={busy || reading}>{reading ? 'Reading image…' : busy ? 'Saving…' : member ? 'Save person' : 'Add person'}</button></div>
    </form>
  </dialog>
}
