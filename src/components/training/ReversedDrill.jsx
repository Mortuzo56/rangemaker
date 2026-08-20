import React, { useCallback, useEffect, useMemo, useState } from 'react'
import GridShell from './GridShell.jsx'
import SelectCell from './SelectCell.jsx'
import ReviewCell from './ReviewCell.jsx'
import RangeMultiSelect from './RangeMultiSelect.jsx'
import { loadHistory, saveHistory, recordResult } from '../../utils/history.js'

function topActionId(entries) {
  if (!entries || !entries.length) return null
  return [...entries].sort((a, b) => b.percent - a.percent)[0].actionId
}

/**
 * Mode inversé : une action cible est annoncée, la grille est vierge.
 * L'utilisateur clique toutes les mains qu'il pense concernées par cette
 * action, puis on compare avec la solution (mains oubliées / en trop).
 */
export default function ReversedDrill({ matrices }) {
  const usable = useMemo(
    () => matrices.filter((m) => Object.values(m.cells).some((c) => (c || []).length > 0)),
    [matrices],
  )
  const [selectedIds, setSelectedIds] = useState(() => new Set(matrices.map((m) => m.id)))
  const [round, setRound] = useState(null) // { matrixId, targetActionId }
  const [picked, setPicked] = useState(() => new Set())
  const [revealed, setRevealed] = useState(false)
  const [roundScores, setRoundScores] = useState([]) // précision (%) par manche

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
      setRound(null)
      return
    }
    const matrix = pool[Math.floor(Math.random() * pool.length)]
    if (!matrix.actions.length) {
      setRound(null)
      return
    }
    const action = matrix.actions[Math.floor(Math.random() * matrix.actions.length)]
    setRound({ matrixId: matrix.id, targetActionId: action.id })
    setPicked(new Set())
    setRevealed(false)
  }, [selectedIds, usable])

  useEffect(() => {
    newRound()
  }, [newRound])

  const matrix = round && matrices.find((m) => m.id === round.matrixId)
  const targetAction = matrix && matrix.actions.find((a) => a.id === round.targetActionId)

  const solutionSet = useMemo(() => {
    const s = new Set()
    if (!matrix || !round) return s
    Object.keys(matrix.cells).forEach((hand) => {
      if (topActionId(matrix.cells[hand]) === round.targetActionId) s.add(hand)
    })
    return s
  }, [matrix, round])

  const toggle = (hand) => {
    if (revealed) return
    setPicked((prev) => {
      const next = new Set(prev)
      next.has(hand) ? next.delete(hand) : next.add(hand)
      return next
    })
  }

  const validate = () => {
    if (!matrix) return
    setRevealed(true)
    let correct = 0
    let missed = 0
    let extra = 0
    let h = history
    solutionSet.forEach((hand) => {
      if (picked.has(hand)) {
        correct++
        h = recordResult(h, matrix.id, hand, 'excellent')
      } else {
        missed++
        h = recordResult(h, matrix.id, hand, 'faux')
      }
    })
    picked.forEach((hand) => {
      if (!solutionSet.has(hand)) {
        extra++
        h = recordResult(h, matrix.id, hand, 'faux')
      }
    })
    setHistory(h)
    const totalJudged = correct + missed + extra
    const precision = totalJudged ? Math.round((correct / totalJudged) * 100) : 100
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
        Cliquez toutes les mains qui font partie de l'action annoncée, puis validez.
      </p>

      {!round && selectedIds.size === 0 && (
        <p className="hint">Sélectionnez au moins une range dans « Ranges travaillées » ci-dessus.</p>
      )}

      {matrix && targetAction && (
        <>
          <div className="reversed-head">
            <div className="reversed-spot">{matrix.name}</div>
            <div className="reversed-target">
              Action à retrouver :&nbsp;
              <span className="reversed-target-chip" style={{ background: targetAction.color }}>
                {targetAction.name}
              </span>
            </div>
          </div>

          {!revealed ? (
            <GridShell
              className="reversed-grid"
              renderCell={(name, row, col) => (
                <SelectCell
                  row={row}
                  col={col}
                  name={name}
                  selected={picked.has(name)}
                  color={targetAction.color}
                  onToggle={toggle}
                />
              )}
            />
          ) : (
            <GridShell
              className="reversed-grid"
              renderCell={(name, row, col) => {
                const inSolution = solutionSet.has(name)
                const isPicked = picked.has(name)
                let status = 'neutral'
                if (inSolution && isPicked) status = 'correct'
                else if (inSolution && !isPicked) status = 'missed'
                else if (!inSolution && isPicked) status = 'extra'
                return (
                  <ReviewCell
                    row={row}
                    col={col}
                    name={name}
                    status={status}
                    color={targetAction.color}
                    expectedColor={targetAction.color}
                  />
                )
              }}
            />
          )}

          <div className="train-play">
            {!revealed ? (
              <button className="btn btn-primary" onClick={validate}>
                Valider
              </button>
            ) : (
              <div className="train-result">
                <div className="train-breakdown">
                  <span className="bd-item"><span className="legend-icon review-icon-correct">✓</span> mains correctement trouvées</span>
                  <span className="bd-item"><span className="legend-icon review-icon-missed">?</span> oubliées</span>
                  <span className="bd-item"><span className="legend-icon review-icon-extra">✕</span> ajoutées à tort</span>
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
