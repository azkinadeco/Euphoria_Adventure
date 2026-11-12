// Runtime loader for Blender-built props (see blender/build_props.py).
// Every model is optional: callers keep their primitive placeholder until the
// .glb arrives, and keep it for good if the file fails to load.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toon, outline } from './toon.js';

const loader = new GLTFLoader();

// count in-flight GLB loads so boot can wait for them (and their shader compiles) before enabling Start
let pending = 0;
const idleWaiters = [];
const rawLoad = loader.load.bind(loader);
loader.load = (url, onLoad, onProgress, onError) => {
  pending++;
  let done = false;
  const finish = () => { if (done) return; done = true; if (--pending === 0) idleWaiters.splice(0).forEach((r) => r()); };
  rawLoad(url, (g) => { try { onLoad(g); } finally { finish(); } }, onProgress, (e) => { try { onError?.(e); } finally { finish(); } });
};
/** number of model files still loading */
export const pendingModels = () => pending;
/** resolves once no model file is loading */
export const modelsIdle = () => (pending === 0 ? Promise.resolve() : new Promise((r) => idleWaiters.push(r)));
const cache = new Map();
const BASE = import.meta.env.BASE_URL + 'assets/models/';

let toonMat = null, emitMat = null;
const mats = () => {
  if (!toonMat) {
    toonMat = toon(0xffffff, { vertexColors: true, rimStrength: 0.3 });
    emitMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  }
  return { toonMat, emitMat };
};

function prepare(scene, ol) {
  const { toonMat, emitMat } = mats();
  const meshes = [];
  scene.traverse((o) => { if (o.isMesh) meshes.push(o); });
  meshes.forEach((o) => {
    const emit = (o.material?.name || '').startsWith('emit');
    o.material = emit ? emitMat : toonMat;
    o.castShadow = !emit;
    o.receiveShadow = true;
    if (!emit && ol > 0) outline(o, ol);
  });
  return scene;
}

/** Resolves to a fresh clone of the model, or null if it could not be loaded. */
export function loadModel(name, { outline: ol = 0.03 } = {}) {
  const key = name + ':' + ol;
  if (!cache.has(key)) {
    cache.set(key, new Promise((resolve) => {
      loader.load(BASE + name + '.glb', (g) => resolve(prepare(g.scene, ol)), undefined, (err) => {
        console.warn('[assets] ' + name + '.glb unavailable, keeping placeholder', err?.message || err);
        resolve(null);
      });
    }));
  }
  return cache.get(key).then((m) => (m ? m.clone() : null));
}

/**
 * Swap a placeholder for a model once it loads.
 * `place(model)` positions the model; `old` objects are removed afterwards.
 */
export function upgrade(name, parent, old, place, opts) {
  return loadModel(name, opts).then((m) => {
    if (!m) return null;
    place(m);
    parent.add(m);
    for (const o of [].concat(old)) o?.removeFromParent();
    return m;
  });
}

// Soft teardrop flame layers (shared by every campfire). Additive, so overlapping
// layers bloom into a bright core.
let _flameGeo = null;
export function flameLayers(parent) {
  if (!_flameGeo) {
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      pts.push(new THREE.Vector2(Math.sin(Math.PI * Math.pow(t, 0.62)) * (1 - t) * 0.42 + 0.001, t));
    }
    _flameGeo = new THREE.LatheGeometry(pts, 12);
  }
  const layers = [[0xff5a14, 0.5, 1.05, 0.55], [0xff9a2a, 0.36, 0.85, 0.7], [0xffe27a, 0.22, 0.6, 0.9]];
  return layers.map(([color, w, h, op], i) => {
    const m = new THREE.Mesh(_flameGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    m.scale.set(w / 0.42 * 0.5, h, w / 0.42 * 0.5);
    m.position.y = 0.12 + i * 0.03;
    m.userData.base = { w: m.scale.x, h };
    parent.add(m);
    return m;
  });
}

/** flicker animation for flameLayers() */
export function flickerFlames(flames, t) {
  flames.forEach((f, i) => {
    const b = f.userData.base;
    const k = 1 + Math.sin(t * (8.3 + i * 3.1)) * 0.12 + Math.sin(t * (13.7 + i * 5)) * 0.07;
    f.scale.set(b.w * (1.06 - (k - 1) * 0.6), b.h * k, b.w * (1.06 - (k - 1) * 0.6));
    f.rotation.y = t * (1.5 + i);
    f.rotation.z = Math.sin(t * (3 + i)) * 0.06;
  });
}

