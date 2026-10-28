import { useCallback, useEffect, useState } from 'react';
import { api, fmtDate, matrixPoints, PRIORITIES, scopeBody, scopeQs, STATUS_LABELS, STORY_MATRIX, STORY_POINTS, TASK_STATUSES, toInputDate } from '../api';
import PointsMatrix from '../components/PointsMatrix';
import { useAuth, useLiveEvent } from '../auth';
import { Avatar, Badge, ErrorText, Field, Modal, Points, useSubmit } from '../components/ui';

const TYPES = ['task', 'story', 'bug', 'ui', 'test'];

export function TaskForm({ scope, features, sprints, initial, preset, onClose, onSaved }) {
  const { user, toast } = useAuth();
  const canEdit = scope.can('tasks.manage');
  const canStatus = scope.can('tasks.status.any') || (scope.can('tasks.status.own') && String(initial?.assignee?._id) === String(user._id));
  const [f, setF] = useState(
    initial
      ? {
          ...initial,
          feature: initial.feature?._id || '', sprint: initial.sprint?._id || '', assignee: initial.assignee?._id || '',
          dueDate: toInputDate(initial.dueDate), points: initial.points ?? '', complexity: initial.complexity ?? '', size: initial.size ?? '',
          pointsMode: initial.pointsMode || (initial.complexity && initial.size ? 'matrix' : 'manual'),
        }
      : { title: '', description: '', type: 'task', priority: 'medium', status: 'todo', feature: '', sprint: '', assignee: '', estimate: '', points: '', complexity: '', size: '', pointsMode: 'matrix', dueDate: '', ...preset }
  );
  const [task, setTask] = useState(initial);
  const [comment, setComment] = useState('');

  const { busy, error, submit } = useSubmit(
    () => {
      const body = {
        title: f.title, description: f.description, type: f.type, priority: f.priority, status: f.status,
        feature: f.feature || null, sprint: f.sprint || null, assignee: f.assignee || null,
        estimate: f.estimate === '' ? null : Number(f.estimate), points: f.points === '' ? null : Number(f.points),
        complexity: f.complexity === '' ? null : Number(f.complexity), size: f.size === '' ? null : Number(f.size),
        pointsMode: f.pointsMode,
        dueDate: f.dueDate || null,
      };
      return initial ? api(`/tasks/${initial._id}`, { method: 'PUT', body }) : api('/tasks', { method: 'POST', body: scopeBody(scope, body) });
    },
    () => { onSaved(); onClose(); }
  );

  const changeStatus = async (status) => {
    try {
      const t = await api(`/tasks/${initial._id}/status`, { method: 'PATCH', body: { status } });
      setF({ ...f, status }); setTask(t); onSaved();
    } catch (e) { toast(e.message, 'error'); }
  };
  const addComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    try { setTask(await api(`/tasks/${initial._id}/comments`, { method: 'POST', body: { text: comment } })); setComment(''); }
    catch (err) { toast(err.message, 'error'); }
  };
  const remove = async () => {
    if (!confirm('Delete this task?')) return;
    try { await api(`/tasks/${initial._id}`, { method: 'DELETE' }); onSaved(); onClose(); } catch (e) { toast(e.message, 'error'); }
  };

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <Modal title={initial ? (canEdit ? 'Edit task' : task.title) : 'New task'} onClose={onClose} wide>
      {canEdit ? (
        <form className="form" onSubmit={submit}>
          <Field label="Title"><input value={f.title} onChange={set('title')} required autoFocus={!initial} /></Field>
          <Field label="Description"><textarea rows={4} value={f.description || ''} onChange={set('description')} /></Field>
          <div className="row three">
            <Field label="Business feature">
              <select value={f.feature} onChange={set('feature')} required>
                <option value="">Select feature…</option>
                {features.map((x) => <option key={x._id} value={x._id}>{x.title}</option>)}
              </select>
            </Field>
            <Field label="Assignee">
              <select value={f.assignee} onChange={set('assignee')}>
                <option value="">Unassigned</option>
                {scope.members.map((m) => <option key={m._id} value={m._id}>{m.name} ({m.role.replace('_', ' ')})</option>)}
              </select>
            </Field>
            <Field label="Sprint">
              <select value={f.sprint} onChange={set('sprint')}>
                <option value="">Backlog</option>
                {sprints.filter((s) => s.status !== 'completed' || s._id === f.sprint).map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            </Field>
          </div>
          <div className="row three">
            <Field label="Type"><select value={f.type} onChange={set('type')}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
            <Field label="Priority"><select value={f.priority} onChange={set('priority')}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></Field>
            <Field label="Status"><select value={f.status} onChange={set('status')}>{TASK_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}</select></Field>
          </div>
          <div className="estimation">
            <div className="estimation-head">
              <strong>Story points</strong>
              <div className="seg">
                <button type="button" className={f.pointsMode === 'matrix' ? 'on' : ''} onClick={() => setF({ ...f, pointsMode: 'matrix' })}>Matrix</button>
                <button type="button" className={f.pointsMode === 'manual' ? 'on' : ''} onClick={() => setF({ ...f, pointsMode: 'manual' })}>Manual</button>
              </div>
            </div>
            {f.pointsMode === 'matrix' ? (
              <>
                <div className="row three">
                  <Field label="Complexity">
                    <select value={f.complexity} onChange={(e) => setF({ ...f, complexity: e.target.value })} required>
                      <option value="">—</option>
                      {[1, 2, 3, 4, 5].map((c) => <option key={c} value={c}>{c} · {STORY_MATRIX.complexityLabels[c - 1]}</option>)}
                    </select>
                  </Field>
                  <Field label="Size">
                    <select value={f.size} onChange={(e) => setF({ ...f, size: e.target.value })} required>
                      <option value="">—</option>
                      {[1, 2, 3, 4, 5].map((x) => <option key={x} value={x}>{x} · {STORY_MATRIX.sizeLabels[x - 1]}</option>)}
                    </select>
                  </Field>
                  <div className="points-result">
                    <span className="field-label">Story points</span>
                    <strong>{f.complexity && f.size ? matrixPoints(Number(f.complexity), Number(f.size), scope.matrix) : '—'}</strong>
                    <small className="muted">{scope.matrixSource === 'workspace' ? 'Workspace matrix' : 'Organisation matrix'}</small>
                  </div>
                </div>
                <details className="matrix-picker" open={!initial}>
                  <summary>Story point matrix — click a cell</summary>
                  <PointsMatrix
                    matrix={scope.matrix}
                    complexity={Number(f.complexity) || null}
                    size={Number(f.size) || null}
                    onPick={(c, x) => setF({ ...f, complexity: String(c), size: String(x) })}
                  />
                </details>
              </>
            ) : (
              <div className="manual-points">
                <Field label="Story points" hint="Enter any value, or leave empty for not estimated">
                  <input type="number" min={0} max={100} step={0.5} value={f.points ?? ''} placeholder="Not estimated" onChange={set('points')} />
                </Field>
                <div className="quick-points">
                  {STORY_POINTS.map((p) => (
                    <button type="button" key={p} className={`chip ${String(f.points) === String(p) ? 'on' : ''}`} onClick={() => setF({ ...f, points: String(p) })}>{p}</button>
                  ))}
                  {f.points !== '' && f.points !== null && <button type="button" className="link-btn" onClick={() => setF({ ...f, points: '' })}>Clear</button>}
                </div>
                {f.complexity && f.size ? (
                  <small className="muted">Matrix would give {matrixPoints(Number(f.complexity), Number(f.size), scope.matrix)} pts for complexity {f.complexity} × size {f.size}; manual value is used instead.</small>
                ) : null}
              </div>
            )}
          </div>
          <div className="row">
            <Field label="Estimate (hours)"><input type="number" min={0} step={0.5} value={f.estimate ?? ''} onChange={set('estimate')} /></Field>
            <Field label="Due date"><input type="date" value={f.dueDate} onChange={set('dueDate')} /></Field>
          </div>
          {!features.length && <div className="error-text">Create a business feature first — tasks are created against features.</div>}
          <ErrorText error={error} />
          <div className="form-actions">
            {initial && <button type="button" className="btn danger" onClick={remove}>Delete</button>}
            <button className="btn primary" disabled={busy}>{initial ? 'Save changes' : 'Create task'}</button>
          </div>
        </form>
      ) : (
        <div className="task-detail">
          <div className="detail-grid">
            <div><span>Feature</span>{task.feature?.title || '—'}</div>
            <div><span>Assignee</span>{task.assignee?.name || 'Unassigned'}</div>
            <div><span>Sprint</span>{task.sprint?.name || 'Backlog'}</div>
            <div><span>Priority</span><Badge value={task.priority} /></div>
            <div><span>Type</span>{task.type}</div>
            <div><span>Due</span>{fmtDate(task.dueDate)}</div>
            <div><span>Story points</span>{task.points ?? 'Not estimated'}{task.pointsMode === 'matrix' && task.complexity && task.size ? <small className="muted"> (complexity {task.complexity} × size {task.size})</small> : task.points != null ? <small className="muted"> (manual)</small> : null}</div>
          </div>
          {task.description && <p className="pre">{task.description}</p>}
          <Field label="Status">
            <select value={f.status} disabled={!canStatus} onChange={(e) => changeStatus(e.target.value)}>
              {TASK_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </Field>
        </div>
      )}
      {initial && (
        <div className="comments">
          <h4>Comments</h4>
          {(task.comments || []).map((c) => (
            <div key={c._id} className="comment"><Avatar name={c.author?.name || '?'} size={22} /><div><strong>{c.author?.name}</strong> <small className="muted">{new Date(c.at).toLocaleString()}</small><p>{c.text}</p></div></div>
          ))}
          <form onSubmit={addComment} className="comment-form">
            <input placeholder="Add a comment…" value={comment} onChange={(e) => setComment(e.target.value)} />
            <button className="btn sm">Post</button>
          </form>
        </div>
      )}
    </Modal>
  );
}

