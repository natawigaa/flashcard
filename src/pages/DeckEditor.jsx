import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Chrome from '../components/Chrome'

export default function DeckEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [deck, setDeck] = useState(null)
  const [cards, setCards] = useState([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [numToAdd, setNumToAdd] = useState(1)
  const [loading, setLoading] = useState(false)
  const STORAGE_BUCKET = 'flascard_image'

  useEffect(() => {
    if (!user) return
    if (id && id !== 'new') loadDeck()
  }, [user, id])

  async function loadDeck() {
    setLoading(true)
    const { data: d, error: de } = await supabase.from('decks').select('*').eq('id', id).single()
    if (de) console.error(de)
    setDeck(d)
    setTitle(d?.title || '')
    setDescription(d?.description || '')
    const { data: c, error: ce } = await supabase.from('flashcards').select('*').eq('deck_id', id)
    if (ce) console.error(ce)
    const items = (c || []).map((it) => ({ ...it }))
    // if images are stored as private paths, create signed URLs for previews
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
        console.error('signed url error', e)
      }
    }))
    setCards(items)
    setLoading(false)
  }

  function addEmptyCard() {
    setCards((s) => [...s, { id: null, front: '', back: '', _localId: Date.now() + Math.random() }])
  }

  function addMultipleCards(n) {
    const count = Math.max(1, Math.floor(Number(n) || 0))
    setCards((s) => {
      const copy = [...s]
      for (let i = 0; i < count; i++) {
        copy.push({ id: null, front: '', back: '', _localId: Date.now() + Math.random() + i })
      }
      return copy
    })
  }

  // handle image per side: 'front' or 'back' — store both preview (data URL) and the File object for upload
  function handleImageChange(idx, side, file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result
      const imageField = side === 'front' ? 'frontImage' : 'backImage'
      const fileField = side === 'front' ? 'frontFile' : 'backFile'
      updateCard(idx, imageField, dataUrl)
      updateCard(idx, fileField, file)
    }
    reader.readAsDataURL(file)
  }

  function updateCard(idx, field, value) {
    setCards((s) => {
      const copy = [...s]
      copy[idx] = { ...copy[idx], [field]: value }
      return copy
    })
  }

  async function removeImage(idx, side) {
    const imageField = side === 'front' ? 'frontImage' : 'backImage'
    const fileField = side === 'front' ? 'frontFile' : 'backFile'
    const dbField = side === 'front' ? 'front_image_url' : 'back_image_url'
    const card = cards[idx]
    // if card is already persisted and has a stored path, remove from storage and update DB
    if (card?.id && card[dbField]) {
      try {
        await supabase.storage.from(STORAGE_BUCKET).remove([card[dbField]])
      } catch (e) {
        console.error('Failed to remove file from storage on removeImage', e)
      }
      try {
        await supabase.from('flashcards').update({ [dbField]: null }).eq('id', card.id)
      } catch (e) {
        console.error('Failed to clear DB image path on removeImage', e)
      }
    }
    // clear preview and file in local state
    updateCard(idx, imageField, null)
    updateCard(idx, fileField, null)
    updateCard(idx, dbField, null)
  }

  function removeCardAt(idx) {
    setCards((s) => {
      const copy = [...s]
      copy.splice(idx, 1)
      return copy
    })
  }

  async function save() {
    // basic validation
    if (!title || !title.toString().trim()) {
      alert('Please enter a title for the deck')
      return
    }
    const completeCards = cards.filter((c) => c.front && c.back)
    if (completeCards.length === 0) {
      const ok = confirm('There are no completed cards (front + back). Create an empty deck?')
      if (!ok) return
    }

    setLoading(true)
    try {
      // ensure user is available
      if (!user || !user.id) {
        setLoading(false)
        alert('You must be signed in to create or edit decks')
        return
      }
      // helper: remove file by storage path (we store private object path in DB)
      async function removeFileByPath(bucket, path) {
        if (!path) return
        try {
          const { error } = await supabase.storage.from(bucket).remove([path])
          if (error) console.error('Failed to remove old file', error)
        } catch (e) {
          console.error('Error removing file', e)
        }
      }

      if (id === 'new') {
        // create deck first
        const { data: newDeck, error: deckErr } = await supabase
          .from('decks')
          .insert({ title, description, owner: user.id })
          .select()
          .single()
        if (deckErr) throw deckErr
        if (!newDeck || !newDeck.id) throw new Error('Deck creation did not return an id')

        // prepare inserts, uploading images when present
        const inserts = []
        for (const c of cards) {
          if (!(c.front && c.back)) continue
          let front_image_url = null
          let back_image_url = null
          // upload front file if present
          if (c.frontFile) {
            try {
              const filename = `uploads/${user.id}/${newDeck.id}/${Date.now()}-${Math.random().toString(36).slice(2)}-front` + (c.frontFile.name ? `-${c.frontFile.name}` : '')
              const { error: upErr } = await supabase.storage.from(STORAGE_BUCKET).upload(filename, c.frontFile)
              if (upErr) throw upErr
              // store private path
              front_image_url = filename
            } catch (e) {
              console.error('Front upload failed', e)
            }
          }
          if (c.backFile) {
            try {
              const filename = `uploads/${user.id}/${newDeck.id}/${Date.now()}-${Math.random().toString(36).slice(2)}-back` + (c.backFile.name ? `-${c.backFile.name}` : '')
              const { error: upErr } = await supabase.storage.from(STORAGE_BUCKET).upload(filename, c.backFile)
              if (upErr) throw upErr
              back_image_url = filename
            } catch (e) {
              console.error('Back upload failed', e)
            }
          }

          inserts.push({ deck_id: newDeck.id, front: c.front, back: c.back, front_image_url, back_image_url })
        }

        if (inserts.length > 0) {
          const { error: insertErr } = await supabase.from('flashcards').insert(inserts)
          if (insertErr) throw insertErr
        }

        navigate(`/deck/${newDeck.id}`)
      } else {
        // update deck title
        const { error: upErr } = await supabase.from('decks').update({ title, description }).eq('id', id)
        if (upErr) throw upErr

        // existing cards: handle inserts with images and updates including image uploads
        // Insert new cards
        const toInsert = []
        for (const c of cards.filter((c) => !c.id && c.front && c.back)) {
          let front_image_url = null
          let back_image_url = null
          if (c.frontFile) {
            try {
              const filename = `uploads/${user.id}/${id}/${Date.now()}-${Math.random().toString(36).slice(2)}-front` + (c.frontFile.name ? `-${c.frontFile.name}` : '')
              const { error: upErr } = await supabase.storage.from(STORAGE_BUCKET).upload(filename, c.frontFile)
              if (upErr) throw upErr
              front_image_url = filename
            } catch (e) { console.error(e) }
          }
          if (c.backFile) {
            try {
              const filename = `uploads/${user.id}/${id}/${Date.now()}-${Math.random().toString(36).slice(2)}-back` + (c.backFile.name ? `-${c.backFile.name}` : '')
              const { error: upErr } = await supabase.storage.from(STORAGE_BUCKET).upload(filename, c.backFile)
              if (upErr) throw upErr
              back_image_url = filename
            } catch (e) { console.error(e) }
          }
          toInsert.push({ deck_id: id, front: c.front, back: c.back, front_image_url, back_image_url })
        }

        if (toInsert.length > 0) {
          const { error: insErr } = await supabase.from('flashcards').insert(toInsert)
          if (insErr) throw insErr
        }

        // Update existing cards (text and optionally image)
        for (const c of cards.filter((c) => c.id)) {
          const updates = { front: c.front, back: c.back }
          // if a new file is present, upload and set the url
          if (c.frontFile) {
            try {
              const filename = `uploads/${user.id}/${id}/${Date.now()}-${Math.random().toString(36).slice(2)}-front` + (c.frontFile.name ? `-${c.frontFile.name}` : '')
              const { error: upErr } = await supabase.storage.from(STORAGE_BUCKET).upload(filename, c.frontFile)
              if (upErr) throw upErr
              // store the object's path in DB (private bucket)
              updates.front_image_url = filename
              // remove old file after successful upload
              if (c.front_image_url) {
                try { await removeFileByPath(STORAGE_BUCKET, c.front_image_url) } catch (e) { console.error('Failed to remove previous front image', e) }
              }
            } catch (e) { console.error(e) }
          }
          if (c.backFile) {
            try {
              const filename = `uploads/${user.id}/${id}/${Date.now()}-${Math.random().toString(36).slice(2)}-back` + (c.backFile.name ? `-${c.backFile.name}` : '')
              const { error: upErr } = await supabase.storage.from(STORAGE_BUCKET).upload(filename, c.backFile)
              if (upErr) throw upErr
              // store object path
              updates.back_image_url = filename
              // remove old file after successful upload
              if (c.back_image_url) {
                try { await removeFileByPath(STORAGE_BUCKET, c.back_image_url) } catch (e) { console.error('Failed to remove previous back image', e) }
              }
            } catch (e) { console.error(e) }
          }

          // perform update if there are changes to persist
          try {
            const { error: updateErr } = await supabase.from('flashcards').update(updates).eq('id', c.id)
            if (updateErr) console.error(updateErr)
          } catch (e) { console.error(e) }
        }

        // reload
        await loadDeck()
      }
    } catch (e) {
      console.error(e)
      alert('Save failed: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  async function deleteCard(cardId, idx) {
    if (!cardId) {
      removeCardAt(idx)
      return
    }
    if (!confirm('Delete this card?')) return
    const { error } = await supabase.from('flashcards').delete().eq('id', cardId)
    if (error) {
      console.error(error)
      alert('Delete failed')
      return
    }
    removeCardAt(idx)
  }

  if (loading) return <div style={{ padding: 20 }}>Loading...</div>

  return (
    <Chrome>
      <div className="deck-editor" style={{ padding: 20 }}>
      <h2>{id === 'new' ? 'Create New Deck' : 'Edit Deck'}</h2>

      <div className="field">
        <label>Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="field">
        <label>Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ width: '100%', maxWidth: 900, padding: 12, borderRadius: 12 }} />
      </div>

      <h3 style={{ marginTop: 20 }}>Cards</h3>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <label style={{ marginRight: 6 }}>Number</label>
        <input type="number" min={1} value={numToAdd} onChange={(e) => setNumToAdd(e.target.value)} style={{ width: 100, padding: 8, borderRadius: 10 }} />
        <button onClick={() => addMultipleCards(numToAdd)}>Add Cards</button>
        <button onClick={addEmptyCard} style={{ marginLeft: 6 }}>Add One</button>
      </div>

      <div className="cards-list">
        {cards.map((c, idx) => (
          <div className="card-box" key={c.id || c._localId}>
            <div className="card-content">
              <div className="card-row-top">
                <div className="card-main">
                  <label className="card-label">Keyword</label>
                  <input
                    className="card-input card-input--large"
                    placeholder="Keyword"
                    value={c.front}
                    onChange={(e) => updateCard(idx, 'front', e.target.value)}
                  />
                </div>

                <div className="card-image-area">
                  <input id={`file-input-${idx}-front`} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { if (e.target.files && e.target.files[0]) handleImageChange(idx, 'front', e.target.files[0]); e.target.value = '' }} />
                  {c.frontImage ? (
                    <div className="img-wrap">
                      <img src={c.frontImage} alt="front" className="card-thumb" />
                      <button type="button" className="img-remove-btn" onClick={() => removeImage(idx, 'front')} aria-label="Remove image">✕</button>
                    </div>
                  ) : (
                    <button type="button" className="icon-btn icon-btn--minimal" onClick={() => document.getElementById(`file-input-${idx}-front`).click()} aria-label="Add image">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                        <path d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M21 19H3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M8.5 11.5l2.5 3L14.5 9l4.5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              <div className="card-row-bottom">
                <div className="card-main">
                  <label className="card-label">Definition</label>
                  <input
                    className="card-input card-input--large"
                    placeholder="Definition"
                    value={c.back}
                    onChange={(e) => updateCard(idx, 'back', e.target.value)}
                  />
                </div>

                <div className="card-image-area">
                  <input id={`file-input-${idx}-back`} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { if (e.target.files && e.target.files[0]) handleImageChange(idx, 'back', e.target.files[0]); e.target.value = '' }} />
                  {c.backImage ? (
                    <div className="img-wrap">
                      <img src={c.backImage} alt="back" className="card-thumb" />
                      <button type="button" className="img-remove-btn" onClick={() => removeImage(idx, 'back')} aria-label="Remove image">✕</button>
                    </div>
                  ) : (
                    <button type="button" className="icon-btn icon-btn--minimal" onClick={() => document.getElementById(`file-input-${idx}-back`).click()} aria-label="Add image">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                        <path d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M21 19H3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M8.5 11.5l2.5 3L14.5 9l4.5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="card-side-actions">
              <button className="small-btn" onClick={() => deleteCard(c.id, idx)}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12 }}>
        <button onClick={save} disabled={loading}>{id === 'new' ? 'Create set' : 'Save Deck'}</button>
      </div>
    </div>
    </Chrome>
  )
}
