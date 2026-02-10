# Help Center Frontend Dockerfile - Next.js SSR
# Build context is frontend/. SDK packages are installed from npm.
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json* ./

# Replace local file: references with npm versions so we install from the registry.
# Delete the lockfile since its resolutions point to the old file: paths.
RUN sed -i 's|"file:../packages/sdk-react"|"*"|g; s|"file:../packages/sdk"|"*"|g' package.json \
    && rm -f package-lock.json \
    && npm install

# Build the source code
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_* vars must be available at build time (they get inlined into JS bundle)
ARG NEXT_PUBLIC_ENV=production
ARG NEXT_PUBLIC_PILLAR_API_URL
ENV NEXT_PUBLIC_ENV=${NEXT_PUBLIC_ENV}
ENV NEXT_PUBLIC_PILLAR_API_URL=${NEXT_PUBLIC_PILLAR_API_URL}

RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
