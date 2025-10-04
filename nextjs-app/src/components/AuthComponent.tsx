'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AuthComponent() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      setMessage(`Error: ${error.message}`)
    } else {
      setMessage('Check your email for confirmation!')
    }
    
    setLoading(false)
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setMessage(`Error: ${error.message}`)
    } else {
      setMessage('Signed in successfully!')
    }
    
    setLoading(false)
  }

  return (
    <div className="card max-w-md mx-auto mt-8 animate-fade-in">
      <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">
        🔐 Supabase Auth
      </h2>
      
      <form className="space-y-4">
        <div className="animate-slide-up">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            placeholder="vas@email.cz"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="form-input"
            required
          />
        </div>
        
        <div className="animate-slide-up" style={{animationDelay: '0.1s'}}>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Heslo
          </label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="form-input"
            required
          />
        </div>
        
        <div className="flex space-x-3 pt-2">
          <button
            onClick={handleSignUp}
            disabled={loading}
            className="flex-1 bg-success-500 text-white py-2.5 px-4 rounded-md hover:bg-success-600 disabled:opacity-50 font-medium transition-all duration-200"
          >
            {loading ? '⏳ Načítání...' : '📝 Registrace'}
          </button>
          
          <button
            onClick={handleSignIn}
            disabled={loading}
            className="btn-primary flex-1 py-2.5 font-medium"
          >
            {loading ? '⏳ Načítání...' : '🔑 Přihlášení'}
          </button>
        </div>
      </form>
      
      {message && (
        <div className="mt-4 p-3 text-center text-sm bg-gray-100 rounded-md">
          {message}
        </div>
      )}
    </div>
  )
}