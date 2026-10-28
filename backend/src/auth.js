const jwt = require('jsonwebtoken');
const { User, Role } = require('./models');
const { ALL, SYSTEM_ROLES } = require('./permissions');

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

// ---------- roles & permissions ----------
// In-memory cache: role key -> Set(permission). Refreshed whenever roles change.
const roleCache = new Map();

async function refreshRoles() {
  const roles = await Role.find();
  roleCache.clear();
  for (const r of roles) roleCache.set(r.key, new Set(r.key === 'admin' ? ALL : r.permissions));
}

// Create built-in roles if missing (never overwrites edited permissions).
async function ensureSystemRoles() {
  for (const r of SYSTEM_ROLES) {
    const existing = await Role.findOne({ key: r.key });
    if (!existing) await Role.create({ ...r, system: true, locked: !!r.locked });
    else if (r.key === 'admin') await Role.updateOne({ key: 'admin' }, { permissions: ALL, locked: true, system: true });
  }
  await refreshRoles();
}

const permissionsOf = (user) => (user?.role === 'admin' ? ALL : [...(roleCache.get(user?.role) || [])]);
const can = (user, perm) => !!user && (user.role === 'admin' || roleCache.get(user.role)?.has(perm) === true);

const requirePerm = (perm) => (req, res, next) => {
  if (!can(req.user, perm)) throw httpError(403, `Missing permission: ${perm}`);
  next();
};

// ---------- tokens ----------
const signToken = (user) => jwt.sign({ sub: String(user._id) }, SECRET, { expiresIn: '7d' });

async function userFromToken(token) {
  if (!token) throw httpError(401, 'Missing token');
  let payload;
  try {
    payload = jwt.verify(token, SECRET);
  } catch {
    throw httpError(401, 'Invalid token');
  }
  const user = await User.findById(payload.sub);
  if (!user) throw httpError(401, 'User no longer exists');
  if (!user.active) throw httpError(403, 'Account is deactivated');
  return user;
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  req.user = await userFromToken(header.startsWith('Bearer ') ? header.slice(7) : null);
  next();
}

// user JSON for the client, with resolved permissions
const publicUser = (user) => {
  const { password, ...rest } = user.toObject ? user.toObject() : user;
  return { ...rest, permissions: permissionsOf(user) };
};

// Back-compat helpers
const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) throw httpError(403, 'Insufficient role');
  next();
};
const isManager = (u) => can(u, 'planning.manage');

module.exports = {
  signToken, userFromToken, requireAuth, requireRole, requirePerm, can, permissionsOf, publicUser,
  refreshRoles, ensureSystemRoles, isManager, httpError,
};
