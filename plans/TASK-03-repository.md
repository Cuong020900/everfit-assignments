# TASK-03 — Repository Interface & TypeORM Implementation

## Metadata

| Field | Value |
|-------|-------|
| **Status** | `[ ]` Pending |
| **Estimated effort** | ~1.5 hours |
| **Blocks** | TASK-04, TASK-05, TASK-06, TASK-07, TASK-08 |
| **Blocked by** | TASK-01, TASK-02 |
| **Commit message** | `feat: add IWorkoutRepository interface and TypeORM implementation` |

---

## Goal

Define the data-access contract (`IWorkoutRepository`) and its TypeORM implementation. All use-cases depend on this abstraction — never on the concrete class directly (DIP).

---

## File Locations

```
src/modules/workout/interfaces/
  workout.repository.interface.ts    # IWorkoutRepository + all input/output types
  insight-plugin.interface.ts        # InsightPlugin (for TASK-08)

src/modules/workout/repositories/
  workout.repository.ts              # TypeOrmWorkoutRepository

test/unit/
  repositories/
    workout-repository.mock.ts       # jest.Mocked<IWorkoutRepository> factory
```

---

## Deliverables

### [ ] `src/modules/workout/interfaces/workout.repository.interface.ts`

```typescript
import { WorkoutEntry } from '../entities/workout-entry.entity';

export interface CreateSetInput {
  reps: number;
  weight: number;
  unit: string;
  weightKg: number;
}

export interface CreateEntryInput {
  exerciseName: string;
  sets: CreateSetInput[];
}

export interface HistoryQuery {
  userId: string;
  limit: number;
  cursor?: { date: string; id: string };
  exerciseName?: string;    // partial ILIKE match
  from?: string;            // YYYY-MM-DD
  to?: string;              // YYYY-MM-DD
  muscleGroup?: string;
}

export interface PRResult {
  exerciseName: string;
  maxWeightKg:   number;  maxWeightReps:  number;  maxWeightDate:  string;
  maxVolumeKg:   number;  maxVolumeReps:  number;  maxVolumeDate:  string;
  bestOneRMKg:   number;  bestOneRMReps:  number;  bestOneRMDate:  string;
}

export interface ProgressQuery {
  userId: string;
  exerciseName: string;
  from: string;
  to: string;
  groupBy: 'daily' | 'weekly' | 'monthly';
}

export interface ProgressPoint {
  period: string;        // YYYY-MM-DD | YYYY-Www | YYYY-MM
  bestWeightKg: number;  // MAX(weight_kg) per day; AVG of daily bests for week/month
  volumeKg: number;      // SUM(weight_kg * reps) per period
}

export interface WorkoutDataEntry {
  date: string;
  exerciseName: string;
  sets: Array<{ reps: number; weightKg: number }>;
}

export interface WorkoutData {
  userId: string;
  from: string;
  to: string;
  entries: WorkoutDataEntry[];
}

export interface IWorkoutRepository {
  saveEntries(userId: string, date: string, entries: CreateEntryInput[]): Promise<WorkoutEntry[]>;
  findHistory(query: HistoryQuery): Promise<{ entries: WorkoutEntry[]; hasMore: boolean }>;
  findPRs(userId: string, exerciseName?: string, from?: string, to?: string): Promise<PRResult[]>;
  findProgressSeries(query: ProgressQuery): Promise<ProgressPoint[]>;
  findWorkoutData(userId: string, from: string, to: string): Promise<WorkoutData>;
}

export const WORKOUT_REPOSITORY = Symbol('IWorkoutRepository');
```

---

### [ ] `src/modules/workout/interfaces/insight-plugin.interface.ts`

```typescript
import { WorkoutData } from './workout.repository.interface';

export interface InsightResult {
  name: string;
  data: Record<string, unknown>;
}

export interface InsightPlugin {
  readonly name: string;
  compute(data: WorkoutData): InsightResult | null;
}

export const INSIGHT_PLUGINS = Symbol('InsightPlugin[]');
```

---

### [ ] `test/unit/repositories/workout-repository.mock.ts`

```typescript
import type { IWorkoutRepository } from '../../../src/modules/workout/interfaces/workout.repository.interface';

export const createMockRepository = (): jest.Mocked<IWorkoutRepository> => ({
  saveEntries:        jest.fn(),
  findHistory:        jest.fn(),
  findPRs:            jest.fn(),
  findProgressSeries: jest.fn(),
  findWorkoutData:    jest.fn(),
});
```

---

### [ ] `src/modules/workout/repositories/workout.repository.ts`

#### Constructor

```typescript
@Injectable()
export class TypeOrmWorkoutRepository implements IWorkoutRepository {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(WorkoutEntry) private readonly entryRepo: Repository<WorkoutEntry>,
    @InjectRepository(ExerciseMetadata) private readonly metaRepo: Repository<ExerciseMetadata>,
  ) {}
}
```

#### `saveEntries()` — transactional insert

```typescript
async saveEntries(userId: string, date: string, entries: CreateEntryInput[]): Promise<WorkoutEntry[]> {
  return this.dataSource.transaction(async (manager) => {
    const results: WorkoutEntry[] = [];
    for (const e of entries) {
      const entry = manager.create(WorkoutEntry, { userId, date, exerciseName: e.exerciseName });
      const saved = await manager.save(entry);
      const sets = e.sets.map((s) =>
        manager.create(WorkoutSet, { ...s, entry: saved }),
      );
      saved.sets = await manager.save(sets);
      results.push(saved);
    }
    return results;
  });
}
```

