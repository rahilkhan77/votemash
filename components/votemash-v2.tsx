'use client'

import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { ArrowRight, Check, Copy, Globe, ImagePlus, Menu, Share2, Trophy, X, Loader } from 'lucide-react'
import { useNextBattle, useVote, useLeaderboard } from '@/hooks/useApi'

type Category = { id: string; name: string; slug: string }

const categories: Category[] = [
  { id: '', name: 'All Categories', slug: 'all' },
  { id: 'ai-tools', name: 'AI Tools', slug: 'ai-tools' },
  { id: 'startups', name: 'Startups', slug: 'startups' },
  { id: 'developer-tools', name: 'Developer Tools', slug: 'developer-tools' },
  { id: 'apps', name: 'Apps', slug: 'apps' },
  { id: 'products', name: 'Products', slug: 'products' },
  { id: 'design-tools', name: 'Design Tools', slug: 'design-tools' },
  { id: 'productivity', name: 'Productivity', slug: 'productivity' },
  { id: 'games', name: 'Games', slug: 'games' },
]

function Logo({ logo, name, large = false }: { logo: string | null; name: string; large?: boolean }) {
  const [showFallback, setShowFallback] = useState(false)

  return (
    <div className={`participant-logo ${large ? 'large' : ''}`}>
      {logo && !showFallback ? (
        <Image src={logo} alt={`${name} logo`} width={large ? 72 : 34} height={large ? 72 : 34} onError={() => setShowFallback(true)} />
      ) : null}
      {!logo || showFallback ? <span>{name.slice(0, 2).toUpperCase()}</span> : null}
    </div>
  )
}

function normalizeWebsiteUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const candidate = trimmed.startsWith('@') ? `https://${trimmed.slice(1)}` : trimmed
  try {
    const parsed = new URL(candidate)
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : ''
  } catch {
    return ''
  }
}

function truncateForPreview(value: string | null | undefined, maxLength = 96) {
  const cleaned = value?.replace(/\s+/g, ' ').trim()
  if (!cleaned) return 'No description found.'
  if (cleaned.length <= maxLength) return cleaned
  const truncated = cleaned.slice(0, maxLength).trim()
  const lastSpace = truncated.lastIndexOf(' ')
  return lastSpace > 0 ? `${truncated.slice(0, lastSpace)}…` : `${truncated}…`
}

function getPreviewLogo(data: any) {
  const candidates = [
    data?.logoUrl,
    data?.openGraphImage,
    data?.favicon,
  ].filter((value): value is string => Boolean(value) && typeof value === 'string' && !value.startsWith('data:'))

  return candidates[0] || null
}

async function previewWebsiteMetadata(url: string, signal?: AbortSignal) {
  const response = await fetch('/api/participants/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
    signal,
  })
  const payload = await response.json()
  if (!response.ok) throw new Error(payload.error?.message || 'Could not fetch website details')
  return payload.data
}

function HomepageEntryBar({ onOpen }: { onOpen: (websiteUrl: string, categoryId: string) => void }) {
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [categoryId, setCategoryId] = useState('ai-tools')

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    onOpen(websiteUrl, categoryId)
  }

  return (
    <section className="entry-bar-wrap">
      <form className="entry-bar" onSubmit={handleSubmit}>
        <div className="entry-bar-field">
          <span className="entry-bar-icon" aria-hidden="true"><Globe size={18} /></span>
          <input
            type="url"
            value={websiteUrl}
            onChange={(event) => setWebsiteUrl(event.target.value)}
            placeholder="Your product URL or @handle"
            aria-label="Product URL or handle"
          />
        </div>
        <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} aria-label="Choose a category">
          {categories.filter((category) => category.id).map((category) => (
            <option key={category.slug} value={category.slug}>{category.name}</option>
          ))}
        </select>
        <button type="submit" className="entry-bar-button">
          Enter <ArrowRight size={16} />
        </button>
      </form>
    </section>
  )
}

