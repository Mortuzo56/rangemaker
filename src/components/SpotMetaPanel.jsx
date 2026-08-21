import React from 'react'
import { POSITIONS, PLAYER_COUNTS, STACK_OPTIONS } from '../utils/meta.js'

/**
 * Panneau du créateur de range : position, nombre de joueurs (HU / 3-max) et
 * tapis effectif (bb) de la range en cours d'édition. Ces informations sont
 * enregistrées avec la matrice (dans `matrix.meta`).
 */
export default function SpotMetaPanel({ meta, setMeta }) {
  const update = (patch) => setMeta((prev) => ({ ...prev, ...patch }))

  return (
    <div className="panel">
      <h2>Spot</h2>
      <div className="spot-meta-grid">
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
          Joueurs
          <select
            value={meta.players ?? ''}
            onChange={(e) => update({ players: e.target.value || null })}
          >
            <option value="">—</option>
            {PLAYER_COUNTS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tapis effectif (bb)
          <select
            value={meta.stack ?? ''}
            onChange={(e) => update({ stack: e.target.value === '' ? null : Number(e.target.value) })}
          >
            <option value="">—</option>
            {STACK_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s} bb
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="hint">Ces informations sont enregistrées avec la range et servent aux filtres et aux exercices.</p>
    </div>
  )
}
