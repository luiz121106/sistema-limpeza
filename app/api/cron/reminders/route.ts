import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// E-mail da dona/admin para receber o resumo
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'seu-email-aqui@gmail.com'

export async function GET() {
  // Instancia a Resend dentro da função para evitar erro no 'npm run build'
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY não configurada.' }, { status: 500 })
  }
  const resend = new Resend(apiKey)

  // Datas no fuso horário de Santa Rosa Beach (Central Time)
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Chicago' })
  
  const tomorrowDate = new Date()
  tomorrowDate.setDate(tomorrowDate.getDate() + 1)
  const tomorrow = tomorrowDate.toLocaleDateString('sv-SE', { timeZone: 'America/Chicago' })

  // 1. Busca agendamentos de hoje e amanhã
  const { data: jobs, error } = await supabase
    .from('jobs')
    .select('*, clients(name, address), cleaners(name, email)')
    .in('scheduled_date', [today, tomorrow])
    .neq('status', 'cancelled')

  if (error || !jobs || jobs.length === 0) {
    return NextResponse.json({ message: 'Nenhum agendamento para notificar.' })
  }

  const FROM_EMAIL = 'Gestão BC <onboarding@resend.dev>'

  // 2. Dispara e-mail para cada limpadora
  for (const job of jobs as any[]) {
    const isToday = job.scheduled_date === today
    const whenText = isToday ? 'HOJE' : 'AMANHÃ'

    if (job.cleaners?.email) {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: job.cleaners.email,
        subject: `⏰ Lembrete de Limpeza ${whenText} - ${job.clients?.name}`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h2>Olá, ${job.cleaners.name}!</h2>
            <p>Você tem uma limpeza agendada para <strong>${whenText} (${job.scheduled_date})</strong> às <strong>${job.scheduled_time}</strong>.</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 15px 0;" />
            <p><strong>Cliente:</strong> ${job.clients?.name}</p>
            <p><strong>Endereço:</strong> ${job.clients?.address}</p>
            ${job.notes ? `<p><strong>Observações:</strong> ${job.notes}</p>` : ''}
          </div>
        `
      })
    }
  }

  // 3. Dispara e-mail de resumo para a DONA / ADMIN
  const todayJobs = (jobs as any[]).filter(j => j.scheduled_date === today)
  const tomorrowJobs = (jobs as any[]).filter(j => j.scheduled_date === tomorrow)

  await resend.emails.send({
    from: FROM_EMAIL,
    to: ADMIN_EMAIL,
    subject: `📋 Resumo do Dia: ${todayJobs.length} limpezas hoje / ${tomorrowJobs.length} amanhã`,
    html: `
      <div style="font-family: sans-serif; padding: 20px; color: #333;">
        <h2>Resumo Diário de Agendamentos</h2>
        <h3>Limpezas para HOJE (${today}): ${todayJobs.length}</h3>
        <ul>
          ${todayJobs.map(j => `<li><strong>${j.scheduled_time}</strong> - ${j.clients?.name} (Limpadora: ${j.cleaners?.name || 'Não atribuída'})</li>`).join('')}
        </ul>
        <h3>Limpezas para AMANHÃ (${tomorrow}): ${tomorrowJobs.length}</h3>
        <ul>
          ${tomorrowJobs.map(j => `<li><strong>${j.scheduled_time}</strong> - ${j.clients?.name} (Limpadora: ${j.cleaners?.name || 'Não atribuída'})</li>`).join('')}
        </ul>
      </div>
    `
  })

  return NextResponse.json({ success: true, count: jobs.length })
}