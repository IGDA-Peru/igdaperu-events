import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { getMemberships, getProfile } from '../lib/data'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { AuthContext } from './auth-context'
import type { Session } from '@supabase/supabase-js'
import type { Membership, Profile } from '../types'
import type { AuthContextValue } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [loading, setLoading] = useState(isSupabaseConfigured)

  const loadUserData = async (nextSession: Session | null) => {
    if (!nextSession) {
      setProfile(null)
      setMemberships([])
      return
    }
    const [nextProfile, nextMemberships] = await Promise.all([
      getProfile(nextSession.user.id),
      getMemberships(nextSession.user.id),
    ])
    setProfile(nextProfile)
    setMemberships(nextMemberships)
  }

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    let mounted = true
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      setSession(data.session)
      try {
        await loadUserData(data.session)
      } finally {
        if (mounted) setLoading(false)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      void loadUserData(nextSession)
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    configured: isSupabaseConfigured,
    loading,
    session,
    user: session?.user || null,
    profile,
    memberships,
    roles: memberships.map((membership) => membership.role),
    signOut: async () => { if (supabase) await supabase.auth.signOut() },
    refreshUserData: async () => { await loadUserData(session) },
  }), [loading, session, profile, memberships])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
