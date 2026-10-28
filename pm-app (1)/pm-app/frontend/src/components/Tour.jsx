// Lightweight, dependency-free guided tour.
// Steps can live on different pages: the tour navigates, waits for the target element
// (matched by [data-tour="..."]), spotlights it and shows a tooltip. Steps are filtered by role.
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, can } from '../api';
import { useAuth } from '../auth';

const TourCtx = createContext({ start: () => {} });
export const useTour = () => useContext(TourCtx);

const doneKey = (u) => `pm_tour_done_${u._id}`;

// path(ctx) -> route, target -> data-tour id (omit for a centred card)
function buildSteps(user, ctx) {
  const ws = ctx.wsId ? `/w/${ctx.wsId}` : null;
  const mgr = can(user, 'tasks.manage') || can(user, 'planning.manage');
  const steps = [
    {
      title: `Welcome to Orbit PM, ${user.name.split(' ')[0]} 👋`,
      body: 'This short tour shows where everything lives. Use the arrow keys or the buttons to move, Esc to close. You can restart it any time from the sidebar.',
    },
    { path: '/', target: 'nav-workspaces', title: 'Workspaces', body: 'A workspace is the root project. Each one contains sub-projects and modules. You only see the workspaces you are a member of.' },
    can(user, 'workspace.create') && { path: '/', target: 'new-workspace', title: 'Create a workspace', body: 'Project managers and admins create workspaces here and choose who belongs to them.' },
    { path: '/', target: 'ws-cards', title: 'Progress at a glance', body: 'Each card shows how many tasks in the workspace are done.' },
    {
      path: '/my-tasks', target: 'my-tasks', title: 'My tasks',
      body: 'Everything assigned to you across all workspaces. Change the status right here — you also get a live notification when someone assigns you a task.',
    },
    ...(ws
      ? [
          { path: `${ws}/dashboard`, target: 'tree', title: 'Workspace tree', body: 'The workspace sits at the top, with its sub-projects (squares) and modules (circles) below. Every level has the same tabs.' },
          { path: `${ws}/dashboard`, target: 'kpis', title: 'Dashboard', body: 'Key numbers for the level you are on. At workspace level they include every sub-project you can see.' },
          { path: `${ws}/dashboard`, target: 'charts', title: 'Charts', body: 'Tasks by status, sprint burndown, workload per person, feature progress, daily throughput and progress per sub-project. Hover any bar or point for details.' },
          { path: `${ws}/tasks`, target: 'task-filters', title: 'Task board filters', body: 'Filter by business feature, sprint or person. Tick "Include sub-projects" to see everything below this level.' },
          {
            path: `${ws}/tasks`, target: 'board', title: 'Kanban board',
            body: mgr
              ? 'Click a card to edit, assign or comment. Drag cards between columns to change status.'
              : can(user, 'tasks.status.any')
                ? 'As QA you can move any task — drag from "QA" to "Done" once verified, or back to "In progress".'
                : 'Drag your own cards between columns to update their status. Click a card to read details and comment.',
          },
          mgr && { path: `${ws}/tasks`, target: 'new-task', title: 'Create tasks', body: 'Every task belongs to a business feature, can be put in a sprint and assigned to anyone on this level.' },
          { path: `${ws}/features`, target: 'tab-features', title: 'Business features', body: 'Features group tasks and show progress. Expand one to see its tasks or add a new task to it.' },
          { path: `${ws}/sprints`, target: 'tab-sprints', title: 'Sprints', body: 'Manual or recurring sprints at any level. A recurring sprint starts the next one automatically and can carry unfinished work over.' },
          can(user, 'reports.view') && { path: `${ws}/sprints`, target: 'velocity', title: 'Story points & sprint analysis', body: 'Committed vs completed points per sprint. Open “Analyse” on a sprint for points per employee, burndown and CSV export.' },
          { path: `${ws}/roadmap`, target: 'tab-roadmap', title: 'Roadmap', body: 'A timeline of milestones with a "today" line. Milestones at risk are shown in red.' },
          { path: `${ws}/docs`, target: 'tab-docs', title: 'Documents', body: 'Detailed project documentation in Markdown, with edit, split and preview modes. Everyone on the level can write.' },
          { path: `${ws}/diagrams`, target: 'tab-diagrams', title: 'Design diagrams', body: 'High-level design, flowcharts and sequence diagrams. The sequence builder adds participants and messages without writing syntax.' },
          { path: `${ws}/chat`, target: 'tab-chat', title: 'Chat', body: 'Each workspace and sub-project has a default channel for common questions. Messages arrive live.' },
          { path: `${ws}/structure`, target: 'tab-structure', title: 'Team & structure', body: mgr ? 'Add workspace members, create sub-projects/modules and assign people to them.' : 'See who is on this level and which sub-projects exist.' },
        ]
      : [{ title: 'No workspace yet', body: mgr ? 'Create your first workspace from the Overview page, then restart the tour to see the workspace tabs.' : 'Ask a project manager to add you to a workspace, then restart the tour.' }]),
    can(user, 'users.manage') && { path: '/users', target: 'users-table', title: 'User management', body: 'Create users, change roles, deactivate or delete. When you delete a user, their tasks, memberships, docs and chat messages are handed over to you.' },
    can(user, 'settings.manage') && { path: '/settings', target: 'points-matrix', title: 'Story point matrix', body: 'Story points come from complexity × size. Edit the values here; tasks pick their points from this matrix.' },
    can(user, 'roles.manage') && { path: '/roles', target: 'roles-grid', title: 'Roles & permissions', body: 'Create your own roles (e.g. Tech Lead, Scrum Master) and choose exactly what each one may do.' },
    { path: '/', target: 'tour-button', title: 'That’s it!', body: 'Restart the tour any time from here. The docs folder in the repository has a full user guide and demo scenarios.' },
  ];
  return steps.filter(Boolean);
}

