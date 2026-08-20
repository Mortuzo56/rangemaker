const { PNG } = require('pngjs');
const fs = require('fs');

function isBlackish(r, g, b) {
  return r < 45 && g < 45 && b < 45;
}

function findLines(file) {
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

  function peaks(arr, thresh) {
    const idxs = [];
    let inRun = false, runStart = 0;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] > thresh) {
        if (!inRun) { inRun = true; runStart = i; }
      } else {
        if (inRun) { inRun = false; idxs.push(Math.round((runStart + i - 1) / 2)); }
      }
    }
    if (inRun) idxs.push(Math.round((runStart + arr.length - 1) / 2));
    return idxs;
  }

  const colLines = peaks(colBlack, 0.5);
  const rowLines = peaks(rowBlack, 0.5);
  console.log(file, width, height);
  console.log('colLines', colLines.length, colLines);
  console.log('rowLines', rowLines.length, rowLines);
}

findLines(process.argv[2]);
