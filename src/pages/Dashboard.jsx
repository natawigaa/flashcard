import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Chrome from '../components/Chrome'

export default function Dashboard() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [decks, setDecks] = useState([])
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!user) return
    fetchDecks()
  }, [user])

  async function fetchDecks() {
    // the decks table uses `owner` (uuid) as the owner column
    const { data, error } = await supabase.from('decks').select('*').eq('owner', user.id)
    if (error) console.error(error)
    else setDecks(data || [])
  }

  const filtered = decks.filter((d) => d.title?.toLowerCase().includes(query.toLowerCase()))

  if (loading) return <div>Loading...</div>

  return (
    <Chrome onSearch={(q) => setQuery(q)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Dashboard</h2>
      </div>

      <h3>Your Decks</h3>
      {filtered.length === 0 ? (
        <p>No decks found. <Link to="/deck/new">Create one</Link></p>
      ) : (
        <div className="decks-grid">
          {filtered.map((d) => (
            <div className="deck-card" key={d.id} onClick={() => navigate(`/play/${d.id}`)}>
              <div className="deck-card-header">
                <h4 className="deck-title">{d.title}</h4>
                <div className="deck-actions">
                  <Link to={`/deck/${d.id}`} className="deck-edit" onClick={(e)=>e.stopPropagation()}>Edit</Link>
                  <button
                    className="icon-btn icon-btn--minimal"
                    onClick={async (e) => {
                      e.stopPropagation()
                      const ok = window.confirm(`Delete deck "${d.title}"? This cannot be undone.`)
                      if (!ok) return
                      try {
                        const { error } = await supabase.from('decks').delete().eq('id', d.id)
                        if (error) throw error
                        setDecks((prev) => prev.filter((x) => x.id !== d.id))
                      } catch (err) {
                        console.error('delete deck', err)
                        alert('Could not delete deck. See console for details.')
                      }
                    }}
                    aria-label={`Delete ${d.title}`}
                    title="Delete deck"
                  >
                    {/* Trash icon */}
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
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
