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

    if (error) {
      console.error('fetchSessions', error)
      setSessions([])
      return
    }

    // log raw data to help debug duplicate cases (remove later if noisy)
    console.debug('fetchSessions raw data', data)

    // Deduplicate more robustly: sometimes rows can be duplicated due to
    // joins or previous code changes. Use a composite key to remove exact
    // duplicates while preserving ordering.
    const seen = new Set()
    const deduped = []
    for (const s of (data || [])) {
      // create a stable key: deck_id + created_at + score + duration
      const keyParts = [s.deck_id, s.created_at, String(s.score), String(s.duration_seconds)]
      const key = keyParts.join('::')
      if (seen.has(key)) continue
      seen.add(key)
      deduped.push(s)
    }

    setSessions(deduped)
  }

  if (loading) return <div style={{ padding: 20 }}>Loading...</div>

  // sometimes the query can return duplicate rows (e.g. accidental join issues or
  // previous code changes). Deduplicate by session id before rendering so each
  // study session only appears once in the UI.
  const displaySessions = (() => {
    const seen = new Set()
    const out = []
    for (const s of sessions) {
      if (!s || !s.id) continue
      if (seen.has(s.id)) continue
      seen.add(s.id)
      out.push(s)
    }
    return out
  })()

  return (
    <Chrome>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Study history</h2>
      </div>

      {displaySessions.length === 0 ? (
        <p>No study sessions yet. Play some decks to generate history.</p>
      ) : (
        <div className="history-list">
          {displaySessions.map((s) => {
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
