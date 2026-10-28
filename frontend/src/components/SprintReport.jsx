import { useEffect, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { api, download, fmtDate, ROLE_LABELS, STATUS_LABELS, TASK_STATUSES } from '../api';
import { useAuth } from '../auth';
import { Avatar, Badge, Empty, Modal } from './ui';

// fixed categorical palette (same order as the dashboard)
const C = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
const STATUS_COLOR = Object.fromEntries(TASK_STATUSES.map((s, i) => [s, C[i]]));
const CAPACITY = '#c3c2b7';
const ALLOCATED = C[0];
const COMPLETED = C[2];
const axis = { fontSize: 12, fill: 'var(--text-2)' };
const tip = { contentStyle: { borderRadius: 8, border: '1px solid var(--line)', fontSize: 13 }, cursor: { fill: 'rgba(0,0,0,0.04)' } };

export default function SprintReport({ sprintId, canExport, onClose }) {
  const { toast } = useAuth();
  const [r, setR] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('people');

  useEffect(() => {
    api(`/sprints/${sprintId}/report`).then(setR).catch((e) => setError(e.message));
  }, [sprintId]);

  const exportCsv = async (type) => {
    try { await download(`/sprints/${sprintId}/report/csv?type=${type}`); } catch (e) { toast(e.message, 'error'); }
  };

  return (
    <Modal title={r ? `Sprint analysis · ${r.sprint.name}` : 'Sprint analysis'} onClose={onClose} wide>
      {error && <Empty>{error}</Empty>}
      {!r && !error && <div className="muted">Loading…</div>}
      {r && <ReportBody r={r} tab={tab} setTab={setTab} canExport={canExport} exportCsv={exportCsv} />}
    </Modal>
  );
}

function ReportBody({ r, tab, setTab, canExport, exportCsv }) {
  const t = r.totals;
  const people = r.members.map((m) => ({ name: m.name, Capacity: m.capacity || 0, Allocated: m.allocated, Completed: m.completed }));
  const hasCapacity = r.members.some((m) => m.capacity > 0);
  const status = r.byStatus.map((s) => ({ ...s, name: STATUS_LABELS[s.status] }));

  return (
    <div className="report">
      <div className="report-head">
        <small className="muted">
          {fmtDate(r.sprint.startDate)} → {fmtDate(r.sprint.endDate)} · <Badge value={r.sprint.status} />
          {r.sprint.goal && <> · {r.sprint.goal}</>}
        </small>
        {canExport && (
          <div className="head-actions">
            <button className="btn sm" onClick={() => exportCsv('members')}>⤓ Employees CSV</button>
            <button className="btn sm" onClick={() => exportCsv('tasks')}>⤓ Tasks CSV</button>
          </div>
        )}
      </div>

      <div className="stat-row">
        <div className="stat hero"><span>Points completed</span><strong>{t.completionPct}%</strong><small>{t.completed} of {t.committed} pts</small></div>
        <div className="stat"><span>Capacity</span><strong>{t.capacity || '—'}</strong></div>
        <div className="stat"><span>Committed</span><strong className={t.overAllocated ? 'warn' : ''}>{t.committed}</strong>{t.loadPct !== null && <small className="muted">{t.loadPct}% of capacity</small>}</div>
        <div className="stat"><span>Remaining</span><strong>{t.remaining}</strong></div>
        <div className="stat"><span>Tasks done</span><strong>{t.tasksDone}/{t.tasks}</strong></div>
        <div className="stat"><span>Not estimated</span><strong className={t.unestimated ? 'warn' : ''}>{t.unestimated}</strong></div>
      </div>
      {t.overAllocated && <div className="warn-banner">⚠ Over-allocated: {t.committed} points committed against a capacity of {t.capacity}.</div>}

      <div className="chart-grid two">
        <section className="card chart-card span-2">
          <header><h3>Points per employee</h3><small className="muted">{hasCapacity ? 'Capacity vs allocated vs completed' : 'Allocated vs completed — set per-member capacity on the sprint to compare'}</small></header>
          {!people.length ? <div className="chart-empty">No tasks in this sprint</div> : (
            <ResponsiveContainer width="100%" height={Math.max(220, 60 + people.length * 34)}>
              <BarChart data={people} layout="vertical" margin={{ left: 10, right: 30 }} barGap={2}>
                <CartesianGrid stroke="var(--line)" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={axis} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={axis} width={120} axisLine={false} tickLine={false} />
                <Tooltip {...tip} formatter={(v, n) => [`${v} pts`, n]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {hasCapacity && <Bar dataKey="Capacity" fill={CAPACITY} radius={[0, 4, 4, 0]} barSize={9} />}
                <Bar dataKey="Allocated" fill={ALLOCATED} radius={[0, 4, 4, 0]} barSize={9} />
                <Bar dataKey="Completed" fill={COMPLETED} radius={[0, 4, 4, 0]} barSize={9} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>

        <section className="card chart-card">
          <header><h3>Story-point burndown</h3><small className="muted">Remaining points vs ideal</small></header>
          {!t.committed ? <div className="chart-empty">No estimated tasks</div> : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={r.burndown} margin={{ right: 12 }}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis dataKey="day" tick={axis} tickFormatter={(v) => v.slice(5)} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={axis} axisLine={false} tickLine={false} width={32} />
                <Tooltip {...tip} />
                <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
                <Line type="linear" dataKey="ideal" name="Ideal" stroke={CAPACITY} strokeWidth={2} strokeDasharray="5 4" dot={false} />
                <Line type="monotone" dataKey="remaining" name="Remaining pts" stroke={C[0]} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </section>

        <section className="card chart-card">
          <header><h3>Points by status</h3></header>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={status} margin={{ right: 8 }}>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis dataKey="name" tick={axis} axisLine={false} tickLine={false} interval={0} />
              <YAxis allowDecimals={false} tick={axis} axisLine={false} tickLine={false} width={32} />
              <Tooltip {...tip} formatter={(v, n, p) => [`${v} pts · ${p.payload.tasks} tasks`, 'Points']} />
              <Bar dataKey="points" radius={[4, 4, 0, 0]} barSize={26} label={{ position: 'top', fontSize: 12, fill: 'var(--text-2)' }}>
                {status.map((s) => <Cell key={s.status} fill={STATUS_COLOR[s.status]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </section>
      </div>

      <div className="seg report-tabs">
        <button className={tab === 'people' ? 'on' : ''} onClick={() => setTab('people')}>Employees ({r.members.length})</button>
        <button className={tab === 'tasks' ? 'on' : ''} onClick={() => setTab('tasks')}>Tasks ({r.tasks.length})</button>
      </div>

      {tab === 'people' ? (
        <div className="card table-card">
          <table className="table">
            <thead>
              <tr><th>Employee</th><th className="num">Capacity</th><th className="num">Allocated</th><th className="num">Completed</th><th className="num">Remaining</th><th>Completion</th><th className="num">Load</th><th className="num">Tasks</th></tr>
            </thead>
            <tbody>
              {r.members.map((m) => (
                <tr key={m.userId || 'unassigned'}>
                  <td><div className="user-cell"><Avatar name={m.name} size={24} /><div><strong>{m.name}</strong><small>{ROLE_LABELS[m.role] || m.role || '—'}</small></div></div></td>
                  <td className="num">{m.capacity || '—'}</td>
                  <td className="num">{m.allocated}</td>
                  <td className="num">{m.completed}</td>
                  <td className="num">{m.remaining}</td>
                  <td><div className="mini-bar"><div style={{ width: `${Math.min(100, m.completionPct)}%` }} /><span>{m.completionPct}%</span></div></td>
                  <td className={`num ${m.overAllocated ? 'overdue' : ''}`}>{m.loadPct !== null ? `${m.loadPct}%` : '—'}</td>
                  <td className="num">{m.tasksDone}/{m.tasks}</td>
                </tr>
              ))}
              <tr className="total-row">
                <td><strong>Total</strong></td>
                <td className="num">{t.capacity || '—'}</td>
                <td className="num">{t.committed}</td>
                <td className="num">{t.completed}</td>
                <td className="num">{t.remaining}</td>
                <td>{t.completionPct}%</td>
                <td className="num">{t.loadPct !== null ? `${t.loadPct}%` : '—'}</td>
                <td className="num">{t.tasksDone}/{t.tasks}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card table-card">
          <table className="table">
            <thead><tr><th>Task</th><th>Assignee</th><th>Status</th><th className="num">C × S</th><th className="num">Points</th><th>Completed</th></tr></thead>
            <tbody>
              {r.tasks.map((x) => (
                <tr key={x._id}>
                  <td><strong>{x.title}</strong><small className="muted"> {x.feature && `· ${x.feature}`}{x.project && ` · ${x.project}`}</small></td>
                  <td>{x.assignee}</td>
                  <td><Badge value={x.status} /></td>
                  <td className="num muted">{x.pointsMode === 'matrix' && x.complexity && x.size ? `${x.complexity} × ${x.size}` : x.points != null ? 'manual' : '—'}</td>
                  <td className="num">{x.points ?? '—'}</td>
                  <td>{x.completedAt ? fmtDate(x.completedAt) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
