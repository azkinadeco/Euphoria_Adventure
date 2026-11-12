// Chapter 2 — INFERNAL CITADEL: story objects, quests, heat, lava, boss hazards.
import { softDot } from './nature.js';
import * as THREE from 'three';
import { VLOC, VOLC, CIT_R, heatAt, lavaAt } from './volcano.js';
import { makeChest } from './reef.js';
import { Enemy } from './enemies.js';
import { EropatraRig, RumiRig } from './heroes3d.js';
import { SCRIPTS } from './story.js';
import { sfx, setMusicMood } from './sfx.js';

export class Chapter2 {
  constructor(game) {
    this.g = game;
    const G = game, W = game.world, S = game.scene;
    this.beams = []; this.tethers = [];

    // NPC versions of the two new heroes wait at the outpost until they join
    const O = VLOC.outpost;
    this.eroNpc = new EropatraRig(); this.eroNpc.root.position.set(O.x + 2.6, O.y, O.z - 2.4); this.eroNpc.root.rotation.y = 2.6; S.add(this.eroNpc.root);
    this.rumiNpc = new RumiRig(); this.rumiNpc.root.position.set(O.x - 2.4, O.y, O.z - 2.6); this.rumiNpc.root.rotation.y = -2.6; S.add(this.rumiNpc.root);
    W.animated.push({ update: (dt) => {
      if (this.eroNpc.root.visible) this.eroNpc.update(dt, { speed: 0, grounded: true });
      if (this.rumiNpc.root.visible) this.rumiNpc.update(dt, { speed: 0, grounded: true });
    } });
    const rest = { pos: W.volcCampfire.pos, radius: 3, kind: 'volc_rest', label: 'Istirahat di api unggun pos depan' };
    rest.enabled = () => G.state.volcCamp;
    W.interactables.push(rest);

    // spirit lanterns
    VLOC.lanterns.forEach((p, i) => {
      const it = { pos: p, radius: 2.8, kind: 'lantern', idx: i, label: 'Sucikan lentera arwah' };
      it.enabled = () => G.state.step === 'volc_lanterns' && !G.state.lanterns[i] && !this.lanternWave?.[i];
      W.interactables.push(it);
    });
    this.lanternWave = {};

    // extra treasure chests (indices continue after Chapter 1's)
    const land = (x, z) => {
      for (let r = 0; r < 30; r += 1.5) for (let a = 0; a < 6.28; a += 0.7) {
        const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
        if (W.heightAt(px, pz) > 1 && !lavaAt(px, pz)) return new THREE.Vector3(px, W.groundAt(px, pz), pz);
      }
      return new THREE.Vector3(x, W.groundAt(x, z), z);
    };
    const base = G.state.chestTotal || 8;
    const spots = [land(-140, -440), land(70, -430), land(-100, -580), land(VLOC.citadel.x + 12, VLOC.citadel.z - 12)];
    G.state.chestTotal = base + spots.length;
    spots.forEach((p, k) => {
      const i = base + k;
      const ch = makeChest(W, p, k * 2);
      const it = { pos: ch.group.position, radius: 2.4, kind: 'chest', idx: i, label: 'Buka peti harta', chest: ch };
      it.enabled = () => !G.state.chests[i];
      W.interactables.push(it);
      W.animated.push({ update: (dt) => { if (G.state.chests[i]) { ch.lid.rotation.x = Math.max(ch.lid.rotation.x - dt * 4, -1.9); ch.glow.intensity = 0; } } });
    });

    // ash in the air (follows the player while in the region)
    const ag = new THREE.BufferGeometry(), ap = [];
    for (let k = 0; k < 400; k++) ap.push((Math.random() - 0.5) * 60, Math.random() * 25, (Math.random() - 0.5) * 60);
    ag.setAttribute('position', new THREE.Float32BufferAttribute(ap, 3));
    this.ash = new THREE.Points(ag, new THREE.PointsMaterial({ map: softDot(), color: 0xffa060, size: 0.12, transparent: true, opacity: 0.8, depthWrite: false }));
    S.add(this.ash);

    this._spawnEnemies();
  }

