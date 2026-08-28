# VoteMash - Full-Stack Implementation

A complete rebuild of VoteMash from frontend-only prototype to production-ready full-stack application.

## Architecture Overview

### Technology Stack
- **Frontend**: Next.js 16 with React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Anonymous voter tokens (secure cookies)
- **Payments**: Dodo Payments integration
- **Validation**: Zod schemas
- **Security**: Row Level Security (RLS), UNIQUE constraints, server-side validation

### Key Design Principles
- **Database is Authoritative**: All data truth lives in Supabase, not the browser
- **Server-Side Validation**: Business logic enforced server-side, not client-side
- **Transactional Operations**: Vote insertion uses database constraints for duplicate prevention
- **Secure Voter Identity**: Anonymous tokens hashed and stored, never raw tokens
- **Privacy First**: No raw IPs stored long-term, all data hashed for risk tracking

## Setup Instructions

### 1. Environment Configuration

Copy `.env.local.example` to `.env.local` and fill in your Supabase and Dodo test-mode credentials:

```bash
cp .env.local.example .env.local
```

**Required environment variables:**
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Public anonymous key from Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (server-side only)
- `DODO_PAYMENTS_API_KEY` - Dodo test-mode API key (server-only)
- `DODO_WEBHOOK_SECRET` - Dodo webhook signing secret (server-only)
- `DODO_PAYMENTS_ENVIRONMENT` - `test_mode` during development
- `DODO_PAYMENTS_PRODUCT_ID_5` - Dodo product configured at $5
- `DODO_PAYMENTS_PRODUCT_ID_9` - Dodo product configured at $9
- `NEXT_PUBLIC_APP_URL` - Your application URL (e.g., http://localhost:3000)

### 2. Supabase Project Setup

1. Create a Supabase project at https://supabase.com
2. Get your URL and API keys from Project Settings → API
3. Run migrations (see below)
4. Seed data (see below)

### 3. Database Migrations

Apply migrations to your Supabase database:

Using Supabase CLI:
```bash
supabase db push
```

Or manually execute SQL files in order:
1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_battle_and_related_tables.sql`
3. `supabase/migrations/003_payments_and_league_joins.sql`
4. `supabase/migrations/004_indexes.sql`
5. `supabase/migrations/005_rls_policies.sql`
6. `supabase/migrations/006_authoritative_voting.sql`
7. `supabase/migrations/007_finalization_consistency.sql`
8. `supabase/migrations/008_atomic_battle_finalization.sql`
9. `supabase/migrations/009_provider_neutral_payments.sql`
10. `supabase/migrations/010_pricing_reservations.sql`

The legacy Stripe payment columns remain only for historical data compatibility;
new records use `provider`, `provider_checkout_id`, and `provider_payment_id`.

### 3a. Dodo Payments Webhook

In Dodo test mode, create two one-time products priced at $5 and $9 and put
their IDs in `DODO_PAYMENTS_PRODUCT_ID_5` and `DODO_PAYMENTS_PRODUCT_ID_9`.
Create a webhook endpoint at:

```text
https://your-domain.example/api/webhooks/dodo
```

Subscribe it to `payment.succeeded` and `payment.failed`, then put its signing
secret in `DODO_WEBHOOK_SECRET`. The handler verifies Standard Webhooks headers
and uses `webhook-id` for database-backed idempotency.

### 4. Seed Database

Populate the database with initial categories and participants:

```bash
npm run seed
```

This:
- Creates 8 categories (AI Tools, Startups, Developer Tools, etc.)
- Adds 25 seed participants across categories
- Creates an initial 48-hour league
- Initializes participant stats
- Generates initial battles

### 5. Start Development Server

```bash
npm run dev
```

Visit http://localhost:3000 to see the application.

## API Endpoints

### Public Endpoints (No authentication required)

#### GET `/api/battles/next`
Fetch the next eligible battle for voting.

Query Parameters:
- `categoryId` (optional) - Filter battles by category

Response:
```json
{
  "success": true,
  "data": {
    "id": "battle-uuid",
    "leagueId": "league-uuid",
    "participantA": {
      "id": "participant-uuid",
      "name": "Cursor",
      "slug": "cursor",
      "logo": "https://...",
      "description": "AI coding assistant"
    },
    "participantB": { ... },
    "votesA": 63,
    "votesB": 37,
    "totalVotes": 100,
    "percentageA": 63,
    "percentageB": 37,
    "leagueEndAt": "2026-08-29T12:00:00Z"
  }
}
```

Automatically creates and sets a secure voter token cookie on first visit.

#### POST `/api/battles/[id]/vote`
Submit a vote for a battle.

Request Body:
```json
{
  "participantId": "participant-uuid"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "winner": "participant-uuid",
    "votesA": 64,
    "votesB": 37,
    "percentageA": 63,
    "percentageB": 37,
    "totalVotes": 101
  }
}
```

Error Cases:
- `409` - Duplicate vote (same voter, same battle)
- `400` - Invalid participant or battle
- `404` - Battle not found
- `401` - No voter token

#### GET `/api/leaderboard`
Fetch the leaderboard for a category.

Query Parameters:
- `categoryId` (optional) - Filter by category
- `limit` (optional, default: 50)
- `offset` (optional, default: 0)

Response:
```json
{
  "success": true,
  "data": {
    "leaderboard": [
      {
        "rank": 1,
        "participant": {
          "id": "...",
          "name": "Cursor",
          "slug": "cursor",
          "logo": "...",
          "description": "...",
          "type": "ai_tool"
        },
        "rating": 1532,
        "wins": 9,
        "losses": 2,
        "battleCount": 11,
        "votesReceived": 634,
        "winRate": 81.82,
        "movement": 2
      },
      ...
    ],
    "total": 25,
    "leagueEndsAt": "2026-08-29T12:00:00Z"
  }
}
```

### Frontend Implementation

The application connects to these APIs via client-side hooks:

#### `useNextBattle(categoryId?)`
Fetches the next eligible battle

```typescript
const { battle, loading, error, refetch } = useNextBattle('ai-tools');
```

#### `useVote(battleId)`
Submits a vote and returns the result

```typescript
const { vote, loading, error, result } = useVote(battleId);
await vote(participantId);
```

#### `useLeaderboard(categoryId?, limit?)`
Fetches leaderboard data

```typescript
const { data, loading, error } = useLeaderboard('ai-tools', 50);
```

## Database Schema

### Core Tables

**profiles**
- Authenticated user profiles
- Optional for public voters (anonymous voting supported)

**categories**
- Competition categories (AI Tools, Startups, etc.)
- 8 predefined categories

**participants**
- Products/tools competing in leagues
- Linked to categories
- Status: pending, active, rejected, inactive

**leagues**
- Time-limited competitions
- 48-hour duration
- Category-specific or global (ALL)

**participant_stats**
- Per-participant, per-league statistics
- Rating (Elo), wins, losses, win rate
- Unique constraint: (participant_id, league_id)

**battles**
- Individual matchups between two participants
- Tracks vote counts, winner, status

**votes**
- Individual votes recorded
- Unique constraint: (battle_id, voter_token_hash)
- Prevents duplicate voting

**battle_results**
- Final results after battle completion
- Stores Elo changes, vote percentages

**league_qualifications**
- Top 3 participants per category qualify for global league
- Unique constraint: (source_league_id, participant_id)

**champion_spotlights**
- Featured winner for 48 hours
- Auto-expires

**payments**
- Dodo Payments for participant entry
- Status: pending, paid, failed

## Voting System

### One Vote Per Battle Per Visitor

1. **Voter Identity**: Secure random token generated on first visit
2. **Storage**: Token stored in secure, HttpOnly cookie
3. **Hashing**: Token is hashed before database storage
4. **Duplicate Prevention**: Database UNIQUE constraint on (battle_id, voter_token_hash)

### Vote Flow

```
1. User clicks a participant card
   ↓
