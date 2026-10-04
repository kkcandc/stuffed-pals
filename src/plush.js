// Builds a stuffed 3D figure from one photo. The animal's outline is
// puffed into a closed volume and colored from the picture. No outside
// model and no network.

const COLS = 64;

export function buildPlush(pixels, width, height, marks) {
  const cols = COLS;
  const rows = Math.max(8, Math.min(110, Math.round(cols * height / Math.max(1, width))));
  const bg = borderColor(pixels, width, height);
  const mask = new Uint8Array(cols * rows);
  const tint = new Float32Array(cols * rows * 3);
  let fg = 0;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const u = (c + 0.5) / cols;
      const v = (r + 0.5) / rows;
      const rgb = bilinear(pixels, width, height, u, v);
      const i = r * cols + c;
      tint[i * 3] = toLinear(rgb[0]);
      tint[i * 3 + 1] = toLinear(rgb[1]);
      tint[i * 3 + 2] = toLinear(rgb[2]);
      if (colorDist(rgb, bg) > 34) {
        mask[i] = 1;
        fg += 1;
      }
    }
  }

  const ratio = fg / (cols * rows);
  if (ratio < 0.04 || ratio > 0.92) fillEllipse(mask, cols, rows);
  else keepLargest(mask, cols, rows);
  dilate(mask, cols, rows);

  const field = distanceField(mask, cols, rows);
  let maxDist = 1;
  for (let i = 0; i < field.length; i += 1) if (field[i] > maxDist) maxDist = field[i];
  const puff = new Float32Array(cols * rows);
  for (let i = 0; i < puff.length; i += 1) {
    if (!mask[i]) continue;
    puff[i] = (field[i] / maxDist) ** 0.62;
  }
  smooth(puff, mask, cols, rows, 2);

  const aspect = cols / rows;
  const raw = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const i = r * cols + c;
      if (!mask[i]) continue;
      raw.push({
        i,
        c,
        r,
        x: ((c + 0.5) / cols - 0.5) * aspect,
        y: 0.5 - (r + 0.5) / rows,
        z: puff[i] * 0.32,
      });
    }
  }
  if (!raw.length) {
    return emptyMesh();
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const cell of raw) {
    if (cell.x < minX) minX = cell.x;
    if (cell.x > maxX) maxX = cell.x;
    if (cell.y < minY) minY = cell.y;
    if (cell.y > maxY) maxY = cell.y;
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const scale = 1.22 / Math.max(0.001, Math.max(maxX - minX, maxY - minY));
  const place = (x, y, z) => [(x - cx) * scale, (y - cy) * scale, z * scale];

  const front = new Int32Array(cols * rows).fill(-1);
  const back = new Int32Array(cols * rows).fill(-1);
  const positions = [];
  const colors = [];
  const add = (x, y, z, r, g, b) => {
    const id = positions.length / 3;
    positions.push(x, y, z);
    colors.push(r, g, b);
    return id;
  };
  for (const cell of raw) {
    const [x, y, z] = place(cell.x, cell.y, cell.z);
    const o = cell.i * 3;
    front[cell.i] = add(x, y, z, tint[o], tint[o + 1], tint[o + 2]);
    back[cell.i] = add(x, y, -z * 0.45, tint[o] * 0.62, tint[o + 1] * 0.58, tint[o + 2] * 0.52);
  }

  const indices = [];
  const push = (a, b, c, d) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    indices.push(a, b, c, a, c, d);
  };
  for (let r = 0; r < rows - 1; r += 1) {
    for (let c = 0; c < cols - 1; c += 1) {
      const a = r * cols + c;
      const b = a + 1;
      const d = a + cols;
      const e = d + 1;
      if (!mask[a] || !mask[b] || !mask[d] || !mask[e]) continue;
      push(front[a], front[b], front[e], front[d]);
      push(back[a], back[d], back[e], back[b]);
    }
  }

  const guide = marks || guessMarks(mask, cols, rows);
  const eyeRad = eyeSearch(guide, cols);
  const anchor = (point, rad = 0) => {
    const hit = rad > 0
      ? darkestCell(mask, tint, cols, rows, point.x, point.y, rad)
      : nearestCell(mask, cols, rows, point.x, point.y);
    const id = front[hit];
    const spot = {
      x: positions[id * 3],
      y: positions[id * 3 + 1],
      z: positions[id * 3 + 2],
      color: [colors[id * 3], colors[id * 3 + 1], colors[id * 3 + 2]],
    };
    if (rad > 0) spot.fur = furNear(mask, tint, cols, rows, point.x, point.y, rad + 1);
    return spot;
  };

  return {
    positions: Float32Array.from(positions),
    colors: Float32Array.from(colors),
    indices: Uint32Array.from(indices),
    anchors: {
      leftEye: anchor(guide.leftEye, eyeRad),
      rightEye: anchor(guide.rightEye, eyeRad),
      mouth: anchor(guide.mouth),
      leftCheek: anchor(guide.leftCheek),
      rightCheek: anchor(guide.rightCheek),
      forehead: anchor(guide.forehead),
      hatBrim: anchor(guide.hatBrim),
      neck: anchor(guide.neck),
      headTop: anchor(guide.headTop),
    },
  };
}

