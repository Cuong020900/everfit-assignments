# TASK-02 — Domain Layer (Entities, Migrations, Converters)

## Metadata

| Field | Value |
|-------|-------|
| **Status** | `[~]` In progress — tests written, implementation missing |
| **Estimated effort** | ~1 hour |
| **Blocks** | TASK-03, TASK-04, TASK-05, TASK-06, TASK-07, TASK-08 |
| **Blocked by** | TASK-01 |
| **Commit message** | `feat: add domain entities, migrations, weight value object, and unit converter` |

---

## Current State

Unit tests already exist and are failing (RED):
- `test/unit/domain/weight.vo.spec.ts` — imports `src/modules/workout/domain/value-objects/weight.vo.ts` (missing)
- `test/unit/units/unit-converter.spec.ts` — imports `src/shared/units/unit-converter.ts` (missing)

**Action:** Implement the source files to make these tests pass.

---

## Goal

Create the TypeORM entities, database migration, `Weight` value object, and `UnitConverter`. These are the foundation that all use-cases build on.

---

## Deliverables

### [ ] `src/modules/workout/domain/value-objects/weight.vo.ts`

Must satisfy existing `test/unit/domain/weight.vo.spec.ts`:

```typescript
import { fromKg, toKg } from '@src/shared/units/unit-converter';

export class Weight {
  constructor(
    readonly value: number,
    readonly unit: string,
  ) {
    if (value <= 0) throw new Error('INVALID_WEIGHT');
    // validate unit by trying the conversion (throws INVALID_UNIT if unknown)
    toKg(value, unit);
  }

  toKg(): number {
    return toKg(this.value, this.unit);
  }

  convertTo(targetUnit: string): number {
    return fromKg(this.toKg(), targetUnit);
  }
}
```

---

### [ ] `src/shared/units/unit-converter.ts`

Must satisfy existing `test/unit/units/unit-converter.spec.ts`:

```typescript
export const UNIT_TO_KG: Record<string, number> = {
  kg: 1,
  lb: 0.453592,
};

export function toKg(value: number, unit: string): number {
  const factor = UNIT_TO_KG[unit];
  if (factor === undefined) throw new Error('INVALID_UNIT');
  return Math.round(value * factor * 10000) / 10000;
}

export function fromKg(valueKg: number, targetUnit: string): number {
  const factor = UNIT_TO_KG[targetUnit];
  if (factor === undefined) throw new Error('INVALID_UNIT');
  return Math.round((valueKg / factor) * 10000) / 10000;
}
```

---

### [ ] `src/modules/workout/entities/workout-entry.entity.ts`

```typescript
import {
  Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn,
} from 'typeorm';
import { WorkoutSet } from './workout-set.entity';

@Entity('workout_entries')
export class WorkoutEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ name: 'exercise_name', type: 'varchar' })
  exerciseName: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => WorkoutSet, (set) => set.entry, { cascade: true, eager: false })
  sets: WorkoutSet[];
}
```

---

### [ ] `src/modules/workout/entities/workout-set.entity.ts`

```typescript
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { WorkoutEntry } from './workout-entry.entity';

@Entity('workout_sets')
export class WorkoutSet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => WorkoutEntry, (entry) => entry.sets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'entry_id' })
  entry: WorkoutEntry;

  @Column({ type: 'int' })
  reps: number;

  @Column({ type: 'numeric', precision: 10, scale: 4 })
  weight: number;

  @Column({ type: 'varchar', length: 10 })
  unit: string;

  @Column({ name: 'weight_kg', type: 'numeric', precision: 10, scale: 4 })
  weightKg: number;
}
```

---

### [ ] `src/modules/workout/entities/exercise-metadata.entity.ts`

```typescript
import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('exercise_metadata')
export class ExerciseMetadata {
  @PrimaryColumn({ type: 'varchar' })
  name: string;

  @Column({ name: 'muscle_group', type: 'varchar' })
  muscleGroup: string;

  @Column({ type: 'text', array: true, default: '{}' })
  aliases: string[];
}
```

---

### [ ] `src/database/migrations/<timestamp>-InitialSchema.ts`

Generate via: `pnpm migration:generate src/database/migrations/InitialSchema`

Migration must create:
1. `workout_entries` table
2. `workout_sets` table with FK to `workout_entries` (CASCADE DELETE)
3. `exercise_metadata` table
4. All 4 indexes from requirements:
   ```sql
   CREATE INDEX idx_entries_user_date     ON workout_entries(user_id, date DESC);
   CREATE INDEX idx_entries_user_exercise ON workout_entries(user_id, exercise_name, date DESC);
   CREATE INDEX idx_sets_entry            ON workout_sets(entry_id);
   CREATE INDEX idx_sets_weight_kg        ON workout_sets(weight_kg DESC);
   ```

---

### [ ] `src/database/seeds/exercise-metadata.seed.ts`

Seed a baseline set of exercises for `muscle-balance` insight:

```typescript
export const EXERCISE_SEED_DATA = [
  { name: 'Bench Press',         muscleGroup: 'push', aliases: ['bench'] },
  { name: 'Overhead Press',      muscleGroup: 'push', aliases: ['ohp', 'shoulder press'] },
  { name: 'Pull-Up',             muscleGroup: 'pull', aliases: ['pullup', 'chin-up'] },
  { name: 'Barbell Row',         muscleGroup: 'pull', aliases: ['row'] },
  { name: 'Deadlift',            muscleGroup: 'legs', aliases: ['dl'] },
  { name: 'Squat',               muscleGroup: 'legs', aliases: ['back squat'] },
  { name: 'Romanian Deadlift',   muscleGroup: 'legs', aliases: ['rdl'] },
  { name: 'Lat Pulldown',        muscleGroup: 'pull', aliases: [] },
  { name: 'Dumbbell Curl',       muscleGroup: 'pull', aliases: ['bicep curl'] },
  { name: 'Tricep Pushdown',     muscleGroup: 'push', aliases: ['tricep extension'] },
  { name: 'Leg Press',           muscleGroup: 'legs', aliases: [] },
  { name: 'Incline Bench Press', muscleGroup: 'push', aliases: ['incline bench'] },
];
```

Seed runs as part of migration or a separate seed script. Keep it simple — `INSERT ... ON CONFLICT DO NOTHING`.

---

### [ ] Register entities in `WorkoutModule`

```typescript
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkoutEntry } from './entities/workout-entry.entity';
import { WorkoutSet } from './entities/workout-set.entity';
import { ExerciseMetadata } from './entities/exercise-metadata.entity';

@Module({
  imports: [TypeOrmModule.forFeature([WorkoutEntry, WorkoutSet, ExerciseMetadata])],
})
export class WorkoutModule {}
```

---

## Acceptance Criteria

- [ ] `pnpm test -- --testPathPattern=weight.vo` → GREEN
- [ ] `pnpm test -- --testPathPattern=unit-converter` → GREEN
- [ ] `pnpm build` compiles with zero TS errors
- [ ] Migration creates all tables + indexes on a fresh DB
- [ ] `docker compose down -v && docker compose up` runs migrations automatically
