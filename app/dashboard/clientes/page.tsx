'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, ArrowLeft, Trash2, Edit, Home, ChevronDown, ChevronUp, MapPin, DollarSign } from 'lucide-react'
import Link from 'next/link'

interface Property {
  id: string
  client_id: string
  name: string
  address: string
}

interface Client {
  id: string
  name: string
  address: string
  price_standard: number
  price_heavy: number
  price_move_in_out: number
  price_vacation: number
  cleaner_payout: number
  notes?: string
  properties?: Property[]
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null)

  // Modal Cliente
  const [showClientModal, setShowClientModal] = useState(false)
  const [editingClientId, setEditingClientId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [priceStandard, setPriceStandard] = useState('')
  const [priceHeavy, setPriceHeavy] = useState('')
  const [priceMoveInOut, setPriceMoveInOut] = useState('')
  const [priceVacation, setPriceVacation] = useState('')
  const [cleanerPayout, setCleanerPayout] = useState('')
  const [notes, setNotes] = useState('')

  // Modal Unidade / Imóvel
  const [showPropertyModal, setShowPropertyModal] = useState(false)
  const [selectedClientIdForProperty, setSelectedClientIdForProperty] = useState<string | null>(null)
  const [propertyName, setPropertyName] = useState('')
  const [propertyAddress, setPropertyAddress] = useState('')

  const [saving, setSaving] = useState(false)

  const fetchClientsAndProperties = async () => {
    setLoading(true)

    // Buscar Clientes
    const { data: clientsData, error: clientErr } = await supabase
      .from('clients')
      .select('*')
      .order('name')

    // Buscar Propriedades
    const { data: propertiesData, error: propErr } = await supabase
      .from('properties')
      .select('*')
      .order('name')

    if (!clientErr && clientsData) {
      const merged = clientsData.map((client) => ({
        ...client,
        properties: (propertiesData || []).filter((p) => p.client_id === client.id),
      }))
      setClients(merged)
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchClientsAndProperties()
  }, [])

  // --- Ações de Cliente ---
  const handleOpenNewClientModal = () => {
    setEditingClientId(null)
    setName('')
    setAddress('')
    setPriceStandard('')
    setPriceHeavy('')
    setPriceMoveInOut('')
    setPriceVacation('')
    setCleanerPayout('')
    setNotes('')
    setShowClientModal(true)
  }

  const handleOpenEditClientModal = (client: Client) => {
    setEditingClientId(client.id)
    setName(client.name)
    setAddress(client.address || '')
    setPriceStandard(client.price_standard?.toString() || '0')
    setPriceHeavy(client.price_heavy?.toString() || '0')
    setPriceMoveInOut(client.price_move_in_out?.toString() || '0')
    setPriceVacation(client.price_vacation?.toString() || '0')
    setCleanerPayout(client.cleaner_payout?.toString() || '0')
    setNotes(client.notes || '')
    setShowClientModal(true)
  }

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const payload = {
      name,
      address,
      price_standard: parseFloat(priceStandard) || 0,
      price_heavy: parseFloat(priceHeavy) || 0,
      price_move_in_out: parseFloat(priceMoveInOut) || 0,
      price_vacation: parseFloat(priceVacation) || 0,
      cleaner_payout: parseFloat(cleanerPayout) || 0,
      notes: notes || null,
    }

    let error
    if (editingClientId) {
      const { error: updateError } = await supabase.from('clients').update(payload).eq('id', editingClientId)
      error = updateError
    } else {
      const { error: insertError } = await supabase.from('clients').insert([payload])
      error = insertError
    }

    if (!error) {
      setShowClientModal(false)
      fetchClientsAndProperties()
    } else {
      alert('Erro ao salvar cliente: ' + error.message)
    }
    setSaving(false)
  }

  const handleDeleteClient = async (id: string) => {
    if (!confirm('Excluir este cliente removerá também suas unidades e histórico. Confirmar?')) return

    const { error } = await supabase.from('clients').delete().eq('id', id)
    if (!error) {
      fetchClientsAndProperties()
    } else {
      alert('Erro ao excluir cliente: ' + error.message)
    }
  }

  // --- Ações de Unidade / Imóvel ---
  const handleOpenAddPropertyModal = (clientId: string) => {
    setSelectedClientIdForProperty(clientId)
    setPropertyName('')
    setPropertyAddress('')
    setShowPropertyModal(true)
  }

  const handleSaveProperty = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedClientIdForProperty) return
    setSaving(true)

    const { error } = await supabase.from('properties').insert([
      {
        client_id: selectedClientIdForProperty,
        name: propertyName,
        address: propertyAddress,
      },
    ])

    if (!error) {
      setShowPropertyModal(false)
      fetchClientsAndProperties()
    } else {
      alert('Erro ao adicionar unidade: ' + error.message)
    }
    setSaving(false)
  }

  const handleDeleteProperty = async (propertyId: string) => {
    if (!confirm('Deseja remover esta unidade?')) return

    const { error } = await supabase.from('properties').delete().eq('id', propertyId)
    if (!error) {
      fetchClientsAndProperties()
    } else {
      alert('Erro ao remover unidade: ' + error.message)
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedClientId(expandedClientId === id ? null : id)
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Topbar */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 transition">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-emerald-400">Gerenciamento de Clientes</h1>
        </div>
        <button
          onClick={handleOpenNewClientModal}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-2 rounded-lg text-sm transition cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Novo Cliente
        </button>
      </header>

      {/* Lista de Clientes */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {loading ? (
          <p className="text-slate-400 text-center py-10">Carregando clientes...</p>
        ) : clients.length === 0 ? (
          <div className="text-center py-16 bg-slate-800/50 rounded-2xl border border-slate-700">
            <h3 className="text-lg font-medium text-slate-300">Nenhum cliente cadastrado</h3>
            <p className="text-slate-500 text-sm mt-1">Clique em "Novo Cliente" para começar.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {clients.map((client) => {
              const isExpanded = expandedClientId === client.id
              const propertyCount = client.properties?.length || 0

              return (
                <div key={client.id} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                  {/* Cabeçalho do Card do Cliente */}
                  <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-800/80">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-white text-lg">{client.name}</span>
                        {propertyCount > 0 && (
                          <span className="text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                            <Home className="w-3 h-3" /> {propertyCount} {propertyCount === 1 ? 'Unidade' : 'Unidades'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-500" /> {client.address || 'Endereço principal não informado'}
                      </p>
                    </div>

                    {/* Preços e Ações */}
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <div className="flex items-center gap-2 bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-700">
                        <DollarSign className="w-4 h-4 text-emerald-400" />
                        <div>
                          <span className="text-slate-400 text-[10px] block">Standard</span>
                          <span className="font-semibold text-emerald-400">${client.price_standard}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleOpenAddPropertyModal(client.id)}
                        className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-lg flex items-center gap-1 transition cursor-pointer font-medium"
                      >
                        <Plus className="w-3.5 h-3.5" /> Unidade
                      </button>

                      <button
                        onClick={() => handleOpenEditClientModal(client)}
                        className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded transition cursor-pointer"
                        title="Editar Cliente"
                      >
                        <Edit className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleDeleteClient(client.id)}
                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition cursor-pointer"
                        title="Excluir Cliente"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      {propertyCount > 0 && (
                        <button
                          onClick={() => toggleExpand(client.id)}
                          className="p-1.5 text-slate-400 hover:text-white bg-slate-700/50 rounded transition cursor-pointer"
                          title="Ver Unidades"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Agrupamento de Unidades / Imóveis Expandível */}
                  {isExpanded && propertyCount > 0 && (
                    <div className="bg-slate-900/50 p-4 border-t border-slate-700 space-y-2">
                      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Home className="w-3.5 h-3.5 text-indigo-400" /> Unidades do Cliente
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {client.properties?.map((prop) => (
                          <div
                            key={prop.id}
                            className="bg-slate-800 p-3 rounded-lg border border-slate-700/80 flex items-center justify-between text-xs"
                          >
                            <div>
                              <span className="font-semibold text-white block">{prop.name}</span>
                              <span className="text-slate-400 flex items-center gap-1 text-[11px] mt-0.5">
                                <MapPin className="w-3 h-3 text-slate-500" /> {prop.address}
                              </span>
                            </div>
                            <button
                              onClick={() => handleDeleteProperty(prop.id)}
                              className="text-slate-500 hover:text-red-400 p-1 rounded transition"
                              title="Remover Unidade"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Modal Criar/Editar Cliente */}
      {showClientModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-lg border border-slate-700 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-4 text-white">
              {editingClientId ? 'Editar Cliente' : 'Novo Cliente'}
            </h2>
            <form onSubmit={handleSaveClient} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Nome do Cliente *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: John Doe"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Endereço Principal</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ex: 123 Main St, Austin, TX"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Preço Standard ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={priceStandard}
                    onChange={(e) => setPriceStandard(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Preço Pesada ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={priceHeavy}
                    onChange={(e) => setPriceHeavy(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Preço Move-In/Out ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={priceMoveInOut}
                    onChange={(e) => setPriceMoveInOut(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Preço Vacation/Airbnb ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={priceVacation}
                    onChange={(e) => setPriceVacation(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Repasse Padrão Limpadora ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={cleanerPayout}
                  onChange={(e) => setCleanerPayout(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Notas / Instruções do Cliente</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Obs: Possui cachorro, chave na caixa com código 1234..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowClientModal(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : 'Salvar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Adicionar Unidade / Imóvel */}
      {showPropertyModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-slate-700 shadow-2xl">
            <h2 className="text-lg font-bold mb-4 text-white flex items-center gap-2">
              <Home className="w-5 h-5 text-indigo-400" /> Nova Unidade / Imóvel
            </h2>
            <form onSubmit={handleSaveProperty} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Nome/Identificador da Unidade *</label>
                <input
                  type="text"
                  required
                  value={propertyName}
                  onChange={(e) => setPropertyName(e.target.value)}
                  placeholder="Ex: Casa de Praia, Apt 302, Unidade B"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Endereço da Unidade *</label>
                <input
                  type="text"
                  required
                  value={propertyAddress}
                  onChange={(e) => setPropertyAddress(e.target.value)}
                  placeholder="Ex: 456 Ocean Dr, Suite 302"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowPropertyModal(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {saving ? 'Adicionando...' : 'Adicionar Unidade'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}