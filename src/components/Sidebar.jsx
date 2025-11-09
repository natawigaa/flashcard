import React from 'react'
import { NavLink } from 'react-router-dom'

export default function Sidebar() {
  const links = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/deck/new', label: 'Create Deck' },
    { to: '/history', label: 'History' },
    { to: '/profile', label: 'Profile' },
    { to: '/settings', label: 'Settings' },
  ]

  return (
    <aside className="sidebar">
      <nav>
        <ul>
          {links.map((l) => (
            <li key={l.to}>
              <NavLink to={l.to} className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                {l.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}
