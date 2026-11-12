// Purr-Bot (Luby's scrap-built mecha cat) + simple story NPC builder.
import * as THREE from 'three';
import { toon, part, damp } from './toon.js';

export class PurrBot {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.active = false;
    this.mode = 'follow'; // follow | storm
    this.vel = new THREE.Vector3();
    this.t = 0;
    this._build();
    this.root.visible = false;
    scene.add(this.root);
  }
  _build() {
    const metal = toon(0xc9d0d4, { flatShading: true }), lime = toon(0x8fe63a), dark = toon(0x2a2d33);
    const glow = new THREE.MeshBasicMaterial({ color: 0xd4ff4a });
    const body = this.body = new THREE.Group(); this.root.add(body);
    const torso = part(new THREE.SphereGeometry(0.26, 14, 10), metal, { ol: 0.02 }); torso.scale.set(1, 0.8, 1.35); torso.position.y = 0.42; body.add(torso);
    const stripe = part(new THREE.SphereGeometry(0.265, 14, 10, 0, Math.PI * 2, 1.1, 0.5), lime, { ol: 0 }); stripe.scale.set(1, 0.8, 1.35); stripe.position.y = 0.42; body.add(stripe);
    const head = this.head = new THREE.Group(); head.position.set(0, 0.68, 0.3); body.add(head);
    const skull = part(new THREE.SphereGeometry(0.22, 14, 10), metal, { ol: 0.02 }); skull.scale.set(1.15, 0.95, 1); head.add(skull);
    for (const s of [-1, 1]) {
      const ear = part(new THREE.ConeGeometry(0.08, 0.16, 4), lime, { ol: 0.015 }); ear.position.set(s * 0.13, 0.2, -0.02); ear.rotation.set(0, Math.PI / 4, -s * 0.3); head.add(ear);
      const eye = new THREE.Mesh(new THREE.CircleGeometry(0.055, 14), glow); eye.position.set(s * 0.085, 0.03, 0.212); head.add(eye);
      const pup = new THREE.Mesh(new THREE.PlaneGeometry(0.018, 0.07), new THREE.MeshBasicMaterial({ color: 0x111111 })); pup.position.set(s * 0.085, 0.03, 0.215); head.add(pup);
      const whisk = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.006, 0.006), dark); whisk.position.set(s * 0.2, -0.05, 0.16); whisk.rotation.z = s * 0.15; head.add(whisk);
    }
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.012, 0.01), dark); mouth.position.set(0, -0.07, 0.21); head.add(mouth);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16), dark); ant.position.set(0.05, 0.27, -0.05); ant.rotation.z = -0.3; head.add(ant);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), glow); bulb.position.set(0.075, 0.35, -0.05); head.add(bulb);
    this.legs = [];
    for (const [x, z] of [[-0.15, 0.2], [0.15, 0.2], [-0.15, -0.2], [0.15, -0.2]]) {
      const lg = new THREE.Group(); lg.position.set(x, 0.32, z); body.add(lg);
      const l = part(new THREE.CylinderGeometry(0.045, 0.04, 0.3, 6), dark, { ol: 0.01 }); l.position.y = -0.15; lg.add(l);
      const f = part(new THREE.SphereGeometry(0.06, 8, 6), lime, { ol: 0.01 }); f.position.y = -0.3; lg.add(f);
      this.legs.push(lg);
    }
    const tail = this.tail = new THREE.Group(); tail.position.set(0, 0.5, -0.33); body.add(tail);
    const tl = part(new THREE.CylinderGeometry(0.025, 0.035, 0.4, 6), metal, { ol: 0.01 }); tl.position.y = 0.2; tail.add(tl);
    const tt = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), glow); tt.position.y = 0.42; tail.add(tt);
    tail.rotation.x = -0.6;
    body.traverse((o) => { if (o.isMesh && !o.userData.isOutline) o.castShadow = true; });

    // storm vortex (burst)
    const vm = new THREE.MeshBasicMaterial({ color: 0xb8ff4a, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.vortex = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(1.2 + i * 0.9, 0.5 + i * 0.3, 2.2 + i * 1.1, 20, 1, true), vm.clone());
      c.position.y = 1 + i * 0.6; c.material.opacity = 0.32 - i * 0.05; this.vortex.add(c);
    }
    this.vortex.visible = false;
    this.root.add(this.vortex);
  }

  setActive(on, pos) { this.active = on; this.root.visible = on; if (on && pos) this.root.position.copy(pos); }

  startStorm(center, dur) { this.mode = 'storm'; this.stormT = dur; this.stormCenter = center.clone(); this.root.position.copy(center); this.vortex.visible = true; }

  update(dt, player, world) {
    if (!this.active) return;
    this.t += dt;
    const R = this.root;
    if (this.mode === 'storm') {
      this.stormT -= dt;
      R.position.lerp(this.stormCenter, 1 - Math.exp(-8 * dt));
      R.position.y = world.heightAt(R.position.x, R.position.z);
      this.body.rotation.y += dt * 22;
      this.body.position.y = 1.2 + Math.sin(this.t * 6) * 0.2;
      this.vortex.rotation.y -= dt * 9;
      this.vortex.children.forEach((c, i) => { c.scale.setScalar(1 + Math.sin(this.t * 10 + i) * 0.06); });
      if (this.stormT <= 0) { this.mode = 'follow'; this.vortex.visible = false; this.body.position.y = 0; this.body.rotation.set(0, 0, 0); }
      return;
    }
    // follow: stay behind-right of Luby, hop when moving
    const p = player.pos, f = player.facing;
    const target = new THREE.Vector3(p.x - Math.sin(f) * 1.4 + Math.cos(f) * 1.1, 0, p.z - Math.cos(f) * 1.4 - Math.sin(f) * 1.1);
    const d = Math.hypot(target.x - R.position.x, target.z - R.position.z);
    if (d > 25) R.position.copy(target);
    const sp = Math.min(d * 3, 13);
    if (d > 0.15) {
      const dir = new THREE.Vector3(target.x - R.position.x, 0, target.z - R.position.z).normalize();
      R.position.addScaledVector(dir, sp * dt);
      R.rotation.y = damp(R.rotation.y, Math.atan2(dir.x, dir.z), 10, dt);
    } else {
      R.rotation.y = damp(R.rotation.y, f, 4, dt);
    }
    world.collide(R.position, 0.3);
    let gy = world.groundAt(R.position.x, R.position.z); if (gy < -50) gy = player.pos.y;
    R.position.y = Math.max(gy, 0);
    const moving = sp > 0.6 && d > 0.3;
    const ph = this.t * 14;
    this.legs.forEach((l, i) => { l.rotation.x = moving ? Math.sin(ph + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * 0.7 : 0; });
    this.body.position.y = moving ? Math.abs(Math.sin(ph)) * 0.08 : 0;
    this.tail.rotation.z = Math.sin(this.t * 3) * 0.5;
    this.head.rotation.y = Math.sin(this.t * 0.8) * 0.3;
  }
}

