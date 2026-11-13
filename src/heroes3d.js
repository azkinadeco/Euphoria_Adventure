// Playable 3D models for Fidelia (Valkyrie Tidal Shield) and Mora (Chronos Astral Sister),
// built on the shared Rig so they reuse every animation Luby has.
import * as THREE from 'three';
import { applyKit, applySkinned } from './assets.js';
import { toon, part, canvasTex, animeHead } from './toon.js';
import { Rig } from './rig.js';

/**
 * Painted anime face (eyes, brows, blush, nose, mouth) matched to each hero's key art.
 * iris: [upper shade, body, lower glow]; shape: round | sharp (raised outer corner) | droopy.
 * `closed` draws the same face with the eyes shut (blink frame).
 */
function softFace(o = {}, closed = false) {
  const {
    iris = ['#1d4f8a', '#4fa3e8', '#bfe6ff'], lash = '#2a2238', brow = lash, browShape = 'soft', shape = 'round',
    mouth = 'smile', blush = 0.38, lip = '#b8485e', liner = null, slit = false, shadow = 'rgba(150,90,110,0.5)',
  } = o;
  const TAU = Math.PI * 2;
  return canvasTex(768, 768, (g) => {
    g.scale(3, 3);
    g.clearRect(0, 0, 256, 256);
    g.lineCap = 'round'; g.lineJoin = 'round';
    const tilt = shape === 'sharp' ? 6 : shape === 'droopy' ? -4 : 2; // how far the outer corner rises
    const ew = 26, eh = shape === 'sharp' ? 27 : 31;
    const eye = (cx, f) => {
      const cy = 134;
      const lid = () => { // upper lash line, inner corner -> outer corner
        g.beginPath(); g.moveTo(cx - f * (ew + 1), cy - 6 + tilt * 0.5);
        g.bezierCurveTo(cx - f * ew * 0.7, cy - eh - 7, cx + f * ew * 0.45, cy - eh - 6, cx + f * (ew + 3), cy - 13 - tilt);
      };
      if (closed) {
        g.strokeStyle = lash; g.lineWidth = 6.5;
        g.beginPath(); g.moveTo(cx - f * (ew + 1), cy + 4); g.quadraticCurveTo(cx, cy + 17, cx + f * (ew + 3), cy + 3 - tilt); g.stroke();
        g.lineWidth = 3.5;
        for (const k of [0.55, 0.8, 1.02]) { g.beginPath(); g.moveTo(cx + f * ew * k, cy + 9 - k * 6 - tilt * k); g.lineTo(cx + f * (ew * k + 6), cy + 15 - k * 7 - tilt * k); g.stroke(); }
      } else {
        g.save();
        g.beginPath(); g.ellipse(cx, cy, ew, eh, 0, 0, TAU); g.clip();
        g.fillStyle = '#fffdfb'; g.fillRect(cx - 40, cy - 40, 80, 80);
        const ix = cx + f * 1.5, iy = cy + 3, ih = eh - 3;
        g.fillStyle = iris[0]; g.beginPath(); g.ellipse(ix, iy, 20.5, ih, 0, 0, TAU); g.fill();
        const gr = g.createLinearGradient(0, iy - ih, 0, iy + ih);
        gr.addColorStop(0, iris[0]); gr.addColorStop(0.42, iris[1]); gr.addColorStop(0.86, iris[2]); gr.addColorStop(1, '#ffffff');
        g.fillStyle = gr; g.beginPath(); g.ellipse(ix, iy + 1, 17.5, ih - 3, 0, 0, TAU); g.fill();
        // pupil + the dark upper half every anime iris has
        g.fillStyle = 'rgba(12,10,26,0.86)'; g.beginPath(); g.ellipse(ix, iy + 2, slit ? 4.5 : 8, slit ? ih * 0.6 : 11, 0, 0, TAU); g.fill();
        const up = g.createLinearGradient(0, iy - ih, 0, iy + 2);
        up.addColorStop(0, 'rgba(10,8,30,0.62)'); up.addColorStop(1, 'rgba(10,8,30,0)');
        g.fillStyle = up; g.beginPath(); g.ellipse(ix, iy, 20.5, ih, 0, 0, TAU); g.fill();
        // bright lower crescent
        g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 3;
        g.beginPath(); g.ellipse(ix, iy + 1, 12, ih - 9, 0, 0.25 * Math.PI, 0.75 * Math.PI); g.stroke();
        // lid shadow over the white
        const sh = g.createLinearGradient(0, cy - eh, 0, cy - eh * 0.2);
        sh.addColorStop(0, shadow); sh.addColorStop(1, 'rgba(150,90,110,0)');
        g.fillStyle = sh; g.fillRect(cx - 40, cy - 40, 80, 40);
        g.restore();
        // highlights
        g.fillStyle = '#fff';
        g.beginPath(); g.ellipse(cx - f * 7, cy - 10, 7, 5.5, -0.5 * f, 0, TAU); g.fill();
        g.beginPath(); g.arc(cx + f * 8, cy + 14, 3, 0, TAU); g.fill();
        // lashes: thick upper line, outer wing, fine lower line, lid crease
        g.strokeStyle = lash; g.lineWidth = 7.5; lid(); g.stroke();
        g.lineWidth = 4.5;
        g.beginPath(); g.moveTo(cx + f * (ew + 1), cy - 13 - tilt); g.lineTo(cx + f * (ew + 10), cy - 19 - tilt * 1.6); g.stroke();
        g.beginPath(); g.moveTo(cx + f * (ew + 1), cy - 9 - tilt); g.lineTo(cx + f * (ew + 8), cy - 9 - tilt); g.stroke();
        g.lineWidth = 2.2;
        g.beginPath(); g.moveTo(cx - f * 12, cy + eh - 2); g.quadraticCurveTo(cx + f * 6, cy + eh + 2, cx + f * (ew - 2), cy + eh - 12 - tilt * 0.3); g.stroke();
        g.strokeStyle = 'rgba(120,60,60,0.5)'; g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(cx - f * 20, cy - eh - 4); g.quadraticCurveTo(cx, cy - eh - 13, cx + f * 22, cy - eh - 6 - tilt * 0.5); g.stroke();
        if (liner) { // kohl wing (Eropatra)
          g.strokeStyle = liner; g.lineWidth = 4;
          g.beginPath(); g.moveTo(cx + f * (ew - 2), cy + eh - 12); g.lineTo(cx + f * (ew + 15), cy + 2 - tilt); g.stroke();
        }
      }
      g.strokeStyle = brow; g.lineWidth = 3.6;
      g.beginPath();
      const by = cy - eh - 20;
      if (browShape === 'soft') { g.moveTo(cx - f * 18, by + 2); g.quadraticCurveTo(cx, by - 5, cx + f * 21, by + 1); }
      else if (browShape === 'worried') { g.moveTo(cx - f * 18, by - 4); g.quadraticCurveTo(cx, by - 3, cx + f * 21, by + 4); }
      else { g.moveTo(cx - f * 18, by + 5); g.quadraticCurveTo(cx, by - 1, cx + f * 22, by - 4); }
      g.stroke();
    };
    eye(128 - 58, -1); eye(128 + 58, 1);
    for (const s of [-1, 1]) { // soft round blush
      const bl = g.createRadialGradient(128 + s * 74, 180, 1, 128 + s * 74, 180, 22);
      bl.addColorStop(0, `rgba(255,120,130,${blush})`); bl.addColorStop(1, 'rgba(255,120,130,0)');
      g.fillStyle = bl; g.fillRect(128 + s * 74 - 24, 160, 48, 40);
    }
    g.strokeStyle = 'rgba(190,105,95,0.6)'; g.lineWidth = 1.8; // nose: a tick of shadow
    g.beginPath(); g.moveTo(129, 180); g.lineTo(131, 185); g.stroke();
    g.strokeStyle = lip; g.lineWidth = 2.6;
    g.beginPath();
    if (mouth === 'smile') { g.moveTo(115, 207); g.quadraticCurveTo(128, 215, 141, 207); g.stroke(); }
    else if (mouth === 'smirk') { g.moveTo(116, 210); g.quadraticCurveTo(130, 214, 143, 204); g.stroke(); }
    else if (mouth === 'open') {
      g.fillStyle = '#8a2a3a'; g.moveTo(117, 205); g.quadraticCurveTo(128, 222, 139, 205); g.quadraticCurveTo(128, 208, 117, 205); g.fill(); g.stroke();
      g.fillStyle = '#ff9aa8'; g.beginPath(); g.ellipse(128, 212, 5, 2.5, 0, 0, TAU); g.fill();
    } else { g.moveTo(118, 209); g.quadraticCurveTo(128, 211, 138, 209); g.stroke(); }
    if (mouth !== 'open') { // lower-lip shine
      g.strokeStyle = 'rgba(230,120,130,0.45)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(123, 216); g.quadraticCurveTo(128, 218, 133, 216); g.stroke();
    }
  });
}
/** open + closed frames of a face; Rig.update swaps them to blink */
const faces = (o) => ({ open: softFace(o), closed: softFace(o, true) });

