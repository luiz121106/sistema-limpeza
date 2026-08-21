'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, ArrowLeft, Trash2, Edit, Home, ChevronDown, ChevronUp, MapPin, DollarSign, Key, Phone, Mail, Shield, UserCheck } from 'lucide-react'
import Link from 'next/link'

interface Property {
  id: string
  client_id: string
  name: string
  address: string
  property_type: string
  default_price: number
  default_payout: number
}

interface Contact {
  type: 'phone' | 'email'
  label: string
  value: string
}

interface Credential {
  label: string
  code: string
}

interface Client {
  id: string
  name: string
  address: string
  client_type: string
  price_standard: number
  price_heavy: number
  price_move_in_out: number
  price_vacation: number
  cleaner_payout: number
  notes?: string
  admin_notes?: string
  contacts?: Contact[]
  access_credentials?: Credential[]
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
  const [clientType, setClientType] = useState('residential')
  const [priceStandard, setPriceStandard] = useState('')
  const [priceHeavy, setPriceHeavy] = useState('')
  const [priceMoveInOut, setPriceMoveInOut] = useState('')
  const [priceVacation, setPriceVacation] = useState('')
  const [cleanerPayout, setCleanerPayout] = useState('')
  const [notes, setNotes] = useState('')
  const [adminNotes, setAdminNotes] = useState('')
  
  // Múltiplos Contatos e Credenciais
  const [contacts, setContacts] = useState<Contact[]>([])
  const [credentials, setCredentials] = useState<Credential[]>([])

  // Modal Unidade / Imóvel
  const [showPropertyModal, setShowPropertyModal] = useState(false)
  const [selectedClientIdForProperty, setSelectedClientIdForProperty] = useState<string | null>(null)
  const [propertyName, setPropertyName] = useState('')
  const [propertyAddress, setPropertyAddress] = useState('')
  const [propertyType, setPropertyType] = useState('1x1')
  const [propertyDefaultPrice, setPropertyDefaultPrice] = useState('')
  const [propertyDefaultPayout, setPropertyDefaultPayout] = useState('')

  const [saving, setSaving] = useState(false)

  const fetchClientsAndProperties = async () => {
    setLoading(true)

    const { data: clientsData, error: clientErr } = await supabase
      .from('clients')
      .select('*')
      .order('name')

    const { data: propertiesData, error: propErr } = await supabase
      .from('properties')
      .select('*')
      .order('name')

    if (!clientErr && clientsData) {
      const merged = clientsData.map((client) => ({
        ...client,
        contacts: Array.isArray(client.contacts) ? client.contacts : [],
        access_credentials: Array.isArray(client.access_credentials) ? client.access_credentials : [],
        properties: (propertiesData || []).filter((p) => p.client_id === client.id),
      }))
      setClients(merged)
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchClientsAndProperties()
  }, [])

  // --- Handlers Contatos Dinâmicos ---
  const handleAddContact = () => {
    setContacts([...contacts, { type: 'phone', label: '', value: '' }])
  }

  const handleUpdateContact = (index: number, field: keyof Contact, value: string) => {
    const updated = [...contacts]
    updated[index] = { ...updated[index], [field]: value }
    setContacts(updated)
  }

  const handleRemoveContact = (index: number) => {
    setContacts(contacts.filter((_, i) => i !== index))
  }

  // --- Handlers Credenciais Dinâmicas ---
  const handleAddCredential = () => {
    setCredentials([...credentials, { label: '', code: '' }])
  }

  const handleUpdateCredential = (index: number, field: keyof Credential, value: string) => {
    const updated = [...credentials]
    updated[index] = { ...updated[index], [field]: value }
    setCredentials(updated)
  }

  const handleRemoveCredential = (index: number) => {
    setCredentials(credentials.filter((_, i) => i !== index))
  }

  // --- Ações de Cliente ---
  const handleOpenNewClientModal = () => {
    setEditingClientId(null)
    setName('')
    setAddress('')
    setClientType('residential')
    setPriceStandard('')
    setPriceHeavy('')
    setPriceMoveInOut('')
    setPriceVacation('')
    setCleanerPayout('')
    setNotes('')
    setAdminNotes('')
    setContacts([])
    setCredentials([])
    setShowClientModal(true)
  }