// ---- geometry-only loading, for instanced scatter (rocks, roots, forest props) ----
const geoCache = new Map();
/** Resolves to one merged BufferGeometry (model space), or null. Shared — clone before mutating. */
export function loadGeometry(name) {
  if (!geoCache.has(name)) {
    geoCache.set(name, new Promise((resolve) => {
      loader.load(BASE + name + '.glb', (g) => {
        g.scene.updateMatrixWorld(true);
        const geos = [];
        g.scene.traverse((o) => { if (o.isMesh) { const ge = o.geometry.clone(); ge.applyMatrix4(o.matrixWorld); geos.push(ge); } });
        if (!geos.length) return resolve(null);
        const keep = Object.keys(geos[0].attributes).filter((k) => geos.every((ge) => ge.attributes[k]));
        for (const ge of geos) for (const k of Object.keys(ge.attributes)) if (!keep.includes(k)) ge.deleteAttribute(k);
        const merged = geos.length > 1 ? mergeGeometries(geos) : geos[0];
        merged.computeBoundingSphere();
        resolve(merged);
      }, undefined, (err) => { console.warn('[assets] ' + name + '.glb unavailable', err?.message || err); resolve(null); });
    }));
  }
  return geoCache.get(name);
}

/** shared cel material for vertex-coloured props */
export function propMaterial() { return mats().toonMat; }

/**
 * Instanced scatter of one model: items = [{x, y, z, rot, s}]. Added to `scene` once loaded.
 * Resolves to the InstancedMesh (or null).
 */
export function scatter(scene, name, items, { material, shadow = true } = {}) {
  if (!items.length) return Promise.resolve(null);
  return loadGeometry(name).then((geo) => {
    if (!geo) return null;
    const im = new THREE.InstancedMesh(geo, material || propMaterial(), items.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    items.forEach((t, i) => { ps.set(t.x, t.y, t.z); q.setFromAxisAngle(up, t.rot || 0); sc.setScalar(t.s || 1); m.compose(ps, q, sc); im.setMatrixAt(i, m); });
    im.computeBoundingSphere();
    im.castShadow = shadow; im.receiveShadow = true;
    im.userData.scatter = name;
    scene.add(im);
    return im;
  });
}

/** Swap the geometry of an existing InstancedMesh (and its instanced outline, if any) for a Blender model. */
export function swapInstanced(im, name) {
  return loadGeometry(name).then((g) => {
    if (!g || !im) return;
    for (const m of [im, im.userData.ol]) if (m) { m.geometry = g; m.computeBoundingSphere(); }
  });
}

/** Stone arch around a glowing portal ring (ring radius R, centre `pos`, facing +z rotated by `yaw`). */
export function portalFrame(parent, pos, R, { dark = false, yaw = 0 } = {}) {
  const k = R / 2.5;
  return upgrade(dark ? 'portal_frame_dark' : 'portal_frame', parent, [], (m) => {
    m.scale.setScalar(k); m.rotation.y = yaw; m.position.set(pos.x, pos.y - 2.8 * k, pos.z);
  }, { outline: 0.03 });
}

// ---- enemy "kits": Blender meshes split by material role (mesh name) ----
const kitCache = new Map();
function loadKitSrc(name) {
  if (!kitCache.has(name)) {
    kitCache.set(name, new Promise((resolve) => {
      loader.load(BASE + name + '.glb', (g) => resolve(g.scene), undefined, (err) => {
        console.warn('[assets] ' + name + '.glb unavailable, keeping placeholder', err?.message || err);
        resolve(null);
      });
    }));
  }
  return kitCache.get(name);
}

function whiteColors(geo) {
  if (!geo.attributes.position) return;
  const n = geo.attributes.position.count;
  geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3).fill(1), 3));
}

/**
 * Swap primitive body parts for a Blender kit. Each kit mesh is named after a material ROLE and gets
 * the enemy's own material for that role (so variant colours, hit-flash and opacity keep working).
 * The role materials switch on vertexColors (kits carry greyscale shading); any primitive left on the
 * same model that still uses one of those materials gets a white colour attribute.
 */
export function applyKit(name, parent, roles, old = [], { ol = 0.015, place } = {}) {
  return loadKitSrc(name).then((src) => {
    if (!src || !parent) return null;
    const m = src.clone(true);
    const used = new Set();
    m.traverse((o) => {
      if (!o.isMesh) return;
      const mat = roles[o.name.replace(/[._\d].*$/, '')];
      if (!mat) { o.visible = false; return; }
      o.material = mat; used.add(mat);
      o.castShadow = !mat.isMeshBasicMaterial; o.receiveShadow = true;
      if (ol > 0 && !mat.isMeshBasicMaterial) outline(o, ol);
    });
    for (const o of [].concat(old)) o?.removeFromParent();
    place?.(m);
    parent.add(m);
    let root = parent;
    while (root.parent && !root.parent.isScene) root = root.parent;
    for (const mat of used) if (!mat.vertexColors) { mat.vertexColors = true; mat.needsUpdate = true; }
    root.traverse((o) => {
      if (o.isMesh && !o.userData.isOutline && used.has(o.material) && !o.geometry.attributes.color) whiteColors(o.geometry);
    });
    return m;
  });
}
