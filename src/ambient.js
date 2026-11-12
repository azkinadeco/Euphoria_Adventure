// Ambient life: butterflies, fireflies, birds, falling leaves, jumping fish.
// Everything lives in a bubble around the player, so the cost stays constant.
import * as THREE from 'three';
import { RLOC } from './reef.js';

export class Ambient {
  constructor(game) {
    this.g = game;
    const S = game.scene;
    this.t = 0;
    this.k = 1;

    // ---------- butterflies ----------
    const wingGeo = new THREE.PlaneGeometry(0.22, 0.16); wingGeo.translate(0.11, 0, 0);
    const cols = [0xffd34d, 0xff8fc8, 0x8fd0ff, 0xffffff, 0xb48fff];
    this.butterflies = [];
    for (let i = 0; i < 26; i++) {
      const b = new THREE.Group();
      const m = new THREE.MeshBasicMaterial({ color: cols[i % cols.length], side: THREE.DoubleSide, map: this.wingTex || (this.wingTex = wingTex()), alphaTest: 0.5 });
      m.userData.noGlow = true;
      const L = new THREE.Mesh(wingGeo, m), R = new THREE.Mesh(wingGeo, m);
      R.scale.x = -1; b.add(L, R);
      b.userData = { L, R, ph: Math.random() * 10, home: new THREE.Vector3(), vel: new THREE.Vector3(), t: 0 };
      b.visible = false;
      S.add(b); this.butterflies.push(b);
    }

    // ---------- fireflies (night) ----------
    const N = 220, fp = new Float32Array(N * 3);
    this.ffData = [];
    for (let i = 0; i < N; i++) this.ffData.push({ o: new THREE.Vector3((Math.random() - 0.5) * 60, 0.5 + Math.random() * 3, (Math.random() - 0.5) * 60), ph: Math.random() * 10 });
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(fp, 3));
    this.fireflies = new THREE.Points(fg, new THREE.PointsMaterial({ color: new THREE.Color(0xd8ff7a).multiplyScalar(3), size: 0.22, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, map: dot() }));
    this.fireflies.frustumCulled = false;
    S.add(this.fireflies);

