import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtDate, STATUS_LABELS, TASK_STATUSES } from '../api';
import { useAuth, useLiveEvent } from '../auth';
import { Badge, Empty, Points } from '../components/ui';

export default function MyTasks() {
  const { toast } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [show, setShow] = useState('open');
  const load = () => api('/tasks/mine').then(setTasks);
  useEffect(() => { load(); }, []);
  useLiveEvent('task.assigned', load);
  useLiveEvent('task.updated', load);

  const setStatus = async (t, status) => {
    try {
      await api(`/tasks/${t._id}/status`, { method: 'PATCH', body: { status } });
      load();
    } catch (e) { toast(e.message, 'error'); }
  };

  const shown = tasks.filter((t) => t.workspace && (show === 'open' ? t.status !== 'done' : show === 'done' ? t.status === 'done' : true));
  const counts = TASK_STATUSES.map((s) => [s, tasks.filter((t) => t.status === s).length]);

  return (
    <div className="page">
      <header className="page-head">
        <div><h1>My tasks</h1><p className="muted">Everything assigned to you across workspaces.</p></div>
        <div className="seg">
          {['open', 'done', 'all'].map((k) => <button key={k} className={show === k ? 'on' : ''} onClick={() => setShow(k)}>{k}</button>)}
        </div>
      </header>
      <div className="stat-row" data-tour="my-tasks">
        {counts.map(([s, n]) => <div key={s} className="stat small"><span>{STATUS_LABELS[s]}</span><strong>{n}</strong></div>)}
      </div>
      {!shown.length && <Empty>Nothing here.</Empty>}
      <div className="task-list">
        {shown.map((t) => {
          const overdue = t.dueDate && t.status !== 'done' && new Date(t.dueDate) < new Date();
          const link = t.project ? `/w/${t.workspace._id}/p/${t.project._id}/tasks` : `/w/${t.workspace._id}/tasks`;
          return (
            <div key={t._id} className="card task-row">
              <div className="task-row-main">
                <div className="task-row-title">
                  <Badge value={t.priority} /> <Points value={t.points} /> <strong>{t.title}</strong>
                </div>
                <small className="muted">
                  <Link to={link}>{t.workspace.name}{t.project ? ` / ${t.project.name}` : ''}</Link>
                  {t.feature && <> · {t.feature.title}</>}
                  {t.sprint && <> · {t.sprint.name}</>}
                  {t.dueDate && <span className={overdue ? 'overdue' : ''}> · due {fmtDate(t.dueDate)}</span>}
                </small>
              </div>
              <select className={`status-select st-${t.status}`} value={t.status} onChange={(e) => setStatus(t, e.target.value)}>
                {TASK_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
}
