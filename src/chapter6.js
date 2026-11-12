// Arc 2 · Chapter 6 — ASHEN BATTLEFIELD (adapted from Euphoria Online Arc 2 · "Ashen Battlefield").
// A separate realm reached through an eclipse rift near the forest camp: an endless plain of ash where
// thousands of swords stand in the ground like grave markers. Five possessed blades must be purified,
// then the corrupted Kali — Hundred Blade Saint — waits on the Altar of a Hundred Blades.
import * as THREE from 'three';
import { Enemy } from './enemies.js';
import { toon, part } from './toon.js';
import { boostGlow } from './graphics.js';
import { makeCampfire } from './reef.js';
import { upgrade, portalFrame, loadGeometry } from './assets.js';
import { terrainMat, rockGeo, rockMat, softDot } from './nature.js';
import { LOC } from './world.js';
import { SCRIPTS } from './story.js';
import { sfx, setMusicMood } from './sfx.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export const ASH = {
  c: { x: 1250, y: 60, z: 0 }, r: 82,
  camp: { x: 1250, z: 58 },
  arena: { x: 1250, z: -52, r: 23 },
  blades: [{ x: 1206, z: 28 }, { x: 1296, z: 22 }, { x: 1212, z: -18 }, { x: 1290, z: -14 }, { x: 1251, z: 4 }],
  rift: { x: 56, z: -46 }, // eclipse rift in the main world, next to the forest camp
};

/** ground height of the ash plain (−300 = the abyss around it) */
export function ashHeight(x, z) {
  const C = ASH.c, A = ASH.arena;
  const r = Math.hypot(x - C.x, z - C.z);
  if (r > ASH.r) return -300;
  let h = C.y + Math.sin(x * 0.07) * Math.cos(z * 0.06) * 1.2 + Math.sin((x + z) * 0.13) * 0.45 + Math.sin(x * 0.31 + z * 0.17) * 0.15;
  h += smooth(ASH.r - 10, ASH.r, r) * 3.5; // a low ridge along the rim
  const fc = smooth(14, 8, Math.hypot(x - ASH.camp.x, z - ASH.camp.z));
  h += (C.y - h) * fc;
  const fa = smooth(A.r + 7, A.r, Math.hypot(x - A.x, z - A.z));
  h += (C.y + 1.2 - h) * fa;
  return h;
}

export class Chapter6 {
  constructor(game) {
    this.g = game;
    this.active = false;
    this.built = false;
    this.waves = [[], [], [], [], []];
    this.mobs = [];
    this.boss = null;
    this.bladeObjs = [];
    this.savePos = V(ASH.rift.x - 3, 0, ASH.rift.z + 3);
    this._buildRift();
  }

  groundAt(x, z) { return ashHeight(x, z); }

