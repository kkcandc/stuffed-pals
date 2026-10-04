import { el } from "./dom.js";
import { mountStage } from "./stage.js";

export function portrait(pal, { large = false, hop = false } = {}) {
  const frame = el("div", {
    class: `portrait${large ? " large" : ""}${hop ? " hop" : ""}`,
    role: "img",
    "aria-label": `${pal.name}, a stuffed pal`,
  });
  mountStage(frame, pal, { live: large });
  return frame;
}

export function tummy(count) {
  const row = el("div", { class: "tummy", "aria-label": `${count} of 5 snacks` });
  for (let i = 0; i < 5; i += 1) {
    row.append(el("span", { class: i < count ? "dot full" : "dot" }));
  }
  return row;
}
