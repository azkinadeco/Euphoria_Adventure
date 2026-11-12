// Euphoria Adventure — Mata Aether & Treasure Radar System
// Mata Aether:
// - Desaturates the world into a moody twilight monochrome palette
// - Expands a glowing sonar resonance pulse from the player
// - Highlights interactive chests, crates, gathering nodes, and Kupu Kristal species
// - Reveals enemy elemental auras and trails to nearest undiscovered treasure
import * as THREE from 'three';
import { sfx } from './sfx.js';

export class ElementalSight {
  constructor(game) {
    this.g = game;
    this.active = false;
    this.duration = 8.0;
    this.t = 0;
    this.cd = 0;
    this.sonarRadius = 0;

    this.group = new THREE.Group();
    this.group.name = 'ElementalSight';
    this.g.scene.add(this.group);
    this.group.visible = false;

    this._initMarkers();
    this._initSonar();
  }

  _initSonar() {
    // Sonar ring on the ground
    const ringGeo = new THREE.RingGeometry(0.8, 1.4, 48);
    ringGeo.rotateX(-Math.PI / 2);
    this.sonarMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0x38f8ff).multiplyScalar(3.0),
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.sonarMat.userData.hdr = true;
    this.sonarMesh = new THREE.Mesh(ringGeo, this.sonarMat);
    this.group.add(this.sonarMesh);
  }

  _initMarkers() {
    // Pool of reusable glowing marker pillars & rings
    this.markerPool = [];
    const pillarGeo = new THREE.CylinderGeometry(0.2, 0.4, 6.0, 8, 1, true);
    pillarGeo.translate(0, 3.0, 0);
    const baseGeo = new THREE.RingGeometry(0.5, 1.8, 24);
    baseGeo.rotateX(-Math.PI / 2);

    for (let i = 0; i < 20; i++) {
      const g = new THREE.Group();

      const pMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      pMat.userData.hdr = true;

      const bMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      bMat.userData.hdr = true;

      const pillar = new THREE.Mesh(pillarGeo, pMat);
      const ring = new THREE.Mesh(baseGeo, bMat);
      g.add(pillar, ring);
      g.visible = false;

      this.group.add(g);
      this.markerPool.push({ group: g, pillar, ring, pMat, bMat });
    }
  }

  toggle() {
    if (this.active) {
      this.deactivate();
    } else {
      this.activate();
    }
  }

  activate() {
    if (this.cd > 0) {
      this.g.ui?.toast(`Mata Aether siap dalam ${this.cd.toFixed(1)}s`, '');
      return;
    }
    this.active = true;
    this.t = this.duration;
    this.sonarRadius = 0;
    this.group.visible = true;

    sfx.sightOn();

    // Stylized Anime Twilight Desaturation
    this.g.graphics.mood({
      sat: 0.12,
      tint: new THREE.Color(0.62, 0.72, 0.98),
      bloom: 1.15,
    });

    this.g.ui?.toast('👁️ Mata Aether Aktif!', 'gold');
    this._updateButton(true);
  }

  deactivate() {
    if (!this.active) return;
    this.active = false;
    this.cd = 2.5;
    this.group.visible = false;

    sfx.sightOff();

    // Restore vibrant anime color grading
    this.g.graphics.mood({
      sat: 1.15,
      tint: new THREE.Color(1.0, 1.0, 1.0),
      bloom: 0.60,
    });

    for (const m of this.markerPool) {
      m.group.visible = false;
    }
    this._updateButton(false);
  }

  _updateButton(on) {
    const btn = document.getElementById('btn-sight');
    if (!btn) return;
    if (on) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  }

  update(dt, playerPos) {
    if (this.cd > 0) {
      this.cd -= dt;
      const btn = document.getElementById('btn-sight');
      if (btn && this.cd > 0) {
        btn.setAttribute('data-cd', Math.ceil(this.cd));
      } else if (btn) {
        btn.removeAttribute('data-cd');
      }
    }

    if (!this.active) return;

    this.t -= dt;
    if (this.t <= 0) {
      this.deactivate();
      return;
    }

    // Sonar scanning wave expansion
    this.sonarRadius += dt * 32.0;
    if (this.sonarRadius > 50.0) this.sonarRadius = 0;
    const waveProgress = this.sonarRadius / 50.0;
    this.sonarMesh.position.set(playerPos.x, playerPos.y + 0.15, playerPos.z);
    this.sonarMesh.scale.setScalar(this.sonarRadius);
    this.sonarMat.opacity = Math.max(0, (1.0 - waveProgress) * 0.7);

    // Collect candidate targets within 50m
    const targets = [];

    // 1. World Interactables (Chests, Crates, Berries, etc.)
    const W = this.g.world;
    if (W && W.interactables) {
      for (const it of W.interactables) {
        if (!it.pos || (it.enabled && !it.enabled())) continue;
        const d = playerPos.distanceTo(it.pos);
        if (d > 48) continue;
        let col = 0xffbe30; // Gold for chests/relics
        if (it.kind === 'berry') col = 0x32ff7e; // Emerald for berries
        else if (it.kind === 'fish' || it.id?.includes('crate')) col = 0xff9f43; // Amber for crates
        else if (it.kind === 'part' || it.kind === 'altar') col = 0x54a0ff; // Cyan for ancient tech
        targets.push({ pos: it.pos, color: col, d });
      }
    }

    // 2. Kupu Kristal
    if (this.g.wildlife && this.g.wildlife.flies) {
      for (const fl of this.g.wildlife.flies) {
        if (!fl.mesh.visible) continue;
        const d = playerPos.distanceTo(fl.mesh.position);
        if (d > 48) continue;
        targets.push({ pos: fl.mesh.position, color: fl.color, d });
      }
    }

    // 3. Enemies with active elemental aura
    if (this.g.enemies) {
      for (const e of this.g.enemies) {
        if (e.dead || e.dormant || !e.root.visible) continue;
        const d = playerPos.distanceTo(e.pos);
        if (d > 45) continue;
        const aura = e.aura ? e.aura.el : (e.shield ? e.shield.el : null);
        const colMap = {
          WATER: 0x4fb4f0,
          FIRE: 0xff4d4d,
          ICE: 0x70d6ff,
          LIGHTNING: 0xbf55ec,
          WIND: 0x2ed573,
          LIGHT: 0xffd32a,
        };
        const col = aura ? (colMap[aura] || 0xffffff) : 0xff3838;
        targets.push({ pos: e.pos, color: col, d });
      }
    }

    // Sort by nearest
    targets.sort((a, b) => a.d - b.d);

    // Apply to marker pool
    for (let i = 0; i < this.markerPool.length; i++) {
      const m = this.markerPool[i];
      const tgt = targets[i];
      if (!tgt) {
        m.group.visible = false;
        continue;
      }
      m.group.visible = true;
      m.group.position.copy(tgt.pos);
      m.pMat.color.setHex(tgt.color).multiplyScalar(2.5);
      m.bMat.color.setHex(tgt.color).multiplyScalar(2.5);

      // Rotate and pulse
      const t = this.t * 3.0 + i;
      m.pillar.rotation.y = t * 0.8;
      m.ring.rotation.z = -t * 1.2;
      const s = 1.0 + Math.sin(t * 2.0) * 0.12;
      m.ring.scale.set(s, s, s);
    }
  }
}
