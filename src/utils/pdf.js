import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { RANKS } from '../constants.js'
import { handName, handKind, cellTotal } from './hands.js'

// --- Génération d'un PDF imprimable A4 des matrices sélectionnées ----------
//
// Approche : on construit hors écran un noeud DOM stylé pour chaque matrice
// (grille 13x13 + légende), on le capture avec html2canvas pour un rendu
// fidèle des couleurs, puis on place les images dans un jsPDF au format A4.

const A4 = { w: 595.28, h: 841.89 } // points (72 dpi) — format portrait
const MARGIN = 28 // ~10 mm

/**
 * Construit le noeud DOM d'UNE matrice (titre + grille + légende).
 * Styles en inline pour être totalement indépendant du CSS de l'appli.
 */
function buildMatrixNode(matrix) {
  const actionsById = Object.fromEntries((matrix.actions || []).map((a) => [a.id, a]))
  // Ordre des bandes = position de l'action dans la définition de la matrice.
  const orderOf = Object.fromEntries((matrix.actions || []).map((a, i) => [a.id, i]))

  const wrap = document.createElement('div')
  wrap.style.cssText = `
    width: 720px; box-sizing: border-box; padding: 16px 18px;
    font-family: Arial, Helvetica, sans-serif; color: #111; background: #fff;`

  // Titre
  const title = document.createElement('div')
  title.textContent = matrix.name || 'Sans nom'
  title.style.cssText = 'font-size: 22px; font-weight: 700; margin-bottom: 10px;'
  wrap.appendChild(title)

  // Grille
  const grid = document.createElement('div')
  grid.style.cssText =
    'display: grid; grid-template-columns: repeat(13, 1fr); gap: 2px; width: 100%;'

  for (let row = 0; row < 13; row++) {
    for (let col = 0; col < 13; col++) {
      const name = handName(row, col)
      const entries = matrix.cells[name] || []
      const kind = handKind(row, col)

      const cell = document.createElement('div')
      cell.style.cssText = `
        position: relative; height: 50px; border: 1px solid #ccc; border-radius: 3px;
        overflow: hidden; background: ${kind === 'pair' ? '#eef2f7' : '#f7f7f7'};
        display: flex;`

      // Bandes verticales proportionnelles (mêmes ordre que dans l'appli)
      const ordered = [...entries].sort(
        (a, b) => (orderOf[a.actionId] ?? 99) - (orderOf[b.actionId] ?? 99),
      )
      ordered.forEach((e) => {
        const act = actionsById[e.actionId]
        if (!act || !e.percent) return
        const band = document.createElement('div')
        band.style.cssText = `height: 100%; width: ${e.percent}%; background: ${act.color};`
        cell.appendChild(band)
      })
      // Zone non attribuée (reste jusqu'à 100%) laissée sur le fond neutre.

      // Libellé de la main par-dessus
      const label = document.createElement('span')
      label.textContent = name
      label.style.cssText = `
        position: absolute; inset: 0; display: flex; align-items: center;
        justify-content: center; font-size: 12px; font-weight: 700; color: #111;
        text-shadow: 0 0 2px #fff, 0 0 2px #fff;`
      cell.appendChild(label)

      grid.appendChild(cell)
    }
  }
  wrap.appendChild(grid)

  // Légende (nom + couleur + % global moyen sur la grille)
  const legend = document.createElement('div')
  legend.style.cssText =
    'display: flex; flex-wrap: wrap; gap: 10px 18px; margin-top: 12px; font-size: 13px;'

  ;(matrix.actions || []).forEach((a) => {
    // % global = moyenne de l'action sur les 169 cases (poids identique par case).
    let sum = 0
    Object.values(matrix.cells).forEach((entries) => {
      const found = (entries || []).find((e) => e.actionId === a.id)
      if (found) sum += found.percent
    })
    const globalPct = (sum / 169).toFixed(1)

    const item = document.createElement('div')
    item.style.cssText = 'display: flex; align-items: center; gap: 6px;'
    item.innerHTML = `
      <span style="width:14px;height:14px;border-radius:3px;display:inline-block;background:${a.color};border:1px solid #999;"></span>
      <span><b>${a.name}</b> <span style="color:#666;">(${globalPct}%)</span></span>`
    legend.appendChild(item)
  })
  wrap.appendChild(legend)

  return wrap
}

/**
 * Génère et télécharge un PDF contenant les matrices fournies.
 * @param {Array} matrices  matrices à imprimer
 * @param {number} perPage  nombre de matrices par page (1 ou 2)
 */
export async function exportMatricesToPdf(matrices, perPage = 2) {
  if (!matrices.length) return

  // Conteneur hors écran pour la capture.
  const stage = document.createElement('div')
  stage.style.cssText = 'position: fixed; left: -10000px; top: 0; background: #fff;'
  document.body.appendChild(stage)

  const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' })
  const usableW = A4.w - MARGIN * 2
  const slotH = (A4.h - MARGIN * 2 - (perPage - 1) * MARGIN) / perPage

  try {
    for (let i = 0; i < matrices.length; i++) {
      const node = buildMatrixNode(matrices[i])
      stage.appendChild(node)

      // Capture haute résolution pour des couleurs nettes à l'impression.
      const canvas = await html2canvas(node, { scale: 2, backgroundColor: '#ffffff' })
      stage.removeChild(node)

      const imgW = usableW
      let imgH = (canvas.height / canvas.width) * imgW
      // On borne la hauteur au créneau disponible (garde le ratio).
      if (imgH > slotH) {
        imgH = slotH
      }

      const slotIndex = i % perPage
      if (i > 0 && slotIndex === 0) pdf.addPage()

      const x = MARGIN
      const y = MARGIN + slotIndex * (slotH + MARGIN)
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, y, imgW, imgH)
    }

    pdf.save('ranges-poker.pdf')
  } finally {
    document.body.removeChild(stage)
  }
}
