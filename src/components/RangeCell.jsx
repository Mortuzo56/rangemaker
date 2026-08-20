import React from 'react'
import { handKind } from '../utils/hands.js'

/**
 * Une case de la grille.
 * Affiche les actions sous forme de bandes verticales empilées horizontalement,
 * proportionnelles à leur pourcentage, avec le nom de la main lisible par-dessus.
 */
function RangeCell({ row, col, name, entries, actionsById, actionOrder, onMouseDown, onMouseEnter, onContextMenu }) {
  const kind = handKind(row, col)

  // Bandes ordonnées selon la position de l'action dans le panneau (gauche -> droite).
  const ordered = [...entries].sort(
    (a, b) => (actionOrder[a.actionId] ?? 99) - (actionOrder[b.actionId] ?? 99),
  )

  return (
    <div
      className={`cell cell-${kind}`}
      onMouseDown={(e) => onMouseDown(e, name)}
      onMouseEnter={(e) => onMouseEnter(e, name)}
      onContextMenu={(e) => {
        e.preventDefault()
        onContextMenu(name)
      }}
      onDoubleClick={() => onContextMenu(name)}
      title={name}
    >
      {/* Bandes de couleur proportionnelles */}
      <div className="cell-bands">
        {ordered.map((e, i) => {
          const act = actionsById[e.actionId]
          if (!act || !e.percent) return null
          return (
            <div
              key={i}
              className="cell-band"
              style={{ width: `${e.percent}%`, background: act.color }}
            />
          )
        })}
        {/* Le reste (jusqu'à 100 %) reste sur le fond neutre de la case. */}
      </div>

      <span className="cell-label">{name}</span>
    </div>
  )
}

export default React.memo(RangeCell)
