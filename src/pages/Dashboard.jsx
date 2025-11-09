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
    <Chrome>
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
