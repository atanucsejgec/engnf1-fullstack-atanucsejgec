// Fixed demo data used by seed.js (spec section 6.1).

const users = [
  { name: 'Admin Lead', email: 'admin@triagesync.test', password: 'Admin@123', role: 'ADMIN' },
  { name: 'Agent Demo', email: 'user@triagesync.test', password: 'User@123', role: 'USER' },
];

// At least 2 of each type, at least 1 inactive
const resources = [
  { name: 'Huddle Room A', type: 'ROOM', capacity: 6, description: 'Small room with a screen for live troubleshooting calls.' },
  { name: 'War Room', type: 'ROOM', capacity: 20, description: 'Large room for incident response and team triage sessions.' },
  { name: 'Quiet Booth 3', type: 'ROOM', capacity: 1, description: 'Single-person booth, closed for renovation.', isActive: false },
  { name: 'Network Lab', type: 'LAB', capacity: 8, description: 'Routers, switches and packet capture tools.' },
  { name: 'Mobile Device Lab', type: 'LAB', capacity: 4, description: 'iOS and Android test devices for reproducing app bugs.' },
  { name: 'Oscilloscope Kit', type: 'EQUIPMENT', capacity: 1, description: 'Portable oscilloscope for hardware diagnostics.' },
  { name: 'Diagnostic Laptop Pool', type: 'EQUIPMENT', capacity: 5, description: 'Pre-imaged laptops with log analysis tools.' },
  { name: 'Legacy Printer Rig', type: 'EQUIPMENT', capacity: 2, description: 'Old printer test rig, retired.', isActive: false },
];

// category/priority are filled by the classifier, unless "priority" is given
// here (the classifier never outputs LOW, so we set it for a few tickets).
// "review" simulates an agent who already reviewed the ticket.
const tickets = [
  { externalId: 'SEED-001', subject: 'Refund for duplicate charge', body: 'I was charged twice for my March invoice, please refund one payment.' },
  { externalId: 'SEED-002', subject: 'Invoice address is wrong', body: 'The invoice shows my old company address. Can you update it?', priority: 'LOW' },
  { externalId: 'SEED-003', subject: 'Locked out after 2FA reset', body: 'I reset my phone and now I am locked out of my account.' },
  { externalId: 'SEED-004', subject: 'Forgot password email never comes', body: 'The reset password email does not arrive in my inbox or spam.' },
  { externalId: 'SEED-005', subject: 'My package has not arrived', body: 'Order #4412 was supposed to come on Monday. Tracking has not updated.' },
  { externalId: 'SEED-006', subject: 'Shipping to Canada', body: 'Do you offer shipping to Canada and how long does it take?', priority: 'LOW' },
  { externalId: 'SEED-007', subject: 'App crash on photo upload', body: 'The Android app crashes every time I attach a photo to a report.' },
  { externalId: 'SEED-008', subject: 'URGENT: production down for our team', body: 'Dashboard returns 500 for every request since 9am. Whole team blocked.' },
  { externalId: 'SEED-009', subject: 'Export reports to CSV', body: 'It would help us a lot if reports could be downloaded as CSV files.', priority: 'LOW' },
  { externalId: 'SEED-010', subject: 'Dark mode please', body: 'Our agents work night shifts, a dark theme would be easier on the eyes.' },
  { externalId: 'SEED-011', subject: '<script>alert("xss")</script> Help', body: 'Body with <b>bold</b> and <img src=x onerror=alert(1)> tags that must show as plain text.' },
  { externalId: 'SEED-012', subject: 'Search results look broken', body: 'Searching for "50% off" shows an error page with an exception trace.' },
  { externalId: 'SEED-013', subject: 'Payment failed but money taken', body: 'My card payment failed at checkout but the bank shows the charge.' },
  { externalId: 'SEED-014', subject: 'Cannot sign in with SSO', body: 'Clicking sign in with Google just reloads the login page.' },
  { externalId: 'SEED-015', subject: 'Delivery to wrong address', body: 'The courier left my delivery at the neighbour building.' },
  { externalId: 'SEED-016', subject: 'Bulk edit tickets', body: 'Please let us select many tickets and change their status at once.', priority: 'LOW' },
  // Already reviewed by an agent (isReviewed = true)
  { externalId: 'SEED-017', subject: 'Charge on card for trial', body: 'The free trial should not have cost anything but I see a payment.',
    review: { status: 'IN_PROGRESS' } },
  { externalId: 'SEED-018', subject: 'Login page shows error', body: 'After entering my password I get a generic error message.',
    review: { status: 'RESOLVED' } },
  { externalId: 'SEED-019', subject: 'Tracking link gives error', body: 'The tracking page for my order shows an error instead of the map.',
    review: { category: 'BUG', status: 'IN_PROGRESS' } },
];

module.exports = { users, resources, tickets };
