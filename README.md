# Panoptes

> Chain Intelligence, Unblinking.

Chain intelligence platform for the Republic AI ecosystem.
Validator monitoring, endpoint health tracking, and smart routing engine.

## Features (Planned)

- Real-time validator monitoring (1200+ validators)
- Endpoint health scoring and smart routing
- Pre-flight transaction validation
- Network analytics dashboard
- Historical data and trend analysis

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
