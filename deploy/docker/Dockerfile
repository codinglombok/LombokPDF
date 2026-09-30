# ─── Stage 1: Builder ────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /build

# Copy manifests first (layer cache)
COPY package*.json ./

# Install ALL deps (including devDeps for build)
RUN npm ci --ignore-scripts

# Copy source
COPY src/         ./src/
COPY tsconfig.json tsup.config.ts ./
COPY templates/   ./templates/

# Build
RUN npm run build

# Prune devDeps
RUN npm prune --omit=dev

# ─── Stage 2: Runtime ────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

# Security: non-root user
RUN addgroup -g 1001 lombok && adduser -u 1001 -G lombok -s /bin/sh -D lombok

WORKDIR /app

# Copy only what's needed
COPY --chown=lombok:lombok --from=builder /build/dist/       ./dist/
COPY --chown=lombok:lombok --from=builder /build/node_modules/ ./node_modules/
COPY --chown=lombok:lombok --from=builder /build/templates/  ./templates/
COPY --chown=lombok:lombok --from=builder /build/package.json ./

# Create temp dir for PDF generation
RUN mkdir -p /tmp/lombokpdf && chown lombok:lombok /tmp/lombokpdf

# Health check (for Docker Compose / ECS / k8s)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('./dist/index.js'); process.exit(0)" || exit 1

# No network access needed for PDF generation by default
EXPOSE 3000

USER lombok

ENV NODE_ENV=production \
    LOMBOKPDF_TEMP_DIR=/tmp/lombokpdf

CMD ["node", "dist/cli/index.js"]

# ─── Labels ──────────────────────────────────────────────────────────────────
LABEL org.opencontainers.image.title="LombokPDF"
LABEL org.opencontainers.image.description="Lightweight, elegant PDF generation — Apache 2.0"
LABEL org.opencontainers.image.url="https://lombokpdf.dev"
LABEL org.opencontainers.image.source="https://github.com/codinglombok/lombokpdf"
LABEL org.opencontainers.image.licenses="Apache-2.0"
LABEL org.opencontainers.image.vendor="Lombok Digital"
