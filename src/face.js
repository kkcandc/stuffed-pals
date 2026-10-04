// Finds a stuffed animal's eyes, mouth, and head in a photo so hats,
// glasses, and cheeks can sit on those parts. This runs on the phone.

const MAX_EDGE = 160;

export function detectFace(pixels, width, height) {
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const src = scale < 0.999 ? downscale(pixels, width, height, w, h) : pixels;
  return detectOn(src, w, h);
}

export function featurePoints(marks) {
  const span = marks.eyeSpan;
  const midX = (marks.leftEye.x + marks.rightEye.x) / 2;
  const eyeY = (marks.leftEye.y + marks.rightEye.y) / 2;
  return {
    glassesLeft: { x: marks.leftEye.x, y: marks.leftEye.y, w: span * 0.74 },
    glassesRight: { x: marks.rightEye.x, y: marks.rightEye.y, w: span * 0.74 },
    bridge: { x: midX, y: eyeY, w: span * 0.34 },
    bow: { x: midX, y: marks.forehead.y, w: span * 1.5 },
    hat: { x: midX, y: marks.hatBrim.y, w: span * 1.7 },
    leftCheek: { x: marks.leftCheek.x, y: marks.leftCheek.y, w: span * 0.62 },
    rightCheek: { x: marks.rightCheek.x, y: marks.rightCheek.y, w: span * 0.62 },
    lips: { x: marks.mouth.x, y: marks.mouth.y, w: span * 0.56 },
    scarf: { x: midX, y: marks.neck.y, w: Math.min(0.92, span * 2.6) },
    mouth: { x: marks.mouth.x, y: marks.mouth.y, w: span * 0.5 },
    sparkleL: { x: marks.leftCheek.x - span * 0.08, y: marks.leftCheek.y - span * 0.12, w: span * 0.2 },
    sparkleR: { x: marks.rightCheek.x + span * 0.08, y: marks.rightCheek.y - span * 0.12, w: span * 0.2 },
  };
}

export function detectFaceFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const maxEdge = 720;
      const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h);
      resolve(detectFace(data.data, w, h));
    };
    img.onerror = () => reject(new Error("photo"));
    img.src = url;
  });
}

function downscale(pixels, sw, sh, dw, dh) {
  const out = new Uint8ClampedArray(dw * dh * 4);
  for (let y = 0; y < dh; y += 1) {
    const sy = Math.min(sh - 1, Math.floor((y + 0.5) * sh / dh));
    for (let x = 0; x < dw; x += 1) {
      const sx = Math.min(sw - 1, Math.floor((x + 0.5) * sw / dw));
      const s = (sy * sw + sx) * 4;
      const d = (y * dw + x) * 4;
      out[d] = pixels[s];
      out[d + 1] = pixels[s + 1];
      out[d + 2] = pixels[s + 2];
      out[d + 3] = pixels[s + 3] ?? 255;
    }
  }
  return out;
}

