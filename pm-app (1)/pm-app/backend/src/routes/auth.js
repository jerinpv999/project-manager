const express = require('express');
const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { signToken, requireAuth, publicUser, httpError } = require('../auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  const user = await User.findOne({ email: String(email || '').toLowerCase() }).select('+password');
  if (!user || !(await bcrypt.compare(String(password || ''), user.password)))
    throw httpError(401, 'Invalid email or password');
  if (!user.active) throw httpError(403, 'Account is deactivated');
  res.json({ token: signToken(user), user: publicUser(user) });
});

router.get('/me', requireAuth, (req, res) => res.json(publicUser(req.user)));

module.exports = router;
