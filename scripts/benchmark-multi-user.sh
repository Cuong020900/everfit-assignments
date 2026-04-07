#!/usr/bin/env bash

set -euo pipefail

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5433}"
DB_NAME="${DB_NAME:-workout_test_db}"
DB_USER="${DB_USER:-workout}"
DB_PASSWORD="${DB_PASSWORD:-workout}"
API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"

USERS_COUNT="${USERS_COUNT:-5}"
ENTRIES_PER_USER="${ENTRIES_PER_USER:-50000}"
SETS_PER_ENTRY="${SETS_PER_ENTRY:-1}"
EXERCISE_VARIANTS="${EXERCISE_VARIANTS:-200}"
DATE_SPAN_DAYS="${DATE_SPAN_DAYS:-365}"
START_DATE="${START_DATE:-2023-01-01}"
START_MONTHS_AGO="${START_MONTHS_AGO:-}"
WARMUP_ROUNDS="${WARMUP_ROUNDS:-3}"
SAMPLE_ROUNDS="${SAMPLE_ROUNDS:-20}"
API_CONCURRENCY="${API_CONCURRENCY:-20}"

REPORT_DIR="${REPORT_DIR:-docs}"
REPORT_TS="$(date '+%Y%m%d-%H%M%S')"
REPORT_FILE="${REPORT_DIR}/benchmark-report-${REPORT_TS}.md"

export PGPASSWORD="${DB_PASSWORD}"

run_psql() {
  psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" "$@"
}

resolve_start_date() {
  if [[ -n "${START_MONTHS_AGO}" ]]; then
    if [[ "$(uname -s)" == "Darwin" ]]; then
      date -v-"${START_MONTHS_AGO}"m '+%Y-%m-%d'
    else
      date -d "${START_MONTHS_AGO} months ago" '+%Y-%m-%d'
    fi
  else
    echo "${START_DATE}"
  fi
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

summarize_ms() {
  awk '
    {
      vals[++n] = $1 + 0
      sum += vals[n]
    }
    END {
      if (n == 0) {
        print "0.000|0.000|0.000|0.000"
        exit
      }

      for (i = 1; i <= n; i++) {
        for (j = i + 1; j <= n; j++) {
          if (vals[j] < vals[i]) {
            t = vals[i]
            vals[i] = vals[j]
            vals[j] = t
          }
        }
      }

      p95_idx = int((n * 95 + 99) / 100)
      if (p95_idx < 1) p95_idx = 1
      if (p95_idx > n) p95_idx = n

      min = vals[1]
      max = vals[n]
      avg = sum / n
      p95 = vals[p95_idx]

      printf "%.3f|%.3f|%.3f|%.3f", min, avg, p95, max
    }
  '
}

measure_api_samples_ms() {
  local url="$1"
  local iterations="$2"
  local i

  for i in $(seq 1 "${iterations}"); do
    curl -sS -o /dev/null -w '%{time_total}\n' "${url}" | awk '{ printf "%.3f\n", $1 * 1000 }'
  done
}

measure_api_parallel_samples_ms() {
  local url="$1"
  local total_requests="$2"
  local concurrency="$3"

  seq 1 "${total_requests}" \
    | xargs -I{} -P "${concurrency}" bash -lc \
      "curl -sS -o /dev/null -w '%{time_total}\n' '${url}'" \
    | awk '{ printf "%.3f\n", $1 * 1000 }'
}

measure_explain_samples_ms() {
  local sql="$1"
  local rounds="$2"
  local i

  for i in $(seq 1 "${rounds}"); do
    run_psql -X -A -t -c "EXPLAIN (ANALYZE, BUFFERS) ${sql};" \
      | awk '/Execution Time/ {print $(NF-1)}'
  done
}

split_stats() {
  local stats="$1"
  local prefix="$2"
  local min avg p95 max
  IFS='|' read -r min avg p95 max <<<"${stats}"
  printf -v "${prefix}_MIN" "%s" "${min}"
  printf -v "${prefix}_AVG" "%s" "${avg}"
  printf -v "${prefix}_P95" "%s" "${p95}"
  printf -v "${prefix}_MAX" "%s" "${max}"
}

echo "==> Checking required tools"
require_cmd psql
require_cmd curl
require_cmd pnpm

echo "==> Resetting schema on ${DB_HOST}:${DB_PORT}/${DB_NAME}"
run_psql -v ON_ERROR_STOP=1 -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"

echo "==> Running migrations"
DB_HOST="${DB_HOST}" DB_PORT="${DB_PORT}" DB_NAME="${DB_NAME}" DB_USER="${DB_USER}" DB_PASSWORD="${DB_PASSWORD}" \
  pnpm migration:run >/dev/null

echo "==> Seeding large multi-user dataset"
RESOLVED_START_DATE="$(resolve_start_date)"
run_psql -v ON_ERROR_STOP=1 -c "
WITH users AS (
  SELECT
    (
      substr(md5('bench-user-' || u::text), 1, 8) || '-' ||
      substr(md5('bench-user-' || u::text), 9, 4) || '-' ||
      '4' || substr(md5('bench-user-' || u::text), 14, 3) || '-' ||
      '8' || substr(md5('bench-user-' || u::text), 18, 3) || '-' ||
      substr(md5('bench-user-' || u::text), 21, 12)
    )::uuid AS user_id
  FROM generate_series(1, ${USERS_COUNT}) AS u
),
entry_source AS (
  SELECT
    gen_random_uuid() AS id,
    u.user_id,
    (
      DATE '${RESOLVED_START_DATE}' +
      (((s - 1) % ${DATE_SPAN_DAYS})::int) +
      (((s - 1) / (${DATE_SPAN_DAYS} * ${EXERCISE_VARIANTS}))::int * (${DATE_SPAN_DAYS} + 1))
    )::date AS date,
    ('Exercise ' || (((s - 1) / ${DATE_SPAN_DAYS}) % ${EXERCISE_VARIANTS}))::text AS exercise_name,
    now() AS created_at,
    now() AS updated_at,
    (1 + ((random() * 9)::int))::int AS reps,
    (40 + (random() * 160))::numeric(10, 4) AS weight_kg
  FROM users u
  CROSS JOIN generate_series(1, ${ENTRIES_PER_USER}) AS s
),
inserted_entries AS (
  INSERT INTO workout_entries (id, user_id, date, exercise_name, created_at, updated_at)
  SELECT id, user_id, date, exercise_name, created_at, updated_at
  FROM entry_source
  RETURNING id
)
INSERT INTO workout_sets (id, entry_id, reps, weight, unit, weight_kg, created_at, updated_at)
SELECT
  gen_random_uuid(),
  es.id,
  es.reps,
  es.weight_kg,
  'kg',
  es.weight_kg,
  now(),
  now()
FROM entry_source es
JOIN inserted_entries ie ON ie.id = es.id
CROSS JOIN generate_series(1, ${SETS_PER_ENTRY});
"

echo "==> Running ANALYZE"
run_psql -c "ANALYZE workout_entries; ANALYZE workout_sets;" >/dev/null

echo "==> Collecting benchmark metrics"
BENCH_USER_ID="$(
  run_psql -X -A -t -c "
    SELECT (
      substr(md5('bench-user-1'), 1, 8) || '-' ||
      substr(md5('bench-user-1'), 9, 4) || '-' ||
      '4' || substr(md5('bench-user-1'), 14, 3) || '-' ||
      '8' || substr(md5('bench-user-1'), 18, 3) || '-' ||
      substr(md5('bench-user-1'), 21, 12)
    )::uuid;
  " | tr -d '[:space:]'
)"

