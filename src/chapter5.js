// Chapter 5 — CELESTIAL ASGARD: The Golden Sky City above the clouds (Grand Finale of Arc 1).
// Features:
// - Plaza of the Sun, Floating Prism Isles, Aether Sanctum, and the Throne of Stars
// - Dynamic Iridescent Rainbow Bifrost Bridge connecting the city to the Sanctum
// - Three Celestial Prisms (Surya, Bintang, Fajar) guarded by Celestial Archons
// - Climax Boss: Eclipse Sovereign · Sovereign of Oblivion (3-phase epic battle)
// - The emotional reunion with the Commander!
import { weatherProps } from './nature.js';
import * as THREE from 'three';
import { Enemy } from './enemies.js';
import { toon, part, applyRim, animeMetal, animeSkin } from './toon.js';
import { boostGlow } from './graphics.js';
import { makeCampfire } from './reef.js';
import { upgrade, portalFrame } from './assets.js';
import { SCRIPTS } from './story.js';
import { sfx, setMusicMood } from './sfx.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export const ASGARD = {
  plaza: { x: 0, y: 260, z: -800, r: 28 },
  sanctum: { x: 0, y: 285, z: -940, r: 32 },
  prisms: [
    { x: -75, y: 265, z: -810, r: 12, name: 'Prisma Surya', color: 0xffaa33 },
    { x: 75, y: 265, z: -810, r: 12, name: 'Prisma Bintang', color: 0x66ccff },
    { x: 0, y: 264, z: -720, r: 12, name: 'Prisma Fajar', color: 0xff66bb },
  ],
};

function segDist(x, z, a, b) {
  const abx = b.x - a.x, abz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((x - a.x) * abx + (z - a.z) * abz) / (abx * abx + abz * abz)));
  return [Math.hypot(x - (a.x + abx * t), z - (a.z + abz * t)), t];
}

export class Chapter5 {
  constructor(game) {
    this.g = game;
    this.active = false;
    this.built = false;
    this.islands = [ASGARD.plaza, ASGARD.sanctum, ...ASGARD.prisms];
    this.bifrost = {
      a: V(0, 260, -828),
      b: V(0, 285, -908),
      w: 3.4,
      on: false,
    };
    this.prismWalkways = [
      { a: V(-28, 260, -805), b: V(-63, 265, -810), w: 2.0 },
      { a: V(28, 260, -805), b: V(63, 265, -810), w: 2.0 },
      { a: V(0, 260, -772), b: V(0, 264, -732), w: 2.0 },
    ];
    this.prismWaves = [[], [], []];
    this.cores = [];
    this.savePos = V(1, 0, 3); // saves made in the sky city resume at Sunbeam Rock
    this._spawnEntities();
  }

  /** walkable ground inside the Asgard sky realm */
  groundAt(x, z) {
    let h = -300;
    for (const i of this.islands) {
      if ((x - i.x) ** 2 + (z - i.z) ** 2 < i.r * i.r) {
        h = Math.max(h, i.y);
      }
    }
    // prism walkways
    for (const pw of this.prismWalkways) {
      const [d, t] = segDist(x, z, pw.a, pw.b);
      if (d < pw.w) {
        h = Math.max(h, pw.a.y + (pw.b.y - pw.a.y) * t + 0.05);
      }
    }
    // Bifrost bridge
    if (this.bifrost.on) {
      const [d, t] = segDist(x, z, this.bifrost.a, this.bifrost.b);
      if (d < this.bifrost.w) {
        h = Math.max(h, this.bifrost.a.y + (this.bifrost.b.y - this.bifrost.a.y) * t + 0.05);
      }
    }
    return h;
  }

  _spawnEntities() {
    // Entities initialized when built
  }

