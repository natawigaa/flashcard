import React from 'react'
import { Link } from 'react-router-dom'

export default function TopBar({ user, onSearch, signOut }) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="topbar-left">{user ? `Hello, ${user.email}` : 'Not signed in'}</div>
        <div className="topbar-center">
          <input
            className="search-box"
            placeholder="Search flashcards..."
            onChange={(e) => onSearch?.(e.target.value)}
          />
        </div>
        <div className="topbar-right">
          {user ? (
            <>
              <Link to="/profile">Profile</Link>
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
