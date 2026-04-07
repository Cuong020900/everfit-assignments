#!/usr/bin/env bash

set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
REPORT_DIR="${REPORT_DIR:-docs}"
REPORT_TS="$(date '+%Y%m%d-%H%M%S')"
REPORT_FILE="${REPORT_DIR}/stress-report-${REPORT_TS}.md"
K6_SCRIPT="${K6_SCRIPT:-scripts/k6-workout-stress.js}"

USER_ID="${USER_ID:-4d22fb9d-795f-469e-a357-6070878c2acb}"
ENDPOINT_HISTORY="${ENDPOINT_HISTORY:-/workouts?userId=${USER_ID}&limit=20}"
ENDPOINT_PROGRESS="${ENDPOINT_PROGRESS:-/workouts/progress?userId=${USER_ID}&exerciseName=Exercise%2042&groupBy=daily}"
ENDPOINT_INSIGHTS="${ENDPOINT_INSIGHTS:-/workouts/insights?userId=${USER_ID}}"

CONCURRENCY_LEVELS="${CONCURRENCY_LEVELS:-10,20,50,100}"
REQUESTS_PER_LEVEL="${REQUESTS_PER_LEVEL:-200}"
K6_TIMEOUT="${K6_TIMEOUT:-30s}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

summarize_file_ms() {
  local file="$1"
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
      printf "%.3f|%.3f|%.3f|%.3f", vals[1], (sum / n), vals[p95_idx], vals[n]
    }
  ' "${file}"
}

