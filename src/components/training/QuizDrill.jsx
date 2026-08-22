import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getMeta, isReactionPosition } from '../../utils/meta.js'
import { computeBorderHands } from '../../utils/borderHands.js'
import { loadHistory, saveHistory, recordResult, pickDueHand } from '../../utils/history.js'
import RangeMultiSelect from './RangeMultiSelect.jsx'
import RangeRevealGrid from './RangeRevealGrid.jsx'

// --- Helpers -------------------------------------------------------------

// Type d'action de la SB déduit du nom de la range (ranges "réaction" uniquement).
function villainActionType(name) {
  if (/shove|all[\s-]?in|tapis/i.test(name)) return 'shove'
  // \b évite de matcher le "2bb" du tapis effectif (ex. "... — 12bb").
  if (/\b2\s*bb/i.test(name)) return 'raise2'
  return 'call' // "vs Call SB" (limp)
}

// Formatage compact d'un montant de BB (9.5, 9, ...).
const fmt = (n) => (n == null || Number.isNaN(n) ? '?' : String(Math.round(n * 100) / 100))

// --- Table 3-max (BTN/SB/BB) --------------------------------------------
// Ordre de sièges (sens horaire) et blindes associées. Utilisé pour placer
// les 2 adversaires autour du héros et calculer les tapis restants.
const ORDER_3MAX = ['btn', 'sb', 'bb']
const POS_LABEL_3MAX = { btn: 'BTN', sb: 'SB', bb: 'BB' }
const BLIND_3MAX = { btn: 0, sb: 0.5, bb: 1 }

// Suits pour l'affichage des cartes.
const SUIT = { s: '♠', h: '♥', d: '♦', c: '♣' }
const RED = { h: true, d: true }

// 2 cartes (rang + suit) à afficher pour une main.
function handCards(hand) {
  const kind = hand.length === 2 ? 'pair' : hand.endsWith('s') ? 'suited' : 'offsuit'
  const r1 = hand[0]
  const r2 = hand[1]
  if (kind === 'pair') return [{ r: r1, s: 's' }, { r: r1, s: 'h' }]
  if (kind === 'suited') return [{ r: r1, s: 'h' }, { r: r2, s: 'h' }]
  return [{ r: r1, s: 's' }, { r: r2, s: 'h' }]
}

// Note la réponse : 'excellent' | 'bon' | 'faux'.
function grade(matrix, hand, chosenId) {
  const entries = matrix.cells[hand] || []
  const pctOf = (id) => entries.find((e) => e.actionId === id)?.percent || 0
  const chosen = pctOf(chosenId)
  const allPcts = matrix.actions.map((a) => pctOf(a.id))
  const max = Math.max(0, ...allPcts)
  if (chosen > 0 && chosen === max) return 'excellent'
  const second = Math.max(0, ...allPcts.filter((p) => p < max))
  if (chosen > 0 && chosen === second) return 'bon'
  return 'faux'
}

const LABELS = {
  excellent: { text: 'Excellent !', cls: 'res-excellent' },
  bon: { text: 'Bon', cls: 'res-bon' },
  faux: { text: 'Faux', cls: 'res-faux' },
}

// Choix rapides pour le nombre de questions ; "Illimité" reste toujours possible.
const LIMIT_PRESETS = [10, 25, 50, 100]
const TIMER_PRESETS = [3, 4, 5]

const MODE_HINTS = {
  speed: 'Répondez avant la fin du temps imparti — objectif : la mémorisation réflexe.',
  border: 'Questions ciblées sur les mains-frontière (décision serrée) de chaque spot.',
  srs: 'Répétition espacée : les mains ratées reviennent plus souvent, les maîtrisées s’espacent.',
}

/**
 * Moteur de quiz sur table de poker HU, partagé par 4 modes d'entraînement :
 *  - 'classic' : question aléatoire (comportement historique)
 *  - 'speed'   : idem + chronomètre configurable, mesure du temps de réponse
 *  - 'border'  : questions limitées aux mains-frontière de chaque spot
 *  - 'srs'     : sélection par répétition espacée (historique inter-spots)
 */
