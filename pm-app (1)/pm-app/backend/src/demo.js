// Demo dataset covering every scenario in docs/DEMO_SCENARIOS.md.
//
// Loaded automatically on first start when APP_MODE=demo and the database has no workspaces,
// or manually:  node src/seed-demo.js [--reset]
//
// Dates are relative to "now" so sprints, burndown, overdue tasks and the roadmap always look live.
const bcrypt = require('bcryptjs');
const M = require('./models');
const { delegateAndDelete } = require('./services/users');
const { refreshRoles } = require('./auth');
const { DEFAULT_MATRIX } = require('./storyPoints');

const DAY = 86400000;
const DEMO_PASSWORD = 'demo123';
const DEMO_DOMAIN = 'demo.local';

const DEMO_USERS = [
  { key: 'priya', name: 'Priya Nair', role: 'project_manager' },
  { key: 'arjun', name: 'Arjun Menon', role: 'developer' },
  { key: 'sara', name: 'Sara Thomas', role: 'developer' },
  { key: 'rahul', name: 'Rahul Das', role: 'ui_developer' },
  { key: 'meera', name: 'Meera Iyer', role: 'qa' },
  { key: 'vikram', name: 'Vikram Rao', role: 'developer', active: false },
  { key: 'anil', name: 'Anil Kumar', role: 'tech_lead' }, // custom role
  { key: 'divya', name: 'Divya Shah', role: 'stakeholder' }, // custom read-only role
  { key: 'kiran', name: 'Kiran Joseph', role: 'developer' }, // deleted at the end of the seed
];

// Custom roles created by the demo (scenario: "manage roles")
const DEMO_ROLES = [
  {
    key: 'tech_lead', name: 'Tech Lead', color: '#008300',
    description: 'Leads a sub-project: manages tasks and sees every sub-project, but cannot plan sprints or manage structure.',
    permissions: ['projects.view_all', 'tasks.manage', 'tasks.status.any', 'tasks.status.own', 'docs.write', 'docs.delete.any', 'chat.write', 'reports.view', 'reports.export'],
  },
  {
    key: 'scrum_master', name: 'Scrum Master', color: '#eb6834',
    description: 'Runs sprints and ceremonies; exports sprint reports.',
    permissions: ['projects.view_all', 'planning.manage', 'tasks.status.any', 'docs.write', 'chat.write', 'reports.view', 'reports.export'],
  },
  {
    key: 'stakeholder', name: 'Stakeholder', color: '#5c5b57',
    description: 'Read-only: dashboards, sprint analysis and chat.',
    permissions: ['reports.view', 'chat.write'],
  },
];
// hours -> [complexity, size] for the demo (points then come from the matrix)
const toCS = (h) => ({ 2: [1, 1], 3: [2, 1], 4: [2, 3], 5: [3, 1], 6: [3, 3], 8: [4, 2], 10: [4, 3] }[h] || [2, 3]);
// Internal Tools uses its own, finer-grained matrix (per-workspace matrix scenario)
const TOOLS_MATRIX = [
  [1, 1, 2, 3, 5],
  [1, 2, 3, 5, 8],
  [2, 3, 5, 8, 13],
  [3, 5, 8, 13, 20],
  [5, 8, 13, 20, 40],
];
// tasks estimated by hand instead of the matrix (manual-points scenario)
const MANUAL = { 'Code review: grid performance': 2, 'Trace sampling config': 1 };
const emailOf = (key) => `${key}@${DEMO_DOMAIN}`;

// Public list for the login screen (deleted + deactivated users are left out)
const demoAccounts = () => [
  { name: 'Administrator', email: process.env.ADMIN_EMAIL || 'admin@example.com', role: 'admin', password: process.env.ADMIN_PASSWORD || 'admin123' },
  ...DEMO_USERS.filter((u) => u.active !== false && u.key !== 'kiran').map((u) => ({ name: u.name, email: emailOf(u.key), role: u.role, roleName: DEMO_ROLES.find((r) => r.key === u.role)?.name, password: DEMO_PASSWORD })),
];

