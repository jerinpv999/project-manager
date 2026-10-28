// Story points calculation matrix: points = MATRIX[complexity][size]
//
//              SIZE →   1   2   3   4   5
//   COMPLEXITY 5        5   8  13  21  21
//              4        3   5   8  13  21
//              3        3   3   5   8  13
//              2        2   2   3   5   8
//              1        1   2   3   5   8
//
// Stored as rows indexed by complexity-1 (row 0 = complexity 1). Editable on the Settings page.
const { Setting } = require('./models');

const KEY = 'storyPointMatrix';
const DEFAULT_MATRIX = [
  [1, 2, 3, 5, 8], // complexity 1
  [2, 2, 3, 5, 8], // complexity 2
  [3, 3, 5, 8, 13], // complexity 3
  [3, 5, 8, 13, 21], // complexity 4
  [5, 8, 13, 21, 21], // complexity 5
];
const COMPLEXITY_LABELS = ['Very low', 'Low', 'Medium', 'High', 'Very high'];
const SIZE_LABELS = ['XS', 'S', 'M', 'L', 'XL'];

let cache = null;

async function getMatrix() {
  if (cache) return cache;
  const s = await Setting.findOne({ key: KEY });
  cache = isValidMatrix(s?.value) ? s.value : DEFAULT_MATRIX;
  return cache;
}

function isValidMatrix(m) {
  return (
    Array.isArray(m) && m.length === 5 &&
    m.every((row) => Array.isArray(row) && row.length === 5 && row.every((v) => Number.isFinite(v) && v >= 0 && v <= 100))
  );
}

async function setMatrix(matrix) {
  const clean = matrix.map((row) => row.map((v) => Number(v)));
  if (!isValidMatrix(clean)) throw Object.assign(new Error('Matrix must be 5×5 numbers between 0 and 100'), { status: 400 });
  await Setting.updateOne({ key: KEY }, { value: clean }, { upsert: true });
  cache = clean;
  return clean;
}

const validLevel = (v) => Number.isInteger(v) && v >= 1 && v <= 5;

// Matrix that applies to a workspace: its own one if set, otherwise the organisation default
async function matrixForWorkspace(workspaceId) {
  const { Workspace } = require('./models');
  const ws = workspaceId ? await Workspace.findById(workspaceId).select('pointMatrix') : null;
  return isValidMatrix(ws?.pointMatrix) ? { matrix: ws.pointMatrix, source: 'workspace' } : { matrix: await getMatrix(), source: 'default' };
}

async function pointsFor(complexity, size, workspaceId) {
  if (!validLevel(complexity) || !validLevel(size)) return null;
  const { matrix } = await matrixForWorkspace(workspaceId);
  return matrix[complexity - 1][size - 1];
}

const cleanMatrix = (matrix) => {
  const clean = (matrix || []).map((row) => (row || []).map((v) => Number(v)));
  if (!isValidMatrix(clean)) throw Object.assign(new Error('Matrix must be 5×5 numbers between 0 and 100'), { status: 400 });
  return clean;
};

// Recalculate points of matrix-mode tasks. filter: extra Mongo filter (e.g. workspace).
async function recalculate({ filter = {}, matrixFor, openOnly = true }) {
  const { Task } = require('./models');
  const q = { ...filter, pointsMode: { $ne: 'manual' }, complexity: { $gte: 1 }, size: { $gte: 1 } };
  if (openOnly) q.status = { $ne: 'done' };
  const tasks = await Task.find(q).select('workspace complexity size points');
  const ops = [];
  for (const t of tasks) {
    const m = await matrixFor(t.workspace);
    const p = m[t.complexity - 1][t.size - 1];
    if (t.points !== p) ops.push({ updateOne: { filter: { _id: t._id }, update: { $set: { points: p, pointsMode: 'matrix' } } } });
  }
  if (ops.length) await Task.bulkWrite(ops);
  return ops.length;
}

module.exports = {
  DEFAULT_MATRIX, COMPLEXITY_LABELS, SIZE_LABELS, getMatrix, setMatrix, pointsFor, matrixForWorkspace,
  validLevel, isValidMatrix, cleanMatrix, recalculate,
};
