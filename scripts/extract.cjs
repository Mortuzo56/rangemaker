const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

function handName(row, col) {
  const rHigh = RANKS[Math.min(row, col)];
  const rLow = RANKS[Math.max(row, col)];
  if (row === col) return rHigh + rHigh;
  if (col > row) return rHigh + rLow + 's';
  return rHigh + rLow + 'o';
}

// Palette de référence (RGB), issue de l'analyse des histogrammes de couleurs.
const PALETTE = {
  allin: [128, 32, 32],
  open: [240, 64, 64],
  limp: [88, 184, 104],
  fold: [64, 128, 184],
};

function isBlackish(r, g, b) {
  return r < 45 && g < 45 && b < 45;
}
function isWhitish(r, g, b) {
  // Couvre aussi les pixels d'anti-aliasing du texte (mélange blanc/fond),
  // qui ne sont pas purement blancs mais restent nettement plus clairs que
  // n'importe quelle couleur de la palette (dont chacune a un canal < 150).
  return r > 170 && g > 170 && b > 170;
}
function dist2(a, b) {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}
function nearestAction(r, g, b) {
  let best = null;
  let bestD = Infinity;
  for (const [key, rgb] of Object.entries(PALETTE)) {
    const d = dist2([r, g, b], rgb);
    if (d < bestD) {
      bestD = d;
      best = key;
    }
  }
  return best;
}

function findLines(colBlack, threshold) {
  const idxs = [];
  let inRun = false,
    runStart = 0;
  for (let i = 0; i < colBlack.length; i++) {
    if (colBlack[i] > threshold) {
      if (!inRun) {
        inRun = true;
        runStart = i;
      }
    } else {
      if (inRun) {
        inRun = false;
        idxs.push(Math.round((runStart + i - 1) / 2));
      }
    }
  }
  if (inRun) idxs.push(Math.round((runStart + colBlack.length - 1) / 2));
  return idxs;
}

function analyzeImage(file) {
  const png = PNG.sync.read(fs.readFileSync(file));
  const { width, height, data } = png;

  const colBlack = new Array(width).fill(0);
  for (let x = 0; x < width; x++) {
    let c = 0;
    for (let y = 0; y < height; y++) {
      const i = (width * y + x) * 4;
      if (isBlackish(data[i], data[i + 1], data[i + 2])) c++;
    }
    colBlack[x] = c / height;
  }
  const rowBlack = new Array(height).fill(0);
  for (let y = 0; y < height; y++) {
    let c = 0;
    for (let x = 0; x < width; x++) {
      const i = (width * y + x) * 4;
      if (isBlackish(data[i], data[i + 1], data[i + 2])) c++;
    }
    rowBlack[y] = c / width;
  }

  const colLines = findLines(colBlack, 0.5);
  const rowLines = findLines(rowBlack, 0.5);
  if (colLines.length !== 14 || rowLines.length !== 14) {
    throw new Error(`Grille non détectée correctement pour ${file}: cols=${colLines.length} rows=${rowLines.length}`);
  }

  const cells = {};
  const usedActions = new Set();

  for (let row = 0; row < 13; row++) {
    for (let col = 0; col < 13; col++) {
      const x0 = colLines[col] + 3;
      const x1 = colLines[col + 1] - 3;
      const y0 = rowLines[row] + 5;
      const y1 = rowLines[row + 1] - 5;
      // Le libellé de la main (ex. "AKs") est toujours ancré en haut à gauche
      // de la case et occupe jusqu'à ~40% de sa hauteur, avec un halo
      // d'anti-aliasing sub-pixel qui peut prendre des teintes proches de la
      // palette. On ignore entièrement les rangées du haut (mais on garde
      // toute la largeur, indispensable pour mesurer fidèlement un partage
      // vertical gauche/droite des couleurs).
      const textCutY = y0 + Math.round((y1 - y0) * 0.55);

      const counts = { allin: 0, open: 0, limp: 0, fold: 0 };
      let total = 0;

      for (let y = textCutY; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (width * y + x) * 4;
          const r = data[i],
            g = data[i + 1],
            b = data[i + 2];
          if (isWhitish(r, g, b) || isBlackish(r, g, b)) continue;
          const action = nearestAction(r, g, b);
          counts[action]++;
          total++;
        }
      }

      const name = handName(row, col);
      if (total === 0) {
        cells[name] = [];
        continue;
      }

      // Pourcentages bruts, puis arrondi en conservant la somme à 100.
      const raw = Object.entries(counts)
        .filter(([, c]) => c > 0)
        .map(([action, c]) => ({ action, pct: (c / total) * 100 }));

      // Seuil de bruit : on ignore les couleurs parasites (anti-aliasing résiduel) < 1.5%.
      const kept = raw.filter((e) => e.pct >= 1.5);
      const keptTotal = kept.reduce((s, e) => s + e.pct, 0);
      const normalized = kept.map((e) => ({ action: e.action, pct: (e.pct / keptTotal) * 100 }));

      const rounded = normalized.map((e) => ({ action: e.action, pct: Math.round(e.pct) }));
      let sum = rounded.reduce((s, e) => s + e.pct, 0);
      if (rounded.length) {
        // Ajuste l'entrée la plus grande pour que la somme fasse exactement 100.
        rounded.sort((a, b) => b.pct - a.pct);
        rounded[0].pct += 100 - sum;
      }

      cells[name] = rounded
        .filter((e) => e.pct > 0)
        .map((e) => {
          usedActions.add(e.action);
          return { action: e.action, percent: e.pct };
        });
    }
  }

  return { cells, usedActions };
}

const file = process.argv[2];
const result = analyzeImage(file);
console.log(JSON.stringify(result, null, 2));
