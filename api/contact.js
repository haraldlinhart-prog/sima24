import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { name, email, thema, nachricht, elapsed, website } = req.body

  if (website) return res.status(200).json({ ok: true })
  if (!elapsed || elapsed < 3) return res.status(400).json({ error: 'Too fast' })
  if (!name || !email || !nachricht) return res.status(400).json({ error: 'Missing fields' })

  const hasLongWord = nachricht.split(' ').some(w => w.length > 60)
  if (hasLongWord) return res.status(400).json({ error: 'Spam detected' })
  if (name.length > 80) return res.status(400).json({ error: 'Spam detected' })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email' })

  try {
    await resend.emails.send({
      from: process.env.CONTACT_FROM || 'noreply@pan21.com',
      to: 'sima24@pan21.com',
      replyTo: email,
      subject: 'SIMA24 Enquiry – ' + (thema || 'General') + ' from ' + name,
      html: `
        <h2>New Enquiry – SIMA24 Virtual Office Pattaya</h2>
        <table style="border-collapse:collapse;width:100%">
          <tr><td style="padding:8px;font-weight:bold;width:120px">Name:</td><td style="padding:8px">${name}</td></tr>
          <tr><td style="padding:8px;font-weight:bold">Email:</td><td style="padding:8px"><a href="mailto:${email}">${email}</a></td></tr>
          <tr><td style="padding:8px;font-weight:bold">Enquiry:</td><td style="padding:8px">${thema || '–'}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;vertical-align:top">Message:</td><td style="padding:8px">${nachricht.replace(/\n/g, '<br>')}</td></tr>
        </table>
        <p style="color:#999;font-size:12px;margin-top:24px">Sent via sima24.net | Form dwell time: ${elapsed}s</p>
      `,
    })
    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('Resend error:', err)
    return res.status(500).json({ error: 'Mail send failed' })
  }
}
