import React from 'react'
import { handKind } from '../../utils/hands.js'

const ICONS = { correct: '✓', extra: '✕', wrong: '✕', missed: '?' }

/**
 * Case de correction (diff entre la tentative de l'utilisateur et la
 * solution), partagée par le Mode inversé et le mode Construis-la-range.
 *  - correct : la tentative correspond à la solution -> couleur pleine + ✓
 *  - extra   : sélectionné/peint à tort -> couleur de la tentative + ✕
 *  - wrong   : mauvaise action peinte -> couleur tentée, pastille solution en coin
 *  - missed  : action attendue mais absente de la tentative -> contour pointillé
 *  - neutral : rien à signaler (hors du champ de la question)
 */
function ReviewCell({ row, col, name, status, color, expectedColor }) {
  const kind = handKind(row, col)
  return (
    <div className={`cell cell-${kind} review-cell review-${status}`} title={name}>
      {(status === 'correct' || status === 'extra' || status === 'wrong') && color && (
        <div className="review-fill" style={{ background: color }} />
      )}
      {status === 'wrong' && expectedColor && (
        <div className="review-expected" style={{ background: expectedColor }} title="Action attendue" />
      )}
      {status === 'missed' && expectedColor && (
        <div className="review-outline" style={{ borderColor: expectedColor }} />
      )}
      {status !== 'neutral' && <span className={'review-icon review-icon-' + status}>{ICONS[status]}</span>}
      <span className="cell-label">{name}</span>
    </div>
  )
}

export default React.memo(ReviewCell)
