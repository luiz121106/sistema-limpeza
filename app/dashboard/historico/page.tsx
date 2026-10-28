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
  Share2,
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
  target_type?: string | null
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

function resolveUnitName(job: HistoryJob): string | null {
  let rawText = ''

  if (job.notes && job.notes.trim()) {
    rawText = job.notes.trim()
  } else {
    const property = getPropertyData(job)
    const client = getClientData(job)

    if (property?.name && property.name.trim()) {
      if (!client?.name || property.name.trim().toLowerCase() !== client.name.trim().toLowerCase()) {
        rawText = property.name.trim()
      }
    }
  }

  if (!rawText) return null

  // Remove prefixos como [Unidade/Especificação:], Unidade:, e colchetes
  const cleaned = rawText
    .replace(/^\[?Unidade\s*\/\s*Especificação:?\s*/i, '')
    .replace(/^\[?Unidade:?\s*/i, '')
    .replace(/[\[\]]/g, '')
    .trim()

  return cleaned || null
}

export default function HistoricoPage() {
  const [jobs, setJobs] = useState<HistoryJob[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [loading, setLoading] = useState(true)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [selectedClient, setSelectedClient] = useState<string>('all')
  const [selectedUnit, setSelectedUnit] = useState<string>('all')
  // Filtro de Categoria (Área Comum vs Unidades / Move-in & Move-out)
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'common_area' | 'unit'>('all')

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
      target_type: job.target_type ?? null,
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

      // Filtro por Categoria (Área Comum vs Unidades/Move-in)
      if (selectedCategory !== 'all') {
        const isCommonArea = j.target_type === 'common_area' || j.notes?.toLowerCase().includes('área comum') || j.notes?.toLowerCase().includes('area comum')
        if (selectedCategory === 'common_area' && !isCommonArea) return false
        if (selectedCategory === 'unit' && isCommonArea) return false
      }

      return true
    })
  }, [jobs, startDate, endDate, selectedClient, selectedUnit, selectedCategory])

  const buildPdfHtml = () => {
    const totalValor = filteredJobs.reduce((acc, j) => acc + Number(j.price || 0) + Number(j.extra_price || 0), 0)
    
    let clientSelectedName = 'Todos os Clientes'
    if (selectedClient !== 'all') {
      const foundClient = clients.find(c => c.id === selectedClient)
      if (foundClient) clientSelectedName = foundClient.name
    }

    let categoryText = 'Todos os Serviços'
    if (selectedCategory === 'common_area') categoryText = 'Apenas Área Comum'
    if (selectedCategory === 'unit') categoryText = 'Apenas Unidades / Move-in & Move-out'

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

    return `
      <style>
        * {
          box-sizing: border-box;
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
          padding: 10px 8px;
          font-weight: 600;
        }
        td {
          padding: 12px 8px !important;
          border-bottom: 1px solid #e2e8f0;
          vertical-align: middle;
        }
        tr:nth-child(even) {
          background-color: #f8fafc !important;
        }
        .badge {
          display: inline-block !important;
          padding: 5px 10px !important;
          border-radius: 6px;
          font-size: 9px;
          font-weight: 700;
          line-height: 1.4 !important;
          vertical-align: middle;
          white-space: nowrap;
          box-sizing: border-box !important;
        }
        .badge-unit {
          background-color: #f3e8ff !important;
          color: #6b21a8 !important;
          border: 1px solid #d8b4fe !important;
        }
      </style>
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #0f172a; background: #ffffff;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #059669; padding-bottom: 12px; margin-bottom: 15px;">
          <div>
            <div style="font-size: 20px; font-weight: 800; color: #059669;">Relatório de Limpezas</div>
            <div style="font-size: 12px; font-weight: 600; color: #475569; margin-top: 2px;">Resumo Operacional & Financeiro</div>
          </div>
          <div style="text-align: right; font-size: 10px; color: #64748b;">
            Emissão: ${new Date().toLocaleDateString('pt-BR')}
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; margin-bottom: 15px; font-size: 11px;">
          <div><span style="color: #64748b; font-size: 9px; display: block; font-weight: bold;">CLIENTE</span><strong>${clientSelectedName}</strong></div>
          <div><span style="color: #64748b; font-size: 9px; display: block; font-weight: bold;">CATEGORIA</span><strong>${categoryText}</strong></div>
          <div><span style="color: #64748b; font-size: 9px; display: block; font-weight: bold;">UNIDADE</span><strong>${selectedUnit !== 'all' ? selectedUnit : 'Todas'}</strong></div>
          <div><span style="color: #64748b; font-size: 9px; display: block; font-weight: bold;">PERÍODO</span><strong>${periodText}</strong></div>
          <div><span style="color: #64748b; font-size: 9px; display: block; font-weight: bold;">REGISTROS</span><strong>${filteredJobs.length} limpeza(s)</strong></div>
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

        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 15px;">
          <div style="font-size: 9px; color: #94a3b8;">Relatório gerado via Gestão de Limpezas.</div>
          <div style="background: #ecfdf5; border: 1px solid #a7f3d0; padding: 10px 16px; border-radius: 8px; text-align: right;">
            <span style="color: #047857; font-size: 10px; font-weight: 700; display: block;">VALOR TOTAL</span>
            <h2 style="color: #065f46; margin: 2px 0 0 0; font-size: 18px;">$${totalValor.toFixed(2)}</h2>
          </div>
        </div>
      </div>
    `
  }

  // Baixar PDF impresso pelo navegador
  const handleGeneratePDF = () => {
    if (filteredJobs.length === 0) {
      alert('Nenhuma limpeza encontrada para gerar o PDF.')
      return
    }

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.open()
      printWindow.document.write(`
        <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Relatório de Limpezas</title></head>
        <body>${buildPdfHtml()}</body></html>
      `)
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

  // Partilhar PDF / Relatório via WhatsApp
  const handleSharePDF = async () => {
    if (filteredJobs.length === 0) {
      alert('Nenhuma limpeza encontrada para partilhar.')
      return
    }

    setIsGeneratingPdf(true)

    try {
      const html2pdf = (await import('html2pdf.js')).default
      const container = document.createElement('div')
      container.innerHTML = buildPdfHtml()
      document.body.appendChild(container)

      const fileName = `Relatorio_Limpezas_${new Date().toISOString().split('T')[0]}.pdf`

      const opt = {
        margin: 5,
        filename: fileName,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' as const }
      }

      const pdfBlob = await html2pdf().set(opt).from(container).output('blob')
      document.body.removeChild(container)

      const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' })

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        try {
          await navigator.share({
            files: [pdfFile],
            title: 'Relatório de Limpezas',
            text: 'Segue o relatório de limpezas em PDF.'
          })
          setIsGeneratingPdf(false)
          return
        } catch (shareErr) {
          console.warn('Partilha nativa cancelada ou bloqueada, executando fallback de download.', shareErr)
        }
      }

      const link = document.createElement('a')
      link.href = URL.createObjectURL(pdfBlob)
      link.download = fileName
      link.click()
      
      alert('O PDF foi gerado e descarregado com sucesso! Agora podes anexá-lo diretamente na conversa do WhatsApp.')
    } catch (err) {
      console.error('Erro ao gerar o PDF:', err)
      alert('Ocorreu um erro ao gerar o relatório.')
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 space-y-6 overflow-x-hidden">
      {/* Topbar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-lg sm:text-xl font-bold text-emerald-400">Histórico de Limpezas</h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSharePDF}
            disabled={isGeneratingPdf}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-3 py-2 sm:px-4 sm:py-2 rounded-xl text-xs flex items-center gap-1.5 sm:gap-2 transition cursor-pointer active:scale-95 shadow-md shrink-0 disabled:opacity-50"
          >
            {isGeneratingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
            <span className="hidden xs:inline">{isGeneratingPdf ? 'Gerando...' : 'Partilhar'}</span>
          </button>

          <button
            onClick={handleGeneratePDF}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-3 py-2 sm:px-4 sm:py-2 rounded-xl text-xs flex items-center gap-1.5 sm:gap-2 transition cursor-pointer active:scale-95 border border-slate-700 shrink-0"
          >
            <FileText className="w-4 h-4" /> <span className="hidden xs:inline">Baixar</span>
          </button>
        </div>
      </div>

      {/* Filtros Responsivos */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 bg-slate-900/60 border border-slate-800 rounded-xl p-3 w-full max-w-full box-border overflow-hidden">
        <div className="flex items-center gap-2 text-slate-500 font-medium text-xs">
          <Filter className="w-4 h-4 shrink-0" />
          <span className="sm:hidden text-slate-400">Filtros:</span>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center w-full sm:w-auto min-w-0">
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 w-full min-w-0">
            <span className="text-xs text-slate-400 shrink-0">De:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-xs text-white focus:outline-none w-full min-w-0"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 w-full min-w-0">
            <span className="text-xs text-slate-400 shrink-0">Até:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-xs text-white focus:outline-none w-full min-w-0"
            />
          </div>
        </div>

        <select
          value={selectedClient}
          onChange={(e) => setSelectedClient(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium w-full max-w-full sm:w-auto min-w-0 truncate"
        >
          <option value="all">Todos os clientes</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {/* Filtro de Categoria */}
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value as 'all' | 'common_area' | 'unit')}
          className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium w-full max-w-full sm:w-auto min-w-0 truncate"
        >
          <option value="all">🏢 All Types (Common Area & Units)</option>
          <option value="common_area">🧹 Common Area Only</option>
          <option value="unit">🔑 Units / Move-in & Move-out Only</option>
        </select>

        {availableUnits.length > 0 && (
          <select
            value={selectedUnit}
            onChange={(e) => setSelectedUnit(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium w-full max-w-full sm:w-auto min-w-0 truncate"
          >
            <option value="all">Todas as unidades</option>
            {availableUnits.map((u) => (
              <option key={u} value={u}>
                Unidade: {u}
              </option>
            ))}
          </select>
        )}

        <div className="flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto sm:ml-auto pt-1 sm:pt-0 border-t border-slate-800/60 sm:border-t-0">
          {(startDate || endDate || selectedClient !== 'all' || selectedUnit !== 'all' || selectedCategory !== 'all') && (
            <button
              onClick={() => {
                setStartDate('')
                setEndDate('')
                setSelectedClient('all')
                setSelectedUnit('all')
                setSelectedCategory('all')
              }}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 bg-slate-800/50 hover:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-700/50 transition cursor-pointer"
            >
              <X className="w-3 h-3" /> Limpar filtros
            </button>
          )}

          <span className="text-xs text-slate-500 ml-auto sm:ml-0 font-medium">
            {filteredJobs.length} {filteredJobs.length === 1 ? 'limpeza' : 'limpezas'}
          </span>
        </div>
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
          <p className="text-slate-500 text-sm mt-1">Tente outro intervalo de datas, cliente, categoria ou unidade.</p>
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
                className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 overflow-hidden"
              >
                <div className="space-y-1.5 w-full lg:w-auto min-w-0">
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

                  {unitName && (
                    <div className="bg-purple-950/40 border border-purple-800/40 text-purple-300 px-2.5 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1.5 max-w-full">
                      <Home className="w-3 h-3 text-purple-400 shrink-0" />
                      <span className="truncate">{unitName}</span>
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

                <div className="flex flex-wrap items-center justify-between lg:justify-end gap-4 text-xs text-slate-300 pt-2 lg:pt-0 border-t border-slate-800/50 lg:border-t-0">
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