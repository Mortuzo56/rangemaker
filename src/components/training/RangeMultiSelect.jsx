import React from 'react'

/**
 * Sélecteur multiple des ranges à travailler (au lieu d'une seule ou de
 * toutes). Repliable : le résumé reste compact, le détail (cases à cocher +
 * tout sélectionner/désélectionner) s'ouvre au clic.
 */
export default function RangeMultiSelect({ matrices, selectedIds, onToggle, onSelectAll, onSelectNone }) {
  const allSelected = matrices.length > 0 && matrices.every((m) => selectedIds.has(m.id))
  const noneSelected = selectedIds.size === 0

  return (
    <details className="range-picker">
      <summary className="range-picker-summary">
        <span className="range-picker-label">Ranges travaillées</span>
        <span className="range-picker-count">
          {selectedIds.size}/{matrices.length}
        </span>
      </summary>
      <div className="range-picker-panel">
        <div className="range-picker-actions">
          <button type="button" className="btn-mini" onClick={onSelectAll} disabled={allSelected}>
            Tout sélectionner
          </button>
          <button type="button" className="btn-mini" onClick={onSelectNone} disabled={noneSelected}>
            Tout désélectionner
          </button>
        </div>
        <ul className="range-picker-list">
          {matrices.map((m) => (
            <li key={m.id}>
              <label className="range-picker-item">
                <input type="checkbox" checked={selectedIds.has(m.id)} onChange={() => onToggle(m.id)} />
                {m.name}
              </label>
            </li>
          ))}
        </ul>
      </div>
    </details>
  )
}