/** Blender weapon kit (batch 22) built in the holder's own space; the primitive parts in `old` are replaced */
const weapon = (name, holder, roles, old = [...holder.children], ol = 0.004) => applyKit(name, holder, roles, old, { ol });
/** a holder group that takes over a primitive's place (for kits that replace a single mesh) */
const holderFor = (o) => { const g = new THREE.Group(); g.position.copy(o.position); g.rotation.copy(o.rotation); o.parent.add(g); return g; };

/** Standard anime-proportioned body on the shared joint layout. Returns helpers for adding accessories. */
function buildBody(rig, S) {
  const j = rig.j;
  const add = (p, o, x = 0, y = 0, z = 0) => { o.position.set(x, y, z); p.add(o); return o; };
  const grp = (p, name, x, y, z) => { const g = add(p, new THREE.Group(), x, y, z); g.name = name; j[name] = g; return g; };
  const Sp = (r, ws = 20, hs = 14, ...a) => new THREE.SphereGeometry(r, ws, hs, ...a);
  const Cy = (rt, rb, h, rs = 16, ...a) => new THREE.CylinderGeometry(rt, rb, h, rs, 1, ...a);

  const pivot = grp(rig.root, 'pivot', 0, S.hipH ?? 0.88, 0);
  const hips = grp(pivot, 'hips', 0, 0, 0);
  const pelvis = add(hips, part(Sp(0.135), S.bottom, { ol: 0.007 })); pelvis.scale.set(1.12, 0.8, 0.86);
  const spine = grp(hips, 'spine', 0, 0.05, 0);
  const waistM = add(spine, part(Cy(0.098, 0.12, 0.22), S.waist ?? S.skin, { ol: 0.006 }), 0, 0.06, 0);
  const chest = grp(spine, 'chest', 0, 0.2, 0);
  const ch = add(chest, part(Sp(0.125), S.chest ?? S.skin, { ol: 0.007 }), 0, 0.04, 0); ch.scale.set(1.06, 0.95, 0.8);
  const neckM = add(chest, part(Cy(0.042, 0.05, 0.1), S.skin, { ol: 0.005 }), 0, 0.17, 0);
  const bodyOld = [pelvis, waistM, ch, neckM]; // primitive segments, replaced by the skinned Blender body
  // cape joints (Blender capes are skinned to them; Rig.update makes them flutter)
  const capeA = grp(chest, 'capeA', 0, 0.11, -0.1);
  grp(capeA, 'capeB', 0, -0.49, -0.1);
  const head = grp(chest, 'head', 0, 0.2, 0.005);
  head.scale.setScalar(1.12); // ~6.5 heads tall
  const skinFace = toon(S.skin.color.getHex(), { isFace: true }); // same light model as the painted face
  const skull = add(head, part(animeHead(Sp(0.12, 32, 24)), skinFace, { ol: 0.008 }), 0, 0.1, 0); skull.scale.set(1, 1.04, 0.98);
  const fc = S.face.open ? S.face : { open: S.face };
  rig.faceTex = fc; rig.mats.skin = S.skin;
  const faceMat = toon(0xffffff, { map: fc.open, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, isFace: true });
  rig.faceMesh = add(skull, new THREE.Mesh(animeHead(Sp(0.1206, 32, 20, Math.PI / 2 - 0.8, 1.6, Math.PI / 2 - 0.7, 1.3)), faceMat));
  rig.faceMesh.renderOrder = 2;
  // hair cap + bangs
  const cap = add(head, part(Sp(0.13, 22, 10, 0, Math.PI * 2, 0, 1.05), S.hair, { ol: 0.008 }), 0, 0.105, -0.012); cap.scale.set(1.04, 1.03, 1.04);
  // sides + back of the hair, open over the face
  const sides = add(head, part(Sp(0.13, 22, 10, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9, 1.0, 1.25), toon(S.hairColor, { side: THREE.DoubleSide }), { ol: 0.008 }), 0, 0.105, -0.012);
  sides.scale.set(1.04, 1.03, 1.04);
  // anime 'angel ring' hair highlight
  const ring = add(head, new THREE.Mesh(new THREE.TorusGeometry(0.118, 0.01, 6, 32, Math.PI * 1.3), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false })), 0, 0.165, -0.01);
  ring.rotation.set(Math.PI / 2 + 0.25, 0, Math.PI * 0.85); ring.material.userData.noGlow = true;
  const hairOld = [cap, sides];
  for (let i = 0; i < 5; i++) {
    const x = (i - 2) * 0.038;
    const b = add(head, part(new THREE.ConeGeometry(0.03, 0.08, 5), i === 1 && S.hair2 ? S.hair2 : S.hair, { ol: 0.005 }), x, 0.165, 0.102 - Math.abs(i - 2) * 0.012);
    b.rotation.set(0.35, 0, Math.PI - x * 2.5);
    hairOld.push(b);
  }
  for (const s of [-1, 1]) {
    const l = add(head, part(new THREE.ConeGeometry(0.03, 0.22, 6), S.hair, { ol: 0.005 }), s * 0.11, 0.02, 0.04);
    l.rotation.set(0.05, 0, Math.PI + s * 0.08);
    hairOld.push(l);
  }
  // signature hairstyle (Blender, matching the portraits): hime / wavy / straight / wild / twin
  const hs = S.hairStyle;
  applyKit(hs ? `kit_hs_${hs}_front` : 'kit_b_hair', head, { hair: S.hair, side: sides.material, hair2: S.hair2 ?? S.hair }, hairOld, { ol: 0.006, crease: 1.2 });
  // long back hair flowing to the waist
  const longH = add(head, part(Cy(0.13, 0.19, S.hairLen ?? 0.62, 18, true, Math.PI * 0.55, Math.PI * 0.9), toon(S.hairColor, { side: THREE.DoubleSide }), { ol: 0.006 }), 0, 0.1 - (S.hairLen ?? 0.62) / 2, -0.04);
  const hairL = S.hairLen ?? 0.62;
  // backOld is returned so a rig can add its own primitive tails for the kit to replace
  const backOld = [longH];
  applyKit(hs ? `kit_hs_${hs}_back` : 'kit_b_hairlong', head, { side: longH.material, tie: S.tie ?? S.hair2 ?? S.hair }, backOld,
    { ol: 0.006, crease: 1.2, place: (m) => { m.position.set(0, hs === 'twin' ? 0.19 : 0.1, 0); m.scale.set(1, hairL, 1); } }).then((m) => { rig.hairBack = m; });
  // glossy anime hair: a cel highlight in a lighter tint of the hair colour
  for (const m of new Set([S.hair, S.hair2 ?? S.hair, sides.material, longH.material])) {
    const u = m.userData;
    u.specStrength = 0.5; u.specPower = 18; u.specThreshold = 0.6;
    u.specColor = m.color.clone().lerp(new THREE.Color(0xffffff), 0.5).multiplyScalar(0.55);
  }
  if (S.hairTip) {
    const tip = add(head, part(Cy(0.19, 0.21, 0.16, 18, true, Math.PI * 0.55, Math.PI * 0.9), toon(S.hairTip, { side: THREE.DoubleSide }), { ol: 0.006 }), 0, 0.1 - (S.hairLen ?? 0.62) - 0.07, -0.04);
  }

  for (const s of [-1, 1]) {
    const k = s > 0 ? 'L' : 'R';
    const arm = grp(chest, 'arm' + k, s * 0.175, 0.1, -0.01);
    const shM = add(arm, part(Sp(0.05, 12, 10), S.shoulder ?? S.skin, { ol: 0.006 }));
    const uaM = add(arm, part(Cy(0.045, 0.04, 0.24), S.upperArm ?? S.skin, { ol: 0.006 }), 0, -0.12, 0);
    const elbow = grp(arm, 'elbow' + k, 0, -0.235, 0);
    const ebM = add(elbow, part(Sp(0.04, 10, 8), S.forearm ?? S.skin, { ol: 0.005 }));
    const faM = add(elbow, part(Cy(0.042, 0.036, 0.22), S.forearm ?? S.skin, { ol: 0.006 }), 0, -0.11, 0);
    const hand = grp(elbow, 'hand' + k, 0, -0.235, 0);
    const hm = add(hand, part(Sp(0.042, 12, 10), S.hand ?? S.skin, { ol: 0.005 }), 0, -0.03, 0); hm.scale.set(0.8, 1.1, 0.9);
    bodyOld.push(shM, uaM, ebM, faM);
    applyKit('kit_b_hand', hand, { hand: hm.material }, [hm], { ol: 0.004, place: (m) => { m.scale.x = -s; } });
  }
  for (const s of [-1, 1]) {
    const k = s > 0 ? 'L' : 'R';
    const leg = grp(hips, 'leg' + k, s * 0.08, -0.05, 0);
    const thM = add(leg, part(Cy(0.075, 0.056, 0.38), S.thigh ?? S.skin, { ol: 0.007 }), 0, -0.19, 0);
    const knee = grp(leg, 'knee' + k, 0, -0.38, 0);
    const knM = add(knee, part(Sp(0.055, 12, 10), S.knee ?? S.shin, { ol: 0.006 }));
    const snM = add(knee, part(Cy(0.054, 0.04, 0.34), S.shin, { ol: 0.007 }), 0, -0.17, 0);
    const foot = grp(knee, 'foot' + k, 0, -0.355, 0);
    const shoe = add(foot, part(Sp(0.09, 14, 10), S.shoe, { ol: 0.007 }), 0, -0.035, 0.035); shoe.scale.set(0.62, 0.5, 1.25);
    bodyOld.push(thM, knM, snM);
    applyKit('kit_b_shoe', foot, { shoe: S.shoe }, [shoe], { ol: 0.007 });
  }
  // one continuous skinned body (hero_body_skinned.glb): skin underneath, garment layers on top.
  // A layer whose material is the skin is simply not drawn; only the bare body carries the outline.
  const lay = (m) => (m && m !== S.skin ? m : undefined);
  applySkinned('hero_body_skinned', rig, {
    skin: S.skin, bottom: lay(S.bottom), waist: lay(S.waist), chest: lay(S.chest), upper: lay(S.upperArm ?? S.shoulder),
    forearm: lay(S.forearm), thigh: lay(S.thigh), knee: lay(S.knee ?? S.shin), shin: lay(S.shin),
  }, bodyOld, { ol: (r) => (r === 'skin' ? 0.007 : r === 'knee' ? 0.004 : 0) });
  /** skinned Blender outfit pieces (hero_outfits.glb): roles -> materials, old primitives replaced */
  const outfit = (roles, old) => applySkinned('hero_outfits', rig, roles, old, { ol: 0.006 });
  /** Blender armour kits (batch 21): pauldrons ride the upper arms (mirrored for the right), chest & head pieces */
  const armor = {
    pauldrons: (roles, old) => ['L', 'R'].forEach((k, i) => applyKit('kit_a_pauldron', j['arm' + k], roles, i ? [] : old,
      { ol: 0.005, place: (m) => { m.scale.x = k === 'L' ? 1 : -1; } })),
    chest: (roles, old) => applyKit('kit_a_chest', chest, roles, old, { ol: 0.005 }),
    head: (roles, old) => applyKit('kit_a_head', head, roles, old, { ol: 0.006 }),
  };
  return { add, Sp, Cy, chest, head, hips, spine, backOld, outfit, armor };
}

