const KEY = "stuffed-pals.v1";
const OUTFITS = new Set(["none", "bow", "scarf", "glasses", "hat"]);
const MAKEUP = new Set(["none", "rosy", "berry", "sparkle"]);

export function emptyState() {
  return { pals: [] };
}

function isPhoto(value) {
  return typeof value === "string" && value.startsWith("data:image/") && value.length < 1_500_000;
}

function cleanPal(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.id !== "string" || typeof raw.name !== "string") return null;
  if (!isPhoto(raw.photo)) return null;
  const name = raw.name.replace(/\s+/g, " ").trim().slice(0, 18);
  if (!name) return null;
  return {
    id: raw.id,
    name,
    photo: raw.photo,
    outfit: OUTFITS.has(raw.outfit) ? raw.outfit : "none",
    makeup: MAKEUP.has(raw.makeup) ? raw.makeup : "none",
    snacks: Number.isFinite(raw.snacks) ? Math.max(0, Math.min(5, raw.snacks)) : 0,
    landmarks: cleanLandmarks(raw.landmarks),
  };
}

function cleanPoint(point) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  return {
    x: Math.min(1, Math.max(0, point.x)),
    y: Math.min(1, Math.max(0, point.y)),
  };
}

function cleanLandmarks(raw) {
  const leftEye = cleanPoint(raw?.leftEye);
  const rightEye = cleanPoint(raw?.rightEye);
  const mouth = cleanPoint(raw?.mouth);
  const headTop = cleanPoint(raw?.headTop);
  const forehead = cleanPoint(raw?.forehead);
  const hatBrim = cleanPoint(raw?.hatBrim);
  const leftCheek = cleanPoint(raw?.leftCheek);
  const rightCheek = cleanPoint(raw?.rightCheek);
  const neck = cleanPoint(raw?.neck);
  if (!leftEye || !rightEye || !mouth || !forehead || !hatBrim || !leftCheek || !rightCheek || !neck) {
    return null;
  }
  const eyeSpan = Number(raw.eyeSpan);
  return {
    leftEye,
    rightEye,
    mouth,
    headTop: headTop || { x: (leftEye.x + rightEye.x) / 2, y: Math.max(0, leftEye.y - 0.2) },
    forehead,
    hatBrim,
    leftCheek,
    rightCheek,
    neck,
    eyeSpan: Number.isFinite(eyeSpan) ? eyeSpan : Math.abs(rightEye.x - leftEye.x),
    confident: Boolean(raw.confident),
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyState();
    const data = JSON.parse(raw);
    const pals = Array.isArray(data?.pals) ? data.pals.map(cleanPal).filter(Boolean) : [];
    return { pals };
  } catch {
    return emptyState();
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ pals: state.pals }));
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