ENTRIES_TOTAL="$(run_psql -X -A -t -c 'SELECT count(*) FROM workout_entries;' | tr -d '[:space:]')"
SETS_TOTAL="$(run_psql -X -A -t -c 'SELECT count(*) FROM workout_sets;' | tr -d '[:space:]')"

HISTORY_PAGE_SQL="SELECT e.id, e.date, e.exercise_name
    FROM workout_entries e
    WHERE e.user_id = '${BENCH_USER_ID}'::uuid
    ORDER BY e.date DESC, e.id DESC
    LIMIT 21"

HISTORY_CURSOR_SQL="SELECT e.id, e.date, e.exercise_name
    FROM workout_entries e
    WHERE e.user_id = '${BENCH_USER_ID}'::uuid
      AND (e.date < DATE '2024-07-01' OR (e.date = DATE '2024-07-01' AND e.id < 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
    ORDER BY e.date DESC, e.id DESC
    LIMIT 21"

HISTORY_WORST_SQL="SELECT e.id, e.date, e.exercise_name
    FROM workout_entries e
    WHERE e.user_id = '${BENCH_USER_ID}'::uuid
      AND e.exercise_name ILIKE '%NoSuchExercisePattern%'
    ORDER BY e.date DESC, e.id DESC
    LIMIT 21"

PROGRESS_SQL="SELECT e.date, s.reps, s.weight_kg
    FROM workout_sets s
    INNER JOIN workout_entries e ON e.id = s.entry_id
    WHERE e.user_id = '${BENCH_USER_ID}'::uuid
      AND e.exercise_name = 'Exercise 42'
    ORDER BY e.date ASC"

PR_SQL="SELECT s.reps, s.weight_kg, e.date, e.exercise_name
    FROM workout_sets s
    INNER JOIN workout_entries e ON e.id = s.entry_id
    WHERE e.user_id = '${BENCH_USER_ID}'::uuid
      AND e.exercise_name = 'Exercise 42'"

echo "==> Warm up"
measure_explain_samples_ms "${HISTORY_PAGE_SQL}" "${WARMUP_ROUNDS}" >/dev/null
measure_explain_samples_ms "${HISTORY_CURSOR_SQL}" "${WARMUP_ROUNDS}" >/dev/null
measure_explain_samples_ms "${PROGRESS_SQL}" "${WARMUP_ROUNDS}" >/dev/null
measure_explain_samples_ms "${PR_SQL}" "${WARMUP_ROUNDS}" >/dev/null
measure_api_samples_ms "${API_BASE_URL}/workouts?userId=${BENCH_USER_ID}&limit=20" "${WARMUP_ROUNDS}" >/dev/null
measure_api_samples_ms "${API_BASE_URL}/workouts/progress?userId=${BENCH_USER_ID}&exerciseName=Exercise%2042&groupBy=daily" "${WARMUP_ROUNDS}" >/dev/null
measure_api_samples_ms "${API_BASE_URL}/workouts/insights?userId=${BENCH_USER_ID}" "${WARMUP_ROUNDS}" >/dev/null

echo "==> SQL benchmark rounds (${SAMPLE_ROUNDS})"
HISTORY_PAGE_STATS="$(measure_explain_samples_ms "${HISTORY_PAGE_SQL}" "${SAMPLE_ROUNDS}" | summarize_ms)"
HISTORY_CURSOR_STATS="$(measure_explain_samples_ms "${HISTORY_CURSOR_SQL}" "${SAMPLE_ROUNDS}" | summarize_ms)"
HISTORY_WORST_STATS="$(measure_explain_samples_ms "${HISTORY_WORST_SQL}" "${SAMPLE_ROUNDS}" | summarize_ms)"
PROGRESS_STATS="$(measure_explain_samples_ms "${PROGRESS_SQL}" "${SAMPLE_ROUNDS}" | summarize_ms)"
PR_STATS="$(measure_explain_samples_ms "${PR_SQL}" "${SAMPLE_ROUNDS}" | summarize_ms)"

split_stats "${HISTORY_PAGE_STATS}" HISTORY_PAGE
split_stats "${HISTORY_CURSOR_STATS}" HISTORY_CURSOR
split_stats "${HISTORY_WORST_STATS}" HISTORY_WORST
split_stats "${PROGRESS_STATS}" PROGRESS
split_stats "${PR_STATS}" PR

echo "==> API serial benchmark rounds (${SAMPLE_ROUNDS})"
API_HISTORY_SERIAL_STATS="$(
  measure_api_samples_ms "${API_BASE_URL}/workouts?userId=${BENCH_USER_ID}&limit=20" "${SAMPLE_ROUNDS}" | summarize_ms
)"
API_PROGRESS_SERIAL_STATS="$(
  measure_api_samples_ms "${API_BASE_URL}/workouts/progress?userId=${BENCH_USER_ID}&exerciseName=Exercise%2042&groupBy=daily" "${SAMPLE_ROUNDS}" | summarize_ms
)"
API_INSIGHTS_SERIAL_STATS="$(
  measure_api_samples_ms "${API_BASE_URL}/workouts/insights?userId=${BENCH_USER_ID}" "${SAMPLE_ROUNDS}" | summarize_ms
)"

