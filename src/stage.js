// Shows the photo as a stuffed 3D figure on the phone. The mesh is built
// here from the picture. No rebuild service and no API key.

import {
  AmbientLight,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  PerspectiveCamera,
  Scene,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
  WebGLRenderer,
} from "three";
import { detectFace } from "./face.js";
import { buildPlush } from "./plush.js";

const seen = new Set();
const shotQueue = [];
let pumping = false;

export function mountStage(frame, pal, { live = false } = {}) {
  const canvas = document.createElement("canvas");
  canvas.className = "plush-view";
  frame.append(canvas);
  const job = { frame, canvas, pal, live };
  const run = live ? runLive(job) : enqueueShot(job);
  run.catch(() => fallback(job));
}

function enqueueShot(job) {
  shotQueue.push(job);
  return pumpShots();
}

async function pumpShots() {
  if (pumping) return;
  pumping = true;
  try {
    while (shotQueue.length) {
      const job = shotQueue.shift();
      if (!job.frame.isConnected) continue;
      try {
        await renderShot(job);
      } catch {
        fallback(job);
      }
    }
  } finally {
    pumping = false;
  }
}

async function renderShot(job) {
  const built = await prepare(job.pal);
  if (!job.frame.isConnected) {
    built.dispose();
    return;
  }
  const renderer = makeRenderer();
  try {
    renderer.setSize(280, 372, false);
    fitCamera(built.camera, built.fitSize);
    built.update(0.6, false, 1);
    renderer.render(built.scene, built.camera);
    const ctx = job.canvas.getContext("2d");
    job.canvas.width = 280;
    job.canvas.height = 372;
    ctx.drawImage(renderer.domElement, 0, 0);
    job.frame.dataset.plush = "3d";
  } finally {
    built.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }
}

async function runLive(job) {
  const built = await prepare(job.pal);
  if (!job.frame.isConnected) {
    built.dispose();
    return;
  }
  let renderer;
  try {
    renderer = makeRenderer(job.canvas);
  } catch (err) {
    built.dispose();
    throw err;
  }
  renderer.setClearColor(0x000000, 0);
  fitCamera(built.camera, built.fitSize);
  const key = seenKey(job.pal);
  const playIntro = !seen.has(key);
  seen.add(key);
  const started = performance.now();
  let raf = 0;

  const resize = () => {
    const w = job.frame.clientWidth || 240;
    const h = job.frame.clientHeight || 320;
    renderer.setPixelRatio(Math.min(1.75, window.devicePixelRatio || 1));
    renderer.setSize(w, h, false);
    built.camera.aspect = w / Math.max(1, h);
    built.camera.updateProjectionMatrix();
  };
  resize();
  const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
  observer?.observe(job.frame);

  const stop = () => {
    cancelAnimationFrame(raf);
    observer?.disconnect();
    built.dispose();
    renderer.dispose();
  };

  const tick = (now) => {
    if (!job.frame.isConnected) {
      stop();
      return;
    }
    const t = (now - started) / 1000;
    const intro = playIntro ? Math.min(1, t / 1.05) : 1;
    const talking = job.frame.classList.contains("talking");
    built.update(t, talking, intro);
    renderer.render(built.scene, built.camera);
    job.frame.dataset.plush = "3d";
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}

function makeRenderer(canvas) {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "low-power",
    preserveDrawingBuffer: !canvas,
  });
  renderer.outputColorSpace = SRGBColorSpace;
  return renderer;
}

function seenKey(pal) {
  if (pal.id) return `id:${pal.id}`;
  return `photo:${String(pal.photo || "").slice(0, 48)}`;
}

async function prepare(pal) {
  const shot = await loadPixels(pal.photo);
  const marks = pal.landmarks || detectFace(shot.pixels, shot.width, shot.height);
  const mesh = buildPlush(shot.pixels, shot.width, shot.height, marks);
  return createFigure(mesh, pal);
}

