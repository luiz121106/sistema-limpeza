'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import {
  ArrowLeft,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  Calendar,
  Loader2,
  Home,
} from 'lucide-react'
import Link from 'next/link'

interface FinJob {
  id: string
  client_id: string
  scheduled_date: string
  price: number | string | null
  extra_price: number | string | null
  status: string
  payment_status: 'a_receber' | 'pago'
  target_type?: 'unit' | 'common_area'
  unit_details?: string
  notes?: string
  clients: { name: string } | null
}

function firstDayOfMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
function todayLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function sixMonthsAgo() {
  const d = new Date()
  d.setMonth(d.getMonth() - 5)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
function jobTotal(j: FinJob) {
  return Number(j.price || 0) + Number(j.extra_price || 0)
}

// Extrai a identificação da Unidade ou Área Comum
function getJobUnitLabel(job: FinJob) {
  if (job.unit_details) {
    return job.unit_details
  }
  if (job.notes) {
    const matchUnit = job.notes.match(/\[Unidade\/Especificação:\s*([^\]]+)\]/)
    if (matchUnit && matchUnit[1]) return matchUnit[1].trim()

    const matchArea = job.notes.match(/\[Área Comum:\s*([^\]]+)\]/)
    if (matchArea && matchArea[1]) return matchArea[1].trim()
  }
  return null
}

