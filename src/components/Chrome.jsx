import React from 'react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import { useAuth } from '../context/AuthContext'

export default function Chrome({ children }) {
  const { user, signOut } = useAuth()

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main">
        <TopBar user={user} onSearch={() => {}} signOut={signOut} />
        <section style={{ padding: 20 }}>
          {children}
        </section>
      </main>
    </div>
  )
}
