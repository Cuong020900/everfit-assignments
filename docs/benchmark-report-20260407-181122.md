# Performance Benchmark Report

- Generated at: 20260407-181122
- DB: localhost:5433/workout_test_db
- API base URL: http://localhost:3000

## Dataset

- Users: 10
- Entries per user: 50000
- Total entries: 500000
- Sets per entry: 1
- Total sets: 500000
- Exercise variants: 200
- Date span (days): 365
- Benchmark user: `4d22fb9d-795f-469e-a357-6070878c2acb`

## SQL Benchmarks (EXPLAIN ANALYZE, ms)

Each metric is aggregated over 20 rounds after 3 warm-up rounds.

- History first page (limit 21): min **0.060** / avg **0.163** / p95 **0.240** / max **0.514**
- History cursor page (limit 21): min **0.058** / avg **0.200** / p95 **0.374** / max **0.775**
- History worst-case no-match ILIKE: min **22.772** / avg **25.499** / p95 **29.648** / max **46.994**
- Progress query (single exercise): min **1.609** / avg **4.175** / p95 **6.551** / max **12.310**
- PR query (single exercise): min **1.706** / avg **3.975** / p95 **8.452** / max **9.443**

## API Benchmarks - Serial (ms)

Each metric is aggregated over 20 sequential requests.

- `GET /workouts`: min **2.957** / avg **5.765** / p95 **9.432** / max **10.531**
- `GET /workouts/progress`: min **2.527** / avg **5.618** / p95 **7.939** / max **10.451**
- `GET /workouts/insights`: min **3.040** / avg **5.367** / p95 **8.030** / max **8.598**

## API Benchmarks - Concurrent (ms)

20 total requests with concurrency 20.

- `GET /workouts`: min **2.625** / avg **11.819** / p95 **37.034** / max **43.827**
- `GET /workouts/progress`: min **3.174** / avg **12.730** / p95 **16.276** / max **121.424**
- `GET /workouts/insights`: min **3.398** / avg **15.639** / p95 **21.413** / max **146.931**

## Methodology

- Schema reset + migration run on each execution.
- Synthetic dataset generated deterministically across users and exercises.
- SQL latency taken from Postgres `Execution Time` in EXPLAIN ANALYZE.
- API latency measured from curl `time_total` (includes HTTP and app overhead).

## Limitations

- Local machine benchmarks are not equivalent to production load.
- Concurrent API section is a lightweight smoke benchmark, not a full load test tool.
- Database cache state and machine background load can influence numbers.
