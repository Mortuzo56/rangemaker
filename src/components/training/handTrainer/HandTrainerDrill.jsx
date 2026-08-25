import React, { useEffect, useMemo, useState } from 'react'
import RAW_PACK from '../../../data/handTrainer/poker_training_scenarios_v1.json'
import { loadScenarioPack, scenarioFacets, buildSessionQueue, applyChoice, scoreOf, parseActionText } from '../../../utils/handTrainerEngine.js'
import { loadAttempts, recordAttempt, loadReviewList, saveReviewList, getWeakestTags } from '../../../utils/handTrainerHistory.js'
import FilterChips from './FilterChips.jsx'
import HandTrainerScene from './HandTrainerScene.jsx'
import HandTrainerDebrief from './HandTrainerDebrief.jsx'
import HandTrainerSummary from './HandTrainerSummary.jsx'

const BASE_SCENARIOS = loadScenarioPack(RAW_PACK)

// Le pack de 1000 scénarios préflop pèse ~11 Mo : servi depuis public/ et
// chargé à la demande (fetch), plutôt que bundlé dans le JS de l'appli, pour
// ne pas alourdir le chargement initial de tous les utilisateurs. Mis en
// cache dans cette promesse module-scope pour n'être fetché qu'une fois par
// session, même si le composant est démonté/remonté.
let extraPackPromise = null
function loadExtraScenarios() {
  if (!extraPackPromise) {
    extraPackPromise = fetch(`${import.meta.env.BASE_URL}poker_training_scenarios_1000_preflop_v2.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((raw) => (raw ? loadScenarioPack(raw) : []))
      .catch((err) => {
        console.error('[handTrainer] échec du chargement du pack de 1000 scénarios :', err)
        return []
      })
  }
  return extraPackPromise
}

const STREET_LABELS = { preflop: 'Préflop', flop: 'Flop', turn: 'Turn', river: 'River' }
const STREET_ID_ORDER = ['preflop', 'flop', 'turn', 'river']

function facetOptions(values, { order, labelFor } = {}) {
  const list = [...new Set(values.filter(Boolean))]
  list.sort(order ? (a, b) => order.indexOf(a) - order.indexOf(b) : undefined)
  return list.map((id) => ({ id, name: labelFor ? labelFor(id) : id }))
}

const LIMIT_PRESETS = [10, 20, 50]

/**
 * Point d'entrée du mode "Situations complètes" : charge le pack additionnel
 * (async) avant de monter l'écran de filtres, pour que les options de filtre
 * et la sélection "tout" par défaut couvrent d'emblée l'ensemble des
 * scénarios disponibles.
 */
export default function HandTrainerDrill() {
  const [extraScenarios, setExtraScenarios] = useState(null) // null = en cours de chargement

  useEffect(() => {
    let alive = true
    loadExtraScenarios().then((list) => {
      if (alive) setExtraScenarios(list)
    })
    return () => {
      alive = false
    }
  }, [])

  if (extraScenarios === null) {
    return <p className="hint">Chargement des scénarios…</p>
  }

  return <HandTrainerDrillReady scenarios={[...BASE_SCENARIOS, ...extraScenarios]} />
}

function HandTrainerDrillReady({ scenarios: SCENARIOS }) {
  const [phase, setPhase] = useState('setup') // 'setup' | 'playing' | 'hand-debrief' | 'session-summary'

  const FACETS_BY_ID = useMemo(() => new Map(SCENARIOS.map((s) => [s.id, scenarioFacets(s)])), [SCENARIOS])
  const PLAYERS_OPTIONS = useMemo(
    () =>
      facetOptions(
        SCENARIOS.map((s) => FACETS_BY_ID.get(s.id).players),
        { labelFor: (id) => (id === 'hu' ? 'Heads-Up' : '3-max') },
      ),
    [SCENARIOS, FACETS_BY_ID],
  )
  const POSITION_OPTIONS = useMemo(
    () => facetOptions(SCENARIOS.map((s) => FACETS_BY_ID.get(s.id).position)),
    [SCENARIOS, FACETS_BY_ID],
  )
  const STREET_OPTIONS = useMemo(
    () =>
      facetOptions(
        SCENARIOS.map((s) => FACETS_BY_ID.get(s.id).street),
        { order: STREET_ID_ORDER, labelFor: (id) => STREET_LABELS[id] || id },
      ),
    [SCENARIOS, FACETS_BY_ID],
  )
  const DIFFICULTY_OPTIONS = useMemo(
    () => facetOptions(SCENARIOS.map((s) => FACETS_BY_ID.get(s.id).difficulty)),
    [SCENARIOS, FACETS_BY_ID],
  )
  const TAG_OPTIONS = useMemo(
    () => facetOptions(SCENARIOS.flatMap((s) => FACETS_BY_ID.get(s.id).tags)),
    [SCENARIOS, FACETS_BY_ID],
  )

  const [selectedPlayers, setSelectedPlayers] = useState(() => new Set(PLAYERS_OPTIONS.map((o) => o.id)))
  const [selectedPositions, setSelectedPositions] = useState(() => new Set(POSITION_OPTIONS.map((o) => o.id)))
  const [selectedStreets, setSelectedStreets] = useState(() => new Set(STREET_OPTIONS.map((o) => o.id)))
  const [selectedDifficulties, setSelectedDifficulties] = useState(() => new Set(DIFFICULTY_OPTIONS.map((o) => o.id)))
  const [selectedTags, setSelectedTags] = useState(() => new Set(TAG_OPTIONS.map((o) => o.id)))
  const [solverVerifiedOnly, setSolverVerifiedOnly] = useState(false)
  const [reviewOnly, setReviewOnly] = useState(false)

  const [limit, setLimit] = useState(null)
  const [customLimitInput, setCustomLimitInput] = useState('')

  const [reviewList, setReviewList] = useState(() => loadReviewList())
  const [attempts, setAttempts] = useState(() => loadAttempts())

  const [queue, setQueue] = useState([])
  const [queueIndex, setQueueIndex] = useState(0)
  const [currentNodeId, setCurrentNodeId] = useState(null)
  const [previousNode, setPreviousNode] = useState(null) // node quitté à la transition précédente (pour animer pot/board)
  const [foldedVillainPositions, setFoldedVillainPositions] = useState(() => new Set())
  const [handDecisions, setHandDecisions] = useState([])
  const [sessionHands, setSessionHands] = useState([]) // [{ scenario, decisions }]
  const [addedToReviewThisHand, setAddedToReviewThisHand] = useState(false)

  const toggleInSet = (setter) => (id) =>
    setter((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const pool = useMemo(
    () =>
      SCENARIOS.filter((s) => {
        const f = FACETS_BY_ID.get(s.id)
        if (f.players && !selectedPlayers.has(f.players)) return false
        if (f.position && !selectedPositions.has(f.position)) return false
        if (f.street && !selectedStreets.has(f.street)) return false
        if (f.difficulty && !selectedDifficulties.has(f.difficulty)) return false
        if (f.tags.length && !f.tags.some((t) => selectedTags.has(t))) return false
        if (solverVerifiedOnly && !f.solverVerified) return false
        if (reviewOnly && !reviewList.has(s.id)) return false
        return true
      }),
    [selectedPlayers, selectedPositions, selectedStreets, selectedDifficulties, selectedTags, solverVerifiedOnly, reviewOnly, reviewList],
  )

  const chooseLimit = (n) => {
    setLimit(n)
    setCustomLimitInput('')
  }
  const commitCustomLimit = () => {
    const n = parseInt(customLimitInput, 10)
    if (Number.isFinite(n) && n > 0) setLimit(n)
    else setCustomLimitInput('')
  }

  const startScenario = (scenario) => {
    setCurrentNodeId(scenario.start_node_id)
    setPreviousNode(null)
    setFoldedVillainPositions(new Set())
    setHandDecisions([])
    setAddedToReviewThisHand(false)
    setPhase('playing')
  }

  const handleStart = () => {
    const q = buildSessionQueue(pool, limit)
    setQueue(q)
    setQueueIndex(0)
    setSessionHands([])
    if (q.length) startScenario(q[0])
  }

  const currentScenario = queue[queueIndex] || null
  const currentNode = currentScenario && currentNodeId ? currentScenario.nodes.find((n) => n.id === currentNodeId) : null

  const finishHand = (scenario, decisions) => {
    const { score, maxScore } = scoreOf(decisions)
    setSessionHands((prev) => [...prev, { scenario, decisions }])
    setAttempts((prev) => recordAttempt(prev, { scenarioId: scenario.id, decisions, totalScore: score, maxScore }))
    setPhase('hand-debrief')
  }

  const onChooseOption = (optionId) => {
    if (!currentScenario || !currentNodeId) return
    const result = applyChoice(currentScenario, currentNodeId, optionId)
    if (!result) return
    const decision = {
      scenarioId: currentScenario.id,
      nodeId: result.node.id,
      optionId: result.option.id,
      street: result.node.street,
      position: result.node.state.hero_position,
      tags: currentScenario.tags || [],
      difficulty: currentScenario.difficulty || null,
      grade: result.option.grade,
      score: result.option.score,
    }
    const nextDecisions = [...handDecisions, decision]
    setHandDecisions(nextDecisions)
    if (result.terminal) {
      finishHand(currentScenario, nextDecisions)
    } else {
      // Le node quitté avait éventuellement lui-même une action adverse
      // (celle à laquelle Hero vient de répondre) : si c'est un fold, le
      // siège correspondant reste grisé pour le reste de la main.
      const leavingVillain = parseActionText(result.node.state.villain_action)
      if (leavingVillain?.verb === 'fold' && leavingVillain.position) {
        setFoldedVillainPositions((prev) => new Set(prev).add(leavingVillain.position))
      }
      setPreviousNode(result.node)
      setCurrentNodeId(result.nextNodeId)
    }
  }

  const replayHand = () => {
    if (currentScenario) startScenario(currentScenario)
  }

  const nextHand = () => {
    if (queueIndex + 1 < queue.length) {
      const next = queueIndex + 1
      setQueueIndex(next)
      startScenario(queue[next])
    } else {
      setPhase('session-summary')
    }
  }

  const addCurrentToReview = () => {
    if (!currentScenario) return
    setReviewList((prev) => {
      const next = new Set(prev)
      next.add(currentScenario.id)
      saveReviewList(next)
      return next
    })
    setAddedToReviewThisHand(true)
  }

  const restartSameFilters = () => {
    const q = buildSessionQueue(pool, limit)
    setQueue(q)
    setQueueIndex(0)
    setSessionHands([])
    if (q.length) startScenario(q[0])
    else setPhase('setup')
  }

  const backToSetup = () => setPhase('setup')

  if (!SCENARIOS.length) {
    return <p className="hint">Aucun scénario exploitable dans le pack d'entraînement.</p>
  }

  if (phase === 'setup') {
    return (
      <div className="training train-setup ht-setup">
        <p className="hint">
          Jouez une main décision par décision (préflop → flop → turn → river). Aucun feedback pendant la main : le
          débrief complet arrive à la fin de chaque main.
        </p>

        <div className="ht-filters">
          <FilterChips label="Format" options={PLAYERS_OPTIONS} selected={selectedPlayers} onToggle={toggleInSet(setSelectedPlayers)} />
          <FilterChips
            label="Position"
            options={POSITION_OPTIONS}
            selected={selectedPositions}
            onToggle={toggleInSet(setSelectedPositions)}
          />
          <FilterChips label="Street de départ" options={STREET_OPTIONS} selected={selectedStreets} onToggle={toggleInSet(setSelectedStreets)} />
          <FilterChips
            label="Difficulté"
            options={DIFFICULTY_OPTIONS}
            selected={selectedDifficulties}
            onToggle={toggleInSet(setSelectedDifficulties)}
          />
          <FilterChips label="Tags" options={TAG_OPTIONS} selected={selectedTags} onToggle={toggleInSet(setSelectedTags)} />

          <div className="filter-group">
            <span className="filter-group-label">Options</span>
            <div className="filter-chips">
              <button
                type="button"
                className={'filter-chip' + (solverVerifiedOnly ? ' active' : '')}
                onClick={() => setSolverVerifiedOnly((v) => !v)}
              >
                Validées par solver uniquement
              </button>
              <button
                type="button"
                className={'filter-chip' + (reviewOnly ? ' active' : '')}
                onClick={() => setReviewOnly((v) => !v)}
                disabled={reviewList.size === 0}
              >
                Mains à revoir uniquement ({reviewList.size})
              </button>
            </div>
          </div>
        </div>

        <div className="train-limit">
          <span className="train-limit-label">Nombre de mains :</span>
          <div className="limit-chips">
            <button className={'chip' + (limit === null ? ' active' : '')} onClick={() => chooseLimit(null)}>
              Toutes ({pool.length})
            </button>
            {LIMIT_PRESETS.map((n) => (
              <button key={n} className={'chip' + (limit === n ? ' active' : '')} onClick={() => chooseLimit(n)}>
                {n}
              </button>
            ))}
            <input
              type="number"
              min="1"
              className={'chip-input' + (limit != null && !LIMIT_PRESETS.includes(limit) ? ' active' : '')}
              placeholder="Autre…"
              value={customLimitInput}
              onChange={(e) => setCustomLimitInput(e.target.value)}
              onBlur={commitCustomLimit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  commitCustomLimit()
                  e.target.blur()
                }
              }}
            />
          </div>
        </div>

        <button className="btn btn-primary train-start-btn" disabled={pool.length === 0} onClick={handleStart}>
          Lancer l'entraînement →
        </button>
        {pool.length === 0 && <p className="hint">Aucune main ne correspond à ces filtres.</p>}
      </div>
    )
  }

  if (phase === 'playing') {
    if (!currentScenario || !currentNode) return null
    return (
      <HandTrainerScene
        key={currentNode.id}
        scenario={currentScenario}
        node={currentNode}
        previousNode={previousNode}
        foldedVillainPositions={foldedVillainPositions}
        handNumber={queueIndex + 1}
        totalHands={queue.length}
        onChoose={onChooseOption}
        onAbandon={backToSetup}
      />
    )
  }

  if (phase === 'hand-debrief') {
    const last = sessionHands[sessionHands.length - 1]
    if (!last) return null
    return (
      <HandTrainerDebrief
        scenario={last.scenario}
        decisions={last.decisions}
        isLastHand={queueIndex + 1 >= queue.length}
        addedToReview={addedToReviewThisHand}
        onReplay={replayHand}
        onNext={nextHand}
        onAddToReview={addCurrentToReview}
      />
    )
  }

  // phase === 'session-summary'
  return (
    <HandTrainerSummary
      sessionHands={sessionHands}
      weakestTags={getWeakestTags(attempts)}
      onRestartSameFilters={restartSameFilters}
      onNewSession={backToSetup}
    />
  )
}
