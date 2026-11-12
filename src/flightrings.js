// Euphoria Adventure — wind rings. Gliding through one launches the hero forward and refills stamina.
import * as THREE from 'three';
import { cullFar } from './cull.js';
import { sfx } from './sfx.js';

const RING_COOLDOWN = 2.4;

export const RING_ROUTES = [
  // Route 1: Whispering Woods canopy towards Starfall Lake
  { x: 35, y: 22, z: -40, dir: [0.35, 0.05, -0.93] },
  { x: 48, y: 20, z: -78, dir: [0.38, -0.05, -0.92] },
  { x: 62, y: 17, z: -115, dir: [0.25, -0.1, -0.96] },

  // Route 2: Aurora Shrine summit down to the frozen lake
  { x: -530, y: 54, z: -18, dir: [0.31, -0.2, 0.93] },
  { x: -518, y: 42, z: 20, dir: [0.31, -0.22, 0.92] },
  { x: -506, y: 30, z: 56, dir: [0.31, -0.25, 0.91] },

  // Route 3: Sea Cliff down across the Sunken Lagoon
  { x: 360, y: 28, z: 25, dir: [0.88, -0.12, 0.45] },
  { x: 405, y: 22, z: 48, dir: [0.85, -0.10, 0.52] },
  { x: 450, y: 16, z: 75, dir: [0.82, -0.08, 0.56] },

  // Route 4: Asgard plaza out to the prism isles
  { x: -42, y: 272, z: -808, dir: [-1, 0.02, 0] },
  { x: 42, y: 272, z: -808, dir: [1, 0.02, 0] },
  { x: 0, y: 272, z: -758, dir: [0, 0.02, 1] },
];

export class FlightRings {
  constructor(game) {
    this.g = game;
    this.rings = [];
    this.group = new THREE.Group();
    this.group.name = 'FlightRings';
    this.g.scene.add(this.group);

    this._buildRings();
  }

  _buildRings() {
    const ringGeo = new THREE.TorusGeometry(2.6, 0.16, 12, 36);
    const innerGeo = new THREE.TorusGeometry(2.1, 0.07, 8, 28);

    // Glowing wind material
    const outerMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0x38ffd0).multiplyScalar(2.2),
      transparent: true,
      opacity: 0.85,
    });
    outerMat.userData.hdr = true;

    const innerMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0xfff68f).multiplyScalar(2.5),
      transparent: true,
      opacity: 0.65,
    });
    innerMat.userData.hdr = true;

    for (let i = 0; i < RING_ROUTES.length; i++) {
      const cfg = RING_ROUTES[i];
      const root = new THREE.Group();
      root.position.set(cfg.x, cfg.y, cfg.z);

      const dir = new THREE.Vector3(...cfg.dir).normalize();
      // Orient ring to face along dir
      root.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);

      const outer = new THREE.Mesh(ringGeo, outerMat);
      const inner = new THREE.Mesh(innerGeo, innerMat);
      root.add(outer, inner);

      // 4 Chevron directional markers around the ring pointing forward
      const chevMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(0x50ffc8).multiplyScalar(3.0),
        transparent: true,
        opacity: 0.9,
      });
      chevMat.userData.hdr = true;
      const chevGeo = new THREE.ConeGeometry(0.24, 0.7, 5);
      chevGeo.rotateX(Math.PI / 2);

      for (let c = 0; c < 4; c++) {
        const ang = (c * Math.PI) / 2;
        const ch = new THREE.Mesh(chevGeo, chevMat);
        ch.position.set(Math.cos(ang) * 2.6, Math.sin(ang) * 2.6, 0.2);
        root.add(ch);
      }

      this.group.add(root);
      cullFar(root, 160); // 5 draw calls per ring; only near rings matter
      this.rings.push({
        root,
        outer,
        inner,
        pos: new THREE.Vector3(cfg.x, cfg.y, cfg.z),
        dir,
        cd: 0,
        t: Math.random() * 10,
        isAsgard: cfg.z < -600,
      });
    }
  }

  update(dt, player) {
    const pPos = player.pos;
    const isAsgardActive = this.g.ch5 && this.g.ch5.active;

    for (let i = 0; i < this.rings.length; i++) {
      const r = this.rings[i];
      // Hide Asgard rings if Ch5 not active, and vice versa
      if (r.isAsgard && !isAsgardActive) {
        r.root.visible = false;
        continue;
      }
      if (!r.isAsgard && isAsgardActive) {
        r.root.visible = false;
        continue;
      }
      r.root.visible = true;

      // Pulse & spin animations
      r.t += dt;
      r.inner.rotation.z = r.t * 1.8;
      r.outer.rotation.z = -r.t * 0.9;
      const pulse = 1.0 + Math.sin(r.t * 3.5) * 0.05;
      r.outer.scale.setScalar(pulse);

      if (r.cd > 0) {
        r.cd -= dt;
        continue;
      }

      // Check proximity to ring
      const dist = pPos.distanceTo(r.pos);
      if (dist < 3.8) {
        // Boost trigger!
        r.cd = RING_COOLDOWN;
        sfx.windRing();

        // Re-orient player to launch along ring forward direction
        player.facing = Math.atan2(r.dir.x, r.dir.z);
        player.speedNow = 25.0;
        player.vy = Math.max(player.vy, r.dir.y * 18 + 5.0);
        player.gliding = true;
        player.grounded = false;
        player.stamina = Math.min(100, player.stamina + 35);
        if (this.g.combat) this.g.combat.fovKick = 4.5;

        // Visual feedback
        this.g.vfx.shockwave(r.pos, 5.0, 0x48ffc8, 0.45);
        this.g.vfx.particles(r.pos, 25, 0x6effdc, { speed: 8, up: 2, life: 0.6 });

        // Show aerodynamic wind ring ring-flash
        r.outer.scale.setScalar(1.5);
      }
    }
  }
}
