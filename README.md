# VoteMash

VoteMash is a public head-to-head voting league for products and tools. The internet decides.

## Architecture

- Next.js and TypeScript frontend and server routes
- PostgreSQL accessed through the lightweight `pg` driver
- Dodo Payments for paid participant entries
- Vercel Cron for expired league processing
- S3-compatible object storage can be used for user-uploaded logos

The browser is never authoritative for votes, ratings, prices, league state, or payment state. Anonymous voting uses a secure first-party cookie; only its SHA-256 hash is stored.

## Database

The canonical schema is [db/migrations/001_initial.sql](db/migrations/001_initial.sql). Apply it with:

```bash
npm run migrate
```

The migration creates users, categories, participants, leagues, league joins, stats, battles, votes, results, qualifications, spotlights, payments, payment events, pricing reservations, and abuse events. PostgreSQL constraints protect duplicate votes, participant pairs, league membership, and payment events.

## Seed

Set `DATABASE_URL`, then run:

```bash
npm run seed
```

The seed is idempotent. It creates the eight categories, ten initial AI Tools participants, an active 48-hour AI Tools league, participant stats, round-robin battles, and active voting battles.

## Environment

Copy `.env.example` to `.env.local` and provide:

- `DATABASE_URL`
- `NEXT_PUBLIC_APP_URL`
- Dodo variables: `DODO_PAYMENTS_API_KEY`, `DODO_WEBHOOK_SECRET`, `DODO_PAYMENTS_ENVIRONMENT`, `DODO_PAYMENTS_PRODUCT_ID_5`, `DODO_PAYMENTS_PRODUCT_ID_9`
- `CRON_SECRET`
- Optional R2 variables for uploaded participant logos

## Local development

```bash
npm install
npm run migrate
npm run seed
npm run dev
```

Open http://localhost:3000.

## APIs

- `GET /api/battles/next?categoryId=ai-tools`
- `POST /api/battles/:id/vote`
- `GET /api/leaderboard?categoryId=ai-tools`
- `GET /api/participants/:slug`
- `POST /api/participants`
- `GET /api/spotlight`
- `POST /api/webhooks/dodo`

## Participant entry and logos

Participant records are created dynamically. Paid entries remain pending until a verified Dodo webhook confirms payment. User-uploaded PNG, JPEG, and WebP logos should be stored in object storage and saved as `participants.logo_url`; initial verified assets live in `public/logos`.

## League lifecycle

Leagues run for exactly 48 hours. The cron route `/api/cron/leagues` finalizes active battles, updates Elo once per battle, qualifies the top three, creates the Champion Spotlight, and closes the league idempotently.

## Testing and deployment

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

Deploy the Next.js app to Vercel, configure the environment variables, provision PostgreSQL, run `npm run migrate` once, and run `npm run seed` for initial data. Configure a Vercel Cron request to `/api/cron/leagues` with `Authorization: Bearer $CRON_SECRET`.
