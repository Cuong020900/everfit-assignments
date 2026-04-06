# TASK-07 — UC-4: Progress Chart Data

## Metadata

| Field | Value |
|-------|-------|
| **Status** | `[ ]` Pending |
| **Estimated effort** | ~1.5 hours |
| **Blocks** | TASK-09 |
| **Blocked by** | TASK-03, TASK-04 |
| **Commit message** | `feat: implement GET /workouts/progress endpoint with daily/weekly/monthly grouping` |

---

## Goal

`GET /workouts/progress` — returns time-series data for a specific exercise for charting. Both weight trend and volume trend returned per period. Supports daily / weekly / monthly grouping.

---

## Endpoint Contract

```
GET /workouts/progress
  ?userId=uuid                  required
  &exerciseName=Bench Press     required
  &from=2024-01-01              optional (default: 30 days ago)
  &to=2024-01-31                optional (default: today)
  &groupBy=daily                optional (daily | weekly | monthly), default: daily
  &unit=kg                      optional, default: kg

→ 200 OK
{
  "exerciseName": "Bench Press",
  "groupBy": "weekly",
  "unit": "kg",
  "insufficientData": false,
  "data": [
    { "period": "2024-W02", "bestWeight": 110,  "volume": 3200 },
    { "period": "2024-W03", "bestWeight": 112.5, "volume": 3450 }
  ]
}
```

---

## Aggregation Rules

| `groupBy` | `bestWeight` | `volume` |
|-----------|-------------|---------|
| `daily` | `MAX(weight_kg)` per day | `SUM(weight_kg × reps)` per day |
| `weekly` | `AVG` of daily `MAX` values for that ISO week | `SUM(weight_kg × reps)` for that week |
| `monthly` | `AVG` of daily `MAX` values for that month | `SUM(weight_kg × reps)` for that month |

> **Why AVG for weekly/monthly bestWeight?** A single heavy day shouldn't dominate the weekly trend line — averaging daily bests gives a smoother, more meaningful progress curve.

---

## Period Key Formats

| `groupBy` | `period` format | Example |
|-----------|----------------|---------|
| `daily` | `YYYY-MM-DD` | `"2024-01-15"` |
| `weekly` | `YYYY-Www` | `"2024-W03"` |
| `monthly` | `YYYY-MM` | `"2024-01"` |

---

## TDD: Write unit tests FIRST

```bash
test/unit/use-cases/get-progress.use-case.spec.ts
test/unit/utils/date-period.util.spec.ts
```

---

## Deliverables

### [ ] `test/unit/utils/date-period.util.spec.ts`

```typescript
describe('DatePeriodUtil', () => {
  it('formats daily period as YYYY-MM-DD')
  it('formats weekly period as YYYY-Www (ISO week)')
  it('formats monthly period as YYYY-MM')
  it('ISO week 1 of 2024 is 2024-W01')
  it('last week of 2023 crossing year boundary formats correctly')
});
```

### [ ] `test/unit/use-cases/get-progress.use-case.spec.ts`

```typescript
describe('GetProgressUseCase', () => {
  it('returns both bestWeight and volume in every data point')

  it('daily: bestWeight = MAX(weight_kg) per day', async () => {
    // fixture: Jan 15 → sets 100kg, 110kg, 90kg
    // expected: { period: '2024-01-15', bestWeight: 110, volume: 300 }
  });

  it('weekly: bestWeight = AVG of daily bests', async () => {
    // fixture: Mon=100, Tue=110, Wed=90 → daily bests avg = 100
    // NOT just MAX(110) — must be AVG
  });

  it('monthly: bestWeight = AVG of daily bests for month')

  it('volume = SUM(weight_kg * reps) per period (all sets, not just best)')

  it('returns insufficientData: true when < 2 data points')
  it('returns insufficientData: true when data is empty')
  it('returns insufficientData: false when >= 2 data points')

  it('defaults from to 30 days ago when not provided')
  it('defaults to to today when not provided')

  it('period key is YYYY-Www for weekly groupBy')
  it('period key is YYYY-MM for monthly groupBy')

  it('throws MISSING_EXERCISE_NAME when exerciseName is empty')
  it('throws INVALID_DATE_RANGE when from > to')

  it('converts bestWeight to lb when unit=lb requested')
});
```

