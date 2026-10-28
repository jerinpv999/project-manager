const BASE = '/api';
const TOKEN_KEY = 'pm_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

export async function api(path, { method = 'GET', body } = {}) {
  const token = getToken();
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && !path.startsWith('/auth/login')) {
    setToken(null);
    if (location.pathname !== '/login') location.href = '/login';
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || res.statusText);
  return data;
}

export const qs = (o) => {
  const p = new URLSearchParams();
  Object.entries(o).forEach(([k, v]) => v !== undefined && v !== null && v !== '' && p.set(k, v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

// scope -> query params understood by the backend
export const scopeQs = (scope, extra = {}) =>
  qs({ workspace: scope.wid, project: scope.pid || 'root', ...extra });

export const scopeBody = (scope, body) => ({ workspace: scope.wid, project: scope.pid || null, ...body });

// Role labels/metadata. Filled from GET /api/roles after sign-in (custom roles included);
// the defaults cover the login screen before roles are loaded.
export const ROLE_LABELS = {
  admin: 'Admin',
  project_manager: 'Project Manager',
  developer: 'Developer',
  qa: 'QA',
  ui_developer: 'UI Developer',
};
export const ROLE_META = {};
export function setRoles(roles) {
  Object.keys(ROLE_META).forEach((k) => delete ROLE_META[k]);
  roles.forEach((r) => { ROLE_LABELS[r.key] = r.name; ROLE_META[r.key] = r; });
}
export const roleLabel = (key) => ROLE_LABELS[key] || key;
// permission checks: current user carries resolved permissions; other users via their role
export const can = (user, perm) => !!user && (user.role === 'admin' || (user.permissions || []).includes(perm));
export const roleCan = (roleKey, perm) => roleKey === 'admin' || !!ROLE_META[roleKey]?.permissions?.includes(perm);
export const STORY_POINTS = [0, 1, 2, 3, 5, 8, 13, 21];
// Story point matrix (complexity × size), loaded from /api/settings/story-points after sign-in
export const STORY_MATRIX = {
  matrix: [[1, 2, 3, 5, 8], [2, 2, 3, 5, 8], [3, 3, 5, 8, 13], [3, 5, 8, 13, 21], [5, 8, 13, 21, 21]],
  complexityLabels: ['Very low', 'Low', 'Medium', 'High', 'Very high'],
  sizeLabels: ['XS', 'S', 'M', 'L', 'XL'],
};
export const setStoryMatrix = (m) => Object.assign(STORY_MATRIX, m);
export const matrixPoints = (c, s, matrix = STORY_MATRIX.matrix) => (c >= 1 && c <= 5 && s >= 1 && s <= 5 ? matrix[c - 1][s - 1] : null);
export const TASK_STATUSES = ['todo', 'in_progress', 'in_review', 'qa', 'done', 'blocked'];
export const STATUS_LABELS = {
  todo: 'To do', in_progress: 'In progress', in_review: 'In review', qa: 'QA', done: 'Done', blocked: 'Blocked',
  proposed: 'Proposed', approved: 'Approved', planned: 'Planned', active: 'Active', completed: 'Completed', at_risk: 'At risk',
};
export const PRIORITIES = ['low', 'medium', 'high', 'critical'];
export const isManager = (u) => can(u, 'planning.manage');
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const toInputDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

// Authenticated file download (CSV exports)
export async function download(path) {
  const res = await fetch(BASE + path, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || res.statusText);
  }
  const cd = res.headers.get('Content-Disposition') || '';
  const name = (cd.match(/filename="([^"]+)"/) || [])[1] || 'export.csv';
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