split_stats "${API_HISTORY_SERIAL_STATS}" API_HISTORY_SERIAL
split_stats "${API_PROGRESS_SERIAL_STATS}" API_PROGRESS_SERIAL
split_stats "${API_INSIGHTS_SERIAL_STATS}" API_INSIGHTS_SERIAL

echo "==> API concurrent benchmark (${SAMPLE_ROUNDS} requests, concurrency ${API_CONCURRENCY})"
API_HISTORY_CONCURRENT_STATS="$(
  measure_api_parallel_samples_ms "${API_BASE_URL}/workouts?userId=${BENCH_USER_ID}&limit=20" "${SAMPLE_ROUNDS}" "${API_CONCURRENCY}" | summarize_ms
)"
API_PROGRESS_CONCURRENT_STATS="$(
  measure_api_parallel_samples_ms "${API_BASE_URL}/workouts/progress?userId=${BENCH_USER_ID}&exerciseName=Exercise%2042&groupBy=daily" "${SAMPLE_ROUNDS}" "${API_CONCURRENCY}" | summarize_ms
)"
API_INSIGHTS_CONCURRENT_STATS="$(
  measure_api_parallel_samples_ms "${API_BASE_URL}/workouts/insights?userId=${BENCH_USER_ID}" "${SAMPLE_ROUNDS}" "${API_CONCURRENCY}" | summarize_ms
)"

split_stats "${API_HISTORY_CONCURRENT_STATS}" API_HISTORY_CONCURRENT
split_stats "${API_PROGRESS_CONCURRENT_STATS}" API_PROGRESS_CONCURRENT
split_stats "${API_INSIGHTS_CONCURRENT_STATS}" API_INSIGHTS_CONCURRENT

