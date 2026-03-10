# Panoptes

> Chain Intelligence, Unblinking.

Chain intelligence platform for the Republic AI ecosystem.
Validator monitoring, endpoint health tracking, smart routing engine, and anomaly detection.

## Features

- **Validator Monitoring** — Real-time tracking with historical snapshots and stake change detection
- **Endpoint Health** — Continuous health checks with latency, uptime, and block freshness tracking
- **Intelligence Layer** — Composite scoring with EMA smoothing for validators and endpoints
- **Smart Routing** — Score-weighted endpoint selection with quadratic bias
- **Anomaly Detection** — 6 detectors (jailing, stake change, commission spike, endpoint down, block stale, mass unbonding)
- **Preflight Validation** — 6-step pre-transaction validation with timeout protection
- **REST API** — Rate limiting, caching, security headers, and CORS
- **Dashboard** — Interactive UI with charts, filtering, score badges, and anomaly alerts

## Architecture

```
┌─────────────────────────────────────────────┐
│                  Next.js App                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Landing  │  │Dashboard │  │ REST API │  │
│  │  Page    │  │  Pages   │  │ Routes   │  │
│  └──────────┘  └──────────┘  └──────────┘  │
│                      │              │       │
│  ┌───────────────────┴──────────────┘       │
│  │         Intelligence Layer               │
│  │  ┌────────┐ ┌────────┐ ┌──────────┐     │
│  │  │Scoring │ │Routing │ │ Anomaly  │     │
│  │  │  EMA   │ │Quadra. │ │6 Detect. │     │
│  │  └────────┘ └────────┘ └──────────┘     │
│  └──────────────────────────────────────┘   │
│                      │                      │
│  ┌───────────────────┴──────────────────┐   │
│  │          Indexer Layer               │   │
│  │  Validators · Endpoints · Stats      │   │
│  └──────────────────────────────────────┘   │
│                      │                      │
│  ┌───────────────────┴──────────────────┐   │
│  │   PostgreSQL (Neon) + republic-sdk   │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | System health check (DB, Chain, Last cron) |
| `GET` | `/api/validators` | List validators (filterable, sortable, paginated) |
| `GET` | `/api/validators/[id]` | Validator detail + historical snapshots |
| `GET` | `/api/endpoints` | List all endpoints (RPC, REST, EVM-RPC) |
| `GET` | `/api/endpoints/best` | Smart route selection (score-weighted) |
| `GET` | `/api/stats` | Aggregated network statistics |
| `GET` | `/api/anomalies` | Anomaly detection results |
| `POST` | `/api/preflight` | 6-step pre-transaction validation |
| `POST` | `/api/cron/health` | Scheduled endpoint health check |
| `POST` | `/api/cron/stats` | Network stats aggregation |
| `POST` | `/api/cron/cleanup` | Old data cleanup |

All endpoints include rate limiting (60 req/min), security headers, and CORS.

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Database:** PostgreSQL (Neon Serverless) + Prisma 7
- **Chain SDK:** republic-sdk
- **UI:** Tailwind CSS v4 + shadcn/ui + Recharts
- **Animation:** Motion (Framer Motion)
- **Testing:** Vitest 4 (228 tests, 87%+ coverage)

## Development

### Prerequisites

- Node.js 22+
- npm

### Setup

```bash
git clone https://github.com/eren-karakus0/panoptes.git
cd panoptes
npm install
cp .env.example .env.local
# Fill in your database credentials and secrets
npx prisma generate
npx prisma migrate deploy
npm run dev
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run lint` | ESLint check |
| `npm test` | Run unit tests |
| `npm run test:watch` | Watch mode tests |
| `npm run test:coverage` | Tests with coverage report |
| `npm run test:integration` | Integration tests (requires chain) |

### Environment Variables

See [`.env.example`](.env.example) for all required variables.

## Deployment

Deployed on Vercel with:
- Neon PostgreSQL (pooled + direct connections)
- GitHub Actions cron jobs for data indexing
- Automatic preview deploys on PR

## License

MIT
