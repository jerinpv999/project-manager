import { useCallback, useEffect, useState } from 'react';
import { api, PRIORITIES, scopeBody, scopeQs } from '../api';
import { useAuth, useLiveEvent } from '../auth';
import { Avatar, Badge, Empty, ErrorText, Field, Modal, Progress, useSubmit } from '../components/ui';
import { TaskForm } from './Tasks';

function FeatureForm({ scope, initial, onClose, onSaved }) {
  const [f, setF] = useState(
    initial ? { ...initial, owner: initial.owner?._id || '' } : { title: '', description: '', priority: 'medium', status: 'proposed', owner: '' }
  );
  const { busy, error, submit } = useSubmit(
    () => {
      const body = { ...f, owner: f.owner || null };
      return initial ? api(`/features/${initial._id}`, { method: 'PUT', body }) : api('/features', { method: 'POST', body: scopeBody(scope, body) });
    },
    () => { onSaved(); onClose(); }
  );
  return (
    <Modal title={initial ? 'Edit business feature' : 'New business feature'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Field label="Title"><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required /></Field>
        <Field label="Description / acceptance criteria"><textarea rows={5} value={f.description || ''} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <div className="row">
          <Field label="Priority">
            <select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select>
          </Field>
          <Field label="Status">
            <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
              <option value="proposed">Proposed</option><option value="approved">Approved</option>
              <option value="in_progress">In progress</option><option value="done">Done</option>
            </select>
          </Field>
        </div>
        <Field label="Owner">
          <select value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })}>
            <option value="">—</option>
            {scope.members.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
          </select>
        </Field>
        <ErrorText error={error} />
        <div className="form-actions"><button className="btn primary" disabled={busy}>Save</button></div>
      </form>
    </Modal>
  );
}

export default function Features({ scope }) {
  const { toast } = useAuth();
  const [features, setFeatures] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [editing, setEditing] = useState(null);
  const [newTaskFor, setNewTaskFor] = useState(null);
  const [open, setOpen] = useState({});

  const load = useCallback(() => {
    api(`/features${scopeQs(scope)}`).then(setFeatures);
    api(`/tasks${scopeQs(scope)}`).then(setTasks);
    api(`/sprints${scopeQs(scope)}`).then(setSprints);
  }, [scope.wid, scope.pid]); // eslint-disable-line
  useEffect(() => { load(); }, [load]);
  useLiveEvent('task.updated', load);
  useLiveEvent('scope.changed', load);

  const remove = async (f) => {
    if (!confirm(`Delete feature "${f.title}"?`)) return;
    try { await api(`/features/${f._id}`, { method: 'DELETE' }); load(); } catch (e) { toast(e.message, 'error'); }
  };

  return (
    <div>
      <div className="toolbar">
        <p className="muted">Business features {scope.project ? `in ${scope.project.name}` : 'at workspace level'}. Tasks are created against a feature.</p>
        {scope.canManage && <button className="btn primary" onClick={() => setEditing({})}>+ New feature</button>}
      </div>
      {!features.length && <Empty>No business features yet.</Empty>}
      <div className="feature-list">
        {features.map((f) => {
          const ft = tasks.filter((t) => String(t.feature?._id) === String(f._id));
          const done = ft.filter((t) => t.status === 'done').length;
          const ptsTotal = ft.reduce((a, t) => a + (Number(t.points) || 0), 0);
          const ptsDone = ft.filter((t) => t.status === 'done').reduce((a, t) => a + (Number(t.points) || 0), 0);
          return (
            <div key={f._id} className="card feature-card">
              <div className="feature-main" onClick={() => setOpen({ ...open, [f._id]: !open[f._id] })}>
                <div className="feature-title">
                  <span className="caret">{open[f._id] ? '▾' : '▸'}</span>
                  <strong>{f.title}</strong>
                  <Badge value={f.priority} />
                  <Badge value={f.status} />
                </div>
                <div className="feature-meta">
                  {f.owner && <span className="owner"><Avatar name={f.owner.name} size={20} /> {f.owner.name}</span>}
                  <div style={{ width: 160 }}><Progress value={done} total={ft.length} /></div>
                  <small className="muted">{done}/{ft.length} tasks · {ptsDone}/{ptsTotal} pts</small>
                </div>
              </div>
              {open[f._id] && (
                <div className="feature-body">
                  {f.description && <p className="pre">{f.description}</p>}
                  <ul className="mini-tasks">
                    {ft.map((t) => (
                      <li key={t._id}><Badge value={t.status} /> {t.points != null && <span className="points">{t.points}</span>} {t.title} {t.assignee && <small className="muted">· {t.assignee.name}</small>}</li>
                    ))}
                    {!ft.length && <li className="muted">No tasks yet</li>}
                  </ul>
                  {(scope.canManage || scope.can('tasks.manage')) && (
                    <div className="card-actions">
                      {scope.can('tasks.manage') && <button className="btn sm primary" onClick={() => setNewTaskFor(f)}>+ Task</button>}
                      {scope.canManage && <button className="btn sm" onClick={() => setEditing(f)}>Edit</button>}
                      {scope.canManage && <button className="btn sm danger" onClick={() => remove(f)}>Delete</button>}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {editing && <FeatureForm scope={scope} initial={editing._id ? editing : null} onClose={() => setEditing(null)} onSaved={load} />}
      {newTaskFor && (
        <TaskForm scope={scope} features={features} sprints={sprints} preset={{ feature: newTaskFor._id }} onClose={() => setNewTaskFor(null)} onSaved={load} />
      )}
    </div>
  );
}
