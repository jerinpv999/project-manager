import { useEffect, useState } from 'react';
import { api, ROLE_LABELS, ROLE_META, fmtDate } from '../api';
import { useAuth } from '../auth';
import { Avatar, Badge, ErrorText, Field, Modal, useSubmit } from '../components/ui';

function UserForm({ initial, onClose, onSaved }) {
  const [f, setF] = useState(initial || { name: '', email: '', password: '', role: 'developer' });
  const { busy, error, submit } = useSubmit(
    () => (initial ? api(`/users/${initial._id}`, { method: 'PUT', body: f }) : api('/users', { method: 'POST', body: f })),
    () => { onSaved(); onClose(); }
  );
  return (
    <Modal title={initial ? 'Edit user' : 'New user'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Field label="Name"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></Field>
        <Field label="Email"><input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></Field>
        <Field label={initial ? 'New password' : 'Password'} hint={initial ? 'Leave blank to keep the current password' : ''}>
          <input type="password" value={f.password || ''} onChange={(e) => setF({ ...f, password: e.target.value })} required={!initial} minLength={6} />
        </Field>
        <Field label="Role">
          <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
            {Object.values(ROLE_META).map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
          </select>
        </Field>
        <ErrorText error={error} />
        <div className="form-actions"><button className="btn primary" disabled={busy}>Save</button></div>
      </form>
    </Modal>
  );
}

export default function Users() {
  const { user: me, toast } = useAuth();
  const [users, setUsers] = useState([]);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState('');
  const load = () => api('/users').then(setUsers);
  useEffect(() => { load(); }, []);

  const toggle = async (u) => {
    try {
      await api(`/users/${u._id}/active`, { method: 'PATCH', body: { active: !u.active } });
      load();
    } catch (e) { toast(e.message, 'error'); }
  };
  const remove = async (u) => {
    if (!confirm(`Delete ${u.name}?\n\nTheir tasks, features, workspace/project memberships, documents and chat messages will be delegated to you (${me.name}).`)) return;
    try {
      const r = await api(`/users/${u._id}`, { method: 'DELETE' });
      const moved = Object.values(r.summary).reduce((a, b) => a + b, 0);
      toast(`Deleted ${r.deleted}. ${moved} records delegated to you.`);
      load();
    } catch (e) { toast(e.message, 'error'); }
  };

  const shown = users.filter((u) => `${u.name} ${u.email} ${u.role}`.toLowerCase().includes(filter.toLowerCase()));
  return (
    <div className="page">
      <header className="page-head">
        <div><h1>Users</h1><p className="muted">Create, edit, deactivate or delete accounts.</p></div>
        <div className="head-actions">
          <input className="search" placeholder="Search users" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <button className="btn primary" onClick={() => setEditing({})}>+ New user</button>
        </div>
      </header>
      <div className="card table-card" data-tour="users-table">
        <table className="table">
          <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Joined</th><th /></tr></thead>
          <tbody>
            {shown.map((u) => (
              <tr key={u._id} className={u.active ? '' : 'row-muted'}>
                <td><div className="user-cell"><Avatar name={u.name} /><div><strong>{u.name}</strong><small>{u.email}</small></div></div></td>
                <td><Badge value={u.role} kind="role" /></td>
                <td><Badge value={u.active ? 'Active' : 'Deactivated'} kind={u.active ? 'done' : 'blocked'} /></td>
                <td>{fmtDate(u.createdAt)}</td>
                <td className="actions">
                  <button className="btn sm" onClick={() => setEditing(u)}>Edit</button>
                  {u._id !== me._id && (
                    <>
                      <button className="btn sm" onClick={() => toggle(u)}>{u.active ? 'Deactivate' : 'Activate'}</button>
                      <button className="btn sm danger" onClick={() => remove(u)}>Delete</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && <UserForm initial={editing._id ? { ...editing, password: '' } : null} onClose={() => setEditing(null)} onSaved={load} />}
    </div>
  );
}
