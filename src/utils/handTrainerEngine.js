// --- Moteur du mode d'entraînement "Situations complètes" -----------------
// Lecteur générique de graphes de décisions décrits par un pack JSON
// (voir src/data/handTrainer/poker_training_scenarios.schema.json). Aucune
// main n'est codée en dur ici : tout vient du pack chargé par les
// composants, qui ne font qu'afficher ce que ces fonctions leur renvoient.

const STREET_ORDER = ['preflop', 'flop', 'turn', 'river']

const SUIT_SYMBOL = { s: '♠', h: '♥', d: '♦', c: '♣' }
const RED_SUITS = new Set(['h', 'd'])

/** Découpe "As" -> { rank: 'A', suit: 's', symbol: '♠', red: false }. */
export function parseCard(code) {
  if (!code || code.length < 2) return null
  const rank = code[0]
  const suit = code[1]
  return { rank, suit, symbol: SUIT_SYMBOL[suit] || suit, red: RED_SUITS.has(suit) }
}

/**
 * Valide la structure d'un pack et renvoie la liste des anomalies trouvées
 * (une entrée { scenarioId, message } par anomalie) : start_node_id
 * introuvable, id de node dupliqué, option sans terminal ni next_node_id,
 * next_node_id introuvable, node sans option is_optimal. Un scénario listé
 * ici est écarté du pool jouable plutôt que de faire planter l'application.
 */
export function validateScenarioPack(pack) {
  const issues = []
  if (!pack || !Array.isArray(pack.scenarios)) return issues

  const seenScenarioIds = new Set()
  for (const scenario of pack.scenarios) {
    const id = scenario.id
    if (seenScenarioIds.has(id)) issues.push({ scenarioId: id, message: `id de scénario dupliqué : "${id}"` })
    seenScenarioIds.add(id)

    const nodesById = new Map()
    for (const node of scenario.nodes || []) {
      if (nodesById.has(node.id)) {
        issues.push({ scenarioId: id, message: `id de node dupliqué : "${node.id}"` })
      }
      nodesById.set(node.id, node)
    }

    if (!nodesById.has(scenario.start_node_id)) {
      issues.push({ scenarioId: id, message: `start_node_id introuvable : "${scenario.start_node_id}"` })
    }

    for (const node of nodesById.values()) {
      if (!node.options || node.options.length < 2) {
        issues.push({ scenarioId: id, message: `node "${node.id}" a moins de 2 options` })
        continue
      }
      let hasOptimal = false
      for (const option of node.options) {
        if (option.is_optimal) hasOptimal = true
        if (!option.terminal && !option.next_node_id) {
          issues.push({
            scenarioId: id,
            message: `option "${option.id}" du node "${node.id}" n'est ni terminale ni reliée à un next_node_id`,
          })
        }
        if (option.next_node_id && !nodesById.has(option.next_node_id)) {
          issues.push({
            scenarioId: id,
            message: `next_node_id introuvable "${option.next_node_id}" (node "${node.id}")`,
          })
        }
      }
      if (!hasOptimal) {
        issues.push({ scenarioId: id, message: `node "${node.id}" n'a aucune option is_optimal` })
      }
    }
  }
  return issues
}

/**
 * Charge un pack : valide et retire les scénarios invalides (journalisés en
 * console.error pour le développeur), renvoie la liste des scénarios
 * jouables.
 */
export function loadScenarioPack(pack) {
  const issues = validateScenarioPack(pack)
  if (issues.length) {
    console.error('[handTrainer] pack de scénarios invalide, scénarios ignorés :', issues)
  }
  const invalidIds = new Set(issues.map((i) => i.scenarioId))
  return (pack?.scenarios || []).filter((s) => !invalidIds.has(s.id))
}

export function getNode(scenario, nodeId) {
  return scenario.nodes.find((n) => n.id === nodeId) || null
}

