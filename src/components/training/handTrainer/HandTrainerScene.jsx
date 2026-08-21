import React, { useEffect, useState } from 'react'
import { parseCard, ACTION_TYPE_COLOR, parseActionText, tableSeatPositions } from '../../../utils/handTrainerEngine.js'

const STREET_LABELS = { preflop: 'Préflop', flop: 'Flop', turn: 'Turn', river: 'River' }
const SEAT_CLASS = { top: 'seat-top', topLeft: 'seat-top-left', topRight: 'seat-top-right', bottom: 'seat-bottom' }
const VERB_LABEL = { check: 'Check', call: 'Call', bet: 'Bet', raise: 'Raise', shove: 'Shove', allin: 'All-in' }

const fmt = (n) => (n == null || Number.isNaN(n) ? '—' : String(Math.round(n * 100) / 100))

function CardFace({ card, small }) {
  const c = parseCard(card)
  if (!c) return null
  return (
    <span className={'card' + (c.red ? ' red' : '') + (small ? ' ht-board-card' : '')}>
      <span className="card-rank">{c.rank}</span>
      <span className="card-suit">{c.symbol}</span>
    </span>
  )
}

/**
 * Écran "en jeu" : une seule décision Hero à la fois, sans aucun feedback
 * (pas de vert/rouge, pas de score). N'affiche et ne propose jamais rien
 * d'autre que ce que contient `node` — aucune main codée en dur ici.
 *
 * Table en feutre façon logiciel de poker : l'action adverse qui amène à ce
 * node (`state.villain_action`) est révélée avec ~0,9 s de délai (bulle +
 * jeton qui glisse devant le siège concerné) avant que Hero puisse agir,
 * comme sur un vrai client. Rien n'est deviné : position/montant viennent du
 * texte du pack, jamais inventés si absents.
 */
