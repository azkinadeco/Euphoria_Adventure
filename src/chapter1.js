// Chapter 1 — SUNKEN REEF: story objects, quests, hazards, treasure chests.
import * as THREE from 'three';
import { RLOC, BRIDGE, makeChest } from './reef.js';
import { Enemy } from './enemies.js';
import { ScyllaRig } from './heroes3d.js';
import { makeNPC } from './characters.js';
import { toon, part } from './toon.js';
import { SCRIPTS } from './story.js';
import { sfx, setMusicMood } from './sfx.js';

const REEF_STEPS = ['reef_samples', 'reef_spires', 'reef_boss'];

export class Chapter1 {
  constructor(game) {
    this.g = game;
    const G = game, W = game.world, S = game.scene;
    this.puddles = [];
    this.waves = [];

    // ---------- NPCs at the reef camp ----------
    const C = RLOC.camp;
    this.scyllaNpc = new ScyllaRig();
    this.scyllaNpc.root.position.set(C.x + 2.5, C.y, C.z + 2.5); this.scyllaNpc.root.rotation.y = -2.3;
    S.add(this.scyllaNpc.root);
    this.hyeonxa = makeNPC({
      hair: 0x1e1622, outfit: 0x2a1830, accent: 0xb03a6a, skin: 0xffe6da,
      extra: (g, body, head) => {
        for (const s of [-1, 1]) { const horn = part(new THREE.ConeGeometry(0.03, 0.2, 6), toon(0xd86a9a), { ol: 0.005 }); horn.position.set(s * 0.08, 0.24, 0); horn.rotation.z = -s * 0.4; head.add(horn); }
        // two serpents coiling over her shoulders
        for (const s of [-1, 1]) {
          const sn = new THREE.Group(); sn.position.set(s * 0.32, 1.35, -0.1); body.add(sn);
          for (let i = 0; i < 6; i++) { const seg = part(new THREE.SphereGeometry(0.07 - i * 0.004, 8, 6), toon(0x3a1a2a), { ol: 0.006 }); seg.position.set(s * Math.sin(i * 0.6) * 0.12, i * 0.09, Math.cos(i * 0.6) * 0.08); sn.add(seg); }
          const hd = part(new THREE.SphereGeometry(0.08, 8, 6), toon(0x3a1a2a), { ol: 0.006 }); hd.scale.set(1, 0.8, 1.4); hd.position.set(s * 0.05, 0.6, 0.12); sn.add(hd);
          g.userData['snake' + s] = sn;
        }
      },
    });
    this.hyeonxa.position.set(C.x - 2.4, C.y, C.z + 2.8); this.hyeonxa.rotation.y = 2.4;
    S.add(this.hyeonxa);
    W.addCollider(this.hyeonxa.position.x, this.hyeonxa.position.z, 0.4);
    W.animated.push({ update: (dt, t) => {
      this.hyeonxa.userData.update(dt);
      for (const s of [-1, 1]) { const sn = this.hyeonxa.userData['snake' + s]; if (sn) sn.rotation.y = Math.sin(t * 1.5 + s) * 0.4; }
      if (this.scyllaNpc.root.visible) this.scyllaNpc.update(dt, { speed: 0, grounded: true });
    } });
    const talk = { pos: this.hyeonxa.position, radius: 2.6, kind: 'reef_talk', label: 'Bicara dengan Hyeonxa' };
    talk.enabled = () => G.state.reefCamp;
    W.interactables.push(talk);
    const cf = { pos: W.reefCampfire.pos, radius: 3, kind: 'reef_rest', label: 'Istirahat di api unggun karang' };
    cf.enabled = () => G.state.reefCamp;
    W.interactables.push(cf);

    // ---------- poison tide pools ----------
    RLOC.pools.forEach((p, i) => {
      const it = { pos: p, radius: 3.2, kind: 'pool', idx: i, label: 'Ambil sampel racun' };
      it.enabled = () => G.state.step === 'reef_samples' && !G.state.samples[i];
      W.interactables.push(it);
    });

    // ---------- treasure chests ----------
    const land = (x, z) => {
      for (let r = 0; r < 30; r += 1.5) for (let a = 0; a < 6.28; a += 0.7) {
        const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
        if (W.heightAt(px, pz) > 1) return new THREE.Vector3(px, W.groundAt(px, pz), pz);
      }
      return new THREE.Vector3(x, Math.max(W.groundAt(x, z), 0), z);
    };
    const spots = [
      land(-120, 40), land(110, -120),                          // Whispering Woods
      new THREE.Vector3(RLOC.ruins.x, W.ruinsTop, RLOC.ruins.z + 0.6), // ruins pedestal
      land(382, -64), land(468, 120), land(520, -70),             // reef
      land(RLOC.islets[0].x, RLOC.islets[0].z), land(RLOC.islets[1].x, RLOC.islets[1].z), // swim-only islets
    ];
    G.state.chestTotal = spots.length;
    this.chests = spots.map((p, i) => {
      const ch = makeChest(W, p, i * 1.3);
      const it = { pos: ch.group.position, radius: 2.4, kind: 'chest', idx: i, label: 'Buka peti harta', chest: ch };
      it.enabled = () => !G.state.chests[i];
      W.interactables.push(it);
      W.animated.push({ update: (dt) => { if (G.state.chests[i]) { ch.lid.rotation.x = Math.max(ch.lid.rotation.x - dt * 4, -1.9); ch.glow.intensity = 0; } } });
      return ch;
    });

    this._spawnEnemies();
  }

