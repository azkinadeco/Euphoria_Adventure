// Runtime loader for Blender-built props (see blender/build_props.py).
// Every model is optional: callers keep their primitive placeholder until the
// .glb arrives, and keep it for good if the file fails to load.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toon, outline, outlineMaterial, charaMat } from './toon.js';
import { cullFar, zoneInstanced } from './cull.js';

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
    toonMat = toon(0xffffff, { vertexColors: true, rimStrength: 0.3, detail: 1 });
    emitMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    toonMat.userData.weathered = true; // has its own detail grain: weatherProps() must not stack a second one
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
    cullFar(m); // draw distance from the model's size
    return m;
  });
}

// Soft teardrop flame layers (shared by every campfire). Additive, so overlapping
// layers bloom into a bright core.
let _flameGeo = null;
let _sparkTex = null;
function sparkTex() {
  if (_sparkTex) return _sparkTex;
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  return (_sparkTex = new THREE.CanvasTexture(c));
}
const _flameT = { value: 0 };
// each layer keeps its MeshBasicMaterial (colour / opacity stay editable, Abadonia recolours hers);
// the shader only shapes it: soft silhouette, flickering torn tips, a hotter base
function flameShader(m) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uFlT = _flameT;
    sh.vertexShader = 'varying vec2 vFl;\nvarying vec3 vFlN;\nvarying vec3 vFlV;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vFl = uv; vFlN = normalize(normalMatrix * normal); vFlV = -(modelViewMatrix * vec4(transformed, 1.0)).xyz;`);
    sh.fragmentShader = 'varying vec2 vFl;\nvarying vec3 vFlN;\nvarying vec3 vFlV;\nuniform float uFlT;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', `
      float fh = vFl.y, fa = vFl.x * 6.2832;
      float fn = sin(fa * 3.0 + fh * 7.0 - uFlT * 9.0) * 0.5 + sin(fa * 5.0 - fh * 11.0 - uFlT * 13.0) * 0.3 + sin(fa * 2.0 + uFlT * 5.0) * 0.2;
      float fEdge = smoothstep(0.0, 0.55, abs(dot(normalize(vFlN), normalize(vFlV))));
      float fTip = 1.0 - smoothstep(0.42 + fn * 0.18, 0.98, fh);
      outgoingLight *= mix(1.45, 0.75, fh);
      diffuseColor.a *= fEdge * fTip * (0.8 + fn * 0.3) * smoothstep(0.0, 0.08, fh);
      #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'flameV2';
  return m;
}
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
  const out = layers.map(([color, w, h, op], i) => {
    const m = new THREE.Mesh(_flameGeo, flameShader(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: Math.min(1, op * 1.35), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })));
    m.scale.set(w / 0.42 * 0.5, h, w / 0.42 * 0.5);
    m.position.y = 0.12 + i * 0.03;
    m.userData.base = { w: m.scale.x, h };
    parent.add(m);
    return m;
  });
  // a few embers drift up out of the fire, wobbling, and wink out
  const N = 12, seed = Array.from({ length: N }, () => [Math.random(), Math.random() * 6.283, 0.5 + Math.random() * 0.8]);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  const sp = new THREE.Points(geo, new THREE.PointsMaterial({ color: new THREE.Color(0xffa040).multiplyScalar(2.2), size: 0.07, map: sparkTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  sp.frustumCulled = false; sp.userData.seed = seed; sp.material.userData.hdr = true;
  parent.add(sp);
  out.sparks = sp;
  return out;
}

/** flicker animation for flameLayers() */
export function flickerFlames(flames, t) {
  _flameT.value = performance.now() / 1000;
  const sp = flames.sparks;
  if (sp && sp.visible) {
    const a = sp.geometry.attributes.position, sd = sp.userData.seed;
    for (let i = 0; i < sd.length; i++) {
      const [ph, ang, sp2] = sd[i], k = (t * 0.55 * sp2 + ph) % 1, r = 0.12 + k * 0.35;
      a.setXYZ(i, Math.cos(ang + k * 4) * r * 0.6 + Math.sin(t * 3 + i) * 0.05 * k, 0.25 + k * 1.9, Math.sin(ang + k * 4) * r * 0.6);
    }
    a.needsUpdate = true;
  }
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
    zoneInstanced(im);
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
/**
 * Bind a skinned Blender body (bones named after the rig's joints) straight onto a procedural Rig:
 * the rig's joint groups become the skeleton, so the existing animator bends the mesh smoothly.
 * Each skinned mesh is named after a material ROLE, like the kits.
 */
/** ol: outline width, or role => width */
export function applySkinned(name, rig, roles, old = [], { ol = 0.006 } = {}) {
  return loadKitSrc(name).then((src) => {
    if (!src || !rig.bindRest) return null;
    if (rig.root.userData.chara) for (const m of Object.values(roles)) charaMat(m); // before the outlines pick their tint
    const holder = new THREE.Group();
    holder.name = name;
    const used = new Set();
    const skels = new Map();
    src.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      const mat = roles[o.name.replace(/[._\d].*$/, '')];
      if (!mat) return;
      const names = o.skeleton.bones.map((b) => b.name);
      if (names.some((n) => !rig.j[n] || !rig.bindRest[n])) { console.warn('[assets] ' + name + ': unknown joint in', names); return; }
      const key = names.join();
      if (!skels.has(key)) skels.set(key, new THREE.Skeleton(names.map((n) => rig.j[n]), names.map((n) => rig.bindRest[n].clone().invert())));
      const sk = skels.get(key);
      const mk = (m) => { const sm = new THREE.SkinnedMesh(o.geometry, m); sm.bind(sk, new THREE.Matrix4()); sm.frustumCulled = false; return sm; };
      const m = mk(mat);
      m.name = o.name;
      m.castShadow = !mat.isMeshBasicMaterial; m.receiveShadow = true;
      holder.add(m);
      used.add(mat);
      const w = typeof ol === 'function' ? ol(o.name.replace(/[._\d].*$/, '')) : ol;
      if (w > 0 && !mat.isMeshBasicMaterial) {
        const line = mk(outlineMaterial(w, mat.userData.olColor));
        line.userData.isOutline = true; line.raycast = () => {}; line.castShadow = false;
        holder.add(line);
      }
    });
    for (const o of [].concat(old)) o?.removeFromParent();
    rig.root.add(holder);
    for (const mat of used) if (!mat.vertexColors) { mat.vertexColors = true; mat.needsUpdate = true; }
    rig.root.traverse((o) => {
      if (o.isMesh && !o.userData.isOutline && used.has(o.material) && !o.geometry.attributes.color) whiteColors(o.geometry);
    });
    return holder;
  });
}

const creasedCache = new WeakMap();
/** smooth-shaded copy of a kit geometry (hard edges only above `angle`), shared by every clone */
function creased(geo, angle) {
  if (!creasedCache.has(geo)) creasedCache.set(geo, toCreasedNormals(geo, angle));
  return creasedCache.get(geo);
}

/** crease: smooth the kit's normals up to this angle (rad) - hair reads as soft locks, not facets */
export function applyKit(name, parent, roles, old = [], { ol = 0.015, place, crease } = {}) {
  return loadKitSrc(name).then((src) => {
    if (!src || !parent) return null;
    for (let a = parent; a; a = a.parent) if (a.userData.chara) { for (const mt of Object.values(roles)) charaMat(mt); break; } // hero rigs: anime look for kit-only materials
    const m = src.clone(true);
    const used = new Set();
    m.traverse((o) => {
      if (!o.isMesh) return;
      const mat = roles[o.name.replace(/[._\d].*$/, '')];
      if (!mat) { o.visible = false; return; }
      o.material = mat; used.add(mat);
      if (crease) o.geometry = creased(o.geometry, crease);
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