  _spawnEnemies() {
    const G = this.g, v = (x, z) => new THREE.Vector3(x, 0, z);
    const zones = [
      { c: v(-30, -390), r: 10, type: 'lavafox', n: 2 },
      { c: VLOC.lanterns[0].clone(), r: 9, type: 'ghost', n: 2 },
      { c: VLOC.lanterns[1].clone(), r: 9, type: 'lavafox', n: 2 },
      { c: VLOC.lanterns[2].clone(), r: 9, type: 'ghost', n: 2 },
      { c: VLOC.lanterns[3].clone(), r: 9, type: 'lavafox', n: 3 },
      { c: VLOC.lanterns[4].clone(), r: 9, type: 'ghost', n: 3 },
      { c: v(-40, -430), r: 10, type: 'ghost', n: 2 },
      { c: v(-90, -470), r: 12, type: 'lavafox', n: 2 },
    ];
    for (const z of zones) { z.alive = []; z.respawnT = 0; G.zones.push(z); for (let i = 0; i < z.n; i++) G._spawnIn(z); }
    this.seals = VLOC.seals.map((p, i) => {
      const pos = p.clone(); pos.y = G.world.groundAt(p.x, p.z);
      const e = new Enemy(G, 'seal', pos, { leash: 999 }); e.sealIdx = i; G.enemies.push(e); return e;
    });
    const c = VLOC.citadel.clone(); c.y = G.world.groundAt(c.x, c.z);
    this.sage = new Enemy(G, 'sage', c, { leash: 999 });
    G.enemies.push(this.sage);
  }

