import { useCallback, useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, download, fmtDate, scopeBody, scopeQs, toInputDate } from '../api';
import { useAuth, useLiveEvent } from '../auth';
import { Avatar, Badge, Empty, ErrorText, Field, Modal, Progress, useSubmit } from '../components/ui';
import SprintReport from '../components/SprintReport';

const DAY = 86400000;
const axis = { fontSize: 12, fill: 'var(--text-2)' };

function SprintForm({ scope, initial, onClose, onSaved }) {
  const today = new Date();
  const [f, setF] = useState(
    initial
      ? {
          ...initial,
          startDate: toInputDate(initial.startDate),
          endDate: toInputDate(initial.endDate),
          capacity: initial.capacity || 0,
          memberCapacity: (initial.memberCapacity || []).map((m) => ({ user: m.user?._id || m.user, points: m.points })),
        }
      : {
          name: 'Sprint 1', goal: '', startDate: toInputDate(today), endDate: toInputDate(new Date(+today + 14 * DAY)),
          status: 'planned', capacity: 0, memberCapacity: [], recurrence: { enabled: false, lengthDays: 14, carryOver: true },
        }
  );
  const rec = f.recurrence || {};
  const setRec = (patch) => setF({ ...f, recurrence: { ...rec, ...patch } });
  const capOf = (uid) => f.memberCapacity.find((m) => String(m.user) === String(uid))?.points ?? '';
  const setCap = (uid, v) => {
    const rest = f.memberCapacity.filter((m) => String(m.user) !== String(uid));
    setF({ ...f, memberCapacity: v === '' ? rest : [...rest, { user: uid, points: Number(v) }] });
  };
  const memberSum = f.memberCapacity.reduce((a, m) => a + (Number(m.points) || 0), 0);

  const { busy, error, submit } = useSubmit(
    () => {
      const body = { ...f, capacity: memberSum > 0 ? memberSum : Number(f.capacity) || 0 };
      return initial ? api(`/sprints/${initial._id}`, { method: 'PUT', body }) : api('/sprints', { method: 'POST', body: scopeBody(scope, body) });
    },
    () => { onSaved(); onClose(); }
  );
  return (
    <Modal title={initial ? 'Edit sprint' : 'New sprint'} onClose={onClose} wide>
      <form className="form" onSubmit={submit}>
        <div className="row">
          <Field label="Name"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></Field>
          <Field label="Status">
            <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
              <option value="planned">Planned</option><option value="active">Active</option><option value="completed">Completed</option>
            </select>
          </Field>
        </div>
        <Field label="Goal"><textarea rows={2} value={f.goal || ''} onChange={(e) => setF({ ...f, goal: e.target.value })} /></Field>
        <div className="row">
          <Field label="Start"><input type="date" value={f.startDate} onChange={(e) => {
            const s = e.target.value;
            setF({ ...f, startDate: s, endDate: rec.enabled ? toInputDate(new Date(new Date(s).getTime() + (rec.lengthDays || 14) * DAY)) : f.endDate });
          }} required /></Field>
          <Field label="End"><input type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} required /></Field>
        </div>

        <div className="recurrence">
          <div className="cap-head">
            <strong>Story-point capacity</strong>
            <div className="cap-total">
              Total
              <input type="number" min={0} value={memberSum > 0 ? memberSum : f.capacity} disabled={memberSum > 0}
                onChange={(e) => setF({ ...f, capacity: e.target.value })} />
              pts
            </div>
          </div>
          <small className="muted">Optionally split the capacity per person — the total is then the sum. Leave a person empty if they are not in this sprint.</small>
          <div className="cap-grid">
            {scope.members.map((m) => (
              <label key={m._id} className="cap-row">
                <Avatar name={m.name} size={22} />
                <span>{m.name}</span>
                <input type="number" min={0} placeholder="—" value={capOf(m._id)} onChange={(e) => setCap(m._id, e.target.value)} />
              </label>
            ))}
          </div>
        </div>

        <div className="recurrence">
          <label className="check"><input type="checkbox" checked={!!rec.enabled} onChange={(e) => setRec({ enabled: e.target.checked })} /> Recurring sprint</label>
          {rec.enabled && (
            <div className="row">
              <Field label="Length (days)" hint="Next sprint starts automatically when this one ends">
                <input type="number" min={1} max={90} value={rec.lengthDays} onChange={(e) => {
                  const n = Number(e.target.value);
                  setF({ ...f, recurrence: { ...rec, lengthDays: n }, endDate: toInputDate(new Date(new Date(f.startDate).getTime() + n * DAY)) });
                }} />
              </Field>
              <label className="check"><input type="checkbox" checked={!!rec.carryOver} onChange={(e) => setRec({ carryOver: e.target.checked })} /> Carry unfinished tasks over</label>
            </div>
          )}
        </div>
        <ErrorText error={error} />
        <div className="form-actions"><button className="btn primary" disabled={busy}>Save sprint</button></div>
      </form>
    </Modal>
  );
}

