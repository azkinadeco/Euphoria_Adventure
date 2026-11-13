// Shared humanoid rig + procedural animator. Every playable hero builds meshes onto the same joint names
// (pivot, hips, spine, chest, head, armL/R, elbowL/R, handL/R, legL/R, kneeL/R, footL/R, optional tail[]).
import * as THREE from 'three';
import { cullFar } from './cull.js';
import { damp, charaLook } from './toon.js';

export class Rig {
  constructor(name) {
    this.root = new THREE.Group();
    this.root.name = name;
    cullFar(this.root, 110); // heroes/NPC rigs: ~80 draw calls each, pointless beyond fog of detail
    this.j = {};
    this.mats = {};
    this._build();
    if (!this.j.tail) this.j.tail = [];
    // rest pose of every joint in rig-root space (skinned bodies bind against it, even if they load later)
    this.root.updateMatrixWorld(true);
    const inv = this.root.matrixWorld.clone().invert();
    this.bindRest = {};
    for (const [n, g] of Object.entries(this.j)) if (g?.isObject3D) this.bindRest[n] = inv.clone().multiply(g.matrixWorld);
    this.phase = 0;
    this.idleT = 0;
    this.time = 0;
    this.blink = 0;
    this.root.traverse((o) => { if (o.isMesh && !o.userData.isOutline) o.castShadow = true; });
    charaLook(this.root, this.mats.skin ? [this.mats.skin] : []);
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

    // weapon stance: how this hero carries what is in her hands
    const style = this.style || 'claw';
    const blade = style === 'sword' || style === 'great' || style === 'dual';
    const pole = style === 'scythe' || style === 'staff' || style === 'cstaff';
    const sway = Math.sin(this.time * 0.55);
    set('hips', 0, 0, sway * 0.025); set('spine', 0, 0, -sway * 0.03); // slow weight shift
    if (blade) { // low guard: blade pointing down along the arm
      set('armR', 0.12, 0, -0.24 - breath * 0.02); set('elbowR', -0.22); set('handR', style === 'great' ? 1.35 : 1.15);
      if (style === 'dual') { set('armL', 0.12, 0, 0.24 + breath * 0.02); set('elbowL', -0.22); set('handL', 1.15); }
    } else if (pole) { // shaft upright beside her, butt near the ground
      set('armR', -0.28, 0, -0.3); set('elbowR', -0.5); set('handR', -0.8);
    }

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
      set('hips', 0, Math.sin(p) * 0.12 * amp, Math.cos(p) * 0.04 * amp);
      // armed run: the weapon arm stays low and trails, it does not pump
      if (blade) {
        set('armR', 0.45 - Math.sin(p) * 0.18, 0, -0.32); set('elbowR', -0.55); set('handR', st.sprint ? 0.5 : 0.85);
        if (style === 'dual') { set('armL', 0.45 + Math.sin(p) * 0.18, 0, 0.32); set('elbowL', -0.55); set('handL', st.sprint ? 0.5 : 0.85); }
      } else if (pole) {
        set('armR', -0.15 - Math.sin(p) * 0.12, 0, -0.32); set('elbowR', -0.85); set('handR', st.sprint ? 0.9 : -0.25);
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
    let spin = 0; // whole-body turns (scythe finisher, charged spin); 2*PI lands back on 0
    const lerp = (x, y, f) => x + (y - x) * f;
    if (a === 'attack' && style !== 'claw' && style !== 'caster' && style !== 'cstaff') {
      k = 34;
      const c = st.combo;
      const w = ss(seg(0, 0.26)), hit = ss(seg(0.26, 0.5)), r = 1 - ss(seg(0.72, 1)), wr = w * r;
      const two = style === 'great' || style === 'scythe'; // both hands on the weapon
      const grip = pole ? 1.4 : 1.0;
      const lunge = (d) => { set('legL', -0.5 * d); set('kneeL', 0.55 * d + 0.1); set('legR', 0.4 * d); set('kneeR', 0.3 * d + 0.1); hipsY = 0.8 - 0.07 * d; };
      if (style === 'staff' && c === 1) { // spear thrust
        const th = ss(seg(0.22, 0.42));
        set('armR', lerp(-0.5, -1.5, th) * wr, 0, -0.1); set('elbowR', lerp(-1.5, -0.08, th) * wr); set('handR', 1.4);
        set('armL', -0.7 * wr, 0, 0.35); set('elbowL', -1.1 * wr);
        set('spine', 0.32 * th * r, 0.3 * (1 - th) * wr - 0.15 * th * r, 0); set('head', -0.12 * wr);
        lunge(th * r + 0.3 * wr);
      } else if (c === 1 || c === 2) {
        const left = style === 'dual' && c === 2; // dual blades alternate hands
        const sg = left ? -1 : 1, A = left ? 'L' : 'R', B = left ? 'R' : 'L';
        const back = c === 2 && !left; // same hand again: backhand return
        // sweep angle in the horizontal plane: + is toward her left
        const from = back ? 0.85 : -1.45, to = back ? -1.5 : 0.85;
        const phi = lerp(from, to, hit) * sg;
        const lift = two ? (back ? lerp(-0.95, -2.0, hit) : lerp(-2.0, -0.95, hit)) : (back ? lerp(-1.3, -1.65, hit) : -1.45);
        set('arm' + A, lift * wr + 0.1 * (1 - wr), 0, (phi + (two ? 0.3 : 0) * sg) * wr - 0.22 * sg * (1 - wr));
        set('elbow' + A, (-0.55 + 0.4 * hit) * wr - 0.2 * (1 - wr)); set('hand' + A, grip);
        if (two) { set('arm' + B, lift * wr, 0, (phi - 0.3 * sg) * wr); set('elbow' + B, -0.75 * wr); }
        else if (style === 'dual') { set('arm' + B, 0.5 * wr, 0, 0.5 * sg * wr + 0.22 * sg); set('elbow' + B, -0.5); set('hand' + B, 0.9); }
        else { set('arm' + B, -0.55 * wr, 0, 0.55 * wr + 0.2); set('elbow' + B, -1.05 * wr - 0.3); } // off hand / shield guards
        const tw = (back ? lerp(0.5, -0.65, hit) : lerp(-0.6, 0.6, hit)) * sg * (two ? 1.3 : 1);
        set('spine', 0.2 * wr, tw * wr, 0); set('hips', 0, tw * 0.35 * wr, 0); set('head', -0.08, -tw * 0.55 * wr, 0);
        lunge((0.5 + 0.5 * hit) * wr);
      } else if (style === 'scythe') { // reaping spin
        spin = ss(seg(0.12, 0.62)) * Math.PI * 2;
        set('armR', -1.35 * wr, 0, -0.75 * wr); set('elbowR', -0.25); set('handR', 1.4);
        set('armL', -1.35 * wr, 0, -1.3 * wr); set('elbowL', -0.8 * wr);
        set('spine', 0.22 * wr, -0.35 * wr, 0); set('head', -0.1);
        set('legL', -0.35 * wr, 0, 0.12); set('kneeL', 0.5 * wr); set('legR', 0.25 * wr, 0, -0.12); set('kneeR', 0.35 * wr); hipsY = 0.8 - 0.08 * wr;
      } else if (style === 'dual') { // crossed blades tear outward
        const open = ss(seg(0.3, 0.52));
        set('armR', -1.5 * wr, 0, lerp(0.75, -1.4, open) * wr - 0.2 * (1 - wr)); set('armL', -1.5 * wr, 0, lerp(-0.75, 1.4, open) * wr + 0.2 * (1 - wr));
        set('elbowR', (-0.9 + 0.75 * open) * wr); set('elbowL', (-0.9 + 0.75 * open) * wr); set('handR', 1.0); set('handL', 1.0);
        set('spine', (0.45 - 0.55 * open) * wr); set('head', -0.15 * wr);
        lunge(wr);
      } else { // overhead chop (sword), slam (greatsword), spinning slam (staff)
        const up = ss(seg(0, 0.32)), down = ss(seg(0.32, 0.54));
        const ax = (-3.0 * up + 2.25 * down) * r;
        set('armR', ax, 0, two ? 0.2 : -0.15); set('elbowR', (-0.75 * up + 0.6 * down) * r); set('handR', lerp(pole ? 0.3 : 0.45, pole ? 1.4 : 1.15, down));
        if (two || style === 'staff') { set('armL', ax, 0, two ? -0.2 : 0.15); set('elbowL', (-0.9 * up + 0.5 * down) * r); }
        else { set('armL', 0.7 * down * r, 0, 0.55 * up * r + 0.2); set('elbowL', -0.6); }
        set('spine', (-0.28 * up + 0.8 * down) * r); set('head', -0.25 * down * r);
        set('legL', (-0.7 * down - 0.1) * r); set('kneeL', (0.95 * down + 0.2) * r); set('legR', 0.45 * down * r); set('kneeR', (0.6 * down + 0.2) * r);
        hipsY = 0.8 + (two ? 0.1 : 0.05) * up * (1 - down) - 0.16 * down * r;
        if (style === 'staff') spin = ss(seg(0, 0.3)) * Math.PI * 2;
      }
    } else if (a === 'attack') {
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
    } else if (a === 'fang') { // lunging thrust through the enemy line
      k = 30;
      set('spine', 0.55, 0.22, 0); set('head', -0.45, -0.15, 0);
      set('armR', -1.55, 0, 0.08); set('elbowR', -0.08); set('handR', pole ? 1.4 : blade ? 1.3 : 0);
      if (style === 'dual') { set('armL', -1.4, 0, -0.1); set('elbowL', -0.3); set('handL', 1.3); } else { set('armL', 0.95, 0, 0.5); set('elbowL', -0.3); }
      set('legL', -1.05); set('kneeL', 1.25); set('legR', 0.7); set('kneeR', 0.3); hipsY = 0.66;
    } else if (a === 'spin') { // charged whirl: weapon held out while the body turns
      k = 26;
      set('armR', -1.45, 0, -1.2); set('elbowR', -0.15); set('handR', pole ? 1.4 : blade ? 1.1 : 0);
      if (style === 'dual' || style === 'claw') { set('armL', -1.45, 0, 1.2); set('elbowL', -0.15); set('handL', blade ? 1.1 : 0); } else { set('armL', -0.9, 0, 0.9); set('elbowL', -0.7); }
      set('spine', 0.18); set('head', -0.1); set('legL', -0.3, 0, 0.14); set('kneeL', 0.45); set('legR', 0.2, 0, -0.14); set('kneeR', 0.3); hipsY = 0.74;
    } else if (a === 'burst' && (blade || style === 'scythe' || style === 'staff')) {
      // weapon raised to the sky, then brought down on the enemy
      k = 20;
      const up = ss(seg(0, 0.34)), hit = ss(seg(0.5, 0.68)), two = style === 'great' || style === 'scythe';
      const ax = -3.05 * up + 1.95 * hit;
      set('armR', ax, 0, two ? 0.15 : -0.2); set('elbowR', -0.25 * up + 0.1 * hit); set('handR', lerp(pole ? -0.1 : 0.35, pole ? 1.4 : 1.15, hit));
      if (two) { set('armL', ax, 0, -0.15); set('elbowL', -0.5 * up); }
      else if (style === 'dual') { set('armL', ax, 0, 0.2); set('elbowL', -0.25 * up); set('handL', lerp(0.35, 1.15, hit)); }
      else { set('armL', -0.5 * up + 0.9 * hit, 0, 0.95 * up); set('elbowL', -0.5); }
      set('spine', -0.3 * up + 0.6 * hit); set('head', -0.3 * up + 0.1 * hit);
      set('legL', -0.25 * up - 0.5 * hit, 0, 0.1); set('kneeL', 0.3 + 0.6 * hit); set('legR', 0.25 * up + 0.2 * hit, 0, -0.1); set('kneeR', 0.3 + 0.3 * hit);
      hipsY = 0.8 + 0.07 * up - 0.2 * hit;
    } else if (a === 'burst' && style !== 'claw') {
      // casters: rise off the ground gathering power, then release it forward
      k = 16;
      const up = ss(seg(0, 0.4)), out = ss(seg(0.5, 0.72)), fl = Math.sin(this.time * 5) * 0.015;
      set('armR', lerp(-0.5 * up, -1.5, out), 0, lerp(-1.45 * up, -0.2, out)); set('armL', lerp(-0.5 * up, -1.5, out), 0, lerp(1.45 * up, 0.2, out));
      set('elbowR', -0.25); set('elbowL', -0.25); set('handR', pole ? lerp(-0.6, 0.9, out) : 0);
      set('spine', -0.28 * up + 0.4 * out); set('head', -0.35 * up + 0.3 * out);
      set('legL', -0.3 * up); set('kneeL', 0.75 * up); set('legR', 0.12 * up); set('kneeR', 0.35 * up);
      hipsY = 0.8 + 0.2 * up * (1 - 0.6 * out) + fl;
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
      if (pole) set('handR', 0.85 * c * r - 0.8 * (1 - c * r)); // staff tips forward at the target
      else if (st.combo === 2) { // second shot from the other hand
        set('armL', -1.55 * c * r, -0.15, 0.15); set('elbowL', -0.15); set('armR', -0.5 * c * r, 0, -0.9 * c * r); set('elbowR', -0.9);
        set('spine', -0.08 * c, 0.25 * c * r, 0); set('head', -0.05, 0.15 * c * r, 0);
      } else if (st.combo === 3) { // both palms push the last one out
        set('armL', -1.5 * c * r, 0, -0.12); set('armR', -1.5 * c * r, 0, 0.12); set('elbowL', -0.9 + 0.8 * c); set('elbowR', -0.9 + 0.8 * c);
        set('spine', 0.22 * c * r, 0, 0); set('head', -0.1);
      }
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

    j.pivot.rotation.y = spin;
    // long back hair lags behind the motion and settles with a soft sway
    if (this.hairBack) {
      const h = this.hairBack, air = st.grounded ? 0 : (st.vy > 0 ? -0.1 : 0.3);
      const tg = Math.min(spd, 9) * 0.042 + air + (a ? 0.08 : 0) + Math.sin(this.time * (moving ? 8 : 1.6)) * (moving ? 0.035 : 0.015);
      h.rotation.x = damp(h.rotation.x, tg, 6, dt);
      h.rotation.z = damp(h.rotation.z, Math.sin(this.time * 1.1) * 0.02 - (T.spine[1] || 0) * 0.25, 5, dt);
    }

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

    // skinned capes: billow back with speed / in the air, slow ripple at rest
    if (j.capeA) {
      const sp = Math.min(spd, 9), air = st.grounded ? 0 : 0.35, w = this.time * (moving ? 9 : 2), r = moving ? 1 : 0.3;
      j.capeA.rotation.x = damp(j.capeA.rotation.x, 0.05 + sp * 0.045 + air + Math.sin(w) * 0.06 * r, 8, dt);
      j.capeB.rotation.x = damp(j.capeB.rotation.x, 0.03 + sp * 0.035 + air * 0.7 + Math.sin(w - 1.2) * 0.09 * r, 8, dt);
      j.capeA.rotation.z = damp(j.capeA.rotation.z, Math.sin(w * 0.5) * 0.03 * r, 8, dt);
    }

    // blink: swap the face texture to its closed-eye frame for a moment (double blink now and then)
    this.blink -= dt;
    if (this.blink < -2.4 - Math.random() * 3.5) this.blink = Math.random() < 0.2 ? 0.34 : 0.11;
    const shut = st.dead || (this.blink > 0 && !(this.blink > 0.11 && this.blink < 0.23));
    const ft = this.faceTex;
    if (ft?.closed && this.faceMesh) {
      const want = shut ? ft.closed : ft.open;
      if (this.faceMesh.material.map !== want) this.faceMesh.material.map = want;
    }
  }

  /** world position of a paw (for VFX) */
  pawWorld(side = 'R', out = new THREE.Vector3()) {
    return this.j['hand' + side].getWorldPosition(out);
  }
}
