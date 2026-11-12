// Combat systems: combo counter & style rank, perfect dodge (slow-mo), lock-on, energy orbs,
// burst cut-ins, impact feedback, attack tokens, elemental shields on elite enemies.
import * as THREE from 'three';
import { sfx } from './sfx.js';
import { ELEMENT_COLOR } from './heroes.js';

const $ = (id) => document.getElementById(id);
const RANKS = [[0, 'C'], [6, 'B'], [14, 'A'], [26, 'S'], [45, 'SS'], [75, 'SSS']];
export const SHIELD_COUNTER = { FIRE: ['WATER', 'ICE'], WATER: ['ICE', 'FIRE', 'LIGHTNING'], ICE: ['FIRE'], DARK: ['LIGHT'], LIGHT: ['DARK'], WIND: ['LIGHTNING', 'ICE'], LIGHTNING: ['WIND', 'LIGHT'] };

export class Combat {
  constructor(game) {
    this.g = game;
    this.combo = 0; this.comboT = 0; this.comboDmg = 0; this.best = 0;
    this.enemyScale = 1; this.slowT = 0;
    this.globalSlowT = 0; this.globalScale = 1;
    this.lock = null;
    this.orbs = [];
    this.orbGeo = new THREE.OctahedronGeometry(0.16, 0);
    this.fovKick = 0;
  }

