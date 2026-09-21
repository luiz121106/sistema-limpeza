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
  Building,
  Home
} from 'lucide-react'
import Link from 'next/link'

interface ClientData {
  id?: string
  name: string
  address?: string
}

interface PropertyData {
  id?: string
  name?: string
  address?: string
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
  property_id?: string | null
  clients: ClientData | ClientData[] | null
  properties: PropertyData | PropertyData[] | null
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

function getPropertyData(job: HistoryJob): PropertyData | null {
  if (!job.properties) return null
  if (Array.isArray(job.properties)) {
    return job.properties[0] || null
  }
  return job.properties
}

function getCleanerName(job: HistoryJob): string {
  if (job.cleaner_name) return job.cleaner_name
  if (!job.cleaners) return 'Não atribuído'
  if (Array.isArray(job.cleaners)) {
    return job.cleaners[0]?.name || 'Não atribuído'
  }
  return job.cleaners.name || 'Não atribuído'
}

// Lógica de identificação do identificador da unidade/notas (ex: "1209 2x2", "127 - 123")
function resolveUnitName(job: HistoryJob): string | null {
  // 1. Se houver anotação no job (campo notes), ela tem prioridade total para Move-In/Out
  if (job.notes && job.notes.trim()) {
    return job.notes.trim()
  }

  // 2. Se não houver notas, busca na tabela properties
  const property = getPropertyData(job)
  const client = getClientData(job)

  if (property?.name && property.name.trim()) {
    if (!client?.name || property.name.trim().toLowerCase() !== client.name.trim().toLowerCase()) {
      return property.name.trim()
    }
  }

  return null
}

export default function HistoricoPage() {
  const [jobs, setJobs] = useState<HistoryJob[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [loading, setLoading] = useState(true)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)
  
  // Filtros
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [selectedClient, setSelectedClient] = useState<string>('all')
  const [selectedUnit, setSelectedUnit] = useState<string>('all')

  const loadAll = useCallback(async () => {
    setLoading(true)

    const [{ data: jobsData }, { data: clientsData }] = await Promise.all([
      supabase
        .from('jobs')
        .select('*, clients(*), properties(*), cleaners(name)')
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

  const availableUnits = useMemo(() => {
    const unitsSet = new Set<string>()
    jobs.forEach((j) => {
      const u = resolveUnitName(j)
      if (u) unitsSet.add(u)
    })
    return Array.from(unitsSet).sort()
  }, [jobs])

  const handleDuplicateJob = async (job: HistoryJob) => {
    const client = getClientData(job)
    const clientName = client?.name || 'Cliente'
    if (!confirm(`Duplicar a limpeza de "${clientName}" e enviar para os novos Agendamentos?`)) return

    setDuplicatingId(job.id)

    const today = new Date().toISOString().split('T')[0]

    const payload = {
      client_id: job.client_id ?? null,
      property_id: job.property_id ?? null,
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
      alert('Limpeza duplicada com sucesso!')
      loadAll()
    }

    setDuplicatingId(null)
  }

  const filteredJobs = useMemo(() => {
    return jobs.filter((j) => {
      if (startDate && j.scheduled_date < startDate) return false
      if (endDate && j.scheduled_date > endDate) return false
      if (selectedClient !== 'all' && j.client_id !== selectedClient) return false
      
      if (selectedUnit !== 'all') {
        const u = resolveUnitName(j)
        if (u !== selectedUnit) return false
      }

      return true
    })
  }, [jobs, startDate, endDate, selectedClient, selectedUnit])

  const handleGeneratePDF = () => {
    if (filteredJobs.length === 0) {
      alert('Nenhuma limpeza encontrada para gerar o PDF.')
      return
    }

    const totalValor = filteredJobs.reduce((acc, j) => acc + Number(j.price || 0) + Number(j.extra_price || 0), 0)
    
    let clientSelectedName = 'Todos os Clientes'
    if (selectedClient !== 'all') {
      const foundClient = clients.find(c => c.id === selectedClient)
      if (foundClient) clientSelectedName = foundClient.name
    }

    const periodText = (startDate || endDate) 
      ? `${startDate ? new Date(`${startDate}T00:00:00`).toLocaleDateString('pt-BR') : 'Início'} até ${endDate ? new Date(`${endDate}T00:00:00`).toLocaleDateString('pt-BR') : 'Hoje'}`
      : 'Período Completo'

    const rows = filteredJobs.map(j => {
      const client = getClientData(j)
      const total = Number(j.price || 0) + Number(j.extra_price || 0)
      const cleaner = getCleanerName(j)
      const unitName = resolveUnitName(j) || '-'
      const dateFormatted = new Date(`${j.scheduled_date}T00:00:00`).toLocaleDateString('pt-BR')
      const statusText = statusLabel[j.status] || j.status
      const unitBadge = unitName !== '-' ? `<span class="badge badge-unit">${unitName}</span>` : '-'

      return `
        <tr>
          <td><strong>${dateFormatted}</strong> ${j.scheduled_time}</td>
          <td><strong>${client?.name || 'Sem cliente'}</strong></td>
          <td>${unitBadge}</td>
          <td>${j.service_type}</td>
          <td>${cleaner}</td>
          <td>${statusText}</td>
          <td style="text-align: right; font-weight: bold; color: #047857;">$${total.toFixed(2)}</td>
        </tr>
      `
    }).join('')

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Relatório de Limpezas</title>
          <style>
            @page {
              size: A4 landscape;
              margin: 10mm;
            }
            * {
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #0f172a;
              margin: 0;
              padding: 15px;
              background-color: #ffffff;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .wrapper {
              width: 100%;
              max-width: 100%;
              margin: 0 auto;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #059669;
              padding-bottom: 12px;
              margin-bottom: 15px;
            }
            .brand {
              font-size: 20px;
              font-weight: 800;
              color: #059669;
            }
            .title {
              font-size: 13px;
              font-weight: 600;
              color: #475569;
              margin-top: 2px;
            }
            .info-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 10px;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              padding: 10px 12px;
              margin-bottom: 15px;
              font-size: 11px;
            }
            .info-item span {
              color: #64748b;
              font-weight: 600;
              display: block;
              font-size: 9px;
              text-transform: uppercase;
              margin-bottom: 2px;
            }
            .info-item strong {
              color: #0f172a;
              font-size: 11px;
              word-break: break-word;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 15px;
              font-size: 10px;
            }
            th {
              background-color: #0f172a !important;
              color: #ffffff !important;
              text-align: left;
              padding: 8px;
              font-weight: 600;
            }
            td {
              padding: 7px 8px;
              border-bottom: 1px solid #e2e8f0;
              vertical-align: middle;
            }
            tr:nth-child(even) {
              background-color: #f8fafc !important;
            }
            .badge {
              padding: 2px 6px;
              border-radius: 4px;
              font-size: 9px;
              font-weight: 700;
              display: inline-block;
            }
            .badge-unit {
              background: #f3e8ff !important;
              color: #6b21a8 !important;
              border: 1px solid #d8b4fe !important;
            }
            .footer-container {
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              margin-top: 15px;
            }
            .total-card {
              background: #ecfdf5 !important;
              border: 1px solid #a7f3d0 !important;
              padding: 10px 16px;
              border-radius: 8px;
              text-align: right;
              margin-left: auto;
            }
            .total-card span {
              color: #047857;
              font-size: 10px;
              font-weight: 700;
            }
            .total-card h2 {
              color: #065f46;
              margin: 2px 0 0 0;
              font-size: 18px;
            }
            .footer {
              font-size: 9px;
              color: #94a3b8;
            }
          </style>
        </head>
        <body>
          <div class="wrapper">
            <div class="header">
              <div>
                <div class="brand">Relatório de Limpezas</div>
                <div class="title">Resumo Operacional & Financeiro</div>
              </div>
              <div style="text-align: right; font-size: 10px; color: #64748b;">
                Emissão: ${new Date().toLocaleDateString('pt-BR')}
              </div>
            </div>

            <div class="info-grid">
              <div class="info-item">
                <span>Cliente</span>
                <strong>${clientSelectedName}</strong>
              </div>
              <div class="info-item">
                <span>Unidade</span>
                <strong>${selectedUnit !== 'all' ? selectedUnit : 'Todas'}</strong>
              </div>
              <div class="info-item">
                <span>Período</span>
                <strong>${periodText}</strong>
              </div>
              <div class="info-item">
                <span>Registros</span>
                <strong>${filteredJobs.length} limpeza(s)</strong>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Data / Hora</th>
                  <th>Cliente</th>
                  <th>Unidade / Notas</th>
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

            <div class="footer-container">
              <div class="footer">
                Relatório gerado via Gestão de Limpezas.
              </div>
              <div class="total-card">
                <span>VALOR TOTAL</span>
                <h2>$${totalValor.toFixed(2)}</h2>
              </div>
            </div>
          </div>
        </body>
      </html>
    `

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.open()
      printWindow.document.write(htmlContent)
      printWindow.document.close()

      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.focus()
          printWindow.print()
        }, 250)
      }
    } else {
      alert('Por favor, permita pop-ups para gerar o PDF no celular.')
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

        <button
          onClick={handleGeneratePDF}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 py-2 rounded-xl text-xs flex items-center gap-2 transition cursor-pointer active:scale-95 shadow-md"
        >
          <FileText className="w-4 h-4" /> Baixar PDF
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 bg-slate-900/60 border border-slate-800 rounded-xl p-3">
        <Filter className="w-4 h-4 text-slate-500" />

        <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5">
          <span className="text-xs text-slate-400">De:</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-transparent text-xs text-white focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5">
          <span className="text-xs text-slate-400">Até:</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-transparent text-xs text-white focus:outline-none"
          />
        </div>

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

        {availableUnits.length > 0 && (
          <select
            value={selectedUnit}
            onChange={(e) => setSelectedUnit(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
          >
            <option value="all">Todas as unidades</option>
            {availableUnits.map((u) => (
              <option key={u} value={u}>
                Unidade: {u}
              </option>
            ))}
          </select>
        )}

        {(startDate || endDate || selectedClient !== 'all' || selectedUnit !== 'all') && (
          <button
            onClick={() => {
              setStartDate('')
              setEndDate('')
              setSelectedClient('all')
              setSelectedUnit('all')
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
          <p className="text-slate-500 text-sm mt-1">Tente outro intervalo de datas, cliente ou unidade.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredJobs.map((j) => {
            const client = getClientData(j)
            const property = getPropertyData(j)
            const cleanerName = getCleanerName(j)
            const total = Number(j.price || 0) + Number(j.extra_price || 0)
            const isDuplicating = duplicatingId === j.id
            const unitName = resolveUnitName(j)
            const displayAddress = property?.address || client?.address

            return (
              <div
                key={j.id}
                className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
              >
                <div className="space-y-1.5 w-full lg:w-auto">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-white text-base">{client?.name ?? 'Sem cliente'}</span>

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

                  {/* Faixa em destaque da Unidade / Notas (Efeito Purple idêntico ao do card) */}
                  {unitName && (
                    <div className="bg-purple-950/40 border border-purple-800/40 text-purple-300 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 w-full lg:w-fit">
                      <Home className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span>{unitName}</span>
                    </div>
                  )}

                  {displayAddress && (
                    <p className="text-xs text-slate-400 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" /> {displayAddress}
                    </p>
                  )}
                  {cleanerName !== 'Não atribuído' && (
                    <p className="text-xs text-slate-400 flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-slate-500 shrink-0" /> {cleanerName}
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