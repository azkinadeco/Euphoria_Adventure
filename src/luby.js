// Luby — "Mecha Cat Mischief" (WIND · ASSASSIN).
// Fully procedural, toon-shaded 3D model built from the 2D character art:
// lime cat hoodie with mecha eyes + ears, paw gloves with glowing pads, black hair with lime streaks,
// lime eyes, black thigh-highs with lime circuit lines, lime sneakers.
// The model exposes named joints that the procedural animator drives.
import * as THREE from 'three';
import { applyKit, applySkinned } from './assets.js';
import { toon, part, canvasTex, animeSkin, animeHair, animeCloth, animeHead } from './toon.js';
import { Rig } from './rig.js';

const C = {
  lime: 0x9fd63c, limeDark: 0x679a22, limeDeep: 0x2f5a0f, skin: 0xfcd9c4, hair: 0x1c1e24,
  stocking: 0x17181d, white: 0xf4f4f0, glow: 0xb8ff4a,
};

function faceTexture(closed = false) {
  return canvasTex(512, 512, (g) => {
    g.scale(2, 2); const w = 256, h = 256; // drawn at 256, rasterised at 512 for crisp eyes
    g.clearRect(0, 0, w, h);
    const eye = (cx, flip) => {
      const cy = 130;
      if (closed) { // blink frame: a happy curved lash line
        g.strokeStyle = '#120c14'; g.lineCap = 'round'; g.lineWidth = 7;
        g.beginPath(); g.moveTo(cx - flip * 28, cy + 4); g.quadraticCurveTo(cx, cy + 18, cx + flip * 29, cy - 2); g.stroke();
        g.lineWidth = 4;
        for (const k of [0.6, 0.85, 1.05]) { g.beginPath(); g.moveTo(cx + flip * 27 * k, cy + 9 - k * 8); g.lineTo(cx + flip * (27 * k + 6), cy + 15 - k * 9); g.stroke(); }
        g.strokeStyle = '#141018'; g.lineWidth = 4.5;
        g.beginPath(); g.moveTo(cx - flip * 18, cy - 54); g.quadraticCurveTo(cx, cy - 52, cx + flip * 22, cy - 44); g.stroke();
        return;
      }
      // sclera with a soft lid shadow
      g.fillStyle = '#ffffff';
      g.beginPath(); g.ellipse(cx, cy, 27, 33, 0, 0, Math.PI * 2); g.fill();
      const sh = g.createLinearGradient(0, cy - 33, 0, cy - 8);
      sh.addColorStop(0, 'rgba(120,90,110,0.55)'); sh.addColorStop(1, 'rgba(120,90,110,0)');
      g.fillStyle = sh; g.beginPath(); g.ellipse(cx, cy, 27, 33, 0, 0, Math.PI * 2); g.fill();
      // layered iris: dark rim, lime body, bright lower crescent
      const ix = cx + flip * 1, iy = cy + 3;
      g.fillStyle = '#1d3d05';
      g.beginPath(); g.ellipse(ix, iy, 22, 30, 0, 0, Math.PI * 2); g.fill();
      const gr = g.createLinearGradient(0, iy - 28, 0, iy + 28);
      gr.addColorStop(0, '#3d7a0c'); gr.addColorStop(0.45, '#8fe63a'); gr.addColorStop(0.85, '#e4ff8a'); gr.addColorStop(1, '#f6ffc8');
      g.fillStyle = gr;
      g.beginPath(); g.ellipse(ix, iy + 1, 19, 27, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(40,90,8,0.6)'; g.lineWidth = 1.2;
      for (let k = 0; k < 14; k++) { // radial iris fibres
        const a = (k / 14) * Math.PI * 2;
        g.beginPath(); g.moveTo(ix + Math.cos(a) * 7, iy + Math.sin(a) * 10); g.lineTo(ix + Math.cos(a) * 17, iy + Math.sin(a) * 24); g.stroke();
      }
      // slit pupil (cat!)
      g.fillStyle = '#0c1a06';
      g.beginPath(); g.ellipse(ix, iy + 1, 4.5, 17, 0, 0, Math.PI * 2); g.fill();
      // highlights: big soft one, sharp sparkle, small bounce
      g.fillStyle = 'rgba(255,255,255,0.95)';
      g.beginPath(); g.ellipse(cx - flip * 7, cy - 11, 7, 6, -0.4, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(cx + flip * 8, cy - 4); g.lineTo(cx + flip * 10, cy + 1); g.lineTo(cx + flip * 15, cy + 3); g.lineTo(cx + flip * 10, cy + 5); g.lineTo(cx + flip * 8, cy + 10); g.lineTo(cx + flip * 6, cy + 5); g.lineTo(cx + flip * 1, cy + 3); g.lineTo(cx + flip * 6, cy + 1); g.fill();
      g.beginPath(); g.arc(cx + flip * 6, cy + 17, 2.6, 0, Math.PI * 2); g.fill();
      // thick winged upper lash line + double-lid crease
      g.strokeStyle = '#120c14'; g.lineCap = 'round'; g.lineJoin = 'round';
      g.lineWidth = 8;
      g.beginPath(); g.moveTo(cx - flip * 28, cy - 12); g.quadraticCurveTo(cx - flip * 2, cy - 38, cx + flip * 27, cy - 22); g.stroke();
      g.lineWidth = 5;
      g.beginPath(); g.moveTo(cx + flip * 25, cy - 23); g.lineTo(cx + flip * 35, cy - 28); g.stroke();
      g.beginPath(); g.moveTo(cx + flip * 24, cy - 19); g.lineTo(cx + flip * 33, cy - 16); g.stroke();
      g.lineWidth = 1.6; g.strokeStyle = 'rgba(70,40,50,0.7)';
      g.beginPath(); g.moveTo(cx - flip * 22, cy - 34); g.quadraticCurveTo(cx, cy - 46, cx + flip * 24, cy - 35); g.stroke();
      // lower lash
      g.strokeStyle = '#2a1a22'; g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(cx - flip * 16, cy + 28); g.quadraticCurveTo(cx, cy + 33, cx + flip * 18, cy + 25); g.stroke();
      // mischievous brow
      g.strokeStyle = '#141018'; g.lineWidth = 4.5;
      g.beginPath(); g.moveTo(cx - flip * 18, cy - 54); g.quadraticCurveTo(cx, cy - 52, cx + flip * 22, cy - 44); g.stroke();
    };
    eye(128 - 58, -1);
    eye(128 + 58, 1);
    // blush
    g.fillStyle = 'rgba(255,120,140,0.45)';
    g.beginPath(); g.ellipse(128 - 74, 178, 20, 8, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(128 + 74, 178, 20, 8, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(220,70,90,0.7)'; g.lineWidth = 2;
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
      g.beginPath(); g.moveTo(128 + s * (64 + i * 9), 182); g.lineTo(128 + s * (69 + i * 9), 173); g.stroke();
    }
    // grin with fang
    g.fillStyle = '#7a1f2c';
    g.beginPath(); g.moveTo(108, 206); g.quadraticCurveTo(128, 232, 150, 204); g.quadraticCurveTo(128, 212, 108, 206); g.fill();
    g.fillStyle = '#ff8fa0';
    g.beginPath(); g.ellipse(130, 218, 9, 4, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff';
    g.beginPath(); g.moveTo(112, 206); g.lineTo(118, 207); g.lineTo(115, 215); g.fill();
    g.beginPath(); g.moveTo(139, 207); g.lineTo(145, 206); g.lineTo(142, 214); g.fill();
    g.strokeStyle = '#3a1218'; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(106, 205); g.quadraticCurveTo(128, 213, 152, 203); g.stroke();
  });
}

function hoodieTexture() {
  return canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#8fe63a'; g.fillRect(0, 0, w, h);
    // soft fabric folds
    for (let i = 0; i < 18; i++) {
      g.strokeStyle = `rgba(60,110,20,${0.08 + Math.random() * 0.1})`;
      g.lineWidth = 2 + Math.random() * 5;
      const x = Math.random() * w;
      g.beginPath(); g.moveTo(x, h * 0.2); g.quadraticCurveTo(x + 20 - Math.random() * 40, h * 0.6, x + 10 - Math.random() * 20, h); g.stroke();
    }
    // zipper edges
    g.fillStyle = '#4f8f15'; g.fillRect(0, 0, 10, h); g.fillRect(w - 10, 0, 10, h);
    g.fillStyle = '#c8d0c0';
    for (let y = 4; y < h; y += 8) { g.fillRect(3, y, 5, 3); g.fillRect(w - 8, y + 4, 5, 3); }
    // Ω emblems on the chest
    g.fillStyle = '#2f5a0f'; g.font = 'bold 54px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('Ω', w * 0.09, h * 0.36);
    g.fillText('Ω', w * 0.91, h * 0.36);
    // hem rib
    g.fillStyle = '#6fbf25'; g.fillRect(0, h - 26, w, 26);
    g.strokeStyle = '#4f8f15'; g.lineWidth = 2;
    for (let x = 0; x < w; x += 8) { g.beginPath(); g.moveTo(x, h - 26); g.lineTo(x, h); g.stroke(); }
  });
}

function stockingTextures() {
  const draw = (g, w, h, base) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#a6ff3d'; g.lineWidth = 3; g.lineJoin = 'round';
    // circuit traces running down the front
    const lines = [[0.42, 0.10], [0.5, 0.16], [0.58, 0.10]];
    for (const [x0, y0] of lines) {
      g.beginPath(); g.moveTo(w * x0, h * y0);
      g.lineTo(w * x0, h * 0.45); g.lineTo(w * (x0 + (x0 - 0.5) * 0.6), h * 0.55); g.lineTo(w * (x0 + (x0 - 0.5) * 0.6), h * 0.95);
      g.stroke();
      g.fillStyle = '#a6ff3d';
      g.beginPath(); g.arc(w * x0, h * y0, 4, 0, Math.PI * 2); g.fill();
    }
    g.font = 'bold 30px Georgia, serif'; g.textAlign = 'center'; g.fillStyle = '#a6ff3d';
    g.fillText('Ω', w * 0.5, h * 0.08 + 14);
  };
  const map = canvasTex(256, 256, (g, w, h) => draw(g, w, h, '#17181d'));
  const emi = canvasTex(256, 256, (g, w, h) => draw(g, w, h, '#000000'));
  return { map, emi };
}

export class Luby extends Rig {
  constructor() { super('Luby'); this._skin(); this.trails = [[this.j.handR, [0, 0.02, 0], [0, -0.2, 0.05]], [this.j.handL, [0, 0.02, 0], [0, -0.2, 0.05]]]; }

  _build() {
    const M = this.mats;
    M.skin = animeSkin(C.skin);
    M.hoodie = animeCloth(0xffffff, { map: hoodieTexture(), side: THREE.DoubleSide });
    M.lime = toon(C.lime);
    M.limeDark = toon(C.limeDark);
    M.limeDeep = toon(C.limeDeep);
    M.hair = animeHair(C.hair);
    M.hairLime = animeHair(0x9cff3a);
    M.white = toon(C.white);
    M.dark = toon(0x222428);
    M.glow = new THREE.MeshBasicMaterial({ color: C.glow });
    M.eyeYellow = new THREE.MeshBasicMaterial({ color: 0xe8ff5a });
    const st = stockingTextures();
    M.stocking = animeCloth(0xffffff, { map: st.map, emissiveMap: st.emi, emissive: 0x9cff3a, emissiveIntensity: 0.9 });
    M.stockK = toon(C.stocking);
    M.stockK.userData.rimColor = new THREE.Color(0xffffff); M.stockK.userData.rimStrength = 0.45; // kit loads after applyRim runs
    this.faceTex = { open: faceTexture(), closed: faceTexture(true) };
    M.face = toon(0xffffff, { map: this.faceTex.open, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, isFace: true });

    const j = this.j;
    const add = (parent, obj, x = 0, y = 0, z = 0) => { obj.position.set(x, y, z); parent.add(obj); return obj; };
    const grp = (parent, name, x, y, z) => { const g = add(parent, new THREE.Group(), x, y, z); g.name = name; j[name] = g; return g; };
    const S = (r, ws = 20, hs = 14, ...a) => new THREE.SphereGeometry(r, ws, hs, ...a);
    const Cy = (rt, rb, h, rs = 16, ...a) => new THREE.CylinderGeometry(rt, rb, h, rs, 1, ...a);

    // pivot (used for flips) sits at hip height
    const pivot = grp(this.root, 'pivot', 0, 0.92, 0);
    const bodyOld = []; // primitive body, replaced by the skinned Blender body (luby_body_skinned.glb)
    const hips = grp(pivot, 'hips', 0, 0, 0);

    // ---------- pelvis ----------
    const pelvis = add(hips, part(S(0.135), M.skin, { ol: 0.007 }));
    bodyOld.push(pelvis);
    pelvis.scale.set(1.12, 0.78, 0.86);
    const bottoms = add(hips, part(S(0.139, 22, 12, 0, Math.PI * 2, 1.45, 1.1), M.limeDark, { ol: 0.006 }), 0, -0.004, 0);
    bodyOld.push(bottoms);
    bottoms.scale.set(1.12, 0.78, 0.86);
    for (const s of [-1, 1]) { // side ties
      const tie = add(hips, part(new THREE.BoxGeometry(0.012, 0.07, 0.012), M.dark, { ol: 0 }), s * 0.15, -0.04, 0.0);
      tie.rotation.z = s * 0.3;
      bodyOld.push(tie);
    }

    // ---------- tail (mecha) ----------
    let tp = grp(hips, 'tail0', 0, 0.0, -0.12);
    j.tail = [];
    for (let i = 0; i < 7; i++) {
      const seg = add(tp, part(S(0.032 - i * 0.0025, 10, 8), i % 2 ? M.lime : M.dark, { ol: 0.005 }), 0, 0, -0.045);
      // fluffy glowing-stripe segment, growing toward the tip like the key art
      const sc = 0.85 + i * 0.07;
      applyKit('kit_luby_tailseg', tp, { lime: M.lime, glow: M.glow }, [seg], { ol: 0.005, place: (m) => m.scale.set(sc, sc, 1) });
      const g = grp(tp, 'tail' + (i + 1), 0, 0, -0.06);
      j.tail.push(tp);
      tp = g;
    }
    const tipOld = add(tp, part(S(0.03, 10, 8), M.glow, { ol: 0.005 }), 0, 0, -0.02);
    applyKit('kit_luby_tailtip', tp, { lime: M.lime, glow: M.glow }, [tipOld], { ol: 0.005, place: (m) => m.scale.setScalar(1.45) });

    // ---------- spine / chest ----------
    const spine = grp(hips, 'spine', 0, 0.05, 0);
    bodyOld.push(add(spine, part(Cy(0.098, 0.12, 0.22), M.skin, { ol: 0.006 }), 0, 0.06, 0));
    const chest = grp(spine, 'chest', 0, 0.19, 0);
    const ch = add(chest, part(S(0.125), M.skin, { ol: 0.007 }), 0, 0.04, 0);
    ch.scale.set(1.08, 0.95, 0.8);
    bodyOld.push(ch);
    for (const s of [-1, 1]) {
      const b = add(chest, part(S(0.057, 14, 10), M.limeDark, { ol: 0.006 }), s * 0.055, 0.02, 0.07);
      b.scale.set(1, 0.92, 0.72);
      bodyOld.push(b);
    }
    // hoodie body (open front)
    const hood = add(chest, part(Cy(0.155, 0.205, 0.44, 22, true, 0.62, Math.PI * 2 - 1.24), M.hoodie, { ol: 0.008 }), 0, -0.07, -0.01);
    hood.receiveShadow = true;
    // shoulder yoke
    const yoke = add(chest, part(S(0.17, 22, 8, Math.PI / 2 + 0.5, Math.PI * 2 - 1.0, 0, 0.95), M.lime, { ol: 0.008 }), 0, 0.075, -0.01);
    yoke.scale.set(1.05, 0.62, 0.92);
    // hem ring
    const hem = add(chest, part(new THREE.TorusGeometry(0.205, 0.022, 8, 24, Math.PI * 2 - 1.3), M.limeDark, { ol: 0.005 }), 0, -0.29, -0.01);
    hem.rotation.x = Math.PI / 2; hem.rotation.z = Math.PI / 2 + 0.65;
    // Blender open hoodie: folds, zipper tapes, ribbed hem, pockets, glowing Ω (chest + back)
    bodyOld.push(hood, yoke, hem);

    // neck + head
    bodyOld.push(add(chest, part(Cy(0.042, 0.05, 0.1), M.skin, { ol: 0.005 }), 0, 0.17, 0));
    applyKit('kit_luby_choker', chest, { dark: M.dark, glow: M.glow }, [], { ol: 0.004, place: (m) => { m.position.y = -0.014; m.scale.set(0.96, 1, 0.96); } });
    const head = grp(chest, 'head', 0, 0.19, 0.005);
    head.scale.setScalar(1.12); // ~6.5 heads tall (was a chibi-ish 1.22)
    M.skinFace = toon(C.skin, { isFace: true });
    const skull = add(head, part(animeHead(S(0.12, 32, 24)), M.skinFace, { ol: 0.008 }), 0, 0.1, 0);
    skull.scale.set(1, 1.04, 0.98);
    const face = add(skull, new THREE.Mesh(animeHead(S(0.1206, 32, 20, Math.PI / 2 - 0.8, 1.6, Math.PI / 2 - 0.7, 1.3)), M.face));
    face.renderOrder = 2;
    this.faceMesh = face;
    // tiny nose
    add(skull, new THREE.Mesh(S(0.006, 6, 4), toon(0xf1b8a5)), 0, -0.012, 0.12);

    // hair
    const backHair = add(head, part(S(0.128, 22, 16), M.hair, { ol: 0.007 }), 0, 0.105, -0.022);
    backHair.scale.set(1.04, 1.02, 1.02);
    const backLong = add(head, part(S(0.11, 16, 12), M.hair, { ol: 0.007 }), 0, 0.02, -0.06);
    backLong.scale.set(1.05, 1.1, 0.7);
    const bang = (x, y, z, rz, len, mat) => {
      const b = add(head, part(new THREE.ConeGeometry(0.03, len, 5), mat, { ol: 0.005 }), x, y, z);
      b.rotation.set(0.35, 0, Math.PI + rz);
      return b;
    };
    const hairOld = [backHair, backLong];
    hairOld.push(bang(-0.072, 0.135, 0.09, 0.25, 0.09, M.hair));
    hairOld.push(bang(-0.034, 0.142, 0.104, 0.1, 0.1, M.hairLime));
    hairOld.push(bang(0.0, 0.145, 0.108, 0.0, 0.085, M.hair));
    hairOld.push(bang(0.036, 0.142, 0.104, -0.12, 0.1, M.hair));
    hairOld.push(bang(0.072, 0.135, 0.09, -0.28, 0.085, M.hair));
    for (const s of [-1, 1]) { // side locks framing the face
      const l = add(head, part(new THREE.ConeGeometry(0.028, 0.17, 5), s < 0 ? M.hairLime : M.hair, { ol: 0.005 }), s * 0.108, 0.04, 0.045);
      l.rotation.set(0.1, 0, Math.PI + s * 0.12);
      hairOld.push(l);
    }
    // same skull as the heroes -> the shared Blender hair kit fits (lime streak on the 3rd bang)
    applyKit('kit_b_hair', head, { hair: M.hair, hair2: M.hairLime } /* back locks hidden: the hood covers them */, hairOld, { ol: 0.006, crease: 1.2 });

    // ---------- cat hood ----------
    const hoodG = grp(head, 'hood', 0, 0.112, -0.012);
    const R = 0.152;
    const cap = add(hoodG, part(S(R, 30, 12, 0, Math.PI * 2, 0, 1.12), M.lime, { ol: 0.009 }));
    cap.material = M.lime;
    const sides = add(hoodG, part(S(R, 30, 12, Math.PI / 2 + 0.82, Math.PI * 2 - 1.64, 1.1, 1.05), toon(C.lime, { side: THREE.DoubleSide }), { ol: 0.009 }));
    const hoodOld = [cap, sides];
    // hood rim around the face
    const rim = add(hoodG, part(new THREE.TorusGeometry(0.12, 0.016, 8, 24, Math.PI * 1.25), M.limeDark, { ol: 0.004 }), 0, -0.015, 0.088);
    rim.rotation.z = -Math.PI * 0.125 + Math.PI * 0.0; rim.rotation.x = -0.2;
    rim.rotation.z = Math.PI * -0.125;
    // mecha eyes on the hood
    const sph = (theta, phi, r = R) => new THREE.Vector3(-r * Math.cos(phi) * Math.sin(theta), r * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta));
    for (const s of [-1, 1]) {
      const p = sph(0.62, Math.PI / 2 + s * 0.45, R + 0.002);
      const n = p.clone().normalize();
      const eg = add(hoodG, new THREE.Group(), p.x, p.y, p.z);
      eg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
      add(eg, new THREE.Mesh(new THREE.CircleGeometry(0.04, 20), M.dark));
      const iris = add(eg, new THREE.Mesh(new THREE.CircleGeometry(0.031, 20), M.eyeYellow), 0, 0, 0.002);
      void iris;
      const pupil = add(eg, new THREE.Mesh(new THREE.CircleGeometry(0.009, 10), M.dark), 0, 0, 0.004);
      pupil.scale.set(0.8, 2.4, 1);
      add(eg, new THREE.Mesh(new THREE.CircleGeometry(0.007, 8), M.white), -0.012, 0.012, 0.005);
    }
    const hnose = add(hoodG, new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.012, 3), M.dark), 0, 0.105, 0.11);
    hnose.rotation.x = Math.PI / 2 + 0.6;
    // ears
    for (const s of [-1, 1]) {
      const ear = add(hoodG, part(new THREE.ConeGeometry(0.06, 0.12, 4), M.lime, { ol: 0.007 }), s * 0.095, 0.135, -0.01);
      ear.rotation.set(-0.1, Math.PI / 4, -s * 0.38);
      const inner = add(hoodG, new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.075, 4), M.limeDeep), s * 0.097, 0.13, 0.02);
      inner.rotation.set(-0.1, Math.PI / 4, -s * 0.38);
      // mecha bolt
      const bolt = add(hoodG, part(new THREE.CylinderGeometry(0.012, 0.012, 0.01, 8), M.white, { ol: 0.003 }), s * 0.06, 0.135, 0.06); bolt.rotation.x = 0.8;
      hoodOld.push(ear, inner, bolt);
    }
    applyKit('kit_luby_hood', hoodG, { lime: M.lime, limeDeep: M.limeDeep, white: M.white }, hoodOld, { ol: 0.008 });
    // panel on top of hood
    const panel = add(hoodG, part(new THREE.BoxGeometry(0.05, 0.012, 0.04), M.dark, { ol: 0.003 }), 0, 0.152, -0.02);
    void panel;
    add(hoodG, new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.014, 0.008), M.glow), 0, 0.153, -0.002);

    // ---------- arms ----------
    for (const s of [-1, 1]) {
      const k = s > 0 ? 'L' : 'R';
      const arm = grp(chest, 'arm' + k, s * 0.155, 0.09, -0.01);
      const ua = add(arm, part(Cy(0.058, 0.062, 0.25), M.lime, { ol: 0.008 }), 0, -0.11, 0);
      const shd = add(arm, part(S(0.065, 14, 10), M.lime, { ol: 0.008 }), 0, 0, 0);
      bodyOld.push(ua, shd);
      const elbow = grp(arm, 'elbow' + k, 0, -0.235, 0);
      const eb = add(elbow, part(S(0.062, 14, 10), M.lime, { ol: 0.007 }));
      const fa = add(elbow, part(Cy(0.064, 0.08, 0.2), M.lime, { ol: 0.008 }), 0, -0.1, 0);
      const cf = add(elbow, part(Cy(0.07, 0.07, 0.04), M.limeDark, { ol: 0.005 }), 0, -0.2, 0);
      bodyOld.push(eb, fa, cf);
      const hand = grp(elbow, 'hand' + k, 0, -0.235, 0);
      const paw = add(hand, part(S(0.078, 18, 14), M.lime, { ol: 0.009 }), 0, -0.02, 0);
      hand.scale.setScalar(0.88);
      paw.scale.set(1, 0.95, 0.9);
      const pad = add(hand, new THREE.Mesh(S(0.034, 14, 10), M.glow), 0, -0.025, 0.06);
      pad.scale.set(1.1, 0.95, 0.45);
      for (let i = 0; i < 4; i++) {
        const a = (i - 1.5) * 0.42;
        const bx = Math.sin(a) * 0.055, bz = Math.cos(a) * 0.035 + 0.02;
        const bean = add(hand, part(S(0.022, 10, 8), M.lime, { ol: 0.004 }), bx, -0.085, bz);
        void bean;
        add(hand, new THREE.Mesh(S(0.012, 8, 6), M.glow), bx, -0.09, bz + 0.015);
        const claw = add(hand, part(new THREE.ConeGeometry(0.008, 0.035, 6), M.white, { ol: 0.003 }), bx, -0.105, bz + 0.012);
        claw.rotation.x = Math.PI - 0.5;
      }
      applyKit('kit_luby_paw', hand, { lime: M.lime, glow: M.glow, white: M.white }, [...hand.children], { ol: 0.007 });
    }

    // ---------- legs ----------
    for (const s of [-1, 1]) {
      const k = s > 0 ? 'L' : 'R';
      const leg = grp(hips, 'leg' + k, s * 0.082, -0.05, 0);
      bodyOld.push(add(leg, part(Cy(0.078, 0.072, 0.08), M.skin, { ol: 0.007 }), 0, -0.04, 0));
      const thighOld = add(leg, part(Cy(0.073, 0.056, 0.3), M.stocking, { ol: 0.007 }), 0, -0.23, 0);
      const knee = grp(leg, 'knee' + k, 0, -0.4, 0);
      const kneeOld = add(knee, part(S(0.056, 12, 10), M.stocking, { ol: 0.006 }));
      const shinOld = add(knee, part(Cy(0.055, 0.04, 0.34), M.stocking, { ol: 0.007 }), 0, -0.17, 0);
      // Blender thigh-highs: band with glowing Ω + circuit traces (knee cap rides on the thigh kit)
      bodyOld.push(thighOld, kneeOld, shinOld);
      const foot = grp(knee, 'foot' + k, 0, -0.39, 0);
      const shoe = add(foot, part(S(0.1, 16, 12), M.lime, { ol: 0.008 }), 0, -0.02, 0.045);
      shoe.scale.set(0.62, 0.52, 1.28);
      const sole = add(foot, part(new THREE.BoxGeometry(0.12, 0.025, 0.24), M.white, { ol: 0.005 }), 0, -0.055, 0.045);
      const strap = add(foot, new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.012, 0.03), M.dark), 0, 0.0, 0.11); strap.rotation.x = -0.6;
      const cuff = add(foot, part(Cy(0.058, 0.06, 0.05), M.limeDark, { ol: 0.005 }), 0, 0.01, 0);
      applyKit('kit_luby_shoe', foot, { lime: M.lime, white: M.white, dark: M.dark, limeDark: M.limeDark }, [shoe, sole, strap, cuff], { ol: 0.007 });
    }

    this.root.traverse((o) => { if (o.isMesh && !o.userData.isOutline) o.castShadow = true; });
    // one continuous skinned body (skin, open hoodie + sleeves, bikini, thigh-highs) bound to these joints
    this._skin = () => applySkinned('luby_body_skinned', this, {
      skin: M.skin, stock: M.stockK, lime: M.lime, limeDark: M.limeDark, limeDeep: M.limeDeep, dark: M.dark, white: M.white, glow: M.glow,
    }, bodyOld, { ol: 0.0045 });
  }
}
