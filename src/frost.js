// Chapter 3 region: FROSTVALE EXPANSE — Valeria's snowy homeland west of Whispering Woods,
// reached by hopping across sea-ice floes. Adapted from Euphoria Online Arc 1 · Chapter 4 (boss: Eroghost).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toon, part, outlineMaterial , terrainMat } from './toon.js';
import { pineTree, plantForest, foliageMat, needleTexture, barkMat, rockGeo, rockMat } from './nature.js';
import { fbm, rng, smooth } from './noise.js';
import { makeCampfire } from './reef.js';
import { upgrade, swapInstanced } from './assets.js';
import { VLight } from './lights.js';

const V = (x, z) => new THREE.Vector3(x, 0, z);
export const FROST = { x: -470, z: 30, r: 140 };
export const FLOC = {
  village: V(-362, 26),
  peak: V(-540, -52),
  lake: V(-492, 92),
  souls: [V(-420, -24), V(-432, 84), V(-525, 22), V(-468, -84)],
  islet: { x: -612, z: -150, r: 9 },
};
// stepping-stone ice floes across the strait (some gaps need a jump)
export const FLOES = (() => {
  const r = rng(77), out = [];
  const a = V(-168, 24), b = V(-345, 26);
  const n = 17;
  for (let i = 0; i <= n; i++) {
    const t = i / n, p = a.clone().lerp(b, t);
    out.push({ x: p.x + (i % 2 ? 1 : -1) * (1 + r() * 2), z: p.z + (r() - 0.5) * 4, r: i % 4 === 2 ? 4.2 : 5.4 + r() * 1.2, y: 0.32 });
  }
  return out;
})();

export function floeAt(x, z) {
  for (const f of FLOES) if ((x - f.x) ** 2 + (z - f.z) ** 2 < f.r * f.r) return f.y;
  return null;
}

export function frostHeight(x, z) {
  const d = Math.hypot(x - FROST.x, z - FROST.z) / FROST.r;
  const di = Math.hypot(x - FLOC.islet.x, z - FLOC.islet.z);
  const isle = di < FLOC.islet.r * 1.6 ? -9 + 11.6 * (1 - smooth(FLOC.islet.r * 0.5, FLOC.islet.r * 1.4, di)) : -9;
  if (d > 1.1) return isle;
  let h = 3 + fbm(x * 0.011 - 400, z * 0.011, 4) * 4.5 + fbm(x * 0.05, z * 0.05, 2) * 0.5;
  const dp = Math.hypot(x - FLOC.peak.x, z - FLOC.peak.z);
  h += 50 * Math.exp(-(dp * dp) / (2 * 30 * 30)) + 10 * Math.exp(-(dp * dp) / (2 * 60 * 60));
  const mask = 1 - smooth(0.76, 1.02, d);
  h = h * mask - 9 * (1 - mask);
  const flat = (p, r, th) => { const w = 1 - smooth(r * 0.6, r, Math.hypot(x - p.x, z - p.z)); h += (th - h) * w; };
  flat(FLOC.village, 22, 3);
  flat(FLOC.lake, 38, 0.7);
  // shrine plateau on the summit
  if (dp < 6) h = Math.max(h, 59.5);
  return Math.max(h, isle);
}
export function coldAt(x, z) {
  const d = Math.hypot(x - FROST.x, z - FROST.z);
  const onFloes = x < -190 && x > -350 && Math.abs(z - 25) < 12 ? 0.5 : 0;
  return Math.max(1 - smooth(FROST.r * 0.85, FROST.r * 1.15, d), onFloes, Math.hypot(x - FLOC.islet.x, z - FLOC.islet.z) < 30 ? 1 : 0);
}

