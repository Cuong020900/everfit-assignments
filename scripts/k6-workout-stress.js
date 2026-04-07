import http from 'k6/http';
import { check } from 'k6';

const baseUrl = __ENV.API_BASE_URL || 'http://localhost:3000';
const endpointPath = __ENV.ENDPOINT_PATH || '/workouts';
const timeout = __ENV.K6_TIMEOUT || '30s';

const vus = Number(__ENV.VUS || 10);
const iterations = Number(__ENV.ITERATIONS || 200);

export const options = {
  vus,
  iterations,
  noConnectionReuse: false,
};

export default function () {
  const res = http.get(`${baseUrl}${endpointPath}`, {
    timeout,
    tags: { endpoint: endpointPath },
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
  });
}
