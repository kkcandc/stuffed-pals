import { cameraMessage, drawPhoto, fileToPhoto, openCamera, stopStream, waitForFrame } from "./camera.js";
import { el } from "./dom.js";
import { MAKEUP, NAME_IDEAS, OUTFITS, SHELF_LIMIT, SNACKS, byId } from "./looks.js";
import { portrait, tummy } from "./portrait.js";
import { isSoft, makeReply } from "./reply.js";
import { loadState, saveState } from "./store.js";

const app = document.querySelector("#app");
const live = document.querySelector("#live");

const fileInput = el("input", {
  type: "file",
  accept: "image/*",
  capture: "environment",
  hidden: true,
  "aria-label": "Open the camera app",
});
document.body.append(fileInput);

let state = loadState();
let view = { name: "shelf" };
let banner = "";
let stream = null;
let bootToken = 0;
let recognition = null;
let listening = false;

fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  fileInput.value = "";
  if (!file) return;
  try {
    const photo = await fileToPhoto(file);
    banner = "";
    go({ name: "name", photo });
  } catch {
    banner = "That photo did not open. Try snapping again.";
    go({ name: "camera" });
  }
});

function announce(text) {
  if (!text) return;
  live.textContent = "";
  window.setTimeout(() => {
    live.textContent = text;
  }, 30);
}

function fitType() {
  const width = app.clientWidth || 390;
  app.style.fontSize = `${Math.max(16, Math.min(22, width * 0.046))}px`;
}

function persist() {
  const ok = saveState(state).ok;
  banner = ok ? "" : "This phone could not store that. Let one pal hop off, then try again.";
  return ok;
}

function stopListening() {
  listening = false;
  if (recognition) {
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    try {
      recognition.stop();
    } catch {
      /* already stopped */
    }
    recognition = null;
  }
}

function releaseCamera() {
  bootToken += 1;
  stopStream(stream);
  stream = null;
}

function go(next) {
  releaseCamera();
  stopListening();
  view = next;
  render();
}

function currentPal() {
  return state.pals.find((pal) => pal.id === view.id) || null;
}

window.addEventListener("resize", fitType);

function render() {
  const bounce = Boolean(view.bounce);
  view.bounce = false;
  const screen = {
    shelf: () => renderShelf(),
    camera: () => renderCamera(),
    name: () => renderName(),
    pal: () => renderPal(bounce),
  }[view.name]();
  app.replaceChildren(screen);
  document.title = view.name === "pal" && currentPal()
    ? `${currentPal().name} · Stuffed Pals`
    : "Stuffed Pals";
  fitType();
  if (view.name === "camera" && !view.error) bootCamera(screen);
}

function bannerNode() {
  if (!banner) return null;
  return el("p", { class: "banner", text: banner, role: "status" });
}

function renderShelf() {
  const count = state.pals.length;
  const empty = count === 0;
  return el("section", { class: "screen", dataset: { screen: "shelf", palCount: String(count) } },
    bannerNode(),
    el("header", { class: "brand" },
      el("div", { class: "mark", "aria-hidden": "true" },
        el("span", { class: "ear" }),
        el("span", { class: "ear right" }),
        el("span", { class: "face" })
      ),
      el("div", {},
        el("p", { class: "eyebrow", text: "Cora's shelf" }),
        el("h1", { text: "Stuffed Pals" })
      )
    ),
    el("p", {
      class: "lede",
      text: empty
        ? "Point the camera at a stuffed animal. That photo becomes a pal, and it stays on this phone."
        : `${count} ${count === 1 ? "pal" : "pals"} on the shelf. Photos stay on this phone.`,
    }),
    empty
      ? el("div", { class: "empty" },
          emptyArt(),
          el("p", { text: "The shelf is empty." })
        )
      : el("div", { class: "grid" }, state.pals.map((pal) => shelfCard(pal))),
    el("div", { class: "dock" },
      el("button", {
        class: "primary",
        type: "button",
        dataset: { action: "new-pal" },
        onClick: () => {
          if (state.pals.length >= SHELF_LIMIT) {
            banner = "The shelf can hold 12 pals. Let one hop off first.";
            render();
            return;
          }
          banner = "";
          go({ name: "camera" });
        },
      }, empty ? "Snap a pal" : "New pal")
    )
  );
}

function shelfCard(pal) {
  return el("button", {
    class: "card",
    type: "button",
    dataset: { palId: pal.id, palName: pal.name },
    onClick: () => {
      banner = "";
      go({ name: "pal", id: pal.id, tab: "talk" });
    },
  },
    portrait(pal),
    el("span", { class: "name", text: pal.name }),
    tummy(pal.snacks)
  );
}

function emptyArt() {
  return el("div", { class: "empty-art", "aria-hidden": "true" });
}

