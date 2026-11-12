import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { cleanerId, email, password, role = 'cleaner' } = await req.json()

    if (!cleanerId || !email || !password) {
      return NextResponse.json(
        { error: 'E-mail e senha são obrigatórios.' },
        { status: 400 }
      )
    }

    const normalizedEmail = email.trim().toLowerCase()
    const validRole = role === 'admin' ? 'admin' : 'cleaner'

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
      // Se já possui acesso, atualiza e-mail, senha e nível de acesso (role)
      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: { role: validRole },
      })

      if (updateErr) throw updateErr
    } else {
      // Verifica se o e-mail já existe no Supabase Auth antes de criar
      const { data: listData } = await supabaseAdmin.auth.admin.listUsers()
      const existingAuthUser = listData?.users?.find(
        (u) => u.email?.toLowerCase() === normalizedEmail
      )

      if (existingAuthUser) {
        userId = existingAuthUser.id
        const { error: updateExistingErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          password,
          email_confirm: true,
          user_metadata: { role: validRole },
        })
        if (updateExistingErr) throw updateExistingErr
      } else {
        // Cria novo usuário no Supabase Auth com o nível de acesso escolhido
        const { data: authData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: normalizedEmail,
          password,
          email_confirm: true,
          user_metadata: { role: validRole },
        })

        if (createErr) throw createErr
        userId = authData.user.id
      }
    }

    // Vincula o user_id e atualiza o e-mail na tabela cleaners
    const { error: linkErr } = await supabaseAdmin
      .from('cleaners')
      .update({ user_id: userId, email: normalizedEmail })
      .eq('id', cleanerId)

    if (linkErr) throw linkErr

    return NextResponse.json({ success: true, userId, role: validRole })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Erro interno do servidor.' },
      { status: 500 }
    )
  }
}