  _spawnEnemies() {
    const G = this.g, v = (x, z) => new THREE.Vector3(x, 0, z);
    const zones = [
      { c: RLOC.pools[0].clone(), r: 8, type: 'reefslime', n: 3 },
      { c: RLOC.pools[1].clone(), r: 8, type: 'jelly', n: 2 },
      { c: RLOC.pools[1].clone(), r: 8, type: 'reefslime', n: 2 },
      { c: RLOC.pools[2].clone(), r: 8, type: 'jelly', n: 3 },
      { c: v(395, 20), r: 12, type: 'reefslime', n: 3 },
      { c: v(470, -10), r: 14, type: 'jelly', n: 2 },
      { c: v(500, 40), r: 12, type: 'reefslime', n: 3 },
      { c: v(440, 70), r: 12, type: 'jelly', n: 2 },
    ];
    for (const z of zones) { z.alive = []; z.respawnT = 0; z.water = true; G.zones.push(z); for (let i = 0; i < z.n; i++) G._spawnIn(z); }
    this.spires = RLOC.spires.map((p, i) => {
      if (G.state.spires?.[i]) return null;
      const pos = p.clone(); pos.y = G.world.groundAt(p.x, p.z);
      const e = new Enemy(G, 'spire', pos, { leash: 999 });
      e.spireIdx = i;
      G.enemies.push(e);
      return e;
    });
    if (!G.state.reefDone) {
      const q = RLOC.lair.clone(); q.y = G.world.groundAt(q.x, q.z);
      this.queen = new Enemy(G, 'queen', q, { leash: 60 });
      G.enemies.push(this.queen);
    }
  }

