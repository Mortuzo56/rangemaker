import React, { useEffect, useMemo, useState } from 'react'
import ViewerCell from './ViewerCell.jsx'
import { RANKS } from '../constants.js'
import { handName } from '../utils/hands.js'
import { POSITIONS, POSITION_GROUPS, STACK_OPTIONS, getMeta } from '../utils/meta.js'

const ALL = 'all'

/**
 * Groupe de cases cliquables (au lieu d'un menu déroulant) : une case active
 * à la fois par groupe. Cliquer la case déjà active la désactive (retour à
 * "tous"). `vertical` empile les cases au lieu de les mettre en ligne (utile
 * pour les colonnes de position 3-max / HU).
 */
function ChipGroup({ label, options, value, onChange, vertical }) {
  return (
    <div className="filter-group">
      <span className="filter-group-label">{label}</span>
      <div className={'filter-chips' + (vertical ? ' filter-chips-vertical' : '')}>
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={'filter-chip' + (value === opt.id ? ' active' : '')}
            onClick={() => onChange(value === opt.id ? ALL : opt.id)}
          >
            {opt.name}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Réduit les entrées d'une case à l'action majoritaire uniquement (vue
 * simplifiée). En cas d'égalité, on garde l'action la plus agressive, c'est
 * à dire celle qui apparaît en premier dans la liste des actions de la
 * matrice (convention déjà utilisée pour l'ordre des bandes gauche→droite).
 */
function dominantEntries(entries, actions) {
  if (!entries || !entries.length) return []
  const orderIndex = Object.fromEntries(actions.map((a, i) => [a.id, i]))
  let best = null
  for (const e of entries) {
    if (!e.percent) continue
    if (!best || e.percent > best.percent) {
      best = e
    } else if (e.percent === best.percent) {
      if ((orderIndex[e.actionId] ?? 99) < (orderIndex[best.actionId] ?? 99)) best = e
    }
  }
  return best ? [{ actionId: best.actionId, percent: 100 }] : []
}

/**
 * Onglet "Consultation" : liste des ranges enregistrées, filtrable par cases
 * cliquables (position en 2 colonnes 3-max / HU, puis tapis effectif) +
 * affichage en lecture seule. On ne peut pas modifier la grille ; cliquer une
 * case l'agrandit et montre les pourcentages de chaque action.
 */
export default function ConsultView({ matrices }) {
  const [selectedId, setSelectedId] = useState(matrices[0]?.id || null)
  const [selectedCell, setSelectedCell] = useState(null)
  const [simplifiedView, setSimplifiedView] = useState(false)

  const [filterPosition, setFilterPosition] = useState(ALL)
  const [filterStack, setFilterStack] = useState(ALL)

  // Chaque matrice enrichie de ses métadonnées effectives (explicites ou déduites du nom).
  const withMeta = useMemo(() => matrices.map((m) => ({ ...m, _meta: getMeta(m) })), [matrices])

  // Position choisie (ou toutes) → cases de tapis effectif disponibles :
  // seuls les tapis pour lesquels une range existe réellement sont proposés.
  const stackOptions = useMemo(() => {
    const relevant = filterPosition === ALL ? withMeta : withMeta.filter((m) => m._meta.position === filterPosition)
    const present = new Set()
    relevant.forEach((m) => { if (m._meta.stack != null) present.add(m._meta.stack) })
    return STACK_OPTIONS.filter((n) => present.has(n)).map((n) => ({ id: String(n), name: `${n} bb` }))
  }, [withMeta, filterPosition])

  // Si le tapis coché n'existe plus pour la position choisie, on le désélectionne.
  useEffect(() => {
    if (filterStack !== ALL && !stackOptions.find((s) => s.id === filterStack)) {
      setFilterStack(ALL)
    }
  }, [stackOptions, filterStack])

  const filtered = useMemo(
    () =>
      withMeta.filter(
        (m) =>
          (filterPosition === ALL || m._meta.position === filterPosition) &&
          (filterStack === ALL || m._meta.stack === Number(filterStack)),
      ),
    [withMeta, filterPosition, filterStack],
  )

  // Dès que les cases cochées ne laissent plus qu'une seule range possible,
  // on l'affiche directement. Sinon, on retombe sur le premier résultat
  // filtré si la sélection courante n'en fait plus partie.
  useEffect(() => {
    if (filtered.length === 1) {
      setSelectedId(filtered[0].id)
      setSelectedCell(null)
    } else if (!filtered.find((m) => m.id === selectedId)) {
      setSelectedId(filtered[0]?.id || null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterPosition, filterStack, filtered])

  const matrix = withMeta.find((m) => m.id === selectedId) || null

  const actionsById = useMemo(
    () => (matrix ? Object.fromEntries(matrix.actions.map((a) => [a.id, a])) : {}),
    [matrix],
  )
  const actionOrder = useMemo(
    () => (matrix ? Object.fromEntries(matrix.actions.map((a, i) => [a.id, i])) : {}),
    [matrix],
  )

  if (!matrices.length) {
    return <p className="hint">Aucune range enregistrée. Créez-en dans l'onglet « Éditeur » ou importez un JSON.</p>
  }

  return (
    <div className="consult">
      {/* Liste des ranges à gauche, avec filtres à cases */}
      <aside className="consult-list">
        <h2>Ranges</h2>

        <div className="consult-filters">
          <div className="filter-group">
            <span className="filter-group-label">Position</span>
            <div className="position-columns">
              {POSITION_GROUPS.map((group) => (
                <ChipGroup
                  key={group.id}
                  label={group.label}
                  vertical
                  options={group.positionIds.map((id) => POSITIONS.find((p) => p.id === id)).filter(Boolean)}
                  value={filterPosition}
                  onChange={setFilterPosition}
                />
              ))}
            </div>
          </div>
          <ChipGroup label="Tapis effectif" options={stackOptions} value={filterStack} onChange={setFilterStack} />
        </div>

        {filtered.length === 0 ? (
          <p className="hint">Aucune range ne correspond à ces filtres.</p>
        ) : (
          <ul>
            {filtered.map((m) => (
              <li
                key={m.id}
                className={'consult-item' + (m.id === selectedId ? ' active' : '')}
                onClick={() => {
                  setSelectedId(m.id)
                  setSelectedCell(null)
                }}
              >
                {m.name}
              </li>
            ))}
          </ul>
        )}
      </aside>

      {/* Affichage lecture seule */}
      <main className="consult-main">
        {matrix && (
          <>
            <div className="consult-head">
              <h2>{matrix.name}</h2>
              <div className="legend">
                {matrix.actions.map((a) => (
                  <span key={a.id} className="legend-item">
                    <span className="legend-swatch" style={{ background: a.color }} />
                    {a.name}
                  </span>
                ))}
              </div>
              <button
                className={'btn btn-mini-toggle' + (simplifiedView ? ' active' : '')}
                onClick={() => setSimplifiedView((v) => !v)}
                title="N'affiche que l'action majoritaire de chaque case (l'action la plus agressive en cas d'égalité)"
              >
                {simplifiedView ? '✓ Vue simplifiée' : 'Vue simplifiée'}
              </button>
            </div>

            <div className="grid-wrap consult-grid">
              {/* En-tête colonnes */}
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
                    const rawEntries = matrix.cells[name] || []
                    const entries = simplifiedView ? dominantEntries(rawEntries, matrix.actions) : rawEntries
                    return (
                      <ViewerCell
                        key={name}
                        row={row}
                        col={col}
                        name={name}
                        entries={entries}
                        actionsById={actionsById}
                        actionOrder={actionOrder}
                        selected={selectedCell === name}
                        onSelect={setSelectedCell}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
            <p className="hint">Cliquez une case pour voir le détail des pourcentages. Lecture seule.</p>
          </>
        )}
      </main>
    </div>
  )
}