/** Chibi-proportioned story NPC (Mora, Fidelia, ...) */
export function makeNPC({ skin = 0xffe2cf, hair, hair2, outfit, accent, cape, extra } = {}) {
  const g = new THREE.Group();
  const S = (r) => new THREE.SphereGeometry(r, 18, 12);
  const M = { skin: toon(skin), hair: toon(hair), hair2: toon(hair2 ?? hair), outfit: toon(outfit), accent: toon(accent) };
  const body = new THREE.Group(); g.add(body);
  for (const s of [-1, 1]) {
    const leg = part(new THREE.CylinderGeometry(0.065, 0.045, 0.78, 8), M.outfit, { ol: 0.007 }); leg.position.set(s * 0.08, 0.39, 0); body.add(leg);
    const boot = part(new THREE.SphereGeometry(0.08, 10, 8), M.accent, { ol: 0.007 }); boot.scale.set(0.8, 0.7, 1.4); boot.position.set(s * 0.08, 0.04, 0.03); body.add(boot);
  }
  const hips = part(S(0.14), M.outfit, { ol: 0.007 }); hips.scale.set(1.1, 0.8, 0.85); hips.position.y = 0.82; body.add(hips);
  const torso = part(new THREE.CylinderGeometry(0.13, 0.11, 0.36, 12), M.outfit, { ol: 0.007 }); torso.position.y = 1.0; body.add(torso);
  const chest = part(S(0.13), M.outfit, { ol: 0.007 }); chest.scale.set(1.05, 0.9, 0.8); chest.position.y = 1.13; body.add(chest);
  const belt = part(new THREE.TorusGeometry(0.125, 0.018, 6, 16), M.accent, { ol: 0 }); belt.rotation.x = Math.PI / 2; belt.position.y = 0.88; body.add(belt);
  const arms = [];
  for (const s of [-1, 1]) {
    const a = new THREE.Group(); a.position.set(s * 0.17, 1.2, 0); body.add(a);
    const u = part(new THREE.CylinderGeometry(0.045, 0.04, 0.5, 8), M.skin, { ol: 0.006 }); u.position.y = -0.25; a.add(u);
    const gl = part(new THREE.CylinderGeometry(0.048, 0.045, 0.2, 8), M.accent, { ol: 0.006 }); gl.position.y = -0.4; a.add(gl);
    a.rotation.z = s * 0.15; arms.push(a);
  }
  const head = new THREE.Group(); head.position.y = 1.4; body.add(head);
  const sk = part(S(0.12), M.skin, { ol: 0.008 }); sk.position.y = 0.06; head.add(sk);
  const hr = part(S(0.13), M.hair, { ol: 0.008 }); hr.position.set(0, 0.09, -0.025); hr.scale.set(1.03, 1.02, 1.0); head.add(hr);
  const longHair = part(new THREE.CylinderGeometry(0.12, 0.17, 0.85, 12, 1, true, Math.PI * 0.6, Math.PI * 0.8), toon(hair2 ?? hair, { side: THREE.DoubleSide }), { ol: 0.006 });
  longHair.position.set(0, -0.3, -0.04); head.add(longHair);
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.CircleGeometry(0.022, 10), new THREE.MeshBasicMaterial({ color: 0x3a2a5a })); e.scale.y = 1.4; e.position.set(s * 0.045, 0.05, 0.117); head.add(e);
    const hl = new THREE.Mesh(new THREE.CircleGeometry(0.007, 6), new THREE.MeshBasicMaterial({ color: 0xffffff })); hl.position.set(s * 0.045 - 0.008, 0.065, 0.119); head.add(hl);
  }
  const bang = part(S(0.11), M.hair, { ol: 0.005 }); bang.scale.set(1.05, 0.45, 0.6); bang.position.set(0, 0.16, 0.06); head.add(bang);
  if (cape) {
    const c = part(new THREE.CylinderGeometry(0.2, 0.42, 1.1, 14, 1, true, Math.PI * 0.55, Math.PI * 0.9), toon(cape, { side: THREE.DoubleSide }), { ol: 0.008 });
    c.position.set(0, 0.7, -0.02); body.add(c);
  }
  if (extra) extra(g, body, head, arms, M);
  g.traverse((o) => { if (o.isMesh && !o.userData.isOutline) o.castShadow = true; });
  g.userData.t = Math.random() * 10;
  g.userData.update = (dt) => {
    g.userData.t += dt;
    const t = g.userData.t;
    body.position.y = Math.sin(t * 2) * 0.008;
    head.rotation.y = Math.sin(t * 0.5) * 0.25;
    arms[0].rotation.x = Math.sin(t * 1.3) * 0.05; arms[1].rotation.x = -Math.sin(t * 1.3) * 0.05;
  };
  return g;
}