  _build() {
    if (this.built) return;
    this.built = true;
    const G = this.g, S = G.scene, W = G.world;
    const grp = this.group = new THREE.Group();

    // 1. Celestial Asgard Sky Dome (golden aurora & solar nebula)
    const asgardSky = new THREE.Mesh(
      new THREE.SphereGeometry(860, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, fog: false,
        uniforms: { uTime: W.waterUniforms.uTime },
        vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }`,
        fragmentShader: `
          uniform float uTime;
          varying vec3 vD;
          float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453); }
          float noise(vec3 p){
            vec3 i = floor(p), f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
              mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
              f.z
            );
          }
          void main(){
            vec3 d = vD;
            float t = uTime * 0.02;
            float n = noise(d * 3.0 + t) * 0.55 + noise(d * 7.0 - t * 0.5) * 0.3 + noise(d * 14.0) * 0.15;

            // Celestial Gold -> Royal Azure -> Lapis Zenith
            vec3 zenith = vec3(0.08, 0.22, 0.65);
            vec3 midSky = vec3(0.32, 0.62, 0.95);
            vec3 goldHorizon = vec3(1.0, 0.82, 0.45);

            vec3 col = mix(goldHorizon, midSky, pow(max(d.y, 0.0), 0.45));
            col = mix(col, zenith, pow(max(d.y, 0.0), 1.8));

            // Solar Celestial Aurora Ribbons
            float aur = smoothstep(0.48, 0.85, n) * smoothstep(0.0, 0.6, d.y);
            col += vec3(1.0, 0.88, 0.35) * aur * 0.7;
            col += vec3(0.4, 0.85, 1.0) * smoothstep(0.65, 0.95, noise(d * 4.0 - t)) * 0.4;

            // Celestial Stars
            float star = step(0.996, hash(floor(d * 350.0)));
            col += vec3(1.0) * star * 2.0;

            gl_FragColor = vec4(col, 1.0);
          }
        `,
      })
    );
    asgardSky.renderOrder = -1;
    grp.add(asgardSky);
    this.asgardSky = asgardSky;

    // 2. Billowing Golden Sea of Clouds beneath the islands (Y = 220)
    const cloudSeaGeo = new THREE.PlaneGeometry(1600, 1600, 1, 1);
    cloudSeaGeo.rotateX(-Math.PI / 2);
    const cloudSeaMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false,
      uniforms: { uTime: W.waterUniforms.uTime },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n(vec2 p){
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(h(i), h(i + vec2(1,0)), f.x), mix(h(i + vec2(0,1)), h(i + vec2(1,1)), f.x), f.y);
        }
        void main(){
          vec2 p = vUv * 24.0 + vec2(uTime * 0.02, uTime * 0.015);
          float c = n(p) * 0.5 + n(p * 2.2) * 0.3 + n(p * 5.0) * 0.2;
          vec3 cloudCol = mix(vec3(0.92, 0.88, 0.78), vec3(1.0, 0.98, 0.92), c);
          gl_FragColor = vec4(cloudCol * 1.25, 0.92);
        }
      `,
    });
    const cloudSea = new THREE.Mesh(cloudSeaGeo, cloudSeaMat);
    cloudSea.position.y = 220;
    grp.add(cloudSea);

    // 3. Floating Golden Marble Islands
    const goldMarble = toon(0xcdc3ae);
    const goldTrim = animeMetal(0xffd700);
    const darkUnder = toon(0x3a3442, { flatShading: true });

    for (const isl of this.islands) {
      const top = part(new THREE.CylinderGeometry(isl.r, isl.r * 0.94, 1.8, Math.max(12, Math.round(isl.r * 1.8))), goldMarble, { ol: 0.04 });
      top.position.set(isl.x, isl.y - 0.9, isl.z);
      top.receiveShadow = true;
      grp.add(top);

      const under = part(new THREE.ConeGeometry(isl.r * 0.94, isl.r * 1.5, Math.max(8, Math.round(isl.r * 1.2)), 3), darkUnder, { ol: 0.04 });
      under.rotation.x = Math.PI;
      under.position.set(isl.x, isl.y - 1.8 - isl.r * 0.75, isl.z);
      grp.add(under);
      upgrade('asgard_island', grp, [top, under], (m) => { m.position.set(isl.x, isl.y, isl.z); m.scale.setScalar(isl.r); m.rotation.y = isl.z; }, { outline: 0.04 });

      // Golden perimeter ring
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(isl.r - 0.2, 0.12, 6, 48),
        goldTrim
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(isl.x, isl.y + 0.04, isl.z);
      grp.add(ring);
    }

    // 4. Columns & Greco-Norse Architecture around Plaza
    const Pl = ASGARD.plaza;
    const colMat = toon(0xd9d0be);
    const colCap = animeMetal(0xffd866);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const cx = Pl.x + Math.cos(a) * (Pl.r - 2.5);
      const cz = Pl.z + Math.sin(a) * (Pl.r - 2.5);
      const colG = new THREE.Group();
      colG.position.set(cx, Pl.y, cz);

      const shaft = part(new THREE.CylinderGeometry(0.55, 0.65, 7.5, 8), colMat, { ol: 0.03 });
      shaft.position.y = 3.75;
      colG.add(shaft);

      const cap = part(new THREE.BoxGeometry(1.6, 0.45, 1.6), colCap, { ol: 0.03 });
      cap.position.y = 7.6;
      colG.add(cap);

      const base = part(new THREE.BoxGeometry(1.8, 0.45, 1.8), colCap, { ol: 0.03 });
      base.position.y = 0.22;
      colG.add(base);

      grp.add(colG);
      W.addCollider(cx, cz, 0.85);
      upgrade('asgard_column', colG, [...colG.children], (m) => { m.scale.setScalar(0.8); m.rotation.y = a; }, { outline: 0.025 });
    }

    // 5. Connecting Walkways to the 3 Prism Isles
    for (const pw of this.prismWalkways) {
      const len = pw.a.distanceTo(pw.b);
      const mid = pw.a.clone().lerp(pw.b, 0.5);
      const walk = part(new THREE.BoxGeometry(pw.w * 2, 0.4, len), goldMarble, { ol: 0.03 });
      walk.position.copy(mid);
      walk.lookAt(pw.b);
      grp.add(walk);

      const trimL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, len, 6), goldTrim);
      trimL.position.set(pw.w, 0.25, 0); trimL.rotation.x = Math.PI / 2; walk.add(trimL);
      const trimR = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, len, 6), goldTrim);
      trimR.position.set(-pw.w, 0.25, 0); trimR.rotation.x = Math.PI / 2; walk.add(trimR);
    }

    // 6. The Three Celestial Prisms
    this.prismMeshes = [];
    ASGARD.prisms.forEach((p, idx) => {
      const pG = new THREE.Group();
      pG.position.set(p.x, p.y, p.z);

      // Pedestal
      const ped = part(new THREE.CylinderGeometry(1.6, 2.2, 2.4, 6), colMat, { ol: 0.03 });
      ped.position.y = 1.2;
      pG.add(ped);
      upgrade('prism_pedestal', pG, ped, () => {}, { outline: 0.03 });

      // Giant Floating Prism Crystal
      const crystalMat = toon(p.color, { emissive: p.color, emissiveIntensity: 1.5, transparent: true, opacity: 0.9 });
      const crystal = part(new THREE.OctahedronGeometry(1.4, 0), crystalMat, { ol: 0.03 });
      crystal.position.y = 3.6;
      crystal.scale.set(0.9, 1.8, 0.9);
      pG.add(crystal);

      // Light Beam to the sky
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.5, 300, 12, 1, true),
        new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
      );
      beam.position.y = 150;
      beam.visible = false;
      pG.add(beam);

      grp.add(pG);
      this.prismMeshes.push({ group: pG, crystal, beam, mat: crystalMat });

      // Interactable for activating prism
      W.interactables.push({
        pos: new THREE.Vector3(p.x, p.y + 1, p.z),
        radius: 3.5,
        kind: 'asgard_prism',
        idx,
        label: `Panggil Penjaga ${p.name}`,
        enabled: () => this.active && !G.state.prisms[idx] && !this.prismWaves[idx].some((e) => !e.dead),
      });
    });

    // 7. The Iridescent Rainbow BIFROST Bridge
    const bifrostLen = this.bifrost.a.distanceTo(this.bifrost.b);
    const bifrostMid = this.bifrost.a.clone().lerp(this.bifrost.b, 0.5);
    const bifrostMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { uTime: W.waterUniforms.uTime },
      vertexShader: `
        varying vec2 vUv;
        void main(){
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;
        void main(){
          float t = vUv.x;
          // 7-Color Rainbow Bands
          vec3 r = vec3(1.0, 0.15, 0.25);
          vec3 o = vec3(1.0, 0.55, 0.10);
          vec3 y = vec3(1.0, 0.95, 0.20);
          vec3 g = vec3(0.20, 0.92, 0.45);
          vec3 b = vec3(0.15, 0.65, 1.00);
          vec3 v = vec3(0.75, 0.35, 0.95);

          vec3 col = mix(r, o, smoothstep(0.0, 0.2, t));
          col = mix(col, y, smoothstep(0.2, 0.4, t));
          col = mix(col, g, smoothstep(0.4, 0.6, t));
          col = mix(col, b, smoothstep(0.6, 0.8, t));
          col = mix(col, v, smoothstep(0.8, 1.0, t));

          // Flowing stardust sparkle along bridge length
          float sparkle = sin(vUv.y * 50.0 - uTime * 6.0) * 0.35 + 0.65;
          col *= sparkle;

          // Soft edge fade
          float edge = smoothstep(0.0, 0.1, t) * (1.0 - smoothstep(0.9, 1.0, t));
          gl_FragColor = vec4(col * 2.2, edge * 0.85);
        }
      `,
    });
    const bifrostMesh = new THREE.Mesh(new THREE.PlaneGeometry(this.bifrost.w * 2, bifrostLen), bifrostMat);
    bifrostMesh.position.copy(bifrostMid);
    bifrostMesh.rotation.x = -Math.PI / 2;
    bifrostMesh.lookAt(this.bifrost.b);
    bifrostMesh.visible = false;
    grp.add(bifrostMesh);
    this.bifrostMesh = bifrostMesh;

    // 8. Aether Sanctum & Throne of Stars
    const Sc = ASGARD.sanctum;
    // Temple Ring Columns
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const cx = Sc.x + Math.cos(a) * (Sc.r - 3);
      const cz = Sc.z + Math.sin(a) * (Sc.r - 3);
      const col = part(new THREE.CylinderGeometry(0.7, 0.85, 10, 8), colMat, { ol: 0.03 });
      col.position.set(cx, Sc.y + 5, cz);
      grp.add(col);
      W.addCollider(cx, cz, 1.0);
      upgrade('asgard_column', grp, col, (m) => { m.position.set(cx, Sc.y, cz); m.rotation.y = a; }, { outline: 0.03 });
    }

    // Throne Dais
    const dais = part(new THREE.CylinderGeometry(8, 10, 1.6, 8), colCap, { ol: 0.04 });
    dais.position.set(Sc.x, Sc.y + 0.8, Sc.z);
    grp.add(dais);
    upgrade('asgard_dais', grp, dais, (m) => m.position.set(Sc.x, Sc.y, Sc.z), { outline: 0.04 });

    // Stasis Crystal holding the Commander
    const stasisG = new THREE.Group();
    stasisG.position.set(Sc.x, Sc.y + 3.8, Sc.z);
    const crystalMesh = part(
      new THREE.OctahedronGeometry(2.2, 0),
      toon(0x66ddff, { emissive: 0x33aaff, emissiveIntensity: 2.0, transparent: true, opacity: 0.75 }),
      { ol: 0.03 }
    );
    crystalMesh.scale.set(0.85, 2.2, 0.85);
    stasisG.add(crystalMesh);
    this.stasisCrystal = crystalMesh;

    // Silhouette of the Commander inside
    const comFig = part(new THREE.CylinderGeometry(0.3, 0.4, 1.8, 8), toon(0xfff6dd), { ol: 0 });
    comFig.position.y = 0;
    stasisG.add(comFig);
    this.commanderFig = comFig;

    grp.add(stasisG);
    this.stasisGroup = stasisG;

    // 9. Campfire / Rest spot on Plaza
    this.campfire = makeCampfire(W, new THREE.Vector3(Pl.x, Pl.y, Pl.z + 8));
    this.campfire.group.visible = false;

    // Portal back to Void Rift / Whispering Woods
    const retPortal = new THREE.Mesh(
      new THREE.TorusGeometry(2.5, 0.25, 8, 36),
      new THREE.MeshBasicMaterial({ color: 0xffd700 })
    );
    retPortal.position.set(Pl.x, Pl.y + 2.8, Pl.z + 20);
    grp.add(retPortal);
    portalFrame(grp, retPortal.position, 2.5);

    W.interactables.push({
      pos: new THREE.Vector3(Pl.x, Pl.y + 1, Pl.z + 20),
      radius: 3.5,
      kind: 'asgard_exit',
      label: 'Turun ke Whispering Woods',
      enabled: () => this.active,
    });

    W.interactables.push({
      pos: new THREE.Vector3(Pl.x, Pl.y + 1, Pl.z + 8),
      radius: 3.5,
      kind: 'asgard_rest',
      label: 'Istirahat di Altar Asgard (pulihkan HP & simpan)',
      enabled: () => this.active,
    });

    boostGlow(grp);
    grp.visible = false;
    weatherProps(grp, 0.3);
    S.add(grp);

    // Rotate crystals
    W.animated.push({
      update: (dt, t) => {
        if (!this.active) return;
        this.prismMeshes.forEach((pm, i) => {
          pm.crystal.rotation.y = t * 1.2 + i;
          pm.crystal.position.y = 3.6 + Math.sin(t * 2 + i) * 0.25;
        });
        if (this.stasisCrystal) {
          this.stasisCrystal.rotation.y = t * 0.8;
          this.stasisCrystal.position.y = Math.sin(t * 1.5) * 0.2;
        }
      },
    });

    // 10. Boss Spawn
    this.boss = new Enemy(G, 'sovereign', V(Sc.x, Sc.y, Sc.z - 6), { leash: Sc.r + 8 });
    this.boss.realmMob = true;
    this.boss.root.visible = false;
    G.enemies.push(this.boss);
  }

  enter(teleport = true) {
    const G = this.g, S = G.state, P = G.player;
    const firstBuild = !this.built;
    this._build();
    if (firstBuild) (S.prisms || []).forEach((on, i) => on && this._lightPrism(i));
    this.active = true;
    G.world.realm = this;
    this.group.visible = true;
    this.campfire.group.visible = true;
    G.graphics.mood({ bloom: 0.34 });

    // Hide main world ground/water
    G.world.terrain.visible = false;
    G.world.water.visible = false;
    if (G.world.grassMesh) G.world.grassMesh.visible = false;
    if (G.world.nearGrass) G.world.nearGrass.setDensity(0);

    const Pl = ASGARD.plaza;
    if (teleport) {
      P.placeAt(V(Pl.x, Pl.y + 0.5, Pl.z + 14), 0);
      sfx.portal();
      G.ui.toast('Tiba di Celestial Asgard — Kota Langit', 'gold big');
    }

    if (S.step === 'asgard_go') {
      G.ui.dialog(SCRIPTS.asgardIntro).then(() => {
        G._advance('asgard_bifrost');
      });
    }

    if (S.prisms && S.prisms.every(Boolean)) {
      this._openBifrost(true);
    }
  }

  exit() {
    const G = this.g, P = G.player;
    if (!this.active) return;
    this.active = false;
    G.world.realm = null;
    this.group.visible = false;
    this.campfire.group.visible = false;
    G.graphics.mood({ bloom: 0.42 });

    G.world.terrain.visible = true;
    G.world.water.visible = true;
    G.world.setDetail(G.gfx);
    if (G.world.grassMesh) G.world.grassMesh.visible = true;
    G.world.nearGrass.setDensity(G.graphics?.P?.grass ?? 1);

    P.placeAt(V(0, 0, 0), 0.6);
  }

  async interact(it) {
    const G = this.g, S = G.state, P = G.player;
    if (it.kind === 'asgard_exit') {
      this.exit();
      G.ui.toast('Kembali ke Whispering Woods');
      return true;
    }
    if (it.kind === 'asgard_rest') {
      P.healAll(1, true);
      S.spawn = 'asgard';
      G.ui.toast('Istirahat di Altar Asgard. HP seluruh party pulih! (Tersimpan)', 'gold');
      G.save();
      return true;
    }
    if (it.kind === 'asgard_prism') {
      const idx = it.idx;
      const p = ASGARD.prisms[idx];
      this.prismWaves[idx] = [];
      G.ui.toast(`Penjaga ${p.name} bangkit!`, 'gold');

      // Spawn Archon and guardians
      const guardTypes = idx === 0 ? ['archon', 'prismguard'] : idx === 1 ? ['archon', 'prismguard', 'prismguard'] : ['archon', 'archon'];
      guardTypes.forEach((type, k) => {
        const ang = (k / guardTypes.length) * Math.PI * 2;
        const e = new Enemy(G, type, V(p.x + Math.cos(ang) * 4, p.y, p.z + Math.sin(ang) * 4), {
          leash: p.r + 8,
          elite: type === 'archon' ? (idx === 0 ? 'FIRE' : idx === 1 ? 'ICE' : 'LIGHTNING') : undefined,
        });
        e.aggro = true;
        e.prismIdx = idx;
        e.realmMob = true;
        G.enemies.push(e);
        this.prismWaves[idx].push(e);
        G.vfx.pillar(e.pos, p.color, 8, 0.7);
      });
      return true;
    }
    return false;
  }

  onKilled(e) {
    const G = this.g, S = G.state;
    if (e.prismIdx !== undefined) {
      const wave = this.prismWaves[e.prismIdx];
      if (wave && wave.every((x) => x.dead)) {
        if (!S.prisms) S.prisms = [false, false, false];
        S.prisms[e.prismIdx] = true;
        this._lightPrism(e.prismIdx);
        sfx.quest();
        G.ui.toast(`${ASGARD.prisms[e.prismIdx].name} AKTIF (${S.prisms.filter(Boolean).length}/3)`, 'gold');

        if (S.prisms.every(Boolean)) {
          G.ui.dialog(SCRIPTS.asgardMid).then(() => {
            this._openBifrost();
            G._advance('asgard_boss');
          });
        }
        G.save();
      }
    }
    if (e.type === 'sovereign') {
      this._victory();
    }
  }

  _lightPrism(idx) {
    if (!this.built) return;
    const pm = this.prismMeshes[idx];
    pm.beam.visible = true;
    pm.mat.emissiveIntensity = 3.5;
  }

  _openBifrost(silent = false) {
    this.bifrost.on = true;
    if (this.bifrostMesh) this.bifrostMesh.visible = true;
    if (!silent) this.g.ui.toast('Jembatan Pelangi BIFROST telah terbentang!', 'gold big');
  }

  async _victory() {
    const G = this.g, S = G.state;
    setMusicMood('normal');
    for (const e of G.enemies) if (e.isAdd && !e.dead) e.die();
    S.asgardDone = true;
    S.inv.fish += 99;
    S.inv.berry += 99;
    G.ui.toast('MENANG BESAR! ECLIPSE SOVEREIGN DIKALAHKAN!', 'gold big');

    // Shatter stasis crystal
    if (this.stasisCrystal) {
      G.vfx.particles(this.stasisCrystal.position, 60, 0x66ddff, { speed: 6, up: 4, life: 1.5 });
      this.stasisCrystal.visible = false;
    }

    await new Promise((r) => setTimeout(r, 2000));
    await G.ui.dialog(SCRIPTS.asgardVictory);
    const P = G.player;
    P.addMember('commander');
    S.party = P.roster.map((x) => x.id);
    G.ui.buildParty();
    S.starlight = (S.starlight || 0) + 1600;
    G.ui.toast('Commander Aethel BERGABUNG! +1600 ✦ Starlight Crystals!', 'gold big');
    await new Promise((r) => setTimeout(r, 2500));
    await G.ui.dialog(SCRIPTS.ashTeaser);
    G._advance('ash_go');
  }

  questTarget(step) {
    if (!this.active) return null;
    const S = this.g.state;
    if (step === 'asgard_bifrost') {
      const idx = (S.prisms || []).findIndex((x) => !x);
      return idx >= 0 ? ASGARD.prisms[idx] : ASGARD.plaza;
    }
    if (step === 'asgard_boss') {
      return ASGARD.sanctum;
    }
    return null;
  }

  mood(dt) {
    if (!this.active) return;
    const W = this.g.world;
    W.scene.fog.color.set(0xfff2d0);
    W.scene.fog.near = 70;
    W.scene.fog.far = 320;
    // white marble under full daylight would blow out through the bloom pass
    W.sun.intensity *= 0.6; W.hemi.intensity *= 0.6;
    this.asgardSky.position.copy(this.g.camera.position);
  }

  update(dt) {
    if (!this.active) return;
    const G = this.g, S = G.state, P = G.player;
    if (this.boss && !this.boss.dead) {
      this.boss.root.visible = this.active;
      // Start boss fight when approaching Sanctum
      if (!this.boss.started && P.pos.distanceTo(ASGARD.sanctum) < 26 && S.step === 'asgard_boss') {
        this.boss.started = true;
        setMusicMood('boss');
        G.ui.dialog(SCRIPTS.asgardBossIntro);
      }
    }

    // Fell into the cloud sea
    if (P.pos.y < 235 && !P.dead) {
      const Pl = ASGARD.plaza;
      P.placeAt(V(Pl.x, Pl.y + 0.5, Pl.z + 10));
      P.iframes = 1;
      P.hp = Math.max(1, P.hp - P.maxHp * 0.12);
      G.ui.toast('Jatuh menembus awan! (-12% HP)');
    }
  }

  onRespawn() {
    const B = this.boss, G = this.g;
    if (B && B.started && !B.dead) {
      B.started = false; B.hp = B.maxHp; B.pos.copy(B.home); B.state = 'idle'; B.invuln = false; B.breakT = 0; B.cancelTele();
      B.phase2Triggered = B.phase3Triggered = false;
      for (const e of G.enemies) if (e.type === 'eclipsecore') { e.dead = true; e.deadT = 1; }
      setMusicMood('normal');
    }
  }

  onLoad() {
    const S = this.g.state;
    if (S.spawn === 'asgard') S.spawn = 'workshop';
    if (S.asgardDone && S.step.startsWith('asgard')) S.step = 'ash_go'; // saved during the victory scene
    if (S.prisms && S.prisms.every(Boolean)) {
      this._openBifrost(true);
    }
  }
}
