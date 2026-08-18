'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Calendar, Clock, MapPin, CheckCircle, Play, Navigation, AlertCircle, RefreshCw, LogOut, ShieldAlert } from 'lucide-react'

interface Cleaner {
  id: string
  name: string
  email: string
  user_id?: string | null
}

interface Job {
  id: string
  scheduled_date: string
  scheduled_time: string
  service_type: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  notes: string | null
  clients: {
    name: string
    address: string
    phone: string | null
  }
}

export default function CleanerPortalPage() {
  const [cleaner, setCleaner] = useState<Cleaner | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [unauthorized, setUnauthorized] = useState(false)

  // Data selecionada (padrão: hoje, no fuso horário LOCAL — não usar toISOString()
  // aqui, pois ela converte pra UTC e pode "pular" pro dia seguinte à noite no Brasil)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date()
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  })

  // Logout — declarado antes dos effects que o usam
  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut()
    window.history.pushState(null, '', '/')
    window.location.replace('/')
  }, [])

  // Buscar apenas os agendamentos do limpador autenticado
  const fetchJobs = useCallback(async (cleanerId: string, date: string) => {
    setLoading(true)

    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('cleaner_id', cleanerId)
      .eq('scheduled_date', date)
      .order('scheduled_time', { ascending: true })

    if (data && !error) {
      const clientIds = Array.from(new Set(data.map((j: any) => j.client_id).filter(Boolean)))
      const { data: clientsData } = await supabase
        .from('clients')
        .select('id, name, address, phone')
        .in('id', clientIds)

      const clientsById = new Map((clientsData ?? []).map((c: any) => [c.id, c]))
      const jobsWithClients = data.map((j: any) => ({
        ...j,
        clients: clientsById.get(j.client_id) ?? null,
      }))
      setJobs(jobsWithClients as Job[])
    } else {
      setJobs([])
    }
    setLoading(false)
  }, [])

  // ---------------------------------------------------------------------
  // HOOK 1 — trava da seta "voltar" do navegador + listener de sessão.
  // Fica no nível superior do componente, roda uma única vez.
  // ---------------------------------------------------------------------
  useEffect(() => {
    window.history.pushState(null, '', window.location.href)
    const onPopState = () => {
      window.history.pushState(null, '', window.location.href)
    }
    window.addEventListener('popstate', onPopState)

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session || event === 'SIGNED_OUT') {
        window.location.replace('/')
      }
    })

    return () => {
      window.removeEventListener('popstate', onPopState)
      authListener.subscription.unsubscribe()
    }
  }, [])

  // ---------------------------------------------------------------------
  // HOOK 2 — autentica, resolve o registro em `cleaners` e busca a agenda.
  // Roda de novo sempre que a data selecionada muda.
  // ---------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false

    async function initCleanerPortal() {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        window.location.href = '/limpador/login'
        return
      }

      const { data: cleanerData } = await supabase
        .from('cleaners')
        .select('*')
        .eq('email', user.email)
        .eq('active', true)
        .single()

      if (cancelled) return

      if (!cleanerData) {
        setUnauthorized(true)
        setLoading(false)
        return
      }

      setCleaner(cleanerData)

      // Vincula user_id na primeira vez que o funcionário faz login
      if (!cleanerData.user_id) {
        await supabase
          .from('cleaners')
          .update({ user_id: user.id })
          .eq('id', cleanerData.id)
      }

      fetchJobs(cleanerData.id, selectedDate)
    }

    initCleanerPortal()

    return () => {
      cancelled = true
    }
  }, [selectedDate, fetchJobs])

  // Atualizar status do serviço
  const handleStatusChange = async (jobId: string, newStatus: string) => {
    if (!cleaner) return
    setUpdatingId(jobId)

    const { error } = await supabase
      .from('jobs')
      .update({ status: newStatus })
      .eq('id', jobId)

    if (!error) {
      fetchJobs(cleaner.id, selectedDate)
    } else {
      alert('Erro ao atualizar status: ' + error.message)
    }
    setUpdatingId(null)
  }

  // Abrir Google Maps
  const openGPS = (address?: string) => {
    if (!address) return
    const encodedAddress = encodeURIComponent(address)
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank')
  }

  if (unauthorized) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center space-y-4">
        <ShieldAlert className="w-12 h-12 text-amber-500" />
        <h2 className="text-xl font-bold">Acesso Restrito</h2>
        <p className="text-sm text-slate-400 max-w-xs">
          Seu e-mail de login não está cadastrado como uma conta de limpador ativo na equipe.
        </p>
        <button
          onClick={handleLogout}
          className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-xl text-xs font-semibold"
        >
          Sair e Tentar Novamente
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col pb-10">
      {/* Topbar Mobile */}
      <header className="bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-20 shadow-md">
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
              BC
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-tight">
                {cleaner ? cleaner.name : 'Minha Agenda'}
              </h1>
              <p className="text-[10px] text-emerald-400 font-medium">Equipe de Limpeza</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => cleaner && fetchJobs(cleaner.id, selectedDate)}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition active:scale-95 cursor-pointer"
              title="Atualizar"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
            <button
              onClick={handleLogout}
              className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition active:scale-95 cursor-pointer"
              title="Sair da Conta"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 max-w-md mx-auto w-full space-y-4">
        {/* Filtro de Data */}
        <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between gap-3">
          <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5 shrink-0">
            <Calendar className="w-4 h-4 text-emerald-400" /> Data:
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Resumo */}
        <div className="flex items-center justify-between text-xs px-1 text-slate-400">
          <span>Serviços agendados</span>
          <span className="font-bold text-emerald-400">{jobs.length} {jobs.length === 1 ? 'item' : 'itens'}</span>
        </div>

        {/* Listagem de Serviços do Funcionário */}
        {loading ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            Carregando sua agenda...
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-12 bg-slate-900/50 rounded-xl border border-slate-800 p-6">
            <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <h3 className="font-semibold text-slate-300">Nenhum serviço para este dia</h3>
            <p className="text-xs text-slate-500 mt-1">Você não possui limpezas atribuídas para esta data.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => {
              const isCompleted = job.status === 'completed'
              const isInProgress = job.status === 'in_progress'

              return (
                <div
                  key={job.id}
                  className={`bg-slate-900 rounded-2xl border p-4 space-y-3 transition ${
                    isCompleted
                      ? 'border-emerald-500/30 bg-emerald-950/10'
                      : isInProgress
                      ? 'border-blue-500/50 bg-blue-950/10'
                      : 'border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                        {job.service_type}
                      </span>
                      <h3 className="text-lg font-bold text-white mt-1 leading-snug">
                        {job.clients?.name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1 text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg text-xs font-bold">
                      <Clock className="w-3.5 h-3.5" />
                      {job.scheduled_time}
                    </div>
                  </div>

                  {/* Endereço com Botão GPS */}
                  <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-2">
                    <p className="text-xs text-slate-300 flex items-start gap-1.5 leading-relaxed">
                      <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      {job.clients?.address}
                    </p>
                    <button
                      onClick={() => openGPS(job.clients?.address)}
                      className="w-full flex items-center justify-center gap-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 py-2 rounded-lg text-xs font-semibold transition active:scale-98 cursor-pointer"
                    >
                      <Navigation className="w-3.5 h-3.5" /> Abrir no Google Maps
                    </button>
                  </div>

                  {/* Instruções */}
                  {job.notes && (
                    <div className="bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-lg flex items-start gap-2 text-xs text-amber-300">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                      <div>
                        <span className="font-bold">Instruções: </span>
                        {job.notes}
                      </div>
                    </div>
                  )}

                  {/* Ações de Status */}
                  <div className="pt-1">
                    {isCompleted ? (
                      <div className="w-full py-2.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl flex items-center justify-center gap-2 text-xs font-bold">
                        <CheckCircle className="w-4 h-4" /> Serviço Concluído
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleStatusChange(job.id, 'in_progress')}
                          disabled={updatingId === job.id}
                          className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer ${
                            isInProgress
                              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          <Play className="w-3.5 h-3.5" />
                          {isInProgress ? 'Em Andamento' : 'Iniciar'}
                        </button>

                        <button
                          onClick={() => handleStatusChange(job.id, 'completed')}
                          disabled={updatingId === job.id}
                          className="py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-lg shadow-emerald-600/20"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Concluir
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}