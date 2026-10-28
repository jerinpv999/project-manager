import { useCallback, useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { api, scopeBody, scopeQs } from '../api';
import { useAuth } from '../auth';
import { Empty } from '../components/ui';

mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'strict', fontFamily: 'Inter, sans-serif' });

const TEMPLATES = {
  sequence: `sequenceDiagram
    autonumber
    actor User
    participant UI as Web App
    participant API as API Server
    participant DB as MongoDB
    User->>UI: Submit login form
    UI->>API: POST /api/auth/login
    API->>DB: find user by email
    DB-->>API: user record
    alt valid credentials
        API-->>UI: 200 { token }
        UI-->>User: Show dashboard
    else invalid
        API-->>UI: 401 Unauthorized
        UI-->>User: Show error
    end`,
  flowchart: `flowchart LR
    A[Client] --> B(API Gateway)
    B --> C{Auth?}
    C -- yes --> D[Service]
    C -- no --> E[401]
    D --> F[(Database)]`,
  class: `classDiagram
    class Workspace { +name +members }
    class Project { +name +kind }
    class Task { +title +status }
    Workspace "1" --> "*" Project
    Project "1" --> "*" Task`,
};

const ARROWS = [
  ['->>', 'Sync call'],
  ['-->>', 'Response'],
  ['-)', 'Async message'],
  ['->', 'Plain line'],
];

// Point-and-click builder for sequence diagrams: appends lines to the source.
function SequenceBuilder({ source, onChange }) {
  const participants = [...source.matchAll(/^\s*(?:participant|actor)\s+(\w+)/gm)].map((m) => m[1]);
  const [p, setP] = useState({ name: '', alias: '', actor: false });
  const [m, setM] = useState({ from: '', to: '', arrow: '->>', text: '' });
  const [note, setNote] = useState({ over: '', text: '' });
  const insertAfterLast = (line, re) => {
    const lines = source.split('\n');
    let idx = 0;
    lines.forEach((l, i) => re.test(l) && (idx = i));
    lines.splice(idx + 1, 0, line);
    onChange(lines.join('\n'));
  };
  const append = (line) => onChange(`${source.replace(/\s+$/, '')}\n    ${line}`);
  const ensureHeader = () => (/^\s*sequenceDiagram/.test(source) ? null : onChange(`sequenceDiagram\n${source}`));

  return (
    <div className="builder">
      <h4>Sequence builder</h4>
      {!/^\s*sequenceDiagram/.test(source) && <button className="btn sm" onClick={ensureHeader}>Convert to sequence diagram</button>}
      <div className="builder-row">
        <input placeholder="Participant id" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value.replace(/\W/g, '') })} />
        <input placeholder="Label (optional)" value={p.alias} onChange={(e) => setP({ ...p, alias: e.target.value })} />
        <label className="check"><input type="checkbox" checked={p.actor} onChange={(e) => setP({ ...p, actor: e.target.checked })} /> actor</label>
        <button className="btn sm" disabled={!p.name} onClick={() => {
          insertAfterLast(`    ${p.actor ? 'actor' : 'participant'} ${p.name}${p.alias ? ` as ${p.alias}` : ''}`, /^\s*(sequenceDiagram|autonumber|participant|actor)\b/);
          setP({ name: '', alias: '', actor: false });
        }}>Add participant</button>
      </div>
      <div className="builder-row">
        <select value={m.from} onChange={(e) => setM({ ...m, from: e.target.value })}><option value="">From…</option>{participants.map((x) => <option key={x}>{x}</option>)}</select>
        <select value={m.arrow} onChange={(e) => setM({ ...m, arrow: e.target.value })}>{ARROWS.map(([a, l]) => <option key={a} value={a}>{l}</option>)}</select>
        <select value={m.to} onChange={(e) => setM({ ...m, to: e.target.value })}><option value="">To…</option>{participants.map((x) => <option key={x}>{x}</option>)}</select>
        <input placeholder="Message" value={m.text} onChange={(e) => setM({ ...m, text: e.target.value })} />
        <button className="btn sm" disabled={!m.from || !m.to} onClick={() => { append(`${m.from}${m.arrow}${m.to}: ${m.text || ' '}`); setM({ ...m, text: '' }); }}>Add message</button>
      </div>
      <div className="builder-row">
        <select value={note.over} onChange={(e) => setNote({ ...note, over: e.target.value })}><option value="">Note over…</option>{participants.map((x) => <option key={x}>{x}</option>)}</select>
        <input placeholder="Note text" value={note.text} onChange={(e) => setNote({ ...note, text: e.target.value })} />
        <button className="btn sm" disabled={!note.over || !note.text} onClick={() => { append(`Note over ${note.over}: ${note.text}`); setNote({ over: '', text: '' }); }}>Add note</button>
        <button className="btn sm" onClick={() => append('alt condition\n        A->>B: ...\n    else otherwise\n        A->>B: ...\n    end')}>+ alt block</button>
        <button className="btn sm" onClick={() => append('loop every minute\n        A->>B: ...\n    end')}>+ loop</button>
      </div>
    </div>
  );
}

