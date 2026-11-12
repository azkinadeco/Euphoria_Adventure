// Interactive Wildlife & Exploration System:
// Glowing Kupu Kristal (Kunang-kunang Kristal) with fluttering translucent wings,
// soft floating orbits, and exploration rewards (Starlight Crystals & Crystal Cores)!

import * as THREE from 'three';
import { boostGlow } from './graphics.js';
import { sfx } from './sfx.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export const FLUTTER_SPOTS = [
  // Whispering Woods
  { x: 12, z: 8, element: 'WIND', name: 'Kupu Kristal Angin', color: 0x8fe63a },
  { x: -18, z: 24, element: 'WIND', name: 'Kupu Kristal Angin', color: 0x8fe63a },
  { x: 5, z: -35, element: 'WIND', name: 'Kupu Kristal Angin', color: 0x8fe63a },
  // Sunken Reef
  { x: 400, z: 30, element: 'WATER', name: 'Kupu Kristal Air', color: 0x4fb4f0 },
  { x: 470, z: -20, element: 'WATER', name: 'Kupu Kristal Air', color: 0x4fb4f0 },
  // Volcanic island
  { x: -70, z: -400, element: 'FIRE', name: 'Kupu Kristal Api', color: 0xff7a2a },
  { x: 30, z: -420, element: 'FIRE', name: 'Kupu Kristal Api', color: 0xff7a2a },
  // Frostvale
  { x: -420, z: 40, element: 'ICE', name: 'Kupu Kristal Es', color: 0x9ee8ff },
  { x: -500, z: -40, element: 'ICE', name: 'Kupu Kristal Es', color: 0x9ee8ff },
  // Asgard
  { x: 14, z: -795, y: 262, element: 'LIGHT', name: 'Kupu Kristal Surya', color: 0xffd700 },
  { x: -14, z: -795, y: 262, element: 'LIGHT', name: 'Kupu Kristal Surya', color: 0xffd700 },
  { x: 0, z: -775, y: 262, element: 'LIGHT', name: 'Kupu Kristal Surya', color: 0xffea70 },
];

export class WildlifeManager {
  constructor(game) {
    this.g = game;
    this.flies = [];
    this._spawnFlutters();
  }

  _spawnFlutters() {
    const G = this.g, S = G.scene, W = G.world;

    FLUTTER_SPOTS.forEach((spot, idx) => {
      const g = new THREE.Group();
      const col = new THREE.Color(spot.color);

      // Glowing crystal core
      const coreMat = new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(1.5) });
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), coreMat);
      core.scale.set(0.7, 1.3, 0.7);
      g.add(core);

      // 4 Fluttering wings
      const wingMat = new THREE.MeshBasicMaterial({
        color: spot.color,
        transparent: true,
        opacity: 0.72,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

      const wingGeo = new THREE.PlaneGeometry(0.35, 0.55);
      wingGeo.translate(0.16, 0.22, 0);

      const wings = [];
      for (const sx of [-1, 1]) {
        for (const sy of [1, -0.6]) {
          const w = new THREE.Mesh(wingGeo, wingMat);
          w.scale.set(sx * 0.9, sy * 0.9, 1);
          w.rotation.x = 0.2;
          g.add(w);
          wings.push(w);
        }
      }

      // Soft light glow halo
      const halo = new THREE.Mesh(
        new THREE.RingGeometry(0.28, 0.38, 20),
        new THREE.MeshBasicMaterial({ color: spot.color, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false })
      );
      halo.rotation.x = Math.PI / 2;
      g.add(halo);

      const land = spot.y === undefined ? W.findLand(spot.x, spot.z) : null;
      const basePos = land ? V(land.x, land.y + 1.8, land.z) : V(spot.x, (spot.y ?? 0) + 1.8, spot.z);
      g.position.copy(basePos);

      boostGlow(g);
      S.add(g);

      const flyData = {
        mesh: g,
        wings,
        basePos,
        spot,
        respawnT: 0,
        active: true,
      };

      this.flies.push(flyData);

      // Interactable for catching
      W.interactables.push({
        pos: basePos,
        radius: 2.8,
        kind: 'flutter',
        flyIdx: idx,
        label: `Tangkap ${spot.name}`,
        enabled: () => flyData.active && (!spot.y || G.ch5.active),
      });
    });

    W.animated.push({
      update: (dt, t) => {
        this.update(dt, t);
      },
    });
  }

  update(dt, t) {
    const P = this.g.player;
    this.flies.forEach((f, i) => {
      if (!f.active) {
        f.respawnT -= dt;
        if (f.respawnT <= 0) {
          f.active = true;
          f.mesh.visible = true;
          this.g.vfx.particles(f.basePos, 10, f.spot.color, { speed: 2, up: 1, life: 0.5 });
        }
        return;
      }

      // sky-city flies only exist while you are up there
      f.mesh.visible = !f.spot.y || !!this.g.ch5?.active;
      // Gentle floating flutter
      const ofsY = Math.sin(t * 2.5 + i) * 0.35;
      const ofsX = Math.cos(t * 1.2 + i * 1.4) * 0.6;
      const ofsZ = Math.sin(t * 1.4 + i * 1.1) * 0.6;
      f.mesh.position.set(f.basePos.x + ofsX, f.basePos.y + ofsY, f.basePos.z + ofsZ);
      f.mesh.rotation.y = t * 1.2 + i;

      // Wing flapping
      const flap = Math.sin(t * 18 + i) * 0.55;
      f.wings.forEach((w, wi) => {
        w.rotation.y = (wi % 2 === 0 ? 1 : -1) * flap;
      });

      // Scatter slightly if player dashes through
      if (P.pos.distanceTo(f.mesh.position) < 1.6 && P.speedNow > 5) {
        f.basePos.y += 0.8 * dt;
      }
    });
  }

  async interact(it) {
    if (it.kind === 'flutter') {
      const f = this.flies[it.flyIdx];
      if (!f || !f.active) return false;

      f.active = false;
      f.mesh.visible = false;
      f.respawnT = 120; // 2 minutes respawn

      const S = this.g.state;
      S.starlight = (S.starlight || 0) + 20;
      S.crystalCores = (S.crystalCores || 0) + 1;

      this.g.vfx.particles(f.mesh.position, 25, f.spot.color, { speed: 4, up: 2, life: 0.7 });
      sfx.pickup();
      this.g.ui.toast(`Berhasil menangkap ${f.spot.name}! +20 ✦ Starlight & 1 Inti Kristal`, 'gold');
      return true;
    }
    return false;
  }
}
