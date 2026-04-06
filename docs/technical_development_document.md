# Technical Development Document

> Project: Everfit Workout Logging API
> Date: 2026-04-06
> Status: Pre-implementation reference — detail lives in the plan step

---

## 0. Project Bootstrap

### Prerequisites

```bash
node --version   # ≥ 20 LTS
pnpm --version   # ≥ 9
nest --version   # NestJS CLI already installed globally
```

### Scaffold the project

```bash
# Create project — select pnpm when prompted, or pass --package-manager
nest new everfit-workout-api --package-manager pnpm --strict

cd everfit-workout-api
```

### Install all dependencies up front

```bash
# Core
pnpm add @nestjs/typeorm typeorm pg
pnpm add @nestjs/config js-yaml
pnpm add @nestjs/swagger
pnpm add nestjs-pino pino-http pino-pretty
pnpm add helmet
pnpm add class-validator class-transformer
pnpm add joi

# Dev / types
pnpm add -D @types/js-yaml
pnpm add -D @types/supertest supertest
```

### Generate the three domain modules via CLI

```bash
nest generate module modules/workout-entry
nest generate controller modules/workout-entry --no-spec
nest generate service modules/workout-entry --no-spec

nest generate module modules/workout-set
nest generate controller modules/workout-set --no-spec
nest generate service modules/workout-set --no-spec

nest generate module modules/exercise-metadata
nest generate controller modules/exercise-metadata --no-spec
nest generate service modules/exercise-metadata --no-spec
```

---

## 1. Technology Stack

| Layer           | Choice                              | Version target | Reason                                                            |
| --------------- | ----------------------------------- | -------------- | ----------------------------------------------------------------- |
| Runtime         | Node.js                             | ≥ 20 LTS       | LTS stability; native `crypto.randomUUID()`                       |
| Framework       | NestJS                              | v11            | DI, modular architecture, official TypeORM + Swagger integrations |
| Language        | TypeScript                          | ≥ 5.x          | Strict mode; decorators for class-validator                       |
| Database        | **PostgreSQL**                      | 16             | See §2                                                            |
| ORM             | TypeORM                             | v0.3.x         | Native NestJS integration; migration support                      |
| Validation      | class-validator + class-transformer | latest         | Standard NestJS pipeline                                          |
| Logger          | nestjs-pino                         | latest         | Structured JSON logs; request context auto-injection              |
| API Docs        | @nestjs/swagger                     | latest         | OpenAPI 3.1 auto-generation from decorators                       |
| Security        | helmet + @nestjs/cors               | latest         | HTTP hardening headers + CORS control                             |
| Container       | Docker + Docker Compose             | v2             | Required by assignment                                            |
| Testing         | Jest + Supertest                    | built-in       | Unit + integration tests; **TDD workflow**                        |
| Package manager | **pnpm**                            | ≥ 9            | Faster installs, strict hoisting, disk-efficient                  |

---

## 2. Database Choice: PostgreSQL ✅

### Why PostgreSQL over MongoDB

| Criterion                                  | PostgreSQL                                     | MongoDB                                  |
| ------------------------------------------ | ---------------------------------------------- | ---------------------------------------- |
| Complex aggregations (PR, chart, insights) | Native `GROUP BY`, window functions, `MAX()`   | Requires `$group` pipeline — verbose     |
| Schema integrity (reps > 0, weight > 0)    | `CHECK` constraints enforced at DB level       | Application-only enforcement             |
| Cursor pagination                          | Stable with `(created_at, id)` composite       | Requires ObjectId sort; less predictable |
| 50k+ entries per user                      | Partial indexes + composite indexes scale well | Sharding needed much earlier             |
| JOIN across workout_entries + workout_sets | Standard SQL join                              | `$lookup` — heavy on large collections   |
| TypeORM support                            | First-class, migrations included               | Partial — less mature migrations         |

**Verdict:** PostgreSQL is the correct choice for an analytics-heavy workout API with structured relational data.

