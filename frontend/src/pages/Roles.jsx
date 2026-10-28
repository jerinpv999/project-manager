import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Empty, ErrorText, Field, Modal, useSubmit } from '../components/ui';

const COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948', '#5c5b57'];

const TEMPLATES = {
  blank: { label: 'Blank', permissions: [] },
  member: { label: 'Like Developer', permissions: ['tasks.status.own', 'docs.write', 'chat.write', 'reports.view'] },
  lead: {
    label: 'Like Tech Lead',
    permissions: ['projects.view_all', 'tasks.manage', 'tasks.status.any', 'docs.write', 'docs.delete.any', 'chat.write', 'reports.view', 'reports.export'],
  },
  viewer: { label: 'Read-only (Stakeholder)', permissions: ['reports.view'] },
};

function RoleForm({ initial, catalog, onClose, onSaved }) {
  const [f, setF] = useState(
    initial
      ? { name: initial.name, description: initial.description || '', color: initial.color, permissions: initial.permissions }
      : { name: '', description: '', color: COLORS[6], permissions: TEMPLATES.member.permissions }
  );
  const groups = useMemo(() => {
    const g = {};
    catalog.forEach((p) => (g[p.group] = g[p.group] || []).push(p));
    return g;
  }, [catalog]);
  const toggle = (key, on) => setF({ ...f, permissions: on ? [...new Set([...f.permissions, key])] : f.permissions.filter((p) => p !== key) });

  const { busy, error, submit } = useSubmit(
    () => (initial ? api(`/roles/${initial.key}`, { method: 'PUT', body: f }) : api('/roles', { method: 'POST', body: f })),
    () => { onSaved(); onClose(); }
  );

  return (
    <Modal title={initial ? `Edit role · ${initial.name}` : 'New role'} onClose={onClose} wide>
      <form className="form" onSubmit={submit}>
        <div className="row">
          <Field label="Role name" hint={initial ? `Key: ${initial.key}` : 'e.g. Tech Lead, Scrum Master, Business Analyst'}>
            <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required autoFocus />
          </Field>
          <Field label="Colour">
            <div className="swatches">
              {COLORS.map((c) => (
                <button type="button" key={c} className={`swatch ${f.color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setF({ ...f, color: c })} aria-label={c} />
              ))}
            </div>
          </Field>
        </div>
        <Field label="Description"><input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        {!initial && (
          <div className="templates">
            <span className="field-label">Start from</span>
            {Object.entries(TEMPLATES).map(([k, t]) => (
              <button type="button" key={k} className="btn sm" onClick={() => setF({ ...f, permissions: t.permissions })}>{t.label}</button>
            ))}
          </div>
        )}
        <div className="perm-groups">
          {Object.entries(groups).map(([group, perms]) => (
            <fieldset key={group} className="perm-group">
              <legend>{group}</legend>
              {perms.map((p) => (
                <label key={p.key} className="check perm">
                  <input type="checkbox" checked={f.permissions.includes(p.key)} onChange={(e) => toggle(p.key, e.target.checked)} />
                  <span>{p.label}</span>
                </label>
              ))}
            </fieldset>
          ))}
        </div>
        <ErrorText error={error} />
        <div className="form-actions">
          <span className="muted">{f.permissions.length} of {catalog.length} permissions</span>
          <button className="btn primary" disabled={busy}>{initial ? 'Save role' : 'Create role'}</button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteRole({ role, roles, onClose, onDone }) {
  const [target, setTarget] = useState('developer');
  const { busy, error, submit } = useSubmit(
    () => api(`/roles/${role.key}${role.users ? `?reassignTo=${target}` : ''}`, { method: 'DELETE' }),
    () => { onDone(); onClose(); }
  );
  return (
    <Modal title={`Delete role · ${role.name}`} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        {role.users ? (
          <Field label={`${role.users} user(s) have this role. Move them to:`}>
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              {roles.filter((r) => r.key !== role.key && r.key !== 'admin').map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
            </select>
          </Field>
        ) : (
          <p className="muted">No users have this role. It will be removed permanently.</p>
        )}
        <ErrorText error={error} />
        <div className="form-actions"><button className="btn danger" disabled={busy}>Delete role</button></div>
      </form>
    </Modal>
  );
}

export default function Roles() {
  const { user, reloadRoles, refreshUser } = useAuth();
  const [roles, setRoles] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [view, setView] = useState('cards');

  const load = async () => {
    const [r, c] = await Promise.all([api('/roles'), api('/roles/permissions')]);
    setRoles(r);
    setCatalog(c);
  };
  useEffect(() => { load(); }, []);
  const saved = async () => {
    await load();
    await reloadRoles();
    await refreshUser();
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Roles & permissions</h1>
          <p className="muted">Built-in roles can be adjusted; create your own for leads, scrum masters, analysts or stakeholders.</p>
        </div>
        <div className="head-actions">
          <div className="seg">
            <button className={view === 'cards' ? 'on' : ''} onClick={() => setView('cards')}>Cards</button>
            <button className={view === 'matrix' ? 'on' : ''} onClick={() => setView('matrix')}>Matrix</button>
          </div>
          <button className="btn primary" onClick={() => setEditing({})}>+ New role</button>
        </div>
      </header>

      {!roles.length && <Empty>Loading roles…</Empty>}

      {view === 'cards' ? (
        <div className="card-grid" data-tour="roles-grid">
          {roles.map((r) => (
            <div key={r.key} className="card role-card" style={{ borderTop: `3px solid ${r.color}` }}>
              <div className="role-head">
                <h3>{r.name}</h3>
                <span className="muted">{r.users} user{r.users === 1 ? '' : 's'}</span>
              </div>
              <small className="muted">{r.system ? 'Built-in' : 'Custom'} · key <code>{r.key}</code></small>
              {r.description && <p className="clamp">{r.description}</p>}
              <div className="perm-chips">
                {r.permissions.length === catalog.length ? (
                  <span className="perm-chip all">All permissions</span>
                ) : (
                  catalog.filter((p) => r.permissions.includes(p.key)).map((p) => <span key={p.key} className="perm-chip" title={p.label}>{p.key}</span>)
                )}
                {!r.permissions.length && <span className="muted">No permissions</span>}
              </div>
              <div className="card-actions">
                {!r.locked && <button className="btn sm" onClick={() => setEditing(r)}>Edit</button>}
                {!r.system && <button className="btn sm danger" onClick={() => setDeleting(r)}>Delete</button>}
                {r.locked && <small className="muted">The Admin role always has every permission.</small>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card table-card" data-tour="roles-grid">
          <table className="table matrix">
            <thead>
              <tr>
                <th>Permission</th>
                {roles.map((r) => <th key={r.key} title={r.description}><i className="role-dot" style={{ background: r.color }} /> {r.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {catalog.map((p) => (
                <tr key={p.key}>
                  <td><strong>{p.label}</strong><small className="muted"> · {p.group}</small></td>
                  {roles.map((r) => <td key={r.key} className="center">{r.permissions.includes(p.key) ? '✓' : ''}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="muted small-note">Signed in as {user.name}. Permission changes apply immediately to new requests; other users pick up UI changes when they reload.</p>

      {editing && <RoleForm initial={editing.key ? editing : null} catalog={catalog} onClose={() => setEditing(null)} onSaved={saved} />}
      {deleting && <DeleteRole role={deleting} roles={roles} onClose={() => setDeleting(null)} onDone={saved} />}
    </div>
  );
}