#### `findHistory()` — cursor pagination with optional filters

```typescript
// Strategy:
//   Build QueryBuilder with:
//     WHERE user_id = :userId
//     AND (date < :cursorDate OR (date = :cursorDate AND id < :cursorId))  -- if cursor
//     AND exercise_name ILIKE :exerciseName                                -- if filter
//     AND date >= :from AND date <= :to                                    -- if range
//     AND muscle_group = :muscleGroup (JOIN exercise_metadata)             -- if muscleGroup
//   ORDER BY date DESC, id DESC
//   LIMIT limit + 1
//
// If results.length > limit → hasMore = true, pop last item
// Always load sets via leftJoinAndSelect

// Cursor: base64url(JSON({ date, id }))
// Invalid cursor → treated as no cursor (start from beginning)
```

#### `findPRs()` — raw SQL aggregation

```sql
SELECT
  we.exercise_name,
  MAX(ws.weight_kg) AS max_weight_kg,
  (SELECT ws2.reps
   FROM workout_sets ws2 JOIN workout_entries we2 ON ws2.entry_id = we2.id
   WHERE we2.user_id = $1 AND we2.exercise_name = we.exercise_name
   ORDER BY ws2.weight_kg DESC LIMIT 1) AS max_weight_reps,
  (SELECT we2.date::text
   FROM workout_sets ws2 JOIN workout_entries we2 ON ws2.entry_id = we2.id
   WHERE we2.user_id = $1 AND we2.exercise_name = we.exercise_name
   ORDER BY ws2.weight_kg DESC LIMIT 1) AS max_weight_date,
  MAX(ws.weight_kg * ws.reps) AS max_volume_kg,
  -- correlated subquery for max_volume_reps and max_volume_date (same pattern)
  MAX(ws.weight_kg * (1 + ws.reps::float / 30)) AS best_one_rm_kg,
  -- correlated subquery for best_one_rm_reps and best_one_rm_date (same pattern)
FROM workout_entries we
JOIN workout_sets ws ON ws.entry_id = we.id
WHERE we.user_id = $1
  [AND we.exercise_name = $2]   -- optional
  [AND we.date >= $3]           -- optional from
  [AND we.date <= $4]           -- optional to
GROUP BY we.exercise_name
```

> **Implementation note:** Use correlated subqueries or a CTE to retrieve `reps` and `date` for each PR type. The goal is all PR data in one query — no N+1.

#### `findProgressSeries()` — DATE_TRUNC grouping

```sql
-- Daily (groupBy = 'daily'):
SELECT
  we.date::text AS period,
  MAX(ws.weight_kg) AS best_weight_kg,
  SUM(ws.weight_kg * ws.reps) AS volume_kg
FROM workout_entries we
JOIN workout_sets ws ON ws.entry_id = we.id
WHERE we.user_id = $1 AND we.exercise_name = $2
  AND we.date BETWEEN $3 AND $4
GROUP BY we.date
ORDER BY we.date ASC

-- Weekly (groupBy = 'weekly'):
-- period = ISO week label e.g. '2024-W03'
-- bestWeightKg = AVG of daily MAX(weight_kg) — requires subquery
-- volumeKg = SUM of all sets in the week
-- Use TO_CHAR(DATE_TRUNC('week', we.date), 'IYYY-"W"IW') for ISO week

-- Monthly (groupBy = 'monthly'):
-- period = 'YYYY-MM'
-- bestWeightKg = AVG of daily MAX values (subquery)
-- volumeKg = SUM of all sets in month
-- Use TO_CHAR(we.date, 'YYYY-MM')
```

#### `findWorkoutData()` — for insights

```typescript
// Returns all entries with their sets for the given user + date range
// Simple query: SELECT entries + LEFT JOIN sets
// Used by GetInsightsUseCase to feed InsightPlugin[]
```

#### `findMuscleGroup()` — helper for history

```typescript
async findMuscleGroup(exerciseName: string): Promise<string | null> {
  const meta = await this.metaRepo.findOne({ where: { name: exerciseName } });
  return meta?.muscleGroup ?? null;
}
```

> Add `findMuscleGroup` to `IWorkoutRepository` if needed, or keep as a separate `ExerciseMetadataService`.

---

### [ ] Register in `WorkoutModule`

```typescript
@Module({
  imports: [TypeOrmModule.forFeature([WorkoutEntry, WorkoutSet, ExerciseMetadata])],
  providers: [
    {
      provide: WORKOUT_REPOSITORY,
      useClass: TypeOrmWorkoutRepository,
    },
  ],
  exports: [WORKOUT_REPOSITORY],
})
export class WorkoutModule {}
```

---

## Acceptance Criteria

- [ ] `IWorkoutRepository` interface compiles — no TypeScript errors
- [ ] `createMockRepository()` implements every method with `jest.fn()`
- [ ] `saveEntries()` is transactional — if one entry fails, all roll back
- [ ] Cursor decode handles invalid/malformed cursors gracefully (returns first page)
- [ ] `pnpm build` with zero errors after this task
