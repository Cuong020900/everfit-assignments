# AI_WORKFLOW.md

Documentation of how AI tools were used during development of this workout tracking API.

## 1. Tools Used

**Claude Code (claude.ai/code)** — primary driver for all implementation.

- `/ck:plan` skill — generated phased implementation plans with explicit dependency ordering (`blockedBy`/`blocks` between tasks)
- `/ck:cook` skill — drove TDD implementation loop (Red → Green → Refactor) one endpoint at a time
- `/ck:scout` — explored codebase structure to inform planning (file locations, existing patterns, conventions)
- General Q&A — TypeORM query builder syntax, NestJS multi-provider DI patterns, Epley 1RM formula (`weight × (1 + reps / 30)`)

**Workflow:** Planning → `/ck:plan` produced phased roadmap. Implementation → `/ck:cook` implemented each phase with subagents for testing, code review, and documentation.

## 2. Where AI Output Was Wrong — and How I Corrected It

### Mistake 1: Overengineered module structure

AI initially proposed a single `WorkoutModule` containing all services, controllers, and repositories — mirroring the `CLAUDE.md` Architecture section literally. The single-module approach created circular dependencies: PR logic joins `workout_sets` and `workout_entries`; cursor pagination logic in history also touches `workout_entries` but for different query shapes.

**Correction:** Refactored into 3 separate bounded modules:
- `WorkoutEntryModule` — `POST /workouts` and `GET /workouts` (history + cursor pagination)
- `WorkoutSetModule` — `GET /workouts/pr` and `GET /workouts/progress`
- `ExerciseMetadataModule` — `GET /workouts/insights` + plugin system

This matched domain boundaries and resolved the circular dependency. Reflected in commit `f8fc61d refactor: codebase structure (overengineering)`.

### Mistake 2: `TransformResponseInterceptor` double-wrapping

AI added `{ data: result }` wrapping inside the interceptor while services were also returning `{ data: [...] }` shaped objects. The interceptor did `{ ...value, meta }` on top of what the service returned, producing `{ data: { data: [...], meta: ... } }` — a double-wrapped response.

**Correction:** Established a clear contract:
- Services return **plain types** (e.g., `{ data: T[], pagination }` or a flat object)
- Controllers wrap with `{ data: await this.service.method() }` before returning
- Interceptor spreads `{ ...value, meta }` — the `data` key passes through unchanged

Why it mattered: integration tests were failing on `response.body.data.data` with unexpected nesting. Fixed in commit `b4e8241 fix: resolve integration test failures`.

### Mistake 3: `findPRSets` query missing `exercise_name`

AI's initial `findPRSets` repository query selected only `reps, weight_kg, date` — missing `exercise_name`. This made it impossible to group PRs by exercise in the service layer.

**Correction:** Added `e.exercise_name AS "exerciseName"` to the SELECT clause and updated the `PRSetResult` type to include `exerciseName: string`. The service then groups results using `Map<string, PRSetResult[]>` before computing per-exercise max weight / max volume / best 1RM.

## 3. Where I Rejected an AI Suggestion

### Rejected: Auto-run migrations inside the seed script

AI suggested adding migration execution at the start of `exercise-metadata.seed.ts`:

```typescript
// AI suggestion — rejected
await dataSource.runMigrations();
await seedExerciseMetadata(dataSource);
```

**Why I rejected it:**
- Migrations already run automatically on NestJS bootstrap via `migrationsRun: true` in TypeORM config — no gap to fill
- Adding migration logic to the seed script violates Single Responsibility Principle and creates a second code path for something already handled
- Running migrations twice against a live database is dangerous (some migrations are not idempotent)

**What I did instead:** Documented in the README that `pnpm seed:docker` runs after `docker compose up --build`, at which point migrations are already applied.

### Rejected: Redis cache for PR queries

AI suggested adding a Redis cache layer for `GET /workouts/pr` since it involves table scans.

**Why I rejected it:** YAGNI. This is a personal fitness app, not a high-traffic service. Redis adds a new container, connection pooling, cache invalidation on every `POST /workouts`, TTL strategy decisions, and an `ioredis` dependency — significant scope increase for a speculative optimisation at personal-use scale. The composite index handles it efficiently.

## 4. Prompting Strategy

**Specific file paths in prompts** — "Update `src/modules/workout-set/dto/get-pr.dto.ts` to replace `PRData` with `PRExerciseResult`..." rather than "update the PR DTO". Eliminates ambiguity about which file to edit.

**Acceptance criteria first** — Defined the expected response JSON shape before asking for implementation. Anchors the AI to the correct output format before it starts designing internals.

**TDD framing** — Prompted with the failing test assertion, not the desired output. "Write a failing test that asserts `response.body.data[0].exerciseName` equals 'Bench Press', then implement the minimum code to pass it." Forces incremental, verifiable progress and keeps implementations honest.

**Incremental scope** — One endpoint per prompt cycle. Each cycle: write test → implement → run test → fix → next. Smaller context means fewer hallucinations about which service/repository/controller is being edited.

**Reference existing patterns** — "Follow the same pattern as `WorkoutEntryRepository.findHistory`" rather than asking the AI to design from scratch. Anchoring to existing code produces consistent style and avoids reinventing patterns already established in the codebase.
