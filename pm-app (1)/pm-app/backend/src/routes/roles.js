const express = require('express');
const M = require('../models');
const { PERMISSIONS, ALL } = require('../permissions');
const { requireAuth, requirePerm, refreshRoles, httpError } = require('../auth');

const router = express.Router();
router.use(requireAuth);
const manage = requirePerm('roles.manage');

const slug = (s) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
const clean = (perms) => [...new Set((perms || []).filter((p) => ALL.includes(p)))];

// Everyone can read roles (labels, colours, permissions) — the UI needs them.
router.get('/', async (req, res) => {
  const [roles, counts] = await Promise.all([
    M.Role.find().sort({ system: -1, name: 1 }),
    M.User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
  ]);
  const byRole = new Map(counts.map((c) => [c._id, c.count]));
  res.json(roles.map((r) => ({ ...r.toObject(), permissions: r.key === 'admin' ? ALL : r.permissions, users: byRole.get(r.key) || 0 })));
});

router.get('/permissions', (req, res) => res.json(PERMISSIONS));

router.post('/', manage, async (req, res) => {
  const { name, description, color, permissions } = req.body;
  const key = slug(req.body.key || name);
  if (!name || !key) throw httpError(400, 'name is required');
  if (await M.Role.exists({ key })) throw httpError(409, `A role with key "${key}" already exists`);
  const role = await M.Role.create({ key, name, description, color, permissions: clean(permissions) });
  await refreshRoles();
  res.status(201).json(role);
});

router.put('/:key', manage, async (req, res) => {
  const role = await M.Role.findOne({ key: req.params.key });
  if (!role) throw httpError(404, 'Role not found');
  if (role.locked) throw httpError(400, 'The Admin role cannot be changed');
  const { name, description, color, permissions } = req.body;
  if (name) role.name = name;
  if (description !== undefined) role.description = description;
  if (color) role.color = color;
  if (permissions) role.permissions = clean(permissions);
  // never lock everyone out of role management
  if (permissions && !role.permissions.includes('roles.manage') && req.user.role === role.key)
    throw httpError(400, 'You cannot remove "Manage roles" from your own role');
  await role.save();
  await refreshRoles();
  res.json(role);
});

// DELETE /roles/:key?reassignTo=<key>  — users on the role move to reassignTo
router.delete('/:key', manage, async (req, res) => {
  const role = await M.Role.findOne({ key: req.params.key });
  if (!role) throw httpError(404, 'Role not found');
  if (role.system) throw httpError(400, 'Built-in roles cannot be deleted');
  const users = await M.User.countDocuments({ role: role.key });
  if (users) {
    const target = req.query.reassignTo;
    if (!target) throw httpError(409, `${users} user(s) have this role. Choose a role to move them to.`);
    if (target === role.key || !(await M.Role.exists({ key: target }))) throw httpError(400, 'Invalid reassignTo role');
    if (target === 'admin' && req.user.role !== 'admin') throw httpError(403, 'Only admins can grant the admin role');
    await M.User.updateMany({ role: role.key }, { role: target });
  }
  await role.deleteOne();
  await refreshRoles();
  res.json({ deleted: role.key, moved: users });
});

module.exports = router;
