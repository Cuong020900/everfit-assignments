---
title: TDD Workout Services Implementation
status: complete
created: 2026-04-07
blockedBy: []
blocks: []
---

# TDD Workout Services Implementation

Implement all 5 workout API endpoints using strict TDD (Red → Green → Refactor).
All services are currently empty stubs. Two existing tests are broken.

## Phases

| # | Phase | Status | File |
|---|-------|--------|------|
| 1 | Fix test infrastructure | ✅ complete | [phase-01](phase-01-fix-test-infrastructure.md) |
| 2 | WorkoutEntryService (log + history) | ✅ complete | [phase-02](phase-02-workout-entry-service.md) |
| 3 | WorkoutSetService (PR + progress) | ✅ complete | [phase-03](phase-03-workout-set-service.md) |
| 4 | ExerciseMetadataService (insights + plugins) | ✅ complete | [phase-04](phase-04-exercise-metadata-service.md) |
| 5 | Integration tests | ✅ complete | [phase-05](phase-05-integration-tests.md) |

## Critical Path

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5
```

Phases 2–4 can be partially parallelised (separate modules), but Phase 1 must complete first.
Phase 5 requires all services to be implemented.

## Key Files Modified

- `src/modules/workout-entry/workout-entry.service.ts`
- `src/modules/workout-set/workout-set.service.ts`
- `src/modules/exercise-metadata/exercise-metadata.service.ts`
- `src/modules.ts` (entity path bug fix)
- `test/unit/**/*.spec.ts` (new + fixed)
- `test/integration/**/*.spec.ts` (new)
