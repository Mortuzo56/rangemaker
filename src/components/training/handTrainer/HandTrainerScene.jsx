import React, { useState } from 'react'
import { parseCard, ACTION_TYPE_COLOR } from '../../../utils/handTrainerEngine.js'

const STREET_LABELS = { preflop: 'Préflop', flop: 'Flop', turn: 'Turn', river: 'River' }

function CardFace({ card }) {
  const c = parseCard(card)
  if (!c) return null
  return (
    <span className={'card' + (c.red ? ' red' : '')}>
      <span className="card-rank">{c.rank}</span>
      <span className="card-suit">{c.symbol}</span>
    </span>
  )
}

/**
 * Écran "en jeu" : une seule décision Hero à la fois, sans aucun feedback
 * (pas de vert/rouge, pas de score). N'affiche et ne propose jamais rien
 * d'autre que ce que contient `node` — aucune main codée en dur ici.
 */
export default function HandTrainerScene({ scenario, node, handNumber, totalHands, onChoose, onAbandon }) {
  const { state } = node
  const boardSlots = Array.from({ length: 5 }, (_, i) => state.board[i] || null)

  // Verrouille les boutons dès le premier choix : le parent remonte ce
  // composant (key={node.id}) à chaque nouveau node, donc `locked` se
  // réinitialise naturellement sans dépendre d'un effet. Évite qu'un double
  // clic (ou un rendu en retard) n'enregistre deux fois la même décision.
  const [locked, setLocked] = useState(false)
  const handleChoose = (optionId) => {
    if (locked) return
    setLocked(true)
    onChoose(optionId)
  }

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

      <div className="ht-info-row">
        <span className="ht-info-chip">{state.hero_position}</span>
        <span className="ht-info-chip">Tapis {state.effective_stack_bb} BB</span>
        <span className="ht-info-chip">Pot {state.pot_bb} BB</span>
        <span className="ht-info-chip">{STREET_LABELS[node.street] || node.street}</span>
      </div>

      <div className="ht-board">
        {boardSlots.map((card, i) =>
          card ? <CardFace key={i} card={card} /> : <span key={i} className="card ht-card-empty" />,
        )}
      </div>

      <div className="ht-hero">
        <div className="hero-cards">
          {state.hero_hand.map((card, i) => (
            <CardFace key={i} card={card} />
          ))}
        </div>
        <span className="ht-hero-label">Votre main</span>
      </div>

      {state.history && state.history.length > 0 && (
        <ul className="ht-history">
          {state.history.map((line, i) => (
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
            disabled={locked}
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
