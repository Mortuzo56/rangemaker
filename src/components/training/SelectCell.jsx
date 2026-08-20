import React from 'react'
import { handKind } from '../../utils/hands.js'

/**
 * Case cliquable à sélection binaire (Mode inversé, phase de réponse) :
 * pleine de la couleur de l'action cible si sélectionnée, neutre sinon.
 * Supporte le glisser-sélectionner : le clic initial fixe le mode (sélectionner
 * ou désélectionner) et chaque case survolée pendant le glisser suit ce mode.
 */
function SelectCell({ row, col, name, selected, color, onStart, onEnter }) {
  const kind = handKind(row, col)
  return (
    <div
      className={'cell cell-' + kind + ' select-cell' + (selected ? ' select-cell-on' : '')}
      style={selected ? { background: color } : undefined}
      onMouseDown={(e) => {
        if (e.button !== 0) return
        e.preventDefault()
        onStart(name)
      }}
      onMouseEnter={() => onEnter(name)}
      title={name}
    >
      <span className="cell-label">{name}</span>
    </div>
  )
}

export default React.memo(SelectCell)
