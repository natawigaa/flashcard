import React, { createContext, useState, useEffect, useContext } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function getSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!mounted) return
      setUser(session?.user ?? null)
      // load profile when session exists
      if (session?.user) {
        try { await loadProfile(session.user.id) } catch (e) { console.error('loadProfile', e) }
      } else {
        setProfile(null)
      }
      // ensure profile exists for signed-in user
      if (session?.user) await ensureProfile(session.user)
      setLoading(false)
    }

    getSession()

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      // when auth changes and we have a user, ensure there's a profile row and load profile
      if (session?.user) {
        ensureProfile(session.user).catch((e) => console.error('ensureProfile', e))
        loadProfile(session.user.id).catch((e) => console.error('loadProfile', e))
      } else {
        setProfile(null)
      }
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

  async function loadProfile(userId) {
    if (!userId) return null
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
      if (error) {
        console.error('loadProfile error', error)
        return null
      }
      setProfile(data)
      return data
    } catch (e) {
      console.error('loadProfile', e)
      return null
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
    <AuthContext.Provider value={{ user, profile, loading, signUp, signIn, signOut, refreshProfile: () => loadProfile(user?.id) }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