export class FideliaRig extends Rig {
  constructor() { super('Fidelia'); }
  _build() {
    this.style = 'sword';
    const skin = toon(0xffe4d4), shell = toon(0xf4eef8, { flatShading: true }), pearl = toon(0xe6dcf2), blue = toon(0x7fc4ec);
    const hairC = 0xcfe6f6;
    const H = buildBody(this, {
      skin, bottom: shell, chest: skin, hair: toon(hairC), hair2: toon(0xa9d4f0), hairColor: hairC, hairLen: 0.7, hairStyle: 'wavy',
      thigh: skin, knee: shell, shin: toon(0xe9eef4, { flatShading: true }), shoe: toon(0xdbe3ec, { flatShading: true }),
      forearm: toon(0xe9eef4, { flatShading: true }), hand: toon(0xe9eef4), face: faces({ iris: ['#0f5a78', '#35b8d8', '#c8f6ff'], lash: '#2c4560', brow: '#86aecb', browShape: 'firm', mouth: 'smile', lip: '#d0607a' }),
    });
    const { add, Sp, Cy, chest, head, hips, outfit, armor } = H;
    // shell breastplate
    const cups = [], pads = [], fins = [];
    for (const s of [-1, 1]) {
      const b = add(chest, part(Sp(0.062, 12, 10), shell, { ol: 0.006 }), s * 0.056, 0.03, 0.075); b.scale.set(1, 0.9, 0.75);
      const pad = add(chest, part(Sp(0.085, 12, 8, 0, Math.PI * 2, 0, 1.6), shell, { ol: 0.007 }), s * 0.19, 0.13, -0.01);
      pad.rotation.z = -s * 0.5; pad.scale.set(1, 0.8, 1.1);
      cups.push(b); pads.push(pad);
      for (let r = 0; r < 3; r++) { // scallop ridges
        const ridge = add(pad, new THREE.Mesh(new THREE.TorusGeometry(0.06 - r * 0.012, 0.004, 4, 16, Math.PI), pearl), 0, 0.03, 0);
        ridge.rotation.y = Math.PI / 2;
      }
    }
    const gem = add(chest, new THREE.Mesh(new THREE.OctahedronGeometry(0.018), new THREE.MeshBasicMaterial({ color: 0x5ad0ff })), 0, 0.0, 0.11);
    void gem;
    armor.pauldrons({ shellPad: shell, shellRidge: pearl }, pads);
    armor.chest({ fidBust: shell }, cups);
    // armored faulds
    const fauldM = toon(0xeef2f8, { side: THREE.DoubleSide, flatShading: true });
    const skirt = add(hips, part(Cy(0.15, 0.2, 0.12, 12, true), fauldM, { ol: 0.006 }), 0, -0.04, 0);
    outfit({ fidFauld: fauldM }, [skirt]);
    const belt = add(hips, part(new THREE.TorusGeometry(0.145, 0.015, 6, 20), blue, { ol: 0 }), 0, 0.03, 0); belt.rotation.x = Math.PI / 2;
    // shell helmet with fins
    const helm = add(head, part(Sp(0.142, 18, 10, 0, Math.PI * 2, 0, 1.15), shell, { ol: 0.008 }), 0, 0.115, -0.01);
    void helm;
    add(head, new THREE.Mesh(Sp(0.018, 8, 6), new THREE.MeshBasicMaterial({ color: 0x5ad0ff })), 0, 0.2, 0.11);
    for (const s of [-1, 1]) {
      const fin = add(head, part(new THREE.ConeGeometry(0.05, 0.2, 3), blue, { ol: 0.006 }), s * 0.15, 0.17, -0.03);
      fin.rotation.set(-0.3, 0, -s * 1.05);
      fins.push(fin);
    }
    armor.head({ fidHelm: shell, fidHelmRidge: pearl, fidFin: blue }, [helm, ...fins]);
    // sword (right hand)
    const sword = new THREE.Group();
    this.j.handR.add(sword);
    sword.position.set(0, -0.05, 0.02); sword.rotation.x = Math.PI / 2 + 0.25;
    add(sword, part(new THREE.BoxGeometry(0.035, 0.12, 0.035), toon(0x6b5a8a), { ol: 0.004 }), 0, 0, 0);
    add(sword, part(new THREE.BoxGeometry(0.16, 0.025, 0.04), pearl, { ol: 0.004 }), 0, 0.07, 0);
    const blade = add(sword, part(new THREE.BoxGeometry(0.05, 0.75, 0.012), toon(0x9ee0ff, { emissive: 0x1a6fa8, emissiveIntensity: 0.6 }), { ol: 0.005 }), 0, 0.46, 0);
    void blade;
    add(sword, new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.08, 4), toon(0x9ee0ff)), 0, 0.875, 0);
    this.sword = sword;
    weapon('kit_w_fidsword', sword, { fsGrip: sword.children[0].material, fsGuard: pearl, fsBlade: blade.material });
    // scallop shield on left forearm
    const shield = part(Sp(0.24, 16, 8, 0, Math.PI * 2, 0, 1.0), shell, { ol: 0.01 });
    shield.scale.set(1, 0.42, 1.1);
    this.j.elbowL.add(shield);
    shield.position.set(0.08, -0.12, 0.02); shield.rotation.z = -Math.PI / 2;
    for (let i = 0; i < 5; i++) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.42), pearl);
      rib.rotation.y = (i - 2) * 0.32; rib.position.y = 0.2; shield.add(rib);
    }
    weapon('kit_w_fidshield', holderFor(shield), { shShell: shell, shRib: pearl }, [shield], 0.006);
  }
}

