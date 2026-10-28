import { useCallback, useEffect, useState } from 'react';
import { api, fmtDate, scopeBody, scopeQs, toInputDate, STATUS_LABELS } from '../api';
import { useAuth, useLiveEvent } from '../auth';
import { Empty, ErrorText, Field, Modal, useSubmit } from '../components/ui';

const DAY = 86400000;

function ItemForm({ scope, features, initial, onClose, onSaved }) {
  const today = new Date();
  const [f, setF] = useState(
    initial
      ? { ...initial, startDate: toInputDate(initial.startDate), endDate: toInputDate(initial.endDate), feature: initial.feature?._id || '' }
      : { title: '', description: '', startDate: toInputDate(today), endDate: toInputDate(new Date(+today + 30 * DAY)), status: 'planned', feature: '' }
  );
  const { busy, error, submit, setError } = useSubmit(
    () => {
      if (f.endDate < f.startDate) { setError('End must be after start'); throw new Error('End must be after start'); }
      const body = { ...f, feature: f.feature || null };
      return initial ? api(`/roadmap/${initial._id}`, { method: 'PUT', body }) : api('/roadmap', { method: 'POST', body: scopeBody(scope, body) });
    },
    () => { onSaved(); onClose(); }
  );
  const remove = async () => {
    if (!confirm('Delete this roadmap item?')) return;
    await api(`/roadmap/${initial._id}`, { method: 'DELETE' }); onSaved(); onClose();
  };
  return (
    <Modal title={initial ? 'Edit milestone' : 'New roadmap milestone'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Field label="Title"><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required /></Field>
        <Field label="Description"><textarea rows={3} value={f.description || ''} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <div className="row">
          <Field label="Start"><input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} required /></Field>
          <Field label="End"><input type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} required /></Field>
        </div>
        <div className="row">
          <Field label="Status">
            <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
              {['planned', 'in_progress', 'done', 'at_risk'].map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </Field>
          <Field label="Linked feature">
            <select value={f.feature} onChange={(e) => setF({ ...f, feature: e.target.value })}>
              <option value="">—</option>
              {features.map((x) => <option key={x._id} value={x._id}>{x.title}</option>)}
            </select>
          </Field>
        </div>
        <ErrorText error={error} />
        <div className="form-actions">
          {initial && <button type="button" className="btn danger" onClick={remove}>Delete</button>}
          <button className="btn primary" disabled={busy}>Save</button>
        </div>
      </form>
    </Modal>
  );
}

export default function Roadmap({ scope }) {
  const [items, setItems] = useState([]);
  const [features, setFeatures] = useState([]);
  const [editing, setEditing] = useState(null);
  const load = useCallback(() => {
    api(`/roadmap${scopeQs(scope)}`).then(setItems);
    api(`/features${scopeQs(scope)}`).then(setFeatures);
  }, [scope.wid, scope.pid]); // eslint-disable-line
  useEffect(() => { load(); }, [load]);
  useLiveEvent('scope.changed', load);

  // timeline bounds: from the 1st of the earliest month to the end of the latest month
  let months = [];
  let min = 0, span = 1;
  if (items.length) {
    const s = new Date(Math.min(...items.map((i) => +new Date(i.startDate)), Date.now()));
    const e = new Date(Math.max(...items.map((i) => +new Date(i.endDate)), Date.now()));
    const start = new Date(s.getFullYear(), s.getMonth(), 1);
    const end = new Date(e.getFullYear(), e.getMonth() + 1, 1);
    min = +start; span = +end - +start;
    for (let d = new Date(start); d < end; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
      const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      months.push({ label: d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }), left: ((+d - min) / span) * 100, width: ((+next - +d) / span) * 100 });
    }
  }
  const pos = (d) => ((+new Date(d) - min) / span) * 100;
  const todayLeft = pos(new Date());

  return (
    <div>
      <div className="toolbar">
        <p className="muted">Roadmap {scope.project ? `for ${scope.project.name}` : 'for the workspace'}.</p>
        {scope.canManage && <button className="btn primary" onClick={() => setEditing({})}>+ Milestone</button>}
      </div>
      {!items.length ? <Empty>No roadmap milestones yet.</Empty> : (
        <div className="card roadmap">
          <div className="rm-row rm-head">
            <div className="rm-label" />
            <div className="rm-track">
              {months.map((m) => <div key={m.left} className="rm-month" style={{ left: `${m.left}%`, width: `${m.width}%` }}>{m.label}</div>)}
            </div>
          </div>
          {items.map((i) => (
            <div key={i._id} className="rm-row">
              <div className="rm-label">
                <strong>{i.title}</strong>
                <small className="muted">{fmtDate(i.startDate)} – {fmtDate(i.endDate)}{i.feature ? ` · ◆ ${i.feature.title}` : ''}</small>
              </div>
              <div className="rm-track">
                {months.map((m) => <div key={m.left} className="rm-grid" style={{ left: `${m.left}%` }} />)}
                <div className="rm-today" style={{ left: `${todayLeft}%` }} />
                <button
                  className={`rm-bar rm-${i.status}`}
                  style={{ left: `${pos(i.startDate)}%`, width: `${Math.max(1.5, pos(i.endDate) - pos(i.startDate))}%` }}
                  onClick={() => scope.canManage && setEditing(i)}
                  title={`${i.title} · ${STATUS_LABELS[i.status]}${i.description ? `\n${i.description}` : ''}`}
                >
                  {STATUS_LABELS[i.status]}
                </button>
              </div>
            </div>
          ))}
          <div className="rm-legend">
            {['planned', 'in_progress', 'done', 'at_risk'].map((s) => <span key={s}><i className={`rm-${s}`} /> {STATUS_LABELS[s]}</span>)}
            <span><i className="rm-today-key" /> Today</span>
          </div>
        </div>
      )}
      {editing && <ItemForm scope={scope} features={features} initial={editing._id ? editing : null} onClose={() => setEditing(null)} onSaved={load} />}
    </div>
  );
}