  // ---------- hazards ----------
  addPuddle(pos, r, life, color = 0x9b3fe0) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 28), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.copy(pos); m.position.y += 0.08;
    this.g.scene.add(m);
    this.g.vfx.particles(pos.clone().setY(pos.y + 0.3), 20, 0xc070ff, { speed: 4, up: 3, life: 0.5 });
    this.puddles.push({ m, pos: pos.clone(), r, life, tick: 0 });
  }
  addWave(center, maxR, speed, dmg) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.35, 6, 64), new THREE.MeshBasicMaterial({ color: 0x8fe8ff, transparent: true, opacity: 0.75 }));
    m.rotation.x = Math.PI / 2; m.position.copy(center); m.position.y = Math.max(center.y, 0) + 0.3;
    this.g.scene.add(m);
    this.waves.push({ m, c: center.clone(), r: 1, maxR, speed, dmg, hit: false });
  }
  _updateHazards(dt) {
    const P = this.g.player;
    const airborne = P.pos.y - this.g.world.groundAt(P.pos.x, P.pos.z) > 0.45;
    for (let i = this.puddles.length - 1; i >= 0; i--) {
      const p = this.puddles[i];
      p.life -= dt; p.tick -= dt;
      p.m.material.opacity = Math.min(0.55, p.life * 0.5);
      if (p.tick <= 0 && !airborne && Math.hypot(P.pos.x - p.pos.x, P.pos.z - p.pos.z) < p.r) { p.tick = 0.6; P.iframes = 0; P.damage(6, null, 0); }
      if (p.life <= 0) { this.g.scene.remove(p.m); this.puddles.splice(i, 1); }
    }
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i];
      w.r += w.speed * dt;
      w.m.scale.set(w.r, w.r, 1 + Math.sin(w.r) * 0.2);
      w.m.material.opacity = 0.75 * (1 - w.r / w.maxR);
      const d = Math.hypot(P.pos.x - w.c.x, P.pos.z - w.c.z);
      if (!w.hit && Math.abs(d - w.r) < 0.9 && !airborne) { w.hit = true; P.damage(w.dmg, w.c, 12); }
      if (w.r >= w.maxR) { this.g.scene.remove(w.m); this.waves.splice(i, 1); }
    }
  }

  // ---------- quests ----------
  questTarget(step) {
    const S = this.g.state, P = this.g.player;
    const nearest = (list, done) => { let b = null, bd = Infinity; list.forEach((p, i) => { if (!done[i]) { const d = p.distanceTo(P.pos); if (d < bd) { bd = d; b = p; } } }); return b; };
    if (step === 'reef_go') return P.pos.x < BRIDGE.a.x ? BRIDGE.a : RLOC.camp;
    if (step === 'reef_samples') return nearest(RLOC.pools, S.samples);
    if (step === 'reef_spires') return nearest(RLOC.spires, S.spires);
    if (step === 'reef_boss') return RLOC.lair;
    return null;
  }

  async interact(it) {
    const G = this.g, S = G.state, P = G.player;
    switch (it.kind) {
      case 'pool': {
        S.samples[it.idx] = true;
        sfx.quest(); G.vfx.pillar(it.pos, 0xb04bff, 5, 0.8);
        G.ui.toast(`Sampel racun diambil (${S.samples.filter(Boolean).length}/3)`, 'gold');
        if (S.samples.every(Boolean)) { await G.ui.dialog(SCRIPTS.reefMid); G._advance('reef_spires'); }
        G.save();
        return true;
      }
      case 'chest': {
        S.chests[it.idx] = true;
        const fish = 2 + Math.floor(Math.random() * 2), berry = 3;
        S.inv.fish += fish; S.inv.berry += berry; S.pearls = (S.pearls || 0) + 1;
        P.addExp(80 + P.level * 10);
        for (const m of P.members) m.energy = Math.min(m.def.burstCost, m.energy + 20);
        sfx.quest(); G.vfx.pillar(it.pos, 0xffd66b, 6, 1);
        G.vfx.particles(it.pos.clone().setY(it.pos.y + 1), 40, 0xffe08a, { speed: 5, up: 6, life: 0.9 });
        G.ui.toast(`Peti harta! +${fish} 🐟 +${berry} 🫐 +1 🦪 Mutiara Laut (${S.pearls}/${S.chestTotal})`, 'gold big');
        G.save();
        return true;
      }
      case 'reef_rest': {
        P.healAll(1, true); S.spawn = 'reef';
        G.ui.toast('Istirahat di api unggun karang. HP pulih! (Tersimpan)', 'gold');
        G._sleepIfNight(); G.save();
        return true;
      }
      case 'reef_talk': {
        const lines = [
          'Ular-ularku bilang kau mencium seperti ikan asin. …Itu pujian.',
          'Air dalam itu dunia Scylla. Ada pulau kecil di tenggara dan timur laut yang hanya bisa dicapai dengan berenang.',
          'Racun ini harum seperti bunga yang terbakar. Seseorang di Infernal Citadel suka bermain kimia.',
        ];
        await G.ui.dialog([['hyeonxa', lines[Math.floor(Math.random() * lines.length)]]]);
        return true;
      }
    }
    return false;
  }

  onKilled(e) {
    const G = this.g, S = G.state;
    if (e.type === 'spire') {
      S.spires[e.spireIdx] = true;
      G.vfx.pillar(e.pos, 0xe6a8ff, 10, 1); G.shake(0.5);
      G.ui.toast(`Menara Karang hancur! (${S.spires.filter(Boolean).length}/3)`, 'gold');
      if (S.step === 'reef_spires' && S.spires.every(Boolean)) G._advance('reef_boss');
      G.save();
    }
    if (e.type === 'queen') this._victory();
  }

  async _victory() {
    const G = this.g, S = G.state;
    setMusicMood('normal');
    for (const e of G.enemies) if (e.isAdd && !e.dead) e.die();
    for (const p of this.puddles) G.scene.remove(p.m); this.puddles = [];
    S.reefDone = true;
    S.inv.fish += 8;
    G.ui.toast('MENANG! Slime Queen dikalahkan', 'gold big');
    await new Promise((r) => setTimeout(r, 1800));
    await G.ui.dialog(SCRIPTS.reefVictory);
    S.causewayOpen = true;
    G._advance('volc_go');
  }

  update(dt) {
    const G = this.g, S = G.state, P = G.player;
    this._updateHazards(dt);
    // fog barrier on the Coral Bridge until the prologue is cleared
    G.world.bridgeBarrier.visible = !S.bridgeOpen;
    if (!S.bridgeOpen && P.pos.x > BRIDGE.a.x + 3 && P.pos.x < BRIDGE.a.x + 12 && Math.abs(P.pos.z - BRIDGE.a.z) < 5) {
      P.pos.x = BRIDGE.a.x + 3;
      if (!this._barrierMsg || G.world.time - this._barrierMsg > 4) { this._barrierMsg = G.world.time; G.ui.toast('Kabut ungu menghalangi jembatan… selesaikan Prolog dulu.'); }
    }
    this.scyllaNpc.root.visible = !S.party.includes('scylla');
    if (G.inputLocked || P.dead) return;
    if (S.step === 'reef_go' && P.pos.distanceTo(RLOC.camp) < 12) {
      G.ui.dialog(SCRIPTS.reefIntro).then(() => {
        S.reefCamp = true; S.spawn = 'reef';
        P.addMember('scylla');
        const m = P.members.find((x) => x.id === 'scylla'); m.level = P.level; m.maxHp = m.calcMaxHp(P.level); m.hp = m.maxHp;
        S.party = P.members.map((x) => x.id);
        G.ui.buildParty();
        G.ui.toast('Scylla bergabung ke party!', 'gold big');
        G.ui.toast(G.input.touch ? 'Tap potret Scylla untuk berenang di air dalam' : 'Tekan 4 untuk Scylla — hanya dia yang bisa berenang di air dalam', '');
        G._advance('reef_samples');
      });
    }
    const Q = this.queen;
    if (Q && S.step === 'reef_boss' && !Q.started && !Q.dead && Math.hypot(P.pos.x - Q.home.x, P.pos.z - Q.home.z) < 30) {
      G.ui.dialog(S.queenIntro ? SCRIPTS.queenRetry : SCRIPTS.queenIntro).then(() => {
        S.queenIntro = true;
        Q.started = true; Q.aggro = true; Q.state = 'rest'; Q.t = 0;
        sfx.roar(); G.shake(0.6); setMusicMood('boss');
      });
    }
  }

  onRespawn() {
    const Q = this.queen;
    if (Q && Q.started && !Q.dead) {
      Q.started = false; Q.hp = Q.maxHp; Q.pos.copy(Q.home); Q.state = 'idle'; Q.enraged = false; Q['split0.66'] = Q['split0.33'] = false; Q.cancelTele();
      setMusicMood('normal');
    }
    for (const p of this.puddles) this.g.scene.remove(p.m); this.puddles = [];
    for (const w of this.waves) this.g.scene.remove(w.m); this.waves = [];
  }

  onLoad() {
    const S = this.g.state;
    if (S.reefDone && this.queen) { this.queen.dead = true; this.queen.remove(); this.g.enemies = this.g.enemies.filter((e) => e !== this.queen); this.queen = null; }
    this.spires.forEach((e, i) => { if (e && S.spires[i]) { e.dead = true; e.remove(); this.g.enemies = this.g.enemies.filter((x) => x !== e); } });
    if (S.party.includes('scylla')) this.g.player.addMember('scylla');
  }

  static get steps() { return REEF_STEPS; }
}
