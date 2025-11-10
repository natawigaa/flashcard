import express from 'express'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import helmet from 'helmet'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import { body, validationResult } from 'express-validator'
import multer from 'multer'
import sharp from 'sharp'

dotenv.config()

const PORT = process.env.PORT || 54321
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment; server cannot start')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const app = express()
app.use(express.json())

// security + logging + CORS
app.use(helmet())
app.use(morgan('dev'))

// Simple request logger for dev — prints method and URL
app.use((req, res, next) => {
  console.log(`[server] ${req.method} ${req.url}`)
  next()
})

// Simple CORS for local dev (adjust in production)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

// Rate limiters
const searchLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false })
const exportLimiter = rateLimit({ windowMs: 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false })

// multer for file upload handling (memory storage)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

app.get('/api/health', (req, res) => res.json({ ok: true }))

// Server-side search endpoint for decks using Supabase service role key.
// Query param: q (string). Returns up to 50 matching decks (title/description).
// IMPORTANT: keep SUPABASE_SERVICE_ROLE_KEY secret — only run this on a trusted server.
app.get('/api/search', searchLimiter, async (req, res) => {
  try {
    // Require Authorization: Bearer <access_token>
    const authHeader = req.headers.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null
    if (!token) return res.status(401).json({ error: 'Missing access token' })

    // Validate the access token and fetch the user. This ensures only authenticated
    // users can call this endpoint. We use the service role key to call getUser.
    const { data: userData, error: userErr } = await supabase.auth.getUser(token)
    if (userErr || !userData?.user) {
      console.error('Auth validation failed', userErr)
      return res.status(401).json({ error: 'Invalid access token' })
    }

    const q = (req.query.q || '').trim()
    if (!q) return res.json({ data: [], count: 0 })

    // Use ilike on title OR description. Limit to 50 results by default.
    const filter = `title.ilike.%${q}%,description.ilike.%${q}%`
    const { data, error, count } = await supabase
      .from('decks')
      .select('id,title,description,owner', { count: 'estimated' })
      .or(filter)
      .limit(50)

    if (error) {
      console.error('Supabase search error', error)
      return res.status(500).json({ error: error.message || error })
    }

    return res.json({ data, count })
  } catch (e) {
    console.error('Search handler error', e)
    return res.status(500).json({ error: e.message || 'unknown' })
  }
})

