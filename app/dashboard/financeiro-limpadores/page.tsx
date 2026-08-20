'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface CleanerRepasse {
  cleanerId: string
  cleanerName: string
  cleanerEmail: string
  totalServicos: number
  totalPayout: number
}

export default function FinanceiroLimpadoresPage() {
  const now = new Date()
  const [year, setYear] = useState<number>(now.getFullYear())
  const [month, setMonth] = useState<number>(now.getMonth() + 1)
  const [fortnight, setFortnight] = useState<number>(now.getDate() <= 15 ? 1 : 2)

  const [relatorio, setRelatorio] = useState<CleanerRepasse[]>([])
  const [loading, setLoading] = useState(true)
  const [totalGeral, setTotalGeral] = useState<number>(0)

  useEffect(() => {
    carregarFinanceiroQuinzenal()
  }, [year, month, fortnight])

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

    // Consulta buscando repasse base, extra do serviço e o repasse padrão do cliente
    const { data: agendamentos, error } = await supabase
      .from('jobs')
      .select(`
        id,
        payout,
        extra_payout,
        scheduled_date,
        cleaner_id,
        cleaners ( id, name, email ),
        clients ( cleaner_payout )
      `)
      .gte('scheduled_date', startDate)
      .lte('scheduled_date', endDate)

    if (error) {
      console.error('Erro ao carregar repasses quinzenais:', error)
      setLoading(false)
      return
    }

    const agrupado = (agendamentos || []).reduce((acc: Record<string, CleanerRepasse>, item: any) => {
      const cleanerId = item.cleaner_id || 'sem-id'
      const cleanerName = item.cleaners?.name || 'Limpadora não identificada'
      const cleanerEmail = item.cleaners?.email || '-'

      // Repasse base do serviço (se não houver no job, busca o padrão do cliente)
      const basePayout = Number(item.payout) || Number(item.clients?.cleaner_payout) || 0
      // Valor extra (gorjeta, ajuda de custo, etc)
      const extraPayout = Number(item.extra_payout) || 0

      // Valor total do repasse para esta limpeza
      const totalJobPayout = basePayout + extraPayout

      if (!acc[cleanerId]) {
        acc[cleanerId] = {
          cleanerId,
          cleanerName,
          cleanerEmail,
          totalServicos: 0,
          totalPayout: 0,
        }
      }

      acc[cleanerId].totalServicos += 1
      acc[cleanerId].totalPayout += totalJobPayout

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
            {relatorio.map((item) => (
              <div
                key={item.cleanerId}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition"
              >
                <div className="space-y-1">
                  <h4 className="font-bold text-gray-800 text-lg">{item.cleanerName}</h4>
                  <p className="text-xs text-gray-500">{item.cleanerEmail}</p>
                  <span className="inline-block bg-emerald-50 text-emerald-700 text-xs px-3 py-1 rounded-full font-medium">
                    {item.totalServicos} {item.totalServicos === 1 ? 'serviço realizado' : 'serviços realizados'}
                  </span>
                </div>

                <div className="bg-emerald-50 sm:bg-transparent p-4 sm:p-0 rounded-xl text-left sm:text-right border sm:border-none border-emerald-100">
                  <span className="text-xs text-gray-500 block font-medium">Total a pagar nesta quinzena</span>
                  <span className="text-3xl font-extrabold text-emerald-600">
                    ${item.totalPayout.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}