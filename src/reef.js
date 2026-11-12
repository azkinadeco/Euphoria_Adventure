// Chapter 1 region: SUNKEN REEF — a lagoon island east of Whispering Woods, joined by the Coral Bridge.
// Adapted from Euphoria Online Arc 1 · Chapter 2 "Sunken Reef" (boss: Slime Queen).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toon, part, outlineMaterial , terrainMat } from './toon.js';
import { palmFronds, palmTrunk, foliageMat, frondTexture, barkMat, rockGeo, rockMat, softDot } from './nature.js';
import { fbm, rng, smooth } from './noise.js';
import { VLight } from './lights.js';
import { upgrade, flameLayers, flickerFlames, swapInstanced } from './assets.js';

const V = (x, z) => new THREE.Vector3(x, 0, z);
export const REEF = { x: 440, z: 30, r: 135 };
export const RLOC = {
  camp: V(354, 24),
  ruins: V(470, 8),
  lair: V(500, 88),
  pools: [V(398, -38), V(428, 98), V(512, -24)],
  spires: [V(412, 58), V(458, -44), V(532, 34)],
  islets: [{ x: 568, z: -80, r: 11 }, { x: 550, z: 144, r: 10 }],
};
export const BRIDGE = { a: V(150, 20), b: V(347, 24), w: 2.2, y: 1.5 };
BRIDGE.mid = BRIDGE.a.clone().lerp(BRIDGE.b, 0.5);

const FLATS = [
  { p: RLOC.camp, r: 16, h: 1.9 },
  { p: RLOC.ruins, r: 13, h: 6.2 },
];

export function reefHeight(x, z) {
  const d = Math.hypot(x - REEF.x, z - REEF.z) / REEF.r;
  let isle = -9;
  for (const i of RLOC.islets) {
    const di = Math.hypot(x - i.x, z - i.z);
    if (di < i.r * 1.6) isle = Math.max(isle, -9 + 11.4 * (1 - smooth(i.r * 0.55, i.r * 1.4, di)));
  }
  if (d > 1.1) return isle;
  const n = fbm(x * 0.012 + 300, z * 0.012 - 120, 3);
  let h = -0.95 + (n + 0.12) * 6.5 + fbm(x * 0.06, z * 0.06, 2) * 0.35;
  if (h < 0) h = Math.max(h, -1.05);
  // blue holes: deep pools only Scylla can swim
  const bh = fbm(x * 0.02 - 50, z * 0.02 + 70, 2);
  if (bh < -0.38 && d < 0.8) h = Math.min(h, -1.05 - (-0.38 - bh) * 40);
  // ruins hill
  h += 5 * Math.exp(-((x - RLOC.ruins.x) ** 2 + (z - RLOC.ruins.z) ** 2) / (2 * 18 * 18));
  const mask = 1 - smooth(0.78, 1.02, d);
  h = h * mask - 9 * (1 - mask);
  for (const f of FLATS) {
    const w = 1 - smooth(f.r * 0.55, f.r, Math.hypot(x - f.p.x, z - f.p.z));
    h += (f.h - h) * w;
  }
  // the Slime Queen's poisoned basin + sand rim
  const dl = Math.hypot(x - RLOC.lair.x, z - RLOC.lair.z);
  if (dl < 32) {
    const target = dl < 22 ? -0.7 : -0.7 + (dl - 22) / 6 * 1.8;
    const w = 1 - smooth(27, 32, dl);
    h += (Math.min(target, 1.1) - h) * w;
  }
  // bridge landing
  const db = Math.hypot(x - BRIDGE.b.x, z - BRIDGE.b.z);
  if (db < 10) h = Math.max(h, 1.6 * (1 - smooth(5, 10, db)) + h * smooth(5, 10, db));
  return Math.max(h, isle);
}

