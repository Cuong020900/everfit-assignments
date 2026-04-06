# TASK-09 — Global Error Handling & Validation Polish

## Metadata

| Field | Value |
|-------|-------|
| **Status** | `[ ]` Pending |
| **Estimated effort** | ~30 minutes |
| **Blocks** | TASK-10 |
| **Blocked by** | TASK-04, TASK-05, TASK-06, TASK-07, TASK-08 |
| **Commit message** | `fix: polish global error handling and validation edge cases` |

---

## Goal

After all 5 use-cases are working, do a cross-cutting pass to ensure:
1. Every error code in the spec produces the exact response shape
2. Class-validator errors are mapped to domain error codes (not raw messages)
3. No 500s for any expected bad-input scenario

---

## Current State of `GlobalExceptionFilter`

The filter already exists at `src/common/filters/http-exception.filter.ts`. It handles:
- Known domain errors (thrown as `new Error('ERROR_CODE')`) → 400 with error code
- `HttpException` from NestJS (class-validator, pipes) → extract from body
- Unknown exceptions → 500 `INTERNAL_SERVER_ERROR`

---

## Review Checklist

### [ ] Verify all error codes are in `KNOWN_ERROR_CODES` set

Current set in `src/common/constants/error-codes.ts`:
```
EMPTY_ENTRIES, EMPTY_SETS, INVALID_REPS, INVALID_WEIGHT, INVALID_UNIT,
INVALID_DATE, INVALID_DATE_RANGE, INVALID_EXERCISE_NAME, INVALID_USER_ID,
LIMIT_EXCEEDED, INVALID_LIMIT, MISSING_EXERCISE_NAME, INVALID_GROUP_BY, INVALID_METRIC
```

`INVALID_METRIC` is in the set but not in the spec — **remove it** unless a use-case throws it.

---

### [ ] Verify class-validator → error code mapping

| Validation scenario | class-validator message | Expected error code |
|---------------------|------------------------|---------------------|
| `userId` not UUID | "userId must be a UUID" | `INVALID_USER_ID` |
| `limit > 100` | "must not be greater than 100" | `LIMIT_EXCEEDED` |
| `limit < 1` | "must not be less than 1" | `INVALID_LIMIT` |
| `date` invalid format | "date must be..." | `INVALID_DATE` |
| `unit` bad value | "unit must be..." | `INVALID_UNIT` |
| `groupBy` bad value | "groupBy must be..." | `INVALID_GROUP_BY` |

The `GlobalExceptionFilter.extractErrorCode()` must handle these. Current implementation checks for `"must not be greater than 100"` → `LIMIT_EXCEEDED`. Extend to cover the remaining cases:

```typescript
function extractErrorCode(body: HttpExceptionBody): string {
  const messages: string[] = Array.isArray(body.message)
    ? body.message
    : body.message !== undefined ? [body.message] : [];

  // Order matters — more specific first
  if (messages.some((m) => m.includes('must not be greater than 100'))) return 'LIMIT_EXCEEDED';
  if (messages.some((m) => m.includes('must not be less than 1')))       return 'INVALID_LIMIT';
  if (messages.some((m) => /userId.*UUID|must be a uuid/i.test(m)))      return 'INVALID_USER_ID';
  if (messages.some((m) => /date.*must be/i.test(m) || /IsDateString/i.test(m))) return 'INVALID_DATE';
  if (messages.some((m) => /unit must be/i.test(m)))                     return 'INVALID_UNIT';
  if (messages.some((m) => /groupBy must be/i.test(m)))                  return 'INVALID_GROUP_BY';
  if (messages.some((m) => /exerciseName must be/i.test(m)))             return 'MISSING_EXERCISE_NAME';

  return body.error ?? 'VALIDATION_ERROR';
}
```

> **Caution:** Regex-based message matching is brittle. Test each case in integration tests. The mapping only needs to be "good enough" for the spec's error codes — not exhaustive.

---

### [ ] Verify `INVALID_USER_ID` for missing `userId`

When `userId` query param is omitted entirely, class-validator should catch it because `@IsUUID()` is required (no `@IsOptional()`). Confirm the 400 response has `error: 'INVALID_USER_ID'`.

---

### [ ] Ensure 500 is never returned for spec-defined bad inputs

Run through every error case in the spec:
- `EMPTY_ENTRIES`, `EMPTY_SETS`, `INVALID_REPS`, `INVALID_WEIGHT`, `INVALID_UNIT` → thrown by use-case → filter catches → 400
- `INVALID_DATE` → class-validator → filter catches → 400
- `INVALID_USER_ID` → class-validator → filter catches → 400
- `LIMIT_EXCEEDED`, `INVALID_LIMIT` → class-validator `@Max`/`@Min` → filter catches → 400
- `INVALID_DATE_RANGE`, `MISSING_EXERCISE_NAME`, `INVALID_GROUP_BY` → use-case guard → filter catches → 400

---

### [ ] Add integration tests for error mapping

File: `test/integration/error-handling.spec.ts` (or add cases to each endpoint spec)

Spot-check the critical ones:
```typescript
describe('Error shape contract', () => {
  it('all errors return { statusCode, error, message }')
  it('INVALID_USER_ID when userId is not a UUID')
  it('INVALID_USER_ID when userId is missing')
  it('LIMIT_EXCEEDED when limit=101')
  it('INVALID_DATE when from=bad-date')
  it('INVALID_UNIT when unit=stone')
});
```

---

### [ ] Response shape validation

Every error response must be exactly:
```json
{ "statusCode": 400, "error": "ERROR_CODE", "message": "Human-readable description" }
```

Verify `ERROR_MESSAGES` map in `error-codes.ts` has entries for every code in `KNOWN_ERROR_CODES`.

---

## Acceptance Criteria

- [ ] Every spec-defined error code produces the correct `{ statusCode, error, message }` shape
- [ ] No 500 responses for any bad-input scenario defined in the spec
- [ ] `INVALID_METRIC` removed from `KNOWN_ERROR_CODES` if no use-case throws it
- [ ] `ERROR_MESSAGES` map is complete for all codes in `KNOWN_ERROR_CODES`
