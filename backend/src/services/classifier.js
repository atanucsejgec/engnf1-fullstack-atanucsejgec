// Deterministic auto-triage (rule T-B1).
// "Deterministic" = the same subject + body always gives the same result.
// Rules are checked top to bottom and the FIRST match wins, so the order
// of CATEGORY_RULES matters (e.g. a refund about a package is BILLING).

const CATEGORY_RULES = [
  { category: 'BILLING', keywords: ['refund', 'invoice', 'charge', 'payment'] },
  { category: 'LOGIN', keywords: ['password', '2fa', 'sign in', 'locked out', 'login'] },
  { category: 'DELIVERY', keywords: ['package', 'arrived', 'shipping', 'tracking', 'delivery'] },
  { category: 'BUG', keywords: ['crash', 'error', '500', 'exception', 'broken'] },
];

const PRIORITY_RULES = [
  { priority: 'URGENT', keywords: ['urgent', 'production down', 'locked out'] },
  { priority: 'HIGH', keywords: ['error', 'refund', 'not arrived'] },
];

function findMatch(rules, text, key, fallback) {
  const rule = rules.find((r) => r.keywords.some((word) => text.includes(word)));
  return rule ? rule[key] : fallback;
}

function classifyTicket(subject, body) {
  // Lowercase so "REFUND" and "Refund" both match
  const text = `${subject} ${body}`.toLowerCase();
  return {
    category: findMatch(CATEGORY_RULES, text, 'category', 'FEATURE_REQUEST'),
    priority: findMatch(PRIORITY_RULES, text, 'priority', 'MEDIUM'),
  };
}

module.exports = { classifyTicket };
