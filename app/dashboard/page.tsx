'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { LogOut, Calendar, Users, DollarSign, Clock, UserPlus, UserCheck, Wallet } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
  // Métricas
  const [clientCount, setClientCount] = useState(0)
  const [cleanerCount, setCleanerCount] = useState(0)
  const [todayJobsCount, setTodayJobsCount] = useState(0)
  const [weeklyRevenue, setWeeklyRevenue] = useState(0)

  useEffect(() => {
    async function initDashboard() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/'
        return
      }
      setUser(user)

      // 1. Total de clientes
      const { count: clients } = await supabase.from('clients').select('*', { count: 'exact', head: true })
      setClientCount(clients || 0)

      // 2. Total de limpadores ativos
      const { count: cleaners } = await supabase.from('cleaners').select('*', { count: 'exact', head: true }).eq('active', true)
      setCleanerCount(cleaners || 0)

      // 3. Limpezas hoje
      const today = new Date().toISOString().split('T')[0]
      const { count: todayJobs } = await supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('scheduled_date', today)
      setTodayJobsCount(todayJobs || 0)

      // 4. Faturamento Mensal (Reseta no 1º dia de cada mês)
      const now = new Date()
      const firstDayOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

      const { data: completedJobs } = await supabase
        .from('jobs')
        .select('price, extra_price')
        .eq('status', 'completed')
        .gte('scheduled_date', firstDayOfMonth)

      if (completedJobs) {
        const total = completedJobs.reduce((sum, item) => {
          const base = Number(item.price || 0)
          const extra = Number(item.extra_price || 0)
          return sum + base + extra
        }, 0)
        setWeeklyRevenue(total)
      }

      setLoading(false)
    }

    initDashboard()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        Carregando painel...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Topbar */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-emerald-400">Brazilian Cleaners</h1>
          <span className="text-xs bg-slate-700 text-slate-300 px-2.5 py-1 rounded-full">
            Painel Geral
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-400 hidden sm:inline">{user?.email}</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Métricas Dinâmicas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/dashboard/clientes" className="bg-slate-800 p-5 rounded-xl border border-slate-700 hover:border-emerald-500/50 transition flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Clientes Cadastrados</p>
              <h3 className="text-2xl font-bold">{clientCount}</h3>
            </div>
          </Link>

          <Link href="/dashboard/limpadores" className="bg-slate-800 p-5 rounded-xl border border-slate-700 hover:border-teal-500/50 transition flex items-center gap-4">
            <div className="p-3 bg-teal-500/10 text-teal-400 rounded-lg">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Limpadores Ativos</p>
              <h3 className="text-2xl font-bold">{cleanerCount}</h3>
            </div>
          </Link>

          <Link href="/dashboard/agendamentos" className="bg-slate-800 p-5 rounded-xl border border-slate-700 hover:border-blue-500/50 transition flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 text-blue-400 rounded-lg">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Limpezas Hoje</p>
              <h3 className="text-2xl font-bold">{todayJobsCount}</h3>
            </div>
          </Link>

          <Link href="/dashboard/financeiro" className="bg-slate-800 p-5 rounded-xl border border-slate-700 hover:border-purple-500/50 transition flex items-center gap-4">
            <div className="p-3 bg-purple-500/10 text-purple-400 rounded-lg">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Faturamento Mensal</p>
              <h3 className="text-2xl font-bold">${weeklyRevenue.toFixed(2)}</h3>
            </div>
          </Link>
        </div>

        {/* Menu de Atalhos (2 fileiras de 3 no notebook/desktop) */}
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-4">
          <h2 className="text-lg font-semibold">Atalhos do Sistema</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <Link
              href="/dashboard/clientes"
              className="p-4 bg-slate-900/60 hover:bg-slate-900 rounded-xl border border-slate-700/80 flex items-center gap-3 transition group"
            >
              <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-lg group-hover:scale-105 transition">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-200 group-hover:text-emerald-400 transition">Gerenciar Clientes</h3>
                <p className="text-xs text-slate-400">Cadastrar novos clientes, endereços e valores.</p>
              </div>
            </Link>

            <Link
              href="/dashboard/limpadores"
              className="p-4 bg-slate-900/60 hover:bg-slate-900 rounded-xl border border-slate-700/80 flex items-center gap-3 transition group"
            >
              <div className="p-2.5 bg-teal-500/10 text-teal-400 rounded-lg group-hover:scale-105 transition">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-200 group-hover:text-teal-400 transition">Equipe / Limpadores</h3>
                <p className="text-xs text-slate-400">Cadastrar e manter a equipe de limpeza.</p>
              </div>
            </Link>

            <Link
              href="/dashboard/agendamentos"
              className="p-4 bg-slate-900/60 hover:bg-slate-900 rounded-xl border border-slate-700/80 flex items-center gap-3 transition group"
            >
              <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-lg group-hover:scale-105 transition">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-200 group-hover:text-blue-400 transition">Agendamentos</h3>
                <p className="text-xs text-slate-400">Organizar a escala e atrelar limpadores.</p>
              </div>
            </Link>

            <Link
              href="/dashboard/financeiro"
              className="p-4 bg-slate-900/60 hover:bg-slate-900 rounded-xl border border-slate-700/80 flex items-center gap-3 transition group"
            >
              <div className="p-2.5 bg-purple-500/10 text-purple-400 rounded-lg group-hover:scale-105 transition">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-200 group-hover:text-purple-400 transition">Financeiro Geral</h3>
                <p className="text-xs text-slate-400">Faturamento, recebíveis e pagamentos.</p>
              </div>
            </Link>

            <Link
              href="/dashboard/financeiro-limpadores"
              className="p-4 bg-slate-900/60 hover:bg-slate-900 rounded-xl border border-slate-700/80 flex items-center gap-3 transition group"
            >
              <div className="p-2.5 bg-emerald-500/10 text-emerald-300 rounded-lg group-hover:scale-105 transition">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-200 group-hover:text-emerald-300 transition">Repasse Limpadores</h3>
                <p className="text-xs text-slate-400">Fechamento quinzenal de repasses da equipe.</p>
              </div>
            </Link>

            <Link
              href="/dashboard/historico"
              className="p-4 bg-slate-900/60 hover:bg-slate-900 rounded-xl border border-slate-700/80 flex items-center gap-3 transition group"
            >
              <div className="p-2.5 bg-slate-500/10 text-slate-300 rounded-lg group-hover:scale-105 transition">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-200 group-hover:text-slate-100 transition">Histórico</h3>
                <p className="text-xs text-slate-400">Todas as limpezas, com filtro por mês e cliente.</p>
              </div>
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}