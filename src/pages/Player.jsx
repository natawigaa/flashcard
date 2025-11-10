import React, { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// Use the actual storage bucket name in your Supabase project
const STORAGE_BUCKET = 'flashcard_image'

export default function Player() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [cards, setCards] = useState([])
  const [originalCards, setOriginalCards] = useState(null)
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [results, setResults] = useState([]) // true = known, false = not
  const [loading, setLoading] = useState(true)
  const containerRef = useRef()
  const sessionStartRef = useRef(null)
  const studySavedRef = useRef(false)
  const recentSavesRef = useRef(new Map())

  useEffect(() => {
    if (!id) return
    load()
    // keyboard handlers: only allow Space to reveal/hide
    const onKey = (e) => {
      if (e.key === ' ' || e.key === 'Spacebar' || e.code === 'Space') { e.preventDefault(); setRevealed((r) => !r) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // When the user finishes a run save the session as a guarded side-effect.
  // Wait until we have results for every card to avoid saving incomplete data.
  useEffect(() => {
    const runFinished = index >= cards.length
    const haveResults = results && results.length >= Math.max(1, cards.length)
    if (runFinished && haveResults && !studySavedRef.current) {
      // mark as in-progress immediately so concurrent effect runs don't start
      studySavedRef.current = true

      const correct = results.filter(Boolean).length
      const total = results.length || cards.length || 0
      const pct = total === 0 ? 0 : Math.round((correct / total) * 100)
      const started = sessionStartRef.current || Date.now()
      const duration = Math.max(0, Date.now() - started) / 1000

      console.debug('Attempting saveStudySession', { pct, duration, total, runFinished, haveResults })

      // save asynchronously; if save fails, reset the flag so app can retry
      saveStudySession(pct, duration, Boolean(originalCards))
        .then(({ error }) => {
          if (error) studySavedRef.current = false
        })
        .catch(() => { studySavedRef.current = false })
    }
    // we intentionally do not include saveStudySession in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, cards.length, results, originalCards])

  async function load() {
    setLoading(true)
    // mark session start time for full runs
    sessionStartRef.current = Date.now()
    studySavedRef.current = false
    const { data } = await supabase.from('flashcards').select('*').eq('deck_id', id)
    const items = (data || []).map((it) => ({ ...it }))
    // create signed urls for images if present (try signedUrl / signedURL and fall back to public url)
    await Promise.all(items.map(async (card) => {
      try {
        if (card.front_image_url) {
          const { data: urlData, error: sErr } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(card.front_image_url, 60 * 60)
          const signed = urlData?.signedUrl ?? urlData?.signedURL
          if (!sErr && signed) {
            card.frontImage = signed
          } else {
            // try public url fallback
            try {
              const { data: pubData, error: pubErr } = await supabase.storage.from(STORAGE_BUCKET).getPublicUrl(card.front_image_url)
              if (!pubErr && pubData?.publicUrl) card.frontImage = pubData.publicUrl
            } catch (e) { /* ignore */ }
          }
        }
        if (card.back_image_url) {
          const { data: urlData, error: sErr } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(card.back_image_url, 60 * 60)
          const signed = urlData?.signedUrl ?? urlData?.signedURL
          if (!sErr && signed) {
            card.backImage = signed
          } else {
            try {
              const { data: pubData, error: pubErr } = await supabase.storage.from(STORAGE_BUCKET).getPublicUrl(card.back_image_url)
              if (!pubErr && pubData?.publicUrl) card.backImage = pubData.publicUrl
            } catch (e) { /* ignore */ }
          }
        }
      } catch (e) {
        console.error('signed url', e)
      }
    }))
    // use a fresh array to ensure re-render
    setCards(items.map((c) => ({ ...c })))
    setIndex(0)
    setRevealed(false)
    setLoading(false)
  }

  function prev() {
    setRevealed(false)
    setIndex((i) => Math.max(0, i - 1))
  }

  function next() {
    setRevealed(false)
    setIndex((i) => Math.min(cards.length, i + 1))
  }

  function markKnown() {
    setResults((r) => [...r, true])
    if (index + 1 >= cards.length) setIndex((i) => i + 1)
    else setIndex((i) => i + 1)
    setRevealed(false)
  }

  function markNotRemember() {
    setResults((r) => [...r, false])
    if (index + 1 >= cards.length) setIndex((i) => i + 1)
    else setIndex((i) => i + 1)
    setRevealed(false)
  }

  // Start a focused session containing only the cards the user marked as not-remember
  function focusStillLearning() {
    // Build list of cards where the corresponding result was false
    const toFocus = cards.filter((c, i) => results[i] === false)
    if (!toFocus || toFocus.length === 0) {
      // nothing to focus on
      return
    }
  // preserve the original cards so user can return to the full deck
  if (!originalCards) setOriginalCards(cards)
  // mark session start for timing and reset saved flag
  sessionStartRef.current = Date.now()
  studySavedRef.current = false
    // Replace current cards with the focused subset and reset progress
    setCards(toFocus.map((c) => ({ ...c })))
    setIndex(0)
    setResults([])
    setRevealed(false)
  }

  function restoreFullDeck() {
    if (!originalCards) return
    setCards(originalCards.map((c) => ({ ...c })))
    setOriginalCards(null)
    setIndex(0)
    setResults([])
    setRevealed(false)
  }

  async function saveStudySession(scorePct, durationSeconds, isFocused = false) {
    try {
      if (!user) return
      // insert a study session record referencing the current deck id
      const payload = {
        user_id: user.id,
        deck_id: id,
        score: Math.round(scorePct),
        duration_seconds: Math.round(durationSeconds),
        is_focused: isFocused,
      }
      // defensive: avoid duplicate inserts by checking a short-lived in-memory map
      try {
        const started = sessionStartRef.current || Date.now()
        const key = `${user.id}::${id}::${Math.round(started / 1000)}`
        const now = Date.now()
        const last = recentSavesRef.current.get(key)
        if (last && (now - last) < 60_000) {
          console.debug('Skipping duplicate saveStudySession (recent)', { key })
          return { data: null, error: null }
        }
        recentSavesRef.current.set(key, now)
        // prune old entries
        for (const [k, t] of recentSavesRef.current.entries()) {
          if (now - t > 5 * 60 * 1000) recentSavesRef.current.delete(k)
        }
      } catch (e) {
        /* ignore guard errors */
      }

      const { data, error } = await supabase.from('study_sessions').insert(payload)
      if (error) {
        console.error('saveStudySession error', error)
        try {
          alert('Failed to save study session: ' + (error?.message || JSON.stringify(error)))
        } catch (e) { /* ignore */ }
        // leave studySavedRef as false so the app can retry later
      } else {
        console.debug('study session saved', data)
        // only mark as saved after successful insert
        studySavedRef.current = true
      }
      return { data, error }
    } catch (e) {
      console.error('saveStudySession', e)
      return { data: null, error: e }
    }
  }

  if (loading) return <div style={{ padding: 20 }}>Loading...</div>
  if (!cards.length) return <div style={{ padding: 20 }}>No cards</div>

  // finished state: show counts and percentage based on marks
  if (index >= cards.length) {
    const correct = results.filter(Boolean).length
    const incorrect = results.filter((r) => r === false).length
    const answered = results.length
    const total = cards.length
    const pct = total === 0 ? 0 : Math.round((correct / total) * 100)
    // prepare percentages for bars
  const pctKnown = total === 0 ? 0 : Math.round((correct / total) * 100)
  const pctIncorrect = total === 0 ? 0 : Math.round((incorrect / total) * 100)

  // Save a study_session row once per finished run (focused or full)
  

    return (
      <div className="player-container">
        <div style={{ width: '100%', maxWidth: 980, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="back-btn" onClick={() => navigate('/dashboard')} tabIndex={-1} aria-label="Back to dashboard">← Back</button>
          {originalCards && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="focus-badge">Focused session</div>
              <button className="undo-btn" onClick={restoreFullDeck} title="Undo focus">Undo</button>
            </div>
          )}
        </div>

        <div className="results-grid" role="region" aria-label="Results">
          <div className="results-left">
            <div style={{ textAlign: 'left', width: '100%' }}>
              <h2 className="section-title">You're doing great! Keep it up to build confidence.</h2>
              <div className="section-sub">How you're doing</div>
            </div>

            <div className="donut" style={{ ['--pct']: `${pct}%` }} aria-hidden>
              <div className="donut-inner">
                <div className="donut-number">{pct}%</div>
                <div className="donut-label">Score</div>
              </div>
            </div>

            <div className="stat-list">
              <div className="stat-row">
                <div className="stat-label">Know</div>
                <div className="stat-bar" aria-hidden>
                  <div className="stat-bar-fill" style={{ width: `${pctKnown}%`, background: '#17a34a' }} />
                </div>
                <div className="stat-count">{correct}</div>
              </div>

              <div className="stat-row">
                <div className="stat-label">Still learning</div>
                <div className="stat-bar" aria-hidden>
                  <div className="stat-bar-fill" style={{ width: `${pctIncorrect}%`, background: '#e24b4b' }} />
                </div>
                <div className="stat-count">{incorrect}</div>
              </div>

              {/* Terms left removed per user request */}
            </div>
          </div>

          <div className="results-right">
            <div style={{ textAlign: 'left' }}>
              <h3 className="section-title">Next steps</h3>
              <div className="section-sub">Choose how to continue</div>
            </div>

            <div className="results-card">
              <div className="results-cta">
                <button className="btn-secondary" onClick={focusStillLearning} disabled={incorrect === 0} aria-disabled={incorrect === 0}>{`Focus on ${incorrect} Still learning cards`}</button>
                {originalCards && (
                  <button className="btn-secondary" onClick={restoreFullDeck} style={{ marginTop: 8 }}>Back to full deck</button>
                )}
                <div style={{ textAlign: 'center', marginTop: 6 }}>
                  <button className="btn-secondary" onClick={() => navigate('/dashboard')}>Back to dashboard</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const card = cards[index]

  return (
    <div className="player-container" ref={containerRef}>
      <div className="player-header" style={{ alignItems: 'flex-start' }}>
        <div style={{ width: '50%', textAlign: 'left' }}>
          <button className="back-btn" onClick={() => navigate('/dashboard')} tabIndex={-1} aria-label="Back to dashboard">← Back</button>
        </div>
        <div style={{ width: '50%', textAlign: 'right' }}>
          <div className="progress">{index + 1} / {cards.length}</div>
        </div>
      </div>

      

      <div
        className={`player-card ${revealed ? 'revealed' : ''}`}
        onClick={() => setRevealed((r) => !r)}
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ' || e.code === 'Space') { e.preventDefault(); setRevealed((r) => !r) } }}
      >
        <div className="card-inner">
          <div className="card-face card-front">
            {card.frontImage && <img src={card.frontImage} alt="front" className="player-img" />}
            <div className="player-front">{card.front}</div>
          </div>

          <div className="card-face card-back" aria-hidden={!revealed}>
            {card.backImage && <img src={card.backImage} alt="back" className="player-img" />}
            <div className="player-back-text">{card.back}</div>
          </div>
        </div>
      </div>

      <div className="player-actions" style={{ display: 'flex', gap: 18, marginTop: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <button className="action-btn action-btn--no" onClick={markNotRemember} tabIndex={-1} aria-label="Not remember">
            {/* X icon */}
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div style={{ marginTop: 6, fontSize: 13 }}>Not remember</div>
        </div>

        <div style={{ width: 12 }} />

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <button className="action-btn action-btn--yes" onClick={markKnown} tabIndex={-1} aria-label="Know">
            {/* Check icon */}
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div style={{ marginTop: 6, fontSize: 13 }}>Know</div>
        </div>
      </div>

      <p className="player-hint">Tab card to reveal Use the buttons above to mark Know / Not remember.</p>
    </div>
  )
}
