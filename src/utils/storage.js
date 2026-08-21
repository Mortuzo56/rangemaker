import { STORAGE_KEY } from '../constants.js'
import { migrateMeta } from './meta.js'

// --- Persistance des matrices dans localStorage ---------------------------
// Une matrice enregistrée = { id, name, actions, cells, createdAt, updatedAt }

/** Lit la liste complète des matrices enregistrées. */
export function loadMatrices() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Migration : ranges taguées avant l'ajout de la position « SB HU ».
    return parsed.map((m) => (m.meta ? { ...m, meta: migrateMeta(m.meta) } : m))
  } catch (err) {
    console.error('Lecture localStorage impossible :', err)
    return []
  }
}

/** Écrit la liste complète des matrices. */
export function saveMatrices(matrices) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(matrices))
  } catch (err) {
    console.error('Écriture localStorage impossible :', err)
    alert("Impossible d'enregistrer (localStorage plein ou indisponible).")
  }
}

/** Génère un identifiant simple et unique (sans dépendance externe). */
export function makeId() {
  return 'm-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}
