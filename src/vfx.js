// Lightweight VFX: claw slashes, shockwaves, particles, ground telegraphs.
import * as THREE from 'three';
import { boostGlow } from './graphics.js';
import { loadGeometry } from './assets.js';

// Blender-made effect meshes (blender/build_props.py build_vfx); primitives are the fallback until they load
const FX = ['slash', 'shock', 'pillar', 'flash', 'ice_shard', 'blade', 'tentacle', 'rune_ring'];

export class VFX {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.geo = {};
    for (const n of FX) loadGeometry('vfx_' + n).then((g) => { if (g) { g.userData.shared = true; this.geo[n] = g; } });
    const push = this.items.push.bind(this.items);
    this.items.push = (it) => { boostGlow(it.obj, 2.2); return push(it); };
    // particle pool (single Points draw call)
    this.MAX = 900;
    this.pPos = new Float32Array(this.MAX * 3);
    this.pCol = new Float32Array(this.MAX * 3);
    this.pVel = new Float32Array(this.MAX * 3);
    this.pLife = new Float32Array(this.MAX);
    this.pMax = new Float32Array(this.MAX);
    this.pGrav = new Float32Array(this.MAX);
    this.pIdx = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.pCol, 3));
    this.points = new THREE.Points(g, new THREE.PointsMaterial({
      size: 0.22, vertexColors: true, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, map: dotTexture(),
    }));
    this.points.frustumCulled = false;
    this.points.material.color.setScalar(2.2);
    scene.add(this.points);
    for (let i = 0; i < this.MAX; i++) this.pPos[i * 3 + 1] = -9999;
  }

  particles(pos, n, color, { speed = 4, up = 2, life = 0.6, grav = 6, spread = 1 } = {}) {
    const c = new THREE.Color(color);
    for (let k = 0; k < n; k++) {
      const i = this.pIdx = (this.pIdx + 1) % this.MAX;
      this.pPos[i * 3] = pos.x + (Math.random() - 0.5) * 0.3 * spread;
      this.pPos[i * 3 + 1] = pos.y + (Math.random() - 0.5) * 0.3 * spread;
      this.pPos[i * 3 + 2] = pos.z + (Math.random() - 0.5) * 0.3 * spread;
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.6);
      this.pVel[i * 3] = Math.cos(a) * s; this.pVel[i * 3 + 1] = up * (0.5 + Math.random()); this.pVel[i * 3 + 2] = Math.sin(a) * s;
      this.pCol[i * 3] = c.r; this.pCol[i * 3 + 1] = c.g; this.pCol[i * 3 + 2] = c.b;
      this.pLife[i] = this.pMax[i] = life * (0.6 + Math.random() * 0.6);
      this.pGrav[i] = grav;
    }
  }

  /** crescent claw slash in front of the attacker */
  slash(pos, yaw, { color = 0xc8ff6a, size = 1.6, tilt = 0.5, mirror = false, life = 0.22 } = {}) {
    const fx = this.geo.slash;
    const geo = fx || new THREE.RingGeometry(size * 0.45, size, 28, 1, -1.2, 2.4);
    const mats = [];
    const grp = new THREE.Group();
    for (let k = 0; k < 3; k++) { // three claw marks
      const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, vertexColors: !!fx });
      if (fx) m.color.multiplyScalar(k === 1 ? 1.6 : 1.1);
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.z = (k - 1) * 0.12;
      mesh.scale.setScalar((fx ? size : 1) * (1 - Math.abs(k - 1) * 0.12));
      grp.add(mesh); mats.push(m);
    }
    const holder = new THREE.Group();
    holder.add(grp);
    grp.rotation.set(Math.PI / 2 + (mirror ? -tilt : tilt), 0, Math.PI / 2);
    holder.position.copy(pos);
    holder.rotation.y = yaw;
    this.scene.add(holder);
    this.items.push({ obj: holder, t: 0, life, update: (it, k) => { grp.rotation.z = Math.PI / 2 + (mirror ? -1 : 1) * (k * 1.4 - 0.7); mats.forEach((m) => (m.opacity = 0.85 * (1 - k))); holder.scale.setScalar(0.85 + k * 0.4); } });
  }

  shockwave(pos, radius = 3, color = 0xb8ff4a, life = 0.45) {
    const fx = this.geo.shock;
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, vertexColors: !!fx });
    if (fx) m.color.multiplyScalar(1.5);
    const ring = new THREE.Mesh(fx || new THREE.RingGeometry(0.85, 1, 40), m);
    ring.rotation.z = Math.random() * 6.28;
    ring.rotation.x = -Math.PI / 2; ring.position.copy(pos); ring.position.y += 0.15;
    this.scene.add(ring);
    this.items.push({ obj: ring, t: 0, life, update: (it, k) => { ring.scale.setScalar(0.3 + radius * Math.sqrt(k)); m.opacity = 0.9 * (1 - k); } });
  }

  pillar(pos, color = 0xb8ff4a, h = 6, life = 0.6) {
    const fx = this.geo.pillar;
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: fx ? 0.9 : 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, vertexColors: !!fx });
    const c = new THREE.Mesh(fx || new THREE.CylinderGeometry(0.6, 1.2, h, 16, 1, true), m);
    c.position.copy(pos);
    if (fx) c.scale.y = h; else c.position.y += h / 2;
    const o0 = m.opacity;
    this.scene.add(c);
    this.items.push({ obj: c, t: 0, life, update: (it, k) => { m.opacity = o0 * (1 - k); c.scale.set(1 + k, fx ? h * (0.7 + 0.3 * Math.min(1, k * 5)) : 1, 1 + k); if (fx) c.rotation.y = k * 2.5; } });
  }

  /** ground warning circle (enemy attacks). returns handle with .done */
  telegraph(pos, radius, dur, color = 0xff3355) {
    const grp = new THREE.Group();
    const fillM = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide });
    const rune = this.geo.rune_ring;
    const edgeM = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide, vertexColors: !!rune });
    const fill = new THREE.Mesh(new THREE.CircleGeometry(1, 40), fillM);
    const edge = new THREE.Mesh(rune || new THREE.RingGeometry(0.95, 1, 48), edgeM);
    fill.rotation.x = edge.rotation.x = -Math.PI / 2;
    grp.add(fill, edge);
    grp.position.copy(pos); grp.position.y += 0.12;
    edge.scale.setScalar(radius);
    this.scene.add(grp);
    const h = { obj: grp, t: 0, life: dur, update: (it, k) => { fill.scale.setScalar(radius * k); fillM.opacity = 0.18 + 0.25 * k; if (rune) edge.rotation.z = it.t * 0.8; } };
    this.items.push(h);
    return h;
  }

  /** Mora's lingering clock face on the ground (time-slow zone) */
  clockRing(pos, radius, life) {
    const grp = new THREE.Group();
    const mk = (geo, op) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xf5c542, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; grp.add(m); return m; };
    mk(new THREE.RingGeometry(radius * 0.95, radius, 64), 0.8);
    mk(new THREE.RingGeometry(radius * 0.6, radius * 0.63, 48), 0.5);
    const ticks = [];
    for (let i = 0; i < 12; i++) {
      const tk = mk(new THREE.PlaneGeometry(0.12, i % 3 === 0 ? 0.7 : 0.4), 0.7);
      const a = (i / 12) * Math.PI * 2;
      tk.position.set(Math.cos(a) * radius * 0.82, 0, Math.sin(a) * radius * 0.82);
      tk.rotation.z = -a + Math.PI / 2;
      ticks.push(tk);
    }
    const hand = mk(new THREE.PlaneGeometry(0.14, radius * 0.75), 0.9);
    hand.geometry.translate(0, radius * 0.37, 0);
    grp.position.copy(pos); grp.position.y += 0.15;
    this.scene.add(grp);
    this.items.push({ obj: grp, t: 0, life, update: (it, k) => {
      hand.rotation.z = -it.t * 3;
      grp.rotation.y = it.t * 0.3;
      const fade = k > 0.85 ? (1 - k) / 0.15 : Math.min(1, it.t * 5);
      grp.children.forEach((c) => (c.material.opacity = 0.75 * fade));
    } });
  }

  /** straight energy beam (railgun, orbital strikes) */
  beamLine(from, to, color = 0xc07aff, width = 0.3, life = 0.4) {
    const len = from.distanceTo(to);
    const grp = new THREE.Group();
    const core = new THREE.Mesh(new THREE.CylinderGeometry(width * 0.35, width * 0.35, len, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    const glow = new THREE.Mesh(new THREE.CylinderGeometry(width, width, len, 10, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    grp.add(core, glow);
    grp.position.copy(from).lerp(to, 0.5);
    grp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
    this.scene.add(grp);
    this.items.push({ obj: grp, t: 0, life, update: (it, k) => { const w = 1 - k; grp.scale.set(w, 1, w); glow.material.opacity = 0.7 * w; core.material.opacity = w; } });
    for (let i = 0; i < 6; i++) this.particles(from.clone().lerp(to, Math.random()), 2, color, { speed: 3, up: 1, life: 0.4 });
  }

  /** Micca's giant mimic chest chomping */
  mimic(pos, life) {
    const grp = new THREE.Group();
    const wood = new THREE.MeshToonMaterial({ color: 0x7a3a24 }), gold = new THREE.MeshToonMaterial({ color: 0xf0c35a }), mouth = new THREE.MeshBasicMaterial({ color: 0x3a0010 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.6, 2.4), wood); base.position.y = 0.8; grp.add(base);
    const inner = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.1, 2.1), mouth); inner.position.y = 1.62; grp.add(inner);
    const lid = new THREE.Group(); lid.position.set(0, 1.6, -1.2); grp.add(lid);
    const lm = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.5, 2.5), wood); lm.position.set(0, 0.25, 1.2); lid.add(lm);
    for (let k = -3; k <= 3; k++) {
      const tb = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.4, 4), new THREE.MeshToonMaterial({ color: 0xf8f0e0 })); tb.position.set(k * 0.42, 1.75, 1.1); grp.add(tb);
      const tt = tb.clone(); tt.rotation.x = Math.PI; tt.position.set(k * 0.42 + 0.2, -0.15, 2.3); lid.add(tt);
    }
    for (const x of [-1.3, 1.3]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.7, 2.5), gold); b.position.set(x, 0.85, 0); grp.add(b); }
    for (const x of [-0.6, 0.6]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff3a5a).multiplyScalar(2.5) })); e.position.set(x, 0.75, 2.45); lid.add(e); }
    grp.position.copy(pos);
    this.scene.add(grp);
    this.items.push({ obj: grp, t: 0, life, update: (it, k) => {
      const appear = Math.min(1, k * 6), vanish = k > 0.85 ? (1 - k) / 0.15 : 1;
      grp.scale.setScalar(appear * vanish * 1.1);
      lid.rotation.x = -Math.abs(Math.sin(it.t * 8.5)) * 1.2;
    } });
    return grp;
  }

  /** heavy hit feedback: flash burst + flying sparks + thin ring */
  impact(pos, color = '#ffffff', big = false) {
    const c = new THREE.Color(color);
    const star = this.geo.flash;
    const flash = new THREE.Mesh(star || new THREE.SphereGeometry(big ? 0.55 : 0.35, 10, 8), new THREE.MeshBasicMaterial({ color: c.clone().lerp(new THREE.Color(1, 1, 1), 0.6).multiplyScalar(3), transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, vertexColors: !!star }));
    flash.position.copy(pos);
    const s0 = star ? (big ? 1.1 : 0.7) : 1;
    if (star) flash.rotation.set(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28);
    this.scene.add(flash);
    this.items.push({ obj: flash, t: 0, life: star ? 0.18 : 0.14, update: (it, k) => { flash.scale.setScalar(s0 * (star ? 0.6 + Math.sin(Math.min(1, k * 1.6) * Math.PI) * 0.9 : 1 + k * 2.2)); flash.material.opacity = 1 - k; } });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 24), new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(2.5), transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    ring.position.copy(pos); ring.lookAt(pos.clone().add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)));
    this.scene.add(ring);
    this.items.push({ obj: ring, t: 0, life: 0.22, update: (it, k) => { ring.scale.setScalar(0.3 + k * (big ? 2.4 : 1.5)); ring.material.opacity = 0.9 * (1 - k); } });
    this.particles(pos, big ? 18 : 9, c.clone().lerp(new THREE.Color(1, 1, 1), 0.3), { speed: big ? 12 : 8, up: 3, life: 0.28, grav: 10 });
  }

  /** ice spike erupting from the ground */
  iceSpike(pos, scale = 1) {
    const grp = new THREE.Group();
    const mat = new THREE.MeshToonMaterial({ color: 0xbff0ff, emissive: 0x2a6a9a, transparent: true, opacity: 0.95, vertexColors: !!this.geo.ice_shard, flatShading: !!this.geo.ice_shard });
    for (let k = 0; k < 5; k++) {
      let c;
      if (this.geo.ice_shard) {
        c = new THREE.Mesh(this.geo.ice_shard, mat);
        c.scale.set(0.35 * scale, (2.4 - k * 0.3) * scale, 0.35 * scale);
      } else {
        c = new THREE.Mesh(new THREE.ConeGeometry(0.35 * scale, (2.4 - k * 0.3) * scale, 5), mat);
        c.geometry.translate(0, 1.2 * scale, 0);
      }
      const a = k * 1.3;
      c.position.set(k ? Math.cos(a) * 0.6 * scale : 0, 0, k ? Math.sin(a) * 0.6 * scale : 0);
      c.rotation.set(k ? Math.sin(a) * 0.4 : 0, k * 0.9, k ? -Math.cos(a) * 0.4 : 0);
      grp.add(c);
    }
    grp.position.copy(pos);
    this.scene.add(grp);
    this.particles(pos.clone().setY(pos.y + 0.5), 14, 0xe8fbff, { speed: 4, up: 3, life: 0.5 });
    this.items.push({ obj: grp, t: 0, life: 0.9, update: (it, k) => { const u = k < 0.15 ? k / 0.15 : 1; grp.scale.set(1, Math.max(0.01, u), 1); mat.opacity = k > 0.7 ? (1 - k) / 0.3 : 0.95; } });
  }

  /** Eropatra's burst: a fire serpent circling the caster */
  serpent(pos, radius, life, cols = [0xff6a1a, 0xffa040, 0xffe08a]) {
    const grp = new THREE.Group();
    const segs = [];
    for (let i = 0; i < 18; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.55 - i * 0.022, 10, 8), new THREE.MeshBasicMaterial({ color: i === 0 ? cols[2] : cols[i % 2], transparent: true, opacity: 0.9 }));
      grp.add(m); segs.push(m);
    }
    for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), new THREE.MeshBasicMaterial({ color: 0x220800 })); e.position.set(sx * 0.25, 0.25, 0.35); segs[0].add(e); }
    grp.position.copy(pos);
    this.scene.add(grp);
    this.items.push({ obj: grp, t: 0, life, update: (it, k) => {
      segs.forEach((m, i) => {
        const a = it.t * 4.2 - i * 0.22;
        m.position.set(Math.cos(a) * radius, 1.2 + Math.sin(it.t * 6 - i * 0.5) * 0.5, Math.sin(a) * radius);
        m.material.opacity = 0.9 * (k > 0.85 ? (1 - k) / 0.15 : 1);
      });
      if (Math.random() < 0.6) this.particles(grp.position.clone().add(segs[0].position), 2, cols[1], { speed: 1, up: 1, life: 0.4 });
    } });
    return grp;
  }

  /** Scylla's abyss tentacle bursting out of the ground */
  tentacle(pos) {
    const fx = this.geo.tentacle;
    const m = new THREE.Mesh(fx || new THREE.ConeGeometry(0.35, 3.2, 8, 4), new THREE.MeshToonMaterial({ color: fx ? 0x5a2a86 : 0x3a1a5a, emissive: 0x2a0a4a, vertexColors: !!fx }));
    if (!fx) m.geometry.translate(0, 1.6, 0);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0xb07aff }));
    if (fx) tip.position.set(0.136, 3.05, -0.115); else tip.position.y = 3.0;
    m.add(tip);
    m.position.copy(pos); m.rotation.set((Math.random() - 0.5) * 0.6, Math.random() * 6, (Math.random() - 0.5) * 0.6);
    this.scene.add(m);
    this.shockwave(pos, 1.4, 0x9a5cff, 0.3);
    this.items.push({ obj: m, t: 0, life: 0.55, update: (it, k) => { const up = k < 0.35 ? k / 0.35 : 1 - (k - 0.35) / 0.65; m.scale.set(1, Math.max(0.01, up), 1); } });
  }

  orb(color = 0xd070ff, r = 0.35) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), new THREE.MeshBasicMaterial({ color }));
    const halo = new THREE.Mesh(new THREE.SphereGeometry(r * 1.8, 12, 10), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.add(halo);
    boostGlow(m, 2.2);
    this.scene.add(m);
    return m;
  }

  /** a sword that drops from the sky, sticks in the ground and fades (Kali) */
  fallingBlade(pos, { color = 0xe8f0ff, delay = 0, size = 1, life = 1.1 } = {}) {
    const g = new THREE.Group();
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false });
    const bl = new THREE.Mesh(new THREE.BoxGeometry(0.09 * size, 1.5 * size, 0.03 * size), m);
    bl.position.y = 0.75 * size;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.4 * size, 0.07 * size, 0.08 * size), m);
    guard.position.y = 1.5 * size;
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07 * size, 0.38 * size, 0.07 * size), m);
    grip.position.y = 1.72 * size;
    if (this.geo.blade) {
      m.vertexColors = true;
      const sw = new THREE.Mesh(this.geo.blade, m);
      sw.scale.setScalar(size);
      g.add(sw);
    } else g.add(bl, guard, grip);
    g.rotation.set((Math.random() - 0.5) * 0.35, Math.random() * Math.PI, (Math.random() - 0.5) * 0.35);
    g.visible = false;
    this.scene.add(g);
    const fall = 0.16, total = delay + life;
    let landed = false;
    this.items.push({ obj: g, t: 0, life: total, update: (it) => {
      const t = it.t - delay;
      if (t < 0) return;
      g.visible = true;
      const f = Math.min(1, t / fall);
      g.position.set(pos.x, pos.y - 0.45 * size + (1 - f) * 9, pos.z);
      if (f >= 1 && !landed) {
        landed = true;
        this.particles(pos.clone().setY(pos.y + 0.2), 8, color, { speed: 3, up: 2, life: 0.35 });
      }
      m.opacity = 0.95 * (1 - Math.max(0, (t - fall) / (life - fall)) ** 2);
    } });
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.t += dt;
      const k = Math.min(1, it.t / it.life);
      it.update(it, k);
      if (k >= 1 || it.done) {
        this.scene.remove(it.obj);
        it.obj.traverse((o) => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); if (o.material) o.material.dispose(); });
        this.items.splice(i, 1);
      }
    }
    for (let i = 0; i < this.MAX; i++) {
      if (this.pLife[i] <= 0) continue;
      this.pLife[i] -= dt;
      if (this.pLife[i] <= 0) { this.pPos[i * 3 + 1] = -9999; continue; }
      this.pVel[i * 3 + 1] -= this.pGrav[i] * dt;
      this.pPos[i * 3] += this.pVel[i * 3] * dt;
      this.pPos[i * 3 + 1] += this.pVel[i * 3 + 1] * dt;
      this.pPos[i * 3 + 2] += this.pVel[i * 3 + 2] * dt;
      const f = this.pLife[i] / this.pMax[i];
      this.pCol[i * 3] *= 0.985 + f * 0.015; this.pCol[i * 3 + 1] *= 0.985 + f * 0.015; this.pCol[i * 3 + 2] *= 0.985 + f * 0.015;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}

function dotTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}
