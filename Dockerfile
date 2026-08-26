# Multi-stage build: compiles the client (Vite) and server (tsc) in a full
# Node image, then assembles a slim runtime image with only what's needed to
# run — no source, no dev dependencies, no build tools.

FROM node:20-bookworm-slim AS build
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

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
RUN npm ci --omit=dev --workspace=server

COPY --from=build /app/server/dist server/dist
COPY --from=build /app/server/prisma server/prisma
COPY --from=build /app/node_modules/.prisma node_modules/.prisma
COPY --from=build /app/client/dist server/client

WORKDIR /app/server

EXPOSE 4000

# Applies any pending migrations before starting — safe to run on every boot
# since Prisma tracks which migrations already ran; this is what makes a
# fresh Coolify deploy (or a first boot on an empty volume) self-initializing.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
