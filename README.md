This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Environment Variables

| Variable       | Description                                                                 |
|----------------|-----------------------------------------------------------------------------|
| `DATABASE_URL` | PostgreSQL URL (pooled). For Neon, use the connection string with `-pooler` in the host. |
| `DIRECT_URL`   | Direct PostgreSQL URL for Prisma migrate (no pooler). Required for Neon to avoid P1002. Same as `DATABASE_URL` but host without `-pooler`. |
| `CRON_SECRET`  | Secret for authenticating cron job requests. Required for `/api/cron/run-jobs`. Generate with `openssl rand -hex 32`. |

For Vercel Cron, set `CRON_SECRET` in project settings. Vercel will send it as `Authorization: Bearer <secret>` when invoking the cron route.

## Cron: Background Jobs

A cron route runs queued background jobs. Configure `vercel.json` crons (every 15 min by default). Set `CRON_SECRET` in Vercel env vars.

**Manual test (local):**
```bash
curl -H "x-cron-secret: <your-secret>" "http://localhost:3000/api/cron/run-jobs?limit=10"
```

**Query params:**
- `orgId` (optional) – process only this org
- `limit` (default 25, max 50) – global job cap
- `perOrg` (default 10, max 25) – cap per org in multi-org mode

## Infra decisions

- **DB:** PostgreSQL (Neon). Use pooled `DATABASE_URL` for the app; use direct `DIRECT_URL` (no `-pooler`) for `prisma migrate` to avoid advisory lock timeouts.
- **Auth:** Clerk (org + user). Cron is secret-gated only, not Clerk-gated.
- **Background jobs:** Prisma + `BackgroundJob` table; cron route `/api/cron/run-jobs` processes QUEUED jobs with overlap guard and per-org caps. See ROADMAP.md and docs in `docs/`.
- **AI:** OpenAI (summarize, generate-actions). Usage and token tracking in `UsageEvent`; cost visibility on Observability page.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
