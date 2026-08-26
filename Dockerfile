# Multi-stage build: compiles the client (Vite) and server (tsc) in a full
# Node image, then assembles a slim runtime image with only what's needed to
# run — no source, no dev dependencies, no build tools.

FROM node:22-bookworm-slim AS build
WORKDIR /app

# Installing from the workspace root once (rather than per-package) lets npm
# dedupe shared deps and keeps this in sync with the local dev setup, which
# also installs from the root via npm workspaces.
COPY package.json package-lock.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
RUN npm ci

COPY client client
COPY server server

RUN npm run build -w client
RUN npx prisma generate --schema server/prisma/schema.prisma
RUN npm run build -w server

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# curl: Coolify's container healthcheck execs `curl` inside the container to
# poll /api/health — without it, the healthcheck itself fails even though the
# app is running fine, and Coolify rolls the deploy back thinking it's down.
# openssl: silences Prisma's libssl-detection warning on this base image
# (harmless either way, but this avoids relying on its guessed fallback).
RUN apt-get update && apt-get install -y --no-install-recommends curl openssl && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
RUN npm ci --omit=dev --workspace=server

COPY --from=build /app/server/dist server/dist
COPY --from=build /app/server/prisma server/prisma
# The optional seed scripts (prisma:seed:demo) import directly from src/
# (via tsx, not the compiled dist/) rather than duplicating that logic — so
# src needs to be here too, even though the app itself only runs dist/.
COPY --from=build /app/server/src server/src
COPY --from=build /app/node_modules/.prisma node_modules/.prisma
COPY --from=build /app/client/dist server/client

WORKDIR /app/server

EXPOSE 4000

# Applies any pending migrations before starting — safe to run on every boot
# since Prisma tracks which migrations already ran; this is what makes a
# fresh Coolify deploy (or a first boot on an empty volume) self-initializing.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
