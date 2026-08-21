import React, { useState } from 'react'
import QuizDrill from './training/QuizDrill.jsx'
import ReversedDrill from './training/ReversedDrill.jsx'
import BuildDrill from './training/BuildDrill.jsx'
import HeatmapPanel from './training/HeatmapPanel.jsx'

const MODES = [
  { id: 'classic', name: 'Classique', desc: 'Question aléatoire, sans contrainte de temps.' },
  { id: 'speed', name: 'Speed Drill', desc: 'Chronomètre configurable (3-5s) : mémorisation réflexe.' },
  { id: 'border', name: 'Border Trainer', desc: "Cible les mains-frontière, les plus difficiles à retenir." },
  { id: 'srs', name: 'Répétition espacée', desc: 'Les mains ratées reviennent plus souvent (type Anki).' },
  { id: 'reversed', name: 'Mode inversé', desc: 'Une action est annoncée : retrouvez toutes les mains concernées.' },
  { id: 'build', name: 'Construis la range', desc: 'Reconstruisez de mémoire la range complète du spot.' },
  { id: 'heatmap', name: 'Heatmap (suivi)', desc: 'Visualisez vos zones faibles par spot.' },
]

/**
 * Onglet "Entraînement" : sélecteur de mode + rendu du mode choisi.
 */
export default function TrainingView({ matrices }) {
  const [mode, setMode] = useState('classic')
  const active = MODES.find((m) => m.id === mode) || MODES[0]

  return (
    <div>
      <div className="mode-picker">
        <label>
          Mode d'entraînement :&nbsp;
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            {MODES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <span className="mode-desc">{active.desc}</span>
      </div>

      {(mode === 'classic' || mode === 'speed' || mode === 'border' || mode === 'srs') && (
        // key={mode} : instance dédiée par variante, pour ne jamais mélanger le
        // score ou les paramètres d'un mode avec un autre.
        <QuizDrill key={mode} matrices={matrices} mode={mode} />
      )}
      {mode === 'reversed' && <ReversedDrill matrices={matrices} />}
      {mode === 'build' && <BuildDrill matrices={matrices} />}
      {mode === 'heatmap' && <HeatmapPanel matrices={matrices} />}
    </div>
  )
}
