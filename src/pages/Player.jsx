import React, { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const STORAGE_BUCKET = 'flascard_image'

export default function Player() {
  const { id } = useParams()
  const { user } = useAuth()
  const [cards, setCards] = useState([])
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [loading, setLoading] = useState(true)
  const containerRef = useRef()

  useEffect(() => {
    if (!id) return
    load()
    // keyboard handlers
    const onKey = (e) => {
      if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); setRevealed((r) => !r) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('flashcards').select('*').eq('deck_id', id)
    const items = (data || []).map((it) => ({ ...it }))
    // create signed urls for images if present
    await Promise.all(items.map(async (card) => {
      try {
        if (card.front_image_url) {
          const { data: urlData, error: sErr } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(card.front_image_url, 60 * 60)
          if (!sErr && urlData?.signedUrl) card.frontImage = urlData.signedUrl
        }
        if (card.back_image_url) {
          const { data: urlData, error: sErr } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(card.back_image_url, 60 * 60)
          if (!sErr && urlData?.signedUrl) card.backImage = urlData.signedUrl
        }
      } catch (e) {
        console.error('signed url', e)
      }
    }))
    setCards(items)
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
    setIndex((i) => Math.min(cards.length - 1, i + 1))
  }

  if (loading) return <div style={{ padding: 20 }}>Loading...</div>
  if (!cards.length) return <div style={{ padding: 20 }}>No cards</div>

  const card = cards[index]

  return (
    <div className="player-container" ref={containerRef}>
      <div className="player-header">
        <h2>{card.deck_title || 'Flashcards'}</h2>
        <div className="progress">{index + 1} / {cards.length}</div>
      </div>

      <div className={`player-card ${revealed ? 'revealed' : ''}`} onClick={() => setRevealed((r) => !r)}>
        {card.frontImage && <img src={card.frontImage} alt="front" className="player-img" />}
        <div className="player-front">{card.front}</div>

        <div className="player-back" aria-hidden={!revealed}>
          {card.backImage && <img src={card.backImage} alt="back" className="player-img" />}
          <div className="player-back-text">{card.back}</div>
        </div>
      </div>

      <div className="player-controls">
        <button onClick={prev} disabled={index === 0}>Prev</button>
        <button onClick={() => setRevealed((r) => !r)}>{revealed ? 'Hide' : 'Reveal'}</button>
        <button onClick={next} disabled={index === cards.length - 1}>Next</button>
      </div>

      <p className="player-hint">Tip: Click card or press Space to reveal, ← → to navigate</p>
    </div>
  )
}
