// Corrupted wildlife of Whispering Woods: Slime, Corrupted Gumi Fox, and the boss Gumi Wolf (Nine Tails).
import * as THREE from 'three';
import { cullFar } from './cull.js';
import { toon, part, damp, applyRim } from './toon.js';
import { boostGlow } from './graphics.js';
import { sfx } from './sfx.js';
import { SHIELD_COUNTER } from './combat.js';
import { KaliRig } from './heroes3d.js';
import { applyKit, loadGeometry } from './assets.js';

const TYPES = {
  slime: { name: 'Corrupted Slime', hp: 70, dmg: 9, speed: 3.2, radius: 0.65, aggro: 15, exp: 12, lv: 2 },
  fox: { name: 'Corrupted Gumi Fox', hp: 120, dmg: 13, speed: 6.2, radius: 0.7, aggro: 20, exp: 22, lv: 4 },
  boss: { name: 'Gumi Wolf · Nine Tails', hp: 2600, dmg: 24, speed: 6.8, radius: 2.2, aggro: 30, exp: 400, lv: 10 },
  reefslime: { name: 'Slime Pelangi', hp: 110, dmg: 13, speed: 3.4, radius: 0.65, aggro: 15, exp: 20, lv: 7 },
  jelly: { name: 'Ubur-ubur Racun', hp: 90, dmg: 11, speed: 3.2, radius: 0.6, aggro: 20, exp: 22, lv: 7 },
  spire: { name: 'Menara Karang Terkorupsi', hp: 900, dmg: 0, speed: 0, radius: 1.3, aggro: 0, exp: 70, lv: 8 },
  queen: { name: 'Slime Queen · Gelatinous Overlord', hp: 5200, dmg: 26, speed: 4.2, radius: 4, aggro: 34, exp: 800, lv: 14 },
  ghost: { name: 'Eroghost', hp: 150, dmg: 16, speed: 4.5, radius: 0.6, aggro: 18, exp: 30, lv: 11 },
  lavafox: { name: 'Rubah Lava', hp: 190, dmg: 18, speed: 6.6, radius: 0.7, aggro: 20, exp: 34, lv: 12 },
  seal: { name: 'Segel Darah', hp: 1300, dmg: 0, speed: 0, radius: 1.2, aggro: 0, exp: 90, lv: 13 },
  bloodcrystal: { name: 'Kristal Darah', hp: 320, dmg: 0, speed: 0, radius: 0.9, aggro: 0, exp: 10, lv: 15 },
  frostwolf: { name: 'Serigala Salju', hp: 260, dmg: 22, speed: 7, radius: 0.7, aggro: 22, exp: 46, lv: 16 },
  frostsoul: { name: 'Arwah Beku', hp: 210, dmg: 20, speed: 4.8, radius: 0.6, aggro: 18, exp: 42, lv: 16 },
  iceblock: { name: 'Warga Membeku', hp: 1100, dmg: 0, speed: 0, radius: 1.3, aggro: 0, exp: 80, lv: 17 },
  voideye: { name: 'Mata Void', hp: 320, dmg: 26, speed: 4, radius: 0.7, aggro: 24, exp: 60, lv: 22 },
  voidwisp: { name: 'Arwah Void', hp: 360, dmg: 28, speed: 5.2, radius: 0.6, aggro: 20, exp: 62, lv: 22 },
  voidroot: { name: 'Akar Void', hp: 1400, dmg: 0, speed: 0, radius: 1.1, aggro: 0, exp: 30, lv: 24 },
  anchorguard: { name: 'Penjaga Jangkar', hp: 900, dmg: 30, speed: 6.5, radius: 0.8, aggro: 24, exp: 120, lv: 23 },
  ygg: { name: 'Ygg-Naar · Eye of the Primordial', hp: 16000, dmg: 40, speed: 2, radius: 3.2, aggro: 50, exp: 3000, lv: 28 },
  phantom: { name: 'Eroghost · Frost Phantom', hp: 10500, dmg: 34, speed: 4.5, radius: 2.4, aggro: 40, exp: 1800, lv: 22 },
  sage: { name: 'Evy Blood Sage · Sanguine Crimson Witch', hp: 7600, dmg: 30, speed: 5, radius: 1.6, aggro: 40, exp: 1200, lv: 18 },
  prismguard: { name: 'Penjaga Prisma', hp: 1400, dmg: 32, speed: 6.4, radius: 0.9, aggro: 24, exp: 180, lv: 27 },
  archon: { name: 'Penjaga Surgawi', hp: 2200, dmg: 36, speed: 5.5, radius: 1.1, aggro: 26, exp: 240, lv: 28 },
  sovereign: { name: 'Eclipse Sovereign · Sovereign of Oblivion', hp: 26000, dmg: 48, speed: 6.5, radius: 3.2, aggro: 55, exp: 5000, lv: 30 },
  ashblade: { name: 'Pedang Kerasukan', hp: 560, dmg: 30, speed: 7, radius: 0.6, aggro: 24, exp: 70, lv: 30 },
  ashwraith: { name: 'Arwah Prajurit Abu', hp: 720, dmg: 30, speed: 4.8, radius: 0.6, aggro: 20, exp: 72, lv: 30 },
  cursedblade: { name: 'Pedang Terkutuk', hp: 1700, dmg: 0, speed: 0, radius: 1.0, aggro: 0, exp: 40, lv: 32 },
  kali: { name: 'Kali · Saint Seratus Pedang (Terkorupsi)', hp: 30000, dmg: 50, speed: 7, radius: 1.1, aggro: 40, exp: 5600, lv: 32 },
  eclipsecore: { name: 'Inti Eclipse', hp: 800, dmg: 0, speed: 0, radius: 0.9, aggro: 0, exp: 50, lv: 30 },
};

function makeSlime(color = 0x9fe07a, coreColor = 0xb04bff) {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const mat = toon(color, { transparent: true, opacity: 0.88, emissive: 0x000000 });
  const blob = part(new THREE.SphereGeometry(0.62, 22, 16), mat, { ol: 0.03 });
  blob.scale.set(1, 0.78, 1); blob.position.y = 0.48; body.add(blob);
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), new THREE.MeshBasicMaterial({ color: coreColor }));
  core.position.y = 0.42; body.add(core);
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshBasicMaterial({ color: 0x1a1020 }));
    e.position.set(s * 0.2, 0.62, 0.5); e.scale.set(1, 1.4, 0.5); body.add(e);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff9cf5 }));
    hl.position.set(s * 0.2 - 0.02, 0.66, 0.54); body.add(hl);
  }
  const drip = part(new THREE.SphereGeometry(0.16, 10, 8), mat, { ol: 0.015 }); drip.position.set(0.4, 0.75, 0.1); body.add(drip);
  g.traverse((o) => { if (o.isMesh && !o.userData.isOutline) o.castShadow = true; });
  applyKit('kit_slime', body, { gel: mat }, [blob, drip], { ol: 0.03 });
  return { root: g, body, mats: [mat], core };
}

function makeFox(tails = 3, boss = false, variant = null) {
  const lava = variant === 'lava', ice = variant === 'ice', vd = variant === 'void';
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const fur = toon(boss ? 0xe4dcef : lava ? 0x8a2a1a : ice ? 0xdfeaf6 : vd ? 0x1a1228 : 0x5d3d8a), belly = toon(boss ? 0xb9a6d6 : lava ? 0x2a1a18 : ice ? 0x8fa8c8 : vd ? 0x6a3aaa : 0xf1e6ff), dark = toon(0x1e1430);
  const glowM = new THREE.MeshBasicMaterial({ color: boss ? 0xff5ce1 : lava ? 0xff9a2a : ice ? 0x7fe0ff : vd ? 0xc07aff : 0xd070ff });
  const torso = part(new THREE.SphereGeometry(0.36, 16, 12), fur, { ol: 0.02 }); torso.scale.set(0.9, 0.85, 1.55); torso.position.y = 0.72; body.add(torso);
  const chest = part(new THREE.SphereGeometry(0.26, 12, 10), belly, { ol: 0.015 }); chest.position.set(0, 0.7, 0.38); chest.scale.set(1, 1.1, 0.8); body.add(chest);
  const head = new THREE.Group(); head.position.set(0, 1.02, 0.6); body.add(head);
  const sk = part(new THREE.SphereGeometry(0.26, 14, 10), fur, { ol: 0.02 }); sk.scale.set(1.05, 0.95, 1); head.add(sk);
  const snout = part(new THREE.ConeGeometry(0.13, 0.32, 8), belly, { ol: 0.015 }); snout.rotation.x = Math.PI / 2; snout.position.set(0, -0.06, 0.3); head.add(snout);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), dark); nose.position.set(0, -0.05, 0.46); head.add(nose);
  const headOld = [sk, snout, nose];
  for (const s of [-1, 1]) {
    const ear = part(new THREE.ConeGeometry(0.1, 0.28, 4), fur, { ol: 0.015 }); ear.position.set(s * 0.15, 0.25, -0.02); ear.rotation.set(-0.15, Math.PI / 4, -s * 0.3); head.add(ear);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), glowM); eye.position.set(s * 0.12, 0.06, 0.2); eye.scale.set(1.3, 0.6, 0.5); eye.rotation.z = s * 0.35; head.add(eye);
    headOld.push(ear, eye);
  }
  applyKit('kit_fox_body', body, { fur, belly }, [torso, chest], { ol: 0.02 });
  applyKit('kit_fox_head', head, { fur, belly, dark, glow: glowM }, headOld, { ol: 0.018 });
  const legs = [];
  for (const [x, z] of [[-0.2, 0.38], [0.2, 0.38], [-0.2, -0.38], [0.2, -0.38]]) {
    const lg = new THREE.Group(); lg.position.set(x, 0.62, z); body.add(lg);
    const l = part(new THREE.CylinderGeometry(0.07, 0.05, 0.6, 6), fur, { ol: 0.012 }); l.position.y = -0.3; lg.add(l);
    const paw = part(new THREE.SphereGeometry(0.075, 8, 6), dark, { ol: 0.01 }); paw.position.set(0, -0.6, 0.03); lg.add(paw);
    applyKit('kit_fox_leg', lg, { fur, dark }, [l, paw], { ol: 0.012 });
    legs.push(lg);
  }
  const tailG = [];
  for (let i = 0; i < tails; i++) {
    const tg = new THREE.Group(); tg.position.set(0, 0.85, -0.5); body.add(tg);
    const spread = tails === 1 ? 0 : (i / (tails - 1) - 0.5) * (boss ? 2.4 : 1.4);
    tg.rotation.set(-0.9, 0, spread);
    const t = part(new THREE.ConeGeometry(0.16, 0.95, 8), fur, { ol: 0.015 }); t.position.y = 0.45; t.rotation.x = Math.PI; tg.add(t);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), glowM); tip.position.y = 0.92; tip.scale.set(1, 1.6, 1); tg.add(tip);
    applyKit('kit_fox_tail', tg, { fur, glow: glowM }, [t, tip], { ol: 0.015 });
    tailG.push(tg);
  }
  if (boss) {
    // crown of foxfire
    for (let i = 0; i < 5; i++) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.25, 6), glowM); f.position.set((i - 2) * 0.09, 0.33, -0.05 - Math.abs(i - 2) * 0.03); head.add(f);
    }
  }
  g.traverse((o) => { if (o.isMesh && !o.userData.isOutline) o.castShadow = true; });
  return { root: g, body, head, legs, tails: tailG, mats: [fur, belly] };
}


function makeJelly() {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const mat = toon(0xff9ae0, { transparent: true, opacity: 0.75, emissive: 0x000000 });
  const bell = part(new THREE.SphereGeometry(0.55, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat, { ol: 0.02 });
  bell.scale.set(1, 0.8, 1); body.add(bell);
  applyKit('kit_jelly', body, { gel: mat }, [bell], { ol: 0.02 });
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), new THREE.MeshBasicMaterial({ color: 0xb04bff })); core.position.y = 0.15; body.add(core);
  const tents = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.012, 0.9, 5), new THREE.MeshBasicMaterial({ color: 0xe6a8ff, transparent: true, opacity: 0.8 }));
    t.geometry.translate(0, -0.45, 0);
    t.position.set(Math.cos(a) * 0.35, 0, Math.sin(a) * 0.35); body.add(t); tents.push(t);
  }
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0x1a1020 })); e.position.set(s * 0.17, 0.22, 0.45); body.add(e); }
  return { root: g, body, mats: [mat], tents, legs: [], tails: [] };
}

function makeSpire() {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const mat = toon(0xa05ce0, { emissive: 0x3a0a6a, emissiveIntensity: 1 });
  const mat2 = toon(0xff7fc8, { emissive: 0x5a1040 });
  for (let i = 0; i < 7; i++) {
    const h = 2 + Math.random() * 2.5;
    const c = part(new THREE.CylinderGeometry(0.08, 0.32, h, 6), i % 2 ? mat : mat2, { ol: 0.02 });
    c.geometry.translate(0, h / 2, 0);
    c.position.set(Math.cos(i * 0.9) * 0.6 * (i ? 1 : 0), 0, Math.sin(i * 0.9) * 0.6 * (i ? 1 : 0));
    c.rotation.set((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.5);
    body.add(c);
  }
  applyKit('kit_coral_spire', body, { a: mat, b: mat2 }, [...body.children], { ol: 0.02, place: (m) => { m.rotation.y = Math.random() * 6.28; } });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 0), new THREE.MeshBasicMaterial({ color: 0xe6a8ff }));
  core.position.y = 1.6; body.add(core);
  return { root: g, body, mats: [mat, mat2], core, legs: [], tails: [] };
}

function makeQueen() {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  // iridescent giant slime: hue shifts with the surface normal
  const geo = new THREE.SphereGeometry(1, 40, 28);
  const col = new Float32Array(geo.attributes.position.count * 3), c = new THREE.Color();
  for (let i = 0; i < geo.attributes.position.count; i++) {
    const nx = geo.attributes.normal.getX(i), ny = geo.attributes.normal.getY(i), nz = geo.attributes.normal.getZ(i);
    c.setHSL((0.5 + nx * 0.15 + ny * 0.25 + nz * 0.1 + 1) % 1, 0.75, 0.72);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = toon(0xffffff, { vertexColors: true, emissive: 0x000000 });
  const blob = part(geo, mat, { ol: 0.01 });
  // glossy highlight
  const shine = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }));
  shine.position.set(-0.45, 0.55, 0.62); shine.scale.set(1, 0.6, 0.3); blob.add(shine);
  blob.scale.set(4.2, 3.0, 4.2); blob.position.y = 2.8; body.add(blob);
  // Blender gel body; the iridescent hue is still derived from the normals, as above
  loadGeometry('kit_queen_gel').then((src) => {
    if (!src) return;
    const g2 = src.clone(); g2.deleteAttribute('color');
    const n = g2.attributes.normal, cc = new Float32Array(n.count * 3);
    for (let i = 0; i < n.count; i++) { c.setHSL((0.5 + n.getX(i) * 0.15 + n.getY(i) * 0.25 + n.getZ(i) * 0.1 + 1) % 1, 0.75, 0.72); cc[i * 3] = c.r; cc[i * 3 + 1] = c.g; cc[i * 3 + 2] = c.b; }
    g2.setAttribute('color', new THREE.BufferAttribute(cc, 3));
    blob.geometry = g2; for (const ch of blob.children) if (ch.userData.isOutline) ch.geometry = g2;
  });
  
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), new THREE.MeshBasicMaterial({ color: 0x1a1020 })); e.position.set(s * 1.2, 3.6, 3.75); e.scale.set(1, 1.5, 0.5); body.add(e);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff })); hl.position.set(s * 1.2 - 0.1, 3.8, 3.92); body.add(hl);
  }
  // the queen herself, riding on top
  const rider = new THREE.Group(); rider.position.y = 5.55; rider.scale.setScalar(1.7); body.add(rider);
  const skin = toon(0xf4c9a8), teal = toon(0x3fc9b0), suit = toon(0x2fb89a), gold = toon(0xf0c35a);
  const riderArms = [];
  const torso = part(new THREE.CylinderGeometry(0.16, 0.13, 0.5, 10), suit, { ol: 0.01 }); torso.position.y = 0.5; rider.add(torso);
  const hip = part(new THREE.SphereGeometry(0.17, 12, 10), suit, { ol: 0.01 }); hip.scale.set(1.1, 0.7, 0.9); hip.position.y = 0.22; rider.add(hip);
  for (const s of [-1, 1]) {
    const leg = part(new THREE.CylinderGeometry(0.07, 0.05, 0.8, 8), skin, { ol: 0.008 }); leg.position.set(s * 0.22, 0.05, 0.3); leg.rotation.x = -1.3; leg.rotation.z = s * 0.3; rider.add(leg);
    const arm = part(new THREE.CylinderGeometry(0.05, 0.04, 0.55, 8), toon(0xf6f6f6), { ol: 0.008 }); arm.position.set(s * 0.25, 0.55, 0.05); arm.rotation.z = s * 0.5; rider.add(arm);
    riderArms.push(arm);
  }
  const head = part(new THREE.SphereGeometry(0.17, 14, 12), skin, { ol: 0.01 }); head.position.y = 0.95; rider.add(head);
  const hair = part(new THREE.SphereGeometry(0.185, 14, 12, 0, Math.PI * 2, 0, 1.8), teal, { ol: 0.01 }); hair.position.set(0, 0.97, -0.02); rider.add(hair);
  const long = part(new THREE.CylinderGeometry(0.17, 0.26, 0.9, 12, 1, true, Math.PI * 0.55, Math.PI * 0.9), toon(0x3fc9b0, { side: THREE.DoubleSide }), { ol: 0.008 }); long.position.set(0, 0.55, -0.05); rider.add(long);
  for (let i = 0; i < 5; i++) { const sp = part(new THREE.ConeGeometry(0.035, 0.14, 4), gold, { ol: 0.004 }); sp.position.set((i - 2) * 0.06, 1.15, 0.05 - Math.abs(i - 2) * 0.02); rider.add(sp); }
  applyKit('kit_queen_rider', rider, { skin, hair: teal, suit, gold }, rider.children.filter((o) => !riderArms.includes(o)), { ol: 0.008 });
  const scepter = new THREE.Group(); scepter.position.set(0.45, 0.4, 0.15); rider.add(scepter);
  scepter.add(part(new THREE.CylinderGeometry(0.025, 0.025, 1.1, 6), gold, { ol: 0.006 }));
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff8fd0 })); orb.position.y = 0.6; scepter.add(orb);
  // orbiting mini slimes
  const minis = [];
  for (let i = 0; i < 5; i++) {
    const m = part(new THREE.SphereGeometry(0.45, 12, 10), toon([0xff9ad5, 0x8fd8ff, 0x7ff0d0, 0xffd27a, 0xc8a0ff][i], { transparent: true, opacity: 0.85 }), { ol: 0.01 });
    m.scale.y = 0.75; body.add(m); minis.push(m);
  }
  g.traverse((o) => { if (o.isMesh && !o.userData.isOutline) o.castShadow = true; });
  return { root: g, body, blob, rider, minis, mats: [mat], legs: [], tails: [], head: rider };
}


