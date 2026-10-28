const express = require('express');
const M = require('../models');
const { requireAuth, requirePerm, can, httpError } = require('../auth');
const { assertWorkspace, projectsOf, canSeeProject, toRaw } = require('../access');
const SP = require('../storyPoints');

const router = express.Router();
router.use(requireAuth);

const SCOPED = [M.Sprint, M.Feature, M.Task, M.RoadmapItem, M.Doc, M.Diagram, M.Channel];

router.get('/', async (req, res) => {
  const q = req.user.role === 'admin' ? {} : { $or: [{ members: req.user._id }, { owner: req.user._id }] };
  const list = await M.Workspace.find(q).populate('owner', 'name email').sort({ createdAt: -1 });
  const counts = await M.Task.aggregate([
    { $match: { workspace: { $in: list.map((w) => w._id) } } },
    { $group: { _id: '$workspace', total: { $sum: 1 }, done: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } } } },
  ]);
  const byWs = new Map(counts.map((c) => [String(c._id), c]));
  res.json(list.map((w) => ({ ...w.toObject(), stats: byWs.get(String(w._id)) || { total: 0, done: 0 } })));
});

router.post('/', requirePerm('workspace.create'), async (req, res) => {
  const { name, key, description, members = [] } = req.body;
  if (!name) throw httpError(400, 'name is required');
  const ws = await M.Workspace.create({
    name,
    key,
    description,
    owner: req.user._id,
    members: [...new Set([String(req.user._id), ...members.map(String)])],
  });
  await M.Channel.create({ workspace: ws._id, project: null, name: 'general', isDefault: true });
  res.status(201).json(ws);
});

router.get('/:id', async (req, res) => {
  await assertWorkspace(req.user, req.params.id);
  res.json(await M.Workspace.findById(req.params.id).populate('members', 'name email role active').populate('owner', 'name email'));
});

router.put('/:id', requirePerm('structure.manage'), async (req, res) => {
  const ws = await assertWorkspace(req.user, req.params.id);
  ['name', 'key', 'description'].forEach((k) => req.body[k] !== undefined && (ws[k] = req.body[k]));
  await ws.save();
  res.json(ws);
});

router.put('/:id/members', requirePerm('structure.manage'), async (req, res) => {
  const ws = await assertWorkspace(req.user, req.params.id);
  const ids = [...new Set((req.body.members || []).map(String))];
  const found = await M.User.countDocuments({ _id: { $in: ids } });
  if (found !== ids.length) throw httpError(400, 'Unknown user in members');
  if (ws.owner && !ids.includes(String(ws.owner))) ids.push(String(ws.owner));
  const removed = ws.members.map(String).filter((m) => !ids.includes(m));
  ws.members = ids;
  await ws.save();
  // users removed from the workspace lose their sub-project assignments too
  if (removed.length) await M.Project.updateMany({ workspace: ws._id }, { $pull: { members: { $in: removed } } });
  res.json(await M.Workspace.findById(ws._id).populate('members', 'name email role active'));
});

router.delete('/:id', requirePerm('workspace.delete'), async (req, res) => {
  const ws = await assertWorkspace(req.user, req.params.id);
  const channels = await M.Channel.find({ workspace: ws._id }).select('_id');
  await M.Message.deleteMany({ channel: { $in: channels.map((c) => c._id) } });
  for (const Model of SCOPED) await Model.deleteMany({ workspace: ws._id });
  await M.Project.deleteMany({ workspace: ws._id });
  await ws.deleteOne();
  res.status(204).end();
});

// Story point matrix for this workspace (own matrix or organisation default)
router.get('/:id/story-points', async (req, res) => {
  const ws = await assertWorkspace(req.user, req.params.id);
  const { matrix, source } = await SP.matrixForWorkspace(ws._id);
  res.json({ matrix, source, defaultMatrix: await SP.getMatrix(), complexityLabels: SP.COMPLEXITY_LABELS, sizeLabels: SP.SIZE_LABELS });
});

// PUT { matrix: number[5][5] | null (null = use organisation default), recalculate: 'none'|'open'|'all' }
router.put('/:id/story-points', requirePerm('structure.manage'), async (req, res) => {
  const ws = await assertWorkspace(req.user, req.params.id);
  const { matrix, recalculate = 'open' } = req.body || {};
  if (!['none', 'open', 'all'].includes(recalculate)) throw httpError(400, 'recalculate must be none, open or all');
  ws.pointMatrix = matrix ? SP.cleanMatrix(matrix) : undefined;
  await ws.save();
  const resolved = await SP.matrixForWorkspace(ws._id);
  const updated = recalculate === 'none' ? 0 : await SP.recalculate({
    filter: { workspace: ws._id },
    matrixFor: async () => resolved.matrix,
    openOnly: recalculate === 'open',
  });
  res.json({ ...resolved, updated });
});

// Projects/modules the current user can see, as a flat list (client builds the tree).
router.get('/:id/projects', async (req, res) => {
  await assertWorkspace(req.user, req.params.id);
  const { all, byId } = await projectsOf(req.params.id);
  const rawMap = new Map([...byId].map(([k, v]) => [k, toRaw(v)]));
  res.json(all.filter((p) => canSeeProject(req.user, toRaw(p), rawMap)));
});

module.exports = router;
