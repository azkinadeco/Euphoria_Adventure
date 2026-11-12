// Distance culling: objects far from the camera are skipped by the renderer.
// The game code keeps full control of `visible`: a culled object is drawn only when the code
// wants it visible AND it is close enough (an accessor combines the two).
import * as THREE from 'three';

const items = [];
const _box = new THREE.Box3();
const _sph = new THREE.Sphere();
let scale = 1;
let acc = 0;

function hook(obj) {
  if (obj.userData._cullHooked) return;
  obj.userData._cullHooked = true;
  let wanted = obj.visible;
  Object.defineProperty(obj, 'visible', {
    configurable: true,
    enumerable: true,
    get() { return wanted && !obj.userData._far; },
    set(v) { wanted = v; },
  });
}

/**
 * Register an object for distance culling.
 * @param {number} [maxDist] fixed draw distance; otherwise derived from the object's size
 *   (small props ~80 m, a 10 m tower ~300 m, anything 20 m+ effectively never culled)
 * @param {number} [minDist] lower bound for the size-derived distance
 */
export function cullFar(obj, maxDist, minDist = 70) {
  if (!obj || obj.userData._cullHooked) return obj;
  hook(obj);
  items.push({ obj, minDist, r: maxDist, r2: maxDist ? (maxDist * scale) ** 2 : 0, off: null });
  return obj;
}

/** graphics preset hook: LOW draws a bit less far */
export function setCullScale(k) { scale = k; for (const it of items) if (it.r !== undefined) it.r2 = (it.r * scale) ** 2; }

/** call every frame; does the work ~5 times a second */
export function updateCull(camPos, dt) {
  acc += dt;
  if (acc < 0.2) return;
  acc = 0;
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i], o = it.obj;
    if (!o.parent) { // removed from the scene: forget it (re-adding later just stays uncullled)
      if (o.userData._removedT === undefined) o.userData._removedT = 0;
      if (++o.userData._removedT > 50) { o.userData._far = false; items.splice(i, 1); }
      continue;
    }
    o.userData._removedT = 0;
    if (!it.r2) { // size-derived distance, measured once the object sits in the world
      o.userData._far = false;
      _box.setFromObject(o);
      if (_box.isEmpty()) continue;
      _box.getBoundingSphere(_sph);
      it.r = Math.min(900, Math.max(it.minDist, 60 + _sph.radius * 25));
      it.r2 = (it.r * scale) ** 2;
      // measure from the middle of the geometry, not the origin (merged models may sit far from it)
      const e0 = o.matrixWorld.elements;
      it.off = [_sph.center.x - e0[12], _sph.center.y - e0[13], _sph.center.z - e0[14]];
    }
    const e = o.matrixWorld.elements, f = it.off;
    const dx = e[12] + (f ? f[0] : 0) - camPos.x, dy = e[13] + (f ? f[1] : 0) - camPos.y, dz = e[14] + (f ? f[2] : 0) - camPos.z;
    o.userData._far = dx * dx + dy * dy + dz * dz > it.r2;
  }
}

export const cullCount = () => items.length;
