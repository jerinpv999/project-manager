// Editable story point matrix with save + recalculation options.
// Used for the organisation default (Settings) and per-workspace matrices (Team & structure).
import { useEffect, useState } from 'react';
import { ErrorText } from './ui';
import PointsMatrix from './PointsMatrix';

const copy = (m) => m.map((r) => [...r]);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export default function MatrixEditor({
  matrix,            // currently effective matrix
  defaultMatrix,     // organisation default (or built-in default on the Settings page)
  inheritable,       // true for workspaces: can follow the organisation default
  inherited,         // true when the workspace currently follows the default
  canEdit,
  onSave,            // async (matrix | null, recalculate) => { updated }
  defaultLabel = 'organisation default',
}) {
  const [draft, setDraft] = useState(copy(matrix));
  const [custom, setCustom] = useState(!inherited);
  const [recalc, setRecalc] = useState('open');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => { setDraft(copy(matrix)); setCustom(!inherited); }, [matrix, inherited]);

  const shown = inheritable && !custom ? defaultMatrix : draft;
  const dirty = inheritable ? custom === inherited || (custom && !same(draft, matrix)) : !same(draft, matrix);
  const setCell = (c, s, v) => setDraft((m) => m.map((row, i) => (i === c - 1 ? row.map((x, j) => (j === s - 1 ? v : x)) : row)));

  const save = async () => {
    setBusy(true); setError(''); setMsg('');
    try {
      const r = await onSave(inheritable && !custom ? null : draft, recalc);
      setMsg(recalc === 'none' ? 'Saved.' : `Saved · ${r?.updated ?? 0} task(s) recalculated.`);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="settings-matrix">
      <PointsMatrix matrix={shown} mode={canEdit && (!inheritable || custom) ? 'edit' : 'view'} onChange={setCell} />
      <div className="matrix-help">
        {inheritable && (
          <div className="seg matrix-source">
            <button className={!custom ? 'on' : ''} disabled={!canEdit} onClick={() => setCustom(false)}>Use {defaultLabel}</button>
            <button className={custom ? 'on' : ''} disabled={!canEdit} onClick={() => { setCustom(true); if (inherited) setDraft(copy(defaultMatrix)); }}>Custom for this workspace</button>
          </div>
        )}
        <ul>
          <li>Story points = value at (<strong>complexity</strong>, <strong>size</strong>).</li>
          <li>Tasks in <em>Matrix</em> mode take their points from here; tasks in <em>Manual</em> mode keep the points typed in.</li>
          {inheritable && <li>{custom ? 'This workspace uses its own matrix.' : `This workspace follows the ${defaultLabel} (Settings page).`}</li>}
        </ul>
        {canEdit ? (
          <>
            <div className="matrix-tools">
              {(!inheritable || custom) && !same(draft, defaultMatrix) && <button className="btn sm" onClick={() => setDraft(copy(defaultMatrix))}>Copy {defaultLabel}</button>}
              {(!inheritable || custom) && !same(draft, matrix) && <button className="btn sm" onClick={() => setDraft(copy(matrix))}>Undo changes</button>}
            </div>
            <fieldset className="recalc">
              <legend>When saving, recalculate matrix-mode tasks</legend>
              <label className="check"><input type="radio" name={`recalc-${inheritable}`} checked={recalc === 'open'} onChange={() => setRecalc('open')} /> Open tasks only (done tasks keep their history)</label>
              <label className="check"><input type="radio" name={`recalc-${inheritable}`} checked={recalc === 'all'} onChange={() => setRecalc('all')} /> All tasks, including done</label>
              <label className="check"><input type="radio" name={`recalc-${inheritable}`} checked={recalc === 'none'} onChange={() => setRecalc('none')} /> Don't change existing tasks</label>
            </fieldset>
            <ErrorText error={error} />
            {msg && <div className="ok-text">{msg}</div>}
            <button className="btn primary" disabled={!dirty || busy} onClick={save}>{busy ? 'Saving…' : 'Save matrix'}</button>
          </>
        ) : (
          <p className="muted">You can view this matrix; ask a project manager to change it.</p>
        )}
      </div>
    </div>
  );
}
