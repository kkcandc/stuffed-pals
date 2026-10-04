import assert from "node:assert/strict";
import test from "node:test";
import { cameraMessage } from "./camera.js";

test("a blocked camera is described plainly and asks them to try again", () => {
  const message = cameraMessage({ name: "NotAllowedError" });
  assert.match(message, /The camera is blocked/);
  assert.match(message, /Try again/);
});

test("a missing camera is not called blocked", () => {
  const message = cameraMessage({ name: "NotFoundError" });
  assert.doesNotMatch(message, /blocked/);
  assert.match(message, /No camera was found/);
  assert.match(message, /Try again/);
});
