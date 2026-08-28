'use client'

import { useEffect, useState, type ChangeEvent } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { ArrowRight, Check, Copy, ImagePlus, Menu, Share2, Trophy, X, Loader } from 'lucide-react'
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
        </nav>
        <div className="header-actions">
          <Link className="league-link" href="/enter">
            Enter the League <ArrowRight size={16} />
          </Link>
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

  useEffect(() => {
    fetch('/api/spotlight').then((response) => response.json()).then((payload) => setSpotlight(payload.data || null)).catch(() => setSpotlight(null))
  }, [])

  return (
    <section className="champion">
      <div className="champion-label">
        <Trophy size={15} /> CHAMPION SPOTLIGHT
      </div>
      <div className="champion-empty">
        <strong>{spotlight?.participants?.name || 'Winner gets featured here for 48 hours.'}</strong>
        <span>{spotlight?.participants?.description || 'Every vote matters.'}</span>
      </div>
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

  const handleVote = (participantId: string) => {
    if (voting || result || transitioning) return
    vote(participantId)
  }

  return (
    <>
      <Champion />
      <main className={`battle-section ${transitioning ? 'battle-transitioning' : ''}`}>
        <LeagueStatus leagueEndAt={battle.leagueEndAt} categoryName={category.name} />
        <span className="section-kicker">LIVE BATTLE</span>
        <h1>Which one wins?</h1>
        <p className="battle-subtitle">Choose one. The internet decides.</p>
        <div className="battle-grid">
          <button className={`battle-card ${result?.winner === battle.participantA.id ? 'selected' : ''}`} onClick={() => handleVote(battle.participantA.id)} disabled={Boolean(result) || transitioning || voting}>
            <Logo logo={battle.participantA.logo} name={battle.participantA.name} large />
            <span className="section-kicker">Product</span>
            <h2>{battle.participantA.name}</h2>
            <p>{battle.participantA.description}</p>
          </button>
          <div className="versus" aria-hidden="true">
            VS
          </div>
          <button className={`battle-card ${result?.winner === battle.participantB.id ? 'selected' : ''}`} onClick={() => handleVote(battle.participantB.id)} disabled={Boolean(result) || transitioning || voting}>
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
          <LeaderboardPreview categorySlug={categorySlug === 'all' ? undefined : categorySlug} />
        </section>
      </main>
    </>
  )
}

function LeaderboardPreview({ categorySlug }: { categorySlug?: string }) {
  const { data, loading } = useLeaderboard(categorySlug, 5)

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
          <input required placeholder="Product name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
            <option value="product">Product</option><option value="startup">Startup</option><option value="ai_tool">AI tool</option><option value="developer_tool">Developer tool</option>
          </select>
          <select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>{categories.filter((category) => category.id).map((category) => <option key={category.slug} value={category.slug}>{category.name}</option>)}</select>
          <textarea required placeholder="Describe your product" maxLength={500} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          <input type="url" placeholder="Website URL" value={form.websiteUrl} onChange={(event) => setForm({ ...form, websiteUrl: event.target.value })} />
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

  return (
    <main className="profile-page">
      <div className="subpage-title">
        <span className="section-kicker">PARTICIPANT</span>
        <h1>{participant?.name || (error ? 'Profile unavailable' : 'Loading...')}</h1>
        <p>{participant?.description || error}</p>
        {participant?.website_url && <a href={participant.website_url} target="_blank" rel="noreferrer">Visit website</a>}
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
