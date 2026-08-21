'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Calendar, Clock, MapPin, ArrowLeft, Trash2, Edit, UserCheck, Copy, Home, Repeat } from 'lucide-react'
import Link from 'next/link'

interface Client {
  id: string
  name: string
  address: string
  price_standard: number
  price_heavy: number
  price_move_in_out: number
  price_vacation?: number
  cleaner_payout?: number
}

interface Property {
  id: string
  client_id: string
  name: string
  address: string
  price_standard?: number
  price_heavy?: number
  price_move_in_out?: number
  price_vacation?: number
  cleaner_payout?: number
}

interface Cleaner {
  id: string
  name: string
  email?: string
}

interface Job {
  id: string
  client_id: string
  property_id?: string | null
  cleaner_id: string | null
  scheduled_date: string
  scheduled_time: string
  service_type: string
  price: number | string
  extra_price: number | string
  payout?: number | string
  extra_payout?: number | string
  cleaner_name: string | null
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  notes: string | null
  is_recurring?: boolean
  recurrence_frequency?: string
  recurrence_until?: string
  clients: {
    name: string
    address: string
  }
  properties?: {
    name: string
    address: string
  } | null
  cleaners: {
    name: string
  } | null
}

export const SERVICE_TYPE_STYLES: Record<string, { label: string; badge: string; border: string }> = {
  Standard: {
    label: 'Standard',
    badge: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    border: 'border-l-4 border-l-blue-500',
  },
  Pesada: {
    label: 'Pesada',
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    border: 'border-l-4 border-l-amber-500',
  },
  'Move-In/Out': {
    label: 'Move-In / Move-Out',
    badge: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    border: 'border-l-4 border-l-purple-500',
  },
  Vacation: {
    label: 'Vacation / Airbnb',
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    border: 'border-l-4 border-l-emerald-500',
  },
}

const getTodayUS = () => {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Chicago' })
}

const generateRecurringDates = (startDateStr: string, frequency: string, untilDateStr: string): string[] => {
  const dates: string[] = []
  let current = new Date(startDateStr + 'T00:00:00')
  const until = new Date(untilDateStr + 'T23:59:59')

  while (current <= until) {
    dates.push(current.toISOString().split('T')[0])

    if (frequency === 'weekly') {
      current.setDate(current.getDate() + 7)
    } else if (frequency === 'biweekly') {
      current.setDate(current.getDate() + 14)
    } else if (frequency === 'monthly') {
      current.setMonth(current.getMonth() + 1)
    } else {
      break
    }
  }

  return dates
}

