// k6 Load Simulation Script — CipherSchools QA Assignment
// Tests the product search API endpoint under realistic load

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ── Custom Metrics ────────────────────────────────────────────────────────────
const errorRate    = new Rate('custom_error_rate');
const searchTrend  = new Trend('search_response_time');

// ── Load Profile: ramp to 20 VUs → hold 30s → ramp down ──────────────────────
export const options = {
  stages: [
    { duration: '10s', target: 20 },  // Ramp up to 20 virtual learners
    { duration: '30s', target: 20 },  // Hold — sustained search load
    { duration: '10s', target: 0  },  // Ramp down gracefully
  ],

  thresholds: {
    // 95th percentile of all requests must be under 2 000 ms
    http_req_duration: ['p(95)<2000'],
    // Error rate must stay below 1%
    custom_error_rate: ['rate<0.01'],
  },

  // Tag all metrics with the environment for Prometheus / Grafana filtering
  tags: { env: __ENV.K6_ENV || 'staging' },
};

// ── Base URL from env — never hardcoded ──────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'https://with-bugs.practicesoftwaretesting.com';
const API_BASE = `${BASE_URL}/api`;   // REST API base

// Search keywords that real learners would use
const KEYWORDS = ['pliers', 'hammer', 'screwdriver', 'wrench', 'bolt', 'drill'];

export default function () {
  const keyword = KEYWORDS[Math.floor(Math.random() * KEYWORDS.length)];
  const url     = `${API_BASE}/products/search?q=${encodeURIComponent(keyword)}&between_price=0,100`;

  const params = {
    headers: {
      'Accept'      : 'application/json',
      'Content-Type': 'application/json',
    },
    tags: { name: 'product_search' },
  };

  const res = http.get(url, params);

  // ── Assertions ──────────────────────────────────────────────────────────────
  const ok = check(res, {
    'status is 200'             : (r) => r.status === 200,
    'response time < 2000ms'    : (r) => r.timings.duration < 2000,
    'body contains data array'  : (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.data) || Array.isArray(body);
      } catch {
        return false;
      }
    },
    'content-type is JSON'      : (r) =>
      (r.headers['Content-Type'] || '').includes('application/json'),
  });

  // Track custom metrics
  errorRate.add(!ok);
  searchTrend.add(res.timings.duration);

  // Simulate realistic user think-time between searches (1–3 s)
  sleep(1 + Math.random() * 2);
}

// ── Summary Callback ──────────────────────────────────────────────────────────
export function handleSummary(data) {
  const p95 = data.metrics.http_req_duration?.values?.['p(95)'] ?? 'N/A';
  const err = data.metrics.custom_error_rate?.values?.rate ?? 'N/A';

  console.log('\n========== THRESHOLD SUMMARY ==========');
  console.log(`  p(95) response time : ${typeof p95 === 'number' ? p95.toFixed(1) + ' ms' : p95}`);
  console.log(`  Error rate          : ${typeof err === 'number' ? (err * 100).toFixed(2) + '%' : err}`);
  console.log('  Thresholds          : p(95)<2000ms | error_rate<1%');
  console.log('=======================================\n');

  return {
    'load/k6/summary.json': JSON.stringify(data, null, 2),
    stdout: '',
  };
}
