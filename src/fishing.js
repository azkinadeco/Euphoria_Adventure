// Euphoria Adventure — Interactive Fishing System
// fishing spots, tension-bar minigame, fish species, and culinary ingredients.
import * as THREE from 'three';
import { upgrade } from './assets.js';
import { sfx } from './sfx.js';

export const FISH_SPECIES = [
  { id: 'perch', name: 'Starfall Perch', stars: 2, icon: '🐟', color: '#54a0ff', desc: 'Ikan air tawar berkilau dari Danau Bintang. Dagingnya lembut dan harum.', starlight: 5 },
  { id: 'trout', name: 'Coral Trout', stars: 3, icon: '🐠', color: '#ff6b81', desc: 'Ikan karang cerah bergaris merah muda dari Sunken Lagoon. Kaya akan minyak sehat.', starlight: 10 },
  { id: 'bass', name: 'Obsidian Bass', stars: 4, icon: '🐡', color: '#ff9f43', desc: 'Ikan langka bertulang keras yang berenang di dekat mata air magma hangat.', starlight: 20 },
  { id: 'koi', name: 'Frostscale Koi', stars: 4, icon: '🐟', color: '#70d6ff', desc: 'Koi bersisik kristal es dari perairan beku Frostvale. Sangat diminati koki kerajaan.', starlight: 20 },
  { id: 'sunfin', name: 'Golden Sunfin', stars: 5, icon: '✨', color: '#ffd700', desc: 'Ikan legendaris pembawa berkah selestial. Sisiknya memancarkan cahaya keemasan abadi.', starlight: 50 },
];

export const FISHING_SPOTS = [
  { id: 'starfall', name: 'Danau Bintang (Whispering Woods)', x: 55, y: 1.2, z: -105, species: ['perch', 'sunfin'] },
  { id: 'lagoon', name: 'Dermaga Karang (Sunken Lagoon)', x: 420, y: 0.6, z: 45, species: ['trout', 'sunfin'] },
  { id: 'magma', name: 'Teluk Obsidian (Pulau Vulkanik)', x: 30, y: 1, z: -350, species: ['bass', 'sunfin'] },
  { id: 'frost', name: 'Teluk Gletser (Frostvale)', x: -372, y: 1, z: -70, species: ['koi', 'sunfin'] },
];

export class FishingManager {
  constructor(game) {
    this.g = game;
    this.active = false;
    this.currentSpot = null;
    this.state = 'idle'; // idle, waiting, bite, reeling, caught
    this.timer = 0;
    this.progress = 0;
    this.tension = 50;
    this.targetMin = 35;
    this.targetMax = 65;
    this.targetDir = 1;
    this.targetSpeed = 22;
    this.isReeling = false;
    this.targetFish = null;

    this.group = new THREE.Group();
    this.group.name = 'FishingSpots';
    this.g.scene.add(this.group);

    this._buildSpots();
    this._createDOM();
  }

