# NyumbaFlow — East Africa Property & Tenancy Hub

A production-ready rental property management platform for Kenya/East Africa, built from a Google
Stitch UI export. Landlords manage properties, units, leases and maintenance; tenants sign leases,
pay rent, and report issues. **Every screen is wired to a real backend — no mock data, no
placeholder buttons.**

Payments run exclusively through **[IntaSend](https://intasend.com)** — M-Pesa STK Push, Airtel
Money and card payments. **Stripe, PayPal and every other processor are intentionally excluded.**

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **Tailwind CSS v4**, theme tokens generated directly from the original Stitch design system
  (`src/app/globals.css`)
- **PostgreSQL** via the [`postgres`](https://github.com/porsager/postgres) driver — works with any
  managed Postgres (Neon, Vercel Postgres, Supabase, Railway, RDS, or self-hosted). Tables are
  created automatically on first request; there's no separate migration step. See
  [Deploying](#deploying-vercel-and-other-serverless-hosts) for why this app requires Postgres
  rather than a file-based database.
- **JWT** session cookies, bcrypt password hashing, phone+OTP login
- **IntaSend** for all payment collection (M-Pesa STK Push, card, Airtel Money) — see
  [`src/lib/intasend.ts`](src/lib/intasend.ts)

## Getting started

```bash
npm install
cp .env.example .env   # set DATABASE_URL (see below) — everything else has a working default
npm run dev
```

You need a Postgres database to point `DATABASE_URL` at. The fastest way to get one for free:
[Neon](https://neon.tech) — sign up, create a project, copy the connection string it gives you into
`DATABASE_URL` in `.env`. A local Postgres works too (`DATABASE_URL=postgresql://user:pass@localhost:5432/nyumbaflow`,
plus `PGSSLMODE=disable` if it's not using TLS).

Open http://localhost:3000. On first run the app seeds demo data automatically (see
[`src/lib/seed.ts`](src/lib/seed.ts)) so there's something to explore immediately:

| Role     | Phone / Email     | Password      |
| -------- | ------------------ | ------------- |
| Landlord | `254712000001`      | `password123` |
| Tenant   | `254712345678`      | `password123` |

The demo portfolio mirrors the original Stitch mockups: Kilimani Palms Estate, Westlands Heights,
and Ruaka Haven Studios, with one paid lease, one lease in arrears, an open maintenance ticket, and
a notice board post.

## What's implemented

- **Auth** — phone + OTP login (OTP is logged to the server console in dev — see
  [SMS provider](#sms--otp-provider) below), email/password fallback, registration, role-based
  access (Landlord / Tenant / Caretaker), **forgot-password / OTP-based password reset**
  (`/reset-password`)
- **Security hardening** — rate limiting on login/OTP-request/OTP-verify (in-memory sliding
  window, see [`src/lib/rate-limit.ts`](src/lib/rate-limit.ts)), CSRF protection via
  Origin/Referer checking on all mutating `/api/**` requests (see [`src/proxy.ts`](src/proxy.ts),
  Next 16's replacement for `middleware.ts`), httpOnly/sameSite session cookies, IntaSend webhook
  signature verification (fail-closed if no challenge is configured)
- **Landlord dashboard** — live cashflow summary, occupancy, arrears with 1-tap M-Pesa STK push,
  recent settlements, CSV statement export
- **Properties & units** — create properties/units, assign tenants, occupancy tracking
- **Lease lifecycle** — draft → tenant reviews & e-signs → move-in payment (M-Pesa / card / Airtel
  via IntaSend) → lease activation → move-in inspection with room-by-room condition capture and
  joint tenant/caretaker digital sign-off → keys released
- **Rent collection** — per-tenant and batch M-Pesa STK Push, card/Airtel checkout, manual
  bank-transfer confirmation (see [Payment channels](#payment-channels) below), full payment ledger
- **Automated billing** — scheduled jobs generate each lease's monthly invoice and send bilingual
  SMS rent reminders (3 days before due, on the due date, and daily once overdue), marking invoices
  `OVERDUE` automatically — see [Scheduled jobs](#scheduled-jobs) below
- **Maintenance** — ticket lifecycle (Reported → Assigned → Quoted → Repaired → Paid), contractor
  assignment, quote approval
- **Tenant portal** — balance, pay rent, report issues, payment history, notice board
- **Bilingual UI** — English/Kiswahili toggle (top bar), persisted per-browser, backed by
  [`src/lib/i18n.tsx`](src/lib/i18n.tsx)
- **Kenya Data Protection Act basics** — self-service data export (JSON download) and account
  deletion (anonymization, not hard-delete, to preserve financial/audit records required by law) at
  `/account`
- **Automated tests** — 15 vitest tests covering the lease/invoice/payment lifecycle (including
  double-payment and partial-payment edge cases), IntaSend phone normalization and webhook
  fail-closed behavior, and rate limiting (`npm test`)

## Payment channels

| Channel shown in UI | How it's handled |
| --- | --- |
| M-Pesa (STK Push) | Real-time via IntaSend's Collections API — [`triggerMpesaStkPush`](src/lib/intasend.ts) |
| Card | Real-time via IntaSend's hosted Checkout — [`createHostedCheckout`](src/lib/intasend.ts) |
| Airtel Money | Real-time via IntaSend's hosted Checkout (mobile-money method) |
| Bank Transfer / PesaLink / RTGS | **Manual reconciliation.** IntaSend doesn't offer real-time push collection over bank rails the way it does M-Pesa/cards, so a landlord confirms these once funds land in their account ([`/api/payments/bank-manual`](src/app/api/payments/bank-manual/route.ts)). This is never faked as automatic. |

A payment is only ever marked `COMPLETE` by the **IntaSend webhook**
([`/api/webhooks/intasend`](src/app/api/webhooks/intasend/route.ts)) or by an explicit landlord
bank confirmation — never by the client-side redirect or poll alone, since that state can be
interrupted or spoofed.

### Setting up IntaSend

1. Create an account at [intasend.com](https://intasend.com) and grab your **sandbox** API keys
   from Settings → API Keys.
2. Put them in `.env`:
   ```
   INTASEND_PUBLISHABLE_KEY=ISPubKey_test_...
   INTASEND_SECRET_KEY=ISSecretKey_test_...
   INTASEND_ENV=sandbox
   ```
3. Under Settings → Webhooks, point IntaSend at
   `https://yourdomain.com/api/webhooks/intasend` and set a challenge string. Put the same string
   in `.env` as `INTASEND_WEBHOOK_CHALLENGE`. Webhooks are rejected until this is set (fail-closed).
4. Switch `INTASEND_ENV=live` and use your live keys when you're ready to accept real payments.

Without IntaSend keys configured, the app still runs — STK push and checkout attempts return a
clear "IntaSend is not configured" error instead of silently pretending to succeed.

## SMS / OTP provider

OTP codes and rent reminders go through [`src/lib/sms.ts`](src/lib/sms.ts), which logs messages to
the server console by default so the whole login and reminder flow is testable without a real SMS
account. Real, working implementations are already wired up for the two most common East Africa
providers — you only need to add credentials, no code changes required:

```
SMS_PROVIDER=africastalking
AFRICASTALKING_API_KEY=...
AFRICASTALKING_USERNAME=...        # use "sandbox" for AT's sandbox environment
AFRICASTALKING_SENDER_ID=...       # optional shortcode/alphanumeric ID
```

or

```
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+1...
```

Leaving `SMS_PROVIDER` unset keeps the console dev provider.

## Scheduled jobs

Two jobs keep billing current, in [`src/lib/jobs.ts`](src/lib/jobs.ts):

- **generate-invoices** — creates each active lease's invoice for the current period if it doesn't
  exist yet
- **send-reminders** — marks unpaid invoices `OVERDUE` past their due date, and SMSes tenants 3
  days before the due date, on the due date, and daily once overdue

Both are triggered by an **external scheduler** hitting an HTTP endpoint — there is no in-process
timer, because a serverless function instance is too short-lived (and too easily duplicated across
regions/instances) for an in-process `setInterval`/cron library to reliably fire on schedule. Set
`CRON_SECRET=<a-long-random-string>` in your environment, then either:

- **On Vercel** — the included `vercel.json` already configures Vercel Cron to hit both endpoints
  (06:00 and 08:00 UTC daily). Vercel automatically sends `Authorization: Bearer $CRON_SECRET` when
  a `CRON_SECRET` env var is set on the project — no extra setup beyond setting that env var.
- **Anywhere else** (GitHub Actions, cron-job.org, a plain crontab) — call:
  ```
  POST /api/cron/generate-invoices   Authorization: Bearer <CRON_SECRET>
  POST /api/cron/send-reminders      Authorization: Bearer <CRON_SECRET>
  ```

Both endpoints also accept GET (for schedulers like Vercel Cron that only send GET) and reject any
request with a missing or incorrect bearer token.

## Deploying (Vercel and other serverless hosts)

This app is built to deploy straight to Vercel (or any serverless Node host):

1. Push the repo to GitHub/GitLab/Bitbucket and import it in Vercel.
2. Add a Postgres database — Vercel's Marketplace has a one-click Neon integration that sets
   `DATABASE_URL` for you automatically, or create one yourself at [neon.tech](https://neon.tech)
   and add `DATABASE_URL` under Project Settings → Environment Variables.
3. Add the other required env vars from `.env.example` (`JWT_SECRET`, `CRON_SECRET`, and your
   IntaSend/SMS credentials when you have them).
4. Deploy. Database tables are created automatically on the first request that touches them — no
   separate migration command to run.
5. Point an external scheduler at the two cron endpoints (see [Scheduled jobs](#scheduled-jobs)
   below) — a `vercel.json` with a Vercel Cron config for both is included in this repo.

**Why Postgres, and not the SQLite this project might have shipped with earlier:** serverless
functions (Vercel's included) have a read-only deployment bundle and no persistent local disk —
only a `/tmp` that isn't shared across invocations or server instances and disappears on the next
cold start. A file-based database like SQLite has nowhere durable to write on that kind of host, so
attempting it either crashes every request (write to a read-only path) or silently loses data
(write to `/tmp`). This is why the app requires `DATABASE_URL` and refuses to start without it,
rather than falling back to a local file. If you're deploying to a normal VPS or Docker host with a
persistent disk instead, Postgres still works fine there — just point `DATABASE_URL` at a Postgres
instance on that same box or network.

All data access goes through [`src/lib/repo.ts`](src/lib/repo.ts) and the schema lives in
[`src/lib/schema.sql`](src/lib/schema.sql) — if you ever need a different database engine, those two
files plus the connection in [`src/lib/db.ts`](src/lib/db.ts) are the only places that would need to
change; no API route or page does.

## File uploads

Maintenance/inspection photos go through [`src/lib/storage.ts`](src/lib/storage.ts) via
[`/api/uploads`](src/app/api/uploads/route.ts), which already supports two drivers — switch with an
env var, no code changes:

```
STORAGE_DRIVER=local        # default — writes to public/uploads, fine for a single-server VPS
```
```
STORAGE_DRIVER=s3
S3_BUCKET=...
S3_REGION=...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_PUBLIC_URL_BASE=...       # e.g. a CloudFront domain, if fronting the bucket with a CDN
```

`local` storage is not durable across serverless deployments or multiple instances — use `s3` for
those.

## Project structure

```
src/
  app/
    login/, register/           auth screens
    landlord/                   dashboard, properties, payments, maintenance (role-gated layout)
    tenant/                     tenant portal + lease review/sign flow (role-gated layout)
    inspections/[leaseId]/      move-in inspection & key handover (shared tenant/landlord view)
    api/                        all backend routes (auth, properties, leases, payments, webhooks, ...)
  components/                   shared UI primitives, STK push modal, nav/top bar
  lib/
    db.ts, schema.sql, repo.ts  data layer
    auth.ts                     sessions, password hashing, OTP
    intasend.ts                 IntaSend integration (the only payment processor)
    sms.ts                      SMS/WhatsApp provider interface
    seed.ts                     demo data seeded on first run
```

## Testing

```bash
npm test          # 15 vitest tests: lease/invoice/payment lifecycle, IntaSend helpers, rate limiting
npm run build      # production build (36 routes)
npx eslint .       # lint (0 errors)
```

## Production checklist

Already done — code, tested, and shipped in this repo:

- [x] Rate limiting on login, OTP request and OTP verify
- [x] CSRF protection (Origin/Referer check) on all mutating API routes
- [x] Forgot-password / OTP-based password reset flow
- [x] IntaSend webhook signature verification, fail-closed by default
- [x] Real SMS provider implementations (Africa's Talking, Twilio) — just add credentials
- [x] Scheduled billing jobs (invoice generation + rent reminders), both in-process and
      external-scheduler modes
- [x] S3-compatible file storage option (alongside local disk)
- [x] Bilingual English/Kiswahili UI
- [x] Data export & account deletion (Kenya Data Protection Act basics)
- [x] Automated test suite (`npm test`, run against a real Postgres database)
- [x] **PostgreSQL data layer** (migrated from an earlier SQLite version that could not run on
      Vercel — see [Deploying](#deploying-vercel-and-other-serverless-hosts) for why), with the
      schema applied automatically on first request
- [x] Vercel Cron configuration (`vercel.json`) so the billing jobs run out of the box on Vercel,
      with the CSRF proxy and cron auth verified not to conflict with each other or with webhooks

Left for you, because they require your own accounts/decisions — no amount of code can close these
without secrets or infrastructure only you control:

- [ ] **Provision a Postgres database and set `DATABASE_URL`** — the app will not start without one
      (see [Getting started](#getting-started) and [Deploying](#deploying-vercel-and-other-serverless-hosts))
- [ ] **Set a strong, unique `JWT_SECRET`** in production (a placeholder will not protect sessions)
- [ ] **Create your own IntaSend account** and configure live keys + webhook challenge — nobody but
      you can generate these credentials, and a real end-to-end payment cannot be verified without
      them (the code path is fully implemented and unit-tested against IntaSend's documented
      request/response/webhook shapes, but has not been exercised against IntaSend's live/sandbox
      servers with real credentials)
- [ ] **Choose and fund an SMS provider account** (Africa's Talking or Twilio) — the integration
      code is complete, but sending a real SMS needs your account
- [ ] Put the app behind HTTPS (required for secure cookies and IntaSend webhooks) — automatic on
      Vercel
