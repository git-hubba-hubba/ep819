import { useState } from 'react'
import { api } from '../api'

export default function AdminAccess() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  async function grant(event) {
    event.preventDefault()
    setBusy(true); setError(''); setNotice('')
    try {
      const { user } = await api('/admins', { method: 'POST', body: JSON.stringify({ email }) })
      setNotice(`${user.name} (${user.email}) now has administrator access. They can reload their workspace to see admin controls.`)
      setEmail('')
    } catch (error) { setError(error.message) }
    finally { setBusy(false) }
  }
  return <section className="view-card" aria-labelledby="admin-access-heading">
    <h2 id="admin-access-heading">Grant admin access</h2>
    <p>This person must first create an account. Administrators can manage tickets, roadmap items, team members, and grant admin access to others.</p>
    <form onSubmit={grant} className="admin-access-form">
      <label>Account email<input type="email" autoComplete="email" required maxLength={254} value={email} disabled={busy} onChange={event => { setEmail(event.target.value); setError(''); setNotice('') }} placeholder="person@example.com" /></label>
      <button className="primary-button" disabled={busy}>{busy ? 'Granting access…' : 'Grant admin access'}</button>
    </form>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
  </section>
}
