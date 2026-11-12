// Visibility streaming: distance culling + world zones.
// The game code keeps full control of `visible`: a managed object is drawn only when the code
// wants it shown AND it is close enough AND it belongs to the active zone (or is right next to
// the camera). An accessor on `visible` combines the three.
import * as THREE from 'three';
import { zoneOf, zoneMask, ZONE_BIT } from './zones.js';

const items = new Map(); // obj -> item
const _box = new THREE.Box3();
const _sph = new THREE.Sphere();
let scale = 1;
let acc = 0;
let activeZone = null;
const NEAR_KEEP = 45; // other-zone things this close to the camera stay drawn (no holes at borders)

const hooked = new WeakMap(); // obj -> () => the visibility the game code asked for

function hook(obj) {
  if (hooked.has(obj)) return;
  let wanted = obj.visible;
  hooked.set(obj, () => wanted);
  Object.defineProperty(obj, 'visible', {
    configurable: true,
    enumerable: true,
    get() { return wanted && !obj.userData._far; },
    set(v) { wanted = v; },
  });
}

/** the visibility the game code set, ignoring streaming (for code that saves & restores `visible`) */
export function wantedVisible(obj) { const f = hooked.get(obj); return f ? f() : obj.visible; }

function item(obj) {
  let it = items.get(obj);
  if (!it) { hook(obj); it = { obj, r: undefined, r2: 0, minDist: 70, zoned: false, measured: false, off: null, rad: 0, gone: 0 }; items.set(obj, it); }
  return it;
}

/**
 * Distance culling.
 * @param {number} [maxDist] fixed draw distance; otherwise derived from the object's size
 *   (small props ~80 m, a 10 m tower ~300 m, anything 20 m+ effectively never culled)
 * @param {number} [minDist] lower bound for the size-derived distance
 */
export function cullFar(obj, maxDist, minDist = 70) {
  if (!obj) return obj;
  const it = item(obj);
  it.minDist = minDist;
  it.auto = !maxDist;
  if (maxDist) { it.r = maxDist; it.r2 = (maxDist * scale) ** 2; }
  it.zoned = true; // everything that is distance-culled also streams with its zone
  return obj;
}

/** zone streaming only (no distance limit) */
export function zoneOnly(obj) { const it = item(obj); it.zoned = true; return obj; }

/**
 * Put every not-yet-managed object of the scene into zone streaming. Big containers are split
 * into their children; huge single meshes (terrain, sea, sky, instanced forests) stay global.
 * @param {Set<THREE.Object3D>} skip roots that are never zoned (player, sky, terrain...)
 */
export function zoneSweep(scene, skip) {
  scene.updateMatrixWorld(true);
  let n = 0;
  const visit = (o) => {
    if (skip.has(o) || o.isLight || o.isCamera || o.userData.noZone) return;
    if (items.has(o)) return;
    _box.setFromObject(o);
    if (_box.isEmpty()) return;
    _box.getBoundingSphere(_sph);
    if (_sph.radius > 120) { for (const c of [...o.children]) visit(c); return; }
    if (!zoneOf(_sph.center.x, _sph.center.y, _sph.center.z)) return;
    zoneOnly(o); n++;
  };
  for (const c of [...scene.children]) visit(c);
  return n;
}

export function setActiveZone(z) { activeZone = z; acc = 1; for (const im of zinst) applyZone(im); }

// ---- island-wide instanced scenery (grass, flowers, rocks, stumps...) ----
// On a zone change the instance buffer is rewritten to hold only that zone's instances (plus a
// border margin): the "re-render the area" step that happens behind the loading fade.
const zinst = [];
const INST_MARGIN = 40;