export default function FinanceiroPage() {
  const [jobs, setJobs] = useState<FinJob[]>([])
  const [chartJobs, setChartJobs] = useState<FinJob[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState(firstDayOfMonth())
  const [endDate, setEndDate] = useState(todayLocal())
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  // Carrega agendamentos do período selecionado (Cards e Pendências)
  const loadJobs = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('jobs')
      .select('id, client_id, scheduled_date, price, extra_price, status, payment_status, target_type, unit_details, notes, clients(name)')
      .gte('scheduled_date', startDate)
      .lte('scheduled_date', endDate)
      .not('status', 'in', '("cancelled","cancelado","deleted")')
      .order('scheduled_date', { ascending: false })

    setJobs((data as unknown as FinJob[]) ?? [])
    setLoading(false)
  }, [startDate, endDate])

  // Carrega dados dos últimos 6 meses exclusivamente para o gráfico
  const loadChartJobs = useCallback(async () => {
    const { data } = await supabase
      .from('jobs')
      .select('scheduled_date, price, extra_price, status')
      .gte('scheduled_date', sixMonthsAgo())
      .lte('scheduled_date', todayLocal())
      .not('status', 'in', '("cancelled","cancelado","deleted")')

    setChartJobs((data as unknown as FinJob[]) ?? [])
  }, [])

  useEffect(() => {
    loadJobs()
    loadChartJobs()

    // Realtime: Atualiza os dados automaticamente se um job for deletado/alterado em outra tela
    const channel = supabase
      .channel('jobs-financeiro-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => {
        loadJobs()
        loadChartJobs()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadJobs, loadChartJobs])

  const markAsPaid = async (jobId: string) => {
    setUpdatingId(jobId)
    const { error } = await supabase
      .from('jobs')
      .update({ payment_status: 'pago' })
      .eq('id', jobId)

    if (!error) {
      setJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, payment_status: 'pago' } : j))
      )
    } else {
      alert('Erro ao atualizar: ' + error.message)
    }
    setUpdatingId(null)
  }

  const totalFaturado = jobs.reduce((s, j) => s + jobTotal(j), 0)
  const totalPago = jobs
    .filter((j) => j.payment_status === 'pago')
    .reduce((s, j) => s + jobTotal(j), 0)
  const totalAReceber = totalFaturado - totalPago
  const pagoPercent = totalFaturado > 0 ? Math.round((totalPago / totalFaturado) * 100) : 0

  const byClient = useMemo(() => {
    const map = new Map<string, { name: string; pago: number; aReceber: number }>()
    for (const j of jobs) {
      const name = j.clients?.name ?? 'Sem cliente'
      const entry = map.get(name) ?? { name, pago: 0, aReceber: 0 }
      if (j.payment_status === 'pago') entry.pago += jobTotal(j)
      else entry.aReceber += jobTotal(j)
      map.set(name, entry)
    }
    return Array.from(map.values()).sort((a, b) => b.pago + b.aReceber - (a.pago + a.aReceber))
  }, [jobs])

  const last6Months = useMemo(() => {
    const months: { label: string; total: number }[] = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const total = chartJobs
        .filter((j) => j.scheduled_date.startsWith(monthKey))
        .reduce((s, j) => s + jobTotal(j), 0)
      months.push({ label: d.toLocaleDateString('pt-BR', { month: 'short' }), total })
    }
    return months
  }, [chartJobs])
  const maxMonth = Math.max(...last6Months.map((m) => m.total), 1)

  const pendentes = jobs
    .filter((j) => j.payment_status === 'a_receber')
    .sort((a, b) => (a.scheduled_date < b.scheduled_date ? 1 : -1))

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6">
      {/* Topbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-emerald-400">Painel Financeiro</h1>
        </div>

        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2">
          <Calendar className="w-4 h-4 text-emerald-400" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-transparent text-xs text-white focus:outline-none"
          />
          <span className="text-slate-600 text-xs">até</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-transparent text-xs text-white focus:outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
        </div>
      ) : (
        <>
          {/* Cards resumo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 text-blue-400 mb-2">
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs font-medium text-slate-400">Total Faturado</span>
              </div>
              <p className="text-2xl font-bold text-white">${totalFaturado.toFixed(2)}</p>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 text-amber-400 mb-2">
                <Clock className="w-4 h-4" />
                <span className="text-xs font-medium text-slate-400">A Receber</span>
              </div>
              <p className="text-2xl font-bold text-amber-400">${totalAReceber.toFixed(2)}</p>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 text-emerald-400 mb-2">
                <DollarSign className="w-4 h-4" />
                <span className="text-xs font-medium text-slate-400">Total Pago</span>
              </div>
              <p className="text-2xl font-bold text-emerald-400">${totalPago.toFixed(2)}</p>
            </div>
          </div>

          {/* Barra visual pago vs a receber */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-2 text-xs text-slate-400">
              <span>Recebido</span>
              <span>{pagoPercent}% do faturamento já pago</span>
            </div>
            <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${pagoPercent}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Mini gráfico últimos 6 meses */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-slate-300 mb-4">Faturamento — últimos 6 meses</h2>
              <div className="flex items-end justify-between gap-2 h-32">
                {last6Months.map((m) => (
                  <div key={m.label} className="flex-1 flex flex-col items-center gap-1.5">
                    <span className="text-[10px] text-slate-500">
                      {m.total > 0 ? `$${m.total.toFixed(0)}` : ''}
                    </span>
                    <div
                      className="w-full bg-emerald-500/70 rounded-t-md transition-all"
                      style={{ height: `${Math.max((m.total / maxMonth) * 100, 3)}%` }}
                    />
                    <span className="text-[10px] text-slate-400 capitalize">{m.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Breakdown por cliente */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-slate-300 mb-4">Detalhamento por cliente</h2>
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {byClient.length === 0 && (
                  <p className="text-xs text-slate-500">Nenhum agendamento no período.</p>
                )}
                {byClient.map((c) => {
                  const total = c.pago + c.aReceber
                  const percent = total > 0 ? (c.pago / total) * 100 : 0
                  return (
                    <div key={c.name}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-white">{c.name}</span>
                        <span className="text-slate-400">
                          <span className="text-emerald-400">${c.pago.toFixed(0)}</span>
                          {c.aReceber > 0 && (
                            <span className="text-amber-400"> · ${c.aReceber.toFixed(0)} pendente</span>
                          )}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Lista de pendências com ação rápida */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-300">
                Pendências de pagamento ({pendentes.length})
              </h2>
            </div>
            {pendentes.length === 0 ? (
              <p className="text-xs text-slate-500 p-5">Tudo pago no período selecionado. 🎉</p>
            ) : (
              <div className="divide-y divide-slate-800">
                {pendentes.map((j) => {
                  const unitLabel = getJobUnitLabel(j)

                  return (
                    <div key={j.id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-white">{j.clients?.name ?? 'Sem cliente'}</p>
                          {unitLabel && (
                            <span className="text-xs bg-purple-900/50 text-purple-200 border border-purple-600/50 px-2 py-0.5 rounded flex items-center gap-1 font-medium">
                              <Home className="w-3 h-3 text-purple-400" />
                              {unitLabel}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {new Date(`${j.scheduled_date}T00:00:00`).toLocaleDateString('pt-BR')} · $
                          {jobTotal(j).toFixed(2)}
                        </p>
                      </div>
                      <button
                        onClick={() => markAsPaid(j.id)}
                        disabled={updatingId === j.id}
                        className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition disabled:opacity-50 cursor-pointer"
                      >
                        {updatingId === j.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        Marcar como pago
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}