mkdir -p "${REPORT_DIR}"

cat > "${REPORT_FILE}" <<EOF
# Performance Benchmark Report

- Generated at: ${REPORT_TS}
- DB: ${DB_HOST}:${DB_PORT}/${DB_NAME}
- API base URL: ${API_BASE_URL}

## Dataset

- Users: ${USERS_COUNT}
- Entries per user: ${ENTRIES_PER_USER}
- Total entries: ${ENTRIES_TOTAL}
- Sets per entry: ${SETS_PER_ENTRY}
- Total sets: ${SETS_TOTAL}
- Exercise variants: ${EXERCISE_VARIANTS}
- Date span (days): ${DATE_SPAN_DAYS}
- Start date: ${RESOLVED_START_DATE}
- Benchmark user: \`${BENCH_USER_ID}\`

## SQL Benchmarks (EXPLAIN ANALYZE, ms)

Each metric is aggregated over ${SAMPLE_ROUNDS} rounds after ${WARMUP_ROUNDS} warm-up rounds.

- History first page (limit 21): min **${HISTORY_PAGE_MIN}** / avg **${HISTORY_PAGE_AVG}** / p95 **${HISTORY_PAGE_P95}** / max **${HISTORY_PAGE_MAX}**
- History cursor page (limit 21): min **${HISTORY_CURSOR_MIN}** / avg **${HISTORY_CURSOR_AVG}** / p95 **${HISTORY_CURSOR_P95}** / max **${HISTORY_CURSOR_MAX}**
- History worst-case no-match ILIKE: min **${HISTORY_WORST_MIN}** / avg **${HISTORY_WORST_AVG}** / p95 **${HISTORY_WORST_P95}** / max **${HISTORY_WORST_MAX}**
- Progress query (single exercise): min **${PROGRESS_MIN}** / avg **${PROGRESS_AVG}** / p95 **${PROGRESS_P95}** / max **${PROGRESS_MAX}**
- PR query (single exercise): min **${PR_MIN}** / avg **${PR_AVG}** / p95 **${PR_P95}** / max **${PR_MAX}**

## API Benchmarks - Serial (ms)

Each metric is aggregated over ${SAMPLE_ROUNDS} sequential requests.

- \`GET /workouts\`: min **${API_HISTORY_SERIAL_MIN}** / avg **${API_HISTORY_SERIAL_AVG}** / p95 **${API_HISTORY_SERIAL_P95}** / max **${API_HISTORY_SERIAL_MAX}**
- \`GET /workouts/progress\`: min **${API_PROGRESS_SERIAL_MIN}** / avg **${API_PROGRESS_SERIAL_AVG}** / p95 **${API_PROGRESS_SERIAL_P95}** / max **${API_PROGRESS_SERIAL_MAX}**
- \`GET /workouts/insights\`: min **${API_INSIGHTS_SERIAL_MIN}** / avg **${API_INSIGHTS_SERIAL_AVG}** / p95 **${API_INSIGHTS_SERIAL_P95}** / max **${API_INSIGHTS_SERIAL_MAX}**

## API Benchmarks - Concurrent (ms)

${SAMPLE_ROUNDS} total requests with concurrency ${API_CONCURRENCY}.

- \`GET /workouts\`: min **${API_HISTORY_CONCURRENT_MIN}** / avg **${API_HISTORY_CONCURRENT_AVG}** / p95 **${API_HISTORY_CONCURRENT_P95}** / max **${API_HISTORY_CONCURRENT_MAX}**
- \`GET /workouts/progress\`: min **${API_PROGRESS_CONCURRENT_MIN}** / avg **${API_PROGRESS_CONCURRENT_AVG}** / p95 **${API_PROGRESS_CONCURRENT_P95}** / max **${API_PROGRESS_CONCURRENT_MAX}**
- \`GET /workouts/insights\`: min **${API_INSIGHTS_CONCURRENT_MIN}** / avg **${API_INSIGHTS_CONCURRENT_AVG}** / p95 **${API_INSIGHTS_CONCURRENT_P95}** / max **${API_INSIGHTS_CONCURRENT_MAX}**

## Methodology

- Schema reset + migration run on each execution.
- Synthetic dataset generated deterministically across users and exercises.
- SQL latency taken from Postgres \`Execution Time\` in EXPLAIN ANALYZE.
- API latency measured from curl \`time_total\` (includes HTTP and app overhead).

## Limitations

- Local machine benchmarks are not equivalent to production load.
- Concurrent API section is a lightweight smoke benchmark, not a full load test tool.
- Database cache state and machine background load can influence numbers.
EOF

echo "==> Done"
echo "Report written to: ${REPORT_FILE}"
