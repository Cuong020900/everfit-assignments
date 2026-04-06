# TASK-10 — Observability & Documentation

## Metadata

| Field | Value |
|-------|-------|
| **Status** | `[ ]` Pending |
| **Estimated effort** | ~30 minutes |
| **Blocks** | TASK-11 |
| **Blocked by** | TASK-09 |
| **Commit message** | `docs: add README, AI_WORKFLOW, complete Swagger decorators` |

---

## Goal

Polish observability (verify Pino logs are correct), complete all Swagger decorators, and write the two required docs: `README.md` and `AI_WORKFLOW.md`.

---

## Deliverables

### [ ] Verify Pino logger output

Every request must log (JSON in production, pretty in dev):

```json
{
  "level": "info",
  "time": "2024-01-15T01:00:00.000Z",
  "pid": 1,
  "req": { "id": "uuid", "method": "POST", "url": "/workouts?userId=..." },
  "res": { "statusCode": 201 },
  "responseTime": 45
}
```

Sensitive fields redacted: `req.headers.authorization`.

---

### [ ] Complete Swagger decorators on all DTOs

```typescript
// Every DTO property needs @ApiProperty()
// Every controller method needs:
@ApiOperation({ summary: '...' })
@ApiQuery({ name: 'userId', required: true, description: 'User UUID', type: String })
@ApiResponse({ status: 200, description: '...' })
@ApiResponse({ status: 400, description: 'Validation error', schema: { ... } })
```

Endpoints to verify:
- [ ] `POST /workouts`
- [ ] `GET /workouts`
- [ ] `GET /workouts/pr`
- [ ] `GET /workouts/progress`
- [ ] `GET /workouts/insights`

---

### [ ] `README.md` (required by assessment)

Sections:

1. **Quick Start**
   ```bash
   git clone ...
   docker compose up --build
   # API: http://localhost:3000
   # Swagger: http://localhost:3000/api/docs
   ```

2. **Architecture Diagram** (ASCII)
   ```
   Client
     │
     ▼
   NestJS API (port 3000)
   ├── WorkoutController
   │   ├── LogWorkoutUseCase
   │   ├── GetHistoryUseCase
   │   ├── GetPRUseCase
   │   ├── GetProgressUseCase
   │   └── GetInsightsUseCase (InsightPlugin[])
   │       ├── MostTrainedInsight
   │       ├── TrainingFrequencyInsight
   │       ├── MuscleBalanceInsight
   │       └── NeglectedExerciseInsight
   └── WorkoutRepository → PostgreSQL 16
   ```

3. **API Reference** — link to Swagger, brief table of 5 endpoints

4. **Database Schema**
   - Tables: `workout_entries`, `workout_sets`, `exercise_metadata`
   - Index rationale

5. **Design Decisions**
   - Why PostgreSQL over MongoDB
   - Why cursor pagination
   - Why `weight_kg` stored at write time
   - Plugin architecture for insights

6. **Scale Trade-offs**
   - Current: composite indexes handle 50k entries/user
   - At 1M+ entries: materialized views for PRs; Redis TTL cache for insights; partition by `user_id` hash
   - Read replicas for analytics queries

7. **Running Tests**
   ```bash
   pnpm test:unit          # fast, no DB
   pnpm test:integration   # requires Docker DB running
   pnpm test:cov           # coverage report
   ```

---

### [ ] `AI_WORKFLOW.md` (required by assessment)

Sections:

1. **Tools Used**
   - Claude Code (claude.ai) for spec clarification, planning, TDD scaffolding
   - Context7 MCP for verified latest library versions
   - GitNexus MCP for codebase structure analysis

2. **AI Mistakes Corrected (≥ 2)**
   - Example 1: AI initially suggested `e2e-spec` naming for integration tests → corrected to `integration.spec.ts` with explanation of distinction
   - Example 2: AI omitted bulk entry support in initial POST design → corrected after re-reading assessment spec
   - Example 3: AI suggested MongoDB → pushed back, PostgreSQL chosen for aggregation performance

3. **AI Suggestions Rejected (≥ 1)**
   - AI suggested Redis cache for PR queries → rejected (YAGNI: not needed at assignment scale; documented as future scale-up path)

4. **Prompting Strategy**
   - Used `/speckit-clarify` to resolve 5 domain ambiguities before any implementation
   - Used `/speckit-plan` to generate per-task plan files with explicit `blocks`/`blockedBy`
   - Verified library versions via Context7 before writing any import statements

---

## Acceptance Criteria

- [ ] `GET http://localhost:3000/api/docs` renders all 5 endpoints with complete schema
- [ ] Every query param and request body field has `@ApiProperty()` / `@ApiQuery()` decoration
- [ ] Pino JSON logs appear in Docker Compose output
- [ ] `README.md` allows reviewer to `docker compose up` in < 2 minutes
- [ ] `AI_WORKFLOW.md` contains all 4 required sections (tools, ≥2 mistakes, ≥1 rejection, strategy)
