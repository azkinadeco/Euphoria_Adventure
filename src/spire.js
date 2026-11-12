// Abyssal Celestial Spire (Menara Ujian Para Bintang)
// The ultimate endgame challenge dungeon featuring 6 trial floors,
// timed chamber battles, per-floor rules, star ratings, and massive Starlight / Artifact rewards!

import { weatherProps } from './nature.js';
import * as THREE from 'three';
import { upgrade, portalFrame } from './assets.js';
import { Enemy } from './enemies.js';
import { toon, part, animeMetal } from './toon.js';
import { boostGlow } from './graphics.js';
import { dropRandomArtifact } from './artifacts.js';
import { sfx, setMusicMood } from './sfx.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export const SPIRE_FLOORS = [
  {
    floor: 1,
    name: 'Lantai 1 · Hembusan Angin Pembuka',
    desc: 'Ujian awal para pengembara di Whispering Woods.',
    disorder: '🍃 Aturan: reaksi Pusaran & damage WIND +75%',
    rules: { elements: ['WIND'], reacts: ['SWIRL'], mult: 1.75 },
    timeLimit: 180,
    waves: [
      { type: 'slime', count: 4, elite: null },
      { type: 'fox', count: 3, elite: 'WIND' },
    ],
  },
  {
    floor: 2,
    name: 'Lantai 2 · Gelombang Pasang Karang',
    desc: 'Arus laut berbahaya dari Lautan Karang.',
    disorder: '🌊 Aturan: reaksi Arus Berantai & Beku +80%',
    rules: { reacts: ['ELECTRO', 'FREEZE'], mult: 1.8 },
    timeLimit: 180,
    waves: [
      { type: 'reefslime', count: 4, elite: null },
      { type: 'jelly', count: 3, elite: 'WATER' },
    ],
  },
  {
    floor: 3,
    name: 'Lantai 3 · Lahar Neraka Membara',
    desc: 'Hawa panas kawah vulkanik dan sihir darah.',
    disorder: '🔥 Aturan: reaksi Lebur & Uap Meledak +100%',
    rules: { reacts: ['MELT', 'VAPORIZE'], mult: 2 },
    timeLimit: 180,
    waves: [
      { type: 'lavafox', count: 3, elite: 'FIRE' },
      { type: 'sage', count: 1, elite: 'FIRE' },
    ],
  },
  {
    floor: 4,
    name: 'Lantai 4 · Gletser Beku Frostvale',
    desc: 'Badai salju abadi dan hantu es penjaga kuil.',
    disorder: '❄️ Aturan: reaksi Retak Petir & damage ICE +90%',
    rules: { elements: ['ICE'], reacts: ['SUPERCONDUCT'], mult: 1.9 },
    timeLimit: 180,
    waves: [
      { type: 'frostwolf', count: 3, elite: 'ICE' },
      { type: 'phantom', count: 1, elite: 'ICE' },
    ],
  },
  {
    floor: 5,
    name: 'Lantai 5 · Kehampaan Primordial',
    desc: 'Dimensi Void Rift yang mengikis realitas.',
    disorder: '🌌 Aturan: isi energi +50% & damage Burst +80%',
    rules: { burst: true, mult: 1.8, energy: 1.5 },
    timeLimit: 200,
    waves: [
      { type: 'voideye', count: 3, elite: 'DARK' },
      { type: 'anchorguard', count: 2, elite: 'DARK' },
      { type: 'ygg', count: 1, elite: null },
    ],
  },
  {
    floor: 6,
    name: 'Lantai 6 · Tahta Para Bintang',
    desc: 'Puncak tertinggi Celestial Spire, pertempuran para dewa.',
    disorder: '👑 Aturan: seluruh reaksi elemen +120% & Crit Rate +20%',
    rules: { anyReact: true, mult: 2.2, crit: 0.2 },
    timeLimit: 240,
    waves: [
      { type: 'archon', count: 2, elite: 'LIGHT' },
      { type: 'prismguard', count: 2, elite: 'LIGHTNING' },
      { type: 'sovereign', count: 1, elite: null },
    ],
  },
];

export class Spire {
  constructor(game) {
    this.g = game;
    this.active = false;
    this.built = false;
    this.currentFloor = 1;
    this.timeLeft = 0;
    this.enemies = [];
    this.waveIdx = 0;
    this.spireCenter = V(0, 320, -1200);
    this.radius = 32;
    this.returnPos = V(1, 0, 3);
  }

