# LUMEN&CO — production image for Render (and any Docker host)
#
# Build-time rule: the build must NEVER need the real database. Render does not
# expose service env vars to `docker build`, and the app is fully dynamic anyway
# (every page reads live data or a session cookie), so nothing is prerendered.
# DATABASE_URL below is a syntactically-valid placeholder that satisfies Prisma's
# schema parser; the real one is injected by Render at container start.

# ─────────────────────────────────────────────────────────────────────────────
# Base — shared OS layer
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS base

# openssl + libc6-compat are what the Prisma query engine links against on musl.
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# ─────────────────────────────────────────────────────────────────────────────
# Dependencies — full install (devDependencies included; the build needs them)
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS deps

COPY package.json package-lock.json* ./

# --ignore-scripts skips Prisma's postinstall; `npm run build` runs
# `prisma generate` explicitly, so the client is still generated.
RUN npm ci --ignore-scripts

# ─────────────────────────────────────────────────────────────────────────────
# Builder — generate Prisma client and compile Next.js
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS builder

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV DATABASE_URL="postgresql://placeholder:placeholder@127.0.0.1:5432/placeholder?schema=public"

# Next inlines NEXT_PUBLIC_* at build time, so these must exist during the build.
# Render injects matching service env vars as build args for every declared ARG.
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_APP_NAME
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# `build` = prisma generate && next build
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Runner — minimal production runtime
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS runner

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Static assets and the standalone server bundle (needs output: 'standalone').
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Next's file tracing does not reliably pick up the Prisma query engine binary,
# so copy the generated client and the schema in explicitly.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma

RUN mkdir -p /app/uploads && chown -R nextjs:nodejs /app/uploads

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
