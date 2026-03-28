FROM node:20-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y openssl curl \
    && rm -rf /var/lib/apt/lists/*

# ── Install dependencies ──────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# ── Build ─────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Generate Prisma client for the target database provider
RUN npx prisma generate
RUN npm run build

# ── Database migration runner (used by docker compose run migrate) ─
FROM base AS migrate
COPY --from=deps /app/node_modules ./node_modules
COPY prisma ./prisma
CMD ["npx", "prisma", "migrate", "deploy"]

# ── Production runner ─────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs && \
    # Create home directory for nextjs user to avoid npx EACCES errors
    mkdir -p /home/nextjs && \
    chown -R nextjs:nodejs /home/nextjs

ENV HOME=/home/nextjs

COPY --from=builder /app/public ./public
# Important: include prisma directory in the final image
COPY --from=builder /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