---

## 3. Project Structure

```
src/
├── main.ts                              # Bootstrap: Swagger, Helmet, CORS, Pino, pipes
├── app.module.ts                        # Root module (imports Modules list)
├── modules.ts                           # Aggregates all feature modules + infra modules
├── config/
│   └── config.module.ts                 # ConfigModule.forRoot with Joi validation
├── model/
│   ├── entities/                        # TypeORM @Entity classes (centralized)
│   │   ├── base.entity.ts               # Abstract: createdAt, updatedAt
│   │   ├── workout-entry.entity.ts      # user_id, date, exercise_name, sets[]
│   │   ├── workout-set.entity.ts        # reps, weight, unit, weight_kg
│   │   └── exercise-metadata.entity.ts  # name (PK), muscle_group, aliases[]
│   └── database-common.ts               # TypeOrmModule.forFeature([all entities])
├── modules/
│   ├── workout-entry/                   # WorkoutEntry + WorkoutSet (cascaded)
│   │   ├── workout-entry.module.ts
│   │   ├── workout-entry.controller.ts  # POST /workouts, GET /workouts
│   │   ├── workout-entry.service.ts
│   │   └── dto/
│   │       ├── log-workout.dto.ts       # LogWorkoutDTO, WorkoutEntryDTO, WorkoutSetDTO, LogWorkoutQueryDTO
│   │       └── get-history.dto.ts       # GetHistoryDTO
│   ├── workout-set/                     # WorkoutSet analytics
│   │   ├── workout-set.module.ts
│   │   ├── workout-set.controller.ts    # GET /workouts/pr, GET /workouts/progress
│   │   ├── workout-set.service.ts
│   │   └── dto/
│   │       ├── get-pr.dto.ts            # GetPRDTO
│   │       └── get-progress.dto.ts      # GetProgressDTO
│   └── exercise-metadata/               # ExerciseMetadata + insights
│       ├── exercise-metadata.module.ts
│       ├── exercise-metadata.controller.ts  # GET /workouts/insights
│       ├── exercise-metadata.service.ts
│       └── dto/
│           └── get-insights.dto.ts      # GetInsightsDTO
├── shared/
│   ├── constants/
│   │   ├── error-codes.ts               # KNOWN_ERROR_CODES → HTTP status mapping
│   │   └── env-keys.enum.ts             # EEnvKey enum
│   ├── filters/
│   │   └── http-exception.filter.ts     # Global error shape: { statusCode, error, message }
│   ├── interceptors/
│   │   └── transform-response.interceptor.ts
│   ├── middleware/
│   │   └── request-id.middleware.ts
│   └── utils/
│       ├── unit-converter.ts            # toKg() / fromKg() — computed once at write time
│       ├── cursor.util.ts               # encodeCursor / decodeCursor (base64url JSON)
│       └── date-period.util.ts          # calcPreviousPeriod / calcDeltaPct
└── database/
    ├── data-source.ts                   # TypeORM DataSource for CLI migrations
    ├── migrations/                      # Generated migration files
    └── seeds/
        └── exercise-metadata.seed.ts    # 12-exercise seed data (pnpm seed)

test/
├── unit/
│   ├── repositories/
│   │   └── workout-repository.mock.ts   # createMockRepository() factory
│   ├── use-cases/
│   │   ├── log-workout.service.spec.ts
│   │   ├── get-history.service.spec.ts
│   │   ├── get-pr.service.spec.ts
│   │   ├── get-progress.service.spec.ts
│   │   └── get-insights.service.spec.ts
│   ├── utils/
│   │   ├── unit-converter.spec.ts
│   │   ├── cursor.util.spec.ts
│   │   └── date-period.util.spec.ts
│   └── insights/
│       ├── most-trained.plugin.spec.ts
│       ├── training-frequency.plugin.spec.ts
│       ├── muscle-balance.plugin.spec.ts
│       └── neglected-exercise.plugin.spec.ts
└── integration/                         # NestJS in-process + Supertest + real test DB
    ├── log-workout.spec.ts
    ├── get-history.spec.ts
    ├── get-pr.spec.ts
    ├── get-progress.spec.ts
    └── get-insights.spec.ts
```