export function zoneInstanced(im) {
  if (!im || im.userData._zinst) return im;
  const n = im.count, A = im.instanceMatrix.array;
  const masks = new Uint16Array(n);
  for (let i = 0; i < n; i++) masks[i] = zoneMask(A[i * 16 + 12], A[i * 16 + 13], A[i * 16 + 14], INST_MARGIN);
  im.userData._zinst = { n, mats: A.slice(0, n * 16), cols: im.instanceColor ? im.instanceColor.array.slice(0, n * 3) : null, masks, density: 1 };
  zinst.push(im);
  applyZone(im);
  return im;
}

/** quality setting: draw this fraction of the (zone-filtered) instances */
export function setInstancedDensity(im, k) {
  const d = im.userData._zinst;
  if (!d) return false;
  d.density = k; applyZone(im);
  return true;
}

function applyZone(im) {
  const d = im.userData._zinst, bit = activeZone ? ZONE_BIT[activeZone] : 0;
  const A = im.instanceMatrix.array, C = im.instanceColor?.array;
  let k = 0;
  for (let i = 0; i < d.n; i++) {
    if (bit && d.masks[i] && !(d.masks[i] & bit)) continue;
    if (k !== i) {
      A.set(d.mats.subarray(i * 16, i * 16 + 16), k * 16);
      if (C && d.cols) C.set(d.cols.subarray(i * 3, i * 3 + 3), k * 3);
    } else if (bit) { A.set(d.mats.subarray(i * 16, i * 16 + 16), k * 16); if (C && d.cols) C.set(d.cols.subarray(i * 3, i * 3 + 3), k * 3); }
    k++;
  }
  if (!bit) { A.set(d.mats); if (C && d.cols) C.set(d.cols); k = d.n; }
  const cnt = Math.floor(k * d.density);
  for (const m of [im, im.userData.ol]) {
    if (!m) continue;
    m.count = cnt;
    m.computeBoundingSphere();
  }
  im.instanceMatrix.needsUpdate = true;
  if (C) im.instanceColor.needsUpdate = true;
}
export const getActiveZone = () => activeZone;

/** graphics preset hook: LOW draws a bit less far */
export function setCullScale(k) { scale = k; for (const it of items.values()) if (it.r !== undefined) it.r2 = (it.r * scale) ** 2; }

/** call every frame; does the work ~5 times a second (or right away after a zone change) */
export function updateCull(camPos, dt) {
  acc += dt;
  if (acc < 0.2) return;
  acc = 0;
  for (const it of items.values()) {
    const o = it.obj;
    if (!o.parent) { // removed from the scene: forget it after a while (it may be re-added)
      if (++it.gone > 50) { o.userData._far = false; items.delete(o); }
      continue;
    }
    it.gone = 0;
    if (!it.measured) { // size + centre offset, measured once the object sits in the world
      o.userData._far = false;
      _box.setFromObject(o);
      if (_box.isEmpty()) continue;
      _box.getBoundingSphere(_sph);
      it.measured = true;
      it.rad = _sph.radius;
      if (it.auto) { it.r = Math.min(900, Math.max(it.minDist, 60 + _sph.radius * 25)); it.r2 = (it.r * scale) ** 2; }
      // measure from the middle of the geometry, not the origin (merged models may sit far from it)
      const e0 = o.matrixWorld.elements;
      it.off = [_sph.center.x - e0[12], _sph.center.y - e0[13], _sph.center.z - e0[14]];
    }
    const e = o.matrixWorld.elements, f = it.off;
    const x = e[12] + f[0], y = e[13] + f[1], z = e[14] + f[2];
    const dx = x - camPos.x, dy = y - camPos.y, dz = z - camPos.z;
    const d2 = dx * dx + dy * dy + dz * dz;
    let far = it.r2 > 0 && d2 > it.r2;
    if (!far && it.zoned && activeZone) {
      const zo = zoneOf(x, y, z); // live: things that move between zones follow along
      if (zo && zo !== activeZone && Math.sqrt(d2) - it.rad > NEAR_KEEP) far = true;
    }
    o.userData._far = far;
  }
}

export const cullCount = () => items.size;