export default function Diagrams({ scope }) {
  const { user, toast } = useAuth();
  const [list, setList] = useState([]);
  const [current, setCurrent] = useState(null);
  const [draft, setDraft] = useState(null);
  const [svg, setSvg] = useState('');
  const [renderError, setRenderError] = useState('');
  const counter = useRef(0);

  const load = useCallback(() => api(`/diagrams${scopeQs(scope)}`).then((d) => { setList(d); return d; }), [scope.wid, scope.pid]); // eslint-disable-line
  useEffect(() => { load().then((d) => d[0] && open(d[0])); }, [load]); // eslint-disable-line

  const open = (d) => { setCurrent(d); setDraft({ title: d.title, kind: d.kind, source: d.source }); };

  // live preview (debounced)
  useEffect(() => {
    if (!draft) return;
    const t = setTimeout(async () => {
      try {
        const { svg } = await mermaid.render(`mmd-${++counter.current}`, draft.source || 'flowchart LR\n  A');
        setSvg(svg); setRenderError('');
      } catch (e) {
        setRenderError(String(e.message || e).split('\n').slice(0, 3).join(' '));
        document.querySelectorAll('[id^="dmmd-"]').forEach((n) => n.remove());
      }
    }, 300);
    return () => clearTimeout(t);
  }, [draft?.source]); // eslint-disable-line

  const create = async (kind) => {
    try {
      const d = await api('/diagrams', { method: 'POST', body: scopeBody(scope, { title: `New ${kind} diagram`, kind, source: TEMPLATES[kind] }) });
      await load(); open(d);
    } catch (e) { toast(e.message, 'error'); }
  };
  const save = async () => {
    try { const d = await api(`/diagrams/${current._id}`, { method: 'PUT', body: draft }); setCurrent(d); load(); toast('Diagram saved'); }
    catch (e) { toast(e.message, 'error'); }
  };
  const remove = async () => {
    if (!confirm(`Delete "${current.title}"?`)) return;
    try { await api(`/diagrams/${current._id}`, { method: 'DELETE' }); const d = await load(); d[0] ? open(d[0]) : (setCurrent(null), setDraft(null)); }
    catch (e) { toast(e.message, 'error'); }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `${draft.title.replace(/\W+/g, '_')}.svg` });
    a.click(); URL.revokeObjectURL(url);
  };

  const dirty = current && draft && JSON.stringify(draft) !== JSON.stringify({ title: current.title, kind: current.kind, source: current.source });
  const canDelete = current && (scope.can('docs.delete.any') || String(current.author?._id) === String(user._id));

  return (
    <div className="split">
      <aside className="card list-pane">
        <div className="card-head"><h3>Diagrams</h3></div>
        {scope.can('docs.write') && <div className="new-buttons">
          <button className="btn sm primary" onClick={() => create('sequence')}>+ Sequence</button>
          <button className="btn sm" onClick={() => create('flowchart')}>+ Flowchart</button>
          <button className="btn sm" onClick={() => create('class')}>+ Class</button>
        </div>}
        {!list.length && <Empty>No diagrams yet.</Empty>}
        {list.map((d) => (
          <button key={d._id} className={`list-item ${current?._id === d._id ? 'active' : ''}`} onClick={() => open(d)}>
            <strong>{d.title}</strong><small className="muted">{d.kind} · {d.author?.name || '—'}</small>
          </button>
        ))}
      </aside>
      <section className="card doc-pane">
        {!current ? <Empty>Create a high-level design or sequence diagram.</Empty> : (
          <>
            <div className="doc-toolbar">
              <input className="doc-title-input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              {dirty && <button className="btn primary sm" onClick={save}>Save</button>}
              <button className="btn sm" onClick={download} disabled={!svg || !!renderError}>Export SVG</button>
              {canDelete && <button className="btn sm danger" onClick={remove}>Delete</button>}
            </div>
            {draft.kind === 'sequence' && <SequenceBuilder source={draft.source} onChange={(source) => setDraft({ ...draft, source })} />}
            <div className="diagram-body">
              <textarea className="doc-editor mono" value={draft.source} spellCheck={false} onChange={(e) => setDraft({ ...draft, source: e.target.value })} />
              <div className="diagram-preview">
                {renderError && <div className="error-text">{renderError}</div>}
                <div dangerouslySetInnerHTML={{ __html: svg }} />
              </div>
            </div>
            <small className="muted">Uses Mermaid syntax — sequenceDiagram, flowchart, classDiagram and more.</small>
          </>
        )}
      </section>
    </div>
  );
}
