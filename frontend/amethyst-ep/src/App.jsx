import { useCallback, useEffect, useState } from 'react'
import AmethystPlus from './components/AmethystPlus'
import AuthPanel from './components/AuthPanel'
import TicketDashboard from './components/TicketDashboard'
import TicketPanel from './components/TicketPanel'
import RoadmapView from './components/RoadmapView'
import TeamView from './components/TeamView'
import { api } from './api'
import './App.css'
import './Workspace.css'

const views = { business: 'Tickets', care: 'Roadmap', sales: 'Team' }
export default function App() {
  const [view, setView] = useState(null)
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [tickets, setTickets] = useState([])
  const [roadmap, setRoadmap] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [panel, setPanel] = useState(null)
  const [notice, setNotice] = useState('')
  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [ticketResult, roadmapResult, teamResult] = await Promise.all([api('/tickets'), api('/roadmap'), api('/team')])
      setTickets(ticketResult.tickets)
      setRoadmap(roadmapResult.items)
      setMembers(teamResult.members)
    }
    catch (error) { setError(error.message); if (error.status === 401) { setUser(null); setTickets([]); setRoadmap([]); setMembers([]); setPanel(null) } }
    finally { setLoading(false) }
  }, [])
  useEffect(() => {
    let active = true
    api('/auth/me').then(({ user }) => {
      if (!active) return
      setUser(user)
      if (user) void refresh()
    }).catch(error => { if (active) setError(error.message) }).finally(() => { if (active) setAuthReady(true) })
    return () => { active = false }
  }, [refresh])
  async function logout() {
    try { await api('/auth/logout', { method: 'POST' }); setUser(null); setTickets([]); setRoadmap([]); setMembers([]); setPanel(null); setNotice(''); setError('') }
    catch (error) { setError(error.message) }
  }
  async function saveTicket(draft) {
    const { ticket, roadmapItem } = await api(draft.id ? `/tickets/${draft.id}` : '/tickets', { method: draft.id ? 'PATCH' : 'POST', body: JSON.stringify(draft) })
    setTickets(previous => draft.id ? previous.map(t => t.id === ticket.id ? ticket : t) : [ticket, ...previous])
    if (roadmapItem) setRoadmap(previous => previous.map(item => item.id === roadmapItem.id ? roadmapItem : item))
    setNotice(`AP-${String(ticket.id).padStart(3, '0')} ${draft.id ? 'updated' : 'created'} and assigned to ${ticket.owner}.`)
  }
  async function saveMember(draft) {
    const result = await api(draft.id ? `/team/${draft.id}` : '/team', { method: draft.id ? 'PATCH' : 'POST', body: JSON.stringify(draft) })
    setMembers(previous => draft.id ? previous.map(m => m.id === result.member.id ? result.member : m) : [...previous, result.member])
    setTickets(result.tickets)
    setRoadmap(result.items)
    setNotice(`${result.member.name} ${draft.id ? 'updated' : 'added to the team'}.`)
  }
  function updateRoadmap({ item, ticket }) {
    setRoadmap(previous => previous.some(i => i.id === item.id) ? previous.map(i => i.id === item.id ? item : i) : [...previous, item])
    if (ticket) setTickets(previous => previous.some(t => t.id === ticket.id) ? previous.map(t => t.id === ticket.id ? ticket : t) : [ticket, ...previous])
    setNotice(`${item.title}: ${item.status}.${ticket ? ` Linked ticket AP-${String(ticket.id).padStart(3, '0')} updated.` : ''}`)
  }
  async function saveRoadmap(draft) {
    updateRoadmap(await api(draft.id ? `/roadmap/${draft.id}` : '/roadmap', { method: draft.id ? 'PATCH' : 'POST', body: JSON.stringify(draft) }))
  }
  async function executeRoadmap(item, action) {
    updateRoadmap(await api(`/roadmap/${item.id}/execute`, { method: 'POST', body: JSON.stringify({ action, version: item.version }) }))
  }
  if (!view) return <main className="experience">
    <h1 className="sr-only">AmethystPlus Scheduling Hub</h1>
    <AmethystPlus value={view} onChange={setView} />
    <section className="path-status"><span className="status-eyebrow">YOUR WORKSPACE, CONNECTED</span><h2>Choose your workspace</h2><p>Select a green circle to open tickets, roadmap, or team.</p><div className="landing-links">{Object.entries(views).map(([key, label]) => <button key={key} onClick={() => setView(key)}>{label} ↗</button>)}</div></section>
  </main>
  if (!authReady) return <main className="auth-page"><p role="status">Opening workspace…</p></main>
  if (!user) return <AuthPanel onAuthenticated={user => { setUser(user); setError(''); void refresh() }} onBack={() => setView(null)} />
  const canEdit = user.role === 'admin'
  return <div className="workspace">
    <aside className="sidebar"><button className="workspace-brand" onClick={() => setView(null)}><span className="brand-mark">A+</span><span>AmethystPlus<small>SCHEDULING HUB</small></span></button><p className="nav-label">WORKSPACE</p><nav aria-label="Workspace">{Object.entries(views).map(([key, label], index) => <button key={key} className={view === key ? 'active' : ''} aria-current={view === key ? 'page' : undefined} onClick={() => { setView(key); setPanel(null) }}><span aria-hidden="true">{['▤', '▦', '◉'][index]}</span>{label}<span className="nav-arrow" aria-hidden="true">↗</span></button>)}</nav><div className="sidebar-bottom"><span className="access-dot" />{canEdit ? 'Administrator access' : 'Read-only access'}<p>{canEdit ? 'Manage tickets and assignments.' : 'Follow progress across your team.'}</p></div></aside>
    <div className="workspace-main"><header className="workspace-header"><span>{views[view]} <span className="header-divider">/</span> Overview</span><div className="account-menu"><span className="avatar">{user.name[0]}</span><span>{user.name}<small>{canEdit ? 'Administrator' : 'Reader'}</small></span><button className="text-button" onClick={logout}>Sign out</button></div></header>
      <main className="workspace-content">
        {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss notification">✕</button></div>}
        {error && <div className="error" role="alert">{error} <button className="text-button" onClick={refresh}>Try again</button></div>}
        <div className="refresh-line"><span>{canEdit ? 'Manage your team’s next steps' : 'Browse tickets and track progress'}</span><button className="text-button" onClick={refresh} disabled={loading}>{loading ? 'Loading…' : '↻ Refresh'}</button></div>
        {loading ? <div className="loading-card" role="status">Loading workspace…</div> : error ? <div className="empty-state"><h2>Unable to load the workspace.</h2><p>Try refreshing to reconnect.</p></div> : view === 'business' ? <TicketDashboard tickets={tickets} canEdit={canEdit} onOpen={setPanel} onCreate={() => setPanel('new')} /> : view === 'care' ? <RoadmapView people={members.map(m => m.name)} items={roadmap} canEdit={canEdit} onSave={saveRoadmap} onExecute={executeRoadmap} onOpenTicket={id => setPanel(tickets.find(t => t.id === id))} /> : <TeamView tickets={tickets} members={members} canEdit={canEdit} onSaveMember={saveMember} onAssign={owner => setPanel({ newTicket: true, owner })} onOpen={setPanel} />}
      </main>
    </div>
    {panel && <TicketPanel key={panel === 'new' || panel.newTicket ? 'new' : panel.id} ticket={panel === 'new' || panel.newTicket ? null : panel} initialOwner={panel.newTicket ? panel.owner : ''} canEdit={canEdit} people={[...members.map(m => m.name), ...tickets.map(t => t.owner)]} onClose={() => setPanel(null)} onSave={saveTicket} />}
  </div>
}
