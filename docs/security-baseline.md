# MeetFlow Security Baseline

**Date**: 2026-06-06
**Phase**: 7 (MVP Acceptance)
**Auditor**: Automated (pnpm audit + manual review)

## 1. Dependency Vulnerabilities

### Patched (this pass)
| Package | From | To | Severity | Advisory |
|---------|------|----|----------|----------|
| vitest | ^2.1.0 | ^2.1.9 | CRITICAL | GHSA-9crc-q9x8-hgqq |
| drizzle-orm | ^0.40.0 | ^0.45.2 | HIGH (SQL injection) | GHSA-gpj5-g38j-94v9 |
| nodemailer | ^6.9.0 | ^7.0.11 | HIGH (DoS) | GHSA-rcmh-qjqh-p98v |
| next-auth | 5.0.0-beta.28 | 5.0.0-beta.31 | (bump) | — |

### Remaining (assessed low risk for MVP)
| Count | Severity | Source | Risk Assessment |
|-------|----------|--------|-----------------|
| 1 | CRITICAL | vitest <4.1.0 (UI server) | Dev-only, `vitest run` doesn't expose UI |
| 2 | HIGH | vite (dev server) | Dev-only, not in production bundle |
| 14 | MODERATE | vite/esbuild (dev) | Dev-only |
| 3 | LOW | vite + nodemailer (transitive) | Acceptable for MVP |

**Conclusion**: No CRITICAL/HIGH vulnerabilities in production dependencies. Remaining issues are dev-environment only.

## 2. Secret Management

- [x] `.env` in `.gitignore` — verified via `git status`
- [x] `.env.local` in `.gitignore` — verified
- [x] No hardcoded API keys in source (scanned: 0 hits for `sk-`, `api_key`, `password=`)
- [x] Environment variables validated at startup (t3-env / manual checks)
- [x] `AUTH_SECRET` required for NextAuth.js

## 3. Input Validation

- [x] All user input validated through Zod schemas (`shared-types/src/validators/`)
- [x] Booking creation validates: email format, name non-empty, ISO8601 timestamps
- [x] Schedule link creation validates: slug format, duration constraints
- [x] tRPC provides type-safe API boundary with auto-validation

## 4. Database Security

- [x] Parameterized queries via Drizzle ORM (no raw SQL concatenation)
- [x] Double-booking prevention via PostgreSQL exclusion constraint (`EXCLUDE USING GIST`)
- [x] Database port bound to `127.0.0.1` in production compose (not publicly exposed)
- [x] Password stored in environment variable, not hardcoded

## 5. Authentication

- [x] NextAuth.js v5 with JWT session strategy
- [x] Protected routes (`/app/*`) require authentication via proxy.ts
- [x] Booking cancel token uses `crypto.randomUUID()` (not guessable)
- [x] OAuth state parameter used for CSRF prevention (handled by NextAuth.js)

## 6. XSS Prevention

- [x] React's default escaping used (no `dangerouslySetInnerHTML` found)
- [x] Email templates use explicit HTML escaping (`escapeHtml` function)
- [x] Booking page branding: CSS variables only, no user HTML injection

## 7. HTTP Headers (production plan)

- [x] Nginx configured with: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`
- [x] HSTS planned (Nginx SSL config ready, commented out until cert obtained)
- [x] Rate limiting configured: 10 req/min on booking endpoint

## 8. Supply Chain

- [x] pnpm lockfile committed (reproducible builds)
- [x] No dependencies from untrusted registries
- [ ] TODO: Configure Renovate/Dependabot for automated updates