function renderCamera() {
  if (view.error) return renderCameraError();
  const video = el("video");
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  return el("section", { class: "screen", dataset: { screen: "camera" } },
    bannerNode(),
    topBar("Shelf", () => go({ name: "shelf" })),
    el("h2", { text: "Hold your pal in the light" }),
    el("p", { class: "hint", dataset: { cameraStatus: "1" }, text: "Opening the camera…" }),
    el("div", { class: "viewfinder" }, video),
    el("button", {
      class: "shutter",
      type: "button",
      dataset: { action: "snap" },
      disabled: true,
      onClick: onSnap,
    }, "Snap"),
    el("button", {
      class: "texty",
      type: "button",
      dataset: { action: "capture-file" },
      onClick: () => fileInput.click(),
    }, "Open the camera app")
  );
}

function renderCameraError() {
  return el("section", { class: "screen", dataset: { screen: "camera", cameraError: "1" } },
    bannerNode(),
    topBar("Shelf", () => go({ name: "shelf" })),
    el("div", { class: "notice" },
      el("h2", { text: "Camera" }),
      el("p", { dataset: { cameraMessage: "1" }, text: view.error })
    ),
    el("div", { class: "dock stack" },
      el("button", {
        class: "primary",
        type: "button",
        dataset: { action: "try-again" },
        onClick: () => {
          banner = "";
          go({ name: "camera" });
        },
      }, "Try again"),
      el("button", {
        class: "secondary",
        type: "button",
        dataset: { action: "capture-file" },
        onClick: () => fileInput.click(),
      }, "Open the camera app")
    )
  );
}

async function bootCamera(screen) {
  const token = ++bootToken;
  const video = screen.querySelector("video");
  const status = screen.querySelector("[data-camera-status]");
  try {
    stream = await openCamera(video);
    if (token !== bootToken || !screen.isConnected) {
      stopStream(stream);
      stream = null;
      return;
    }
    const ready = await waitForFrame(video, () => token === bootToken && screen.isConnected);
    if (!ready) {
      if (token !== bootToken) return;
      stopStream(stream);
      stream = null;
      const err = new Error("timeout");
      err.name = "TimeoutError";
      throw err;
    }
    if (status) status.textContent = "Camera on. Fill the frame with your pal.";
    const snap = screen.querySelector("[data-action=snap]");
    if (snap) snap.disabled = false;
  } catch (err) {
    if (token !== bootToken) return;
    stopStream(stream);
    stream = null;
    view = { name: "camera", error: cameraMessage(err) };
    render();
  }
}

function onSnap() {
  const video = app.querySelector("video");
  const button = app.querySelector("[data-action=snap]");
  if (button) button.disabled = true;
  try {
    const photo = drawPhoto(video);
    banner = "";
    go({ name: "name", photo });
  } catch {
    if (button) button.disabled = false;
    const status = app.querySelector("[data-camera-status]");
    if (status) status.textContent = "The picture was empty. Hold still and tap Snap again.";
  }
}

function renderName() {
  const draft = {
    name: "New pal",
    photo: view.photo,
    outfit: "none",
    makeup: "none",
    moodLine: "",
  };
  const field = el("input", {
    id: "pal-name",
    class: "field",
    maxlength: "18",
    autocomplete: "off",
    autocapitalize: "words",
    placeholder: "A soft name",
    "aria-label": "Pal name",
    value: view.draft || "",
  });
  field.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      savePal(field.value);
    }
  });
  return el("section", { class: "screen", dataset: { screen: "name" } },
    bannerNode(),
    topBar("Back", () => go({ name: "camera" })),
    el("div", { class: "name-photo" }, portrait(draft, { large: true })),
    el("h2", { text: "What should we call this pal?" }),
    field,
    el("div", { class: "chips" }, NAME_IDEAS.map((idea) => el("button", {
      class: "chip",
      type: "button",
      onClick: () => {
        field.value = idea;
        field.focus();
      },
    }, idea))),
    el("div", { class: "dock" },
      el("button", {
        class: "primary",
        type: "button",
        dataset: { action: "save-pal" },
        onClick: () => savePal(field.value),
      }, "Keep on the shelf")
    )
  );
}

function savePal(rawName) {
  const name = String(rawName || "").replace(/\s+/g, " ").trim().slice(0, 18);
  if (!name) {
    banner = "Give your pal a name first.";
    view = { ...view, draft: "" };
    render();
    return;
  }
  if (!isSoft(name)) {
    banner = "Pick a kind name. This shelf is a soft place.";
    view = { ...view, draft: "" };
    render();
    return;
  }
  if (state.pals.length >= SHELF_LIMIT) {
    banner = "The shelf can hold 12 pals. Let one hop off first.";
    render();
    return;
  }
  const pal = {
    id: crypto.randomUUID(),
    name,
    photo: view.photo,
    outfit: "none",
    makeup: "none",
    snacks: 0,
    moodLine: `Hi. I am ${name}. Tell me something.`,
    chat: [],
  };
  state.pals.unshift(pal);
  if (!persist()) {
    state.pals.shift();
    saveState(state);
    view = { ...view, draft: name };
    render();
    return;
  }
  announce(pal.moodLine);
  go({ name: "pal", id: pal.id, tab: "talk", bounce: true });
}

