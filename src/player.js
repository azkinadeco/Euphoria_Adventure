// Player controller: a party of up to 3 heroes sharing one body position (switching).
// Movement, stamina and hunger are shared; HP, energy, cooldowns and shields are per hero.
import * as THREE from 'three';
import { applyKit } from './assets.js';
import { sfx } from './sfx.js';
import { angleDiff } from './enemies.js';
import { HEROES, PARTY_ORDER, chaosEl } from './heroes.js';
import { WEAPON_BY_ID } from './gacha.js';
import { applyRim } from './toon.js';
import { boostGlow } from './graphics.js';

const MELEE = [
  null,
  { dur: 0.42, hit: 0.3, mult: 0.62, range: 2.4, cone: 0.15, knock: 3 },
  { dur: 0.42, hit: 0.3, mult: 0.7, range: 2.4, cone: 0.15, knock: 3 },
  { dur: 0.62, hit: 0.52, mult: 1.35, range: 3.0, aoe: true, knock: 8, stun: 0.3 },
];
const SWORD = [
  null,
  { dur: 0.48, hit: 0.32, mult: 0.75, range: 2.8, cone: 0.0, knock: 4 },
  { dur: 0.48, hit: 0.32, mult: 0.8, range: 2.8, cone: 0.0, knock: 4 },
  { dur: 0.7, hit: 0.5, mult: 1.5, range: 3.4, aoe: true, knock: 10, stun: 0.4 },
];
const SCYTHE = [
  null,
  { dur: 0.45, hit: 0.3, mult: 0.8, range: 3.3, cone: -0.3, knock: 4 },
  { dur: 0.45, hit: 0.3, mult: 0.85, range: 3.3, cone: -0.3, knock: 4 },
  { dur: 0.7, hit: 0.48, mult: 1.6, range: 3.8, aoe: true, knock: 9, stun: 0.3 },
];
const CAST = [null, { dur: 0.42, hit: 0.2, mult: 0.55, bolts: 1 }, { dur: 0.42, hit: 0.2, mult: 0.55, bolts: 1 }, { dur: 0.6, hit: 0.3, mult: 0.5, bolts: 3 }];

class Member {
  constructor(id, level) {
    this.id = id;
    this.def = HEROES[id];
    this.rig = this.def.make();
    applyRim(this.rig.root, 0xffffff, 0.45);
    boostGlow(this.rig.root);
    this.level = level;
    this.artifacts = { flower: null, plume: null, sands: null, goblet: null, circlet: null };
    this.weapon = null;
    this.maxHp = this.hp = this.calcMaxHp(level);
    this.energy = 0;
    this.cd = { skill: 0, burst: 0 };
    this.shield = 0; this.shieldT = 0;
  }
  getArtifactBonus() {
    let flatHp = 0, flatAtk = 0, atkPct = 0, critRate = 0, critDmg = 0, erPct = 0, elemDmg = 0, normalDmg = 0, burstDmg = 0, cdr = 0;
    const setCounts = {};
    for (const art of Object.values(this.artifacts)) {
      if (!art) continue;
      setCounts[art.set] = (setCounts[art.set] || 0) + 1;
      if (art.slot === 'flower') flatHp += art.mainVal;
      else if (art.slot === 'plume') flatAtk += art.mainVal;
      else if (art.slot === 'sands') {
        if (art.mainStat === 'atk_pct') atkPct += art.mainVal;
        else if (art.mainStat === 'er') erPct += art.mainVal;
      } else if (art.slot === 'goblet') {
        if (art.mainStat === 'elem_dmg') elemDmg += art.mainVal;
        else if (art.mainStat === 'atk_pct') atkPct += art.mainVal;
      } else if (art.slot === 'circlet') {
        if (art.mainStat === 'crit_rate') critRate += art.mainVal;
        else if (art.mainStat === 'crit_dmg') critDmg += art.mainVal;
      }
    }
    if ((setCounts['gladiator'] || 0) >= 2) atkPct += 0.18;
    if ((setCounts['viridescent'] || 0) >= 2 && this.def.element === 'WIND') elemDmg += 0.15;
    if ((setCounts['crimson'] || 0) >= 2 && this.def.element === 'FIRE') elemDmg += 0.15;
    if ((setCounts['blizzard'] || 0) >= 2 && this.def.element === 'ICE') elemDmg += 0.15;
    if ((setCounts['celestial'] || 0) >= 2) burstDmg += 0.20;
    if ((setCounts['abyssal'] || 0) >= 2 && ['DARK', 'LIGHTNING'].includes(this.def.element)) elemDmg += 0.15;

    const w = WEAPON_BY_ID[this.weapon]?.stats;
    if (w) { atkPct += w.atkPct || 0; critRate += w.critRate || 0; critDmg += w.critDmg || 0; elemDmg += w.elemDmg || 0; normalDmg += w.normalDmg || 0; burstDmg += w.burstDmg || 0; cdr += w.cdr || 0; }
    return { flatHp, flatAtk, atkPct, critRate, critDmg, erPct, elemDmg, normalDmg, burstDmg, cdr, setCounts };
  }
  /** re-apply max HP after gear changes, keeping the current health ratio */
  refreshHp() { const r = this.maxHp ? this.hp / this.maxHp : 1; this.maxHp = this.calcMaxHp(this.level); this.hp = Math.min(this.maxHp, Math.max(this.hp > 0 ? 1 : 0, this.maxHp * r)); }
  calcMaxHp(lv) {
    const base = Math.round((120 + (lv - 1) * 18) * this.def.hpMul);
    const flat = this.artifacts?.flower ? (this.artifacts.flower.mainVal || 0) : 0;
    return base + flat;
  }
  get dead() { return this.hp <= 0; }
}

