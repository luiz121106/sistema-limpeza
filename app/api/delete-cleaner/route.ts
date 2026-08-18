import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { cleanerId } = await req.json()

    if (!cleanerId) {
      return NextResponse.json({ error: 'ID do limpador não informado.' }, { status: 400 })
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

    if (!serviceKey) {
      console.error('❌ ERRO: SUPABASE_SERVICE_ROLE_KEY não está definida no .env.local')
      return NextResponse.json(
        { error: 'Configuração do servidor ausente: SUPABASE_SERVICE_ROLE_KEY não foi encontrada.' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl!, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    console.log(`🔍 Buscando limpador ID: ${cleanerId}...`)

    // 1. Busca os dados do limpador no banco
    const { data: cleaner, error: fetchError } = await supabaseAdmin
      .from('cleaners')
      .select('id, user_id')
      .eq('id', cleanerId)
      .single()

    if (fetchError || !cleaner) {
      console.error('❌ Erro ao buscar limpador no banco:', fetchError?.message)
      return NextResponse.json({ error: 'Limpador não encontrado no banco de dados.' }, { status: 404 })
    }

    const authUserId = cleaner.user_id

    // 2. Desvincula o limpador de possíveis agendamentos (para evitar erro de Foreign Key)
    console.log('🔄 Desvinculando o limpador dos agendamentos em jobs...')
    const { error: jobsError } = await supabaseAdmin
      .from('jobs')
      .update({ cleaner_id: null }) // Se sua coluna tiver outro nome (ex: limpador_id), ajuste aqui
      .eq('cleaner_id', cleanerId)

    if (jobsError) {
      console.warn('⚠️ Alerta ao desvincular de jobs (pode não existir a coluna/vínculo):', jobsError.message)
    }

    // 3. Deleta o registro da tabela 'cleaners'
    console.log('🗑️ Apagando registro da tabela cleaners...')
    const { error: dbError } = await supabaseAdmin
      .from('cleaners')
      .delete()
      .eq('id', cleanerId)

    if (dbError) {
      console.error('❌ Erro ao apagar da tabela cleaners:', dbError.message)
      return NextResponse.json(
        { error: 'Erro ao apagar do banco: ' + dbError.message },
        { status: 400 }
      )
    }

    // 4. Deleta o login/usuário do Supabase Auth
    if (authUserId) {
      console.log(`🔐 Revogando acesso no Supabase Auth para user_id: ${authUserId}...`)
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(authUserId)

      if (authError) {
        console.error('❌ Erro ao apagar do Supabase Auth:', authError.message)
        return NextResponse.json(
          { error: 'O registro foi removido, mas falhou ao apagar a conta de login: ' + authError.message },
          { status: 400 }
        )
      }
    } else {
      console.log('ℹ️ Este limpador não possuía login de acesso (user_id nulo).')
    }

    console.log('✅ Limpador e acesso excluídos com sucesso!')
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('❌ Erro interno na API:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}