export default function HandTrainerScene({
  scenario,
  node,
  previousNode,
  foldedVillainPositions,
  handNumber,
  totalHands,
  onChoose,
  onAbandon,
}) {
  const { state } = node
  const boardSlots = Array.from({ length: 5 }, (_, i) => state.board[i] || null)
  const previousBoardLen = previousNode ? previousNode.state.board.length : null
  const previousPot = previousNode ? previousNode.state.pot_bb : null

  const pendingAction = parseActionText(state.villain_action)
  const settledHistory = state.history ? state.history.slice(0, -1) : []

  // anim : 0 = arrivée sur le node (pot/board d'avant, pas de bulle),
  // 1 = action adverse révélée (bulle + jeton + nouvelle carte), 2 = à vous de jouer.
  const [animPhase, setAnimPhase] = useState(pendingAction ? 0 : 2)
  const [locked, setLocked] = useState(false)

  useEffect(() => {
    if (!state.villain_action) return
    const t1 = setTimeout(() => setAnimPhase(1), 900)
    const t2 = setTimeout(() => setAnimPhase(2), 1500)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
    // `state.villain_action` (chaîne primitive) plutôt que `pendingAction` :
    // ce dernier est un objet recréé à chaque rendu, ce qui ferait relancer
    // l'effet (et donc régresser animPhase) à chaque setAnimPhase.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.villain_action])

  const handleChoose = (optionId) => {
    if (locked || animPhase < 2) return
    setLocked(true)
    onChoose(optionId)
  }

  const revealed = animPhase >= 1
  const potValue = revealed || previousPot == null ? state.pot_bb : previousPot
  const visibleBoardCount = revealed || previousBoardLen == null ? boardSlots.length : previousBoardLen

  const foldedSet = new Set(foldedVillainPositions)
  if (revealed && pendingAction?.verb === 'fold' && pendingAction.position) {
    foldedSet.add(pendingAction.position)
  }

  const bubbleFor = (pos) => {
    if (!revealed || pendingAction?.position !== pos || pendingAction.verb === 'fold') return null
    const amountText = pendingAction.amount != null ? ` ${fmt(pendingAction.amount)} BB` : ''
    return (VERB_LABEL[pendingAction.verb] || pendingAction.raw) + amountText
  }
  const showChipFor = (pos) => revealed && pendingAction?.position === pos && pendingAction.movesChips

  const { isHU, villainPositions } = tableSeatPositions(scenario, state.hero_position)
  const seats = isHU
    ? [
        { key: 'top', pos: villainPositions[0] },
        { key: 'bottom', pos: state.hero_position, isHero: true },
      ]
    : [
        { key: 'topLeft', pos: villainPositions[0] },
        { key: 'topRight', pos: villainPositions[1] },
        { key: 'bottom', pos: state.hero_position, isHero: true },
      ]

  return (
    <div className="training ht-scene">
      <div className="train-top">
        <button className="btn-mini" onClick={onAbandon}>
          ← Paramètres
        </button>
        <div className="train-score ht-progress">
          Main {handNumber} / {totalHands} · {scenario.title}
        </div>
      </div>

      <span className="ht-street-label">
        {STREET_LABELS[node.street] || node.street} · Tapis {fmt(state.effective_stack_bb)} BB
      </span>

      <div className={'table' + (isHU ? '' : ' table-3max')}>
        <div className="ht-table-board">
          {boardSlots.map((card, i) =>
            card && i < visibleBoardCount ? (
              <CardFace key={i} card={card} small />
            ) : (
              <span key={i} className="card ht-board-card ht-card-empty" />
            ),
          )}
        </div>

        {seats.map((seat) => {
          if (!seat.pos) return null
          if (seat.isHero) {
            return (
              <div key={seat.key} className={'seat ' + SEAT_CLASS[seat.key]}>
                <div className="player">
                  <div className="hero-cards">
                    {state.hero_hand.map((card, i) => (
                      <CardFace key={i} card={card} />
                    ))}
                  </div>
                  <div className="pinfo">
                    <div className="pname hero-name">
                      {seat.pos}
                      {seat.pos === 'BTN' && (
                        <span className="dealer" title="Bouton">
                          D
                        </span>
                      )}{' '}
                      (vous)
                    </div>
                    <div className="pstack">{fmt(state.effective_stack_bb)} BB</div>
                  </div>
                </div>
              </div>
            )
          }
          const folded = foldedSet.has(seat.pos)
          return (
            <div key={seat.key} className={'seat ' + SEAT_CLASS[seat.key] + (folded ? ' seat-folded' : '')}>
              <div className="player">
                <div className="pcards">
                  <span className="pcard back" />
                  <span className="pcard back" />
                </div>
                <div className="pinfo">
                  <div className="pname">
                    {seat.pos}
                    {seat.pos === 'BTN' && (
                      <span className="dealer" title="Bouton">
                        D
                      </span>
                    )}
                    {folded && <span className="fold-tag">Fold</span>}
                  </div>
                </div>
              </div>
              {showChipFor(seat.pos) && (
                <div className="bet bet-villain ht-chip-anim">
                  <span className="chip-token" /> {fmt(pendingAction.amount)} BB
                </div>
              )}
              {bubbleFor(seat.pos) && <div className="action-bubble ht-bubble-anim">{bubbleFor(seat.pos)}</div>}
            </div>
          )
        })}

        <div className="pot">
          <span className="pot-label">POT</span>
          <span className="pot-value">{fmt(potValue)} BB</span>
        </div>
      </div>

      {settledHistory.length > 0 && (
        <ul className="ht-history">
          {settledHistory.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}

      <div className="ht-prompt">{node.prompt}</div>

      <div className="train-actions">
        {node.options.map((option) => (
          <button
            key={option.id}
            className="train-btn"
            style={{ '--action-color': ACTION_TYPE_COLOR[option.action_type] || 'var(--muted)' }}
            disabled={locked || animPhase < 2}
            onClick={() => handleChoose(option.id)}
          >
            <span className="action-icon" />
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