function renderPal(bounce) {
  const pal = currentPal();
  if (!pal) {
    view = { name: "shelf" };
    return renderShelf();
  }
  const tab = view.tab || "talk";
  return el("section", { class: "screen pal-screen", dataset: { screen: "pal", palName: pal.name } },
    bannerNode(),
    el("header", { class: "top" },
      el("button", {
        class: "back",
        type: "button",
        dataset: { action: "back" },
        onClick: () => go({ name: "shelf" }),
      }, "Shelf"),
      el("h2", { class: "pal-title", text: pal.name }),
      el("button", {
        class: "quiet",
        type: "button",
        dataset: { action: "hop" },
        onClick: () => hopOff(pal),
      }, view.confirmHop ? "Yes, hop off" : "Hop off")
    ),
    el("div", { class: "stage" }, portrait(pal, { large: true, bubble: true, hop: bounce })),
    el("div", { class: "tabs", role: "tablist" },
      tabButton("talk", "Talk", tab),
      tabButton("snack", "Snack", tab),
      tabButton("dress", "Dress", tab)
    ),
    tab === "talk" ? talkPanel(pal) : tab === "snack" ? snackPanel(pal) : dressPanel(pal)
  );
}

function tabButton(id, label, current) {
  const on = id === current;
  return el("button", {
    class: on ? "tab on" : "tab",
    type: "button",
    role: "tab",
    "aria-selected": on ? "true" : "false",
    dataset: { action: "tab", tab: id },
    onClick: () => {
      view = { ...view, tab: id, confirmHop: false };
      render();
    },
  }, label);
}

function talkPanel(pal) {
  const field = el("input", {
    id: "say-line",
    class: "field",
    maxlength: "160",
    autocomplete: "off",
    placeholder: "Say something…",
    "aria-label": `Say something to ${pal.name}`,
    enterkeyhint: "send",
  });
  field.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      sendLine(field.value);
    }
  });
  return el("div", { class: "panel", dataset: { panel: "talk" } },
    el("div", { class: "log" }, pal.chat.length
      ? pal.chat.map((line) => el("p", {
          class: line.role === "you" ? "chat you" : "chat pal",
        },
          el("span", { class: "who", text: line.role === "you" ? "You" : pal.name }),
          el("span", {
            class: "msg",
            text: line.text,
            dataset: line.role === "pal" ? { reply: "log" } : undefined,
          })
        ))
      : el("p", { class: "hint", text: "Type or speak a short line. The reply uses your words." })),
    el("div", { class: "composer" },
      field,
      el("button", {
        class: "mic",
        type: "button",
        dataset: { action: "mic" },
        "aria-label": "Speak a line",
        "aria-pressed": "false",
        onClick: () => speakLine(),
      }, "Speak")
    ),
    el("button", {
      class: "primary",
      type: "button",
      dataset: { action: "say" },
      onClick: () => sendLine(field.value),
    }, "Say it"),
    el("p", { class: "fine", dataset: { talkStatus: "1" }, text: "Answers are made on this phone from your words." })
  );
}

function sendLine(raw) {
  const pal = currentPal();
  if (!pal) return;
  const text = String(raw || "").trim();
  const reply = makeReply(text);
  if (!reply) {
    const status = app.querySelector("[data-talk-status]");
    if (status) status.textContent = "Say a little something first.";
    return;
  }
  stopListening();
  pal.chat.push({ role: "you", text: text.slice(0, 160) });
  pal.chat.push({ role: "pal", text: reply });
  pal.chat = pal.chat.slice(-12);
  pal.moodLine = reply;
  persist();
  announce(`${pal.name} says: ${reply}`);
  view = { ...view, tab: "talk", bounce: true, confirmHop: false };
  render();
}

