import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Chrome from '../components/Chrome'

export default function Dashboard() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [decks, setDecks] = useState([])
  const [query, setQuery] = useState('')
  const [loadingSearch, setLoadingSearch] = useState(false)
  const [searchError, setSearchError] = useState(null)

  useEffect(() => {
    if (!user) return
    fetchDecks()
  }, [user])

  // fetch server-side search when query changes (TopBar is debounced)
  useEffect(() => {
    // if query empty, reload user's decks client-side
    if (!user) return
    if (!query) {
      fetchDecks()
      return
    }

    let mounted = true
    async function runSearch() {

  console.log('[debug] runSearch start', { query })
      setLoadingSearch(true)
      setSearchError(null)
      try {
        // get current access token for the logged in user
        const { data } = await supabase.auth.getSession()
        const accessToken = data?.session?.access_token
  console.log('[debug] access token present?', !!accessToken)
        if (!accessToken) throw new Error('No access token available')

        // Prefer explicit API base from env (Vite uses VITE_ prefix). Default to localhost:54321
        const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:54321').replace(/\/$/, '')
  console.log('[debug] apiBase', apiBase)
        const resp = await fetch(`${apiBase}/api/search?q=${encodeURIComponent(query)}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
  console.log('[debug] fetch sent to', `${apiBase}/api/search?q=${encodeURIComponent(query)}`)
        if (!mounted) return
        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}))
          throw new Error(body?.error || `Search failed (${resp.status})`)
        }
        const body = await resp.json()
  console.log('[debug] search response', body)
        setDecks(body.data || [])
      } catch (err) {
        console.error('search error', err)
        setSearchError(err.message || String(err))
      } finally {
        if (mounted) setLoadingSearch(false)
      }
    }
    runSearch()
    return () => { mounted = false }
  }, [query, user])

  async function fetchDecks() {
    // the decks table uses `owner` (uuid) as the owner column
    const { data, error } = await supabase.from('decks').select('*').eq('owner', user.id)
    if (error) console.error(error)
    else setDecks(data || [])
  }

  const [openMenuId, setOpenMenuId] = useState(null)
  const [exportLoadingId, setExportLoadingId] = useState(null)
  const [exportFormat, setExportFormat] = useState('csv') // global default; per-deck chooser in dropdown
  const [toast, setToast] = useState(null)
  const location = useLocation()

  useEffect(() => {
    if (location?.state?.toast) {
      setToast(location.state.toast)
      // clear history state so toast doesn't reappear on navigation
      try { window.history.replaceState({}, '', window.location.pathname) } catch (e) {}
      setTimeout(() => setToast(null), 4000)
    }
  }, [location])
  // close menu when clicking outside
  useEffect(() => {
    function onDocClick() {
      setOpenMenuId(null)
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [])

  async function handleExport(deck) {
    setExportLoadingId(deck.id)
    try {
      const { data } = await supabase.auth.getSession()
      const accessToken = data?.session?.access_token
      if (!accessToken) throw new Error('Not authenticated')
      const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:54321').replace(/\/$/, '')
      const resp = await fetch(`${apiBase}/api/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ deck_id: deck.id, format: exportFormat || 'csv' }),
      })
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}))
        throw new Error(body?.error || `Export failed (${resp.status})`)
      }
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const cd = resp.headers.get('content-disposition') || ''
      const m = cd.match(/filename="?([^";]+)"?/)
      a.download = m ? m[1] : `${deck.title || 'deck'}.${exportFormat === 'json' ? 'json' : 'csv'}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setToast('Export completed — ตรวจสอบไฟล์ดาวน์โหลดของคุณ')
    } catch (err) {
      console.error('export error', err)
      setToast(`Export ล้มเหลว: ${err.message || err}`)
    } finally {
      setExportLoadingId(null)
      // hide toast after 4s
      setTimeout(() => setToast(null), 4000)
    }
  }

  async function handleDelete(deck) {
    const ok = window.confirm(`Delete deck "${deck.title}"? This cannot be undone.`)
    if (!ok) return
    try {
      const { error } = await supabase.from('decks').delete().eq('id', deck.id)
      if (error) throw error
      setDecks((prev) => prev.filter((x) => x.id !== deck.id))
    } catch (err) {
      console.error('delete deck', err)
      alert('Could not delete deck. See console for details.')
    }
  }

  const filtered = decks.filter((d) => d.title?.toLowerCase().includes(query.toLowerCase()))

  if (loading) return <div>Loading...</div>

  return (
    <Chrome onSearch={(q) => setQuery(q)}>
      {/* toast */}
      {toast && (
        <div style={{ position: 'fixed', right: 16, top: 16, background: 'var(--card)', color: 'var(--text)', padding: '10px 14px', borderRadius: 8, boxShadow: '0 6px 18px rgba(0,0,0,0.12)', zIndex: 1200 }}>
          {toast}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Dashboard</h2>
      </div>

      <h3>Your Decks</h3>
      {loadingSearch ? (
        <p>Searching…</p>
      ) : searchError ? (
        <p style={{ color: 'var(--muted)' }}>Search error: {searchError}</p>
      ) : filtered.length === 0 ? (
        <p>No decks found. <Link to="/deck/new">Create one</Link></p>
      ) : (
        <div className="decks-grid">
          {filtered.map((d) => (
            <div className="deck-card" key={d.id} onClick={() => navigate(`/play/${d.id}`)}>
              <div className="deck-card-header">
                <h4 className="deck-title">{d.title}</h4>
                <div className="deck-actions">
                  <Link to={`/deck/${d.id}`} className="deck-edit" onClick={(e)=>e.stopPropagation()}>Edit</Link>
                  {/* three-dot vertical menu */}
                  <div className="menu-wrapper" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="icon-btn icon-btn--minimal"
                      aria-haspopup="true"
                      aria-expanded={openMenuId === d.id}
                      onClick={() => setOpenMenuId(openMenuId === d.id ? null : d.id)}
                      title="More"
                    >
                      {/* vertical three dots */}
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <circle cx="12" cy="5" r="1" />
                        <circle cx="12" cy="12" r="1" />
                        <circle cx="12" cy="19" r="1" />
                      </svg>
                    </button>

                    {openMenuId === d.id && (
                      <div className="menu-dropdown" role="menu" onClick={(e) => e.stopPropagation()}>
                        <div style={{ padding: '8px 12px' }}>
                          <label style={{ display: 'block', fontSize: 12, marginBottom: 6 }}>รูปแบบการส่งออก</label>
                          <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value)} style={{ width: '100%' }}>
                            <option value="csv">CSV</option>
                            <option value="json">JSON</option>
                          </select>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <button className="menu-item" onClick={() => { setOpenMenuId(null); handleExport(d) }} role="menuitem" disabled={exportLoadingId === d.id}>
                            {exportLoadingId === d.id ? 'กำลังส่งออก…' : 'Export'}
                          </button>
                          <button className="menu-item" onClick={() => { setOpenMenuId(null); handleDelete(d) }} role="menuitem">Delete</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {d.description && <p className="deck-desc">{d.description}</p>}
              <div className="deck-meta">
                <span>{d.card_count ?? 0} cards</span>
                <span className="deck-created">{d.created_at ? new Date(d.created_at).toLocaleDateString() : ''}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Chrome>
  )
}
