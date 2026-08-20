import React, { useMemo, useState } from 'react'
import GridShell from './GridShell.jsx'
import HeatCell from './HeatCell.jsx'
import { loadHistory, getStat, errorRate } from '../../utils/history.js'

/**
 * Suivi de performance : grille 13x13 colorée du vert (maîtrisée) au rouge
 * (erreurs fréquentes) selon l'historique de réponses enregistré pour un spot.
 */
export default function HeatmapPanel({ matrices }) {
  const usable = useMemo(
    () => matrices.filter((m) => Object.values(m.cells).some((c) => (c || []).length > 0)),
    [matrices],
  )
  const [matrixId, setMatrixId] = useState(usable[0]?.id || null)
  const [history, setHistory] = useState(() => loadHistory())

  const matrix = usable.find((m) => m.id === matrixId) || usable[0] || null

  const hands = useMemo(() => (matrix ? Object.keys(matrix.cells).filter((n) => (matrix.cells[n] || []).length > 0) : []), [matrix])

  const weakest = useMemo(() => {
    if (!matrix) return []
    return hands
      .map((hand) => ({ hand, ...getStat(history, matrix.id, hand), rate: errorRate(history, matrix.id, hand) }))
      .filter((h) => h.seen > 0)
      .sort((a, b) => b.rate - a.rate || b.seen - a.seen)
      .slice(0, 8)
  }, [matrix, hands, history])

  const totalSeen = weakest.length
    ? hands.reduce((sum, hand) => sum + getStat(history, matrix.id, hand).seen, 0)
    : 0

  if (!usable.length) {
    return <p className="hint">Aucune range exploitable. Créez ou importez des ranges d'abord.</p>
  }

  return (
    <div className="training training-wide">
      <div className="train-top">
        <label>
          Spot :&nbsp;
          <select value={matrix?.id || ''} onChange={(e) => setMatrixId(e.target.value)}>
            {usable.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <button className="btn-mini" onClick={() => setHistory(loadHistory())}>
          Rafraîchir
        </button>
      </div>

      <p className="hint train-mode-hint">
        Couleur = taux d'erreur constaté sur cette main pour ce spot (toutes sessions et tous modes confondus). Gris = pas encore pratiquée.
      </p>

      {matrix && (
        <>
          <GridShell
            className="heatmap-grid"
            renderCell={(name, row, col) => {
              const stat = getStat(history, matrix.id, name)
              const rate = errorRate(history, matrix.id, name)
              return <HeatCell row={row} col={col} name={name} rate={rate || 0} seen={stat.seen} />
            }}
          />

          <div className="heat-legend">
            <span className="heat-legend-label">Maîtrisée</span>
            <span className="heat-legend-bar" />
            <span className="heat-legend-label">Erreurs fréquentes</span>
            <span className="heat-legend-swatch heat-legend-unseen" />
            <span className="heat-legend-label">Jamais pratiquée</span>
          </div>

          <div className="heat-summary">
            <div className="heat-summary-title">
              {totalSeen} tentative{totalSeen > 1 ? 's' : ''} enregistrée{totalSeen > 1 ? 's' : ''} sur ce spot.
            </div>
            {weakest.length > 0 && (
              <>
                <div className="heat-summary-subtitle">Mains les plus fragiles :</div>
                <div className="heat-weak-list">
                  {weakest.map((w) => (
                    <span key={w.hand} className="heat-weak-item">
                      {w.hand} <b>{Math.round(w.rate * 100)}%</b>
                      <span className="hint">&nbsp;({w.seen})</span>
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