export class Player {
  constructor(game) {
    this.game = game;
    this.root = new THREE.Group();
    game.scene.add(this.root);
    this.level = 1; this.exp = 0;
    this.members = [];
    this.active = 0;
    this.cache = {}; // every recruited hero (team of up to 4 + bench)
    // wind glider (shared by every hero)
    this.glider = new THREE.Group();
    const gm = new THREE.MeshToonMaterial({ color: 0xf6f0e0, side: THREE.DoubleSide });
    const sail = new THREE.Shape(); sail.moveTo(0, 0); sail.lineTo(1.3, -0.25); sail.lineTo(0.9, -0.55); sail.lineTo(0, -0.35); sail.lineTo(0, 0);
    for (const sx of [-1, 1]) { const w = new THREE.Mesh(new THREE.ShapeGeometry(sail), gm); w.scale.x = sx; w.rotation.x = -Math.PI / 2 + 0.25; w.position.set(0, 1.75, -0.1); this.glider.add(w); }
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.4, 6), new THREE.MeshToonMaterial({ color: 0x8a5a2a })); bar.rotation.z = Math.PI / 2; bar.position.y = 1.75; this.glider.add(bar);
    applyKit('kit_glider', this.glider, { sail: gm, bar: bar.material }, [...this.glider.children], { ol: 0.01 });
    this.glider.visible = false;
    game.scene && this.root.add(this.glider);
    this.coolT = 0; this.heatTick = 0; this.lavaTick = 0;
    this.commanderBuffT = 0;
    this.addMember('luby');

    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.vy = 0;
    this.facing = 0;
    this.grounded = true;
    this.doubleUsed = false;
    this.flipT = 0;
    this.stamina = 100; this.staminaDelay = 0; this.exhausted = false;
    this.hunger = 100;
    this.combo = 0; this.comboWindow = 0; this.queued = false;
    this.action = null; this.actionT = 0; this.actionDur = 0; this.actionData = null;
    this.iframes = 0; this.hurtT = 0; this.combatT = 99; this.switchCD = 0;
    this.dead = false; this.deadT = 0;
    this.speedNow = 0;
    this.waterMsgT = 0;
  }

  // ---------- party ----------
  /** recruit a hero; joins the active team if there is room (max 4), otherwise waits on the bench */
  addMember(id) {
    if (this.cache[id]) return this.cache[id];
    const m = new Member(id, this.level);
    this.cache[id] = m;
    if (this.members.length >= 4) return m;
    m.rig.root.visible = this.members.length === 0;
    this.root.add(m.rig.root);
    this.members.push(m);
    this.members.sort((a, b) => PARTY_ORDER.indexOf(a.id) - PARTY_ORDER.indexOf(b.id));
    this.active = this.members.findIndex((x) => x.rig.root.visible);
    return m;
  }
  get roster() { return Object.values(this.cache).sort((a, b) => PARTY_ORDER.indexOf(a.id) - PARTY_ORDER.indexOf(b.id)); }
  /** choose the active team (1–4 recruited heroes) */
  setTeam(ids) {
    ids = ids.filter((id) => this.cache[id]).slice(0, 4);
    if (!ids.length) return false;
    const cur = this.m?.id;
    for (const m of this.members) this.root.remove(m.rig.root);
    this.members = ids.map((id) => this.cache[id]).sort((a, b) => PARTY_ORDER.indexOf(a.id) - PARTY_ORDER.indexOf(b.id));
    for (const m of this.members) { m.rig.root.visible = false; this.root.add(m.rig.root); }
    let ai = this.members.findIndex((m) => m.id === cur && !m.dead);
    if (ai < 0) ai = Math.max(0, this.members.findIndex((m) => !m.dead));
    this.active = ai;
    this.m.rig.root.visible = true;
    this.action = null;
    return true;
  }
  get m() { return this.members[this.active]; }
  get hero() { return this.m.def; }
  get luby() { return this.m.rig; }
  get hp() { return this.m.hp; }
  set hp(v) { this.m.hp = v; }
  get maxHp() { return this.m.maxHp; }
  get energy() { return this.m.energy; }
  set energy(v) { this.m.energy = v; }
  get cd() { return this.m.cd; }
  get atk() {
    let base = (30 + (this.level - 1) * 5) * this.hero.atkMul;
    if (this.commanderBuffT > 0) base *= 1.25;
    if (this.celestialT > 0) base *= 1.25;
    if (this.game.cooking) base *= this.game.cooking.getAtkMultiplier();
    if (this.m?.getArtifactBonus) {
      const b = this.m.getArtifactBonus();
      base = (base + b.flatAtk) * (1 + b.atkPct);
    }
    return Math.round(base);
  }
  expNeed() { return Math.round(60 * Math.pow(this.level, 1.4)); }

  healAll(frac, revive = false) {
    for (const m of revive ? Object.values(this.cache) : this.members) {
      if (m.dead && !revive) continue;
      const before = m.hp;
      m.hp = Math.min(m.maxHp, Math.max(m.hp, 0) + m.maxHp * frac);
      if (m === this.m && m.hp > before) this.game.ui.damageNumber(this.pos.clone().setY(this.pos.y + 1.9), Math.round(m.hp - before), 'heal');
    }
  }

  switchTo(i, force = false) {
    const G = this.game;
    if (i === this.active || !this.members[i]) return false;
    if (!force && (this.members[i].dead || this.switchCD > 0 || this.dead || G.inputLocked || (this.action && this.action !== 'attack' && this.action !== 'eat'))) {
      if (this.members[i].dead) G.ui.toast(this.members[i].def.name + ' tumbang — istirahat untuk memulihkan');
      return false;
    }
    if (this.members[i].dead) return false;
    if (this.swimming && !this.members[i].def.swim) {
      if (!force) { G.ui.toast('Hanya Scylla yang bisa berenang di air dalam'); return false; }
      if (this.lastLand) this.placeAt(this.lastLand);
      this.swimming = false;
    }
    this.m.rig.root.visible = false;
    this.active = i;
    this.m.rig.root.visible = true;
    this.action = null; this.combo = 0;
    this.switchCD = 1.0;
    this.iframes = Math.max(this.iframes, 0.3);
    G.vfx.particles(this.pos.clone().setY(this.pos.y + 0.9), 24, this.hero.color, { speed: 4, up: 2, life: 0.5 });
    G.vfx.shockwave(this.pos, 1.6, this.hero.color, 0.35);
    G.ui.onSwitch();
    if (Math.random() < 0.6) G.ui.voice('swap');
    sfx.ui();
    return true;
  }

  addExp(n) {
    this.exp += n;
    while (this.exp >= this.expNeed()) {
      this.exp -= this.expNeed();
      this.level++;
      for (const m of Object.values(this.cache)) { m.level = this.level; m.maxHp = m.calcMaxHp(this.level); m.hp = m.maxHp; }
      this.game.ui.toast(`LEVEL UP!  Lv.${this.level}`, 'gold big');
      sfx.quest();
      this.game.vfx.pillar(this.pos, 0xffe066, 8, 1);
    }
  }

  placeAt(p, facing = this.facing) {
    this.pos.copy(p); this.pos.y = this.game.world.groundAt(p.x, p.z);
    this.vel.set(0, 0, 0); this.vy = 0; this.facing = facing;
    this.root.position.copy(this.pos); this.root.rotation.y = facing;
  }

  startAction(name, dur, data = null) { this.action = name; this.actionT = 0; this.actionDur = dur; this.actionData = data; this._hitDone = false; this._ticks = 0; }

  nearestEnemy(maxD, preferFront = true) {
    const L = this.game.combat?.lock;
    if (L && !L.dead && Math.hypot(L.pos.x - this.pos.x, L.pos.z - this.pos.z) < maxD * 1.5) return L;
    let best = null, bd = Infinity;
    const fx = Math.sin(this.facing), fz = Math.cos(this.facing);
    for (const e of this.game.enemies) {
      if (e.dead || e.dormant) continue;
      const dx = e.pos.x - this.pos.x, dz = e.pos.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d > maxD) continue;
      const score = d - (preferFront ? ((dx * fx + dz * fz) / (d + 0.01)) * 3 : 0);
      if (score < bd) { bd = score; best = e; }
    }
    return best;
  }

  faceToward(p) { this.facing = Math.atan2(p.x - this.pos.x, p.z - this.pos.z); }
  _camDir(input, camYaw) {
    const ax = input.axis();
    if (ax.mag < 0.1) return null;
    const fwd = new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const w = fwd.multiplyScalar(ax.y).addScaledVector(right, ax.x);
    return Math.atan2(w.x, w.z);
  }

  update(dt, input, camYaw) {
    const G = this.game, W = G.world;
    const events = G.inputLocked ? [] : input.consume();
    if (G.inputLocked) input.consume();

    for (const m of this.members) {
      m.cd.skill = Math.max(0, m.cd.skill - dt); m.cd.burst = Math.max(0, m.cd.burst - dt);
      if (m.shieldT > 0) { m.shieldT -= dt; if (m.shieldT <= 0) m.shield = 0; }
    }
    this.iframes -= dt; this.hurtT -= dt; this.combatT += dt; this.comboWindow -= dt; this.waterMsgT -= dt; this.switchCD -= dt;
    if (this.flipT > 0) this.flipT = Math.max(0, this.flipT - dt / 0.45);

    if (this.dead) {
      this.deadT += dt;
      this.luby.update(dt, { dead: true, grounded: true });
      if (this.deadT > 3) G.respawn();
      return;
    }

    // ---------------- survival ----------------
    const sprintWanted = input.sprint && !this.exhausted;
    this.hunger = Math.max(0, this.hunger - dt * (0.22 + (sprintWanted && this.speedNow > 6 ? 0.3 : 0)));
    // volcanic heat: drink Jus Sejuk (cooking) to stay cool
    this.coolT = Math.max(0, this.coolT - dt);
    this.warmT = Math.max(0, (this.warmT || 0) - dt);
    this.commanderBuffT = Math.max(0, this.commanderBuffT - dt);
    this.celestialT = Math.max(0, (this.celestialT || 0) - dt);
    this.chill = Math.max(0, (this.chill || 0) - dt);
    const cold = G.coldAt ? G.coldAt(this.pos.x, this.pos.z) : 0;
    this.nearWarm = G.nearWarm ? G.nearWarm(this.pos) : false;
    this.freezing = (cold > 0.3 || G.blizzard > 0) && this.warmT <= 0 && !this.hero.coldImmune && !this.nearWarm && !(G.cooking && G.cooking.isColdImmune());
    if (this.freezing || this.chill > 0) {
      this.coldTick = (this.coldTick || 0) - dt * (G.blizzard > 0 ? 3 : 1);
      if (this.coldTick <= 0) {
        this.coldTick = 3;
        this.hp = Math.max(1, this.hp - this.maxHp * (G.blizzard > 0 ? 0.05 : 0.025));
        this.stamina = Math.max(0, this.stamina - 10);
        if (!this._coldMsg || G.world.time - this._coldMsg > 20) { this._coldMsg = G.world.time; G.ui.toast(G.blizzard > 0 ? '🌨 Badai salju! Berlindung di dekat anglo api!' : '❄ Kedinginan! Dekati api atau minum Sup Pedas (B)'); }
      }
    }
    const heat = G.heatAt ? G.heatAt(this.pos.x, this.pos.z) : 0;
    this.hot = heat > 0.3 && this.coolT <= 0 && !(G.cooking && G.cooking.isHeatImmune());
    if (this.hot) {
      this.hunger = Math.max(0, this.hunger - dt * 0.8 * heat);
      this.heatTick -= dt;
      if (this.heatTick <= 0) {
        this.heatTick = 3;
        this.hp = Math.max(1, this.hp - this.maxHp * 0.025);
        if (!this._heatMsg || G.world.time - this._heatMsg > 20) { this._heatMsg = G.world.time; G.ui.toast('🔥 Kepanasan! Masak & minum Jus Sejuk di api unggun (V)'); }
      }
    }
    if (G.lavaAt && G.lavaAt(this.pos.x, this.pos.z) && this.grounded) {
      this.lavaTick -= dt;
      if (this.lavaTick <= 0) { this.lavaTick = 0.4; this.iframes = 0; this.damage(this.maxHp * 0.12, null, 0); G.vfx.particles(this.pos.clone().setY(this.pos.y + 0.3), 10, 0xff6a1a, { speed: 3, up: 3, life: 0.5 }); }
    }
    if (this.hunger <= 0) { this.hp -= dt * 1.2; if (Math.random() < dt * 0.15) G.ui.toast('Party kelaparan… cari makanan! 🍖'); }
    else if (this.hunger > 50 && this.combatT > 5) for (const m of this.members) if (!m.dead && m.hp < m.maxHp) m.hp = Math.min(m.maxHp, m.hp + dt * 1.5);
    if (this.hp <= 0) { this._downed(); if (this.dead) return; }

    // ---------------- input events ----------------
    for (const ev of events) {
      if (ev === 'attack') this._tryAttack(input, camYaw);
      else if (ev === 'skill') this._trySkill();
      else if (ev === 'burst') this._tryBurst();
      else if (ev === 'jump') this._tryJump();
      else if (ev === 'dash') this._tryDash(input, camYaw);
      else if (ev === 'interact') G.interact();
      else if (ev === 'eat1') G.eat('berry');
      else if (ev === 'eat2') G.eat('fish');
      else if (ev === 'eat3') G.eat('grilled');
      else if (ev === 'eat4') G.eat('cool');
      else if (ev === 'eat5') G.eat('soup');
      else if (ev === 'menu') G.ui.toggleMenu();
      else if (ev === 'lock') G.combat.toggleLock();
      else if (ev === 'sight') G.sight?.toggle();
      else if (ev === 'photo') G.photo?.open();
      else if (ev === 'map') G.map?.toggle();
      else if (ev.startsWith('sw')) this.switchTo(+ev.slice(2));
    }

    // ---------------- movement ----------------
    const ax = G.inputLocked ? { x: 0, y: 0, mag: 0 } : input.axis();
    const fwd = new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const wish = new THREE.Vector3().addScaledVector(fwd, ax.y).addScaledVector(right, ax.x);
    let sprinting = false, target = 0;
    const busy = this.action && this.action !== 'eat';
    if (!busy && ax.mag > 0.05) {
      sprinting = sprintWanted && this.stamina > 0 && this.grounded;
      target = (sprinting ? 9.2 : 5.6) * Math.max(ax.mag, 0.35) * (this.hero.speedMul || 1);
      this.facing += angleDiff(Math.atan2(wish.x, wish.z), this.facing) * (1 - Math.exp(-14 * dt));
    }
    if (this.action === 'eat') target *= 0.4;
    if (W.heightAt(this.pos.x, this.pos.z) < -0.2 && !this.hero.swim) target *= 0.55;
    if (this.swimming) target = ax.mag > 0.05 ? (sprinting ? 8.5 : 5.2) * Math.max(ax.mag, 0.35) : 0;
    if (this.gliding) target = 8.5;
    this.speedNow += (target - this.speedNow) * (1 - Math.exp(-(target > this.speedNow ? 10 : 14) * dt));
    const move = new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing)).multiplyScalar(this.speedNow);

    const staMult = G.cooking ? G.cooking.getStaminaCostMultiplier() : 1.0;
    if (this.gliding) { this.stamina -= 7 * staMult * dt; this.staminaDelay = 0.8; if (this.stamina <= 0) { this.stamina = 0; this.gliding = false; this.exhausted = true; } }
    else if (sprinting && this.speedNow > 6) { this.stamina -= 18 * (this.hero.staminaMul || 1) * staMult * dt; this.staminaDelay = 0.8; if (this.stamina <= 0) { this.stamina = 0; this.exhausted = true; } }
    else { this.staminaDelay -= dt; if (this.staminaDelay <= 0) this.stamina = Math.min(100, this.stamina + 30 * dt); }
    if (this.exhausted && this.stamina > 30) this.exhausted = false;

    // ---------------- charged attack (hold) ----------------
    if (input.attackHeld && !G.inputLocked && this.grounded && !this.swimming && (!this.action || this.action === 'attack' || this.actionData?.isAttack)) {
      this.chargeT = (this.chargeT || 0) + dt;
      if (this.chargeT > 0.2 && !this._chargeFx) { this._chargeFx = true; sfx.charge(); }
      if (this.chargeT > 0.2 && Math.random() < 0.5) G.vfx.particles(this.pos.clone().setY(this.pos.y + 0.9), 1, this.hero.color, { speed: 2.5, up: 1, life: 0.3, grav: 0 });
      if (this.chargeT > 0.45 && !this._charged) {
        this._charged = true;
        if (this.stamina >= 20) this._startCharged();
        else G.ui.toast('Stamina kurang untuk serangan charged');
      }
    } else if (!input.attackHeld) { this.chargeT = 0; this._charged = false; this._chargeFx = false; }

    // ---------------- actions ----------------
    if (this.action) {
      this.actionT += dt;
      this._updateAction(dt, move);
      if (this.action && this.actionT >= this.actionDur) {
        const was = this.action, wasAttack = this.actionData?.isAttack;
        this.action = null;
        if (was === 'attack' || wasAttack) { this.comboWindow = 0.55; if (this.queued) { this.queued = false; this._tryAttack(input, camYaw); } }
      }
    }

    const prev = this.pos.clone();
    this.pos.addScaledVector(move, dt);
    this.pos.addScaledVector(this.vel, dt);
    this.vel.multiplyScalar(Math.exp(-7 * dt));
    W.collide(this.pos, 0.35);
    for (const e of G.enemies) {
      if (e.dead) continue;
      const dx = this.pos.x - e.pos.x, dz = this.pos.z - e.pos.z, d = Math.hypot(dx, dz), mm = e.radius + 0.35;
      if (d < mm && d > 0.001 && Math.abs(this.pos.y - e.pos.y) < 2.5) { this.pos.x = e.pos.x + dx / d * mm; this.pos.z = e.pos.z + dz / d * mm; }
    }
    if (!this.hero.swim && this.grounded && this.pos.y > -0.3 && W.groundAt(this.pos.x, this.pos.z) < -1.3) {
      this.pos.x = prev.x; this.pos.z = prev.z; this.speedNow *= 0.5;
      if (this.waterMsgT <= 0) {
        G.ui.toast(this.hero.id === 'luby' ? '“Nyaa! Air dalam! Aku benci mandi!” 💦' : 'Airnya terlalu dalam untuk diseberangi.');
        this.waterMsgT = 4;
      }
    }
    if (!W.realm && !W.arenaFloor) { this.pos.x = Math.min(600, Math.max(-635, this.pos.x)); this.pos.z = Math.min(235, Math.max(-630, this.pos.z)); }

    // swimming (Scylla only): deep water keeps her at the surface
    const groundHere = W.groundAt(this.pos.x, this.pos.z);
    this.swimming = !!this.hero.swim && groundHere < -1.2 && this.pos.y < 0.3;
    if (this.swimming) {
      if (this.action && this.action !== 'burst') this.action = null;
      this.pos.y += (-0.55 - this.pos.y) * (1 - Math.exp(-8 * dt)); this.vy = 0; this.grounded = true; this.doubleUsed = false;
      if (this.speedNow > 1 && Math.random() < 0.5) G.vfx.particles(new THREE.Vector3(this.pos.x, 0.05, this.pos.z), 2, 0xd8f4ff, { speed: 1.5, up: 1.5, life: 0.4 });
    } else if (groundHere > 0.2 && this.grounded) this.lastLand = this.pos.clone();
    const gh = Math.max(groundHere, -0.9);
    if (this.action === 'plunge') this.vy = -34;
    if (this.action !== 'pounce' && !this.swimming) {
      this.vy -= 24 * dt;
      if (this.gliding) this.vy = Math.max(this.vy, -2.4);
      this.pos.y += this.vy * dt;
    }
    if (!this.swimming && (this.pos.y <= gh || (this.grounded && this.vy <= 0 && this.pos.y - gh < 0.45))) {
      if (!this.grounded && this.vy < -12) { sfx.land(); G.vfx.particles(this.pos, 8, 0xd8e8c0, { speed: 3, up: 1, life: 0.4 }); }
      this.pos.y = gh; this.vy = 0; this.grounded = true; this.doubleUsed = false; this.gliding = false;
      if (this.action === 'plunge') this._plungeImpact();
    } else if (!this.swimming) this.grounded = false;
    // fell into deep water (non-swimmer): pulled back to the last safe ground
    if (!this.hero.swim && this.grounded && groundHere < -1.3 && this.pos.y < -0.3) {
      if (this.lastLand) this.placeAt(this.lastLand);
      this.damage(this.maxHp * 0.08, null, 0);
      G.ui.toast(this.hero.id === 'luby' ? '“NYAAA! BASAH!” — kembali ke daratan' : 'Tercebur! Kembali ke daratan', '');
      G.vfx.particles(new THREE.Vector3(this.pos.x, 0.2, this.pos.z), 30, 0xd8f4ff, { speed: 4, up: 5, life: 0.6 });
    }
    this.glider.visible = !!this.gliding;
    if (this.gliding && Math.random() < 0.3) G.vfx.particles(this.pos.clone().setY(this.pos.y + 1.2), 1, 0xffffff, { speed: 0.5, up: 0, life: 0.5, grav: 0 });

    this.root.position.copy(this.pos);
    this.root.rotation.y = this.facing + (this.action === 'charged' && !this.actionData?.mage ? Math.min(1, this.actionT / this.actionDur) * Math.PI * 4 : 0);
    this.sprinting = sprinting && this.speedNow > 6.5;
    this.luby.update(dt, {
      speed: this.speedNow, sprint: this.sprinting, grounded: this.grounded || this.action === 'pounce', vy: this.vy,
      action: this.action === 'ambush' || this.action === 'judgement' ? 'attack' : this.action === 'plunge' ? 'pounce' : this.action === 'charged' ? (this.actionData?.mage ? 'cast' : 'spin') : this.action,
      actionT: this.action === 'plunge' ? 0.5 : this.actionDur ? this.actionT / this.actionDur : 0, combo: this.action === 'ambush' || this.action === 'judgement' ? 3 : this.combo,
      hurtT: this.hurtT, flipT: this.flipT, swim: this.swimming, glide: this.gliding,
    });
  }

  // ---------------- normal attack ----------------
  _tryAttack(input, camYaw) {
    if (this.swimming) return;
    // plunge attack from height
    if (!this.grounded && (!this.action || this.action === 'dash') && this.pos.y - this.game.world.groundAt(this.pos.x, this.pos.z) > 2.2) {
      this.gliding = false;
      this.startAction('plunge', 4, { startY: this.pos.y });
      this.iframes = 0.4;
      sfx.dash();
      return;
    }
    if (this.action && (this.action === 'attack' || this.actionData?.isAttack)) { this.queued = true; return; }
    if (this.action) return;
    this.combo = this.comboWindow > 0 && this.combo < 3 ? this.combo + 1 : 1;
    const id = this.hero.id;
    const ranged = id === 'mora' || id === 'rumi' || id === 'gemora';
    const e = this.nearestEnemy(ranged ? 18 : 6);
    if (e) this.faceToward(e.pos);
    else { const f = this._camDir(input, camYaw); if (f !== null) this.facing = f; }
    if (ranged) {
      const A = CAST[this.combo];
      this.startAction('cast', A.dur, { ...A, isAttack: true, target: e });
    } else {
      const A = (id === 'fidelia' || id === 'valeria' || id === 'commander' || id === 'kali' ? SWORD : id === 'scylla' ? SCYTHE : MELEE)[this.combo];
      this.startAction('attack', A.dur, A);
    }
    this.speedNow = 0;
    sfx.swing();
  }

  // ---------------- elemental skill (E) ----------------
  _trySkill() {
    const G = this.game, H = this.hero;
    if (this.cd.skill > 0 || (this.action && this.action !== 'attack' && !this.actionData?.isAttack)) { if (this.cd.skill > 0) G.ui.flashSkill('e'); return; }
    if (H.id === 'luby') {
      const e = this.nearestEnemy(14);
      let target;
      if (e) { this.faceToward(e.pos); target = e.pos.clone().addScaledVector(new THREE.Vector3(this.pos.x - e.pos.x, 0, this.pos.z - e.pos.z).normalize(), e.radius + 0.6); }
      else target = this.pos.clone().add(new THREE.Vector3(Math.sin(this.facing) * 7, 0, Math.cos(this.facing) * 7));
      target.y = G.world.groundAt(target.x, target.z);
      this.startAction('pounce', 0.78, { from: this.pos.clone(), to: target });
      this.iframes = 0.7;
      sfx.pounce();
    } else if (H.id === 'eropatra' || H.id === 'rumi') {
      // both strike the FURTHEST enemy in range, as in the original skills
      let far = null, fd = -1;
      for (const e of G.enemies) {
        if (e.dead || e.dormant) continue;
        const d = Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z);
        if (d < (H.id === 'rumi' ? 18 : 12) && d > fd) { fd = d; far = e; }
      }
      if (H.id === 'eropatra') {
        if (far) this.faceToward(far.pos);
        const to = far ? far.pos.clone().addScaledVector(new THREE.Vector3(far.pos.x - this.pos.x, 0, far.pos.z - this.pos.z).normalize(), far.radius + 1.2)
          : this.pos.clone().add(new THREE.Vector3(Math.sin(this.facing) * 10, 0, Math.cos(this.facing) * 10));
        if (!this.hero.swim && G.world.groundAt(to.x, to.z) < -1.2) to.copy(far ? far.pos : this.pos);
        this.startAction('fang', 0.55, { from: this.pos.clone(), to, hit: new Set() });
        this.iframes = 0.55; sfx.dash();
      } else {
        if (!far) { G.ui.toast('Tidak ada target dalam jangkauan'); return; }
        this.faceToward(far.pos);
        this.startAction('cast', 0.6, { exorcism: true, target: far });
      }
    } else if (H.id === 'gemora') {
      const e = this.nearestEnemy(30); if (e) this.faceToward(e.pos);
      this.startAction('cast', 0.6, { railgun: true });
    } else if (H.id === 'micca') {
      this.startAction('cast', 0.7, { pandora: true });
    } else if (H.id === 'valeria') {
      const e = this.nearestEnemy(10); if (e) this.faceToward(e.pos);
      this.startAction('judgement', 0.65, {});
      this.iframes = 0.3; sfx.swing();
    } else if (H.id === 'glytta') {
      const e = this.nearestEnemy(10); if (e) this.faceToward(e.pos);
      const to = this.pos.clone().add(new THREE.Vector3(Math.sin(this.facing) * 10, 0, Math.cos(this.facing) * 10));
      if (G.world.groundAt(to.x, to.z) < -1.2) to.copy(this.pos.clone().add(new THREE.Vector3(Math.sin(this.facing) * 3, 0, Math.cos(this.facing) * 3)));
      this.startAction('fang', 0.5, { from: this.pos.clone(), to, hit: new Set(), element: 'WIND', mult: 1.4, color: 0x7ff0e0 });
      this.iframes = 0.5; sfx.dash();
    } else if (H.id === 'scylla') {
      // Kraken Ambush: strike the FURTHEST enemy in range (as in the original skill)
      let far = null, fd = -1;
      for (const e of G.enemies) {
        if (e.dead || e.dormant) continue;
        const d = Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z);
        if (d < 15 && d > fd) { fd = d; far = e; }
      }
      if (!far) { G.ui.toast('Tidak ada mangsa dalam jangkauan'); return; }
      this.startAction('ambush', 0.75, { target: far });
      this.iframes = 0.8;
      sfx.dash();
    } else if (H.id === 'fidelia') {
      const e = this.nearestEnemy(8);
      if (e) this.faceToward(e.pos);
      this.startAction('bash', 0.55, {});
      this.iframes = 0.3;
      sfx.dash();
    } else if (H.id === 'kali') {
      const e = this.nearestEnemy(14); if (e) this.faceToward(e.pos);
      this.startAction('cast', 0.7, { bladeRain: true });
    } else if (H.id === 'commander') {
      const e = this.nearestEnemy(12);
      if (e) this.faceToward(e.pos);
      const to = this.pos.clone().add(new THREE.Vector3(Math.sin(this.facing) * 9, 0, Math.cos(this.facing) * 9));
      if (G.world.groundAt(to.x, to.z) < -1.2) to.copy(this.pos.clone().add(new THREE.Vector3(Math.sin(this.facing) * 3, 0, Math.cos(this.facing) * 3)));
      this.startAction('fang', 0.45, { from: this.pos.clone(), to, hit: new Set(), element: 'LIGHT', mult: 2.6, color: 0xffd700 });
      this.m.shield = Math.max(this.m.shield, this.m.maxHp * 0.2);
      this.m.shieldT = 8.0;
      this.iframes = 0.45;
      sfx.dash();
    } else {
      const e = this.nearestEnemy(16);
      if (e) this.faceToward(e.pos);
      const c = e ? e.pos.clone() : this.pos.clone().add(new THREE.Vector3(Math.sin(this.facing) * 7, 0, Math.cos(this.facing) * 7));
      this.startAction('cast', 0.6, { skill: true, center: c });
    }
    this.cd.skill = H.skillCD * (1 - this.m.getArtifactBonus().cdr);
    this.speedNow = 0;
    if (Math.random() < 0.4) G.ui.voice('skill');
  }

  // ---------------- burst (Q) ----------------
  _tryBurst() {
    const G = this.game, H = this.hero;
    if (H.id === 'luby' && !G.state.purrbot) { G.ui.toast('Purr-Bot belum diperbaiki… (selesaikan quest)'); return; }
    if (this.cd.burst > 0 || this.energy < H.burstCost || (this.action && this.action !== 'attack' && !this.actionData?.isAttack)) { G.ui.flashSkill('q'); return; }
    const e = this.nearestEnemy(14);
    if (e) this.faceToward(e.pos);
    const center = e ? e.pos.clone() : this.pos.clone().add(new THREE.Vector3(Math.sin(this.facing) * 5, 0, Math.cos(this.facing) * 5));
    this.startAction('burst', { mora: 1.4, scylla: 1.5, eropatra: 1.5, rumi: 1.3, glytta: 1.5, valeria: 1.2, gemora: 1.6, micca: 1.5, commander: 1.6, kali: 1.7 }[H.id] || 1.0, { center });
    this.energy = 0;
    this.cd.burst = H.burstCD;
    if ((this.m.getArtifactBonus().setCounts.celestial || 0) >= 4) this.celestialT = 12;
    this.iframes = 1.1;
    this.speedNow = 0;
    G.burstCinematic(H);
    sfx.burst();
  }

  _tryJump() {
    if (this.action && this.action !== 'attack' && !this.actionData?.isAttack) return;
    if (this.grounded) { this.vy = 8.6; this.grounded = false; this.action = null; sfx.jump(); }
    else if (!this.doubleUsed && this.stamina >= 10) {
      this.doubleUsed = true; this.vy = 8.2; this.flipT = 1; this.stamina -= 10; this.staminaDelay = 0.8;
      sfx.jump(); this.game.vfx.particles(this.pos.clone().setY(this.pos.y + 0.3), 12, this.hero.color, { speed: 3, up: -1, life: 0.4, grav: 0 });
    } else if (this.gliding) this.gliding = false;
    else if (this.stamina > 5 && !this.swimming) {
      this.gliding = true; this.action = null; sfx.dash();
      if (!this.game.state.glideHint) { this.game.state.glideHint = true; this.game.ui.toast('Glider terbuka! Tekan lompat lagi untuk menutup.', 'gold'); }
    }
  }

  _tryDash(input, camYaw) {
    if (this.stamina < 20 || (this.action && this.action !== 'attack' && !this.actionData?.isAttack)) return;
    const f = this._camDir(input, camYaw); if (f !== null) this.facing = f;
    this.stamina -= 20 * (this.hero.staminaMul || 1); this.staminaDelay = 0.8;
    this.startAction('dash', 0.3);
    this._pdUsed = false;
    this.game.combat.fovKick = Math.max(this.game.combat.fovKick, 3);
    this.iframes = 0.32;
    sfx.dash();
  }

  // ---------------- charged & plunge ----------------
  _startCharged() {
    const H = this.hero, G = this.game;
    this.stamina -= 20; this.staminaDelay = 0.9;
    const mage = H.id === 'mora' || H.id === 'rumi' || H.id === 'gemora';
    const e = this.nearestEnemy(mage ? 18 : 7);
    if (e) this.faceToward(e.pos);
    this.startAction('charged', mage ? 0.75 : 0.7, { mage, target: e });
    this.queued = false; this.speedNow = 0;
    this.iframes = Math.max(this.iframes, 0.25);
    G.vfx.shockwave(this.pos, 1.6, H.color, 0.3);
    sfx.swing();
  }
  _chargedHit(center, radius, mult, launch) {
    const G = this.game, H = this.hero;
    const col = H.color;
    G.vfx.shockwave(center, radius, col, 0.4); G.vfx.shockwave(center, radius * 0.6, 0xffffff, 0.25);
    G.vfx.particles(center.clone().setY(center.y + 0.6), 30, col, { speed: 9, up: 3, life: 0.5 });
    let hits = 0;
    for (const en of G.enemies) {
      if (en.dead || en.dormant) continue;
      if (Math.hypot(en.pos.x - center.x, en.pos.z - center.z) < radius + en.radius) { G.dealDamage(en, this.atk * mult, { element: H.element === 'CHAOS' ? chaosEl() : H.element, knock: 7, poise: 26, launch }); hits++; }
    }
    if (hits) { this._gainEnergy(4 + hits); G.hitstop(0.07); G.shake(0.25); sfx.heavy(); }
  }
  _plungeImpact() {
    const G = this.game, D = this.actionData;
    const h = Math.max(0, D.startY - this.pos.y);
    const radius = 3 + Math.min(h, 25) * 0.12, mult = Math.min(1.4 + h * 0.07, 3.6);
    this.action = null;
    this.iframes = 0.4;
    G.vfx.impact(this.pos.clone().setY(this.pos.y + 0.3), this.hero.color, true);
    G.vfx.particles(this.pos.clone().setY(this.pos.y + 0.2), 40, 0xd8d0b8, { speed: 8, up: 4, life: 0.7 });
    G.combat.fovKick = 5;
    this._chargedHit(this.pos.clone(), radius, mult, 7);
    G.shake(Math.min(0.7, 0.3 + h * 0.02));
    sfx.heavy();
  }

  _gainEnergy(n) {
    const er = 1 + this.m.getArtifactBonus().erPct;
    const floor = this.game.spire?.active ? this.game.spire.energyMult() : 1;
    this.energy = Math.min(this.hero.burstCost, this.energy + n * er * floor * (this.game.combat?.energyMult() || 1));
  }

  _meleeHit(D, fwd, color) {
    const G = this.game;
    const paw = this.pos.clone().addScaledVector(fwd, 0.9); paw.y += 0.9;
    if (D.aoe) {
      G.vfx.shockwave(this.pos.clone().addScaledVector(fwd, 1.2), 3, color, 0.35);
      G.vfx.slash(paw, this.facing, { size: 2.0, tilt: 1.2, color });
      G.shake(0.12);
    } else G.vfx.slash(paw, this.facing, { size: this.hero.id === 'fidelia' ? 2.0 : 1.6, tilt: 0.45, mirror: this.combo === 2, color });
    let hits = 0;
    const center = D.aoe ? this.pos.clone().addScaledVector(fwd, 1.2) : this.pos;
    for (const e of G.enemies) {
      if (e.dead || e.dormant) continue;
      const dx = e.pos.x - center.x, dz = e.pos.z - center.z, d = Math.hypot(dx, dz);
      if (d > D.range + e.radius) continue;
      if (!D.aoe && d > 0.5 && (dx * fwd.x + dz * fwd.z) / d < D.cone) continue;
      G.dealDamage(e, this.atk * D.mult, { knock: D.knock, stun: D.stun || 0, critBonus: this.hero.id === 'luby' ? 0.15 : 0, element: this.hero.id === 'micca' ? chaosEl() : null });
      hits++;
    }
    if (hits) { this._gainEnergy(3 * Math.min(hits, 3)); G.hitstop(0.045); }
    // Kali · Seratus Pedang: the third slash calls three falling swords
    if (this.hero.id === 'kali' && D.aoe) this._bladeDrop(center, 3, 2.2, 0.35);
  }

  /** Kali: drop `n` swords around `c`; each deals `mult`×ATK WIND in a small radius */
  _bladeDrop(c, n, spread, mult, delay = 0.06) {
    const G = this.game;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * spread;
      const p = c.clone().add(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
      p.y = G.world.groundAt(p.x, p.z);
      G.vfx.fallingBlade(p, { delay: i * delay, color: 0xe8f4ff });
      setTimeout(() => {
        if (G.player !== this) return;
        for (const e of G.enemies) {
          if (e.dead || e.dormant) continue;
          if (Math.hypot(e.pos.x - p.x, e.pos.z - p.z) < 1.6 + e.radius) G.dealDamage(e, this.atk * mult, { element: 'WIND', knock: 1, poise: 6 });
        }
      }, (i * delay + 0.16) * 1000);
    }
  }

  _updateAction(dt, move) {
    const G = this.game, a = this.action, t = this.actionT, D = this.actionData, H = this.hero;
    const fwd = new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing));
    if (a === 'attack') {
      if (t < D.hit) move.copy(fwd).multiplyScalar(2.2);
      if (!this._hitDone && t >= D.hit) { this._hitDone = true; this._meleeHit(D, fwd, H.id === 'fidelia' || H.id === 'valeria' ? 0x9ee0ff : H.id === 'scylla' ? 0xb07aff : H.id === 'glytta' || H.id === 'kali' ? 0x7ff0e0 : H.id === 'eropatra' ? 0xffb050 : 0xc8ff6a); }
    } else if (a === 'cast' && D.isAttack) {
      move.set(0, 0, 0);
      if (!this._hitDone && t >= D.hit) {
        this._hitDone = true;
        const from = this.pos.clone().addScaledVector(fwd, 0.5); from.y += 1.3;
        for (let i = 0; i < D.bolts; i++) {
          const tgt = D.target && !D.target.dead ? D.target : this.nearestEnemy(18);
          G.spawnBolt(from.clone().add(new THREE.Vector3((i - 1) * 0.35, i * 0.1, 0)), tgt, fwd, this.atk * D.mult * (H.id === 'gemora' ? 1.1 : 1), i * 0.08, H.id === 'rumi' ? 'DARK' : H.id === 'gemora' ? 'LIGHTNING' : 'LIGHT');
        }
        sfx.pickup();
      }
    } else if (a === 'cast' && D.skill) { // Mora · Chronos Ring
      move.set(0, 0, 0);
      if (!this._hitDone && t >= 0.3) {
        this._hitDone = true;
        const c = D.center.clone(); c.y = G.world.groundAt(c.x, c.z);
        G.vfx.clockRing(c, 4.5, 4);
        G.vfx.shockwave(c, 4.5, 0xf5c542, 0.5);
        G.vfx.particles(c.clone().setY(c.y + 1), 30, 0xffe6a0, { speed: 5, up: 3, life: 0.7 });
        let hits = 0;
        for (const e of G.enemies) {
          if (e.dead || e.dormant) continue;
          if (Math.hypot(e.pos.x - c.x, e.pos.z - c.z) < 4.5 + e.radius) {
            G.dealDamage(e, this.atk * 1.6, { element: 'LIGHT', stun: 0.2 });
            e.slowT = 4; hits++;
          }
        }
        if (hits) this._gainEnergy(12);
        sfx.burst();
      }
    } else if (a === 'fang') { // Eropatra · Serpent Empress Fang (pierces everything in the line)
      move.set(0, 0, 0);
      const k = Math.min(1, t / 0.3);
      if (k < 1 || !D.done) {
        const p = D.from.clone().lerp(D.to, k); p.y = G.world.groundAt(p.x, p.z);
        this.pos.copy(p); this.vy = 0;
        G.vfx.particles(this.pos.clone().setY(this.pos.y + 0.8), 3, D.color || 0xff8a2a, { speed: 1.5, up: 1, life: 0.4 });
        for (const e of G.enemies) {
          if (e.dead || e.dormant || D.hit.has(e)) continue;
          if (Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z) < 1.8 + e.radius) {
            D.hit.add(e); G.dealDamage(e, this.atk * (D.mult || 2.0), { element: D.element || 'FIRE', knock: 5, stun: 0.4 });
            G.vfx.slash(e.pos.clone().setY(e.pos.y + 1), this.facing + Math.random(), { size: 1.8, color: D.color || 0xffa040 });
          }
        }
        if (k >= 1) { D.done = true; if (D.hit.size) { this._gainEnergy(10 + D.hit.size * 2); G.hitstop(0.06); } G.vfx.shockwave(this.pos, 2.5, D.color || 0xff8a2a, 0.35); }
      }
    } else if (a === 'cast' && D.bladeRain) { // Kali · Hundred Blade Rain (a line of falling swords)
      move.set(0, 0, 0);
      if (!this._hitDone && t >= 0.28) {
        this._hitDone = true;
        const side = new THREE.Vector3(fwd.z, 0, -fwd.x);
        for (let k = 0; k < 14; k++) {
          const p = this.pos.clone().addScaledVector(fwd, 1.5 + k).addScaledVector(side, (Math.random() - 0.5) * 2.6);
          p.y = G.world.groundAt(p.x, p.z);
          G.vfx.fallingBlade(p, { delay: k * 0.025, color: 0xdff0ff, size: 1.1 });
        }
        G.shake(0.3); sfx.heavy();
        let hits = 0;
        for (const e of G.enemies) {
          if (e.dead || e.dormant) continue;
          const dx = e.pos.x - this.pos.x, dz = e.pos.z - this.pos.z;
          const along = dx * fwd.x + dz * fwd.z, across = Math.abs(dx * side.x + dz * side.z);
          if (along > -0.5 && along < 15 + e.radius && across < 1.8 + e.radius) {
            G.dealDamage(e, this.atk * 2.3, { element: 'WIND', knock: 4, stun: 0.5, poise: 30 });
            e.shredT = 8; hits++;
          }
        }
        if (hits) { this._gainEnergy(10 + hits * 2); G.hitstop(0.07); G.ui.toast('🗡️ DEF musuh turun!'); }
      }
    } else if (a === 'cast' && D.railgun) { // Gemora · Void Railgun (pierces the whole line)
      move.set(0, 0, 0);
      if (!this._hitDone && t >= 0.32) {
        this._hitDone = true;
        const from = this.pos.clone().addScaledVector(fwd, 0.6); from.y += 1.2;
        const to = from.clone().addScaledVector(fwd, 30);
        G.vfx.beamLine(from, to, 0xc07aff, 0.35);
        G.shake(0.25); G.combat.fovKick = 4; sfx.burst();
        let hits = 0;
        for (const e of G.enemies) {
          if (e.dead || e.dormant) continue;
          const dx = e.pos.x - this.pos.x, dz = e.pos.z - this.pos.z;
          const along = dx * fwd.x + dz * fwd.z, across = Math.abs(dx * fwd.z - dz * fwd.x);
          if (along > 0 && along < 31 && across < 1.6 + e.radius) { G.dealDamage(e, this.atk * 2.0, { element: 'LIGHTNING', critBonus: 0.3, knock: 5, poise: 30 }); hits++; }
        }
        if (hits) { this._gainEnergy(10 + hits * 2); G.hitstop(0.06); }
      }
    } else if (a === 'cast' && D.pandora) { // Micca · Pandora Unboxed (every enemy nearby)
      move.set(0, 0, 0);
      if (!this._hitDone && t >= 0.35) {
        this._hitDone = true;
        G.vfx.shockwave(this.pos, 12, 0xff5ca8, 0.7); G.vfx.shockwave(this.pos, 7, 0xffd66b, 0.5);
        for (const c of [0xff5ca8, 0x4fb4f0, 0xff7a2a, 0x9ee8ff, 0xc07aff, 0x8fe63a]) G.vfx.particles(this.pos.clone().setY(this.pos.y + 1.4), 10, c, { speed: 10, up: 7, life: 0.8 });
        G.shake(0.3); sfx.burst();
        let hits = 0;
        for (const e of G.enemies) {
          if (e.dead || e.dormant) continue;
          if (Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z) < 12 + e.radius) { G.dealDamage(e, this.atk * 1.2, { element: chaosEl(), stun: Math.random() < 0.2 ? 1 : 0, poise: 20 }); hits++; }
        }
        if (hits) this._gainEnergy(8 + hits * 2);
      }
    } else if (a === 'cast' && D.exorcism) { // Rumi · Crimson Exorcism
      move.set(0, 0, 0);
      if (!this._hitDone && t >= 0.3) {
        this._hitDone = true;
        const e = D.target;
        if (!e.dead) {
          const p = e.pos.clone();
          G.vfx.pillar(p, 0xe0404a, 7, 0.6);
          const cross = [[1, 0], [-1, 0], [0, 1], [0, -1]];
          for (const [dx, dz] of cross) G.vfx.particles(p.clone().add(new THREE.Vector3(dx * 1.2, 1.5, dz * 1.2)), 10, 0xff3a4a, { speed: 3, up: 1, life: 0.5 });
          G.vfx.shockwave(p, 3, 0xe0404a, 0.4);
          const exec = e.hp < e.maxHp * 0.35 ? 1.8 : 1;
          G.dealDamage(e, this.atk * 1.6 * exec, { element: 'DARK', stun: 0.4 });
          for (const o of G.enemies) if (o !== e && !o.dead && !o.dormant && o.pos.distanceTo(p) < 3) G.dealDamage(o, this.atk * 0.7, { element: 'DARK' });
          this._gainEnergy(12);
        }
        sfx.burst();
      }
    } else if (a === 'charged') {
      move.set(0, 0, 0);
      if (D.mage) {
        if (!this._hitDone && t >= 0.4) {
          this._hitDone = true;
          const c = D.target && !D.target.dead ? D.target.pos.clone() : this.pos.clone().addScaledVector(fwd, 7);
          c.y = G.world.groundAt(c.x, c.z);
          G.vfx.pillar(c, H.color, 9, 0.6);
          this._chargedHit(c, 4.5, 1.9, 5);
        }
      } else {
        const hitsAt = [0.25, 0.55];
        this._ticks = this._ticks || 0;
        while (this._ticks < hitsAt.length && t >= hitsAt[this._ticks] * this.actionDur) {
          this._ticks++;
          G.vfx.slash(this.pos.clone().setY(this.pos.y + 0.9), this.facing + this._ticks * 2, { size: 3.0, tilt: 0.1, color: H.color });
          this._chargedHit(this.pos.clone(), 3.4, 0.95, this._ticks === 2 ? 6 : 0);
        }
      }
    } else if (a === 'judgement') { // Valeria · Frostvale Judgement (a whole column)
      move.set(0, 0, 0);
      if (!this._hitDone && t >= 0.32) {
        this._hitDone = true;
        for (let k = 1; k <= 5; k++) {
          const p = this.pos.clone().addScaledVector(fwd, k * 2.1); p.y = G.world.groundAt(p.x, p.z);
          setTimeout(() => G.vfx.iceSpike(p, 1 + k * 0.08), k * 50);
        }
        G.shake(0.3); sfx.land();
        let hits = 0;
        for (const e of G.enemies) {
          if (e.dead || e.dormant) continue;
          const dx = e.pos.x - this.pos.x, dz = e.pos.z - this.pos.z;
          const along = dx * fwd.x + dz * fwd.z, across = Math.abs(dx * fwd.z - dz * fwd.x);
          if (along > -0.5 && along < 11.5 && across < 2.2 + e.radius) { G.dealDamage(e, this.atk * 1.7, { element: 'ICE', stun: 1.0, knock: 3 }); hits++; }
        }
        if (hits) { this._gainEnergy(12); G.hitstop(0.06); }
        this.m.shield = Math.round(this.maxHp * 0.2); this.m.shieldT = 10;
      }
    } else if (a === 'ambush') { // Scylla · Kraken Ambush
      move.set(0, 0, 0);
      const e = D.target, rig = this.m.rig.root;
      if (t < 0.25) {
        rig.visible = t < 0.08;
        if (Math.random() < 0.8) G.vfx.particles(this.pos.clone().setY(this.pos.y + 0.8), 3, 0x7a3fd0, { speed: 2, up: 1, life: 0.4 });
      } else if (!D.moved) {
        D.moved = true; rig.visible = true;
        if (!e.dead) {
          const away = new THREE.Vector3(e.pos.x - this.pos.x, 0, e.pos.z - this.pos.z).normalize();
          const p = e.pos.clone().addScaledVector(away, e.radius + 0.9);
          p.y = G.world.groundAt(p.x, p.z);
          if (G.world.groundAt(p.x, p.z) < -1.2 && !this.hero.swim) p.copy(e.pos);
          this.pos.copy(p); this.faceToward(e.pos);
        }
        G.vfx.particles(this.pos.clone().setY(this.pos.y + 1), 24, 0x9a5cff, { speed: 5, up: 3, life: 0.5 });
      } else if (!this._hitDone && t >= 0.4) {
        this._hitDone = true;
        G.vfx.slash(this.pos.clone().addScaledVector(fwd, 0.9).setY(this.pos.y + 1), this.facing, { size: 2.4, tilt: 1.2, color: 0xb07aff });
        G.vfx.shockwave(this.pos.clone().addScaledVector(fwd, 1), 2.6, 0x4fb4f0, 0.35);
        if (!e.dead) G.dealDamage(e, this.atk * 1.9, { element: 'WATER', critBonus: 0.3, knock: 6, stun: 0.5 });
        for (const o of G.enemies) if (o !== e && !o.dead && !o.dormant && o.pos.distanceTo(e.pos) < 2.5) G.dealDamage(o, this.atk * 0.8, { element: 'WATER' });
        this._gainEnergy(12); G.hitstop(0.07); G.shake(0.25); sfx.land();
      }
    } else if (a === 'bash') { // Fidelia · Tidal Bulwark
      if (t < 0.25) move.copy(fwd).multiplyScalar(18);
      else move.set(0, 0, 0);
      if (Math.random() < 0.7) G.vfx.particles(this.pos.clone().setY(this.pos.y + 0.4), 2, 0x7fd0ff, { speed: 2, up: 1, life: 0.4 });
      if (!this._hitDone && t >= 0.25) {
        this._hitDone = true;
        const c = this.pos.clone().addScaledVector(fwd, 1.5);
        G.vfx.shockwave(c, 3.4, 0x4fb4f0, 0.45);
        G.vfx.particles(c.clone().setY(c.y + 0.5), 30, 0x9ee0ff, { speed: 7, up: 4, life: 0.6 });
        G.shake(0.3);
        let hits = 0;
        for (const e of G.enemies) {
          if (e.dead || e.dormant) continue;
          if (Math.hypot(e.pos.x - c.x, e.pos.z - c.z) < 3 + e.radius) { G.dealDamage(e, this.atk * 1.8, { element: 'WATER', knock: 10, stun: 0.6 }); hits++; }
        }
        if (hits) { this._gainEnergy(12); G.hitstop(0.06); }
        this.m.shield = Math.round(this.maxHp * 0.25); this.m.shieldT = 12;
        G.ui.toast('🛡️ Perisai Tidal +' + this.m.shield);
        sfx.land();
      }
    } else if (a === 'pounce') { // Luby · Mecha-Cat Pounce
      const T0 = 0.18, T1 = 0.6;
      move.set(0, 0, 0);
      if (t >= T0 && t < T1) {
        const k = (t - T0) / (T1 - T0);
        const p = D.from.clone().lerp(D.to, k);
        p.y = D.from.y + (D.to.y - D.from.y) * k + Math.sin(k * Math.PI) * 2.6;
        this.pos.copy(p); this.vy = 0;
        if (Math.random() < 0.6) G.vfx.particles(this.pos.clone().setY(this.pos.y + 0.6), 2, 0xb8ff4a, { speed: 1, up: 0, life: 0.35, grav: 0 });
      } else if (t >= T1 && !this._hitDone) {
        this._hitDone = true;
        this.pos.copy(D.to);
        sfx.land();
        G.vfx.shockwave(this.pos, 4.2, 0xb8ff4a, 0.5);
        G.vfx.shockwave(this.pos, 2.5, 0xffffff, 0.3);
        G.vfx.particles(this.pos.clone().setY(this.pos.y + 0.3), 36, 0xb8ff4a, { speed: 9, up: 4, life: 0.6 });
        G.shake(0.35);
        let hits = 0;
        for (const e of G.enemies) {
          if (e.dead || e.dormant) continue;
          if (Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z) < 3.6 + e.radius) { G.dealDamage(e, this.atk * 2.4, { element: 'WIND', knock: 9, stun: 1.6, critBonus: 0.3 }); hits++; }
        }
        if (hits) { this._gainEnergy(12); G.hitstop(0.08); }
      }
    } else if (a === 'burst') {
      move.set(0, 0, 0);
      if (H.id === 'commander' && !this._hitDone && t > 0.45) {
        this._hitDone = true;
        G.vfx.shockwave(this.pos, 11, 0xffd700, 0.9);
        G.vfx.shockwave(this.pos, 7, 0xffffff, 0.6);
        G.vfx.pillar(this.pos, 0xffea70, 12, 1.2);
        for (let k = 0; k < 12; k++) {
          const ang = (k / 12) * Math.PI * 2;
          const p = this.pos.clone().add(new THREE.Vector3(Math.cos(ang) * 7.5, 0, Math.sin(ang) * 7.5));
          p.y = G.world.groundAt(p.x, p.z);
          G.vfx.pillar(p, 0xffd700, 6, 0.6);
        }
        G.vfx.particles(this.pos.clone().setY(this.pos.y + 1), 100, 0xfff0aa, { speed: 14, up: 6, life: 1.0 });
        G.shake(0.6); sfx.heavy();
        for (const e of G.enemies) {
          if (e.dead || e.dormant) continue;
          if (Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z) < 11 + e.radius) {
            G.dealDamage(e, this.atk * 4.2, { element: 'LIGHT', knock: 16, stun: 1.2, critBonus: 0.2 });
          }
        }
        this.commanderBuffT = 12.0;
        G.ui.toast('🌟 Genesis Nova: Party ATK +25% & Crit +15% (12 dtk)!', 'gold big');
      }
      if (H.id === 'luby' && !this._hitDone && t > 0.45) { this._hitDone = true; G.startStorm(D.center); }
      if (H.id === 'kali') { // Pedang ke-101: a hundred swords, then the hundred-and-first
        const ticks = [0.3, 0.42, 0.54, 0.66, 0.78, 0.9, 1.02, 1.14];
        if (t >= 0.25 && !D.ring) { D.ring = true; G.vfx.shockwave(this.pos, 11, 0xd9d2c3, 0.6); G.vfx.clockRing(this.pos, 11, 1.6); }
        while (this._ticks < ticks.length && t >= ticks[this._ticks]) {
          this._ticks++;
          const near = G.enemies.filter((en) => !en.dead && !en.dormant && Math.hypot(en.pos.x - this.pos.x, en.pos.z - this.pos.z) < 11 + en.radius);
          for (let k = 0; k < 6; k++) {
            const a2 = Math.random() * Math.PI * 2, r2 = 2 + Math.random() * 9;
            const p = near.length && k < 3 ? near[(this._ticks + k) % near.length].pos.clone() : this.pos.clone().add(new THREE.Vector3(Math.cos(a2) * r2, 0, Math.sin(a2) * r2));
            p.y = G.world.groundAt(p.x, p.z);
            G.vfx.fallingBlade(p, { delay: k * 0.02, color: 0xf2f6ff });
          }
          for (const en of near) G.dealDamage(en, this.atk * 0.45, { element: 'WIND', poise: 10 });
          sfx.swing();
        }
        if (!this._hitDone && t >= 1.35) {
          this._hitDone = true;
          G.vfx.fallingBlade(this.pos.clone().addScaledVector(fwd, 2).setY(G.world.groundAt(this.pos.x + fwd.x * 2, this.pos.z + fwd.z * 2)), { color: 0xffe8a0, size: 3, life: 1.4 });
          G.vfx.shockwave(this.pos, 11, 0xffffff, 0.7); G.vfx.pillar(this.pos, 0xd9d2c3, 10, 0.9);
          G.shake(0.6); sfx.heavy();
          for (const en of G.enemies) {
            if (en.dead || en.dormant) continue;
            if (Math.hypot(en.pos.x - this.pos.x, en.pos.z - this.pos.z) < 11 + en.radius) G.dealDamage(en, this.atk * 2.2, { element: 'WIND', knock: 12, stun: 0.8, poise: 40 });
          }
        }
      }
      if (H.id === 'fidelia' && !this._hitDone && t > 0.5) {
        this._hitDone = true;
        G.vfx.shockwave(this.pos, 8.5, 0x4fb4f0, 0.8); G.vfx.shockwave(this.pos, 6, 0xbfe9ff, 0.6);
        G.vfx.pillar(this.pos, 0x4fb4f0, 7, 0.9);
        G.vfx.particles(this.pos.clone().setY(this.pos.y + 0.5), 80, 0x9ee0ff, { speed: 12, up: 5, life: 0.9 });
        G.shake(0.5);
        for (const e of G.enemies) {
          if (e.dead || e.dormant) continue;
          if (Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z) < 8 + e.radius) G.dealDamage(e, this.atk * 3.0, { element: 'WATER', knock: 14, stun: 0.8 });
        }
        this.healAll(0.25);
        G.ui.toast('🌊 Seluruh party pulih 25%', 'gold');
      }
      if (H.id === 'gemora') {
        const ticks = [0.3, 0.5, 0.7, 0.9, 1.1];
        if (!this._orbTargets) {
          const list = G.enemies.filter((e) => !e.dead && !e.dormant && e.pos.distanceTo(this.pos) < 20).sort((a1, b1) => a1.pos.distanceTo(this.pos) - b1.pos.distanceTo(this.pos));
          this._orbTargets = list.length ? list : [null];
        }
        while (this._ticks < ticks.length && t >= ticks[this._ticks]) {
          const e = this._orbTargets[this._ticks % this._orbTargets.length];
          this._ticks++;
          const c = e && !e.dead ? e.pos.clone() : this.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 10, 0, (Math.random() - 0.5) * 10));
          c.y = G.world.groundAt(c.x, c.z);
          G.vfx.beamLine(c.clone().setY(c.y + 60), c, 0xc07aff, 0.9);
          G.vfx.shockwave(c, 3.5, 0xc07aff, 0.4); G.vfx.impact(c.clone().setY(c.y + 0.5), '#c07aff', true);
          G.shake(0.25); sfx.heavy();
          for (const en of G.enemies) {
            if (en.dead || en.dormant) continue;
            if (Math.hypot(en.pos.x - c.x, en.pos.z - c.z) < 3.5 + en.radius) G.dealDamage(en, this.atk * 1.5, { element: 'LIGHTNING', poise: 30 });
          }
        }
        if (t >= this.actionDur - 0.05) this._orbTargets = null;
      }
      if (H.id === 'micca') {
        const ticks = [0.45, 0.8, 1.15];
        if (!this._mimic) { const c = D.center.clone(); c.y = G.world.groundAt(c.x, c.z); this._mimicAt = c; this._mimic = G.vfx.mimic(c, 1.4); }
        while (this._ticks < ticks.length && t >= ticks[this._ticks]) {
          this._ticks++;
          const c = this._mimicAt;
          G.vfx.shockwave(c, 4.5, 0xff5ca8, 0.35); G.shake(0.3); sfx.heavy();
          for (const en of G.enemies) {
            if (en.dead || en.dormant) continue;
            if (Math.hypot(en.pos.x - c.x, en.pos.z - c.z) < 4.5 + en.radius) G.dealDamage(en, this.atk * 1.6, { element: chaosEl(), poise: 25 });
          }
        }
        if (t >= this.actionDur - 0.05) this._mimic = null;
      }
      if (H.id === 'valeria' && !this._hitDone && t > 0.5) {
        this._hitDone = true;
        for (let k = 0; k < 10; k++) { const ang = (k / 10) * Math.PI * 2; const p = this.pos.clone().add(new THREE.Vector3(Math.cos(ang) * 6, 0, Math.sin(ang) * 6)); p.y = G.world.groundAt(p.x, p.z); G.vfx.iceSpike(p, 1.4); }
        G.vfx.shockwave(this.pos, 8.5, 0x9ee8ff, 0.7); G.vfx.pillar(this.pos, 0xbff6ff, 9, 0.9);
        G.vfx.particles(this.pos.clone().setY(this.pos.y + 1), 70, 0xe8fbff, { speed: 10, up: 5, life: 0.9 });
        G.shake(0.5);
        for (const e of G.enemies) {
          if (e.dead || e.dormant) continue;
          if (Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z) < 8 + e.radius) { G.dealDamage(e, this.atk * 2.6, { element: 'ICE' }); e.stun = Math.max(e.stun, e.isBoss ? 0.8 : e.static ? 0 : 3); }
        }
      }
      if (H.id === 'glytta') {
        const ticks = [0.3, 0.5, 0.7, 0.9, 1.1, 1.3];
        if (!this._serpent) this._serpent = G.vfx.serpent(this.pos, 4, 1.5, [0x3fd0c8, 0x9ef6ee, 0xffffff]);
        while (this._ticks < ticks.length && t >= ticks[this._ticks]) {
          this._ticks++;
          for (const e of G.enemies) {
            if (e.dead || e.dormant) continue;
            if (Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z) < 5.5 + e.radius) G.dealDamage(e, this.atk * 0.55, { element: 'WIND', knock: 1 });
          }
        }
        if (t >= this.actionDur - 0.05) this._serpent = null;
      }
      if (H.id === 'eropatra') {
        const ticks = [0.3, 0.5, 0.7, 0.9, 1.1, 1.3];
        if (!this._serpent) { this._serpent = G.vfx.serpent(this.pos, 5.5, 1.5); }
        while (this._ticks < ticks.length && t >= ticks[this._ticks]) {
          this._ticks++;
          for (const e of G.enemies) {
            if (e.dead || e.dormant) continue;
            if (Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z) < 6.8 + e.radius) G.dealDamage(e, this.atk * 0.6, { element: 'FIRE', knock: 2 });
          }
        }
        if (t >= this.actionDur - 0.05) this._serpent = null;
      }
      if (H.id === 'rumi') {
        const ticks = [0.35, 0.6, 0.85, 1.1];
        if (!this._circle) { this._circle = true; G.vfx.clockRing(this.pos, 7, 1.4); G.vfx.shockwave(this.pos, 7, 0xe0404a, 0.5); }
        while (this._ticks < ticks.length && t >= ticks[this._ticks]) {
          this._ticks++;
          G.vfx.particles(this.pos.clone().setY(this.pos.y + 0.5), 30, 0xff4a5a, { speed: 8, up: 3, life: 0.5 });
          for (const e of G.enemies) {
            if (e.dead || e.dormant) continue;
            if (Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z) < 7 + e.radius) { e.bounty = true; G.dealDamage(e, this.atk * 0.8, { element: 'DARK', stun: 0.2 }); }
          }
        }
        if (t >= this.actionDur - 0.05) this._circle = false;
      }
      if (H.id === 'scylla') {
        const ticks = [0.35, 0.6, 0.85, 1.1, 1.35];
        while (this._ticks < ticks.length && t >= ticks[this._ticks]) {
          this._ticks++;
          G.shake(0.15);
          for (let k = 0; k < 4; k++) { const a = Math.random() * Math.PI * 2, rr = 1.5 + Math.random() * 4.5; const tp = this.pos.clone().add(new THREE.Vector3(Math.cos(a) * rr, 0, Math.sin(a) * rr)); tp.y = Math.max(G.world.groundAt(tp.x, tp.z), 0); G.vfx.tentacle(tp); }
          for (const e of G.enemies) {
            if (e.dead || e.dormant) continue;
            const d = Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z);
            if (d < 6.5 + e.radius) {
              G.dealDamage(e, this.atk * 0.75, { element: 'WATER', stun: 0.3 });
              if (!e.isBoss && e.type !== 'spire' && d > 1.5) e.pos.addScaledVector(new THREE.Vector3(this.pos.x - e.pos.x, 0, this.pos.z - e.pos.z).normalize(), 0.8);
            }
          }
        }
      }
      if (H.id === 'mora') {
        const c = D.center;
        for (const tk of [0.4, 0.75, 1.1]) {
          if (this._ticks < 3 && t >= tk && this._ticks === [0.4, 0.75, 1.1].indexOf(tk)) {
            this._ticks++;
            const gp = c.clone(); gp.y = G.world.groundAt(gp.x, gp.z);
            G.vfx.pillar(gp, 0xf5c542, 14, 0.7); G.vfx.shockwave(gp, 7, 0xffe08a, 0.5);
            G.vfx.particles(gp.clone().setY(gp.y + 2), 40, 0xfff0b0, { speed: 6, up: 6, life: 0.8 });
            G.shake(0.25);
            for (const e of G.enemies) {
              if (e.dead || e.dormant) continue;
              if (Math.hypot(e.pos.x - gp.x, e.pos.z - gp.z) < 7 + e.radius) G.dealDamage(e, this.atk * 1.4, { element: 'LIGHT', stun: 0.3 });
            }
            if (this._ticks === 1) {
              this.healAll(0.15);
              for (const m of this.members) m.cd.skill = 0;
              G.ui.toast('⏳ Waktu diputar ulang: cooldown Skill semua hero direset!', 'gold');
            }
          }
        }
      }
    } else if (a === 'dash') {
      move.copy(fwd).multiplyScalar(17 * (1 - t / this.actionDur * 0.5));
      if (Math.random() < 0.7) G.vfx.particles(this.pos.clone().setY(this.pos.y + 0.5), 2, 0xd8ffa0, { speed: 1, up: 0.5, life: 0.3, grav: 0 });
    } else if (a === 'interact') {
      move.set(0, 0, 0);
    }
  }

  damage(amount, from, knock = 8) {
    if (this.dead || this.game.inputLocked) return;
    if (this.iframes > 0) {
      // dodged inside the first frames of a dash → Perfect Dodge
      if (this.action === 'dash' && this.actionT < 0.24 && !this._pdUsed && amount > 0) { this._pdUsed = true; this.game.combat.perfectDodge(from); }
      return;
    }
    const def = 1 / ((1 + this.level * 0.03) * this.hero.defMul);
    let dmg = Math.round(amount * def);
    const m = this.m;
    if (m.shield > 0) {
      const absorbed = Math.min(m.shield, dmg);
      m.shield -= absorbed; dmg -= absorbed;
      this.game.vfx.particles(this.pos.clone().setY(this.pos.y + 1), 10, 0x9ee0ff, { speed: 3, up: 2, life: 0.4 });
      if (m.shield <= 0) { m.shieldT = 0; this.game.ui.toast('Perisai pecah!'); }
    }
    this.hp -= dmg;
    this.game.rift?.onPlayerHit(dmg);
    this.combatT = 0;
    this.iframes = 0.55; this.hurtT = 0.25;
    if (from) { const d = new THREE.Vector3(this.pos.x - from.x, 0, this.pos.z - from.z).normalize(); this.vel.addScaledVector(d, knock); }
    if (this.action === 'attack') this.action = null;
    this.game.ui.damageNumber(this.pos.clone().setY(this.pos.y + 1.8), dmg, 'player');
    if (dmg > 0) { this.game.ui.hurt(); this.game.shake(0.2); sfx.hurt(); if (Math.random() < 0.3) this.game.ui.voice('hurt'); }
    if (this.hp <= 0) this._downed();
  }

  /** active hero fell: swap to the next standing hero, or the whole party is down */
  _downed() {
    if (this.dead) return;
    this.m.hp = 0;
    this.game.ui.voice('ko');
    const next = this.members.findIndex((x) => !x.dead);
    if (next >= 0) {
      this.game.ui.toast(this.hero.name + ' tumbang!');
      this.switchTo(next, true);
      this.iframes = 1.5;
      return;
    }
    this.dead = true; this.deadT = 0; this.action = null;
  }
}
