import React, { useMemo } from 'react'
import { cellTotal } from '../utils/hands.js'

/**
 * Modale d'édition fine d'une case.
 * Permet de régler précisément le % de chaque action (champ numérique + slider).
 * La somme est bornée à 100 % : on empêche toute saisie qui dépasserait.
 */
export default function CellEditor({ name, entries, actions, onChange, onClear, onClose }) {
  // Map actionId -> percent pour un accès simple.
  const byId = useMemo(() => {
    const m = {}
    ;(entries || []).forEach((e) => {
      m[e.actionId] = e.percent
    })
    return m
  }, [entries])

  const total = cellTotal(entries)
  const remaining = 100 - total

  // Reconstruit le tableau d'entrées à partir de la map (en ignorant les 0).
  const commit = (map) => {
    const next = Object.entries(map)
      .filter(([, pct]) => pct > 0)
      .map(([actionId, percent]) => ({ actionId, percent }))
    onChange(name, next)
  }

  const setPercent = (actionId, raw) => {
    let value = Math.max(0, Math.min(100, Math.round(raw)))
    // Plafonne pour que la somme ne dépasse jamais 100 %.
    const others = total - (byId[actionId] || 0)
    if (value + others > 100) value = 100 - others
    commit({ ...byId, [actionId]: value })
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Édition de {name}</h3>
          <button className="btn-icon" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="editor-rows">
          {actions.map((a) => {
            const pct = byId[a.id] || 0
            return (
              <div key={a.id} className="editor-row">
                <span className="swatch" style={{ background: a.color }} />
                <span className="editor-name">{a.name}</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={pct}
                  onChange={(e) => setPercent(a.id, Number(e.target.value))}
                />
                <input
                  className="editor-num"
                  type="number"
                  min="0"
                  max="100"
                  value={pct}
                  onChange={(e) => setPercent(a.id, Number(e.target.value))}
                />
                <span className="pct-sign">%</span>
              </div>
            )
          })}
        </div>

        <div className={'editor-total' + (remaining < 0 ? ' over' : '')}>
          Attribué : <b>{total}%</b> — Non attribué (neutre) : <b>{remaining}%</b>
        </div>

        <div className="modal-actions">
          <button className="btn" onClick={() => onClear(name)}>
            Vider la case
          </button>
          <button className="btn btn-primary" onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