export class MoraRig extends Rig {
  constructor() { super('Mora'); this.orbT = 0; }
  _build() {
    this.style = 'caster';
    const skin = toon(0xffe6d8), suit = toon(0xf6f4fa), purple = toon(0x8a3fb0), gold = toon(0xf0c35a);
    const starTex = canvasTex(256, 128, (g, w, h) => {
      g.fillStyle = '#7a35a6'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#ffe7a8';
      for (let i = 0; i < 40; i++) { const x = Math.random() * w, y = Math.random() * h, r = Math.random() * 2.2 + 0.6; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#f0c35a'; g.fillRect(0, h - 8, w, 8);
    });
    const cloak = toon(0xffffff, { map: starTex, side: THREE.DoubleSide });
    const H = buildBody(this, {
      skin, bottom: suit, chest: suit, waist: suit, hair: toon(0xf4a8d0), hair2: toon(0xffc8e4), hairColor: 0xf4a8d0, hairTip: 0xa8c8f0, hairLen: 0.78, hairStyle: 'straight',
      thigh: suit, knee: suit, shin: suit, shoe: gold, upperArm: suit, forearm: suit, hand: skin,
      face: faces({ iris: ['#5a1f7a', '#c060c8', '#ffc8e8'], lash: '#4a2a48', brow: '#d98ab4', mouth: 'smile', lip: '#d04a70', blush: 0.46 }),
    });
    const { add, Sp, Cy, chest, head, outfit, armor } = H;
    // hood (star cloak) + cape
    const hood = add(head, part(Sp(0.15, 20, 10, Math.PI / 2 + 0.8, Math.PI * 2 - 1.6, 0, 1.9), cloak, { ol: 0.008 }), 0, 0.11, -0.015);
    void hood;
    const hoodTop = add(head, part(Sp(0.152, 20, 8, 0, Math.PI * 2, 0, 0.95), cloak, { ol: 0.008 }), 0, 0.11, -0.015);
    void hoodTop;
    const cape = add(chest, part(Cy(0.17, 0.42, 1.05, 18, true, Math.PI * 0.6, Math.PI * 0.8), cloak, { ol: 0.008 }), 0, -0.42, -0.02);
    outfit({ moraCape: cloak }, [cape]);
    // gold collar + jewel
    const collar = add(chest, part(new THREE.TorusGeometry(0.07, 0.014, 6, 18), gold, { ol: 0 }), 0, 0.15, 0); collar.rotation.x = Math.PI / 2;
    armor.head({ moraHood: cloak, moraHoodTrim: gold }, [hood, hoodTop]);
    armor.chest({ moraCollar: gold }, [collar]);
    add(chest, new THREE.Mesh(new THREE.OctahedronGeometry(0.022), new THREE.MeshBasicMaterial({ color: 0xc28bff })), 0, 0.1, 0.1);
    for (const s of [-1, 1]) add(this.j['hand' + (s > 0 ? 'L' : 'R')], part(new THREE.TorusGeometry(0.045, 0.01, 6, 14), gold, { ol: 0 }), 0, 0.02, 0).rotation.x = Math.PI / 2;
    // floating planet orb (time & stars)
    const orb = new THREE.Group();
    const planet = new THREE.Mesh(Sp(0.11, 16, 12), toon(0xf0c070, { emissive: 0x6a4010 }));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.012, 6, 28), new THREE.MeshBasicMaterial({ color: 0xd2b0ff }));
    ring.rotation.x = 1.2; orb.add(planet, ring);
    this.root.add(orb);
    this.orb = orb;
  }
  update(dt, st) {
    super.update(dt, st);
    this.orbT += dt;
    const t = this.orbT;
    const casting = st.action === 'cast' || st.action === 'burst';
    if (casting) this.j.handR.getWorldPosition(this.orb.position), this.root.worldToLocal(this.orb.position), this.orb.position.z += 0.25;
    else this.orb.position.set(-0.45 + Math.sin(t * 0.8) * 0.05, 1.55 + Math.sin(t * 1.5) * 0.07, -0.1);
    this.orb.rotation.y += dt * 1.5;
  }
}

