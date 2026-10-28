import { useCallback, useEffect, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { api, qs, STATUS_LABELS, TASK_STATUSES, PRIORITIES } from '../api';
import { useLiveEvent } from '../auth';
import { Empty } from '../components/ui';

// Categorical palette (fixed order – colour follows the entity, never its rank)
const C = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
const STATUS_COLOR = Object.fromEntries(TASK_STATUSES.map((s, i) => [s, C[i]]));
const PRIORITY_COLOR = { low: C[0], medium: C[2], high: C[3], critical: C[1] };
const DONE = C[2];
const OPEN = '#c3c2b7';
const axis = { fontSize: 12, fill: 'var(--text-2)' };
const grid = <CartesianGrid stroke="var(--line)" vertical={false} />;
const tip = { contentStyle: { borderRadius: 8, border: '1px solid var(--line)', fontSize: 13 }, cursor: { fill: 'rgba(0,0,0,0.04)' } };

function ChartCard({ title, subtitle, children, span = 1, empty }) {
  return (
    <section className={`card chart-card span-${span}`}>
      <header><h3>{title}</h3>{subtitle && <small className="muted">{subtitle}</small>}</header>
      {empty ? <div className="chart-empty">No data yet</div> : <div className="chart-body">{children}</div>}
    </section>
  );
}

const short = (s, n = 18) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s);

