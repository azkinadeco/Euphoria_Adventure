// Chapter 2 region: INFERNAL CITADEL — a volcanic island north of Whispering Woods,
// reached by the Obsidian Causeway. Adapted from Euphoria Online Arc 1 · Chapter 3 (boss: Evy Blood Sage).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toon, part, outlineMaterial , terrainMat } from './toon.js';
import { rockGeo, rockMat, softDot } from './nature.js';
import { fbm, rng, smooth } from './noise.js';
import { makeCampfire } from './reef.js';
import { upgrade, swapInstanced, loadGeometry, propMaterial } from './assets.js';
import { VLight } from './lights.js';

const V = (x, z) => new THREE.Vector3(x, 0, z);
export const VOLC = { x: -40, z: -470, r: 140 };
export const VLOC = {
  outpost: V(-32, -352),
  citadel: V(-40, -462),
  volcano: V(25, -548),
  causeway: { a: V(-20, -150), b: V(-32, -342) },
  lanterns: [V(-100, -400), V(20, -395), V(-120, -500), V(60, -470), V(-70, -560)],
  seals: [V(-52, -420), V(-28, -420), V(-40, -414)],
  lava: [
    { x: -85, z: -430, r: 7 }, { x: 15, z: -440, r: 6 }, { x: -110, z: -470, r: 8 },
    { x: 40, z: -500, r: 7 }, { x: -20, z: -520, r: 5 }, { x: -75, z: -520, r: 6 }, { x: 22, z: -546, r: 9 },
  ],
};
export const CIT_R = 26;          // wall radius
export const GATE_HALF = 0.22;    // gate gap (radians) facing +z

function segDist(x, z, a, b) {
  const abx = b.x - a.x, abz = b.z - a.z, t = Math.max(0, Math.min(1, ((x - a.x) * abx + (z - a.z) * abz) / (abx * abx + abz * abz)));
  return Math.hypot(x - (a.x + abx * t), z - (a.z + abz * t));
}

export function volcanoHeight(x, z) {
  const d = Math.hypot(x - VOLC.x, z - VOLC.z) / VOLC.r;
  const dc = segDist(x, z, VLOC.causeway.a, VLOC.causeway.b);
  if (d > 1.12 && dc > 9) return -9;
  let h = 3.2 + fbm(x * 0.01 + 700, z * 0.01, 4) * 5 + fbm(x * 0.05, z * 0.05, 2) * 0.6;
  const dv = Math.hypot(x - VLOC.volcano.x, z - VLOC.volcano.z);
  h += 46 * Math.exp(-(dv * dv) / (2 * 34 * 34));
  if (dv < 11) h -= (11 - dv) * 2.2; // crater
  const mask = 1 - smooth(0.74, 1.02, d);
  h = h * mask - 9 * (1 - mask);
  const flat = (p, r, th) => { const w = 1 - smooth(r * 0.6, r, Math.hypot(x - p.x, z - p.z)); h += (th - h) * w; };
  flat(VLOC.citadel, 36, 8);
  flat(VLOC.outpost, 15, 3);
  // basalt causeway rising out of the sea
  if (dc < 8) {
    const ch = 2.3 + fbm(x * 0.2, z * 0.2, 2) * 0.25;
    const w = 1 - smooth(4, 8, dc);
    h = Math.max(h, h + (ch - h) * w);
  }
  for (const l of VLOC.lava) {
    const dl = Math.hypot(x - l.x, z - l.z);
    if (dl < l.r * 1.4) h -= 0.8 * (1 - smooth(l.r * 0.7, l.r * 1.4, dl));
  }
  return h;
}

/** is (x,z) inside a lava pool? */
export function lavaAt(x, z) {
  for (const l of VLOC.lava) if (Math.hypot(x - l.x, z - l.z) < l.r * 0.85) return true;
  return false;
}
/** 0..1 how deep into the volcanic heat zone */
export function heatAt(x, z) {
  const d = Math.hypot(x - VOLC.x, z - VOLC.z);
  return Math.max(1 - smooth(VOLC.r * 0.9, VOLC.r * 1.15, d), z < -300 && segDist(x, z, VLOC.causeway.a, VLOC.causeway.b) < 10 ? 0.4 : 0);
}

