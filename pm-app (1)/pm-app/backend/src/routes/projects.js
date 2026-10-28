const express = require('express');
const M = require('../models');
const { requireAuth, requirePerm, httpError } = require('../auth');
const requireManager = requirePerm('structure.manage');
const { assertWorkspace, assertProject } = require('../access');

const router = express.Router();
router.use(requireAuth);

const SCOPED = [M.Sprint, M.Feature, M.Task, M.RoadmapItem, M.Doc, M.Diagram, M.Channel];

function ensureSubset(ws, ids) {
  const allowed = new Set([...ws.members.map(String), String(ws.owner)]);
  const bad = ids.filter((id) => !allowed.has(String(id)));
  if (bad.length) throw httpError(400, 'Only workspace members can be assigned to a sub-project/module');
}

router.post('/', requireManager, async (req, res) => {
  const { workspace, parent = null, name, description, kind = 'subproject', members = [] } = req.body;
  if (!name) throw httpError(400, 'name is required');
  const ws = await assertWorkspace(req.user, workspace);
  if (parent) {
    const par = await M.Project.findById(parent);
    if (!par || String(par.workspace) !== String(ws._id)) throw httpError(400, 'Parent must be in the same workspace');
  }
  ensureSubset(ws, members);
  const p = await M.Project.create({ workspace: ws._id, parent, name, description, kind, members });
  await M.Channel.create({ workspace: ws._id, project: p._id, name: 'general', isDefault: true });
  res.status(201).json(p);
});

router.get('/:id', async (req, res) => {
  await assertProject(req.user, req.params.id);
  res.json(await M.Project.findById(req.params.id).populate('members', 'name email role active'));
});

router.put('/:id', requireManager, async (req, res) => {
  const { p } = await assertProject(req.user, req.params.id);
  ['name', 'description', 'kind'].forEach((k) => req.body[k] !== undefined && (p[k] = req.body[k]));
  await p.save();
  res.json(p);
});

router.put('/:id/members', requireManager, async (req, res) => {
  const { ws, p } = await assertProject(req.user, req.params.id);
  const ids = [...new Set((req.body.members || []).map(String))];
  ensureSubset(ws, ids);
  p.members = ids;
  await p.save();
  res.json(await M.Project.findById(p._id).populate('members', 'name email role active'));
});

router.delete('/:id', requireManager, async (req, res) => {
  const { p } = await assertProject(req.user, req.params.id);
  if (await M.Project.exists({ parent: p._id })) throw httpError(400, 'Delete or move its modules first');
  const channels = await M.Channel.find({ project: p._id }).select('_id');
  await M.Message.deleteMany({ channel: { $in: channels.map((c) => c._id) } });
  for (const Model of SCOPED) await Model.deleteMany({ project: p._id });
  await p.deleteOne();
  res.status(204).end();
});

module.exports = router;
