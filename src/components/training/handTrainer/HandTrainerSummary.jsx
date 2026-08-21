import React from 'react'
import { scoreOf, groupScore } from '../../../utils/handTrainerEngine.js'

const STREET_LABELS = { preflop: 'Préflop', flop: 'Flop', turn: 'Turn', river: 'River' }

function GroupTable({ title, groups, labelFor }) {
  const entries = Object.entries(groups)
  if (!entries.length) return null
  return (
    <div className="ht-summary-group">
      <h3>{title}</h3>
      {entries.map(([key, g]) => (
        <div key={key} className="ht-summary-row">
          <span>{labelFor ? labelFor(key) : key}</span>
          <span>
            {g.score}/{g.maxScore} ({g.maxScore ? Math.round((g.score / g.maxScore) * 100) : 0}%)
          </span>
        </div>
      ))}
    </div>
  )
}

/** Résumé de fin de session : score global + répartition par street/position/tag, persisté à part de ce résumé. */
export default function HandTrainerSummary({ sessionHands, weakestTags, onRestartSameFilters, onNewSession }) {
  const allDecisions = sessionHands.flatMap((h) => h.decisions)
  const { score, maxScore, percentage } = scoreOf(allDecisions)
  const byStreet = groupScore(allDecisions, (d) => d.street)
  const byPosition = groupScore(allDecisions, (d) => d.position)
  const byTag = groupScore(allDecisions, (d) => d.tags)

  return (
    <div className="training ht-summary">
      <h2>Session terminée</h2>
      <div className="session-end-title">
        {sessionHands.length} main{sessionHands.length > 1 ? 's' : ''} jouée{sessionHands.length > 1 ? 's' : ''} — Score
        global : {score} / {maxScore} ({percentage}%)
      </div>

      <div className="ht-summary-groups">
        <GroupTable title="Par street" groups={byStreet} labelFor={(k) => STREET_LABELS[k] || k} />
        <GroupTable title="Par position" groups={byPosition} />
        <GroupTable title="Par tag" groups={byTag} />
      </div>

      {weakestTags.length > 0 && (
        <div className="ht-weakest-tags">
          Tags à retravailler en priorité : {weakestTags.map((t) => `${t.tag} (${t.percentage}%)`).join(', ')}
        </div>
      )}

      <div className="session-end-actions">
        <button className="btn btn-primary" onClick={onRestartSameFilters}>
          Rejouer (mêmes paramètres)
        </button>
        <button className="btn" onClick={onNewSession}>
          Nouvel entraînement
        </button>
      </div>
    </div>
  )
}
