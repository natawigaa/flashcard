import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'


export default function Debug() {
  const [session, setSession] = useState(null)
  const [url, setUrl] = useState('')
  const [err, setErr] = useState(null)

  useEffect(() => {
    setUrl(import.meta.env.VITE_SUPABASE_URL || '(no VITE_SUPABASE_URL)')
  }, [])

  async function fetchSession() {
    try {
      const { data } = await supabase.auth.getSession()
      setSession(data?.session ?? null)
      setErr(null)
    } catch (e) {
      setErr(String(e))
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Debug</h2>
      <p><strong>Supabase URL:</strong> {url}</p>
      <p>
        <button onClick={fetchSession}>Get current session</button>
      </p>
      {err && <pre style={{ color: 'red' }}>{err}</pre>}
      <h3>Session</h3>
      <pre style={{ maxHeight: 300, overflow: 'auto', background: '#111', color: '#efe', padding: 8 }}>
        {JSON.stringify(session, null, 2)}
      </pre>
      <p>Note: This page only shows the Supabase URL and session (no keys).</p>
    </div>
  )
}
