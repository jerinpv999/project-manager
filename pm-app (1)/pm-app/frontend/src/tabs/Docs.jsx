import { useCallback, useEffect, useMemo, useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { api, scopeBody, scopeQs } from '../api';
import { useAuth } from '../auth';
import { Empty } from '../components/ui';

const TEMPLATE = `# Project overview

## Goals
-

## Scope
### In scope
-
### Out of scope
-

## Architecture
Describe the high-level components. Link sequence diagrams from the Diagrams tab.

## Stakeholders
| Role | Name |
|------|------|
| Project manager | |
| Tech lead | |

## Risks & mitigations
| Risk | Impact | Mitigation |
|------|--------|-----------|
| | | |

## Release plan
`;

export default function Docs({ scope }) {
  const { user, toast } = useAuth();
  const [docs, setDocs] = useState([]);
  const [current, setCurrent] = useState(null);
  const [draft, setDraft] = useState(null);
  const [mode, setMode] = useState('preview');

  const load = useCallback(() => api(`/docs${scopeQs(scope)}`).then((d) => { setDocs(d); return d; }), [scope.wid, scope.pid]); // eslint-disable-line
  useEffect(() => { load().then((d) => d[0] && open(d[0])); }, [load]); // eslint-disable-line

  const open = (d) => { setCurrent(d); setDraft({ title: d.title, content: d.content }); setMode('preview'); };
  const create = async () => {
    try {
      const d = await api('/docs', { method: 'POST', body: scopeBody(scope, { title: 'Untitled document', content: TEMPLATE }) });
      await load(); open(d); setMode('edit');
    } catch (e) { toast(e.message, 'error'); }
  };
  const save = async () => {
    try {
      const d = await api(`/docs/${current._id}`, { method: 'PUT', body: draft });
      setCurrent(d); await load(); toast('Document saved'); setMode('preview');
    } catch (e) { toast(e.message, 'error'); }
  };
  const remove = async () => {
    if (!confirm(`Delete "${current.title}"?`)) return;
    try { await api(`/docs/${current._id}`, { method: 'DELETE' }); const d = await load(); d[0] ? open(d[0]) : (setCurrent(null), setDraft(null)); }
    catch (e) { toast(e.message, 'error'); }
  };

  const html = useMemo(() => (draft ? DOMPurify.sanitize(marked.parse(draft.content || '')) : ''), [draft]);
  const dirty = current && draft && (draft.title !== current.title || draft.content !== current.content);
  const canDelete = current && (scope.can('docs.delete.any') || String(current.author?._id) === String(user._id));

  return (
    <div className="split">
      <aside className="card list-pane">
        <div className="card-head"><h3>Documents</h3>{scope.can('docs.write') && <button className="btn sm primary" onClick={create}>+ New</button>}</div>
        {!docs.length && <Empty>No documents yet.</Empty>}
        {docs.map((d) => (
          <button key={d._id} className={`list-item ${current?._id === d._id ? 'active' : ''}`} onClick={() => open(d)}>
            <strong>{d.title}</strong>
            <small className="muted">Updated {new Date(d.updatedAt).toLocaleDateString()} by {d.updatedBy?.name || d.author?.name || '—'}</small>
          </button>
        ))}
      </aside>
      <section className="card doc-pane">
        {!current ? <Empty>Select or create a document.</Empty> : (
          <>
            <div className="doc-toolbar">
              {mode === 'edit'
                ? <input className="doc-title-input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                : <h2>{draft.title}</h2>}
              <div className="seg">
                {scope.can('docs.write') && <button className={mode === 'edit' ? 'on' : ''} onClick={() => setMode('edit')}>Edit</button>}
                {scope.can('docs.write') && <button className={mode === 'split' ? 'on' : ''} onClick={() => setMode('split')}>Split</button>}
                <button className={mode === 'preview' ? 'on' : ''} onClick={() => setMode('preview')}>Preview</button>
              </div>
              {dirty && <button className="btn primary sm" onClick={save}>Save</button>}
              {canDelete && <button className="btn sm danger" onClick={remove}>Delete</button>}
            </div>
            <div className={`doc-body mode-${mode}`}>
              {mode !== 'preview' && (
                <textarea className="doc-editor" value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} placeholder="Write in Markdown…" />
              )}
              {mode !== 'edit' && <article className="markdown" dangerouslySetInnerHTML={{ __html: html }} />}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