  // ---------------------------------------------------------------- main-world rift
  _buildRift() {
    const G = this.g, W = G.world;
    const h = W.heightAt(ASH.rift.x, ASH.rift.z);
    const grp = this.riftGroup = new THREE.Group();
    grp.position.set(ASH.rift.x, h, ASH.rift.z);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.16, 8, 40), new THREE.MeshBasicMaterial({ color: 0xb070ff }));
    ring.position.y = 2.6; grp.add(ring);
    portalFrame(grp, ring.position, 2.2, { dark: true });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(2.1, 40), new THREE.MeshBasicMaterial({ color: 0x1a0a22, transparent: true, opacity: 0.92, side: THREE.DoubleSide }));
    disc.position.y = 2.6; grp.add(disc);
    const corona = new THREE.Mesh(new THREE.RingGeometry(2.3, 3.1, 40), new THREE.MeshBasicMaterial({ color: 0xff7ad8, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    corona.position.y = 2.6; grp.add(corona);
    for (let i = 0; i < 5; i++) {
      const sh = part(new THREE.OctahedronGeometry(0.3, 0), toon(0x2a1a34, { flatShading: true }), { ol: 0.01 });
      const a = (i / 5) * Math.PI * 2; sh.position.set(Math.cos(a) * 3, 0.5, Math.sin(a) * 3); grp.add(sh);
    }
    grp.visible = false;
    boostGlow(grp);
    G.scene.add(grp);
    W.interactables.push({
      pos: grp.position.clone().setY(h + 1), radius: 3.6, kind: 'ash_rift', label: 'Masuki Retakan Gerhana',
      enabled: () => !!G.state.asgardDone && !this.active,
    });
    W.animated.push({ update: (dt, t) => {
      grp.visible = !!G.state.asgardDone && !W.realm;
      if (!grp.visible) return;
      ring.rotation.z = t * 0.6; corona.rotation.z = -t * 0.4; corona.material.opacity = 0.3 + Math.sin(t * 2) * 0.08;
      disc.lookAt(G.camera.position.x, disc.getWorldPosition(new THREE.Vector3()).y, G.camera.position.z);
      ring.quaternion.copy(disc.quaternion); corona.quaternion.copy(disc.quaternion);
    } });
  }

  // ---------------------------------------------------------------- realm
  _build() {
    if (this.built) return;
    this.built = true;
    const G = this.g, S = G.scene, W = G.world, C = ASH.c;
    const grp = this.group = new THREE.Group();

    // 1. eclipse sky: ash-grey haze, a black sun with a burning corona above the altar
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(860, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uTime: W.waterUniforms.uTime },
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }',
      fragmentShader: `
        uniform float uTime; varying vec3 vD;
        float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453); }
        float n(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(h(i), h(i + vec3(1,0,0)), f.x), mix(h(i + vec3(0,1,0)), h(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(h(i + vec3(0,0,1)), h(i + vec3(1,0,1)), f.x), mix(h(i + vec3(0,1,1)), h(i + vec3(1,1,1)), f.x), f.y), f.z); }
        void main(){
          vec3 d = normalize(vD);
          float up = max(d.y, 0.0);
          vec3 col = mix(vec3(0.42, 0.30, 0.28), vec3(0.16, 0.11, 0.14), pow(up, 0.6));
          float t = uTime * 0.015;
          float c = n(d * 4.0 + vec3(t, 0.0, t * 0.6)) * 0.6 + n(d * 9.0 - t) * 0.4;
          col = mix(col, vec3(0.30, 0.22, 0.22), smoothstep(0.45, 0.8, c) * 0.6);
          vec3 sd = normalize(vec3(0.0, 0.42, -1.0));
          float a = dot(d, sd);
          float corona = smoothstep(0.985, 0.9935, a) * (1.0 - smoothstep(0.9935, 0.9945, a));
          float glow = pow(max(a, 0.0), 60.0);
          col += vec3(1.0, 0.45, 0.75) * corona * 3.0 + vec3(0.9, 0.3, 0.4) * glow * 0.6;
          col = mix(col, vec3(0.0), smoothstep(0.9938, 0.995, a)); // the black sun
          col *= 1.0 - smoothstep(0.0, -0.3, d.y) * 0.5;
          gl_FragColor = vec4(col, 1.0);
        }`,
    }));
    this.sky.renderOrder = -1;
    grp.add(this.sky);

    // 2. ash plain: displaced grid; vertices beyond the rim fall away into a cliff
    const R = ASH.r + 8, N = 150;
    const geo = new THREE.PlaneGeometry(R * 2, R * 2, N, N);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, cols = new Float32Array(pos.count * 3);
    const cA = new THREE.Color(0x6e6460), cB = new THREE.Color(0x4a4040), cE = new THREE.Color(0x7a4a3a), cS = new THREE.Color(0x3a3438), tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + C.x, z = pos.getZ(i) + C.z;
      const r = Math.hypot(x - C.x, z - C.z);
      const y = r > ASH.r ? C.y - 18 - (r - ASH.r) * 2.5 : ashHeight(x, z);
      pos.setY(i, y - C.y);
      const k = 0.5 + 0.5 * Math.sin(x * 0.11 + Math.cos(z * 0.09) * 2.0);
      tmp.copy(cA).lerp(cB, k);
      if (Math.sin(x * 0.23) * Math.cos(z * 0.19) > 0.75) tmp.lerp(cE, 0.45); // scorched patches
      if (Math.hypot(x - ASH.arena.x, z - ASH.arena.z) < ASH.arena.r) tmp.copy(cS);
      if (r > ASH.r - 1) tmp.multiplyScalar(0.7);
      cols[i * 3] = tmp.r; cols[i * 3 + 1] = tmp.g; cols[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    geo.computeVertexNormals();
    const ground = new THREE.Mesh(geo, terrainMat());
    ground.position.set(C.x, C.y, C.z);
    ground.receiveShadow = true;
    grp.add(ground);

    // abyss of ash fog below
    const abyss = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.MeshBasicMaterial({ color: 0x2a1a1e }));
    abyss.rotation.x = -Math.PI / 2; abyss.position.set(C.x, C.y - 45, C.z);
    grp.add(abyss);

    // 3. a forest of swords stuck in the ground (two instanced meshes)
    const nS = 340;
    const bladeG = new THREE.BoxGeometry(0.1, 1.5, 0.03); bladeG.translate(0, 0.75, 0);
    const hiltG = new THREE.BoxGeometry(0.42, 0.07, 0.09); hiltG.translate(0, 1.5, 0);
    const gripG = new THREE.CylinderGeometry(0.035, 0.035, 0.38, 6); gripG.translate(0, 1.72, 0);
    const steelM = new THREE.MeshLambertMaterial({ color: 0xb8b8c4 }), darkM = new THREE.MeshLambertMaterial({ color: 0x2a2228 });
    const iBlade = new THREE.InstancedMesh(bladeG, steelM, nS), iHilt = new THREE.InstancedMesh(hiltG, darkM, nS), iGrip = new THREE.InstancedMesh(gripG, darkM, nS);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p3 = new THREE.Vector3();
    let rs = 7;
    const rnd = () => { rs = (rs * 16807) % 2147483647; return rs / 2147483647; };
    let k = 0;
    while (k < nS) {
      const a = rnd() * Math.PI * 2, r = 6 + Math.sqrt(rnd()) * (ASH.r - 9);
      const x = C.x + Math.cos(a) * r, z = C.z + Math.sin(a) * r;
      if (Math.hypot(x - ASH.camp.x, z - ASH.camp.z) < 11) continue;
      if (Math.hypot(x - ASH.arena.x, z - ASH.arena.z) < ASH.arena.r + 2) continue;
      if (ASH.blades.some((b) => Math.hypot(x - b.x, z - b.z) < 6)) continue;
      const s = 0.8 + rnd() * 0.7;
      e.set((rnd() - 0.5) * 0.7, rnd() * Math.PI, (rnd() - 0.5) * 0.7); q.setFromEuler(e); sc.setScalar(s);
      p3.set(x, ashHeight(x, z) - 0.45 * s, z);
      m4.compose(p3, q, sc);
      iBlade.setMatrixAt(k, m4); iHilt.setMatrixAt(k, m4); iGrip.setMatrixAt(k, m4);
      k++;
    }
    for (const im of [iBlade, iHilt, iGrip]) { im.castShadow = true; im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); grp.add(im); }
    // one Blender sword (vertex-coloured) replaces the three primitive layers
    loadGeometry('rusty_sword').then((g) => {
      if (!g) return;
      iBlade.geometry = g; iBlade.material = new THREE.MeshLambertMaterial({ vertexColors: true }); iBlade.computeBoundingSphere();
      iHilt.visible = false; iGrip.visible = false;
    });

    // 4. boulders and torn war banners
    const rocks = new THREE.InstancedMesh(rockGeo(61), rockMat(), 40);
    for (let i = 0; i < 40; i++) {
      const a = rnd() * Math.PI * 2, r = 12 + rnd() * (ASH.r - 16);
      const x = C.x + Math.cos(a) * r, z = C.z + Math.sin(a) * r;
      if (Math.hypot(x - ASH.camp.x, z - ASH.camp.z) < 12 || Math.hypot(x - ASH.arena.x, z - ASH.arena.z) < ASH.arena.r + 3) { i--; continue; }
      const s = 0.8 + rnd() * 2.2;
      e.set(0, rnd() * 6.28, 0); q.setFromEuler(e); sc.set(s, s * (0.6 + rnd() * 0.5), s);
      m4.compose(p3.set(x, ashHeight(x, z) - 0.2 * s, z), q, sc);
      rocks.setMatrixAt(i, m4); rocks.setColorAt(i, new THREE.Color(0x5a5250).multiplyScalar(0.8 + rnd() * 0.4));
      if (s > 1.6) W.addCollider(x, z, s * 0.8);
    }
    rocks.castShadow = rocks.receiveShadow = true; rocks.computeBoundingSphere();
    grp.add(rocks);
    const poleM = toon(0x3a2a22), clothM = toon(0x6a1a2a, { side: THREE.DoubleSide });
    this.banners = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3, r = 30 + (i % 3) * 14;
      const x = C.x + Math.cos(a) * r, z = C.z + Math.sin(a) * r;
      const b = new THREE.Group(); b.position.set(x, ashHeight(x, z), z); b.rotation.set((rnd() - 0.5) * 0.25, rnd() * 6.28, (rnd() - 0.5) * 0.25);
      const pole = part(new THREE.CylinderGeometry(0.07, 0.09, 6, 6), poleM, { ol: 0.01 }); pole.position.y = 3; b.add(pole);
      const cloth = part(new THREE.PlaneGeometry(1.6, 2.4, 4, 4), clothM, { ol: 0 }); cloth.position.set(0.85, 4.4, 0); b.add(cloth);
      grp.add(b); this.banners.push(cloth);
    }

    // 5. arena: Altar of a Hundred Blades — a ring of giant swords around a dark dais
    const A = ASH.arena;
    const dais = part(new THREE.CylinderGeometry(7, 8.5, 1.2, 10), toon(0x2a2228, { flatShading: true }), { ol: 0.03 });
    dais.position.set(A.x, C.y + 0.65, A.z); grp.add(dais);
    upgrade('blade_dais', grp, dais, (m) => m.position.set(A.x, C.y + 0.05, A.z), { outline: 0.03 });
    const glyph = new THREE.Mesh(new THREE.RingGeometry(5.2, 5.6, 48), new THREE.MeshBasicMaterial({ color: 0xa040ff, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
    glyph.rotation.x = -Math.PI / 2; glyph.position.set(A.x, C.y + 1.28, A.z); grp.add(glyph); this.glyph = glyph;
    const bigSteel = toon(0x8a8a98), bigDark = toon(0x1e1a22);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const x = A.x + Math.cos(a) * (A.r + 1.5), z = A.z + Math.sin(a) * (A.r + 1.5);
      const sw = new THREE.Group(); sw.position.set(x, ashHeight(x, z) - 1, z); sw.rotation.set(Math.cos(a) * 0.12, -a, Math.sin(a) * 0.12);
      const bl = part(new THREE.BoxGeometry(0.6, 8, 0.16), bigSteel, { ol: 0.02 }); bl.position.y = 4; sw.add(bl);
      const gd = part(new THREE.BoxGeometry(2.4, 0.4, 0.5), bigDark, { ol: 0.02 }); gd.position.y = 8; sw.add(gd);
      const gp = part(new THREE.CylinderGeometry(0.2, 0.2, 2, 8), bigDark, { ol: 0.02 }); gp.position.y = 9.1; sw.add(gp);
      grp.add(sw);
      W.addCollider(x, z, 0.7);
      upgrade('giant_sword', sw, [...sw.children], () => {}, { outline: 0.02 });
    }

    // 6. the five possessed blades (quest objectives)
    const cursedSteel = toon(0x4a3a5a, { emissive: 0x3a0a5a, emissiveIntensity: 1.1 }), pureSteel = toon(0xeef2ff, { emissive: 0xffe0a0, emissiveIntensity: 0.6 });
    ASH.blades.forEach((b, idx) => {
      const y = ashHeight(b.x, b.z);
      const g = new THREE.Group(); g.position.set(b.x, y, b.z);
      const sw = new THREE.Group(); sw.rotation.z = 0.12; g.add(sw);
      const bl = part(new THREE.BoxGeometry(0.34, 3.4, 0.08), cursedSteel, { ol: 0.015 }); bl.position.y = 1.2; sw.add(bl);
      const gd = part(new THREE.BoxGeometry(1.3, 0.18, 0.24), bigDark, { ol: 0.012 }); gd.position.y = 2.95; sw.add(gd);
      const gp = part(new THREE.CylinderGeometry(0.09, 0.09, 0.9, 8), bigDark, { ol: 0.012 }); gp.position.y = 3.5; sw.add(gp);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 60, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xa040ff, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending }));
      beam.position.y = 30; g.add(beam);
      grp.add(g);
      W.addCollider(b.x, b.z, 0.5);
      this.bladeObjs.push({ g, bl, beam, cursedSteel, pureSteel });
      W.interactables.push({
        pos: V(b.x, y + 1, b.z), radius: 3.2, kind: 'ash_blade', idx, label: 'Cabut Pedang Kali yang kerasukan',
        enabled: () => this.active && G.state.step === 'ash_blades' && !G.state.ashBlades[idx] && !this.waves[idx].some((x) => !x.dead),
      });
    });

    // 7. camp: campfire + rest, and the rift back home
    const cp = V(ASH.camp.x, C.y, ASH.camp.z);
    this.campfire = makeCampfire(W, cp.clone().add(V(0, 0, -3)));
    this.campfire.group.visible = false;
    W.interactables.push({ pos: cp.clone().add(V(0, 1, -3)), radius: 3.4, kind: 'ash_rest', label: 'Istirahat di api unggun (pulihkan HP & simpan)', enabled: () => this.active });
    const ret = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.16, 8, 40), new THREE.MeshBasicMaterial({ color: 0xffd66b }));
    ret.position.set(cp.x, C.y + 2.6, cp.z + 9); grp.add(ret);
    portalFrame(grp, ret.position, 2.2, { dark: true });
    W.interactables.push({ pos: V(cp.x, C.y + 1, cp.z + 9), radius: 3.4, kind: 'ash_exit', label: 'Kembali ke Whispering Woods', enabled: () => this.active });

    // 8. falling ash
    const NA = 1400, ap = new Float32Array(NA * 3);
    for (let i = 0; i < NA; i++) { ap[i * 3] = C.x + (Math.random() - 0.5) * 120; ap[i * 3 + 1] = C.y + Math.random() * 40; ap[i * 3 + 2] = C.z + (Math.random() - 0.5) * 120; }
    const ag = new THREE.BufferGeometry(); ag.setAttribute('position', new THREE.BufferAttribute(ap, 3));
    this.ash = new THREE.Points(ag, new THREE.PointsMaterial({ color: 0xcfc4c0, size: 0.16, map: softDot(), transparent: true, opacity: 0.75, depthWrite: false }));
    this.ash.frustumCulled = false;
    grp.add(this.ash);

    boostGlow(grp);
    grp.visible = false;
    S.add(grp);
    this.syncVisuals();

    // 9. the corrupted Kali
    if (!G.state.ashDone) {
      this.boss = new Enemy(G, 'kali', V(A.x, C.y + 1.2, A.z), { leash: A.r + 10 });
      this.boss.realmMob = true; this.boss.root.visible = false; this.boss.facing = 0;
      G.enemies.push(this.boss);
    }
  }

  syncVisuals() {
    const S = this.g.state;
    this.bladeObjs.forEach((o, i) => {
      const done = !!S.ashBlades?.[i];
      o.bl.material = done ? o.pureSteel : o.cursedSteel;
      o.beam.material.color.set(done ? 0xffe8a0 : 0xa040ff);
      o.beam.material.opacity = done ? 0.4 : 0.3;
    });
  }

  _refillMobs() {
    const G = this.g, C = ASH.c;
    this.mobs = this.mobs.filter((e) => !e.dead);
    const spots = [[1225, 40, 'ashblade'], [1275, 38, 'ashwraith'], [1200, 0, 'ashblade'], [1300, 2, 'ashblade'], [1230, -25, 'ashwraith'], [1272, -28, 'ashblade'], [1250, 25, 'ashwraith']];
    for (const [x, z, type] of spots) {
      if (this.mobs.some((e) => e.spot === x + ',' + z)) continue;
      const e = new Enemy(G, type, V(x, ashHeight(x, z), z), { leash: 30 });
      e.realmMob = true; e.spot = x + ',' + z;
      G.enemies.push(e); this.mobs.push(e);
    }
    void C;
  }

  /** Kali's sheath phase: cursed blades rise around the arena */
  spawnCursed(c, n) {
    const G = this.g;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      const x = c.x + Math.cos(a) * 14, z = c.z + Math.sin(a) * 14;
      const e = new Enemy(G, 'cursedblade', V(x, ashHeight(x, z), z), { leash: 999 });
      e.realmMob = true; e.isAdd = true;
      G.enemies.push(e);
      G.vfx.pillar(e.pos, 0xa040ff, 8, 0.8);
    }
  }

  enter(teleport = true) {
    const G = this.g, S = G.state, P = G.player, W = G.world;
    this._build();
    this.active = true;
    W.realm = this;
    this.group.visible = true; this.campfire.group.visible = true;
    W.terrain.visible = false; W.water.visible = false; if (W.sky) W.sky.visible = false;
    if (W.grassMesh) W.grassMesh.visible = false;
    W.nearGrass?.setDensity(0);
    G.graphics.mood({ tint: new THREE.Color(1.06, 0.95, 0.92), bloom: 0.4 });
    this.savedDay = W.dayT;
    this._refillMobs();
    if (teleport) {
      P.placeAt(V(ASH.camp.x, 0, ASH.camp.z - 6), Math.PI);
      G.cam.target.copy(P.pos);
      sfx.portal?.();
    }
    G.ui.bigText('ASHEN BATTLEFIELD', '#e8dcae');
    if (!S.ashCamp) {
      S.ashCamp = true;
      G.ui.dialog(SCRIPTS.ashIntro).then(() => { if (S.step === 'ash_go') G._advance('ash_blades'); });
    } else if (S.step === 'ash_go') G._advance('ash_blades');
  }

  exit() {
    const G = this.g, P = G.player, W = G.world;
    if (!this.active) return;
    this.active = false;
    W.realm = null;
    this.group.visible = false; this.campfire.group.visible = false;
    W.terrain.visible = true; W.water.visible = true; if (W.sky) W.sky.visible = true;
    W.setDetail(G.gfx);
    if (W.grassMesh) W.grassMesh.visible = true;
    W.nearGrass?.setDensity(G.graphics?.P?.grass ?? 1);
    W.dayT = this.savedDay ?? W.dayT;
    G.graphics.mood({ tint: new THREE.Color(1, 1, 1), bloom: 0.42 });
    P.placeAt(this.savePos.clone());
    G.cam.target.copy(P.pos);
    setMusicMood('normal');
  }

  async interact(it) {
    const G = this.g, S = G.state, P = G.player;
    if (it.kind === 'ash_rift') { G.ui.toggleMenu(false); this.enter(true); return true; }
    if (it.kind === 'ash_exit') { this.exit(); G.ui.toast('Kembali ke Whispering Woods'); return true; }
    if (it.kind === 'ash_rest') {
      P.healAll(1, true); S.spawn = 'ash';
      G.ui.toast('Istirahat di api unggun medan abu. HP pulih! (Tersimpan)', 'gold');
      G.save();
      return true;
    }
    if (it.kind === 'ash_blade') {
      const idx = it.idx, b = ASH.blades[idx];
      this.waves[idx] = [];
      G.ui.toast('Pedang itu bergetar… roh-roh prajurit bangkit!', 'gold');
      sfx.roar?.(); G.shake(0.3);
      const list = idx === 4 ? ['ashwraith', 'ashblade', 'ashblade'] : idx >= 2 ? ['ashblade', 'ashblade', 'ashwraith'] : ['ashblade', 'ashwraith'];
      list.forEach((type, k) => {
        const a = (k / list.length) * Math.PI * 2;
        const x = b.x + Math.cos(a) * 5, z = b.z + Math.sin(a) * 5;
        const e = new Enemy(G, type, V(x, ashHeight(x, z), z), { leash: 30, elite: idx === 4 && k === 0 ? 'DARK' : undefined });
        e.aggro = true; e.realmMob = true; e.ashIdx = idx;
        G.enemies.push(e); this.waves[idx].push(e);
        G.vfx.pillar(e.pos, 0xa040ff, 6, 0.7);
      });
      return true;
    }
    return false;
  }

  onKilled(e) {
    const G = this.g, S = G.state;
    if (e.ashIdx !== undefined) {
      const idx = e.ashIdx;
      if (this.waves[idx].every((x) => x.dead) && !S.ashBlades[idx]) {
        S.ashBlades[idx] = true;
        this.syncVisuals();
        const b = ASH.blades[idx];
        G.vfx.pillar(V(b.x, ashHeight(b.x, b.z), b.z), 0xffe8a0, 10, 1);
        sfx.quest();
        const n = S.ashBlades.filter(Boolean).length;
        G.ui.toast(`Pedang Kali disucikan (${n}/5)`, 'gold');
        S.inv.berry += 2;
        if (n === 2) G.ui.dialog(SCRIPTS.ashMid);
        if (n === 5) G.ui.dialog(SCRIPTS.ashAllBlades).then(() => G._advance('ash_boss'));
        G.save();
      }
    }
    if (e.type === 'kali') this._victory();
  }

  async _victory() {
    const G = this.g, S = G.state, P = G.player;
    setMusicMood('normal');
    for (const e of G.enemies) if (e.isAdd && !e.dead) e.die();
    S.ashDone = true;
    S.inv.fish += 10; S.inv.berry += 10;
    G.ui.toast('MENANG! Kali · Saint Seratus Pedang telah dibebaskan!', 'gold big');
    await new Promise((r) => setTimeout(r, 1800));
    await G.ui.dialog(SCRIPTS.ashVictory);
    const m = P.addMember('kali');
    if (m) { m.level = P.level; m.maxHp = m.calcMaxHp(P.level); m.hp = m.maxHp; }
    G.ui.buildParty();
    S.starlight = (S.starlight || 0) + 800;
    G.ui.toast('Kali BERGABUNG! Atur party di menu ☰ · +800 ✦ Starlight', 'gold big');
    G._advance('free');
  }

  questTarget(step) {
    const S = this.g.state, P = this.g.player;
    if (!['ash_go', 'ash_blades', 'ash_boss'].includes(step)) return null;
    if (!this.active) return V(ASH.rift.x, 0, ASH.rift.z);
    if (step === 'ash_blades') {
      let best = null, bd = Infinity;
      ASH.blades.forEach((b, i) => { if (!S.ashBlades[i]) { const d = Math.hypot(b.x - P.pos.x, b.z - P.pos.z); if (d < bd) { bd = d; best = V(b.x, 0, b.z); } } });
      return best;
    }
    if (step === 'ash_boss') return V(ASH.arena.x, 0, ASH.arena.z);
    return null;
  }

  mood() {
    if (!this.active) return;
    const W = this.g.world;
    W.scene.fog.color.set(0x5a4644); W.scene.fog.near = 45; W.scene.fog.far = 240;
    W.sun.intensity *= 0.55; W.hemi.intensity *= 0.7;
    W.sun.color.lerp(new THREE.Color(0xffb0a0), 0.5);
    this.sky.position.copy(this.g.camera.position);
  }

  update(dt) {
    const G = this.g, S = G.state, P = G.player;
    if (!this.active) return;
    G.world.dayT = 0.5;
    const t = G.world.time || 0;
    // ash drifts down around the camera
    const ap = this.ash.geometry.attributes.position, cam = G.camera.position;
    for (let i = 0; i < ap.count; i++) {
      let y = ap.getY(i) - dt * (0.6 + (i % 7) * 0.12);
      if (y < ASH.c.y - 5) y += 45;
      let x = ap.getX(i) + Math.sin(t * 0.7 + i) * dt * 0.3, z = ap.getZ(i);
      // keep every flake inside a 120 m box around the camera
      if (x - cam.x > 60) x -= 120; else if (x - cam.x < -60) x += 120;
      if (z - cam.z > 60) z -= 120; else if (z - cam.z < -60) z += 120;
      ap.setXYZ(i, x, y, z);
    }
    ap.needsUpdate = true;
    this.banners.forEach((b, i) => { b.rotation.y = Math.sin(t * 2 + i) * 0.25; });
    this.glyph.rotation.z += dt * 0.3;

    const B = this.boss;
    if (B && !B.dead && !B.started && S.step === 'ash_boss' && Math.hypot(P.pos.x - ASH.arena.x, P.pos.z - ASH.arena.z) < ASH.arena.r - 4 && !this._intro) {
      this._intro = true;
      G.ui.dialog(S.ashIntroSeen ? SCRIPTS.ashBossRetry : SCRIPTS.ashBossIntro).then(() => {
        S.ashIntroSeen = true; this._intro = false;
        B.started = true; B.aggro = true; B.state = 'rest'; B.t = 0; B.cd = 1.2;
        setMusicMood('boss'); G.shake(0.5);
      });
    }

    // fell off the plateau
    if (P.pos.y < ASH.c.y - 15 && !P.dead) {
      const back = P.lastLand && P.lastLand.y > ASH.c.y - 5 ? P.lastLand : V(ASH.camp.x, 0, ASH.camp.z - 6);
      P.placeAt(back.clone());
      P.iframes = 1; P.hp = Math.max(1, P.hp - P.maxHp * 0.12);
      G.ui.toast('Jatuh ke jurang abu! (−12% HP)');
    }
  }

  onRespawn() {
    const B = this.boss, G = this.g;
    if (B && B.started && !B.dead) {
      B.started = false; B.hp = B.maxHp; B.pos.copy(B.home); B.state = 'idle'; B.invuln = false; B.breakT = 0; B.cancelTele();
      B.ph1 = B.ph2 = false; B.enraged = false; B.rains = [];
      setMusicMood('normal');
    }
    for (const e of G.enemies) if (e.type === 'cursedblade' && !e.dead) { e.dead = true; e.deadT = 1; }
  }

  onLoad() {
    const S = this.g.state;
    if (!Array.isArray(S.ashBlades) || S.ashBlades.length !== 5) S.ashBlades = [false, false, false, false, false];
    if (S.spawn === 'ash') S.spawn = 'camp';
    if (S.ashDone && S.step.startsWith('ash_')) S.step = 'free'; // saved during the victory scene
    if (S.step === 'ash_blades' && S.ashBlades.every(Boolean)) S.step = 'ash_boss';
    if (this.built) this.syncVisuals();
  }
}