function loadPixels(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const maxEdge = 320;
      const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
      const width = Math.max(1, Math.round(img.naturalWidth * scale));
      const height = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, width, height);
      const data = ctx.getImageData(0, 0, width, height);
      resolve({ pixels: data.data, width, height });
    };
    img.onerror = () => reject(new Error("photo"));
    img.src = url;
  });
}

function createFigure(mesh, pal) {
  const disposables = new Set();
  const track = (obj) => {
    disposables.add(obj);
    return obj;
  };
  const geo = track(new BufferGeometry());
  geo.setAttribute("position", new BufferAttribute(mesh.positions, 3));
  geo.setAttribute("color", new BufferAttribute(mesh.colors, 3));
  geo.setIndex(new BufferAttribute(mesh.indices, 1));
  geo.computeVertexNormals();
  const fur = track(new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.84,
    metalness: 0.02,
    side: DoubleSide,
  }));
  const body = new Mesh(geo, fur);

  const scene = new Scene();
  scene.add(new AmbientLight(0xfff4e8, 0.82));
  const key = new DirectionalLight(0xfff1e0, 1.25);
  key.position.set(0.45, 1.5, 2.4);
  scene.add(key);
  const fill = new DirectionalLight(0xd5efe6, 0.48);
  fill.position.set(-1.8, 0.2, 1.1);
  scene.add(fill);

  const root = new Group();
  const turn = new Group();
  turn.add(body);
  root.add(turn);
  scene.add(root);

  const anchors = mesh.anchors;
  const span = anchors
    ? Math.max(0.12, Math.hypot(anchors.rightEye.x - anchors.leftEye.x, anchors.rightEye.y - anchors.leftEye.y))
    : 0.24;
  const dress = anchors ? addDress(turn, anchors, span, pal, track) : null;

  const size = new Vector3();
  body.geometry.computeBoundingBox();
  const box = body.geometry.boundingBox;
  const minY = box.min.y;
  size.subVectors(box.max, box.min);
  const shadow = new Mesh(
    track(new CircleGeometry(Math.max(size.x, size.z) * 0.42, 28)),
    track(new MeshBasicMaterial({ color: 0xc4a07a, transparent: true, opacity: 0.32 })),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = minY - 0.03;
  scene.add(shadow);

  const camera = new PerspectiveCamera(26, 3 / 4, 0.05, 20);
  const fitSize = Math.max(size.x, size.y);

  return {
    scene,
    camera,
    fitSize,
    update(t, talking, intro) {
      const ease = 1 - (1 - intro) ** 3;
      turn.scale.set(0.94 + 0.06 * ease, 0.94 + 0.06 * ease, 0.045 + 0.955 * ease);
      const wobble = Math.sin(t * 0.7) * 0.055 * ease;
      turn.rotation.y = 0.02 + 0.24 * ease + wobble;
      turn.rotation.z = Math.sin(t * 0.85) * 0.03 * ease;
      const bob = Math.sin(t * 2.15) * 0.04;
      root.position.y = bob + (talking ? Math.sin(t * 7.5) * 0.012 : 0);
      shadow.scale.setScalar(1 - bob * 0.8);
      if (dress) dress.step(t, talking);
    },
    dispose() {
      for (const item of disposables) item.dispose();
      disposables.clear();
    },
  };
}

function fitCamera(camera, fitSize) {
  const dist = (fitSize * 0.62) / Math.tan((camera.fov * Math.PI) / 360);
  camera.position.set(0, fitSize * 0.04, dist);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
}