export default function SchedulePage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [cleaners, setCleaners] = useState<Cleaner[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingJobId, setEditingJobId] = useState<string | null>(null)

  // Form states
  const [clientId, setClientId] = useState('')
  const [propertyId, setPropertyId] = useState('')
  const [unitDetails, setUnitDetails] = useState('') // Novo campo para texto livre
  const [cleanerId, setCleanerId] = useState('')
  const [scheduledDate, setScheduledDate] = useState(getTodayUS())
  const [scheduledTime, setScheduledTime] = useState('08:00')
  const [serviceType, setServiceType] = useState('Standard')
  const [price, setPrice] = useState('')
  const [extraPrice, setExtraPrice] = useState('0')
  const [payout, setPayout] = useState<number | string>('')
  const [extraPayout, setExtraPayout] = useState<number | string>('')
  const [notes, setNotes] = useState('')

  // Estados de Recorrência
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrenceFrequency, setRecurrenceFrequency] = useState('weekly')
  const [recurrenceUntil, setRecurrenceUntil] = useState('')

  const [saving, setSaving] = useState(false)

  const fetchData = async () => {
    setLoading(true)

    const { data: clientsData } = await supabase.from('clients').select('*').order('name')
    if (clientsData) setClients(clientsData)

    const { data: propertiesData } = await supabase.from('properties').select('*').order('name')
    if (propertiesData) setProperties(propertiesData)

    const { data: cleanersData } = await supabase.from('cleaners').select('id, name, email').eq('active', true).order('name')
    if (cleanersData) setCleaners(cleanersData)

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const cutoff = yesterday.toISOString()

    const { data: jobsData } = await supabase
      .from('jobs')
      .select('*, clients(name, address), properties(name, address), cleaners(name)')
      .or(`status.neq.completed,completed_at.gt.${cutoff}`)
      .order('scheduled_date', { ascending: true })

    if (jobsData) setJobs(jobsData as any)

    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const availableProperties = properties.filter((p) => p.client_id === clientId)

  const updatePricing = (targetServiceType: string, targetPropertyId: string, targetClientId: string) => {
    if (editingJobId) return

    const selectedProperty = properties.find((p) => p.id === targetPropertyId)
    const selectedClient = clients.find((c) => c.id === targetClientId)

    const source = selectedProperty || selectedClient
    if (!source) return

    let basePrice = 0
    if (targetServiceType === 'Standard') basePrice = source.price_standard || 0
    if (targetServiceType === 'Pesada') basePrice = source.price_heavy || 0
    if (targetServiceType === 'Move-In/Out') basePrice = source.price_move_in_out || 0
    if (targetServiceType === 'Vacation') basePrice = source.price_vacation || source.price_standard || 0

    setPrice(basePrice.toString())

    if (source.cleaner_payout !== undefined && source.cleaner_payout !== null) {
      setPayout(source.cleaner_payout)
    }
  }

  const handleClientChange = (id: string) => {
    setClientId(id)
    setPropertyId('')
    setUnitDetails('')

    const selected = clients.find((c) => c.id === id)
    if (selected && !editingJobId) {
      updatePricing(serviceType, '', id)
      if ((selected as any).notes) setNotes((selected as any).notes)
    }
  }

  const handlePropertyChange = (propId: string) => {
    setPropertyId(propId)
    updatePricing(serviceType, propId, clientId)
  }

  const handleServiceTypeChange = (type: string) => {
    setServiceType(type)
    updatePricing(type, propertyId, clientId)
  }

  const handleOpenNewModal = () => {
    setEditingJobId(null)
    setClientId('')
    setPropertyId('')
    setUnitDetails('')
    setCleanerId('')
    setScheduledDate(getTodayUS())
    setScheduledTime('08:00')
    setServiceType('Standard')
    setPrice('')
    setExtraPrice('0')
    setPayout('')
    setExtraPayout('0')
    setNotes('')
    setIsRecurring(false)
    setRecurrenceFrequency('weekly')
    setRecurrenceUntil('')
    setShowModal(true)
  }

  const handleOpenEditModal = (job: Job) => {
    setEditingJobId(job.id)
    setClientId(job.client_id)
    setPropertyId(job.property_id || '')
    setUnitDetails('')
    setCleanerId(job.cleaner_id || '')
    setScheduledDate(job.scheduled_date)
    setScheduledTime(job.scheduled_time)
    setServiceType(job.service_type)
    setPrice(job.price ? job.price.toString() : '0')
    setExtraPrice(job.extra_price ? job.extra_price.toString() : '0')
    setPayout(job.payout ? job.payout.toString() : '')
    setExtraPayout(job.extra_payout ? job.extra_payout.toString() : '0')
    setNotes(job.notes || '')
    setIsRecurring(job.is_recurring || false)
    setRecurrenceFrequency(job.recurrence_frequency || 'weekly')
    setRecurrenceUntil(job.recurrence_until || '')
    setShowModal(true)
  }

  const handleDuplicateJob = (job: Job) => {
    setEditingJobId(null)
    setClientId(job.client_id)
    setPropertyId(job.property_id || '')
    setUnitDetails('')
    setCleanerId(job.cleaner_id || '')
    setScheduledDate('')
    setScheduledTime(job.scheduled_time)
    setServiceType(job.service_type)
    setPrice(job.price ? job.price.toString() : '0')
    setExtraPrice(job.extra_price ? job.extra_price.toString() : '0')
    setPayout(job.payout ? job.payout.toString() : '')
    setExtraPayout(job.extra_payout ? job.extra_payout.toString() : '0')
    setNotes(job.notes || '')
    setIsRecurring(false)
    setRecurrenceFrequency('weekly')
    setRecurrenceUntil('')
    setShowModal(true)
  }

  const handleSaveJob = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    // Junta as especificações da unidade no campo de observações se preenchido
    let finalNotes = notes
    if (unitDetails.trim()) {
      finalNotes = `[Unidade/Especificação: ${unitDetails.trim()}] ${notes}`.trim()
    }

    const basePayload = {
      client_id: clientId,
      property_id: propertyId || null,
      cleaner_id: cleanerId || null,
      scheduled_time: scheduledTime,
      service_type: serviceType,
      price: parseFloat(price) || 0,
      extra_price: parseFloat(extraPrice) || 0,
      payout: parseFloat(String(payout)) || 0,
      extra_payout: parseFloat(String(extraPayout)) || 0,
      notes: finalNotes || null,
      is_recurring: isRecurring,
      recurrence_frequency: isRecurring ? recurrenceFrequency : null,
      recurrence_until: isRecurring ? recurrenceUntil : null,
    }

    let error

    if (editingJobId) {
      const { error: updateError } = await supabase
        .from('jobs')
        .update({ ...basePayload, scheduled_date: scheduledDate })
        .eq('id', editingJobId)
      error = updateError
    } else {
      if (isRecurring && recurrenceUntil && recurrenceUntil >= scheduledDate) {
        const dates = generateRecurringDates(scheduledDate, recurrenceFrequency, recurrenceUntil)
        const jobsToInsert = dates.map((date) => ({
          ...basePayload,
          scheduled_date: date,
          status: 'pending',
        }))

        const { error: batchError } = await supabase.from('jobs').insert(jobsToInsert)
        error = batchError
      } else {
        const { error: insertError } = await supabase
          .from('jobs')
          .insert([{ ...basePayload, scheduled_date: scheduledDate, status: 'pending' }])
        error = insertError
      }
    }

    if (!error) {
      if (!editingJobId && cleanerId) {
        const selectedCleaner = cleaners.find((c) => c.id === cleanerId)
        const selectedClient = clients.find((c) => c.id === clientId)
        const selectedProperty = properties.find((p) => p.id === propertyId)

        if (selectedCleaner?.email) {
          fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              cleanerEmail: selectedCleaner.email,
              cleanerName: selectedCleaner.name,
              clientName: selectedClient?.name || 'Cliente',
              date: scheduledDate,
              time: scheduledTime,
              address: selectedProperty?.address || selectedClient?.address || '',
              payout: selectedProperty?.cleaner_payout || selectedClient?.cleaner_payout || 0,
            }),
          }).catch((err) => console.error('Erro ao enviar e-mail:', err))
        }
      }

      setShowModal(false)
      fetchData()
    } else {
      alert('Erro ao salvar agendamento: ' + error.message)
    }
    setSaving(false)
  }

  const handleUpdateStatus = async (jobId: string, newStatus: string) => {
    const { error } = await supabase
      .from('jobs')
      .update({ status: newStatus })
      .eq('id', jobId)

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

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Topbar */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 transition">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-emerald-400">Agendamentos de Limpeza</h1>
        </div>
        <button
          onClick={handleOpenNewModal}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-2 rounded-lg text-sm transition cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Nova Limpeza
        </button>
      </header>

      {/* Listagem */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {loading ? (
          <p className="text-slate-400 text-center py-10">Carregando agenda...</p>
        ) : jobs.length === 0 ? (
          <div className="text-center py-16 bg-slate-800/50 rounded-2xl border border-slate-700">
            <Calendar className="w-12 h-12 text-slate-500 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-slate-300">Nenhuma limpeza agendada</h3>
            <p className="text-slate-500 text-sm mt-1">Clique em "Nova Limpeza" para organizar a agenda.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => {
              const basePrice = Number(job.price || 0)
              const extraPriceNum = Number(job.extra_price || 0)
              const totalPrice = basePrice + extraPriceNum
              const assignedCleanerName = job.cleaners?.name || job.cleaner_name
              const style = SERVICE_TYPE_STYLES[job.service_type] || SERVICE_TYPE_STYLES['Standard']

              const addressDisplay = job.properties?.address || job.clients?.address

              return (
                <div
                  key={job.id}
                  className={`bg-slate-800 p-4 rounded-xl border border-slate-700 ${style.border} flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition hover:border-slate-600`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white text-lg">{job.clients?.name}</span>

                      {/* Badge por Tipo de Serviço */}
                      <span className={`text-xs px-2 py-0.5 rounded border font-medium ${style.badge}`}>
                        {style.label}
                      </span>

                      {/* Unidade / Imóvel Cadastrado */}
                      {job.properties?.name && (
                        <span className="text-xs bg-slate-700/80 text-slate-300 border border-slate-600 px-2 py-0.5 rounded flex items-center gap-1 font-medium">
                          <Home className="w-3 h-3 text-slate-400" /> {job.properties.name}
                        </span>
                      )}

                      {/* Tag de Recorrência */}
                      {job.is_recurring && (
                        <span className="text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded flex items-center gap-1 font-medium">
                          <Repeat className="w-3 h-3" />
                          {job.recurrence_frequency === 'weekly' && 'Semanal'}
                          {job.recurrence_frequency === 'biweekly' && 'Quinzenal'}
                          {job.recurrence_frequency === 'monthly' && 'Mensal'}
                        </span>
                      )}

                      {/* Limpador */}
                      {assignedCleanerName && (
                        <span className="text-xs bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded flex items-center gap-1">
                          <UserCheck className="w-3 h-3" /> {assignedCleanerName}
                        </span>
                      )}
                    </div>

                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressDisplay || '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition underline decoration-slate-600 underline-offset-2 w-fit"
                    >
                      <MapPin className="w-3.5 h-3.5 text-slate-500" /> {addressDisplay}
                    </a>

                    {job.notes && (
                      <p className="text-xs text-slate-400 italic bg-slate-900/40 p-1.5 rounded mt-1">
                        Obs: {job.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-emerald-400" />
                      <span>{job.scheduled_date}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-amber-400" />
                      <span>{job.scheduled_time}</span>
                    </div>

                    <div className="text-right">
                      <div className="font-bold text-emerald-400 text-sm">
                        ${totalPrice.toFixed(2)}
                      </div>
                      {extraPriceNum > 0 && (
                        <div className="text-[10px] text-amber-400">
                          (Base: ${basePrice.toFixed(2)} + Extra: ${extraPriceNum.toFixed(2)})
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 bg-slate-900/60 p-1 rounded-lg border border-slate-700">
                      <button
                        onClick={() => handleUpdateStatus(job.id, 'pending')}
                        className={`px-2 py-1 rounded text-[11px] font-medium transition cursor-pointer ${
                          job.status === 'pending' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Pendente
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(job.id, 'in_progress')}
                        className={`px-2 py-1 rounded text-[11px] font-medium transition cursor-pointer ${
                          job.status === 'in_progress' ? 'bg-blue-500 text-white font-bold' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Em Andamento
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(job.id, 'completed')}
                        className={`px-2 py-1 rounded text-[11px] font-medium transition cursor-pointer ${
                          job.status === 'completed' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Concluída
                      </button>
                    </div>

                    <button
                      onClick={() => handleDuplicateJob(job)}
                      className="p-1.5 text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 rounded transition cursor-pointer"
                      title="Duplicar Agendamento"
                    >
                      <Copy className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleOpenEditModal(job)}
                      className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded transition cursor-pointer"
                      title="Editar Agendamento"
                    >
                      <Edit className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDeleteJob(job.id)}
                      className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition cursor-pointer"
                      title="Excluir Agendamento"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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

              {/* Seletor de Unidades Cadastradas do Cliente */}
{clientId && (
  <div className="space-y-3">
    {availableProperties.length > 0 ? (
      <div>
        <label className="block text-xs text-emerald-400 mb-1 font-semibold">
          Selecione a Unidade / Imóvel de Vacation *
        </label>
        <select
          value={propertyId}
          onChange={(e) => handlePropertyChange(e.target.value)}
          className="w-full bg-slate-900 border border-emerald-500/50 rounded-lg p-2.5 text-sm focus:outline-none focus:border-emerald-500 text-white font-medium"
        >
          <option value="">Selecione uma unidade do cliente...</option>
          {availableProperties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.address}
            </option>
          ))}
        </select>
      </div>
    ) : (
      <p className="text-xs text-slate-400 italic">
        Este cliente não possui unidades cadastradas (será usado o endereço padrão).
      </p>
    )}

    <div>
      <label className="block text-xs text-slate-400 mb-1">Especificação Extra (Ex: Apto / Bloco / Área)</label>
      <input
        type="text"
        value={unitDetails}
        onChange={(e) => setUnitDetails(e.target.value)}
        placeholder="Ex: Apt 302, Bloco B, Área Externa..."
        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm focus:outline-none focus:border-emerald-500 text-white"
      />
    </div>
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