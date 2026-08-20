import React, { useCallback, useEffect, useRef } from 'react'
import RangeCell from './RangeCell.jsx'
import { RANKS } from '../constants.js'
import { handName } from '../utils/hands.js'

/**
 * Grille 13x13 + en-têtes de rangs.
 * Gère le clic et le glisser (peinture) : on applique l'action active sur
 * chaque case survolée pendant que le bouton gauche est enfoncé.
 */
export default function RangeGrid({ cells, actionsById, actionOrder, onPaintCell, onOpenCell }) {
  const painting = useRef(false)
  const painted = useRef(new Set()) // cases déjà peintes durant ce glisser

  // Fin de peinture dès que le bouton est relâché (même hors de la grille).
  useEffect(() => {
    const stop = () => {
      painting.current = false
      painted.current.clear()
    }
    window.addEventListener('mouseup', stop)
    return () => window.removeEventListener('mouseup', stop)
  }, [])

  const handleMouseDown = useCallback(
    (e, name) => {
      if (e.button !== 0) return // seul le clic gauche peint
      painting.current = true
      painted.current = new Set([name])
      onPaintCell(name)
    },
    [onPaintCell],
  )

  const handleMouseEnter = useCallback(
    (e, name) => {
      if (!painting.current) return
      if (painted.current.has(name)) return
      painted.current.add(name)
      onPaintCell(name)
    },
    [onPaintCell],
  )

  return (
    <div className="grid-wrap">
      {/* En-tête de colonnes */}
      <div className="grid-head-row">
        <div className="grid-corner" />
        {RANKS.map((r) => (
          <div key={r} className="grid-head">
            {r}
          </div>
        ))}
      </div>

      {/* Lignes de la grille */}
      {RANKS.map((rowRank, row) => (
        <div key={rowRank} className="grid-row">
          <div className="grid-head">{rowRank}</div>
          {RANKS.map((colRank, col) => {
            const name = handName(row, col)
            return (
              <RangeCell
                key={name}
                row={row}
                col={col}
                name={name}
                entries={cells[name] || []}
                actionsById={actionsById}
                actionOrder={actionOrder}
                onMouseDown={handleMouseDown}
                onMouseEnter={handleMouseEnter}
                onContextMenu={onOpenCell}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}