  // ---------- combo ----------
  registerHit(dmg) {
    this.combo++; this.comboT = 3.2; this.comboDmg += dmg;
    this.best = Math.max(this.best, this.combo);
    this.g.state.bestCombo = Math.max(this.g.state.bestCombo || 0, this.combo);
    const el = $('combo'); if (!el) return;
    el.classList.remove('hidden');
    $('combo-n').textContent = this.combo;
    const r = this.rank();
    const rk = $('combo-rank');
    if (rk.textContent !== r) { rk.textContent = r; rk.className = 'rank r-' + r.toLowerCase(); rk.animate([{ transform: 'scale(1.8)' }, { transform: 'scale(1)' }], { duration: 250 }); }
    $('combo-dmg').textContent = Math.round(this.comboDmg).toLocaleString('id-ID') + ' dmg';
    el.querySelector('.cn').animate([{ transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 120 });
  }
  rank() { let r = 'C'; for (const [n, k] of RANKS) if (this.combo >= n) r = k; return r; }
  /** style bonus: higher rank → more burst energy per hit */
  energyMult() { return 1 + RANKS.findIndex((x) => x[1] === this.rank()) * 0.12; }

  // ---------- perfect dodge ----------
  perfectDodge(from) {
    const G = this.g, P = G.player;
    this.slowT = 1.8;
    P.iframes = Math.max(P.iframes, 0.6);
    P._gainEnergy(10);
    P.stamina = Math.min(100, P.stamina + 25);
    G.vfx.shockwave(P.pos, 4, 0xbfe6ff, 0.5);
    G.vfx.particles(P.pos.clone().setY(P.pos.y + 1), 30, 0xbfe6ff, { speed: 6, up: 2, life: 0.6 });
    G.ui.bigText('PERFECT DODGE', '#bfe6ff');
    sfx.perfect();
    G.graphics.mood({ tint: new THREE.Color(0.85, 0.95, 1.15) });
  }

  // ---------- global slow (burst cinematics) ----------
  slowAll(t, scale) { this.globalSlowT = t; this.globalScale = scale; }

  // ---------- lock-on ----------
  toggleLock() {
    const G = this.g;
    if (this.lock) { this.lock = null; $('lock').classList.add('hidden'); return; }
    const cam = G.camera, P = G.player;
    const fwd = new THREE.Vector3(); cam.getWorldDirection(fwd);
    let best = null, bs = Infinity;
    for (const e of G.enemies) {
      if (e.dead || e.dormant || !e.root.visible) continue;
      const d = e.pos.distanceTo(P.pos);
      if (d > 32) continue;
      const to = e.pos.clone().sub(cam.position).normalize();
      const score = d * (1.6 - to.dot(fwd));
      if (score < bs) { bs = score; best = e; }
    }
    this.lock = best;
    if (best) sfx.ui(); else G.ui.toast('Tidak ada target untuk dikunci');
  }

  // ---------- energy orbs ----------
  dropOrbs(pos, color, n) {
    const G = this.g;
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(this.orbGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.4) }));
      m.position.copy(pos).add(new THREE.Vector3(0, 1, 0));
      G.scene.add(m);
      const a = Math.random() * Math.PI * 2;
      this.orbs.push({ m, v: new THREE.Vector3(Math.cos(a) * 3, 5 + Math.random() * 2, Math.sin(a) * 3), t: 0 });
    }
  }

  // ---------- burst cut-in ----------
  cutIn(H) {
    const el = $('cutin');
    if (!el) return;
    $('cutin-img').src = H.portrait;
    $('cutin-name').textContent = H.name;
    $('cutin-skill').textContent = H.burstName;
    el.style.setProperty('--c', H.color);
    el.classList.remove('hidden', 'play'); void el.offsetWidth; el.classList.add('play');
    clearTimeout(this._cut); this._cut = setTimeout(() => el.classList.add('hidden'), 1250);
    this.slowAll(0.55, 0.25);
  }

  // ---------- attack tokens: at most 2 regular enemies wind up at once ----------
  canAttack(e) {
    if (e.isBoss) return true;
    let n = 0;
    for (const o of this.g.enemies) if (o !== e && !o.dead && !o.isBoss && ['windup', 'lunge', 'leap', 'claw_wind', 'aim'].includes(o.state)) n++;
    return n < 2;
  }

  /** impact feedback for a landed hit */
  impact(e, dmg, crit, element) {
    const G = this.g;
    const col = element ? ELEMENT_COLOR[element] : '#ffffff';
    const p = e.pos.clone().setY(e.pos.y + Math.min(e.tall * 0.5, 2.5));
    G.vfx.impact(p, col, crit);
    sfx.hitEl(element, crit);
    this.registerHit(dmg);
    if (crit) this.fovKick = Math.max(this.fovKick, 2.5);
  }

  update(realDt) {
    const G = this.g, P = G.player;
    // timers
    if (this.slowT > 0) { this.slowT -= realDt; if (this.slowT <= 0) G.graphics.mood({ tint: new THREE.Color(1, 1, 1) }); }
    this.enemyScale = this.slowT > 0 ? 0.25 : 1;
    if (this.globalSlowT > 0) this.globalSlowT -= realDt;
    if (this.comboT > 0) { this.comboT -= realDt; if (this.comboT <= 0) { this.combo = 0; this.comboDmg = 0; $('combo')?.classList.add('hidden'); } }
    const bar = $('combo-bar'); if (bar) bar.style.width = Math.max(0, this.comboT / 3.2) * 100 + '%';
    this.fovKick = Math.max(0, this.fovKick - realDt * 10);

    // orbs pop, then home in on the active hero
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i];
      o.t += realDt;
      const target = P.pos.clone().setY(P.pos.y + 1);
      if (o.t < 0.45) { o.v.y -= 14 * realDt; o.m.position.addScaledVector(o.v, realDt); }
      else {
        const d = target.clone().sub(o.m.position); const L = d.length();
        o.m.position.addScaledVector(d.normalize(), Math.min(L, (12 + o.t * 20) * realDt));
        if (L < 0.6) {
          P._gainEnergy(2.5);
          for (const m of P.members) if (m !== P.m) m.energy = Math.min(m.def.burstCost, m.energy + 1);
          G.scene.remove(o.m); this.orbs.splice(i, 1); sfx.orb();
          continue;
        }
      }
      o.m.rotation.y += realDt * 6;
      if (o.t > 6) { G.scene.remove(o.m); this.orbs.splice(i, 1); }
    }

    // lock-on validity + reticle
    const L = this.lock, rt = $('lock');
    if (L && (L.dead || L.dormant || L.pos.distanceTo(P.pos) > 40 || !L.root.visible)) { this.lock = null; }
    if (!this.lock) { rt?.classList.add('hidden'); return; }
    const v = this.lock.pos.clone().setY(this.lock.pos.y + Math.min(this.lock.tall * 0.55, 3)).project(G.camera);
    if (v.z > 1) { rt.classList.add('hidden'); return; }
    rt.classList.remove('hidden');
    rt.style.left = ((v.x + 1) / 2) * innerWidth + 'px';
    rt.style.top = ((1 - v.y) / 2) * innerHeight + 'px';
  }
}
