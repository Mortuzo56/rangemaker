import React, { useEffect, useMemo, useState } from 'react'
import RangeGrid from './components/RangeGrid.jsx'
import ActionsPanel from './components/ActionsPanel.jsx'
import CellEditor from './components/CellEditor.jsx'
import MatrixManager from './components/MatrixManager.jsx'
import ConsultView from './components/ConsultView.jsx'
import TrainingView from './components/TrainingView.jsx'
import SpotMetaPanel from './components/SpotMetaPanel.jsx'
import { DEFAULT_ACTIONS } from './constants.js'
import { emptyCells, cellTotal } from './utils/hands.js'
import { loadMatrices, saveMatrices, makeId } from './utils/storage.js'
import { getMeta, migrateMeta } from './utils/meta.js'

const DEFAULT_META = { position: null, players: null, stack: null }

export default function App() {
  // --- État de la matrice en cours d'édition ---
  const [actions, setActions] = useState(DEFAULT_ACTIONS)
  const [cells, setCells] = useState(() => emptyCells())
  const [activeActionId, setActiveActionId] = useState(DEFAULT_ACTIONS[0].id)
  const [paintPercent, setPaintPercent] = useState(100)
  const [meta, setMeta] = useState(DEFAULT_META)

  // --- Matrices enregistrées + suivi de celle actuellement chargée ---
  const [matrices, setMatrices] = useState(() => loadMatrices())
  const [currentId, setCurrentId] = useState(null)
  const [currentName, setCurrentName] = useState('')

  // --- Case ouverte dans l'éditeur fin (null = fermé) ---
  const [openCellName, setOpenCellName] = useState(null)

  // --- Onglet actif : 'edit' (éditeur) ou 'view' (consultation) ---
  const [view, setView] = useState('edit')

  // --- Thème clair / sombre (persisté) ---
  const [theme, setTheme] = useState(() => localStorage.getItem('rangemaker.theme') || 'light')

  // Applique le thème sur <html> et le mémorise.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('rangemaker.theme', theme)
  }, [theme])

  // Persistance automatique de la liste des matrices.
  useEffect(() => {
    saveMatrices(matrices)
  }, [matrices])

  // Pré-remplissage / mise à jour du jeu de ranges fourni avec l'appli
  // (public/seed-matrices.json). On mémorise (par nom) les ranges déjà
  // proposées : à chaque lancement, seules celles qu'on n'a encore jamais
  // ajoutées sont injectées. Une range du seed volontairement supprimée par
  // l'utilisateur ne revient donc pas toute seule, mais une toute nouvelle
  // range ajoutée au seed plus tard (ex. mise à jour de l'appli) atteint bien
  // les utilisateurs qui avaient déjà des ranges enregistrées.
  useEffect(() => {
    const SEEDED_NAMES_KEY = 'rangemaker.seededNames'
    fetch(`${import.meta.env.BASE_URL}seed-matrices.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((list) => {
        if (!Array.isArray(list) || !list.length) return
        const seededNames = new Set(JSON.parse(localStorage.getItem(SEEDED_NAMES_KEY) || '[]'))
        // Migration depuis l'ancien système (un seul indicateur "déjà semé
        // une fois") : sans historique par nom, on considère que tout ce qui
        // n'est pas une range "bb-hu" (introduites avec ce nouveau système) a
        // déjà été proposé, pour ne pas ressusciter d'anciennes ranges
        // supprimées volontairement.
        if (!localStorage.getItem(SEEDED_NAMES_KEY) && localStorage.getItem('rangemaker.seeded')) {
          list.forEach((m) => {
            if (m.meta?.position !== 'bb-hu') seededNames.add(m.name)
          })
        }
        const candidates = list.filter((m) => !seededNames.has(m.name))
        if (!candidates.length) return
        setMatrices((prev) => {
          const existingNames = new Set(prev.map((m) => m.name))
          const now = Date.now()
          const toAdd = candidates
            .filter((m) => !existingNames.has(m.name))
            .map((m, i) => ({
              id: makeId(),
              name: m.name,
              actions: m.actions,
              cells: m.cells,
              meta: m.meta,
              createdAt: now + i,
              updatedAt: now + i,
            }))
          return toAdd.length ? [...prev, ...toAdd] : prev
        })
        candidates.forEach((m) => seededNames.add(m.name))
        localStorage.setItem(SEEDED_NAMES_KEY, JSON.stringify([...seededNames]))
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const actionsById = useMemo(
    () => Object.fromEntries(actions.map((a) => [a.id, a])),
    [actions],
  )

  // Ordre d'affichage des bandes = position de l'action dans le panneau.
  const actionOrder = useMemo(
    () => Object.fromEntries(actions.map((a, i) => [a.id, i])),
    [actions],
  )

  // --- Peinture d'une case avec l'action active au % du curseur ---
  const paintCell = (name) => {
    if (!activeActionId) return
    setCells((prev) => {
      const existing = prev[name] || []
      // Toutes les entrées sauf l'action active.
      const others = existing.filter((e) => e.actionId !== activeActionId)
      let othersTotal = cellTotal(others)
      let desired = paintPercent

      // On borne à 100 % : si besoin, on réduit proportionnellement les autres actions.
      if (desired + othersTotal > 100) {
        const room = Math.max(0, 100 - desired)
        const factor = othersTotal > 0 ? room / othersTotal : 0
        others.forEach((e) => {
          e.percent = Math.round(e.percent * factor)
        })
      }

      const next = others.filter((e) => e.percent > 0)
      if (desired > 0) next.push({ actionId: activeActionId, percent: desired })
      return { ...prev, [name]: next }
    })
  }

  const updateCell = (name, entries) => {
    setCells((prev) => ({ ...prev, [name]: entries }))
  }

  const clearCell = (name) => {
    setCells((prev) => ({ ...prev, [name]: [] }))
  }

  const resetAll = () => {
    if (confirm('Vider toutes les cases de la matrice courante ?')) {
      setCells(emptyCells())
    }
  }

  // --- Enregistrement / chargement ---
  const snapshot = () => ({
    actions: JSON.parse(JSON.stringify(actions)),
    cells: JSON.parse(JSON.stringify(cells)),
    meta: JSON.parse(JSON.stringify(meta)),
  })

  const saveNew = (name) => {
    const now = Date.now()
    const m = { id: makeId(), name, ...snapshot(), createdAt: now, updatedAt: now }
    setMatrices((prev) => [...prev, m])
    setCurrentId(m.id)
    setCurrentName(name)
  }

  const saveOver = () => {
    if (!currentId) {
      alert('Aucune matrice chargée. Utilisez « Enregistrer sous… ».')
      return
    }
    setMatrices((prev) =>
      prev.map((m) =>
        m.id === currentId ? { ...m, ...snapshot(), updatedAt: Date.now() } : m,
      ),
    )
  }

  const loadMatrix = (id) => {
    const m = matrices.find((x) => x.id === id)
    if (!m) return
    setActions(JSON.parse(JSON.stringify(m.actions)))
    setCells(JSON.parse(JSON.stringify(m.cells)))
    setActiveActionId(m.actions[0]?.id || null)
    setCurrentId(m.id)
    setCurrentName(m.name)
    setMeta(getMeta(m))
  }

  const renameMatrix = (id, name) => {
    setMatrices((prev) => prev.map((m) => (m.id === id ? { ...m, name } : m)))
    if (id === currentId) setCurrentName(name)
  }

  const duplicateMatrix = (id) => {
    const m = matrices.find((x) => x.id === id)
    if (!m) return
    const now = Date.now()
    const copy = {
      ...JSON.parse(JSON.stringify(m)),
      id: makeId(),
      name: m.name + ' (copie)',
      createdAt: now,
      updatedAt: now,
    }
    setMatrices((prev) => [...prev, copy])
  }

  const deleteMatrix = (id) => {
    const m = matrices.find((x) => x.id === id)
    if (!m) return
    if (!confirm(`Supprimer « ${m.name} » ?`)) return
    setMatrices((prev) => prev.filter((x) => x.id !== id))
    if (id === currentId) {
      setCurrentId(null)
      setCurrentName('')
    }
  }

  // Normalise un objet importé en matrice valide (ou null si invalide).
  const toMatrix = (data) => {
    if (!data || !Array.isArray(data.actions) || typeof data.cells !== 'object') return null
    const now = Date.now()
    return {
      id: makeId(),
      name: data.name || 'Import',
      actions: data.actions,
      cells: data.cells,
      ...(data.meta ? { meta: migrateMeta(data.meta) } : {}),
      createdAt: now,
      updatedAt: now,
    }
  }

  const importMatrix = (data) => {
    // Le JSON peut contenir une seule matrice ou un tableau de matrices.
    const list = Array.isArray(data) ? data : [data]
    const imported = list.map(toMatrix).filter(Boolean)
    if (!imported.length) {
      alert('JSON invalide : aucune matrice exploitable.')
      return
    }
    setMatrices((prev) => [...prev, ...imported])
    // On charge la première matrice importée dans l'éditeur.
    const first = imported[0]
    setActions(JSON.parse(JSON.stringify(first.actions)))
    setCells(JSON.parse(JSON.stringify(first.cells)))
    setActiveActionId(first.actions[0]?.id || null)
    setCurrentId(first.id)
    setCurrentName(first.name)
    setMeta(getMeta(first))
    if (imported.length > 1) {
      alert(`${imported.length} matrices importées.`)
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>♠ RangeMaker</h1>
        <span className="subtitle">
          Matrices de ranges poker {currentName ? `— chargée : ${currentName}` : '(non enregistrée)'}
        </span>
        <button
          className="btn theme-toggle"
          onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          title="Basculer le thème clair / sombre"
        >
          {theme === 'dark' ? '☀ Clair' : '🌙 Sombre'}
        </button>
      </header>

      {/* Onglets : Éditeur / Consultation */}
      <nav className="tabs">
        <button className={'tab' + (view === 'edit' ? ' active' : '')} onClick={() => setView('edit')}>
          Éditeur
        </button>
        <button className={'tab' + (view === 'view' ? ' active' : '')} onClick={() => setView('view')}>
          Consultation
        </button>
        <button className={'tab' + (view === 'train' ? ' active' : '')} onClick={() => setView('train')}>
          Entraînement
        </button>
      </nav>

      {view === 'view' ? (
        <ConsultView matrices={matrices} />
      ) : view === 'train' ? (
        <TrainingView matrices={matrices} />
      ) : (
        <div className="layout">
        <main className="grid-col">
          <div className="grid-toolbar">
            <button className="btn" onClick={resetAll}>
              Tout réinitialiser
            </button>
          </div>
          <RangeGrid
            cells={cells}
            actionsById={actionsById}
            actionOrder={actionOrder}
            onPaintCell={paintCell}
            onOpenCell={setOpenCellName}
          />
        </main>

        <aside className="side-col">
          <SpotMetaPanel meta={meta} setMeta={setMeta} />
          <ActionsPanel
            actions={actions}
            setActions={setActions}
            activeActionId={activeActionId}
            setActiveActionId={setActiveActionId}
            paintPercent={paintPercent}
            setPaintPercent={setPaintPercent}
          />
          <MatrixManager
            matrices={matrices}
            currentName={currentName}
            onSaveNew={saveNew}
            onSaveOver={saveOver}
            onLoad={loadMatrix}
            onRename={renameMatrix}
            onDuplicate={duplicateMatrix}
            onDelete={deleteMatrix}
            onImport={importMatrix}
          />
        </aside>
        </div>
      )}

      {view === 'edit' && openCellName && (
        <CellEditor
          name={openCellName}
          entries={cells[openCellName] || []}
          actions={actions}
          onChange={updateCell}
          onClear={clearCell}
          onClose={() => setOpenCellName(null)}
        />
      )}
    </div>
  )
}