function addDress(turn, anchors, span, pal, track) {
  const lidRgb = anchors.leftEye.fur || anchors.forehead.color;
  const furColor = new Color(lidRgb[0], lidRgb[1], lidRgb[2]);
  const ink = track(new MeshStandardMaterial({ color: 0x2a211c, roughness: 0.4, metalness: 0.15 }));
  const gold = track(new MeshStandardMaterial({ color: 0xf2c14e, roughness: 0.48 }));
  const mouthMat = track(new MeshStandardMaterial({
    color: pal.makeup === "berry" ? 0xc23b55 : 0x3b221f,
    roughness: 0.55,
  }));
  const tongueMat = track(new MeshStandardMaterial({ color: 0xe56b84, roughness: 0.45 }));

  const mouth = new Mesh(track(new SphereGeometry(1, 16, 12)), mouthMat);
  mouth.position.set(anchors.mouth.x, anchors.mouth.y, anchors.mouth.z + span * 0.16);
  const tongue = new Mesh(track(new SphereGeometry(0.45, 10, 8)), tongueMat);
  tongue.position.set(0, -0.2, 0.15);
  mouth.add(tongue);
  turn.add(mouth);

  const lids = [anchors.leftEye, anchors.rightEye].map((eye) => {
    const lid = new Mesh(track(new SphereGeometry(span * 0.24, 12, 8)), track(new MeshStandardMaterial({
      color: furColor,
      roughness: 0.9,
    })));
    lid.scale.set(1.2, 0.28, 0.4);
    const homeY = eye.y + span * 0.16;
    lid.position.set(eye.x, homeY, eye.z + span * 0.14);
    lid.userData.homeY = homeY;
    lid.userData.eyeY = eye.y;
    turn.add(lid);
    const light = new Mesh(
      track(new SphereGeometry(span * 0.045, 8, 6)),
      track(new MeshBasicMaterial({ color: 0xfffaf4 })),
    );
    light.position.set(eye.x + span * 0.06, eye.y + span * 0.05, eye.z + span * 0.2);
    turn.add(light);
    return { lid, light };
  });

  if (pal.outfit === "glasses") addGlasses(turn, anchors, span, ink, gold, track);
  if (pal.outfit === "bow") addBow(turn, anchors.forehead, span, gold, track);
  if (pal.outfit === "hat") addHat(turn, anchors.hatBrim, span, track);
  if (pal.outfit === "scarf") addScarf(turn, anchors.neck, span, track);
  if (pal.makeup === "rosy") addCheeks(turn, anchors, span, track);
  if (pal.makeup === "sparkle") addSparkles(turn, anchors, span, gold, track);

  return {
    step(t, talking) {
      const open = talking ? 0.22 + Math.abs(Math.sin(t * 16)) * 0.9 : 0.16;
      mouth.scale.set(span * 0.46, span * 0.34 * open, span * 0.18);
      const closed = blinkClosed(t);
      for (const { lid, light } of lids) {
        lid.scale.y = 0.22 + closed * 1.15;
        lid.position.y = lid.userData.homeY - closed * span * 0.14;
        light.visible = closed < 0.55;
      }
    },
  };
}

function blinkClosed(t) {
  const u = t % 3.4;
  if (u < 3.12 || u > 3.36) return 0;
  return Math.sin(((u - 3.12) / 0.24) * Math.PI);
}

function addGlasses(turn, anchors, span, ink, gold, track) {
  const ring = track(new TorusGeometry(span * 0.34, span * 0.04, 8, 18));
  const lensGeo = track(new CircleGeometry(span * 0.28, 18));
  const lensMat = track(new MeshStandardMaterial({
    color: 0xfff6ea,
    transparent: true,
    opacity: 0.2,
    roughness: 0.05,
  }));
  const star = track(starGeometry(span * 0.11));
  for (const eye of [anchors.leftEye, anchors.rightEye]) {
    const z = eye.z + span * 0.22;
    const hoop = new Mesh(ring, ink);
    hoop.position.set(eye.x, eye.y, z);
    turn.add(hoop);
    const lens = new Mesh(lensGeo, lensMat);
    lens.position.set(eye.x, eye.y, z - 0.004);
    turn.add(lens);
    const gem = new Mesh(star, gold);
    gem.position.set(eye.x, eye.y, z + span * 0.04);
    turn.add(gem);
  }
  const bridge = new Mesh(track(new BoxGeometry(span * 0.32, span * 0.045, span * 0.045)), ink);
  bridge.position.set(
    (anchors.leftEye.x + anchors.rightEye.x) / 2,
    (anchors.leftEye.y + anchors.rightEye.y) / 2,
    Math.max(anchors.leftEye.z, anchors.rightEye.z) + span * 0.22,
  );
  turn.add(bridge);
}