  spawnBloodCrystals(center, n) {
    const G = this.g;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      const p = center.clone().add(new THREE.Vector3(Math.cos(a) * 11, 0, Math.sin(a) * 11)); p.y = G.world.groundAt(p.x, p.z);
      const e = new Enemy(G, 'bloodcrystal', p, { leash: 999 }); e.isAdd = true;
      G.enemies.push(e);
      G.vfx.pillar(p, 0xff2a3a, 6, 0.6);
    }
  }

  // ---------- boss hazards ----------
  addBeam(origin, angle, speed, life, dmg, color = 0xff2a3a, len = 24) {
    const grp = new THREE.Group();
    const core = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, len), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.8), transparent: true, opacity: 0.15, depthWrite: false }));
    core.position.z = len / 2; grp.add(core);
    grp.position.copy(origin); grp.position.y += 1;
    grp.rotation.y = angle;
    this.g.scene.add(grp);
    this.beams.push({ grp, core, t: 0, life, speed, dmg, len, origin: origin.clone(), tick: 0 });
  }
  addTether(source, dur, dmg) {
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 6), new THREE.MeshBasicMaterial({ color: 0xff2a3a }));
    this.g.scene.add(line);
    this.tethers.push({ source, line, t: 0, dur, dmg });
    if (!this.g.state.tetherHint) { this.g.state.tetherHint = true; this.g.ui.toast('Tali darah! Menjauh lebih dari 14 m untuk memutusnya!', 'gold big'); }
  }
  _updateHazards(dt) {
    const G = this.g, P = G.player;
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      b.t += dt; b.tick -= dt;
      const live = b.t > 0.8; // short warning before the beam becomes lethal
      if (live) b.grp.rotation.y += b.speed * dt;
      b.core.scale.x = live ? 1.6 : 0.3;
      b.core.material.opacity = live ? 0.75 : 0.25 + Math.sin(b.t * 30) * 0.1;
      if (live && b.tick <= 0) {
        const a = b.grp.rotation.y, dx = P.pos.x - b.origin.x, dz = P.pos.z - b.origin.z;
        const along = dx * Math.sin(a) + dz * Math.cos(a), across = Math.abs(dx * Math.cos(a) - dz * Math.sin(a));
        if (along > 0 && along < b.len && across < 1.2) { b.tick = 0.5; P.damage(b.dmg, null, 4); }
      }
      if (b.t >= b.life) { G.scene.remove(b.grp); this.beams.splice(i, 1); }
    }
    for (let i = this.tethers.length - 1; i >= 0; i--) {
      const t = this.tethers[i];
      t.t += dt;
      const a = t.source.pos.clone().setY(t.source.pos.y + 3.5), b = P.pos.clone().setY(P.pos.y + 1);
      const d = a.distanceTo(b);
      t.line.position.copy(a).lerp(b, 0.5); t.line.scale.y = d;
      t.line.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      const broken = Math.hypot(P.pos.x - t.source.pos.x, P.pos.z - t.source.pos.z) > 14 || t.source.dead;
      if (broken) { G.ui.toast('Tali darah putus!'); G.scene.remove(t.line); this.tethers.splice(i, 1); continue; }
      if (t.t >= t.dur) {
        P.iframes = 0; P.damage(t.dmg, t.source.pos, 4);
        t.source.hp = Math.min(t.source.maxHp, t.source.hp + t.source.maxHp * 0.04);
        G.vfx.particles(t.source.pos.clone().setY(t.source.pos.y + 3), 20, 0xff2a3a, { speed: 3, up: 2, life: 0.5 });
        G.ui.toast('Evy menghisap darah dan pulih!');
        G.scene.remove(t.line); this.tethers.splice(i, 1);
      }
    }
  }

  // ---------- quests ----------
  questTarget(step) {
    const S = this.g.state, P = this.g.player;
    const nearest = (list, done) => { let b = null, bd = Infinity; list.forEach((p, i) => { if (!done[i]) { const d = p.distanceTo(P.pos); if (d < bd) { bd = d; b = p; } } }); return b; };
    if (step === 'volc_go') return P.pos.z > -150 ? VLOC.causeway.a : VLOC.outpost;
    if (step === 'volc_lanterns') return nearest(VLOC.lanterns, S.lanterns);
    if (step === 'volc_seals') return nearest(VLOC.seals, S.seals);
    if (step === 'volc_boss') return VLOC.citadel;
    return null;
  }

  async interact(it) {
    const G = this.g, S = G.state;
    if (it.kind === 'lantern') {
      this.lanternWave[it.idx] = [];
      const lp = VLOC.lanterns[it.idx];
      G.ui.toast('Arwah-arwah gelisah muncul! Kalahkan mereka untuk menyucikan lentera.', 'gold');
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2;
        const p = lp.clone().add(new THREE.Vector3(Math.cos(a) * 5, 0, Math.sin(a) * 5)); p.y = G.world.groundAt(p.x, p.z);
        const e = new Enemy(G, 'ghost', p, { leash: 40 }); e.aggro = true; e.lanternIdx = it.idx;
        G.enemies.push(e); this.lanternWave[it.idx].push(e);
        G.vfx.pillar(p, 0xbfe6ff, 5, 0.6);
      }
      return true;
    }
    if (it.kind === 'volc_rest') {
      G.player.healAll(1, true); S.spawn = 'volc';
      G.ui.toast('Istirahat di pos depan. HP pulih! (Tersimpan)', 'gold');
      G._sleepIfNight(); G.save();
      return true;
    }
    return false;
  }

  onKilled(e) {
    const G = this.g, S = G.state;
    if (e.lanternIdx !== undefined) {
      const wave = this.lanternWave[e.lanternIdx];
      if (wave && wave.every((x) => x.dead)) {
        S.lanterns[e.lanternIdx] = true;
        const lm = G.world.lanternMeshes[e.lanternIdx];
        lm.flame.material.color.set(0xffe08a); lm.flame.scale.setScalar(1.6);
        G.vfx.pillar(VLOC.lanterns[e.lanternIdx], 0xffe08a, 9, 1); sfx.quest();
        G.ui.toast(`Lentera disucikan (${S.lanterns.filter(Boolean).length}/5)`, 'gold');
        if (S.step === 'volc_lanterns' && S.lanterns.every(Boolean)) G.ui.dialog(SCRIPTS.volcMid).then(() => G._advance('volc_seals'));
        G.save();
      }
    }
    if (e.type === 'seal') {
      S.seals[e.sealIdx] = true;
      G.vfx.pillar(e.pos, 0xff2a3a, 10, 1); G.shake(0.5);
      G.ui.toast(`Segel Darah hancur! (${S.seals.filter(Boolean).length}/3)`, 'gold');
      if (S.seals.every(Boolean)) { this._openGate(); if (S.step === 'volc_seals') G._advance('volc_boss'); }
      G.save();
    }
    if (e.type === 'sage') this._victory();
  }

  _openGate(instant = false) {
    const W = this.g.world;
    this.gateOpen = true;
    for (const c of W.gateColliders) c.disabled = true;
    if (instant) W.citadelGate.position.y -= 7.2;
    else { this.gateAnim = 7.2; this.g.ui.toast('Gerbang Infernal Citadel terbuka!', 'gold big'); this.g.shake(0.6); }
  }

  async _victory() {
    const G = this.g, S = G.state;
    setMusicMood('normal');
    for (const e of G.enemies) if (e.isAdd && !e.dead) e.die();
    this._clearHazards();
    S.volcDone = true; S.inv.fish += 10; S.inv.berry += 10;
    G.ui.toast('MENANG! Evy Blood Sage dikalahkan', 'gold big');
    await new Promise((r) => setTimeout(r, 1800));
    await G.ui.dialog(SCRIPTS.volcVictory);
    S.floesOpen = true;
    G._advance('frost_go');
  }

  _clearHazards() {
    for (const b of this.beams) this.g.scene.remove(b.grp); this.beams = [];
    for (const t of this.tethers) this.g.scene.remove(t.line); this.tethers = [];
  }

  /** red-tinted fog & sky while inside the volcanic region */
  mood(dt) {
    const G = this.g, P = G.player, W = G.world;
    const k = heatAt(P.pos.x, P.pos.z);
    this.moodK = (this.moodK ?? 0) + (k - (this.moodK ?? 0)) * (1 - Math.exp(-2 * dt));
    if (this.moodK > 0.01) {
      W.scene.fog.color.lerp(new THREE.Color(0x6a2a1a), this.moodK * 0.8);
      W.skyUniforms.horizon.value.lerp(new THREE.Color(0xa04a2a), this.moodK * 0.7);
      W.skyUniforms.top.value.lerp(new THREE.Color(0x3a1a1a), this.moodK * 0.5);
      W.scene.fog.near = 40; W.scene.fog.far = (G.gfx === 'low' ? 300 : 520) * (1 - this.moodK * 0.45);
    } else W.scene.fog.near = 90;
    this.ash.visible = this.moodK > 0.05;
    if (this.ash.visible) {
      this.ash.position.set(P.pos.x, P.pos.y, P.pos.z);
      const a = this.ash.geometry.attributes.position;
      for (let i = 0; i < a.count; i++) { let y = a.getY(i) - dt * 1.2; if (y < 0) y = 25; a.setY(i, y); }
      a.needsUpdate = true;
      this.ash.material.opacity = 0.8 * this.moodK;
    }
  }

  update(dt) {
    const G = this.g, S = G.state, P = G.player, W = G.world;
    this._updateHazards(dt);
    if (this.gateAnim > 0) { const d = Math.min(this.gateAnim, dt * 3); W.citadelGate.position.y -= d; this.gateAnim -= d; }
    // fire wall on the causeway until Chapter 1 is cleared
    W.causewayBarrier.visible = !S.causewayOpen;
    const bp = W.causewayBarrierPos;
    if (!S.causewayOpen && P.pos.z < bp.z + 2 && P.pos.z > bp.z - 10 && Math.abs(P.pos.x - bp.x) < 7) {
      P.pos.z = bp.z + 2;
      if (!this._barMsg || W.time - this._barMsg > 4) { this._barMsg = W.time; G.ui.toast('Dinding api menghalangi jalan… selesaikan Bab 1 dulu.'); }
    }
    const recruited = !!P.cache.eropatra;
    this.eroNpc.root.visible = !recruited; this.rumiNpc.root.visible = !recruited;
    if (G.inputLocked || P.dead) return;
    if (S.step === 'volc_go' && P.pos.distanceTo(VLOC.outpost) < 12) {
      G.ui.dialog(SCRIPTS.volcIntro).then(() => {
        S.volcCamp = true; S.spawn = 'volc';
        for (const id of ['eropatra', 'rumi']) { const m = P.addMember(id); m.level = P.level; m.maxHp = m.calcMaxHp(P.level); m.hp = m.maxHp; }
        S.party = P.roster.map((x) => x.id);
        if (S.coolHint !== true) { S.coolHint = true; S.inv.cool = (S.inv.cool || 0) + 2; G.ui.toast('Rumi memberimu 2 🧊 Jus Sejuk (tekan V)', 'gold'); }
        G.ui.toast('Eropatra & Rumi bergabung! Atur party di menu ☰', 'gold big');
        G.ui.buildParty();
        G._advance('volc_lanterns');
      });
    }
    const B = this.sage;
    if (B && S.step === 'volc_boss' && !B.started && !B.dead && Math.hypot(P.pos.x - B.home.x, P.pos.z - B.home.z) < CIT_R - 3) {
      G.ui.dialog(S.sageIntro ? SCRIPTS.sageRetry : SCRIPTS.sageIntro).then(() => {
        S.sageIntro = true;
        B.started = true; B.aggro = true; B.state = 'rest'; B.t = 0;
        sfx.roar(); G.shake(0.6); setMusicMood('boss');
        for (const c of G.world.gateColliders) c.disabled = false; // the gate slams shut behind you
        G.world.citadelGate.position.y = VLOC.citadel.y + 3.4; this.gateAnim = 0;
        G.ui.toast('Gerbang tertutup di belakangmu!', '');
      });
    }
  }

  onRespawn() {
    const B = this.sage;
    if (B && B.started && !B.dead) {
      B.started = false; B.hp = B.maxHp; B.pos.copy(B.home); B.state = 'idle'; B.invuln = false; B.enraged = false; B['sh0.7'] = B['sh0.35'] = false;
      for (const e of this.g.enemies) if (e.type === 'bloodcrystal') { e.dead = true; e.deadT = 1; }
      setMusicMood('normal');
      if (this.g.state.seals.every(Boolean)) this._openGate(true);
    }
    this._clearHazards();
  }

  onLoad() {
    const G = this.g, S = G.state;
    if (S.volcDone && this.sage) { this.sage.dead = true; this.sage.remove(); G.enemies = G.enemies.filter((e) => e !== this.sage); this.sage = null; }
    this.seals.forEach((e, i) => { if (S.seals[i]) { e.dead = true; e.remove(); G.enemies = G.enemies.filter((x) => x !== e); } });
    if (S.seals.every(Boolean)) this._openGate(true);
    S.lanterns.forEach((lit, i) => { if (lit) { const lm = G.world.lanternMeshes[i]; lm.flame.material.color.set(0xffe08a); lm.flame.scale.setScalar(1.6); } });
  }
}

export { heatAt, lavaAt, VOLC };
