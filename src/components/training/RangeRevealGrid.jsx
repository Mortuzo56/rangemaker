import React, { useState } from 'react'
import ViewerCell from '../ViewerCell.jsx'
import { RANKS } from '../../constants.js'
import { handName } from '../../utils/hands.js'

/**
 * Grille complète en lecture seule affichée après une réponse, pour situer
 * la main jouée dans l'ensemble de la range (au lieu du seul détail de
 * cette case). Réutilise le rendu de l'onglet Consultation ; la main de la
 * question en cours est mise en évidence.
 */
export default function RangeRevealGrid({ matrix, highlightHand, onClose }) {
  const [selectedCell, setSelectedCell] = useState(null)

  const actionsById = Object.fromEntries(matrix.actions.map((a) => [a.id, a]))
  const actionOrder = Object.fromEntries(matrix.actions.map((a, i) => [a.id, i]))

  return (
    <div className="range-reveal">
      <div className="range-reveal-head">
        <span className="range-reveal-title">{matrix.name}</span>
        <div className="legend">
          {matrix.actions.map((a) => (
            <span key={a.id} className="legend-item">
              <span className="legend-swatch" style={{ background: a.color }} />
              {a.name}
            </span>
          ))}
        </div>
        <button className="btn-mini" onClick={onClose}>
          Masquer la range
        </button>
      </div>
      <div className="grid-wrap range-reveal-grid">
        <div className="grid-head-row">
          <div className="grid-corner" />
          {RANKS.map((r) => (
            <div key={r} className="grid-head">
              {r}
            </div>
          ))}
        </div>
        {RANKS.map((rowRank, row) => (
          <div key={rowRank} className="grid-row">
            <div className="grid-head">{rowRank}</div>
            {RANKS.map((colRank, col) => {
              const name = handName(row, col)
              return (
                <ViewerCell
                  key={name}
                  row={row}
                  col={col}
                  name={name}
                  entries={matrix.cells[name] || []}
                  actionsById={actionsById}
                  actionOrder={actionOrder}
                  selected={selectedCell === name}
                  onSelect={setSelectedCell}
                  highlighted={name === highlightHand}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
