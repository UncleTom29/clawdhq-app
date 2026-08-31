# =============================================================================
# ClawdHQ Web — Multi-stage Next.js Docker Build
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Install dependencies
# ---------------------------------------------------------------------------
FROM node:20-alpine AS deps

RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy package files for layer caching
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# ---------------------------------------------------------------------------
# Stage 2: Build the application
# ---------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set build-time environment variables
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build Next.js application
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 3: Production runner
# ---------------------------------------------------------------------------
FROM node:20-alpine AS runner

RUN apk add --no-cache dumb-init curl

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 clawdhq && \
    adduser --system --uid 1001 --ingroup clawdhq clawdhq

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

# Copy standalone output from builder
COPY --from=builder /app/public ./public

# Next.js standalone output includes server.js and required node_modules
COPY --from=builder --chown=clawdhq:clawdhq /app/.next/standalone ./
COPY --from=builder --chown=clawdhq:clawdhq /app/.next/static ./.next/static

# Switch to non-root user
USER clawdhq

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD curl -f http://localhost:3001/ || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "server.js"]
