const express = require('express');
const bcrypt = require('bcryptjs');
const M = require('../models');
const { requireAuth, requirePerm, httpError } = require('../auth');
const { delegateAndDelete } = require('../services/users');

const router = express.Router();
router.use(requireAuth);
const adminOnly = requirePerm('users.manage');
const validRole = async (role) => {
  if (role && !(await M.Role.exists({ key: role }))) throw httpError(400, `Unknown role: ${role}`);
};

// Everyone signed in can list users (needed to pick members/assignees).
router.get('/', async (req, res) => {
  res.json(await M.User.find().sort({ name: 1 }));
});

router.post('/', adminOnly, async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) throw httpError(400, 'name, email and password are required');
  await validRole(role);
  if (role === 'admin' && req.user.role !== 'admin') throw httpError(403, 'Only admins can create admins');
  if (await M.User.exists({ email: email.toLowerCase() })) throw httpError(409, 'Email already in use');
  const user = await M.User.create({ name, email, role, password: await bcrypt.hash(password, 10) });
  res.status(201).json(await M.User.findById(user._id));
});

router.put('/:id', adminOnly, async (req, res) => {
  const user = await M.User.findById(req.params.id);
  if (!user) throw httpError(404, 'User not found');
  const { name, email, role, password } = req.body;
  await validRole(role);
  if ((role === 'admin' || user.role === 'admin') && req.user.role !== 'admin' && role !== user.role)
    throw httpError(403, 'Only admins can grant or remove the admin role');
  if (String(user._id) === String(req.user._id) && role && role !== 'admin')
    throw httpError(400, 'You cannot remove your own admin role');
  if (name) user.name = name;
  if (email) user.email = email;
  if (role) user.role = role;
  if (password) user.password = await bcrypt.hash(password, 10);
  await user.save();
  res.json(await M.User.findById(user._id));
});

router.patch('/:id/active', adminOnly, async (req, res) => {
  if (String(req.params.id) === String(req.user._id)) throw httpError(400, 'You cannot deactivate yourself');
  const user = await M.User.findByIdAndUpdate(req.params.id, { active: !!req.body.active }, { new: true });
  if (!user) throw httpError(404, 'User not found');
  res.json(user);
});

// Delete: everything the user owned / was assigned is delegated to the admin performing the delete.
router.delete('/:id', adminOnly, async (req, res) => {
  const user = await M.User.findById(req.params.id);
  if (!user) throw httpError(404, 'User not found');
  if (String(user._id) === String(req.user._id)) throw httpError(400, 'You cannot delete yourself');
  const summary = await delegateAndDelete(user, req.user);
  res.json({ deleted: user.email, delegatedTo: req.user.email, summary });
});

module.exports = router;
