import { RANKS } from '../constants.js'

/**
 * Renvoie le nom canonique de la main pour la case (row, col) de la grille 13x13.
 * Convention classique :
 *  - row === col        -> paire        (ex. "AA")
 *  - col  >  row        -> suited        (ex. "AKs")  [triangle supérieur droit]
 *  - col  <  row        -> offsuit       (ex. "AKo")  [triangle inférieur gauche]
 * Le rang le plus fort est toujours écrit en premier.
 */
export function handName(row, col) {
  const rHigh = RANKS[Math.min(row, col)] // rang le plus fort (indice le plus petit)
  const rLow = RANKS[Math.max(row, col)]
  if (row === col) return rHigh + rHigh
  if (col > row) return rHigh + rLow + 's'
  return rHigh + rLow + 'o'
}

/** Catégorie d'une case : 'pair' | 'suited' | 'offsuit'. */
export function handKind(row, col) {
  if (row === col) return 'pair'
  return col > row ? 'suited' : 'offsuit'
}

/**
 * Construit une grille vide : un objet indexé par nom de main -> tableau d'actions.
 * Chaque case = [] (aucune action attribuée au départ).
 */
export function emptyCells() {
  const cells = {}
  for (let row = 0; row < 13; row++) {
    for (let col = 0; col < 13; col++) {
      cells[handName(row, col)] = []
    }
  }
  return cells
}

/** Somme des pourcentages attribués dans une case (0..100). */
export function cellTotal(entries) {
  if (!entries) return 0
  return entries.reduce((sum, e) => sum + (e.percent || 0), 0)
}
