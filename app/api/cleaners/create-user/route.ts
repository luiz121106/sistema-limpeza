import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { cleanerId, email, password } = await req.json()

    if (!cleanerId || !email || !password) {
      return NextResponse.json(
        { error: 'E-mail e senha são obrigatórios.' },
        { status: 400 }
      )
    }

    // Busca o funcionário no banco
    const { data: cleaner, error: cleanerErr } = await supabaseAdmin
      .from('cleaners')
      .select('user_id')
      .eq('id', cleanerId)
      .single()

    if (cleanerErr) {
      return NextResponse.json({ error: 'Funcionário não encontrado.' }, { status: 404 })
    }

    let userId = cleaner.user_id

    if (userId) {
      // Se já possui acesso, atualiza e-mail e senha
      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        email,
        password,
        email_confirm: true,
      })

      if (updateErr) throw updateErr
    } else {
      // Se não possui acesso, cria novo usuário no Supabase Auth
      const { data: authData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role: 'cleaner' },
      })

      if (createErr) throw createErr
      userId = authData.user.id

      // Vincula o user_id retornado à tabela de cleaners
      const { error: linkErr } = await supabaseAdmin
        .from('cleaners')
        .update({ user_id: userId, email })
        .eq('id', cleanerId)

      if (linkErr) throw linkErr
    }

    return NextResponse.json({ success: true, userId })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Erro interno do servidor.' },
      { status: 500 }
    )
  }
}