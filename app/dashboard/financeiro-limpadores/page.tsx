'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface JobDetail {
  id: string
  date: string
  clientName: string
  unitLabel: string | null
  payout: number
}

interface CleanerRepasse {
  cleanerId: string
  cleanerName: string
  cleanerEmail: string
  totalServicos: number
  totalPayout: number
  servicos: JobDetail[]
}

// Extrai o nome da unidade ou área comum
function getJobUnitLabel(item: any) {
  if (item.unit_details) {
    return item.unit_details
  }
  if (item.notes) {
    const matchUnit = item.notes.match(/\[Unidade\/Especificação:\s*([^\]]+)\]/)
    if (matchUnit && matchUnit[1]) return matchUnit[1].trim()

    const matchArea = item.notes.match(/\[Área Comum:\s*([^\]]+)\]/)
    if (matchArea && matchArea[1]) return matchArea[1].trim()
  }
  return null
}

export default function FinanceiroLimpadoresPage() {
  const now = new Date()
  const [year, setYear] = useState<number>(now.getFullYear())
  const [month, setMonth] = useState<number>(now.getMonth() + 1)
  const [fortnight, setFortnight] = useState<number>(now.getDate() <= 15 ? 1 : 2)

  const [relatorio, setRelatorio] = useState<CleanerRepasse[]>([])
  const [loading, setLoading] = useState(true)
  const [totalGeral, setTotalGeral] = useState<number>(0)
  const [expandedCleanerId, setExpandedCleanerId] = useState<string | null>(null)

  useEffect(() => {
    carregarFinanceiroQuinzenal()
  }, [year, month, fortnight])

  const toggleExpand = (cleanerId: string) => {
    setExpandedCleanerId((prev) => (prev === cleanerId ? null : cleanerId))
  }

  async function carregarFinanceiroQuinzenal() {
    setLoading(true)

    const monthFormatted = String(month).padStart(2, '0')
    let startDate = ''
    let endDate = ''

    if (fortnight === 1) {
      startDate = `${year}-${monthFormatted}-01`
      endDate = `${year}-${monthFormatted}-15`
    } else {
      const lastDay = new Date(year, month, 0).getDate()
      startDate = `${year}-${monthFormatted}-16`
      endDate = `${year}-${monthFormatted}-${lastDay}`
    }

    // Busca incluindo detalhes do serviço, cliente e unidade
    const { data: agendamentos, error } = await supabase
      .from('jobs')
      .select(`
        id,
        payout,
        extra_payout,
        scheduled_date,
        cleaner_id,
        unit_details,
        notes,
        target_type,
        cleaners ( id, name, email ),
        clients ( name, cleaner_payout )
      `)
      .gte('scheduled_date', startDate)
      .lte('scheduled_date', endDate)
      .order('scheduled_date', { ascending: true })

    if (error) {
      console.error('Erro ao carregar repasses quinzenais:', error)
      setLoading(false)
      return
    }

    const agrupado = (agendamentos || []).reduce((acc: Record<string, CleanerRepasse>, item: any) => {
      const cleanerId = item.cleaner_id || 'sem-id'
      const cleanerName = item.cleaners?.name || 'Limpadora não identificada'
      const cleanerEmail = item.cleaners?.email || '-'

      const basePayout = Number(item.payout) || Number(item.clients?.cleaner_payout) || 0
      const extraPayout = Number(item.extra_payout) || 0
      const totalJobPayout = basePayout + extraPayout

      if (!acc[cleanerId]) {
        acc[cleanerId] = {
          cleanerId,
          cleanerName,
          cleanerEmail,
          totalServicos: 0,
          totalPayout: 0,
          servicos: [],
        }
      }

      acc[cleanerId].totalServicos += 1
      acc[cleanerId].totalPayout += totalJobPayout
      acc[cleanerId].servicos.push({
        id: item.id,
        date: item.scheduled_date,
        clientName: item.clients?.name || 'Cliente sem nome',
        unitLabel: getJobUnitLabel(item),
        payout: totalJobPayout,
      })

      return acc
    }, {})

    const lista = Object.values(agrupado) as CleanerRepasse[]
    const somaTotal = lista.reduce((sum: number, item: CleanerRepasse) => sum + item.totalPayout, 0)

    setRelatorio(lista)
    setTotalGeral(somaTotal)
    setLoading(false)
  }

  const meses = [
    { value: 1, label: 'Janeiro' },
    { value: 2, label: 'Fevereiro' },
    { value: 3, label: 'Março' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Maio' },
    { value: 6, label: 'Junho' },
    { value: 7, label: 'Julho' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Setembro' },
    { value: 10, label: 'Outubro' },
    { value: 11, label: 'Novembro' },
    { value: 12, label: 'Dezembro' },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Fechamento das Limpadoras</h1>
          <p className="text-gray-500 text-sm">Cálculo quinzenal de repasses e serviços</p>
        </div>

        <div className="flex flex-wrap gap-2 bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
          <select
            value={fortnight}
            onChange={(e) => setFortnight(Number(e.target.value))}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm bg-white font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value={1}>1ª Quinzena (01 a 15)</option>
            <option value={2}>2ª Quinzena (16 ao fim do mês)</option>
          </select>

          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm bg-white font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {meses.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>

          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm bg-white font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-6 rounded-2xl shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-emerald-100 text-xs font-semibold uppercase tracking-wider">
            Total gasto com repasses nesta quinzena
          </span>
          <h2 className="text-4xl font-extrabold mt-1">
            ${totalGeral.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h2>
          <p className="text-emerald-100 text-xs mt-1">
            Período: {fortnight === 1 ? '01 a 15' : '16 ao fim'} de {meses.find((m) => m.value === month)?.label} / {year}
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-xl border border-white/20 text-center">
          <span className="block text-2xl font-bold">{relatorio.length}</span>
          <span className="text-xs text-emerald-100">Limpadoras com repasse</span>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
          <h3 className="font-semibold text-gray-700 text-sm">Resumo por Limpadora</h3>
          <span className="text-xs text-gray-500">{relatorio.length} participante(s)</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-500 animate-pulse">
            Carregando fechamento quinzenal...
          </div>
        ) : relatorio.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            Nenhum serviço realizado na {fortnight}ª quinzena de {meses.find((m) => m.value === month)?.label}.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {relatorio.map((item) => {
              const isExpanded = expandedCleanerId === item.cleanerId

              return (
                <div key={item.cleanerId} className="flex flex-col">
                  {/* Item do Cabeçalho (Clicável para expandir) */}
                  <div
                    onClick={() => toggleExpand(item.cleanerId)}
                    className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50 transition"
                  >
                    <div className="space-y-1">
                      <h4 className="font-bold text-gray-800 text-lg">{item.cleanerName}</h4>
                      <p className="text-xs text-gray-500">{item.cleanerEmail}</p>

                      <div className="flex items-center gap-2 pt-1">
                        <span className="inline-block bg-emerald-50 text-emerald-700 text-xs px-3 py-1 rounded-full font-medium">
                          {item.totalServicos} {item.totalServicos === 1 ? 'serviço realizado' : 'serviços realizados'}
                        </span>
                        <span className="text-xs text-emerald-600 font-medium hover:underline">
                          {isExpanded ? '▲ Ocultar detalhes' : '▼ Ver quais foram'}
                        </span>
                      </div>
                    </div>

                    <div className="bg-emerald-50 sm:bg-transparent p-4 sm:p-0 rounded-xl text-left sm:text-right border sm:border-none border-emerald-100">
                      <span className="text-xs text-gray-500 block font-medium">Total a pagar nesta quinzena</span>
                      <span className="text-3xl font-extrabold text-emerald-600">
                        ${item.totalPayout.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Detalhes expansíveis com a lista das limpezas */}
                  {isExpanded && (
                    <div className="bg-slate-50 p-4 border-t border-gray-100 divide-y divide-gray-200/80">
                      <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                        Detalhamento das Limpezas:
                      </p>
                      {item.servicos.map((svc) => (
                        <div key={svc.id} className="py-2.5 flex items-center justify-between text-xs">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-gray-900">{svc.clientName}</span>
                              {svc.unitLabel && (
                                <span className="bg-purple-700 text-white border border-purple-800 px-2.5 py-0.5 rounded-md font-bold text-[11px] shadow-sm">
                                  {svc.unitLabel}
                                </span>
                              )}
                            </div>
                            <span className="text-gray-500 text-[11px]">
                              {new Date(`${svc.date}T00:00:00`).toLocaleDateString('pt-BR')}
                            </span>
                          </div>

                          <span className="font-bold text-gray-700 bg-white border border-gray-200 px-2.5 py-1 rounded shadow-sm">
                            Repasse: ${svc.payout.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}