import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { useConfig } from '../config';
import { ROLE_LABELS } from '../api';
import { Avatar, ErrorText, useSubmit } from '../components/ui';

const ROLE_HINT = {
  admin: 'Users, delete & delegate, everything',
  project_manager: 'Owns the Acme workspace',
  developer: 'Assigned tasks, updates status',
  ui_developer: 'Storefront only — no Payments access',
  qa: 'Moves tasks QA → Done',
  tech_lead: 'Custom role · manages tasks, exports reports',
  stakeholder: 'Custom role · read-only reports',
};

export default function Login() {
  const { login } = useAuth();
  const { mode, accounts } = useConfig();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { busy, error, submit, setError } = useSubmit(() => login(email, password), () => nav('/'));

  const quick = async (a) => {
    setError('');
    try { await login(a.email, a.password); nav('/'); } catch (e) { setError(e.message); }
  };

  return (
    <div className="login-page">
      <div className="login-wrap">
        <form className="login-card" onSubmit={submit}>
          <div className="brand dark"><span className="brand-mark">◎</span> Orbit PM</div>
          <p className="muted">
            Sign in to your workspace
            {mode === 'demo' && <span className="mode-badge demo">Demo mode</span>}
          </p>
          <input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required />
          <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <ErrorText error={error} />
          <button className="btn primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>

        {mode === 'demo' && accounts.length > 0 && (
          <div className="demo-accounts">
            <h3>Try a role</h3>
            <p className="muted">Sample data is preloaded. Click an account to sign in as that person{accounts.find((a) => a.role !== 'admin') ? ` (password ${accounts.find((a) => a.role !== 'admin').password})` : ''}.</p>
            {accounts.map((a) => (
              <button key={a.email} className="demo-account" onClick={() => quick(a)}>
                <Avatar name={a.name} size={34} />
                <div>
                  <strong>{a.name}</strong>
                  <small>{ROLE_LABELS[a.role] || a.roleName || a.role} · {ROLE_HINT[a.role] || ''}</small>
                  <code>{a.email}</code>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