/** distance along / across the bridge deck (for walkable ground) */
export function bridgeDeck(x, z) {
  const { a, b } = BRIDGE;
  const abx = b.x - a.x, abz = b.z - a.z, L2 = abx * abx + abz * abz;
  const t = ((x - a.x) * abx + (z - a.z) * abz) / L2;
  if (t < -0.01 || t > 1.01) return null;
  const px = a.x + abx * t, pz = a.z + abz * t;
  const across = Math.hypot(x - px, z - pz);
  const nearMid = Math.abs(t - 0.5) * Math.sqrt(L2) < 4;
  if (across < (nearMid ? 4 : BRIDGE.w)) return BRIDGE.y + 0.07;
  return null;
}

export function makeCampfire(world, pos) {
  const fire = new THREE.Group();
  const props = [];
  for (let i = 0; i < 5; i++) {
    const l = part(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 6), toon(0x6b4428), { ol: 0.02 });
    l.rotation.z = Math.PI / 2 - 0.25; l.rotation.y = (i / 5) * Math.PI * 2; l.position.y = 0.15; fire.add(l); props.push(l);
  }
  for (let i = 0; i < 8; i++) {
    const st = part(new THREE.DodecahedronGeometry(0.2, 0), toon(0x8a8378, { flatShading: true }), { ol: 0.02 });
    const a = (i / 8) * Math.PI * 2; st.position.set(Math.cos(a) * 0.8, 0.1, Math.sin(a) * 0.8); fire.add(st); props.push(st);
  }
  upgrade('campfire', fire, props, () => {}, { outline: 0.02 });
  const flames = flameLayers(fire);
  const fl = new VLight(0xff9a3a, 0, 14, 1.6); fl.position.y = 1.2; fire.add(fl);
  fire.position.copy(pos);
  world.scene.add(fire);
  world.animated.push({ update: (dt, t) => {
    flickerFlames(flames, t);
    fl.intensity = (world.nightAmt * 30 + 6) * (0.85 + Math.sin(t * 17) * 0.1);
  } });
  world.addCollider(pos.x, pos.z, 0.7);
  return { group: fire, light: fl, pos: pos.clone() };
}

export function makeChest(world, pos, rot = 0) {
  const g = new THREE.Group();
  const wood = toon(0x9a5a2a), gold = toon(0xf0c35a);
  const base = part(new THREE.BoxGeometry(1.0, 0.55, 0.65), wood, { ol: 0.025 }); base.position.y = 0.28; g.add(base);
  const baseParts = [base];
  const lidG = new THREE.Group(); lidG.position.set(0, 0.55, -0.32); g.add(lidG);
  const lid = part(new THREE.CylinderGeometry(0.33, 0.33, 1.0, 10, 1, false, 0, Math.PI), wood, { ol: 0.025 });
  lid.rotation.z = Math.PI / 2; lid.position.z = 0.32; lidG.add(lid);
  for (const x of [-0.42, 0, 0.42]) { const b = part(new THREE.BoxGeometry(0.08, 0.58, 0.68), gold, { ol: 0.01 }); b.position.set(x, 0.28, 0); g.add(b); baseParts.push(b); }
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.06), gold); lock.position.set(0, 0.48, 0.34); g.add(lock); baseParts.push(lock);
  upgrade('chest_base', g, baseParts, () => {}, { outline: 0.02 });
  upgrade('chest_lid', lidG, lid, () => {}, { outline: 0.02 });
  const glow = new VLight(0xffd66b, 4, 5, 2); glow.position.y = 1; g.add(glow);
  g.position.copy(pos); g.rotation.y = rot;
  world.scene.add(g);
  world.addCollider(pos.x, pos.z, 0.6);
  return { group: g, lid: lidG, glow };
}

