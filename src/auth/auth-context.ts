import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import type { Membership, Profile, Role } from '../types'

export type AuthContextValue = {
  configured: boolean
  loading: boolean
  session: Session | null
  user: User | null
  profile: Profile | null
  memberships: Membership[]
  roles: Role[]
  signOut: () => Promise<void>
  refreshUserData: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
