const { PNG } = require('pngjs');
const fs = require('fs');

const file = process.argv[2];
const png = PNG.sync.read(fs.readFileSync(file));
const { width, height, data } = png;

const counts = new Map();
for (let i = 0; i < data.length; i += 4) {
  const r = data[i], g = data[i + 1], b = data[i + 2];
  // quantize to reduce anti-aliasing noise
  const qr = Math.round(r / 8) * 8;
  const qg = Math.round(g / 8) * 8;
  const qb = Math.round(b / 8) * 8;
  const key = `${qr},${qg},${qb}`;
  counts.set(key, (counts.get(key) || 0) + 1);
}

const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
console.log(file, width, height);
for (const [k, v] of sorted) {
  console.log(k, v, (v / (width * height) * 100).toFixed(2) + '%');
}