export class ScyllaRig extends Rig {
  constructor() { super('Scylla'); }
  _build() {
    this.style = 'scythe';
    const skin = toon(0xffe8dc), black = toon(0x262030), purple = toon(0x8a4fd0), net = toon(0x3a3444), silver = toon(0xe9e9f2);
    const H = buildBody(this, {
      skin, bottom: black, chest: black, waist: skin, hair: silver, hair2: toon(0xd0d0e4), hairColor: 0xe9e9f2, hairLen: 0.82, hairStyle: 'wavy',
      thigh: net, knee: net, shin: net, shoe: black, upperArm: skin, forearm: black, hand: black,
      face: faces({ iris: ['#2a1050', '#8a5ae0', '#e0c8ff'], lash: '#2a2430', brow: '#b4b4c6', browShape: 'firm', shape: 'sharp', mouth: 'flat', blush: 0.2, lip: '#b05070' }),
    });
    const { add, Sp, Cy, chest, hips, outfit } = H;
    // corset lines + skirt
    const belt = add(hips, part(new THREE.TorusGeometry(0.14, 0.016, 6, 20), purple, { ol: 0 }), 0, 0.03, 0); belt.rotation.x = Math.PI / 2;
    const skM = toon(0xf0f0f6, { side: THREE.DoubleSide });
    const sk = add(hips, part(Cy(0.15, 0.22, 0.14, 14, true), skM, { ol: 0.006 }), 0, -0.05, 0);
    outfit({ scySkirt: skM, scyLace: toon(0x2a2232, { side: THREE.DoubleSide }) }, [sk]);
    for (const sx of [-1, 1]) add(chest, new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.16, 0.01), purple), sx * 0.04, 0.0, 0.1);
    // hair ornament (shell)
    add(this.j.head, part(Sp(0.03, 8, 6), purple, { ol: 0.004 }), 0.1, 0.18, 0.04);
    // giant abyss scythe
    const sc = new THREE.Group();
    this.j.handR.add(sc);
    sc.position.set(0, -0.04, 0); sc.rotation.x = Math.PI / 2 - 0.2;
    add(sc, part(Cy(0.025, 0.025, 2.0, 8), toon(0x1c1824), { ol: 0.005 }), 0, 0.2, 0);
    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(0, 0); bladeShape.quadraticCurveTo(0.55, 0.15, 0.95, -0.55); bladeShape.quadraticCurveTo(0.45, -0.05, 0, -0.18); bladeShape.lineTo(0, 0);
    const blade = part(new THREE.ExtrudeGeometry(bladeShape, { depth: 0.03, bevelEnabled: false }), toon(0x9a5cff, { emissive: 0x4a1a9a, emissiveIntensity: 0.8 }), { ol: 0.008 });
    blade.position.set(0, 1.18, -0.015); sc.add(blade);
    for (let k = 0; k < 3; k++) { const sp = add(sc, part(new THREE.ConeGeometry(0.03, 0.18, 4), toon(0x9a5cff), { ol: 0.004 }), -0.05, 1.05 - k * 0.12, 0); sp.rotation.z = 1.2; }
    weapon('kit_w_scythe', sc, { scShaft: sc.children[0].material, scBlade: blade.material, scSpike: sc.children[2].material }, undefined, 0.005);
  }
}

export class EropatraRig extends Rig {
  constructor() { super('Eropatra'); }
  _build() {
    this.style = 'staff';
    const skin = toon(0xf4cba6), gold = toon(0xf0c35a, { emissive: 0x3a2400 }), white = toon(0xf8f4ea), black = toon(0x15121a);
    const H = buildBody(this, {
      skin, bottom: white, chest: gold, waist: skin, hair: black, hair2: black, hairColor: 0x15121a, hairLen: 0.95, hairStyle: 'hime',
      thigh: skin, knee: skin, shin: skin, shoe: gold, upperArm: skin, forearm: skin, hand: skin,
      face: faces({ iris: ['#6a3a00', '#e8b020', '#fff0a0'], lash: '#0c0a10', brow: '#15121a', browShape: 'firm', shape: 'sharp', mouth: 'smirk', liner: '#0c0a10', lip: '#b04040', blush: 0.25 }),
    });
    const { add, Sp, Cy, chest, head, hips, outfit, armor } = H;
    // long white skirt with gold hem + gold collar (usekh)
    const skM = toon(0xf8f4ea, { side: THREE.DoubleSide });
    const sk = add(hips, part(Cy(0.16, 0.3, 0.62, 16, true), skM, { ol: 0.006 }), 0, -0.3, 0);
    const hem = add(hips, part(new THREE.TorusGeometry(0.3, 0.018, 6, 24), gold, { ol: 0 }), 0, -0.6, 0); hem.rotation.x = Math.PI / 2;
    const belt = add(hips, part(new THREE.TorusGeometry(0.15, 0.025, 6, 20), gold, { ol: 0 }), 0, 0.03, 0); belt.rotation.x = Math.PI / 2;
    const panel = add(hips, part(new THREE.BoxGeometry(0.08, 0.32, 0.02), gold, { ol: 0.004 }), 0, -0.14, 0.15);
    const collar = add(chest, part(Cy(0.11, 0.2, 0.08, 18), gold, { ol: 0.005 }), 0, 0.14, 0);
    void collar;
    // golden halo crown + side braids with gold cuffs
    const crown = add(head, part(new THREE.TorusGeometry(0.135, 0.018, 6, 22), gold, { ol: 0.004 }), 0, 0.2, 0); crown.rotation.x = Math.PI / 2;
    armor.chest({ usekh: gold, usekhBead: toon(0x2fb8c8) }, [collar]);
    armor.head({ eroCrown: gold }, [crown]);
    add(head, new THREE.Mesh(Sp(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: 0x40d0ff })), 0, 0.2, 0.135);
    const halo = add(head, new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.012, 6, 28), new THREE.MeshBasicMaterial({ color: 0xffd86a })), 0, 0.2, -0.17);
    void halo;
    for (const s of [-1, 1]) add(head, part(Cy(0.03, 0.03, 0.05, 8), gold, { ol: 0.003 }), s * 0.11, -0.06, 0.04);
    for (const s of [-1, 1]) { const arm = this.j['elbow' + (s > 0 ? 'L' : 'R')]; add(arm, part(Cy(0.046, 0.046, 0.06, 10), gold, { ol: 0.003 }), 0, -0.05, 0); }
    // cape
    const capeM = toon(0xf0e6c8, { side: THREE.DoubleSide });
    const cape = add(chest, part(Cy(0.2, 0.45, 1.2, 18, true, Math.PI * 0.55, Math.PI * 0.9), capeM, { ol: 0.006 }), 0, -0.5, -0.03);
    outfit({ eroSkirt: skM, eroGold: gold, eroCape: capeM }, [sk, hem, panel, cape]);
    // Anubis staff
    const st = new THREE.Group(); this.j.handR.add(st);
    st.position.set(0, -0.04, 0); st.rotation.x = Math.PI / 2 - 0.15;
    add(st, part(Cy(0.022, 0.022, 1.7, 8), gold, { ol: 0.004 }), 0, 0.1, 0);
    const jack = add(st, part(new THREE.BoxGeometry(0.1, 0.16, 0.2), black, { ol: 0.005 }), 0, 1.0, 0.04);
    void jack;
    for (const s of [-1, 1]) add(st, part(new THREE.ConeGeometry(0.025, 0.12, 4), black, { ol: 0.003 }), s * 0.04, 1.13, 0);
    add(st, part(new THREE.ConeGeometry(0.035, 0.12, 6), black, { ol: 0.003 }), 0, 0.98, 0.17).rotation.x = Math.PI / 2;
    weapon('kit_w_anubis', st, { anShaft: gold, anHead: black });
  }
}

