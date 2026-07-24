// Fetches recent Thailand news (title, link, image, source, date) for the
// Feedzy-style news tiles in the "Why Thailand" section on the homepage.
// Cached at the edge for 30 minutes so the tiles refresh with fresh
// headlines throughout the day without hammering the source feed.

const FEED_URL = 'https://www.thaienquirer.com/feed/'
const SOURCE_NAME = 'Thai Enquirer'

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#8217;/g, "\u2019")
    .replace(/&#8216;/g, "\u2018")
    .replace(/&#8211;/g, "\u2013")
    .replace(/&#8212;/g, "\u2014")
    .replace(/&#8230;/g, "\u2026")
}

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))
  if (!m) return null
  const raw = m[1].replace('<![CDATA[', '').replace(']]>', '').trim()
  return decodeEntities(raw)
}

function stripTags(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function firstImage(block) {
  const content = block.match(/<content:encoded>([\s\S]*?)<\/content:encoded>/)
  const source = content ? content[1] : block
  const m = source.match(/<img[^>]*src="([^"]+)"/)
  return m ? m[1] : null
}

export default async function handler(req, res) {
  try {
    const response = await fetch(FEED_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Sima24NewsBot/1.0)' },
    })
    const xml = await response.text()
    const rawItems = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/g)).map(m => m[1])

    const parsed = rawItems
      .map(block => {
        const title = tag(block, 'title')
        const link = tag(block, 'link')
        const pubDate = tag(block, 'pubDate')
        const descRaw = tag(block, 'description') || ''
        const desc = stripTags(descRaw).slice(0, 150)
        const image = firstImage(block)
        return title && link && image ? { title, link, pubDate, desc, image, source: SOURCE_NAME } : null
      })
      .filter(Boolean)
      .slice(0, 4)

    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600')
    res.status(200).json({ items: parsed })
  } catch (err) {
    res.setHeader('Cache-Control', 's-maxage=300')
    res.status(200).json({ items: [] })
  }
}
