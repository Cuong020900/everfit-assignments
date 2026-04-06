# TASK-07 — UC-4: Progress Chart Data

## Metadata

| Field | Value |
|-------|-------|
| **Status** | `[ ]` Pending |
| **Estimated effort** | ~1.5 hours |
| **Blocks** | TASK-09 |
| **Blocked by** | TASK-03, TASK-04 |
| **Commit message** | `feat: implement GET /workouts/progress time-series chart endpoint` |

---

## Goal

`GET /workouts/progress?userId={uuid}&exerciseName={name}` — returns time-series data for a specific exercise. Used for rendering progress charts. Supports daily/weekly/monthly grouping.

---

## Endpoint Contract

```
GET /workouts/progress
  ?userId=uuid                        required
  &exerciseName=Bench Press           required
  &from=2024-01-01                    optional, default 30 days ago
  &to=2024-01-31                      optional, default today
  &groupBy=daily|weekly|monthly       optional, default daily
  &unit=kg|lb                         optional, default kg

→ 200 OK
{
  "exerciseName": "Bench Press",
  "groupBy": "weekly",
  "unit": "kg",
  "data": [
    { "period": "2024-W02", "bestWeight": 110,   "volume": 3200 },
    { "period": "2024-W03", "bestWeight": 112.5, "volume": 3450 },
    { "period": "2024-W04", "bestWeight": 115,   "volume": 3600 }
  ],
  "insufficientData": false
}
```

---

## Aggregation Rules

| `groupBy` | `bestWeight` | `volume` |
|-----------|-------------|----------|
| `daily`   | `MAX(weight_kg)` per day | `SUM(weight_kg × reps)` per day |
| `weekly`  | `AVG` of daily `MAX(weight_kg)` values for that ISO week | `SUM(weight_kg × reps)` for whole week |
| `monthly` | `AVG` of daily `MAX(weight_kg)` values for that calendar month | `SUM(weight_kg × reps)` for whole month |

**Period format:**
- Daily: `"YYYY-MM-DD"` (ISO date)
- Weekly: `"YYYY-WNN"` (ISO week, e.g. `"2024-W03"`)
- Monthly: `"YYYY-MM"` (e.g. `"2024-01"`)

---

## TDD: Write unit tests FIRST

File: `test/unit/use-cases/get-progress.use-case.spec.ts`

---

## Deliverables

### [ ] `test/unit/use-cases/get-progress.use-case.spec.ts`

```typescript
describe('GetProgressUseCase', () => {
  it('throws MISSING_EXERCISE_NAME when exerciseName not provided')
  it('throws INVALID_DATE_RANGE when from is after to')
  it('throws INVALID_GROUP_BY for unknown groupBy value')
  it('defaults from to 30 days ago when not provided')
  it('defaults to to today when not provided')
  it('returns insufficientData: true when fewer than 2 data points')
  it('returns insufficientData: true with data: [] when no data')
  it('converts bestWeight to lb when unit=lb')
  it('converts volume to lb-based when unit=lb')  // volume = SUM(weightKg * reps), unit conversion applied
  it('returns insufficientData: false when 2+ data points')
  it('passes correct groupBy to repository')
});
```

---

### [ ] `src/modules/workout/dto/get-progress.dto.ts`

```typescript
export class GetProgressDto {
  @IsUUID()
  userId: string;

  @IsString() @IsNotEmpty()
  exerciseName: string;

  @IsOptional() @IsDateString()
  from?: string;

  @IsOptional() @IsDateString()
  to?: string;

  @IsOptional() @IsEnum(['daily', 'weekly', 'monthly'])
  groupBy: 'daily' | 'weekly' | 'monthly' = 'daily';

  @IsOptional() @IsEnum(['kg', 'lb'])
  unit: 'kg' | 'lb' = 'kg';
}
```

---

### [ ] `src/modules/workout/use-cases/get-progress.use-case.ts`