// bypasses hooks/timestamps so we can back-date records
const rawSet = (Model, id, fields) => Model.collection.updateOne({ _id: id }, { $set: fields });

async function seedDemo({ log = console.log } = {}) {
  const now = Date.now();
  const at = (days, hours = 10) => {
    const d = new Date(now + days * DAY);
    d.setHours(hours, 0, 0, 0);
    return d;
  };

  const admin = await M.User.findOne({ role: 'admin' }).sort({ createdAt: 1 });
  if (!admin) throw new Error('Seed the admin user first');

  // ---------- custom roles ----------
  for (const r of DEMO_ROLES) if (!(await M.Role.exists({ key: r.key }))) await M.Role.create(r);
  await refreshRoles();

  // ---------- users ----------
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const U = { admin };
  for (const d of DEMO_USERS) {
    U[d.key] =
      (await M.User.findOne({ email: emailOf(d.key) })) ||
      (await M.User.create({ name: d.name, email: emailOf(d.key), role: d.role, active: d.active !== false, password: hash }));
  }
  const id = (k) => U[k]._id;

  // ---------- workspaces ----------
  const acme = await M.Workspace.create({
    name: 'Acme Commerce Platform',
    key: 'ACP',
    description: 'Customer-facing e-commerce platform: storefront, checkout, search and payments.',
    owner: id('priya'),
    members: ['priya', 'arjun', 'sara', 'rahul', 'meera', 'vikram', 'anil', 'divya', 'kiran'].map(id),
  });
  // Second workspace that most demo users can NOT see (visibility scenario)
  const tools = await M.Workspace.create({
    name: 'Internal Tools',
    key: 'INT',
    description: 'Back-office tooling. Only Priya and Sara are members. Uses its own story point matrix.',
    pointMatrix: TOOLS_MATRIX,
    owner: id('priya'),
    members: [id('priya'), id('sara')],
  });

  // ---------- sub-projects & modules ----------
  const P = {};
  P.storefront = await M.Project.create({ workspace: acme._id, name: 'Storefront', kind: 'subproject', description: 'Web storefront: catalogue, product pages, cart.', members: ['arjun', 'rahul', 'meera', 'anil', 'kiran'].map(id) });
  P.checkout = await M.Project.create({ workspace: acme._id, parent: P.storefront._id, name: 'Checkout', kind: 'module', description: 'One-page checkout and coupons.', members: ['arjun', 'meera'].map(id) });
  P.search = await M.Project.create({ workspace: acme._id, parent: P.storefront._id, name: 'Product Search', kind: 'module', description: 'Faceted search backed by OpenSearch.', members: [id('sara')] });
  P.payments = await M.Project.create({ workspace: acme._id, name: 'Payments Gateway', kind: 'subproject', description: 'UPI, cards and refunds. Restricted team (PCI scope).', members: ['sara', 'meera'].map(id) });
  P.admin = await M.Project.create({ workspace: tools._id, name: 'Admin Console', kind: 'subproject', description: 'Ops dashboard for support staff.', members: [id('sara')] });

  // default chat channels, as the API would create them
  const CH = {};
  for (const [k, ws, p] of [['acme', acme, null], ['tools', tools, null], ...Object.entries(P).map(([k, p]) => [k, { _id: p.workspace }, p])]) {
    CH[k] = await M.Channel.create({ workspace: ws._id, project: p ? p._id : null, name: 'general', isDefault: true });
  }
  const scopeOf = (k) => (k === 'acme' ? { workspace: acme._id, project: null } : k === 'tools' ? { workspace: tools._id, project: null } : { workspace: P[k].workspace, project: P[k]._id });

  // ---------- sprints ----------
  const S = {};
  const cap = (byKey) => {
    const memberCapacity = Object.entries(byKey).map(([k, points]) => ({ user: id(k), points }));
    return { memberCapacity, capacity: memberCapacity.reduce((a, m) => a + m.points, 0) };
  };
  // Recurring workspace sprint: #1 finished and already rolled over into #2 (active)
  S.ws1 = await M.Sprint.create({ ...scopeOf('acme'), name: 'Platform Sprint 1', sequence: 1, goal: 'Foundations: SSO and logging.', startDate: at(-20, 0), endDate: at(-6, 0), status: 'completed', recurrence: { enabled: true, lengthDays: 14, carryOver: true, spawnedNext: true }, ...cap({ arjun: 6, rahul: 3, sara: 4 }), createdBy: id('priya') });
  S.ws2 = await M.Sprint.create({ ...scopeOf('acme'), name: 'Platform Sprint 2', sequence: 2, goal: 'Finish SSO, ship observability dashboards.', startDate: at(-6, 0), endDate: at(8, 0), status: 'active', recurrence: { enabled: true, lengthDays: 14, carryOver: true }, ...cap({ arjun: 10, sara: 12, meera: 3 }), createdBy: id('priya') });
  // Manual sprints at sub-project / module level
  S.sf = await M.Sprint.create({ ...scopeOf('storefront'), name: 'Storefront Sprint 3', goal: 'Listing redesign + wishlist MVP.', startDate: at(-5, 0), endDate: at(9, 0), status: 'active', ...cap({ arjun: 8, rahul: 13, meera: 3, anil: 3 }), createdBy: id('priya') });
  S.co = await M.Sprint.create({ ...scopeOf('checkout'), name: 'Checkout Sprint 1', goal: 'One-page checkout to beta.', startDate: at(-8, 0), endDate: at(6, 0), status: 'active', capacity: 15, createdBy: id('priya') }); // over-allocated scenario
  S.pay = await M.Sprint.create({ ...scopeOf('payments'), name: 'Payments Sprint 1', goal: 'UPI collect flow.', startDate: at(-10, 0), endDate: at(4, 0), status: 'active', ...cap({ sara: 15, meera: 5 }), createdBy: id('priya') }); // Sara over capacity
  S.pay2 = await M.Sprint.create({ ...scopeOf('payments'), name: 'Payments Sprint 2', goal: 'Refunds.', startDate: at(4, 0), endDate: at(18, 0), status: 'planned', capacity: 20, createdBy: id('priya') });

  // ---------- business features ----------
  const F = {};
  const feature = async (key, scopeKey, title, priority, status, owner, description) =>
    (F[key] = await M.Feature.create({ ...scopeOf(scopeKey), title, priority, status, owner: id(owner), createdBy: id('priya'), description }));
  await feature('sso', 'acme', 'Single sign-on (Google & Microsoft)', 'high', 'in_progress', 'arjun', 'Staff and B2B customers sign in with company accounts.\n\nAcceptance: OIDC login, JIT user provisioning, logout everywhere.');
  await feature('obs', 'acme', 'Platform observability', 'medium', 'in_progress', 'sara', 'Central logs, traces and SLO dashboards for every service.');
  await feature('listing', 'storefront', 'Product listing redesign', 'high', 'in_progress', 'rahul', 'New grid, quick view, lazy images. Lighthouse score ≥ 90 on mobile.');
  await feature('wishlist', 'storefront', 'Wishlist', 'medium', 'approved', 'arjun', 'Logged-in users save products; share a wishlist link.');
  await feature('onepage', 'checkout', 'One-page checkout', 'critical', 'in_progress', 'arjun', 'Address, shipping and payment on a single page. Target: -20% checkout drop-off.');
  await feature('coupons', 'checkout', 'Coupon codes', 'medium', 'proposed', 'arjun', 'Percent and flat discounts, expiry, usage limits.');
  await feature('facets', 'search', 'Faceted search', 'high', 'in_progress', 'sara', 'Filter by brand, price, rating, size; counts per facet.');
  await feature('upi', 'payments', 'UPI payments', 'critical', 'in_progress', 'sara', 'UPI collect + intent flows via the PSP; webhook reconciliation.');
  await feature('refunds', 'payments', 'Refund workflow', 'high', 'approved', 'sara', 'Full and partial refunds with maker-checker approval.');
  await feature('audit', 'admin', 'Audit log viewer', 'low', 'proposed', 'sara', 'Searchable audit trail for support actions.');

  // ---------- tasks ----------
  // [scope, feature, sprint, title, type, status, priority, assignee, estimate, dueInDays, doneDaysAgo]
  const T = [
    ['acme', 'sso', 'ws1', 'Set up OIDC provider configuration', 'task', 'done', 'high', 'arjun', 6, -12, 13],
    ['acme', 'sso', 'ws1', 'Design login page with SSO buttons', 'ui', 'done', 'medium', 'rahul', 4, -11, 12],
    ['acme', 'sso', 'ws2', 'Just-in-time user provisioning', 'story', 'in_progress', 'high', 'arjun', 8, 3],
    ['acme', 'sso', 'ws2', 'Global logout across services', 'task', 'todo', 'medium', 'kiran', 5, 6],
    ['acme', 'sso', 'ws2', 'Test SSO with expired tokens', 'test', 'qa', 'high', 'meera', 3, 2],
    ['acme', 'obs', 'ws1', 'Ship structured JSON logging', 'task', 'done', 'medium', 'sara', 5, -9, 8],
    ['acme', 'obs', 'ws2', 'Grafana SLO dashboards', 'task', 'in_review', 'medium', 'sara', 6, 4],
    ['acme', 'obs', 'ws2', 'Alert routing to on-call', 'task', 'done', 'low', 'sara', 3, 1, 3],
    ['acme', 'obs', 'ws2', 'Trace sampling config', 'task', 'blocked', 'medium', 'arjun', 2, -1],
    ['acme', 'obs', null, 'Evaluate log retention costs', 'task', 'todo', 'low', null, 2, 20],

    ['storefront', 'listing', 'sf', 'New product grid component', 'ui', 'done', 'high', 'rahul', 8, -1, 2],
    ['storefront', 'listing', 'sf', 'Quick-view modal', 'ui', 'in_progress', 'medium', 'rahul', 5, 4],
    ['storefront', 'listing', 'sf', 'Lazy-load product images', 'task', 'done', 'medium', 'arjun', 3, -2, 4],
    ['storefront', 'listing', 'sf', 'Lighthouse audit on mobile', 'test', 'todo', 'medium', 'meera', 2, 7],
    ['storefront', 'listing', 'sf', 'Fix grid overflow on Safari', 'bug', 'in_progress', 'high', 'rahul', 2, -2],
    ['storefront', 'listing', 'sf', 'Code review: grid performance', 'task', 'in_review', 'medium', 'anil', 3, 2],
    ['storefront', 'wishlist', 'sf', 'Wishlist API endpoints', 'story', 'todo', 'medium', 'arjun', 6, 8],
    ['storefront', 'wishlist', null, 'Share-wishlist link design', 'ui', 'todo', 'low', 'rahul', 3, 15],

    ['checkout', 'onepage', 'co', 'Address form with autocomplete', 'story', 'done', 'critical', 'arjun', 8, -4, 6],
    ['checkout', 'onepage', 'co', 'Shipping method selector', 'task', 'done', 'high', 'arjun', 4, -3, 5],
    ['checkout', 'onepage', 'co', 'Payment step integration', 'story', 'in_progress', 'critical', 'arjun', 10, 3],
    ['checkout', 'onepage', 'co', 'End-to-end checkout regression', 'test', 'qa', 'critical', 'meera', 6, 4],
    ['checkout', 'onepage', 'co', 'Double charge on refresh', 'bug', 'in_review', 'critical', 'arjun', 3, -1],
    ['checkout', 'coupons', null, 'Coupon validation rules', 'task', 'todo', 'medium', 'arjun', 5, 12],

    ['search', 'facets', null, 'Index brand/price/rating facets', 'task', 'done', 'high', 'sara', 6, -6, 7],
    ['search', 'facets', null, 'Facet counts API', 'story', 'in_progress', 'high', 'sara', 5, 2],
    ['search', 'facets', null, 'Search relevance test set', 'test', 'todo', 'medium', 'meera', 4, 9],

    ['payments', 'upi', 'pay', 'PSP sandbox integration', 'task', 'done', 'critical', 'sara', 8, -7, 9],
    ['payments', 'upi', 'pay', 'UPI collect request flow', 'story', 'done', 'critical', 'sara', 8, -2, 3],
    ['payments', 'upi', 'pay', 'Webhook signature verification', 'task', 'in_review', 'critical', 'sara', 4, 1],
    ['payments', 'upi', 'pay', 'Reconciliation job', 'task', 'in_progress', 'high', 'sara', 6, 3],
    ['payments', 'upi', 'pay', 'UPI timeout scenarios', 'test', 'qa', 'high', 'meera', 4, 2],
    ['payments', 'refunds', 'pay2', 'Maker-checker approval screen', 'story', 'todo', 'high', 'sara', 8, 14],
    ['payments', 'refunds', 'pay2', 'Partial refund calculation', 'task', 'todo', 'high', null, 5, 16],

    ['admin', 'audit', null, 'Audit log schema', 'task', 'todo', 'low', 'sara', 3, 10],
  ];
  const tasks = [];
  const UNESTIMATED = ['Evaluate log retention costs', 'Partial refund calculation', 'Share-wishlist link design'];
  for (const [sk, fk, spk, title, type, status, priority, who, estimate, due, doneAgo] of T) {
    const t = await M.Task.create({
      ...scopeOf(sk), feature: F[fk]._id, sprint: spk ? S[spk]._id : null, title, type, status, priority,
      assignee: who ? id(who) : null, reporter: id('priya'), estimate, dueDate: at(due, 18),
      ...(() => {
        if (UNESTIMATED.includes(title)) return { points: null, pointsMode: 'manual' };
        const [complexity, size] = toCS(estimate);
        if (MANUAL[title] !== undefined) return { points: MANUAL[title], pointsMode: 'manual', complexity, size };
        const matrix = sk === 'admin' ? TOOLS_MATRIX : DEFAULT_MATRIX;
        return { complexity, size, pointsMode: 'matrix', points: matrix[complexity - 1][size - 1] };
      })(),
      description: `${title}.\n\nPart of "${F[fk].title}".`,
    });
    await rawSet(M.Task, t._id, { completedAt: status === 'done' ? at(-doneAgo, 15) : null, createdAt: at(-21) });
    tasks.push(t);
  }
  const task = (title) => tasks.find((t) => t.title === title);
  const comment = (title, who, text, daysAgo) =>
    M.Task.updateOne({ _id: task(title)._id }, { $push: { comments: { author: id(who), text, at: at(-daysAgo, 12) } } });
  await comment('Double charge on refresh', 'meera', 'Reproduced on Chrome: refresh on the payment step charges twice.', 2);
  await comment('Double charge on refresh', 'arjun', 'Added an idempotency key per order. Please re-test.', 1);
  await comment('Trace sampling config', 'arjun', 'Blocked: waiting for the collector upgrade from infra.', 1);
  await comment('Global logout across services', 'kiran', 'Will start after JIT provisioning lands.', 3);
  await comment('UPI timeout scenarios', 'meera', 'Covering 30s, 2min and 5min PSP timeouts.', 1);

  // ---------- roadmap ----------
  const rm = (sk, title, start, end, status, fk, description) =>
    M.RoadmapItem.create({ ...scopeOf(sk), title, startDate: at(start, 0), endDate: at(end, 0), status, feature: fk ? F[fk]._id : null, createdBy: id('priya'), description });
  await rm('acme', 'Identity & SSO', -30, 10, 'in_progress', 'sso', 'Company logins for staff and B2B.');
  await rm('acme', 'Observability baseline', -20, 20, 'in_progress', 'obs');
  await rm('acme', 'Holiday sale readiness', 15, 45, 'planned', null, 'Load tests, freeze window, war room.');
  await rm('acme', 'Mobile app beta', 50, 110, 'planned');
  await rm('storefront', 'Listing redesign', -15, 10, 'in_progress', 'listing');
  await rm('storefront', 'Wishlist launch', 10, 35, 'planned', 'wishlist');
  await rm('checkout', 'One-page checkout beta', -25, 6, 'in_progress', 'onepage');
  await rm('checkout', 'Coupons', 10, 30, 'planned', 'coupons');
  await rm('payments', 'UPI go-live', -30, 5, 'at_risk', 'upi', 'PSP certification slipping by ~1 week.');
  await rm('payments', 'Refunds', 5, 35, 'planned', 'refunds');
  await rm('payments', 'PSP sandbox', -45, -25, 'done');

  // ---------- docs ----------
  await M.Doc.create({ ...scopeOf('acme'), title: 'Platform overview', author: id('priya'), updatedBy: id('priya'), content: DOC_OVERVIEW });
  await M.Doc.create({ ...scopeOf('acme'), title: 'Release process', author: id('kiran'), updatedBy: id('kiran'), content: DOC_RELEASE });
  await M.Doc.create({ ...scopeOf('storefront'), title: 'Storefront technical spec', author: id('arjun'), updatedBy: id('rahul'), content: DOC_STOREFRONT });
  await M.Doc.create({ ...scopeOf('payments'), title: 'PCI compliance notes', author: id('sara'), updatedBy: id('sara'), content: DOC_PCI });

  // ---------- diagrams ----------
  await M.Diagram.create({ ...scopeOf('acme'), title: 'High-level architecture', kind: 'flowchart', author: id('priya'), source: DIAGRAM_ARCH });
  await M.Diagram.create({ ...scopeOf('checkout'), title: 'Checkout sequence', kind: 'sequence', author: id('arjun'), source: DIAGRAM_CHECKOUT });
  await M.Diagram.create({ ...scopeOf('payments'), title: 'UPI collect flow', kind: 'sequence', author: id('sara'), source: DIAGRAM_UPI });

  // ---------- chat ----------
  const say = async (chKey, who, text, minutesAgo) => {
    const ch = CH[chKey];
    const m = await M.Message.create({ channel: ch._id, workspace: ch.workspace, author: id(who), text });
    const ts = new Date(now - minutesAgo * 60000);
    await rawSet(M.Message, m._id, { createdAt: ts, updatedAt: ts });
  };
  await say('acme', 'priya', 'Welcome to the Acme Commerce Platform workspace 👋 Use this channel for common questions.', 60 * 50);
  await say('acme', 'kiran', 'Where do we document the release checklist?', 60 * 49);
  await say('acme', 'priya', 'Docs tab → "Release process". Kiran, can you keep it updated?', 60 * 48);
  await say('acme', 'kiran', 'Sure, will do.', 60 * 47);
  await say('acme', 'arjun', 'Heads-up: trace sampling task is blocked on the collector upgrade.', 60 * 26);
  await say('acme', 'sara', 'SLO dashboards are in review — feedback welcome.', 60 * 3);
  await say('acme', 'meera', 'QA env is refreshed with today’s build.', 40);
  await say('storefront', 'rahul', 'Quick-view modal designs are attached to the task.', 60 * 30);
  await say('storefront', 'meera', 'Found a grid overflow on Safari, logged as a bug.', 60 * 20);
  await say('storefront', 'arjun', 'Images now lazy-load; LCP dropped ~35%.', 60 * 5);
  await say('checkout', 'meera', 'Double charge bug is reproducible — critical.', 60 * 28);
  await say('checkout', 'arjun', 'Fix is in review, idempotency key per order.', 60 * 6);
  await say('payments', 'sara', 'PSP certification moved by a week; marked UPI go-live at risk.', 60 * 8);
  await say('payments', 'meera', 'Timeout test plan is ready.', 60 * 2);
  await say('tools', 'sara', 'Starting the audit log schema next week.', 60 * 12);

  // ---------- scenario: deleted user → everything delegated to the admin ----------
  const summary = await delegateAndDelete(U.kiran, admin);
  // admin was given Kiran's workspace/sub-project memberships; owner stays Priya

  log(`Demo data loaded. Kiran Joseph deleted → delegated to ${admin.email}: ${JSON.stringify(summary)}`);
  return { workspaces: [acme._id, tools._id] };
}