export function buildFrost(world) {
  const s = world.scene, H = (x, z) => world.heightAt(x, z), r = rng(5151);
  world.warmSources = world.warmSources || [];

  // ---------- terrain ----------
  const SIZE = 360, SEG = 180, CX = -480, CZ = 0;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2); geo.translate(CX, 0, CZ);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, frostHeight(p.getX(i), p.getZ(i)));
  geo.computeVertexNormals();
  const n = geo.attributes.normal, cols = new Float32Array(p.count * 3), c = new THREE.Color();
  const snow = new THREE.Color(0xdfe6f0), shade = new THREE.Color(0xb4c4dc), rock = new THREE.Color(0x6a7486), ice = new THREE.Color(0x9fdcf2), seabed = new THREE.Color(0x24506a), path = new THREE.Color(0xb8b0a4);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (y < -1) c.copy(seabed);
    else c.copy(snow).lerp(shade, smooth(0.95, 0.75, n.getY(i)) * 0.8 + fbm(x * 0.05, z * 0.05, 2) * 0.1);
    if (n.getY(i) < 0.62 && y > 0) c.lerp(rock, 0.65);
    if (Math.hypot(x - FLOC.lake.x, z - FLOC.lake.z) < 30) c.copy(ice).lerp(snow, fbm(x * 0.2, z * 0.2, 2) * 0.3 + 0.1);
    if (Math.hypot(x - FLOC.village.x, z - FLOC.village.z) < 14) c.lerp(path, 0.35);
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const terrain = new THREE.Mesh(geo, terrainMat());
  terrain.receiveShadow = true; s.add(terrain);
  // glassy lake sheen
  const lakeIce = new THREE.Mesh(new THREE.CircleGeometry(30, 48), new THREE.MeshBasicMaterial({ color: 0xd8f6ff, transparent: true, opacity: 0.35, depthWrite: false }));
  lakeIce.rotation.x = -Math.PI / 2; lakeIce.position.set(FLOC.lake.x, H(FLOC.lake.x, FLOC.lake.z) + 0.05, FLOC.lake.z); s.add(lakeIce);

  const addInst = (g, mat, list, colorFn, ol = 0) => {
    const im = new THREE.InstancedMesh(g, mat, list.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), e = new THREE.Euler();
    list.forEach((t, i) => { ps.set(t.x, t.y, t.z); e.set(t.rx || 0, t.rot || 0, t.rz || 0); q.setFromEuler(e); sc.setScalar(t.s); m.compose(ps, q, sc); im.setMatrixAt(i, m); if (colorFn) im.setColorAt(i, colorFn(t)); });
    im.castShadow = true; im.receiveShadow = true; s.add(im);
    if (ol) { const o = new THREE.InstancedMesh(g, outlineMaterial(ol, 0x1a2230), list.length); o.instanceMatrix = im.instanceMatrix; s.add(o); world.outlineMeshes.push(o); im.userData.ol = o; }
    return im;
  };
  const busy = (x, z) => Math.hypot(x - FLOC.village.x, z - FLOC.village.z) < 20 || Math.hypot(x - FLOC.lake.x, z - FLOC.lake.z) < 36
    || FLOC.souls.some((q) => Math.hypot(x - q.x, z - q.z) < 6) || Math.hypot(x - FLOC.peak.x, z - FLOC.peak.z) < 8;

  // ---------- snowy pines, ice crystals, rocks ----------
  const pines = [], crystals = [], rocks = [];
  for (let i = 0; i < 6000 && (pines.length < 260 || crystals.length < 60 || rocks.length < 90); i++) {
    const x = FROST.x + (r() * 2 - 1) * 150, z = FROST.z + (r() * 2 - 1) * 150, y = H(x, z);
    if (y < 1 || busy(x, z)) continue;
    const k = r();
    if (k < 0.65 && pines.length < 260 && y < 40) pines.push({ x, z, y: y - 0.2, s: 0.8 + r() * 0.6, rot: r() * 6, tint: r() });
    else if (k < 0.8 && crystals.length < 60) crystals.push({ x, z, y: y - 0.2, s: 0.5 + r() * 1.2, rot: r() * 6, rz: (r() - 0.5) * 0.4, tint: r() });
    else if (rocks.length < 90) rocks.push({ x, z, y, s: 0.5 + r() * 1.5, rot: r() * 6, tint: r() });
  }
  const pA = new THREE.Color(0x2f5f52), pB = new THREE.Color(0x4a7468);
  const snowy = foliageMat(world.windUniform, needleTexture(), { key: 'snowpine', snow: 0.85, lift: 0.1, sway: 0.4 });
  plantForest(world, [0, 1].map((k) => ({ list: pines.filter((_t, i) => i % 2 === k), geo: pineTree(401 + k * 5, { height: 7.6 + k * 1.3 }), shadeColor: 0x6c7f9e, shadeSize: 6, trunkMat: barkMat(0x6a5444), leafMat: snowy, color: (t) => pA.clone().lerp(pB, t.tint) })));
  for (const t of pines) { const cc = world.addCollider(t.x, t.z, 0.4 * t.s); cc.canopy = 2.0 * t.s; cc.y0 = t.y + 1.3 * t.s; cc.y1 = t.y + 6.5 * t.s; }
  const crysGeo = new THREE.OctahedronGeometry(0.8, 0); crysGeo.scale(0.6, 2.2, 0.6); crysGeo.translate(0, 1.2, 0);
  const cA = new THREE.Color(0x9ee8ff), cB = new THREE.Color(0xc8b8ff);
  swapInstanced(addInst(crysGeo, toon(0xffffff, { emissive: 0x1a3a5a, transparent: true, opacity: 0.9 }), crystals, (t) => cA.clone().lerp(cB, t.tint), 0.03), 'ice_crystal');
  const rA = new THREE.Color(0x7a8496), rB = new THREE.Color(0xa8b2c2), snowCap = rockMat({ cover: 0xdfe6f0, amount: 0.9 });
  [0, 1].forEach((k) => addInst(rockGeo(41 + k * 3), snowCap, rocks.filter((_t, i) => i % 2 === k), (t) => rA.clone().lerp(rB, t.tint)));
  for (const k of rocks) if (k.s > 1) world.addCollider(k.x, k.z, k.s * 0.85);

  // ---------- ice floes across the strait ----------
  const floeMat = toon(0xeaf6ff, { flatShading: true });
  for (const f of FLOES) {
    const fl = part(new THREE.CylinderGeometry(f.r, f.r * 0.9, 1.0, 9), floeMat, { ol: 0.04 });
    fl.position.set(f.x, f.y - 0.5, f.z); fl.rotation.y = f.x; s.add(fl);
    upgrade('ice_floe', s, fl, (m) => { m.position.set(f.x, f.y - 0.5, f.z); m.scale.set(f.r, 1, f.r); m.rotation.y = f.x; }, { outline: 0.03 });
  }
  world.animated.push({ update: () => {} });
  // blizzard wall blocking the floes until Chapter 2 is cleared
  const wallM = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false });
  const bw = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 10, 24, 1, true), wallM);
  bw.position.set(FLOES[1].x, 4, FLOES[1].z); s.add(bw);
  world.floeBarrier = bw; world.floeBarrierPos = new THREE.Vector3(FLOES[1].x, 0, FLOES[1].z);
  world.animated.push({ update: (dt, t) => { bw.rotation.y = t * 1.5; wallM.opacity = 0.4 + Math.sin(t * 3) * 0.1; } });

  // ---------- Frostvale village ----------
  const Vg = FLOC.village; Vg.y = H(Vg.x, Vg.z);
  const wood = toon(0x7a5232), roofSnow = toon(0xf6faff), wallW = toon(0xd8c8a8);
  const houses = [[-10, -12, 0.3], [10, -13, -0.3], [-14, 8, 1.6], [12, 10, -1.5]];
  for (const [dx, dz, rot] of houses) {
    const g = new THREE.Group();
    const body = part(new THREE.BoxGeometry(5, 3.2, 4), wallW, { ol: 0.04 }); body.position.y = 1.6; g.add(body);
    const roof = part(new THREE.ConeGeometry(4.2, 2.4, 4), roofSnow, { ol: 0.04 }); roof.position.y = 4.4; roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, 0.75); g.add(roof);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1, 1.8, 0.1), wood); door.position.set(0, 0.9, 2.02); g.add(door);
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.1), new THREE.MeshBasicMaterial({ color: 0xffc46b })); win.position.set(1.6, 1.9, 2.02); g.add(win);
    g.position.set(Vg.x + dx, Vg.y, Vg.z + dz); g.rotation.y = rot; s.add(g);
    upgrade('frost_house', g, [...g.children], () => {}, { outline: 0.03 });
    { const hc = world.addCollider(Vg.x + dx, Vg.z + dz, 3); hc.canopy = 3.2; hc.y0 = Vg.y - 1; hc.y1 = Vg.y + 6; }
  }
  // gate arch facing the floes (east)
  const archParts = [];
  for (const sd of [-1, 1]) { const post = part(new THREE.CylinderGeometry(0.4, 0.5, 6, 8), wood, { ol: 0.03 }); post.position.set(Vg.x + 17, Vg.y + 3, Vg.z + sd * 4); s.add(post); archParts.push(post); world.addCollider(Vg.x + 17, Vg.z + sd * 4, 0.5); }
  const beam = part(new THREE.BoxGeometry(0.6, 0.6, 9.5), wood, { ol: 0.03 }); beam.position.set(Vg.x + 17, Vg.y + 6, Vg.z); s.add(beam);
  const sign = part(new THREE.BoxGeometry(0.2, 1, 3), toon(0x74b9ff), { ol: 0.02 }); sign.position.set(Vg.x + 17.2, Vg.y + 5, Vg.z); s.add(sign);
  upgrade('frost_arch', s, [...archParts, beam, sign], (m) => m.position.set(Vg.x + 17, Vg.y, Vg.z), { outline: 0.03 });
  world.frostCampfire = makeCampfire(world, new THREE.Vector3(Vg.x, Vg.y, Vg.z));
  world.warmSources.push(world.frostCampfire.pos);
  const brazier = (x, z) => {
    const y = H(x, z);
    const b = part(new THREE.CylinderGeometry(0.55, 0.35, 1.3, 8), toon(0x3a3a44), { ol: 0.02 }); b.position.set(x, y + 0.65, z); s.add(b);
    upgrade('brazier', s, b, (m) => { m.position.set(x, y, z); m.rotation.y = x; }, { outline: 0.02 });
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 7), new THREE.MeshBasicMaterial({ color: 0xff9a3a })); f.position.set(x, y + 1.9, z); s.add(f);
    const pl = new VLight(0xff9a3a, 14, 10, 1.6); pl.position.set(x, y + 2.4, z); s.add(pl);
    world.addCollider(x, z, 0.6);
    world.warmSources.push(new THREE.Vector3(x, y, z));
    world.animated.push({ update: (dt, t) => { f.scale.y = 1 + Math.sin(t * 10 + x) * 0.15; } });
    return { f, pl };
  };
  brazier(Vg.x + 8, Vg.z + 1); brazier(Vg.x - 8, Vg.z - 1);
  // arena braziers around the frozen lake (warmth during the blizzard)
  world.lakeBraziers = [0, 1, 2, 3].map((k) => {
    const a = k * Math.PI / 2 + Math.PI / 4;
    return brazier(FLOC.lake.x + Math.cos(a) * 17, FLOC.lake.z + Math.sin(a) * 17);
  });

  // ---------- Aurora Shrine on the summit ----------
  const P0 = FLOC.peak; P0.y = H(P0.x, P0.z);
  const shrine = new THREE.Group();
  const plat = part(new THREE.CylinderGeometry(4, 4.4, 0.6, 10), toon(0xdfe8f6, { flatShading: true }), { ol: 0.04 }); plat.position.y = 0.2; shrine.add(plat);
  const shrineParts = [plat];
  for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; const pl = part(new THREE.CylinderGeometry(0.25, 0.3, 3, 6), toon(0x9ee8ff, { emissive: 0x1a4a6a }), { ol: 0.02 }); pl.position.set(Math.cos(a) * 3.4, 1.8, Math.sin(a) * 3.4); shrine.add(pl); shrineParts.push(pl); }
  upgrade('aurora_shrine', shrine, shrineParts, () => {}, { outline: 0.03 });
  const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 1), new THREE.MeshBasicMaterial({ color: 0xbff6ff })); orb.position.y = 2.2; shrine.add(orb);
  shrine.position.copy(P0); s.add(shrine);
  world.shrineOrb = orb;
  world.animated.push({ update: (dt, t) => { orb.rotation.y = t; orb.position.y = 2.2 + Math.sin(t * 2) * 0.2; } });

  // ---------- aurora curtains ----------
  const auroraMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uTime: world.waterUniforms.uTime, uStrength: { value: 0.5 } },
    vertexShader: `uniform float uTime; varying vec2 vUv; void main(){ vUv = uv; vec3 p = position; p.z += sin(p.x*0.02 + uTime*0.4)*18.0; p.y += sin(p.x*0.05 + uTime*0.7)*4.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0); }`,
    fragmentShader: `uniform float uTime; uniform float uStrength; varying vec2 vUv; void main(){ float band = smoothstep(0.0,0.35,vUv.y) * (1.0 - smoothstep(0.55,1.0,vUv.y)); float flick = 0.6 + 0.4*sin(vUv.x*40.0 + uTime*1.5); vec3 c = mix(vec3(0.2,1.0,0.6), vec3(0.7,0.3,1.0), vUv.y); gl_FragColor = vec4(c, band*flick*uStrength); }`,
  });
  world.auroraMat = auroraMat;
  for (let k = 0; k < 3; k++) {
    const a = new THREE.Mesh(new THREE.PlaneGeometry(360, 50, 60, 1), auroraMat);
    a.position.set(FROST.x + (k - 1) * 30, 130 + k * 12, FROST.z - 60 + k * 50); a.rotation.y = 0.3 * (k - 1);
    s.add(a);
  }

  // ---------- treasure islet (glide from the summit, or swim) ----------
  const I = FLOC.islet;
  const ib = part(new THREE.OctahedronGeometry(1.4, 0), toon(0x9ee8ff, { emissive: 0x1a3a5a }), { ol: 0.03 });
  ib.scale.y = 2.2; ib.position.set(I.x + 4, H(I.x + 4, I.z) + 1.2, I.z - 2); s.add(ib);
}
