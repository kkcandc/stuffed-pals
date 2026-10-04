// Picks a light, playful voice already on the phone. The line itself
// is still the on-device reply, not a model.

export function pickFunnyVoice(voices) {
  const list = Array.isArray(voices) ? voices : [];
  const english = list.filter((voice) => /^en/i.test(voice.lang || ""));
  const pool = english.length ? english : list;
  const score = (voice) => {
    const name = `${voice.name || ""} ${voice.lang || ""}`.toLowerCase();
    let value = 0;
    if (/demonic|croak|anxious|zombie|whisper/.test(name)) value -= 8;
    if (/child|kid|boy|girl/.test(name)) value += 6;
    if (/female[3-5]|woman|samantha|karen|moira|fiona|tessa|serena/.test(name)) value += 5;
    if (/female/.test(name)) value += 2;
    if (/\bmale\b|daniel|alex\b|fred/.test(name)) value -= 2;
    return value;
  };
  return pool.slice().sort((a, b) => score(b) - score(a))[0] || null;
}

export function funnyUtteranceSettings() {
  return { pitch: 1.85, rate: 1.12, volume: 0.82 };
}
