import React from 'react'
import { makeId } from '../utils/storage.js'

/**
 * Panneau de gestion des actions :
 *  - liste des actions (nom éditable + color picker + suppression)
 *  - sélection de l'action active (une seule à la fois)
 *  - ajout d'une action
 *  - curseur global du % de peinture (mode "peinture")
 */
export default function ActionsPanel({
  actions,
  setActions,
  activeActionId,
  setActiveActionId,
  paintPercent,
  setPaintPercent,
}) {
  const addAction = () => {
    const colors = ['#e53935', '#43a047', '#1e88e5', '#fb8c00', '#8e24aa', '#00acc1', '#c0ca33']
    const color = colors[actions.length % colors.length]
    const newAction = { id: makeId(), name: 'Action ' + (actions.length + 1), color }
    setActions([...actions, newAction])
    setActiveActionId(newAction.id)
  }

  const updateAction = (id, patch) => {
    setActions(actions.map((a) => (a.id === id ? { ...a, ...patch } : a)))
  }

  const removeAction = (id) => {
    const next = actions.filter((a) => a.id !== id)
    setActions(next)
    if (activeActionId === id && next.length) setActiveActionId(next[0].id)
  }

  // Déplace une action dans la liste (change l'ordre des bandes gauche->droite).
  const moveAction = (index, dir) => {
    const target = index + dir
    if (target < 0 || target >= actions.length) return
    const next = [...actions]
    ;[next[index], next[target]] = [next[target], next[index]]
    setActions(next)
  }

  return (
    <div className="panel">
      <h2>Actions</h2>

      <p className="hint">Ordre de la liste = ordre des bandes dans la case (gauche → droite).</p>

      <ul className="action-list">
        {actions.map((a, index) => (
          <li
            key={a.id}
            className={'action-item' + (a.id === activeActionId ? ' active' : '')}
            onClick={() => setActiveActionId(a.id)}
          >
            <span className="action-move">
              <button
                className="btn-move"
                title="Monter (vers la gauche)"
                disabled={index === 0}
                onClick={(e) => {
                  e.stopPropagation()
                  moveAction(index, -1)
                }}
              >
                ▲
              </button>
              <button
                className="btn-move"
                title="Descendre (vers la droite)"
                disabled={index === actions.length - 1}
                onClick={(e) => {
                  e.stopPropagation()
                  moveAction(index, 1)
                }}
              >
                ▼
              </button>
            </span>
            <input
              type="radio"
              checked={a.id === activeActionId}
              onChange={() => setActiveActionId(a.id)}
              onClick={(e) => e.stopPropagation()}
            />
            <input
              type="color"
              value={a.color}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => updateAction(a.id, { color: e.target.value })}
            />
            <input
              className="action-name"
              type="text"
              value={a.name}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => updateAction(a.id, { name: e.target.value })}
            />
            <button
              className="btn-icon"
              title="Supprimer l'action"
              onClick={(e) => {
                e.stopPropagation()
                removeAction(a.id)
              }}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      <button className="btn" onClick={addAction}>
        + Ajouter une action
      </button>

      <div className="paint-percent">
        <label>
          % appliqué au clic (mode peinture) : <b>{paintPercent}%</b>
        </label>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={paintPercent}
          onChange={(e) => setPaintPercent(Number(e.target.value))}
        />
        <div className="hint">
          Astuce : 100 % = case pleine. Clic droit / double-clic sur une case pour l'édition fine.
        </div>
      </div>
    </div>
  )
}
