import { cameraMessage, drawPhoto, fileToPhoto, openCamera, stopStream, waitForFrame } from "./camera.js";
import { el } from "./dom.js";
import { detectFaceFromUrl } from "./face.js";
import { MAKEUP, NAME_IDEAS, OUTFITS, SHELF_LIMIT, SNACKS, byId } from "./looks.js";
import { portrait, tummy } from "./portrait.js";
import { isSoft, makeReply } from "./reply.js";
import { loadState, saveState } from "./store.js";
import { funnyUtteranceSettings, pickFunnyVoice } from "./voice.js";

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
let pendingSpeech = "";
let talkTimer = 0;
let speechGen = 0;

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
  hush();
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
  const line = pendingSpeech;
  pendingSpeech = "";
  const screen = {
    shelf: () => renderShelf(),
    camera: () => renderCamera(),
    name: () => renderName(),
    pal: () => renderPal(bounce),
  }[view.name]();
  app.replaceChildren(screen);
  hush();
  document.title = view.name === "pal" && currentPal()
    ? `${currentPal().name} · Stuffed Pals`
    : "Stuffed Pals";
  fitType();
  if (view.name === "camera" && !view.error) bootCamera(screen);
  if (line) requestAnimationFrame(() => speakAloud(line));
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
        ? "Point the camera at a stuffed animal. That photo becomes a 3D pal, and it stays on this phone."
        : `${count} ${count === 1 ? "pal" : "pals"} on the shelf. Each photo stays on this phone.`,
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

async function savePal(rawName) {
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
  unlockVoice();
  let landmarks = null;
  try {
    landmarks = await detectFaceFromUrl(view.photo);
  } catch {
    landmarks = null;
  }
  const pal = {
    id: crypto.randomUUID(),
    name,
    photo: view.photo,
    outfit: "none",
    makeup: "none",
    snacks: 0,
    landmarks,
  };
  state.pals.unshift(pal);
  if (!persist()) {
    state.pals.shift();
    saveState(state);
    view = { ...view, draft: name };
    render();
    return;
  }
  pendingSpeech = `Hi! I am ${name}. Say something to me.`;
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
    el("div", { class: "stage" }, portrait(pal, { large: true, hop: bounce })),
    el("p", { class: "caption", dataset: { caption: "1" } }),
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
  return el("div", { class: "panel", dataset: { panel: "talk" } },
    el("button", {
      class: "primary talk-btn",
      type: "button",
      dataset: { action: "talk" },
      "aria-pressed": "false",
      onClick: () => startTalk(pal),
    }, `Talk to ${pal.name}`),
    el("p", {
      class: "hint",
      dataset: { talkStatus: "1" },
      text: `Tap, then say something. ${pal.name} answers out loud.`,
    }),
    el("p", { class: "fine", text: "Answers are made on this phone from your words." })
  );
}

function startTalk(pal) {
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  const status = app.querySelector("[data-talk-status]");
  const button = app.querySelector("[data-action=talk]");
  if (!Ctor) {
    if (status) status.textContent = "This phone cannot hear right now. Tap Try again.";
    if (button) button.textContent = "Try again";
    return;
  }
  if (listening) {
    stopListening();
    if (button) {
      button.setAttribute("aria-pressed", "false");
      button.textContent = `Talk to ${pal.name}`;
    }
    return;
  }
  hush();
  unlockVoice();
  const rec = new Ctor();
  recognition = rec;
  listening = true;
  rec.lang = "en-US";
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  if (button) {
    button.setAttribute("aria-pressed", "true");
    button.textContent = "Listening…";
  }
  if (status) status.textContent = "Listening…";
  rec.onresult = (event) => {
    const said = event.results?.[0]?.[0]?.transcript || "";
    listening = false;
    recognition = null;
    resetTalkButton(pal);
    if (said.trim()) answerSpoken(said);
    else if (status) status.textContent = "I could not hear that. Tap and try again.";
  };
  rec.onerror = (event) => {
    listening = false;
    recognition = null;
    resetTalkButton(pal);
    const node = app.querySelector("[data-talk-status]");
    const talk = app.querySelector("[data-action=talk]");
    if (talk) talk.textContent = "Try again";
    if (!node) return;
    node.textContent = event.error === "not-allowed"
      ? "The microphone is blocked. Allow microphone access in your browser, then tap Try again."
      : "I could not hear that. Tap and try again.";
  };
  rec.onend = () => {
    listening = false;
    const talk = app.querySelector("[data-action=talk]");
    if (talk && talk.getAttribute("aria-pressed") === "true") resetTalkButton(pal);
  };
  try {
    rec.start();
  } catch {
    listening = false;
    resetTalkButton(pal);
    if (status) status.textContent = "This phone cannot hear right now. Tap Try again.";
  }
}

