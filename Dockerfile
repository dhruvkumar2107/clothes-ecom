# LUMEN&CO — Docker Configuration
# Multi-stage build for optimal production image size

# ─────────────────────────────────────────────────────────────────────────────
# Base stage — shared dependencies
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS base

# Install dependencies for native modules (bcrypt, sharp, etc.)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    vips-dev \
    openssl

WORKDIR /app

# Enable corepack for pnpm/yarn if needed
RUN corepack enable

# ─────────────────────────────────────────────────────────────────────────────
# Dependencies stage — install production dependencies
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS deps

# Copy package files
COPY package.json package-lock.json* ./

# Install production dependencies only
RUN npm ci --only=production --ignore-scripts

# ─────────────────────────────────────────────────────────────────────────────
# Builder stage — build the Next.js application
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS builder

# Use dummy DATABASE_URL for build (Prisma generate only). Real URL at runtime.
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/build_db"
ENV NEXT_TELEMETRY_DISABLED=1

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies (including devDependencies for build)
RUN npm ci --ignore-scripts

# Copy Prisma schema
COPY prisma ./prisma/

# Generate Prisma Client
RUN npx prisma generate

# Copy source code
COPY . .

# Build the application (skip DB-dependent static generation)
# Unset DATABASE_URL so Next.js build doesn't try to connect to Supabase
RUN DATABASE_URL="postgresql://user:pass@localhost:5432/build_db" npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Runner stage — production runtime
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS runner

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma client and schema for runtime
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma

# Copy production node_modules
COPY --from=deps /app/node_modules ./node_modules

# Create uploads directory
RUN mkdir -p /app/uploads && chown -R nextjs:nodejs /app/uploads

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]