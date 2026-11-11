import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

// Configuração usando a Porta 587 (STARTTLS) para evitar bloqueios de rede local
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // usa STARTTLS
  requireTLS: true,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASS,
  },
  tls: {
    rejectUnauthorized: false, // evita falhas de certificado na máquina local
  },
  connectionTimeout: 10000,
})

export async function POST(request: Request) {
  try {
    const { 
      type, // 'NEW_JOB' | 'UPDATE' | 'CANCELLATION'
      cleanerEmail, 
      cleanerName, 
      clientName, 
      unit, 
      unitDetails, 
      date, 
      time, 
      address, 
      payout 
    } = await request.json()

    if (!cleanerEmail) {
      return NextResponse.json({ error: 'E-mail do limpador não informado' }, { status: 400 })
    }

    // Aceita tanto a chave 'unit' quanto 'unitDetails'
    const unitLabel = unit || unitDetails || null

    const formattedDate = date ? date.split('-').reverse().join('/') : date

    // Formata o repasse em Dólar (USD) mantendo duas casas decimais
    const formattedPayout = payout 
      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(payout))
      : null

    // Personalização por tipo de evento
    let subject = ''
    let titleHeader = ''
    let colorHeader = '#059669' // Verde (Padrão)
    let alertMessage = '<p>Você tem um novo agendamento de limpeza confirmado.</p>'

    if (type === 'CANCELLATION') {
      subject = `❌ CANCELADO: Agendamento em ${clientName} - ${formattedDate}`
      titleHeader = 'Agendamento Cancelado / Removido'
      colorHeader = '#dc2626' // Vermelho
      alertMessage = '<p style="color: #dc2626; font-weight: bold;">Informamos que o agendamento de limpeza abaixo foi CANCELADO ou você foi removido(a) deste serviço.</p>'
    } else if (type === 'UPDATE') {
      subject = `✏️ ATUALIZAÇÃO: Agendamento em ${clientName} - ${formattedDate}`
      titleHeader = 'Agendamento Atualizado'
      colorHeader = '#d97706' // Amarelo/Laranja
      alertMessage = '<p style="color: #d97706; font-weight: bold;">Houve alterações nos detalhes da sua limpeza. Confira as informações atualizadas abaixo:</p>'
    } else {
      subject = `🧹 Novo Agendamento de Limpeza - ${formattedDate}`
      titleHeader = `Olá, ${cleanerName}!`
      colorHeader = '#059669'
      alertMessage = '<p>Você tem um novo agendamento de limpeza confirmado.</p>'
    }

    const info = await transporter.sendMail({
      from: `"Sistema de Limpeza" <${process.env.GMAIL_USER}>`,
      to: cleanerEmail,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: ${colorHeader}; margin-top: 0;">${titleHeader}</h2>
          ${alertMessage}
          
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 5px 0;">
              <strong>👤 Cliente:</strong> ${clientName}
              ${
                unitLabel 
                  ? `<span style="background-color: #6b21a8; color: #ffffff; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 12px; margin-left: 6px;">${unitLabel}</span>` 
                  : ''
              }
            </p>
            ${unitLabel ? `<p style="margin: 5px 0;"><strong>🏢 Unidade / Área:</strong> ${unitLabel}</p>` : ''}
            <p style="margin: 5px 0;"><strong>📅 Data:</strong> ${formattedDate}</p>
            <p style="margin: 5px 0;"><strong>⏰ Horário:</strong> ${time}</p>
            <p style="margin: 5px 0;"><strong>📍 Endereço:</strong> ${address}</p>
            ${formattedPayout && type !== 'CANCELLATION' ? `<p style="margin: 5px 0;"><strong>💵 Valor de Serviço:</strong> ${formattedPayout}</p>` : ''}
          </div>

          <p style="font-size: 11px; color: #6b7280; margin-bottom: 0;">Este é um e-mail automático enviado pelo sistema de agendamento.</p>
        </div>
      `,
    })

    console.log('E-mail enviado com sucesso! ID:', info.messageId)
    return NextResponse.json({ success: true, messageId: info.messageId })
  } catch (error: any) {
    console.error('ERRO DETALHADO DO GMAIL:', error)
    return NextResponse.json({ error: 'Erro ao enviar e-mail: ' + error.message }, { status: 500 })
  }
}