function makeGhost(tint = 0xc6cde4) {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const mat = toon(tint, { transparent: true, opacity: 0.8, emissive: 0x000000, side: THREE.DoubleSide, rimColor: 0xa8dcff, rimStrength: 0.55 });
  const sheet = part(new THREE.CylinderGeometry(0.28, 0.75, 1.9, 16, 3, true), mat, { ol: 0.015 }); sheet.position.y = 0.2; body.add(sheet);
  const top = part(new THREE.SphereGeometry(0.3, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat, { ol: 0.015 }); top.position.y = 1.15; body.add(top);
  const ghostOld = [];
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0x0a0a10 })); e.position.set(s * 0.1, 1.15, 0.31); e.scale.set(1, 1.5, 0.5); body.add(e);
    const sl = part(new THREE.ConeGeometry(0.22, 0.9, 8, 1, true), mat, { ol: 0.01 }); sl.position.set(s * 0.45, 0.7, 0); sl.rotation.z = s * 0.9; body.add(sl);
    ghostOld.push(sl);
  }
  const hair = part(new THREE.CylinderGeometry(0.18, 0.32, 1.3, 10, 1, true, Math.PI * 0.6, Math.PI * 0.8), toon(0xf4d27a, { side: THREE.DoubleSide }), { ol: 0.008 }); hair.position.set(0, 0.45, -0.12); body.add(hair);
  applyKit('kit_ghost', body, { cloak: mat, hair: hair.material }, [...ghostOld, sheet, top, hair], { ol: 0.015 });
  const wisps = [];
  for (let i = 0; i < 3; i++) { const w = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.7 })); body.add(w); wisps.push(w); }
  return { root: g, body, mats: [mat], wisps, legs: [], tails: [] };
}

function makeSeal(small = false) {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const stone = toon(0x3a2a2e, { flatShading: true, emissive: 0x000000 });
  const blood = toon(0xc0182a, { emissive: 0x6a0a14, emissiveIntensity: 1 });
  const s = small ? 0.6 : 1;
  const base = part(new THREE.CylinderGeometry(1.1 * s, 1.4 * s, 0.6 * s, 6), stone, { ol: 0.03 }); base.position.y = 0.3 * s; body.add(base);
  const obel = part(new THREE.CylinderGeometry(0.25 * s, 0.6 * s, 3.4 * s, 4), small ? blood : stone, { ol: 0.03 }); obel.position.y = 2.2 * s; body.add(obel);
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.45 * s, 0), new THREE.MeshBasicMaterial({ color: 0xff2a3a })); core.position.y = (small ? 2.6 : 4.3) * s; body.add(core);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.8 * s, 0.05, 6, 24), new THREE.MeshBasicMaterial({ color: 0xff4a5a })); ring.position.y = core.position.y; ring.rotation.x = Math.PI / 2; body.add(ring);
  applyKit('kit_blood_seal', body, { base: stone, obel: small ? blood : stone }, [base, obel], { ol: 0.03, place: (m) => m.scale.setScalar(s) });
  return { root: g, body, mats: [stone, blood], core, ring, legs: [], tails: [] };
}

function makeSage() {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const skin = toon(0xf2a0a8, { emissive: 0x000000 }), robe = toon(0xf6eef0, { side: THREE.DoubleSide }), hairM = toon(0xc8283a, { side: THREE.DoubleSide });
  const fig = new THREE.Group(); fig.scale.setScalar(2.3); fig.position.y = 1.2; body.add(fig);
  const skirt = part(new THREE.ConeGeometry(0.42, 1.2, 14, 1, true), robe, { ol: 0.008 }); skirt.position.y = 0.6; fig.add(skirt);
  const torso = part(new THREE.CylinderGeometry(0.15, 0.13, 0.55, 12), skin, { ol: 0.008 }); torso.position.y = 1.4; fig.add(torso);
  const chest = part(new THREE.SphereGeometry(0.17, 12, 10), robe, { ol: 0.008 }); chest.scale.set(1.05, 0.8, 0.8); chest.position.y = 1.55; fig.add(chest);
  const head = part(new THREE.SphereGeometry(0.15, 14, 12), skin, { ol: 0.008 }); head.position.y = 1.9; fig.add(head);
  for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe0ff })); e.position.set(sx * 0.055, 1.92, 0.135); fig.add(e); }
  const horn = part(new THREE.ConeGeometry(0.03, 0.25, 6), toon(0xf6eef0), { ol: 0.004 }); horn.position.set(0, 2.12, 0.05); fig.add(horn);
  const hair = part(new THREE.CylinderGeometry(0.16, 0.34, 1.5, 14, 1, true, Math.PI * 0.45, Math.PI * 1.1), hairM, { ol: 0.006 }); hair.position.set(0, 1.2, -0.06); fig.add(hair);
  const hairTop = part(new THREE.SphereGeometry(0.165, 14, 10, 0, Math.PI * 2, 0, 1.7), hairM, { ol: 0.006 }); hairTop.position.y = 1.92; fig.add(hairTop);
  applyKit('kit_sage', fig, { skin, robe, hair: hairM }, [skirt, torso, chest, head, hair, hairTop], { ol: 0.006 });
  // six arms holding blood orbs & skulls
  const arms = [], orbs = [];
  for (let k = 0; k < 6; k++) {
    const sx = k % 2 ? 1 : -1, row = Math.floor(k / 2);
    const a = new THREE.Group(); a.position.set(sx * 0.17, 1.6 - row * 0.12, 0); fig.add(a);
    const up = part(new THREE.CylinderGeometry(0.035, 0.03, 0.5, 8), skin, { ol: 0.005 }); up.position.y = 0.25; a.add(up);
    a.rotation.z = -sx * (0.9 + row * 0.6); a.rotation.x = -0.3 + row * 0.3;
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshBasicMaterial({ color: [0xff2a3a, 0xd0f0ff, 0xff8aa0][row] }));
    orb.position.y = 0.55; a.add(orb);
    arms.push(a); orbs.push(orb);
  }
  const aura = new THREE.Mesh(new THREE.RingGeometry(1.8, 2.2, 40), new THREE.MeshBasicMaterial({ color: 0xff2a3a, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
  aura.rotation.x = -Math.PI / 2; aura.position.y = 0.1; g.add(aura);
  const shield = new THREE.Mesh(new THREE.SphereGeometry(3.4, 24, 16), new THREE.MeshBasicMaterial({ color: 0xff3a4a, transparent: true, opacity: 0.25, depthWrite: false }));
  shield.position.y = 3.4; shield.visible = false; g.add(shield);
  g.traverse((o) => { if (o.isMesh && !o.userData.isOutline) o.castShadow = true; });
  return { root: g, body, fig, arms, orbs, aura, shield, mats: [skin], legs: [], tails: [], head: fig };
}


function makeIceBlock() {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const iceM = toon(0xbfeeff, { transparent: true, opacity: 0.55, emissive: 0x000000, flatShading: true });
  const block = part(new THREE.DodecahedronGeometry(1.6, 0), iceM, { ol: 0.02 }); block.scale.set(0.9, 1.35, 0.9); block.position.y = 1.6; body.add(block);
  // frozen villager inside
  const v = new THREE.Group(); v.position.y = 0.4; body.add(v);
  const skin = toon(0xc8d8f0), cloth = toon(0x6a8ab0);
  const torso = part(new THREE.CylinderGeometry(0.2, 0.25, 0.9, 10), cloth, { ol: 0.01 }); torso.position.y = 1.1; v.add(torso);
  const head = part(new THREE.SphereGeometry(0.2, 12, 10), skin, { ol: 0.01 }); head.position.y = 1.75; v.add(head);
  for (const s of [-1, 1]) { const leg = part(new THREE.CylinderGeometry(0.08, 0.07, 0.7, 8), cloth, { ol: 0.008 }); leg.position.set(s * 0.1, 0.35, 0); v.add(leg); const arm = part(new THREE.CylinderGeometry(0.06, 0.05, 0.6, 8), cloth, { ol: 0.008 }); arm.position.set(s * 0.3, 1.2, 0.1); arm.rotation.z = s * 0.6; arm.rotation.x = -0.6; v.add(arm); }
  const iceOld = [block];
  for (let k = 0; k < 5; k++) { const sp = part(new THREE.ConeGeometry(0.25, 1.2, 5), iceM, { ol: 0.01 }); const a = k * 1.25; sp.position.set(Math.cos(a) * 1.3, 0.5, Math.sin(a) * 1.3); sp.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6); body.add(sp); iceOld.push(sp); }
  applyKit('kit_ice_prison', body, { ice: iceM }, iceOld, { ol: 0.02 });
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.25), new THREE.MeshBasicMaterial({ color: 0x9a7aff })); core.position.y = 3.2; body.add(core);
  return { root: g, body, mats: [iceM], core, ring: core, legs: [], tails: [] };
}

function makePhantom() {
  const g = makeGhost(0xa6cfe8);
  g.root.scale.setScalar(3.4);
  const crownM = toon(0x9ee8ff, { emissive: 0x2a6a9a, emissiveIntensity: 0.9 });
  for (let k = 0; k < 7; k++) { const c = part(new THREE.ConeGeometry(0.06, 0.32, 5), crownM, { ol: 0.004 }); const a = (k / 7) * Math.PI * 2; c.position.set(Math.cos(a) * 0.22, 1.5, Math.sin(a) * 0.22); g.body.add(c); }
  const shards = [];
  for (let k = 0; k < 6; k++) { const sh = part(new THREE.OctahedronGeometry(0.16, 0), crownM, { ol: 0.004 }); sh.scale.y = 2.2; g.body.add(sh); shards.push(sh); }
  g.shards = shards;
  return g;
}


function makeEye() {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const flesh = toon(0x2a1a3a, { emissive: 0x000000 });
  const ball = part(new THREE.SphereGeometry(0.55, 18, 14), toon(0xf4eef8, { emissive: 0x000000 }), { ol: 0.02 }); body.add(ball);
  const iris = new THREE.Mesh(new THREE.CircleGeometry(0.28, 20), new THREE.MeshBasicMaterial({ color: 0xa04aff })); iris.position.z = 0.54; body.add(iris);
  const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.12, 16), new THREE.MeshBasicMaterial({ color: 0x0a0010 })); pupil.position.z = 0.55; body.add(pupil);
  const lid = part(new THREE.SphereGeometry(0.58, 16, 10, 0, Math.PI * 2, 0, 1.1), flesh, { ol: 0.015 }); lid.rotation.x = -0.4; body.add(lid);
  const tents = [];
  for (let i = 0; i < 5; i++) {
    const t = new THREE.Group(); const a = (i / 5) * Math.PI * 2; t.position.set(Math.cos(a) * 0.3, -0.4, Math.sin(a) * 0.3); body.add(t);
    for (let k = 0; k < 4; k++) { const sg = part(new THREE.SphereGeometry(0.09 - k * 0.015, 8, 6), flesh, { ol: 0.006 }); sg.position.y = -k * 0.16; t.add(sg); }
    applyKit('kit_eye_tentacle', t, { flesh }, [...t.children], { ol: 0.006 });
    tents.push(t);
  }
  applyKit('kit_void_eye', body, { sclera: ball.material, flesh }, [ball, lid], { ol: 0.02 });
  return { root: g, body, mats: [flesh], tents, legs: [], tails: [] };
}

function makeVoidRoot() {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const m = toon(0x1a1028, { emissive: 0x000000 });
  for (let i = 0; i < 5; i++) {
    const seg = part(new THREE.CylinderGeometry(0.5 - i * 0.08, 0.6 - i * 0.08, 0.9, 8), m, { ol: 0.02 });
    seg.position.set(Math.sin(i * 0.7) * 0.3, 0.45 + i * 0.8, Math.cos(i * 0.9) * 0.2); seg.rotation.z = Math.sin(i) * 0.3; body.add(seg);
  }
  applyKit('kit_void_root', body, { bark: m }, [...body.children], { ol: 0.02, place: (k) => { k.rotation.y = Math.random() * 6.28; } });
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), new THREE.MeshBasicMaterial({ color: 0xb06aff })); eye.position.y = 3.6; body.add(eye);
  return { root: g, body, mats: [m], core: eye, ring: eye, legs: [], tails: [] };
}

function makeYgg() {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const dark = toon(0x1c1426, { emissive: 0x000000 }), skin = toon(0xd8d0e0), hair = toon(0x120c1a, { side: THREE.DoubleSide });
  const fig = new THREE.Group(); fig.scale.setScalar(3.2); fig.position.y = 0.5; body.add(fig);
  const torso = part(new THREE.CylinderGeometry(0.16, 0.13, 0.6, 12), dark, { ol: 0.006 }); torso.position.y = 1.35; fig.add(torso);
  const hips = part(new THREE.SphereGeometry(0.17, 12, 10), dark, { ol: 0.006 }); hips.scale.set(1.1, 0.75, 0.9); hips.position.y = 1.0; fig.add(hips);
  const yggOld = [torso, hips];
  for (const s of [-1, 1]) { const leg = part(new THREE.CylinderGeometry(0.07, 0.045, 1.0, 8), skin, { ol: 0.005 }); leg.position.set(s * 0.09, 0.5, 0); fig.add(leg); yggOld.push(leg); }
  applyKit('kit_ygg_body', fig, { dark, skin }, yggOld, { ol: 0.005 });
  const head = new THREE.Group(); head.position.y = 1.85; fig.add(head);
  head.add(part(new THREE.SphereGeometry(0.17, 16, 12), skin, { ol: 0.006 }));
  const lh = part(new THREE.CylinderGeometry(0.17, 0.3, 1.6, 14, 1, true, Math.PI * 0.45, Math.PI * 1.1), hair, { ol: 0.005 }); lh.position.set(0, -0.6, -0.05); head.add(lh);
  head.add(part(new THREE.SphereGeometry(0.18, 14, 10, 0, Math.PI * 2, 0, 1.4), hair, { ol: 0.005 }));
  applyKit('kit_ygg_head', head, { skin, hair }, [...head.children], { ol: 0.005 });
  // the great eye
  const eyeW = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff })); eyeW.position.set(0, 0.01, 0.12); eyeW.scale.z = 0.6; head.add(eyeW);
  const iris = new THREE.Mesh(new THREE.CircleGeometry(0.075, 20), new THREE.MeshBasicMaterial({ color: 0xa04aff })); iris.position.set(0, 0.01, 0.19); head.add(iris);
  const lid = part(new THREE.SphereGeometry(0.115, 14, 10, 0, Math.PI * 2, 0, 1.6), skin, { ol: 0 }); lid.position.set(0, 0.01, 0.12); lid.scale.z = 0.62; lid.rotation.x = -Math.PI / 2; lid.visible = false; head.add(lid);
  // tentacles with eyes
  const tents = [];
  for (let i = 0; i < 8; i++) {
    const t = new THREE.Group(); const a = (i / 8) * Math.PI * 2;
    t.position.set(Math.cos(a) * 0.8, 3.6 + (i % 2) * 0.6, Math.sin(a) * 0.8 - 0.6); body.add(t);
    const segs = [];
    let prev = t;
    for (let k = 0; k < 7; k++) {
      const j = new THREE.Group(); j.position.y = k ? 0.75 : 0; prev.add(j);
      const ball = part(new THREE.SphereGeometry(0.34 - k * 0.03, 10, 8), dark, { ol: 0.015 }); j.add(ball);
      const ks = (0.34 - k * 0.03) / 0.34;
      applyKit('kit_ygg_seg', j, { dark }, [ball], { ol: 0.015, place: (m) => m.scale.setScalar(ks) });
      segs.push(j); prev = j;
    }
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), new THREE.MeshBasicMaterial({ color: 0x8a3aff })); tip.position.y = 0.7; prev.add(tip);
    t.rotation.z = Math.cos(a) * -1.0; t.rotation.x = Math.sin(a) * 1.0;
    tents.push({ t, segs, tip, a });
  }
  g.traverse((o) => { if (o.isMesh && !o.userData.isOutline) o.castShadow = true; });
  return { root: g, body, fig, tents, iris, eyeW, lid, mats: [dark], legs: [], tails: [], head };
}

