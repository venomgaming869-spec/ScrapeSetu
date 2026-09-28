import { createContext, useContext, useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

const AuthContext = createContext(null)

async function readProfile(userId) {
  if (!supabase || !userId) return null
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (!data) return null
  const roleTable = data.role === 'collector' ? 'collector_profiles' : data.role === 'recycler' ? 'recycler_profiles' : null
  if (!roleTable) return data
  const { data: roleProfile } = await supabase.from(roleTable).select('*').eq('id', userId).maybeSingle()
  return { ...data, role_profile: roleProfile }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return undefined
    }
    let active = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      setProfile(await readProfile(data.session?.user?.id))
      if (active) setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (!nextSession) {
        setProfile(null)
        setLoading(false)
      } else {
        window.setTimeout(async () => {
          const nextProfile = await readProfile(nextSession.user.id)
          setProfile(nextProfile)
          setLoading(false)
        }, 0)
      }
    })
    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  async function signIn(identifier, password) {
    const value = identifier.trim()
    const credentials = value.includes('@')
      ? { email: value, password }
      : { phone: value.replace(/(?!^\+)[^\d]/g, ''), password }
    const { data, error } = await supabase.auth.signInWithPassword(credentials)
    if (error) throw error
    return data.user?.id
  }

  async function signUp({ name, identifier, password, role, phone, serviceLocation, businessName, location, serviceArea }) {
    const value = identifier.trim()
    const options = {
      data: { name, role, phone, service_location: serviceLocation, business_name: businessName, location, service_area: serviceArea },
    }
    const credentials = value.includes('@')
      ? { email: value, password, options }
      : { phone: value.replace(/(?!^\+)[^\d]/g, ''), password, options }
    const { data, error } = await supabase.auth.signUp(credentials)
    if (error) throw error
    return data
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, signIn, signUp, signOut, configured: isSupabaseConfigured }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}