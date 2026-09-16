# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Nocturna — production image (Fastify + Socket.io + static SPA)
# Build:  docker build -t nocturna .
# Run:    docker run --rm -p 3001:3001 nocturna
# Or:     docker compose up
# ---------------------------------------------------------------------------

FROM node:22-bookworm-slim AS build
WORKDIR /app

# Copy workspace manifests first for better layer caching
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY server/package.json server/
COPY client/package.json client/

RUN npm ci

COPY packages/shared packages/shared
COPY server server
COPY client client

RUN npm run build

# Production node_modules only (workspace hoist)
RUN npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3001 \
    CLIENT_DIST=/app/client/dist

RUN useradd --create-home --uid 10001 nocturna

COPY --from=build --chown=nocturna:nocturna /app/package.json /app/package-lock.json ./
COPY --from=build --chown=nocturna:nocturna /app/node_modules ./node_modules
COPY --from=build --chown=nocturna:nocturna /app/packages/shared ./packages/shared
COPY --from=build --chown=nocturna:nocturna /app/server/package.json ./server/package.json
COPY --from=build --chown=nocturna:nocturna /app/server/dist ./server/dist
COPY --from=build --chown=nocturna:nocturna /app/client/dist ./client/dist

USER nocturna
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/dist/index.js"]