function detectOn(pixels, width, height) {
  const n = width * height;
  const lum = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const o = i * 4;
    lum[i] = pixels[o] * 0.299 + pixels[o + 1] * 0.587 + pixels[o + 2] * 0.114;
  }

  const bg = borderColor(pixels, width, height);
  const fg = new Uint8Array(n);
  let fgCount = 0;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      const o = i * 4;
      const dist = colorDist(pixels[o], pixels[o + 1], pixels[o + 2], bg[0], bg[1], bg[2]);
      if (dist > 34) {
        fg[i] = 1;
        fgCount += 1;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  const fgRatio = fgCount / n;
  const bbox = fgRatio < 0.05 || fgRatio > 0.93 || maxX <= minX
    ? { minX: 0, minY: 0, maxX: width - 1, maxY: height - 1 }
    : padBBox({ minX, minY, maxX, maxY }, width, height, 2);

  const radius = Math.max(2, Math.round(Math.min(width, height) * 0.025));
  const blur = boxBlur(lum, width, height, radius);
  const pair = findEyePair(lum, blur, fg, width, height, bbox, fgRatio);
  const confident = Boolean(pair);
  const eyes = pair || guessEyes(bbox, width, height);
  const left = eyes.left.cx < eyes.right.cx ? eyes.left : eyes.right;
  const right = eyes.left.cx < eyes.right.cx ? eyes.right : eyes.left;
  const eyeDist = Math.max(4, Math.hypot(right.cx - left.cx, right.cy - left.cy));
  const midX = (left.cx + right.cx) / 2;
  const eyeY = (left.cy + right.cy) / 2;
  const faceLum = sampleFaceLum(lum, width, midX, eyeY, eyeDist);
  const mouthPx = findMouth(lum, width, height, midX, eyeY, eyeDist, faceLum, bbox);
  let headTop = findHeadTop(lum, fg, width, midX, eyeY, eyeDist, faceLum, bbox);
  if (eyeY - headTop < eyeDist * 0.75) headTop = Math.max(0, eyeY - eyeDist * 1.4);

  const mouthY = mouthPx.y;
  const cheekDrop = eyeDist * 0.5;
  const leftCheek = {
    x: clamp01((left.cx - eyeDist * 0.42) / width),
    y: clamp01((eyeY + cheekDrop) / height),
  };
  const rightCheek = {
    x: clamp01((right.cx + eyeDist * 0.42) / width),
    y: clamp01((eyeY + cheekDrop) / height),
  };
  const neckY = Math.min(height - 1, mouthY + eyeDist * 1.05);
  const eyeYn = eyeY / height;
  const headN = headTop / height;
  return {
    leftEye: { x: clamp01(left.cx / width), y: clamp01(left.cy / height) },
    rightEye: { x: clamp01(right.cx / width), y: clamp01(right.cy / height) },
    mouth: { x: clamp01(mouthPx.x / width), y: clamp01(mouthY / height) },
    headTop: { x: clamp01(midX / width), y: clamp01(headN) },
    forehead: { x: clamp01(midX / width), y: clamp01(headN + (eyeYn - headN) * 0.36) },
    hatBrim: { x: clamp01(midX / width), y: clamp01(headN + (eyeYn - headN) * 0.58) },
    leftCheek,
    rightCheek,
    neck: { x: clamp01(midX / width), y: clamp01(neckY / height) },
    eyeSpan: eyeDist / width,
    confident,
  };
}

function findEyePair(lum, blur, fg, width, height, bbox, fgRatio) {
  const faceH = bbox.maxY - bbox.minY + 1;
  const searchBottom = bbox.minY + Math.round(faceH * 0.78);
  for (const contrast of [32, 22, 14]) {
    const blobs = darkBlobs(lum, blur, width, height, bbox, searchBottom, contrast);
    const pair = bestPair(blobs, bbox, fg, width, fgRatio);
    if (pair) return pair;
  }
  return null;
}

