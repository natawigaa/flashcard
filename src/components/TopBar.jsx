import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function TopBar({ user, onSearch, signOut }) {
  const { profile } = useAuth()
  const displayName = profile?.username || user?.email || 'Not signed in'
  const [value, setValue] = useState('')
  const timerRef = useRef(null)
  const DEBOUNCE_MS = 300

  useEffect(() => {
    // debounce calling onSearch
    if (!onSearch) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      onSearch(value)
    }, DEBOUNCE_MS)
    return () => clearTimeout(timerRef.current)
  }, [value, onSearch])

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="topbar-left">{user ? `Hello, ${displayName}` : 'Not signed in'}</div>
        <div className="topbar-center">
          <input
            className="search-box"
            placeholder="Search flashcards..."
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <div className="topbar-right">
          {user ? (
            <>
              <Link to="/profile">Profile</Link>
              <span style={{ margin: '0 8px' }} />
              <Link to="/settings">Settings</Link>
              <span style={{ margin: '0 8px' }} />
              <button onClick={() => signOut?.()} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', padding: '6px 10px', borderRadius: 8, color: 'inherit', cursor: 'pointer' }}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/login">Sign in</Link>
              <span style={{ margin: '0 8px' }} />
              <Link to="/register">Register</Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
