// --- Historique de performance par (spot, main) ----------------------------
// Alimente à la fois la répétition espacée (quelle main servir en priorité)
// et la heatmap de suivi (quelles mains sont maîtrisées / à risque).
// Persisté dans localStorage, indépendamment des matrices elles-mêmes.

const HISTORY_KEY = 'rangemaker.history.v1'

// Intervalles (ms) d'un système à la Leitner : une réussite ("excellent")
// fait monter d'une case, un échec ("faux") revient à la case 0.
const BOX_INTERVALS_MS = [
  0, // 0 : due immédiatement
  2 * 60 * 1000, // 1 : 2 min
  10 * 60 * 1000, // 2 : 10 min
  60 * 60 * 1000, // 3 : 1 h
  24 * 60 * 60 * 1000, // 4 : 1 jour
  4 * 24 * 60 * 60 * 1000, // 5 : 4 jours
  10 * 24 * 60 * 60 * 1000, // 6 : 10 jours
]
const MAX_BOX = BOX_INTERVALS_MS.length - 1

export function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch (err) {
    console.error('Lecture historique impossible :', err)
    return {}
  }
}

export function saveHistory(history) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  } catch (err) {
    console.error('Écriture historique impossible :', err)
  }
}

const EMPTY_STAT = { seen: 0, correct: 0, faux: 0, box: 0, dueAt: 0, lastResult: null, lastAt: null }

/** Statistiques d'une main pour un spot donné (valeurs par défaut si jamais vue). */
export function getStat(history, matrixId, hand) {
  return history[matrixId]?.[hand] || EMPTY_STAT
}

/**
 * Enregistre le résultat d'une tentative et met à jour la planification.
 * `result` : 'excellent' | 'bon' | 'faux'. Retourne le nouvel historique (immuable).
 */
export function recordResult(history, matrixId, hand, result, now = Date.now()) {
  const prev = getStat(history, matrixId, hand)
  let box = prev.box
  if (result === 'excellent') box = Math.min(MAX_BOX, box + 1)
  else if (result === 'faux') box = 0
  // 'bon' : ligne acceptable mais pas optimale -> pas de progression de boîte, révision proche.
  const dueAt = now + BOX_INTERVALS_MS[box]
  const next = {
    seen: prev.seen + 1,
    correct: prev.correct + (result !== 'faux' ? 1 : 0),
    faux: prev.faux + (result === 'faux' ? 1 : 0),
    box,
    dueAt,
    lastResult: result,
    lastAt: now,
  }
  return {
    ...history,
    [matrixId]: { ...history[matrixId], [hand]: next },
  }
}

/** Taux d'erreur (0..1) d'une main pour un spot, ou null si jamais pratiquée. */
export function errorRate(history, matrixId, hand) {
  const s = getStat(history, matrixId, hand)
  if (!s.seen) return null
  return s.faux / s.seen
}

/**
 * Choisit la prochaine main à servir en répétition espacée parmi une liste de
 * candidats { matrixId, hand }. Priorité aux mains en retard (dueAt le plus
 * ancien, les jamais-vues étant toujours prioritaires), avec un peu d'aléa
 * parmi les plus urgentes pour ne pas être parfaitement répétitif.
 */
export function pickDueHand(history, candidates, now = Date.now()) {
  if (!candidates.length) return null
  const withDue = candidates.map((c) => ({ ...c, due: getStat(history, c.matrixId, c.hand).dueAt }))
  withDue.sort((a, b) => a.due - b.due)
  const overdue = withDue.filter((c) => c.due <= now)
  const poolSize = Math.max(5, Math.ceil((overdue.length || withDue.length) * 0.3))
  const pool = (overdue.length ? overdue : withDue).slice(0, poolSize)
  return pool[Math.floor(Math.random() * pool.length)]
}

export { HISTORY_KEY }
