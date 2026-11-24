// Concurrency check for rule B6.
// Sends 10 booking requests for the SAME slot at the same moment and prints
// the status codes. Expected result: exactly one 201, all others 409.
//
// Usage: node scripts/race-test.js [apiUrl]
//   apiUrl defaults to http://localhost:4000/api
const API = process.argv[2] || 'http://localhost:4000/api';
const REQUESTS = 10;

async function call(method, path, token, body) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

// Registers (if needed) and logs in a throwaway test user
async function getToken(i) {
  const email = `race.tester${i}@triagesync.test`;
  await call('POST', '/auth/register', null, { name: `Race Tester ${i}`, email, password: 'Race12345' });
  const login = await call('POST', '/auth/login', null, { email, password: 'Race12345' });
  return login.data.token;
}

// A random :00/:30 slot between 2 and 25 days from now, so repeated runs don't collide
function randomSlot() {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + 2 + Math.floor(Math.random() * 23));
  start.setUTCHours(Math.floor(Math.random() * 20), Math.random() < 0.5 ? 0 : 30, 0, 0);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  return { startTime: start.toISOString(), endTime: end.toISOString() };
}

async function race(label, tokens, resourceId) {
  const slot = randomSlot();
  const results = await Promise.all(
    tokens.map((token) => call('POST', '/bookings', token, { resourceId, ...slot, purpose: 'Concurrency test' }))
  );
  const counts = {};
  for (const r of results) counts[r.status] = (counts[r.status] || 0) + 1;
  const ok = counts[201] === 1 && counts[409] === REQUESTS - 1;
  console.log(`${label}: ${JSON.stringify(counts)} -> ${ok ? 'PASS' : 'FAIL'}`);

  // Clean up: cancel the winning booking so test users don't hit the 3-booking limit
  const winner = results.find((r) => r.status === 201);
  const winnerToken = tokens[results.indexOf(winner)];
  if (winner) await call('PATCH', `/bookings/${winner.data.id}/cancel`, winnerToken);
  return ok;
}

async function main() {
  const tokens = await Promise.all(Array.from({ length: REQUESTS }, (_, i) => getToken(i + 1)));
  const resources = await call('GET', '/resources', tokens[0]);
  const resourceId = resources.data.data[0].id;

  const a = await race('Same user x10     ', Array(REQUESTS).fill(tokens[0]), resourceId);
  const b = await race('10 different users', tokens, resourceId);
  process.exit(a && b ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
