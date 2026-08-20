import React, { useRef, useState } from 'react'
import { exportMatricesToPdf } from '../utils/pdf.js'

/**
 * Gestionnaire des matrices enregistrées :
 *  - enregistrer la matrice courante (nouveau nom)
 *  - liste : charger, renommer, dupliquer, supprimer
 *  - import / export JSON d'une matrice
 *  - sélection multiple (cases à cocher) + génération PDF
 */
export default function MatrixManager({
  matrices,
  currentName,
  onSaveNew,
  onSaveOver,
  onLoad,
  onRename,
  onDuplicate,
  onDelete,
  onImport,
}) {
  const [selected, setSelected] = useState(() => new Set())
  const [perPage, setPerPage] = useState(2)
  const [busy, setBusy] = useState(false)
  const fileInput = useRef(null)

  const toggleSelected = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleSaveNew = () => {
    const name = prompt('Nom de la nouvelle matrice :', currentName || 'Ma range')
    if (name && name.trim()) onSaveNew(name.trim())
  }

  const handleRename = (m) => {
    const name = prompt('Nouveau nom :', m.name)
    if (name && name.trim()) onRename(m.id, name.trim())
  }

  const handleExport = (m) => {
    const blob = new Blob([JSON.stringify(m, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = (m.name || 'range').replace(/[^\w\-]+/g, '_') + '.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result)
        onImport(data)
      } catch {
        alert('Fichier JSON invalide.')
      }
    }
    reader.readAsText(file)
    e.target.value = '' // permet de réimporter le même fichier
  }

  const handleGeneratePdf = async () => {
    const chosen = matrices.filter((m) => selected.has(m.id))
    if (!chosen.length) {
      alert('Sélectionnez au moins une matrice à imprimer.')
      return
    }
    setBusy(true)
    try {
      await exportMatricesToPdf(chosen, perPage)
    } catch (err) {
      console.error(err)
      alert('Erreur pendant la génération du PDF.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="panel">
      <h2>Matrices enregistrées</h2>

      <div className="save-row">
        <button className="btn btn-primary" onClick={handleSaveNew}>
          Enregistrer sous…
        </button>
        <button className="btn" onClick={onSaveOver} title="Écraser la matrice chargée">
          Mettre à jour
        </button>
        <button className="btn" onClick={() => fileInput.current?.click()}>
          Importer JSON
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={handleImportFile}
        />
      </div>

      {matrices.length === 0 && <p className="hint">Aucune matrice enregistrée pour l'instant.</p>}

      <ul className="matrix-list">
        {matrices.map((m) => (
          <li key={m.id} className="matrix-item">
            <input
              type="checkbox"
              checked={selected.has(m.id)}
              onChange={() => toggleSelected(m.id)}
              title="Sélectionner pour le PDF"
            />
            <span className="matrix-name" onClick={() => onLoad(m.id)} title="Charger">
              {m.name}
            </span>
            <span className="matrix-btns">
              <button className="btn-mini" onClick={() => onLoad(m.id)}>
                Charger
              </button>
              <button className="btn-mini" onClick={() => handleRename(m)}>
                Renommer
              </button>
              <button className="btn-mini" onClick={() => onDuplicate(m.id)}>
                Dupliquer
              </button>
              <button className="btn-mini" onClick={() => handleExport(m)}>
                Export
              </button>
              <button className="btn-mini danger" onClick={() => onDelete(m.id)}>
                Suppr.
              </button>
            </span>
          </li>
        ))}
      </ul>

      <div className="pdf-row">
        <label>
          Matrices par page :&nbsp;
          <select value={perPage} onChange={(e) => setPerPage(Number(e.target.value))}>
            <option value={1}>1</option>
            <option value={2}>2</option>
          </select>
        </label>
        <button className="btn btn-primary" onClick={handleGeneratePdf} disabled={busy}>
          {busy ? 'Génération…' : 'Générer le PDF'}
        </button>
      </div>
    </div>
  )
}
