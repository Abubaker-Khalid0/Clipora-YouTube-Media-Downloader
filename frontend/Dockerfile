# ── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: Run ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

ENV NODE_ENV=production

WORKDIR /app

# Copy only the standalone bundle and required static assets
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# ── CE-02 FIX ────────────────────────────────────────────────────────────────
# next-intl loads locale JSON files via a dynamic import at request time:
#   await import(`./messages/${locale}.json`)
# Dynamic imports of JSON modules are NOT automatically bundled into the
# Next.js standalone output, so the file must be copied explicitly.
# Without this line the first request crashes with MODULE_NOT_FOUND.
COPY --from=builder /app/messages ./messages

EXPOSE 3000

CMD ["node", "server.js"]
