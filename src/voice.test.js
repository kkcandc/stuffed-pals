import assert from "node:assert/strict";
import test from "node:test";
import { funnyUtteranceSettings, pickFunnyVoice } from "./voice.js";

function voice(name, lang = "en-US") {
  return { name, lang };
}

test("a light english voice wins over a scary one", () => {
  const picked = pickFunnyVoice([
    voice("English (America)+demonic"),
    voice("English (America)+male1"),
    voice("English (America)+female4"),
    voice("Afrikaans+female5", "af"),
  ]);
  assert.equal(picked.name, "English (America)+female4");
});

test("whisper and zombie stay out of the top pick", () => {
  const picked = pickFunnyVoice([
    voice("English+zombie"),
    voice("English+whisper"),
    voice("English+female3"),
  ]);
  assert.equal(picked.name, "English+female3");
});

test("the funny voice is quick and high", () => {
  const settings = funnyUtteranceSettings();
  assert.ok(settings.pitch > 1.4);
  assert.ok(settings.rate > 1);
  assert.ok(settings.volume > 0.5 && settings.volume <= 1);
});
