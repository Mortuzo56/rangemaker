// --- Métadonnées d'une range (position / nombre de joueurs / tapis effectif) ---
// Ces attributs servent à filtrer les ranges dans l'onglet Consultation et à
// contextualiser les exercices d'entraînement. Ils sont stockés dans
// `matrix.meta` quand ils ont été choisis explicitement dans le créateur,
// sinon on les déduit du nom de la matrice pour rester compatible avec les
// ranges déjà enregistrées ou importées avant l'ajout de cette fonctionnalité.

// Positions couvertes par les charts push/fold de l'appli : les opens
// (BTN et SB en 3-max, SB HU en Heads-Up) et les 3 réactions possibles de la
// BB (vs SB en 3-max, vs BTN en 3-max, vs SB en Heads-Up — cas nommé « BB HU »
// pour éviter toute confusion avec « BB vs SB »). Le suffixe « HU » distingue
// systématiquement la variante Heads-Up de la variante 3-max d'une même
// position, plutôt que de compter uniquement sur la case « Joueurs ».
export const POSITIONS = [
  { id: 'btn', name: 'BTN' },
  { id: 'sb', name: 'SB' },
  { id: 'sb-hu', name: 'SB HU' },
  { id: 'bb-vs-sb', name: 'BB vs SB' },
  { id: 'bb-vs-btn', name: 'BB vs BTN' },
  { id: 'bb-hu', name: 'BB HU' },
]

export const PLAYER_COUNTS = [
  { id: 'hu', name: 'HU' },
  { id: '3max', name: '3-max' },
]

// Tapis effectifs pris en charge (en bb), du plus profond au plus court.
export const STACK_OPTIONS = Array.from({ length: 14 }, (_, i) => 15 - i)

const REACTION_POSITIONS = new Set(['bb-vs-sb', 'bb-vs-btn', 'bb-hu'])

/** Vrai si la position désigne une range de réaction (la BB répond à un adversaire). */
export function isReactionPosition(position) {
  return REACTION_POSITIONS.has(position)
}

/** Déduit les métadonnées à partir du nom de la matrice (heuristique). */
export function inferMeta(name = '') {
  const lower = name.toLowerCase()

  const stackMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*bb/)
  const stack = stackMatch ? Number(stackMatch[1].replace(',', '.')) : null

  const isHu = /\bhu\b|heads[\s-]?up/.test(lower)
  const is3Max = /3[\s-]?max/.test(lower)
  const players = isHu ? 'hu' : is3Max ? '3max' : null

  let position = null
  if (/\bbb\b.*\bvs\b.*\bsb\b/.test(lower)) position = 'bb-vs-sb'
  else if (/\bbb\b.*\bvs\b.*\bbtn\b/.test(lower)) position = 'bb-vs-btn'
  else if (/\bbb\b/.test(lower)) position = isHu ? 'bb-hu' : null
  else if (/\bbtn\b/.test(lower)) position = 'btn'
  else if (/\bsb\b/.test(lower)) position = isHu ? 'sb-hu' : 'sb'

  return { position, players, stack }
}

/** Métadonnées effectives d'une matrice : explicites si présentes, sinon déduites. */
export function getMeta(matrix) {
  const inferred = inferMeta(matrix?.name)
  const explicit = matrix?.meta || {}
  return {
    position: explicit.position ?? inferred.position,
    players: explicit.players ?? inferred.players,
    stack: explicit.stack ?? inferred.stack,
  }
}

/**
 * Corrige les métadonnées explicites enregistrées avant l'ajout de la
 * position dédiée « SB HU » (elles utilisaient encore position: 'sb' avec
 * players: 'hu'). Sans cette migration, les ranges taguées avant ce
 * changement restent invisibles pour la nouvelle case « SB HU ».
 */
export function migrateMeta(meta) {
  if (!meta) return meta
  if (meta.position === 'sb' && meta.players === 'hu') {
    return { ...meta, position: 'sb-hu' }
  }
  return meta
}
