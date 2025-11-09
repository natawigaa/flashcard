import React, { createContext, useState, useEffect, useContext } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function getSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!mounted) return
      setUser(session?.user ?? null)
      // ensure profile exists for signed-in user
      if (session?.user) await ensureProfile(session.user)
      setLoading(false)
    }

    getSession()

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      // when auth changes and we have a user, ensure there's a profile row
      if (session?.user) ensureProfile(session.user).catch((e) => console.error('ensureProfile', e))
      setLoading(false)
    })

    return () => {
      mounted = false
      listener?.subscription?.unsubscribe?.()
    }
  }, [])

  // upsert a profiles row so FK constraints on decks.owner (profiles.id) succeed
  async function ensureProfile(user) {
    if (!user?.id) return
    try {
      const username = user.email ? user.email.split('@')[0] : null
      const payload = { id: user.id, username, full_name: user.user_metadata?.full_name ?? null }
      // use upsert so we don't overwrite existing metadata accidentally
      const { error } = await supabase.from('profiles').upsert(payload, { returning: 'minimal' })
      if (error) console.error('profiles upsert error', error)
    } catch (e) {
      console.error('ensureProfile error', e)
    }
  }

  const signUp = async (email, password) => {
    const res = await supabase.auth.signUp({ email, password })
    // if immediate session/user returned, ensure profile
    try {
      // only ensure profile when there is an active session (user is fully signed in)
      const sessionUser = res.data?.session?.user
      if (sessionUser) await ensureProfile(sessionUser)
    } catch (e) {
      console.error('ensureProfile after signUp', e)
    }
    return res
  }

  const signIn = async (email, password) => {
    const res = await supabase.auth.signInWithPassword({ email, password })
    try {
      const sessionUser = res.data?.session?.user
      if (sessionUser) await ensureProfile(sessionUser)
    } catch (e) {
      console.error('ensureProfile after signIn', e)
    }
    return res
  }

  const signOut = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
