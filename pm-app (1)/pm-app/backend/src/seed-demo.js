// CLI: load the demo dataset.
//   node src/seed-demo.js          -> adds demo data (skips if demo workspace already exists)
//   node src/seed-demo.js --reset  -> wipes all workspaces/projects/tasks/... and demo users, then reloads
// In Docker:  docker compose exec backend node src/seed-demo.js --reset
const mongoose = require('mongoose');
const M = require('./models');
const { seedDemo, resetDatabase } = require('./demo');
const { seedAdmin } = require('./index');
const { ensureSystemRoles } = require('./auth');

(async () => {
  await mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost:27017/pmapp');
  if (process.argv.includes('--reset')) {
    await resetDatabase();
    console.log('Database reset (admin users kept).');
  } else if (await M.Workspace.exists({ key: 'ACP', name: 'Acme Commerce Platform' })) {
    console.log('Demo workspace already exists. Use --reset to reload it.');
    process.exit(0);
  }
  await ensureSystemRoles();
  await seedAdmin();
  await seedDemo();
  await mongoose.disconnect();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