  _buildSpots() {
    const W = this.g.world;
    const pierGeo = new THREE.BoxGeometry(2.4, 0.25, 4.2);
    const postGeo = new THREE.CylinderGeometry(0.12, 0.12, 2.0, 6);
    const pierMat = new THREE.MeshToonMaterial({ color: 0x6d4c30 });
    const postMat = new THREE.MeshToonMaterial({ color: 0x4a321e });

    this.fishShadows = [];

    for (const s of FISHING_SPOTS) {
      // snap each pier to a real shoreline near its region, facing the water
      const shore = W.findShore(s.x, s.z);
      const g = new THREE.Group();
      if (shore) { g.position.set(shore.pos.x, Math.max(shore.pos.y, 0.5) + 0.3, shore.pos.z); g.rotation.y = shore.yaw; } else g.position.set(s.x, s.y, s.z);

      // Wooden pier
      const pier = new THREE.Mesh(pierGeo, pierMat); pier.position.y = 0.1;
      const p1 = new THREE.Mesh(postGeo, postMat); p1.position.set(-1.0, -0.8, -1.8);
      const p2 = new THREE.Mesh(postGeo, postMat); p2.position.set(1.0, -0.8, -1.8);
      const p3 = new THREE.Mesh(postGeo, postMat); p3.position.set(-1.0, -0.8, 1.8);
      const p4 = new THREE.Mesh(postGeo, postMat); p4.position.set(1.0, -0.8, 1.8);
      g.add(pier, p1, p2, p3, p4);

      // Tackle box & bucket
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.4), new THREE.MeshToonMaterial({ color: 0x3867d6 }));
      box.position.set(0.7, 0.4, 0.8);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.04, 2.8, 4), new THREE.MeshToonMaterial({ color: 0xeb3b5a }));
      rod.rotation.x = Math.PI / 4;
      rod.position.set(0.7, 1.2, 1.4);
      g.add(box, rod);
      upgrade('fishing_pier', g, [pier, p1, p2, p3, p4, box, rod], () => {}, { outline: 0.02 });

      // Swimming fish shadows in water
      const shadowsGroup = new THREE.Group();
      shadowsGroup.position.set(0, -0.2, 3.8);
      const shadowGeo = new THREE.ConeGeometry(0.18, 0.65, 5);
      shadowGeo.rotateZ(Math.PI / 2);
      const shadowMat = new THREE.MeshBasicMaterial({ color: 0x1b2838, transparent: true, opacity: 0.6 });

      const fishes = [];
      for (let f = 0; f < 3; f++) {
        const fishMesh = new THREE.Mesh(shadowGeo, shadowMat);
        const ang = (f * Math.PI * 2) / 3;
        fishMesh.position.set(Math.cos(ang) * 1.8, 0, Math.sin(ang) * 1.8);
        shadowsGroup.add(fishMesh);
        fishes.push({ mesh: fishMesh, ang, radius: 1.5 + f * 0.4, spd: 0.8 + f * 0.25 });
      }
      g.add(shadowsGroup);
      this.fishShadows.push({ group: shadowsGroup, fishes });

      this.group.add(g);

      // Register interactable
      W.interactables.push({
        pos: g.position.clone().add(new THREE.Vector3(0, 0.2, 0)),
        radius: 3.5,
        label: `Mulai Memancing (${s.name.split(' (')[0]})`,
        kind: 'fishing_spot',
        spotId: s.id,
        enabled: () => true,
      });
    }
  }

  _createDOM() {
    let wrap = document.getElementById('fishing-overlay');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'fishing-overlay';
      wrap.className = 'fishing-overlay hidden';
      wrap.innerHTML = `
        <div id="fish-alert" class="fish-alert hidden">!</div>
        <div id="fish-hud" class="fish-hud hidden">
          <div class="fish-header">
            <span id="fish-target-name">Sedang Menarik Ikan…</span>
            <span id="fish-timer">5.0s</span>
          </div>
          <div class="fish-track-container">
            <div id="fish-target-zone" class="fish-target-zone"></div>
            <div id="fish-indicator" class="fish-indicator"></div>
          </div>
          <div class="fish-progress-wrap">
            <div id="fish-progress-fill" class="fish-progress-fill"></div>
          </div>
          <div class="fish-controls-tip">Tahan SPASI / Klik untuk menaikkan tegangan tali</div>
          <button id="fish-reel-btn" class="fish-reel-btn">TARIK TALI</button>
        </div>
        <div id="fish-result-card" class="fish-result-card hidden">
          <div id="frc-icon" class="frc-icon">🐟</div>
          <div id="frc-name" class="frc-name">Starfall Perch</div>
          <div id="frc-stars" class="frc-stars">⭐⭐⭐</div>
          <div id="frc-desc" class="frc-desc">Deskripsi ikan yang berhasil ditangkap.</div>
          <div id="frc-reward" class="frc-reward">+1 Ikan · +50 EXP · +10 ✦ Starlight</div>
          <button id="frc-btn-ok" class="frc-btn-ok">Simpan Tangkapan</button>
        </div>
      `;
      document.body.appendChild(wrap);
    }
    this.dom = wrap;
    this._bindEvents();
  }

  _bindEvents() {
    const $ = (id) => document.getElementById(id);

    const startReel = (e) => {
      e?.preventDefault();
      this.isReeling = true;
    };
    const endReel = (e) => {
      e?.preventDefault();
      this.isReeling = false;
    };

    const btn = $('fish-reel-btn');
    btn?.addEventListener('mousedown', startReel);
    btn?.addEventListener('touchstart', startReel, { passive: false });
    window.addEventListener('mouseup', endReel);
    window.addEventListener('touchend', endReel);

    window.addEventListener('keydown', (e) => {
      if (this.active && this.state === 'reeling' && e.code === 'Space') {
        this.isReeling = true;
      }
    });
    window.addEventListener('keyup', (e) => {
      if (this.active && e.code === 'Space') {
        this.isReeling = false;
      }
    });

    $('frc-btn-ok')?.addEventListener('click', () => {
      $('fish-result-card').classList.add('hidden');
      this.endFishing();
    });
  }

  startFishing(spotId) {
    const spot = FISHING_SPOTS.find((s) => s.id === spotId);
    if (!spot) return;

    this.active = true;
    this.currentSpot = spot;
    this.state = 'waiting';
    this.timer = 1.8 + Math.random() * 2.2;
    this.g.inputLocked = true;
    document.exitPointerLock?.();

    this.dom.classList.remove('hidden');
    document.getElementById('fish-alert').classList.add('hidden');
    document.getElementById('fish-hud').classList.add('hidden');
    document.getElementById('fish-result-card').classList.add('hidden');

    sfx.swing();
    this.g.ui.toast(`🎣 Memulai memancing di ${spot.name}...`);
  }

  endFishing() {
    this._clearBite?.();
    this.active = false;
    this.state = 'idle';
    this.g.inputLocked = false;
    this.dom.classList.add('hidden');
    document.getElementById('fish-hud').classList.add('hidden');
    document.getElementById('fish-alert').classList.add('hidden');
    document.getElementById('fish-result-card').classList.add('hidden');
  }

  _onFishBite() {
    this.state = 'bite';
    this.timer = 1.4; // player has 1.4s window to react and start reeling!
    sfx.land();

    const alert = document.getElementById('fish-alert');
    alert.classList.remove('hidden');

    // Pick candidate fish from spot
    const pool = this.currentSpot.species;
    const isRare = Math.random() < 0.22;
    const pickId = isRare && pool.includes('sunfin') ? 'sunfin' : pool[0];
    this.targetFish = FISH_SPECIES.find((f) => f.id === pickId) || FISH_SPECIES[0];

    // Auto-advance to reeling on click/tap/space
    this._clearBite?.();
    const triggerReel = () => { this._clearBite?.(); if (this.state === 'bite') this._startReeling(); };
    this._clearBite = () => {
      for (const ev of ['keydown', 'pointerdown']) window.removeEventListener(ev, triggerReel);
      this._clearBite = null;
    };
    for (const ev of ['keydown', 'pointerdown']) window.addEventListener(ev, triggerReel);
  }

  _startReeling() {
    this.state = 'reeling';
    this.timer = 6.0;
    this.progress = 25;
    this.tension = 50;
    this.targetMin = 35;
    this.targetMax = 65;

    document.getElementById('fish-alert').classList.add('hidden');
    document.getElementById('fish-hud').classList.remove('hidden');
    document.getElementById('fish-target-name').textContent = `Menarik: ${this.targetFish.name}`;
    sfx.swing();
  }

  _onFishCaught() {
    this.state = 'caught';
    sfx.wishPurple();

    const fish = this.targetFish;
    // Award rewards
    const S = this.g.state;
    S.inv.fish = (S.inv.fish || 0) + fish.stars;
    S.starlight = (S.starlight || 0) + fish.starlight;
    this.g.player.addExp(fish.stars * 40);
    this.g.ui.updateStarlightHUD();

    const $ = (id) => document.getElementById(id);
    $('fish-hud').classList.add('hidden');
    $('fish-result-card').classList.remove('hidden');

    $('frc-icon').textContent = fish.icon;
    $('frc-name').textContent = fish.name;
    $('frc-name').style.color = fish.color;
    $('frc-stars').textContent = '⭐'.repeat(fish.stars);
    $('frc-desc').textContent = fish.desc;
    $('frc-reward').textContent = `+${fish.stars} 🐟 Ikan Segar · +${fish.stars * 40} EXP · +${fish.starlight} ✦ Starlight Crystals`;

    this.g.vfx.particles(this.g.player.pos.clone().add(new THREE.Vector3(0, 1.2, 0)), 30, 0x54a0ff, { speed: 5, up: 4, life: 0.6 });
    this.g.save();
  }

  _onFishEscaped() {
    this.state = 'escaped';
    sfx.hurt();
    this.g.ui.toast('Ikan terlepas! Tarikan tali tidak stabil.', '');
    this.endFishing();
  }

  update(dt) {
    // 1. Animate swimming fish shadows in the water
    for (const spot of this.fishShadows) {
      for (const f of spot.fishes) {
        f.ang += f.spd * dt;
        f.mesh.position.set(Math.cos(f.ang) * f.radius, 0, Math.sin(f.ang) * f.radius);
        f.mesh.rotation.y = -f.ang + Math.PI / 2;
      }
    }

    if (!this.active) return;

    if (this.state === 'waiting') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this._onFishBite();
      }
    } else if (this.state === 'bite') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this._onFishEscaped();
      }
    } else if (this.state === 'reeling') {
      this.timer -= dt;
      document.getElementById('fish-timer').textContent = `${Math.max(0, this.timer).toFixed(1)}s`;

      if (this.timer <= 0) {
        this._onFishEscaped();
        return;
      }

      // Update tension
      if (this.isReeling) {
        this.tension = Math.min(100, this.tension + dt * 45);
      } else {
        this.tension = Math.max(0, this.tension - dt * 38);
      }

      // Move target sweet-spot back and forth
      this.targetMin += this.targetDir * this.targetSpeed * dt;
      if (this.targetMin > 65) {
        this.targetMin = 65;
        this.targetDir = -1;
      } else if (this.targetMin < 15) {
        this.targetMin = 15;
        this.targetDir = 1;
      }
      this.targetMax = this.targetMin + 26;

      // Check if tension is inside sweet spot
      const inZone = this.tension >= this.targetMin && this.tension <= this.targetMax;
      if (inZone) {
        this.progress += dt * 26;
      } else {
        this.progress = Math.max(0, this.progress - dt * 14);
      }

      // Update DOM bars
      const indicator = document.getElementById('fish-indicator');
      const targetZone = document.getElementById('fish-target-zone');
      const progFill = document.getElementById('fish-progress-fill');

      if (indicator) indicator.style.left = `${this.tension}%`;
      if (targetZone) {
        targetZone.style.left = `${this.targetMin}%`;
        targetZone.style.width = `${this.targetMax - this.targetMin}%`;
        targetZone.className = 'fish-target-zone ' + (inZone ? 'active' : '');
      }
      if (progFill) progFill.style.width = `${Math.min(100, this.progress)}%`;

      if (this.progress >= 100) {
        this._onFishCaught();
      }
    }
  }
}
