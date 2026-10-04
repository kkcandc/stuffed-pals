import { el, svg } from "./dom.js";
import { featurePoints } from "./face.js";

function star(cx, cy, r, fill) {
  const points = [];
  for (let i = 0; i < 5; i += 1) {
    const outer = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const inner = outer + Math.PI / 5;
    points.push([cx + Math.cos(outer) * r, cy + Math.sin(outer) * r]);
    points.push([cx + Math.cos(inner) * r * 0.42, cy + Math.sin(inner) * r * 0.42]);
  }
  return svg("polygon", {
    points: points.map((pair) => pair.map((n) => n.toFixed(1)).join(" ")).join(" "),
    fill,
    stroke: "#2a211c",
    "stroke-width": 3,
  });
}

function piece(className, point, anchor = "c") {
  const node = el("div", { class: `piece ${className} anchor-${anchor}` });
  node.style.left = `${point.x * 100}%`;
  node.style.top = `${point.y * 100}%`;
  node.style.width = `${point.w * 100}%`;
  return node;
}

function bowArt() {
  return svg("svg", { viewBox: "0 0 120 70", "aria-hidden": "true" },
    svg("ellipse", { cx: "34", cy: "30", rx: "28", ry: "20", fill: "#f2c14e", stroke: "#2a211c", "stroke-width": "4" }),
    svg("ellipse", { cx: "86", cy: "30", rx: "28", ry: "20", fill: "#f6d36a", stroke: "#2a211c", "stroke-width": "4" }),
    svg("polygon", { points: "40,36 18,66 46,58", fill: "#f2c14e", stroke: "#2a211c", "stroke-width": "3" }),
    svg("polygon", { points: "80,36 102,66 74,58", fill: "#f6d36a", stroke: "#2a211c", "stroke-width": "3" }),
    svg("circle", { cx: "60", cy: "32", r: "12", fill: "#e07a32", stroke: "#2a211c", "stroke-width": "4" })
  );
}

function hatArt() {
  return svg("svg", { viewBox: "0 0 140 110", "aria-hidden": "true" },
    svg("polygon", { points: "70,6 124,78 16,78", fill: "#e25b45", stroke: "#2a211c", "stroke-width": "4" }),
    svg("rect", { x: "8", y: "74", width: "124", height: "16", rx: "8", fill: "#f2c14e", stroke: "#2a211c", "stroke-width": "4" }),
    svg("circle", { cx: "70", cy: "36", r: "6", fill: "#fffaf4" }),
    svg("circle", { cx: "70", cy: "54", r: "5", fill: "#2a211c" })
  );
}

function scarfArt() {
  return svg("svg", { viewBox: "0 0 200 70", "aria-hidden": "true" },
    svg("path", {
      d: "M8 20 C50 4 150 4 192 20 L198 46 C150 34 50 34 2 46 Z",
      fill: "#2f7d68",
      stroke: "#2a211c",
      "stroke-width": "4",
    }),
    svg("path", { d: "M24 30 H176", stroke: "#f3eadf", "stroke-width": "6", "stroke-linecap": "round" }),
    svg("path", { d: "M20 42 H180", stroke: "#f2c14e", "stroke-width": "6", "stroke-linecap": "round" })
  );
}

function wearLayer(pal) {
  const fit = el("div", { class: "fit" });
  if (!pal.landmarks) return fit;
  const points = featurePoints(pal.landmarks);
  const outfit = pal.outfit;
  const makeup = pal.makeup;

  if (makeup === "rosy") {
    fit.append(piece("cheek", points.leftCheek), piece("cheek", points.rightCheek));
  }
  if (makeup === "berry") {
    fit.append(piece("lips", points.lips));
  }
  if (makeup === "sparkle") {
    const left = piece("spark", points.sparkleL);
    const right = piece("spark", points.sparkleR);
    left.append(svg("svg", { viewBox: "0 0 20 20" }, star(10, 10, 8, "#ffe08a")));
    right.append(svg("svg", { viewBox: "0 0 20 20" }, star(10, 10, 8, "#ffe08a")));
    fit.append(left, right);
  }
  if (outfit === "glasses") {
    const left = piece("lens", points.glassesLeft);
    const right = piece("lens", points.glassesRight);
    left.append(svg("svg", { viewBox: "0 0 20 20" }, star(10, 10, 5, "#f2c14e")));
    right.append(svg("svg", { viewBox: "0 0 20 20" }, star(10, 10, 5, "#f2c14e")));
    fit.append(piece("bridge", points.bridge), left, right);
  }
  if (outfit === "bow") {
    const bow = piece("bow", points.bow);
    bow.append(bowArt());
    fit.append(bow);
  }
  if (outfit === "hat") {
    const hat = piece("hat", points.hat, "b");
    hat.append(hatArt());
    fit.append(hat);
  }
  if (outfit === "scarf") {
    const scarf = piece("scarf", points.scarf);
    scarf.append(scarfArt());
    fit.append(scarf);
  }

  const mouth = piece("mouth", points.mouth);
  mouth.append(el("span", { class: "tongue" }));
  fit.append(mouth);
  return fit;
}

function bindFit(frame) {
  const img = frame.querySelector("img");
  const fit = frame.querySelector(".fit");
  if (!fit) return;
  const layout = () => {
    const cw = frame.clientWidth;
    const ch = frame.clientHeight;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    if (!cw || !ch || !iw || !ih) return;
    const scale = Math.max(cw / iw, ch / ih);
    const w = iw * scale;
    const h = ih * scale;
    fit.style.width = `${w}px`;
    fit.style.height = `${h}px`;
    fit.style.left = `${(cw - w) / 2}px`;
    fit.style.top = `${(ch - h) / 2}px`;
    fit.classList.add("ready");
  };
  if (img.complete && img.naturalWidth) layout();
  else img.addEventListener("load", layout);
  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(layout);
    observer.observe(frame);
  }
}

export function portrait(pal, { large = false, hop = false } = {}) {
  const frame = el("div", {
    class: `portrait${large ? " large" : ""}${hop ? " hop" : ""}`,
  });
  const img = el("img", {
    src: pal.photo,
    alt: `${pal.name}, a stuffed pal`,
    draggable: "false",
  });
  frame.append(img, wearLayer(pal));
  bindFit(frame);
  return frame;
}

export function tummy(count) {
  const row = el("div", { class: "tummy", "aria-label": `${count} of 5 snacks` });
  for (let i = 0; i < 5; i += 1) {
    row.append(el("span", { class: i < count ? "dot full" : "dot" }));
  }
  return row;
}
