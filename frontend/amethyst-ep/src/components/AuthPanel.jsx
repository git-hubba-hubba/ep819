import { useState } from 'react'
import { api } from '../api'
import AmethystPlus from './AmethystPlus'

export default function AuthPanel({ view, onChangeView, onAuthenticated, onBack }) {
  const [mode, setMode] = useState('login')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const { user } = await api(`/auth/${mode}`, { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) })
      onAuthenticated(user)
    } catch (error) { setError(error.message) }
    finally { setBusy(false) }
  }
  return <main className="auth-page">
    <button className="text-button" onClick={onBack}>← Back to AmethystPlus</button>
    <div className="page-image"><AmethystPlus value={view} onChange={onChangeView} /></div>
    <section className="auth-card">
      <span className="brand-mark" aria-hidden="true">A+</span>
      <p className="eyebrow">AMETHYSTPLUS WORKSPACE</p>
      <h1>{mode === 'login' ? 'Welcome back.' : 'Stay in the loop.'}</h1>
      <p className="muted">{mode === 'login' ? 'Sign in to see your team’s action items.' : 'Create an account to read tickets, track deadlines, and see who owns what.'}</p>
      <div className="auth-switch"><button aria-pressed={mode === 'login'} onClick={() => { setMode('login'); setError('') }} disabled={busy}>Sign in</button><button aria-pressed={mode === 'signup'} onClick={() => { setMode('signup'); setError('') }} disabled={busy}>Create account</button></div>
      <form onSubmit={submit}>
        {mode === 'signup' && <label>Full name<input name="name" autoComplete="name" required maxLength={100} /></label>}
        <label>Email address<input name="email" type="email" autoComplete="username" required maxLength={254} /></label>
        <label>Password<input name="password" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required minLength={12} maxLength={128} /></label>
        {mode === 'signup' && <small className="muted">Use at least 12 characters. New accounts have read-only access.</small>}
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary-button" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in →' : 'Create read-only account →'}</button>
      </form>
      <p className="auth-note">Ticket creation and editing are reserved for the administrator.</p>
    </section>
  </main>
}
