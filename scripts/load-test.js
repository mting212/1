// MeetFlow k6 Load Test Script
// Usage: k6 run scripts/load-test.js
// Docs: https://k6.io/docs/

import { check, sleep } from 'k6';
import http from 'k6/http';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const STAGING_URL = __ENV.STAGING_URL || 'https://staging.meetflow.dev';

// ── Scenarios ─────────────────────────────────────────────

export const options = {
  scenarios: {
    // Scenario 1: Steady booking page traffic
    booking_page_browse: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },   // Ramp up to 10 users
        { duration: '1m', target: 10 },     // Stay at 10 users
        { duration: '10s', target: 0 },     // Ramp down
      ],
      gracefulRampDown: '5s',
    },

    // Scenario 2: Booking submission spike
    booking_submit: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 5,
      maxVUs: 20,
      stages: [
        { duration: '10s', target: 1 },     // Warm up
        { duration: '30s', target: 5 },     // 5 bookings/sec
        { duration: '10s', target: 0 },     // Cool down
      ],
    },

    // Scenario 3: API health check (constant low traffic)
    health_check: {
      executor: 'constant-arrival-rate',
      rate: 2,
      timeUnit: '1s',
      duration: '1m',
      preAllocatedVUs: 2,
    },
  },
  thresholds: {
    // Booking page: 95% of requests under 3s
    'http_req_duration{scenario:booking_page_browse}': ['p(95)<3000'],
    // Booking submit: 95% of requests under 2s
    'http_req_duration{scenario:booking_submit}': ['p(95)<2000'],
    // Health check: all requests under 200ms
    'http_req_duration{scenario:health_check}': ['p(99)<200'],
    // Error rate: less than 1%
    'http_req_failed': ['rate<0.01'],
  },
};

// ── Helpers ───────────────────────────────────────────────

function randomSlug() {
  const slugs = ['test/30min', 'demo/15min', 'meeting/60min'];
  return slugs[Math.floor(Math.random() * slugs.length)];
}

function randomAttendee() {
  const id = Math.random().toString(36).substring(7);
  return {
    name: `Test User ${id}`,
    email: `test-${id}@example.com`,
    timezone: 'Asia/Shanghai',
  };
}

// ── Test Functions ────────────────────────────────────────

export function setup() {
  // Verify the target is reachable before starting tests
  const res = http.get(`${BASE_URL}/api/trpc/health`);
  check(res, {
    'health endpoint reachable': (r) => r.status === 200,
  });
  return { baseUrl: BASE_URL };
}

export default function (data) {
  // This function is shared by all scenarios.
  // The exec handles are specified in scenario definitions below.
}

// ── Scenario Handlers ─────────────────────────────────────

// Scenario 1: Browse booking pages
export function bookingPageBrowse() {
  const slug = randomSlug();
  const res = http.get(`${BASE_URL}/${slug}`, {
    headers: { 'Accept': 'text/html' },
  });

  check(res, {
    'booking page loads': (r) => r.status === 200,
    'contains calendar grid': (r) => r.body.includes('calendar') || r.body.includes('grid'),
  });

  sleep(3); // Simulate user reading the page
}

// Scenario 2: Submit bookings
export function bookingSubmit() {
  const attendee = randomAttendee();
  const now = new Date();
  // Pick a time slot 2 days from now at 10:00
  const startTime = new Date(now.getTime() + 2 * 86400000);
  startTime.setHours(10, 0, 0, 0);
  const endTime = new Date(startTime.getTime() + 30 * 60000);

  const payload = JSON.stringify({
    schedule_link_slug: 'test/30min',
    start_time: startTime.toISOString(),
    end_time: endTime.toISOString(),
    attendee_name: attendee.name,
    attendee_email: attendee.email,
    attendee_timezone: attendee.timezone,
  });

  const res = http.post(`${BASE_URL}/api/trpc/booking.create`, payload, {
    headers: {
      'Content-Type': 'application/json',
      'trpc-batch-mode': 'false',
    },
  });

  check(res, {
    'booking submit responds': (r) => r.status === 200 || r.status === 409,
  });
}

// Scenario 3: Health check
export function healthCheck() {
  const res = http.get(`${BASE_URL}/api/trpc/health`);
  check(res, {
    'health returns ok': (r) => r.status === 200 && r.json('result.data.status') === 'ok',
  });
}

// ── Teardown ──────────────────────────────────────────────

export function teardown(data) {
  console.log('Load test complete.');
}
