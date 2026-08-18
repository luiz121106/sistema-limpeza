'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, User, MapPin, Key, Phone, ArrowLeft, Pencil, Trash2, X } from 'lucide-react'
import Link from 'next/link'

interface Client {
  id: string
  name: string
  phone: string | null
  address: string
  gate_code: string | null
  price_standard: number
  price_heavy: number
  price_move_in_out: number
  notes: string | null
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  // Formulário Cadastro
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [gateCode, setGateCode] = useState('')
  const [priceStandard, setPriceStandard] = useState('')
  const [priceHeavy, setPriceHeavy] = useState('')
  const [priceMove, setPriceMove] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // Formulário Edição
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editGateCode, setEditGateCode] = useState('')
  const [editPriceStandard, setEditPriceStandard] = useState('')
  const [editPriceHeavy, setEditPriceHeavy] = useState('')
  const [editPriceMove, setEditPriceMove] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const fetchClients = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('name', { ascending: true })

    if (!error && data) {
      setClients(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchClients()
  }, [])

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const { error } = await supabase.from('clients').insert([
      {
        name,
        phone: phone || null,
        address,
        gate_code: gateCode || null,
        price_standard: parseFloat(priceStandard) || 0,
        price_heavy: parseFloat(priceHeavy) || 0,
        price_move_in_out: parseFloat(priceMove) || 0,
        notes: notes || null,
      },
    ])

    if (!error) {
      setShowModal(false)
      setName('')
      setPhone('')
      setAddress('')
      setGateCode('')
      setPriceStandard('')
      setPriceHeavy('')
      setPriceMove('')
      setNotes('')
      fetchClients()
    } else {
      alert('Erro ao salvar cliente: ' + error.message)
    }
    setSaving(false)
  }

  // Abrir Modal de Edição
  const handleOpenEditModal = (client: Client) => {
    setEditingClient(client)
    setEditName(client.name)
    setEditPhone(client.phone || '')
    setEditAddress(client.address)
    setEditGateCode(client.gate_code || '')
    setEditPriceStandard(client.price_standard.toString())
    setEditPriceHeavy(client.price_heavy.toString())
    setEditPriceMove(client.price_move_in_out.toString())
    setEditNotes(client.notes || '')
  }

  // Atualizar Cliente
  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingClient) return

    setEditSaving(true)

    const { error } = await supabase
      .from('clients')
      .update({
        name: editName,
        phone: editPhone || null,
        address: editAddress,
        gate_code: editGateCode || null,
        price_standard: parseFloat(editPriceStandard) || 0,
        price_heavy: parseFloat(editPriceHeavy) || 0,
        price_move_in_out: parseFloat(editPriceMove) || 0,
        notes: editNotes || null,
      })
      .eq('id', editingClient.id)

    if (!error) {
      setEditingClient(null)
      fetchClients()
    } else {
      alert('Erro ao atualizar cliente: ' + error.message)
    }
    setEditSaving(false)
  }

  // Excluir Cliente
  const handleDeleteClient = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este cliente?')) return

    const { error } = await supabase.from('clients').delete().eq('id', id)

    if (error) {
      alert('Erro ao excluir: ' + error.message)
    } else {
      fetchClients()
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Topbar */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-emerald-400">Cadastro de Clientes</h1>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-2 rounded-lg text-sm transition cursor-pointer active:scale-95"
        >
          <Plus className="w-4 h-4" /> Novo Cliente
        </button>
      </header>

      {/* Conteúdo */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {loading ? (
          <p className="text-slate-400 text-center py-10">Carregando clientes...</p>
        ) : clients.length === 0 ? (
          <div className="text-center py-16 bg-slate-800/50 rounded-2xl border border-slate-700">
            <User className="w-12 h-12 text-slate-500 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-slate-300">Nenhum cliente cadastrado</h3>
            <p className="text-slate-500 text-sm mt-1">Clique em "Novo Cliente" para adicionar o primeiro.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clients.map((c) => (
              <div key={c.id} className="bg-slate-800 p-5 rounded-xl border border-slate-700 space-y-3 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold text-lg text-white">{c.name}</h3>
                    {c.phone && (
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {c.phone}
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-300 space-y-1">
                    <p className="flex items-start gap-1.5 text-slate-400">
                      <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{c.address}</span>
                    </p>
                    {c.gate_code && (
                      <p className="flex items-center gap-1.5 text-slate-400">
                        <Key className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>Gate/Portão: <strong className="text-slate-200">{c.gate_code}</strong></span>
                      </p>
                    )}
                  </div>

                  {/* Preços por Modalidade */}
                  <div className="pt-2 border-t border-slate-700/60 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-slate-900/60 p-2 rounded-lg">
                      <span className="block text-slate-500 text-[10px]">Standard</span>
                      <strong className="text-emerald-400">${c.price_standard}</strong>
                    </div>
                    <div className="bg-slate-900/60 p-2 rounded-lg">
                      <span className="block text-slate-500 text-[10px]">Pesada</span>
                      <strong className="text-emerald-400">${c.price_heavy}</strong>
                    </div>
                    <div className="bg-slate-900/60 p-2 rounded-lg">
                      <span className="block text-slate-500 text-[10px]">Move-In/Out</span>
                      <strong className="text-emerald-400">${c.price_move_in_out}</strong>
                    </div>
                  </div>

                  {c.notes && (
                    <p className="text-xs text-slate-400 bg-slate-900/40 p-2 rounded border border-slate-700/40 italic">
                      "{c.notes}"
                    </p>
                  )}
                </div>

                {/* Botões de Ação */}
                <div className="pt-3 border-t border-slate-700/60 flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(c)}
                    className="p-2 text-slate-400 hover:text-white active:text-white hover:bg-slate-700 active:bg-slate-600 rounded-lg transition cursor-pointer"
                    title="Editar Cliente"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteClient(c.id)}
                    className="p-2 text-slate-400 hover:text-red-400 active:text-red-400 hover:bg-red-500/10 active:bg-red-500/20 rounded-lg transition cursor-pointer"
                    title="Excluir Cliente"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal de Novo Cliente */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-lg border border-slate-700 shadow-2xl max-h-[90vh] overflow-y-auto relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-bold mb-4 text-white">Cadastrar Novo Cliente</h2>
            <form onSubmit={handleSaveClient} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Nome do Cliente *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: John Smith"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm focus:outline-none focus:border-emerald-500 text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Telefone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(555) 000-0000"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm focus:outline-none focus:border-emerald-500 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Gate Code / Senha</label>
                  <input
                    type="text"
                    value={gateCode}
                    onChange={(e) => setGateCode(e.target.value)}
                    placeholder="#1234"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm focus:outline-none focus:border-emerald-500 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Endereço Completo *</label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="123 Main St, Orlando, FL"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm focus:outline-none focus:border-emerald-500 text-white"
                />
              </div>

              {/* Tabela de Preços do Cliente */}
              <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-700/60 space-y-2">
                <p className="text-xs font-semibold text-emerald-400">Preços Padrão do Cliente ($)</p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Standard</label>
                    <input
                      type="number"
                      step="0.01"
                      value={priceStandard}
                      onChange={(e) => setPriceStandard(e.target.value)}
                      placeholder="150"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Pesada</label>
                    <input
                      type="number"
                      step="0.01"
                      value={priceHeavy}
                      onChange={(e) => setPriceHeavy(e.target.value)}
                      placeholder="220"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Move-In/Out</label>
                    <input
                      type="number"
                      step="0.01"
                      value={priceMove}
                      onChange={(e) => setPriceMove(e.target.value)}
                      placeholder="300"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Observações / Instruções da Casa</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Cão no quintal, chave debaixo do tapete..."
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
                  {saving ? 'Salvando...' : 'Salvar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Editar Cliente */}
      {editingClient && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-lg border border-slate-700 shadow-2xl max-h-[90vh] overflow-y-auto relative">
            <button
              onClick={() => setEditingClient(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-bold mb-4 text-white">Editar Cliente</h2>
            <form onSubmit={handleUpdateClient} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Nome do Cliente *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm focus:outline-none focus:border-emerald-500 text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Telefone</label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm focus:outline-none focus:border-emerald-500 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Gate Code / Senha</label>
                  <input
                    type="text"
                    value={editGateCode}
                    onChange={(e) => setEditGateCode(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm focus:outline-none focus:border-emerald-500 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Endereço Completo *</label>
                <input
                  type="text"
                  required
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm focus:outline-none focus:border-emerald-500 text-white"
                />
              </div>

              {/* Tabela de Preços do Cliente */}
              <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-700/60 space-y-2">
                <p className="text-xs font-semibold text-emerald-400">Preços Padrão do Cliente ($)</p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Standard</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editPriceStandard}
                      onChange={(e) => setEditPriceStandard(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Pesada</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editPriceHeavy}
                      onChange={(e) => setEditPriceHeavy(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Move-In/Out</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editPriceMove}
                      onChange={(e) => setEditPriceMove(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Observações / Instruções da Casa</label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm focus:outline-none focus:border-emerald-500 text-white"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setEditingClient(null)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition cursor-pointer disabled:opacity-50"
                >
                  {editSaving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}