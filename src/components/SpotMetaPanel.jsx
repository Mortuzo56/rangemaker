import React from 'react'
import { RANGE_TYPES, RANGE_STYLES, POSITIONS } from '../utils/meta.js'

/**
 * Panneau du créateur de range : type (open/réaction), style (GTO/simplifiée),
 * position et tapis effectif (bb) de la range en cours d'édition. Ces
 * informations sont enregistrées avec la matrice (dans `matrix.meta`).
 */
export default function SpotMetaPanel({ meta, setMeta }) {
  const update = (patch) => setMeta((prev) => ({ ...prev, ...patch }))

  return (
    <div className="panel">
      <h2>Spot</h2>
      <div className="spot-meta-grid">
        <label>
          Type
          <select value={meta.type} onChange={(e) => update({ type: e.target.value })}>
            {RANGE_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Style
          <select value={meta.style} onChange={(e) => update({ style: e.target.value })}>
            {RANGE_STYLES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Position
          <select
            value={meta.position ?? ''}
            onChange={(e) => update({ position: e.target.value || null })}
          >
            <option value="">—</option>
            {POSITIONS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tapis effectif (bb)
          <input
            type="number"
            min="0"
            step="0.5"
            placeholder="ex. 10"
            value={meta.stack ?? ''}
            onChange={(e) => {
              const raw = e.target.value
              update({ stack: raw === '' ? null : Number(raw) })
            }}
          />
        </label>
      </div>
      <p className="hint">Ces informations sont enregistrées avec la range et servent aux filtres et aux exercices.</p>
    </div>
  )
}