  _build() {
    if (this.built) return;
    this.built = true;
    const G = this.g, S = G.scene, W = G.world;
    const grp = this.group = new THREE.Group();

    // Spire Floating Battle Arena Platform
    const C = this.spireCenter;
    const marbleMat = toon(0xc9bfaa);
    const goldRim = animeMetal(0xffd700);
    const darkUnder = toon(0x1a1626, { flatShading: true });

    // Main dais
    const top = part(new THREE.CylinderGeometry(this.radius, this.radius * 0.94, 2.4, 32), marbleMat, { ol: 0.04 });
    top.position.set(C.x, C.y - 1.2, C.z);
    top.receiveShadow = true;
    grp.add(top);

    // Golden boundary ring
    const ring = new THREE.Mesh(new THREE.TorusGeometry(this.radius - 0.4, 0.25, 8, 48), goldRim);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(C.x, C.y + 0.05, C.z);
    grp.add(ring);

    // Underside inverted cone
    const under = part(new THREE.ConeGeometry(this.radius * 0.94, this.radius * 1.6, 24, 2), darkUnder, { ol: 0.04 });
    under.rotation.x = Math.PI;
    under.position.set(C.x, C.y - 2.4 - this.radius * 0.8, C.z);
    grp.add(under);
    upgrade('asgard_island', grp, [top, under], (m) => { m.position.set(C.x, C.y, C.z); m.scale.setScalar(this.radius); }, { outline: 0.04 });

    // 8 Rune Monolith Pillars surrounding arena
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const px = C.x + Math.cos(a) * (this.radius - 2.8);
      const pz = C.z + Math.sin(a) * (this.radius - 2.8);
      const pil = part(new THREE.BoxGeometry(1.6, 12, 1.6), marbleMat, { ol: 0.03 });
      pil.position.set(px, C.y + 6, pz);
      grp.add(pil);

      const cap = new THREE.Mesh(new THREE.OctahedronGeometry(0.8), goldRim);
      cap.position.set(px, C.y + 12.8, pz);
      grp.add(cap);
      upgrade('spire_monolith', grp, [pil, cap], (m) => { m.position.set(px, C.y, pz); m.rotation.y = -a; }, { outline: 0.03 });

      W.addCollider(px, pz, 1.2);
    }

    // Central Monolith
    const centerMono = part(new THREE.OctahedronGeometry(2.4, 0), animeMetal(0xffd700), { ol: 0.03 });
    centerMono.position.set(C.x, C.y + 3.8, C.z);
    centerMono.scale.set(0.8, 1.8, 0.8);
    grp.add(centerMono);
    this.centerMono = centerMono;