function waitFor(selector, timeout = 4000) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const tick = () => {
      const el = document.querySelector(selector);
      if (el && el.getBoundingClientRect().width) return resolve(el);
      if (Date.now() - t0 > timeout) return resolve(null);
      setTimeout(tick, 100);
    };
    tick();
  });
}

function TourOverlay({ steps, index, setIndex, onClose }) {
  const nav = useNavigate();
  const loc = useLocation();
  const step = steps[index];
  const [rect, setRect] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setRect(null);
    (async () => {
      if (step.path && loc.pathname !== step.path) nav(step.path);
      if (step.target) {
        const el = await waitFor(`[data-tour="${step.target}"]`);
        if (cancelled) return;
        if (el) {
          el.scrollIntoView({ block: 'center', behavior: 'smooth' });
          await new Promise((r) => setTimeout(r, 350));
          if (!cancelled) setRect(el.getBoundingClientRect());
        }
      }
      if (!cancelled) setReady(true);
    })();
    return () => { cancelled = true; };
  }, [index]); // eslint-disable-line

  useLayoutEffect(() => {
    if (!step.target) return;
    const update = () => {
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      if (el) setRect(el.getBoundingClientRect());
    };
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => { window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); };
  }, [step]);

  const next = useCallback(() => (index < steps.length - 1 ? setIndex(index + 1) : onClose(true)), [index, steps.length, setIndex, onClose]);
  const prev = useCallback(() => index > 0 && setIndex(index - 1), [index, setIndex]);
  useEffect(() => {
    const k = (e) => {
      if (e.key === 'Escape') onClose(false);
      if (e.key === 'ArrowRight' || e.key === 'Enter') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [next, prev, onClose]);

  const pad = 6;
  const W = Math.min(340, window.innerWidth - 32);
  let tipStyle = { left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: W };
  if (rect) {
    const below = rect.bottom + 14 + 180 < window.innerHeight;
    const left = Math.max(16, Math.min(rect.left, window.innerWidth - W - 16));
    tipStyle = below
      ? { left, top: rect.bottom + pad + 10, width: W }
      : { left, top: Math.max(16, rect.top - pad - 10), transform: 'translateY(-100%)', width: W };
    // big targets (e.g. whole board): put the card inside the viewport, bottom-right
    if (rect.height > window.innerHeight * 0.6) tipStyle = { right: 24, bottom: 24, width: W };
  }

  return (
    <div className="tour-root" aria-live="polite">
      {rect ? (
        <div className="tour-spot" style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} />
      ) : (
        <div className="tour-dim" />
      )}
      <div className="tour-catch" onClick={(e) => e.stopPropagation()} />
      {ready && (
        <div className="tour-card" style={tipStyle} role="dialog" aria-label={step.title}>
          <div className="tour-progress">
            {steps.map((_, i) => <span key={i} className={i === index ? 'on' : i < index ? 'done' : ''} />)}
          </div>
          <h4>{step.title}</h4>
          <p>{step.body}</p>
          <div className="tour-actions">
            <button className="btn sm" onClick={() => onClose(false)}>Skip tour</button>
            <span className="muted">{index + 1} / {steps.length}</span>
            <div className="spacer" />
            {index > 0 && <button className="btn sm" onClick={prev}>Back</button>}
            <button className="btn sm primary" onClick={next}>{index === steps.length - 1 ? 'Finish' : 'Next'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function TourProvider({ children }) {
  const { user } = useAuth();
  const [steps, setSteps] = useState(null);
  const [index, setIndex] = useState(0);

  const start = useCallback(async () => {
    if (!user) return;
    let wsId = null;
    try {
      const list = await api('/workspaces');
      // prefer the demo workspace if present
      wsId = (list.find((w) => w.key === 'ACP') || list[0])?._id || null;
    } catch { /* ignore */ }
    setIndex(0);
    setSteps(buildSteps(user, { wsId }));
  }, [user]);

  // auto-start once per user
  useEffect(() => {
    if (!user) return;
    let seen = false;
    try { seen = !!localStorage.getItem(doneKey(user)); } catch { /* ignore */ }
    if (!seen) {
      const t = setTimeout(start, 600);
      return () => clearTimeout(t);
    }
  }, [user, start]);

  const close = () => {
    try { localStorage.setItem(doneKey(user), '1'); } catch { /* ignore */ }
    setSteps(null);
  };

  return (
    <TourCtx.Provider value={{ start }}>
      {children}
      {steps && <TourOverlay steps={steps} index={index} setIndex={setIndex} onClose={close} />}
    </TourCtx.Provider>
  );
}
