import React, { useEffect, useMemo, useState } from 'react'
import ViewerCell from './ViewerCell.jsx'
import { RANKS } from '../constants.js'
import { handName } from '../utils/hands.js'
import { RANGE_TYPES, RANGE_STYLES, POSITIONS, getMeta } from '../utils/meta.js'

const ALL = 'all'

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
 * Onglet "Consultation" : liste des ranges enregistrées, filtrable par type
 * (open / réaction), tapis effectif (bb) et style (simplifiée / GTO), +
 * affichage en lecture seule. On ne peut pas modifier la grille ; cliquer
 * une case l'agrandit et montre les pourcentages de chaque action.
 */
export default function ConsultView({ matrices, onUpdateMeta }) {
  const [selectedId, setSelectedId] = useState(matrices[0]?.id || null)
  const [selectedCell, setSelectedCell] = useState(null)
  const [simplifiedView, setSimplifiedView] = useState(false)

  const [filterType, setFilterType] = useState(ALL)
  const [filterStack, setFilterStack] = useState(ALL)
  const [filterStyle, setFilterStyle] = useState(ALL)
  const [filterPosition, setFilterPosition] = useState(ALL)

  // Chaque matrice enrichie de ses métadonnées effectives (explicites ou déduites du nom).
  const withMeta = useMemo(() => matrices.map((m) => ({ ...m, _meta: getMeta(m) })), [matrices])

  // Valeurs de tapis disponibles pour le menu déroulant, triées croissant.
  const availableStacks = useMemo(() => {
    const set = new Set()
    withMeta.forEach((m) => { if (m._meta.stack != null) set.add(m._meta.stack) })
    return [...set].sort((a, b) => a - b)
  }, [withMeta])

  const filtered = useMemo(
    () =>
      withMeta.filter(
        (m) =>
          (filterType === ALL || m._meta.type === filterType) &&
          (filterStack === ALL || m._meta.stack === Number(filterStack)) &&
          (filterStyle === ALL || m._meta.style === filterStyle) &&
          (filterPosition === ALL || m._meta.position === filterPosition),
      ),
    [withMeta, filterType, filterStack, filterStyle, filterPosition],
  )

  // Si la sélection n'existe plus (suppression) ou sort du filtre, on retombe sur le premier résultat filtré.
  useEffect(() => {
    if (!filtered.find((m) => m.id === selectedId)) {
      setSelectedId(filtered[0]?.id || null)
    }
  }, [filtered, selectedId])

  const matrix = withMeta.find((m) => m.id === selectedId) || null

  const actionsById = useMemo(
    () => (matrix ? Object.fromEntries(matrix.actions.map((a) => [a.id, a])) : {}),
    [matrix],
  )
  const actionOrder = useMemo(
    () => (matrix ? Object.fromEntries(matrix.actions.map((a, i) => [a.id, i])) : {}),
    [matrix],
  )

  const handleStackTag = () => {
    const current = matrix._meta.stack
    const value = prompt('Tapis effectif (en bb) :', current != null ? String(current) : '')
    if (value === null) return
    const n = Number(value.replace(',', '.'))
    if (value.trim() !== '' && Number.isFinite(n)) onUpdateMeta(matrix.id, { stack: n })
    else if (value.trim() === '') onUpdateMeta(matrix.id, { stack: null })
  }

  if (!matrices.length) {
    return <p className="hint">Aucune range enregistrée. Créez-en dans l'onglet « Éditeur » ou importez un JSON.</p>
  }

  return (
    <div className="consult">
      {/* Liste des ranges à gauche, avec filtres */}
      <aside className="consult-list">
        <h2>Ranges</h2>

        <div className="consult-filters">
          <label>
            Type
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value={ALL}>Tous</option>
              {RANGE_TYPES.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
          <label>
            Position
            <select value={filterPosition} onChange={(e) => setFilterPosition(e.target.value)}>
              <option value={ALL}>Toutes</option>
              {POSITIONS.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <label>
            Tapis effectif
            <select value={filterStack} onChange={(e) => setFilterStack(e.target.value)}>
              <option value={ALL}>Tous</option>
              {availableStacks.map((s) => (
                <option key={s} value={s}>{s} bb</option>
              ))}
            </select>
          </label>
          <label>
            Style
            <select value={filterStyle} onChange={(e) => setFilterStyle(e.target.value)}>
              <option value={ALL}>Tous</option>
              {RANGE_STYLES.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
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

            <div className="consult-tags">
              <label>
                Type
                <select
                  value={matrix._meta.type}
                  onChange={(e) => onUpdateMeta(matrix.id, { type: e.target.value })}
                >
                  {RANGE_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Position
                <select
                  value={matrix._meta.position ?? ''}
                  onChange={(e) => onUpdateMeta(matrix.id, { position: e.target.value || null })}
                >
                  <option value="">—</option>
                  {POSITIONS.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </label>
              <button className="btn-mini" onClick={handleStackTag} title="Modifier le tapis effectif">
                Tapis : {matrix._meta.stack != null ? `${matrix._meta.stack} bb` : '—'}
              </button>
              <label>
                Style
                <select
                  value={matrix._meta.style}
                  onChange={(e) => onUpdateMeta(matrix.id, { style: e.target.value })}
                >
                  {RANGE_STYLES.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </label>
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