export class RumiRig extends Rig {
  constructor() { super('Rumi'); }
  _build() {
    this.style = 'cstaff';
    const skin = toon(0xf2c8a4), black = toon(0x1a1418), red = toon(0x9a1a24), blonde = toon(0xf4d27a);
    const H = buildBody(this, {
      skin, bottom: black, chest: black, waist: black, hair: blonde, hair2: toon(0xffe6a0), hairColor: 0xf4d27a, hairLen: 0.8, hairStyle: 'wavy',
      thigh: black, knee: black, shin: black, shoe: red, upperArm: skin, forearm: black, hand: black,
      face: faces({ iris: ['#4a1408', '#c85a28', '#ffc890'], lash: '#2a1a10', brow: '#b8923a', shape: 'droopy', mouth: 'smile', lip: '#c04848' }),
    });
    const { add, Sp, Cy, chest, head, hips, outfit } = H;
    const skM = toon(0x1a1418, { side: THREE.DoubleSide });
    const sk = add(hips, part(Cy(0.15, 0.24, 0.26, 14, true), skM, { ol: 0.006 }), 0, -0.1, 0);
    for (const s of [-1, 1]) { // curled horns
      const h = add(head, part(new THREE.ConeGeometry(0.035, 0.2, 8), black, { ol: 0.004 }), s * 0.1, 0.22, 0.0);
      h.rotation.set(-0.5, 0, -s * 0.7);
    }
    const capeM = toon(0x9a1a24, { side: THREE.DoubleSide });
    const cape = add(chest, part(Cy(0.2, 0.46, 1.0, 18, true, Math.PI * 0.55, Math.PI * 0.9), capeM, { ol: 0.006 }), 0, -0.4, -0.03);
    outfit({ rumSkirt: skM, rumCape: capeM }, [sk, cape]);
    add(chest, new THREE.Mesh(Sp(0.02, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3a4a })), 0, 0.12, 0.1);
    // cross-spike staff
    const st = new THREE.Group(); this.j.handR.add(st);
    st.position.set(0, -0.04, 0); st.rotation.x = Math.PI / 2 - 0.15;
    add(st, part(Cy(0.018, 0.018, 1.8, 6), black, { ol: 0.004 }), 0, 0.1, 0);
    for (const [dx, dy] of [[0, 1.12], [0.14, 1.0], [-0.14, 1.0], [0, 0.88]]) add(st, part(new THREE.ConeGeometry(0.03, 0.18, 4), black, { ol: 0.003 }), dx, dy, 0).rotation.z = Math.atan2(-dx, dy - 1.0) || 0;
    const core = add(st, new THREE.Mesh(new THREE.OctahedronGeometry(0.05), new THREE.MeshBasicMaterial({ color: 0xff3a4a })), 0, 1.0, 0);
    weapon('kit_w_rumistaff', st, { rsShaft: black, rsSpike: black, rsGem: core.material });
  }
}

export class ValeriaRig extends Rig {
  constructor() { super('Valeria'); }
  _build() {
    this.style = 'great';
    const skin = toon(0xe2ad88), gold = toon(0xd8a840, { emissive: 0x2a1a00, flatShading: true }), dark = toon(0x2a1e18), net = toon(0x4a3a2a);
    const H = buildBody(this, {
      skin, bottom: gold, chest: gold, waist: skin, hair: dark, hair2: dark, hairColor: 0x2a1e18, hairLen: 0.95, hairStyle: 'straight',
      thigh: net, knee: gold, shin: net, shoe: gold, upperArm: skin, forearm: gold, hand: skin,
      face: faces({ iris: ['#123a7a', '#3f8ff0', '#c8ecff'], lash: '#1a120e', brow: '#2a1e18', browShape: 'worried', mouth: 'open', blush: 0.7, lip: '#a03040' }),
    });
    const { add, Sp, Cy, chest, head, hips, outfit } = H;
    const tasM = toon(0xd8a840, { side: THREE.DoubleSide, flatShading: true });
    const tas = add(hips, part(Cy(0.15, 0.22, 0.16, 12, true), tasM, { ol: 0.006 }), 0, -0.06, 0);
    outfit({ valTasset: tasM }, [tas]);
    const pads = [];
    for (const sx of [-1, 1]) { const pad = add(chest, part(Sp(0.08, 10, 8), gold, { ol: 0.006 }), sx * 0.19, 0.12, 0); pad.scale.y = 0.75; pads.push(pad); }
    const circ = add(head, part(new THREE.TorusGeometry(0.13, 0.014, 6, 20), gold, { ol: 0.003 }), 0, 0.17, 0.01); circ.rotation.x = Math.PI / 2 - 0.25;
    H.armor.pauldrons({ valPad: gold, valRim: dark }, pads);
    H.armor.head({ valCirclet: gold }, [circ]);
    add(head, new THREE.Mesh(new THREE.OctahedronGeometry(0.025), new THREE.MeshBasicMaterial({ color: 0x9ee8ff })), 0, 0.19, 0.13);
    const ah = add(head, part(new THREE.ConeGeometry(0.012, 0.12, 4), dark, { ol: 0 }), 0, 0.27, 0.02); ah.rotation.z = 0.5; // ahoge
    // greatsword with an icy edge
    const sw = new THREE.Group(); this.j.handR.add(sw);
    sw.position.set(0, -0.04, 0); sw.rotation.x = Math.PI / 2 + 0.2;
    add(sw, part(new THREE.BoxGeometry(0.05, 0.22, 0.05), dark, { ol: 0.004 }), 0, 0.02, 0);
    add(sw, part(new THREE.BoxGeometry(0.28, 0.05, 0.07), gold, { ol: 0.004 }), 0, 0.14, 0);
    add(sw, part(new THREE.BoxGeometry(0.13, 1.0, 0.03), gold, { ol: 0.005 }), 0, 0.68, 0);
    const ice = add(sw, new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.95, 0.012), toon(0x9ee8ff, { emissive: 0x2a6a9a, emissiveIntensity: 0.8 })), 0, 0.68, 0);
    weapon('kit_w_valsword', sw, { vsGrip: dark, vsGuard: gold, vsCore: gold, vsEdge: ice.material });
    // tower shield on the back
    const sh = part(new THREE.BoxGeometry(0.5, 0.85, 0.06), gold, { ol: 0.008 });
    sh.position.set(0, -0.05, -0.17); chest.add(sh);
    const emblem = new THREE.Mesh(new THREE.CircleGeometry(0.1, 12), new THREE.MeshBasicMaterial({ color: 0x9ee8ff }));
    add(sh, emblem, 0, 0.15, -0.035).rotation.y = Math.PI;
    const shG = holderFor(sh);
    weapon('kit_w_tower', shG, { tsBody: gold, tsRim: dark }, [sh], 0.007).then((m) => { if (m) add(shG, emblem, 0, 0.15, -0.086); });
  }
}

export class GlyttaRig extends Rig {
  constructor() { super('Glytta'); }
  _build() {
    this.style = 'caster';
    const skin = toon(0xe8dcd8), dark = toon(0x1a1a24, { flatShading: true }), teal = toon(0x3fd0c8, { emissive: 0x0a4a48, emissiveIntensity: 0.9 }), white = toon(0xf2f2f6);
    const H = buildBody(this, {
      skin, bottom: dark, chest: dark, waist: skin, hair: white, hair2: toon(0xdde4f0), hairColor: 0xf2f2f6, hairLen: 0.9, hairStyle: 'wild',
      thigh: dark, knee: dark, shin: dark, shoe: dark, upperArm: dark, forearm: dark, hand: dark,
      face: faces({ iris: ['#0a3a3a', '#3fd0c8', '#c8fff6'], mouth: 'smile' }),
    });
    const { add, Sp, chest, head } = H;
    const halo = add(head, new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.012, 6, 28), new THREE.MeshBasicMaterial({ color: 0xc8fff6 })), 0, 0.33, -0.02);
    halo.rotation.x = Math.PI / 2;
    // jagged crystal armor spikes
    for (const sx of [-1, 1]) {
      for (let k = 0; k < 3; k++) { const sp = add(chest, part(new THREE.ConeGeometry(0.035, 0.22, 4), dark, { ol: 0.004 }), sx * (0.17 + k * 0.03), 0.18 - k * 0.02, -0.04); sp.rotation.z = -sx * (0.8 + k * 0.3); }
      add(chest, part(Sp(0.03, 6, 5), teal, { ol: 0 }), sx * 0.12, 0.07, 0.09);
    }
    // twin crystal blades on both forearms
    for (const k of ['L', 'R']) {
      const sx = k === 'L' ? 1 : -1;
      const b = part(new THREE.ConeGeometry(0.06, 0.95, 4), teal, { ol: 0.006 });
      b.geometry.translate(0, 0.47, 0);
      b.position.set(sx * 0.03, -0.08, 0.05); b.rotation.x = Math.PI / 2 + 0.3;
      this.j['hand' + k].add(b);
      weapon('kit_w_crystal', holderFor(b), { crBlade: teal }, [b], 0.005);
      const guard = part(new THREE.BoxGeometry(0.12, 0.14, 0.12), dark, { ol: 0.004 }); guard.position.y = -0.04; this.j['hand' + k].add(guard);
    }
  }
}