function makePrismGuard() {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const armor = toon(0xfbfcfe);
  const gold = toon(0xffd700, { emissive: 0x664400, emissiveIntensity: 0.6 });
  const glow = new THREE.MeshBasicMaterial({ color: 0x66e0ff });

  const torso = part(new THREE.CylinderGeometry(0.24, 0.16, 0.8, 6), armor, { ol: 0.012 });
  torso.position.y = 1.3; body.add(torso);
  const coreGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), glow);
  coreGem.position.set(0, 1.35, 0.25); body.add(coreGem);

  const pgOld = [torso];
  for (const s of [-1, 1]) {
    const p = part(new THREE.ConeGeometry(0.18, 0.45, 4), gold, { ol: 0.01 });
    p.position.set(s * 0.45, 1.55, 0); p.rotation.z = -s * 0.7; body.add(p); pgOld.push(p);
  }

  const head = part(new THREE.DodecahedronGeometry(0.18, 0), armor, { ol: 0.01 });
  head.position.y = 1.85; body.add(head);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, 0.12), glow);
  visor.position.set(0, 1.85, 0.19); body.add(visor);

  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.03, 6, 24), gold);
  halo.position.set(0, 2.15, -0.05); halo.rotation.x = 0.3; body.add(halo);

  const blades = [];
  for (const s of [-1, 1]) {
    const bldG = new THREE.Group();
    bldG.position.set(s * 0.55, 1.1, 0.2);
    const bld = part(new THREE.ConeGeometry(0.08, 1.1, 4), gold, { ol: 0.01 });
    bld.rotation.x = Math.PI; bldG.add(bld);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.5, 4), glow);
    tip.position.y = -0.55; tip.rotation.x = Math.PI; bldG.add(tip);
    applyKit('kit_prism_blade', bldG, { gold, glow }, [bld, tip], { ol: 0.01 });
    body.add(bldG);
    blades.push(bldG);
  }

  const skirt = part(new THREE.ConeGeometry(0.32, 0.6, 6, 1, true), armor, { ol: 0.012 });
  skirt.position.y = 0.75; body.add(skirt);
  const thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.02, 0.35, 8), glow);
  thruster.position.y = 0.4; body.add(thruster);
  applyKit('kit_prismguard', body, { armor, gold }, [...pgOld, head, skirt], { ol: 0.012 });

  g.traverse((o) => { if (o.isMesh && !o.userData.isOutline) o.castShadow = true; });
  return { root: g, body, blades, halo, thruster, mats: [armor, gold], legs: [], tails: [], head };
}

function makeArchon() {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const robe = toon(0xf8f6f0, { side: THREE.DoubleSide });
  const gold = toon(0xffcc33, { emissive: 0x885500, emissiveIntensity: 0.8 });
  const glow = new THREE.MeshBasicMaterial({ color: 0xffe680 });
  const darkSilk = toon(0x282038);

  const fig = new THREE.Group(); fig.scale.setScalar(1.6); fig.position.y = 0.4; body.add(fig);

  const skirt = part(new THREE.ConeGeometry(0.38, 1.2, 12, 1, true), robe, { ol: 0.01 });
  skirt.position.y = 0.6; fig.add(skirt);
  const sash = part(new THREE.CylinderGeometry(0.2, 0.22, 0.2, 10), darkSilk, { ol: 0.008 });
  sash.position.y = 1.15; fig.add(sash);
  const torso = part(new THREE.CylinderGeometry(0.18, 0.16, 0.6, 10), robe, { ol: 0.01 });
  torso.position.y = 1.45; fig.add(torso);

  const head = part(new THREE.SphereGeometry(0.16, 14, 12), toon(0xffeedd), { ol: 0.008 });
  head.position.y = 1.95; fig.add(head);
  applyKit('kit_archon', fig, { skin: head.material, hair: toon(0xf4e3b0, { side: THREE.DoubleSide }), robe, silk: darkSilk, gold }, [skirt, sash, torso, head], { ol: 0.008 });
  const crown = part(new THREE.TorusGeometry(0.24, 0.03, 6, 24), gold, { ol: 0.006 });
  crown.position.set(0, 2.15, -0.05); crown.rotation.x = 0.4; fig.add(crown);

  const wings = [];
  for (let k = 0; k < 4; k++) {
    const s = k % 2 === 0 ? -1 : 1;
    const up = k < 2;
    const wG = new THREE.Group();
    wG.position.set(s * 0.15, up ? 1.6 : 1.35, -0.15);
    fig.add(wG);
    const blade = part(new THREE.BoxGeometry(0.04, up ? 0.9 : 0.65, 0.22), gold, { ol: 0.008 });
    blade.position.set(s * (up ? 0.45 : 0.32), up ? 0.35 : -0.15, 0);
    blade.rotation.z = -s * (up ? 0.7 : 0.35);
    wG.add(blade);
    const feather = new THREE.Mesh(new THREE.ConeGeometry(0.12, up ? 0.8 : 0.55, 4), glow);
    feather.position.set(s * (up ? 0.5 : 0.35), up ? 0.4 : -0.2, 0);
    feather.rotation.z = -s * (up ? 0.8 : 0.4);
    wG.add(feather);
    const fl = (up ? 0.8 : 0.55) * 1.25;
    applyKit('kit_feather', wG, { spine: gold, vane: glow }, [blade, feather], { ol: 0.006, place: (m) => { m.position.copy(feather.position); m.rotation.copy(feather.rotation); m.scale.set(fl * s, fl, fl); } });
    wings.push(wG);
  }

  const halberd = new THREE.Group();
  halberd.position.set(0.4, 1.4, 0.2);
  const shaft = part(new THREE.CylinderGeometry(0.025, 0.025, 2.4, 8), darkSilk, { ol: 0.006 });
  shaft.position.y = 0.2; halberd.add(shaft);
  const spearHead = part(new THREE.ConeGeometry(0.09, 0.6, 4), gold, { ol: 0.008 });
  spearHead.position.y = 1.5; halberd.add(spearHead);
  const energyTip = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), glow);
  energyTip.position.y = 1.25; halberd.add(energyTip);
  applyKit('kit_halberd', halberd, { silk: darkSilk, gold }, [shaft, spearHead], { ol: 0.006 });
  fig.add(halberd);

  g.traverse((o) => { if (o.isMesh && !o.userData.isOutline) o.castShadow = true; });
  return { root: g, body, fig, wings, halberd, mats: [robe, gold], legs: [], tails: [], head: fig };
}

// ===================== ASHEN BATTLEFIELD (Arc 2 · Bab 6) =====================
function bladeMesh(steel, dark, size = 1) {
  const g = new THREE.Group();
  const bl = part(new THREE.BoxGeometry(0.12 * size, 1.5 * size, 0.035 * size), steel, { ol: 0.01 }); bl.position.y = 0.75 * size; g.add(bl);
  const tip = part(new THREE.ConeGeometry(0.085 * size, 0.25 * size, 4), steel, { ol: 0.008 }); tip.position.y = 1.62 * size; tip.rotation.y = Math.PI / 4; tip.scale.z = 0.4; g.add(tip);
  const guard = part(new THREE.BoxGeometry(0.46 * size, 0.08 * size, 0.1 * size), dark, { ol: 0.008 }); g.add(guard);
  const grip = part(new THREE.CylinderGeometry(0.04 * size, 0.04 * size, 0.42 * size, 8), dark, { ol: 0.008 }); grip.position.y = -0.24 * size; g.add(grip);
  applyKit('kit_blade', g, { steel, dark }, [bl, tip, guard, grip], { ol: 0.008, place: (m) => m.scale.setScalar(size) });
  return g;
}

function makeAshBlade() {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const steel = toon(0xb8b4c8, { emissive: 0x2a0a4a, emissiveIntensity: 0.6 }), dark = toon(0x2a2030);
  const b = bladeMesh(steel, dark, 1); b.position.y = -0.7; body.add(b);
  const wisp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshBasicMaterial({ color: 0xb070ff, transparent: true, opacity: 0.55, depthWrite: false }));
  body.add(wisp);
  g.traverse((o) => { if (o.isMesh && !o.userData.isOutline) o.castShadow = true; });
  return { root: g, body, wisp, mats: [steel], legs: [], tails: [] };
}

function makeCursedBlade() {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const steel = toon(0x4a3a5a, { emissive: 0x3a0a5a, emissiveIntensity: 0.9 }), dark = toon(0x1a1420);
  const b = bladeMesh(steel, dark, 2.4); b.rotation.x = Math.PI; b.position.y = 3.6; b.rotation.z = 0.08; body.add(b);
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), new THREE.MeshBasicMaterial({ color: 0xd060ff }));
  core.position.y = 3.75; body.add(core);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.4, 32), new THREE.MeshBasicMaterial({ color: 0xa040ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; g.add(ring);
  g.traverse((o) => { if (o.isMesh && !o.userData.isOutline) o.castShadow = true; });
  return { root: g, body, core, mats: [steel], legs: [], tails: [] };
}

function makeKaliBoss() {
  const g = new THREE.Group();
  const rig = new KaliRig(true);
  rig.root.scale.setScalar(1.9);
  g.add(rig.root);
  const steel = toon(0x8a6ab8, { emissive: 0x5a1a8a, emissiveIntensity: 1.3 }), dark = toon(0x1a1420);
  const orbit = new THREE.Group(); g.add(orbit);
  const orbitBlades = [];
  for (let i = 0; i < 8; i++) { const b = bladeMesh(steel, dark, 0.8); orbit.add(b); orbitBlades.push(b); }
  const barrier = new THREE.Mesh(new THREE.SphereGeometry(3.6, 24, 16), new THREE.MeshBasicMaterial({ color: 0xa040ff, transparent: true, opacity: 0.22, depthWrite: false }));
  barrier.position.y = 2.2; barrier.visible = false; g.add(barrier);
  return { root: g, rig, body: rig.root, orbit, orbitBlades, barrier, mats: rig.flashMats, legs: [], tails: [] };
}

function makeEclipseCore() {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const darkCore = toon(0x1a0f26, { emissive: 0x4a0066, emissiveIntensity: 1.2 });
  const gold = toon(0xffcc22, { emissive: 0xffaa00, emissiveIntensity: 1.5 });

  const core = part(new THREE.OctahedronGeometry(0.65, 0), darkCore, { ol: 0.02 });
  core.position.y = 1.6; body.add(core);
  applyKit('kit_eclipse_core', core, { core: darkCore, gold }, [...core.children], { ol: 0.02, place: () => { core.geometry = new THREE.BufferGeometry(); } });

  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.05, 6, 28), gold);
  ring1.position.y = 1.6; ring1.rotation.x = Math.PI / 3; body.add(ring1);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.04, 6, 28), gold);
  ring2.position.y = 1.6; ring2.rotation.y = Math.PI / 4; body.add(ring2);

  const aura = new THREE.Mesh(new THREE.SphereGeometry(0.75, 12, 10), new THREE.MeshBasicMaterial({ color: 0xaa22ff, transparent: true, opacity: 0.35, depthWrite: false }));
  aura.position.y = 1.6; body.add(aura);

  return { root: g, body, core, ring1, ring2, mats: [darkCore, gold], legs: [], tails: [] };
}

function makeSovereign() {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const darkArmor = toon(0x181224, { emissive: 0x24143a, emissiveIntensity: 0.8 });
  const solarGold = toon(0xffbb22, { emissive: 0xff8800, emissiveIntensity: 1.8 });
  const solarFlame = new THREE.MeshBasicMaterial({ color: 0xff3355 });
  const skin = toon(0xf8e8e4);
  const hairM = toon(0xf5f3f0, { side: THREE.DoubleSide });

  const fig = new THREE.Group(); fig.scale.setScalar(3.2); fig.position.y = 1.2; body.add(fig);

  const cuirass = part(new THREE.CylinderGeometry(0.18, 0.14, 0.65, 10), darkArmor, { ol: 0.008 });
  cuirass.position.y = 1.45; fig.add(cuirass);
  const crest = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), solarFlame);
  crest.position.set(0, 1.55, 0.16); fig.add(crest);
  const skirt = part(new THREE.ConeGeometry(0.42, 1.3, 12, 1, true), darkArmor, { ol: 0.008 });
  skirt.position.y = 0.65; fig.add(skirt);
  applyKit('kit_sovereign_body', fig, { armor: darkArmor, gold: solarGold }, [cuirass, skirt], { ol: 0.008 });

  const head = new THREE.Group(); head.position.y = 1.95; fig.add(head);
  head.add(part(new THREE.SphereGeometry(0.16, 14, 12), skin, { ol: 0.006 }));
  const hair = part(new THREE.CylinderGeometry(0.16, 0.36, 1.8, 14, 1, true, Math.PI * 0.4, Math.PI * 1.2), hairM, { ol: 0.006 });
  hair.position.set(0, -0.65, -0.06); head.add(hair);
  head.add(part(new THREE.SphereGeometry(0.175, 14, 10, 0, Math.PI * 2, 0, 1.4), hairM, { ol: 0.006 }));
  applyKit('kit_sovereign_head', head, { skin, hair: hairM }, [...head.children], { ol: 0.006 });

  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), solarFlame);
    eye.position.set(s * 0.05, 0.02, 0.135); head.add(eye);
  }

  const corona = new THREE.Group();
  corona.position.set(0, 2.05, -0.3); fig.add(corona);
  const haloDisc = new THREE.Mesh(new THREE.RingGeometry(0.65, 0.85, 36), new THREE.MeshBasicMaterial({ color: 0xff3355, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }));
  corona.add(haloDisc);
  const haloInner = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.58, 32), new THREE.MeshBasicMaterial({ color: 0xffcc33, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
  corona.add(haloInner);
  for (let k = 0; k < 12; k++) {
    const ray = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.45, 4), solarGold);
    const a = (k / 12) * Math.PI * 2;
    ray.position.set(Math.cos(a) * 0.95, Math.sin(a) * 0.95, 0);
    ray.rotation.z = a - Math.PI / 2;
    corona.add(ray);
  }

  const wings = [];
  for (let w = 0; w < 6; w++) {
    const side = w % 2 === 0 ? -1 : 1;
    const tier = Math.floor(w / 2);
    const wG = new THREE.Group();
    wG.position.set(side * 0.15, 1.8 - tier * 0.35, -0.2);
    fig.add(wG);
    const span = 1.6 - tier * 0.3;
    const strut = part(new THREE.BoxGeometry(0.05, span, 0.18), darkArmor, { ol: 0.008 });
    strut.position.set(side * span * 0.5, span * 0.35, 0);
    strut.rotation.z = -side * (0.65 + tier * 0.3);
    wG.add(strut);
    const plume = new THREE.Mesh(new THREE.ConeGeometry(0.18, span * 0.9, 4), solarGold);
    plume.position.set(side * span * 0.55, span * 0.4, 0);
    plume.rotation.z = -side * (0.75 + tier * 0.3);
    wG.add(plume);
    const pl = span * 0.95;
    applyKit('kit_feather', wG, { spine: darkArmor, vane: solarGold }, [strut, plume], { ol: 0.008, place: (m) => { m.position.copy(plume.position); m.rotation.copy(plume.rotation); m.scale.set(pl * side, pl, pl); } });
    wings.push({ group: wG, tier, side });
  }

  const swords = [];
  for (let k = 0; k < 4; k++) {
    const swG = new THREE.Group();
    const bld = part(new THREE.ConeGeometry(0.12, 2.2, 4), darkArmor, { ol: 0.01 });
    bld.rotation.x = Math.PI; swG.add(bld);
    const edge = new THREE.Mesh(new THREE.ConeGeometry(0.07, 1.8, 4), solarFlame);
    edge.position.y = -0.3; edge.rotation.x = Math.PI; swG.add(edge);
    const hilt = part(new THREE.BoxGeometry(0.6, 0.08, 0.12), solarGold, { ol: 0.008 });
    hilt.position.y = 0.7; swG.add(hilt);
    applyKit('kit_sov_sword', swG, { armor: darkArmor, flame: solarFlame, gold: solarGold }, [bld, edge, hilt], { ol: 0.01 });
    fig.add(swG);
    swords.push(swG);
  }

  const barrier = new THREE.Mesh(
    new THREE.SphereGeometry(3.6, 28, 20),
    new THREE.MeshBasicMaterial({ color: 0xff3355, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })
  );
  barrier.position.y = 2.4;
  barrier.visible = false;
  g.add(barrier);

  g.traverse((o) => { if (o.isMesh && !o.userData.isOutline) o.castShadow = true; });
  return { root: g, body, fig, head, corona, wings, swords, barrier, mats: [darkArmor, solarGold], legs: [], tails: [] };
}

