// Loads many synthetic tickets through the real import service, so we can
// measure API speed on a realistic amount of data (SOLUTION.md part C).
// Idempotent: ids are PERF-00001..., so running it again only updates them.
// Usage: node scripts/generate-tickets.js [count]   (default 2000)
const { importTickets } = require('../src/services/ticketImport');
const pool = require('../src/db/pool');

const SUBJECTS = [
  'Refund for order', 'Invoice missing VAT', 'Cannot login on mobile', 'Password reset link expired',
  'Package not arrived yet', 'Tracking shows wrong city', 'App crash when saving', 'Error 500 on dashboard',
  'Add export to PDF', 'Feature idea: team tags', 'Locked out after update', 'Payment declined twice',
];
const BODIES = [
  'Customer reports the issue started after the latest release.',
  'Happens every time on Chrome and Safari, screenshots attached.',
  'This is blocking our finance team, please look at it soon.',
  'Not urgent, but several users asked about it this week.',
];

async function main() {
  const count = Number(process.argv[2]) || 2000;
  const tickets = Array.from({ length: count }, (_, i) => ({
    externalId: `PERF-${String(i + 1).padStart(5, '0')}`,
    subject: `${SUBJECTS[i % SUBJECTS.length]} #${i + 1}`,
    body: `${BODIES[i % BODIES.length]} Reference ${i * 7919 % 100000}.`,
  }));

  // The import endpoint accepts up to 1000 tickets per call
  for (let i = 0; i < tickets.length; i += 1000) {
    const result = await importTickets({ tickets: tickets.slice(i, i + 1000) });
    console.log(result);
  }
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
