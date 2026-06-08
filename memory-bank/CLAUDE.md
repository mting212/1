# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Identity

**MeetFlow** — 会议协调与日程安排平台。A scheduling platform inspired by SavvyCal that balances organizer time-protection with invitee booking convenience. AI-powered time coordination is the core differentiator vs competitors.

**Phase**: Pre-implementation design. Two design documents define the full system. **Read them before writing code**: `design-document.md` and `tech-stack.md`.

---

## Rules Extracted from Design Documents

These rules are derived from `design-document.md` and `tech-stack.md`. Every code change must satisfy them.

### A. Product Rules

**A1 — Dual Respect**: Every feature must serve BOTH the organizer (time protection, control) and the invitee (convenience, clarity). Never optimize for one at the expense of the other.

**A2 — One-Step Booking**: Invitees book in a single view. The traditional "click a day, then click a time" two-step flow is explicitly rejected. Use a week-view grid.

**A3 — Progressive Disclosure**: Default UI is minimal. Advanced controls (buffers, limits, workflows) appear on demand. Never expose power features to first-time users.

**A4 — Timezone-First**: Every time display must show the viewer's local time, with timezone label visible. Never show times without indicating the timezone.

**A5 — White-Label Ready**: Booking pages must work on custom domains (`meet.example.com`) and support per-organizer branding (logo, colors, banner). Never hardcode "MeetFlow" branding into the public booking page.

### B. Data Integrity Rules

**B1 — UTC Storage, Local Display**: All timestamps stored as UTC (`TIMESTAMPTZ`). Convert to local time only at the presentation layer. Use IANA timezone identifiers (e.g. `Asia/Shanghai`), never offsets.

**B2 — Double-Booking Prevention is Mandatory**: Use PostgreSQL exclusion constraints (`EXCLUDE USING GIST`) at the database level as the final guard. The application-layer "two-phase lock" is a performance optimization, not a substitute.

```sql
-- This constraint must exist in every iteration of the bookings table
ALTER TABLE bookings ADD CONSTRAINT no_double_booking
EXCLUDE USING GIST (
    schedule_link_id WITH =,
    tsrange(start_time, end_time) WITH &&
) WHERE (status != 'cancelled');
```

**B3 — Two-Phase Booking**: Phase 1: read from cache (may be stale) for display. Phase 2: acquire DB row lock + re-verify no conflict before commit. On conflict, show a friendly message — never silently fail.

**B4 — Recurring Events Use RRULE**: Store recurring availability and events in iCalendar RRULE format. Use `rrule-go` (Go) / `rrule` (Node) libraries for parsing and expansion. Never implement custom recurrence logic.

### C. Architecture Rules

**C1 — Three-Language Split is Intentional**: Go for the scheduling engine (CPU-bound, high-concurrency availability computation). Node.js/TypeScript for BFF + workflow (IO-bound, shared types with frontend). Python for AI services (ML ecosystem). Do not collapse these into a single language.

**C2 — gRPC Between Services, tRPC to Frontend**: Service-to-service: protobuf + gRPC. BFF-to-frontend: tRPC for end-to-end type safety. Never use REST between internal services.

**C3 — Calendar Grid Component is Self-Built**: No existing library handles "week-view + calendar overlay + timezone-aware + ranked availability". Build `CalendarGrid` from scratch. Use `date-fns` + `date-fns-tz` for date logic, never Moment.js or luxon.

**C4 — PostgreSQL, Not MySQL**: The schema relies on `tsrange`, `EXCLUDE USING GIST`, `TIMESTAMPTZ`, `JSONB`, and PostgreSQL arrays. MySQL cannot express these. Never propose MySQL as an alternative.

**C5 — Drizzle ORM, Not Prisma**: The scheduling queries need window functions, range operators, and raw SQL expressiveness. Prisma's abstraction is too limiting. Use Drizzle (Node) + sqlc (Go).

### D. Frontend Rules

**D1 — TypeScript Strict Mode**: `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`. No exceptions.

**D2 — State Management**: Zustand for client state. React Hook Form + Zod for forms. Never introduce Redux.

**D3 — Responsive Breakpoints**:
- Desktop (≥1024px): Full week view, sidebar nav
- Tablet (768-1023px): 3-day scrollable view
- Mobile (<768px): Single day stack, swipe to change day, large touch targets (≥44px)

**D4 — RSC/Client Component Split**: Public booking pages → Server Components with ISR (SEO-critical). Interactive elements (time slot picker, form) → Client Components. Use Server Actions for form submission.

