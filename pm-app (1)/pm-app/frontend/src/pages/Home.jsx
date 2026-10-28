import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, can } from '../api';
import { useAuth } from '../auth';
import { Empty, ErrorText, Field, MemberPicker, Modal, Progress, useSubmit } from '../components/ui';

function CreateWorkspace({ onClose }) {
  const nav = useNavigate();
  const [users, setUsers] = useState([]);
  const [f, setF] = useState({ name: '', key: '', description: '', members: [] });
  useEffect(() => { api('/users').then((u) => setUsers(u.filter((x) => x.active))); }, []);
  const { busy, error, submit } = useSubmit(
    () => api('/workspaces', { method: 'POST', body: f }),
    (ws) => { onClose(); nav(`/w/${ws._id}`); }
  );
  return (
    <Modal title="New workspace" onClose={onClose} wide>
      <form onSubmit={submit} className="form">
        <div className="row">
          <Field label="Name"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></Field>
          <Field label="Key" hint="Short code, e.g. CRM"><input value={f.key} maxLength={6} onChange={(e) => setF({ ...f, key: e.target.value })} /></Field>
        </div>
        <Field label="Description"><textarea rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <Field label="Members"><MemberPicker users={users} value={f.members} onChange={(members) => setF({ ...f, members })} /></Field>
        <ErrorText error={error} />
        <div className="form-actions"><button className="btn primary" disabled={busy}>Create workspace</button></div>
      </form>
    </Modal>
  );
}

export default function Home() {
  const { user } = useAuth();
  const [list, setList] = useState(null);
  const [creating, setCreating] = useState(false);
  useEffect(() => { api('/workspaces').then(setList); }, [creating]);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Welcome back, {user.name.split(' ')[0]}</h1>
          <p className="muted">Your workspaces and how they are tracking.</p>
        </div>
        {can(user, 'workspace.create') && <button className="btn primary" data-tour="new-workspace" onClick={() => setCreating(true)}>+ New workspace</button>}
      </header>
      {list && !list.length && <Empty>No workspaces yet. {can(user, 'workspace.create') ? 'Create one to get started.' : 'Ask a project manager to add you.'}</Empty>}
      <div className="card-grid" data-tour="ws-cards">
        {list?.map((w) => (
          <Link key={w._id} to={`/w/${w._id}`} className="card ws-card">
            <div className="ws-card-head">
              <span className="ws-key big">{(w.key || w.name).slice(0, 3).toUpperCase()}</span>
              <div>
                <h3>{w.name}</h3>
                <small className="muted">{w.members.length} members · owner {w.owner?.name || '—'}</small>
              </div>
            </div>
            <p className="muted clamp">{w.description || 'No description'}</p>
            <Progress value={w.stats.done} total={w.stats.total} />
            <small className="muted">{w.stats.done} of {w.stats.total} tasks done</small>
          </Link>
        ))}
      </div>
      {creating && <CreateWorkspace onClose={() => setCreating(false)} />}
    </div>
  );
}
