'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface JobDetail {
  id: string
  date: string
  clientName: string
  unitLabel: string | null
  payout: number
  isHelper: boolean
  roleLabel?: string
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
  const yearStr = now.getFullYear()
  const monthStr = String(now.getMonth() + 1).padStart(2, '0')

  // Intervalo livre de datas (padrão: do dia 1º ao último dia do mês atual)
  const [startDate, setStartDate] = useState<string>(`${yearStr}-${monthStr}-01`)
  const [endDate, setEndDate] = useState<string>(() => {
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    return `${yearStr}-${monthStr}-${String(lastDay).padStart(2, '0')}`
  })

  const [relatorio, setRelatorio] = useState<CleanerRepasse[]>([])
  const [loading, setLoading] = useState(true)
  const [totalGeral, setTotalGeral] = useState<number>(0)
  const [expandedCleanerId, setExpandedCleanerId] = useState<string | null>(null)

  // Estado para controlar o modal do PDF
  const [pdfCleaner, setPdfCleaner] = useState<CleanerRepasse | null>(null)
  const [isSharing, setIsSharing] = useState(false)

  useEffect(() => {
    carregarFinanceiroPorPeriodo()
  }, [startDate, endDate])

  const toggleExpand = (cleanerId: string) => {
    setExpandedCleanerId((prev) => (prev === cleanerId ? null : cleanerId))
  }

  async function carregarFinanceiroPorPeriodo() {
    setLoading(true)

    const sDate = startDate <= endDate ? startDate : endDate
    const eDate = startDate <= endDate ? endDate : startDate

    try {
      // Busca limpa em paralelo para evitar erros de Foreign Key no Supabase
      const [jobsRes, cleanersRes, clientsRes] = await Promise.all([
        supabase
          .from('jobs')
          .select('*')
          .gte('scheduled_date', sDate)
          .lte('scheduled_date', eDate)
          .order('scheduled_date', { ascending: true }),
        supabase.from('cleaners').select('id, name, email'),
        supabase.from('clients').select('id, name, cleaner_payout')
      ])

      if (jobsRes.error) throw jobsRes.error
      if (cleanersRes.error) throw cleanersRes.error

      const cleanersList = cleanersRes.data || []
      const clientsList = clientsRes.data || []

      const cleanersById = new Map(cleanersList.map((c) => [c.id, c]))
      const clientsById = new Map(clientsList.map((cl) => [cl.id, cl]))

      const agrupado: Record<string, CleanerRepasse> = {}

      const initializeCleaner = (id: string, name: string, email: string) => {
        if (!agrupado[id]) {
          agrupado[id] = {
            cleanerId: id,
            cleanerName: name,
            cleanerEmail: email || '-',
            totalServicos: 0,
            totalPayout: 0,
            servicos: [],
          }
        }
      }

      (jobsRes.data || []).forEach((item: any) => {
        const unitLabel = getJobUnitLabel(item)
        const clientObj = clientsById.get(item.client_id)
        const clientName = clientObj?.name || 'Cliente sem nome'

        // A. Processa Limpadora Principal
        if (item.cleaner_id) {
          const mainCleaner = cleanersById.get(item.cleaner_id)
          if (mainCleaner) {
            const cId = mainCleaner.id
            const cName = mainCleaner.name
            const cEmail = mainCleaner.email || '-'

            const basePayout = Number(item.payout) || Number(clientObj?.cleaner_payout) || 0
            const extraPayout = Number(item.extra_payout) || 0
            const totalMainPayout = basePayout + extraPayout

            initializeCleaner(cId, cName, cEmail)

            agrupado[cId].totalServicos += 1
            agrupado[cId].totalPayout += totalMainPayout
            agrupado[cId].servicos.push({
              id: `${item.id}-main`,
              date: item.scheduled_date,
              clientName: clientName,
              unitLabel: unitLabel,
              payout: totalMainPayout,
              isHelper: false,
              roleLabel: 'Limpeza Principal'
            })
          }
        }

        // B. Processa Helper (se houver)
        if (item.has_helper && item.helper_id) {
          const helperCleaner = cleanersById.get(item.helper_id)
          if (helperCleaner) {
            const hId = helperCleaner.id
            const hName = helperCleaner.name
            const hEmail = helperCleaner.email || '-'
            const hPayout = Number(item.helper_payout) || 0

            initializeCleaner(hId, hName, hEmail)

            agrupado[hId].totalServicos += 1
            agrupado[hId].totalPayout += hPayout
            agrupado[hId].servicos.push({
              id: `${item.id}-helper`,
              date: item.scheduled_date,
              clientName: clientName,
              unitLabel: unitLabel,
              payout: hPayout,
              isHelper: true,
              roleLabel: 'Ajudante (Helper)'
            })
          }
        }
      })

      const lista = Object.values(agrupado) as CleanerRepasse[]
      const somaTotal = lista.reduce((sum: number, item: CleanerRepasse) => sum + item.totalPayout, 0)

      setRelatorio(lista)
      setTotalGeral(somaTotal)
    } catch (error) {
      console.error('Erro ao carregar repasses do período:', error)
    } finally {
      setLoading(false)
    }
  }

  // Formata datas para o cabeçalho do holerite / PDF
  const formatDateBR = (dateStr: string) => {
    if (!dateStr) return ''
    const [y, m, d] = dateStr.split('-')
    return `${d}/${m}/${y}`
  }

  // Função para compartilhar o PDF pelo WhatsApp
  const handleShareWhatsAppPDF = async () => {
    if (!pdfCleaner) return
    setIsSharing(true)

    try {
      // @ts-ignore
      const html2pdf = (await import('html2pdf.js')).default

      const fileName = `Holerite_${pdfCleaner.cleanerName.replace(/\s+/g, '_')}_${startDate}_a_${endDate}.pdf`

      const rows = pdfCleaner.servicos.map(svc => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 8px 4px;">${new Date(`${svc.date}T00:00:00`).toLocaleDateString('pt-BR')}</td>
          <td style="padding: 8px 4px;">
            <strong style="color: #0f172a; display: block;">${svc.clientName}</strong>
            <div style="display: flex; gap: 4px; align-items: center; margin-top: 2px;">
              ${svc.unitLabel ? `<span style="color: #7e22ce; font-size: 10px; font-weight: bold; background-color: #f3e8ff; padding: 1px 4px; border-radius: 3px;">${svc.unitLabel}</span>` : ''}
              ${svc.isHelper ? `<span style="color: #0284c7; font-size: 9px; font-weight: bold; background-color: #e0f2fe; padding: 1px 4px; border-radius: 3px;">🤝 Helper</span>` : ''}
            </div>
          </td>
          <td style="padding: 8px 4px; text-align: right; font-weight: bold; color: #0f172a;">$${svc.payout.toFixed(2)}</td>
        </tr>
      `).join('')

      const element = document.createElement('div')
      element.innerHTML = `
        <div style="padding: 20px; font-family: Arial, sans-serif; color: #0f172a; background-color: #ffffff;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 16px;">
            <div>
              <h1 style="font-size: 20px; font-weight: 900; color: #047857; margin: 0; text-transform: uppercase;">Brazilian Cleaners</h1>
              <p style="font-size: 11px; color: #64748b; margin: 2px 0 0 0;">Demonstrativo de Repasse de Serviços</p>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 9px; font-weight: bold; color: #94a3b8; text-transform: uppercase; display: block;">PERÍODO</span>
              <span style="font-size: 11px; font-weight: bold; color: #334155; display: block;">
                ${formatDateBR(startDate)} até ${formatDateBR(endDate)}
              </span>
            </div>
          </div>

          <div style="background-color: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 16px;">
            <span style="font-size: 9px; font-weight: bold; color: #94a3b8; text-transform: uppercase; display: block;">Profissional</span>
            <strong style="font-size: 14px; color: #1e293b;">${pdfCleaner.cleanerName}</strong>
            ${pdfCleaner.cleanerEmail ? `<p style="font-size: 11px; color: #64748b; margin: 2px 0 0 0;">${pdfCleaner.cleanerEmail}</p>` : ''}
          </div>

          <table style="width: 100%; text-align: left; font-size: 11px; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr style="border-bottom: 1px solid #94a3b8; color: #64748b;">
                <th style="padding: 6px 4px;">Data</th>
                <th style="padding: 6px 4px;">Unidade / Cliente</th>
                <th style="padding: 6px 4px; text-align: right;">Repasse</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>

          <div style="border-top: 2px solid #0f172a; padding-top: 12px; display: flex; justify-content: space-between; align-items: center;">
            <p style="font-size: 10px; color: #64748b; font-style: italic; margin: 0;">Obrigado pela sua parceria!</p>
            <div style="text-align: right;">
              <span style="font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase; display: block;">TOTAL A RECEBER</span>
              <span style="font-size: 20px; font-weight: 900; color: #047857;">
                $${pdfCleaner.totalPayout.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      `

      const opt = {
        margin: 8,
        filename: fileName,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
      }

      const pdfBlob = await html2pdf().set(opt).from(element).output('blob')
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' })

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Holerite - ${pdfCleaner.cleanerName}`,
          text: `Olá ${pdfCleaner.cleanerName}, segue em anexo o teu comprovativo de repasse referente ao período de ${formatDateBR(startDate)} a ${formatDateBR(endDate)}.`
        })
      } else {
        const url = URL.createObjectURL(pdfBlob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        a.click()

        alert('O PDF foi descarregado. A abrir o WhatsApp Web para anexares o ficheiro...')
        window.open('https://web.whatsapp.com', '_blank')
      }
    } catch (error) {
      console.error('Erro ao partilhar o PDF:', error)
      alert('Ocorreu um erro ao gerar/partilhar o PDF.')
    } finally {
      setIsSharing(false)
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-holerite, #printable-holerite * {
            visibility: visible;
          }
          #printable-holerite {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20px;
          }
        }
      `}</style>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Fechamento das Limpadoras</h1>
          <p className="text-gray-500 text-sm">Cálculo de repasses por período personalizado (Inclui Helpers)</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-white p-2.5 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-gray-500">De:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs bg-white font-medium text-gray-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-gray-500">Até:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs bg-white font-medium text-gray-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      <div className="bg-linear-to-r from-emerald-600 to-teal-700 text-white p-6 rounded-2xl shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-emerald-100 text-xs font-semibold uppercase tracking-wider">
            Total gasto com repasses neste período
          </span>
          <h2 className="text-4xl font-extrabold mt-1">
            ${totalGeral.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h2>
          <p className="text-emerald-100 text-xs mt-1">
            Período: {formatDateBR(startDate)} até {formatDateBR(endDate)}
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-xl border border-white/20 text-center">
          <span className="block text-2xl font-bold">{relatorio.length}</span>
          <span className="text-xs text-emerald-100">Limpadoras com repasse</span>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
          <h3 className="font-semibold text-gray-700 text-sm">Resumo por Limpadora</h3>
          <span className="text-xs text-gray-500">{relatorio.length} participante(s)</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-500 animate-pulse">
            Carregando fechamento do período...
          </div>
        ) : relatorio.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            Nenhum serviço realizado no período de {formatDateBR(startDate)} a {formatDateBR(endDate)}.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {relatorio.map((item) => {
              const isExpanded = expandedCleanerId === item.cleanerId

              return (
                <div key={item.cleanerId} className="flex flex-col">
                  <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition">
                    <div className="space-y-1">
                      <h4 className="font-bold text-gray-800 text-lg">{item.cleanerName}</h4>
                      <p className="text-xs text-gray-500">{item.cleanerEmail}</p>

                      <div className="flex items-center gap-3 pt-1">
                        <span className="inline-block bg-emerald-50 text-emerald-700 text-xs px-3 py-1 rounded-full font-medium">
                          {item.totalServicos} {item.totalServicos === 1 ? 'trabalho realizado' : 'trabalhos realizados'}
                        </span>

                        <button
                          type="button"
                          onClick={() => toggleExpand(item.cleanerId)}
                          className="text-xs text-emerald-600 font-medium hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          {isExpanded ? '▲ Ocultar detalhes' : '▼ Ver quais foram'}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-left sm:text-right">
                        <span className="text-xs text-gray-500 block font-medium">Total a pagar neste período</span>
                        <span className="text-3xl font-extrabold text-emerald-600">
                          ${item.totalPayout.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setPdfCleaner(item)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-sm cursor-pointer transition shrink-0"
                      >
                        📄 Gerar PDF / Holerite
                      </button>
                    </div>
                  </div>

                  {/* Detalhes expansíveis com a lista das limpezas */}
                  {isExpanded && (
                    <div className="bg-slate-50 p-4 border-t border-gray-100 divide-y divide-gray-200/80">
                      <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                        Detalhamento dos Serviços:
                      </p>
                      {item.servicos.map((svc) => (
                        <div key={svc.id} className="py-2.5 flex items-center justify-between text-xs">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-gray-900">{svc.clientName}</span>
                              {svc.unitLabel && (
                                <span className="bg-purple-700 text-white border border-purple-800 px-2.5 py-0.5 rounded-md font-bold text-[11px] shadow-xs">
                                  {svc.unitLabel}
                                </span>
                              )}
                              {svc.isHelper && (
                                <span className="bg-sky-100 text-sky-800 border border-sky-300 px-2 py-0.5 rounded-md font-bold text-[10px]">
                                  🤝 Helper
                                </span>
                              )}
                            </div>
                            <span className="text-gray-500 text-[11px]">
                              {new Date(`${svc.date}T00:00:00`).toLocaleDateString('pt-BR')}
                            </span>
                          </div>

                          <span className="font-bold text-gray-700 bg-white border border-gray-200 px-2.5 py-1 rounded-sm shadow-xs">
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

      {/* MODAL HOLERITE / GERAR PDF */}
      {pdfCleaner && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-gray-200 w-full max-w-2xl rounded-2xl p-6 shadow-2xl relative space-y-6 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b pb-4 sticky top-0 bg-white z-10 pt-1">
              <h3 className="text-sm font-bold text-gray-700">Comprovante de Pagamento</h3>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleShareWhatsAppPDF}
                  disabled={isSharing}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition disabled:opacity-50"
                >
                  {isSharing ? '⌛ Gerando...' : '📱 Partilhar no WhatsApp'}
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition"
                >
                  🖨️ Imprimir / Salvar PDF
                </button>
                <button
                  type="button"
                  onClick={() => setPdfCleaner(null)}
                  className="p-2 text-gray-400 hover:text-gray-700 cursor-pointer text-lg font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Conteúdo imprimível e convertível em PDF */}
            <div id="printable-holerite" className="bg-white text-gray-900 p-2 space-y-6">
              <div className="flex justify-between items-start border-b border-gray-200 pb-4">
                <div>
                  <h1 className="text-2xl font-black text-emerald-700 uppercase">Brazilian Cleaners</h1>
                  <p className="text-xs text-gray-500">Demonstrativo de Repasse de Serviços</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-gray-400 block uppercase">PERÍODO</span>
                  <span className="text-xs font-bold text-gray-700 block">
                    {formatDateBR(startDate)} até {formatDateBR(endDate)}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-gray-200 text-xs">
                <span className="text-gray-400 font-bold block text-[10px] uppercase">Profissional</span>
                <strong className="text-base text-gray-800">{pdfCleaner.cleanerName}</strong>
                {pdfCleaner.cleanerEmail && <p className="text-gray-500">{pdfCleaner.cleanerEmail}</p>}
              </div>

              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-300 text-gray-500">
                    <th className="py-2">Data</th>
                    <th className="py-2">Unidade / Cliente</th>
                    <th className="py-2 text-right">Repasse</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pdfCleaner.servicos.map((svc) => (
                    <tr key={svc.id}>
                      <td className="py-2.5">
                        {new Date(`${svc.date}T00:00:00`).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="py-2.5">
                        <span className="font-bold block text-gray-900">{svc.clientName}</span>
                        <div className="flex items-center gap-1 mt-0.5">
                          {svc.unitLabel && (
                            <span className="text-[10px] text-purple-700 font-semibold">
                              {svc.unitLabel}
                            </span>
                          )}
                          {svc.isHelper && (
                            <span className="text-[9px] text-sky-700 bg-sky-50 px-1 rounded font-bold border border-sky-200">
                              🤝 Helper
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 text-right font-bold text-gray-900">
                        ${svc.payout.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="border-t-2 border-gray-900 pt-4 flex justify-between items-center">
                <p className="text-[11px] text-gray-500 italic">Obrigado pela sua parceria!</p>
                <div className="text-right">
                  <span className="text-xs font-bold text-gray-500 block uppercase">TOTAL A RECEBER</span>
                  <span className="text-2xl font-black text-emerald-600">
                    ${pdfCleaner.totalPayout.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}