**D5 — Branding via CSS Variables**: Organizer brand config (colors, logo) injects as CSS custom properties. Never generate per-organizer CSS files at build time.

### E. Backend Rules

**E1 — Go Scheduling Engine Interface**:
```
Input:  organizer constraints (availability rules, buffers, limits, calendar events)
        + invitee calendar events (optional overlay)
        + window (default: 14 days forward, 2 hours minimum notice)
Output: ranked list of available time slots, each annotated as "preferred" or "available"
```

**E2 — Calendar Sync Protocol**:
- Google Calendar: Push webhook (real-time)
- Outlook: Push webhook (real-time)
- iCloud/CalDAV: Poll every 5 minutes
- All changes → event queue → async processing

**E3 — OAuth Providers**: Google and Outlook for MVP. iCloud is Phase 2. NextAuth.js v5 (Auth.js) for session management. Never store calendar provider passwords — OAuth only.

**E4 — Video Meeting Auto-Generation**: On booking confirmation, auto-create meeting URL via Zoom API (default) or Google Meet API. Store URL on the booking record. Handle API failures gracefully — the booking succeeds even if meeting URL generation fails.

### F. AI Service Rules

**F1 — AI is Phase 4**: Do not build AI features in MVP (Phases 1-3). Design the architecture to accommodate them later (Python service behind gRPC, data collection hooks), but do not implement.

**F2 — AI Service Boundary**: Python 3.12 + FastAPI. Communicates with the rest of the system only via gRPC. Never call the AI service directly from the frontend.

**F3 — LLM Provider**: DeepSeek API (OpenAI-compatible, `base_url="https://api.deepseek.com/v1"`). The Anthropic SDK is not used in this project.

### G. Testing Rules

**G1 — Double-Booking Test is Mandatory**: Before any release, a test must prove that two concurrent bookings for the same slot cannot both succeed. This is the highest-stakes test in the entire system.

**G2 — Timezone Tests Required**: Every time-related function must have tests with at least 3 timezones (UTC, Asia/Shanghai, America/New_York) including a DST boundary date.

### H. Scope & Priority Rules

**H1 — MVP Acceptance Criteria**: One user can connect a calendar → create a scheduling link → receive a booking. Anything beyond this is Phase 2+.

**H2 — Priority Enforcement**:
- P0: Must ship in the current phase. Phase cannot close without it.
- P1: Should ship in the current phase. Can slip to next phase with documented rationale.
- P2: Nice to have. Never build P2 items before all P0 and P1 items in the current phase are done.

**H3 — Phase 1 MVP Scope (Do Not Expand)**:
1. User registration + Google/Outlook OAuth
2. Single scheduling link with week-view time picker
3. Fixed weekly availability rules
4. Booking creation → email confirmation + calendar event
5. Automatic timezone detection for invitees
6. Basic brand customization (logo + colors)

### I. Monorepo & Tooling Rules

**I1 — Directory Structure**: Follow the monorepo layout defined in `tech-stack.md` §7.3. Do not invent alternative structures.

**I2 — Package Manager**: pnpm for Node.js, Go modules for Go, uv for Python. Never npm or yarn.

**I3 — Linting**: Biome (not ESLint + Prettier). Git hooks via lefthook (not husky).

**I4 — E2E**: Playwright. Tests must cover the full booking flow: open link → select slot → fill form → confirm → verify email sent → verify calendar event created.

### J. Design Constraint Rules

**J1 — Week View, Not Month View**: Month view fails on mobile and provides information overload. The week view is the only supported default.

**J2 — Never Expose All Free Slots**: Organizers define which slots to expose. Free calendar time ≠ available for booking. Buffers, limits, and preferred-slot ranking apply before any slot is shown.

**J3 — Invitee Calendar Overlay is Opt-In**: Invitees choose to connect their calendar. Never require it. The overlay is a convenience, not a gate.

---

## Implementation Order

When coding begins, follow this sequence (dependencies are linear):

```
1. Monorepo scaffold (turbo.json, pnpm-workspace.yaml, compose.yml)
2. Database migrations (PostgreSQL schema from design-document.md §6.2)
3. Go scheduling engine (availability calculation → conflict detection → ranking)
4. Next.js scaffold + NextAuth.js + tRPC setup
5. Calendar OAuth (Google + Outlook)
6. Scheduling link UI (CalendarGrid component)
7. Booking flow end-to-end (select → form → confirm → email → calendar event)
```