function darkBlobs(lum, blur, width, height, bbox, searchBottom, contrast) {
  const mask = new Uint8Array(width * height);
  for (let y = bbox.minY; y <= searchBottom && y < height; y += 1) {
    for (let x = bbox.minX; x <= bbox.maxX && x < width; x += 1) {
      const i = y * width + x;
      if (blur[i] - lum[i] >= contrast && lum[i] < 150) mask[i] = 1;
    }
  }

  const seen = new Uint8Array(width * height);
  const blobs = [];
  const faceArea = (bbox.maxX - bbox.minX + 1) * (bbox.maxY - bbox.minY + 1);
  const minArea = Math.max(5, faceArea * 0.0007);
  const maxArea = faceArea * 0.09;
  const stack = [];

  for (let y = bbox.minY; y <= searchBottom && y < height; y += 1) {
    for (let x = bbox.minX; x <= bbox.maxX && x < width; x += 1) {
      const start = y * width + x;
      if (!mask[start] || seen[start]) continue;
      let count = 0;
      let sumX = 0;
      let sumY = 0;
      let sumLum = 0;
      let minBX = x;
      let maxBX = x;
      let minBY = y;
      let maxBY = y;
      stack.push(start);
      seen[start] = 1;
      while (stack.length) {
        const i = stack.pop();
        const px = i % width;
        const py = (i - px) / width;
        count += 1;
        sumX += px;
        sumY += py;
        sumLum += lum[i];
        if (px < minBX) minBX = px;
        if (px > maxBX) maxBX = px;
        if (py < minBY) minBY = py;
        if (py > maxBY) maxBY = py;
        const neighbors = [i - 1, i + 1, i - width, i + width];
        for (const n of neighbors) {
          if (n < 0 || n >= mask.length || seen[n] || !mask[n]) continue;
          const nx = n % width;
          if (Math.abs(nx - px) > 1) continue;
          seen[n] = 1;
          stack.push(n);
        }
      }
      const bw = maxBX - minBX + 1;
      const bh = maxBY - minBY + 1;
      const aspect = bw / bh;
      if (count < minArea || count > maxArea) continue;
      if (aspect < 0.35 || aspect > 2.8) continue;
      blobs.push({
        cx: sumX / count,
        cy: sumY / count,
        area: count,
        r: Math.sqrt(count / Math.PI),
        contrast: (blur[Math.round(sumY / count) * width + Math.round(sumX / count)] || 0) - sumLum / count,
      });
      if (blobs.length > 40) return blobs;
    }
  }
  return blobs;
}

function bestPair(blobs, bbox, fg, width, fgRatio) {
  let best = null;
  let bestScore = 0.8;
  const faceW = bbox.maxX - bbox.minX + 1;
  const faceH = bbox.maxY - bbox.minY + 1;
  const useFg = fgRatio > 0.05 && fgRatio < 0.93;
  for (let i = 0; i < blobs.length; i += 1) {
    for (let j = i + 1; j < blobs.length; j += 1) {
      const a = blobs[i];
      const b = blobs[j];
      const dx = Math.abs(a.cx - b.cx);
      const dy = Math.abs(a.cy - b.cy);
      if (dx < Math.max(a.r, b.r) * 2.1) continue;
      if (dy > Math.max(4, dx * 0.42)) continue;
      if (dx < faceW * 0.1 || dx > faceW * 0.72) continue;
      const sizeRatio = Math.min(a.area, b.area) / Math.max(a.area, b.area);
      if (sizeRatio < 0.4) continue;
      const mid = Math.round((a.cy + b.cy) / 2) * width + Math.round((a.cx + b.cx) / 2);
      let score = sizeRatio * 4 + (1 - dy / Math.max(dx, 1)) * 2;
      score += Math.min(a.contrast, b.contrast) / 25;
      score -= ((a.cy + b.cy) / 2 - bbox.minY) / faceH;
      if (useFg && mid >= 0 && mid < fg.length && !fg[mid]) score -= 1.5;
      if (score > bestScore) {
        bestScore = score;
        best = { left: a, right: b };
      }
    }
  }
  return best;
}

function guessEyes(bbox, width, height) {
  const cx = (bbox.minX + bbox.maxX) / 2;
  const faceH = bbox.maxY - bbox.minY;
  const faceW = bbox.maxX - bbox.minX;
  const cy = bbox.minY + faceH * 0.36;
  const dx = Math.max(6, faceW * 0.16);
  return {
    left: { cx: cx - dx, cy },
    right: { cx: cx + dx, cy },
  };
}

function sampleFaceLum(lum, width, midX, eyeY, eyeDist) {
  const samples = [];
  const y = Math.round(eyeY + eyeDist * 0.22);
  for (let x = Math.round(midX - eyeDist * 0.2); x <= midX + eyeDist * 0.2; x += 1) {
    const i = y * width + x;
    if (i >= 0 && i < lum.length) samples.push(lum[i]);
  }
  if (!samples.length) return 160;
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)];
}

