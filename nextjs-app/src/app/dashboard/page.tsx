'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user ?? null

      if (!user) {
        router.push('/')
        return
      }

      setUser(user)
      setLoading(false)
    }

    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          router.push('/')
        } else {
          setUser(session.user)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [router])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        <header className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
              <p className="text-gray-600 mt-1">Vítejte, {user.email}!</p>
            </div>
            <button
              onClick={handleSignOut}
              className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition-colors"
            >
              Odhlásit se
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Statistiky */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">
              Uživatelský profil
            </h3>
            <div className="space-y-2 text-sm">
              <p><strong>Email:</strong> {user.email}</p>
              <p><strong>ID:</strong> {user.id.slice(0, 8)}...</p>
              <p><strong>Registrován:</strong> {new Date(user.created_at || '').toLocaleDateString('cs-CZ')}</p>
            </div>
          </div>

          {/* Rychlé akce */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">
              Rychlé akce
            </h3>
            <div className="space-y-2">
              <button className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 transition-colors text-sm">
                Vytvořit nový projekt
              </button>
              <button className="w-full bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600 transition-colors text-sm">
                Zobrazit nastavení
              </button>
              <button className="w-full bg-purple-500 text-white py-2 px-4 rounded-md hover:bg-purple-600 transition-colors text-sm">
                Exportovat data
              </button>
            </div>
          </div>

          {/* Nedávná aktivita */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">
              Nedávná aktivita
            </h3>
            <div className="space-y-2 text-sm text-gray-600">
              <p>• Přihlášení dnes v {new Date().toLocaleTimeString('cs-CZ')}</p>
              <p>• Vytvořen účet {new Date(user.created_at || '').toLocaleDateString('cs-CZ')}</p>
              <p>• Všechno funguje správně! 🎉</p>
            </div>
          </div>
        </div>

        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">
            Informace o aplikaci
          </h3>
          <p className="text-gray-600 mb-4">
            Toto je chráněná stránka. K této stránce máte přístup pouze když jste přihlášeni.
            Middleware automaticky přesměrovává nepřihlášené uživatele na hlavní stránku.
          </p>
          <div className="bg-gray-50 p-4 rounded-md">
            <h4 className="font-medium text-gray-800 mb-2">Použité technologie:</h4>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
              <li>Next.js 15 s App Router</li>
              <li>Tailwind CSS pro styling</li>
              <li>Supabase pro autentifikaci a databázi</li>
              <li>TypeScript pro type safety</li>
              <li>Middleware pro ochranu rout</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}