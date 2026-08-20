import React, { useCallback, useEffect, useMemo, useState } from 'react'
import RangeGrid from '../RangeGrid.jsx'
import GridShell from './GridShell.jsx'
import ReviewCell from './ReviewCell.jsx'
import RangeMultiSelect from './RangeMultiSelect.jsx'
import { emptyCells } from '../../utils/hands.js'
import { loadHistory, saveHistory, recordResult } from '../../utils/history.js'

const ERASE = '__erase'

function topAction(entries, actionsById) {
  if (!entries || !entries.length) return null
  const id = [...entries].sort((a, b) => b.percent - a.percent)[0].actionId
  return actionsById[id] || null
}

/**
 * Mode "construis la range" : grille vierge, l'utilisateur peint de mémoire
 * chaque main avec l'action de son choix (palette du spot), puis comparaison
 * case par case avec la solution.
 */
export default function BuildDrill({ matrices }) {
  const usable = useMemo(
    () => matrices.filter((m) => Object.values(m.cells).some((c) => (c || []).length > 0)),
    [matrices],
  )
  const [selectedIds, setSelectedIds] = useState(() => new Set(matrices.map((m) => m.id)))
  const [matrixId, setMatrixId] = useState(null)
  const [attempt, setAttempt] = useState(() => emptyCells())
  const [activeTool, setActiveTool] = useState(null)
  const [revealed, setRevealed] = useState(false)
  const [roundScores, setRoundScores] = useState([])
  const [history, setHistory] = useState(() => loadHistory())
  useEffect(() => {
    saveHistory(history)
  }, [history])

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

  const newRound = useCallback(() => {
    const pool = usable.filter((m) => selectedIds.has(m.id))
    if (!pool.length) {
      setMatrixId(null)
      return
    }
    const matrix = pool[Math.floor(Math.random() * pool.length)]
    setMatrixId(matrix.id)
    setAttempt(emptyCells())
    setActiveTool(matrix.actions[0]?.id || null)
    setRevealed(false)
  }, [selectedIds, usable])

  useEffect(() => {
    newRound()
  }, [newRound])

  const matrix = matrixId && matrices.find((m) => m.id === matrixId)
  const actionsById = useMemo(
    () => (matrix ? Object.fromEntries(matrix.actions.map((a) => [a.id, a])) : {}),
    [matrix],
  )
  const actionOrder = useMemo(
    () => (matrix ? Object.fromEntries(matrix.actions.map((a, i) => [a.id, i])) : {}),
    [matrix],
  )

  const paintCell = (hand) => {
    if (revealed || !activeTool) return
    setAttempt((prev) => ({
      ...prev,
      [hand]: activeTool === ERASE ? [] : [{ actionId: activeTool, percent: 100 }],
    }))
  }

  // Calculé en continu (pas seulement après révélation) pour pouvoir être
  // consommé de façon synchrone au clic sur "Comparer", sans dépendre du
  // timing d'un effet.
  const diff = useMemo(() => {
    if (!matrix) return null
    let correct = 0
    let judged = 0
    const perHand = {}
    Object.keys(matrix.cells).forEach((hand) => {
      const solAct = topAction(matrix.cells[hand], actionsById)
      const attAct = topAction(attempt[hand], actionsById)
      if (!solAct && !attAct) {
        perHand[hand] = { status: 'neutral' }
        return
      }
      judged++
      if (solAct && attAct && solAct.id === attAct.id) {
        correct++
        perHand[hand] = { status: 'correct', color: solAct.color }
      } else if (solAct && !attAct) {
        perHand[hand] = { status: 'missed', expectedColor: solAct.color }
      } else if (!solAct && attAct) {
        perHand[hand] = { status: 'extra', color: attAct.color }
      } else {
        perHand[hand] = { status: 'wrong', color: attAct.color, expectedColor: solAct.color }
      }
    })
    return { correct, judged, perHand }
  }, [matrix, attempt, actionsById])

  const handleReveal = () => {
    if (!matrix || !diff) return
    setRevealed(true)
    let h = history
    Object.entries(diff.perHand).forEach(([hand, d]) => {
      if (d.status === 'neutral') return
      h = recordResult(h, matrix.id, hand, d.status === 'correct' ? 'excellent' : 'faux')
    })
    setHistory(h)
    const precision = diff.judged ? Math.round((diff.correct / diff.judged) * 100) : 100
    setRoundScores((r) => [...r, precision])
  }

  if (!usable.length) {
    return (
      <p className="hint">
        Aucune range exploitable pour l'entraînement. Créez ou importez des ranges d'abord.
      </p>
    )
  }

  const avgPrecision = roundScores.length
    ? Math.round(roundScores.reduce((a, b) => a + b, 0) / roundScores.length)
    : null

  return (
    <div className="training training-wide">
      <div className="train-top">
        <RangeMultiSelect
          matrices={usable}
          selectedIds={selectedIds}
          onToggle={toggleRange}
          onSelectAll={selectAllRanges}
          onSelectNone={selectNoneRanges}
        />
        <div className="train-score">
          Manches : <b>{roundScores.length}</b>
          {avgPrecision != null && (
            <>
              &nbsp;·&nbsp;Précision moyenne : <b>{avgPrecision}%</b>
            </>
          )}
        </div>
      </div>

      <p className="hint train-mode-hint">
        Reconstruisez de mémoire la range complète du spot avec la palette d'actions, puis validez.
      </p>

      {!matrix && selectedIds.size === 0 && (
        <p className="hint">Sélectionnez au moins une range dans « Ranges travaillées » ci-dessus.</p>
      )}

      {matrix && (
        <>
          <div className="reversed-head">
            <div className="reversed-spot">{matrix.name}</div>
          </div>

          {!revealed && (
            <div className="build-palette">
              {matrix.actions.map((a) => (
                <button
                  key={a.id}
                  className={'palette-btn' + (activeTool === a.id ? ' active' : '')}
                  style={{ borderColor: a.color }}
                  onClick={() => setActiveTool(a.id)}
                >
                  <span className="train-dot" style={{ background: a.color }} />
                  {a.name}
                </button>
              ))}
              <button
                className={'palette-btn' + (activeTool === ERASE ? ' active' : '')}
                onClick={() => setActiveTool(ERASE)}
              >
                ⌫ Gomme
              </button>
            </div>
          )}

          {!revealed ? (
            <RangeGrid
              cells={attempt}
              actionsById={actionsById}
              actionOrder={actionOrder}
              onPaintCell={paintCell}
              onOpenCell={() => {}}
            />
          ) : (
            <GridShell
              className="reversed-grid"
              renderCell={(name, row, col) => {
                const d = diff.perHand[name] || { status: 'neutral' }
                return <ReviewCell row={row} col={col} name={name} status={d.status} color={d.color} expectedColor={d.expectedColor} />
              }}
            />
          )}

          <div className="train-play">
            {!revealed ? (
              <button className="btn btn-primary" onClick={handleReveal}>
                Comparer avec la solution
              </button>
            ) : (
              <div className="train-result">
                <div className="result-banner res-excellent">
                  {diff.judged ? Math.round((diff.correct / diff.judged) * 100) : 100}% correct
                </div>
                <div className="train-breakdown">
                  <span className="bd-item"><span className="legend-icon review-icon-correct">✓</span> action correcte</span>
                  <span className="bd-item"><span className="legend-icon review-icon-wrong">✕</span> mauvaise action</span>
                  <span className="bd-item"><span className="legend-icon review-icon-missed">?</span> oubliée</span>
                </div>
                <button className="btn btn-primary" onClick={newRound}>
                  Manche suivante →
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
