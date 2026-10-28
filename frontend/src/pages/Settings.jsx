import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import MatrixEditor from '../components/MatrixEditor';

export default function Settings() {
  const { reloadRoles } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => { api('/settings/story-points').then(setData); }, []);
  if (!data) return <div className="page muted">Loading…</div>;

  const save = async (matrix, recalculate) => {
    const r = await api('/settings/story-points', { method: 'PUT', body: { matrix, recalculate } });
    setData({ ...data, matrix: r.matrix });
    await reloadRoles(); // also refreshes the matrix used by task forms
    return r;
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Settings</h1>
          <p className="muted">Organisation-wide settings.</p>
        </div>
      </header>

      <section className="card settings-card" data-tour="points-matrix">
        <header className="card-head">
          <div>
            <h3>Default story points matrix</h3>
            <small className="muted">
              Used by every workspace that doesn't have its own matrix. Workspaces can override it under
              Team &amp; structure → Story point matrix.
            </small>
          </div>
        </header>
        <MatrixEditor
          matrix={data.matrix}
          defaultMatrix={data.defaultMatrix}
          defaultLabel="built-in default"
          canEdit
          onSave={save}
        />
      </section>
    </div>
  );
}