    // ---------- falling leaves ----------
    const LN = 90, lp = new Float32Array(LN * 3);
    this.leafData = [];
    for (let i = 0; i < LN; i++) this.leafData.push({ x: (Math.random() - 0.5) * 50, y: Math.random() * 12, z: (Math.random() - 0.5) * 50, s: 0.5 + Math.random() });
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(lp, 3));
    this.leaves = new THREE.Points(lg, new THREE.PointsMaterial({ color: 0x9fd65a, size: 0.16, transparent: true, depthWrite: false, map: leafTex() }));
    this.leaves.frustumCulled = false;
    S.add(this.leaves);

    // ---------- birds ----------
    this.birds = [];
    const birdM = new THREE.MeshBasicMaterial({ color: 0x2a2a33, side: THREE.DoubleSide }); birdM.userData.noGlow = true;
    const bw = new THREE.PlaneGeometry(0.9, 0.25); bw.translate(0.45, 0, 0);
    for (let f = 0; f < 3; f++) {
      const flock = { c: new THREE.Vector3([0, 440, -40][f], 0, [0, 30, -470][f]), r: 60 + f * 15, h: 45 + f * 10, sp: 0.12 + f * 0.03, list: [] };
      for (let i = 0; i < 7; i++) {
        const b = new THREE.Group();
        const L = new THREE.Mesh(bw, birdM), R = new THREE.Mesh(bw, birdM); R.scale.x = -1; b.add(L, R);
        b.userData = { L, R, off: new THREE.Vector3((i % 3 - 1) * 3, (i % 2) * 1.5, Math.floor(i / 3) * 3), ph: Math.random() * 6 };
        S.add(b); flock.list.push(b);
      }
      this.birds.push(flock);
    }

    // ---------- jumping fish (lagoon) ----------
    const fishM = new THREE.MeshToonMaterial({ color: 0xffa04a });
    this.fish = [];
    for (let i = 0; i < 5; i++) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 6), fishM);
      f.rotation.z = Math.PI / 2; f.visible = false; S.add(f);
      this.fish.push({ m: f, t: 99, from: new THREE.Vector3(), dir: new THREE.Vector3() });
    }
  }

  setDensity(k) { this.k = k; }

  update(dt) {
    const G = this.g, W = G.world, P = G.player.pos;
    this.t += dt;
    const t = this.t, night = W.nightAmt;
    const onMain = P.x * P.x + P.z * P.z < 200 * 200;
    const inReef = Math.hypot(P.x - 440, P.z - 30) < 150;
    const cold = G.coldAt ? G.coldAt(P.x, P.z) > 0.3 : false;
    const hot = G.heatAt ? G.heatAt(P.x, P.z) > 0.3 : false;

    // butterflies: daytime, warm green regions
    const bOn = (onMain || inReef) && night < 0.5 && this.k > 0.3;
    const nB = Math.floor(this.butterflies.length * Math.min(1, this.k));
    this.butterflies.forEach((b, i) => {
      const u = b.userData;
      b.visible = bOn && i < nB;
      if (!b.visible) { u.t = 0; return; }
      if (u.t <= 0 || b.position.distanceTo(P) > 30) {
        const a = Math.random() * Math.PI * 2, r = 6 + Math.random() * 18;
        u.home.set(P.x + Math.cos(a) * r, 0, P.z + Math.sin(a) * r);
        u.home.y = Math.max(W.fastHeight(u.home.x, u.home.z), 0.2) + 0.6 + Math.random();
        b.position.copy(u.home); u.t = 6 + Math.random() * 8;
      }
      u.t -= dt;
      const tgt = u.home.clone().add(new THREE.Vector3(Math.sin(t * 0.7 + u.ph) * 2.5, Math.sin(t * 1.9 + u.ph) * 0.5, Math.cos(t * 0.9 + u.ph) * 2.5));
      const d = tgt.sub(b.position);
      b.position.addScaledVector(d, Math.min(1, dt * 1.5));
      b.rotation.y = Math.atan2(d.x, d.z);
      const fl = Math.sin(t * 22 + u.ph) * 1.1;
      u.L.rotation.y = fl; u.R.rotation.y = -fl;
    });

    // fireflies at night around the player (not in snow / lava)
    const fOn = night > 0.35 && !cold && !hot;
    this.fireflies.visible = fOn;
    if (fOn) {
      const a = this.fireflies.geometry.attributes.position;
      const n = Math.floor(this.ffData.length * Math.min(1, this.k));
      for (let i = 0; i < this.ffData.length; i++) {
        const f = this.ffData[i];
        if (i >= n) { a.setXYZ(i, 0, -999, 0); continue; }
        const x = P.x + f.o.x + Math.sin(t * 0.5 + f.ph) * 2, z = P.z + f.o.z + Math.cos(t * 0.4 + f.ph) * 2;
        const gy = Math.max(W.fastHeight(x, z), 0);
        a.setXYZ(i, x, gy + f.o.y + Math.sin(t * 1.3 + f.ph) * 0.5, z);
        if ((x - P.x) ** 2 + (z - P.z) ** 2 > 900) f.o.set((Math.random() - 0.5) * 50, 0.5 + Math.random() * 3, (Math.random() - 0.5) * 50);
      }
      a.needsUpdate = true;
      this.fireflies.material.opacity = Math.min(1, (night - 0.35) * 3) * (0.6 + 0.4 * Math.sin(t * 3));
    }

    // leaves drifting down near trees on the main island
    this.leaves.visible = onMain && this.k > 0.3;
    if (this.leaves.visible) {
      const a = this.leaves.geometry.attributes.position;
      for (let i = 0; i < this.leafData.length; i++) {
        const l = this.leafData[i];
        l.y -= dt * 0.8 * l.s; l.x += Math.sin(t * 1.5 + i) * dt * 0.8 + dt * 0.4; l.z += Math.cos(t * 1.2 + i) * dt * 0.5;
        if (l.y < 0) { l.y = 8 + Math.random() * 6; l.x = (Math.random() - 0.5) * 50; l.z = (Math.random() - 0.5) * 50; }
        a.setXYZ(i, P.x + l.x, W.fastHeight(P.x + l.x, P.z + l.z) + l.y, P.z + l.z);
      }
      a.needsUpdate = true;
    }

    // birds circling over each region, hidden at night
    for (const fl of this.birds) {
      const ang = t * fl.sp;
      const lead = new THREE.Vector3(fl.c.x + Math.cos(ang) * fl.r, fl.h + Math.sin(t * 0.3) * 4, fl.c.z + Math.sin(ang) * fl.r);
      const heading = Math.atan2(-Math.sin(ang), Math.cos(ang));
      for (const b of fl.list) {
        b.visible = night < 0.6;
        const o = b.userData.off.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), heading);
        b.position.copy(lead).add(o);
        b.rotation.y = heading;
        const fla = Math.sin(t * 9 + b.userData.ph) * 0.7;
        b.userData.L.rotation.z = fla; b.userData.R.rotation.z = -fla;
      }
    }

    // jumping fish in the reef lagoon
    for (const f of this.fish) {
      f.t += dt;
      if (f.t > 1.1) {
        f.m.visible = false;
        if (inReef && Math.random() < dt * 0.6) {
          const a = Math.random() * Math.PI * 2, r = 8 + Math.random() * 20;
          const x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r;
          if (W.fastHeight(x, z) < -0.6) { f.from.set(x, 0, z); f.dir.set(Math.cos(a + 1.5), 0, Math.sin(a + 1.5)); f.t = 0; f.m.visible = true; G.vfx.particles(f.from.clone().setY(0.1), 8, 0xe8fbff, { speed: 2, up: 3, life: 0.4 }); }
        }
        continue;
      }
      const k = f.t / 1.1;
      f.m.position.copy(f.from).addScaledVector(f.dir, k * 2.4);
      f.m.position.y = Math.sin(k * Math.PI) * 1.6 - 0.1;
      f.m.rotation.y = Math.atan2(f.dir.x, f.dir.z) + Math.PI / 2;
      f.m.rotation.z = Math.PI / 2 + (0.5 - k) * 2;
      if (f.t + dt > 1.1) G.vfx.particles(f.m.position.clone().setY(0.1), 8, 0xe8fbff, { speed: 2, up: 3, life: 0.4 });
    }
    void RLOC;
  }
}

function dot() {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}
function leafTex() {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(16, 16, 12, 6, 0.6, 0, Math.PI * 2); g.fill();
  return new THREE.CanvasTexture(c);
}

function wingTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.beginPath(); g.ellipse(26, 22, 24, 18, -0.4, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(22, 46, 16, 13, 0.5, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(40,30,30,0.9)';
  g.beginPath(); g.arc(30, 20, 5, 0, Math.PI * 2); g.fill();
  g.fillRect(0, 26, 6, 12);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