function emptyMesh() {
  return {
    positions: new Float32Array([0, 0, 0, 0.1, 0, 0, 0, 0.1, 0]),
    colors: new Float32Array([0.5, 0.7, 0.6, 0.5, 0.7, 0.6, 0.5, 0.7, 0.6]),
    indices: new Uint32Array([0, 1, 2]),
    anchors: null,
  };
}

function guessMarks(mask, cols, rows) {
  let minX = cols;
  let minY = rows;
  let maxX = 0;
  let maxY = 0;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (!mask[r * cols + c]) continue;
      if (c < minX) minX = c;
      if (r < minY) minY = r;
      if (c > maxX) maxX = c;
      if (r > maxY) maxY = r;
    }
  }
  const u = (c) => (c + 0.5) / cols;
  const v = (r) => (r + 0.5) / rows;
  const mid = (minX + maxX) / 2;
  const top = minY;
  const bot = maxY;
  const span = Math.max(2, (maxX - minX) * 0.16);
  const eyeR = top + (bot - top) * 0.38;
  return {
    leftEye: { x: u(mid - span), y: v(eyeR) },
    rightEye: { x: u(mid + span), y: v(eyeR) },
    mouth: { x: u(mid), y: v(top + (bot - top) * 0.58) },
    leftCheek: { x: u(mid - span * 1.5), y: v(top + (bot - top) * 0.5) },
    rightCheek: { x: u(mid + span * 1.5), y: v(top + (bot - top) * 0.5) },
    forehead: { x: u(mid), y: v(top + (bot - top) * 0.22) },
    hatBrim: { x: u(mid), y: v(top + (bot - top) * 0.16) },
    neck: { x: u(mid), y: v(top + (bot - top) * 0.72) },
    headTop: { x: u(mid), y: v(top + 1) },
  };
}

function eyeSearch(guide, cols) {
  const dx = Math.abs((guide.leftEye?.x ?? 0.4) - (guide.rightEye?.x ?? 0.6)) * cols;
  return Math.max(2, Math.min(5, Math.round(dx * 0.42)));
}

function furNear(mask, tint, cols, rows, x, y, rad) {
  let c0 = Math.round(x * cols - 0.5);
  let r0 = Math.round(y * rows - 0.5);
  const samples = [];
  for (let dy = -rad; dy <= rad; dy += 1) {
    for (let dx = -rad; dx <= rad; dx += 1) {
      const c = c0 + dx;
      const r = r0 + dy;
      if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
      const i = r * cols + c;
      if (!mask[i]) continue;
      const cr = tint[i * 3];
      const cg = tint[i * 3 + 1];
      const cb = tint[i * 3 + 2];
      const lum = cr * 0.2126 + cg * 0.7152 + cb * 0.0722;
      if (lum < 0.08) continue;
      samples.push([cr, cg, cb, lum]);
    }
  }
  if (!samples.length) return [0.55, 0.62, 0.52];
  samples.sort((a, b) => a[3] - b[3]);
  const mid = samples[Math.floor(samples.length * 0.7)];
  return [mid[0], mid[1], mid[2]];
}

function darkestCell(mask, tint, cols, rows, x, y, rad) {
  let c0 = Math.round(x * cols - 0.5);
  let r0 = Math.round(y * rows - 0.5);
  c0 = Math.max(0, Math.min(cols - 1, c0));
  r0 = Math.max(0, Math.min(rows - 1, r0));
  let best = -1;
  let bestLum = Infinity;
  for (let dy = -rad; dy <= rad; dy += 1) {
    for (let dx = -rad; dx <= rad; dx += 1) {
      const c = c0 + dx;
      const r = r0 + dy;
      if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
      const i = r * cols + c;
      if (!mask[i]) continue;
      const lum = tint[i * 3] * 0.2126 + tint[i * 3 + 1] * 0.7152 + tint[i * 3 + 2] * 0.0722;
      if (lum < bestLum) {
        bestLum = lum;
        best = i;
      }
    }
  }
  return best >= 0 ? best : nearestCell(mask, cols, rows, x, y);
}

function nearestCell(mask, cols, rows, x, y) {
  let c = Math.round(x * cols - 0.5);
  let r = Math.round(y * rows - 0.5);
  c = Math.max(0, Math.min(cols - 1, c));
  r = Math.max(0, Math.min(rows - 1, r));
  if (mask[r * cols + c]) return r * cols + c;
  for (let rad = 1; rad < Math.max(cols, rows); rad += 1) {
    for (let dy = -rad; dy <= rad; dy += 1) {
      for (let dx = -rad; dx <= rad; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== rad) continue;
        const cc = c + dx;
        const rr = r + dy;
        if (cc < 0 || rr < 0 || cc >= cols || rr >= rows) continue;
        const i = rr * cols + cc;
        if (mask[i]) return i;
      }
    }
  }
  return r * cols + c;
}

