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
    const { cleanerEmail, cleanerName, clientName, date, time, address, payout } = await request.json()

    if (!cleanerEmail) {
      return NextResponse.json({ error: 'E-mail do limpador não informado' }, { status: 400 })
    }

    const formattedDate = date ? date.split('-').reverse().join('/') : date

    // Formata o repasse em Dólar (USD) mantendo duas casas decimais
    const formattedPayout = payout 
      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(payout))
      : null

    const info = await transporter.sendMail({
      from: `"Sistema de Limpeza" <${process.env.GMAIL_USER}>`,
      to: cleanerEmail,
      subject: `🧹 Novo Agendamento de Limpeza - ${formattedDate}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #059669; margin-top: 0;">Olá, ${cleanerName}!</h2>
          <p>Você tem um novo agendamento de limpeza confirmado.</p>
          
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>👤 Cliente:</strong> ${clientName}</p>
            <p style="margin: 5px 0;"><strong>📅 Data:</strong> ${formattedDate}</p>
            <p style="margin: 5px 0;"><strong>⏰ Horário:</strong> ${time}</p>
            <p style="margin: 5px 0;"><strong>📍 Endereço:</strong> ${address}</p>
            ${formattedPayout ? `<p style="margin: 5px 0;"><strong>💵 Valor de Serviço:</strong> ${formattedPayout}</p>` : ''}
          </div>

          <p style="font-size: 13px; color: #6b7280;">Por favor, certifique-se de chegar ao local no horário combinado.</p>
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