function EntryModal({ isOpen, onClose, onSuccess, initialWebsiteUrl = '', initialCategoryId = 'ai-tools' }: { isOpen: boolean; onClose: () => void; onSuccess?: () => void; initialWebsiteUrl?: string; initialCategoryId?: string }) {
  const [step, setStep] = useState<'url' | 'form' | 'success'>('url')
  const [form, setForm] = useState({ name: '', type: 'product', categoryId: initialCategoryId, description: '', websiteUrl: initialWebsiteUrl, logoUrl: '' })
  const [status, setStatus] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [preview, setPreview] = useState<any>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [logoEdited, setLogoEdited] = useState(false)
  const [price, setPrice] = useState('FREE')
  const [previewRetryKey, setPreviewRetryKey] = useState(0)
  const previewControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!isOpen) return

    const normalized = normalizeWebsiteUrl(form.websiteUrl)
    const controller = new AbortController()

    if (previewControllerRef.current) {
      previewControllerRef.current.abort()
    }
    previewControllerRef.current = controller

    if (!normalized) {
      return
    }

    const timer = window.setTimeout(async () => {
      setPreview(null)
      setPreviewUrl('')
      setStatus('')
      setPreviewLoading(true)
      try {
        const data = await previewWebsiteMetadata(normalized, controller.signal)
        if (controller.signal.aborted) return
        setPreview(data)
        setPreviewUrl(normalized)
        setForm((current) => ({
          ...current,
          websiteUrl: normalized,
          name: current.name || data.siteName || data.title || '',
          description: current.description || data.description || '',
          logoUrl: logoEdited ? current.logoUrl : data.logoUrl || current.logoUrl || '',
        }))
      } catch (error) {
        if (controller.signal.aborted) return
        setPreview(null)
        setPreviewUrl('')
        setStatus("Couldn't fetch website details. You can enter them manually.")
      } finally {
        if (!controller.signal.aborted) setPreviewLoading(false)
      }
    }, 500)

    return () => {
      clearTimeout(timer)
      controller.abort()
      if (previewControllerRef.current === controller) previewControllerRef.current = null
    }
  }, [form.websiteUrl, isOpen, logoEdited, previewRetryKey])

  const uploadLogo = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      setStatus('Logo must be a PNG, JPEG, or WebP under 2 MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setLogoEdited(true)
      setForm((current) => ({ ...current, logoUrl: typeof reader.result === 'string' ? reader.result : current.logoUrl }))
    }
    reader.readAsDataURL(file)
  }

  const handleContinueFromUrl = () => {
    if (!form.websiteUrl || previewLoading) return
    setStep('form')
  }

  const handleRetryPreview = () => {
    const normalized = normalizeWebsiteUrl(form.websiteUrl)
    if (!normalized) return
    setStatus('')
    setPreview(null)
    setPreviewUrl('')
    setPreviewRetryKey((value) => value + 1)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setStatus('')
    try {
      const response = await fetch('/api/participants', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error?.message || 'Submission failed')
      if (data.data.checkoutUrl) {
        window.location.assign(data.data.checkoutUrl)
        return
      }
      setStep('success')
      setForm({ name: '', type: 'product', categoryId: initialCategoryId, description: '', websiteUrl: '', logoUrl: '' })
      setPreview(null)
      onSuccess?.()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  const normalizedWebsiteUrl = normalizeWebsiteUrl(form.websiteUrl)
  const previewLogo = preview ? getPreviewLogo(preview) : null
  const effectiveName = (preview?.siteName || preview?.title || form.name || 'Untitled product').trim() || 'Untitled product'
  const effectiveDescription = (preview?.description || form.description || 'No description found.').trim() || 'No description found.'
  const previewWebsite = normalizedWebsiteUrl ? new URL(normalizedWebsiteUrl).hostname.replace(/^www\./, '') : 'website.com'

  return (
    <div className="entry-modal-overlay" onClick={onClose}>
      <div className="entry-modal" onClick={(e) => e.stopPropagation()}>
        <button className="entry-modal-close" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>

        {step === 'url' && (
          <div className="entry-modal-content">
            <h2>Enter your product</h2>
            <p>Start with your website URL</p>
            <div style={{ display: 'grid', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  required
                  type="url"
                  placeholder="Your product URL"
                  value={form.websiteUrl}
                  onChange={(event) => {
                    const nextValue = event.target.value
                    setForm({ ...form, websiteUrl: nextValue })
                    setStatus('')
                    setPreview(null)
                    setPreviewUrl('')
                    if (!normalizeWebsiteUrl(nextValue)) {
                      setPreviewLoading(false)
                    }
                  }}
                  style={{ flex: 1 }}
                />
                <button type="button" onClick={handleContinueFromUrl} disabled={!form.websiteUrl || previewLoading} className="entry-continue-btn">
                  {previewLoading ? <Loader size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                </button>
              </div>

              {previewLoading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: '#f5f4f7', borderRadius: '10px', color: '#4f4a59', fontSize: '13px' }}>
                  <Loader size={14} className="animate-spin" />
                  <span>Fetching website details...</span>
                </div>
              )}

              {preview && previewUrl === normalizedWebsiteUrl && (
                <div style={{ display: 'grid', gap: '10px', padding: '12px', border: '1px solid #e8e5ee', borderRadius: '12px', background: '#fff', boxShadow: '0 8px 18px rgba(23,21,30,0.03)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <span style={{ fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#777480', fontWeight: '700' }}>Here&apos;s what we found</span>
                    <span style={{ fontSize: '11px', color: '#777480' }}>Fetched from your website</span>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {previewLogo ? (
                      <div style={{ width: '42px', height: '42px', minWidth: '42px', borderRadius: '10px', overflow: 'hidden', border: '1px solid #e8e5ee', background: '#f5f4f7', display: 'grid', placeItems: 'center' }}>
                        <Image src={previewLogo} alt={effectiveName} width={42} height={42} unoptimized loader={({ src }) => src} onError={(event) => { event.currentTarget.style.display = 'none' }} />
                      </div>
                    ) : (
                      <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#f1edff', color: '#7657d9', display: 'grid', placeItems: 'center', fontWeight: '700', fontSize: '12px' }}>
                        {effectiveName.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: '700', fontSize: '14px', lineHeight: '1.25', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{truncateForPreview(effectiveName, 52)}</div>
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '2px', lineHeight: '1.4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{truncateForPreview(effectiveDescription, 72)}</div>
                      <div style={{ fontSize: '11px', color: '#777480', marginTop: '4px' }}>{previewWebsite}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button type="button" className="entry-secondary-btn" onClick={() => setStep('form')}>Edit details</button>
                    <button type="button" className="entry-continue-btn" onClick={handleContinueFromUrl}>Continue <ArrowRight size={16} /></button>
                  </div>
                </div>
              )}

              {!previewLoading && status && (
                <div style={{ display: 'grid', gap: '8px', padding: '10px 12px', background: '#fff5f3', border: '1px solid #f1d7d3', borderRadius: '10px', color: '#5a2e2a', fontSize: '13px' }}>
                  <div>{status}</div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="button" className="entry-secondary-btn" onClick={handleRetryPreview}>Try again</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 'form' && (
          <form onSubmit={submit} style={{ display: 'grid', gap: '12px' }}>
            <div className="entry-modal-content">
              <h2>Almost there</h2>
              <p>Complete your submission</p>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>Product Name</label>
                <input required placeholder="Product name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>Description</label>
                <textarea required placeholder="Describe your product" maxLength={500} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} style={{ minHeight: '80px' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>Logo</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input type="file" accept="image/png,image/jpeg,image/webp" aria-label="Upload logo" onChange={uploadLogo} style={{ flex: 1 }} />
                  {form.logoUrl && <ImagePlus size={18} />}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>What are you entering?</label>
                <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
                  <option value="product">Product</option>
                  <option value="startup">Startup</option>
                  <option value="ai_tool">AI Tool</option>
                  <option value="developer_tool">Developer Tool</option>
                  <option value="app">App</option>
                  <option value="game">Game</option>
                  <option value="design_tool">Design Tool</option>
                  <option value="brand">Brand</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>Choose a category</label>
                <select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>
                  {categories.filter((category) => category.id).map((category) => (
                    <option key={category.slug} value={category.slug}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#666' }}>Entry price</div>
                <div style={{ fontSize: '20px', fontWeight: '600' }}>{price}</div>
              </div>

              {status && <p style={{ fontSize: '14px', color: '#d32f2f' }}>{status}</p>}

              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => setStep('url')} style={{ flex: 1 }} className="entry-secondary-btn">
                  Back
                </button>
                <button type="submit" disabled={submitting} style={{ flex: 1 }}>
                  {submitting ? 'Submitting...' : 'Enter League'}
                </button>
              </div>
            </div>
          </form>
        )}

        {step === 'success' && (
          <div className="entry-modal-content">
            <div style={{ textAlign: 'center' }}>
              <h2>You&apos;re in</h2>
              <p>Your product has entered the league.</p>
              <div style={{ marginTop: '24px' }}>
                <Link href={`/p/${form.name.toLowerCase().replace(/\s+/g, '-')}`} className="entry-success-link">
                  View your profile <ArrowRight size={16} />
                </Link>
              </div>
            </div>
            <button onClick={onClose} style={{ marginTop: '16px', width: '100%' }}>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function Header() {
  const [open, setOpen] = useState(false)

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link href="/" className="brand">
          <strong>VoteMash</strong>
          <span>The internet decides.</span>
        </Link>
        <nav>
          <Link href="/">Battles</Link>
          <Link href="/leaderboard">Leaderboard</Link>
          <Link href="/how-it-works">How It Works</Link>
        </nav>
        <div className="header-actions">
          <button className="mobile-menu" aria-label="Toggle menu" onClick={() => setOpen(!open)}>
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
      {open && (
        <div className="mobile-nav">
          <Link href="/">Battles</Link>
          <Link href="/leaderboard">Leaderboard</Link>
          <Link href="/how-it-works">How It Works</Link>
        </div>
      )}
    </header>
  )
}

function Categories({ selected, onChange }: { selected: string; onChange: (id: string) => void }) {
  return (
    <div className="category-scroll">
      <div className="category-pills">
        {categories.map((c) => (
          <button key={c.slug} className={selected === c.slug ? 'active' : ''} onClick={() => onChange(c.slug)}>
            {c.name}
          </button>
        ))}
      </div>
    </div>
  )
}

function LeagueStatus({ leagueEndAt, categoryName }: { leagueEndAt: string | null; categoryName: string }) {
  const [timeRemaining, setTimeRemaining] = useState('--:--:--')

  useEffect(() => {
    if (!leagueEndAt) return

    const updateTimer = () => {
      const now = new Date().getTime()
      const end = new Date(leagueEndAt).getTime()
      const diff = Math.max(0, end - now)

      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      setTimeRemaining(`${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [leagueEndAt])

  return (
    <div className="league-status">
      <span className="live-dot" />
      <b>{categoryName.toUpperCase()}</b>
      <i />
      <span>48H LEAGUE</span>
      <strong>
        {timeRemaining} <small>remaining</small>
      </strong>
    </div>
  )
}

function Champion() {
  const [spotlight, setSpotlight] = useState<any>(null)
  const [participant, setParticipant] = useState<any>(null)

  useEffect(() => {
    let cancelled = false

    const loadSpotlight = async () => {
      try {
        const response = await fetch('/api/spotlight')
        const payload = await response.json()
        const activeSpotlight = payload.data || null
        if (cancelled) return
        setSpotlight(activeSpotlight)

        if (!activeSpotlight?.participants?.slug) {
          setParticipant(null)
          return
        }

        const participantResponse = await fetch(`/api/participants/${activeSpotlight.participants.slug}`)
        const participantPayload = await participantResponse.json()
        if (!cancelled) setParticipant(participantPayload.data || null)
      } catch {
        if (!cancelled) {
          setSpotlight(null)
          setParticipant(null)
        }
      }
    }

    void loadSpotlight()
    return () => { cancelled = true }
  }, [])

  const championName = spotlight?.participants?.name || participant?.name || ''
  const championLogo = spotlight?.participants?.logo_url || participant?.logo_url || null
  const championWebsite = normalizeWebsiteUrl(participant?.website_url || '')
  const categoryName = participant?.categories?.name || '48H LEAGUE'

  return (
    <section className={`champion ${spotlight ? 'champion-active' : 'champion-empty-state'}`}>
      <div className="champion-label">
        <Trophy size={15} /> CHAMPION SPOTLIGHT
      </div>
      {spotlight ? (
        <div className="champion-feature">
          <Logo logo={championLogo} name={championName || 'Champion'} large />
          <div className="champion-feature-copy">
            <strong>{championName || 'Current champion'}</strong>
            <span>#1 — {categoryName} / 48H LEAGUE</span>
            <small>Featured for 48 hours</small>
          </div>
          {championWebsite ? (
            <a href={championWebsite} target="_blank" rel="noopener noreferrer" className="champion-visit">
              Visit website <ArrowRight size={15} />
            </a>
          ) : null}
        </div>
      ) : (
        <div className="champion-empty">
          <strong>Win this league and your product gets featured here for 48 hours.</strong>
        </div>
      )}
    </section>
  )
}

function Ranking({ entries }: { entries: any[] }) {
  return (
    <div className="ranking">
      {entries.map((entry, i) => (
        <Link href={`/p/${entry.participant.slug}`} className={`ranking-row ${i < 3 ? 'top' : ''}`} key={entry.participant.id}>
          <b>#{entry.rank}</b>
          <span className="rank-person">
            <Logo logo={entry.participant.logo} name={entry.participant.name} />
            <strong>{entry.participant.name}</strong>
          </span>
          <span className="rating">{entry.rating}</span>
          <span>{Math.round(entry.winRate)}%</span>
          <span className={entry.movement >= 0 ? 'up' : 'down'}>
            {entry.movement >= 0 ? '↑' : '↓'}
            {Math.abs(entry.movement)}
          </span>
        </Link>
      ))}
    </div>
  )
}

function ShareResult({ name }: { name: string }) {
  const [copied, setCopied] = useState(false)

  const share = async () => {
    const text = `${name} is currently ranked on VoteMash.`
    if (navigator.share) {
      await navigator.share({ title: 'VoteMash result', text, url: location.href })
    } else {
      await navigator.clipboard?.writeText(location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    }
  }

  return (
    <button className="share-result" onClick={share}>
      {copied ? <Check size={16} /> : <Share2 size={16} />} {copied ? 'Link copied' : 'Share Result'}
    </button>
  )
}

function BattleView({ categorySlug, setCategorySlug }: { categorySlug: string; setCategorySlug: (slug: string) => void }) {
  const { battle, loading, error, refetch } = useNextBattle(categorySlug === 'all' ? undefined : categorySlug)
  const { vote, loading: voting, result } = useVote(battle?.id || '')
  const [transitioning, setTransitioning] = useState(false)
  const [leaderboardRefreshKey, setLeaderboardRefreshKey] = useState(0)
  const [entryOpen, setEntryOpen] = useState(false)
  const [entrySeed, setEntrySeed] = useState({ websiteUrl: '', categoryId: 'ai-tools' })

  const category = categories.find((c) => c.slug === categorySlug) || categories[0]

  useEffect(() => {
    if (!result) return

    const timer = window.setTimeout(() => {
      setTransitioning(true)
      refetch()
      window.setTimeout(() => setTransitioning(false), 240)
    }, 850)

    return () => window.clearTimeout(timer)
  }, [result, refetch])

  if (error) {
    return (
      <>
        <Champion />
        <main className="battle-section">
          <LeagueStatus leagueEndAt={battle?.leagueEndAt || null} categoryName={category.name} />
          <p className="error-message">Couldn&apos;t load the next battle. Please retry.</p>
          <button onClick={() => void refetch()}>Retry</button>
        </main>
      </>
    )
  }

  if (loading) {
    return (
      <>
        <Champion />
        <main className="battle-section">
          <LeagueStatus leagueEndAt={null} categoryName={category.name} />
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
            <Loader size={40} className="animate-spin" />
          </div>
        </main>
      </>
    )
  }

  if (!battle) {
    return (
      <>
        <Champion />
        <main className="battle-section">
          <LeagueStatus leagueEndAt={null} categoryName={category.name} />
          <p>No battles available right now.</p>
          <Link href="/leaderboard">Check leaderboard</Link>
        </main>
      </>
    )
  }

  const handleVote = async (participantId: string) => {
    if (voting || result || transitioning) return
    if (await vote(participantId)) setLeaderboardRefreshKey((key) => key + 1)
  }

  const handleEntryOpen = (websiteUrl: string, categoryId: string) => {
    setEntrySeed({ websiteUrl, categoryId })
    setEntryOpen(true)
  }

  return (
    <>
      <HomepageEntryBar onOpen={handleEntryOpen} />
      <EntryModal key={`${entryOpen ? 'open' : 'closed'}-${entrySeed.websiteUrl}-${entrySeed.categoryId}`} isOpen={entryOpen} onClose={() => setEntryOpen(false)} initialWebsiteUrl={entrySeed.websiteUrl} initialCategoryId={entrySeed.categoryId} />
      <Champion />
      <main className={`battle-section ${transitioning ? 'battle-transitioning' : ''}`}>
        <LeagueStatus leagueEndAt={battle.leagueEndAt} categoryName={category.name} />
        <span className="section-kicker">LIVE BATTLE</span>
        <h1>Which one wins?</h1>
        <p className="battle-subtitle">Choose one. The internet decides.</p>
        <div className="battle-grid">
          <button className={`battle-card ${result?.winner === battle.participantA.id ? 'selected' : ''} ${result && result.winner !== battle.participantA.id ? 'secondary' : ''}`} onClick={() => handleVote(battle.participantA.id)} disabled={Boolean(result) || transitioning || voting}>
            <Logo logo={battle.participantA.logo} name={battle.participantA.name} large />
            <span className="section-kicker">Product</span>
            <h2>{battle.participantA.name}</h2>
            <p>{battle.participantA.description}</p>
          </button>
          <div className="versus" aria-hidden="true">
            VS
          </div>
          <button className={`battle-card ${result?.winner === battle.participantB.id ? 'selected' : ''} ${result && result.winner !== battle.participantB.id ? 'secondary' : ''}`} onClick={() => handleVote(battle.participantB.id)} disabled={Boolean(result) || transitioning || voting}>
            <Logo logo={battle.participantB.logo} name={battle.participantB.name} large />
            <span className="section-kicker">Product</span>
            <h2>{battle.participantB.name}</h2>
            <p>{battle.participantB.description}</p>
          </button>
        </div>
        {result && (
          <div className="battle-result" aria-live="polite">
            <strong>{result.winner === battle.participantA.id ? battle.participantA.name : battle.participantB.name} wins</strong>
            <span>{result.percentageA}% — {result.percentageB}%</span>
          </div>
        )}
        <div className="vote-note">1 vote per battle</div>
        <Categories selected={categorySlug} onChange={setCategorySlug} />

        <section className="home-leaderboard">
          <div className="section-heading">
            <div>
              <span className="section-kicker">TOP OF THE LEAGUE</span>
              <h2>Leaderboard</h2>
            </div>
            <Link href="/leaderboard">
              View full board <ArrowRight size={14} />
            </Link>
          </div>
          <LeaderboardPreview categorySlug={categorySlug === 'all' ? undefined : categorySlug} refreshKey={leaderboardRefreshKey} />
        </section>
      </main>
    </>
  )
}

function LeaderboardPreview({ categorySlug, refreshKey }: { categorySlug?: string; refreshKey?: number }) {
  const { data, loading } = useLeaderboard(categorySlug, 5, refreshKey)

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '20px' }}>Loading leaderboard...</div>
  }

  if (!data || data.leaderboard.length === 0) {
    return <div style={{ textAlign: 'center', padding: '20px' }}>No leaderboard data yet.</div>
  }

  return <Ranking entries={data.leaderboard} />
}

function Leaderboard({ categorySlug, setCategorySlug }: { categorySlug: string; setCategorySlug: (slug: string) => void }) {
  const category = categories.find((c) => c.slug === categorySlug) || categories[0]
  const { data, loading } = useLeaderboard(categorySlug === 'all' ? undefined : categorySlug, 50)

  return (
    <main className="subpage">
      <div className="subpage-title">
        <span className="section-kicker">THE RANKINGS</span>
        <h1>Leaderboard</h1>
        <p>Every vote moves the board.</p>
      </div>
      <div className="leaderboard-toolbar">
        <Categories selected={categorySlug} onChange={setCategorySlug} />
        <LeagueStatus leagueEndAt={data?.leagueEndsAt || null} categoryName={category.name} />
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Loader size={40} className="animate-spin" />
        </div>
      ) : data && data.leaderboard.length > 0 ? (
        <>
          <Ranking entries={data.leaderboard} />
          <Champion />
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px' }}>No leaderboard data available.</div>
      )}
    </main>
  )
}

function EnterLeague() {
  const [form, setForm] = useState({ name: '', type: 'product', categoryId: 'ai-tools', description: '', websiteUrl: '', logoUrl: '' })
  const [status, setStatus] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [preview, setPreview] = useState<any>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [logoEdited, setLogoEdited] = useState(false)
  const previewControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const normalizedUrl = normalizeWebsiteUrl(form.websiteUrl)
    if (!normalizedUrl) return

    const controller = new AbortController()
    if (previewControllerRef.current) {
      previewControllerRef.current.abort()
    }
    previewControllerRef.current = controller

    const timer = window.setTimeout(async () => {
      setPreview(null)
      setPreviewUrl('')
      setStatus('')
      setPreviewLoading(true)
      try {
        const data = await previewWebsiteMetadata(normalizedUrl, controller.signal)
        if (controller.signal.aborted) return
        setPreview(data)
        setPreviewUrl(normalizedUrl)
        setForm((current) => ({
          ...current,
          websiteUrl: normalizedUrl,
          name: current.name || data.siteName || data.title || '',
          description: current.description || data.description || '',
          logoUrl: logoEdited ? current.logoUrl : data.logoUrl || current.logoUrl || '',
        }))
      } catch (error) {
        if (controller.signal.aborted) return
        setPreview(null)
        setPreviewUrl('')
        setStatus("Couldn't fetch website details. You can enter them manually.")
      } finally {
        if (!controller.signal.aborted) setPreviewLoading(false)
      }
    }, 500)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
      if (previewControllerRef.current === controller) {
        previewControllerRef.current = null
      }
    }
  }, [form.websiteUrl, logoEdited])

  const uploadLogo = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      setStatus('Logo must be a PNG, JPEG, or WebP under 2 MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setLogoEdited(true)
      setForm((current) => ({ ...current, logoUrl: typeof reader.result === 'string' ? reader.result : current.logoUrl }))
    }
    reader.readAsDataURL(file)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setStatus('')
    try {
      const response = await fetch('/api/participants', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error?.message || 'Submission failed')
      if (data.data.checkoutUrl) window.location.assign(data.data.checkoutUrl)
      else setStatus('Your participant is live.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="enter-page">
      <div className="enter-copy">
        <span className="section-kicker">THE INTERNET DECIDES</span>
        <h1>
          Put your product
          <br />
          to the test.
        </h1>
        <p>Enter the 48H League and let the internet decide.</p>
        <div className="entry-proof">
          <span>
            <strong>48H</strong> live league
          </span>
          <span>
            <strong>1</strong> battle match
          </span>
          <span>
            <strong>∞</strong> opinions
          </span>
        </div>
      </div>
      <div className="price-card entry-form" style={{ textAlign: 'center', padding: '40px' }}>
        <form onSubmit={submit} style={{ display: 'grid', gap: '12px', textAlign: 'left' }}>
          <input required type="url" placeholder="Website URL" value={form.websiteUrl} onChange={(event) => {
            const nextValue = event.target.value
            setForm({ ...form, websiteUrl: nextValue })
            setStatus('')
            setPreview(null)
            setPreviewUrl('')
            if (!normalizeWebsiteUrl(nextValue)) {
              setPreviewLoading(false)
            }
          }} />
          {previewLoading && <p aria-live="polite">Fetching website details...</p>}
          {preview && previewUrl === form.websiteUrl && (
            <div aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {preview.logoUrl && <Image src={preview.logoUrl} alt="Website logo preview" width={48} height={48} unoptimized loader={({ src }) => src} />}
              <div>
                <strong>{preview.siteName || preview.title || form.name}</strong>
                <p style={{ margin: '4px 0 0' }}>{preview.description || 'Review and edit the details before entering.'}</p>
              </div>
            </div>
          )}
          <input required placeholder="Product name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
            <option value="product">Product</option><option value="startup">Startup</option><option value="ai_tool">AI tool</option><option value="developer_tool">Developer tool</option>
          </select>
          <select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>{categories.filter((category) => category.id).map((category) => <option key={category.slug} value={category.slug}>{category.name}</option>)}</select>
          <textarea required placeholder="Describe your product" maxLength={500} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          <input type="url" placeholder="Logo URL (optional)" value={form.logoUrl.startsWith('data:') ? '' : form.logoUrl} onChange={(event) => { setLogoEdited(true); setForm({ ...form, logoUrl: event.target.value }) }} />
          <input type="file" accept="image/png,image/jpeg,image/webp" aria-label="Upload logo" onChange={uploadLogo} />
          <button type="submit" disabled={submitting}>{submitting ? 'Submitting...' : 'Enter the League'}</button>
          {status && <p aria-live="polite">{status}</p>}
        </form>
      </div>
    </main>
  )
}

function Profile({ slug }: { slug: string }) {
  const [participant, setParticipant] = useState<any>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/participants/${slug}`).then(async (response) => {
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error?.message || 'Profile unavailable')
      setParticipant(payload.data)
    }).catch((reason) => setError(reason instanceof Error ? reason.message : 'Profile unavailable'))
  }, [slug])

  const websiteUrl = normalizeWebsiteUrl(participant?.website_url || '')

  return (
    <main className="profile-page">
      <div className="subpage-title">
        <span className="section-kicker">PARTICIPANT</span>
        <h1>{participant?.name || (error ? 'Profile unavailable' : 'Loading...')}</h1>
        <p>{participant?.description || error}</p>
        {websiteUrl && <a href={websiteUrl} target="_blank" rel="noopener noreferrer">Visit website</a>}
      </div>
    </main>
  )
}

function HowItWorks() {
  return (
    <main className="subpage how-page">
      <div className="subpage-title">
        <span className="section-kicker">THE LOOP</span>
        <h1>How VoteMash works</h1>
        <p>A public signal for products worth paying attention to.</p>
      </div>
      <div className="steps">
        {[
          ['01', 'Enter the League', 'Add your product to a category and get a profile.'],
          ['02', 'Get matched', 'Your product meets a challenger in a live 48H league.'],
          ['03', 'The public votes', 'Visitors choose a side. One vote per battle.'],
          ['04', 'Your rating changes', "Wins move your Elo rating and your place on the board."],
          ['05', 'Top 3 qualify for ALL', 'The strongest category performers earn a global spot.'],
          ['06', 'Champion Spotlight', 'The league winner gets featured for the following 48 hours.'],
        ].map(([n, t, d]) => (
          <article key={n}>
            <span>{n}</span>
            <h2>{t}</h2>
            <p>{d}</p>
          </article>
        ))}
      </div>
    </main>
  )
}

export default function VoteMash() {
  const pathname = usePathname()
  const [categorySlug, setCategorySlug] = useState('ai-tools')

  let content: React.ReactNode

  if (pathname === '/leaderboard') {
    content = <Leaderboard categorySlug={categorySlug} setCategorySlug={setCategorySlug} />
  } else if (pathname === '/enter') {
    content = <EnterLeague />
  } else if (pathname === '/how-it-works') {
    content = <HowItWorks />
  } else if (pathname?.startsWith('/p/')) {
    content = <Profile slug={pathname.split('/').pop() || 'unknown'} />
  } else {
    content = <BattleView categorySlug={categorySlug} setCategorySlug={setCategorySlug} />
  }

  return (
    <div className="votemash-shell">
      <Header />
      <div className="page-wrap">{content}</div>
      <footer>
        <Link href="/how-it-works">How It Works</Link>
        <span>VoteMash · The internet decides.</span>
        <span>© 2026 VoteMash</span>
      </footer>
    </div>
  )
}
