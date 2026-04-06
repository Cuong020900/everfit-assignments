# TASK-10 — Observability & Documentation

## Metadata

| Field | Value |
|-------|-------|
| **Status** | `[ ]` Pending |
| **Estimated effort** | ~45 minutes |
| **Blocks** | TASK-11 |
| **Blocked by** | TASK-09 |
| **Commit message** | `docs: add README, AI_WORKFLOW.md, Swagger annotations, and seed script` |

---

## Goal

Finalize everything the submission checklist requires: README, AI_WORKFLOW.md, Swagger decorators on all endpoints, and confirm the exercise_metadata seed runs in Docker.

---

## Deliverables

### [ ] `README.md`

Must cover all 6 required points from the assessment:

```markdown
# Everfit Workout Tracking API

## Quick Start
docker compose up --build
# API: http://localhost:3000
# Swagger: http://localhost:3000/api/docs

## Architecture
[Diagram: Controller → UseCases → IWorkoutRepository → TypeORM → PostgreSQL]
[Module tree, plugin system, cursor pagination]

## API Reference
| Method | Route                   | Description                  |
| POST   | /workouts               | Bulk log workout entries      |
| GET    | /workouts               | Paginated workout history     |
| GET    | /workouts/pr            | Personal records per exercise |
| GET    | /workouts/progress      | Time-series progress chart    |
| GET    | /workouts/insights      | Training analytics insights   |

## Database Schema
[Tables: workout_entries, workout_sets, exercise_metadata]
[Indexes and rationale]

## Design Decisions & Trade-offs

### Why PostgreSQL
- Complex aggregations (PR, progress) use native GROUP BY, window functions, MAX()
- Schema constraints enforced at DB level (CHECK reps > 0)
- Cursor pagination stable with (date, id) composite

### Timezone
- Accept ISO 8601 with any UTC offset; normalize to UTC server-side
- `date` stored as DATE (no time component) — trade-off: no sub-day filtering, simpler for workout use case

### weight_kg computed at write time
- Stored at INSERT — never re-derived at query time
- Enables raw SQL aggregations without application-layer conversion

### Cursor vs offset pagination
- Offset pagination has O(N) skip cost — cursor is O(log N) with composite index
- Cursor is opaque base64url JSON { date, id }

## Scale-Up Strategy (at 50k+ entries/user)
- Materialized views for PR data (refresh on write)
- Redis cache for insights (TTL ~1h)
- Range-partition workout_entries by user_id hash
- Read replica for analytics queries
- Composite partial indexes per user
```

---

### [ ] `AI_WORKFLOW.md`

Required content per assessment:

```markdown
# AI Workflow

## Tools Used
- Claude Code (claude.ai/code) — primary development assistant
- Model: Claude Sonnet 4.x

## Prompting Strategy
- Requirements were given as structured markdown; AI turned them into task plan files
- TDD workflow enforced via task descriptions (tests written before implementation)
- Each use-case was implemented with explicit interface-first approach

## AI Mistakes Corrected (≥2 required)
1. **Wrong cursor encoding** — AI initially suggested using `btoa()` for cursor encoding,
   which is browser-only. Corrected to `Buffer.from().toString('base64url')` for Node.js.

2. **Missing cascade delete** — AI omitted `onDelete: 'CASCADE'` on the workout_sets FK.
   Corrected after noticing the schema requirement.

3. **Volume unit conversion** — AI initially returned volumeKg unconverted when unit=lb.
   Corrected to apply `fromKg(volumeKg, unit)` before returning.

## AI Suggestions Rejected (≥1 required)
1. **Redis caching for insights** — AI suggested adding Redis for insights caching.
   Rejected per YAGNI — assignment scale doesn't require it; documented in README scale-up section.

2. **dayjs for date arithmetic** — AI suggested using dayjs for `calcPreviousPeriod()`.
   Rejected in favour of native Date — simple subtraction doesn't justify a dependency.
```

---

### [ ] Swagger decorators on all endpoints

Add to `workout.controller.ts`:

```typescript
@ApiTags('workouts')
@Controller('workouts')
export class WorkoutController {}

// Per endpoint:
@ApiOperation({ summary: '...' })
@ApiQuery({ name: 'userId', type: String, format: 'uuid', required: true })
@ApiResponse({ status: 200, description: '...' })
@ApiResponse({ status: 400, schema: { example: { statusCode: 400, error: 'ERROR_CODE', message: '...' } } })
```

Minimum required: operation summary + userId query param + 200/400 responses on each endpoint.

---

### [ ] Confirm seed runs in Docker

Option A — seed as part of the migration file:
```typescript
// In InitialSchema migration, after creating tables:
await queryRunner.query(`
  INSERT INTO exercise_metadata(name, muscle_group, aliases)
  VALUES
    ('Bench Press', 'push', ARRAY['bench']),
    ('Squat', 'legs', ARRAY['back squat']),
    ...
  ON CONFLICT (name) DO NOTHING;
`);
```

Option B — separate seed command triggered from docker-compose `command`:
```yaml
command: sh -c "pnpm migration:run && pnpm seed && node dist/main"
```

**→ Option A is simpler** (no extra command, idempotent via ON CONFLICT). Use this.

---

### [ ] `.env.example`

```env
# .env.example — copy to .env and fill in
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=workout_db
DB_USER=workout
DB_PASSWORD=workout
PORT=3000
LOG_LEVEL=info
CORS_ORIGINS=http://localhost:3000
```

---

## Acceptance Criteria

- [ ] `README.md` covers architecture, setup, API docs, schema, trade-offs, scale strategy
- [ ] `AI_WORKFLOW.md` has ≥2 AI mistakes corrected and ≥1 AI suggestion rejected
- [ ] Swagger UI at `http://localhost:3000/api/docs` shows all 5 endpoints with params
- [ ] Exercise seed data present after `docker compose up` (Bench Press, Squat, etc.)
- [ ] `.env.example` committed
