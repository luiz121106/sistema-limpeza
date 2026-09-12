'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  ArrowLeft,
  Plus,
  ExternalLink,
  Copy,
  Check,
  Edit,
  Trash2,
  Building,
  Globe
} from 'lucide-react'

interface VacationProperty {
  id: string
  name: string
  address: string
  client_name: string
  client_id?: string
}

interface VacationLink {
  id: string
  property_id?: string | null
  client_id?: string | null
  title?: string
  platform?: string
  url: string
}

export default function VacationLinksPage() {
  const [properties, setProperties] = useState<VacationProperty[]>([])
  const [links, setLinks] = useState<VacationLink[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Modal State
  const [showModal, setShowModal] = useState(false)
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null)
  const [selectedPropertyId, setSelectedPropertyId] = useState('')
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      // 1. Busca propriedades estritamente do tipo VACATION
      const { data: propsData, error: propsError } = await supabase
        .from('properties')
        .select('*, clients(*)')
        .ilike('property_type', '%vacation%')

      if (propsError) throw propsError

      // 2. Busca clientes estritamente do tipo VACATION
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .ilike('client_type', '%vacation%')

      if (clientsError) throw clientsError

      // 3. Mapeia propriedades reais
      const itemsFromProperties: VacationProperty[] = (propsData || []).map((p) => ({
        id: p.id,
        name: p.name || (p.unit_number ? `Unidade ${p.unit_number}` : 'Imóvel sem nome'),
        address: p.address || p.clients?.address || '',
        client_name: p.clients?.name || 'Cliente não informado',
        client_id: p.client_id
      }))

      // 4. Cria entradas virtuais para clientes Vacation sem sub-unidades
      const clientIdsWithProperties = new Set(itemsFromProperties.map((p) => p.client_id))

      const itemsFromClients: VacationProperty[] = (clientsData || [])
        .filter((c) => !clientIdsWithProperties.has(c.id))
        .map((c) => ({
          id: `client-${c.id}`,
          name: c.name,
          address: c.address || 'Endereço não informado',
          client_name: c.name,
          client_id: c.id
        }))

      const combinedProperties = [...itemsFromProperties, ...itemsFromClients]
      setProperties(combinedProperties)

      // 5. Busca links
      const { data: linksData, error: linksError } = await supabase
        .from('vacation_links')
        .select('*')
        .order('created_at', { ascending: true })

      if (linksError) throw linksError
      if (linksData) setLinks(linksData as VacationLink[])

    } catch (err) {
      console.error('Erro ao carregar dados:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (propertyId?: string, linkToEdit?: VacationLink) => {
    if (linkToEdit) {
      setEditingLinkId(linkToEdit.id)
      const targetId = linkToEdit.property_id || (linkToEdit.client_id ? `client-${linkToEdit.client_id}` : '')
      setSelectedPropertyId(targetId)
      setTitle(linkToEdit.title || linkToEdit.platform || '')
      setUrl(linkToEdit.url)
    } else {
      setEditingLinkId(null)
      setSelectedPropertyId(propertyId || (properties[0]?.id || ''))
      setTitle('Airbnb')
      setUrl('')
    }
    setShowModal(true)
  }

  const handleSaveLink = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPropertyId || !title || !url) {
      alert('Por favor, preencha todos os campos.')
      return
    }

    setSaving(true)
    try {
      const isVirtualClient = selectedPropertyId.startsWith('client-')
      const propertyIdValue = isVirtualClient ? null : selectedPropertyId
      const clientIdValue = isVirtualClient
        ? selectedPropertyId.replace('client-', '')
        : properties.find((p) => p.id === selectedPropertyId)?.client_id || null

      const payload = {
        property_id: propertyIdValue,
        client_id: clientIdValue,
        title,
        platform: title,
        url
      }

      if (editingLinkId) {
        const { error } = await supabase
          .from('vacation_links')
          .update(payload)
          .eq('id', editingLinkId)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('vacation_links')
          .insert([payload])

        if (error) throw error
      }

      setShowModal(false)
      fetchData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar link'
      alert(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteLink = async (linkId: string) => {
    if (!confirm('Deseja realmente remover este link?')) return

    const { error } = await supabase.from('vacation_links').delete().eq('id', linkId)
    if (!error) {
      fetchData()
    } else {
      alert('Erro ao deletar link: ' + error.message)
    }
  }

  const handleCopy = (linkId: string, textToCopy: string) => {
    navigator.clipboard.writeText(textToCopy)
    setCopiedId(linkId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Topbar */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-emerald-400">Unidades Vacation & Links</h1>
            <p className="text-xs text-slate-400">Links do Airbnb, Vrbo e plataformas de anúncios</p>
          </div>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-2 rounded-lg text-sm transition cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Novo Link
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 lg:p-6 max-w-6xl mx-auto w-full space-y-6">
        {loading ? (
          <p className="text-slate-400 text-center py-10">Carregando unidades...</p>
        ) : properties.length === 0 ? (
          <div className="bg-slate-800 rounded-xl p-8 text-center border border-slate-700">
            <Building className="w-12 h-12 text-slate-500 mx-auto mb-3" />
            <p className="text-slate-300 font-medium">Nenhuma propriedade Vacation cadastrada.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {properties.map((prop) => {
              const propLinks = links.filter((l) => {
                if (prop.id.startsWith('client-')) {
                  const clientId = prop.id.replace('client-', '')
                  return l.client_id === clientId
                }
                return l.property_id === prop.id
              })

              return (
                <div
                  key={prop.id}
                  className="bg-slate-800 border border-slate-700 rounded-xl p-5 flex flex-col justify-between hover:border-slate-600 transition"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 border-b border-slate-700/80 pb-3 mb-4">
                      <div>
                        <h2 className="font-bold text-lg text-white">{prop.name}</h2>
                        {prop.address && (
                          <p className="text-xs text-slate-400 mt-0.5">{prop.address}</p>
                        )}
                        {prop.client_name && (
                          <span className="inline-block text-[10px] bg-purple-900/40 text-purple-300 border border-purple-700/50 px-2 py-0.5 rounded mt-2">
                            Cliente: {prop.client_name}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleOpenModal(prop.id)}
                        className="p-1.5 text-xs text-emerald-400 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-800/50 rounded-lg flex items-center gap-1 transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Adicionar Link
                      </button>
                    </div>

                    {/* Links List */}
                    <div className="space-y-2">
                      {propLinks.length === 0 ? (
                        <p className="text-xs text-slate-500 italic py-2">
                          Nenhum link vinculado a esta unidade.
                        </p>
                      ) : (
                        propLinks.map((link) => (
                          <div
                            key={link.id}
                            className="bg-slate-900/80 border border-slate-700/70 rounded-lg p-2.5 flex items-center justify-between gap-2"
                          >
                            <div className="flex items-center gap-2 overflow-hidden">
                              <Globe className="w-4 h-4 text-sky-400 shrink-0" />
                              <div className="truncate">
                                <p className="text-xs font-semibold text-slate-200">
                                  {link.title || link.platform || 'Anúncio'}
                                </p>
                                <p className="text-[10px] text-slate-400 truncate">{link.url}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => handleCopy(link.id, link.url)}
                                className="p-1.5 text-slate-400 hover:text-emerald-400 bg-slate-800 hover:bg-slate-700 rounded transition cursor-pointer"
                                title="Copiar URL"
                              >
                                {copiedId === link.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>

                              <a
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 text-slate-400 hover:text-sky-400 bg-slate-800 hover:bg-slate-700 rounded transition"
                                title="Abrir link em nova aba"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>

                              <button
                                onClick={() => handleOpenModal(prop.id, link)}
                                className="p-1.5 text-slate-400 hover:text-amber-400 bg-slate-800 hover:bg-slate-700 rounded transition cursor-pointer"
                                title="Editar Link"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleDeleteLink(link.id)}
                                className="p-1.5 text-slate-500 hover:text-red-400 bg-slate-800 hover:bg-slate-700 rounded transition cursor-pointer"
                                title="Excluir Link"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Modal Adicionar / Editar Link */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-slate-700 shadow-2xl">
            <h2 className="text-lg font-bold mb-4 text-white">
              {editingLinkId ? 'Editar Link' : 'Adicionar Novo Link'}
            </h2>

            <form onSubmit={handleSaveLink} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Selecione a Unidade *</label>
                <select
                  required
                  value={selectedPropertyId}
                  onChange={(e) => setSelectedPropertyId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Selecione...</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.client_name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Plataforma / Nome do Anúncio *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Airbnb, Vrbo, Booking, Anúncio Venda..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">URL Completa do Anúncio *</label>
                <input
                  type="url"
                  required
                  placeholder="https://www.airbnb.com/rooms/..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex gap-2 justify-end pt-3">
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
                  {saving ? 'Salvando...' : 'Salvar Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}