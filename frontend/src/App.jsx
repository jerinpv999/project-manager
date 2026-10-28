import { useEffect, useState } from 'react';
import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import { api, ROLE_LABELS, can } from './api';
import { Avatar } from './components/ui';
import { useConfig } from './config';
import { useTour } from './components/Tour';
import Login from './pages/Login';
import Home from './pages/Home';
import Users from './pages/Users';
import Roles from './pages/Roles';
import Settings from './pages/Settings';
import MyTasks from './pages/MyTasks';
import ScopeView from './pages/ScopeView';

function Sidebar() {
  const { user, logout, online, toast } = useAuth();
  const { mode } = useConfig();
  const { start } = useTour();
  const [workspaces, setWorkspaces] = useState([]);
  const resetDemo = async () => {
    if (!confirm('Reset the demo? All demo data is wiped and reloaded, including anything you changed.')) return;
    try {
      await api('/demo/reset', { method: 'POST' });
      toast('Demo data reloaded');
      setTimeout(() => (location.href = '/'), 600);
    } catch (e) { toast(e.message, 'error'); }
  };
  const loc = useLocation();
  useEffect(() => {
    api('/workspaces').then(setWorkspaces).catch(() => {});
  }, [loc.pathname]);

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">◎</span> Orbit PM
        <span className={`mode-badge ${mode}`} title={mode === 'demo' ? 'Sample data — safe to experiment' : 'Live data'}>{mode}</span>
      </div>
      <nav className="nav">
        <NavLink to="/" end data-tour="nav-overview">Overview</NavLink>
        <NavLink to="/my-tasks" data-tour="nav-mytasks">My tasks</NavLink>
        {can(user, 'users.manage') && <NavLink to="/users">Users</NavLink>}
        {can(user, 'roles.manage') && <NavLink to="/roles" data-tour="nav-roles">Roles</NavLink>}
        {can(user, 'settings.manage') && <NavLink to="/settings">Settings</NavLink>}
      </nav>
      <div className="nav-section">Workspaces</div>
      <nav className="nav nav-ws" data-tour="nav-workspaces">
        {workspaces.map((w) => (
          <NavLink key={w._id} to={`/w/${w._id}`}>
            <span className="ws-key">{(w.key || w.name).slice(0, 3).toUpperCase()}</span>
            {w.name}
          </NavLink>
        ))}
        {!workspaces.length && <div className="nav-empty">No workspaces yet</div>}
      </nav>
      <div className="sidebar-tools">
        <button className="side-btn" onClick={start} data-tour="tour-button">✦ Take the tour</button>
        {mode === 'demo' && can(user, 'users.manage') && <button className="side-btn" onClick={resetDemo}>↺ Reset demo data</button>}
      </div>
      <div className="sidebar-foot">
        <Avatar name={user.name} size={32} />
        <div className="who">
          <strong>{user.name}</strong>
          <small>{ROLE_LABELS[user.role]} <span className={`dot ${online ? 'on' : ''}`} title={online ? 'Live' : 'Offline'} /></small>
        </div>
        <button className="icon-btn light" onClick={logout} title="Sign out">⎋</button>
      </div>
    </aside>
  );
}

export default function App() {
  const { user, ready } = useAuth();
  if (!ready) return <div className="splash">Loading…</div>;
  if (!user)
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/my-tasks" element={<MyTasks />} />
          <Route path="/users" element={can(user, 'users.manage') ? <Users /> : <Navigate to="/" />} />
          <Route path="/roles" element={can(user, 'roles.manage') ? <Roles /> : <Navigate to="/" />} />
          <Route path="/settings" element={can(user, 'settings.manage') ? <Settings /> : <Navigate to="/" />} />
          <Route path="/w/:wid/p/:pid/:tab?" element={<ScopeView />} />
          <Route path="/w/:wid/:tab?" element={<ScopeView />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}
