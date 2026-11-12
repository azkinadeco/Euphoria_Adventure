// STARLIGHT RIFT — wave-based combat trial on a floating star platform (mode from Euphoria Online).
import { softDot, weatherProps } from './nature.js';
import * as THREE from 'three';
import { upgrade } from './assets.js';
import { Enemy } from './enemies.js';
import { toon, part, canvasTex } from './toon.js';
import { sfx, setMusicMood } from './sfx.js';
import { boostGlow } from './graphics.js';

export const ARENA = { x: 0, z: 120, y: 280, r: 24 };
const WAVES = [
  [['slime', 4], ['fox', 2]],
  [['reefslime', 3], ['jelly', 2], ['fox', 1, 'DARK']],
  [['ghost', 3], ['lavafox', 3]],
  [['frostwolf', 3], ['frostsoul', 2], ['lavafox', 1, 'FIRE']],
  [['frostwolf', 1, 'ICE'], ['ghost', 1, 'DARK'], ['ghost', 3], ['reefslime', 1, 'WATER']],
];

export class Rift {
  constructor(game) {
    this.g = game;
    this.active = false;
    this.built = false;
  }

  _build() {
    const G = this.g, W = G.world, S = G.scene, A = ARENA;
    this.group = new THREE.Group();
    const rune = canvasTex(512, 512, (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      gr.addColorStop(0, '#2a1650'); gr.addColorStop(0.7, '#1a0f36'); gr.addColorStop(1, '#0c0820');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#b48fff'; g.lineWidth = 4;
      for (const r of [240, 200, 120, 60]) { g.beginPath(); g.arc(w / 2, h / 2, r, 0, Math.PI * 2); g.stroke(); }
      g.lineWidth = 2;
      for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; g.beginPath(); g.moveTo(w / 2 + Math.cos(a) * 120, h / 2 + Math.sin(a) * 120); g.lineTo(w / 2 + Math.cos(a) * 200, h / 2 + Math.sin(a) * 200); g.stroke(); }
      g.fillStyle = '#ffe08a';
      for (let k = 0; k < 160; k++) { g.globalAlpha = Math.random(); g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
      g.globalAlpha = 1;
      g.font = 'bold 28px Georgia'; g.textAlign = 'center';
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; g.save(); g.translate(w / 2 + Math.cos(a) * 220, h / 2 + Math.sin(a) * 220); g.rotate(a + Math.PI / 2); g.fillText('✦', 0, 10); g.restore(); }
    });
    const top = new THREE.Mesh(new THREE.CircleGeometry(A.r, 64), new THREE.MeshToonMaterial({ map: rune, emissiveMap: rune, emissive: 0xffffff, emissiveIntensity: 0.6 }));
    top.rotation.x = -Math.PI / 2; top.position.set(A.x, A.y + 0.01, A.z); top.receiveShadow = true; this.group.add(top);
    const base = part(new THREE.CylinderGeometry(A.r, A.r * 0.35, 12, 24, 1), toon(0x2a1f40, { flatShading: true }), { ol: 0.08 });
    base.position.set(A.x, A.y - 6, A.z); this.group.add(base);
    upgrade('rift_base', this.group, base, (m) => { m.position.set(A.x, A.y - 0.03, A.z); m.scale.set(A.r, 1, A.r); }, { outline: 0.06 });
    const rim = new THREE.Mesh(new THREE.TorusGeometry(A.r, 0.25, 8, 96), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xb48fff).multiplyScalar(2.5) }));
    rim.rotation.x = Math.PI / 2; rim.position.set(A.x, A.y + 0.15, A.z); this.group.add(rim);
    const crys = toon(0xc8a0ff, { emissive: 0x6a3ad0, emissiveIntensity: 1.2 });
    this.crystals = [];
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const c = part(new THREE.OctahedronGeometry(1.2, 0), crys, { ol: 0.04 });
      c.scale.y = 2.6; c.position.set(A.x + Math.cos(a) * (A.r + 2.5), A.y + 4, A.z + Math.sin(a) * (A.r + 2.5));
      this.group.add(c); this.crystals.push(c);
    }
    for (let k = 0; k < 14; k++) { // floating rocks
      const a = Math.random() * Math.PI * 2, rr = A.r + 8 + Math.random() * 25;
      const rsz = 1 + Math.random() * 2.5;
      const rk = part(new THREE.DodecahedronGeometry(rsz, 0), toon(0x3a2f50, { flatShading: true }), { ol: 0.05 });
      rk.position.set(A.x + Math.cos(a) * rr, A.y - 10 + Math.random() * 25, A.z + Math.sin(a) * rr); this.group.add(rk);
      const rp = rk.position.clone();
      upgrade('void_debris', this.group, rk, (m) => { m.position.copy(rp); m.scale.setScalar(rsz); m.rotation.y = a; }, { outline: 0.04 });
    }
    const sg = new THREE.BufferGeometry(), sp = [];
    for (let k = 0; k < 500; k++) { const a = Math.random() * Math.PI * 2, rr = 5 + Math.random() * 60; sp.push(A.x + Math.cos(a) * rr, A.y - 20 + Math.random() * 50, A.z + Math.sin(a) * rr); }
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.motes = new THREE.Points(sg, new THREE.PointsMaterial({ map: softDot(), color: new THREE.Color(0xd8c0ff).multiplyScalar(2), size: 0.25, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.group.add(this.motes);
    boostGlow(this.group);
    this.group.visible = false;
    weatherProps(this.group, 0.6);
    S.add(this.group);
    this.walls = [];
    for (let k = 0; k < 48; k++) { const a = (k / 48) * Math.PI * 2; const c = W.addCollider(A.x + Math.cos(a) * (A.r + 0.8), A.z + Math.sin(a) * (A.r + 0.8), 1.4); c.disabled = true; this.walls.push(c); }
    W.animated.push({ update: (dt, t) => { if (!this.active) return; this.crystals.forEach((c, i) => { c.rotation.y = t + i; c.position.y = A.y + 4 + Math.sin(t + i) * 0.6; }); this.motes.rotation.y = t * 0.03; } });
    this.built = true;
  }

  enter() {
    const G = this.g, P = G.player, W = G.world;
    if (this.active) return;
    if (G.activeBoss()) { G.ui.toast('Selesaikan pertarungan bos dulu'); return; }
    if (!this.built) this._build();
    this.active = true;
    this.returnPos = P.pos.clone();
    this.savedDay = W.dayT;
    W.arenaFloor = ARENA;
    this.group.visible = true;
    for (const c of this.walls) c.disabled = false;
    P.placeAt(new THREE.Vector3(ARENA.x, 0, ARENA.z + 12), Math.PI);
    G.cam.target.copy(P.pos);
    P.healAll(1, true);
    for (const m of P.members) m.energy = m.def.burstCost * 0.5;
    this.wave = 0; this.time = 0; this.dmgTaken = 0; this.enemies = []; this.state = 'intro'; this.t = 0;
    G.combat.best = 0;
    document.getElementById('rift-hud').classList.remove('hidden');
    G.ui.bigText('STARLIGHT RIFT', '#d8c0ff');
    setMusicMood('boss');
    sfx.quest();
  }

  _spawnWave() {
    const G = this.g, P = G.player;
    const scale = 1 + (P.level - 1) * 0.1 + this.wave * 0.12;
    const list = WAVES[this.wave];
    let k = 0, total = list.reduce((a, b) => a + b[1], 0);
    for (const [type, n, elite] of list) for (let i = 0; i < n; i++) {
      const a = (k++ / total) * Math.PI * 2 + this.wave;
      const p = new THREE.Vector3(ARENA.x + Math.cos(a) * 15, ARENA.y, ARENA.z + Math.sin(a) * 15);
      const e = new Enemy(G, type, p, { leash: 999, elite });
      e.maxHp *= scale; e.hp = e.maxHp; e.dmg *= 0.9 + scale * 0.25; e.aggro = true; e.rift = true; e.home.copy(new THREE.Vector3(ARENA.x, ARENA.y, ARENA.z));
      if (e.shield) { e.shield.hp *= scale; e.shield.max = e.shield.hp; }
      G.enemies.push(e); this.enemies.push(e);
      G.vfx.pillar(p, 0xb48fff, 6, 0.7);
    }
    const b = document.getElementById('wave-banner');
    b.textContent = this.wave === WAVES.length - 1 ? 'GELOMBANG TERAKHIR' : `GELOMBANG ${this.wave + 1}`;
    b.classList.remove('hidden'); clearTimeout(this._wb); this._wb = setTimeout(() => b.classList.add('hidden'), 1800);
    sfx.roar();
  }

  onPlayerHit(dmg) { if (this.active) this.dmgTaken += dmg; }

  update(dt) {
    if (!this.active) return;
    const G = this.g, P = G.player, W = G.world;
    W.dayT = 0.93; // eternal starlit night inside the rift
    this.t += dt;
    if (this.state !== 'result') this.time += dt;
    document.getElementById('rift-wave').textContent = `Gelombang ${Math.min(this.wave + 1, WAVES.length)}/${WAVES.length}`;
    document.getElementById('rift-time').textContent = `⏱ ${Math.floor(this.time / 60)}:${String(Math.floor(this.time % 60)).padStart(2, '0')}`;
    // fell off the platform
    if (P.pos.y < ARENA.y - 14 && !P.dead) {
      P.placeAt(new THREE.Vector3(ARENA.x, 0, ARENA.z)); P.iframes = 1;
      P.hp = Math.max(1, P.hp - P.maxHp * 0.15); G.ui.toast('Jatuh dari platform! (-15% HP)');
    }
    if (this.state === 'intro' && this.t > 2.2) { this.state = 'fight'; this._spawnWave(); }
    else if (this.state === 'fight') {
      this.enemies = this.enemies.filter((e) => !e.dead);
      if (!this.enemies.length) { this.state = 'pause'; this.t = 0; this.wave++; P.healAll(0.15); if (this.wave >= WAVES.length) this._finish(); else G.ui.toast(`Gelombang selesai! Party pulih 15%`, 'gold'); }
    } else if (this.state === 'pause' && this.t > 2.5) { this.state = 'fight'; this._spawnWave(); }
  }

  async _finish() {
    const G = this.g, S = G.state, P = G.player;
    this.state = 'result';
    const t = this.time, maxHp = P.members.reduce((a, m) => a + m.maxHp, 0);
    const dmgRatio = this.dmgTaken / Math.max(1, maxHp);
    let stars = 1; if (t < 300) stars++; if (dmgRatio < 0.6) stars++;
    const best = G.combat.best;
    const R = S.rift = S.rift || { clears: 0, bestTime: null, bestStars: 0 };
    const first = R.clears === 0;
    R.clears++; R.bestStars = Math.max(R.bestStars, stars); R.bestTime = R.bestTime ? Math.min(R.bestTime, t) : t;
    const fish = 3 + stars * 2, berry = 4 + stars * 2;
    S.inv.fish += fish; S.inv.berry += berry; S.inv.pepper = (S.inv.pepper || 0) + stars;
    P.addExp(200 + stars * 120 + (first ? 400 : 0));
    G.ui.bigText('★'.repeat(stars) + '☆'.repeat(3 - stars), '#ffd66b');
    sfx.quest();
    await new Promise((r) => setTimeout(r, 1600));
    const mm = Math.floor(t / 60), ss = String(Math.floor(t % 60)).padStart(2, '0');
    await G.ui.dialog([
      ['nar', `— STARLIGHT RIFT SELESAI —   ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`],
      ['nar', `Waktu ${mm}:${ss} · Damage diterima ${Math.round(dmgRatio * 100)}% · Combo terbaik ${best} HIT`],
      ['nar', `Hadiah: +${fish} 🐟 +${berry} 🫐 +${stars} 🌶️ · EXP besar${first ? ' · Bonus clear pertama!' : ''}`],
      ['nar', '★ syarat: selesai < 5 menit, dan damage diterima < 60% total HP party.'],
    ]);
    this.exit();
    G.save();
  }

  exit() {
    const G = this.g, P = G.player, W = G.world;
    if (!this.active) return;
    this.active = false;
    for (const e of this.enemies) if (!e.dead) { e.dead = true; e.deadT = 1; }
    this.enemies = [];
    W.arenaFloor = null;
    W.dayT = this.savedDay ?? W.dayT;
    this.group.visible = false;
    for (const c of this.walls) c.disabled = true;
    document.getElementById('rift-hud').classList.add('hidden');
    P.placeAt(this.returnPos || new THREE.Vector3(0, 0, 0));
    G.cam.target.copy(P.pos);
    setMusicMood('normal');
  }

  fail() {
    if (!this.active) return;
    this.g.ui.toast('Gagal di Starlight Rift… coba lagi dengan party yang lebih kuat!', '');
    this.exit();
  }
}