export class GemoraRig extends Rig {
  constructor() { super('Gemora'); }
  _build() {
    this.style = 'caster';
    const skin = toon(0xf4dcd8), black = toon(0x16121e), purple = toon(0x9a5ad8, { emissive: 0x3a1a6a, emissiveIntensity: 0.8 }), hairC = 0x8a4ad0;
    const H = buildBody(this, {
      skin, bottom: black, chest: black, waist: skin, hair: toon(hairC), hair2: toon(0xb07ae8), hairColor: hairC, hairLen: 1.05, hairStyle: 'straight',
      thigh: toon(0x2a2236), knee: black, shin: toon(0x2a2236), shoe: black, upperArm: skin, forearm: black, hand: black,
      face: faces({ iris: ['#3a0a6a', '#b07aff', '#f0d8ff'], mouth: 'flat' }),
    });
    const { add, Sp, Cy, chest, head, hips } = H;
    for (const s of [-1, 1]) { // antennae
      const a = add(head, part(Cy(0.006, 0.006, 0.22, 5), black, { ol: 0 }), s * 0.06, 0.32, 0); a.rotation.z = -s * 0.35;
      add(head, new THREE.Mesh(Sp(0.025, 8, 6), new THREE.MeshBasicMaterial({ color: 0xc07aff })), s * 0.1, 0.42, 0);
    }
    for (const s of [-1, 1]) add(chest, new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.18, 0.01), purple), s * 0.07, -0.02, 0.1);
    const belt = add(hips, part(new THREE.TorusGeometry(0.145, 0.016, 6, 20), purple, { ol: 0 }), 0, 0.02, 0); belt.rotation.x = Math.PI / 2;
    // void rifle
    const gun = new THREE.Group(); this.j.handR.add(gun);
    gun.position.set(0, -0.06, 0.02); gun.rotation.x = Math.PI / 2;
    add(gun, part(new THREE.BoxGeometry(0.08, 0.42, 0.12), black, { ol: 0.005 }), 0, 0.12, 0);
    add(gun, part(Cy(0.03, 0.03, 0.4, 8), toon(0x3a3248), { ol: 0.004 }), 0, 0.5, 0.02);
    add(gun, new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.2, 0.02), purple), 0, 0.15, 0.065);
    const muzzle = add(gun, new THREE.Mesh(Sp(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: 0xc07aff })), 0, 0.7, 0.02);
    weapon('kit_w_rifle', gun, { rfBody: black, rfBarrel: gun.children[1].material, rfGlow: purple }, gun.children.slice(0, 3)).then((m) => { if (m) muzzle.position.y = 0.76; });
  }
}

export class MiccaRig extends Rig {
  constructor() { super('Micca'); this.bt = 0; }
  _build() {
    this.style = 'caster';
    const skin = toon(0xffe2d4), brown = toon(0x5a3a2a), horn = toon(0xe8d8b0, { flatShading: true }), gold = toon(0xf0c35a), hairC = 0xdfe2ea;
    const H = buildBody(this, {
      skin, bottom: brown, chest: brown, waist: skin, hair: toon(hairC), hair2: toon(0xc8ccd8), hairColor: hairC, hairLen: 0.85, hairStyle: 'twin', tie: gold,
      thigh: toon(0x3a2a24), knee: brown, shin: toon(0x3a2a24), shoe: brown, upperArm: skin, forearm: brown, hand: skin,
      face: faces({ iris: ['#6a0a2a', '#ff4a7a', '#ffc0d0'], browShape: 'firm', mouth: 'smile' }),
    });
    const { add, Sp, Cy, head } = H;
    for (const s of [-1, 1]) { // curled ram horns
      for (let k = 0; k < 6; k++) {
        const a = k * 0.75;
        const seg = add(head, part(Sp(0.04 - k * 0.004, 8, 6), horn, { ol: 0.004 }), s * (0.12 + Math.sin(a) * 0.06), 0.2 + Math.cos(a) * 0.06 - k * 0.012, -0.02 + Math.sin(a + 1) * 0.03);
        void seg;
      }
    }
    // war hammer
    const hm = new THREE.Group(); this.j.handR.add(hm);
    hm.position.set(0, -0.05, 0); hm.rotation.x = Math.PI / 2 + 0.2;
    add(hm, part(Cy(0.022, 0.022, 1.3, 8), toon(0x2a1a14), { ol: 0.004 }), 0, 0.3, 0);
    add(hm, part(new THREE.BoxGeometry(0.34, 0.22, 0.22), toon(0x2a2a30, { flatShading: true }), { ol: 0.008 }), 0, 0.95, 0);
    add(hm, new THREE.Mesh(new THREE.OctahedronGeometry(0.05), new THREE.MeshBasicMaterial({ color: 0xff3a5a })), 0, 0.95, 0.12);
    weapon('kit_w_hammer', hm, { hmHandle: hm.children[0].material, hmHead: hm.children[1].material }, hm.children.slice(0, 2), 0.005);
    // Pandora's box floating behind her
    const box = new THREE.Group();
    box.add(part(new THREE.BoxGeometry(0.42, 0.3, 0.3), toon(0x6a2a1a), { ol: 0.008 }));
    const lid = new THREE.Group(); lid.position.set(0, 0.15, -0.15); box.add(lid);
    const lm = part(new THREE.BoxGeometry(0.44, 0.08, 0.32), toon(0x7a3a24), { ol: 0.006 }); lm.position.z = 0.15; lid.add(lm);
    for (const x of [-0.18, 0.18]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.32, 0.32), gold); b.position.x = x; box.add(b); }
    const eye = new THREE.Mesh(Sp(0.05, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff3a5a })); eye.position.set(0, 0.04, 0.16); box.add(eye);
    this.root.add(box);
    this.box = box; this.boxLid = lid;
  }
  update(dt, st) {
    super.update(dt, st);
    this.bt += dt;
    const open = st.action === 'cast' || st.action === 'burst';
    this.box.position.set(0.5, 1.2 + Math.sin(this.bt * 2) * 0.08, -0.45);
    this.box.rotation.y = Math.sin(this.bt) * 0.3;
    this.boxLid.rotation.x = -(open ? 1.2 : 0.1 + Math.abs(Math.sin(this.bt * 3)) * 0.15);
  }
}

