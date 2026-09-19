import { useId, useRef, useState } from 'react'
import { MAX_IMPORT_BYTES, parseImport } from '../imports/parseImport'
import TicketPanel from './TicketPanel'
import RoadmapPanel from './RoadmapPanel'

export default function FileImport({ kind, onSave, people = [] }) {
  const input = useRef(null)
  const helpId = useId()
  const [batch, setBatch] = useState(null)
  const [index, setIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const approved = useRef(0)
  async function upload(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy(true); setError(''); setMessage('')
    try {
      if (file.size > MAX_IMPORT_BYTES) throw new Error('Choose a file smaller than 1 MB.')
      const drafts = parseImport(await file.text(), file.name, kind)
      approved.current = 0; setIndex(0); setBatch({ drafts, filename: file.name })
    } catch (error) { setError(error.message) }
    finally { setBusy(false) }
  }
  function next() {
    if (index + 1 < batch.drafts.length) setIndex(index + 1)
    else {
      setMessage(`Review finished. ${approved.current} added; ${batch.drafts.length - approved.current} skipped.`)
      setBatch(null)
    }
  }
  async function approve(draft) { await onSave(draft); approved.current++ }
  const review = batch ? {
    initialDraft: batch.drafts[index],
    importLabel: `${batch.filename} · Item ${index + 1} of ${batch.drafts.length}. Review all fields and fill in missing details. Nothing is added until you approve.`,
    onClose: next, onSave: approve, canEdit: true,
    onCancelImport: () => { setMessage(`Review stopped. ${approved.current} added; all remaining drafts discarded.`); setBatch(null) },
  } : null
  return <div className="file-import">
    <input ref={input} type="file" accept=".csv,.json,.txt" hidden onChange={upload} aria-label={`Upload ${kind} file`} />
    <button className="secondary-button" disabled={busy || !!batch} onClick={() => input.current.click()} aria-describedby={helpId}>{busy ? 'Reading file…' : '↑ Upload file'}</button>
    <details id={helpId}><summary>File formats</summary><p>CSV, JSON, or labeled TXT · up to 1 MB / 100 items. Include a title and at least one relevant detail. Each item requires admin approval.</p><p>{kind === 'tickets' ? 'Fields: title, owner, notes, priority, status, dueDate (YYYY-MM-DD), useCase.' : 'Fields: title, owner, notes, phase (1.0, 2.0, 3.0), status, startMonth and endMonth (YYYY-MM), keyMilestone (true/false).'}</p><p>JSON accepts an object or array. TXT uses one Field: value per line, with a blank line between items. Missing fields use the form defaults or remain empty for review.</p></details>
    {error && <p className="error" role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    {batch && (kind === 'tickets' ? <TicketPanel key={index} {...review} people={people} /> : <RoadmapPanel key={index} {...review} owners={people} />)}
  </div>
}