export default function QuizDrill({ matrices, mode = 'classic' }) {
  // Tant que l'entraînement n'est pas lancé, on affiche l'écran de paramétrage
  // (périmètre + nombre de questions + chrono) au lieu de la table de jeu :
  // le score affiché ensuite ne concerne alors que cette session-là.
  const [started, setStarted] = useState(false)
  const [selectedIds, setSelectedIds] = useState(() => new Set(matrices.map((m) => m.id)))
  const [question, setQuestion] = useState(null) // { matrixId, hand }
  const [answered, setAnswered] = useState(null) // { chosenId, result }
  const [showRange, setShowRange] = useState(false) // affiche la range complète après réponse
  const [stats, setStats] = useState({ excellent: 0, bon: 0, faux: 0 })
  // Phases : 0 = blindes postées, 1 = action SB révélée, 2 = à nous de jouer.
  const [phase, setPhase] = useState(0)

  // Longueur de la session : null = illimité, sinon nombre max de questions.
  const [limit, setLimit] = useState(null)
  const [customLimitInput, setCustomLimitInput] = useState('')

  // Chronomètre (mode 'speed' uniquement).
  const [timerDuration, setTimerDuration] = useState(4)
  const [timeLeft, setTimeLeft] = useState(timerDuration)
  const [responseTimes, setResponseTimes] = useState([])
  const phaseStartRef = useRef(null)

  // Historique de performance (persisté), lu via ref pour ne pas faire
  // dépendre nextQuestion() de son contenu (sinon une nouvelle question
  // serait générée à chaque réponse, avant même le clic sur "Suivante").
  const [history, setHistory] = useState(() => loadHistory())
  const historyRef = useRef(history)
  useEffect(() => {
    historyRef.current = history
    saveHistory(history)
  }, [history])

  const recordAndPersist = useCallback((matrixId, hand, result) => {
    setHistory((prev) => recordResult(prev, matrixId, hand, result))
  }, [])

  const borderCache = useRef(new Map()) // matrixId -> Set des mains-frontière

  const usable = useMemo(
    () => matrices.filter((m) => Object.values(m.cells).some((c) => (c || []).length > 0)),
    [matrices],
  )

  // Retire de la sélection les ranges qui auraient disparu (suppression, import différent).
  useEffect(() => {
    const usableIds = new Set(usable.map((m) => m.id))
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => usableIds.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [usable])

  const toggleRange = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  const selectAllRanges = () => setSelectedIds(new Set(usable.map((m) => m.id)))
  const selectNoneRanges = () => setSelectedIds(new Set())

  const nextQuestion = useCallback(() => {
    setShowRange(false)
    const pool = usable.filter((m) => selectedIds.has(m.id))
    if (!pool.length) {
      setQuestion(null)
      return
    }

    if (mode === 'srs') {
      const candidates = []
      pool.forEach((m) => {
        Object.keys(m.cells).forEach((hand) => {
          if ((m.cells[hand] || []).length) candidates.push({ matrixId: m.id, hand })
        })
      })
      const picked = pickDueHand(historyRef.current, candidates)
      if (!picked) {
        setQuestion(null)
        return
      }
      setQuestion({ matrixId: picked.matrixId, hand: picked.hand })
      setAnswered(null)
      return
    }

    if (mode === 'border') {
      let matrix = null
      let borderSet = null
      for (let i = 0; i < 8; i++) {
        const candidate = pool[Math.floor(Math.random() * pool.length)]
        if (!borderCache.current.has(candidate.id)) {
          borderCache.current.set(candidate.id, computeBorderHands(candidate))
        }
        const set = borderCache.current.get(candidate.id)
        if (set.size) {
          matrix = candidate
          borderSet = set
          break
        }
      }
      if (!matrix) matrix = pool[Math.floor(Math.random() * pool.length)]
      const filled = Object.keys(matrix.cells).filter((n) => (matrix.cells[n] || []).length > 0)
      const src = borderSet && borderSet.size ? [...borderSet] : filled
      const hand = src[Math.floor(Math.random() * src.length)]
      setQuestion({ matrixId: matrix.id, hand })
      setAnswered(null)
      return
    }

    // 'classic' et 'speed' : sélection aléatoire (comportement historique).
    const matrix = pool[Math.floor(Math.random() * pool.length)]
    const filled = Object.keys(matrix.cells).filter((n) => (matrix.cells[n] || []).length > 0)
    const mixed = filled.filter((n) => matrix.cells[n].length > 1)
    const src = mixed.length && Math.random() < 0.6 ? mixed : filled
    const hand = src[Math.floor(Math.random() * src.length)]
    setQuestion({ matrixId: matrix.id, hand })
    setAnswered(null)
  }, [selectedIds, usable, mode])

  // Première question + régénération au changement de périmètre.
  useEffect(() => {
    nextQuestion()
  }, [nextQuestion])

  // Remet le score (et le temps de réponse) à zéro et relance une question.
  const resetSession = useCallback(() => {
    setStats({ excellent: 0, bon: 0, faux: 0 })
    setResponseTimes([])
    nextQuestion()
  }, [nextQuestion])

  const chooseLimit = (n) => {
    setLimit(n)
    setCustomLimitInput('')
  }

  const commitCustomLimit = () => {
    const n = parseInt(customLimitInput, 10)
    if (Number.isFinite(n) && n > 0) setLimit(n)
    else setCustomLimitInput('')
  }

  // Lance l'entraînement avec les paramètres choisis : score et question remis à zéro.
  const handleStart = () => {
    resetSession()
    setStarted(true)
  }
  const backToSetup = () => setStarted(false)

  const matrix = question && matrices.find((m) => m.id === question.matrixId)
  const meta = matrix ? getMeta(matrix) : null
  // Range "réaction" (BB vs SB/BTN) : le vilain agit avant nous.
  // Range "open" : c'est nous qui ouvrons (SB/BTN), pas d'action adverse à révéler.
  const isReaction = isReactionPosition(meta?.position)

  // Révélation progressive à chaque nouvelle question.
  useEffect(() => {
    if (!question) return
    setPhase(0)
    if (isReaction) {
      const t1 = setTimeout(() => setPhase(1), 1000) // action SB
      const t2 = setTimeout(() => setPhase(2), 1600) // notre tour
      return () => {
        clearTimeout(t1)
        clearTimeout(t2)
      }
    }
    // Range d'open : rien à révéler, on passe directement à notre tour.
    const t = setTimeout(() => setPhase(2), 700)
    return () => clearTimeout(t)
  }, [question, isReaction])

  const onAnswer = (actionId) => {
    if (answered || phase < 2 || !matrix) return
    const result = grade(matrix, question.hand, actionId)
    setAnswered({ chosenId: actionId, result })
    setStats((s) => ({ ...s, [result]: s[result] + 1 }))
    recordAndPersist(matrix.id, question.hand, result)
    if (mode === 'speed' && actionId != null && phaseStartRef.current != null) {
      setResponseTimes((rt) => [...rt, Date.now() - phaseStartRef.current])
    }
  }

  // Chronomètre du mode 'speed' : démarre dès qu'on peut répondre, s'arrête à la réponse.
  useEffect(() => {
    if (mode !== 'speed' || phase < 2 || answered) return
    phaseStartRef.current = Date.now()
    setTimeLeft(timerDuration)
    const interval = setInterval(() => {
      setTimeLeft((t) => Math.max(0, +(t - 0.1).toFixed(1)))
    }, 100)
    return () => clearInterval(interval)
  }, [mode, phase, question, timerDuration, answered])

  // Temps écoulé sans réponse -> comptée comme fausse, sans temps de réponse.
  useEffect(() => {
    if (mode !== 'speed' || phase < 2 || answered) return
    if (timeLeft <= 0) onAnswer(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft])

  if (!usable.length) {
    return (
      <p className="hint">
        Aucune range exploitable pour l'entraînement. Créez ou importez des ranges d'abord.
      </p>
    )
  }

  if (!started) {
    return (
      <div className="training train-setup">
        {MODE_HINTS[mode] && <p className="hint train-mode-hint">{MODE_HINTS[mode]}</p>}

        <RangeMultiSelect
          matrices={usable}
          selectedIds={selectedIds}
          onToggle={toggleRange}
          onSelectAll={selectAllRanges}
          onSelectNone={selectNoneRanges}
        />

        <div className="train-limit">
          <span className="train-limit-label">Nombre de questions :</span>
          <div className="limit-chips">
            <button className={'chip' + (limit === null ? ' active' : '')} onClick={() => chooseLimit(null)}>
              Illimité
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

        {mode === 'speed' && (
          <div className="train-limit">
            <span className="train-limit-label">Temps par question :</span>
            <div className="limit-chips">
              {TIMER_PRESETS.map((n) => (
                <button
                  key={n}
                  className={'chip' + (timerDuration === n ? ' active' : '')}
                  onClick={() => setTimerDuration(n)}
                >
                  {n}s
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          className="btn btn-primary train-start-btn"
          disabled={selectedIds.size === 0}
          onClick={handleStart}
        >
          Lancer l'entraînement →
        </button>
        {selectedIds.size === 0 && (
          <p className="hint">Sélectionnez au moins une range dans « Ranges travaillées » ci-dessus.</p>
        )}
      </div>
    )
  }

  // --- Données de la table ---
  const bb = meta?.stack ?? NaN
  const hasStacks = bb != null && !Number.isNaN(bb)
  const vType = matrix && isReaction ? villainActionType(matrix.name) : null
  const actionBet = vType === 'call' ? 1 : vType === 'raise2' ? 2 : hasStacks ? bb : 0
  const actionText =
    vType === 'call' ? 'Call' : vType === 'raise2' ? 'Raise 2 BB' : `Open shove ${fmt(bb)} BB`

  // Réaction : le vilain (SB/BTN) a posté la petite blinde puis agit ; nous (BB) avons déjà notre blinde entière.
  // Open : nous (SB/BTN) avons posté la petite blinde et c'est à nous de parler ; le vilain (BB) attend, blinde entière postée.
  const villainBet = isReaction ? (phase >= 1 ? actionBet : 0.5) : 1
  const villainBehind = hasStacks ? bb - villainBet : null
  const heroBet = isReaction ? 1 : 0.5
  const heroBehind = hasStacks ? bb - heroBet : null
  const pot = villainBet + heroBet

  const villainLabel = isReaction ? 'SB' : 'BB'
  const heroLabel = isReaction ? 'BB (vous)' : `${POS_LABEL_3MAX[meta?.position] || 'SB'} (vous)`

  // Table à 3 sièges (BTN/SB/BB) : pour les ranges d'open (BTN/SB) ET pour les
  // réactions de la BB en 3-max (BB vs SB, BB vs BTN) — dans ce dernier cas
  // l'un des 2 adversaires a déjà foldé avant que l'action nous arrive.
  // Heads-Up (SB Open ou "BB HU") retombe sur la table à 2 sièges historique.
  const heroPos3 = meta?.position
  const is3Max = meta?.players === '3max'
  const REACTION_VILLAIN_3MAX = { 'bb-vs-sb': 'sb', 'bb-vs-btn': 'btn' }
  const villain3MaxPos = REACTION_VILLAIN_3MAX[heroPos3]
  let seats
  let potValue
  if (is3Max && villain3MaxPos) {
    const foldedPos = villain3MaxPos === 'sb' ? 'btn' : 'sb'
    const villainBetNow = phase >= 1 ? actionBet : BLIND_3MAX[villain3MaxPos]
    const villain3MaxBehind = hasStacks ? bb - villainBetNow : null
    const foldedBehind = hasStacks ? bb - BLIND_3MAX[foldedPos] : null
    seats = [
      {
        key: 'topLeft',
        label: POS_LABEL_3MAX[foldedPos],
        stack: foldedBehind,
        bet: BLIND_3MAX[foldedPos],
        isHero: false,
        dealer: foldedPos === 'btn',
        folded: true,
      },
      {
        key: 'topRight',
        label: POS_LABEL_3MAX[villain3MaxPos],
        stack: villain3MaxBehind,
        bet: villainBetNow,
        isHero: false,
        dealer: villain3MaxPos === 'btn',
        actionText: phase >= 1 ? actionText : null,
      },
      {
        key: 'bottom',
        label: 'BB (vous)',
        stack: heroBehind,
        bet: heroBet,
        isHero: true,
        dealer: false,
      },
    ]
    potValue = heroBet + villainBetNow + BLIND_3MAX[foldedPos]
  } else if (is3Max) {
    const heroIdx = ORDER_3MAX.indexOf(heroPos3)
    const leftPos = ORDER_3MAX[(heroIdx + 1) % 3]
    const rightPos = ORDER_3MAX[(heroIdx + 2) % 3]
    const behind = (pos) => (hasStacks ? bb - BLIND_3MAX[pos] : null)
    seats = [
      {
        key: 'topLeft',
        label: POS_LABEL_3MAX[leftPos],
        stack: behind(leftPos),
        bet: BLIND_3MAX[leftPos],
        isHero: false,
        dealer: leftPos === 'btn',
      },
      {
        key: 'topRight',
        label: POS_LABEL_3MAX[rightPos],
        stack: behind(rightPos),
        bet: BLIND_3MAX[rightPos],
        isHero: false,
        dealer: rightPos === 'btn',
      },
      {
        key: 'bottom',
        label: POS_LABEL_3MAX[heroPos3] + ' (vous)',
        stack: behind(heroPos3),
        bet: BLIND_3MAX[heroPos3],
        isHero: true,
        dealer: heroPos3 === 'btn',
      },
    ]
    potValue = 0.5 + 1
  } else {
    seats = [
      {
        key: 'top',
        label: villainLabel,
        stack: villainBehind,
        bet: villainBet,
        isHero: false,
        dealer: isReaction,
        actionText: isReaction && phase >= 1 ? actionText : null,
      },
      {
        key: 'bottom',
        label: heroLabel,
        stack: heroBehind,
        bet: heroBet,
        isHero: true,
        dealer: !isReaction,
      },
    ]
    potValue = pot
  }
  const SEAT_CLASS = { top: 'seat-top', topLeft: 'seat-top-left', topRight: 'seat-top-right', bottom: 'seat-bottom' }

  const cards = question ? handCards(question.hand) : []
  const breakdown =
    matrix && question
      ? [...(matrix.cells[question.hand] || [])]
          .map((e) => ({ ...e, act: matrix.actions.find((a) => a.id === e.actionId) }))
          .filter((e) => e.act)
          .sort((a, b) => b.percent - a.percent)
      : []
  const total = stats.excellent + stats.bon + stats.faux
  const sessionDone = limit != null && total >= limit
  const questionNumber = limit != null ? Math.min(total + (answered ? 0 : 1), limit) : total + (answered ? 0 : 1)
  const avgResponseMs = responseTimes.length
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    : null

  return (
    <div className="training">
      {/* Barre du haut : retour aux paramètres + score de cette session */}
      <div className="train-top">
        <button className="btn-mini" onClick={backToSetup}>
          ← Paramètres
        </button>
        <div className="train-score">
          Score : <b className="res-excellent">{stats.excellent}</b> excellent&nbsp;·&nbsp;
          <b className="res-bon">{stats.bon}</b> bon&nbsp;·&nbsp;
          <b className="res-faux">{stats.faux}</b> faux
          {mode === 'speed' && avgResponseMs != null && (
            <span className="train-avg-time">· ⏱ moy. {(avgResponseMs / 1000).toFixed(2)}s</span>
          )}
        </div>
      </div>

      {limit != null && !sessionDone && <span className="train-progress">Question {questionNumber} / {limit}</span>}

      {matrix && question && (
        <>
          {/* --- Table de poker --- */}
          <div className={'table' + (is3Max ? ' table-3max' : '')}>
            <div className="table-community">
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} className="table-community-slot" />
              ))}
            </div>

            {seats.map((s) => (
              <div key={s.key} className={'seat ' + SEAT_CLASS[s.key] + (s.folded ? ' seat-folded' : '')}>
                {s.isHero ? (
                  <>
                    <div className="bet bet-hero">
                      <span className="chip-token" /> {fmt(s.bet)} BB
                    </div>
                    <div className="player">
                      <div className="hero-cards">
                        {cards.map((c, i) => (
                          <span key={i} className={'card' + (RED[c.s] ? ' red' : '')}>
                            <span className="card-rank">{c.r}</span>
                            <span className="card-suit">{SUIT[c.s]}</span>
                          </span>
                        ))}
                      </div>
                      <div className="pinfo">
                        <div className="pname hero-name">
                          {s.label}
                          {s.dealer && <span className="dealer" title="Bouton">D</span>} — {question.hand}
                        </div>
                        <div className="pstack">{fmt(s.stack)} BB</div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="player">
                      <div className="pcards">
                        <span className="pcard back" />
                        <span className="pcard back" />
                      </div>
                      <div className="pinfo">
                        <div className="pname">
                          {s.label}
                          {s.dealer && <span className="dealer" title="Bouton">D</span>}
                          {s.folded && <span className="fold-tag">Fold</span>}
                        </div>
                        <div className="pstack">{fmt(s.stack)} BB</div>
                      </div>
                    </div>
                    {!s.folded && (
                      <div className="bet bet-villain">
                        <span className="chip-token" /> {fmt(s.bet)} BB
                      </div>
                    )}
                    {s.actionText && <div className="action-bubble">{s.actionText}</div>}
                  </>
                )}
              </div>
            ))}

            {/* Pot au centre */}
            <div className="pot">
              <span className="pot-label">POT</span>
              <span className="pot-value">{fmt(potValue)} BB</span>
            </div>

            {mode === 'speed' && phase >= 2 && !answered && (
              <div className="table-timer">
                <div
                  className={'table-timer-bar' + (timeLeft <= 1 ? ' table-timer-low' : '')}
                  style={{ width: `${(timeLeft / timerDuration) * 100}%` }}
                />
                <span className="table-timer-label">{timeLeft.toFixed(1)}s</span>
              </div>
            )}
          </div>

          {/* --- Zone d'action --- */}
          <div className="train-play">
            {phase < 2 && !answered && <div className="train-wait">…</div>}
            {phase >= 2 && !answered && <div className="train-question">À vous de jouer :</div>}

            {phase >= 2 && (
              <div className="train-actions">
                {matrix.actions.map((a) => {
                  const isChosen = answered && answered.chosenId === a.id
                  return (
                    <button
                      key={a.id}
                      className={'train-btn' + (isChosen ? ' chosen' : '')}
                      style={{ '--action-color': a.color }}
                      disabled={!!answered}
                      onClick={() => onAnswer(a.id)}
                    >
                      <span className="action-icon" />
                      {a.name}
                    </button>
                  )
                })}
              </div>
            )}

            {answered && (
              <div className="train-result">
                {mode === 'speed' && answered.chosenId === null && (
                  <div className="train-timeout-note">⏱ Temps écoulé — aucune réponse</div>
                )}
                <div className={'result-banner ' + LABELS[answered.result].cls}>
                  {LABELS[answered.result].text}
                </div>
                <div className="train-breakdown">
                  {breakdown.map((e, i) => (
                    <span key={e.actionId} className="bd-item">
                      <span className="train-dot" style={{ background: e.act.color }} />
                      {e.act.name} <b>{e.percent}%</b>
                      {i === 0 && <span className="bd-tag">meilleure</span>}
                    </span>
                  ))}
                </div>

                {!showRange && (
                  <button className="btn-mini train-reveal-btn" onClick={() => setShowRange(true)}>
                    Voir la range complète
                  </button>
                )}
                {showRange && matrix && (
                  <RangeRevealGrid matrix={matrix} highlightHand={question.hand} onClose={() => setShowRange(false)} />
                )}

                {sessionDone ? (
                  <div className="train-session-end">
                    <div className="session-end-title">
                      Session terminée : {total} question{total > 1 ? 's' : ''} —{' '}
                      <b className="res-excellent">{stats.excellent}</b> excellent&nbsp;·&nbsp;
                      <b className="res-bon">{stats.bon}</b> bon&nbsp;·&nbsp;
                      <b className="res-faux">{stats.faux}</b> faux
                      {mode === 'speed' && avgResponseMs != null && (
                        <>
                          {' '}
                          · ⏱ moy. <b>{(avgResponseMs / 1000).toFixed(2)}s</b>
                        </>
                      )}
                    </div>
                    <div className="session-end-actions">
                      <button className="btn btn-primary" onClick={resetSession}>
                        Rejouer (mêmes paramètres)
                      </button>
                      <button className="btn" onClick={backToSetup}>
                        Nouvel entraînement
                      </button>
                    </div>
                  </div>
                ) : (
                  <button className="btn btn-primary" onClick={nextQuestion}>
                    Question suivante →
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
