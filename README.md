# Panoptes

> Chain Intelligence, Unblinking.

Chain intelligence platform for the Republic AI ecosystem.
Validator monitoring, endpoint health tracking, and smart routing engine.

## Features

- Real-time validator monitoring and historical snapshots
- Endpoint health tracking with uptime/latency stats
- Network statistics with bonded ratio and block time trends
- Smart endpoint routing (best endpoint by latency)
- REST API with rate limiting, caching, and security headers
- Interactive dashboard with charts and filtering

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Database:** PostgreSQL (Neon Serverless) + Prisma 7
- **Chain SDK:** republic-sdk
- **UI:** Tailwind CSS v4 + shadcn/ui
- **Testing:** Vitest 4

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
# Fill in your Neon database credentials
npx prisma generate
npm run dev
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run lint` | ESLint check |
| `npm test` | Run tests |
| `npm run test:watch` | Watch mode tests |
| `npm run test:coverage` | Tests with coverage |

## License

MIT