    // Exit portal back to Asgard
    const portal = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.25, 8, 32), new THREE.MeshBasicMaterial({ color: 0xffd700 }));
    portal.position.set(C.x, C.y + 2.6, C.z + this.radius - 4);
    grp.add(portal);
    portalFrame(grp, portal.position, 2.5);

    W.interactables.push({
      pos: new THREE.Vector3(C.x, C.y + 1, C.z + this.radius - 4),
      radius: 3.5,
      kind: 'spire_exit',
      label: 'Keluar dari Menara Ujian',
      enabled: () => this.active,
    });

    boostGlow(grp);
    grp.visible = false;
    weatherProps(grp, 0.3);
    S.add(grp);

    W.animated.push({
      update: (dt, t) => {
        if (!this.active) return;
        if (this.centerMono) {
          this.centerMono.rotation.y = t * 1.5;
          this.centerMono.position.y = C.y + 3.8 + Math.sin(t * 2) * 0.25;
        }
      },
    });
  }

  get rules() { return SPIRE_FLOORS[this.currentFloor - 1].rules; }
  damageMult(element, react, isBurst) {
    const r = this.rules;
    const hit = (r.anyReact && react) || (r.burst && isBurst) || (react && r.reacts?.includes(react)) || (element && r.elements?.includes(element));
    return hit ? r.mult : 1;
  }
  energyMult() { return this.rules.energy || 1; }
  critBonus() { return this.rules.crit || 0; }

  groundAt(x, z) {
    const C = this.spireCenter;
    if ((x - C.x) ** 2 + (z - C.z) ** 2 < this.radius * this.radius) {
      return C.y;
    }
    return -400;
  }

  startFloor(floorNum = 1) {
    const G = this.g, P = G.player, S = G.state;
    this._build();
    this.returnPos = P.pos.clone();
    this.currentFloor = Math.max(1, Math.min(6, floorNum));
    const flDef = SPIRE_FLOORS[this.currentFloor - 1];
    this.active = true;
    G.world.realm = this;
    this.group.visible = true;
    G.graphics.mood({ bloom: 0.34 });

    // Hide main world ground/water
    G.world.terrain.visible = false;
    G.world.water.visible = false;

    const C = this.spireCenter;
    P.placeAt(V(C.x, C.y + 0.5, C.z + 18), 0);
    P.healAll(1, true);

    this.timeLeft = flDef.timeLimit;
    this.waveIdx = 0;
    this.waveT = 0; this.leaveT = 0;
    this.enemies = [];

    sfx.portal();
    setMusicMood('boss');
    G.ui.toast(`MEMASUKI ${flDef.name.toUpperCase()}!`, 'gold big');
    G.ui.toast(flDef.disorder, 'gold');

    this._spawnNextWave();
  }

  _spawnNextWave() {
    const G = this.g, C = this.spireCenter;
    const flDef = SPIRE_FLOORS[this.currentFloor - 1];
    if (this.waveIdx >= flDef.waves.length) {
      this._completeFloor();
      return;
    }

    const wave = flDef.waves[this.waveIdx];
    this.waveIdx++;
    G.ui.toast(`Gelombang ${this.waveIdx}/${flDef.waves.length}!`, 'gold');

    for (let k = 0; k < wave.count; k++) {
      const ang = (k / wave.count) * Math.PI * 2 + Math.PI / 6;
      const dist = 6 + Math.random() * 8;
      const pos = V(C.x + Math.cos(ang) * dist, C.y, C.z + Math.sin(ang) * dist);
      const e = new Enemy(G, wave.type, pos, { leash: this.radius + 6, elite: wave.elite });
      e.realmMob = true;
      e.spireMob = true;
      e.aggro = true;
      if (e.isBoss) { e.started = true; e.state = 'rest'; e.t = 0; }
      G.enemies.push(e);
      this.enemies.push(e);
      G.vfx.pillar(pos, 0xffd700, 7, 0.6);
    }
  }

  /** white marble under full daylight would blow out through the bloom pass */
  mood() {
    if (!this.active) return;
    const W = this.g.world;
    W.sun.intensity *= 0.6; W.hemi.intensity *= 0.6;
  }

  update(dt) {
    if (!this.active) return;
    const G = this.g, P = G.player;
    // floor cleared: short pause on the reward, then leave
    if (this.leaveT > 0) { this.leaveT -= dt; if (this.leaveT <= 0) this.exit(); return; }
    this.timeLeft -= dt;

    if (this.timeLeft <= 0) {
      this.exit();
      G.ui.toast('WAKTU HABIS! Tantangan Menara Gagal.', 'gold big');
      sfx.hurt();
      return;
    }

    // Check fell off
    if (P.pos.y < this.spireCenter.y - 15) {
      P.placeAt(V(this.spireCenter.x, this.spireCenter.y + 0.5, this.spireCenter.z + 18));
      P.hp = Math.max(1, P.hp - P.maxHp * 0.15);
      G.ui.toast('Jatuh dari arena Menara! (-15% HP)');
    }

    // Check wave clear
    if (this.enemies.length > 0 && this.enemies.every((e) => e.dead)) {
      this.enemies = [];
      this.waveT = 1;
    }
    if (this.waveT > 0) { this.waveT -= dt; if (this.waveT <= 0) this._spawnNextWave(); }
  }

  _completeFloor() {
    const G = this.g, S = G.state;
    const flDef = SPIRE_FLOORS[this.currentFloor - 1];
    const secLeft = Math.ceil(this.timeLeft);

    let stars = 1;
    if (secLeft >= 120) stars = 3;
    else if (secLeft >= 60) stars = 2;

    if (!S.spireStars) S.spireStars = {};
    const prevStars = S.spireStars[this.currentFloor] || 0;
    S.spireStars[this.currentFloor] = Math.max(prevStars, stars);

    // Starlight rewards (100 per star)
    const starlightEarned = stars * 100;
    S.starlight = (S.starlight || 0) + starlightEarned;

    // Drop artifact
    const art = dropRandomArtifact(this.currentFloor >= 4 ? 5 : 4);
    if (!S.inventoryArtifacts) S.inventoryArtifacts = [];
    S.inventoryArtifacts.push(art);

    sfx.quest();
    G.ui.toast(`LANTAI ${this.currentFloor} SELESAI! ${'⭐'.repeat(stars)} (${secLeft}s tersisa)`, 'gold big');
    G.ui.toast(`Hadiah: +${starlightEarned} ✦ Starlight & Artifak [${art.setName} - ${art.slotName}]!`, 'gold big');

    setMusicMood('normal');
    this.leaveT = 2.5;
  }

  exit(failed = false) {
    const G = this.g, P = G.player;
    if (!this.active) return;
    this.active = false;
    G.world.realm = null;
    this.group.visible = false;
    G.graphics.mood({ bloom: 0.42 });

    G.world.terrain.visible = true;
    G.world.water.visible = true;

    // Kill remaining mobs
    for (const e of G.enemies) if ((e.spireMob || e.isAdd || ['eclipsecore', 'voidroot', 'bloodcrystal'].includes(e.type)) && !e.dead) { e.dead = true; e.deadT = 1; e.cancelTele(); }
    this.enemies = [];

    if (!failed) P.placeAt(this.returnPos, 0);
    G.cam.target.copy(P.pos);
    setMusicMood('normal');
  }

  async interact(it) {
    if (it.kind === 'spire_exit') {
      this.exit();
      this.g.ui.toast('Keluar dari Menara Ujian');
      return true;
    }
    return false;
  }
}
