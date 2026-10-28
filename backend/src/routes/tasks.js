const express = require('express');
const M = require('../models');
const scoped = require('./scoped');
const { requireAuth, can, httpError } = require('../auth');
const { assertScope } = require('../access');
const { publishToUsers, publishToScope } = require('../events');
const { pointsFor, validLevel } = require('../storyPoints');

const populate = [
  { path: 'assignee', select: 'name email role' },
  { path: 'reporter', select: 'name email' },
  { path: 'feature', select: 'title' },
  { path: 'sprint', select: 'name status' },
  { path: 'comments.author', select: 'name' },
];

const idOf = (v) => (v && v._id ? v._id : v);

// assignee must be an active user who can access the task's scope
async function validateRefs(req, body, doc) {
  const workspace = doc ? doc.workspace : body.workspace;
  const project = doc ? doc.project : body.project;
  if (body.assignee) {
    const u = await M.User.findById(body.assignee);
    if (!u || !u.active) throw httpError(400, 'Assignee not found or inactive');
    try {
      await assertScope(u, workspace, project);
    } catch {
      throw httpError(400, `${u.name} is not assigned to this workspace / sub-project`);
    }
  }
  if (body.assignee === '') body.assignee = null;
  if (body.sprint === '') body.sprint = null;
  if (body.feature === '') body.feature = null;
  for (const [field, Model] of [['feature', M.Feature], ['sprint', M.Sprint]]) {
    if (!body[field]) continue;
    const ref = await Model.findById(body[field]);
    if (!ref || String(ref.workspace) !== String(workspace)) throw httpError(400, `Invalid ${field}`);
  }
  if (body.status && !M.TASK_STATUSES.includes(body.status)) throw httpError(400, 'Invalid status');
  if (body.points !== undefined && body.points !== null && body.points !== '') {
    const n = Number(body.points);
    if (!Number.isFinite(n) || n < 0 || n > 100) throw httpError(400, 'Story points must be between 0 and 100');
    body.points = n;
  } else if (body.points === '') body.points = null;

  // Complexity × size → points from the story point matrix (server is authoritative)
  for (const k of ['complexity', 'size']) {
    if (body[k] === '' || body[k] === undefined) { if (body[k] === '') body[k] = null; continue; }
    if (body[k] === null) continue;
    const n = Number(body[k]);
    if (!validLevel(n)) throw httpError(400, `${k} must be 1–5`);
    body[k] = n;
  }
  // pointsMode: 'matrix' -> points = workspace matrix[complexity][size]; 'manual' -> points as entered
  if (body.pointsMode !== undefined && !['matrix', 'manual'].includes(body.pointsMode)) throw httpError(400, 'pointsMode must be matrix or manual');
  const complexity = body.complexity !== undefined ? body.complexity : doc?.complexity;
  const size = body.size !== undefined ? body.size : doc?.size;
  let mode = body.pointsMode ?? doc?.pointsMode;
  if (!mode || (!doc && body.pointsMode === undefined)) mode = complexity && size ? 'matrix' : 'manual';
  if (mode === 'matrix') {
    if (!(complexity && size)) throw httpError(400, 'Choose complexity and size, or switch to manual points');
    body.points = await pointsFor(complexity, size, workspace);
  }
  body.pointsMode = mode;
}

async function notify(req, task, before) {
  const assignee = idOf(task.assignee);
  if (assignee && (!before || String(before.assignee) !== String(assignee)) && String(assignee) !== String(req.user._id)) {
    publishToUsers([assignee], 'task.assigned', {
      task: { _id: task._id, title: task.title },
      by: req.user.name,
    });
  }
  await publishToScope(task.workspace, task.project, 'task.updated', { taskId: task._id, workspace: task.workspace, project: task.project });
}

// Who can change status: tasks.status.any, or the assignee with tasks.status.own.
const canChangeStatus = (u, task) =>
  can(u, 'tasks.status.any') || (can(u, 'tasks.status.own') && String(task.assignee) === String(u._id));

const router = express.Router();
router.use(requireAuth);

router.get('/mine', async (req, res) => {
  const q = { assignee: req.user._id };
  if (req.query.status) q.status = req.query.status;
  res.json(
    await M.Task.find(q)
      .populate(populate)
      .populate('workspace', 'name key')
      .populate('project', 'name kind')
      .sort({ updatedAt: -1 })
  );
});

router.patch('/:id/status', async (req, res) => {
  const task = await M.Task.findById(req.params.id);
  if (!task) throw httpError(404, 'Task not found');
  await assertScope(req.user, task.workspace, task.project);
  if (!canChangeStatus(req.user, task)) throw httpError(403, 'You are not allowed to change the status of this task');
  if (!M.TASK_STATUSES.includes(req.body.status)) throw httpError(400, 'Invalid status');
  task.status = req.body.status;
  await task.save();
  await task.populate(populate);
  await notify(req, task, task.toObject());
  res.json(task);
});

router.post('/:id/comments', async (req, res) => {
  const task = await M.Task.findById(req.params.id);
  if (!task) throw httpError(404, 'Task not found');
  await assertScope(req.user, task.workspace, task.project);
  if (!req.body.text) throw httpError(400, 'text is required');
  task.comments.push({ author: req.user._id, text: req.body.text });
  await task.save();
  await task.populate(populate);
  res.status(201).json(task);
});

router.use(
  scoped(M.Task, {
    populate,
    perm: 'tasks.manage',
    filters: ['status', 'assignee', 'feature', 'sprint', 'priority', 'type'],
    authorField: 'reporter',
    sort: { createdAt: -1 },
    // developers may edit status of their own tasks via PUT too
    canUpdate: (u, doc, body) =>
      can(u, 'tasks.manage') || (canChangeStatus(u, doc) && Object.keys(body).every((k) => k === 'status')),
    beforeSave: validateRefs,
    afterSave: notify,
    afterDelete: (req, doc) => publishToScope(doc.workspace, doc.project, 'task.updated', { taskId: doc._id }),
  })
);

module.exports = router;
