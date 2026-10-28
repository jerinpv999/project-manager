import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, can } from '../api';
import MatrixEditor from '../components/MatrixEditor';
import { useAuth } from '../auth';
import { Avatar, Badge, Empty, ErrorText, Field, MemberPicker, Modal, useSubmit } from '../components/ui';

function ProjectForm({ scope, initial, onClose }) {
  const nav = useNavigate();
  const [f, setF] = useState(
    initial || { name: '', description: '', kind: scope.pid ? 'module' : 'subproject', members: [] }
  );
  // only workspace members can be assigned to sub-projects/modules
  const candidates = scope.ws.members.filter((m) => m.active !== false);
  const { busy, error, submit } = useSubmit(
    async () => {
      if (initial) {
        await api(`/projects/${initial._id}`, { method: 'PUT', body: f });
        return api(`/projects/${initial._id}/members`, { method: 'PUT', body: { members: f.members } });
      }
      return api('/projects', { method: 'POST', body: { ...f, workspace: scope.wid, parent: scope.pid } });
    },
    (p) => { scope.reload(); onClose(); if (!initial) nav(`/w/${scope.wid}/p/${p._id}/structure`); }
  );
  return (
    <Modal title={initial ? `Edit ${initial.name}` : scope.pid ? 'New module / sub-project' : 'New sub-project'} onClose={onClose} wide>
      <form className="form" onSubmit={submit}>
        <div className="row">
          <Field label="Name"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></Field>
          <Field label="Type">
            <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
              <option value="subproject">Sub-project</option>
              <option value="module">Module</option>
            </select>
          </Field>
        </div>
        <Field label="Description"><textarea rows={3} value={f.description || ''} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <Field label="Assigned members" hint="Only members of this workspace can be assigned">
          <MemberPicker users={candidates} value={f.members} onChange={(members) => setF({ ...f, members })} />
        </Field>
        <ErrorText error={error} />
        <div className="form-actions"><button className="btn primary" disabled={busy}>Save</button></div>
      </form>
    </Modal>
  );
}

function WorkspaceMembers({ scope, onClose }) {
  const [users, setUsers] = useState([]);
  const [members, setMembers] = useState(scope.ws.members.map((m) => m._id));
  useEffect(() => { api('/users').then((u) => setUsers(u.filter((x) => x.active))); }, []);
  const { busy, error, submit } = useSubmit(
    () => api(`/workspaces/${scope.wid}/members`, { method: 'PUT', body: { members } }),
    () => { scope.reload(); onClose(); }
  );
  return (
    <Modal title="Workspace members" onClose={onClose} wide>
      <form className="form" onSubmit={submit}>
        <p className="muted">Removing someone from the workspace also removes them from all its sub-projects and modules.</p>
        <MemberPicker users={users} value={members} onChange={setMembers} />
        <ErrorText error={error} />
        <div className="form-actions"><button className="btn primary" disabled={busy}>Save members</button></div>
      </form>
    </Modal>
  );
}

function EditWorkspace({ scope, onClose }) {
  const [f, setF] = useState({ name: scope.ws.name, key: scope.ws.key || '', description: scope.ws.description || '' });
  const { busy, error, submit } = useSubmit(
    () => api(`/workspaces/${scope.wid}`, { method: 'PUT', body: f }),
    () => { scope.reload(); onClose(); }
  );
  return (
    <Modal title="Edit workspace" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Field label="Name"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></Field>
        <Field label="Key"><input value={f.key} maxLength={6} onChange={(e) => setF({ ...f, key: e.target.value })} /></Field>
        <Field label="Description"><textarea rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <ErrorText error={error} />
        <div className="form-actions"><button className="btn primary" disabled={busy}>Save</button></div>
      </form>
    </Modal>
  );
}

function WorkspaceMatrix({ scope }) {
  const { reloadRoles } = useAuth();
  const [data, setData] = useState(null);
  useEffect(() => { api(`/workspaces/${scope.wid}/story-points`).then(setData); }, [scope.wid]);
  if (!data) return null;
  const save = async (matrix, recalculate) => {
    const r = await api(`/workspaces/${scope.wid}/story-points`, { method: 'PUT', body: { matrix, recalculate } });
    setData({ ...data, matrix: r.matrix, source: r.source });
    await reloadRoles();
    scope.reload(); // task forms pick up the new matrix
    return r;
  };
  return (
    <section className="card span-all" data-tour="ws-matrix">
      <header className="card-head">
        <div>
          <h3>Story point matrix <span className={`pill ${data.source === 'workspace' ? '' : 'muted-pill'}`}>{data.source === 'workspace' ? 'Custom' : 'Organisation default'}</span></h3>
          <small className="muted">Applies to this workspace and all its sub-projects and modules.</small>
        </div>
      </header>
      <MatrixEditor
        matrix={data.matrix}
        defaultMatrix={data.defaultMatrix}
        inheritable
        inherited={data.source !== 'workspace'}
        canEdit={scope.can('structure.manage')}
        onSave={save}
      />
    </section>
  );
}

