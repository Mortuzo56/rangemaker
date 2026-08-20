// --- Métadonnées d'une range (type / position / tapis effectif / style) ---
// Ces attributs servent à filtrer les ranges dans l'onglet Consultation et à
// contextualiser les exercices d'entraînement. Ils sont stockés dans
// `matrix.meta` quand ils ont été choisis explicitement dans le créateur,
// sinon on les déduit du nom de la matrice pour rester compatible avec les
// ranges déjà enregistrées ou importées avant l'ajout de cette fonctionnalité.

export const RANGE_TYPES = [
  { id: 'open', name: 'Open' },
  { id: 'reaction', name: 'Réaction' },
]

export const RANGE_STYLES = [
  { id: 'simplified', name: 'Simplifiée' },
  { id: 'gto', name: 'GTO' },
]

// Positions courantes. Le suffixe « (Heads-Up) » distingue les spots à 2
// joueurs des mêmes positions à table plus large (la range n'est pas la
// même selon le nombre d'adversaires).
export const POSITIONS = [
  { id: 'utg', name: 'UTG' },
  { id: 'utg1', name: 'UTG+1' },
  { id: 'lj', name: 'LJ' },
  { id: 'hj', name: 'HJ' },
  { id: 'co', name: 'CO' },
  { id: 'btn', name: 'BTN' },
  { id: 'sb', name: 'SB' },
  { id: 'bb', name: 'BB' },
  { id: 'sb-hu', name: 'SB (Heads-Up)' },
  { id: 'bb-hu', name: 'BB (Heads-Up)' },
]

/** Déduit les métadonnées à partir du nom de la matrice (heuristique). */
export function inferMeta(name = '') {
  const lower = name.toLowerCase()
  const stackMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*bb/)
  const stack = stackMatch ? Number(stackMatch[1].replace(',', '.')) : null
  const type = /\bvs\b|r[ée]action/.test(lower) ? 'reaction' : 'open'
  const style = /simplifi/.test(lower) ? 'simplified' : 'gto'
  const isHu = /\bhu\b|heads[\s-]?up/.test(lower)
  let position = null
  for (const p of POSITIONS) {
    const base = p.id.replace('-hu', '')
    if (new RegExp(`\\b${base}\\b`, 'i').test(lower)) {
      position = isHu ? (base === 'sb' ? 'sb-hu' : base === 'bb' ? 'bb-hu' : p.id) : p.id
      break
    }
  }
  return { type, stack, style, position }
}

/** Métadonnées effectives d'une matrice : explicites si présentes, sinon déduites. */
export function getMeta(matrix) {
  const inferred = inferMeta(matrix?.name)
  const explicit = matrix?.meta || {}
  return {
    type: explicit.type ?? inferred.type,
    stack: explicit.stack ?? inferred.stack,
    style: explicit.style ?? inferred.style,
    position: explicit.position ?? inferred.position,
  }
}