### Module → Entity → Endpoint mapping

| Module | Entity ownership | Endpoints |
|--------|-----------------|-----------|
| `WorkoutEntryModule` | `WorkoutEntry`, `WorkoutSet` (cascaded) | `POST /workouts`, `GET /workouts` |
| `WorkoutSetModule` | `WorkoutSet` | `GET /workouts/pr`, `GET /workouts/progress` |
| `ExerciseMetadataModule` | `ExerciseMetadata` | `GET /workouts/insights` |

---

## 4. Design Principles

### 4.1 SOLID (applied pragmatically)

| Principle                 | Applied where                                                                                      |
| ------------------------- | -------------------------------------------------------------------------------------------------- |
| **S**ingle Responsibility | Each use-case class handles exactly one operation; controller is HTTP-only                         |
| **O**pen/Closed           | `InsightPlugin` interface — add new insight by creating a new class, never modifying existing ones |
| **L**iskov Substitution   | `IWorkoutRepository` interface — swap TypeORM impl for in-memory mock in tests                     |
| **I**nterface Segregation | Separate `IWorkoutRepository` per domain concern; no fat interfaces                                |
| **D**ependency Inversion  | Use cases depend on `IWorkoutRepository` abstraction, not `WorkoutRepository` concretely           |

### 4.2 DRY (Don't Repeat Yourself)

- Unit conversion logic lives in exactly one place: `unit-converter.ts`
- Error response shape enforced in one global `HttpExceptionFilter`
- `weight_kg` computed once at write time, never re-derived at read time
- Shared `PaginationDTO` / `DateRangeDTO` base classes reused across endpoints

### 4.3 YAGNI (You Aren't Gonna Need It)

- No Redis cache until benchmarks show it's needed
- No CQRS, Event Sourcing, or Saga patterns — domain is too simple
- No auth middleware (assessment explicitly excludes it)
- No GraphQL layer — REST is sufficient
- No message queue (no async processing required)

### 4.4 TDD (Test-Driven Development)

**Yes — TDD is the primary development workflow.** Writing tests first on this project:

- Forces the repository interface and use-case API to be designed for testability before any implementation exists
- Immediately catches wrong assumptions about business logic (1RM, PR, pagination)
- Produces a living spec — each failing test is a precise, executable requirement
- Aligns with the assessment's emphasis on _test design over coverage %_

**Red → Green → Refactor cycle applied per use-case:**

```
1. RED    Write a failing test for the next behaviour
2. GREEN  Write the minimum code to pass it
3. REFACTOR Clean up without breaking tests
```

**Where TDD is strictly applied (unit layer):**

- `Weight` value object — all conversion + validation cases
- `UnitConverter` — all unit mappings
- Each use-case — tested against a mock `IWorkoutRepository`
- Each `InsightPlugin` — tested with fixture `WorkoutData`

**Where TDD is applied pragmatically (integration layer):**

- Write the e2e spec for an endpoint first (defines the contract)
- Implement controller → use-case → repository until the spec passes
- Avoids over-mocking at the integration level — hits a real test DB

---

## 5. Database Schema & Indexing

### Entities

```
workout_entries  (id UUID PK, user_id UUID, date DATE, exercise_name VARCHAR, created_at TIMESTAMPTZ)
workout_sets     (id UUID PK, entry_id UUID FK, reps INT, weight NUMERIC, unit VARCHAR, weight_kg NUMERIC)
exercise_metadata (name VARCHAR PK, muscle_group VARCHAR, aliases TEXT[])
```

### Index Strategy

