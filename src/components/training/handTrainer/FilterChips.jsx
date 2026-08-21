import React from 'react'

/**
 * Groupe de cases cliquables à sélection multiple (contrairement aux
 * `filter-chip` de l'onglet Consultation, qui sont exclusives). Cliquer une
 * case l'ajoute/la retire de la sélection ; plusieurs positions, tags, etc.
 * peuvent donc être actifs à la fois.
 */
export default function FilterChips({ label, options, selected, onToggle }) {
  if (!options.length) return null
  return (
    <div className="filter-group">
      <span className="filter-group-label">{label}</span>
      <div className="filter-chips">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={'filter-chip' + (selected.has(opt.id) ? ' active' : '')}
            onClick={() => onToggle(opt.id)}
          >
            {opt.name}
          </button>
        ))}
      </div>
    </div>
  )
}
