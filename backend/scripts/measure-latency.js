// Measures response time of GET /api/tickets?limit=100 (SOLUTION.md part C).
// Runs each query 40 times after a warm-up and prints median and p95 in ms.
// Usage: node scripts/measure-latency.js [apiUrl] [email] [password]
const API = process.argv[2] || 'http://localhost:4000/api';
const EMAIL = process.argv[3] || 'user@triagesync.test';
const PASSWORD = process.argv[4] || 'User@123';
const RUNS = 40;

const QUERIES = [
  'limit=100',
  'limit=100&status=OPEN&priority=HIGH',
  'limit=100&q=crash',
  'limit=100&category=BILLING&q=refund',
];

function percentile(sorted, p) {
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

async function main() {
  const login = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  }).then((r) => r.json());
  const headers = { Authorization: `Bearer ${login.token}` };

  for (const query of QUERIES) {
    const url = `${API}/tickets?${query}`;
    for (let i = 0; i < 5; i++) await fetch(url, { headers }); // warm-up

    const times = [];
    let total = 0;
    for (let i = 0; i < RUNS; i++) {
      const start = performance.now();
      const body = await fetch(url, { headers }).then((r) => r.json());
      times.push(performance.now() - start);
      total = body.total;
    }
    times.sort((a, b) => a - b);
    console.log(
      `${query.padEnd(38)} total=${String(total).padEnd(5)} median=${percentile(times, 50).toFixed(1)}ms  p95=${percentile(times, 95).toFixed(1)}ms`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