async function resetDatabase() {
  const collections = [M.Workspace, M.Project, M.Sprint, M.Feature, M.Task, M.RoadmapItem, M.Doc, M.Diagram, M.Channel, M.Message];
  for (const Model of collections) await Model.deleteMany({});
  await M.User.deleteMany({ email: new RegExp(`@${DEMO_DOMAIN.replace('.', '\\.')}$`) });
}

// ---------- content ----------
const DOC_OVERVIEW = `# Acme Commerce Platform

## Goals
- Grow online conversion from 2.1% to 2.6% by Q2
- Cut checkout drop-off by 20% with one-page checkout
- Launch UPI payments for Indian customers

## Structure
| Area | Type | Lead |
|------|------|------|
| Storefront | Sub-project | Arjun Menon |
| ↳ Checkout | Module | Arjun Menon |
| ↳ Product Search | Module | Sara Thomas |
| Payments Gateway | Sub-project | Sara Thomas |

## Ways of working
- Two-week **recurring platform sprints**; sub-projects may run their own sprints.
- Every task belongs to a **business feature**.
- QA moves tasks from *QA* to *Done*.
- Ask common questions in the **Chat** tab.

## Architecture
See the *High-level architecture* diagram in the Diagrams tab.
`;

const DOC_RELEASE = `# Release process

1. Cut a release branch on Monday of the second sprint week.
2. QA signs off the regression suite (see Meera).
3. Deploy to staging, smoke test, then production behind a feature flag.
4. Post release notes in the workspace chat.

> Originally written by Kiran Joseph. Ownership moved to the admin when Kiran's account was deleted.
`;

