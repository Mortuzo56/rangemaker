// --- Historique du mode "Situations complètes" ------------------------------
// Indépendant de l'historique de quiz (utils/history.js) : ici on persiste
// une tentative complète par main jouée (toutes les décisions prises), pas
// juste des statistiques par carte.

import { scoreOf, groupScore } from './handTrainerEngine.js'

const ATTEMPTS_KEY = 'rangemaker.handTrainerAttempts.v1'
const REVIEW_KEY = 'rangemaker.handTrainerReview.v1'
// Borne raisonnable pour ne pas faire grossir localStorage indéfiniment.
const MAX_ATTEMPTS = 500

export function loadAttempts() {
  try {
    const raw = localStorage.getItem(ATTEMPTS_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch (err) {
    console.error('Lecture historique des mains impossible :', err)
    return []
  }
}

function saveAttempts(attempts) {
  try {
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(attempts.slice(-MAX_ATTEMPTS)))
  } catch (err) {
    console.error('Écriture historique des mains impossible :', err)
  }
}

/** Enregistre une tentative terminée { scenarioId, decisions, totalScore, maxScore } et la persiste. */
export function recordAttempt(attempts, attempt) {
  const next = [...attempts, { ...attempt, date: new Date().toISOString() }]
  saveAttempts(next)
  return next
}

/** Toutes les décisions de tout l'historique, aplaties (pour les stats globales). */
function allDecisions(attempts) {
  return attempts.flatMap((a) => a.decisions)
}

export function overallStats(attempts) {
  return scoreOf(allDecisions(attempts))
}

export function statsByTag(attempts) {
  return groupScore(allDecisions(attempts), (d) => d.tags)
}

/**
 * Tags les plus faibles (taux de réussite le plus bas), pour un futur mode
 * "Entraîne-moi sur mes leaks". Ignore les tags trop peu pratiqués.
 */
export function getWeakestTags(attempts, { minCount = 2, topN = 5 } = {}) {
  const groups = statsByTag(attempts)
  return Object.entries(groups)
    .filter(([, g]) => g.count >= minCount)
    .map(([tag, g]) => ({ tag, ...g, percentage: g.maxScore ? Math.round((g.score / g.maxScore) * 100) : 0 }))
    .sort((a, b) => a.percentage - b.percentage)
    .slice(0, topN)
}

// --- Mains marquées "à revoir" ---------------------------------------------

export function loadReviewList() {
  try {
    const raw = localStorage.getItem(REVIEW_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(parsed) ? parsed : [])
  } catch (err) {
    console.error('Lecture des mains à revoir impossible :', err)
    return new Set()
  }
}

export function saveReviewList(set) {
  try {
    localStorage.setItem(REVIEW_KEY, JSON.stringify([...set]))
  } catch (err) {
    console.error('Écriture des mains à revoir impossible :', err)
  }
}
