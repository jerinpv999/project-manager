const express = require('express');
const M = require('../models');
const { requireAuth, requirePerm, httpError } = require('../auth');
const SP = require('../storyPoints');

const router = express.Router();
router.use(requireAuth);

// Story point matrix: readable by everyone (task forms use it), editable with settings.manage
router.get('/story-points', async (req, res) => {
  res.json({
    matrix: await SP.getMatrix(),
    defaultMatrix: SP.DEFAULT_MATRIX,
    complexityLabels: SP.COMPLEXITY_LABELS,
    sizeLabels: SP.SIZE_LABELS,
  });
});

// PUT { matrix: number[5][5], recalculate: 'none' | 'open' | 'all' }
router.put('/story-points', requirePerm('settings.manage'), async (req, res) => {
  const { matrix, recalculate = 'open' } = req.body || {};
  if (!['none', 'open', 'all'].includes(recalculate)) throw httpError(400, 'recalculate must be none, open or all');
  const saved = await SP.setMatrix(matrix || []);
  let updated = 0;
  if (recalculate !== 'none') {
    const custom = await M.Workspace.find({ 'pointMatrix.0': { $exists: true } }).select('_id');
    updated = await SP.recalculate({
      filter: { workspace: { $nin: custom.map((w) => w._id) } },
      matrixFor: async () => saved,
      openOnly: recalculate === 'open',
    });
  }
  res.json({ matrix: saved, updated });
});

module.exports = router;
