// The incoming ticket feed that the "Re-import feed" button sends to
// POST /api/tickets/import. It is INPUT for the API, not display data:
// everything on screen still comes from the database.
//
// SEED-xxx ids already exist (seeded), so re-importing them must NOT create
// duplicates. FEED-xxx ids are new the first time and updates afterwards.
export const ticketFeed = [
  { externalId: 'SEED-001', subject: 'Refund for duplicate charge', body: 'I was charged twice for my March invoice, please refund one payment.' },
  { externalId: 'SEED-005', subject: 'My package has not arrived', body: 'Order #4412 was supposed to come on Monday. Tracking has not updated.' },
  { externalId: 'SEED-019', subject: 'Tracking link gives error', body: 'The tracking page for my order shows an error instead of the map.' },
  { externalId: 'FEED-101', subject: 'Refund not received after 10 days', body: 'You approved my refund but nothing reached my bank account yet.' },
  { externalId: 'FEED-102', subject: 'Cannot login after password change', body: 'I changed my password yesterday and the login page keeps rejecting it.' },
  { externalId: 'FEED-103', subject: 'Package arrived damaged', body: 'The box was crushed and the delivery driver did not wait for a signature.' },
  { externalId: 'FEED-104', subject: 'Urgent: checkout throws exception', body: 'Every customer gets an exception page at checkout. This is costing us sales.' },
  { externalId: 'FEED-105', subject: 'Add keyboard shortcuts', body: 'Power users would love shortcuts for moving between tickets.' },
  { externalId: 'FEED-106', subject: 'Locked out of admin panel', body: 'Our only admin is locked out and we cannot add new staff.' },
  { externalId: 'FEED-107', subject: 'Invoice PDF is blank', body: 'Downloading last month invoice gives an empty PDF file.' },
  { externalId: 'FEED-108', subject: 'Where is my tracking number?', body: 'The confirmation email did not include any tracking number for shipping.' },
]