function speakLine() {
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  const status = app.querySelector("[data-talk-status]");
  const button = app.querySelector("[data-action=mic]");
  if (!Ctor) {
    if (status) status.textContent = "This browser cannot hear right now. Type your line instead.";
    return;
  }
  if (listening) {
    stopListening();
    if (button) button.setAttribute("aria-pressed", "false");
    if (status) status.textContent = "Answers are made on this phone from your words.";
    return;
  }
  const rec = new Ctor();
  recognition = rec;
  listening = true;
  rec.lang = "en-US";
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  if (button) button.setAttribute("aria-pressed", "true");
  if (status) status.textContent = "Listening…";
  rec.onresult = (event) => {
    const said = event.results?.[0]?.[0]?.transcript || "";
    listening = false;
    recognition = null;
    if (said.trim()) sendLine(said);
    else if (status) status.textContent = "I could not hear that. Try again, or type it.";
  };
  rec.onerror = (event) => {
    listening = false;
    recognition = null;
    const node = app.querySelector("[data-talk-status]");
    const mic = app.querySelector("[data-action=mic]");
    if (mic) mic.setAttribute("aria-pressed", "false");
    if (!node) return;
    node.textContent = event.error === "not-allowed"
      ? "The microphone is blocked. Allow it, or type your line."
      : "I could not hear that. Try again, or type it.";
  };
  rec.onend = () => {
    listening = false;
    const mic = app.querySelector("[data-action=mic]");
    if (mic) mic.setAttribute("aria-pressed", "false");
  };
  try {
    rec.start();
  } catch {
    listening = false;
    if (status) status.textContent = "This browser cannot hear right now. Type your line instead.";
  }
}

function snackPanel(pal) {
  const full = pal.snacks >= 5;
  return el("div", { class: "panel", dataset: { panel: "snack" } },
    el("div", { class: "tummy-row" },
      el("span", { text: full ? "Full of wiggles" : "Tummy" }),
      tummy(pal.snacks)
    ),
    el("div", { class: "snacks" }, SNACKS.map((snack) => el("button", {
      class: "snack",
      type: "button",
      dataset: { action: "snack", snack: snack.id },
      disabled: full,
      onClick: () => feed(snack.id),
    }, snackIcon(snack.id), el("span", { text: snack.name })))),
    el("p", {
      class: "hint",
      text: full
        ? `${pal.name} is full of wiggles. No more snacks for now.`
        : "Tap a snack to share it.",
    })
  );
}

function feed(id) {
  const pal = currentPal();
  const snack = SNACKS.find((item) => item.id === id);
  if (!pal || !snack || pal.snacks >= 5) return;
  pal.snacks += 1;
  pal.moodLine = pal.snacks >= 5
    ? `${snack.line} ${pal.name} is full of wiggles.`
    : snack.line;
  persist();
  announce(pal.moodLine);
  view = { ...view, tab: "snack", bounce: true, confirmHop: false };
  render();
}

function dressPanel(pal) {
  return el("div", { class: "panel", dataset: { panel: "dress" } },
    el("p", { class: "look-now", text: lookSentence(pal) }),
    el("p", { class: "label", text: "Outfits" }),
    el("div", { class: "chips" }, OUTFITS.map((item) => choiceChip("outfit", item, pal.outfit))),
    el("p", { class: "label", text: "Makeup" }),
    el("div", { class: "chips" }, MAKEUP.map((item) => choiceChip("makeup", item, pal.makeup)))
  );
}

function lookSentence(pal) {
  const outfit = byId(OUTFITS, pal.outfit);
  const makeup = byId(MAKEUP, pal.makeup);
  if (outfit.id === "none" && makeup.id === "none") return "No outfit yet. Pick a look.";
  if (outfit.id === "none") return `Makeup: ${makeup.name}.`;
  if (makeup.id === "none") return `Wearing ${outfit.name}.`;
  return `Wearing ${outfit.name} and ${makeup.name}.`;
}

function choiceChip(kind, item, current) {
  const on = item.id === current;
  return el("button", {
    class: on ? "chip on" : "chip",
    type: "button",
    "aria-pressed": on ? "true" : "false",
    dataset: { action: kind, [kind]: item.id },
    onClick: () => applyLook(kind, item.id),
  }, item.name);
}

function applyLook(kind, id) {
  const pal = currentPal();
  const list = kind === "outfit" ? OUTFITS : MAKEUP;
  const item = list.find((entry) => entry.id === id);
  if (!pal || !item || pal[kind] === id) return;
  pal[kind] = id;
  pal.moodLine = item.line;
  persist();
  announce(item.line);
  view = { ...view, tab: "dress", bounce: true, confirmHop: false };
  render();
}

function hopOff(pal) {
  if (!view.confirmHop) {
    view = { ...view, confirmHop: true };
    render();
    return;
  }
  state.pals = state.pals.filter((item) => item.id !== pal.id);
  persist();
  announce(`${pal.name} hopped off the shelf.`);
  go({ name: "shelf" });
}

function topBar(label, onClick) {
  return el("header", { class: "top" },
    el("button", { class: "back", type: "button", onClick }, label)
  );
}

function snackIcon(id) {
  const colors = {
    cookie: "#e0a15a",
    berry: "#8d4fbf",
    milk: "#f7f1e6",
    honey: "#f0b429",
  };
  return el("span", {
    class: `snack-icon ${id}`,
    "aria-hidden": "true",
    style: `--snack:${colors[id] || "#f0b429"}`,
  });
}

render();