// POST /api/export - owner or admin can export a deck as CSV or JSON
app.post('/api/export', exportLimiter,
  body('deck_id').isUUID().withMessage('deck_id must be a uuid'),
  body('format').optional().isIn(['csv','json']).withMessage('format must be csv or json'),
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

      const { deck_id, format = 'csv' } = req.body

      const authHeader = req.headers.authorization || ''
      const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null
      if (!token) return res.status(401).json({ error: 'Missing access token' })

      const { data: userData, error: userErr } = await supabase.auth.getUser(token)
      if (userErr || !userData?.user) return res.status(401).json({ error: 'Invalid access token' })
      const userId = userData.user.id

      // load profile to check is_admin
      const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', userId).single()

      // get deck and verify ownership or admin
      const { data: deck, error: deckErr } = await supabase.from('decks').select('id,title,owner').eq('id', deck_id).single()
      if (deckErr || !deck) {
        console.error('deck load error', deckErr)
        return res.status(404).json({ error: 'Deck not found' })
      }
      const isOwner = deck.owner === userId
      const isAdmin = profile?.is_admin === true
      if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Forbidden' })

      // fetch flashcards. Try to include `notes` if the column exists; if the DB
      // doesn't have that column we'll catch the error and retry without it.
      let includeNotes = false
      let cards
      try {
        const trySelect = 'front,back,front_image_url,back_image_url,notes'
        const { data, error } = await supabase.from('flashcards').select(trySelect).eq('deck_id', deck_id)
        if (error) throw error
        cards = data
        includeNotes = true
      } catch (err) {
        // If the error is about missing column `notes`, fall back to selecting
        // the known columns. Otherwise propagate the error.
        const msg = String(err?.message || err)
        if (msg.includes('notes') || msg.includes('column') && msg.includes('does not exist')) {
          console.warn('notes column not present, falling back to core columns')
          const { data, error } = await supabase.from('flashcards').select('front,back,front_image_url,back_image_url').eq('deck_id', deck_id)
          if (error) {
            console.error('cards load error (fallback)', error)
            return res.status(500).json({ error: error.message || 'Failed to load cards' })
          }
          cards = data
          includeNotes = false
        } else {
          console.error('cards load error', err)
          return res.status(500).json({ error: err.message || 'Failed to load cards' })
        }
      }

      if (format === 'json') {
        return res.json({ rows: cards })
      }

      // stream CSV
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      const filename = `${(deck.title || 'deck').replace(/[^a-z0-9_-]/ig, '_')}-${Date.now()}.csv`
      const filenameEncoded = encodeURIComponent(filename)
      // include filename* for UTF-8 aware clients (good for non-ascii filenames)
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${filenameEncoded}`)
      // Prepend UTF-8 BOM so Excel on Windows detects UTF-8 and displays Thai correctly
      const BOM = '\uFEFF'

      // write header (include notes column only if present)
      const headers = ['front', 'back', 'front_image_url', 'back_image_url']
      if (includeNotes) headers.push('notes')
      res.write(BOM + headers.join(',') + '\n')

      for (const r of cards) {
        const escape = (s) => {
          if (s === null || s === undefined) return ''
          const str = String(s).replace(/"/g, '""')
          if (/[",\n]/.test(str)) return `"${str}"`
          return str
        }
        const parts = [escape(r.front), escape(r.back), escape(r.front_image_url), escape(r.back_image_url)]
        if (includeNotes) parts.push(escape(r.notes))
        const line = parts.join(',') + '\n'
        if (!res.write(line)) await new Promise((r) => res.once('drain', r))
      }
      res.end()
    } catch (e) {
      console.error('export error', e)
      return res.status(500).json({ error: e.message || 'unknown' })
    }
  }
)


// POST /api/images/resize - accept multipart file 'image' and return signed url for jpg
app.post('/api/images/resize', upload.single('image'), async (req, res) => {
  try {
    const authHeader = req.headers.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null
    if (!token) return res.status(401).json({ error: 'Missing access token' })
    const { data: userData, error: userErr } = await supabase.auth.getUser(token)
    if (userErr || !userData?.user) return res.status(401).json({ error: 'Invalid access token' })
    const userId = userData.user.id

    if (!req.file || !req.file.buffer) return res.status(400).json({ error: 'No file uploaded' })

    // process image to jpg (resize to max width 1200)
    const buffer = await sharp(req.file.buffer).resize({ width: 1200, withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer()

    const bucket = process.env.STORAGE_BUCKET || 'flashcard_image'
    const objectPath = `flashcards/${userId}/${Date.now()}.jpg`
    const { data: uploadData, error: uploadErr } = await supabase.storage.from(bucket).upload(objectPath, buffer, { contentType: 'image/jpeg', upsert: false })
    if (uploadErr) {
      console.error('upload error', uploadErr)
      return res.status(500).json({ error: 'Failed to upload image' })
    }

    // create signed URL valid for 1 hour
    const { data: urlData, error: urlErr } = await supabase.storage.from(bucket).createSignedUrl(objectPath, 60 * 60)
    if (urlErr) {
      console.error('signed url error', urlErr)
      return res.status(500).json({ error: 'Failed to create signed url' })
    }

    return res.json({ path: objectPath, url: urlData?.signedUrl || urlData?.signedURL })
  } catch (e) {
    console.error('image resize error', e)
    return res.status(500).json({ error: e.message || 'unknown' })
  }
})

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`)
})
