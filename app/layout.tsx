import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'VoteMash — The internet decides.',
  description: 'Fast, competitive A/B battles for the products people love.',
  generator: 'VoteMash',
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#fbfbfd',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className="bg-background"><body className="antialiased">{children}{process.env.NODE_ENV === 'production' && <Analytics />}</body></html>
}