function findMouth(lum, width, height, midX, eyeY, eyeDist, faceLum, bbox) {
  const y0 = Math.max(0, Math.round(eyeY + eyeDist * 0.35));
  const y1 = Math.min(height - 1, bbox.maxY, Math.round(eyeY + eyeDist * 1.45));
  const x0 = Math.max(0, Math.round(midX - eyeDist * 0.55));
  const x1 = Math.min(width - 1, Math.round(midX + eyeDist * 0.55));
  let sumX = 0;
  let sumY = 0;
  let count = 0;
  let bestY = 0;
  let bestCount = 0;
  for (let y = y0; y <= y1; y += 1) {
    let row = 0;
    for (let x = x0; x <= x1; x += 1) {
      const value = lum[y * width + x];
      if (value < faceLum - 16) {
        sumX += x;
        sumY += y;
        count += 1;
        row += 1;
      }
    }
    if (row > bestCount) {
      bestCount = row;
      bestY = y;
    }
  }
  if (count >= 6) {
    return { x: sumX / count, y: Math.max(sumY / count, bestY - 1) };
  }
  return { x: midX, y: Math.min(height - 1, eyeY + eyeDist * 0.9) };
}

function findHeadTop(lum, fg, width, midX, eyeY, eyeDist, faceLum, bbox) {
  let top = eyeY;
  const x0 = Math.max(0, Math.round(midX - eyeDist * 0.45));
  const x1 = Math.min(width - 1, Math.round(midX + eyeDist * 0.45));
  for (let y = Math.round(eyeY); y >= bbox.minY; y -= 1) {
    let on = 0;
    for (let x = x0; x <= x1; x += 1) {
      const i = y * width + x;
      if (fg[i] || Math.abs(lum[i] - faceLum) < 48) on += 1;
    }
    if (on >= Math.max(2, (x1 - x0) * 0.35)) top = y;
    else if (eyeY - y > eyeDist * 0.3) break;
  }
  return top;
}

function borderColor(pixels, width, height) {
  const bins = [];
  const take = (x, y) => {
    const o = (y * width + x) * 4;
    bins.push([pixels[o], pixels[o + 1], pixels[o + 2]]);
  };
  const edge = Math.max(2, Math.round(Math.min(width, height) * 0.04));
  for (let i = 0; i < edge; i += 1) {
    take(i, 0);
    take(width - 1 - i, 0);
    take(i, height - 1);
    take(width - 1 - i, height - 1);
    take(0, Math.min(height - 1, i));
    take(width - 1, Math.min(height - 1, i));
  }
  const mid = (index) => {
    const values = bins.map((c) => c[index]).sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)];
  };
  return [mid(0), mid(1), mid(2)];
}

function colorDist(r, g, b, r2, g2, b2) {
  const dr = r - r2;
  const dg = g - g2;
  const db = b - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function padBBox(box, width, height, pad) {
  return {
    minX: Math.max(0, box.minX - pad),
    minY: Math.max(0, box.minY - pad),
    maxX: Math.min(width - 1, box.maxX + pad),
    maxY: Math.min(height - 1, box.maxY + pad),
  };
}

function boxBlur(src, width, height, radius) {
  const integ = new Float64Array((width + 1) * (height + 1));
  const stride = width + 1;
  for (let y = 0; y < height; y += 1) {
    let row = 0;
    for (let x = 0; x < width; x += 1) {
      row += src[y * width + x];
      integ[(y + 1) * stride + (x + 1)] = integ[y * stride + (x + 1)] + row;
    }
  }
  const out = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(height - 1, y + radius);
    for (let x = 0; x < width; x += 1) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width - 1, x + radius);
      const sum = integ[(y1 + 1) * stride + (x1 + 1)]
        - integ[y0 * stride + (x1 + 1)]
        - integ[(y1 + 1) * stride + x0]
        + integ[y0 * stride + x0];
      out[y * width + x] = sum / ((x1 - x0 + 1) * (y1 - y0 + 1));
    }
  }
  return out;
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}