```sql
-- History: paginated list by user, reverse-chrono
CREATE INDEX idx_entries_user_date      ON workout_entries(user_id, date DESC);

-- PR + progress: filter by user + exercise
CREATE INDEX idx_entries_user_exercise  ON workout_entries(user_id, exercise_name, date DESC);

-- Set joins (entry_id is FK; explicit index speeds aggregations)
CREATE INDEX idx_sets_entry             ON workout_sets(entry_id);

-- PR queries: MAX(weight_kg) scan
CREATE INDEX idx_sets_weight_kg         ON workout_sets(weight_kg DESC);
```

> **Scale note (document in README):** At 50k+ entries/user — add partial indexes per user, consider materialized views for PR data, and range-partition `workout_entries` by `user_id` hash.

### Migrations

- All schema changes via TypeORM migrations (`pnpm migration:generate` / `pnpm migration:run`)
- `synchronize: false` in all environments — never auto-sync against real data
- Migrations run automatically in Docker entrypoint before app start

---

## 6. API Security & HTTP Hardening

### 6.1 Helmet

```typescript
// main.ts
import helmet from "helmet";
app.use(helmet());
```

Enables: `X-DNS-Prefetch-Control`, `X-Frame-Options`, `X-XSS-Protection`, `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `Content-Security-Policy`.

### 6.2 CORS

```typescript
app.enableCors({
  origin: process.env.ALLOWED_ORIGINS?.split(",") ?? "*",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"],
});
```

- Default `*` for dev/assignment; restrict to explicit origins for production-like setups.

### 6.3 Global Validation Pipe

```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true, // strip unknown properties
    forbidNonWhitelisted: true,
    transform: true, // auto-cast query params to declared types
    transformOptions: { enableImplicitConversion: true },
  }),
);
```

### 6.4 Global Exception Filter

All unhandled exceptions return the consistent shape:

```json
{ "statusCode": 400, "error": "ERROR_CODE", "message": "..." }
```

---

## 7. Structured Logging (nestjs-pino)

```typescript
// app.module.ts
LoggerModule.forRoot({
  pinoHttp: {
    level: process.env.LOG_LEVEL ?? 'info',
    transport: process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty' }   // human-readable in dev
      : undefined,                   // raw JSON in prod/Docker
    redact: ['req.headers.authorization'],
    autoLogging: true,              // logs every request/response automatically
  },
}),

// main.ts
const app = await NestFactory.create(AppModule, { bufferLogs: true });
app.useLogger(app.get(Logger));
```

Every log line automatically includes: `level`, `time`, `pid`, `req.id`, `req.method`, `req.url`, `res.statusCode`, `responseTime`.

---

## 8. API Documentation (Swagger / OpenAPI)

```typescript
// main.ts
const config = new DocumentBuilder()
  .setTitle("Everfit Workout API")
  .setVersion("1.0")
  .setDescription("Workout logging, PR tracking, progress charts, and insights")
  .addTag("workouts")
  .build();

const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup("api/docs", app, document);
```

- Decorators on DTOs: `@ApiProperty()`, `@ApiQuery()`, `@ApiResponse()`
- Available at `http://localhost:3000/api/docs` in dev
- JSON spec at `http://localhost:3000/api/docs-json`

---

## 9. Docker Setup

### docker-compose.yml (brief)

```yaml
services:
  api:
    build: .
    ports: ["3000:3000"]
    environment:
      DATABASE_URL: postgres://everfit:everfit@db:5432/everfit
      NODE_ENV: development
      LOG_LEVEL: info
    depends_on:
      db:
        condition: service_healthy
    command: sh -c "pnpm migration:run && node dist/main"

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: everfit
      POSTGRES_PASSWORD: everfit
      POSTGRES_DB: everfit
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U everfit"]
      interval: 5s
      retries: 5

volumes:
  pgdata:
```

### Dockerfile (brief)

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app

