import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useParams } from 'react-router-dom';
import { api, can, roleCan, STORY_MATRIX } from '../api';
import { useAuth } from '../auth';
import { Empty } from '../components/ui';
import Dashboard from '../tabs/Dashboard';
import Structure from '../tabs/Structure';
import Sprints from '../tabs/Sprints';
import Features from '../tabs/Features';
import Tasks from '../tabs/Tasks';
import Roadmap from '../tabs/Roadmap';
import Docs from '../tabs/Docs';
const Diagrams = lazy(() => import('../tabs/Diagrams'));
import Chat from '../tabs/Chat';

const TABS = [
  ['dashboard', 'Dashboard', Dashboard],
  ['tasks', 'Tasks', Tasks],
  ['features', 'Features', Features],
  ['sprints', 'Sprints', Sprints],
  ['roadmap', 'Roadmap', Roadmap],
  ['docs', 'Docs', Docs],
  ['diagrams', 'Diagrams', Diagrams],
  ['chat', 'Chat', Chat],
  ['structure', 'Team & structure', Structure],
];

function Tree({ wid, pid, projects, ws }) {
  const children = (parent) => projects.filter((p) => String(p.parent || '') === String(parent || ''));
  const known = new Set(projects.map((p) => String(p._id)));
  // a project whose parent the user can't see is shown at the top level
  const roots = projects.filter((p) => !p.parent || !known.has(String(p.parent)));
  const Node = ({ p, depth }) => (
    <>
      <NavLink
        to={`/w/${wid}/p/${p._id}`}
        className={() => `tree-item ${String(pid) === String(p._id) ? 'active' : ''}`}
        style={{ paddingLeft: 12 + depth * 14 }}
      >
        <span className={`kind-dot ${p.kind}`} />
        {p.name}
      </NavLink>
      {children(p._id).map((c) => <Node key={c._id} p={c} depth={depth + 1} />)}
    </>
  );
  return (
    <div className="tree" data-tour="tree">
      <Link to={`/w/${wid}`} className={`tree-item root ${!pid ? 'active' : ''}`}>
        <span className="ws-key">{(ws.key || ws.name).slice(0, 3).toUpperCase()}</span> {ws.name}
      </Link>
      {roots.map((p) => <Node key={p._id} p={p} depth={1} />)}
      {!projects.length && <div className="tree-empty">No sub-projects yet</div>}
      <div className="tree-legend"><span className="kind-dot subproject" /> sub-project <span className="kind-dot module" /> module</div>
    </div>
  );
}

export default function ScopeView() {
  const { wid, pid, tab = 'dashboard' } = useParams();
  const { user } = useAuth();
  const [ws, setWs] = useState(null);
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState('');
  const [rev, setRev] = useState(0);

  const reload = useCallback(() => setRev((r) => r + 1), []);
  useEffect(() => {
    setError('');
    Promise.all([api(`/workspaces/${wid}`), api(`/workspaces/${wid}/projects`)])
      .then(([w, p]) => { setWs(w); setProjects(p); })
      .catch((e) => setError(e.message));
  }, [wid, rev]);

  const project = pid ? projects.find((p) => String(p._id) === String(pid)) : null;

  // users that may be assigned work in this scope
  const members = useMemo(() => {
    if (!ws) return [];
    const active = ws.members.filter((m) => m.active !== false);
    if (!project) return active;
    const byId = new Map(projects.map((p) => [String(p._id), p]));
    const allowed = new Set();
    let cur = project;
    while (cur) {
      cur.members.forEach((m) => allowed.add(String(m._id || m)));
      cur = cur.parent ? byId.get(String(cur.parent)) : null;
    }
    return active.filter((m) => allowed.has(String(m._id)) || roleCan(m.role, 'projects.view_all'));
  }, [ws, project, projects]);

  if (error) return <div className="page"><Empty>{error}</Empty></div>;
  if (!ws || (pid && !project)) return <div className="page muted">Loading…</div>;

  const scope = { wid, pid: pid || null, ws, project, projects, members, canManage: can(user, 'planning.manage'), can: (perm) => can(user, perm), reload,
    // story point matrix in force for this workspace (own one, or the organisation default)
    matrix: ws.pointMatrix?.length === 5 ? ws.pointMatrix : STORY_MATRIX.matrix,
    matrixSource: ws.pointMatrix?.length === 5 ? 'workspace' : 'default', key: `${wid}:${pid || ''}` };
  const base = pid ? `/w/${wid}/p/${pid}` : `/w/${wid}`;
  const Current = (TABS.find((t) => t[0] === tab) || TABS[0])[2];

  const crumbs = [];
  if (project) {
    const byId = new Map(projects.map((p) => [String(p._id), p]));
    let cur = project;
    while (cur) { crumbs.unshift(cur); cur = cur.parent ? byId.get(String(cur.parent)) : null; }
  }

  return (
    <div className="scope">
      <Tree wid={wid} pid={pid} projects={projects} ws={ws} />
      <div className="scope-main">
        <header className="scope-head">
          <div className="crumbs">
            <Link to={`/w/${wid}`}>{ws.name}</Link>
            {crumbs.map((c) => <span key={c._id}> / <Link to={`/w/${wid}/p/${c._id}`}>{c.name}</Link></span>)}
          </div>
          <h1>
            {project ? project.name : ws.name}
            <span className="scope-kind">{project ? (project.kind === 'module' ? 'Module' : 'Sub-project') : 'Workspace'}</span>
          </h1>
          {(project?.description || (!project && ws.description)) && <p className="muted">{project ? project.description : ws.description}</p>}
          <nav className="tabs">
            {TABS.map(([k, label]) => (
              <NavLink key={k} data-tour={`tab-${k}`} to={`${base}/${k}`} className={() => (tab === k ? 'active' : '')}>{label}</NavLink>
            ))}
          </nav>
        </header>
        <div className="scope-body">
          <Suspense fallback={<div className="muted">Loading…</div>}><Current key={scope.key} scope={scope} /></Suspense>
        </div>
      </div>
    </div>
  );
}