export default function Tasks({ scope }) {
  const { user, toast } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [features, setFeatures] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [filters, setFilters] = useState({ feature: '', sprint: '', assignee: '', all: '' });
  const [editing, setEditing] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  const load = useCallback(() => {
    api(`/tasks${scopeQs(scope, { ...filters, all: filters.all ? 1 : '' })}`).then(setTasks).catch((e) => toast(e.message, 'error'));
  }, [scope.wid, scope.pid, filters]); // eslint-disable-line
  useEffect(() => {
    api(`/features${scopeQs(scope)}`).then(setFeatures);
    api(`/sprints${scopeQs(scope)}`).then(setSprints);
  }, [scope.wid, scope.pid]); // eslint-disable-line
  useEffect(() => { load(); }, [load]);
  useLiveEvent('task.updated', load);

  const move = async (taskId, status) => {
    const t = tasks.find((x) => x._id === taskId);
    if (!t || t.status === status) return;
    setTasks((ts) => ts.map((x) => (x._id === taskId ? { ...x, status } : x)));
    try { await api(`/tasks/${taskId}/status`, { method: 'PATCH', body: { status } }); }
    catch (e) { toast(e.message, 'error'); load(); }
  };

  const setF = (k) => (e) => setFilters({ ...filters, [k]: e.target.value });
  const canDrag = (t) => scope.can('tasks.status.any') || (scope.can('tasks.status.own') && String(t.assignee?._id) === String(user._id));

  return (
    <div>
      <div className="toolbar filters" data-tour="task-filters">
        <select value={filters.feature} onChange={setF('feature')}>
          <option value="">All features</option>
          {features.map((f) => <option key={f._id} value={f._id}>{f.title}</option>)}
        </select>
        <select value={filters.sprint} onChange={setF('sprint')}>
          <option value="">All sprints</option>
          <option value="none">Backlog</option>
          {sprints.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
        </select>
        <select value={filters.assignee} onChange={setF('assignee')}>
          <option value="">Everyone</option>
          <option value={user._id}>Me</option>
          {scope.members.filter((m) => m._id !== user._id).map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
        </select>
        <label className="check"><input type="checkbox" checked={!!filters.all} onChange={(e) => setFilters({ ...filters, all: e.target.checked ? '1' : '' })} /> Include sub-projects / modules</label>
        <div className="spacer" />
        {scope.can('tasks.manage') && <button className="btn primary" data-tour="new-task" onClick={() => setEditing({})}>+ New task</button>}
      </div>

      <div className="board" data-tour="board">
        {TASK_STATUSES.map((s) => {
          const col = tasks.filter((t) => t.status === s);
          return (
            <div
              key={s}
              className={`column ${dragOver === s ? 'drag-over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(s); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => { e.preventDefault(); setDragOver(null); move(e.dataTransfer.getData('text/plain'), s); }}
            >
              <div className={`column-head st-${s}`}><span>{STATUS_LABELS[s]}</span><span className="col-meta"><small className="muted">{col.reduce((a, t) => a + (Number(t.points) || 0), 0)} pts</small><span className="count">{col.length}</span></span></div>
              {col.map((t) => {
                const overdue = t.dueDate && t.status !== 'done' && new Date(t.dueDate) < new Date();
                return (
                  <div
                    key={t._id}
                    className={`task-card prio-${t.priority}`}
                    draggable={canDrag(t)}
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', t._id)}
                    onClick={() => setEditing(t)}
                  >
                    <div className="task-card-top"><span className={`type type-${t.type}`}>{t.type}</span><span className="card-badges"><Points value={t.points} /><Badge value={t.priority} /></span></div>
                    <div className="task-card-title">{t.title}</div>
                    {t.feature && <div className="task-card-feature">◆ {t.feature.title}</div>}
                    <div className="task-card-foot">
                      <span className={overdue ? 'overdue' : 'muted'}>{t.dueDate ? fmtDate(t.dueDate) : t.sprint?.name || ''}</span>
                      {t.assignee ? <Avatar name={t.assignee.name} size={22} /> : <span className="muted">—</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      {editing && (
        <TaskForm scope={scope} features={features} sprints={sprints} initial={editing._id ? editing : null} onClose={() => setEditing(null)} onSaved={load} />
      )}
    </div>
  );
}
