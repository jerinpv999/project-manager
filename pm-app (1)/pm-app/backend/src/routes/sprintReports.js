// Sprint analysis: story-point allocation vs completion, per employee, with CSV export.
//
// GET /api/sprints/velocity?workspace=&project=          committed vs completed per sprint
// GET /api/sprints/export/csv?workspace=&project=[&all=1] every sprint × employee (CSV)
// GET /api/sprints/:id/report                             full analysis (JSON)
// GET /api/sprints/:id/report/csv?type=members|tasks      one sprint (CSV)
const express = require('express');
const M = require('../models');
const { requireAuth, requirePerm, httpError } = require('../auth');
const { assertScope, descendantIds } = require('../access');

const router = express.Router();
router.use(requireAuth);
const DAY = 86400000;

const pts = (t) => Number(t.points) || 0;
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

async function buildReport(sprint) {
  const tasks = await M.Task.find({ sprint: sprint._id })
    .populate('assignee', 'name email role')
    .populate('feature', 'title')
    .populate('project', 'name')
    .sort({ status: 1, title: 1 });
  await sprint.populate('memberCapacity.user', 'name email role');

  const committed = tasks.reduce((s, t) => s + pts(t), 0);
  const done = tasks.filter((t) => t.status === 'done');
  const completed = done.reduce((s, t) => s + pts(t), 0);
  const memberCapTotal = (sprint.memberCapacity || []).reduce((s, m) => s + (Number(m.points) || 0), 0);
  const capacity = sprint.capacity || memberCapTotal;

  // per employee
  const rows = new Map();
  const row = (u) => {
    const k = u ? String(u._id) : 'unassigned';
    if (!rows.has(k))
      rows.set(k, {
        userId: u ? u._id : null, name: u ? u.name : 'Unassigned', email: u ? u.email : '', role: u ? u.role : '',
        capacity: 0, tasks: 0, tasksDone: 0, allocated: 0, completed: 0, remaining: 0,
      });
    return rows.get(k);
  };
  for (const m of sprint.memberCapacity || []) if (m.user) row(m.user).capacity = Number(m.points) || 0;
  for (const t of tasks) {
    const r = row(t.assignee);
    r.tasks += 1;
    r.allocated += pts(t);
    if (t.status === 'done') { r.tasksDone += 1; r.completed += pts(t); }
  }
  const members = [...rows.values()].map((r) => ({
    ...r,
    remaining: r.allocated - r.completed,
    completionPct: pct(r.completed, r.allocated),
    loadPct: r.capacity ? pct(r.allocated, r.capacity) : null,
    overAllocated: r.capacity > 0 && r.allocated > r.capacity,
  })).sort((a, b) => (a.userId ? 0 : 1) - (b.userId ? 0 : 1) || b.allocated - a.allocated);

  // points by status
  const byStatus = M.TASK_STATUSES.map((s) => ({
    status: s,
    points: tasks.filter((t) => t.status === s).reduce((a, t) => a + pts(t), 0),
    tasks: tasks.filter((t) => t.status === s).length,
  }));

  // story-point burndown
  const now = new Date();
  const days = Math.max(1, Math.ceil((sprint.endDate - sprint.startDate) / DAY));
  const burndown = [];
  for (let i = 0; i <= days; i++) {
    const d = new Date(sprint.startDate.getTime() + i * DAY);
    const burned = done.filter((t) => t.completedAt && t.completedAt <= d).reduce((a, t) => a + pts(t), 0);
    burndown.push({
      day: day(d),
      ideal: Math.round((committed - (committed * i) / days) * 10) / 10,
      remaining: d <= now ? committed - burned : null,
    });
  }

  return {
    sprint: {
      _id: sprint._id, name: sprint.name, status: sprint.status, goal: sprint.goal,
      startDate: sprint.startDate, endDate: sprint.endDate, workspace: sprint.workspace, project: sprint.project,
    },
    totals: {
      capacity,
      committed,
      completed,
      remaining: committed - completed,
      completionPct: pct(completed, committed),
      loadPct: capacity ? pct(committed, capacity) : null,
      overAllocated: capacity > 0 && committed > capacity,
      tasks: tasks.length,
      tasksDone: done.length,
      unestimated: tasks.filter((t) => t.points === null || t.points === undefined).length,
    },
    members,
    byStatus,
    burndown,
    tasks: tasks.map((t) => ({
      _id: t._id, title: t.title, status: t.status, points: t.points, pointsMode: t.pointsMode, complexity: t.complexity, size: t.size, type: t.type, priority: t.priority,
      assignee: t.assignee ? t.assignee.name : 'Unassigned', assigneeId: t.assignee?._id || null,
      feature: t.feature?.title || '', project: t.project?.name || '', completedAt: t.completedAt,
    })),
  };
}

