# TASK-05 — UC-2: Get Workout History

## Metadata

| Field | Value |
|-------|-------|
| **Status** | `[ ]` Pending |
| **Estimated effort** | ~1.5 hours |
| **Blocks** | TASK-09 |
| **Blocked by** | TASK-03, TASK-04 |
| **Commit message** | `feat: implement GET /workouts history endpoint with cursor pagination` |

---

## Goal

`GET /workouts?userId={uuid}` — paginated reverse-chronological workout history. Supports cursor pagination, filtering by exercise name (partial ILIKE), date range, muscle group, and unit conversion.

---

## Endpoint Contract

```
GET /workouts
  ?userId=uuid               required
  &limit=20                  default 20, max 100
  &cursor=<opaque>           optional, from previous response
  &exerciseName=bench        optional, partial case-insensitive match
  &from=2024-01-01           optional
  &to=2024-01-31             optional
  &muscleGroup=push          optional (requires exercise_metadata lookup)
  &unit=kg                   optional, default kg

→ 200 OK
{
  "data": [
    {
      "id": "uuid",
      "date": "2024-01-15",
      "exerciseName": "Bench Press",
      "muscleGroup": "push",        // null if not in exercise_metadata
      "sets": [
        { "id": "uuid", "reps": 10, "weight": 220.46, "unit": "lb", "weightKg": 100 }
      ],
      "createdAt": "2024-01-15T01:00:00.000Z"
    }
  ],
  "pagination": {
    "nextCursor": "opaque-cursor-string-or-null",
    "hasMore": true,
    "limit": 20
  }
}
```

---

## TDD: Write unit tests FIRST

File: `test/unit/use-cases/get-history.use-case.spec.ts`

---

## Deliverables

### [ ] `src/common/utils/cursor.util.ts`

```typescript
interface CursorPayload { date: string; id: string; }

export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

export function decodeCursor(cursor: string): CursorPayload | null {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as CursorPayload;
  } catch {
    return null;  // invalid cursor → treat as start from beginning
  }
}
```

---

### [ ] `test/unit/utils/cursor.util.spec.ts`

```typescript
describe('cursor util', () => {
  it('encode → decode round-trips correctly')
  it('decodeCursor returns null for invalid base64')
  it('decodeCursor returns null for valid base64 but invalid JSON')
  it('encoded string contains no + or / characters (url-safe)')
});
```

---

### [ ] `test/unit/use-cases/get-history.use-case.spec.ts`

```typescript
describe('GetHistoryUseCase', () => {
  it('passes limit and userId to repository')
  it('returns hasMore: false when repo returns <= limit entries')
  it('returns hasMore: true when repo returns limit+1 entries')
  it('builds nextCursor from last entry when hasMore is true')
  it('decodes cursor and passes it to repository')
  it('converts weights to lb when unit=lb requested')
  it('defaults limit to 20 when not provided')
  it('throws LIMIT_EXCEEDED when limit > 100')
  it('throws INVALID_LIMIT when limit < 1')
  it('passes exerciseName filter to repository')
  it('passes muscleGroup filter to repository')
  it('passes from/to date range to repository')
  it('muscleGroup is null when not in exercise_metadata (repo returns null)')
  it('returns empty data array with hasMore: false when no entries')
});
```

---

### [ ] `src/modules/workout/dto/get-history.dto.ts`

```typescript
export class GetHistoryDto {
  @IsUUID()
  userId: string;

  @IsOptional() @IsInt() @Min(1) @Max(100) @Type(() => Number)
  limit = 20;

  @IsOptional() @IsString()
  cursor?: string;

  @IsOptional() @IsString()
  exerciseName?: string;

  @IsOptional() @IsDateString()
  from?: string;

  @IsOptional() @IsDateString()
  to?: string;

  @IsOptional() @IsString()
  muscleGroup?: string;

  @IsOptional() @IsEnum(['kg', 'lb'])
  unit: 'kg' | 'lb' = 'kg';
}
```

> `@Max(100)` from class-validator will produce a message containing "must not be greater than 100" — the `GlobalExceptionFilter` maps this to `LIMIT_EXCEEDED`. `@Min(1)` maps to `INVALID_LIMIT`.

---

### [ ] `src/modules/workout/use-cases/get-history.use-case.ts`

Key logic:
1. Validate `limit` range (use-case guard or DTO validation — DTO preferred)
2. Decode cursor if present via `decodeCursor()`
3. Call `repo.findHistory()` with all filters
4. For each entry: convert `weightKg` to requested `unit` via `fromKg()`
5. Attach `muscleGroup` from repository result (nullable)
6. Build `nextCursor` from last entry's `{ date, id }` if `hasMore`

```typescript
// Response weight conversion:
const weight = fromKg(set.weightKg, unit);
// The response set becomes: { id, reps, weight, unit, weightKg: set.weightKg }
```

---

### [ ] Controller handler — `GET /workouts`

```typescript
@Get()
@ApiOperation({ summary: 'Get paginated workout history' })
async getHistory(@Query() dto: GetHistoryDto) {
  return this.getHistoryUseCase.execute(dto);
}
```

**Critical:** This `@Get()` handler must be declared AFTER `@Get('pr')`, `@Get('progress')`, and `@Get('insights')` in the controller class. NestJS routes are matched top-to-bottom.

---

### [ ] `test/integration/get-history.spec.ts`

```typescript
describe('GET /workouts', () => {
  it('200 — returns entries in reverse-chronological order')
  it('200 — default limit is 20')
  it('200 — cursor from page 1 fetches page 2 correctly (non-overlapping)')
  it('200 — limit=100 is accepted')
  it('400 LIMIT_EXCEEDED — limit=101')
  it('200 — exerciseName partial match is case-insensitive ("bench" matches "Bench Press")')
  it('200 — muscleGroup filter returns only matching exercises')
  it('200 — from/to date range filters correctly')
  it('200 — unit=lb converts all weights in response sets')
  it('200 — empty result returns { data: [], hasMore: false, nextCursor: null }')
  it('400 INVALID_USER_ID — missing userId')
  it('400 INVALID_USER_ID — userId: "not-a-uuid"')
  it('400 INVALID_DATE — from: "bad-date"')
});
```

---

## Acceptance Criteria

- [ ] `pnpm test -- --testPathPattern=get-history` → GREEN
- [ ] `pnpm test:integration -- --testPathPattern=get-history` → GREEN
- [ ] Cursor is base64url-encoded JSON `{ date, id }`
- [ ] Fetching page 2 with cursor returns non-overlapping entries
- [ ] `exerciseName=bench` matches `"Bench Press"` (case-insensitive ILIKE)
- [ ] `limit=100` → 200; `limit=101` → 400 `LIMIT_EXCEEDED`
- [ ] `unit=lb` converts `weightKg` to lb in response sets
- [ ] `muscleGroup` is `null` when exercise is not in `exercise_metadata`
