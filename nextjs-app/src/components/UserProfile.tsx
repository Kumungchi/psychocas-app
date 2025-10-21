'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

export default function UserProfile() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Získat aktuálního uživatele
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
      setLoading(false)
    }

    getUser()

    // Poslouchat změny v autentifikaci
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  if (loading) {
    return (
      <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-md">
        <div className="animate-pulse flex space-x-4">
          <div className="rounded-full bg-gray-300 h-12 w-12"></div>
          <div className="flex-1 space-y-2 py-1">
            <div className="h-4 bg-gray-300 rounded w-3/4"></div>
            <div className="h-4 bg-gray-300 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="card max-w-md mx-auto mt-8 border-success-200 animate-fade-in">
      <div className="flex items-center space-x-4 mb-6">
        <div className="w-14 h-14 bg-gradient-to-br from-success-400 to-success-600 rounded-full flex items-center justify-center shadow-lg">
          <span className="text-white font-bold text-xl">
            {user.email?.[0].toUpperCase()}
          </span>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            ✅ Přihlášený uživatel
          </h3>
          <p className="text-gray-600 text-sm font-medium">{user.email}</p>
        </div>
      </div>
      
      <div className="space-y-2 text-sm text-gray-600 mb-4">
        <p><strong>ID:</strong> {user.id}</p>
        <p><strong>Vytvořeno:</strong> {new Date(user.created_at || '').toLocaleDateString('cs-CZ')}</p>
        <p><strong>Poslední přihlášení:</strong> {new Date(user.last_sign_in_at || '').toLocaleDateString('cs-CZ')}</p>
      </div>
      
      <button
        onClick={handleSignOut}
        className="w-full bg-danger-500 text-white py-2.5 px-4 rounded-md hover:bg-danger-600 transition-all duration-200 font-medium flex items-center justify-center space-x-2"
      >
        <span>🚪</span>
        <span>Odhlásit se</span>
      </button>
    </div>
  )
}