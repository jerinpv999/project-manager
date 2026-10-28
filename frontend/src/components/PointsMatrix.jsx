// Complexity × Size story point grid, laid out like the team's estimation sheet:
// complexity 5 at the top, size 1 → 5 left to right.
// mode="pick": click a cell to choose complexity + size.  mode="edit": cells are number inputs.
import { STORY_MATRIX } from '../api';

// Sequential single-hue ramp (light → dark) by the value's rank among distinct values
const RAMP = ['#e6effb', '#cfe0f7', '#a9c8f0', '#7aaae6', '#4f8ddc', '#2a78d6', '#1d5aa6', '#143f75'];

export default function PointsMatrix({ matrix = STORY_MATRIX.matrix, mode = 'pick', complexity, size, onPick, onChange }) {
  const { complexityLabels, sizeLabels } = STORY_MATRIX;
  const distinct = [...new Set(matrix.flat().map(Number))].sort((a, b) => a - b);
  const shade = (v) => {
    const i = distinct.indexOf(Number(v));
    const idx = distinct.length <= 1 ? 0 : Math.round((i / (distinct.length - 1)) * (RAMP.length - 1));
    return { background: RAMP[idx], color: idx >= 4 ? '#fff' : '#17171a' };
  };

  return (
    <div className="pm-wrap">
      <div className="pm-axis-y">Complexity</div>
      <table className="pm-grid" role="grid" aria-label="Story points matrix">
        <tbody>
          {[5, 4, 3, 2, 1].map((c) => (
            <tr key={c}>
              <th scope="row" title={complexityLabels[c - 1]}>
                <span className="pm-level">{c}</span>
                <small>{complexityLabels[c - 1]}</small>
              </th>
              {[1, 2, 3, 4, 5].map((s) => {
                const v = matrix[c - 1][s - 1];
                const selected = complexity === c && size === s;
                const inRow = complexity === c || size === s;
                if (mode === 'view') return <td key={s} style={shade(v)}><span className="pm-val">{v}</span></td>;
                if (mode === 'edit') {
                  return (
                    <td key={s} style={shade(v)}>
                      <input
                        type="number" min={0} max={100} value={v}
                        aria-label={`Complexity ${c}, size ${s}`}
                        onChange={(e) => onChange?.(c, s, e.target.value === '' ? 0 : Number(e.target.value))}
                      />
                    </td>
                  );
                }
                return (
                  <td key={s} style={shade(v)} className={`${selected ? 'sel' : ''} ${complexity && size && inRow && !selected ? 'cross' : ''}`}>
                    <button type="button" onClick={() => onPick?.(c, s)} title={`Complexity ${c} (${complexityLabels[c - 1]}) × Size ${s} (${sizeLabels[s - 1]}) = ${v} pts`}>
                      {v}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
          <tr className="pm-foot">
            <th />
            {[1, 2, 3, 4, 5].map((s) => (
              <th key={s} scope="col" title={sizeLabels[s - 1]}>
                <span className="pm-level">{s}</span>
                <small>{sizeLabels[s - 1]}</small>
              </th>
            ))}
          </tr>
        </tbody>
      </table>
      <div className="pm-axis-x">Size</div>
    </div>
  );
}
