import { useEffect, useState } from 'react';
import { STATUS_LABELS, ROLE_LABELS, ROLE_META } from '../api';

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export const Badge = ({ value, kind }) => {
  if (kind === 'role') return <RoleBadge role={value} />;
  return <span className={`badge badge-${kind || value}`}>{STATUS_LABELS[value] || value}</span>;
};

export const RoleBadge = ({ role }) => (
  <span className="badge badge-role">
    <i className="role-dot" style={{ background: ROLE_META[role]?.color || '#8b8a84' }} />
    {ROLE_LABELS[role] || role}
  </span>
);

export const Points = ({ value }) =>
  value === null || value === undefined ? null : <span className="points" title="Story points">{value}</span>;

export function Avatar({ name = '?', size = 26 }) {
  const initials = name.split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return (
    <span className="avatar" title={name} style={{ width: size, height: size, background: `hsl(${h} 45% 42%)`, fontSize: size * 0.4 }}>
      {initials}
    </span>
  );
}

export const Empty = ({ children }) => <div className="empty">{children}</div>;

export function ErrorText({ error }) {
  return error ? <div className="error-text">{error}</div> : null;
}

// Handles a form submit with busy/error state.
export function useSubmit(fn, onDone) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e) => {
    e?.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await fn();
      onDone?.(r);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, submit, setError };
}

export function MemberPicker({ users, value, onChange }) {
  const set = new Set(value.map(String));
  return (
    <div className="member-picker">
      {users.map((u) => (
        <label key={u._id} className={`member-chip ${set.has(String(u._id)) ? 'on' : ''} ${u.active === false ? 'inactive' : ''}`}>
          <input
            type="checkbox"
            checked={set.has(String(u._id))}
            onChange={(e) => onChange(e.target.checked ? [...value, u._id] : value.filter((v) => String(v) !== String(u._id)))}
          />
          <Avatar name={u.name} size={22} />
          <span>{u.name}</span>
          <small>{ROLE_LABELS[u.role]}</small>
        </label>
      ))}
    </div>
  );
}

export function Progress({ value, total }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="progress" title={`${value}/${total}`}>
      <div className="progress-bar" style={{ width: `${pct}%` }} />
      <span>{pct}%</span>
    </div>
  );
}
