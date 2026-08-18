'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Calendar, Clock, MapPin, ArrowLeft, Trash2, Edit, UserCheck } from 'lucide-react'
import Link from 'next/link'

interface Client {
  id: string
  name: string
  address: string
  price_standard: number
  price_heavy: number
  price_move_in_out: number
}

interface Cleaner {
  id: string
  name: string
}

interface Job {
  id: string
  client_id: string
  cleaner_id: string | null
  scheduled_date: string
  scheduled_time: string
  service_type: string
  price: number | string
  extra_price: number | string
  cleaner_name: string | null
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  notes: string | null
  clients: {
    name: string
    address: string
  }
  cleaners: {
    name: string
  } | null
}

export default function SchedulePage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [cleaners, setCleaners] = useState<Cleaner[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingJobId, setEditingJobId] = useState<string | null>(null)

  // Form states
  const [clientId, setClientId] = useState('')
  const [cleanerId, setCleanerId] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('08:00')
  const [serviceType, setServiceType] = useState('Standard')
  const [price, setPrice] = useState('')
  const [extraPrice, setExtraPrice] = useState('0')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    
    // Buscar Clientes
    const { data: clientsData } = await supabase.from('clients').select('*').order('name')
    if (clientsData) setClients(clientsData)

    // Buscar Limpadores Ativos
    const { data: cleanersData } = await supabase.from('cleaners').select('id, name').eq('active', true).order('name')
    if (cleanersData) setCleaners(cleanersData)

 // Buscar Agendamentos
const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

const { data: jobsData } = await supabase
  .from('jobs')
  .select('*, clients(name, address), cleaners(name)')
  .or(`status.neq.completed,completed_at.gt.${cutoff}`)
  .order('scheduled_date', { ascending: true })

if (jobsData) setJobs(jobsData as any)
    
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleClientChange = (id: string) => {
    setClientId(id)
    const selected = clients.find(c => c.id === id)
    if (selected && !editingJobId) {
      if (serviceType === 'Standard') setPrice(selected.price_standard.toString())
      if (serviceType === 'Pesada') setPrice(selected.price_heavy.toString())
      if (serviceType === 'Move-In/Out') setPrice(selected.price_move_in_out.toString())
    }
  }

  const handleServiceTypeChange = (type: string) => {
    setServiceType(type)
    const selected = clients.find(c => c.id === clientId)
    if (selected && !editingJobId) {
      if (type === 'Standard') setPrice(selected.price_standard.toString())
      if (type === 'Pesada') setPrice(selected.price_heavy.toString())
      if (type === 'Move-In/Out') setPrice(selected.price_move_in_out.toString())
    }
  }

  const handleOpenNewModal = () => {
    setEditingJobId(null)
    setClientId('')
    setCleanerId('')
    setScheduledDate('')
    setScheduledTime('08:00')
    setServiceType('Standard')
    setPrice('')
    setExtraPrice('0')
    setNotes('')
    setShowModal(true)
  }

  const handleOpenEditModal = (job: Job) => {
    setEditingJobId(job.id)
    setClientId(job.client_id)
    setCleanerId(job.cleaner_id || '')
    setScheduledDate(job.scheduled_date)
    setScheduledTime(job.scheduled_time)
    setServiceType(job.service_type)
    setPrice(job.price ? job.price.toString() : '0')
    setExtraPrice(job.extra_price ? job.extra_price.toString() : '0')
    setNotes(job.notes || '')
    setShowModal(true)
  }

  const handleSaveJob = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const payload = {
      client_id: clientId,
      cleaner_id: cleanerId || null,
      scheduled_date: scheduledDate,
      scheduled_time: scheduledTime,
      service_type: serviceType,
      price: parseFloat(price) || 0,
      extra_price: parseFloat(extraPrice) || 0,
      notes: notes || null,
    }

    let error

    if (editingJobId) {
      const { error: updateError } = await supabase
        .from('jobs')
        .update(payload)
        .eq('id', editingJobId)
      error = updateError
    } else {
      const { error: insertError } = await supabase
        .from('jobs')
        .insert([{ ...payload, status: 'pending' }])
      error = insertError
    }

    if (!error) {
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

              return (
                <div key={job.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white text-lg">{job.clients?.name}</span>
                      <span className="text-xs bg-slate-700 text-emerald-400 px-2 py-0.5 rounded font-medium">
                        {job.service_type}
                      </span>
                      {assignedCleanerName && (
                        <span className="text-xs bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded flex items-center gap-1">
                          <UserCheck className="w-3 h-3" /> {assignedCleanerName}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-500" /> {job.clients?.address}
                    </p>
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
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-lg border border-slate-700 shadow-2xl">
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