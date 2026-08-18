'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  UserCheck,
  Loader2,
  Filter,
  DollarSign,
} from 'lucide-react'
import Link from 'next/link'

interface HistoryJob {
  id: string
  scheduled_date: string
  scheduled_time: string
  service_type: string
  price: number | string | null
  extra_price: number | string | null
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  payment_status: 'a_receber' | 'pago' | null
  client_id: string
  clients: { name: string; address: string } | null
  cleaners: { name: string } | null
  cleaner_name: string | null
}

interface ClientOption {
  id: string
  name: string
}

const statusLabel: Record<HistoryJob['status'], string> = {
  pending: 'Pendente',
  in_progress: 'Em Andamento',
  completed: 'Concluída',
  cancelled: 'Cancelada',
}
const statusStyle: Record<HistoryJob['status'], string> = {
  pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  in_progress: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
}

export default function HistoricoPage() {
  const [jobs, setJobs] = useState<HistoryJob[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState<string>('all') // 'YYYY-MM' ou 'all'
  const [selectedClient, setSelectedClient] = useState<string>('all')

  const loadAll = useCallback(async () => {
    setLoading(true)

    const [{ data: jobsData }, { data: clientsData }] = await Promise.all([
      supabase
        .from('jobs')
        .select(
          '*, clients(name, address), cleaners(name)'
        )
        .order('scheduled_date', { ascending: false })
        .order('scheduled_time', { ascending: false }),
      supabase.from('clients').select('id, name').order('name'),
    ])

    setJobs((jobsData as unknown as HistoryJob[]) ?? [])
    setClients(clientsData ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const availableMonths = useMemo(() => {
    const set = new Set(jobs.map((j) => j.scheduled_date.slice(0, 7)))
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1))
  }, [jobs])

  const filteredJobs = useMemo(() => {
    return jobs.filter((j) => {
      if (selectedMonth !== 'all' && !j.scheduled_date.startsWith(selectedMonth)) return false
      if (selectedClient !== 'all' && j.client_id !== selectedClient) return false
      return true
    })
  }, [jobs, selectedMonth, selectedClient])

  function monthLabel(monthKey: string) {
    const [year, month] = monthKey.split('-')
    const d = new Date(Number(year), Number(month) - 1, 1)
    return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6">
      {/* Topbar */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-emerald-400">Histórico de Limpezas</h1>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 bg-slate-900/60 border border-slate-800 rounded-xl p-3">
        <Filter className="w-4 h-4 text-slate-500" />

        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
        >
          <option value="all">Todos os meses</option>
          {availableMonths.map((m) => (
            <option key={m} value={m} className="capitalize">
              {monthLabel(m)}
            </option>
          ))}
        </select>

        <select
          value={selectedClient}
          onChange={(e) => setSelectedClient(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
        >
          <option value="all">Todos os clientes</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <span className="text-xs text-slate-500 ml-auto">
          {filteredJobs.length} {filteredJobs.length === 1 ? 'limpeza' : 'limpezas'}
        </span>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/50 rounded-2xl border border-slate-800">
          <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <h3 className="font-semibold text-slate-300">Nenhuma limpeza encontrada</h3>
          <p className="text-slate-500 text-sm mt-1">Tente outro filtro de mês ou cliente.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredJobs.map((j) => {
            const total = Number(j.price || 0) + Number(j.extra_price || 0)
            const cleanerName = j.cleaners?.name || j.cleaner_name
            return (
              <div
                key={j.id}
                className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-white">{j.clients?.name ?? 'Sem cliente'}</span>
                    <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                      {j.service_type}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded border ${statusStyle[j.status]}`}
                    >
                      {statusLabel[j.status]}
                    </span>
                    {j.payment_status && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded border ${
                          j.payment_status === 'pago'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}
                      >
                        {j.payment_status === 'pago' ? 'Pago' : 'A receber'}
                      </span>
                    )}
                  </div>
                  {j.clients?.address && (
                    <p className="text-xs text-slate-400 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-500" /> {j.clients.address}
                    </p>
                  )}
                  {cleanerName && (
                    <p className="text-xs text-slate-400 flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-slate-500" /> {cleanerName}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-emerald-400" />
                    {new Date(`${j.scheduled_date}T00:00:00`).toLocaleDateString('pt-BR')}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-400" />
                    {j.scheduled_time}
                  </div>
                  <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                    <DollarSign className="w-3.5 h-3.5" />
                    {total.toFixed(2)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}