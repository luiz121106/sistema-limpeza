'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  ArrowLeft,
  Plus,
  ChevronLeft,
  ChevronRight,
  List,
  Calendar,
  Clock,
  MapPin,
  Home,
  UserCheck,
  Edit,
  Trash2,
  Copy,
  Repeat
} from 'lucide-react'

// Tipagens
interface Client {
  id: string
  name: string
  address?: string
  client_type?: string
}

interface Cleaner {
  id: string
  name: string
  email?: string
}

interface Job {
  id: string
  client_id: string
  property_id?: string
  cleaner_id?: string
  cleaner_name?: string
  scheduled_date: string
  scheduled_time: string
  service_type: string
  price: number
  extra_price?: number
  payout?: number
  extra_payout?: number
  status: 'pending' | 'in_progress' | 'completed'
  notes?: string
  target_type?: 'unit' | 'common_area'
  selected_common_areas?: any[]
  unit_details?: string
  clients?: Client
  cleaners?: Cleaner
}

interface CalendarDay {
  dateStr: string
  label: string
  isToday: boolean
  isCurrentMonth: boolean
}

export interface PropertyCommonArea {
  id: string
  property_id?: string
  client_id?: string
  name: string
  client_price: number
  cleaner_price: number
}

const SERVICE_TYPE_STYLES: Record<string, { bg: string; border: string; badge: string; label: string }> = {
  Standard: {
    bg: 'bg-emerald-950/20 hover:bg-emerald-950/40',
    border: 'border-emerald-500/40',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    label: 'Standard'
  },
  Pesada: {
    bg: 'bg-amber-950/20 hover:bg-amber-950/40',
    border: 'border-amber-500/40',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    label: 'Pesada'
  },
  'Move-In/Out': {
    bg: 'bg-rose-950/20 hover:bg-rose-950/40',
    border: 'border-rose-500/40',
    badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    label: 'Move-In/Out'
  },
  Vacation: {
    bg: 'bg-purple-950/20 hover:bg-purple-950/40',
    border: 'border-purple-500/40',
    badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    label: 'Vacation / Airbnb'
  },
  Complex: {
    bg: 'bg-sky-950/20 hover:bg-sky-950/40',
    border: 'border-sky-500/40',
    badge: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    label: 'Complex'
  },
  Residencial: {
    bg: 'bg-indigo-950/20 hover:bg-indigo-950/40',
    border: 'border-indigo-500/40',
    badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    label: 'Residencial'
  }
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month' | 'list'>('month')
  const [jobs, setJobs] = useState<Job[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [cleaners, setCleaners] = useState<Cleaner[]>([])
  const [loading, setLoading] = useState(true)

  // Modal State
  const [showModal, setShowModal] = useState(false)
  const [editingJobId, setEditingJobId] = useState<string | null>(null)
  const [clientId, setClientId] = useState('')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [unitDetails, setUnitDetails] = useState('')
  const [cleanerId, setCleanerId] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('09:00')
  const [serviceType, setServiceType] = useState('Standard')
  const [price, setPrice] = useState('')
  const [extraPrice, setExtraPrice] = useState('0')
  const [payout, setPayout] = useState('')
  const [extraPayout, setExtraPayout] = useState('0')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [targetType, setTargetType] = useState<'unit' | 'common_area'>('unit')
  const [availableAreas, setAvailableAreas] = useState<PropertyCommonArea[]>([])
  const [selectedAreaIds, setSelectedAreaIds] = useState<string[]>([])
  
  // Recorrência
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrenceFrequency, setRecurrenceFrequency] = useState('weekly')
  const [recurrenceUntil, setRecurrenceUntil] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [jobsRes, clientsRes, cleanersRes] = await Promise.all([
        supabase
          .from('jobs')
          .select('*, clients(*), cleaners(*)')
          .order('scheduled_date', { ascending: true })
          .order('scheduled_time', { ascending: true }),
        supabase.from('clients').select('*').order('name'),
        supabase.from('cleaners').select('*').order('name')
      ])

      if (jobsRes.data) setJobs(jobsRes.data as Job[])
      if (clientsRes.data) setClients(clientsRes.data)
      if (cleanersRes.data) setCleaners(cleanersRes.data)
    } catch (err) {
      console.error('Erro ao buscar dados:', err)
    } finally {
      setLoading(false)
    }
  }

  // Busca na tabela 'property_common_areas' filtrando pelo client_id
  useEffect(() => {
    if (clientId && targetType === 'common_area') {
      supabase
        .from('property_common_areas')
        .select('*')
        .eq('client_id', clientId)
        .order('name')
        .then(({ data, error }) => {
          if (!error && data) {
            const formatted = data.map((item) => ({
              id: item.id,
              name: item.name,
              client_price: Number(item.client_price || 0),
              cleaner_price: Number(item.cleaner_price || 0)
            }))
            setAvailableAreas(formatted)
          } else {
            setAvailableAreas([])
          }
        })
    } else {
      setAvailableAreas([])
    }
  }, [clientId, targetType])

  // Somar automaticamente os valores das áreas selecionadas
  const handleToggleArea = (area: PropertyCommonArea) => {
    const isSelected = selectedAreaIds.includes(area.id)
    let updatedIds: string[]

    if (isSelected) {
      updatedIds = selectedAreaIds.filter((id) => id !== area.id)
    } else {
      updatedIds = [...selectedAreaIds, area.id]
    }

    setSelectedAreaIds(updatedIds)

    const selectedItems = availableAreas.filter((a) => updatedIds.includes(a.id))
    const totalClientPrice = selectedItems.reduce((acc, curr) => acc + Number(curr.client_price || 0), 0)
    const totalCleanerPrice = selectedItems.reduce((acc, curr) => acc + Number(curr.cleaner_price || 0), 0)

    setPrice(totalClientPrice.toString())
    setPayout(totalCleanerPrice.toString())
  }
  
  // Extrai o nome da unidade/imóvel ou áreas comuns selecionadas
  const getJobUnitLabel = (job: any) => {
    if (job.target_type === 'common_area' && job.selected_common_areas && Array.isArray(job.selected_common_areas)) {
      return job.selected_common_areas.map((a: any) => a.name).join(', ')
    }
    if (job.unit_details) {
      return job.unit_details
    }
    if (job.notes) {
      const matchUnit = job.notes.match(/\[Unidade\/Especificação:\s*([^\]]+)\]/)
      if (matchUnit && matchUnit[1]) {
        return matchUnit[1].trim()
      }
      const matchArea = job.notes.match(/\[Área Comum:\s*([^\]]+)\]/)
      if (matchArea && matchArea[1]) {
        return matchArea[1].trim()
      }
    }
    return null
  }

  // Troca de cliente no modal
  const handleClientChange = (selectedClientId: string) => {
    setClientId(selectedClientId)
    const client = clients.find((c) => c.id === selectedClientId) || null
    setSelectedClient(client)

    setTargetType('unit')
    setUnitDetails('')
    setSelectedAreaIds([])
  }

  const handleServiceTypeChange = (type: string) => {
    setServiceType(type)
  }

  const handleOpenNewModal = (initialDate?: string) => {
    setEditingJobId(null)
    setClientId('')
    setSelectedClient(null)
    setUnitDetails('')
    setCleanerId('')
    setScheduledDate(initialDate || new Date().toISOString().split('T')[0])
    setScheduledTime('09:00')
    setServiceType('Standard')
    setPrice('')
    setExtraPrice('0')
    setPayout('')
    setExtraPayout('0')
    setNotes('')
    setIsRecurring(false)
    setRecurrenceFrequency('weekly')
    setRecurrenceUntil('')
    setTargetType('unit')
    setSelectedAreaIds([])
    setShowModal(true)
  }

  const handleOpenEditModal = (job: Job) => {
    setEditingJobId(job.id)
    setClientId(job.client_id || '')

    const client = clients.find((c) => c.id === job.client_id) || null
    setSelectedClient(client)

    let cleanNotes = job.notes || ''
    const matchUnit = cleanNotes.match(/\[Unidade\/Especificação:\s*([^\]]+)\]/)
    const matchArea = cleanNotes.match(/\[Área Comum:\s*([^\]]+)\]/)

    if (matchUnit) {
      setTargetType('unit')
      setUnitDetails(matchUnit[1].trim())
      cleanNotes = cleanNotes.replace(/\[Unidade\/Especificação:\s*[^\]]+\]\n?/, '').trim()
    } else if (matchArea) {
      setTargetType('common_area')
      const areaNames = matchArea[1].split(',').map((s) => s.trim())
      cleanNotes = cleanNotes.replace(/\[Área Comum:\s*[^\]]+\]\n?/, '').trim()
      
      // Carrega as áreas para preencher os checkboxes selecionados
      supabase
        .from('property_common_areas')
        .select('*')
        .eq('client_id', job.client_id)
        .then(({ data }) => {
          if (data) {
            const formatted = data.map((item) => ({
              id: item.id,
              name: item.name,
              client_price: Number(item.client_price || 0),
              cleaner_price: Number(item.cleaner_price || 0)
            }))
            setAvailableAreas(formatted)
            const matchedIds = formatted
              .filter((a) => areaNames.includes(a.name))
              .map((a) => a.id)
            setSelectedAreaIds(matchedIds)
          }
        })
    } else {
      setTargetType('unit')
      setUnitDetails('')
      setSelectedAreaIds([])
    }

    setCleanerId(job.cleaner_id || '')
    setScheduledDate(job.scheduled_date || '')
    setScheduledTime(job.scheduled_time || '09:00')
    setServiceType(job.service_type || 'Standard')
    setPrice(job.price ? String(job.price) : '')
    setExtraPrice(job.extra_price ? String(job.extra_price) : '0')
    setPayout(job.payout ? String(job.payout) : '')
    setExtraPayout(job.extra_payout ? String(job.extra_payout) : '0')
    setNotes(cleanNotes)
    setIsRecurring(false)
    setShowModal(true)
  }

  // Função auxiliar para disparar o e-mail via API
  const sendEmailToCleaner = async (date: string) => {
    const selectedCleanerObj = cleaners.find((c) => c.id === cleanerId)
    const selectedClientObj = clients.find((c) => c.id === clientId)

    if (selectedCleanerObj?.email) {
      const totalPayout = (parseFloat(payout) || 0) + (parseFloat(extraPayout) || 0)
      try {
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cleanerEmail: selectedCleanerObj.email,
            cleanerName: selectedCleanerObj.name,
            clientName: selectedClientObj?.name || 'Cliente',
            date: date,
            time: scheduledTime,
            address: selectedClientObj?.address || 'Endereço não informado',
            payout: totalPayout
          })
        })
      } catch (err) {
        console.error('Erro ao enviar e-mail para limpador:', err)
      }
    }
  }

  const handleSaveJob = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientId || !scheduledDate || !scheduledTime) {
      alert('Por favor, preencha todos os campos obrigatórios.')
      return
    }

    setSaving(true)

    let finalNotes = notes.trim()
    if (targetType === 'unit' && unitDetails.trim()) {
      const tag = `[Unidade/Especificação: ${unitDetails.trim()}]`
      finalNotes = finalNotes ? `${tag}\n${finalNotes}` : tag
    } else if (targetType === 'common_area' && selectedAreaIds.length > 0) {
      const selectedNames = availableAreas
        .filter((a) => selectedAreaIds.includes(a.id))
        .map((a) => a.name)
        .join(', ')
      const tag = `[Área Comum: ${selectedNames}]`
      finalNotes = finalNotes ? `${tag}\n${finalNotes}` : tag
    }

    const payload = {
      client_id: clientId,
      cleaner_id: cleanerId || null,
      scheduled_date: scheduledDate,
      scheduled_time: scheduledTime,
      service_type: serviceType,
      price: parseFloat(price) || 0,
      extra_price: parseFloat(extraPrice) || 0,
      payout: parseFloat(payout) || 0,
      extra_payout: parseFloat(extraPayout) || 0,
      notes: finalNotes,
      status: 'pending'
    }

    try {
      if (editingJobId) {
        const { error } = await supabase.from('jobs').update(payload).eq('id', editingJobId)
        if (error) throw error
        await sendEmailToCleaner(scheduledDate)
      } else {
        if (isRecurring && recurrenceUntil) {
          const datesToCreate: string[] = [scheduledDate]
          let current = new Date(`${scheduledDate}T00:00:00`)
          const end = new Date(`${recurrenceUntil}T00:00:00`)

          while (true) {
            if (recurrenceFrequency === 'weekly') {
              current.setDate(current.getDate() + 7)
            } else if (recurrenceFrequency === 'biweekly') {
              current.setDate(current.getDate() + 14)
            } else if (recurrenceFrequency === 'monthly') {
              current.setMonth(current.getMonth() + 1)
            }

            if (current > end) break
            datesToCreate.push(current.toISOString().split('T')[0])
          }

          const batchPayloads = datesToCreate.map((d) => ({
            ...payload,
            scheduled_date: d
          }))

          const { error } = await supabase.from('jobs').insert(batchPayloads)
          if (error) throw error

          // Dispara e-mail para cada data gerada na recorrência
          for (const date of datesToCreate) {
            await sendEmailToCleaner(date)
          }
        } else {
          const { error } = await supabase.from('jobs').insert([payload])
          if (error) throw error
          await sendEmailToCleaner(scheduledDate)
        }
      }

      setShowModal(false)
      fetchData()
    } catch (err: any) {
      alert('Erro ao salvar agendamento: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDuplicateJob = async (job: Job) => {
    const newDate = prompt('Digite a nova data para a cópia (AAAA-MM-DD):', job.scheduled_date)
    if (!newDate) return

    const { id, clients, cleaners, ...copyData } = job
    const payload = {
      ...copyData,
      scheduled_date: newDate,
      status: 'pending'
    }

    const { error } = await supabase.from('jobs').insert([payload])
    if (!error) {
      fetchData()
    } else {
      alert('Erro ao duplicar agendamento: ' + error.message)
    }
  }

  const handleUpdateStatus = async (jobId: string, newStatus: string) => {
    const { error } = await supabase.from('jobs').update({ status: newStatus }).eq('id', jobId)
    if (!error) {
      fetchData()
    } else {
      alert('Erro ao atualizar status: ' + error.message)
    }
  }

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm('Deseja realmente excluir este agendamento?')) return

    const { error } = await supabase.from('jobs').delete().eq('id', jobId)
    if (!error) {
      fetchData()
    } else {
      alert('Erro ao excluir: ' + error.message)
    }
  }

  // Navegação Calendário
  const handleNavigate = (direction: 'prev' | 'next' | 'today') => {
    const newDate = new Date(currentDate)

    if (direction === 'today') {
      setCurrentDate(new Date())
      return
    }

    if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1))
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7))
    } else if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1))
    }

    setCurrentDate(newDate)
  }

  const getHeaderPeriodLabel = () => {
    if (viewMode === 'day') {
      return currentDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    }
    if (viewMode === 'week') {
      const start = new Date(currentDate)
      start.setDate(currentDate.getDate() - currentDate.getDay())
      const end = new Date(start)
      end.setDate(start.getDate() + 6)
      return `${start.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}`
    }
    if (viewMode === 'month') {
      return currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    }
    return 'Todas as Limpezas'
  }

  // Gerador de Dias do Calendário
  const generateCalendarDays = (): CalendarDay[] => {
    const todayStr = new Date().toISOString().split('T')[0]
    const days: CalendarDay[] = []

    if (viewMode === 'day') {
      const dateStr = currentDate.toISOString().split('T')[0]
      days.push({
        dateStr,
        label: currentDate.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'numeric' }),
        isToday: dateStr === todayStr,
        isCurrentMonth: true
      })
      return days
    }

    if (viewMode === 'week') {
      const start = new Date(currentDate)
      start.setDate(currentDate.getDate() - currentDate.getDay())

      for (let i = 0; i < 7; i++) {
        const d = new Date(start)
        d.setDate(start.getDate() + i)
        const dateStr = d.toISOString().split('T')[0]
        days.push({
          dateStr,
          label: d.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric' }),
          isToday: dateStr === todayStr,
          isCurrentMonth: true
        })
      }
      return days
    }

    // Mês
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    const firstDayOfMonth = new Date(year, month, 1)
    const startingDayOfWeek = firstDayOfMonth.getDay()

    const startDate = new Date(firstDayOfMonth)
    startDate.setDate(startDate.getDate() - startingDayOfWeek)

    for (let i = 0; i < 35; i++) {
      const d = new Date(startDate)
      d.setDate(startDate.getDate() + i)
      const dateStr = d.toISOString().split('T')[0]
      days.push({
        dateStr,
        label: `${d.getDate()} ${d.toLocaleDateString('pt-BR', { weekday: 'short' })}`,
        isToday: dateStr === todayStr,
        isCurrentMonth: d.getMonth() === month
      })
    }

    return days
  }

  const calendarDays = generateCalendarDays()

  // Agrupa agendamentos por data
  const jobsByDate = jobs.reduce<Record<string, Job[]>>((acc, job) => {
    if (!acc[job.scheduled_date]) acc[job.scheduled_date] = []
    acc[job.scheduled_date].push(job)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Topbar */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 transition">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-emerald-400">Agendamentos de Limpeza</h1>
        </div>
        <button
          onClick={() => handleOpenNewModal()}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-2 rounded-lg text-sm transition cursor-pointer w-full sm:w-auto justify-center"
        >
          <Plus className="w-4 h-4" /> Nova Limpeza
        </button>
      </header>

      {/* Controles do Calendário */}
      <main className="flex-1 p-4 lg:p-6 max-w-7xl mx-auto w-full space-y-4 flex flex-col">
        <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleNavigate('today')}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-semibold text-slate-200 transition cursor-pointer"
            >
              Hoje
            </button>

            <div className="flex items-center bg-slate-900 rounded-lg border border-slate-700">
              <button
                onClick={() => handleNavigate('prev')}
                className="p-2 hover:bg-slate-800 rounded-l-lg text-slate-300 transition cursor-pointer"
                title="Anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleNavigate('next')}
                className="p-2 hover:bg-slate-800 rounded-r-lg text-slate-300 transition cursor-pointer"
                title="Próximo"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <span className="text-sm font-semibold text-white capitalize ml-2">
              {getHeaderPeriodLabel()}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-1 bg-slate-900 p-1 rounded-lg border border-slate-700 w-full md:w-auto">
            <button
              type="button"
              onClick={() => setViewMode('day')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1 ${
                viewMode === 'day' ? 'bg-emerald-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Dia
            </button>

            <button
              type="button"
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1 ${
                viewMode === 'week' ? 'bg-emerald-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Semana
            </button>

            <button
              type="button"
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1 ${
                viewMode === 'month' ? 'bg-emerald-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Mês
            </button>

            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1 ${
                viewMode === 'list' ? 'bg-emerald-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" /> Lista
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-slate-400 text-center py-10">Carregando agenda...</p>
        ) : viewMode === 'list' ? (
          /* MODO LISTA */
          <div className="space-y-3">
            {jobs.length === 0 ? (
              <p className="text-center py-12 text-slate-400">Nenhum agendamento encontrado.</p>
            ) : (
              jobs.map((job) => {
                const basePrice = Number(job.price || 0)
                const extraPriceNum = Number(job.extra_price || 0)
                const totalPrice = basePrice + extraPriceNum
                const style = SERVICE_TYPE_STYLES[job.service_type] || SERVICE_TYPE_STYLES['Standard']
                const unitLabel = getJobUnitLabel(job)

                return (
                  <div
                    key={job.id}
                    className={`bg-slate-800 p-4 rounded-xl border border-slate-700 ${style.border} flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition hover:border-slate-600`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white text-lg">{job.clients?.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded border font-medium ${style.badge}`}>
                          {style.label}
                        </span>
                        {unitLabel && (
                          <span className="text-xs bg-purple-900/50 text-purple-200 border border-purple-600/50 px-2 py-0.5 rounded flex items-center gap-1 font-medium">
                            <Home className="w-3 h-3 text-purple-400" /> {unitLabel}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-500" />
                        {job.clients?.address || 'Endereço não informado'}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4 text-emerald-400" />
                        <span>{job.scheduled_date}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4 text-amber-400" />
                        <span>{job.scheduled_time}</span>
                      </div>
                      <div className="font-bold text-emerald-400 text-sm">
                        ${totalPrice.toFixed(2)}
                      </div>

                      <button
                        onClick={() => handleOpenEditModal(job)}
                        className="p-1.5 text-slate-400 hover:text-emerald-400 rounded transition cursor-pointer"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteJob(job.id)}
                        className="p-1.5 text-slate-500 hover:text-red-400 rounded transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        ) : (
          /* MODO GRADE/CALENDÁRIO */
          <div
            className={`grid gap-2 flex-1 ${
              viewMode === 'day'
                ? 'grid-cols-1'
                : viewMode === 'week'
                ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-7'
                : 'grid-cols-2 sm:grid-cols-5 md:grid-cols-7'
            }`}
          >
            {calendarDays.map((day) => {
              const dayJobs = jobsByDate[day.dateStr] || []

              return (
                <div
                  key={day.dateStr}
                  className={`min-h-[160px] bg-slate-800/60 rounded-xl border flex flex-col p-2 transition ${
                    day.isToday
                      ? 'border-emerald-500 bg-emerald-950/10'
                      : day.isCurrentMonth
                      ? 'border-slate-700/80 hover:border-slate-600'
                      : 'border-slate-800 opacity-40'
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-slate-700/50 pb-1.5 mb-2">
                    <span
                      className={`text-xs font-bold uppercase tracking-wider ${
                        day.isToday ? 'text-emerald-400 font-extrabold' : 'text-slate-300'
                      }`}
                    >
                      {day.label}
                    </span>

                    <button
                      onClick={() => handleOpenNewModal(day.dateStr)}
                      className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-slate-700 rounded transition cursor-pointer"
                      title="Agendar neste dia"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-1.5 flex-1 overflow-y-auto max-h-[420px]">
                    {dayJobs.length === 0 ? (
                      <p className="text-[10px] text-slate-500 italic text-center py-4">Sem limpezas</p>
                    ) : (
                      dayJobs.map((job) => {
                        const style = SERVICE_TYPE_STYLES[job.service_type] || SERVICE_TYPE_STYLES['Standard']
                        const totalPrice = Number(job.price || 0) + Number(job.extra_price || 0)
                        const assignedCleaner = job.cleaners?.name || job.cleaner_name
                        const unitLabel = getJobUnitLabel(job)

                        return (
                          <div
                            key={job.id}
                            className={`p-2 rounded-lg border text-left flex flex-col gap-1 transition ${style.bg} ${
                              job.status === 'completed' ? 'opacity-60' : ''
                            }`}
                          >
                            <div className="flex items-start justify-between gap-1">
                              <span className="font-bold text-xs text-white truncate max-w-[120px]">
                                {job.clients?.name}
                              </span>
                              <span className="text-[10px] font-bold text-emerald-400">
                                ${totalPrice.toFixed(0)}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-[10px] text-slate-300">
                              <span className="flex items-center gap-0.5">
                                <Clock className="w-3 h-3 text-amber-400" /> {job.scheduled_time}
                              </span>

                              <span className={`px-1 py-0.2 rounded text-[9px] font-semibold ${style.badge}`}>
                                {style.label}
                              </span>
                            </div>

                            {unitLabel && (
                              <p className="text-[10px] text-purple-300 truncate flex items-center gap-1 font-medium bg-purple-950/40 px-1 py-0.5 rounded border border-purple-800/40">
                                <Home className="w-2.5 h-2.5 text-purple-400 flex-shrink-0" /> {unitLabel}
                              </p>
                            )}

                            {assignedCleaner && (
                              <p className="text-[10px] text-emerald-300 truncate flex items-center gap-1">
                                <UserCheck className="w-2.5 h-2.5 flex-shrink-0" /> {assignedCleaner}
                              </p>
                            )}

                            {(() => {
                              const fullAddress = job.clients?.address
                              if (!fullAddress) return null

                              return (
                                <a
                                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium hover:underline truncate w-fit pt-0.5"
                                  title="Abrir endereço no Google Maps"
                                >
                                  <MapPin className="w-2.5 h-2.5 text-sky-400 flex-shrink-0" />
                                  <span className="truncate max-w-[130px]">{fullAddress}</span>
                                </a>
                              )
                            })()}

                            <div className="flex items-center justify-between pt-1 border-t border-slate-700/50 mt-1">
                              <select
                                value={job.status}
                                onChange={(e) => handleUpdateStatus(job.id, e.target.value)}
                                className="bg-slate-900 border border-slate-700 text-[9px] rounded px-1 py-0.5 text-slate-200 font-medium focus:outline-none"
                              >
                                <option value="pending">Pendente</option>
                                <option value="in_progress">Em Andamento</option>
                                <option value="completed">Concluída</option>
                              </select>

                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleDuplicateJob(job)}
                                  className="p-1 text-slate-400 hover:text-sky-400 rounded transition cursor-pointer"
                                  title="Duplicar"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleOpenEditModal(job)}
                                  className="p-1 text-slate-400 hover:text-emerald-400 rounded transition cursor-pointer"
                                  title="Editar"
                                >
                                  <Edit className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleDeleteJob(job.id)}
                                  className="p-1 text-slate-500 hover:text-red-400 rounded transition cursor-pointer"
                                  title="Excluir"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Modal Criar/Editar Agendamento */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-lg border border-slate-700 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-4 text-white">
              {editingJobId ? 'Editar Agendamento' : 'Agendar Nova Limpeza'}
            </h2>
            <form onSubmit={handleSaveJob} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Selecione o Cliente *</label>
                <select
                  required
                  value={clientId}
                  onChange={(e) => handleClientChange(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm focus:outline-none focus:border-emerald-500 text-white"
                >
                  <option value="">Selecione um cliente...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Seletor de Tipo (Unidade x Área Comum) e seus respectivos inputs */}
              {clientId && (
                <div className="space-y-3">
                  <div className="flex gap-2 mb-3 bg-slate-800 p-1 rounded-lg border border-slate-700">
                    <button
                      type="button"
                      onClick={() => setTargetType('unit')}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition ${
                        targetType === 'unit' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Unidade / Bloco
                    </button>
                    <button
                      type="button"
                      onClick={() => setTargetType('common_area')}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition ${
                        targetType === 'common_area' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Área Comum
                    </button>
                  </div>

                  {targetType === 'unit' ? (
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Especificação da Unidade (Bloco, Apt, Tamanho...)</label>
                      <input
                        type="text"
                        value={unitDetails}
                        onChange={(e) => setUnitDetails(e.target.value)}
                        placeholder="Ex: Bloco A, Apt 302 - 2 Quartos..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm focus:outline-none focus:border-emerald-500 text-white"
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="block text-xs text-slate-400">Selecione as Áreas Solicitadas:</label>
                      {availableAreas.length === 0 ? (
                        <p className="text-xs text-amber-400 italic bg-amber-950/30 p-2 rounded border border-amber-800/40">
                          Nenhuma Área Comum cadastrada para este cliente.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto p-2 bg-slate-900 rounded-lg border border-slate-700">
                          {availableAreas.map((area) => (
                            <label key={area.id} className="flex items-center justify-between text-xs text-slate-200 cursor-pointer p-1 hover:bg-slate-800 rounded">
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={selectedAreaIds.includes(area.id)}
                                  onChange={() => handleToggleArea(area)}
                                  className="rounded border-slate-700 text-emerald-500 focus:ring-0"
                                />
                                <span>{area.name}</span>
                              </div>
                              <span className="text-slate-400 text-[10px]">
                                Cliente: ${area.client_price} | Repasse: ${area.cleaner_price}
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs text-slate-400 mb-1">Selecione o(a) Limpador(a) / Responsável</label>
                <select
                  value={cleanerId}
                  onChange={(e) => setCleanerId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm focus:outline-none focus:border-emerald-500 text-white"
                >
                  <option value="">Nenhum selecionado</option>
                  {cleaners.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Repasse Base Limpadora ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={payout}
                    onChange={(e) => setPayout(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm focus:outline-none focus:border-emerald-500 text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Extra Limpadora ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={extraPayout}
                    onChange={(e) => setExtraPayout(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm focus:outline-none focus:border-emerald-500 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Data *</label>
                  <input
                    type="date"
                    required
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm focus:outline-none focus:border-emerald-500 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Horário *</label>
                  <input
                    type="time"
                    required
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm focus:outline-none focus:border-emerald-500 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Serviço</label>
                  <select
                    value={serviceType}
                    onChange={(e) => handleServiceTypeChange(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm focus:outline-none focus:border-emerald-500 text-white"
                  >
                    <option value="Standard">Standard</option>
                    <option value="Pesada">Pesada</option>
                    <option value="Move-In/Out">Move-In/Out</option>
                    <option value="Vacation">Vacation / Airbnb</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Valor Base ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm focus:outline-none focus:border-emerald-500 text-white font-bold text-emerald-400"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Valor Extra ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={extraPrice}
                    onChange={(e) => setExtraPrice(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm focus:outline-none focus:border-amber-500 text-amber-400 font-bold"
                  />
                </div>
              </div>

              {/* Seção de Recorrência */}
              {!editingJobId && (
                <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-700 space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-indigo-400">
                    <input
                      type="checkbox"
                      checked={isRecurring}
                      onChange={(e) => setIsRecurring(e.target.checked)}
                      className="w-4 h-4 rounded accent-indigo-500 cursor-pointer"
                    />
                    <Repeat className="w-4 h-4" />
                    Repetir este agendamento (Recorrência)
                  </label>

                  {isRecurring && (
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Frequência</label>
                        <select
                          value={recurrenceFrequency}
                          onChange={(e) => setRecurrenceFrequency(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                        >
                          <option value="weekly">Semanal (a cada 7 dias)</option>
                          <option value="biweekly">Quinzenal (a cada 14 dias)</option>
                          <option value="monthly">Mensal (todo mês)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Repetir até *</label>
                        <input
                          type="date"
                          required={isRecurring}
                          min={scheduledDate}
                          value={recurrenceUntil}
                          onChange={(e) => setRecurrenceUntil(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs text-slate-400 mb-1">Observações do Agendamento</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Lembrar de levar aspirador extra, limpar forno (extra $30)..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm focus:outline-none focus:border-emerald-500 text-white"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : editingJobId ? 'Atualizar Agendamento' : 'Confirmar Agendamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}