run_level() {
  local endpoint="$1"
  local concurrency="$2"
  local total_requests="$3"
  local out_file="$4"

  : > "${out_file}"
  seq 1 "${total_requests}" | xargs -I{} -P "${concurrency}" bash -lc "
    resp=\$(curl -sS -o /dev/null -w '%{http_code} %{time_total}' '${API_BASE_URL}${endpoint}')
    code=\$(echo \"\$resp\" | awk '{print \$1}')
    sec=\$(echo \"\$resp\" | awk '{print \$2}')
    ms=\$(awk -v s=\"\$sec\" 'BEGIN { printf \"%.3f\", s * 1000 }')
    echo \"\$code \$ms\"
  " >> "${out_file}"
}

run_level_k6() {
  local endpoint="$1"
  local concurrency="$2"
  local total_requests="$3"
  local out_file="$4"
  local summary_file="$5"

  k6 run \
    -q \
    --summary-export "${summary_file}" \
    -e API_BASE_URL="${API_BASE_URL}" \
    -e ENDPOINT_PATH="${endpoint}" \
    -e VUS="${concurrency}" \
    -e ITERATIONS="${total_requests}" \
    -e K6_TIMEOUT="${K6_TIMEOUT}" \
    "${K6_SCRIPT}" >/dev/null

  node -e "
    const fs = require('node:fs');
    const summary = JSON.parse(fs.readFileSync('${summary_file}', 'utf8'));
    const m = summary.metrics || {};
    const duration = m.http_req_duration || {};
    const checks = m.checks || {};
    const reqs = m.http_reqs || {};
    const failed = m.http_req_failed || {};
    const total = Number(reqs.count || 0);
    const fails = Math.round((Number(failed.rate || 0)) * total);
    const success = Math.max(total - fails, 0);
    const lines = [];
    for (let i = 0; i < success; i++) {
      lines.push('200 ' + Number(duration.avg || 0).toFixed(3));
    }
    for (let i = 0; i < fails; i++) {
      lines.push('500 ' + Number(duration.avg || 0).toFixed(3));
    }
    fs.writeFileSync('${out_file}', lines.join('\n') + (lines.length ? '\n' : ''));
    const detail = {
      total,
      success,
      fail: fails,
      min: Number(duration.min || 0).toFixed(3),
      avg: Number(duration.avg || 0).toFixed(3),
      p95: Number(duration['p(95)'] || 0).toFixed(3),
      max: Number(duration.max || 0).toFixed(3),
      checksRate: Number(checks.value || 0).toFixed(4),
    };
    fs.writeFileSync('${summary_file}.parsed.json', JSON.stringify(detail));
  "
}

extract_stats() {
  local data_file="$1"
  local prefix="$2"
  local lat_file
  lat_file="$(mktemp)"

  awk '$1 ~ /^2[0-9][0-9]$/ { print $2 }' "${data_file}" > "${lat_file}"
  local success total fail stats min avg p95 max
  success="$(awk '$1 ~ /^2[0-9][0-9]$/ {c++} END {print c+0}' "${data_file}")"
  total="$(wc -l < "${data_file}" | tr -d '[:space:]')"
  fail="$((total - success))"
  stats="$(summarize_file_ms "${lat_file}")"
  rm -f "${lat_file}"

  IFS='|' read -r min avg p95 max <<<"${stats}"
  printf -v "${prefix}_TOTAL" "%s" "${total}"
  printf -v "${prefix}_SUCCESS" "%s" "${success}"
  printf -v "${prefix}_FAIL" "%s" "${fail}"
  printf -v "${prefix}_MIN" "%s" "${min}"
  printf -v "${prefix}_AVG" "%s" "${avg}"
  printf -v "${prefix}_P95" "%s" "${p95}"
  printf -v "${prefix}_MAX" "%s" "${max}"
}

echo "==> Checking required tools"
require_cmd curl
require_cmd xargs
require_cmd awk
require_cmd docker
require_cmd uname

RUNNER='curl'
if command -v k6 >/dev/null 2>&1; then
  RUNNER='k6'
fi

mkdir -p "${REPORT_DIR}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

echo "==> Capturing machine and Docker resource configuration"
OS_NAME="$(uname -s)"
OS_VER="$(uname -r)"
CPU_CORES="$(sysctl -n hw.ncpu 2>/dev/null || echo 'unknown')"
MEM_BYTES="$(sysctl -n hw.memsize 2>/dev/null || echo '0')"
MEM_GB="$(awk -v b="${MEM_BYTES}" 'BEGIN { if (b == 0) { print "unknown" } else { printf "%.2f", b/1024/1024/1024 } }')"

API_CONTAINER_ID="$(docker compose ps -q api || true)"
if [[ -n "${API_CONTAINER_ID}" ]]; then
  DOCKER_API_NAME="$(docker inspect -f '{{.Name}}' "${API_CONTAINER_ID}" | sed 's#^/##')"
  DOCKER_API_MEM="$(docker inspect -f '{{.HostConfig.Memory}}' "${API_CONTAINER_ID}")"
  DOCKER_API_NANO_CPUS="$(docker inspect -f '{{.HostConfig.NanoCpus}}' "${API_CONTAINER_ID}")"
  DOCKER_API_CPUS="$(awk -v n="${DOCKER_API_NANO_CPUS}" 'BEGIN { if (n == 0) { print "unlimited" } else { printf "%.2f", n/1000000000 } }')"
  DOCKER_API_MEM_HR="$(awk -v b="${DOCKER_API_MEM}" 'BEGIN { if (b == 0) { print "unlimited" } else { printf "%.2f GiB", b/1024/1024/1024 } }')"
else
  DOCKER_API_NAME="not-found"
  DOCKER_API_MEM_HR="unknown"
  DOCKER_API_CPUS="unknown"
fi

DOCKER_STATS_SNAPSHOT="$(docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}' || true)"

echo "==> Running stress tests"
RESULT_LINES=()
IFS=',' read -r -a LEVELS <<<"${CONCURRENCY_LEVELS}"

for c in "${LEVELS[@]}"; do
  c="$(echo "${c}" | xargs)"
  [[ -z "${c}" ]] && continue

  for endpoint_name in history progress insights; do
    case "${endpoint_name}" in
      history) endpoint="${ENDPOINT_HISTORY}" ;;
      progress) endpoint="${ENDPOINT_PROGRESS}" ;;
      insights) endpoint="${ENDPOINT_INSIGHTS}" ;;
    esac

    out_file="${TMP_DIR}/${endpoint_name}-c${c}.log"
    summary_file="${TMP_DIR}/${endpoint_name}-c${c}.summary.json"
    if [[ "${RUNNER}" == 'k6' ]]; then
      run_level_k6 "${endpoint}" "${c}" "${REQUESTS_PER_LEVEL}" "${out_file}" "${summary_file}"
      parsed_file="${summary_file}.parsed.json"
      if [[ -f "${parsed_file}" ]]; then
        STATS_TOTAL="$(node -e "const d=require('${parsed_file}'); console.log(d.total);")"
        STATS_SUCCESS="$(node -e "const d=require('${parsed_file}'); console.log(d.success);")"
        STATS_FAIL="$(node -e "const d=require('${parsed_file}'); console.log(d.fail);")"
        STATS_MIN="$(node -e "const d=require('${parsed_file}'); console.log(d.min);")"
        STATS_AVG="$(node -e "const d=require('${parsed_file}'); console.log(d.avg);")"
        STATS_P95="$(node -e "const d=require('${parsed_file}'); console.log(d.p95);")"
        STATS_MAX="$(node -e "const d=require('${parsed_file}'); console.log(d.max);")"
        STATS_CHECKS_RATE="$(node -e "const d=require('${parsed_file}'); console.log(d.checksRate);")"
      else
        extract_stats "${out_file}" STATS
        STATS_CHECKS_RATE='n/a'
      fi
    else
      run_level "${endpoint}" "${c}" "${REQUESTS_PER_LEVEL}" "${out_file}"
      extract_stats "${out_file}" STATS
      STATS_CHECKS_RATE='n/a'
    fi

    RESULT_LINES+=("| ${endpoint_name} | ${c} | ${STATS_TOTAL} | ${STATS_SUCCESS} | ${STATS_FAIL} | ${STATS_MIN} | ${STATS_AVG} | ${STATS_P95} | ${STATS_MAX} | ${STATS_CHECKS_RATE} |")
    echo "  endpoint=${endpoint_name} concurrency=${c} done"
  done