function resetTalkButton(pal) {
  const button = app.querySelector("[data-action=talk]");
  if (!button) return;
  button.setAttribute("aria-pressed", "false");
  button.textContent = `Talk to ${pal.name}`;
}

function answerSpoken(said) {
  const pal = currentPal();
  if (!pal) return;
  const reply = makeReply(said);
  const status = app.querySelector("[data-talk-status]");
  if (!reply) {
    if (status) status.textContent = "I could not hear that. Tap and try again.";
    return;
  }
  if (status) status.textContent = `${pal.name} is talking.`;
  speakAloud(reply);
}

function unlockVoice() {
  if (!window.speechSynthesis) return;
  const primer = new SpeechSynthesisUtterance(" ");
  primer.volume = 0;
  primer.rate = 2;
  window.speechSynthesis.speak(primer);
}

function hush() {
  speechGen += 1;
  window.clearTimeout(talkTimer);
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  const portraitNode = app.querySelector(".portrait.large");
  if (portraitNode) portraitNode.classList.remove("talking");
}

function speakAloud(line) {
  const pal = currentPal();
  if (!line || !pal || !window.speechSynthesis) return;
  const gen = ++speechGen;
  window.speechSynthesis.cancel();
  const caption = app.querySelector("[data-caption]");
  const portraitNode = app.querySelector(".portrait.large");
  if (caption) {
    caption.textContent = line;
    caption.dataset.reply = "latest";
  }
  if (portraitNode) portraitNode.classList.add("talking");
  announce(`${pal.name} says: ${line}`);
  const settings = funnyUtteranceSettings();
  const utter = new SpeechSynthesisUtterance(`${line} Hee hee!`);
  utter.pitch = settings.pitch;
  utter.rate = settings.rate;
  utter.volume = settings.volume;
  utter.lang = "en-US";
  const voice = pickFunnyVoice(window.speechSynthesis.getVoices());
  if (voice) utter.voice = voice;
  const stopMouth = () => {
    if (gen !== speechGen) return;
    if (portraitNode?.isConnected) portraitNode.classList.remove("talking");
    const status = app.querySelector("[data-talk-status]");
    if (status?.isConnected && status.textContent === `${pal.name} is talking.`) {
      status.textContent = `Tap, then say something. ${pal.name} answers out loud.`;
    }
  };
  utter.onend = stopMouth;
  utter.onerror = stopMouth;
  window.clearTimeout(talkTimer);
  let started = false;
  const begin = () => {
    if (started || gen !== speechGen || !portraitNode?.isConnected) return;
    started = true;
    const picked = pickFunnyVoice(window.speechSynthesis.getVoices());
    if (picked) utter.voice = picked;
    window.speechSynthesis.speak(utter);
  };
  if (window.speechSynthesis.getVoices().length) begin();
  else {
    window.speechSynthesis.addEventListener("voiceschanged", begin, { once: true });
    window.setTimeout(begin, 1200);
  }
  talkTimer = window.setTimeout(stopMouth, Math.min(14000, 900 + line.length * 90));
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
  const line = pal.snacks >= 5
    ? `${snack.line} ${pal.name} is full of wiggles.`
    : snack.line;
  persist();
  pendingSpeech = line;
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
  persist();
  pendingSpeech = item.line;
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

if (window.speechSynthesis) window.speechSynthesis.getVoices();
render();