// ---------- CSV ----------
const esc = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (header, rows) => '﻿' + [header, ...rows].map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n';
const sendCsv = (res, filename, csv) => {
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
};
const fileSafe = (s) => String(s).replace(/[^\w.-]+/g, '_');

const MEMBER_HEADER = ['Sprint', 'Sprint status', 'Start', 'End', 'Employee', 'Email', 'Role', 'Capacity (pts)', 'Allocated (pts)', 'Completed (pts)', 'Remaining (pts)', 'Completion %', 'Load % of capacity', 'Tasks', 'Tasks done'];
const memberRows = (rep) => rep.members.map((m) => [
  rep.sprint.name, rep.sprint.status, day(rep.sprint.startDate), day(rep.sprint.endDate),
  m.name, m.email, m.role, m.capacity, m.allocated, m.completed, m.remaining, m.completionPct, m.loadPct ?? '', m.tasks, m.tasksDone,
]);
const totalRow = (rep) => [
  rep.sprint.name, rep.sprint.status, day(rep.sprint.startDate), day(rep.sprint.endDate),
  'TOTAL', '', '', rep.totals.capacity, rep.totals.committed, rep.totals.completed, rep.totals.remaining, rep.totals.completionPct, rep.totals.loadPct ?? '', rep.totals.tasks, rep.totals.tasksDone,
];

async function loadSprint(req) {
  const sprint = await M.Sprint.findById(req.params.id);
  if (!sprint) throw httpError(404, 'Sprint not found');
  await assertScope(req.user, sprint.workspace, sprint.project);
  return sprint;
}

async function sprintsInScope(req) {
  const { workspace, project, all } = req.query;
  const { ws, p } = await assertScope(req.user, workspace, project);
  const q = { workspace: ws._id };
  if (all === '1') { if (p) q.project = { $in: [p._id, ...(await descendantIds(p._id))] }; }
  else q.project = p ? p._id : null;
  return { sprints: await M.Sprint.find(q).sort({ startDate: 1 }), ws, p };
}

router.get('/velocity', requirePerm('reports.view'), async (req, res) => {
  const { sprints } = await sprintsInScope(req);
  const agg = await M.Task.aggregate([
    { $match: { sprint: { $in: sprints.map((s) => s._id) } } },
    {
      $group: {
        _id: '$sprint',
        committed: { $sum: { $ifNull: ['$points', 0] } },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, { $ifNull: ['$points', 0] }, 0] } },
      },
    },
  ]);
  const by = new Map(agg.map((a) => [String(a._id), a]));
  res.json(sprints.map((s) => {
    const a = by.get(String(s._id)) || { committed: 0, completed: 0 };
    const cap = s.capacity || (s.memberCapacity || []).reduce((x, m) => x + (Number(m.points) || 0), 0);
    return { _id: s._id, name: s.name, status: s.status, startDate: s.startDate, capacity: cap, committed: a.committed, completed: a.completed };
  }));
});

router.get('/export/csv', requirePerm('reports.export'), async (req, res) => {
  const { sprints, ws, p } = await sprintsInScope(req);
  const rows = [];
  for (const s of sprints) {
    const rep = await buildReport(s);
    rows.push(...memberRows(rep), totalRow(rep));
  }
  sendCsv(res, `${fileSafe(p ? p.name : ws.name)}_sprint_points.csv`, toCsv(MEMBER_HEADER, rows));
});

router.get('/:id/report', requirePerm('reports.view'), async (req, res) => {
  res.json(await buildReport(await loadSprint(req)));
});

router.get('/:id/report/csv', requirePerm('reports.export'), async (req, res) => {
  const rep = await buildReport(await loadSprint(req));
  if (req.query.type === 'tasks') {
    const header = ['Sprint', 'Task', 'Sub-project/module', 'Business feature', 'Type', 'Priority', 'Assignee', 'Status', 'Points mode', 'Complexity', 'Size', 'Story points', 'Completed on'];
    const rows = rep.tasks.map((t) => [rep.sprint.name, t.title, t.project, t.feature, t.type, t.priority, t.assignee, t.status, t.pointsMode || '', t.complexity ?? '', t.size ?? '', t.points ?? '', day(t.completedAt)]);
    return sendCsv(res, `${fileSafe(rep.sprint.name)}_tasks.csv`, toCsv(header, rows));
  }
  sendCsv(res, `${fileSafe(rep.sprint.name)}_employees.csv`, toCsv(MEMBER_HEADER, [...memberRows(rep), totalRow(rep)]));
});

module.exports = { router, buildReport, toCsv };
