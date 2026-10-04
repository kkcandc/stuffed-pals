import { el, svg } from "./dom.js";

function star(cx, cy, r, fill) {
  const points = [];
  for (let i = 0; i < 5; i += 1) {
    const outer = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const inner = outer + Math.PI / 5;
    points.push([cx + Math.cos(outer) * r, cy + Math.sin(outer) * r]);
    points.push([cx + Math.cos(inner) * r * 0.42, cy + Math.sin(inner) * r * 0.42]);
  }
  return svg("polygon", {
    points: points.map((pair) => pair.map((n) => n.toFixed(1)).join(",")).join(" "),
    fill,
    stroke: "#2a211c",
    "stroke-width": 2,
  });
}

function bow() {
  return svg("g", { transform: "translate(150 86)" },
    svg("ellipse", { cx: -40, cy: 0, rx: 42, ry: 28, fill: "#f2c14e", stroke: "#2a211c", "stroke-width": 4 }),
    svg("ellipse", { cx: 40, cy: 0, rx: 42, ry: 28, fill: "#f6d36a", stroke: "#2a211c", "stroke-width": 4 }),
    svg("polygon", { points: "-12,8 -34,52 -6,44", fill: "#f2c14e", stroke: "#2a211c", "stroke-width": 3 }),
    svg("polygon", { points: "12,8 34,52 6,44", fill: "#f6d36a", stroke: "#2a211c", "stroke-width": 3 }),
    svg("circle", { cx: 0, cy: 2, r: 15, fill: "#e07a32", stroke: "#2a211c", "stroke-width": 4 })
  );
}

function hat() {
  return svg("g", {},
    svg("polygon", { points: "150,12 222,112 78,112", fill: "#e25b45", stroke: "#2a211c", "stroke-width": 4 }),
    svg("rect", { x: 64, y: 104, width: 172, height: 18, rx: 8, fill: "#f2c14e", stroke: "#2a211c", "stroke-width": 3 }),
    svg("circle", { cx: 150, cy: 48, r: 7, fill: "#fffaf4" }),
    svg("circle", { cx: 150, cy: 72, r: 6, fill: "#2a211c" })
  );
}

function scarf() {
  return svg("g", {},
    svg("path", {
      d: "M18 262 C100 236 200 236 282 262 L292 314 C200 292 100 292 8 314 Z",
      fill: "#2f7d68",
      stroke: "#2a211c",
      "stroke-width": 4,
    }),
    svg("path", { d: "M36 284 H264", stroke: "#f3eadf", "stroke-width": 7, "stroke-linecap": "round" }),
    svg("path", { d: "M32 302 H270", stroke: "#f2c14e", "stroke-width": 7, "stroke-linecap": "round" }),
    svg("path", { d: "M78 314 v22 M108 312 v26 M210 312 v26 M240 314 v22", stroke: "#f2c14e", "stroke-width": 5, "stroke-linecap": "round" })
  );
}

function glasses() {
  return svg("g", {},
    svg("circle", { cx: 112, cy: 176, r: 36, fill: "rgba(255,250,244,0.28)", stroke: "#2a211c", "stroke-width": 6 }),
    svg("circle", { cx: 196, cy: 176, r: 36, fill: "rgba(255,250,244,0.28)", stroke: "#2a211c", "stroke-width": 6 }),
    svg("path", { d: "M148 176 H160", stroke: "#2a211c", "stroke-width": 6, "stroke-linecap": "round" }),
    svg("path", { d: "M76 170 H78 M232 170 H234", stroke: "#2a211c", "stroke-width": 6, "stroke-linecap": "round" }),
    star(112, 176, 14, "#f2c14e"),
    star(196, 176, 14, "#f2c14e")
  );
}

function rosy() {
  return svg("g", {},
    svg("ellipse", { cx: 92, cy: 214, rx: 34, ry: 22, fill: "#ff6b8a", opacity: "0.82" }),
    svg("ellipse", { cx: 214, cy: 214, rx: 34, ry: 22, fill: "#ff6b8a", opacity: "0.82" })
  );
}

function berryLips() {
  return svg("path", {
    d: "M118 268 Q150 292 182 268 Q168 278 150 280 Q132 278 118 268 Z",
    fill: "#c23b55",
    stroke: "#7a2034",
    "stroke-width": 2,
    opacity: "0.92",
  });
}

function sparkles() {
  return svg("g", {},
    star(78, 188, 10, "#ffe08a"),
    star(98, 214, 7, "#fffaf4"),
    star(70, 228, 6, "#f2c14e"),
    star(230, 188, 10, "#ffe08a"),
    star(214, 214, 7, "#fffaf4"),
    star(236, 230, 6, "#f2c14e")
  );
}

const OUTFIT_ART = { bow, hat, scarf, glasses };
const MAKEUP_ART = { rosy, berry: berryLips, sparkle: sparkles };

export function wearSvg(outfit, makeup) {
  const parts = [];
  if (MAKEUP_ART[makeup]) parts.push(MAKEUP_ART[makeup]());
  if (OUTFIT_ART[outfit]) parts.push(OUTFIT_ART[outfit]());
  return svg("svg", {
    class: "wear",
    viewBox: "0 0 300 400",
    "aria-hidden": "true",
  }, parts);
}

export function portrait(pal, { large = false, bubble = false, hop = false } = {}) {
  const frame = el("div", { class: `portrait${large ? " large" : ""}${hop ? " hop" : ""}` });
  const img = el("img", {
    src: pal.photo,
    alt: `${pal.name}, a stuffed pal`,
    draggable: "false",
  });
  frame.append(img, wearSvg(pal.outfit, pal.makeup));
  if (bubble && pal.moodLine) {
    frame.append(
      el("div", { class: "bubble" },
        el("p", { class: "who", text: pal.name }),
        el("p", { class: "said", text: pal.moodLine, dataset: { reply: "latest" } })
      )
    );
  }
  return frame;
}

export function tummy(count) {
  const row = el("div", { class: "tummy", "aria-label": `${count} of 5 snacks` });
  for (let i = 0; i < 5; i += 1) {
    row.append(el("span", { class: i < count ? "dot full" : "dot" }));
  }
  return row;
}
