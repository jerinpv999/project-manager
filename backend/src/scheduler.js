// Activates planned sprints and rolls recurring sprints forward.
const { Sprint, Task } = require('./models');

const DAY = 86400000;

function nextName(name, seq) {
  const m = name.match(/^(.*?)(\d+)\s*$/);
  return m ? `${m[1]}${Number(m[2]) + 1}` : `${name} #${seq + 1}`;
}

async function tick() {
  const now = new Date();
  await Sprint.updateMany(
    { status: 'planned', startDate: { $lte: now }, endDate: { $gt: now } },
    { status: 'active' }
  );

  const ended = await Sprint.find({ status: { $ne: 'completed' }, endDate: { $lte: now } });
  for (const s of ended) {
    s.status = 'completed';
    if (s.recurrence?.enabled && !s.recurrence.spawnedNext) {
      const len = s.recurrence.lengthDays || Math.max(1, Math.round((s.endDate - s.startDate) / DAY));
      const startDate = new Date(s.endDate);
      const endDate = new Date(startDate.getTime() + len * DAY);
      const next = await Sprint.create({
        workspace: s.workspace,
        project: s.project,
        name: nextName(s.name, s.sequence || 1),
        sequence: (s.sequence || 1) + 1,
        goal: '',
        startDate,
        endDate,
        status: startDate <= now && endDate > now ? 'active' : 'planned',
        recurrence: { enabled: true, lengthDays: len, carryOver: s.recurrence.carryOver },
        createdBy: s.createdBy,
      });
      if (s.recurrence.carryOver) {
        await Task.updateMany({ sprint: s._id, status: { $ne: 'done' } }, { sprint: next._id });
      }
      s.recurrence.spawnedNext = true;
      console.log(`[scheduler] recurring sprint "${s.name}" -> "${next.name}"`);
    }
    await s.save();
  }
}

function startScheduler(intervalMs = 60000) {
  const run = () => tick().catch((e) => console.error('[scheduler]', e));
  run();
  return setInterval(run, intervalMs);
}

module.exports = { startScheduler, tick };