# Enable pnpm via corepack (bundled with Node 20)
RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM node:20-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main"]
```

---

## 10. Environment Configuration

Pure env vars — no YAML config files. `ConfigModule.forRoot` reads `.env` with Joi validation and sensible defaults.

### 10.1 Environment Variables

| Env var | Default | Notes |
|---------|---------|-------|
| `NODE_ENV` | `development` | |
| `PORT` | `3000` | |
| `DB_HOST` | `localhost` | |
| `DB_PORT` | `5432` | Test DB uses `5433` |
| `DB_NAME` | `workout_db` | Test DB uses `workout_test_db` |
| `DB_USER` | `workout` | |
| `DB_PASSWORD` | `workout` | |
| `LOG_LEVEL` | `info` | |
| `CORS_ORIGINS` | (all) | Comma-separated list |

### 10.2 ConfigModule Setup (`src/config/config.module.ts`)

```typescript
import * as Joi from 'joi';

ConfigModule.forRoot({
  isGlobal: true,
  envFilePath: '.env',
  validationSchema: Joi.object({
    NODE_ENV:    Joi.string().valid('development', 'production', 'test').default('development'),
    PORT:        Joi.number().default(3000),
    DB_HOST:     Joi.string().default('localhost'),
    DB_PORT:     Joi.number().default(5432),
    DB_NAME:     Joi.string().default('workout_db'),
    DB_USER:     Joi.string().default('workout'),
    DB_PASSWORD: Joi.string().default('workout'),
    LOG_LEVEL:   Joi.string().default('info'),
    CORS_ORIGINS: Joi.string().optional(),
  }),
})
```

`ConfigService` is available globally — feature modules do not need to import `ConfigModule`.

### 10.3 `.env` File

```env
# .env — never commit secrets
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=workout_db
DB_USER=workout
DB_PASSWORD=workout
PORT=3000
LOG_LEVEL=info
```

Test env uses `DB_PORT=5433` and `DB_NAME=workout_test_db` — set in the test runner or `jest-integration.json`.

---

## 11. Testing Strategy (TDD-first)

### 11.1 Philosophy

> Write the test first. Let the failing test drive the implementation.

- Every use-case, value object, and insight plugin is written **test-first**
- Integration (e2e) specs define the HTTP contract **before** the controller is implemented
- Assessment evaluates test _design_ over coverage % — edge cases matter more than line count

### 11.2 Test Layers

| Layer       | Location            | Tool             | DB                    | When written                   |
| ----------- | ------------------- | ---------------- | --------------------- | ------------------------------ |
| Unit        | `test/unit/`        | Jest             | None (mocks)          | **Before** implementation      |
| Integration | `test/integration/` | Jest + Supertest | Real test DB (Docker) | **Before** controller/use-case |

> **Naming note:** Files use `.spec.ts` (not `.e2e-spec.ts`). The NestJS CLI default of `e2e-spec` implies a deployed environment — our integration tests run the app fully in-process via `Test.createTestingModule()`, which is integration testing, not end-to-end.

### 11.3 TDD Cycle per Feature

```
For each service (e.g. log-workout):

  1. RED   — write test/unit/use-cases/log-workout.service.spec.ts
             describe all behaviours: happy path, empty sets, invalid weight, lb→kg conversion
             run: pnpm test -- --testPathPattern=log-workout   → all RED ✗

  2. GREEN — implement workout-entry.service.ts using createMockRepository()
             run: pnpm test -- --testPathPattern=log-workout   → all GREEN ✓

  3. REFACTOR — clean up, no duplication, run again to confirm GREEN

  4. RED   — write test/integration/log-workout.spec.ts
             Full HTTP contract: POST /workouts with real DB, verify 201 + persisted data

  5. GREEN — wire controller → service → TypeORM repository
             run: pnpm test:integration -- --testPathPattern=log-workout → GREEN ✓
```

### 11.4 Unit Test Conventions

```typescript
// test/unit/use-cases/log-workout.service.spec.ts

