import dns from 'node:dns/promises'
import net from 'node:net'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getConfiguredRateLimiter, getRateLimitKey, RATE_LIMIT_CONFIG } from '@/lib/security/rate-limit'
import { getClientIp, hashIpAddress } from '@/lib/security/voter'

const PreviewInputSchema = z.object({ url: z.string().url().max(2048) })
const MAX_RESPONSE_BYTES = 1024 * 1024
const REQUEST_TIMEOUT_MS = 5000
const MAX_REDIRECTS = 3

function isBlockedAddress(address: string) {
  if (address === '127.0.0.1' || address === '0.0.0.0' || address === '::1' || address.startsWith('169.254.')) return true
  if (net.isIPv4(address)) {
    const octets = address.split('.').map(Number)
    return octets[0] === 10 || octets[0] === 127 || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) || (octets[0] === 192 && octets[1] === 168)
  }
  if (net.isIPv6(address)) return address === '::1' || address.toLowerCase().startsWith('fc') || address.toLowerCase().startsWith('fd') || address.toLowerCase().startsWith('fe80:')
  return true
}

async function assertPublicUrl(value: string) {
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Only public HTTP(S) websites are supported')
  if (url.hostname === 'localhost' || url.hostname.endsWith('.localhost') || url.hostname.endsWith('.internal') || url.hostname === 'metadata.google.internal') throw new Error('Private hosts are not allowed')
  const addresses = await dns.lookup(url.hostname, { all: true, verbatim: true })
  if (!addresses.length || addresses.some(({ address }) => isBlockedAddress(address))) throw new Error('Private hosts are not allowed')
  return url
}

async function fetchPublicHtml(initialUrl: string) {
  let currentUrl = await assertPublicUrl(initialUrl)
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const response = await fetch(currentUrl, { redirect: 'manual', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), headers: { accept: 'text/html,application/xhtml+xml', 'user-agent': 'VoteMash metadata preview' } })
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location || redirect === MAX_REDIRECTS) throw new Error('Too many redirects')
      currentUrl = await assertPublicUrl(new URL(location, currentUrl).toString())
      continue
    }
    if (!response.ok) throw new Error('Website could not be fetched')
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/html')) throw new Error('Website did not return HTML')
    const reader = response.body?.getReader()
    if (!reader) throw new Error('Website response was empty')
    const chunks: Uint8Array[] = []
    let total = 0
    while (total < MAX_RESPONSE_BYTES) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_RESPONSE_BYTES) throw new Error('Website response was too large')
      chunks.push(value)
    }
    return { url: currentUrl, html: Buffer.concat(chunks).toString('utf8') }
  }
  throw new Error('Website could not be fetched')
}

function getMeta(html: string, key: string) {
  const pattern = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']*)["'][^>]*>|<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${key}["'][^>]*>`, 'i')
  const match = html.match(pattern)
  return match?.[1] || match?.[2] || null
}

function getIcon(html: string, baseUrl: URL) {
  const match = html.match(/<link[^>]+rel=["'][^"']*(?:icon|shortcut icon)[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>|<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*(?:icon|shortcut icon)[^"']*["'][^>]*>/i)
  const icon = match ? new URL(match[1] || match[2], baseUrl) : new URL('/favicon.ico', baseUrl)
  return ['http:', 'https:'].includes(icon.protocol) ? icon.toString() : null
}

function clean(value: string | null) {
  return value?.replace(/\s+/g, ' ').trim() || null
}

export async function POST(request: Request) {
  const limiter = getConfiguredRateLimiter()
  if (limiter) {
    const clientIp = getClientIp(request)
    const ipHash = hashIpAddress(clientIp)
    const key = getRateLimitKey(['preview', ipHash || 'anonymous'])
    const decision = await limiter.check(key, RATE_LIMIT_CONFIG.preview.limit, RATE_LIMIT_CONFIG.preview.windowSeconds)
    if (!decision.allowed) {
      const headers = decision.retryAfter ? { 'Retry-After': String(decision.retryAfter) } : undefined
      return NextResponse.json({ success: false, error: { code: 'RATE_LIMITED', message: 'Too many preview requests. Please wait a moment.' } }, { status: 429, headers })
    }
  }

  const parsed = PreviewInputSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ success: false, error: { code: 'INVALID_URL', message: 'Enter a valid public website URL.' } }, { status: 400 })
  try {
    const { url, html } = await fetchPublicHtml(parsed.data.url)
    const title = clean(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || null)
    const description = clean(getMeta(html, 'description'))
    const siteName = clean(getMeta(html, 'og:site_name'))
    const openGraphImage = getMeta(html, 'og:image')
    const icon = getIcon(html, url)
    return NextResponse.json({ success: true, data: { url: url.toString(), title, description, siteName, favicon: icon, openGraphImage: openGraphImage ? new URL(openGraphImage, url).toString() : null, logoUrl: openGraphImage ? new URL(openGraphImage, url).toString() : icon } })
  } catch (error) {
    return NextResponse.json({ success: false, error: { code: 'PREVIEW_FAILED', message: error instanceof Error ? error.message : 'Could not fetch website details' } }, { status: 422 })
  }
}
