# MeetFlow MVP Launch Checklist

## Pre-Launch Verification

### 1. Infrastructure
- [ ] PostgreSQL 16 running (local or managed)
- [ ] Redis 7 running (local or managed)
- [ ] Go scheduler engine deployed and healthy
- [ ] Next.js web app deployed
- [ ] Nginx reverse proxy configured
- [ ] SSL certificate obtained and auto-renewal configured
- [ ] DNS records configured (meetflow.dev, staging)

### 2. Environment Variables (all set in production)
- [ ] `DATABASE_URL`
- [ ] `REDIS_URL`
- [ ] `AUTH_SECRET` (generated via `npx auth secret`)
- [ ] `AUTH_URL` (production URL)
- [ ] `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- [ ] `AZURE_AD_CLIENT_ID` / `AZURE_AD_CLIENT_SECRET`
- [ ] `ZOOM_CLIENT_ID` / `ZOOM_CLIENT_SECRET`
- [ ] `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS`
- [ ] `GRPC_SCHEDULER_ADDR`

### 3. Security
- [ ] `.env` and `.env.local` NOT in git (`git status` clean)
- [ ] `pnpm audit` — no CRITICAL vulnerabilities
- [ ] OAuth redirect URIs match production URL
- [ ] HTTPS enforced (HSTS header present)
- [ ] Database port NOT exposed to public internet (127.0.0.1 binding)
- [ ] Rate limiting enabled on booking endpoint

### 4. Database
- [ ] All 5 tables created (users, calendar_accounts, schedule_links, availability_rules, bookings)
- [ ] Exclusion constraint `no_double_booking` present on bookings table
- [ ] Seed data works (`pnpm seed`)
- [ ] Daily backups configured (cron + backup.sh)

### 5. Functional Smoke Tests
- [ ] Visit landing page — loads without error
- [ ] Visit public booking page (`/[slug]`) — shows calendar grid
- [ ] Timezone auto-detection works
- [ ] Select a time slot → form panel opens
- [ ] Submit booking → success confirmation shown
- [ ] Confirmation email sent (check Ethereal/Mailpit in dev, SMTP in prod)
- [ ] Booking visible in organizer dashboard
- [ ] Cancel booking → slot released
- [ ] Login → dashboard loads
- [ ] Create schedule link → public page accessible
- [ ] Edit schedule link settings
- [ ] Branding changes (color) reflected on booking page

### 6. Performance (Lighthouse)
- [ ] LCP < 2.5s
- [ ] INP < 200ms
- [ ] CLS < 0.1
- [ ] No layout shifts during calendar grid load
- [ ] JS bundle < 300KB (gzipped)

### 7. Monitoring
- [ ] Health check endpoint responding (200)
- [ ] Error logging configured (Sentry or equivalent)
- [ ] Uptime monitoring configured (UptimeRobot or equivalent)
- [ ] Database connection pool alerts (if applicable)

## Launch Steps

1. Merge all code to `main` branch
2. Run CI pipeline — ALL checks green
3. Deploy to staging environment
4. Run full smoke test suite on staging
5. Configure production OAuth apps with real domain
6. Deploy to production
7. Run smoke tests on production
8. Invite first 3 test users
9. Monitor for 48 hours

## Rollback Plan

1. Keep previous container image tagged
2. SSH into server
3. `docker compose -f compose.prod.yml down`
4. Switch image tag
5. `docker compose -f compose.prod.yml up -d`
6. Verify health check

## Post-Launch (Week 1)

- [ ] Monitor Sentry for errors
- [ ] Check database backup integrity
- [ ] Review rate limiting effectiveness
- [ ] Collect user feedback from first 3 users
- [ ] Plan Phase 2 priorities based on feedback
