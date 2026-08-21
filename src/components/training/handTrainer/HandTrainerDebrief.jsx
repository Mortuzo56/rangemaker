import React from 'react'
import { getNode, scoreOf, gradeClass, gradeLabel } from '../../../utils/handTrainerEngine.js'

const STREET_LABELS = { preflop: 'Préflop', flop: 'Flop', turn: 'Turn', river: 'River' }
const GRADE_ICON = { excellent: '✅', bon: '☑️', mauvais: '❌' }

/**
 * Débrief de fin de main : liste chaque décision prise (dans l'ordre), son
 * grade, l'explication, et toutes les alternatives possibles à ce node avec
 * leur propre grade — jamais montré pendant la main elle-même.
 */
export default function HandTrainerDebrief({ scenario, decisions, isLastHand, addedToReview, onReplay, onNext, onAddToReview }) {
  const { score, maxScore, percentage } = scoreOf(decisions)
  const overallGrade = percentage >= 90 ? 'excellent' : percentage >= 60 ? 'bon' : 'mauvais'

  return (
    <div className="training ht-debrief">
      <h2>{scenario.title}</h2>
      <div className={'ht-debrief-score ' + gradeClass(overallGrade)}>
        Score de la main : {score} / {maxScore} ({percentage}%)
      </div>

      <div className="ht-timeline">
        {decisions.map((decision, i) => {
          const node = getNode(scenario, decision.nodeId)
          const chosenOption = node.options.find((o) => o.id === decision.optionId)
          return (
            <div key={i} className="ht-decision-card">
              <div className="ht-decision-head">
                <span className="ht-decision-street">{STREET_LABELS[decision.street] || decision.street}</span>
                <span className={'ht-decision-grade ' + gradeClass(decision.grade)}>
                  {GRADE_ICON[decision.grade] || ''} {gradeLabel(decision.grade)}
                </span>
              </div>
              <div className="ht-decision-choice">
                Ton choix : <b>{chosenOption.label}</b>
              </div>
              <div className="ht-decision-feedback">{chosenOption.feedback}</div>
              <ul className="ht-alt-list">
                {node.options.map((option) => (
                  <li key={option.id} className={'ht-alt-item' + (option.id === decision.optionId ? ' chosen' : '')}>
                    <span className={gradeClass(option.grade)}>{gradeLabel(option.grade)}</span>
                    <span>{option.label}</span>
                    {option.is_optimal && <span className="ht-alt-optimal-tag">optimal</span>}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>

      <div className="ht-debrief-actions">
        <button className="btn" onClick={onReplay}>
          Rejouer cette main
        </button>
        <button className="btn-mini" onClick={onAddToReview} disabled={addedToReview}>
          {addedToReview ? '✓ Ajoutée aux mains à revoir' : 'Ajouter aux mains à revoir'}
        </button>
        <button className="btn btn-primary" onClick={onNext}>
          {isLastHand ? 'Voir le résumé de session →' : 'Main suivante →'}
        </button>
      </div>
    </div>
  )
}
