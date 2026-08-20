const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ACTIONS = [
  { id: 'a-allin', name: 'All-in', color: '#802020' },
  { id: 'a-open', name: 'Open', color: '#f04040' }, // nom précisé par catégorie plus bas
  { id: 'a-limp', name: 'Limp', color: '#58b868' },
  { id: 'a-fold', name: 'Fold', color: '#4080b8' },
];

const ACTION_KEY_TO_ID = { allin: 'a-allin', open: 'a-open', limp: 'a-limp', fold: 'a-fold' };

const CATEGORIES = [
  {
    dir: 'RANGES/HU-SB',
    prefix: 'HU-SB-',
    position: 'sb-hu',
    openName: 'Open 2bb',
    nameFor: (bb) => `SB Open (Heads-Up) — ${bb}bb`,
  },
  {
    dir: 'RANGES/3P-BTN',
    prefix: '3P-BTN-',
    position: 'btn',
    openName: 'Open 2bb',
    nameFor: (bb) => `BTN Open (3-max) — ${bb}bb`,
  },
  {
    dir: 'RANGES/3P-SB',
    prefix: '3P-SB-',
    position: 'sb',
    openName: 'Open 2.5bb',
    nameFor: (bb) => `SB Open (3-max) — ${bb}bb`,
  },
];

const matrices = [];

for (const cat of CATEGORIES) {
  const files = fs.readdirSync(cat.dir).filter((f) => f.endsWith('.png'));
  files.sort((a, b) => {
    const na = Number(a.match(/(\d+(?:\.\d+)?)bb/)[1]);
    const nb = Number(b.match(/(\d+(?:\.\d+)?)bb/)[1]);
    return na - nb;
  });

  for (const file of files) {
    const bbMatch = file.match(/(\d+(?:\.\d+)?)bb/);
    const bb = Number(bbMatch[1]);
    const fullPath = path.join(cat.dir, file);
    const out = execSync(`node scripts/extract.cjs "${fullPath}"`, { maxBuffer: 50 * 1024 * 1024 }).toString();
    const { cells: rawCells } = JSON.parse(out);

    const cells = {};
    for (const [hand, entries] of Object.entries(rawCells)) {
      cells[hand] = entries.map((e) => ({ actionId: ACTION_KEY_TO_ID[e.action], percent: e.percent }));
    }

    const actions = ACTIONS.map((a) => (a.id === 'a-open' ? { ...a, name: cat.openName } : { ...a }));

    matrices.push({
      name: cat.nameFor(bb),
      actions,
      cells,
      meta: { type: 'open', style: 'gto', position: cat.position, stack: bb },
    });
    console.error(`OK ${fullPath} -> ${cat.nameFor(bb)}`);
  }
}

fs.writeFileSync(
  'C:/Users/LENOVO/AppData/Local/Temp/claude/C--Users-LENOVO-Desktop-rangemaker/e51779dc-c81f-45ac-a944-6a22026a580a/scratchpad/matrices.json',
  JSON.stringify(matrices, null, 2),
);
console.error(`Total matrices: ${matrices.length}`);