done

echo "==> Writing report"
{
  echo "# API Concurrency Stress Test Report"
  echo
  echo "- Generated at: ${REPORT_TS}"
  echo "- API base URL: ${API_BASE_URL}"
  echo "- Requests per level/endpoint: ${REQUESTS_PER_LEVEL}"
  echo "- Concurrency levels: ${CONCURRENCY_LEVELS}"
  echo "- Test userId: \`${USER_ID}\`"
  echo "- Runner: ${RUNNER}"
  if [[ "${RUNNER}" == 'k6' ]]; then
    echo "- k6 script: \`${K6_SCRIPT}\`"
  fi
  echo
  echo "## Machine Configuration"
  echo
  echo "- OS: ${OS_NAME} ${OS_VER}"
  echo "- CPU cores: ${CPU_CORES}"
  echo "- RAM: ${MEM_GB} GiB"
  echo
  echo "## Docker Configuration"
  echo
  echo "- API container: ${DOCKER_API_NAME}"
  echo "- API CPU limit: ${DOCKER_API_CPUS}"
  echo "- API memory limit: ${DOCKER_API_MEM_HR}"
  echo
  echo "### docker stats snapshot"
  echo
  echo '```text'
  echo "${DOCKER_STATS_SNAPSHOT}"
  echo '```'
  echo
  echo "## Results (ms)"
  echo
  echo "| Endpoint | Concurrency | Total | Success | Fail | Min | Avg | P95 | Max | Checks Rate |"
  echo "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |"
  printf '%s\n' "${RESULT_LINES[@]}"
  echo
  echo "## Methodology"
  echo
  echo "- Each endpoint is tested independently at each concurrency level."
  echo "- For each level, the script sends \`${REQUESTS_PER_LEVEL}\` requests."
  if [[ "${RUNNER}" == 'k6' ]]; then
    echo "- Latency metrics are computed by k6 (\`http_req_duration\`)."
    echo "- Success/fail are derived from k6 request + check metrics."
  else
    echo "- k6 is not installed, so this run used curl fallback mode."
    echo "- Latency metrics are computed from curl \`time_total\`."
  fi
  echo "- This script is intended for compare-and-iterate under local constraints."
} > "${REPORT_FILE}"

echo "==> Done"
echo "Report written to: ${REPORT_FILE}"
