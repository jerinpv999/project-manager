const express = require('express');
const M = require('../models');
const { requireAuth, requirePerm, httpError } = require('../auth');
const { assertScope } = require('../access');
const { publishToScope } = require('../events');

const router = express.Router();
router.use(requireAuth);

// Default "common questions" channel for a workspace or sub-project (created on demand).
router.get('/channel', async (req, res) => {
  const { ws, p } = await assertScope(req.user, req.query.workspace, req.query.project);
  const q = { workspace: ws._id, project: p ? p._id : null, isDefault: true };
  const channel = (await M.Channel.findOne(q)) || (await M.Channel.create({ ...q, name: 'general' }));
  res.json(channel);
});

async function loadChannel(user, id) {
  const ch = await M.Channel.findById(id);
  if (!ch) throw httpError(404, 'Channel not found');
  await assertScope(user, ch.workspace, ch.project);
  return ch;
}

router.get('/:channelId/messages', async (req, res) => {
  const ch = await loadChannel(req.user, req.params.channelId);
  const q = { channel: ch._id };
  if (req.query.before) q.createdAt = { $lt: new Date(req.query.before) };
  const msgs = await M.Message.find(q).sort({ createdAt: -1 }).limit(Number(req.query.limit) || 50).populate('author', 'name role');
  res.json(msgs.reverse());
});

router.post('/:channelId/messages', requirePerm('chat.write'), async (req, res) => {
  const ch = await loadChannel(req.user, req.params.channelId);
  const text = String(req.body.text || '').trim();
  if (!text) throw httpError(400, 'Message is empty');
  const msg = await M.Message.create({ channel: ch._id, workspace: ch.workspace, author: req.user._id, text });
  await msg.populate('author', 'name role');
  await publishToScope(ch.workspace, ch.project, 'chat.message', { channelId: String(ch._id), message: msg });
  res.status(201).json(msg);
});

module.exports = router;