export default function Structure({ scope }) {
  const { user, toast } = useAuth();
  const nav = useNavigate();
  const [modal, setModal] = useState(null);
  const children = scope.projects.filter((p) => String(p.parent || '') === String(scope.pid || ''));
  const members = scope.project ? scope.project.members : scope.ws.members;

  const removeProject = async () => {
    if (!confirm(`Delete "${scope.project.name}" and all its tasks, features, sprints, docs and chat?`)) return;
    try {
      await api(`/projects/${scope.pid}`, { method: 'DELETE' });
      scope.reload();
      nav(`/w/${scope.wid}`);
    } catch (e) { toast(e.message, 'error'); }
  };
  const removeWorkspace = async () => {
    if (!confirm(`Delete workspace "${scope.ws.name}" and EVERYTHING inside it? This cannot be undone.`)) return;
    try { await api(`/workspaces/${scope.wid}`, { method: 'DELETE' }); nav('/'); } catch (e) { toast(e.message, 'error'); }
  };

  return (
    <div className="two-col">
      <section className="card">
        <header className="card-head">
          <h3>{scope.project ? 'Assigned members' : 'Workspace members'} <span className="count">{members.length}</span></h3>
          {scope.can('structure.manage') && (
            <button className="btn sm" onClick={() => setModal(scope.project ? 'editProject' : 'members')}>Manage</button>
          )}
        </header>
        {!members.length && <Empty>No one assigned yet.</Empty>}
        <ul className="member-list">
          {members.map((m) => (
            <li key={m._id}>
              <Avatar name={m.name} />
              <div><strong>{m.name}</strong><small>{m.email}</small></div>
              <Badge value={m.role} kind="role" />
            </li>
          ))}
        </ul>
        {scope.project && <p className="muted small-note">Project managers in the workspace can always access sub-projects. Members of a parent sub-project can see its modules.</p>}
      </section>

      <section className="card">
        <header className="card-head">
          <h3>{scope.pid ? 'Modules & sub-projects' : 'Sub-projects'} <span className="count">{children.length}</span></h3>
          {scope.can('structure.manage') && <button className="btn sm primary" onClick={() => setModal('newProject')}>+ Add</button>}
        </header>
        {!children.length && <Empty>Nothing here yet.</Empty>}
        <ul className="project-list">
          {children.map((p) => (
            <li key={p._id}>
              <Link to={`/w/${scope.wid}/p/${p._id}`}>
                <span className={`kind-dot ${p.kind}`} />
                <div>
                  <strong>{p.name}</strong>
                  <small>{p.kind === 'module' ? 'Module' : 'Sub-project'} · {p.members.length} members</small>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {scope.can('structure.manage') && (
        <section className="card span-all">
          <header className="card-head"><h3>Settings</h3></header>
          <div className="settings-row">
            {scope.project ? (
              <>
                <button className="btn" onClick={() => setModal('editProject')}>Edit {scope.project.kind === 'module' ? 'module' : 'sub-project'}</button>
                <button className="btn danger" onClick={removeProject}>Delete</button>
              </>
            ) : (
              <>
                <button className="btn" onClick={() => setModal('editWs')}>Edit workspace</button>
                {can(user, 'workspace.delete') && <button className="btn danger" onClick={removeWorkspace}>Delete workspace</button>}
              </>
            )}
          </div>
          <p className="muted small-note">Roles are set per user on the Users page; custom roles and their permissions are managed on the Roles page.</p>
        </section>
      )}

      {!scope.pid ? <WorkspaceMatrix scope={scope} /> : (
        <section className="card span-all"><small className="muted">Story points here use the workspace's matrix ({scope.matrixSource === 'workspace' ? 'custom' : 'organisation default'}). Change it on the workspace's Team &amp; structure tab.</small></section>
      )}

      {modal === 'newProject' && <ProjectForm scope={scope} onClose={() => setModal(null)} />}
      {modal === 'editProject' && (
        <ProjectForm
          scope={scope}
          initial={{ ...scope.project, members: scope.project.members.map((m) => m._id) }}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'members' && <WorkspaceMembers scope={scope} onClose={() => setModal(null)} />}
      {modal === 'editWs' && <EditWorkspace scope={scope} onClose={() => setModal(null)} />}
    </div>
  );
}
