import { handName, cellTotal } from './hands.js'

function topAction(entries) {
  if (!entries || !entries.length) return null
  return [...entries].sort((a, b) => b.percent - a.percent)[0]
}

/**
 * Une main est "frontière" (difficile à retenir) si :
 *  - la case est mêlée entre plusieurs actions (pas ~100% une seule), ou
 *  - un voisin direct de la grille (haut/bas/gauche/droite) a une action
 *    majoritaire différente : c'est la limite visuelle entre deux zones.
 * Les cases vides (aucune action définie) sont ignorées, ainsi que leurs
 * voisines vides (rien à comparer).
 * Retourne un Set des noms de mains "frontière" pour ce spot.
 */
export function computeBorderHands(matrix) {
  const border = new Set()
  const cellAt = (row, col) => matrix.cells[handName(row, col)] || []

  for (let row = 0; row < 13; row++) {
    for (let col = 0; col < 13; col++) {
      const name = handName(row, col)
      const entries = cellAt(row, col)
      if (!entries.length) continue

      const top = topAction(entries)
      const mixed = entries.length > 1 && top.percent < 90 || cellTotal(entries) < 95

      let differsFromNeighbour = false
      if (!mixed) {
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nr = row + dr, nc = col + dc
          if (nr < 0 || nr > 12 || nc < 0 || nc > 12) continue
          const nEntries = cellAt(nr, nc)
          if (!nEntries.length) continue
          const nTop = topAction(nEntries)
          if (nTop.actionId !== top.actionId) {
            differsFromNeighbour = true
            break
          }
        }
      }

      if (mixed || differsFromNeighbour) border.add(name)
    }
  }
  return border
}
