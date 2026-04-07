---
phase: 02
title: Dockerfile + Docker Compose — Full Stack Startup
status: completed
priority: P0
effort: 30min
---

# Phase 02 — Dockerfile + Docker Compose

Make `docker compose up --build` start the complete stack (API + Postgres).

## Context Links

- `docker-compose.yml` — API service currently commented out
- `src/main.ts` — listens on `PORT` env var, default 3000
- `.env.example` (to be created) — shows required env vars
- `CLAUDE.md` §Configuration — env vars and defaults

## Overview

Two tasks:
1. Write a multi-stage `Dockerfile` that builds the NestJS app and runs it
2. Uncomment and configure the `api` service in `docker-compose.yml`
3. Add `.env.example` for developer onboarding

## Implementation Steps

### 1. Create `Dockerfile`

Multi-stage build to keep the runtime image lean:

```dockerfile
# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install deps (separate layer for caching)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY tsconfig*.json biome.json ./
COPY src ./src
RUN pnpm build

# Stage 2: Runtime
FROM node:22-alpine AS runtime
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Only production deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# Copy compiled output
COPY --from=builder /app/dist ./dist

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000

CMD ["node", "dist/main.js"]
```

**Rationale for choices:**
- `node:22-alpine` — latest LTS, minimal image (~70MB vs ~300MB for full node)
- Two-stage — dev deps not in production image
- `pnpm install --prod` — excludes dev dependencies like biome, jest, ts-node
- Non-root user — security best practice

### 2. Update `docker-compose.yml`

Uncomment and configure the API service:

```yaml
services:
  api:
    build: .
    ports:
      - '3000:3000'
    environment:
      NODE_ENV: production
      DB_HOST: db
      DB_PORT: 5432
      DB_NAME: workout_db
      DB_USER: workout
      DB_PASSWORD: workout
      LOG_LEVEL: info
      PORT: 3000
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped
```

**Key points:**
- `depends_on: service_healthy` — API waits for Postgres health check to pass
- `DB_HOST: db` — Docker network name of the `db` service
- `restart: unless-stopped` — auto-restart on crash
- Migrations run on startup (`migrationsRun: true` in TypeORM config) — no separate migration step needed

### 3. Create `.env.example`

```dotenv
# Server
PORT=3000
NODE_ENV=development
LOG_LEVEL=info

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=workout_db
DB_USER=workout
DB_PASSWORD=workout

# CORS (comma-separated origins, or leave empty for *)
# CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

### 4. Verify Startup Sequence

The startup sequence on `docker compose up --build`:
1. `db` starts → passes healthcheck (pg_isready)
2. `api` builds image → waits for db healthcheck
3. `api` starts → TypeORM connects → runs migrations → listens on :3000
4. Seed data (if needed) can be run via: `docker compose exec api node dist/database/seeds/exercise-metadata.seed.js`

**Add `pnpm seed:docker` script to `package.json`:**
```json
"seed:docker": "docker compose exec api node dist/database/seeds/exercise-metadata.seed.js"
```

## Todo List

- [ ] Create `Dockerfile` (multi-stage: builder + runtime)
- [ ] Uncomment and configure API service in `docker-compose.yml`
- [ ] Create `.env.example`
- [ ] Add `seed:docker` script to `package.json`
- [ ] Verify: `docker compose up --build` starts without errors
- [ ] Verify: `curl http://localhost:3000/workouts?userId=<valid-uuid>` returns 200

## Success Criteria

- `docker compose up --build` exits cleanly with API on port 3000
- `docker compose down -v` cleans up completely
- `.env.example` documents all required variables
- No secrets committed (`.env` in `.gitignore`)