---

### [ ] `src/common/utils/date-period.util.ts`

```typescript
import * as dayjs from 'dayjs';
import * as isoWeek from 'dayjs/plugin/isoWeek';
dayjs.extend(isoWeek);

export function formatPeriod(date: string | Date, groupBy: 'daily' | 'weekly' | 'monthly'): string {
  const d = dayjs(date);
  switch (groupBy) {
    case 'daily':   return d.format('YYYY-MM-DD');
    case 'weekly':  return `${d.isoWeekYear()}-W${String(d.isoWeek()).padStart(2, '0')}`;
    case 'monthly': return d.format('YYYY-MM');
  }
}

export function defaultFrom(): string {
  return dayjs().subtract(30, 'day').format('YYYY-MM-DD');
}

export function defaultTo(): string {
  return dayjs().format('YYYY-MM-DD');
}
```

---

### [ ] `src/modules/workout/dto/get-progress.dto.ts`

```typescript
export class GetProgressDto {
  @IsUUID()                                               userId: string;
  @IsString() @IsNotEmpty()                               exerciseName: string;
  @IsOptional() @IsDateString()                           from?: string;
  @IsOptional() @IsDateString()                           to?: string;
  @IsOptional() @IsEnum(['daily', 'weekly', 'monthly'])   groupBy: 'daily' | 'weekly' | 'monthly' = 'daily';
  @IsOptional() @IsEnum(['kg', 'lb'])                     unit: 'kg' | 'lb' = 'kg';
}
```

---

### [ ] `src/modules/workout/use-cases/get-progress.use-case.ts`

Key logic:
1. Validate `exerciseName` is present; throw `MISSING_EXERCISE_NAME`
2. Validate `from ≤ to`; throw `INVALID_DATE_RANGE`
3. Default `from` to 30 days ago, `to` to today if omitted
4. Call `repo.findProgressSeries({ userId, exerciseName, from, to, groupBy })`
5. Convert `bestWeightKg` to requested `unit`
6. Set `insufficientData: data.length < 2`

---

### [ ] Controller — GET /workouts/progress handler

```typescript
// Declare before @Get(':id')
@Get('progress')
@ApiOperation({ summary: 'Get progress chart data for an exercise' })
async getProgress(@Query() dto: GetProgressDto) {
  return this.getProgressUseCase.execute(dto);
}
```

---

### [ ] `test/integration/get-progress.spec.ts`

```typescript
describe('GET /workouts/progress', () => {
  it('200 — daily grouping returns YYYY-MM-DD period keys')
  it('200 — weekly grouping returns YYYY-Www period keys')
  it('200 — weekly bestWeight is AVG of daily bests, not raw MAX')
  it('200 — monthly grouping returns YYYY-MM period keys')
  it('200 — volume includes all sets in period, not just best')
  it('200 — insufficientData:true for single data point')
  it('200 — insufficientData:true for no data')
  it('200 — unit=lb converts bestWeight in response')
  it('400 MISSING_EXERCISE_NAME — exerciseName omitted')
  it('400 INVALID_DATE_RANGE — from after to')
  it('400 INVALID_GROUP_BY — unknown groupBy value')
});
```

---

## Acceptance Criteria

- [ ] `pnpm test:unit -- --testPathPattern=get-progress` → GREEN
- [ ] `pnpm test:unit -- --testPathPattern=date-period` → GREEN
- [ ] `pnpm test:integration -- --testPathPattern=get-progress` → GREEN
- [ ] Weekly `bestWeight` is average of daily bests (not just `MAX` across the week)
- [ ] `volume` is sum of all sets in period (not filtered to best set)
- [ ] Missing `exerciseName` → 400 `MISSING_EXERCISE_NAME`
- [ ] Route `/workouts/progress` does not conflict with `/workouts/:id`