2. POST /api/battles/[id]/vote { participantId }
   ↓
3. Server validates:
   - Battle exists and is active
   - Participant is in battle
   - Voter hasn't voted in this battle (checked via database)
   ↓
4. Insert vote with unique constraint
   ↓
5. If unique violation → return 409 "Already voted"
   ↓
6. Update battle vote counts
   ↓
7. Return live result (current percentages)
   ↓
8. Frontend shows result, then auto-loads next battle
```

## Elo Rating System

### Configuration
- **Initial Rating**: 1500
- **K-Factor**: 32 (adjustment per battle)

### Formula
Expected Score: `1 / (1 + 10^((opponent_rating - player_rating) / 400))`

New Rating: `old_rating + K * (actual_score - expected_score)`

### Calculation Timing
- **When**: After battle is finalized (when league ends)
- **Not**: After each individual vote
- **Why**: Prevents gaming the system with voting shenanigans

## Battle Lifecycle

### Statuses
- `scheduled` - Generated but not yet active
- `active` - Accepting votes
- `completed` - Voting closed, results final
- `cancelled` - Removed from league

### Battle Finalization Process

When a league's 48-hour window closes:

1. Identify completed battles
2. Calculate final vote winner (tie-breaker: higher rating)
3. Calculate Elo changes
4. Update participant_stats
5. Create battle_results record
6. Update battle status to completed

### Tie-Breaking

If votes are exactly equal:
1. Higher Elo rating wins
2. If equal, earlier participant wins (more seasoned)

## League Lifecycle

### 48-Hour League Flow

```
START_AT
  ↓
