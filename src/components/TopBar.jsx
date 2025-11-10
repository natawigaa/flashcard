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
        <div className="topbar-left">
          <Link to="/" className="brand" aria-label="Flash Learn home">
            {/* simple flash / lightning mark */}
            <svg className="brand-mark" viewBox="0 0 24 24" width="40" height="40" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <defs>
                <linearGradient id="g1" x1="0%" x2="100%" y1="0%" y2="0%">
                  <stop offset="0%" stopColor="#4aa3ff" />
                  <stop offset="100%" stopColor="#1e90ff" />
                </linearGradient>
              </defs>
              <path d="M13.5 2L6 13h5l-1 9L18 11h-5l.5-9z" fill="url(#g1)" />
            </svg>
            <span className="brand-text">Flash Learn</span>
          </Link>
          {user ? <div className="greeting">— Hello, {displayName}</div> : null}
        </div>
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