export function buildReef(world) {
  const s = world.scene;
  const H = (x, z) => world.heightAt(x, z);
  const r = rng(4242);

  // ---------- terrain ----------
  const SIZE = 380, SEG = 190, CX = 420, CZ = 30;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2); geo.translate(CX, 0, CZ);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, reefHeight(p.getX(i), p.getZ(i)));
  geo.computeVertexNormals();
  const n = geo.attributes.normal, cols = new Float32Array(p.count * 3), c = new THREE.Color();
  const sand = new THREE.Color(0xe2d2a4), wet = new THREE.Color(0xbfad7c), lagoon = new THREE.Color(0x8fe3d2), deep = new THREE.Color(0x1f6f8f);
  const green = new THREE.Color(0x6f9f4c), stone = new THREE.Color(0xc9c0a8), poison = new THREE.Color(0x9a5fc0), seabed = new THREE.Color(0x3a8aa0);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (y < -3) c.copy(seabed).lerp(deep, Math.min(1, (-3 - y) / 6));
    else if (y < -1.1) c.copy(deep).lerp(lagoon, smooth(-3, -1.1, y));
    else if (y < 0) c.copy(lagoon).lerp(wet, smooth(-0.4, 0, y));
    else if (y < 0.5) c.copy(wet).lerp(sand, smooth(0, 0.5, y));
    else c.copy(sand);
    if (y > 2.2) c.lerp(green, smooth(2.2, 3.2, y) * (0.6 + 0.4 * fbm(x * 0.05, z * 0.05, 2)));
    if (n.getY(i) < 0.78 && y > 0) c.lerp(stone, 0.6);
    if (Math.hypot(x - RLOC.ruins.x, z - RLOC.ruins.z) < 11) c.lerp(stone, 0.55);
    const dl = Math.hypot(x - RLOC.lair.x, z - RLOC.lair.z);
    if (dl < 30) c.lerp(poison, smooth(30, 12, dl) * 0.7);
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const terrain = new THREE.Mesh(geo, terrainMat());
  terrain.receiveShadow = true;
  s.add(terrain);

  // ---------- instancing helper ----------
  const addInst = (g, mat, list, colorFn, ol = 0) => {
    const im = new THREE.InstancedMesh(g, mat, list.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), e = new THREE.Euler();
    list.forEach((t, i) => {
      ps.set(t.x, t.y, t.z); e.set(t.rx || 0, t.rot || 0, t.rz || 0); q.setFromEuler(e); sc.setScalar(t.s);
      m.compose(ps, q, sc); im.setMatrixAt(i, m);
      if (colorFn) im.setColorAt(i, colorFn(t));
    });
    im.castShadow = true; im.receiveShadow = true;
    s.add(im);
    if (ol) {
      const o = new THREE.InstancedMesh(g, outlineMaterial(ol, 0x1d2a14), list.length);
      o.instanceMatrix = im.instanceMatrix; s.add(o); world.outlineMeshes.push(o); im.userData.ol = o;
    }
    return im;
  };
  const tooClose = (x, z) => [RLOC.camp, RLOC.lair, ...RLOC.pools, ...RLOC.spires].some((q, i) => Math.hypot(x - q.x, z - q.z) < (i === 1 ? 30 : 7)) || Math.hypot(x - RLOC.ruins.x, z - RLOC.ruins.z) < 11;

  // ---------- palms ----------
  const top = new THREE.Vector3(1.375, 5.9, 0);
  const palms = [];
  for (let i = 0; i < 3000 && palms.length < 150; i++) {
    const x = REEF.x + (r() * 2 - 1) * 150, z = REEF.z + (r() * 2 - 1) * 150, y = H(x, z);
    if (y < 0.8 || y > 7 || tooClose(x, z) || bridgeDeck(x, z) !== null) continue;
    palms.push({ x, z, y: y - 0.1, s: 0.8 + r() * 0.5, rot: r() * Math.PI * 2, tint: r() });
  }
  for (const isl of RLOC.islets) for (let k = 0; k < 3; k++) { const a = k * 2.1, x = isl.x + Math.cos(a) * 4, z = isl.z + Math.sin(a) * 4; palms.push({ x, z, y: H(x, z) - 0.1, s: 0.9, rot: a, tint: r() }); }
  addInst(palmTrunk(top), barkMat(0xa58c70), palms);
  const lA = new THREE.Color(0x4f8f3e), lB = new THREE.Color(0x8cae52);
  addInst(palmFronds(top), foliageMat(world.windUniform, frondTexture(), { key: 'palm', lift: 0.12, sway: 0.5 }), palms, (t) => lA.clone().lerp(lB, t.tint));
  for (const t of palms) { const cc = world.addCollider(t.x, t.z, 0.3 * t.s); cc.canopy = 2.6 * t.s; cc.y0 = t.y + 5 * t.s; cc.y1 = t.y + 7 * t.s; }

  // ---------- coral & shells ----------
  const branchParts = [];
  for (let k = 0; k < 6; k++) {
    const g = new THREE.CylinderGeometry(0.04, 0.07, 0.8, 5); g.translate(0, 0.4, 0);
    g.rotateZ((k % 3 - 1) * 0.5); g.rotateY(k * 1.1); branchParts.push(g);
    const tip = new THREE.SphereGeometry(0.08, 6, 5); tip.translate(0, 0.82, 0); tip.rotateZ((k % 3 - 1) * 0.5); tip.rotateY(k * 1.1); branchParts.push(tip);
  }
  const coralGeos = [
    mergeGeometries(branchParts.map((g) => g.toNonIndexed())),
    (() => { const g = new THREE.SphereGeometry(0.6, 10, 8); g.scale(1, 1, 0.12); g.translate(0, 0.5, 0); return g; })(),
    (() => { const g = new THREE.IcosahedronGeometry(0.45, 1); g.scale(1, 0.6, 1); return g; })(),
  ];
  const coralCols = [0xff6f91, 0xffa94d, 0xb57bff, 0x4dd6c4, 0xffe066, 0xff8fd0].map((h) => new THREE.Color(h));
  const corals = [[], [], []];
  for (let i = 0; i < 9000 && corals[0].length + corals[1].length + corals[2].length < 750; i++) {
    const x = REEF.x + (r() * 2 - 1) * 140, z = REEF.z + (r() * 2 - 1) * 140, y = H(x, z);
    if (y > 0.3 || y < -1.2 || bridgeDeck(x, z) !== null) continue;
    if (Math.hypot(x - RLOC.lair.x, z - RLOC.lair.z) < 24) continue;
    corals[Math.floor(r() * 3)].push({ x, z, y, s: 0.6 + r() * 0.9, rot: r() * 6, tint: r() });
  }
  corals.forEach((list, k) => {
    const im = addInst(coralGeos[k], toon(0xffffff, { emissive: 0x111111 }), list, (t) => coralCols[Math.floor(t.tint * coralCols.length)]);
    im.castShadow = false;
    swapInstanced(im, ['coral_branch', 'coral_fan', 'coral_brain'][k]);
  });
  const shells = [];
  for (let i = 0; i < 3000 && shells.length < 180; i++) {
    const x = REEF.x + (r() * 2 - 1) * 140, z = REEF.z + (r() * 2 - 1) * 140, y = H(x, z);
    if (y < 0 || y > 1.4) continue;
    shells.push({ x, z, y: y + 0.03, s: 0.7 + r() * 0.8, rot: r() * 6, tint: r() });
  }
  const starGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.04, 5);
  addInst(starGeo, toon(0xffffff), shells, (t) => coralCols[Math.floor(t.tint * 3)]).castShadow = false;

  // ---------- rocks ----------
  const rocks = [];
  for (let i = 0; i < 2000 && rocks.length < 70; i++) {
    const x = REEF.x + (r() * 2 - 1) * 150, z = REEF.z + (r() * 2 - 1) * 150, y = H(x, z);
    if (y < -1.1 || tooClose(x, z) || bridgeDeck(x, z) !== null) continue;
    rocks.push({ x, z, y, s: 0.4 + r() * 1.6, rot: r() * 6, tint: r() });
  }
  const rA = new THREE.Color(0xb5ab95), rB = new THREE.Color(0xd8cfb8), reefRock = rockMat();
  [0, 1].forEach((k) => addInst(rockGeo(51 + k * 3, 0.6), reefRock, rocks.filter((_t, i) => i % 2 === k), (t) => rA.clone().lerp(rB, t.tint)));
  for (const k of rocks) if (k.s > 1) world.addCollider(k.x, k.z, k.s * 0.85);

  // ---------- Coral Bridge ----------
  const { a, b } = BRIDGE;
  const dir = new THREE.Vector3().subVectors(b, a); const L = dir.length(); dir.normalize();
  const yaw = Math.atan2(dir.x, dir.z);
  const planks = [], posts = [];
  for (let d = 0; d < L; d += 0.95) {
    const pt = a.clone().addScaledVector(dir, d);
    planks.push({ x: pt.x, z: pt.z, y: BRIDGE.y, s: 1, rot: yaw + (Math.sin(d * 7) * 0.02), tint: r() });
    if (Math.round(d / 0.95) % 6 === 0) for (const side of [-1, 1]) {
      const o = new THREE.Vector3(dir.z, 0, -dir.x).multiplyScalar(side * BRIDGE.w);
      posts.push({ x: pt.x + o.x, z: pt.z + o.z, y: BRIDGE.y - 3.5, s: 1, rot: 0 });
    }
  }
  const plankGeo = new THREE.BoxGeometry(BRIDGE.w * 2, 0.14, 0.82);
  const pA = new THREE.Color(0xa77a4c), pB = new THREE.Color(0xc4975f);
  // plank long axis must run across the deck: rotate box so its X axis is perpendicular to dir
  planks.forEach((pk) => (pk.rot = yaw + Math.PI / 2 + Math.PI / 2));
  addInst(plankGeo, toon(0xffffff), planks, (t) => pA.clone().lerp(pB, t.tint), 0.02);
  const postGeo = new THREE.CylinderGeometry(0.13, 0.15, 8, 6);
  addInst(postGeo, toon(0x7a5235), posts);
  for (const side of [-1, 1]) { // rope rails
    const o = new THREE.Vector3(dir.z, 0, -dir.x).multiplyScalar(side * BRIDGE.w);
    const rail = part(new THREE.CylinderGeometry(0.05, 0.05, L, 5), toon(0xe0c98f), { ol: 0.012 });
    rail.position.copy(a.clone().lerp(b, 0.5).add(o)); rail.position.y = BRIDGE.y + 0.9;
    rail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    s.add(rail);
  }
  // pavilion at mid-span
  const M = BRIDGE.mid;
  const deck = part(new THREE.CylinderGeometry(4, 4, 0.2, 8), toon(0xb08254), { ol: 0.03 }); deck.position.set(M.x, BRIDGE.y - 0.03, M.z); s.add(deck);
  const pavilion = [deck];
  for (let k = 0; k < 4; k++) {
    const ang = k * Math.PI / 2 + Math.PI / 4;
    const pl = part(new THREE.CylinderGeometry(0.15, 0.15, 3.2, 6), toon(0xf2eee4), { ol: 0.015 });
    pl.position.set(M.x + Math.cos(ang) * 3.2, BRIDGE.y + 1.6, M.z + Math.sin(ang) * 3.2); s.add(pl); pavilion.push(pl);
  }
  const roof = part(new THREE.ConeGeometry(4.8, 1.8, 8), toon(0x3fa9a0), { ol: 0.04 }); roof.position.set(M.x, BRIDGE.y + 4.1, M.z); s.add(roof); pavilion.push(roof);
  upgrade('gazebo', s, pavilion, (m) => m.position.set(M.x, BRIDGE.y - 0.13, M.z), { outline: 0.03 });
  const lantern = new VLight(0xffc46b, 0, 12, 1.8); lantern.position.set(M.x, BRIDGE.y + 2.8, M.z); s.add(lantern);
  world.animated.push({ update: () => { lantern.intensity = world.nightAmt * 25; } });
  // fog barrier (removed once the prologue is cleared)
  const barrier = new THREE.Mesh(new THREE.PlaneGeometry(7, 6), new THREE.MeshBasicMaterial({ color: 0xb06bff, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  barrier.position.copy(a.clone().addScaledVector(dir, 6)); barrier.position.y = BRIDGE.y + 2.5; barrier.rotation.y = yaw;
  s.add(barrier);
  world.bridgeBarrier = barrier;
  world.animated.push({ update: (dt, t) => { barrier.material.opacity = 0.35 + Math.sin(t * 2) * 0.1; } });

  // ---------- reef camp ----------
  const C = RLOC.camp; C.y = H(C.x, C.z);
  const tent = new THREE.Group();
  for (let k = 0; k < 8; k++) {
    const seg = part(new THREE.ConeGeometry(2.4, 2.8, 8, 1, true, k * Math.PI / 4, Math.PI / 4), toon(k % 2 ? 0x3fa9c9 : 0xf4f1ea, { side: THREE.DoubleSide }), { ol: 0.03 });
    tent.add(seg);
  }
  tent.position.set(C.x - 5, C.y + 1.4, C.z - 4); s.add(tent);
  upgrade('beach_tent', s, tent, (m) => { m.position.set(C.x - 5, C.y, C.z - 4); m.rotation.y = 0.8; }, { outline: 0.03 });
  world.addCollider(C.x - 5, C.z - 4, 2.1);
  const boat = new THREE.Group();
  const hull = part(new THREE.SphereGeometry(1.4, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), toon(0x9a5a2a, { side: THREE.DoubleSide }), { ol: 0.03 });
  hull.scale.set(0.7, 0.5, 1.8); boat.add(hull);
  upgrade('rowboat', boat, hull, () => {}, { outline: 0.025 });
  boat.position.set(C.x - 2, Math.max(H(C.x - 2, C.z + 10), 0) + 0.45, C.z + 10); boat.rotation.y = 0.4; boat.rotation.z = 0.25; s.add(boat);
  world.reefCampfire = makeCampfire(world, new THREE.Vector3(C.x, C.y, C.z));

  // ---------- ruins ----------
  const R0 = RLOC.ruins; R0.y = H(R0.x, R0.z);
  const stoneM = toon(0xe2dac6, { flatShading: true }), mossM = toon(0x5fbfa8);
  for (let k = 0; k < 9; k++) {
    const ang = (k / 9) * Math.PI * 2, h = [4.5, 2.2, 4.5, 1.2, 4.5, 3.1, 4.5, 0.8, 2.6][k];
    const col = part(new THREE.CylinderGeometry(0.55, 0.65, h, 8), stoneM, { ol: 0.04 });
    const px = R0.x + Math.cos(ang) * 9, pz = R0.z + Math.sin(ang) * 9, py = H(px, pz);
    col.position.set(px, py + h / 2 - 0.2, pz); s.add(col);
    const cap = part(new THREE.CylinderGeometry(0.62, 0.62, 0.18, 8), mossM, { ol: 0.02 }); cap.position.set(px, py + h - 0.1, pz); s.add(cap);
    world.addCollider(px, pz, 0.7);
    const full = h >= 4.5, sy = full ? 1 : h / 2.6;
    upgrade(full ? 'reef_column' : 'reef_column_broken', s, [col, cap], (m) => {
      m.position.set(px, py - 0.15, pz); m.rotation.y = ang * 2.3 + k;
      m.scale.set(1, Math.max(sy, 0.4), 1);
    }, { outline: 0.03 });
  }
  const ped = part(new THREE.CylinderGeometry(1.6, 2, 0.8, 10), stoneM, { ol: 0.04 }); ped.position.set(R0.x, R0.y + 0.2, R0.z); s.add(ped);
  upgrade('reef_pedestal', s, ped, (m) => { m.position.set(R0.x, R0.y - 0.2, R0.z); m.rotation.y = 0.3; }, { outline: 0.03 });
  const clam = part(new THREE.SphereGeometry(1.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(0xf4d6e8), { ol: 0.03 });
  clam.position.set(R0.x, R0.y + 0.6, R0.z - 0.6); clam.rotation.x = -1.1; s.add(clam);
  world.ruinsTop = R0.y + 0.6;

  // ---------- Slime Queen's lair ----------
  const Lr = RLOC.lair;
  const poisonM = new THREE.MeshBasicMaterial({ color: 0x9b4fd6, transparent: true, opacity: 0.32, depthWrite: false });
  const poisonWater = new THREE.Mesh(new THREE.CircleGeometry(23, 48), poisonM);
  poisonWater.rotation.x = -Math.PI / 2; poisonWater.position.set(Lr.x, 0.04, Lr.z); s.add(poisonWater);
  world.animated.push({ update: (dt, t) => { poisonM.opacity = 0.28 + Math.sin(t * 1.3) * 0.06; } });
  const crys = toon(0x7ff0e0, { emissive: 0x1a8f80, emissiveIntensity: 0.9 });
  const crys2 = toon(0xff8fd0, { emissive: 0x9a2a7a, emissiveIntensity: 0.9 });
  for (let k = 0; k < 16; k++) {
    const ang = (k / 16) * Math.PI * 2 + r() * 0.2, rr = 25 + r() * 4;
    const x = Lr.x + Math.cos(ang) * rr, z = Lr.z + Math.sin(ang) * rr;
    const sz = 0.5 + r() * 0.7, gy = Math.max(H(x, z), 0);
    const cr = part(new THREE.OctahedronGeometry(sz, 0), k % 2 ? crys : crys2, { ol: 0.03 });
    cr.position.set(x, gy + 0.6, z); cr.scale.y = 2.2; cr.rotation.set(r() * 0.4, r() * 3, r() * 0.4); s.add(cr);
    const ry = cr.rotation.y;
    upgrade(k % 2 ? 'crystal_teal' : 'crystal_pink', s, cr, (m) => { m.position.set(x, gy - 0.05, z); m.rotation.y = ry; m.scale.setScalar(sz * 1.6); }, { outline: 0.03 });
  }
  const lairLight = new VLight(0xc070ff, 30, 45, 1.5); lairLight.position.set(Lr.x, 5, Lr.z); s.add(lairLight);
  const bg = new THREE.BufferGeometry(), bp = [];
  for (let k = 0; k < 220; k++) bp.push(Lr.x + (r() * 2 - 1) * 22, r() * 6, Lr.z + (r() * 2 - 1) * 22);
  bg.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3));
  const bubbles = new THREE.Points(bg, new THREE.PointsMaterial({ map: softDot(), color: 0xc8f8ff, size: 0.3, transparent: true, opacity: 0.7, depthWrite: false }));
  s.add(bubbles);
  world.animated.push({ update: (dt) => {
    const a2 = bg.attributes.position;
    for (let k = 0; k < a2.count; k++) { let y = a2.getY(k) + dt * (0.6 + (k % 5) * 0.2); if (y > 7) y = 0; a2.setY(k, y); }
    a2.needsUpdate = true;
  } });

  // ---------- poison tide pools ----------
  world.poolMeshes = RLOC.pools.map((pp) => {
    pp.y = Math.max(H(pp.x, pp.z), 0);
    const g = new THREE.Group();
    const disk = new THREE.Mesh(new THREE.CircleGeometry(2.4, 32), new THREE.MeshBasicMaterial({ color: 0xa04be0, transparent: true, opacity: 0.6, depthWrite: false }));
    disk.rotation.x = -Math.PI / 2; g.add(disk);
    const rim = new THREE.Mesh(new THREE.RingGeometry(2.3, 2.6, 32), new THREE.MeshBasicMaterial({ color: 0xe6a8ff, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    rim.rotation.x = -Math.PI / 2; rim.position.y = 0.01; g.add(rim);
    g.position.set(pp.x, pp.y + 0.06, pp.z);
    s.add(g);
    world.animated.push({ update: (dt, t) => { rim.scale.setScalar(1 + Math.sin(t * 3) * 0.04); } });
    return g;
  });
}
