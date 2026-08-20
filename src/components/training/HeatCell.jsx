import React from 'react'
import { handKind } from '../../utils/hands.js'

// Vert (maîtrisé) -> rouge (erreurs fréquentes) via la teinte HSL.
function heatColor(rate) {
  const hue = 140 - 140 * rate // 140 = vert, 0 = rouge
  return `hsl(${hue}, 65%, 45%)`
}

/** Case colorée selon le taux d'erreur (heatmap de suivi de performance). */
function HeatCell({ row, col, name, rate, seen }) {
  const kind = handKind(row, col)
  const style = seen ? { background: heatColor(rate) } : undefined
  const title = seen
    ? `${name} — ${Math.round(rate * 100)}% d'erreurs (${seen} essai${seen > 1 ? 's' : ''})`
    : `${name} — pas encore pratiquée`
  return (
    <div className={'cell cell-' + kind + ' heat-cell' + (seen ? '' : ' heat-cell-unseen')} style={style} title={title}>
      <span className="cell-label">{name}</span>
    </div>
  )
}

export default React.memo(HeatCell)
