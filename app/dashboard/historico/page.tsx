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
  Copy,
  X,
  FileText,
  Building
} from 'lucide-react'
import Link from 'next/link'

interface ClientData {
  id?: string
  name: string
  address?: string
  unit?: string
}

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
  cleaner_id?: string | null
  cleaner_payout?: number | string | null
  notes?: string | null
  clients: ClientData | ClientData[] | null
  cleaners: { name: string } | { name: string }[] | null
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

function getClientData(job: HistoryJob): ClientData | null {
  if (!job.clients) return null
  if (Array.isArray(job.clients)) {
    return job.clients[0] || null
  }
  return job.clients
}

function getCleanerName(job: HistoryJob): string {
  if (job.cleaner_name) return job.cleaner_name
  if (!job.cleaners) return 'Não atribuído'
  if (Array.isArray(job.cleaners)) {
    return job.cleaners[0]?.name || 'Não atribuído'
  }
  return job.cleaners.name || 'Não atribuído'
}

export default function HistoricoPage() {
  const [jobs, setJobs] = useState<HistoryJob[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [loading, setLoading] = useState(true)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)
  
  // Filtros por intervalo de datas e cliente
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [selectedClient, setSelectedClient] = useState<string>('all')

  const loadAll = useCallback(async () => {
    setLoading(true)

    const [{ data: jobsData }, { data: clientsData }] = await Promise.all([
      supabase
        .from('jobs')
        .select('*, clients(*), cleaners(name)')
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

  const handleDuplicateJob = async (job: HistoryJob) => {
    const client = getClientData(job)
    const clientName = client?.name || 'Cliente'
    if (!confirm(`Duplicar a limpeza de "${clientName}" e enviar para os novos Agendamentos?`)) return

    setDuplicatingId(job.id)

    const today = new Date().toISOString().split('T')[0]

    const payload = {
      client_id: job.client_id ?? null,
      cleaner_id: job.cleaner_id ?? null,
      cleaner_name: job.cleaner_name ?? null,
      service_type: job.service_type ?? '',
      scheduled_date: today,
      scheduled_time: job.scheduled_time ?? '08:00',
      price: job.price ?? 0,
      extra_price: job.extra_price ?? 0,
      cleaner_payout: job.cleaner_payout ?? 0,
      notes: job.notes ?? null,
      status: 'pending',
      payment_status: 'a_receber',
    }

    const { error } = await supabase.from('jobs').insert([payload])

    if (error) {
      alert('Erro ao duplicar agendamento: ' + error.message)
    } else {
      alert('Limpeza duplicada com sucesso! Ela já está disponível na lista de Agendamentos.')
      loadAll()
    }

    setDuplicatingId(null)
  }

  // Filtragem dos registos
  const filteredJobs = useMemo(() => {
    return jobs.filter((j) => {
      if (startDate && j.scheduled_date < startDate) return false
      if (endDate && j.scheduled_date > endDate) return false
      if (selectedClient !== 'all' && j.client_id !== selectedClient) return false
      return true
    })
  }, [jobs, startDate, endDate, selectedClient])

  // Gerador de PDF
  const handleGeneratePDF = () => {
    if (filteredJobs.length === 0) {
      alert('Nenhuma limpeza encontrada para gerar o PDF.')
      return
    }

    const totalValor = filteredJobs.reduce((acc, j) => acc + Number(j.price || 0) + Number(j.extra_price || 0), 0)
    const clientSelectedName = selectedClient !== 'all' 
      ? clients.find(c => c.id === selectedClient)?.name || 'Cliente Específico' 
      : 'Todos os Clientes'

    const periodText = (startDate || endDate) 
      ? `${startDate ? new Date(`${startDate}T00:00:00`).toLocaleDateString('pt-BR') : 'Início'} até ${endDate ? new Date(`${endDate}T00:00:00`).toLocaleDateString('pt-BR') : 'Hoje'}`
      : 'Período Completo'

    const rows = filteredJobs.map(j => {
      const client = getClientData(j)
      const total = Number(j.price || 0) + Number(j.extra_price || 0)
      const cleaner = getCleanerName(j)
      const unitName = client?.unit || '-'
      const dateFormatted = new Date(`${j.scheduled_date}T00:00:00`).toLocaleDateString('pt-BR')
      const statusText = statusLabel[j.status] || j.status
      const unitBadge = unitName !== '-' ? `<span class="badge badge-unit">${unitName}</span>` : '-'

      return `
        <tr>
          <td><strong>${dateFormatted}</strong> - ${j.scheduled_time}</td>
          <td><strong>${client?.name || 'Sem cliente'}</strong></td>
          <td>${unitBadge}</td>
          <td>${j.service_type}</td>
          <td>${cleaner}</td>
          <td>${statusText}</td>
          <td style="text-align: right; font-weight: bold; color: #047857;">&#36;${total.toFixed(2)}</td>
        </tr>
      `
    }).join('')

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Resumo de Limpezas</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; margin: 0; padding: 30px; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #059669; padding-bottom: 15px; margin-bottom: 25px; }
            .brand { font-size: 24px; font-weight: bold; color: #059669; }
            .title { font-size: 16px; font-weight: 600; color: #0f172a; margin-top: 5px; }
            .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; font-size: 12px; }
            .info-item span { color: #64748b; font-weight: 500; display: block; margin-bottom: 3px; }
            .info-item strong { color: #0f172a; font-size: 13px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 11px; }
            th { background-color: #0f172a; color: #ffffff; text-align: left; padding: 10px; font-weight: 600; }
            td { padding: 9px 10px; border-bottom: 1px solid #e2e8f0; }
            tr:nth-child(even) { background-color: #f8fafc; }
            .badge { padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; display: inline-block; }
            .badge-unit { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
            .total-card { float: right; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 12px 20px; border-radius: 8px; text-align: right; }
            .total-card span { color: #047857; font-size: 11px; font-weight: 600; }
            .total-card h2 { color: #065f46; margin: 3px 0 0 0; font-size: 20px; }
            .footer { margin-top: 50px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="brand">Relatório de Limpezas</div>
              <div class="title">Resumo Operacional & Financeiro</div>
            </div>
            <div style="text-align: right; font-size: 11px; color: #64748b;">
              Gerado em: ${new Date().toLocaleDateString('pt-BR')}
            </div>
          </div>

          <div class="info-box">
            <div class="info-item">
              <span>CLIENTE</span>
              <strong>${clientSelectedName}</strong>
            </div>
            <div class="info-item">
              <span>PERÍODO</span>
              <strong>${periodText}</strong>
            </div>
            <div class="info-item">
              <span>TOTAL REGISTOS</span>
              <strong>${filteredJobs.length} limpeza(s)</strong>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Data / Hora</th>
                <th>Cliente</th>
                <th>Unidade</th>
                <th>Serviço</th>
                <th>Limpador</th>
                <th>Status</th>
                <th style="text-align: right;">Valor ($)</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>

          <div class="total-card">
            <span>VALOR TOTAL DO PERÍODO</span>
            <h2>&#36;${totalValor.toFixed(2)}</h2>
          </div>

          <div style="clear: both;"></div>

          <div class="footer">
            Relatório gerado automaticamente pelo Sistema de Gestão de Limpezas.
          </div>
        </body>
      </html>
    `

    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    document.body.appendChild(iframe)

    const doc = iframe.contentWindow?.document
    if (doc) {
      doc.open()
      doc.write(htmlContent)
      doc.close()

      setTimeout(() => {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
        setTimeout(() => {
          document.body.removeChild(iframe)
        }, 1000)
      }, 500)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6">
      {/* Topbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-emerald-400">Histórico de Limpezas</h1>
        </div>

        {/* Botão de PDF */}
        <button
          onClick={handleGeneratePDF}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 py-2 rounded-xl text-xs flex items-center gap-2 transition cursor-pointer active:scale-95 shadow-md"
          title="Baixar resumo formatado em PDF"
        >
          <FileText className="w-4 h-4" /> Baixar PDF
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 bg-slate-900/60 border border-slate-800 rounded-xl p-3">
        <Filter className="w-4 h-4 text-slate-500" />

        {/* Campo Data Inicial */}
        <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5">
          <span className="text-xs text-slate-400">De:</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-transparent text-xs text-white focus:outline-none"
          />
        </div>

        {/* Campo Data Final */}
        <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5">
          <span className="text-xs text-slate-400">Até:</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-transparent text-xs text-white focus:outline-none"
          />
        </div>

        {/* Seleção de Cliente */}
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

        {/* Botão de Limpar Filtros */}
        {(startDate || endDate || selectedClient !== 'all') && (
          <button
            onClick={() => {
              setStartDate('')
              setEndDate('')
              setSelectedClient('all')
            }}
            className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 bg-slate-800/50 hover:bg-slate-800 px-2 py-1.5 rounded-lg border border-slate-700/50 transition cursor-pointer"
          >
            <X className="w-3 h-3" /> Limpar filtros
          </button>
        )}

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
          <p className="text-slate-500 text-sm mt-1">Tente outro intervalo de datas ou cliente.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredJobs.map((j) => {
            const client = getClientData(j)
            const cleanerName = getCleanerName(j)
            const total = Number(j.price || 0) + Number(j.extra_price || 0)
            const isDuplicating = duplicatingId === j.id
            const unitName = client?.unit

            return (
              <div
                key={j.id}
                className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-white">{client?.name ?? 'Sem cliente'}</span>
                    
                    {/* Exibição da Unidade */}
                    {unitName && (
                      <span className="text-xs bg-emerald-950/60 text-emerald-400 border border-emerald-800/50 px-2 py-0.5 rounded font-medium flex items-center gap-1">
                        <Building className="w-3 h-3" /> {unitName}
                      </span>
                    )}

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

                  {client?.address && (
                    <p className="text-xs text-slate-400 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-500" /> {client.address}
                    </p>
                  )}
                  {cleanerName !== 'Não atribuído' && (
                    <p className="text-xs text-slate-400 flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-slate-500" /> {cleanerName}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between lg:justify-end gap-4 text-xs text-slate-300">
                  <div className="flex items-center gap-4">
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

                  <button
                    onClick={() => handleDuplicateJob(j)}
                    disabled={isDuplicating}
                    className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-lg flex items-center gap-1.5 font-medium transition cursor-pointer disabled:opacity-50"
                    title="Duplicar esta limpeza para Agendamentos"
                  >
                    {isDuplicating ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{isDuplicating ? 'Duplicando...' : 'Duplicar'}</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}