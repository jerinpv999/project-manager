// Permission catalog + built-in roles.
// Admin always has every permission. Other roles (built-in or custom) get an explicit list,
// editable on the Roles page.

const PERMISSIONS = [
  { key: 'users.manage', group: 'Administration', label: 'Manage users (create, edit, deactivate, delete)' },
  { key: 'roles.manage', group: 'Administration', label: 'Manage roles and permissions' },
  { key: 'settings.manage', group: 'Administration', label: 'Manage settings (story point matrix)' },
  { key: 'workspace.create', group: 'Workspaces', label: 'Create workspaces' },
  { key: 'workspace.delete', group: 'Workspaces', label: 'Delete workspaces' },
  { key: 'structure.manage', group: 'Workspaces', label: 'Manage members, sub-projects and modules' },
  { key: 'projects.view_all', group: 'Workspaces', label: 'See every sub-project/module in their workspaces' },
  { key: 'planning.manage', group: 'Planning', label: 'Create & edit sprints, business features and roadmap' },
  { key: 'tasks.manage', group: 'Tasks', label: 'Create, edit, assign and delete tasks' },
  { key: 'tasks.status.any', group: 'Tasks', label: 'Change status of any task' },
  { key: 'tasks.status.own', group: 'Tasks', label: 'Change status of own tasks' },
  { key: 'docs.write', group: 'Content', label: 'Write docs and diagrams' },
  { key: 'docs.delete.any', group: 'Content', label: "Delete anyone's docs and diagrams" },
  { key: 'chat.write', group: 'Content', label: 'Post in chat' },
  { key: 'reports.view', group: 'Reports', label: 'View sprint analysis' },
  { key: 'reports.export', group: 'Reports', label: 'Export reports as CSV' },
];
const ALL = PERMISSIONS.map((p) => p.key);

const BASE = ['tasks.status.own', 'docs.write', 'chat.write', 'reports.view'];

const SYSTEM_ROLES = [
  { key: 'admin', name: 'Admin', color: '#6250d6', description: 'Full access to everything.', permissions: ALL, locked: true },
  {
    key: 'project_manager', name: 'Project Manager', color: '#2a78d6', description: 'Plans and runs workspaces.',
    permissions: ['workspace.create', 'structure.manage', 'projects.view_all', 'planning.manage', 'tasks.manage', 'tasks.status.any', 'docs.delete.any', ...BASE, 'reports.export'],
  },
  { key: 'developer', name: 'Developer', color: '#1baf7a', description: 'Works on assigned tasks.', permissions: [...BASE] },
  { key: 'ui_developer', name: 'UI Developer', color: '#e87ba4', description: 'Works on UI tasks.', permissions: [...BASE] },
  { key: 'qa', name: 'QA', color: '#eda100', description: 'Verifies work; can move any task.', permissions: [...BASE, 'tasks.status.any'] },
];

module.exports = { PERMISSIONS, ALL, SYSTEM_ROLES };