export function makeMora() {
  return makeNPC({
    hair: 0xf2a6cf, hair2: 0xa8c8f0, outfit: 0xf3f0f6, accent: 0x9b6bd6, cape: 0x8a3fb0,
    extra: (g, body, head, arms) => {
      // floating planet orb (time & stars)
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), toon(0xf0c070, { emissive: 0x6a4010 }));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.015, 6, 24), new THREE.MeshBasicMaterial({ color: 0xc8a0ff }));
      ring.rotation.x = 1.2; orb.add(ring); orb.position.set(-0.45, 1.75, 0.15); g.add(orb);
      const hood = part(new THREE.SphereGeometry(0.15, 16, 10, 0, Math.PI * 2, 0, 1.4), toon(0x8a3fb0, { side: THREE.DoubleSide }), { ol: 0.006 });
      hood.position.set(0, 0.1, -0.03); hood.rotation.x = -0.4; head.add(hood);
      arms[0].rotation.z = -0.8;
      const old = g.userData.update;
      g.userData.update = (dt) => { old(dt); orb.position.y = 1.75 + Math.sin(g.userData.t * 1.5) * 0.06; orb.rotation.y += dt; };
    },
  });
}

export function makeFidelia() {
  return makeNPC({
    hair: 0xc8e4f4, outfit: 0xeef3f8, accent: 0x8fc4e8,
    extra: (g, body, head, arms) => {
      const shellMat = toon(0xf2eaf6, { flatShading: true });
      const shield = part(new THREE.SphereGeometry(0.32, 12, 8, 0, Math.PI * 2, 0, 1.0), shellMat, { ol: 0.012 });
      shield.rotation.x = Math.PI / 2; shield.position.set(0.32, 0.95, 0.15); shield.scale.set(1, 0.5, 1); body.add(shield);
      const sword = part(new THREE.BoxGeometry(0.05, 1.0, 0.015), toon(0x7ad0ff, { emissive: 0x104060 }), { ol: 0.008 });
      sword.position.set(-0.28, 0.75, 0.1); sword.rotation.z = 0.15; body.add(sword);
      const helm = part(new THREE.SphereGeometry(0.14, 14, 8, 0, Math.PI * 2, 0, 1.2), shellMat, { ol: 0.008 });
      helm.position.set(0, 0.11, -0.01); head.add(helm);
      for (const s of [-1, 1]) {
        const fin = part(new THREE.ConeGeometry(0.06, 0.2, 3), toon(0x9fd8f0), { ol: 0.006 }); fin.position.set(s * 0.15, 0.15, -0.02); fin.rotation.z = -s * 1.0; head.add(fin);
        const pad = part(new THREE.SphereGeometry(0.09, 10, 8), shellMat, { ol: 0.006 }); pad.position.set(s * 0.19, 1.22, 0); pad.scale.y = 0.7; body.add(pad);
      }
    },
  });
}