  const handleOpenEditClientModal = (client: Client) => {
    setEditingClientId(client.id)
    setName(client.name)
    setAddress(client.address || '')
    setClientType(client.client_type || 'residential')
    setPriceStandard(client.price_standard?.toString() || '0')
    setPriceHeavy(client.price_heavy?.toString() || '0')
    setPriceMoveInOut(client.price_move_in_out?.toString() || '0')
    setPriceVacation(client.price_vacation?.toString() || '0')
    setCleanerPayout(client.cleaner_payout?.toString() || '0')
    setNotes(client.notes || '')
    setAdminNotes(client.admin_notes || '')
    setContacts(client.contacts || [])
    setCredentials(client.access_credentials || [])
    setShowClientModal(true)
  }

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const payload = {
      name,
      address,
      client_type: clientType,
      price_standard: parseFloat(priceStandard) || 0,
      price_heavy: parseFloat(priceHeavy) || 0,
      price_move_in_out: parseFloat(priceMoveInOut) || 0,
      price_vacation: parseFloat(priceVacation) || 0,
      cleaner_payout: parseFloat(cleanerPayout) || 0,
      notes: notes || null,
      admin_notes: adminNotes || null,
      contacts,
      access_credentials: credentials,
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
    setPropertyType('1x1')
    setPropertyDefaultPrice('')
    setPropertyDefaultPayout('')
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
        property_type: propertyType,
        default_price: parseFloat(propertyDefaultPrice) || 0,
        default_payout: parseFloat(propertyDefaultPayout) || 0,
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

  const renderBadgeType = (type: string) => {
    switch (type) {
      case 'complex':
        return <span className="text-xs bg-purple-500/10 text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded-full font-medium">Complexo</span>
      case 'stelar':
        return <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-medium">Stelar (Vacation)</span>
      default:
        return <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full font-medium">Pequeno / Residencial</span>
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
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-white text-lg">{client.name}</span>
                        {renderBadgeType(client.client_type)}
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

                      <button
                        onClick={() => toggleExpand(client.id)}
                        className="p-1.5 text-slate-400 hover:text-white bg-slate-700/50 rounded transition cursor-pointer flex items-center gap-1"
                        title="Ver Detalhes e Unidades"
                      >
                        <span className="text-[11px] font-medium hidden sm:inline">Detalhes</span>
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Área Expandível: Unidades + Dados Privados da Administração */}
                  {isExpanded && (
                    <div className="bg-slate-900/60 p-4 border-t border-slate-700 space-y-4">
                      
                      {/* Senhas e Contatos Confidenciais (Admin Only) */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-800/90 p-3.5 rounded-xl border border-amber-500/20">
                        {/* Credenciais de Acesso */}
                        <div>
                          <h5 className="text-xs font-semibold text-amber-400 flex items-center gap-1.5 mb-2">
                            <Shield className="w-3.5 h-3.5" /> Senhas e Acessos (Privado Admin)
                          </h5>
                          {client.access_credentials && client.access_credentials.length > 0 ? (
                            <div className="space-y-1">
                              {client.access_credentials.map((cred, idx) => (
                                <div key={idx} className="flex items-center justify-between bg-slate-900/80 px-2.5 py-1 rounded text-xs">
                                  <span className="text-slate-400 font-medium">{cred.label}:</span>
                                  <span className="text-emerald-400 font-mono font-bold">{cred.code}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500 italic">Nenhuma senha registrada.</p>
                          )}
                        </div>

                        {/* Contatos Adicionais */}
                        <div>
                          <h5 className="text-xs font-semibold text-amber-400 flex items-center gap-1.5 mb-2">
                            <Phone className="w-3.5 h-3.5" /> Contatos Extras (Privado Admin)
                          </h5>
                          {client.contacts && client.contacts.length > 0 ? (
                            <div className="space-y-1">
                              {client.contacts.map((c, idx) => (
                                <div key={idx} className="flex items-center justify-between bg-slate-900/80 px-2.5 py-1 rounded text-xs">
                                  <span className="text-slate-400 font-medium">{c.label} ({c.type}):</span>
                                  <span className="text-indigo-300 font-mono">{c.value}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500 italic">Nenhum contato extra registrado.</p>
                          )}
                        </div>

                        {/* Anotações do Admin */}
                        {client.admin_notes && (
                          <div className="md:col-span-2 border-t border-slate-700/60 pt-2 mt-1">
                            <span className="text-[11px] font-semibold text-slate-400 block mb-0.5">Notas do Administrador:</span>
                            <p className="text-xs text-slate-300 bg-slate-900/50 p-2 rounded italic">{client.admin_notes}</p>
                          </div>
                        )}
                      </div>

                      {/* Lista de Unidades */}
                      <div>
                        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <Home className="w-3.5 h-3.5 text-indigo-400" /> Unidades do Cliente
                        </h4>
                        {propertyCount === 0 ? (
                          <p className="text-xs text-slate-500 italic">Nenhuma unidade vinculada. Clique no botão "+ Unidade" para adicionar.</p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {client.properties?.map((prop) => (
                              <div
                                key={prop.id}
                                className="bg-slate-800 p-3 rounded-lg border border-slate-700/80 flex items-center justify-between text-xs"
                              >
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-white">{prop.name}</span>
                                    <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded font-mono">
                                      {prop.property_type || '1x1'}
                                    </span>
                                  </div>
                                  <span className="text-slate-400 flex items-center gap-1 text-[11px] mt-1">
                                    <MapPin className="w-3 h-3 text-slate-500" /> {prop.address}
                                  </span>
                                  {(prop.default_price > 0 || prop.default_payout > 0) && (
                                    <span className="text-[10px] text-emerald-400 font-medium block mt-1">
                                      Cobrança: ${prop.default_price} | Repasse: ${prop.default_payout}
                                    </span>
                                  )}
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
                        )}
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
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-2xl border border-slate-700 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
            <h2 className="text-lg font-bold text-white">
              {editingClientId ? 'Editar Cliente' : 'Novo Cliente'}
            </h2>
            <form onSubmit={handleSaveClient} className="space-y-4">
              {/* Nome e Categoria */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs text-slate-400 mb-1">Nome do Cliente / Empresa *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: John Doe / Stelar Properties"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Tipo de Cliente *</label>
                  <select
                    value={clientType}
                    onChange={(e) => setClientType(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="residential">Pequeno / Residencial</option>
                    <option value="stelar">Stelar (Vacation Rentals)</option>
                    <option value="complex">Complexo / Prédios</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Endereço Principal / Sede</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ex: 123 Main St, Austin, TX"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Tabela de Preços Padrão */}
              <div className="bg-slate-900/50 p-3.5 rounded-xl border border-slate-700/70 space-y-3">
                <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Tabela de Preços Padrão ($)</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Standard</label>
                    <input
                      type="number"
                      step="0.01"
                      value={priceStandard}
                      onChange={(e) => setPriceStandard(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Pesada (Deep)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={priceHeavy}
                      onChange={(e) => setPriceHeavy(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Move-In/Out</label>
                    <input
                      type="number"
                      step="0.01"
                      value={priceMoveInOut}
                      onChange={(e) => setPriceMoveInOut(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Vacation/Airbnb</label>
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
                  <label className="block text-[11px] text-slate-400 mb-1">Repasse Padrão para Limpadora ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={cleanerPayout}
                    onChange={(e) => setCleanerPayout(e.target.value)}
                    placeholder="Valor pago à limpadora por padrão"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Múltiplos Contatos Dinâmicos */}
              <div className="bg-slate-900/50 p-3.5 rounded-xl border border-slate-700/70 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" /> Contatos Extras (Telefones/Emails)
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddContact}
                    className="text-xs bg-indigo-600/30 text-indigo-300 hover:bg-indigo-600/50 px-2 py-1 rounded transition"
                  >
                    + Adicionar Contato
                  </button>
                </div>

                {contacts.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">Nenhum contato extra adicionado.</p>
                ) : (
                  contacts.map((c, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select
                        value={c.type}
                        onChange={(e) => handleUpdateContact(idx, 'type', e.target.value as any)}
                        className="bg-slate-900 border border-slate-700 text-xs rounded p-2 text-white"
                      >
                        <option value="phone">Telefone</option>
                        <option value="email">E-mail</option>
                      </select>
                      <input
                        type="text"
                        placeholder="Rótulo (ex: Gerente, Financeiro)"
                        value={c.label}
                        onChange={(e) => handleUpdateContact(idx, 'label', e.target.value)}
                        className="w-1/3 bg-slate-900 border border-slate-700 text-xs rounded p-2 text-white"
                      />
                      <input
                        type="text"
                        placeholder="Número ou E-mail"
                        value={c.value}
                        onChange={(e) => handleUpdateContact(idx, 'value', e.target.value)}
                        className="flex-1 bg-slate-900 border border-slate-700 text-xs rounded p-2 text-white"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveContact(idx)}
                        className="text-slate-500 hover:text-red-400 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Múltiplas Credenciais de Acesso Privadas */}
              <div className="bg-slate-900/50 p-3.5 rounded-xl border border-amber-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                    <Key className="w-3.5 h-3.5" /> Senhas e Códigos de Acesso (Privado Admin)
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddCredential}
                    className="text-xs bg-amber-600/30 text-amber-300 hover:bg-amber-600/50 px-2 py-1 rounded transition"
                  >
                    + Adicionar Senha / Acesso
                  </button>
                </div>

                {credentials.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">Nenhuma senha cadastrada.</p>
                ) : (
                  credentials.map((cred, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Local/Rótulo (ex: Portão, Cofre, Wi-Fi)"
                        value={cred.label}
                        onChange={(e) => handleUpdateCredential(idx, 'label', e.target.value)}
                        className="w-1/2 bg-slate-900 border border-slate-700 text-xs rounded p-2 text-white"
                      />
                      <input
                        type="text"
                        placeholder="Código ou Senha"
                        value={cred.code}
                        onChange={(e) => handleUpdateCredential(idx, 'code', e.target.value)}
                        className="flex-1 bg-slate-900 border border-slate-700 text-xs rounded p-2 text-emerald-400 font-mono font-bold"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveCredential(idx)}
                        className="text-slate-500 hover:text-red-400 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Notas do Cliente vs Notas Privadas do Admin */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Notas Públicas (Limpadoras)</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Instruções visíveis para as limpadoras..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-amber-400 mb-1">Notas Confidenciais (Admin Only)</label>
                  <textarea
                    rows={2}
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Notas estratégicas apenas para a gerência..."
                    className="w-full bg-slate-900 border border-amber-500/40 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
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
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-slate-700 shadow-2xl space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
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
                  placeholder="Ex: Apt 302, Townhouse 4, Área Externa Bloco B"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Tipologia do Imóvel</label>
                <select
                  value={propertyType}
                  onChange={(e) => setPropertyType(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="1x1">1x1 (1 Quarto / 1 Banheiro)</option>
                  <option value="2x2">2x2 (2 Quartos / 2 Banheiros)</option>
                  <option value="3x2">3x2 (3 Quartos / 2 Banheiros)</option>
                  <option value="TH_1x1">Townhouse 1x1</option>
                  <option value="TH_2x2">Townhouse 2x2</option>
                  <option value="TH_3x3">Townhouse 3x3</option>
                  <option value="exterior">Área Externa</option>
                  <option value="building">Prédio / Condomínio</option>
                </select>
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Preço Cobrado ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={propertyDefaultPrice}
                    onChange={(e) => setPropertyDefaultPrice(e.target.value)}
                    placeholder="Opicional"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Repasse Limpadora ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={propertyDefaultPayout}
                    onChange={(e) => setPropertyDefaultPayout(e.target.value)}
                    placeholder="Opicional"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
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