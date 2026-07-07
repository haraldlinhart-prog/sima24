import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

// Catches bot-generated random tokens like "WXQnZcxqFFurVSKaEGSBzeH" that are short
// enough to slide past a simple length check but look nothing like a real word/name:
// very few vowels AND unnaturally frequent upper/lowercase switching. Both conditions
// are required together (not just one) specifically to avoid flagging real oddly-cased
// words — "McDonald" or "PayPal" fail the case-switch check alone but have a normal
// vowel ratio, so they correctly pass.
function isGibberish(str) {
  if (!str) return false
  const words = str.split(/\s+/).filter(w => w.length >= 6)
  const vowelChars = 'aeiouyAEIOUYäöüÄÖÜàáâãåèéêëìíîïòóôõùúûýÀÁÂÃÅÈÉÊËÌÍÎÏÒÓÔÕÙÚÛÝ'
  for (const word of words) {
    const letters = word.replace(/[^a-zA-ZäöüÄÖÜßàáâãåèéêëìíîïòóôõùúûýÀÁÂÃÅÈÉÊËÌÍÎÏÒÓÔÕÙÚÛÝ]/g, '')
    if (letters.length < 6) continue

    let vowels = 0
    for (const ch of letters) if (vowelChars.includes(ch)) vowels++
    const vowelRatio = vowels / letters.length

    let transitions = 0
    for (let i = 1; i < letters.length; i++) {
      const prevUpper = letters[i - 1] === letters[i - 1].toUpperCase() && letters[i - 1] !== letters[i - 1].toLowerCase()
      const curUpper = letters[i] === letters[i].toUpperCase() && letters[i] !== letters[i].toLowerCase()
      if (prevUpper !== curUpper) transitions++
    }
    const transitionRatio = transitions / (letters.length - 1)
    if (vowelRatio < 0.2 && transitionRatio > 0.35) return true

    // Extra signal (sima24 hardening): real words/names — even long German compounds
    // like "Geschaeftsfuehrer" or "Datenschutzerklaerung" — top out around 4-5
    // consecutive consonants. Random tokens routinely run 6+ (e.g. "TNBZfxTf").
    // This catches cases the vowel/transition check alone misses.
    let run = 0, maxRun = 0
    for (const ch of letters) {
      if (vowelChars.includes(ch)) { run = 0 } else { run++; if (run > maxRun) maxRun = run }
    }
    if (maxRun >= 6) return true
  }
  // A single very long no-space token (however "wordlike") is also a bot tell.
  if (/\S{61,}/.test(str)) return true
  return false
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { name, email, thema, nachricht, elapsed, website } = req.body

  if (website) return res.status(200).json({ ok: true })
  if (!elapsed || elapsed < 3) return res.status(200).json({ ok: true })
  if (!name || !email || !nachricht) return res.status(400).json({ error: 'Missing fields' })

  if (isGibberish(name) || isGibberish(thema) || isGibberish(nachricht)) {
    // Silent success, same as honeypot/timing rejection — no hint to the bot that it
    // was specifically the content that got it caught.
    return res.status(200).json({ ok: true })
  }
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
