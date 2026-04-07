---
phase: 03
title: README.md — Complete Rewrite
status: completed
priority: P0
effort: 45min
---

# Phase 03 — README.md Rewrite

Replace the default NestJS boilerplate README with a complete project README
that satisfies the interview assignment's submission requirements.

## Context Links

- `docs/interview_assetment.md` §Deliverables — what the README must cover
- `docs/requirements.md` — API endpoint specs to document
- `docs/technical_development_document.md` — architecture decisions
- `docs/REPORT.md` — assessment findings

## What the Interview Requires in README

From `interview_assetment.md`:
> "A README with: setup instructions, API documentation, database schema, technical decisions, trade-offs"

## README Structure

The README must cover 6 areas:

### 1. Overview (2–3 sentences)
- What the project does
- Tech stack: NestJS, TypeScript, PostgreSQL, TypeORM, Docker

### 2. Quick Start (Docker)
```bash
docker compose up --build   # starts API + Postgres on port 3000
# Run seed data (optional — muscle groups won't be available without it)
docker compose exec api node dist/database/seeds/exercise-metadata.seed.js
```

### 3. Local Development Setup
```bash
pnpm install
# Copy .env.example → .env (edit DB credentials if needed)
docker compose up db         # just Postgres
pnpm start:dev              # hot-reload on :3000
```

### 4. API Reference — All 5 Endpoints

For each endpoint, document:
- Method + path
- Query params (type, required/optional, description)
- Request body (for POST)
- Response shape (exact JSON with field descriptions)
- Error codes + HTTP status

Endpoints:
- `POST /workouts?userId={uuid}` — log workout
- `GET /workouts?userId={uuid}&...` — get history
- `GET /workouts/pr?userId={uuid}&...` — personal records
- `GET /workouts/progress?userId={uuid}&exerciseName=...` — progress over time
- `GET /workouts/insights?userId={uuid}&...` — training insights

### 5. Database Schema

```
workout_entries: id, user_id, date, exercise_name, created_at, updated_at
workout_sets:    id, entry_id, reps, weight, unit, weight_kg, created_at, updated_at
exercise_metadata: name (PK), muscle_group, aliases[]
```

Indexes documented. Explain `weight_kg` (normalised at write time). Explain DATE vs TIMESTAMP choice.

### 6. Technical Decisions & Trade-offs

Key decisions to explain:
- **Repository pattern** — why, how it enables testability
- **weight_kg at write time** — vs convert at query time
- **DATE column (string, not Date)** — timezone-safety
- **Cursor pagination** — why not offset
- **Plugin system for insights** — OCP, extensibility
- **Exercise metadata** — why a separate table, aliases
- **No auth** — out of scope per assignment

Trade-offs to address:
- **Scale** — currently no Redis/cache; at 10k req/s would add caching layer
- **Exercise name matching** — exact match for PR/Progress, partial for history (ILIKE)
- **No FK constraints** — managed at app level per project conventions
- **weight_kg precision** — 4 decimal places sufficient for kg/lb conversions

### 7. Running Tests

```bash
# Unit tests (no DB)
pnpm test

# Integration tests (requires Docker DB on port 5433)
docker compose up db-test    # starts test DB
pnpm test:integration

# Coverage report
pnpm test:cov
```

## Todo List

- [ ] Write new README.md (replace default NestJS content)
- [ ] Section 1: Overview + tech stack
- [ ] Section 2: Quick Start (Docker one-liner)
- [ ] Section 3: Local dev setup
- [ ] Section 4: Full API reference (all 5 endpoints, shapes, errors)
- [ ] Section 5: Database schema + ER relationships
- [ ] Section 6: Technical decisions + trade-offs (≥5 explained)
- [ ] Section 7: Testing instructions
- [ ] Verify all command examples are correct
- [ ] Proofread for clarity

## Success Criteria

- README has complete setup instructions that work from scratch
- Every endpoint is documented with request/response shapes
- At least 5 technical decisions explained with reasoning
- At least 3 trade-offs acknowledged
- No stale NestJS boilerplate content
