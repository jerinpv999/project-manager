// Access rules
//  - admin: everything
//  - workspace content: workspace members (and owner)
//  - sub-project/module content: project managers in the workspace, or users assigned
//    to that project or any of its ancestor projects
const { Workspace, Project, User } = require('./models');
const { httpError, isManager, can } = require('./auth');

const has = (arr, id) => (arr || []).some((m) => String(m) === String(id));

async function assertWorkspace(user, wsId) {
  const ws = await Workspace.findById(wsId);
  if (!ws) throw httpError(404, 'Workspace not found');
  if (user.role === 'admin') return ws;
  if (!has(ws.members, user._id) && String(ws.owner) !== String(user._id))
    throw httpError(403, 'Not a member of this workspace');
  return ws;
}

function canSeeProject(user, project, byId) {
  if (can(user, 'projects.view_all')) return true;
  let cur = project;
  while (cur) {
    if (has(cur.members, user._id)) return true;
    cur = cur.parent ? byId.get(String(cur.parent)) : null;
  }
  return false;
}

async function projectsOf(wsId) {
  const all = await Project.find({ workspace: wsId }).populate('members', 'name email role active');
  // keep raw ids handy for membership checks
  const byId = new Map(all.map((p) => [String(p._id), p]));
  return { all, byId };
}

async function accessibleProjectIds(user, wsId) {
  const { all, byId } = await projectsOf(wsId);
  return all.filter((p) => canSeeProject(user, toRaw(p), byId)).map((p) => p._id);
}

// members may be populated docs; normalise to ids for checks
function toRaw(p) {
  return { ...p.toObject(), members: (p.members || []).map((m) => m._id || m) };
}

async function assertProject(user, projectId) {
  const p = await Project.findById(projectId);
  if (!p) throw httpError(404, 'Project not found');
  const ws = await assertWorkspace(user, p.workspace);
  const { byId } = await projectsOf(p.workspace);
  const rawMap = new Map([...byId].map(([k, v]) => [k, toRaw(v)]));
  if (!canSeeProject(user, toRaw(p), rawMap)) throw httpError(403, 'Not assigned to this project');
  return { ws, p };
}

// Resolve { workspace, project } from request params and verify access.
async function assertScope(user, workspace, project) {
  if (project && project !== 'root') {
    const { ws, p } = await assertProject(user, project);
    return { ws, p };
  }
  if (!workspace) throw httpError(400, 'workspace is required');
  return { ws: await assertWorkspace(user, workspace), p: null };
}

async function descendantIds(projectId) {
  const out = [];
  let frontier = [projectId];
  while (frontier.length) {
    const kids = await Project.find({ parent: { $in: frontier } }).select('_id');
    frontier = kids.map((k) => k._id);
    out.push(...frontier);
  }
  return out;
}

// All users who may see content in a scope (used for realtime fan-out).
async function audienceForScope(wsId, projectId) {
  const ws = await Workspace.findById(wsId);
  if (!ws) return [];
  const admins = await User.find({ role: 'admin', active: true }).select('_id');
  const ids = new Set(admins.map((a) => String(a._id)));
  const memberIds = [...(ws.members || []), ws.owner].filter(Boolean);
  if (!projectId) {
    memberIds.forEach((m) => ids.add(String(m)));
    return [...ids];
  }
  const members = await User.find({ _id: { $in: memberIds }, active: true });
  const { byId } = await projectsOf(wsId);
  const rawMap = new Map([...byId].map(([k, v]) => [k, toRaw(v)]));
  const project = rawMap.get(String(projectId));
  for (const u of members) if (project && canSeeProject(u, project, rawMap)) ids.add(String(u._id));
  return [...ids];
}

module.exports = {
  assertWorkspace,
  assertProject,
  assertScope,
  descendantIds,
  accessibleProjectIds,
  audienceForScope,
  projectsOf,
  canSeeProject,
  toRaw,
  isManager,
};