export default function Dashboard({ scope }) {
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(
    () => api(`/dashboard${qs({ workspace: scope.wid, project: scope.pid })}`).then(setD).catch((e) => setError(e.message)),
    [scope.wid, scope.pid]
  );
  useEffect(() => { load(); }, [load]);
  useLiveEvent('task.updated', load);

  if (error) return <Empty>{error}</Empty>;
  if (!d) return <div className="muted">Loading dashboard…</div>;

  const t = d.totals;
  const pct = t.total ? Math.round((t.done / t.total) * 100) : 0;
  const status = TASK_STATUSES.map((s) => ({ key: s, name: STATUS_LABELS[s], count: d.byStatus.find((x) => x._id === s)?.count || 0 }));
  const priority = PRIORITIES.map((p) => ({ key: p, name: p, count: d.byPriority.find((x) => x._id === p)?.count || 0 }));
  const people = d.byAssignee.map((a) => ({ name: a.name, Done: a.done, Open: a.total - a.done }));
  const features = d.byFeature.map((f) => ({ name: short(f.name, 22), full: f.name, pct: Math.round((f.done / f.total) * 100), done: f.done, total: f.total }));
  const projects = d.byProject.map((p) => ({ name: short(p.name, 22), Done: p.done, Open: p.total - p.done }));
  const throughput = d.throughput.map((x) => ({ ...x, label: x.day.slice(5) }));

  return (
    <div className="dash">
      <div className="stat-row" data-tour="kpis">
        <div className="stat hero"><span>Completion</span><strong>{pct}%</strong><small>{t.done} of {t.total} tasks</small></div>
        <div className="stat"><span>Open tasks</span><strong>{t.total - t.done}</strong></div>
        <div className="stat"><span>Overdue</span><strong className={t.overdue ? 'warn' : ''}>{t.overdue}</strong></div>
        <div className="stat"><span>Blocked</span><strong className={t.blocked ? 'warn' : ''}>{t.blocked}</strong></div>
        <div className="stat"><span>Features</span><strong>{t.features}</strong></div>
        <div className="stat"><span>Active sprints</span><strong>{t.activeSprints}</strong></div>
        <div className="stat"><span>Members</span><strong>{t.members}</strong></div>
      </div>

      <div className="chart-grid" data-tour="charts">
        <ChartCard title="Tasks by status" empty={!t.total}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={status} layout="vertical" margin={{ left: 10, right: 24 }}>
              <CartesianGrid stroke="var(--line)" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={axis} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={axis} width={84} axisLine={false} tickLine={false} />
              <Tooltip {...tip} />
              <Bar dataKey="count" name="Tasks" radius={[0, 4, 4, 0]} barSize={16} label={{ position: 'right', fontSize: 12, fill: 'var(--text-2)' }}>
                {status.map((s) => <Cell key={s.key} fill={STATUS_COLOR[s.key]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={d.burndown ? `Burndown · ${d.burndown.sprint.name}` : 'Sprint burndown'} subtitle={d.burndown ? `${d.burndown.total} tasks in sprint` : 'Create a sprint at this level to see burndown'} empty={!d.burndown || !d.burndown.total} span={2}>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={d.burndown?.points || []} margin={{ right: 16 }}>
              {grid}
              <XAxis dataKey="day" tick={axis} tickFormatter={(v) => v.slice(5)} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={axis} axisLine={false} tickLine={false} width={32} />
              <Tooltip {...tip} />
              <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
              <Line type="linear" dataKey="ideal" name="Ideal" stroke={OPEN} strokeWidth={2} strokeDasharray="5 4" dot={false} />
              <Line type="monotone" dataKey="remaining" name="Remaining" stroke={C[0]} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Workload by person" subtitle="Done vs open tasks" empty={!people.length} span={2}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={people} margin={{ right: 8 }}>
              {grid}
              <XAxis dataKey="name" tick={axis} tickFormatter={(v) => short(v, 12)} axisLine={false} tickLine={false} interval={0} />
              <YAxis allowDecimals={false} tick={axis} axisLine={false} tickLine={false} width={32} />
              <Tooltip {...tip} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Done" stackId="a" fill={DONE} stroke="var(--surface)" strokeWidth={2} barSize={26} />
              <Bar dataKey="Open" stackId="a" fill={OPEN} stroke="var(--surface)" strokeWidth={2} radius={[4, 4, 0, 0]} barSize={26} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Tasks by priority" empty={!t.total}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={priority}>
              {grid}
              <XAxis dataKey="name" tick={axis} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={axis} axisLine={false} tickLine={false} width={32} />
              <Tooltip {...tip} />
              <Bar dataKey="count" name="Tasks" radius={[4, 4, 0, 0]} barSize={30} label={{ position: 'top', fontSize: 12, fill: 'var(--text-2)' }}>
                {priority.map((p) => <Cell key={p.key} fill={PRIORITY_COLOR[p.key]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Business feature progress" subtitle="% of tasks done per feature" empty={!features.length} span={2}>
          <ResponsiveContainer width="100%" height={Math.max(200, features.length * 30 + 40)}>
            <BarChart data={features} layout="vertical" margin={{ left: 10, right: 40 }}>
              <CartesianGrid stroke="var(--line)" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={axis} unit="%" axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={axis} width={150} axisLine={false} tickLine={false} />
              <Tooltip {...tip} formatter={(v, n, p) => [`${v}% (${p.payload.done}/${p.payload.total})`, p.payload.full]} />
              <Bar dataKey="pct" fill={C[6]} radius={[0, 4, 4, 0]} barSize={14} label={{ position: 'right', fontSize: 12, fill: 'var(--text-2)', formatter: (v) => `${v}%` }} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Throughput" subtitle="Tasks completed per day, last 14 days" empty={!throughput.some((x) => x.done)}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={throughput}>
              {grid}
              <XAxis dataKey="label" tick={axis} axisLine={false} tickLine={false} interval={1} />
              <YAxis allowDecimals={false} tick={axis} axisLine={false} tickLine={false} width={28} />
              <Tooltip {...tip} />
              <Bar dataKey="done" name="Completed" fill={C[0]} radius={[4, 4, 0, 0]} barSize={12} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={scope.pid ? 'Progress by module' : 'Progress by sub-project'} subtitle="Done vs open tasks" empty={!projects.length} span={3}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={projects}>
              {grid}
              <XAxis dataKey="name" tick={axis} axisLine={false} tickLine={false} interval={0} />
              <YAxis allowDecimals={false} tick={axis} axisLine={false} tickLine={false} width={32} />
              <Tooltip {...tip} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Done" stackId="a" fill={DONE} stroke="var(--surface)" strokeWidth={2} barSize={34} />
              <Bar dataKey="Open" stackId="a" fill={OPEN} stroke="var(--surface)" strokeWidth={2} radius={[4, 4, 0, 0]} barSize={34} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
