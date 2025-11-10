import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Chrome from '../components/Chrome'

function fmtDuration(sec) {
  if (!sec && sec !== 0) return '-'
  const s = Math.round(sec)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

export default function History() {
  const { user, loading } = useAuth()
  const [sessions, setSessions] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) return
    fetchSessions()
  }, [user])

  async function fetchSessions() {
    const { data, error } = await supabase
      .from('study_sessions')
      .select('*, decks(title)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) console.error('fetchSessions', error)
    else setSessions(data || [])
  }

  if (loading) return <div style={{ padding: 20 }}>Loading...</div>

  return (
    <Chrome>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Study history</h2>
      </div>

      {sessions.length === 0 ? (
        <p>No study sessions yet. Play some decks to generate history.</p>
      ) : (
        <div className="history-list">
          {sessions.map((s) => {
            const deckTitle = s.decks?.title || (Array.isArray(s.decks) ? s.decks[0]?.title : 'Deck')
            const when = s.created_at ? new Date(s.created_at).toLocaleString() : ''
            const duration = fmtDuration(s.duration_seconds)
            return (
              <div key={s.id} className="history-item" onClick={() => navigate(`/play/${s.deck_id}`)}>
                <div className="history-left">
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div className="history-deck">{deckTitle}</div>
                    {s.is_focused && <div className="focus-badge" style={{ fontSize: 11, padding: '4px 8px' }}>Focused</div>}
                  </div>
                  <div className="history-meta">{when}</div>
                </div>
                <div className="history-right">
                  <div className="history-score">{s.score}%</div>
                  <div className="history-duration">{duration}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Chrome>
  )
}
