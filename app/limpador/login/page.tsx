'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Lock, Mail, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setErrorMsg('E-mail ou senha inválidos.')
        setLoading(false)
        return
      }

      if (data.session) {
        router.replace('/dashboard')
      }
    } catch (err) {
      setErrorMsg('Ocorreu um erro ao tentar fazer login.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-black text-emerald-400 uppercase tracking-wide">
            Brazilian Cleaners
          </h1>
          <p className="text-xs text-slate-400">Entre com as suas credenciais para aceder ao sistema</p>
        </div>

        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs text-center">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-slate-300 font-medium">E-mail</label>
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 focus-within:border-emerald-500 transition">
              <Mail className="w-4 h-4 text-slate-500 shrink-0" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="bg-transparent text-sm text-white w-full focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-300 font-medium">Senha</label>
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 focus-within:border-emerald-500 transition">
              <Lock className="w-4 h-4 text-slate-500 shrink-0" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-transparent text-sm text-white w-full focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl text-sm transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Entrar no Sistema'}
          </button>
        </form>
      </div>
    </div>
  )
}