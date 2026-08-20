import React from 'react'
import { RANKS } from '../../constants.js'
import { handName } from '../../utils/hands.js'

/**
 * Coquille réutilisable pour toute grille 13x13 (avec en-têtes de rangs) :
 * délègue le rendu de chaque case à `renderCell(name, row, col)`.
 * Utilisée par les modes d'entraînement basés sur une grille (inversé,
 * construis-la-range, heatmap) pour ne pas dupliquer la structure.
 */
export default function GridShell({ renderCell, className = '' }) {
  return (
    <div className={'grid-wrap ' + className}>
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
            return <React.Fragment key={name}>{renderCell(name, row, col)}</React.Fragment>
          })}
        </div>
      ))}
    </div>
  )
}
