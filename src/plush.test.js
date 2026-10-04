import assert from "node:assert/strict";
import test from "node:test";
import { buildPlush } from "./plush.js";

function paintAnimal({ width, height, ox, oy, rx, ry }) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    pixels[i * 4] = 236;
    pixels[i * 4 + 1] = 220;
    pixels[i * 4 + 2] = 198;
    pixels[i * 4 + 3] = 255;
  }
  const put = (x, y, color) => {
    const px = Math.round(x);
    const py = Math.round(y);
    if (px < 0 || py < 0 || px >= width || py >= height) return;
    const o = (py * width + px) * 4;
    pixels[o] = color[0];
    pixels[o + 1] = color[1];
    pixels[o + 2] = color[2];
  };
  const ellipse = (cx, cy, erx, ery, color) => {
    for (let y = cy - ery; y <= cy + ery; y += 1) {
      for (let x = cx - erx; x <= cx + erx; x += 1) {
        const nx = (x - cx) / erx;
        const ny = (y - cy) / ery;
        if (nx * nx + ny * ny <= 1) put(x, y, color);
      }
    }
  };
  ellipse(ox, oy, rx, ry, [98, 166, 142]);
  ellipse(ox, oy + ry * 0.12, rx * 0.5, ry * 0.42, [246, 239, 228]);
  const eye = Math.max(4, Math.min(rx, ry) * 0.14);
  ellipse(ox - rx * 0.28, oy - ry * 0.16, eye, eye, [24, 18, 16]);
  ellipse(ox + rx * 0.28, oy - ry * 0.16, eye, eye, [24, 18, 16]);
  return pixels;
}

function span(mesh) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < mesh.positions.length; i += 3) {
    const x = mesh.positions[i];
    const y = mesh.positions[i + 1];
    const z = mesh.positions[i + 2];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  return { x: maxX - minX, y: maxY - minY, z: maxZ - minZ };
}

test("one photo becomes a stuffed volume, not a flat card", () => {
  const pixels = paintAnimal({ width: 180, height: 240, ox: 90, oy: 120, rx: 58, ry: 70 });
  const mesh = buildPlush(pixels, 180, 240, {
    leftEye: { x: 0.41, y: 0.46 },
    rightEye: { x: 0.59, y: 0.46 },
    mouth: { x: 0.5, y: 0.58 },
    leftCheek: { x: 0.34, y: 0.54 },
    rightCheek: { x: 0.66, y: 0.54 },
    forehead: { x: 0.5, y: 0.32 },
    hatBrim: { x: 0.5, y: 0.26 },
    neck: { x: 0.5, y: 0.7 },
    headTop: { x: 0.5, y: 0.2 },
  });
  const size = span(mesh);
  assert.ok(mesh.indices.length > 300 && mesh.indices.length % 3 === 0);
  assert.ok(size.z > 0.08, `thickness ${size.z}`);
  assert.ok(size.z > size.y * 0.08);
  const { leftEye, rightEye, mouth, forehead } = mesh.anchors;
  assert.ok(leftEye.x < rightEye.x);
  assert.ok(leftEye.y > mouth.y);
  assert.ok(forehead.y > leftEye.y);
  assert.ok(leftEye.z > 0);
  const darkness = leftEye.color[0] + leftEye.color[1] + leftEye.color[2];
  assert.ok(darkness < 0.35, `eye color ${darkness}`);
});

test("a wide animal becomes a wider figure than a tall one", () => {
  const wide = buildPlush(
    paintAnimal({ width: 220, height: 160, ox: 110, oy: 80, rx: 80, ry: 36 }),
    220,
    160,
    null,
  );
  const tall = buildPlush(
    paintAnimal({ width: 140, height: 240, ox: 70, oy: 120, rx: 36, ry: 90 }),
    140,
    240,
    null,
  );
  const wideRatio = span(wide).x / span(wide).y;
  const tallRatio = span(tall).x / span(tall).y;
  assert.ok(wideRatio > tallRatio + 0.25, `wide ${wideRatio} tall ${tallRatio}`);
});

test("an animal in the corner is still built from its own pixels", () => {
  const pixels = paintAnimal({ width: 200, height: 200, ox: 48, oy: 150, rx: 32, ry: 34 });
  const mesh = buildPlush(pixels, 200, 200, null);
  const size = span(mesh);
  assert.ok(size.x > 0.4 && size.y > 0.4);
  assert.ok(mesh.anchors.leftEye.color[0] + mesh.anchors.leftEye.color[1] + mesh.anchors.leftEye.color[2] < 0.45);
  assert.ok(mesh.anchors.leftEye.z > 0.01);
});