export class Enemy {
  constructor(game, type, pos, opts = {}) {
    this.game = game;
    this.type = type;
    const T = TYPES[type];
    this.def = T;
    this.maxHp = this.hp = T.hp;
    this.dmg = T.dmg; this.speed = T.speed; this.radius = T.radius;
    this.pos = pos.clone();
    this.home = pos.clone();
    this.vel = new THREE.Vector3();
    this.vy = 0;
    this.facing = Math.random() * Math.PI * 2;
    this.state = 'idle'; this.t = Math.random() * 2;
    this.stun = 0; this.flash = 0; this.dead = false; this.deadT = 0;
    this.zone = opts.zone;
    this.leash = opts.leash || 40;
    this.aggro = false;
    this.aura = null;   // {el, t} — elemental aura for reactions
    this.slowT = 0;     // Mora's Chronos Ring

    this.isBoss = type === 'boss' || type === 'queen' || type === 'sage' || type === 'phantom' || type === 'ygg' || type === 'sovereign' || type === 'kali';
    this.tall = { boss: 6.2, queen: 8.5, spire: 4.2, jelly: 2.4, fox: 1.9, lavafox: 1.9, ghost: 2.6, seal: 4.4, bloodcrystal: 2.4, sage: 6.4, frostwolf: 1.9, frostsoul: 2.6, iceblock: 3.2, phantom: 9, voideye: 2.6, voidwisp: 2.6, voidroot: 3.6, anchorguard: 2.4, ygg: 10, sovereign: 11, archon: 3.8, prismguard: 2.4, eclipsecore: 2.2, kali: 3.4, ashblade: 1.8, ashwraith: 2.6, cursedblade: 4.2 }[type] ?? 1.5;
    this.static = type === 'spire' || type === 'seal' || type === 'bloodcrystal' || type === 'iceblock' || type === 'voidroot' || type === 'eclipsecore' || type === 'cursedblade';
    const RAINBOW = [[0xff9ad5, 0x6a2fd0], [0x8fd8ff, 0x2f5fd0], [0x7ff0d0, 0x1f9f80], [0xffd27a, 0xd04b8a]];
    const m = type === 'slime' ? makeSlime()
      : type === 'reefslime' ? makeSlime(...RAINBOW[Math.floor(Math.random() * RAINBOW.length)])
      : type === 'jelly' ? makeJelly()
      : type === 'spire' ? makeSpire()
      : type === 'queen' ? makeQueen()
      : type === 'ghost' ? makeGhost()
      : type === 'frostsoul' ? makeGhost(0x9ee8ff)
      : type === 'voidwisp' ? makeGhost(0x5a3a8a)
      : type === 'voideye' ? makeEye()
      : type === 'voidroot' ? makeVoidRoot()
      : type === 'ygg' ? makeYgg()
      : type === 'sovereign' ? makeSovereign()
      : type === 'archon' ? makeArchon()
      : type === 'prismguard' ? makePrismGuard()
      : type === 'eclipsecore' ? makeEclipseCore()
      : type === 'kali' ? makeKaliBoss()
      : type === 'ashblade' ? makeAshBlade()
      : type === 'ashwraith' ? makeGhost(0x8a7a7a)
      : type === 'cursedblade' ? makeCursedBlade()
      : type === 'anchorguard' ? makeFox(5, false, 'void')
      : type === 'iceblock' ? makeIceBlock()
      : type === 'phantom' ? makePhantom()
      : type === 'frostwolf' ? makeFox(3, false, 'ice')
      : type === 'seal' || type === 'bloodcrystal' ? makeSeal(type === 'bloodcrystal')
      : type === 'sage' ? makeSage()
      : type === 'lavafox' ? makeFox(3, false, 'lava')
      : makeFox(type === 'boss' ? 9 : 3, type === 'boss');
    this.floats = type === 'jelly' || type === 'ghost' || type === 'frostsoul' || type === 'phantom' || type === 'voidwisp' || type === 'voideye' || type === 'archon' || type === 'sovereign' || type === 'prismguard' || type === 'eclipsecore' || type === 'ashblade' || type === 'ashwraith';
    this.burnT = 0; this.burnTick = 0; this.invuln = false;
    this.model = m;
    this.root = m.root;
    if (type === 'boss') this.root.scale.setScalar(3.1);
    // poise: how much punishment before staggering (bosses get BROKEN instead)
    this.maxPoise = this.poise = { slime: 18, reefslime: 22, jelly: 20, fox: 28, lavafox: 34, frostwolf: 40, ghost: 26, frostsoul: 32, ashblade: 40, ashwraith: 34 }[type] ?? (this.isBoss ? (type === 'sovereign' || type === 'kali' ? 380 : 260) : 9999);
    this.flinch = 0; this.breakT = 0; this.poiseT = 0;
    // elite variant with an elemental shield
    if (opts.elite) {
      this.elite = true;
      this.maxHp = this.hp = this.maxHp * 3.2; this.dmg *= 1.4; this.maxPoise = this.poise = this.maxPoise * 2.5;
      this.root.scale.multiplyScalar(1.3); this.tall *= 1.3; this.radius *= 1.25;
      this.shield = { el: opts.elite, hp: this.maxHp * 0.45, max: this.maxHp * 0.45 };
      const col = { FIRE: 0xff7a2a, WATER: 0x4fb4f0, ICE: 0x9ee8ff, DARK: 0xb06bff, LIGHT: 0xf5c542, WIND: 0x8fe63a, LIGHTNING: 0xc07aff }[opts.elite] ?? 0xffffff;
      this.shieldMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(1.6), transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending }));
      this.shieldMesh.scale.setScalar(this.tall * 0.62); this.shieldMesh.position.y = this.tall * 0.45 / this.root.scale.x;
      this.shieldMesh.scale.divideScalar(this.root.scale.x);
      this.root.add(this.shieldMesh);
      const crown = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 6, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd66b).multiplyScalar(2) }));
      crown.rotation.x = Math.PI / 2; crown.position.y = (this.tall + 0.2) / this.root.scale.x; this.root.add(crown);
      this.eliteCrown = crown;
    }
    boostGlow(this.root);
    if (this.isBoss) applyRim(this.root, 0xffe0f0, 0.5);
    game.scene.add(this.root);
    cullFar(this.root, undefined, 110);

    // hp bar (camera-facing)
    const bar = new THREE.Group();
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.12), new THREE.MeshBasicMaterial({ color: 0x110811, transparent: true, opacity: 0.75, depthTest: false }));
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(1.06, 0.08), new THREE.MeshBasicMaterial({ color: 0xff4d6d, depthTest: false }));
    fill.position.z = 0.001; bg.renderOrder = 10; fill.renderOrder = 11;
    fill.geometry.translate(0.53, 0, 0); fill.position.x = -0.53;
    bar.add(bg, fill);
    bar.visible = false;
    this.bar = bar; this.barFill = fill;
    if (!this.isBoss) game.scene.add(bar);
    this.root.position.copy(this.pos);
    // aura indicator (small glowing gem above the head)
    this.auraDot = new THREE.Mesh(new THREE.OctahedronGeometry(this.isBoss ? 0.45 : 0.16), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false }));
    this.auraDot.renderOrder = 12; this.auraDot.visible = false;
    game.scene.add(this.auraDot);
  }

  get name() { return (this.elite ? 'Elite ' : '') + this.def.name; }
  get dormant() { return this.isBoss && !this.started; }

  hit(amount, { crit = false, knock = 0, stun = 0, from, element = null, poise = 8, launch = 0 } = {}) {
    if (this.dead) return 0;
    if (this.invuln || this.phased) { this.game.ui.damageNumber(this.pos.clone().setY(this.pos.y + this.tall * 0.9), 'Kebal', ''); return 0; }
    const G = this.game, top = this.pos.clone().setY(this.pos.y + this.tall * 0.9);
    // elemental shield: only the counter element cracks it quickly
    if (this.shield && this.shield.hp > 0) {
      const counter = (SHIELD_COUNTER[this.shield.el] || []).includes(element);
      this.shield.hp -= amount * (counter ? 2.5 : 0.35);
      amount *= 0.2;
      if (counter && Math.random() < 0.4) G.ui.damageNumber(top.clone().setY(top.y + 0.5), 'Efektif!', 'react prism');
      if (this.shield.hp <= 0) {
        this.shield.hp = 0; this.shieldMesh.visible = false;
        this.breakT = 3; this.cancelTele(); sfx.breakS();
        G.ui.damageNumber(top.clone().setY(top.y + 0.6), 'PERISAI PECAH!', 'break');
        G.vfx.shockwave(this.pos, 3.5, 0xffffff, 0.5); G.shake(0.3);
      }
    }
    if (this.breakT > 0) amount *= 1.3;
    if (this.shredT > 0) amount *= 1.3;
    this.hp -= amount;
    this.flash = 0.12;
    if (!this.static) this.flinch = 0.18;
    // poise → stagger / BREAK
    if (!this.static && this.breakT <= 0) {
      this.poise -= poise; this.poiseT = 3;
      if (this.poise <= 0) {
        this.poise = this.maxPoise;
        this.cancelTele();
        if (this.isBoss) {
          this.breakT = 3.2; sfx.breakS();
          G.ui.damageNumber(top.clone().setY(top.y + 0.8), 'BREAK!', 'break');
          G.vfx.shockwave(this.pos, 6, 0xffd66b, 0.6); G.shake(0.4);
        } else {
          this.stun = Math.max(this.stun, 0.8);
          if (!this.floats) this.vy = Math.max(this.vy, 5.5);
          if (this.state !== 'dead') { this.state = 'stunned'; }
        }
      }
    }
    if (launch && !this.isBoss && !this.static && !this.floats) this.vy = Math.max(this.vy, launch);
    this.aggro = true;
    if (from && knock) {
      const d = new THREE.Vector3(this.pos.x - from.x, 0, this.pos.z - from.z).normalize();
      const k = this.isBoss ? knock * 0.08 : this.static ? 0 : knock;
      this.vel.addScaledVector(d, k);
    }
    if (stun && !this.static) this.stun = Math.max(this.stun, this.isBoss ? stun * 0.35 : stun);
    if (this.state === 'windup' && stun && this.type !== 'boss') { this.state = 'recover'; this.t = 0; this.cancelTele(); }
    this.game.ui.damageNumber(top, Math.round(amount), (crit ? 'crit ' : '') + (element ? 'el-' + element.toLowerCase() : '') + (amount > 300 ? ' big' : ''));
    this.game.vfx.particles(this.pos.clone().setY(this.pos.y + 0.8), crit ? 14 : 8, crit ? 0xd8ff6a : 0xffffff, { speed: 5, up: 3, life: 0.4 });
    if (this.hp <= 0) this.die();
    return amount;
  }

  cancelTele() { if (this.tele) { this.tele.done = true; this.tele = null; } }

  die() {
    this.dead = true; this.hp = 0; this.state = 'dead'; this.deadT = 0;
    this.excl && (this.excl.visible = false);
    const P = this.game.player.pos;
    if (!this.isBoss && !this.static) { const d = new THREE.Vector3(this.pos.x - P.x, 0, this.pos.z - P.z).normalize(); this.vel.copy(d.multiplyScalar(9)); this.vy = 7; this.spin = (Math.random() - 0.5) * 16; }
    this.cancelTele();
    sfx.enemyDie();
    this.game.vfx.particles(this.pos.clone().setY(this.pos.y + 0.7), 30, 0xc77dff, { speed: 6, up: 5, life: 0.9 });
    this.game.vfx.shockwave(this.pos, 2, 0xc77dff);
    this.bar.visible = false;
    this.auraDot.visible = false;
    this.game.onEnemyKilled(this);
  }

  remove() {
    this.game.scene.remove(this.root);
    this.game.scene.remove(this.bar);
    this.game.scene.remove(this.auraDot);
    if (this.excl) this.game.scene.remove(this.excl);
    this.cancelTele();
  }

  update(dt) {
    const G = this.game, P = G.player, W = G.world;
    if (this.dead) {
      this.deadT += dt;
      if (this.spin) {
        this.pos.addScaledVector(this.vel, dt); this.vy -= 20 * dt; this.pos.y += this.vy * dt;
        this.root.position.copy(this.pos); this.root.rotation.x += this.spin * dt;
        if (this.deadT > 0.35) this.root.scale.multiplyScalar(1 - dt * 5);
        return this.deadT > 0.8;
      }
      this.root.scale.multiplyScalar(1 - dt * 3);
      this.root.position.y += dt * 0.5;
      return this.deadT > 0.7;
    }
    this.flash -= dt;
    // elemental aura + time slow
    if (this.aura) { this.aura.t -= dt; if (this.aura.t <= 0) this.aura = null; }
    this.auraDot.visible = !!this.aura;
    if (this.aura) {
      this.auraDot.material.color.set(AURA_COL[this.aura.el] || 0xffffff);
      this.auraDot.position.set(this.pos.x, this.pos.y + this.tall + 0.3, this.pos.z);
      this.auraDot.rotation.y += dt * 3;
    }
    if (this.slowT > 0) {
      this.slowT -= dt; dt *= 0.45;
      if (Math.random() < 0.1) G.vfx.particles(this.pos.clone().setY(this.pos.y + 1), 1, 0xf5c542, { speed: 0.5, up: 0.5, life: 0.6, grav: 0 });
    }
    this.t += dt;
    this.stun -= dt;
    if (this.burnT > 0) {
      this.burnT -= dt; this.burnTick -= dt;
      if (Math.random() < 0.3) G.vfx.particles(this.pos.clone().setY(this.pos.y + this.tall * 0.5), 1, 0xff7a2a, { speed: 1, up: 2, life: 0.5, grav: -2 });
      if (this.burnTick <= 0) { this.burnTick = 0.5; this.hit(this.burnDmg, {}); if (this.dead) return false; }
    }

    const toP = new THREE.Vector3(P.pos.x - this.pos.x, 0, P.pos.z - this.pos.z);
    const dist = toP.length();
    const homeD = Math.hypot(this.pos.x - this.home.x, this.pos.z - this.home.z);
    if (!this.aggro && dist < this.def.aggro && !P.dead) this.aggro = true;
    if (this.aggro && (P.dead || homeD > this.leash || dist > this.def.aggro * 2.2)) {
      this.aggro = false; this.state = 'return'; this.cancelTele();
    }

    if (this.stun > 0) {
      this.state = 'stunned';
    } else if (this.state === 'stunned') { this.state = 'chase'; this.t = 0; }
    this.poiseT -= dt; if (this.poiseT <= 0) this.poise = this.maxPoise;
    if (this.shredT > 0) this.shredT -= dt;
    this.flinch = Math.max(0, this.flinch - dt);

    if (this.breakT > 0) {
      this.breakT -= dt;
      if (Math.random() < 0.15) G.vfx.particles(this.pos.clone().setY(this.pos.y + this.tall), 1, 0xffd66b, { speed: 1, up: 1, life: 0.5, grav: 0 });
    } else if (this.type === 'slime' || this.type === 'reefslime') this._slime(dt, toP, dist);
    else if (this.type === 'fox' || this.type === 'lavafox' || this.type === 'frostwolf' || this.type === 'anchorguard') this._fox(dt, toP, dist);
    else if (this.type === 'voidwisp') this._ghost(dt, toP, dist);
    else if (this.type === 'voideye') this._voideye(dt, toP, dist);
    else if (this.type === 'voidroot') this._iceblock(dt);
    else if (this.type === 'ygg') this._ygg(dt, toP, dist);
    else if (this.type === 'sovereign') this._sovereign(dt, toP, dist);
    else if (this.type === 'archon') this._archon(dt, toP, dist);
    else if (this.type === 'prismguard') this._prismguard(dt, toP, dist);
    else if (this.type === 'eclipsecore' || this.type === 'cursedblade') this._iceblock(dt);
    else if (this.type === 'kali') this._kali(dt, toP, dist);
    else if (this.type === 'ashblade') this._ashblade(dt, toP, dist);
    else if (this.type === 'ashwraith') this._ghost(dt, toP, dist);
    else if (this.type === 'frostsoul') this._ghost(dt, toP, dist);
    else if (this.type === 'iceblock') this._iceblock(dt);
    else if (this.type === 'phantom') this._phantom(dt, toP, dist);
    else if (this.type === 'ghost') this._ghost(dt, toP, dist);
    else if (this.type === 'seal' || this.type === 'bloodcrystal') this._seal(dt);
    else if (this.type === 'sage') this._sage(dt, toP, dist);
    else if (this.type === 'jelly') this._jelly(dt, toP, dist);
    else if (this.type === 'spire') this._spire(dt);
    else if (this.type === 'queen') this._queen(dt, toP, dist);
    else this._boss(dt, toP, dist);

    // physics
    this.pos.addScaledVector(this.vel, dt);
    this.vel.multiplyScalar(Math.exp(-6 * dt));
    W.collide(this.pos, this.radius * 0.6);
    let gh = Math.max(W.groundAt(this.pos.x, this.pos.z), -0.6);
    if (W.realm && gh < -50) { this.pos.x += (this.home.x - this.pos.x) * 0.15; this.pos.z += (this.home.z - this.pos.z) * 0.15; gh = this.home.y; }
    if (this.floats) {
      this.pos.y = (W.realm ? gh : Math.max(gh, 0)) + (this.type === 'phantom' ? 2.8 : this.type === 'ghost' || this.type === 'frostsoul' || this.type === 'voidwisp' || this.type === 'ashwraith' ? 0.45 : this.type === 'voideye' ? 2.2 : 1.3) + Math.sin(this.t * 2) * 0.25; this.grounded = true;
    } else {
      this.vy -= 30 * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= gh) { this.pos.y = gh; this.vy = 0; this.grounded = true; } else this.grounded = false;
    }
    // keep out of deep water
    if (!this.floats && W.groundAt(this.pos.x, this.pos.z) < -1.3) { this.pos.x += (this.home.x - this.pos.x) * 0.05; this.pos.z += (this.home.z - this.pos.z) * 0.05; }

    this.root.position.copy(this.pos);
    this.root.rotation.y += angleDiff(this.facing, this.root.rotation.y) * (1 - Math.exp(-10 * dt));
    this.root.rotation.x = this.flinch > 0 ? -0.35 * (this.flinch / 0.18) : (this.breakT > 0 ? Math.sin(this.t * 6) * 0.08 : 0);
    // "!" warning while winding up an attack
    const warn = !!(this.tele && !this.tele.done) || this.state === 'windup' || this.state === 'claw_wind';
    if (warn && !this.excl) { this.excl = makeExcl(); G.scene.add(this.excl); }
    if (this.excl) { this.excl.visible = warn; if (warn) { this.excl.position.set(this.pos.x, this.pos.y + this.tall + 0.9, this.pos.z); this.excl.scale.setScalar((this.isBoss ? 2.2 : 1) * (1 + Math.sin(this.t * 20) * 0.1)); } }
    if (this.shieldMesh && this.shield.hp > 0) { this.shieldMesh.rotation.y += dt; this.shieldMesh.material.opacity = 0.22 + Math.sin(this.t * 3) * 0.06; }
    if (this.eliteCrown) this.eliteCrown.rotation.z += dt * 2;

    for (const mt of this.model.mats) mt.emissive && mt.emissive.setRGB(this.flash > 0 ? 0.9 : (this.stun > 0 ? 0.25 : 0), this.flash > 0 ? 0.9 : (this.stun > 0 ? 0.25 : 0), this.flash > 0 ? 0.9 : 0.05);

    if (this.bar.parent) {
      const show = this.aggro && this.hp < this.maxHp;
      this.bar.visible = show;
      if (show) {
        this.bar.position.set(this.pos.x, this.pos.y + this.tall, this.pos.z);
        this.bar.quaternion.copy(G.camera.quaternion);
        this.barFill.scale.x = Math.max(0.001, this.hp / this.maxHp);
      }
    }
    return false;
  }

  _face(toP, k = 1) { if (toP.lengthSq() > 0.01) this.facing = Math.atan2(toP.x, toP.z); void k; }

  _moveToward(target, speed, dt) {
    const d = new THREE.Vector3(target.x - this.pos.x, 0, target.z - this.pos.z);
    const L = d.length();
    if (L < 0.05) return L;
    d.divideScalar(L);
    this.pos.addScaledVector(d, Math.min(speed * dt, L));
    this.facing = Math.atan2(d.x, d.z);
    return L;
  }

  _slime(dt, toP, dist) {
    const b = this.model.body;
    const P = this.game.player;
    if (this.state === 'stunned') { b.scale.set(1.2, 0.7, 1.2); b.rotation.z = Math.sin(this.t * 20) * 0.1; return; }
    b.rotation.z = 0;
    // squishy hop cycle
    const hop = (speed, target) => {
      const ph = (this.t * 2.2) % 1;
      if (ph < 0.12 && this.grounded && !this._hopped) { this.vy = 6; this._hopped = true; }
      if (ph > 0.5) this._hopped = false;
      if (!this.grounded) this._moveToward(target, speed, dt);
      const sq = this.grounded ? 1 - Math.sin(ph * Math.PI * 2) * 0.12 : 1.1;
      b.scale.set(2 - sq, sq, 2 - sq);
    };
    if (this.state === 'return') { hop(this.speed, this.home); if (Math.hypot(this.pos.x - this.home.x, this.pos.z - this.home.z) < 1.5) { this.state = 'idle'; this.hp = this.maxHp; } return; }
    if (!this.aggro) {
      if (!this.wander || this.t > this.wanderT) { this.wander = this.home.clone().add(new THREE.Vector3((Math.random() - 0.5) * 12, 0, (Math.random() - 0.5) * 12)); this.wanderT = this.t + 3 + Math.random() * 3; }
      hop(this.speed * 0.5, this.wander);
      return;
    }
    if (this.state === 'windup') {
      this._face(toP);
      b.scale.set(1.35, 0.6, 1.35);
      if (this.t > 0.55) { this.state = 'leap'; this.t = 0; this.vy = 8; this.leapTo = P.pos.clone(); }
      return;
    }
    if (this.state === 'leap') {
      b.scale.set(0.85, 1.25, 0.85);
      this._moveToward(this.leapTo, 9, dt);
      if (this.grounded && this.t > 0.15) {
        this.state = 'recover'; this.t = 0;
        this.cancelTele();
        this.game.vfx.shockwave(this.pos, 1.8, 0xc77dff, 0.3);
        if (P.pos.distanceTo(this.pos) < 1.7) P.damage(this.dmg, this.pos);
      }
      return;
    }
    if (this.state === 'recover') { b.scale.set(1.25, 0.75, 1.25); if (this.t > 0.9) { this.state = 'chase'; this.t = 0; } return; }
    // chase
    this.state = 'chase';
    if (dist < 2.6 && this.grounded && !this.game.combat.canAttack(this)) { hop(this.speed * 0.6, this.pos.clone().add(new THREE.Vector3(-toP.z, 0, toP.x).normalize().multiplyScalar(2))); return; }
    if (dist < 2.6 && this.grounded) {
      this.state = 'windup'; this.t = 0;
      this.tele = this.game.vfx.telegraph(P.pos, 1.6, 0.75, 0xff3355);
      return;
    }
    hop(this.speed, P.pos);
  }

  _legs(dt, speed) {
    const ph = this.t * (6 + speed * 1.6);
    this.model.legs.forEach((l, i) => { l.rotation.x = speed > 0.3 ? Math.sin(ph + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.8 : damp(l.rotation.x, 0, 8, dt); });
    this.model.tails.forEach((t, i) => { t.rotation.y = Math.sin(this.t * 3 + i * 0.7) * 0.3; });
    this.model.body.position.y = speed > 0.3 ? Math.abs(Math.sin(ph)) * 0.06 : 0;
  }

  _fox(dt, toP, dist) {
    const P = this.game.player, b = this.model.body;
    b.rotation.x = 0;
    if (this.state === 'stunned') { this._legs(dt, 0); b.rotation.z = Math.sin(this.t * 18) * 0.12; return; }
    b.rotation.z = 0;
    if (this.state === 'return') { const L = this._moveToward(this.home, this.speed, dt); this._legs(dt, this.speed); if (L < 1.5) { this.state = 'idle'; this.hp = this.maxHp; } return; }
    if (!this.aggro) {
      if (!this.wander || this.t > this.wanderT) { this.wander = this.home.clone().add(new THREE.Vector3((Math.random() - 0.5) * 16, 0, (Math.random() - 0.5) * 16)); this.wanderT = this.t + 3 + Math.random() * 4; }
      const L = this._moveToward(this.wander, 2.2, dt);
      this._legs(dt, L > 0.3 ? 2.2 : 0);
      return;
    }
    if (this.state === 'windup') {
      this._face(toP); this._legs(dt, 0);
      b.rotation.x = 0.25; b.position.y = -0.12;
      if (this.t > 0.5) { this.state = 'lunge'; this.t = 0; this.lungeDir = new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing)); this.hitDone = false; sfx.dash(); }
      return;
    }
    if (this.state === 'lunge') {
      b.rotation.x = -0.2;
      this.pos.addScaledVector(this.lungeDir, 15 * dt);
      this._legs(dt, 12);
      if (!this.hitDone && P.pos.distanceTo(this.pos) < 1.5) { this.hitDone = true; P.damage(this.dmg, this.pos); }
      if (this.t > 0.32) { this.state = 'recover'; this.t = 0; this.cancelTele(); }
      return;
    }
    if (this.state === 'recover') { this._legs(dt, 0); if (this.t > 0.9) { this.state = 'chase'; this.t = 0; } return; }
    this.state = 'chase';
    if (dist < 4.2 && !this.game.combat.canAttack(this)) {
      const side = new THREE.Vector3(-toP.z, 0, toP.x).normalize().multiplyScalar(Math.sin(this.t + this.home.x) > 0 ? 3 : -3);
      this._moveToward(this.pos.clone().add(side).addScaledVector(toP.clone().normalize(), -1.5), this.speed * 0.5, dt); this._legs(dt, this.speed * 0.5);
      return;
    }
    if (dist < 4.2) {
      this.state = 'windup'; this.t = 0;
      const tp = this.pos.clone().addScaledVector(toP.clone().normalize(), 2.6);
      this.tele = this.game.vfx.telegraph(tp, 1.4, 0.55, 0xff3355);
      return;
    }
    // approach with a slight circling offset so packs spread out
    const side = new THREE.Vector3(-toP.z, 0, toP.x).normalize().multiplyScalar(Math.sin(this.t * 0.8 + this.home.x) * 2);
    this._moveToward(P.pos.clone().add(side), this.speed, dt);
    this._legs(dt, this.speed);
  }

  // ===================== BOSS =====================
  _boss(dt, toP, dist) {
    const G = this.game, P = G.player, b = this.model.body;
    const den = this.home;
    if (!this.started) { this._legs(dt, 0); return; }
    if (this.state === 'stunned') { this._legs(dt, 0); b.rotation.z = Math.sin(this.t * 14) * 0.05; return; }
    b.rotation.z = 0; b.rotation.x = 0; b.position.y = 0;
    const phase2 = this.hp < this.maxHp * 0.5;
    if (phase2 && !this.enraged) {
      this.enraged = true; this.state = 'howl'; this.t = 0; sfx.roar();
      G.ui.toast('Gumi Wolf marah! Ekor-ekornya menyala!', 'gold');
    }
    this.cd = (this.cd || 0) - dt;
    this.summonCD = (this.summonCD || 20) - dt;

    switch (this.state) {
      case 'idle': case 'chase': case 'return': {
        this.state = 'chase';
        const backHome = Math.hypot(this.pos.x - den.x, this.pos.z - den.z) > 24;
        if (backHome) { this._moveToward(den, this.speed, dt); this._legs(dt, this.speed); break; }
        this._face(toP);
        if (this.cd <= 0) { this._pickAttack(dist, phase2); break; }
        if (dist > 5) { this._moveToward(P.pos, this.speed * (phase2 ? 1.15 : 1), dt); this._legs(dt, this.speed); }
        else this._legs(dt, 0);
        break;
      }
      case 'bite_wind': {
        this._face(toP); this._legs(dt, 0);
        b.rotation.x = 0.15;
        if (this.t > (phase2 ? 0.6 : 0.85)) { this.state = 'bite'; this.t = 0; this.hitDone = false; sfx.dash(); }
        break;
      }
      case 'bite': {
        const L = this._moveToward(this.biteTo, 26, dt); this._legs(dt, 14);
        b.rotation.x = -0.15;
        if (!this.hitDone && P.pos.distanceTo(this.pos) < 3.4) { this.hitDone = true; P.damage(this.dmg, this.pos, 14); }
        if (L < 0.5 || this.t > 0.6) { this.state = 'rest'; this.t = 0; this.cancelTele(); G.vfx.shockwave(this.pos, 3, 0xff5ce1, 0.35); G.shake(0.25); }
        break;
      }
      case 'sweep_wind': {
        this._legs(dt, 0);
        this.model.tails.forEach((t) => (t.rotation.x = -0.4));
        if (this.t > 1.0) {
          this.state = 'sweep'; this.t = 0; this.cancelTele(); sfx.swing();
          G.vfx.shockwave(this.pos, 7, 0xff5ce1, 0.5); G.shake(0.3);
          if (P.pos.distanceTo(this.pos) < 7) P.damage(this.dmg * 0.8, this.pos, 16);
        }
        break;
      }
      case 'sweep': {
        this.root.rotation.y += dt * 20;
        this.facing = this.root.rotation.y;
        if (this.t > 0.45) { this.state = 'rest'; this.t = 0; }
        break;
      }
      case 'foxfire': {
        this._face(toP); this._legs(dt, 0);
        const n = phase2 ? 7 : 5;
        const iv = 0.9 / n;
        while ((this.shots || 0) < n && this.t > (this.shots || 0) * iv) {
          const tail = this.model.tails[(this.shots * 2) % this.model.tails.length];
          const p = tail.children[1].getWorldPosition(new THREE.Vector3());
          G.spawnProjectile(p, P, { speed: phase2 ? 11 : 9, dmg: 10, homing: 2.2, life: 4 });
          this.shots++;
        }
        if (this.t > 1.3) { this.state = 'rest'; this.t = 0; }
        break;
      }
      case 'ring': {
        this._legs(dt, 0);
        if (!this.ringDone && this.t > 0.6) {
          this.ringDone = true;
          for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            const p = this.pos.clone().add(new THREE.Vector3(Math.cos(a) * 2.5, 2, Math.sin(a) * 2.5));
            G.spawnProjectile(p, null, { speed: 10, dmg: 12, dir: new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), life: 3 });
          }
        }
        if (this.t > 1.2) { this.state = 'rest'; this.t = 0; }
        break;
      }
      case 'howl': {
        this._legs(dt, 0);
        this.model.head.rotation.x = -0.6;
        if (this.t > 0.4 && !this.howled) { this.howled = true; G.shake(0.6); G.vfx.shockwave(this.pos, 10, 0xff5ce1, 0.8); }
        if (this.t > 1.6) {
          this.model.head.rotation.x = 0; this.howled = false;
          G.summonAdds(this.pos, 2);
          this.summonCD = 28;
          this.state = 'rest'; this.t = 0;
        }
        break;
      }
      case 'rest': {
        this._legs(dt, 0);
        if (this.t > (phase2 ? 0.5 : 0.9)) { this.state = 'chase'; this.t = 0; this.cd = phase2 ? 0.6 : 1.2; }
        break;
      }
      default: this.state = 'chase';
    }
  }


  // ===================== SUNKEN REEF =====================
  _jelly(dt, toP, dist) {
    const P = this.game.player, M = this.model;
    M.tents.forEach((t, i) => (t.rotation.x = Math.sin(this.t * 3 + i) * 0.3));
    M.body.scale.y = 1 + Math.sin(this.t * 3) * 0.08;
    if (this.state === 'stunned') return;
    if (this.state === 'return' || !this.aggro) {
      const tgt = this.state === 'return' ? this.home : (this.wander && this.t < this.wanderT ? this.wander : (this.wander = this.home.clone().add(new THREE.Vector3((Math.random() - 0.5) * 14, 0, (Math.random() - 0.5) * 14)), this.wanderT = this.t + 4, this.wander));
      const L = this._moveToward(tgt, this.state === 'return' ? this.speed : 1.2, dt);
      if (this.state === 'return' && L < 1.5) { this.state = 'idle'; this.hp = this.maxHp; }
      return;
    }
    this._face(toP);
    // keep a comfortable range, strafe a little
    const want = dist > 11 ? 1 : dist < 7 ? -1 : 0;
    if (want) this.pos.addScaledVector(toP.clone().normalize(), want * this.speed * dt);
    this.pos.addScaledVector(new THREE.Vector3(-toP.z, 0, toP.x).normalize(), Math.sin(this.t * 0.7) * 1.5 * dt);
    this.shotT = (this.shotT ?? 1.5) - dt;
    if (this.shotT <= 0 && dist < 16) {
      this.shotT = 2.6;
      this.game.spawnProjectile(this.pos.clone().setY(this.pos.y + 0.2), P, { speed: 8, dmg: this.dmg, homing: 1.2, life: 3.5, color: 0xb04bff, poison: 3 });
    }
  }

  _spire(dt) {
    const M = this.model;
    M.core.rotation.y += dt * 2;
    M.core.scale.setScalar(1 + Math.sin(this.t * 4) * 0.12);
    this.stun = 0;
    if (!this.summoned && this.hp < this.maxHp * 0.6) {
      this.summoned = true;
      this.game.summonAdds(this.pos, 3, 'reefslime');
      this.game.ui.toast('Menara karang memanggil penjaga!');
    }
  }

  _queen(dt, toP, dist) {
    const G = this.game, P = G.player, M = this.model, L = this.home;
    // idle wobble
    M.minis.forEach((m, i) => { const a = this.t * 0.8 + (i / M.minis.length) * Math.PI * 2; m.position.set(Math.cos(a) * 5.4, 0.6 + Math.abs(Math.sin(this.t * 3 + i)) * 0.8, Math.sin(a) * 5.4); });
    M.rider.rotation.y = Math.sin(this.t * 0.7) * 0.3;
    const squash = (k) => { M.blob.scale.set(4.2 * (2 - k), 3.0 * k, 4.2 * (2 - k)); M.blob.position.y = 2.8 * k; M.rider.position.y = 5.55 - (1 - k) * 3; };
    if (!this.started) { squash(1 + Math.sin(this.t * 2) * 0.03); return; }
    if (this.state === 'stunned') { squash(0.9); return; }
    const phase2 = this.hp < this.maxHp * 0.5;
    // splits at 66% / 33%
    for (const th of [0.66, 0.33]) {
      if (!this['split' + th] && this.hp < this.maxHp * th) {
        this['split' + th] = true;
        G.summonAdds(this.pos, 3, 'reefslime');
        G.ui.toast('Slime Queen membelah diri!', 'gold'); G.shake(0.4);
      }
    }
    if (phase2 && !this.enraged) { this.enraged = true; G.ui.toast('“Blub… BLUB! Sang Ratu melahap semuanya!”', 'gold'); sfx.roar(); }
    this.cd = (this.cd ?? 1.5) - dt;
    switch (this.state) {
      case 'slam_wind': {
        squash(0.75 + Math.sin(this.t * 20) * 0.03);
        if (this.t > (phase2 ? 0.75 : 1.0)) { this.state = 'slam'; this.t = 0; this.from = this.pos.clone(); }
        break;
      }
      case 'slam': {
        const k = Math.min(1, this.t / 0.6);
        this.pos.x = this.from.x + (this.slamTo.x - this.from.x) * k;
        this.pos.z = this.from.z + (this.slamTo.z - this.from.z) * k;
        this.vy = 0; this.pos.y = G.world.groundAt(this.pos.x, this.pos.z) + Math.sin(k * Math.PI) * 6;
        squash(1.15);
        if (k >= 1) {
          this.state = 'rest'; this.t = 0; this.cancelTele(); sfx.land();
          G.vfx.shockwave(this.pos, 6, 0xff8fd0, 0.5); G.vfx.particles(this.pos.clone().setY(this.pos.y + 0.5), 50, 0xc8f8ff, { speed: 10, up: 5, life: 0.7 }); G.shake(0.5);
          if (Math.hypot(P.pos.x - this.pos.x, P.pos.z - this.pos.z) < 5.5 && P.pos.y - this.pos.y < 2.5) P.damage(this.dmg, this.pos, 16);
        }
        break;
      }
      case 'rain': {
        squash(1 + Math.sin(this.t * 10) * 0.05);
        if (!this.rained && this.t > 1.1) {
          this.rained = true;
          for (const c of this.rainAt) G.addPuddle(c, 2.6, 7);
          sfx.enemyDie();
        }
        if (this.t > 1.5) { this.state = 'rest'; this.t = 0; }
        break;
      }
      case 'bubbles': {
        squash(1 + Math.sin(this.t * 14) * 0.06);
        if (!this.shot && this.t > 0.5) {
          this.shot = true;
          const n = phase2 ? 11 : 7, base = Math.atan2(toP.x, toP.z);
          for (let i = 0; i < n; i++) {
            const a = base + (i - (n - 1) / 2) * 0.16;
            G.spawnProjectile(this.pos.clone().add(new THREE.Vector3(Math.sin(a) * 4, 2.5, Math.cos(a) * 4)), null, { speed: 8, dmg: 11, dir: new THREE.Vector3(Math.sin(a), -0.12, Math.cos(a)), life: 4, color: 0x8fd8ff });
          }
        }
        if (this.t > 1.1) { this.state = 'rest'; this.t = 0; }
        break;
      }
      case 'wave': {
        squash(0.7 + Math.min(1, this.t) * 0.5);
        if (!this.waved && this.t > 0.7) { this.waved = true; G.addWave(this.pos, 26, 10, this.dmg * 0.9); G.shake(0.4); }
        if (this.t > 1.4) { this.state = 'rest'; this.t = 0; }
        break;
      }
      case 'rest': {
        squash(1 + Math.sin(this.t * 6) * 0.04);
        if (this.t > (phase2 ? 0.6 : 1.0)) { this.state = 'chase'; this.t = 0; this.cd = phase2 ? 0.8 : 1.4; }
        break;
      }
      default: {
        this.state = 'chase';
        const far = Math.hypot(this.pos.x - L.x, this.pos.z - L.z) > 20;
        squash(1 + Math.abs(Math.sin(this.t * 3)) * 0.06);
        if (far) { this._moveToward(L, this.speed, dt); break; }
        this._face(toP);
        if (dist > 7) this._moveToward(P.pos, this.speed, dt);
        if (this.cd <= 0) {
          this.t = 0;
          const r = Math.random();
          if (phase2 && r < 0.25) { this.state = 'wave'; this.waved = false; if (!G.state.waveHint) { G.state.waveHint = true; G.ui.toast('Gelombang datang — LOMPAT (Spasi / ⤒) untuk menghindar!', 'gold big'); } }
          else if (r < 0.55) { this.state = 'slam_wind'; this.slamTo = P.pos.clone(); this.tele = G.vfx.telegraph(this.slamTo, 5.5, phase2 ? 1.35 : 1.6, 0xff2a6a); }
          else if (r < 0.8) {
            this.state = 'rain'; this.rained = false;
            this.rainAt = [P.pos.clone()];
            for (let i = 0; i < (phase2 ? 5 : 3); i++) this.rainAt.push(P.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 14, 0, (Math.random() - 0.5) * 14)));
            for (const c of this.rainAt) { c.y = Math.max(G.world.groundAt(c.x, c.z), 0); G.vfx.telegraph(c, 2.6, 1.1, 0xb04bff); }
          } else { this.state = 'bubbles'; this.shot = false; }
        }
      }
    }
  }


  // ===================== INFERNAL CITADEL =====================
  _ghost(dt, toP, dist) {
    const G = this.game, P = G.player, M = this.model;
    M.wisps.forEach((w, i) => { const a = this.t * 2 + i * 2.1; w.position.set(Math.cos(a) * 0.9, 1 + Math.sin(this.t * 3 + i) * 0.3, Math.sin(a) * 0.9); });
    M.body.rotation.z = Math.sin(this.t * 2) * 0.08;
    M.mats[0].opacity = this.phased ? 0.15 : 0.85;
    if (this.state === 'stunned') return;
    if (this.state === 'return' || !this.aggro) {
      const tgt = this.state === 'return' ? this.home : this.home.clone().add(new THREE.Vector3(Math.sin(this.t * 0.4) * 6, 0, Math.cos(this.t * 0.3) * 6));
      const L = this._moveToward(tgt, this.state === 'return' ? this.speed : 1.5, dt);
      if (this.state === 'return' && L < 1.5) { this.state = 'idle'; this.hp = this.maxHp; }
      return;
    }
    this._face(toP);
    switch (this.state) {
      case 'phase': {
        if (this.t > 0.9) {
          // reappear behind the player
          const back = new THREE.Vector3(-Math.sin(P.facing), 0, -Math.cos(P.facing));
          this.pos.set(P.pos.x + back.x * 2.2, this.pos.y, P.pos.z + back.z * 2.2);
          this.phased = false; this.state = 'claw_wind'; this.t = 0;
          this.tele = G.vfx.telegraph(P.pos.clone(), 1.6, 0.6, 0xff3355);
          G.vfx.particles(this.pos.clone().setY(this.pos.y + 1), 16, 0xbfe6ff, { speed: 3, up: 1, life: 0.4 });
        }
        break;
      }
      case 'claw_wind': {
        if (this.t > 0.6) {
          this.state = 'recover'; this.t = 0; this.cancelTele();
          G.vfx.slash(this.pos.clone().setY(this.pos.y + 1).addScaledVector(toP.clone().normalize(), 1), this.facing, { size: 1.7, color: 0xbfe6ff });
          if (dist < 2.8) P.damage(this.dmg, this.pos, 6);
        }
        break;
      }
      case 'recover': if (this.t > 1.2) { this.state = 'chase'; this.t = 0; } break;
      default: {
        this.state = 'chase';
        this.phaseCD = (this.phaseCD ?? 2 + Math.random() * 2) - dt;
        if (this.phaseCD <= 0) { this.phaseCD = 4 + Math.random() * 2; this.state = 'phase'; this.phased = true; this.t = 0; return; }
        if (dist > 2.4) this._moveToward(P.pos, this.speed, dt);
        else { this.state = 'claw_wind'; this.t = 0; this.tele = G.vfx.telegraph(P.pos.clone(), 1.6, 0.6, 0xff3355); }
      }
    }
  }

  _seal(dt) {
    const M = this.model;
    M.core.rotation.y += dt * 2; M.ring.rotation.z += dt;
    M.core.scale.setScalar(1 + Math.sin(this.t * 5) * 0.15);
    this.stun = 0;
    if (this.type === 'seal' && !this.summoned && this.hp < this.maxHp * 0.6) {
      this.summoned = true; this.game.summonAdds(this.pos, 2, 'ghost'); this.game.ui.toast('Segel Darah memanggil arwah!');
    }
  }

  _sage(dt, toP, dist) {
    const G = this.game, P = G.player, M = this.model, C = this.home;
    const hover = 1.2 + Math.sin(this.t * 1.6) * 0.3;
    M.fig.position.y = hover;
    M.arms.forEach((a, i) => { a.rotation.y = Math.sin(this.t * 2 + i) * 0.3; });
    M.aura.rotation.z += dt; M.aura.material.opacity = 0.35 + Math.sin(this.t * 3) * 0.15;
    M.shield.visible = this.invuln;
    if (this.invuln) { M.shield.rotation.y += dt; if (!G.enemies.some((e) => e.type === 'bloodcrystal' && !e.dead)) { this.invuln = false; G.ui.toast('Perisai darah runtuh! Serang sekarang!', 'gold'); this.cd = 0.5; } }
    if (!this.started) return;
    this.stun = Math.min(this.stun, 0.4);
    if (this.state === 'stunned') return;
    const phase2 = this.hp < this.maxHp * 0.5;
    for (const th of [0.7, 0.35]) {
      if (!this['sh' + th] && this.hp < this.maxHp * th) {
        this['sh' + th] = true; this.invuln = true; this.state = 'rest'; this.t = 0;
        G.spawnBloodCrystals(C, 3);
        G.ui.toast('Evy menyerap darah — hancurkan 3 Kristal Darah!', 'gold big'); sfx.roar();
      }
    }
    if (phase2 && !this.enraged) { this.enraged = true; G.summonAdds(this.pos, 3, 'ghost'); G.ui.toast('“Darahmu akan menyempurnakan ritualku!”', 'gold'); }
    this.cd = (this.cd ?? 1.5) - dt;
    switch (this.state) {
      case 'bolts': {
        const n = phase2 ? 8 : 6;
        while ((this.shots || 0) < n && this.t > this.shots * 0.12) {
          const o = M.orbs[this.shots % 6].getWorldPosition(new THREE.Vector3());
          G.spawnProjectile(o, P, { speed: 10, dmg: 13, homing: 1.8, life: 4, color: 0xff2a3a });
          this.shots++;
        }
        if (this.t > 1.3) { this.state = 'rest'; this.t = 0; }
        break;
      }
      case 'rain': {
        if (!this.rained && this.t > 1.0) { this.rained = true; for (const c of this.rainAt) G.addPuddle(c, 2.8, 6, 0xb0102a); }
        if (this.t > 1.4) { this.state = 'rest'; this.t = 0; }
        break;
      }
      case 'beam': {
        if (!this.beamed && this.t > 0.3) { this.beamed = true; G.addBeam(this.pos, Math.atan2(toP.x, toP.z), phase2 ? 1.0 : 0.75, 4.2, this.dmg * 0.7); }
        if (this.t > 4.6) { this.state = 'rest'; this.t = 0; }
        break;
      }
      case 'drain': {
        if (!this.tethered) { this.tethered = true; G.addTether(this, 2.6, this.dmg); }
        if (this.t > 2.9) { this.state = 'rest'; this.t = 0; this.tethered = false; }
        break;
      }
      case 'blink': {
        if (this.t > 0.35 && !this.blinked) {
          this.blinked = true;
          const a = Math.random() * Math.PI * 2, rr = 6 + Math.random() * 8;
          G.vfx.particles(this.pos.clone().setY(this.pos.y + 3), 30, 0xff2a3a, { speed: 4, up: 2, life: 0.5 });
          this.pos.set(C.x + Math.cos(a) * rr, this.pos.y, C.z + Math.sin(a) * rr);
          G.vfx.particles(this.pos.clone().setY(this.pos.y + 3), 30, 0xff2a3a, { speed: 4, up: 2, life: 0.5 });
        }
        if (this.t > 0.7) { this.state = 'rest'; this.t = 0; }
        break;
      }
      case 'rest': {
        if (this.t > (phase2 ? 0.6 : 1.0) && !this.invuln) { this.state = 'chase'; this.t = 0; this.cd = phase2 ? 0.7 : 1.2; }
        else if (this.invuln && this.t > 2.2) { this.state = 'bolts'; this.shots = 0; this.t = 0; }
        break;
      }
      default: {
        this.state = 'chase';
        this._face(toP);
        if (dist > 12) this._moveToward(P.pos, this.speed * 0.6, dt);
        if (Math.hypot(this.pos.x - C.x, this.pos.z - C.z) > 18) this._moveToward(C, this.speed, dt);
        if (this.cd <= 0) {
          this.t = 0;
          const r = Math.random();
          if (r < 0.18) { this.state = 'blink'; this.blinked = false; }
          else if (r < 0.42) { this.state = 'bolts'; this.shots = 0; }
          else if (r < 0.62) {
            this.state = 'rain'; this.rained = false; this.rainAt = [P.pos.clone()];
            for (let i = 0; i < (phase2 ? 5 : 3); i++) this.rainAt.push(P.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 12, 0, (Math.random() - 0.5) * 12)));
            for (const c of this.rainAt) { c.y = G.world.groundAt(c.x, c.z); G.vfx.telegraph(c, 2.8, 1.0, 0xb0102a); }
          } else if (r < 0.82) { this.state = 'beam'; this.beamed = false; }
          else { this.state = 'drain'; this.tethered = false; }
        }
      }
    }
  }


  // ===================== FROSTVALE =====================
  _iceblock(dt) {
    const M = this.model;
    M.core.rotation.y += dt * 2;
    this.stun = 0;
    if (this.type === 'iceblock' && !this.summoned && this.hp < this.maxHp * 0.55) { this.summoned = true; this.game.summonAdds(this.pos, 2, 'frostsoul'); this.game.ui.toast('Arwah beku melindungi warga yang membeku!'); }
  }

  _phantom(dt, toP, dist) {
    const G = this.game, P = G.player, M = this.model, C = this.home;
    M.shards.forEach((sh, i) => { const a = this.t * 1.5 + (i / 6) * Math.PI * 2; sh.position.set(Math.cos(a) * 1.1, 1 + Math.sin(this.t * 2 + i) * 0.3, Math.sin(a) * 1.1); sh.rotation.y += dt * 3; });
    M.wisps.forEach((w, i) => { const a = this.t * 2 + i * 2.1; w.position.set(Math.cos(a) * 0.9, 1 + Math.sin(this.t * 3 + i) * 0.3, Math.sin(a) * 0.9); });
    M.mats[0].opacity = this.phased ? 0.15 : 0.85;
    if (!this.started) return;
    this.stun = Math.min(this.stun, 0.8);
    if (this.state === 'stunned') return;
    const phase2 = this.hp < this.maxHp * 0.5;
    if (phase2 && !this.enraged) { this.enraged = true; this.blizCD = 0; G.ui.toast('“Hehehe… jiwa beku rasanya paling enak.”', 'gold'); }
    this.cd = (this.cd ?? 1.5) - dt;
    this.blizCD = (this.blizCD ?? 99) - dt;
    if (phase2 && this.blizCD <= 0 && this.state !== 'blizzard') { this.state = 'blizzard'; this.t = 0; this.blizCD = 38; }
    switch (this.state) {
      case 'shards': {
        if (!this.shot && this.t > 0.5) {
          this.shot = true;
          const n = phase2 ? 16 : 12;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + this.t;
            G.spawnProjectile(this.pos.clone().add(new THREE.Vector3(Math.cos(a) * 3, 3, Math.sin(a) * 3)), null, { speed: 9, dmg: 16, dir: new THREE.Vector3(Math.cos(a), -0.08, Math.sin(a)), life: 3.5, color: 0x9ee8ff });
          }
        }
        if (this.t > 1.1) { this.state = 'rest'; this.t = 0; }
        break;
      }
      case 'spikes': {
        if (!this.spiked && this.t > 1.1) {
          this.spiked = true;
          for (const c of this.spikeAt) {
            G.vfx.iceSpike(c);
            if (Math.hypot(P.pos.x - c.x, P.pos.z - c.z) < 2.6) P.damage(this.dmg * 0.8, c, 10);
          }
          G.shake(0.3);
        }
        if (this.t > 1.5) { this.state = 'rest'; this.t = 0; }
        break;
      }
      case 'breath': {
        if (!this.breathed && this.t > 0.9) {
          this.breathed = true;
          const c = this.breathAt;
          G.vfx.shockwave(c, 5.5, 0xbff6ff, 0.5); G.vfx.particles(c.clone().setY(c.y + 1), 50, 0xe8fbff, { speed: 8, up: 3, life: 0.7 });
          if (Math.hypot(P.pos.x - c.x, P.pos.z - c.z) < 5.5) { P.damage(this.dmg, this.pos, 12); P.chill = 4; }
        }
        if (this.t > 1.3) { this.state = 'rest'; this.t = 0; }
        break;
      }
      case 'phase': {
        if (this.t > 1.1 && this.phased) {
          this.phased = false;
          const a = Math.random() * Math.PI * 2;
          this.pos.set(P.pos.x + Math.cos(a) * 8, this.pos.y, P.pos.z + Math.sin(a) * 8);
          if (Math.hypot(this.pos.x - C.x, this.pos.z - C.z) > 26) this.pos.set(C.x, this.pos.y, C.z);
          G.vfx.particles(this.pos.clone().setY(this.pos.y + 3), 40, 0xe8fbff, { speed: 5, up: 2, life: 0.6 });
        }
        if (this.t > 1.5) { this.state = 'rest'; this.t = 0; }
        break;
      }
      case 'blizzard': {
        if (!this.blizzed) { this.blizzed = true; G.startBlizzard(9); G.summonAdds(this.pos, 3, 'frostsoul'); }
        if (this.t > 2) { this.state = 'rest'; this.t = 0; this.blizzed = false; }
        break;
      }
      case 'rest': {
        if (this.t > (phase2 ? 0.6 : 1.0)) { this.state = 'chase'; this.t = 0; this.cd = phase2 ? 0.7 : 1.2; }
        break;
      }
      default: {
        this.state = 'chase';
        this._face(toP);
        if (dist > 9) this._moveToward(P.pos, this.speed, dt);
        if (Math.hypot(this.pos.x - C.x, this.pos.z - C.z) > 26) this._moveToward(C, this.speed * 1.5, dt);
        if (this.cd <= 0) {
          this.t = 0;
          const r = Math.random();
          if (r < 0.2) { this.state = 'phase'; this.phased = true; }
          else if (r < 0.45) { this.state = 'shards'; this.shot = false; }
          else if (r < 0.72) {
            this.state = 'spikes'; this.spiked = false; this.spikeAt = [P.pos.clone()];
            for (let i = 0; i < (phase2 ? 6 : 4); i++) this.spikeAt.push(P.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 12, 0, (Math.random() - 0.5) * 12)));
            for (const c of this.spikeAt) { c.y = G.world.groundAt(c.x, c.z); G.vfx.telegraph(c, 2.6, 1.1, 0x7fd8ff); }
          } else {
            this.state = 'breath'; this.breathed = false;
            this.breathAt = this.pos.clone().addScaledVector(toP.clone().normalize(), Math.min(dist, 7)); this.breathAt.y = G.world.groundAt(this.breathAt.x, this.breathAt.z);
            this.tele = G.vfx.telegraph(this.breathAt, 5.5, 0.9, 0x7fd8ff);
          }
        }
      }
    }
  }


  // ===================== ASHEN BATTLEFIELD =====================
  _ashblade(dt, toP, dist) {
    const G = this.game, P = G.player, M = this.model;
    M.wisp.scale.setScalar(1 + Math.sin(this.t * 8) * 0.15);
    if (this.state === 'stunned') { M.body.rotation.z += dt * 12; return; }
    if (this.state === 'return' || !this.aggro) {
      M.body.rotation.set(0, 0, Math.sin(this.t * 1.5) * 0.2);
      const tgt = this.state === 'return' ? this.home : this.home.clone().add(new THREE.Vector3(Math.sin(this.t * 0.5) * 5, 0, Math.cos(this.t * 0.4) * 5));
      const L = this._moveToward(tgt, this.state === 'return' ? this.speed : 1.6, dt);
      if (this.state === 'return' && L < 1.5) { this.state = 'idle'; this.hp = this.maxHp; }
      return;
    }
    switch (this.state) {
      case 'aim': {
        this._face(toP);
        M.body.rotation.set(-Math.PI / 2 + Math.sin(this.t * 30) * 0.05, 0, 0); // tip toward the target, trembling
        if (this.t > 0.7) { this.state = 'dash'; this.t = 0; this.from = this.pos.clone(); this.hitDone = false; this.cancelTele(); }
        break;
      }
      case 'dash': {
        const k = Math.min(1, this.t / 0.32);
        this.pos.x = this.from.x + (this.to.x - this.from.x) * k; this.pos.z = this.from.z + (this.to.z - this.from.z) * k;
        if (Math.random() < 0.7) G.vfx.particles(this.pos.clone().setY(this.pos.y), 2, 0xb070ff, { speed: 1, up: 0, life: 0.3, grav: 0 });
        if (!this.hitDone && Math.hypot(P.pos.x - this.pos.x, P.pos.z - this.pos.z) < 1.4) { this.hitDone = true; P.damage(this.dmg, this.pos, 8); }
        if (k >= 1) { this.state = 'recover'; this.t = 0; }
        break;
      }
      case 'recover': {
        M.body.rotation.x = damp(M.body.rotation.x, 0, 4, dt);
        if (this.t > 0.9) { this.state = 'chase'; this.t = 0; this.cd = 1.8 + Math.random() * 1.5; }
        break;
      }
      default: {
        this.state = 'chase';
        this._face(toP);
        M.body.rotation.set(0, 0, Math.sin(this.t * 2) * 0.2);
        // circle the player at a distance
        const want = P.pos.clone().add(new THREE.Vector3(Math.sin(this.t * 0.8 + this.home.x) * 6, 0, Math.cos(this.t * 0.8 + this.home.x) * 6));
        this._moveToward(want, this.speed * 0.6, dt);
        this.cd = (this.cd ?? 1.5) - dt;
        if (this.cd <= 0 && dist < 14 && G.combat.canAttack?.(this) !== false) {
          this.state = 'aim'; this.t = 0;
          const tgt = P.pos.clone(), dir = new THREE.Vector3(tgt.x - this.pos.x, 0, tgt.z - this.pos.z).normalize();
          this.to = tgt.clone().addScaledVector(dir, 2.5);
          this.tele = G.vfx.telegraph(tgt.setY(G.world.groundAt(tgt.x, tgt.z)), 1.5, 0.7, 0xb070ff);
        }
      }
    }
  }

  /** Kali drops a sword on each point after a warning circle */
  _kaliRain(center, n) {
    const G = this.game;
    this.rains = this.rains || [];
    for (let i = 0; i < n; i++) {
      const c = i === 0 ? center.clone() : center.clone().add(new THREE.Vector3((Math.random() - 0.5) * 14, 0, (Math.random() - 0.5) * 14));
      if (Math.hypot(c.x - this.home.x, c.z - this.home.z) > 21) c.lerp(this.home, 0.4);
      c.y = G.world.groundAt(c.x, c.z);
      G.vfx.telegraph(c, 2.2, 1.1, 0xb070ff);
      this.rains.push({ c, t: 1.1 + i * 0.05 });
    }
  }
  _kaliSlashSetup() {
    const G = this.game, fwd = new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing));
    this.slAt = this.pos.clone().addScaledVector(fwd, 1.8); this.slAt.y = G.world.groundAt(this.slAt.x, this.slAt.z);
    this.tele = G.vfx.telegraph(this.slAt, 3.4, 0.55, 0xb070ff);
    this.slHit = false;
  }
  _kaliDashSetup(toP, dist) {
    const G = this.game, C = this.home;
    const dir = toP.clone().normalize();
    const len = Math.min(dist + 3, 18);
    this.from = this.pos.clone();
    this.to = this.pos.clone().addScaledVector(dir, len);
    const off = new THREE.Vector3(this.to.x - C.x, 0, this.to.z - C.z);
    if (off.length() > 20) { off.setLength(20); this.to.set(C.x + off.x, this.to.y, C.z + off.z); }
    const L = Math.hypot(this.to.x - this.from.x, this.to.z - this.from.z);
    for (let d = 0; d <= L; d += 2.6) {
      const p = this.from.clone().lerp(this.to, L > 0 ? d / L : 0); p.y = G.world.groundAt(p.x, p.z);
      G.vfx.telegraph(p, 1.7, 0.85, 0xb070ff);
    }
    this.dashHit = false;
  }

  _kali(dt, toP, dist) {
    const G = this.game, P = G.player, M = this.model, C = this.home;
    // movement speed for the walk animation
    const last = this._lastPos || this.pos.clone();
    const spd = Math.hypot(this.pos.x - last.x, this.pos.z - last.z) / Math.max(dt, 1e-4);
    this._lastPos = this.pos.clone();
    const orbR = this.enraged ? 3.4 : 1.7;
    M.orbit.rotation.y += dt * (this.enraged ? 2.6 : 1.2);
    M.orbitBlades.forEach((b, i) => { const a = (i / M.orbitBlades.length) * Math.PI * 2; b.position.set(Math.cos(a) * (orbR - 0.6), 1.6 + Math.sin(this.t * 3 + i) * 0.2, Math.sin(a) * (orbR - 0.6)); b.rotation.set(0, -a, -Math.PI / 2); });
    M.barrier.visible = !!this.invuln;
    const anim = { slash: 'attack', dash: 'dash', rain: 'cast', fan: 'cast', sheath: 'cast' }[this.state] || null;
    M.rig.update(dt, { speed: Math.min(spd, 8) / 1.9, sprint: spd > 9, grounded: true, vy: 0, action: anim, actionT: Math.min(1, this.t / 0.8), combo: (this.sl || 0) % 3 + 1, dt });
    if (!this.started) return;
    this.stun = Math.min(this.stun, 0.6);
    // pending sword rain
    if (this.rains) {
      for (let i = this.rains.length - 1; i >= 0; i--) {
        const r = this.rains[i];
        r.t -= dt;
        if (r.t <= 0) {
          this.rains.splice(i, 1);
          G.vfx.fallingBlade(r.c, { color: 0xc890ff, size: 1.6 });
          G.vfx.shockwave(r.c, 2.2, 0xb070ff, 0.3);
          if (Math.hypot(P.pos.x - r.c.x, P.pos.z - r.c.z) < 2.2 && P.pos.y - r.c.y < 2.5) P.damage(this.dmg * 0.8, r.c, 8);
        }
      }
    }
    // spinning blade ring hurts on contact once enraged
    this.orbCD = (this.orbCD || 0) - dt;
    if (this.enraged && !this.invuln && this.orbCD <= 0 && Math.abs(dist - orbR) < 0.9 && P.pos.y - this.pos.y < 3) { this.orbCD = 0.9; P.damage(this.dmg * 0.4, this.pos, 6); }
    // sheath phases at 60% and 25%: invulnerable until the cursed blades are broken
    if (!this.invuln && ((!this.ph1 && this.hp < this.maxHp * 0.6) || (this.ph1 && !this.ph2 && this.hp < this.maxHp * 0.25))) {
      if (!this.ph1) this.ph1 = true; else this.ph2 = true;
      this.invuln = true; this.state = 'sheath'; this.t = 0; this.cancelTele(); this.rainT = 2.5;
      this.enraged = true;
      G.ch6?.spawnCursed(C, this.ph2 ? 5 : 4);
      G.ui.toast(this.ph2 ? 'Kali: “Seratus pedang… untuk seratus musuh!”' : 'Kali menyarungkan diri dalam pusaran pedang! Hancurkan Pedang Terkutuk!', 'gold');
      G.shake(0.5); sfx.roar();
    }
    if (this.state === 'sheath') {
      this._moveToward(C, this.speed, dt);
      this._face(toP);
      if (!G.enemies.some((e) => e.type === 'cursedblade' && !e.dead)) {
        this.invuln = false; this.breakT = 5; this.state = 'rest'; this.t = 0;
        G.ui.damageNumber(this.pos.clone().setY(this.pos.y + this.tall + 0.6), 'BREAK!', 'break');
        G.ui.toast('Pusaran pedang runtuh! Serang Kali sekarang!', 'gold');
        G.vfx.shockwave(this.pos, 7, 0xffffff, 0.6); G.shake(0.5); sfx.breakS();
      } else {
        this.rainT -= dt;
        if (this.rainT <= 0) { this.rainT = this.ph2 ? 3.0 : 3.8; this._kaliRain(P.pos, this.ph2 ? 9 : 7); }
      }
      return;
    }
    if (this.state === 'stunned') return;
    switch (this.state) {
      case 'slash': {
        if (!this.slHit && this.t >= 0.55) {
          this.slHit = true;
          const c = this.slAt;
          G.vfx.slash(c.clone().setY(c.y + 1.4), this.facing, { size: 4.2, color: 0xb070ff, tilt: 0.5, mirror: this.sl % 2 === 1 });
          G.vfx.shockwave(c, 3.4, 0xb070ff, 0.35);
          if (Math.hypot(P.pos.x - c.x, P.pos.z - c.z) < 3.4) P.damage(this.dmg, this.pos, 10);
          sfx.swing();
        }
        if (this.t < 0.5) this.vel.addScaledVector(new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing)), dt * 10);
        if (this.t >= 0.8) {
          this.sl++;
          if (this.sl >= (this.enraged ? 3 : 2)) { this.state = 'rest'; this.t = 0; }
          else { this.t = 0; this._face(toP); this._kaliSlashSetup(); }
        }
        break;
      }
      case 'dash': {
        if (this.t >= 0.85 && this.t < 1.15) {
          const k = (this.t - 0.85) / 0.3;
          this.pos.x = this.from.x + (this.to.x - this.from.x) * k; this.pos.z = this.from.z + (this.to.z - this.from.z) * k;
          G.vfx.particles(this.pos.clone().setY(this.pos.y + 1.5), 3, 0xb070ff, { speed: 2, up: 1, life: 0.35 });
          if (!this.dashHit && Math.hypot(P.pos.x - this.pos.x, P.pos.z - this.pos.z) < 2.0) { this.dashHit = true; P.damage(this.dmg * 1.1, this.pos, 14); }
        }
        if (this.t >= 1.15 && !this.dashEnd) { this.dashEnd = true; this.pos.x = this.to.x; this.pos.z = this.to.z; G.vfx.shockwave(this.pos, 3, 0xb070ff, 0.4); G.shake(0.25); }
        if (this.t >= 1.5) {
          if (this.enraged && !this.dash2) { this.dash2 = true; this.t = 0; this.dashEnd = false; this._face(toP); this._kaliDashSetup(toP, dist); }
          else { this.state = 'rest'; this.t = 0; }
        }
        break;
      }
      case 'rain': {
        if (this.t >= 1.6) { this.state = 'rest'; this.t = 0; }
        break;
      }
      case 'fan': {
        this._face(toP);
        const volleys = this.enraged ? [0.6, 1.0] : [0.6];
        while ((this.vol || 0) < volleys.length && this.t >= volleys[this.vol || 0]) {
          this.vol = (this.vol || 0) + 1;
          const n = this.enraged ? 7 : 5;
          for (let i = 0; i < n; i++) {
            const a = this.facing + (i / (n - 1) - 0.5) * 1.1 + (this.vol === 2 ? 0.08 : 0);
            G.spawnProjectile(this.pos.clone().add(new THREE.Vector3(Math.sin(a) * 1.2, 1.7, Math.cos(a) * 1.2)), null, { speed: 15, dmg: this.dmg * 0.55, dir: new THREE.Vector3(Math.sin(a), 0, Math.cos(a)), life: 2.4, color: 0xc8a8ff });
          }
          sfx.swing();
        }
        if (this.t >= 1.4) { this.state = 'rest'; this.t = 0; }
        break;
      }
      case 'rest': {
        if (this.t > (this.enraged ? 0.5 : 0.9)) { this.state = 'chase'; this.t = 0; this.cd = this.enraged ? 0.6 : 1.1; }
        break;
      }
      default: {
        this.state = 'chase';
        this._face(toP);
        if (dist > 3.2) this._moveToward(P.pos, this.speed * (this.enraged ? 1.15 : 1), dt);
        if (Math.hypot(this.pos.x - C.x, this.pos.z - C.z) > 20) this._moveToward(C, this.speed * 1.4, dt);
        this.cd = (this.cd ?? 1.5) - dt;
        if (this.cd <= 0) {
          this.t = 0;
          const r = Math.random();
          if (dist < 5.5 && r < 0.5) { this.state = 'slash'; this.sl = 0; this._kaliSlashSetup(); }
          else if (r < 0.65) { this.state = 'dash'; this.dash2 = false; this.dashEnd = false; this._kaliDashSetup(toP, dist); }
          else if (r < 0.85) { this.state = 'rain'; this._kaliRain(P.pos, this.enraged ? 9 : 6); G.ui.toast('Kali: “Hujan Seratus Pedang!”'); }
          else { this.state = 'fan'; this.vol = 0; }
        }
      }
    }
  }

  // ===================== VOID RIFT =====================
  _voideye(dt, toP, dist) {
    const G = this.game, P = G.player, M = this.model;
    M.tents.forEach((t, i) => (t.rotation.z = Math.sin(this.t * 3 + i) * 0.5));
    if (this.state === 'stunned') return;
    M.body.lookAt(P.pos.x, this.pos.y, P.pos.z); M.body.rotation.x = 0;
    if (!this.aggro) { this._moveToward(this.home.clone().add(new THREE.Vector3(Math.sin(this.t * 0.4) * 5, 0, Math.cos(this.t * 0.4) * 5)), 1.5, dt); return; }
    if (dist > 12) this._moveToward(P.pos, this.speed, dt); else if (dist < 7) this.pos.addScaledVector(toP.clone().normalize(), -this.speed * dt);
    this.shotT = (this.shotT ?? 1.2) - dt;
    if (this.shotT <= 0.6 && !this.tele && this.shotT > 0) this.tele = G.vfx.telegraph(P.pos.clone(), 1.2, 0.6, 0xa04aff);
    if (this.shotT <= 0 && dist < 22) {
      this.shotT = 2.4; this.cancelTele();
      G.spawnProjectile(this.pos.clone().add(toP.clone().normalize().multiplyScalar(0.7)), P, { speed: 14, dmg: this.dmg, homing: 0.6, life: 3, color: 0xa04aff });
    }
  }

  _ygg(dt, toP, dist) {
    const G = this.game, P = G.player, M = this.model;
    M.tents.forEach((tn, i) => {
      tn.segs.forEach((j, k) => { j.rotation.z = Math.sin(this.t * 1.6 + i + k * 0.6) * 0.22; j.rotation.x = Math.cos(this.t * 1.3 + i * 2 + k * 0.5) * 0.18; });
    });
    M.head.lookAt(P.pos.x, P.pos.y + 2, P.pos.z);
    M.lid.visible = this.invuln; M.iris.visible = !this.invuln; M.eyeW.visible = !this.invuln;
    if (this.invuln && !G.enemies.some((e) => e.type === 'voidroot' && !e.dead)) {
      this.invuln = false; this.breakT = 5; G.ui.toast('Mata Ygg-Naar terbuka & terguncang — SERANG!', 'gold big'); sfx.breakS();
    }
    if (!this.started) return;
    this.stun = Math.min(this.stun, 0.6);
    if (this.state === 'stunned') return;
    this._face(toP);
    const phase2 = this.hp < this.maxHp * 0.5;
    for (const th of [0.66, 0.33]) {
      if (!this['eye' + th] && this.hp < this.maxHp * th) {
        this['eye' + th] = true; this.invuln = true; this.state = 'rest'; this.t = 0;
        G.spawnVoidRoots(this.home, 4);
        G.summonAdds(this.pos, 2, 'voideye');
        G.ui.toast('Ygg-Naar menutup matanya — hancurkan 4 Akar Void!', 'gold big'); sfx.roar();
      }
    }
    this.cd = (this.cd ?? 2) - dt;
    switch (this.state) {
      case 'gaze': {
        if (!this.gazed && this.t > 0.4) { this.gazed = true; G.addBeam(this.pos.clone().setY(this.pos.y + 4), Math.atan2(toP.x, toP.z) - 0.9, phase2 ? 0.75 : 0.55, 4.5, this.dmg * 0.6, 0xa04aff, 30); }
        if (this.t > 4.8) { this.state = 'rest'; this.t = 0; }
        break;
      }
      case 'eyes': {
        while ((this.shots || 0) < 8 && this.t > (this.shots || 0) * 0.14) {
          const tip = M.tents[this.shots % 8].tip.getWorldPosition(new THREE.Vector3());
          G.spawnProjectile(tip, P, { speed: 11, dmg: 18, homing: 1.6, life: 4, color: 0xa04aff });
          this.shots++;
        }
        if (this.t > 1.5) { this.state = 'rest'; this.t = 0; }
        break;
      }
      case 'slam': {
        if (!this.slammed && this.t > 1.1) {
          this.slammed = true;
          for (const c of this.slamAt) { G.vfx.pillar(c, 0x8a3aff, 6, 0.5); G.vfx.shockwave(c, 3, 0xa04aff, 0.4); if (Math.hypot(P.pos.x - c.x, P.pos.z - c.z) < 2.8) P.damage(this.dmg, c, 12); }
          G.shake(0.5); sfx.heavy();
        }
        if (this.t > 1.5) { this.state = 'rest'; this.t = 0; }
        break;
      }
      case 'pull': {
        const d = new THREE.Vector3(this.pos.x - P.pos.x, 0, this.pos.z - P.pos.z);
        if (this.t < 2.4 && d.length() > 3) P.vel.addScaledVector(d.normalize(), 9 * dt);
        if (Math.random() < 0.5) G.vfx.particles(P.pos.clone().setY(P.pos.y + 1), 1, 0xa04aff, { speed: 2, up: 0, life: 0.4, grav: 0 });
        if (!this.pulled && this.t > 2.5) {
          this.pulled = true; this.cancelTele();
          G.vfx.shockwave(this.pos, 7, 0xa04aff, 0.6); G.shake(0.5);
          if (Math.hypot(P.pos.x - this.pos.x, P.pos.z - this.pos.z) < 7.5) P.damage(this.dmg * 1.3, this.pos, 18);
        }
        if (this.t > 3) { this.state = 'rest'; this.t = 0; }
        break;
      }
      case 'rest': {
        if (this.t > (phase2 ? 0.7 : 1.1) && !this.invuln) { this.state = 'chase'; this.t = 0; this.cd = phase2 ? 0.6 : 1.1; }
        else if (this.invuln && this.t > 2.4) { this.state = 'eyes'; this.shots = 0; this.t = 0; }
        break;
      }
      default: {
        this.state = 'chase';
        if (this.cd <= 0) {
          this.t = 0;
          const r = Math.random();
          if (r < 0.28) { this.state = 'gaze'; this.gazed = false; G.ui.bigText('👁', '#c07aff'); }
          else if (r < 0.5) { this.state = 'eyes'; this.shots = 0; }
          else if (r < 0.78) {
            this.state = 'slam'; this.slammed = false; this.slamAt = [P.pos.clone()];
            for (let i = 0; i < (phase2 ? 5 : 3); i++) this.slamAt.push(P.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 12, 0, (Math.random() - 0.5) * 12)));
            for (const c of this.slamAt) { c.y = G.world.groundAt(c.x, c.z); G.vfx.telegraph(c, 2.8, 1.1, 0xa04aff); }
          } else {
            this.state = 'pull'; this.pulled = false;
            this.tele = G.vfx.telegraph(this.pos, 7.5, 2.5, 0xa04aff);
            if (!G.state.pullHint) { G.state.pullHint = true; G.ui.toast('Ygg-Naar menarikmu! Lari/dash menjauh sebelum ledakan!', 'gold big'); }
          }
        }
      }
    }
  }

  _prismguard(dt, toP, dist) {
    const G = this.game, P = G.player, M = this.model;
    M.halo.rotation.z += dt * 2;
    M.thruster.scale.setScalar(1 + Math.sin(this.t * 12) * 0.2);
    if (this.state === 'stunned') return;
    this._face(toP);

    if (this.state === 'windup') {
      M.blades.forEach((b, i) => { b.rotation.x = -0.6; b.rotation.z = (i === 0 ? 0.4 : -0.4); });
      if (this.t > 0.45) {
        this.state = 'lunge'; this.t = 0;
        this.lungeDir = new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing));
        this.hitDone = false; sfx.dash();
      }
      return;
    }
    if (this.state === 'lunge') {
      this.pos.addScaledVector(this.lungeDir, 16 * dt);
      if (!this.hitDone && P.pos.distanceTo(this.pos) < 2.0) {
        this.hitDone = true; P.damage(this.dmg, this.pos);
        G.vfx.shockwave(this.pos, 1.8, 0x66e0ff, 0.3);
      }
      if (this.t > 0.35) { this.state = 'recover'; this.t = 0; this.cancelTele(); }
      return;
    }
    if (this.state === 'recover') {
      if (this.t > 0.8) { this.state = 'chase'; this.t = 0; }
      return;
    }

    this.state = 'chase';
    if (dist < 4.5 && this.game.combat.canAttack(this)) {
      this.state = 'windup'; this.t = 0;
      const tp = this.pos.clone().addScaledVector(toP.clone().normalize(), 3.2);
      this.tele = G.vfx.telegraph(tp, 1.5, 0.5, 0x66e0ff);
      return;
    }
    this._moveToward(P.pos, this.speed, dt);
  }

  _archon(dt, toP, dist) {
    const G = this.game, P = G.player, M = this.model;
    M.wings.forEach((w, i) => {
      w.rotation.y = Math.sin(this.t * 3.5 + i * 0.7) * 0.35;
      w.rotation.z = Math.cos(this.t * 2.5 + i * 0.5) * 0.15;
    });
    M.halberd.rotation.z = Math.sin(this.t * 1.8) * 0.15;
    if (this.state === 'stunned') return;
    this._face(toP);

    this.cd = (this.cd ?? 2.0) - dt;
    switch (this.state) {
      case 'spears': {
        while ((this.shots || 0) < 3 && this.t > (this.shots || 0) * 0.3) {
          const tip = this.pos.clone().setY(this.pos.y + 2.4);
          G.spawnProjectile(tip, P, { speed: 13, dmg: this.dmg * 0.7, homing: 1.8, life: 3.5, color: 0xffe680 });
          this.shots++;
        }
        if (this.t > 1.2) { this.state = 'rest'; this.t = 0; }
        break;
      }
      case 'pillar': {
        if (!this.slammed && this.t > 0.9) {
          this.slammed = true;
          G.vfx.pillar(this.pillarAt, 0xffd700, 8, 0.6);
          G.vfx.shockwave(this.pillarAt, 3.2, 0xffe680, 0.4);
          if (P.pos.distanceTo(this.pillarAt) < 3.2) P.damage(this.dmg * 1.2, this.pillarAt, 14);
          sfx.heavy();
        }
        if (this.t > 1.3) { this.state = 'rest'; this.t = 0; }
        break;
      }
      case 'rest': {
        if (this.t > 1.0) { this.state = 'chase'; this.t = 0; this.cd = 1.5; }
        break;
      }
      default: {
        this.state = 'chase';
        if (this.cd <= 0) {
          this.t = 0;
          if (Math.random() < 0.55) {
            this.state = 'spears'; this.shots = 0;
          } else {
            this.state = 'pillar'; this.slammed = false; this.pillarAt = P.pos.clone();
            this.pillarAt.y = G.world.groundAt(this.pillarAt.x, this.pillarAt.z);
            G.vfx.telegraph(this.pillarAt, 3.2, 0.9, 0xffd700);
          }
          break;
        }
        if (dist > 6) this._moveToward(P.pos, this.speed, dt);
        else if (dist < 4) this._moveToward(this.pos.clone().addScaledVector(toP.clone().normalize(), -2), this.speed * 0.7, dt);
      }
    }
  }

  _sovereign(dt, toP, dist) {
    const G = this.game, P = G.player, M = this.model;
    M.wings.forEach((w, i) => {
      w.group.rotation.y = Math.sin(this.t * 2.2 + i * 0.8) * 0.28;
      w.group.rotation.z = Math.cos(this.t * 1.6 + i * 0.6) * 0.16;
    });
    M.corona.rotation.z += dt * 0.9;
    M.swords.forEach((sw, i) => {
      const a = this.t * 2.4 + (i / 4) * Math.PI * 2;
      sw.position.set(Math.cos(a) * 1.8, 1.4 + Math.sin(this.t * 3 + i) * 0.25, Math.sin(a) * 1.8);
      sw.rotation.y = -a;
      sw.rotation.x = 0.35;
    });
    M.barrier.visible = this.invuln;

    // Check breaking shield state
    if (this.invuln && !G.enemies.some((e) => e.type === 'eclipsecore' && !e.dead)) {
      this.invuln = false; this.breakT = 6.0;
      G.ui.toast('Perisai Gerhana RUNTUH! Eclipse Sovereign TERGUNCANG — SERANG SEKARANG!', 'gold big');
      sfx.breakS(); G.shake(0.6);
    }

    if (!this.started) return;
    this.stun = Math.min(this.stun, 0.5);
    if (this.state === 'stunned') return;
    this._face(toP);

    const phase2 = this.hp < this.maxHp * 0.66;
    const phase3 = this.hp < this.maxHp * 0.33;

    // Phase 2 shield transition
    if (phase2 && !this.phase2Triggered) {
      this.phase2Triggered = true; this.invuln = true; this.state = 'rest'; this.t = 0;
      G.ui.toast('ECLIPSE PHASE 2: Inti Gerhana bangkit! Hancurkan 2 Inti Eclipse!', 'gold big');
      sfx.roar();
      for (let k = 0; k < 2; k++) {
        const ang = (k / 2) * Math.PI * 2 + Math.PI / 4;
        const cp = this.home.clone().add(new THREE.Vector3(Math.cos(ang) * 12, 0, Math.sin(ang) * 12));
        cp.y = G.world.groundAt(cp.x, cp.z);
        const ec = new Enemy(G, 'eclipsecore', cp, { leash: 999 });
        ec.realmMob = true; G.enemies.push(ec);
        G.vfx.pillar(cp, 0xff3355, 6, 0.6);
      }
      G.summonAdds(this.pos, 2, 'prismguard');
    }

    // Phase 3 shield transition
    if (phase3 && !this.phase3Triggered) {
      this.phase3Triggered = true; this.invuln = true; this.state = 'rest'; this.t = 0;
      G.ui.toast('ECLIPSE CLIMAX: Gerhana Total Menyala! Hancurkan 3 Inti Eclipse!', 'gold big');
      sfx.roar();
      for (let k = 0; k < 3; k++) {
        const ang = (k / 3) * Math.PI * 2;
        const cp = this.home.clone().add(new THREE.Vector3(Math.cos(ang) * 14, 0, Math.sin(ang) * 14));
        cp.y = G.world.groundAt(cp.x, cp.z);
        const ec = new Enemy(G, 'eclipsecore', cp, { leash: 999 });
        ec.realmMob = true; G.enemies.push(ec);
        G.vfx.pillar(cp, 0xff3355, 6, 0.6);
      }
      G.summonAdds(this.pos, 1, 'archon');
    }

    this.cd = (this.cd ?? 2.0) - dt;
    switch (this.state) {
      case 'cleave': {
        if (!this.cleaved && this.t > 0.8) {
          this.cleaved = true;
          G.vfx.shockwave(this.pos, 9.0, 0xff3355, 0.5);
          G.shake(0.4); sfx.heavy();
          if (dist < 8.5) P.damage(this.dmg * 1.1, this.pos, 16);
        }
        if (this.t > 1.4) { this.state = 'rest'; this.t = 0; }
        break;
      }
      case 'star_fall': {
        if (!this.starsRained && this.t > 1.2) {
          this.starsRained = true;
          for (const c of this.starTargets) {
            G.vfx.pillar(c, 0xffaa00, 10, 0.6);
            G.vfx.shockwave(c, 3.4, 0xff3355, 0.4);
            if (P.pos.distanceTo(c) < 3.4) P.damage(this.dmg * 0.9, c, 14);
          }
          G.shake(0.5); sfx.heavy();
        }
        if (this.t > 1.6) { this.state = 'rest'; this.t = 0; }
        break;
      }
      case 'beam': {
        if (!this.beamed && this.t > 0.4) {
          this.beamed = true;
          G.addBeam(this.pos.clone().setY(this.pos.y + 3.5), Math.atan2(toP.x, toP.z) - 0.85, phase3 ? 0.8 : 0.6, 4.2, this.dmg * 0.7, 0xff3355, 34);
        }
        if (this.t > 4.5) { this.state = 'rest'; this.t = 0; }
        break;
      }
      case 'rest': {
        if (this.t > (phase3 ? 0.6 : phase2 ? 0.9 : 1.3) && !this.invuln) {
          this.state = 'chase'; this.t = 0; this.cd = phase3 ? 0.5 : 1.0;
        } else if (this.invuln && this.t > 2.5) {
          this.state = 'star_fall'; this.starsRained = false;
          this.starTargets = [P.pos.clone()];
          for (let i = 0; i < 3; i++) {
            const ofs = new THREE.Vector3((Math.random() - 0.5) * 16, 0, (Math.random() - 0.5) * 16);
            const tg = P.pos.clone().add(ofs);
            tg.y = G.world.groundAt(tg.x, tg.z);
            this.starTargets.push(tg);
          }
          for (const c of this.starTargets) G.vfx.telegraph(c, 3.4, 1.2, 0xff3355);
        }
        break;
      }
      default: {
        this.state = 'chase';
        if (this.cd <= 0) {
          this.t = 0;
          const r = Math.random();
          if (r < 0.35) {
            this.state = 'cleave'; this.cleaved = false;
            this.tele = G.vfx.telegraph(this.pos, 8.5, 0.8, 0xff3355);
          } else if (r < 0.7) {
            this.state = 'star_fall'; this.starsRained = false;
            const cnt = phase3 ? 6 : phase2 ? 5 : 4;
            this.starTargets = [P.pos.clone()];
            for (let i = 1; i < cnt; i++) {
              const ofs = new THREE.Vector3((Math.random() - 0.5) * 18, 0, (Math.random() - 0.5) * 18);
              const tg = P.pos.clone().add(ofs);
              tg.y = G.world.groundAt(tg.x, tg.z);
              this.starTargets.push(tg);
            }
            for (const c of this.starTargets) G.vfx.telegraph(c, 3.4, 1.2, 0xffaa00);
          } else {
            this.state = 'beam'; this.beamed = false;
            G.ui.bigText('☀️ GERHANA', '#ff3355');
          }
          break;
        }
        if (dist > 7) this._moveToward(P.pos, this.speed * (phase3 ? 1.25 : 1.0), dt);
      }
    }
  }

  _pickAttack(dist, phase2) {
    const G = this.game, P = G.player;
    this.t = 0;
    if (phase2 && this.summonCD <= 0) { this.state = 'howl'; sfx.roar(); return; }
    const r = Math.random();
    if (dist < 7 && r < 0.4) {
      this.state = 'sweep_wind';
      this.tele = G.vfx.telegraph(this.pos, 7, 1.0, 0xff2a6a);
    } else if (dist > 9 && r < 0.6) {
      this.state = 'foxfire'; this.shots = 0;
    } else if (phase2 && r > 0.75) {
      this.state = 'ring'; this.ringDone = false;
      this.tele = G.vfx.telegraph(this.pos, 3, 0.6, 0xff5ce1);
    } else {
      this.state = 'bite_wind';
      this.biteTo = P.pos.clone();
      this.tele = G.vfx.telegraph(this.biteTo, 3.2, phase2 ? 0.6 : 0.85, 0xff2a6a);
    }
  }
}

let _exclTex = null;
function makeExcl() {
  if (!_exclTex) {
    const c = document.createElement('canvas'); c.width = 32; c.height = 64;
    const g = c.getContext('2d'); g.font = 'bold 56px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 6; g.strokeStyle = '#3a0010'; g.strokeText('!', 16, 34); g.fillStyle = '#ff3355'; g.fillText('!', 16, 34);
    _exclTex = new THREE.CanvasTexture(c);
  }
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: _exclTex, depthTest: false, transparent: true, color: new THREE.Color(2, 1.2, 1.2) }));
  sp.renderOrder = 13; sp.scale.set(0.45, 0.9, 1); sp.center.set(0.5, 0);
  const g = new THREE.Group(); g.add(sp); g.visible = false; return g;
}

const AURA_COL = { WATER: 0x4fb4f0, LIGHT: 0xf5c542, WIND: 0x8fe63a, FIRE: 0xff7a2a, ICE: 0x9ee8ff, LIGHTNING: 0xc07aff };

export function angleDiff(a, b) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export { TYPES as ENEMY_TYPES };