describe('LogWorkoutService', () => {
  let service: LogWorkoutService;
  let repo: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    repo = createMockRepository();
    service = new LogWorkoutService(repo);
  });

  it('normalizes lb weight to kg before saving', async () => {
    repo.saveEntries.mockResolvedValue([]);
    await service.execute({ userId: 'u1', date: '2024-01-01',
      entries: [{ exerciseName: 'Bench', sets: [{ reps: 5, weight: 220.46, unit: 'lb' }] }] });

    expect(repo.saveEntries).toHaveBeenCalledWith(
      expect.anything(), expect.anything(),
      [expect.objectContaining({ sets: [expect.objectContaining({ weightKg: expect.closeTo(100, 1) })] })],
    );
  });

  it('throws EMPTY_SETS when sets array is empty', async () => {
    await expect(service.execute({ userId: 'u1', date: '2024-01-01',
      entries: [{ exerciseName: 'X', sets: [] }] }))
      .rejects.toThrow('EMPTY_SETS');
  });
});
```

### 11.5 Integration Test Conventions

```typescript
// test/integration/log-workout.spec.ts
// NOT "e2e" — this is in-process NestJS + Supertest + real test DB.
// True E2E (external client vs deployed server) is out of scope for this assignment.

describe("POST /workouts", () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Spins up real NestJS app against test DB (config.test.yaml)
    app = await createTestApp();
  });

  afterEach(() => clearTestDb());
  afterAll(() => app.close());

  it("201 — persists all sets with correct weight_kg", async () => {
    const res = await request(app.getHttpServer())
      .post("/workouts?userId=user-uuid")
      .send({
        date: "2024-01-15",
        entries: [
          {
            exerciseName: "Squat",
            sets: [{ reps: 5, weight: 100, unit: "kg" }],
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.entries[0].sets[0].weightKg).toBe(100);
  });

  it("400 EMPTY_SETS — rejects empty sets array", async () => {
    const res = await request(app.getHttpServer())
      .post("/workouts?userId=user-uuid")
      .send({
        date: "2024-01-15",
        entries: [{ exerciseName: "Squat", sets: [] }],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("EMPTY_SETS");
  });
});
```

### 11.6 pnpm Test Scripts (`package.json`)

```json
{
  "scripts": {
    "test": "jest --runInBand",
    "test:watch": "jest --watch",
    "test:unit": "jest --testPathPattern=test/unit",
    "test:integration": "jest --testPathPattern=test/integration --runInBand",
    "test:cov": "jest --coverage"
  }
}
```

> **Why not `test:e2e`?** The NestJS CLI generates `test:e2e` by default, but our integration tests are **not** true E2E — they run the app in-process via `Test.createTestingModule()` + Supertest against a real test DB. Renaming to `test:integration` is more precise and avoids implying a deployed environment is required.

Run order during development:

```bash
pnpm test:unit         # fast feedback, no DB needed (~seconds)
pnpm test:integration  # full contract verification, requires test DB (~10-30s)
pnpm test:cov          # coverage report (informational only)
```

---

## 12. Scalability Notes (document in README)

| Concern           | Now                         | At scale                                      |
| ----------------- | --------------------------- | --------------------------------------------- |
| PR queries        | `MAX()` scan with index     | Materialized view refreshed on write          |
| Insights          | Computed per request        | Cache with Redis (TTL ~1h)                    |
| High write volume | Standard INSERT             | Partition `workout_entries` by `user_id` hash |
| Read replicas     | Single DB                   | Route analytics queries to read replica       |
| Aggregations      | PostgreSQL window functions | Same — already correct pattern                |

---

## 13. What is Intentionally Excluded (YAGNI)

| Item                    | Reason                              |
| ----------------------- | ----------------------------------- |
| JWT / OAuth             | Assessment explicitly excludes auth |
| Redis                   | Not needed at assignment scale      |
| CQRS / Event Sourcing   | Over-engineered for this domain     |
| Rate limiting           | Not required by assessment          |
| GraphQL                 | REST sufficient                     |
| Multi-tenancy isolation | Single `userId` param is sufficient |
| Soft deletes            | Not specified; add only if required |