function addBow(turn, spot, span, gold, track) {
  const knotMat = track(new MeshStandardMaterial({ color: 0xe07a32, roughness: 0.5 }));
  const loopGeo = track(new SphereGeometry(span * 0.34, 14, 10));
  const z = spot.z + span * 0.28;
  for (const side of [-1, 1]) {
    const loop = new Mesh(loopGeo, gold);
    loop.scale.set(1.5, 0.82, 0.42);
    loop.position.set(spot.x + side * span * 0.46, spot.y + span * 0.08, z);
    turn.add(loop);
    const tail = new Mesh(track(new SphereGeometry(span * 0.14, 10, 8)), gold);
    tail.scale.set(0.7, 1.6, 0.4);
    tail.position.set(spot.x + side * span * 0.5, spot.y - span * 0.34, z);
    turn.add(tail);
  }
  const knot = new Mesh(track(new SphereGeometry(span * 0.1, 12, 8)), knotMat);
  knot.position.set(spot.x, spot.y, z + span * 0.04);
  turn.add(knot);
}

function addHat(turn, spot, span, track) {
  const red = track(new MeshStandardMaterial({ color: 0xe25b45, roughness: 0.55 }));
  const gold = track(new MeshStandardMaterial({ color: 0xf2c14e, roughness: 0.48 }));
  const brim = new Mesh(track(new CylinderGeometry(span * 0.7, span * 0.7, span * 0.08, 20)), gold);
  brim.position.set(spot.x, spot.y, spot.z + span * 0.08);
  turn.add(brim);
  const cone = new Mesh(track(new ConeGeometry(span * 0.42, span * 0.78, 18)), red);
  cone.position.set(spot.x, spot.y + span * 0.4, spot.z + span * 0.08);
  turn.add(cone);
}

function addScarf(turn, spot, span, track) {
  const cloth = track(new MeshStandardMaterial({ color: 0x2f7d68, roughness: 0.7 }));
  const scarf = new Mesh(track(new TorusGeometry(span * 0.62, span * 0.11, 8, 18)), cloth);
  scarf.scale.set(1.35, 0.5, 0.75);
  scarf.position.set(spot.x, spot.y, spot.z + span * 0.05);
  turn.add(scarf);
}

function addCheeks(turn, anchors, span, track) {
  const blush = track(new MeshStandardMaterial({
    color: 0xff5a82,
    transparent: true,
    opacity: 0.62,
    roughness: 0.85,
  }));
  const geo = track(new SphereGeometry(span * 0.13, 12, 8));
  for (const cheek of [anchors.leftCheek, anchors.rightCheek]) {
    const ball = new Mesh(geo, blush);
    ball.scale.set(1.3, 1, 0.45);
    ball.position.set(cheek.x, cheek.y, cheek.z + span * 0.16);
    turn.add(ball);
  }
}

function addSparkles(turn, anchors, span, gold, track) {
  const geo = track(new OctahedronGeometry(span * 0.07, 0));
  const spots = [
    [anchors.leftCheek, -0.1, 0.16],
    [anchors.leftCheek, 0.08, 0.02],
    [anchors.rightCheek, 0.1, 0.16],
    [anchors.rightCheek, -0.08, 0.02],
  ];
  for (const [spot, dx, dy] of spots) {
    const bit = new Mesh(geo, gold);
    bit.position.set(spot.x + span * dx, spot.y + span * dy, spot.z + span * 0.2);
    turn.add(bit);
  }
}

function starGeometry(radius) {
  const shape = new Shape();
  for (let i = 0; i < 10; i += 1) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? radius : radius * 0.42;
    const x = Math.cos(ang) * r;
    const y = Math.sin(ang) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return new ShapeGeometry(shape);
}

function fallback(job) {
  if (!job.frame.isConnected || job.frame.querySelector("img")) return;
  job.canvas?.remove();
  const img = document.createElement("img");
  img.src = job.pal.photo;
  img.alt = `${job.pal.name}, a stuffed pal`;
  img.draggable = false;
  job.frame.dataset.plush = "photo";
  job.frame.append(img);
}