const DOC_STOREFRONT = `# Storefront technical spec

## Stack
React 18, server-side rendering, CDN image resizing.

## Product grid
- CSS grid, 2 / 3 / 4 columns by breakpoint
- Images lazy-loaded with \`loading="lazy"\` and blur placeholder

## Performance budget
| Metric | Target |
|-------|--------|
| LCP | < 2.5 s |
| CLS | < 0.1 |
| JS (gz) | < 170 KB |
`;

const DOC_PCI = `# PCI compliance notes

- Card data never touches our servers — tokenised by the PSP.
- Webhooks are verified with HMAC-SHA256 signatures.
- Access to the Payments Gateway sub-project is restricted to the payments team.
- Quarterly ASV scans; annual SAQ-A.
`;

const DIAGRAM_ARCH = `flowchart LR
    U[Customer browser] --> CDN[CDN]
    CDN --> SF[Storefront SSR]
    SF --> API[Commerce API]
    API --> CO[Checkout service]
    API --> SR[(OpenSearch)]
    CO --> PAY[Payments gateway]
    PAY --> PSP{{UPI / Card PSP}}
    API --> DB[(MongoDB)]
    API -. logs/traces .-> OBS[Observability stack]`;

const DIAGRAM_CHECKOUT = `sequenceDiagram
    autonumber
    actor C as Customer
    participant UI as Checkout page
    participant API as Checkout API
    participant PAY as Payments gateway
    C->>UI: Fill address & shipping
    UI->>API: POST /orders (idempotency key)
    API-->>UI: order id
    C->>UI: Pay
    UI->>PAY: create payment(order id)
    PAY-->>UI: redirect / UPI intent
    PAY-)API: webhook payment.succeeded
    API-->>UI: order confirmed
    Note over API: Same idempotency key → no double charge`;

const DIAGRAM_UPI = `sequenceDiagram
    autonumber
    actor C as Customer
    participant APP as Storefront
    participant GW as Payments Gateway
    participant PSP as UPI PSP
    participant BANK as Customer bank app
    C->>APP: Choose UPI, enter VPA
    APP->>GW: POST /upi/collect
    GW->>PSP: collect request
    PSP->>BANK: push notification
    BANK-->>C: approve with UPI PIN
    alt approved
        PSP-)GW: webhook SUCCESS (signed)
        GW-->>APP: payment success
    else timeout (5 min)
        PSP-)GW: webhook EXPIRED
        GW-->>APP: ask customer to retry
    end`;

module.exports = { seedDemo, resetDatabase, demoAccounts, DEMO_PASSWORD, DEMO_ROLES };
