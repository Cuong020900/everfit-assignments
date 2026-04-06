# Plans Index

Each file in this folder = one implementation task.
Tasks are executed in order. Dependencies are declared explicitly in each file.

## Dependency Graph

```
TASK-01  Project Scaffold & Infrastructure     [DONE]
   └── TASK-02  Domain Layer                    [DONE]
         └── TASK-03  Repository                [pending]
               └── TASK-04  UC-1: Log Workout   [pending]
                     ├── TASK-05  UC-2: History  [pending]
                     ├── TASK-06  UC-3: PRs      [pending]
                     ├── TASK-07  UC-4: Progress [pending]
                     └── TASK-08  UC-5: Insights [pending]
                           └── (all 05-08) → TASK-09  Error Handling Polish  [pending]
                                 └── TASK-10  Docs & Observability           [pending]
                                       └── TASK-11  Final Verification       [pending]
```

## Critical Path

```
TASK-01 → TASK-02 → TASK-03 → TASK-04 → (05/06/07/08 in parallel) → TASK-09 → TASK-10 → TASK-11
```

## Status Summary

| Task | File | Status | Notes |
|------|------|--------|-------|
| TASK-01 | TASK-01-scaffold.md | ✅ Done | Minor diffs from plan: uses DB_* vars, workout/workout_db names |
| TASK-02 | TASK-02-domain.md | ✅ Done | All 17 unit tests GREEN; migrations split per table; @src/ aliases enforced |
| TASK-03 | TASK-03-repository.md | 🔄 Next | Unblocked — implement IWorkoutRepository + TypeORM impl |
| TASK-04 | TASK-04-uc-log-workout.md | ⏳ Pending | |
| TASK-05 | TASK-05-uc-get-history.md | ⏳ Pending | |
| TASK-06 | TASK-06-uc-get-pr.md | ⏳ Pending | |
| TASK-07 | TASK-07-uc-get-progress.md | ⏳ Pending | |
| TASK-08 | TASK-08-uc-get-insights.md | ⏳ Pending | |
| TASK-09 | TASK-09-error-handling.md | ⏳ Pending | |
| TASK-10 | TASK-10-docs-observability.md | ⏳ Pending | |
| TASK-11 | TASK-11-final-verification.md | ⏳ Pending | |

## Conventions Used Across All Tasks

- **Shared folder**: `src/shared/` — constants, filters, utils (NOT `src/common/`)
- **Config**: Pure env vars via `ConfigModule.forRoot` + Joi — no YAML files
- **DB names**: `workout_db` / `workout_test_db`, user `workout`
- **Injection token**: `WORKOUT_REPOSITORY` (Symbol)
- **Error pattern**: `throw new Error('ERROR_CODE')` in use-cases; filter maps to HTTP
- **Weight**: stored as `weight_kg` at write time; never recomputed at read time
- **Cursor**: base64url-encoded JSON `{ date, id }` — never base64 (charset issue)
- **Route order**: static routes (`/pr`, `/progress`, `/insights`) before `@Get()` in controller
- **Test mock factory**: `createMockRepository()` from `test/unit/repositories/workout-repository.mock.ts`

## Start Next Task

TASK-03 is unblocked. Implement `IWorkoutRepository` interface and `TypeOrmWorkoutRepository`:

```bash
pnpm test -- --testPathPatterns="workout-repository"
```
