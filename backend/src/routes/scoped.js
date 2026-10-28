// Generic CRUD router for anything that lives in a workspace / sub-project scope
// (sprints, features, tasks, roadmap items, docs, diagrams).
//
// GET    /?workspace=<id>&project=<id|root>[&all=1][&<filter>=..]
//          project omitted/root -> workspace-level items only
//          all=1                -> include every sub-project/module below the scope
// POST   /           body: { workspace, project, ...fields }
// GET    /:id
// PUT    /:id
// DELETE /:id
const express = require('express');
const { requireAuth, can, httpError } = require('../auth');
const { assertScope, descendantIds, accessibleProjectIds } = require('../access');

const PROTECTED = ['_id', 'workspace', 'project', 'createdAt', 'updatedAt', '__v'];

module.exports = function scoped(Model, opts = {}) {
  const router = express.Router();
  router.use(requireAuth);
  const populate = opts.populate || [];
  const filters = opts.filters || [];
  const memberWrite = opts.write === 'member';
  const pop = (q) => (populate.length ? q.populate(populate) : q);

  // opts.perm: permission needed to create/edit/delete (default planning.manage).
  // write: 'member' -> anyone with docs.write; delete by author or docs.delete.any.
  const perm = opts.perm || 'planning.manage';
  const isManager = (u) => can(u, perm);
  const canCreate = (u) => (memberWrite ? can(u, 'docs.write') : isManager(u));
  const canUpdate = opts.canUpdate || ((u) => (memberWrite ? can(u, 'docs.write') : isManager(u)));
  const canDelete = (u, doc) =>
    memberWrite
      ? can(u, 'docs.delete.any') || (opts.authorField && String(doc[opts.authorField]) === String(u._id))
      : isManager(u);

  router.get('/', async (req, res) => {
    const { workspace, project, all } = req.query;
    const { ws, p } = await assertScope(req.user, workspace, project);
    const q = { workspace: ws._id };
    if (all === '1') {
      if (p) q.project = { $in: [p._id, ...(await descendantIds(p._id))] };
      else if (!can(req.user, 'projects.view_all')) q.project = { $in: [null, ...(await accessibleProjectIds(req.user, ws._id))] };
    } else {
      q.project = p ? p._id : null;
    }
    for (const f of filters) {
      const v = req.query[f];
      if (v === undefined || v === '') continue;
      q[f] = v === 'none' ? null : v;
    }
    res.json(await pop(Model.find(q)).sort(opts.sort || { createdAt: -1 }));
  });

  router.post('/', async (req, res) => {
    const body = { ...req.body };
    const { ws, p } = await assertScope(req.user, body.workspace, body.project);
    if (!canCreate(req.user)) throw httpError(403, 'You do not have permission to create this');
    PROTECTED.forEach((k) => delete body[k]);
    Object.assign(body, { workspace: ws._id, project: p ? p._id : null });
    if (opts.authorField) body[opts.authorField] = req.user._id;
    if (opts.beforeSave) await opts.beforeSave(req, body, null);
    const doc = await Model.create(body);
    if (populate.length) await doc.populate(populate);
    if (opts.afterSave) await opts.afterSave(req, doc, null);
    res.status(201).json(doc);
  });

  router.get('/:id', async (req, res) => {
    const doc = await pop(Model.findById(req.params.id));
    if (!doc) throw httpError(404, 'Not found');
    await assertScope(req.user, doc.workspace?._id || doc.workspace, doc.project?._id || doc.project);
    res.json(doc);
  });

  router.put('/:id', async (req, res) => {
    const doc = await Model.findById(req.params.id);
    if (!doc) throw httpError(404, 'Not found');
    await assertScope(req.user, doc.workspace, doc.project);
    const body = { ...req.body };
    PROTECTED.forEach((k) => delete body[k]);
    if (opts.authorField) delete body[opts.authorField];
    if (!canUpdate(req.user, doc, body)) throw httpError(403, 'You are not allowed to edit this');
    const before = doc.toObject();
    if (opts.beforeSave) await opts.beforeSave(req, body, doc);
    Object.assign(doc, body);
    await doc.save();
    if (populate.length) await doc.populate(populate);
    if (opts.afterSave) await opts.afterSave(req, doc, before);
    res.json(doc);
  });

  router.delete('/:id', async (req, res) => {
    const doc = await Model.findById(req.params.id);
    if (!doc) throw httpError(404, 'Not found');
    await assertScope(req.user, doc.workspace, doc.project);
    if (!canDelete(req.user, doc)) throw httpError(403, 'You are not allowed to delete this');
    await doc.deleteOne();
    if (opts.afterDelete) await opts.afterDelete(req, doc);
    res.status(204).end();
  });

  return router;
};
