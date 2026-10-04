import assert from "node:assert/strict";
import test from "node:test";
import { detectFace, featurePoints } from "./face.js";

function paintAnimal({ width, height, ox, oy, scale, background }) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  const bg = background;
  for (let i = 0; i < width * height; i += 1) {
    pixels[i * 4] = bg[0];
    pixels[i * 4 + 1] = bg[1];
    pixels[i * 4 + 2] = bg[2];
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
    pixels[o + 3] = 255;
  };
  const disc = (cx, cy, r, color) => {
    for (let y = cy - r; y <= cy + r; y += 1) {
      for (let x = cx - r; x <= cx + r; x += 1) {
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) put(x, y, color);
      }
    }
  };
  const body = [98, 166, 142];
  const belly = [246, 239, 228];
  const eye = [24, 18, 16];
  const blush = [232, 150, 150];
  const stitch = [70, 48, 40];
  disc(ox, oy, 52 * scale, body);
  disc(ox - 28 * scale, oy - 40 * scale, 16 * scale, body);
  disc(ox + 28 * scale, oy - 40 * scale, 16 * scale, body);
  disc(ox, oy + 8 * scale, 28 * scale, belly);
  const left = [ox - 16 * scale, oy - 6 * scale];
  const right = [ox + 16 * scale, oy - 6 * scale];
  disc(left[0], left[1], 5 * scale, eye);
  disc(right[0], right[1], 5 * scale, eye);
  disc(ox - 24 * scale, oy + 8 * scale, 5 * scale, blush);
  disc(ox + 24 * scale, oy + 8 * scale, 5 * scale, blush);
  for (let i = -2; i <= 2; i += 1) {
    disc(ox + i * 4 * scale, oy + 16 * scale, 1.4 * scale, stitch);
  }
  return {
    pixels,
    leftEye: { x: left[0] / width, y: left[1] / height },
    rightEye: { x: right[0] / width, y: right[1] / height },
    mouth: { x: ox / width, y: (oy + 16 * scale) / height },
  };
}

test("eyes are found on the animal, and glasses use those eyes", () => {
  const drawn = paintAnimal({
    width: 180,
    height: 240,
    ox: 90,
    oy: 120,
    scale: 1.3,
    background: [236, 220, 198],
  });
  const marks = detectFace(drawn.pixels, 180, 240);
  assert.equal(marks.confident, true);
  assert.ok(Math.abs(marks.leftEye.x - drawn.leftEye.x) < 0.04, `left x ${marks.leftEye.x}`);
  assert.ok(Math.abs(marks.leftEye.y - drawn.leftEye.y) < 0.04, `left y ${marks.leftEye.y}`);
  assert.ok(Math.abs(marks.rightEye.x - drawn.rightEye.x) < 0.04, `right x ${marks.rightEye.x}`);
  assert.ok(Math.abs(marks.rightEye.y - drawn.rightEye.y) < 0.04, `right y ${marks.rightEye.y}`);
  const pieces = featurePoints(marks);
  assert.ok(Math.abs(pieces.glassesLeft.x - marks.leftEye.x) < 0.001);
  assert.ok(Math.abs(pieces.glassesLeft.y - marks.leftEye.y) < 0.001);
  assert.ok(Math.abs(pieces.glassesRight.x - marks.rightEye.x) < 0.001);
  assert.ok(pieces.bow.y < marks.leftEye.y);
  assert.ok(pieces.hat.y < marks.leftEye.y);
  assert.ok(pieces.leftCheek.y > marks.leftEye.y);
  assert.ok(pieces.lips.y > marks.leftEye.y);
  assert.ok(pieces.scarf.y > pieces.lips.y);
});

test("an animal in the corner is not dressed at the center of the photo", () => {
  const drawn = paintAnimal({
    width: 220,
    height: 280,
    ox: 58,
    oy: 70,
    scale: 1,
    background: [186, 214, 232],
  });
  const marks = detectFace(drawn.pixels, 220, 280);
  assert.equal(marks.confident, true);
  assert.ok(marks.leftEye.x < 0.35, `eye x ${marks.leftEye.x}`);
  assert.ok(marks.leftEye.y < 0.4, `eye y ${marks.leftEye.y}`);
  assert.ok(Math.abs(marks.leftEye.x - 0.5) > 0.12);
  const pieces = featurePoints(marks);
  assert.ok(pieces.glassesLeft.y < 0.42);
  assert.ok(pieces.bow.y < pieces.glassesLeft.y);
  assert.ok(pieces.hat.y < pieces.glassesLeft.y);
});
