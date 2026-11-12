// Shared humanoid rig + procedural animator. Every playable hero builds meshes onto the same joint names
// (pivot, hips, spine, chest, head, armL/R, elbowL/R, handL/R, legL/R, kneeL/R, footL/R, optional tail[]).
import * as THREE from 'three';
import { cullFar } from './cull.js';
import { damp } from './toon.js';

export class Rig {
  constructor(name) {
    this.root = new THREE.Group();
    this.root.name = name;
    cullFar(this.root, 110); // heroes/NPC rigs: ~80 draw calls each, pointless beyond fog of detail
    this.j = {};
    this.mats = {};
    this._build();
    if (!this.j.tail) this.j.tail = [];
    this.phase = 0;
    this.idleT = 0;
    this.time = 0;
    this.blink = 0;
    this.root.traverse((o) => { if (o.isMesh && !o.userData.isOutline) o.castShadow = true; });
  }

  _build() {}

  /**
   * Procedural animation.
   * st: { speed (m/s), sprint, grounded, vy, action, actionT (0..1), combo, dt, dead, hurtT, flipT }
   */
  update(dt, st) {
    this.time += dt;
    const j = this.j;
    const T = {}; // target rotations: name -> [x,y,z]
    const set = (n, x = 0, y = 0, z = 0) => { T[n] = [x, y, z]; };
    const names = ['hips', 'spine', 'chest', 'head', 'armL', 'armR', 'elbowL', 'elbowR', 'handL', 'handR', 'legL', 'legR', 'kneeL', 'kneeR', 'footL', 'footR'];
    for (const n of names) set(n);
    let hipsY = 0.8;
    let k = 14;

    // rest
    const breath = Math.sin(this.time * 2.2);
    set('armL', 0.05, 0, 0.2 + breath * 0.02); set('armR', 0.05, 0, -0.2 - breath * 0.02);
    set('elbowL', -0.35); set('elbowR', -0.35);
    set('chest', breath * 0.025);
    set('head', -0.04 + breath * 0.02, Math.sin(this.time * 0.6) * 0.12, Math.sin(this.time * 0.9) * 0.04);
    set('kneeL', 0.08); set('kneeR', 0.08); set('legL', -0.04, 0, 0.03); set('legR', -0.04, 0, -0.03);

    const spd = st.speed || 0;
    const moving = spd > 0.3 && st.grounded;
    if (!moving && st.grounded && !st.action) this.idleT += dt; else this.idleT = 0;

    if (moving) {
      const amp = Math.min(spd / 5.5, 1.5);
      this.phase += dt * (5.5 + spd * 1.25);
      const p = this.phase;
      const sw = 0.75 * Math.min(amp, 1.1);
      set('legL', -Math.sin(p) * sw - 0.05);
      set('legR', Math.sin(p) * sw - 0.05);
      set('kneeL', Math.max(0, Math.sin(p - 1.3)) * 1.35 * Math.min(amp, 1) + 0.15);
      set('kneeR', Math.max(0, -Math.sin(p - 1.3)) * 1.35 * Math.min(amp, 1) + 0.15);
      set('footL', Math.sin(p) * 0.3); set('footR', -Math.sin(p) * 0.3);
      hipsY = 0.79 + Math.abs(Math.cos(p)) * 0.045 * amp;
      set('hips', 0, Math.sin(p) * 0.12 * amp, 0);
      set('spine', 0.14 * amp, -Math.sin(p) * 0.1 * amp, 0);
      set('head', -0.12 * amp, 0, 0);
      if (st.sprint) {
        // anime "ninja run": arms trailing behind
        set('armL', 1.25, 0, 0.35); set('armR', 1.25, 0, -0.35);
        set('elbowL', -0.2); set('elbowR', -0.2);
        set('spine', 0.48, 0, 0);
        set('head', -0.38);
      } else {
        set('armL', Math.sin(p) * 0.7, 0, 0.18); set('armR', -Math.sin(p) * 0.7, 0, -0.18);
        set('elbowL', -0.95); set('elbowR', -0.95);
      }
    } else if (!st.grounded) {
      const up = st.vy > 0;
      set('legL', up ? -0.9 : -0.35); set('kneeL', up ? 1.4 : 0.6);
      set('legR', up ? -0.2 : 0.15); set('kneeR', up ? 0.9 : 0.4);
      set('armL', -0.4, 0, 1.0); set('armR', -0.4, 0, -1.0);
      set('elbowL', -0.6); set('elbowR', -0.6);
      set('spine', up ? -0.08 : 0.12);
    } else if (this.idleT > 7) {
      // idle special: cat-paw wave ("nya~")
      const t = (this.idleT - 7) % 6;
      if (t < 2.2) {
        const w = Math.sin(t * 9) * 0.35;
        set('armR', -2.5, 0, -0.35 + w * 0.3); set('elbowR', -1.3 + w);
        set('handR', 0, 0, w);
        set('head', 0.05, -0.2, 0.18);
        set('spine', 0, -0.12, 0.05);
      }
    }

    // ---- actions override ----
    const a = st.action, t = st.actionT || 0;
    const ss = (x) => x * x * (3 - 2 * x);
    const seg = (t0, t1) => Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
    if (a === 'attack') {
      k = 32;
      const c = st.combo;
      const w = ss(seg(0, 0.3)), s2 = ss(seg(0.3, 0.6));
      if (c === 1 || c === 2) {
        const sgn = c === 1 ? 1 : -1; // 1 = right paw, 2 = left paw
        const arm = c === 1 ? 'armR' : 'armL', el = c === 1 ? 'elbowR' : 'elbowL';
        const ax = -1.2 + (-1.5 + 1.2) * s2;
        const az = (-1.5 + 1.9 * s2) * sgn * (w > 0 ? 1 : 0);
        set(arm, ax * Math.max(w, s2), 0, az + (sgn > 0 ? -0.2 : 0.2) * (1 - w));
        set(el, -0.6 + 0.4 * s2);
        set('spine', 0.25 * w, (0.45 - 0.95 * s2) * sgn * w, 0);
        set('head', -0.1, (-0.3 + 0.6 * s2) * sgn, 0);
        set('legL', sgn > 0 ? -0.5 : 0.3); set('kneeL', 0.4);
        set('legR', sgn > 0 ? 0.3 : -0.5); set('kneeR', 0.4);
        hipsY = 0.74;
      } else {
        // double-paw overhead slam
        const up = ss(seg(0, 0.4)), down = ss(seg(0.4, 0.62));
        const ax = -2.9 * up + (2.9 - 1.0) * down;
        set('armL', ax, 0, 0.25); set('armR', ax, 0, -0.25);
        set('elbowL', -0.4); set('elbowR', -0.4);
        set('spine', -0.2 * up + 0.75 * down);
        set('head', -0.2 * down);
        set('legL', -0.6 * down - 0.1); set('kneeL', 0.9 * down + 0.2);
        set('legR', 0.4 * down); set('kneeR', 0.6 * down + 0.2);
        hipsY = 0.8 - 0.14 * down;
      }
    } else if (a === 'pounce') {
      k = 26;
      if (t < 0.25) { // crouch
        const c = ss(seg(0, 0.25));
        set('spine', 0.5 * c); set('legL', -0.9 * c); set('legR', -0.9 * c); set('kneeL', 1.6 * c); set('kneeR', 1.6 * c);
        set('armL', -0.6 * c, 0, 0.5); set('armR', -0.6 * c, 0, -0.5); hipsY = 0.8 - 0.25 * c;
      } else if (t < 0.8) { // flying, paws forward
        set('spine', 0.55); set('armL', -2.2, 0, 0.25); set('armR', -2.2, 0, -0.25); set('elbowL', -0.2); set('elbowR', -0.2);
        set('legL', 0.7); set('legR', 0.4); set('kneeL', 1.1); set('kneeR', 1.4); set('head', -0.5);
      } else { // landing slam
        const c = 1 - ss(seg(0.8, 1));
        set('spine', 0.6 * c); set('armL', -1.3 * c, 0, 0.6); set('armR', -1.3 * c, 0, -0.6);
        set('legL', -1.0 * c); set('legR', -0.4 * c); set('kneeL', 1.6 * c); set('kneeR', 1.2 * c);
        hipsY = 0.8 - 0.3 * c;
      }
    } else if (a === 'burst') {
      k = 20;
      const up = ss(seg(0, 0.4)), point = ss(seg(0.45, 0.7));
      set('armL', -2.9 * up + 1.3 * point, 0, 0.3); set('armR', -2.9 * up + 1.3 * point, 0, -0.3);
      set('elbowL', -0.2); set('elbowR', -0.2);
      set('spine', -0.25 * up + 0.3 * point); set('head', -0.25 * up);
      set('legL', -0.3); set('legR', 0.3); set('kneeR', 0.4);
    } else if (a === 'dash') {
      k = 30;
      set('spine', 0.7); set('armL', 1.3, 0, 0.4); set('armR', 1.3, 0, -0.4);
      set('legL', -0.9); set('kneeL', 1.2); set('legR', 0.6); set('kneeR', 0.6); set('head', -0.5);
      hipsY = 0.68;
    } else if (a === 'interact') {
      const c = Math.sin(Math.min(t, 1) * Math.PI);
      set('spine', 0.6 * c); set('armL', -1.0 * c, 0, 0.2); set('armR', -1.0 * c, 0, -0.2);
      set('legL', -0.8 * c); set('legR', -0.8 * c); set('kneeL', 1.5 * c); set('kneeR', 1.5 * c);
      hipsY = 0.8 - 0.28 * c;
    } else if (a === 'eat') {
      const c = Math.sin(Math.min(t, 1) * Math.PI);
      set('armR', -1.9 * c, 0, 0.25 * c); set('elbowR', -1.9 * c); set('head', -0.15 * c + Math.sin(this.time * 20) * 0.05 * c);
      set('armL', -1.6 * c, 0, -0.1 * c); set('elbowL', -1.9 * c);
    } else if (a === 'bash') {
      // shield bash / forward thrust (Fidelia)
      k = 28;
      const c = ss(seg(0, 0.3));
      set('armL', -1.5 * c, 0.4 * c, 0.3); set('elbowL', -1.2 * c); set('armR', 0.6, 0, -0.4); set('elbowR', -0.6);
      set('spine', 0.4 * c, 0.3 * c, 0); set('legL', -0.7 * c); set('kneeL', 0.6); set('legR', 0.5 * c); set('kneeR', 0.3);
      hipsY = 0.8 - 0.1 * c;
    } else if (a === 'cast') {
      // spell cast (Mora): right hand points at the target, left hand opens
      k = 24;
      const c = ss(seg(0, 0.35)), r = 1 - ss(seg(0.7, 1));
      set('armR', -1.55 * c * r, 0.15, -0.15); set('elbowR', -0.15);
      set('armL', -0.5 * c * r, 0, 0.9 * c * r); set('elbowL', -0.9);
      set('spine', -0.08 * c, -0.25 * c * r, 0); set('head', -0.05, -0.15 * c * r, 0);
      set('legL', -0.25 * c); set('legR', 0.2 * c); set('kneeR', 0.25);
    }
    if (st.glide) {
      set('armL', -2.9, 0, 0.35); set('armR', -2.9, 0, -0.35); set('elbowL', -0.2); set('elbowR', -0.2);
      set('legL', 0.25); set('legR', 0.05); set('kneeL', 0.5); set('kneeR', 0.3); set('spine', 0.25); set('head', -0.3);
      k = 12;
    }
    if (st.swim) {
      // front crawl at the surface
      const sp = this.time * (st.speed > 0.5 ? 6 : 2.5);
      set('armL', -2.6 + Math.sin(sp) * 1.4, 0, 0.3); set('armR', -2.6 - Math.sin(sp) * 1.4, 0, -0.3);
      set('elbowL', -0.4); set('elbowR', -0.4);
      set('legL', Math.sin(sp * 2) * 0.35); set('legR', -Math.sin(sp * 2) * 0.35); set('kneeL', 0.2); set('kneeR', 0.2);
      set('head', -1.0); set('spine', 0); hipsY = 0.8; k = 10;
    }
    if (st.hurtT > 0) { set('spine', -0.35); set('head', 0.3); k = 30; }
    if (st.dead) {
      // curled-up nap pose ("Just... a nap...")
      set('spine', 1.1); set('head', 0.4); set('legL', -1.6); set('legR', -1.5); set('kneeL', 2.3); set('kneeR', 2.3);
      set('armL', -1.4, 0, 0.3); set('armR', -1.4, 0, -0.3); set('elbowL', -1.8); set('elbowR', -1.8);
      hipsY = 0.22; k = 6;
    }

    for (const n of names) {
      const g = j[n], tg = T[n];
      g.rotation.x = damp(g.rotation.x, tg[0], k, dt);
      g.rotation.y = damp(g.rotation.y, tg[1], k, dt);
      g.rotation.z = damp(g.rotation.z, tg[2], k, dt);
    }
    j.hips.position.y = damp(j.hips.position.y, hipsY - 0.8, k, dt);
    // dead: lie on side
    j.pivot.rotation.z = damp(j.pivot.rotation.z, st.dead ? 1.45 : 0, 5, dt);

    // cat-leap flip (double jump)
    if (st.flipT > 0) j.pivot.rotation.x = (1 - st.flipT) * Math.PI * 2;
    else j.pivot.rotation.x = damp(j.pivot.rotation.x % (Math.PI * 2), st.swim ? 1.35 : 0, st.swim ? 6 : 20, dt);

    // tail: lazy S-curve sway, whips when moving fast
    const tw = moving ? 0.35 + spd * 0.04 : 0.25;
    for (let i = 0; i < j.tail.length; i++) {
      const g = j.tail[i];
      g.rotation.y = Math.sin(this.time * (moving ? 7 : 2.2) - i * 0.6) * tw;
      g.rotation.x = i === 0 ? -0.9 + (moving ? 0.5 : 0) : -0.12 + Math.sin(this.time * 1.7 - i * 0.5) * 0.06;
    }

    // blink (squash the face decal's eyes by scaling the face vertically for a moment)
    this.blink -= dt;
    if (this.blink < -3 - Math.random() * 3) this.blink = 0.12;
    if (this.faceMesh) this.faceMesh.scale.y = this.blink > 0 ? 0.985 : 1;
  }

  /** world position of a paw (for VFX) */
  pawWorld(side = 'R', out = new THREE.Vector3()) {
    return this.j['hand' + side].getWorldPosition(out);
  }
}
