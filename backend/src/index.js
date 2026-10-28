const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const bcrypt = require('bcryptjs');
const M = require('./models');
const scoped = require('./routes/scoped');
const { startScheduler } = require('./scheduler');
const { publishToScope } = require('./events');
const { seedDemo, demoAccounts, resetDatabase } = require('./demo');
const { requireAuth, requirePerm, httpError, ensureSystemRoles } = require('./auth');

const PORT = process.env.PORT || 4000;
// APP_MODE=demo -> sample data, demo logins, reset button.  APP_MODE=live -> clean install.
const APP_MODE = process.env.APP_MODE === 'demo' ? 'demo' : 'live';
const IS_DEMO = APP_MODE === 'demo';
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/pmapp';

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(morgan('dev', { skip: (req) => req.path === '/api/events' }));

const live = (kind) => ({
  afterSave: (req, doc) => publishToScope(doc.workspace, doc.project, 'scope.changed', { kind }),
  afterDelete: (req, doc) => publishToScope(doc.workspace, doc.project, 'scope.changed', { kind }),
});

app.get('/api/health', (req, res) => res.json({ ok: true }));
// Public app config: mode + (demo only) the demo accounts for the login screen
app.get('/api/config', (req, res) => {
  res.json({ mode: APP_MODE, accounts: IS_DEMO ? demoAccounts() : [] });
});
// Demo only: wipe and reload the demo dataset (admin)
app.post('/api/demo/reset', requireAuth, requirePerm('users.manage'), async (req, res) => {
  if (!IS_DEMO) throw httpError(404, 'Not available in live mode');
  await resetDatabase();
  await seedDemo();
  res.json({ ok: true });
});
app.use('/api/auth', require('./routes/auth'));
app.use('/api/events', require('./routes/events'));
app.use('/api/users', require('./routes/users'));
app.use('/api/roles', require('./routes/roles'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/workspaces', require('./routes/workspaces'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/dashboard', require('./routes/dashboard'));

app.use('/api/sprints', require('./routes/sprintReports').router); // report/velocity/CSV routes first
app.use('/api/sprints', scoped(M.Sprint, {
  authorField: 'createdBy',
  sort: { startDate: -1 },
  populate: [{ path: 'memberCapacity.user', select: 'name role' }],
  beforeSave: (req, body) => {
    if (Array.isArray(body.memberCapacity)) {
      body.memberCapacity = body.memberCapacity
        .filter((m) => m && m.user && Number(m.points) > 0)
        .map((m) => ({ user: m.user._id || m.user, points: Number(m.points) }));
      const sum = body.memberCapacity.reduce((a, m) => a + m.points, 0);
      if (sum > 0) body.capacity = sum; // per-member split defines the total
    }
    if (body.capacity !== undefined) body.capacity = Math.max(0, Number(body.capacity) || 0);
  },
  ...live('sprint'),
}));
app.use('/api/features', scoped(M.Feature, {
  authorField: 'createdBy',
  populate: [{ path: 'owner', select: 'name' }],
  filters: ['status', 'priority'],
  ...live('feature'),
}));
app.use('/api/roadmap', scoped(M.RoadmapItem, {
  authorField: 'createdBy',
  populate: [{ path: 'feature', select: 'title' }],
  sort: { startDate: 1 },
  ...live('roadmap'),
}));
app.use('/api/docs', scoped(M.Doc, {
  write: 'member',
  authorField: 'author',
  populate: [{ path: 'author', select: 'name' }, { path: 'updatedBy', select: 'name' }],
  sort: { updatedAt: -1 },
  beforeSave: (req, body) => { body.updatedBy = req.user._id; },
}));
app.use('/api/diagrams', scoped(M.Diagram, {
  write: 'member',
  authorField: 'author',
  populate: [{ path: 'author', select: 'name' }],
  sort: { updatedAt: -1 },
}));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  let status = err.status || 500;
  let message = err.message;
  if (err.name === 'ValidationError' || err.name === 'CastError') status = 400;
  if (err.code === 11000) { status = 409; message = 'Duplicate value'; }
  if (status >= 500) console.error(err);
  if (!res.headersSent) res.status(status).json({ error: message });
});

async function seedAdmin() {
  if (await M.User.exists({ role: 'admin' })) return;
  const email = process.env.ADMIN_EMAIL || 'admin@example.com';
  const password = process.env.ADMIN_PASSWORD || (IS_DEMO ? 'admin123' : null);
  if (!password) throw new Error('Live mode needs ADMIN_PASSWORD for the first admin. Set it in .env');
  await M.User.create({ name: 'Administrator', email, role: 'admin', password: await bcrypt.hash(password, 10) });
  console.log(`Seeded admin user ${email}`);
}

async function main() {
  if (!IS_DEMO && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16)) {
    throw new Error('Live mode needs JWT_SECRET (16+ characters). Set it in .env');
  }
  await mongoose.connect(MONGO_URL);
  console.log(`MongoDB connected · mode: ${APP_MODE}`);
  await ensureSystemRoles();
  await seedAdmin();
  if (IS_DEMO && !(await M.Workspace.exists({}))) {
    console.log('Demo mode with an empty database: loading demo data…');
    await seedDemo();
  }
  startScheduler();
  app.listen(PORT, () => console.log(`API listening on :${PORT}`));
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { app, main, seedAdmin };
