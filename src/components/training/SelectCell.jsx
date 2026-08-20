import React from 'react'
import { handKind } from '../../utils/hands.js'

/**
 * Case cliquable à sélection binaire (Mode inversé, phase de réponse) :
 * pleine de la couleur de l'action cible si sélectionnée, neutre sinon.
 */
function SelectCell({ row, col, name, selected, color, onToggle }) {
  const kind = handKind(row, col)
  return (
    <div
      className={'cell cell-' + kind + ' select-cell' + (selected ? ' select-cell-on' : '')}
      style={selected ? { background: color } : undefined}
      onMouseDown={(e) => {
        e.preventDefault()
        onToggle(name)
      }}
      title={name}
    >
      <span className="cell-label">{name}</span>
    </div>
  )
}

export default React.memo(SelectCell)