```typescript
async execute(dto: GetProgressDto) {
  if (!dto.exerciseName?.trim()) throw new Error('MISSING_EXERCISE_NAME');

  // Defaults
  const to = dto.to ?? new Date().toISOString().slice(0, 10);
  const from = dto.from ?? (() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  })();

  if (from > to) throw new Error('INVALID_DATE_RANGE');

  const valid = ['daily', 'weekly', 'monthly'];
  if (!valid.includes(dto.groupBy)) throw new Error('INVALID_GROUP_BY');

  const series = await this.repo.findProgressSeries({
    userId: dto.userId,
    exerciseName: dto.exerciseName,
    from,
    to,
    groupBy: dto.groupBy,
  });

  if (series.length === 0) {
    return { exerciseName: dto.exerciseName, groupBy: dto.groupBy, unit: dto.unit,
             data: [], insufficientData: true };
  }

  const data = series.map((p) => ({
    period: p.period,
    bestWeight: fromKg(p.bestWeightKg, dto.unit),
    volume: fromKg(p.volumeKg, dto.unit),
  }));

  return {
    exerciseName: dto.exerciseName,
    groupBy: dto.groupBy,
    unit: dto.unit,
    data,
    insufficientData: data.length < 2,
  };
}
```

> **Unit note on volume:** `volumeKg` is `SUM(weight_kg × reps)` stored in kg. When `unit=lb`, convert via `fromKg(volumeKg, 'lb')`. This matches the spec intent — volume expressed in the requested unit.

---

### [ ] Repository: `findProgressSeries()` — weekly SQL pattern

Weekly aggregation is the most complex. Two-layer approach:

```sql
-- Step 1: Daily bests per exercise
WITH daily_bests AS (
  SELECT
    we.date,
    MAX(ws.weight_kg)             AS daily_best_kg,
    SUM(ws.weight_kg * ws.reps)   AS daily_volume_kg
  FROM workout_entries we
  JOIN workout_sets ws ON ws.entry_id = we.id
  WHERE we.user_id = $1
    AND we.exercise_name = $2
    AND we.date BETWEEN $3 AND $4
  GROUP BY we.date
)
-- Step 2: Aggregate to week/month
SELECT
  TO_CHAR(DATE_TRUNC('week', date), 'IYYY-"W"IW')  AS period,
  AVG(daily_best_kg)                                 AS best_weight_kg,
  SUM(daily_volume_kg)                               AS volume_kg
FROM daily_bests
GROUP BY DATE_TRUNC('week', date)
ORDER BY DATE_TRUNC('week', date) ASC;
```

For `daily` groupBy, step 2 is just the `daily_bests` CTE result directly. For `monthly`, replace `DATE_TRUNC('week', ...)` with `DATE_TRUNC('month', ...)` and `TO_CHAR(..., 'YYYY-MM')`.

---

### [ ] Controller handler — `GET /workouts/progress`

```typescript
@Get('progress')
@ApiOperation({ summary: 'Get time-series progress chart data for an exercise' })
async getProgress(@Query() dto: GetProgressDto) {
  return this.getProgressUseCase.execute(dto);
}
```

**Must be declared BEFORE `@Get()` in the controller.**

---

### [ ] `test/integration/get-progress.spec.ts`

```typescript
describe('GET /workouts/progress', () => {
  it('200 — returns daily data points in ascending order')
  it('200 — groupBy=weekly uses AVG of daily bests, not raw MAX')
  it('200 — groupBy=monthly produces correct period format YYYY-MM')
  it('200 — insufficientData: true when only 1 data point')
  it('200 — insufficientData: true with data: [] when no data')
  it('200 — unit=lb converts bestWeight and volume')
  it('200 — defaults from to 30 days ago and to to today when omitted')
  it('400 MISSING_EXERCISE_NAME — exerciseName omitted')
  it('400 INVALID_DATE_RANGE — from after to')
  it('400 INVALID_GROUP_BY — groupBy: "hourly"')
  it('400 INVALID_USER_ID — missing userId')
});
```

---

## Acceptance Criteria

- [ ] `pnpm test -- --testPathPattern=get-progress` → GREEN
- [ ] `pnpm test:integration -- --testPathPattern=get-progress` → GREEN
- [ ] Weekly `bestWeight` = AVG of daily bests (not raw MAX of all sets in week)
- [ ] `period` format: `"YYYY-MM-DD"` daily, `"YYYY-WNN"` weekly, `"YYYY-MM"` monthly
- [ ] `insufficientData: true` when < 2 data points; `false` when 2+
- [ ] Default date range is last 30 days → today when `from`/`to` omitted
