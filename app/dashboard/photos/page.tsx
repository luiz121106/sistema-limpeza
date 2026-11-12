'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { ArrowLeft, Calendar, UserCheck, Home, Filter } from 'lucide-react'

interface PhotoGroup {
  id: string
  scheduled_date: string
  scheduled_time: string
  unit_details?: string | null
  clients?: { name: string } | null
  cleaners?: { name: string } | null
  job_photos: Array<{
    id: string
    photo_url: string
    photo_type: 'before' | 'after'
    created_at: string
  }>
}

export default function PhotosDashboardPage() {
  const [photoGroups, setPhotoGroups] = useState<PhotoGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [filterDate, setFilterDate] = useState('')

  const fetchPhotos = async () => {
    setLoading(true)

    // 1. Busca todas as fotos registradas na tabela job_photos
    const { data: photosData, error: photosError } = await supabase
      .from('job_photos')
      .select('id, job_id, photo_url, photo_type, created_at')
      .order('created_at', { ascending: false })

    if (photosError || !photosData || photosData.length === 0) {
      if (photosError) console.error('Erro ao buscar job_photos:', photosError)
      setPhotoGroups([])
      setLoading(false)
      return
    }

    // 2. Busca os agendamentos correspondentes
    const jobIds = Array.from(new Set(photosData.map((p) => p.job_id).filter(Boolean)))
    let jobsQuery = supabase
      .from('jobs')
      .select('id, scheduled_date, scheduled_time, client_id, cleaner_id')
      .in('id', jobIds)
      .order('scheduled_date', { ascending: false })

    if (filterDate) {
      jobsQuery = jobsQuery.eq('scheduled_date', filterDate)
    }

    const { data: jobsData, error: jobsError } = await jobsQuery

    if (jobsError || !jobsData || jobsData.length === 0) {
      if (jobsError) console.error('Erro ao buscar jobs:', jobsError)
      setPhotoGroups([])
      setLoading(false)
      return
    }

    // 3. Busca nomes de clientes e limpadores
    const clientIds = Array.from(new Set(jobsData.map((j) => j.client_id).filter(Boolean)))
    const cleanerIds = Array.from(new Set(jobsData.map((j) => j.cleaner_id).filter(Boolean)))

    const [{ data: clientsData }, { data: cleanersData }] = await Promise.all([
      clientIds.length > 0
        ? supabase.from('clients').select('id, name').in('id', clientIds)
        : Promise.resolve({ data: [] }),
      cleanerIds.length > 0
        ? supabase.from('cleaners').select('id, name').in('id', cleanerIds)
        : Promise.resolve({ data: [] }),
    ])

    const clientsById = new Map((clientsData ?? []).map((c: any) => [c.id, c]))
    const cleanersById = new Map((cleanersData ?? []).map((cl: any) => [cl.id, cl]))

    // 4. Agrupa as fotos por agendamento
    const groups: PhotoGroup[] = jobsData.map((job: any) => ({
      id: job.id,
      scheduled_date: job.scheduled_date,
      scheduled_time: job.scheduled_time,
      clients: clientsById.get(job.client_id) ?? null,
      cleaners: cleanersById.get(job.cleaner_id) ?? null,
      job_photos: photosData.filter((p) => p.job_id === job.id) as PhotoGroup['job_photos'],
    }))

    setPhotoGroups(groups.filter((g) => g.job_photos.length > 0))
    setLoading(false)
  }

  useEffect(() => {
    fetchPhotos()
  }, [filterDate])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6">
      {/* Topbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-emerald-400">Galeria de Execução de Limpezas</h1>
            <p className="text-xs text-slate-400">Fotos de Antes e Depois enviadas pela equipe</p>
          </div>
        </div>

        {/* Filtro por Data */}
        <div className="flex items-center gap-2 bg-slate-900 p-2 rounded-xl border border-slate-800">
          <Filter className="w-4 h-4 text-emerald-400" />
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="bg-transparent text-xs text-white focus:outline-none cursor-pointer"
          />
          {filterDate && (
            <button
              onClick={() => setFilterDate('')}
              className="text-[10px] text-slate-400 hover:text-white underline ml-1"
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Exibição por Card de Limpeza */}
      {loading ? (
        <p className="text-xs text-slate-500 py-8">Carregando galeria de fotos...</p>
      ) : photoGroups.length === 0 ? (
        <p className="text-xs text-slate-500 py-8">Nenhuma foto registrada para este período.</p>
      ) : (
        <div className="space-y-6">
          {photoGroups.map((group) => (
            <div
              key={group.id}
              className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4"
            >
              {/* Informações da Limpeza */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-white text-base">{group.clients?.name || 'Cliente'}</span>
                  {group.unit_details && (
                    <span className="text-xs bg-purple-950/60 text-purple-300 border border-purple-800/40 px-2 py-0.5 rounded flex items-center gap-1 font-medium">
                      <Home className="w-3 h-3 text-purple-400" /> {group.unit_details}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-emerald-400" /> {group.scheduled_date}
                  </span>
                  <span className="flex items-center gap-1 text-emerald-300">
                    <UserCheck className="w-3.5 h-3.5" /> Limpadora: {group.cleaners?.name || 'Não atribuída'}
                  </span>
                </div>
              </div>

              {/* Grid das Fotos do Agendamento */}
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {group.job_photos.map((photo) => (
                  <a
                    key={photo.id}
                    href={photo.photo_url}
                    target="_blank"
                    rel="noreferrer"
                    className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 aspect-square group block"
                  >
                    <img
                      src={photo.photo_url}
                      alt="Foto do imóvel"
                      className="w-full h-full object-cover transition transform group-hover:scale-105"
                    />
                    <span
                      className={`absolute top-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        photo.photo_type === 'before'
                          ? 'bg-amber-950/90 text-amber-300 border border-amber-600/50'
                          : 'bg-emerald-950/90 text-emerald-300 border border-emerald-600/50'
                      }`}
                    >
                      {photo.photo_type === 'before' ? 'Antes' : 'Depois'}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}