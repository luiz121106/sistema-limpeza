'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import imageCompression from 'browser-image-compression'
import { Camera, Trash2, X, Upload } from 'lucide-react'

interface JobPhoto {
  id: string
  job_id: string
  photo_url: string
  photo_type: string
  created_at: string
}

interface JobPhotosModalProps {
  jobId: string
  clientName: string
  onClose: () => void
}

export default function JobPhotosModal({ jobId, clientName, onClose }: JobPhotosModalProps) {
  const [photos, setPhotos] = useState<JobPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [photoType, setPhotoType] = useState<'before' | 'after'>('after')

  const fetchPhotos = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('job_photos')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })

    if (data) setPhotos(data as JobPhoto[])
    setLoading(false)
  }

  useEffect(() => {
    fetchPhotos()
  }, [jobId])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]

        const options = {
          maxSizeMB: 0.2, // Máximo 200KB
          maxWidthOrHeight: 1200,
          useWebWorker: true,
        }

        const compressedFile = await imageCompression(file, options)

        const fileExt = file.name.split('.').pop()
        const fileName = `${jobId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from('cleaning-photos')
          .upload(fileName, compressedFile)

        if (uploadError) throw uploadError

        const { data: publicUrlData } = supabase.storage
          .from('cleaning-photos')
          .getPublicUrl(fileName)

        await supabase.from('job_photos').insert([
          {
            job_id: jobId,
            photo_url: publicUrlData.publicUrl,
            photo_type: photoType,
          },
        ])
      }

      fetchPhotos()
    } catch (err: any) {
      alert('Erro ao enviar foto: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm('Deseja excluir esta foto?')) return

    const { error } = await supabase.from('job_photos').delete().eq('id', photoId)
    if (!error) {
      setPhotos(photos.filter((p) => p.id !== photoId))
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl p-6 shadow-2xl relative space-y-4">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-white cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Fotos da Limpeza</h3>
            <p className="text-xs text-slate-400">Cliente: {clientName}</p>
          </div>
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setPhotoType('before')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                photoType === 'before'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-slate-900 text-slate-400 border border-slate-800'
              }`}
            >
              Antes da Limpeza
            </button>
            <button
              type="button"
              onClick={() => setPhotoType('after')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                photoType === 'after'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-slate-900 text-slate-400 border border-slate-800'
              }`}
            >
              Depois da Limpeza
            </button>
          </div>

          <label className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer transition active:scale-95">
            <Upload className="w-4 h-4" />
            {uploading ? 'Compactando & Enviando...' : 'Adicionar Fotos'}
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={uploading}
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        </div>

        {loading ? (
          <p className="text-xs text-slate-500 py-8 text-center">Carregando fotos...</p>
        ) : photos.length === 0 ? (
          <p className="text-xs text-slate-500 py-8 text-center">Nenhuma foto enviada para este agendamento ainda.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-80 overflow-y-auto p-1">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="relative group rounded-xl overflow-hidden border border-slate-800 bg-slate-950 aspect-video"
              >
                <img
                  src={photo.photo_url}
                  alt="Foto da limpeza"
                  className="w-full h-full object-cover"
                />
                <span
                  className={`absolute top-1.5 left-1.5 text-[9px] font-bold px-2 py-0.5 rounded ${
                    photo.photo_type === 'before'
                      ? 'bg-amber-950/80 text-amber-300 border border-amber-600/50'
                      : 'bg-emerald-950/80 text-emerald-300 border border-emerald-600/50'
                  }`}
                >
                  {photo.photo_type === 'before' ? 'Antes' : 'Depois'}
                </span>
                <button
                  onClick={() => handleDeletePhoto(photo.id)}
                  className="absolute top-1.5 right-1.5 p-1.5 bg-red-600/80 hover:bg-red-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition cursor-pointer"
                  title="Excluir Foto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}