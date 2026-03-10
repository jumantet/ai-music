# AI Release Toolkit for Artists

A full-stack micro-SaaS that helps independent artists prepare and promote their music releases. Generate AI-powered EPKs, press kits, and outreach emails — all from one tool.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Expo React Native Web + TypeScript |
| API | Apollo Server v5 + Express 5 + TypeScript |
| Database | PostgreSQL + Prisma ORM |
| AI | OpenAI GPT-4o |
| Storage | Cloudflare R2 (S3-compatible) |
| Email | Resend |
| Payments | Stripe |
| Monorepo | Turborepo |

## Project Structure

```
micro-saas-musique/
├── apps/
│   ├── web/          # Expo React Native Web app
│   └── api/          # Apollo GraphQL server
├── packages/
│   └── shared/       # Shared TypeScript types
├── turbo.json
└── package.json
```

## Features

- **EPK Generation** — AI-generated artist bio, press pitch, short bio, and release description
- **Public EPK Page** — Shareable page at `/epk/[slug]` with cover art, bio, player, and press notes
- **Press Kit Download** — Auto-generated `press-kit.zip` with all press materials
- **Outreach Emails** — AI-written emails tailored for blogs, radio stations, playlist curators, and journalists
- **Mini CRM** — Track outreach status: Not Contacted → Sent → Replied → Featured
- **Stripe Billing** — Free plan (1 release) and Pro plan (unlimited)

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

```bash
# API
cp apps/api/.env.example apps/api/.env

# Web
cp apps/web/.env.example apps/web/.env
```

Fill in all values in `apps/api/.env`:
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — Random secret for JWT signing
- `OPENAI_API_KEY` — From [platform.openai.com](https://platform.openai.com)
- `R2_*` — From [Cloudflare R2](https://developers.cloudflare.com/r2/)
- `RESEND_API_KEY` — From [resend.com](https://resend.com)
- `STRIPE_*` — From [Stripe Dashboard](https://dashboard.stripe.com)

### 3. Set up the database

```bash
cd apps/api
npx prisma migrate dev --name init
```

### 4. Run in development

```bash
# From project root — starts both API and web concurrently
npm run dev
```

- API: http://localhost:4000/graphql
- Web: http://localhost:8081

## Development Commands

```bash
# Run all apps
npm run dev

# Type check all apps
npm run type-check

# API only
cd apps/api && npm run dev

# Web only
cd apps/web && npm run dev

# Prisma Studio (DB browser)
cd apps/api && npm run db:studio
```

## Stripe Setup

1. Create a product in your Stripe Dashboard (Pro Plan, €12/month)
2. Copy the Price ID into `STRIPE_PRO_PRICE_ID`
3. Set up a webhook pointing to `https://your-api.com/webhooks/stripe`
4. Subscribe to: `checkout.session.completed`, `customer.subscription.deleted`

## Cloudflare R2 Setup

1. Create a bucket in Cloudflare R2
2. Enable public access or use a custom domain
3. Create R2 API credentials and fill in `R2_*` env vars

## Business Model

| Plan | Price | Releases | EPK Pages | Outreach |
|------|-------|----------|-----------|----------|
| Free | €0 | 1 | 1 | ✓ |
| Pro | €12–19/month | Unlimited | Unlimited | ✓ |
