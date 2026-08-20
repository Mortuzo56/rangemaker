import React from 'react'
import { handKind, cellTotal } from '../utils/hands.js'

/**
 * Case en lecture seule (onglet Consultation).
 * Au clic : la case s'agrandit légèrement (via la classe "selected") et
 * affiche le détail des pourcentages de chaque action.
 */
export default function ViewerCell({ row, col, name, entries, actionsById, actionOrder, selected, onSelect }) {
  const kind = handKind(row, col)
  const ordered = [...entries].sort(
    (a, b) => (actionOrder[a.actionId] ?? 99) - (actionOrder[b.actionId] ?? 99),
  )
  const rest = 100 - cellTotal(entries)

  return (
    <div
      className={'vcell cell-' + kind + (selected ? ' vcell-selected' : '')}
      onClick={() => onSelect(selected ? null : name)}
      title={name}
    >
      {/* Bandes proportionnelles (clippées par le conteneur) */}
      <div className="cell-bands">
        {ordered.map((e, i) => {
          const act = actionsById[e.actionId]
          if (!act || !e.percent) return null
          return <div key={i} className="cell-band" style={{ width: `${e.percent}%`, background: act.color }} />
        })}
      </div>

      {selected ? (
        // Détail des pourcentages par-dessus les bandes.
        <div className="vcell-detail">
          <div className="vcell-hand">{name}</div>
          {ordered.map((e, i) => {
            const act = actionsById[e.actionId]
            if (!act) return null
            return (
              <div key={i} className="vcell-line">
                <span className="vcell-dot" style={{ background: act.color }} />
                {act.name} {e.percent}%
              </div>
            )
          })}
          {rest > 0 && <div className="vcell-line vcell-muted">— {rest}%</div>}
        </div>
      ) : (
        <span className="cell-label">{name}</span>
      )}
    </div>
  )
}
