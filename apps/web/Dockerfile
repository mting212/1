# ── Stage 1: Install dependencies ──────────────────────────
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable pnpm && corepack prepare pnpm@11 --activate

WORKDIR /app

# Copy root workspace config
COPY pnpm-workspace.yaml ./
COPY pnpm-lock.yaml ./
COPY package.json ./
COPY .npmrc ./

# Copy all workspace packages (needed for dependency resolution)
COPY apps/web/package.json apps/web/
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/calendar-engine/package.json packages/calendar-engine/
COPY packages/notification/package.json packages/notification/
COPY packages/video-meeting/package.json packages/video-meeting/

# Configure pnpm: registry mirror for faster downloads in China
RUN echo "registry=https://registry.npmmirror.com" >> .npmrc

# Install dependencies (skip build scripts, rebuild required ones)
RUN pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm rebuild esbuild sharp

# ── Stage 2: Build ─────────────────────────────────────────
FROM base AS builder

# Copy source code for all packages
COPY packages/shared-types/ packages/shared-types/
COPY packages/calendar-engine/ packages/calendar-engine/
COPY packages/notification/ packages/notification/
COPY packages/video-meeting/ packages/video-meeting/
COPY apps/web/ apps/web/

# Build workspace dependencies first, then the web app
RUN pnpm --filter @meetflow/shared-types build
RUN pnpm --filter @meetflow/calendar-engine build
RUN pnpm --filter @meetflow/notification build
RUN pnpm --filter @meetflow/video-meeting build
RUN pnpm --filter web build

# ── Stage 3: Production runtime ────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output (includes minimal node_modules for runtime)
COPY --from=builder /app/apps/web/.next/standalone ./

# Copy static files and public assets
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

# Copy workspace node_modules for native modules not bundled by standalone
COPY --from=builder /app/node_modules/.pnpm ./node_modules/.pnpm

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]