export function buildVolcano(world) {
  const s = world.scene, H = (x, z) => world.heightAt(x, z), r = rng(9090);

  // ---------- terrain ----------
  const SIZE = 340, SEG = 170, CX = -30, CZ = -455;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2); geo.translate(CX, 0, CZ);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, volcanoHeight(p.getX(i), p.getZ(i)));
  geo.computeVertexNormals();
  const n = geo.attributes.normal, cols = new Float32Array(p.count * 3), c = new THREE.Color();
  const basalt = new THREE.Color(0x3c3538), ash = new THREE.Color(0x6a605c), rust = new THREE.Color(0x7a3e2c), obs = new THREE.Color(0x231e26);
  const glow = new THREE.Color(0xff7a2a), sand = new THREE.Color(0x4a4040), stone = new THREE.Color(0x5a4646), seabed = new THREE.Color(0x1d3d4a);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (y < -1) c.copy(seabed);
    else if (y < 0.6) c.copy(sand);
    else {
      c.copy(basalt).lerp(ash, smooth(-0.3, 0.6, fbm(x * 0.04, z * 0.04, 2)));
      c.lerp(rust, smooth(0.2, 0.6, fbm(x * 0.02 + 30, z * 0.02, 2)) * 0.6);
      if (y > 30) c.lerp(ash, 0.5);
    }
    if (n.getY(i) < 0.75 && y > 0) c.lerp(obs, 0.5);
    if (segDist(x, z, VLOC.causeway.a, VLOC.causeway.b) < 4 && y > 1) c.copy(obs).lerp(basalt, 0.3);
    if (Math.hypot(x - VLOC.citadel.x, z - VLOC.citadel.z) < 30) c.copy(stone);
    for (const l of VLOC.lava) { const dl = Math.hypot(x - l.x, z - l.z); if (dl < l.r * 1.8) c.lerp(glow, (1 - smooth(l.r * 0.8, l.r * 1.8, dl)) * 0.55); }
    if (Math.hypot(x - VLOC.volcano.x, z - VLOC.volcano.z) < 12) c.lerp(glow, 0.7);
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const terrain = new THREE.Mesh(geo, terrainMat());
  terrain.receiveShadow = true; s.add(terrain);

  const addInst = (g, mat, list, colorFn, ol = 0) => {
    const im = new THREE.InstancedMesh(g, mat, list.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), e = new THREE.Euler();
    list.forEach((t, i) => { ps.set(t.x, t.y, t.z); e.set(t.rx || 0, t.rot || 0, t.rz || 0); q.setFromEuler(e); sc.setScalar(t.s); m.compose(ps, q, sc); im.setMatrixAt(i, m); if (colorFn) im.setColorAt(i, colorFn(t)); });
    im.castShadow = true; im.receiveShadow = true; s.add(im);
    if (ol) { const o = new THREE.InstancedMesh(g, outlineMaterial(ol, 0x120a0a), list.length); o.instanceMatrix = im.instanceMatrix; s.add(o); world.outlineMeshes.push(o); im.userData.ol = o; }
    return im;
  };
  const busy = (x, z) => Math.hypot(x - VLOC.citadel.x, z - VLOC.citadel.z) < 34 || Math.hypot(x - VLOC.outpost.x, z - VLOC.outpost.z) < 12
    || segDist(x, z, VLOC.causeway.a, VLOC.causeway.b) < 6 || lavaAt(x, z) || [...VLOC.lanterns, ...VLOC.seals].some((q) => Math.hypot(x - q.x, z - q.z) < 5);

  // ---------- dead trees, obsidian spires, rocks ----------
  const deadParts = [];
  { const t = new THREE.CylinderGeometry(0.12, 0.25, 3.2, 6); t.translate(0, 1.6, 0); deadParts.push(t); }
  for (let k = 0; k < 4; k++) { const b = new THREE.CylinderGeometry(0.04, 0.09, 1.4, 5); b.translate(0, 0.7, 0); b.rotateZ(0.9 * (k % 2 ? 1 : -1)); b.rotateY(k * 1.6); b.translate(0, 2.2 + k * 0.25, 0); deadParts.push(b); }
  const deadGeo = mergeGeometries(deadParts.map((g) => g.toNonIndexed()));
  const trees = [], spires = [], rocks = [];
  for (let i = 0; i < 5000 && (trees.length < 90 || spires.length < 70 || rocks.length < 110); i++) {
    const x = VOLC.x + (r() * 2 - 1) * 150, z = VOLC.z + (r() * 2 - 1) * 150, y = H(x, z);
    if (y < 0.8 || y > 34 || busy(x, z)) continue;
    const k = r();
    if (k < 0.33 && trees.length < 90) trees.push({ x, z, y: y - 0.1, s: 0.8 + r() * 0.6, rot: r() * 6, rz: (r() - 0.5) * 0.2 });
    else if (k < 0.6 && spires.length < 70) spires.push({ x, z, y: y - 0.3, s: 0.6 + r() * 1.4, rot: r() * 6, rz: (r() - 0.5) * 0.3, tint: r() });
    else if (rocks.length < 110) rocks.push({ x, z, y, s: 0.5 + r() * 1.6, rot: r() * 6, tint: r() });
  }
  swapInstanced(addInst(deadGeo, new THREE.MeshLambertMaterial({ color: 0x5a4a46 }), trees), 'dead_tree');
  for (const t of trees) world.addCollider(t.x, t.z, 0.3 * t.s);
  const spireGeo = new THREE.ConeGeometry(0.7, 4, 5); spireGeo.translate(0, 2, 0);
  const sA = new THREE.Color(0x1d1822), sB = new THREE.Color(0x4a2a3a);
  swapInstanced(addInst(spireGeo, toon(0xffffff, { flatShading: true }), spires, (t) => sA.clone().lerp(sB, t.tint), 0.04), 'obsidian_spire');
  for (const t of spires) world.addCollider(t.x, t.z, 0.6 * t.s);
  const rA = new THREE.Color(0x3a3236), rB = new THREE.Color(0x5e504c), basaltRock = rockMat();
  [0, 1].forEach((k) => addInst(rockGeo(61 + k * 3), basaltRock, rocks.filter((_t, i) => i % 2 === k), (t) => rA.clone().lerp(rB, t.tint)));
  for (const k of rocks) if (k.s > 1) world.addCollider(k.x, k.z, k.s * 0.85);

  // ---------- lava pools ----------
  const lavaMat = new THREE.MeshBasicMaterial({ color: 0xff6a1a });
  lavaMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = world.waterUniforms.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;').replace('#include <project_vertex>', '#include <project_vertex>\nvW = (modelMatrix * vec4(position,1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uTime; varying vec3 vW;').replace('#include <dithering_fragment>', `#include <dithering_fragment>
      float w = sin(vW.x*0.9 + uTime*0.8) * sin(vW.z*0.8 - uTime*0.6) + sin((vW.x - vW.z)*1.7 + uTime*1.3)*0.5;
      gl_FragColor.rgb = mix(vec3(0.85,0.18,0.02), vec3(1.0,0.85,0.25), smoothstep(-0.2, 1.1, w));`);
  };
  for (const l of VLOC.lava) {
    const y = H(l.x, l.z) + 0.25;
    const disk = new THREE.Mesh(new THREE.CircleGeometry(l.r, 36), lavaMat);
    disk.rotation.x = -Math.PI / 2; disk.position.set(l.x, Math.max(y, 0.2), l.z); s.add(disk);
  }
  const lavaLights = VLOC.lava.slice(0, 4).map((l) => { const pl = new VLight(0xff6a1a, 30, 22, 1.6); pl.position.set(l.x, H(l.x, l.z) + 2.5, l.z); s.add(pl); return pl; });
  world.animated.push({ update: (dt, t) => lavaLights.forEach((pl, i) => (pl.intensity = 26 + Math.sin(t * 3 + i) * 6)) });
  // volcano smoke plume
  const smokeG = new THREE.BufferGeometry(), sp = [];
  for (let k = 0; k < 300; k++) sp.push(VLOC.volcano.x + (r() - 0.5) * 10, H(VLOC.volcano.x, VLOC.volcano.z) + r() * 60, VLOC.volcano.z + (r() - 0.5) * 10);
  smokeG.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const smoke = new THREE.Points(smokeG, new THREE.PointsMaterial({ map: softDot(), color: 0x5a4a48, size: 6, transparent: true, opacity: 0.35, depthWrite: false }));
  s.add(smoke);
  const baseY = H(VLOC.volcano.x, VLOC.volcano.z);
  world.animated.push({ update: (dt) => {
    const a = smokeG.attributes.position;
    for (let k = 0; k < a.count; k++) { let y = a.getY(k) + dt * (2 + (k % 4)); let x = a.getX(k) + dt * 1.5; if (y > baseY + 70) { y = baseY; x = VLOC.volcano.x + (Math.random() - 0.5) * 8; } a.setY(k, y); a.setX(k, x); }
    a.needsUpdate = true;
  } });

  // ---------- causeway pillars & fire barrier ----------
  const { a: ca, b: cb } = VLOC.causeway;
  const dir = new THREE.Vector3().subVectors(cb, ca); const L = dir.length(); dir.normalize();
  const side = new THREE.Vector3(dir.z, 0, -dir.x);
  const pillarM = toon(0x2a2430, { flatShading: true });
  for (let d = 20; d < L; d += 16) for (const sd of [-1, 1]) {
    const pt = ca.clone().addScaledVector(dir, d).addScaledVector(side, sd * 5.2);
    const h = 2.5 + r() * 3;
    const pl = part(new THREE.CylinderGeometry(0.5, 0.8, h, 6), pillarM, { ol: 0.04 });
    pl.position.set(pt.x, H(pt.x, pt.z) + h / 2 - 0.3, pt.z); s.add(pl);
    const gy = H(pt.x, pt.z) - 0.3;
    upgrade('fire_pillar', s, pl, (m) => { m.position.set(pt.x, gy, pt.z); m.scale.set(1, h / 4, 1); m.rotation.y = d; }, { outline: 0.035 });
    const brazier = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.8, 6), new THREE.MeshBasicMaterial({ color: 0xff8a2a }));
    brazier.position.set(pt.x, pl.position.y + h / 2 + 0.4, pt.z); s.add(brazier);
  }
  const fireWall = new THREE.Group();
  for (let k = 0; k < 7; k++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4 + (k % 3), 6), new THREE.MeshBasicMaterial({ color: [0xff4a1a, 0xff8a2a, 0xffc04a][k % 3], transparent: true, opacity: 0.8 }));
    f.position.set((k - 3) * 1.4, 2, 0); fireWall.add(f);
  }
  const fwp = ca.clone().addScaledVector(dir, 22); fwp.y = H(fwp.x, fwp.z);
  fireWall.position.copy(fwp); fireWall.rotation.y = Math.atan2(side.x, side.z) + Math.PI / 2;
  s.add(fireWall);
  world.causewayBarrier = fireWall; world.causewayBarrierPos = fwp;
  world.animated.push({ update: (dt, t) => fireWall.children.forEach((f, i) => { f.scale.y = 1 + Math.sin(t * 8 + i) * 0.2; }) });

  // ---------- outpost ----------
  const O = VLOC.outpost; O.y = H(O.x, O.z);
  const tent = part(new THREE.ConeGeometry(2.6, 3, 6), toon(0xc9a05a), { ol: 0.04 }); tent.position.set(O.x - 5, O.y + 1.5, O.z + 3); s.add(tent);
  upgrade('tent', s, tent, (m) => { m.position.set(O.x - 5, O.y, O.z + 3); m.rotation.y = -0.6; }, { outline: 0.035 });
  world.addCollider(O.x - 5, O.z + 3, 2.2);
  const banner = part(new THREE.PlaneGeometry(1.1, 1.8), toon(0xe6b84a, { side: THREE.DoubleSide }), { ol: 0 }); banner.position.set(O.x + 4, O.y + 2.5, O.z + 4); s.add(banner);
  const pole = part(new THREE.CylinderGeometry(0.06, 0.06, 4, 6), toon(0x5a3a1a), { ol: 0.01 }); pole.position.set(O.x + 4.6, O.y + 2, O.z + 4); s.add(pole);
  upgrade('outpost_banner', s, [banner, pole], (m) => m.position.set(O.x + 4.6, O.y, O.z + 4), { outline: 0.015 });
  world.volcCampfire = makeCampfire(world, new THREE.Vector3(O.x, O.y, O.z));

  // ---------- the Infernal Citadel ----------
  const C = VLOC.citadel; C.y = H(C.x, C.z);
  const wallM = toon(0x4a3438, { flatShading: true }), trimM = toon(0x8a2a2a), roofM = toon(0x9a1a1a);
  world.citadelWallColliders = [];
  const wallSegs = [];
  const SEGS = 36;
  for (let k = 0; k < SEGS; k++) {
    const a0 = (k / SEGS) * Math.PI * 2;
    const am = a0 + Math.PI / SEGS;
    const rel = am > Math.PI ? am - Math.PI * 2 : am; // angle relative to +z
    if (Math.abs(rel) < GATE_HALF) continue; // gate gap facing +z
    const x = C.x + Math.sin(am) * CIT_R, z = C.z + Math.cos(am) * CIT_R;
    const len = 2 * Math.PI * CIT_R / SEGS + 0.2;
    const w = part(new THREE.BoxGeometry(len, 7, 1.6), wallM, { ol: 0.04 });
    w.position.set(x, C.y + 3.3, z); w.rotation.y = am; s.add(w);
    const wallOld = [w];
    if (k % 2 === 0) { const cr = part(new THREE.BoxGeometry(1, 1, 1.7), trimM, { ol: 0.02 }); cr.position.set(x, C.y + 7.2, z); cr.rotation.y = w.rotation.y; s.add(cr); wallOld.push(cr); }
    wallSegs.push({ x, y: C.y, z, rot: am, s: len / 4.74, old: wallOld });
    for (let q = -1; q <= 1; q++) {
      const cx = C.x + Math.sin(am + q * 0.05) * CIT_R, cz = C.z + Math.cos(am + q * 0.05) * CIT_R;
      world.citadelWallColliders.push(world.addCollider(cx, cz, 1.2));
    }
  }
  // all wall segments share one Blender geometry -> one instanced mesh (+ one instanced outline)
  loadGeometry('citadel_wall').then((g) => {
    if (!g) return;
    addInst(g, propMaterial(), wallSegs, null, 0.035);
    for (const t of wallSegs) for (const o of t.old) o.removeFromParent();
  });
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + k * Math.PI / 2;
    const x = C.x + Math.sin(a) * (CIT_R + 1), z = C.z + Math.cos(a) * (CIT_R + 1);
    const tw = part(new THREE.CylinderGeometry(3, 3.4, 12, 10), wallM, { ol: 0.05 }); tw.position.set(x, C.y + 6, z); s.add(tw);
    const rf = part(new THREE.ConeGeometry(3.8, 5, 10), roofM, { ol: 0.05 }); rf.position.set(x, C.y + 14.5, z); s.add(rf);
    upgrade('citadel_tower', s, [tw, rf], (m) => { m.position.set(x, C.y, z); m.rotation.y = a; }, { outline: 0.05 });
    { const tc = world.addCollider(x, z, 3.3); tc.canopy = 3.6; tc.y0 = C.y - 1; tc.y1 = C.y + 17; }
  }
  // gate towers + portcullis
  const gA = Math.PI / 2 - Math.PI / 2; // +z
  for (const sd of [-1, 1]) {
    const a = gA + sd * (GATE_HALF + 0.06);
    const x = C.x + Math.sin(a) * CIT_R, z = C.z + Math.cos(a) * CIT_R;
    const gt = part(new THREE.BoxGeometry(3, 10, 3), wallM, { ol: 0.04 }); gt.position.set(x, C.y + 5, z); s.add(gt);
    upgrade('citadel_gatetower', s, gt, (m) => m.position.set(x, C.y, z), { outline: 0.04 });
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1, 6), new THREE.MeshBasicMaterial({ color: 0xff8a2a })); fl.position.set(x, C.y + 10.6, z); s.add(fl);
  }
  const gate = part(new THREE.BoxGeometry(11, 7, 0.6), toon(0x2a1a14), { ol: 0.04 });
  for (let k = -4; k <= 4; k++) { const bar = new THREE.Mesh(new THREE.BoxGeometry(0.15, 7, 0.7), toon(0x6a6a70)); bar.position.x = k * 1.2; gate.add(bar); }
  gate.position.set(C.x, C.y + 3.4, C.z + CIT_R); s.add(gate);
  // the Blender portcullis rides inside the (now invisible) gate mesh, so chapter2's slide animation still works
  upgrade('portcullis', gate, [...gate.children], () => { gate.material.visible = false; }, { outline: 0.02 });
  world.citadelGate = gate;
  world.gateColliders = [-4, -2, 0, 2, 4].map((dx) => world.addCollider(C.x + dx, C.z + CIT_R, 1.3));
  // courtyard ritual circle + braziers
  const ring = new THREE.Mesh(new THREE.RingGeometry(14, 14.6, 64), new THREE.MeshBasicMaterial({ color: 0xc0182a, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(C.x, C.y + 0.06, C.z); s.add(ring);
  const ring2 = new THREE.Mesh(new THREE.RingGeometry(7, 7.3, 6), new THREE.MeshBasicMaterial({ color: 0xc0182a, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
  ring2.rotation.x = -Math.PI / 2; ring2.position.set(C.x, C.y + 0.07, C.z); s.add(ring2);
  world.animated.push({ update: (dt, t) => { ring2.rotation.z = t * 0.2; } });
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    const x = C.x + Math.sin(a) * 18, z = C.z + Math.cos(a) * 18;
    const bz = part(new THREE.CylinderGeometry(0.5, 0.3, 1.4, 8), toon(0x3a2a2a), { ol: 0.02 }); bz.position.set(x, C.y + 0.7, z); s.add(bz);
    upgrade('brazier', s, bz, (m) => { m.position.set(x, C.y + 0.08, z); m.rotation.y = a; }, { outline: 0.02 });
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.2, 6), new THREE.MeshBasicMaterial({ color: 0xff3a2a })); f.position.set(x, C.y + 2, z); s.add(f);
    world.addCollider(x, z, 0.6);
  }
  const citLight = new VLight(0xff3a2a, 40, 40, 1.4); citLight.position.set(C.x, C.y + 8, C.z); s.add(citLight);

  // ---------- spirit lanterns ----------
  world.lanternMeshes = VLOC.lanterns.map((lp) => {
    lp.y = H(lp.x, lp.z);
    const g = new THREE.Group();
    const post = part(new THREE.CylinderGeometry(0.08, 0.1, 2.4, 6), toon(0x2a2224), { ol: 0.01 }); post.position.y = 1.2; g.add(post);
    const cage = part(new THREE.CylinderGeometry(0.3, 0.25, 0.5, 6), toon(0x5a4a3a), { ol: 0.015 }); cage.position.y = 2.6; g.add(cage);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshBasicMaterial({ color: 0x8a6aff })); flame.position.y = 2.6; g.add(flame);
    g.position.copy(lp); s.add(g);
    world.addCollider(lp.x, lp.z, 0.4);
    upgrade('spirit_lantern', g, [post, cage], () => {}, { outline: 0.015 });
    return { g, flame };
  });
}
