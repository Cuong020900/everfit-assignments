# Phase 01 — Fix Test Infrastructure

**Priority:** Critical (blocks all other phases)
**Status:** 🔲 todo

## Context

Two existing tests reference deleted module paths and will fail immediately:
- `test/unit/domain/weight.vo.spec.ts` → `@src/modules/workout/domain/value-objects/weight.vo` (deleted)
- `test/unit/repositories/workout-repository.mock.ts` → `@src/modules/workout/interfaces/workout.repository.interface` (deleted)

Also: `src/modules.ts` line 26 has a wrong entity glob (`modules/**/*.entity`) but entities live in `src/model/entities/`. This will break integration tests.

## Implementation Steps

### 1. Remove or replace `weight.vo.spec.ts`

The `Weight` value object was deleted. Options:
- **Delete** the spec and test `toKg`/`fromKg` directly (already covered by `unit-converter.spec.ts`)
- Or recreate the `Weight` VO if domain modeling is desired

**Decision:** Delete `test/unit/domain/weight.vo.spec.ts`. The unit-converter spec already covers the same logic. Adding a VO just for wrapping would violate KISS/YAGNI given the current architecture doesn't use it.

```bash
# Action
rm test/unit/domain/weight.vo.spec.ts
```

### 2. Create repository interfaces per module

Create one interface file per module so each service can be tested with mocks.

**File:** `src/modules/workout-entry/interfaces/workout-entry.repository.interface.ts`
```ts
export interface IWorkoutEntryRepository {
  saveEntries(userId: string, date: string, entries: WorkoutEntryInput[]): Promise<void>;
  findHistory(query: HistoryQuery): Promise<HistoryResult>;
}
```

**File:** `src/modules/workout-set/interfaces/workout-set.repository.interface.ts`
```ts
export interface IWorkoutSetRepository {
  findPRSets(query: PRQuery): Promise<PRSetResult[]>;
  findProgressSeries(query: ProgressQuery): Promise<ProgressSetResult[]>;
}
```

**File:** `src/modules/exercise-metadata/interfaces/exercise-metadata.repository.interface.ts`
```ts
export interface IExerciseMetadataRepository {
  findWorkoutData(userId: string, from?: string, to?: string): Promise<WorkoutDataResult[]>;
  findMuscleGroup(exerciseName: string): Promise<string | null>;
}
```

Define all input/output types in the same interface file (or a `types.ts` sibling).

### 3. Update mock repository

**File:** `test/unit/repositories/workout-repository.mock.ts`

Update to export typed mocks for each new interface:
```ts
export const createWorkoutEntryRepoMock = (): jest.Mocked<IWorkoutEntryRepository> => ({
  saveEntries: jest.fn(),
  findHistory: jest.fn(),
});

export const createWorkoutSetRepoMock = (): jest.Mocked<IWorkoutSetRepository> => ({
  findPRSets: jest.fn(),
  findProgressSeries: jest.fn(),
});

export const createExerciseMetadataRepoMock = (): jest.Mocked<IExerciseMetadataRepository> => ({
  findWorkoutData: jest.fn(),
  findMuscleGroup: jest.fn(),
});
```

### 4. Fix entity path in `src/modules.ts`

Line 26 currently:
```ts
entities: [`${__dirname}/modules/**/*.entity{.ts,.js}`],
```

Fix to:
```ts
entities: [`${__dirname}/model/entities/*.entity{.ts,.js}`],
```

This ensures TypeORM root connection knows about all entities (needed for migrations + integration tests).

### 5. Add injection tokens

Each module needs a `REPOSITORY` injection token constant.

**Files to create or update:**
- `src/modules/workout-entry/workout-entry.module.ts` — add `WORKOUT_ENTRY_REPOSITORY` token
- `src/modules/workout-set/workout-set.module.ts` — add `WORKOUT_SET_REPOSITORY` token
- `src/modules/exercise-metadata/exercise-metadata.module.ts` — add `EXERCISE_METADATA_REPOSITORY` token

### 6. Verify clean run

```bash
pnpm test  # should pass (only unit-converter.spec.ts runs)
```

## Success Criteria

- `pnpm test` passes with 0 failures
- No references to deleted module paths remain
- Each module has its own typed repository interface
- Entity path in `modules.ts` is correct