export default function Sprints({ scope }) {
  const { toast } = useAuth();
  const [sprints, setSprints] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [velocity, setVelocity] = useState([]);
  const [editing, setEditing] = useState(null);
  const [report, setReport] = useState(null);
  const canView = scope.can('reports.view');
  const canExport = scope.can('reports.export');

  const load = useCallback(() => {
    api(`/sprints${scopeQs(scope)}`).then(setSprints);
    api(`/tasks${scopeQs(scope, { all: 1 })}`).then(setTasks);
    if (canView) api(`/sprints/velocity${scopeQs(scope)}`).then(setVelocity).catch(() => {});
  }, [scope.wid, scope.pid, canView]); // eslint-disable-line
  useEffect(() => { load(); }, [load]);
  useLiveEvent('scope.changed', load);
  useLiveEvent('task.updated', load);

  const remove = async (s) => {
    if (!confirm(`Delete ${s.name}? Tasks stay but are unlinked from the sprint.`)) return;
    try { await api(`/sprints/${s._id}`, { method: 'DELETE' }); load(); } catch (e) { toast(e.message, 'error'); }
  };
  const exportAll = async () => {
    try { await download(`/sprints/export/csv${scopeQs(scope)}`); } catch (e) { toast(e.message, 'error'); }
  };

  const vel = velocity.map((v) => ({ name: v.name, Capacity: v.capacity, Committed: v.committed, Completed: v.completed }));
  const avgVelocity = (() => {
    const done = velocity.filter((v) => v.status === 'completed');
    return done.length ? Math.round(done.reduce((a, v) => a + v.completed, 0) / done.length) : null;
  })();

  return (
    <div>
      <div className="toolbar">
        <p className="muted">Sprints {scope.project ? `for ${scope.project.name}` : 'at workspace level'}. Recurring sprints roll over automatically.</p>
        <div className="head-actions">
          {canExport && sprints.length > 0 && <button className="btn" onClick={exportAll}>⤓ Export all sprints CSV</button>}
          {scope.canManage && <button className="btn primary" onClick={() => setEditing({})}>+ New sprint</button>}
        </div>
      </div>

      {canView && vel.length > 0 && (
        <section className="card chart-card velocity" data-tour="velocity">
          <header>
            <h3>Story points per sprint</h3>
            <small className="muted">Capacity vs committed vs completed{avgVelocity !== null && ` · average velocity ${avgVelocity} pts`}</small>
          </header>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={vel} margin={{ right: 8 }} barGap={2}>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis dataKey="name" tick={axis} axisLine={false} tickLine={false} interval={0} />
              <YAxis allowDecimals={false} tick={axis} axisLine={false} tickLine={false} width={32} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--line)', fontSize: 13 }} cursor={{ fill: 'rgba(0,0,0,0.04)' }} formatter={(v, n) => [`${v} pts`, n]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Capacity" fill="#c3c2b7" radius={[4, 4, 0, 0]} barSize={14} />
              <Bar dataKey="Committed" fill="#2a78d6" radius={[4, 4, 0, 0]} barSize={14} />
              <Bar dataKey="Completed" fill="#1baf7a" radius={[4, 4, 0, 0]} barSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}

      {!sprints.length && <Empty>No sprints yet.</Empty>}
      <div className="card-grid">
        {sprints.map((s) => {
          const st = tasks.filter((t) => String(t.sprint?._id) === String(s._id));
          const committed = st.reduce((a, t) => a + (Number(t.points) || 0), 0);
          const completed = st.filter((t) => t.status === 'done').reduce((a, t) => a + (Number(t.points) || 0), 0);
          const left = Math.ceil((new Date(s.endDate) - new Date()) / DAY);
          const over = s.capacity > 0 && committed > s.capacity;
          return (
            <div key={s._id} className={`card sprint-card ${s.status}`}>
              <div className="sprint-head">
                <h3>{s.name}</h3>
                <Badge value={s.status} />
              </div>
              <small className="muted">{fmtDate(s.startDate)} → {fmtDate(s.endDate)}{s.status === 'active' && left >= 0 && ` · ${left} days left`}</small>
              {s.recurrence?.enabled && <div className="pill">↻ Every {s.recurrence.lengthDays} days{s.recurrence.carryOver ? ' · carry-over' : ''}</div>}
              {s.goal && <p className="clamp">{s.goal}</p>}
              <div className="sprint-points">
                <div><span>Capacity</span><strong>{s.capacity || '—'}</strong></div>
                <div><span>Committed</span><strong className={over ? 'warn' : ''}>{committed}</strong></div>
                <div><span>Completed</span><strong>{completed}</strong></div>
              </div>
              {over && <small className="overdue">Over capacity by {committed - s.capacity} pts</small>}
              <Progress value={completed} total={committed} />
              <small className="muted">{completed}/{committed} points · {st.filter((t) => t.status === 'done').length}/{st.length} tasks</small>
              <div className="card-actions">
                {canView && <button className="btn sm primary" onClick={() => setReport(s._id)}>Analyse</button>}
                {scope.canManage && <button className="btn sm" onClick={() => setEditing(s)}>Edit</button>}
                {scope.canManage && <button className="btn sm danger" onClick={() => remove(s)}>Delete</button>}
              </div>
            </div>
          );
        })}
      </div>
      {editing && <SprintForm scope={scope} initial={editing._id ? editing : null} onClose={() => setEditing(null)} onSaved={load} />}
      {report && <SprintReport sprintId={report} canExport={canExport} onClose={() => setReport(null)} />}
    </div>
  );
}
