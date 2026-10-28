const express = require('express');
const M = require('../models');
const { requireAuth, can } = require('../auth');
const { assertScope, descendantIds, accessibleProjectIds } = require('../access');

const router = express.Router();
router.use(requireAuth);
const DAY = 86400000;
const doneExpr = { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } };

// GET /api/dashboard?workspace=<id>&project=<id>
// Workspace level includes all sub-projects; project level includes its modules.
router.get('/', async (req, res) => {
  const { ws, p } = await assertScope(req.user, req.query.workspace, req.query.project);
  const match = { workspace: ws._id };
  let projectIds = null;
  if (p) {
    projectIds = [p._id, ...(await descendantIds(p._id))];
    match.project = { $in: projectIds };
  } else if (!can(req.user, 'projects.view_all')) {
    match.project = { $in: [null, ...(await accessibleProjectIds(req.user, ws._id))] };
  }
  const now = new Date();

  const [byStatus, byPriority, byType, byAssignee, byFeature, byProject, throughput, totals] = await Promise.all([
    M.Task.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    M.Task.aggregate([{ $match: match }, { $group: { _id: '$priority', count: { $sum: 1 } } }]),
    M.Task.aggregate([{ $match: match }, { $group: { _id: '$type', count: { $sum: 1 } } }]),
    M.Task.aggregate([
      { $match: { ...match, assignee: { $ne: null } } },
      { $group: { _id: '$assignee', total: { $sum: 1 }, done: doneExpr } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
      { $project: { name: { $ifNull: [{ $arrayElemAt: ['$u.name', 0] }, 'Unknown'] }, total: 1, done: 1 } },
      { $sort: { total: -1 } },
      { $limit: 15 },
    ]),
    M.Task.aggregate([
      { $match: { ...match, feature: { $ne: null } } },
      { $group: { _id: '$feature', total: { $sum: 1 }, done: doneExpr } },
      { $lookup: { from: 'features', localField: '_id', foreignField: '_id', as: 'f' } },
      { $project: { name: { $ifNull: [{ $arrayElemAt: ['$f.title', 0] }, 'Deleted'] }, total: 1, done: 1 } },
      { $sort: { total: -1 } },
      { $limit: 12 },
    ]),
    M.Task.aggregate([
      { $match: match },
      { $group: { _id: '$project', total: { $sum: 1 }, done: doneExpr } },
      { $lookup: { from: 'projects', localField: '_id', foreignField: '_id', as: 'p' } },
      { $project: { name: { $ifNull: [{ $arrayElemAt: ['$p.name', 0] }, p ? p.name : 'Workspace level'] }, total: 1, done: 1 } },
      { $sort: { total: -1 } },
    ]),
    M.Task.aggregate([
      { $match: { ...match, completedAt: { $gte: new Date(now - 14 * DAY) } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt' } }, count: { $sum: 1 } } },
    ]),
    M.Task.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          done: doneExpr,
          blocked: { $sum: { $cond: [{ $eq: ['$status', 'blocked'] }, 1, 0] } },
          overdue: { $sum: { $cond: [{ $and: [{ $ne: ['$status', 'done'] }, { $lt: ['$dueDate', now] }, { $gt: ['$dueDate', null] }] }, 1, 0] } },
        },
      },
    ]),
  ]);

  const featureMatch = { ...match };
  const features = await M.Feature.aggregate([{ $match: featureMatch }, { $group: { _id: '$status', count: { $sum: 1 } } }]);

  // Burndown for the active sprint at this exact scope (or the most recent one)
  const sprintScope = { workspace: ws._id, project: p ? p._id : null };
  const sprint =
    (await M.Sprint.findOne({ ...sprintScope, status: 'active' }).sort({ startDate: -1 })) ||
    (await M.Sprint.findOne(sprintScope).sort({ startDate: -1 }));
  let burndown = null;
  if (sprint) {
    const tasks = await M.Task.find({ sprint: sprint._id }).select('status completedAt');
    const total = tasks.length;
    const days = Math.max(1, Math.ceil((sprint.endDate - sprint.startDate) / DAY));
    const points = [];
    for (let i = 0; i <= days; i++) {
      const day = new Date(sprint.startDate.getTime() + i * DAY);
      const ideal = Math.round((total - (total * i) / days) * 10) / 10;
      let remaining = null;
      if (day <= now) remaining = total - tasks.filter((t) => t.completedAt && t.completedAt <= day).length;
      points.push({ day: day.toISOString().slice(0, 10), ideal, remaining });
    }
    burndown = { sprint: { _id: sprint._id, name: sprint.name, status: sprint.status }, total, points };
  }

  const tp = new Map(throughput.map((t) => [t._id, t.count]));
  const throughputSeries = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now - i * DAY).toISOString().slice(0, 10);
    throughputSeries.push({ day: d, done: tp.get(d) || 0 });
  }

  const members = p ? p.members.length : ws.members.length;
  const activeSprints = await M.Sprint.countDocuments({ workspace: ws._id, status: 'active', ...(projectIds ? { project: { $in: projectIds } } : {}) });

  res.json({
    totals: { ...(totals[0] || { total: 0, done: 0, blocked: 0, overdue: 0 }), members, activeSprints, features: features.reduce((s, f) => s + f.count, 0) },
    byStatus,
    byPriority,
    byType,
    byAssignee,
    byFeature,
    byProject,
    featureStatus: features,
    throughput: throughputSeries,
    burndown,
  });
});

module.exports = router;