/**
 * Applique le choix d'une option : renvoie le node, l'option choisie, et si
 * la main se termine ou continue vers `nextNodeId`. Ne révèle jamais le
 * grade ni le feedback : c'est au débrief de fin de main de le faire.
 */
export function applyChoice(scenario, nodeId, optionId) {
  const node = getNode(scenario, nodeId)
  const option = node?.options.find((o) => o.id === optionId)
  if (!node || !option) return null
  return {
    node,
    option,
    terminal: !!option.terminal,
    nextNodeId: option.terminal ? null : option.next_node_id,
  }
}

/**
 * Facettes de filtrage déduites du scénario (format, position/street de
 * départ, tags, difficulté, validation) — toujours lues depuis le pack.
 */
export function scenarioFacets(scenario) {
  const start = getNode(scenario, scenario.start_node_id)
  const playerCount = scenario.format?.players
  return {
    players: playerCount === 2 ? 'hu' : playerCount === 3 ? '3max' : null,
    position: start?.state?.hero_position || null,
    street: start?.street || null,
    stack: start?.state?.effective_stack_bb ?? null,
    tags: scenario.tags || [],
    difficulty: scenario.difficulty || null,
    solverVerified: !!scenario.validation?.solver_verified,
  }
}

export function sortStreets(streets) {
  return [...streets].sort((a, b) => STREET_ORDER.indexOf(a) - STREET_ORDER.indexOf(b))
}

export function scoreOf(decisions) {
  const score = decisions.reduce((sum, d) => sum + d.score, 0)
  const maxScore = decisions.length * 2
  return { score, maxScore, percentage: maxScore ? Math.round((score / maxScore) * 100) : 0 }
}

/**
 * Regroupe des décisions par clé (street/position/tag...) et calcule le
 * score de chaque groupe. `keyFn` peut renvoyer une valeur ou un tableau de
 * valeurs (ex. les tags d'une décision comptent dans chacun de ses tags).
 */
export function groupScore(decisions, keyFn) {
  const groups = {}
  for (const d of decisions) {
    const keys = keyFn(d)
    const list = Array.isArray(keys) ? keys : [keys]
    for (const key of list) {
      if (key == null) continue
      if (!groups[key]) groups[key] = { score: 0, maxScore: 0, count: 0 }
      groups[key].score += d.score
      groups[key].maxScore += 2
      groups[key].count += 1
    }
  }
  return groups
}

export function gradeClass(grade) {
  if (grade === 'excellent') return 'res-excellent'
  if (grade === 'bon') return 'res-bon'
  return 'res-faux'
}

export function gradeLabel(grade) {
  if (grade === 'excellent') return 'Excellent'
  if (grade === 'bon') return 'Bon'
  return 'Mauvais'
}

/** Couleur par défaut des boutons de décision, par type d'action (le pack ne fournit pas de couleur explicite). */
export const ACTION_TYPE_COLOR = {
  fold: '#9e9e9e',
  check: '#1e88e5',
  call: '#43a047',
  limp: '#1e88e5',
  bet: '#fb8c00',
  raise: '#e53935',
  shove: '#8e24aa',
}

/** Mélange de Fisher-Yates (ne modifie pas le tableau d'origine). */
export function shuffle(list) {
  const arr = [...list]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * Construit une file de scénarios pour une session : mélange le pool filtré
 * et, si `limit` dépasse sa taille, le reboucle en évitant de remettre deux
 * fois de suite le même scénario. `limit` null = toute la sélection (une
 * seule passe, sans répétition).
 */
export function buildSessionQueue(pool, limit) {
  if (!pool.length) return []
  const need = limit == null ? pool.length : limit
  const queue = []
  while (queue.length < need) {
    const batch = shuffle(pool)
    if (queue.length && batch[0].id === queue[queue.length - 1].id && batch.length > 1) {
      ;[batch[0], batch[1]] = [batch[1], batch[0]]
    }
    for (const scenario of batch) {
      if (queue.length >= need) break
      queue.push(scenario)
    }
  }
  return queue
}
