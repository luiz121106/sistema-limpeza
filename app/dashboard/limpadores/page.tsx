'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  ArrowLeft, 
  Plus, 
  Phone, 
  Mail, 
  Pencil, 
  Trash2, 
  KeyRound, 
  ShieldCheck, 
  X, 
  CheckCircle2, 
  AlertCircle,
  UserPlus
} from 'lucide-react'
import Link from 'next/link'

interface Cleaner {
  id: string
  name: string
  phone: string | null
  email: string | null
  active: boolean
  user_id: string | null
}

export default function LimpadoresPage() {
  const [cleaners, setCleaners] = useState<Cleaner[]>([])
  const [loading, setLoading] = useState(true)

  // Modal Novo Limpador
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState('')

  // Modal Editar Limpador
  const [editingCleaner, setEditingCleaner] = useState<Cleaner | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editActive, setEditActive] = useState(true)
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')

  // Modal de Senha/Acesso
  const [selectedCleaner, setSelectedCleaner] = useState<Cleaner | null>(null)
  const [accessEmail, setAccessEmail] = useState('')
  const [accessPassword, setAccessPassword] = useState('')
  const [accessLoading, setAccessLoading] = useState(false)
  const [accessError, setAccessError] = useState('')
  const [accessSuccess, setAccessSuccess] = useState(false)

  const fetchCleaners = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('cleaners').select('*').order('name')
    if (data && !error) {
      setCleaners(data as Cleaner[])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchCleaners()
  }, [])

  // Cadastrar Novo Limpador
  const handleAddCleaner = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddLoading(true)
    setAddError('')

    const { error } = await supabase.from('cleaners').insert([
      {
        name: newName,
        email: newEmail || null,
        phone: newPhone || null,
        active: true,
      },
    ])

    if (error) {
      setAddError(error.message)
      setAddLoading(false)
      return
    }

    setNewName('')
    setNewEmail('')
    setNewPhone('')
    setIsAddModalOpen(false)
    setAddLoading(false)
    fetchCleaners()
  }

  // Abrir Modal de Edição
  const handleOpenEditModal = (cleaner: Cleaner) => {
    setEditingCleaner(cleaner)
    setEditName(cleaner.name)
    setEditEmail(cleaner.email || '')
    setEditPhone(cleaner.phone || '')
    setEditActive(cleaner.active)
    setEditError('')
  }

  // Salvar Edição do Limpador
  const handleUpdateCleaner = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingCleaner) return

    setEditLoading(true)
    setEditError('')

    const { error } = await supabase
      .from('cleaners')
      .update({
        name: editName,
        email: editEmail || null,
        phone: editPhone || null,
        active: editActive,
      })
      .eq('id', editingCleaner.id)

    if (error) {
      setEditError(error.message)
      setEditLoading(false)
      return
    }

    setEditingCleaner(null)
    setEditLoading(false)
    fetchCleaners()
  }

  // Excluir Limpador
  const handleDeleteCleaner = async (cleanerId: string) => {
    if (!confirm('Deseja realmente excluir este limpador? O acesso dele será revogado.')) return

    try {
      const response = await fetch('/api/cleaners/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cleanerId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao excluir')
      }

      alert('Limpador e login excluídos com sucesso!')
      fetchCleaners()
    } catch (error: unknown) {
      const err = error as Error
      alert('Erro: ' + err.message)
    }
  }

  // Abrir Modal de Senha
  const openAccessModal = (cleaner: Cleaner) => {
    setSelectedCleaner(cleaner)
    setAccessEmail(cleaner.email || '')
    setAccessPassword('')
    setAccessError('')
    setAccessSuccess(false)
  }

  // Criar Usuário no Supabase Auth via API
  const handleCreateAccess = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCleaner) return

    setAccessLoading(true)
    setAccessError('')
    setAccessSuccess(false)

    try {
      const res = await fetch('/api/cleaners/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cleanerId: selectedCleaner.id,
          email: accessEmail,
          password: accessPassword,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Falha ao gerar acesso')
      }

      setAccessSuccess(true)
      fetchCleaners()
      setTimeout(() => {
        setSelectedCleaner(null)
        setAccessSuccess(false)
      }, 1500)
    } catch (err: unknown) {
      const error = err as Error
      setAccessError(error.message)
    } finally {
      setAccessLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6">
      {/* Topbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-emerald-400">Equipe de Limpeza</h1>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer active:scale-95"
        >
          <Plus className="w-4 h-4" /> Novo Limpador
        </button>
      </div>

      {/* Grid de Cards */}
      {loading ? (
        <div className="text-slate-500 text-xs py-8">Carregando equipe...</div>
      ) : cleaners.length === 0 ? (
        <div className="text-slate-500 text-xs py-8">Nenhum limpador cadastrado.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cleaners.map((cleaner) => (
            <div
              key={cleaner.id}
              className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4 relative flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-bold text-white">{cleaner.name}</h3>
                    {cleaner.user_id && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 mt-0.5">
                        <ShieldCheck className="w-3 h-3" /> Login ativado
                      </span>
                    )}
                  </div>

                  <span className={`border text-[10px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                    cleaner.active 
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${cleaner.active ? 'bg-emerald-400' : 'bg-slate-500'}`}></span>
                    {cleaner.active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-400">
                  {cleaner.phone && (
                    <p className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-emerald-400" /> {cleaner.phone}
                    </p>
                  )}
                  {cleaner.email && (
                    <p className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-emerald-400" /> {cleaner.email}
                    </p>
                  )}
                </div>
              </div>

              {/* Ações do Card */}
              <div className="border-t border-slate-800/80 pt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => openAccessModal(cleaner)}
                  className="text-xs text-slate-300 hover:text-emerald-400 active:text-emerald-400 flex items-center gap-1.5 font-medium transition cursor-pointer p-1"
                  title="Gerar Login / Definir Senha"
                >
                  <KeyRound className="w-4 h-4 text-emerald-400" />
                  {cleaner.user_id ? 'Alterar Senha' : 'Gerar Acesso'}
                </button>

                <div className="flex items-center gap-1 text-slate-400">
                  <button 
                    type="button"
                    onClick={() => handleOpenEditModal(cleaner)}
                    className="p-2.5 hover:text-white active:text-white hover:bg-slate-800 active:bg-slate-700 rounded-lg transition cursor-pointer" 
                    title="Editar"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>

                  <button 
                    type="button"
                    onClick={() => handleDeleteCleaner(cleaner.id)}
                    className="p-2.5 hover:text-red-400 active:text-red-400 hover:bg-red-500/10 active:bg-red-500/20 rounded-lg transition cursor-pointer" 
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Cadastro de Novo Limpador */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl relative space-y-4">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Cadastrar Novo Limpador</h3>
                <p className="text-xs text-slate-400">Adicione os dados do membro da equipe</p>
              </div>
            </div>

            <form onSubmit={handleAddCleaner} className="space-y-4">
              {addError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl text-xs text-center font-medium">
                  {addError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Maria Silva"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">E-mail</label>
                <input
                  type="email"
                  placeholder="exemplo@email.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Telefone / WhatsApp</label>
                <input
                  type="text"
                  placeholder="(00) 00000-0000"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition disabled:opacity-50 cursor-pointer"
                >
                  {addLoading ? 'Cadastrando...' : 'Cadastrar Limpador'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Limpador */}
      {editingCleaner && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl relative space-y-4">
            <button
              onClick={() => setEditingCleaner(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                <Pencil className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Editar Limpador</h3>
                <p className="text-xs text-slate-400">Atualize os dados de {editingCleaner.name}</p>
              </div>
            </div>

            <form onSubmit={handleUpdateCleaner} className="space-y-4">
              {editError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl text-xs text-center font-medium">
                  {editError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">E-mail</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Telefone / WhatsApp</label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="activeCheck"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                  className="rounded border-slate-800 bg-slate-950 text-emerald-500 focus:ring-emerald-500"
                />
                <label htmlFor="activeCheck" className="text-xs font-medium text-slate-300">
                  Limpador ativo na equipe
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingCleaner(null)}
                  className="px-4 py-2 rounded-xl border border-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition disabled:opacity-50 cursor-pointer"
                >
                  {editLoading ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para Gerar/Criar Senha */}
      {selectedCleaner && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl relative space-y-4">
            <button
              onClick={() => setSelectedCleaner(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Criar Login de Acesso</h3>
                <p className="text-xs text-slate-400">{selectedCleaner.name}</p>
              </div>
            </div>

            {selectedCleaner.user_id && (
              <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 p-3 rounded-xl text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Este funcionário já possui acesso. A nova senha substituirá a antiga.</span>
              </div>
            )}

            {accessSuccess ? (
              <div className="bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 p-4 rounded-xl text-center text-xs font-semibold flex items-center justify-center gap-2">
                <CheckCircle2 className="w-5 h-5" /> Senha criada com sucesso!
              </div>
            ) : (
              <form onSubmit={handleCreateAccess} className="space-y-4">
                {accessError && (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl text-xs text-center font-medium">
                    {accessError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">E-mail do Funcionário</label>
                  <input
                    type="email"
                    required
                    placeholder="exemplo@email.com"
                    value={accessEmail}
                    onChange={(e) => setAccessEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Senha Inicial</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Mínimo 6 caracteres"
                    value={accessPassword}
                    onChange={(e) => setAccessPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedCleaner(null)}
                    className="px-4 py-2 rounded-xl border border-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={accessLoading}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition disabled:opacity-50 cursor-pointer"
                  >
                    {accessLoading ? 'Salvando...' : 'Salvar Senha'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}