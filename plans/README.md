# Plans Index

Each file in this folder = one implementation task.
Tasks are executed in order. Dependencies are declared explicitly in each file.

## Dependency Graph

```
TASK-01  Project Scaffold & Infrastructure
   └── blocks: TASK-02, TASK-03

TASK-02  Domain Layer (Entities, Migrations, Converters)
   ├── blockedBy: TASK-01
   └── blocks: TASK-03, TASK-04, TASK-05, TASK-06, TASK-07, TASK-08

TASK-03  Repository Interface & TypeORM Implementation
   ├── blockedBy: TASK-01, TASK-02
   └── blocks: TASK-04, TASK-05, TASK-06, TASK-07, TASK-08

TASK-04  UC-1: Log Workout
   ├── blockedBy: TASK-02, TASK-03
   └── blocks: TASK-05 (history needs data), TASK-06, TASK-07, TASK-08

TASK-05  UC-2: Get Workout History
   ├── blockedBy: TASK-03, TASK-04
   └── blocks: TASK-09

TASK-06  UC-3: Personal Records
   ├── blockedBy: TASK-03, TASK-04
   └── blocks: TASK-09

TASK-07  UC-4: Progress Chart
   ├── blockedBy: TASK-03, TASK-04
   └── blocks: TASK-09

TASK-08  UC-5: Insights & Plugin System
   ├── blockedBy: TASK-03, TASK-04
   └── blocks: TASK-09

TASK-09  Global Error Handling & Validation Polish
   ├── blockedBy: TASK-05, TASK-06, TASK-07, TASK-08
   └── blocks: TASK-10

TASK-10  Observability & Documentation
   ├── blockedBy: TASK-09
   └── blocks: TASK-11

TASK-11  Final Integration Pass & Docker Verification
   └── blockedBy: TASK-10
```

## Status Legend

| Symbol | Meaning |
|--------|---------|
| `[ ]` | Pending |
| `[x]` | Done |
| `[~]` | In progress |
| `[!]` | Blocked |

## Files

| Task | File | Est. |
|------|------|------|
| TASK-01 | [TASK-01-scaffold.md](./TASK-01-scaffold.md) | ~1h |
| TASK-02 | [TASK-02-domain.md](./TASK-02-domain.md) | ~1h |
| TASK-03 | [TASK-03-repository.md](./TASK-03-repository.md) | ~1.5h |
| TASK-04 | [TASK-04-uc-log-workout.md](./TASK-04-uc-log-workout.md) | ~1h |
| TASK-05 | [TASK-05-uc-get-history.md](./TASK-05-uc-get-history.md) | ~1.5h |
| TASK-06 | [TASK-06-uc-get-pr.md](./TASK-06-uc-get-pr.md) | ~1.5h |
| TASK-07 | [TASK-07-uc-get-progress.md](./TASK-07-uc-get-progress.md) | ~1.5h |
| TASK-08 | [TASK-08-uc-get-insights.md](./TASK-08-uc-get-insights.md) | ~2h |
| TASK-09 | [TASK-09-error-handling.md](./TASK-09-error-handling.md) | ~30min |
| TASK-10 | [TASK-10-docs-observability.md](./TASK-10-docs-observability.md) | ~30min |
| TASK-11 | [TASK-11-final-verification.md](./TASK-11-final-verification.md) | ~30min |

**Total estimated effort: ~11–12 hours**