export class CommanderRig extends Rig {
  constructor() { super('Commander'); this.bt = 0; }
  _build() {
    this.style = 'dual';
    const skin = toon(0xffe6d6), coat = toon(0x1a243a, { flatShading: true }), gold = toon(0xffd700, { emissive: 0x664400, emissiveIntensity: 0.5 });
    const hairC = 0xf5d882;
    const H = buildBody(this, {
      skin, bottom: coat, chest: coat, waist: coat, hair: toon(hairC), hair2: toon(0xffeaa0), hairColor: hairC, hairLen: 0.5, hairStyle: 'straight',
      thigh: coat, knee: gold, shin: coat, shoe: toon(0x101624), upperArm: coat, forearm: gold, hand: coat,
      face: faces({ iris: ['#8a5800', '#f5b820', '#fff4b8'], lash: '#3a2a14', brow: '#c8a850', browShape: 'firm', mouth: 'smile' }),
    });
    const { add, Sp, Cy, chest, spine, outfit } = H;

    // Golden Pauldrons (Blender kit replaces the boxes)
    const pads = [];
    for (const s of [-1, 1]) {
      const p = add(chest, part(new THREE.BoxGeometry(0.14, 0.08, 0.16), gold, { ol: 0.006 }), s * 0.22, 0.15, -0.01);
      p.rotation.z = -s * 0.35; pads.push(p);
    }
    H.armor.pauldrons({ cmdPad: gold, cmdTrim: coat }, pads);

    // White & Gold Flowing Cape behind the spine
    const capeGeo = new THREE.PlaneGeometry(0.48, 0.95, 4, 6);
    capeGeo.translate(0, -0.45, 0);
    const capeMat = toon(0xfbfcfe, { side: THREE.DoubleSide });
    const cape = add(spine, part(capeGeo, capeMat, { ol: 0.006 }), 0, 0.2, -0.12);
    cape.rotation.x = 0.15;
    outfit({ cmdCape: capeMat }, [cape]);

    // Dual Celestial Blades: Solaris (handR) & Lunaris (handL)
    const makeBlade = (hand, color, glowCol) => {
      const sword = new THREE.Group();
      hand.add(sword);
      sword.position.set(0, -0.05, 0);
      sword.rotation.x = Math.PI / 2 + 0.1;
      add(sword, part(Cy(0.018, 0.018, 0.45, 8), coat, { ol: 0.004 }), 0, 0.08, 0);
      add(sword, part(new THREE.BoxGeometry(0.18, 0.04, 0.06), gold, { ol: 0.005 }), 0, 0.3, 0);
      const bld = add(sword, part(new THREE.ConeGeometry(0.05, 1.25, 4), toon(0xf8f8fc), { ol: 0.006 }), 0, 0.92, 0);
      bld.scale.set(0.4, 1, 1.4);
      const edge = add(sword, new THREE.Mesh(new THREE.ConeGeometry(0.035, 1.15, 4), new THREE.MeshBasicMaterial({ color: glowCol })), 0, 0.9, 0);
      edge.scale.set(0.3, 1, 1.5);
      weapon('kit_w_celestial', sword, { csHilt: coat, csGuard: gold, csBlade: bld.material, csEdge: edge.material });
      return sword;
    };
    this.bladeR = makeBlade(this.j.handR, 0xffaa00, 0xffd700);
    this.bladeL = makeBlade(this.j.handL, 0x44bbff, 0x77ddff);
  }
  update(dt, st) {
    super.update(dt, st);
    this.bt += dt;
    if (this.cape) {
      this.cape.rotation.x = 0.15 + (st.grounded ? 0.08 : 0.35) + Math.sin(this.bt * 6) * 0.08;
      this.cape.rotation.y = Math.sin(this.bt * 3) * 0.05;
    }
  }
}

/** Kali · Hundred Blade Saint (Arc 2). `corrupt` builds the Second-Eclipse boss version. */
export class KaliRig extends Rig {
  constructor(corrupt = false) { super(corrupt ? 'KaliCorrupt' : 'Kali', corrupt); this.bt = 0; }
  _build() {
    this.style = 'sword';
    const c = this.root.name === 'KaliCorrupt';
    const skin = toon(c ? 0xd8c8d8 : 0xf8e0d2), shirt = toon(c ? 0x3a3050 : 0xf4f2f0), black = toon(0x16141c);
    const hairC = c ? 0x9a90b0 : 0xeadcae, hair = toon(hairC), hair2 = toon(c ? 0x7a6a98 : 0xf6ecc8);
    const H = buildBody(this, {
      skin, bottom: black, chest: shirt, waist: skin, hair, hair2, hairColor: hairC, hairLen: 0.72, hairStyle: 'twin', tie: black,
      thigh: skin, knee: skin, shin: skin, shoe: skin, upperArm: shirt, forearm: shirt, hand: skin, shoulder: shirt,
      face: faces({ iris: c ? ['#4a0a3a', '#ff3a8a', '#ffc0e0'] : ['#2a3a6a', '#6a90d8', '#d8e8ff'], lash: '#2a2018', brow: c ? '#6a5a88' : '#c0aa78', browShape: c ? 'firm' : 'soft', mouth: c ? 'flat' : 'smile' }),
    });
    const { add, Sp, Cy, head } = H;
    this.flashMats = [skin, shirt, hair];
    // very long twin tails tied high on both sides
    for (const s of [-1, 1]) {
      const knot = add(head, part(Sp(0.035, 8, 6), black, { ol: 0.003 }), s * 0.13, 0.19, -0.03);
      const tail = add(head, part(Cy(0.04, 0.016, 0.85, 8), hair, { ol: 0.004 }), s * 0.15, -0.24, -0.07);
      tail.rotation.z = s * 0.12;
      H.backOld.push(knot, tail); // the Blender twin-tail kit (with ties) replaces these
    }
    // katana in the right hand
    const blade = (mat) => {
      const g = new THREE.Group();
      add(g, part(new THREE.BoxGeometry(0.04, 0.2, 0.04), black, { ol: 0.003 }), 0, 0.02, 0);
      add(g, part(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 10), toon(0xc8a050), { ol: 0.003 }), 0, 0.13, 0);
      add(g, part(new THREE.BoxGeometry(0.035, 0.9, 0.012), mat, { ol: 0.003 }), 0, 0.59, 0);
      weapon('kit_w_katana', g, { ktGrip: black, ktGuard: g.children[1].material, ktBlade: mat }, undefined, 0.003);
      return g;
    };
    const steel = toon(c ? 0x6a4a9a : 0xdfe6f0, { emissive: c ? 0x4a0a6a : 0x2a3a4a, emissiveIntensity: c ? 1.2 : 0.35 });
    const kat = blade(steel); this.j.handR.add(kat);
    kat.position.set(0, -0.05, 0.02); kat.rotation.x = Math.PI / 2 + 0.15;
    // a halo of floating swords behind her back
    this.halo = new THREE.Group(); this.root.add(this.halo);
    this.haloBlades = [];
    for (let i = 0; i < 6; i++) {
      const b = blade(steel); b.scale.setScalar(0.5);
      this.halo.add(b); this.haloBlades.push(b);
    }
    if (c) {
      const aura = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 32), new THREE.MeshBasicMaterial({ color: 0xa040ff, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }));
      aura.rotation.x = -Math.PI / 2; aura.position.y = 0.03; this.root.add(aura); this.aura = aura;
    }
  }
  update(dt, st) {
    super.update(dt, st);
    this.bt += dt;
    const spread = st.action === 'cast' || st.action === 'burst' ? 1.35 : 1;
    this.haloBlades.forEach((b, i) => {
      const a = -1.1 + (i / 5) * 2.2 + Math.sin(this.bt * 1.3 + i) * 0.05;
      b.position.set(Math.sin(a) * 0.3 * spread, 1.12 + Math.cos(a) * 0.26 * spread + Math.sin(this.bt * 2 + i) * 0.02, -0.26);
      b.rotation.set(0, 0, -a);
    });
    if (this.aura) this.aura.rotation.z += dt;
  }
}