function borderColor(pixels, width, height) {
  const acc = [0, 0, 0];
  let n = 0;
  const take = (x, y) => {
    const o = (y * width + x) * 4;
    acc[0] += pixels[o];
    acc[1] += pixels[o + 1];
    acc[2] += pixels[o + 2];
    n += 1;
  };
  for (let x = 0; x < width; x += 1) {
    take(x, 0);
    if (height > 1) take(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    take(0, y);
    if (width > 1) take(width - 1, y);
  }
  return acc.map((v) => v / Math.max(1, n));
}

function bilinear(pixels, width, height, u, v) {
  const x = Math.min(width - 1, Math.max(0, u * (width - 1)));
  const y = Math.min(height - 1, Math.max(0, v * (height - 1)));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const tx = x - x0;
  const ty = y - y0;
  const at = (px, py) => {
    const o = (py * width + px) * 4;
    return [pixels[o], pixels[o + 1], pixels[o + 2]];
  };
  const a = at(x0, y0);
  const b = at(x1, y0);
  const c = at(x0, y1);
  const d = at(x1, y1);
  return [0, 1, 2].map((k) => {
    const top = a[k] + (b[k] - a[k]) * tx;
    const bot = c[k] + (d[k] - c[k]) * tx;
    return top + (bot - top) * ty;
  });
}

function colorDist(rgb, bg) {
  const dr = rgb[0] - bg[0];
  const dg = rgb[1] - bg[1];
  const db = rgb[2] - bg[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function toLinear(value) {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function fillEllipse(mask, cols, rows) {
  const rx = cols * 0.28;
  const ry = rows * 0.34;
  const cx = cols / 2;
  const cy = rows / 2;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const nx = (c - cx) / rx;
      const ny = (r - cy) / ry;
      mask[r * cols + c] = nx * nx + ny * ny <= 1 ? 1 : 0;
    }
  }
}

function keepLargest(mask, cols, rows) {
  const seen = new Uint8Array(mask.length);
  let best = [];
  const stack = [];
  for (let i = 0; i < mask.length; i += 1) {
    if (!mask[i] || seen[i]) continue;
    const blob = [];
    stack.push(i);
    seen[i] = 1;
    while (stack.length) {
      const cur = stack.pop();
      blob.push(cur);
      const x = cur % cols;
      const y = (cur - x) / cols;
      const next = [cur - 1, cur + 1, cur - cols, cur + cols];
      for (const n of next) {
        if (n < 0 || n >= mask.length || seen[n] || !mask[n]) continue;
        const nx = n % cols;
        if (Math.abs(nx - x) > 1) continue;
        if (Math.abs((n - nx) / cols - y) > 1) continue;
        seen[n] = 1;
        stack.push(n);
      }
    }
    if (blob.length > best.length) best = blob;
  }
  mask.fill(0);
  for (const i of best) mask[i] = 1;
}

function dilate(mask, cols, rows) {
  const copy = mask.slice();
  for (let r = 1; r < rows - 1; r += 1) {
    for (let c = 1; c < cols - 1; c += 1) {
      const i = r * cols + c;
      if (copy[i] || copy[i - 1] || copy[i + 1] || copy[i - cols] || copy[i + cols]) mask[i] = 1;
    }
  }
}

function distanceField(mask, cols, rows) {
  const inf = cols + rows;
  const dist = new Float32Array(mask.length);
  for (let i = 0; i < mask.length; i += 1) dist[i] = mask[i] ? inf : 0;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const i = r * cols + c;
      if (!mask[i]) continue;
      let best = dist[i];
      if (c > 0) best = Math.min(best, dist[i - 1] + 1);
      if (r > 0) best = Math.min(best, dist[i - cols] + 1);
      dist[i] = best;
    }
  }
  for (let r = rows - 1; r >= 0; r -= 1) {
    for (let c = cols - 1; c >= 0; c -= 1) {
      const i = r * cols + c;
      if (!mask[i]) continue;
      let best = dist[i];
      if (c + 1 < cols) best = Math.min(best, dist[i + 1] + 1);
      if (r + 1 < rows) best = Math.min(best, dist[i + cols] + 1);
      dist[i] = best;
    }
  }
  return dist;
}

function smooth(puff, mask, cols, rows, times) {
  const next = new Float32Array(puff.length);
  for (let t = 0; t < times; t += 1) {
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const i = r * cols + c;
        if (!mask[i]) continue;
        let sum = puff[i];
        let n = 1;
        const neighbors = [i - 1, i + 1, i - cols, i + cols];
        for (const k of neighbors) {
          if (k < 0 || k >= mask.length || !mask[k]) continue;
          const x = i % cols;
          const nx = k % cols;
          if (Math.abs(nx - x) > 1) continue;
          sum += puff[k];
          n += 1;
        }
        next[i] = sum / n;
      }
    }
    puff.set(next);
  }
}
