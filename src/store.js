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
  const chat = Array.isArray(raw.chat)
    ? raw.chat
        .filter((line) => line && (line.role === "you" || line.role === "pal") && typeof line.text === "string")
        .slice(-12)
        .map((line) => ({ role: line.role, text: line.text.slice(0, 200) }))
    : [];
  return {
    id: raw.id,
    name,
    photo: raw.photo,
    outfit: OUTFITS.has(raw.outfit) ? raw.outfit : "none",
    makeup: MAKEUP.has(raw.makeup) ? raw.makeup : "none",
    snacks: Number.isFinite(raw.snacks) ? Math.max(0, Math.min(5, raw.snacks)) : 0,
    moodLine: typeof raw.moodLine === "string" ? raw.moodLine.slice(0, 200) : "",
    chat,
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