ACTIVE (48 hours)
  ↓
END_AT (status changes to completed)
  ↓
FINALIZATION
  - Complete battles
  - Calculate ratings
  - Determine rankings
  - Select top 3 participants
  - Create league_qualifications
  ↓
CHAMPION SPOTLIGHT
  - Winner featured for 48 hours
  - Auto-expires
  ↓
NEXT LEAGUE STARTS
```

## Development Scripts

```bash
# Start development server
npm run dev

# Type-check
npm run typecheck

# Lint code
npm run lint

# Build for production
npm run build

# Start production server
npm start

# Seed database with initial data
npm run seed
```

## Deployment

### Vercel

VoteMash is optimized for Vercel deployment:

1. Connect your GitHub repository
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Environment Variables Checklist

Before deploying, ensure all variables are set:
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `DODO_PAYMENTS_API_KEY`
- [ ] `DODO_WEBHOOK_SECRET`
- [ ] `DODO_PAYMENTS_PRODUCT_ID_5`
- [ ] `DODO_PAYMENTS_PRODUCT_ID_9`
- [ ] `NEXT_PUBLIC_APP_URL` (production domain)

## Security Considerations

### Implemented
✅ Row Level Security (RLS) on all tables
✅ Server-side validation of all inputs
✅ Secure voter token cookies (HttpOnly, Secure, SameSite)
✅ Token hashing (no raw tokens in database)
✅ Database-enforced duplicate vote prevention
✅ Authenticated-only write operations
✅ Public read-only access for competition data
✅ Zod validation for all API inputs

### Not Implemented Yet (For Future)
⚠️ Rate limiting (basic structure ready)
⚠️ CAPTCHA for suspicious activity
⚠️ IP-based abuse detection
⚠️ Webhook signature verification (Dodo Payments)
⚠️ Payment fraud detection

## Known Limitations

1. **Voter Identity**: Uses browser cookies. One account per device.
2. **Bot Protection**: No CAPTCHA or other bot prevention yet
3. **Rate Limiting**: Basic structure ready but not enforced
4. **Participant Management**: Basic entry flow, no participant dashboard yet
5. **Dodo Payments**: Payment collection ready, but management features limited

## Troubleshooting

### "Missing required environment variable"
- Ensure .env.local exists with all required variables
- Restart dev server after updating environment variables

### "Battle not found"
- Verify league is active (check end_at timestamp)
- Run seed script to populate initial data

### "Voter token not found"
- Cookies might be disabled
- Check browser cookie settings
- Clear site data and refresh

### "Duplicate vote" on first visit
- Voter token cookie might be corrupted
- Clear browser cookies for localhost
- Refresh page

## Implementation Phases

This is a 26-phase implementation. Completed phases:
1. ✅ Repository audit
2. ✅ Environment configuration
3. ✅ Supabase clients setup
4. ✅ Database migrations + RLS
5. ✅ Initial categories and participants seed
6. ✅ Battle fetching API
7. ✅ Voting API with duplicate prevention

In Progress / To Do:
- [ ] Frontend API integration
- [ ] Battle finalization and Elo updates
- [ ] League lifecycle management
- [ ] Participant entry and payments
- [ ] Dodo webhook handling
- [ ] Rate limiting
- [ ] Additional APIs (profiles, champion spotlight, etc.)

## Support

For issues or questions, please refer to:
- Supabase documentation: https://supabase.com/docs
- Next.js documentation: https://nextjs.org/docs
- Dodo Payments documentation: https://docs.dodopayments.com/
