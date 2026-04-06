# TASK-09 — Global Error Handling & Validation Polish

## Metadata

| Field | Value |
|-------|-------|
| **Status** | `[ ]` Pending |
| **Estimated effort** | ~30 minutes |
| **Blocks** | TASK-10 |
| **Blocked by** | TASK-05, TASK-06, TASK-07, TASK-08 |
| **Commit message** | `fix: standardize all error responses to { statusCode, error, message }` |

---

## Goal

Ensure every error response from every endpoint matches the exact shape defined in requirements. Map class-validator errors and use-case exceptions to typed error codes. Verify all 20+ error cases from `requirements.md §7` are covered by tests.

---

## Required Error Shape

```json
{
  "statusCode": 400,
  "error": "ERROR_CODE",
  "message": "Human-readable description"
}
```

No nested `errors[]` array, no `validationErrors`, no NestJS default shape.

---

## Deliverables

### [ ] `src/common/filters/http-exception.filter.ts`

```typescript
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx  = host.switchToHttp();
    const res  = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body   = exception.getResponse() as any;

      // class-validator produces { message: string[], error: string, statusCode: number }
      // map to our shape
      const errorCode = this.extractErrorCode(body);
      const message   = Array.isArray(body.message) ? body.message[0] : (body.message ?? 'Bad Request');

      return res.status(status).json({ statusCode: status, error: errorCode, message });
    }

    // Domain errors thrown as plain Error('ERROR_CODE')
    if (exception instanceof Error) {
      const code = exception.message;
      if (KNOWN_ERROR_CODES.has(code)) {
        return res.status(400).json({ statusCode: 400, error: code, message: ERROR_MESSAGES[code] });
      }
    }

    // Unknown — 500
    res.status(500).json({ statusCode: 500, error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' });
  }

  private extractErrorCode(body: any): string {
    // Map common class-validator messages to our codes
    if (typeof body?.message === 'string' && body.message.includes('must not be greater than 100')) {
      return 'LIMIT_EXCEEDED';
    }
    return body?.error ?? 'VALIDATION_ERROR';
  }
}
```

---

### [ ] `src/common/constants/error-codes.ts`

```typescript
export const KNOWN_ERROR_CODES = new Set([
  'EMPTY_ENTRIES',
  'EMPTY_SETS',
  'INVALID_REPS',
  'INVALID_WEIGHT',
  'INVALID_UNIT',
  'INVALID_DATE',
  'INVALID_DATE_RANGE',
  'INVALID_EXERCISE_NAME',
  'INVALID_USER_ID',
  'LIMIT_EXCEEDED',
  'INVALID_LIMIT',
  'MISSING_EXERCISE_NAME',
  'INVALID_GROUP_BY',
  'INVALID_METRIC',
]);

export const ERROR_MESSAGES: Record<string, string> = {
  EMPTY_ENTRIES:          'The entries array must contain at least one item',
  EMPTY_SETS:             'Each entry must contain at least one set',
  INVALID_REPS:           'Reps must be a positive integer',
  INVALID_WEIGHT:         'Weight must be a positive number',
  INVALID_UNIT:           'Unit must be "kg" or "lb"',
  INVALID_DATE:           'Date must be a valid YYYY-MM-DD string',
  INVALID_DATE_RANGE:     '"from" must be before or equal to "to"',
  INVALID_EXERCISE_NAME:  'Exercise name must not be empty',
  INVALID_USER_ID:        'userId must be a valid UUID',
  LIMIT_EXCEEDED:         'Limit must not exceed 100',
  INVALID_LIMIT:          'Limit must be a positive integer',
  MISSING_EXERCISE_NAME:  'exerciseName is required for this endpoint',
  INVALID_GROUP_BY:       'groupBy must be "daily", "weekly", or "monthly"',
  INVALID_METRIC:         'metric must be "maxWeight", "totalVolume", or "estimatedOneRM"',
};
```

---

### [ ] Register filter globally in `main.ts`

```typescript
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
app.useGlobalFilters(new GlobalExceptionFilter());
```

---

### [ ] Error coverage checklist (verify each has an integration test)

| Error Code | Endpoint | Test exists |
|------------|----------|-------------|
| `EMPTY_ENTRIES` | POST /workouts | TASK-04 |
| `EMPTY_SETS` | POST /workouts | TASK-04 |
| `INVALID_REPS` | POST /workouts | TASK-04 |
| `INVALID_WEIGHT` | POST /workouts | TASK-04 |
| `INVALID_UNIT` | POST /workouts, GET /workouts, GET /workouts/pr, GET /workouts/progress | TASK-04,05,06,07 |
| `INVALID_DATE` | POST /workouts, GET /workouts, GET /workouts/pr, GET /workouts/progress, GET /workouts/insights | All tasks |
| `INVALID_DATE_RANGE` | GET /workouts/pr, GET /workouts/progress, GET /workouts/insights | TASK-06,07,08 |
| `INVALID_USER_ID` | All endpoints | All tasks |
| `LIMIT_EXCEEDED` | GET /workouts | TASK-05 |
| `MISSING_EXERCISE_NAME` | GET /workouts/progress | TASK-07 |

---

### [ ] `test/integration/error-handling.spec.ts`

Cross-endpoint error shape verification:

```typescript
describe('Global Error Handling', () => {
  it('all 400 errors return { statusCode, error, message } shape')
  it('unknown route returns 404 — not 500')
  it('500 from unexpected error returns { statusCode: 500, error: "INTERNAL_ERROR" }')
  it('class-validator array message is unwrapped to single string')
});
```

---

## Acceptance Criteria

- [ ] Every error response matches `{ statusCode, error, message }` — no exceptions
- [ ] `POST /workouts` with empty entries → `{ error: "EMPTY_ENTRIES" }`
- [ ] `GET /workouts?limit=101` → `{ error: "LIMIT_EXCEEDED" }`
- [ ] `GET /workouts/progress` without `exerciseName` → `{ error: "MISSING_EXERCISE_NAME" }`
- [ ] Unhandled exceptions → `{ statusCode: 500, error: "INTERNAL_ERROR" }` (not stack trace)
- [ ] All 14 error codes in the table above have at least one integration test
