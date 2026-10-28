const express = require('express');
const { userFromToken } = require('../auth');
const { subscribeClient } = require('../events');

const router = express.Router();

// EventSource cannot send headers, so the JWT comes in the query string.
router.get('/', async (req, res) => {
  const user = await userFromToken(req.query.token);
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write(`event: ready\ndata: {"user":"${user._id}"}\n\n`);
  const unsubscribe = subscribeClient(user._id, res);
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

module.exports = router;
