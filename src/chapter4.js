// Chapter 4 — VOID RIFT: a realm of floating islands in a violet nebula, entered through the Aurora Gate.
// Adapted from Euphoria Online Arc 1 · Chapter 5 (boss: Ygg-Naar, Eye of the Primordial).
import { weatherProps } from './nature.js';
import * as THREE from 'three';
import { upgrade, portalFrame } from './assets.js';
import { Enemy } from './enemies.js';
import { GemoraRig, MiccaRig } from './heroes3d.js';
import { toon, part, applyRim } from './toon.js';
import { boostGlow } from './graphics.js';
import { makeCampfire } from './reef.js';
import { FLOC } from './frost.js';
import { SCRIPTS } from './story.js';
import { sfx, setMusicMood } from './sfx.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const VOIDR = {
  gate: { x: 260, z: -255, r: 13, y: 160 },
  central: { x: 260, z: -372, r: 26, y: 170 },
  anchors: [{ x: 175, z: -305, r: 9, y: 166 }, { x: 352, z: -300, r: 9, y: 168 }, { x: 190, z: -405, r: 10, y: 158 }],
};
const STONES = [
  { x: 238, z: -268, r: 3.2, y: 161 }, { x: 222, z: -278, r: 3, y: 162.5 }, { x: 206, z: -287, r: 3, y: 164 }, { x: 191, z: -296, r: 3.2, y: 165 },
  { x: 182, z: -355, r: 4.5, y: 161 },
];
const PADS = [
  { x: 178, z: -312, to: 'mid', target: V(182, 161, -355) },
  { x: 184, z: -360, to: 'a3', target: V(190, 158, -405) },
];

function segDist(x, z, a, b) {
  const abx = b.x - a.x, abz = b.z - a.z, t = Math.max(0, Math.min(1, ((x - a.x) * abx + (z - a.z) * abz) / (abx * abx + abz * abz)));
  return [Math.hypot(x - (a.x + abx * t), z - (a.z + abz * t)), t];
}

export class Chapter4 {
  constructor(game) {
    this.g = game;
    this.active = false;
    this.built = false;
    this.islands = [VOIDR.gate, VOIDR.central, ...VOIDR.anchors, ...STONES];
    this.bridges = [
      { a: V(271, 160, -258), b: V(345, 168, -296), w: 1.8, on: true },
      { a: V(260, 160, -268), b: V(260, 170, -346), w: 2.2, on: false, final: true },
    ];
    this.beams = [];
    this._spawnEnemies();
    game.world.interactables.push({ pos: FLOC.peak, radius: 5, kind: 'aurora_gate', label: 'Masuki Gerbang Aurora (Void Rift)', enabled: () => game.state.voidOpen && !this.active });
  }

  /** walkable surface inside the realm (everything else is the abyss) */
  groundAt(x, z) {
    let h = -200;
    for (const i of this.islands) if ((x - i.x) ** 2 + (z - i.z) ** 2 < i.r * i.r) h = Math.max(h, i.y);
    for (const b of this.bridges) {
      if (!b.on) continue;
      const [d, t] = segDist(x, z, b.a, b.b);
      if (d < b.w) h = Math.max(h, b.a.y + (b.b.y - b.a.y) * t + 0.05);
    }
    return h;
  }

  _build() {
    const G = this.g, S = G.scene, W = G.world;
    const grp = this.group = new THREE.Group();
    // nebula sky dome
    const nebula = new THREE.Mesh(new THREE.SphereGeometry(820, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uTime: W.waterUniforms.uTime },
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }',
      fragmentShader: `uniform float uTime; varying vec3 vD;
        float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
        float n3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(mix(h(i), h(i+vec3(1,0,0)), f.x), mix(h(i+vec3(0,1,0)), h(i+vec3(1,1,0)), f.x), f.y), mix(mix(h(i+vec3(0,0,1)), h(i+vec3(1,0,1)), f.x), mix(h(i+vec3(0,1,1)), h(i+vec3(1,1,1)), f.x), f.y), f.z); }
        void main(){
          vec3 d = vD; float t = uTime * 0.01;
          float n = n3(d*2.5 + t) * 0.5 + n3(d*5.0 - t) * 0.3 + n3(d*11.0) * 0.2;
          vec3 c = mix(vec3(0.02,0.01,0.06), vec3(0.32,0.08,0.45), smoothstep(0.35, 0.8, n));
          c = mix(c, vec3(0.1,0.25,0.6), smoothstep(0.55, 0.95, n3(d*3.0 + 7.0)) * 0.6);
          c += vec3(0.9,0.5,1.0) * smoothstep(0.75, 1.0, n) * 0.5;
          float st = step(0.997, h(floor(d * 400.0)));
          c += vec3(1.0) * st * 1.5;
          gl_FragColor = vec4(c, 1.0);
        }`,
    }));
    nebula.renderOrder = -1;
    grp.add(nebula); this.nebula = nebula;
    // giant distant void eye in the sky
    const eye = new THREE.Mesh(new THREE.SphereGeometry(40, 24, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x8a3aff).multiplyScalar(1.6), fog: false }));
    eye.position.set(260, 360, -700); grp.add(eye);
    const pupil = new THREE.Mesh(new THREE.CircleGeometry(16, 24), new THREE.MeshBasicMaterial({ color: 0x050008, fog: false })); pupil.position.set(260, 360, -659); grp.add(pupil);

    // islands
    const rock = toon(0x2a2236, { flatShading: true }), topM = toon(0x4a3a6a), crys = toon(0xb07aff, { emissive: 0x5a2aa0, emissiveIntensity: 1.2 });
    for (const i of this.islands) {
      const top = part(new THREE.CylinderGeometry(i.r, i.r * 0.92, 1.4, Math.max(10, Math.round(i.r * 2))), topM, { ol: 0.05 });
      top.position.set(i.x, i.y - 0.7, i.z); top.receiveShadow = true; grp.add(top);
      const under = part(new THREE.ConeGeometry(i.r * 0.92, i.r * 1.6, Math.max(8, Math.round(i.r * 1.5)), 3), rock, { ol: 0.05 });
      under.rotation.x = Math.PI; under.position.set(i.x, i.y - 1.4 - i.r * 0.8, i.z); grp.add(under);
      upgrade('void_island', grp, [top, under], (m) => { m.position.set(i.x, i.y, i.z); m.scale.setScalar(i.r); m.rotation.y = i.x; }, { outline: 0.05 });
      const rim = new THREE.Mesh(new THREE.TorusGeometry(i.r - 0.2, 0.08, 6, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xb07aff).multiplyScalar(2) }));
      rim.rotation.x = Math.PI / 2; rim.position.set(i.x, i.y + 0.03, i.z); grp.add(rim);
      const n = Math.round(i.r / 3);
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI * 2, rr = i.r * (0.55 + Math.random() * 0.35);
        const sz = 0.4 + Math.random() * 0.6;
        const c = part(new THREE.OctahedronGeometry(sz, 0), crys, { ol: 0.02 });
        c.scale.y = 2.2; c.position.set(i.x + Math.cos(a) * rr, i.y + 0.5, i.z + Math.sin(a) * rr); c.rotation.set(Math.random() * 0.4, Math.random() * 3, Math.random() * 0.4); grp.add(c);
        const cx = c.position.x, cz = c.position.z, ry = c.rotation.y;
        upgrade('crystal_violet', grp, c, (m) => { m.position.set(cx, i.y - 0.05, cz); m.rotation.y = ry; m.scale.setScalar(sz * 1.6); }, { outline: 0.02 });
        W.addCollider(c.position.x, c.position.z, 0.5).realm = true;
      }
    }
    // floating debris
    for (let k = 0; k < 40; k++) {
      const dsz = 0.8 + Math.random() * 3;
      const d = part(new THREE.DodecahedronGeometry(dsz, 0), rock, { ol: 0.04 });
      d.position.set(260 + (Math.random() - 0.5) * 300, 130 + Math.random() * 80, -340 + (Math.random() - 0.5) * 300); grp.add(d);
      const dp = d.position.clone(), dr = Math.random() * 6;
      upgrade('void_debris', grp, d, (m) => { m.position.copy(dp); m.scale.setScalar(dsz); m.rotation.set(dr * 0.3, dr, dr * 0.2); }, { outline: 0.04 });
    }
    // light bridges
    this.bridgeMeshes = this.bridges.map((b) => {
      const len = b.a.distanceTo(b.b);
      const m = new THREE.Mesh(new THREE.BoxGeometry(b.w * 2, 0.12, len), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xc8a0ff).multiplyScalar(1.4), transparent: true, opacity: 0.55, depthWrite: false }));
      m.position.copy(b.a).lerp(b.b, 0.5);
      m.lookAt(b.b); m.position.y -= 0.02;
      grp.add(m); m.visible = b.on;
      return m;
    });
    // jump pads
    this.padMeshes = PADS.map((p) => {
      const y = this.groundAt(p.x, p.z);
      const g = new THREE.Group();
      const padBase = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.5, 0.25, 20), toon(0x3a2a5a)); g.add(padBase);
      upgrade('jump_pad', g, padBase, () => {}, { outline: 0.02 });
      const glow = new THREE.Mesh(new THREE.RingGeometry(0.6, 1.2, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x8fffe0).multiplyScalar(2), side: THREE.DoubleSide }));
      glow.rotation.x = -Math.PI / 2; glow.position.y = 0.14; g.add(glow);
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 6, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0x8fffe0, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      col.position.y = 3; g.add(col);
      g.position.set(p.x, y, p.z); grp.add(g);
      return { g, glow };
    });
    // star anchors
    this.anchorMeshes = VOIDR.anchors.map((a) => {
      const g = new THREE.Group();
      const ab = part(new THREE.CylinderGeometry(0.8, 1.2, 0.8, 6), rock, { ol: 0.03 }); g.add(ab);
      const ob = part(new THREE.CylinderGeometry(0.2, 0.5, 3.6, 4), rock, { ol: 0.03 }); ob.position.y = 2.2; g.add(ob);
      upgrade('void_anchor', g, [ab, ob], (m) => { m.rotation.y = a.x; }, { outline: 0.03 });
      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), new THREE.MeshBasicMaterial({ color: 0x3a2a5a })); core.position.y = 4.6; g.add(core);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 200, 10, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffe08a).multiplyScalar(2), transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
      beam.position.y = 104; beam.visible = false; g.add(beam);
      g.position.set(a.x, a.y, a.z); grp.add(g);
      W.addCollider(a.x, a.z, 1.1).realm = true;
      return { g, core, beam };
    });
    // barrier dome over the central island
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(VOIDR.central.r + 2, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xa04aff).multiplyScalar(1.3), transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    this.dome.position.set(VOIDR.central.x, VOIDR.central.y, VOIDR.central.z); grp.add(this.dome);

    // Golden Celestial Gate on central island to Chapter 5 (Celestial Asgard)
    const c = VOIDR.central;
    this.asgardGate = new THREE.Mesh(new THREE.TorusGeometry(3.0, 0.28, 10, 36), new THREE.MeshBasicMaterial({ color: 0xffd700 }));
    this.asgardGate.position.set(c.x, c.y + 3.2, c.z - 16); grp.add(this.asgardGate);
    this.asgardDisc = new THREE.Mesh(new THREE.CircleGeometry(2.8, 32), new THREE.MeshBasicMaterial({ color: 0xffe680, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false }));
    this.asgardDisc.position.copy(this.asgardGate.position); grp.add(this.asgardDisc);
    portalFrame(grp, this.asgardGate.position, 3.0);

    // portal home on the gate island
    const Gt = VOIDR.gate;
    this.portal = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.25, 10, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x7fffc0).multiplyScalar(2) }));
    this.portal.position.set(Gt.x - 7, Gt.y + 2.6, Gt.z); this.portal.rotation.y = Math.PI / 2; grp.add(this.portal);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(2.1, 32), new THREE.MeshBasicMaterial({ color: 0x7fffc0, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    disc.position.copy(this.portal.position); disc.rotation.y = Math.PI / 2; grp.add(disc);
    portalFrame(grp, this.portal.position, 2.2, { yaw: Math.PI / 2 });
    boostGlow(grp);
    grp.visible = false;
    weatherProps(grp, 0.6);
    S.add(grp);
    this.campfire = makeCampfire(W, new THREE.Vector3(Gt.x + 4, Gt.y, Gt.z + 4));
    this.campfire.group.visible = false;
    for (const c of W.colliders) if (c.realm) c.disabled = true;

    // NPCs (until they join)
    this.gemNpc = new GemoraRig(); this.gemNpc.root.position.set(Gt.x + 2, Gt.y, Gt.z - 4); this.gemNpc.root.rotation.y = 0.6; grp.add(this.gemNpc.root);
    this.micNpc = new MiccaRig(); this.micNpc.root.position.set(Gt.x - 2, Gt.y, Gt.z - 4.5); this.micNpc.root.rotation.y = -0.4; grp.add(this.micNpc.root);
    applyRim(this.gemNpc.root, 0xffffff, 0.4); applyRim(this.micNpc.root, 0xffffff, 0.4);
    boostGlow(this.gemNpc.root); boostGlow(this.micNpc.root);
    W.animated.push({ update: (dt, t) => {
      if (!this.active) return;
      if (this.gemNpc.root.visible) this.gemNpc.update(dt, { speed: 0, grounded: true });
      if (this.micNpc.root.visible) this.micNpc.update(dt, { speed: 0, grounded: true });
      this.portal.rotation.z = t; this.dome.rotation.y = t * 0.1;
      if (this.asgardGate) { this.asgardGate.rotation.z = t * 0.8; this.asgardDisc.rotation.z = -t * 0.5; }
      this.padMeshes.forEach((p, i) => { p.glow.scale.setScalar(1 + Math.sin(t * 4 + i) * 0.15); });
      this.anchorMeshes.forEach((a) => (a.core.rotation.y = t));
    } });
    // interactables
    const add = (it) => { W.interactables.push(it); return it; };
    add({ pos: this.portal.position.clone().setY(Gt.y), radius: 3.5, kind: 'void_exit', label: 'Kembali ke Frostvale', enabled: () => this.active });
    add({ pos: this.campfire.pos, radius: 3, kind: 'void_rest', label: 'Istirahat di api unggun void', enabled: () => this.active && G.state.voidCamp });
    add({ pos: V(c.x, c.y, c.z - 16), radius: 4.5, kind: 'void_to_asgard', label: 'Tangga Cahaya: Masuki Celestial Asgard', enabled: () => this.active && (G.state.asgardOpen || G.state.voidDone || G.state.step === 'asgard_go') });
    VOIDR.anchors.forEach((a, i) => add({ pos: V(a.x, a.y, a.z), radius: 3, kind: 'anchor', idx: i, label: 'Aktifkan Jangkar Bintang', enabled: () => this.active && G.state.step === 'void_anchors' && !G.state.anchors[i] && !this.anchorWave?.[i] }));
    this.anchorWave = {};
    this.built = true;
  }

  _spawnEnemies() {
    const G = this.g;
    this.mobs = [];
    const place = (type, isl, n) => {
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI * 2, rr = isl.r * 0.5 * Math.random();
        const e = new Enemy(G, type, V(isl.x + Math.cos(a) * rr, isl.y, isl.z + Math.sin(a) * rr), { leash: isl.r + 6 });
        e.realmMob = true; e.root.visible = false; G.enemies.push(e); this.mobs.push(e);
      }
    };
    place('voideye', VOIDR.anchors[0], 1); place('voidwisp', VOIDR.anchors[1], 2); place('voideye', STONES[4], 1);
    const c = VOIDR.central;
    this.ygg = new Enemy(G, 'ygg', V(c.x, c.y, c.z - 6), { leash: 999 });
    this.ygg.realmMob = true;
    G.enemies.push(this.ygg);
  }

  spawnRoots(center, n) {
    const G = this.g;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.4;
      const p = V(center.x + Math.cos(a) * 14, center.y, center.z + Math.sin(a) * 14);
      const e = new Enemy(G, 'voidroot', p, { leash: 999 }); e.isAdd = true; e.realmMob = true;
      G.enemies.push(e); G.vfx.pillar(p, 0xa04aff, 6, 0.6);
    }
  }

  // ---------- realm entry / exit ----------
  enter(atGate = true) {
    const G = this.g, P = G.player, W = G.world;
    if (!this.built) { this._build(); this.syncVisuals(); }
    if (!this.active) { this.returnPos = FLOC.peak.clone().add(V(0, 0, 4)); this.savedDay = W.dayT; }
    this.active = true;
    W.realm = this;
    this.group.visible = true; this.campfire.group.visible = true;
    for (const c of W.colliders) if (c.realm) c.disabled = false;
    if (atGate) { P.placeAt(V(VOIDR.gate.x, 0, VOIDR.gate.z + 6), Math.PI); G.cam.target.copy(P.pos); }
    G.ui.bigText('VOID RIFT', '#c07aff');
    sfx.quest();
  }
  exit() {
    const G = this.g, P = G.player, W = G.world;
    if (!this.active) return;
    this.active = false;
    W.realm = null;
    this.group.visible = false; this.campfire.group.visible = false;
    for (const c of W.colliders) if (c.realm) c.disabled = true;
    P.placeAt(this.returnPos || FLOC.peak.clone());
    G.cam.target.copy(P.pos);
    W.dayT = this.savedDay ?? W.dayT;
    G.graphics.mood({ tint: new THREE.Color(1, 1, 1) });
    setMusicMood('normal');
  }

  // ---------- quests ----------
  questTarget(step) {
    const S = this.g.state, P = this.g.player;
    if (step === 'void_go') return this.active ? V(VOIDR.gate.x, 0, VOIDR.gate.z) : FLOC.peak;
    if (!this.active) return null;
    if (step === 'void_anchors') { let b = null, bd = Infinity; VOIDR.anchors.forEach((a, i) => { if (!S.anchors[i]) { const d = Math.hypot(a.x - P.pos.x, a.z - P.pos.z); if (d < bd) { bd = d; b = V(a.x, 0, a.z); } } }); return b; }
    if (step === 'void_boss') return V(VOIDR.central.x, 0, VOIDR.central.z);
    return null;
  }

  async interact(it) {
    const G = this.g, S = G.state, P = G.player;
    if (it.kind === 'aurora_gate') {
      G.ui.toggleMenu(false);
      this.enter(true);
      if (!S.voidCamp) {
        await G.ui.dialog(SCRIPTS.voidIntro);
        S.voidCamp = true; S.spawn = 'void';
        for (const id of ['gemora', 'micca']) { const m = P.addMember(id); m.level = P.level; m.maxHp = m.calcMaxHp(P.level); m.hp = m.maxHp; }
        S.party = P.roster.map((x) => x.id);
        G.ui.buildParty();
        G.ui.toast('Gemora & Micca bergabung! (Atur party di menu ☰)', 'gold big');
        G.ui.toast('Jump pad = loncat tinggi → buka glider untuk menyeberang!', '');
        if (S.step === 'void_go') G._advance('void_anchors');
      }
      return true;
    }
    if (it.kind === 'void_exit') { this.exit(); G.ui.toast('Kembali ke Kuil Aurora'); return true; }
    if (it.kind === 'void_to_asgard') { this.exit(); this.g.ch5.enter(true); return true; }
    if (it.kind === 'void_rest') { P.healAll(1, true); S.spawn = 'void'; G.ui.toast('Istirahat di api unggun void. HP pulih! (Tersimpan)', 'gold'); G.save(); return true; }
    if (it.kind === 'anchor') {
      const a = VOIDR.anchors[it.idx];
      this.anchorWave[it.idx] = [];
      G.ui.toast('Penjaga Jangkar terbangun!', 'gold');
      const list = it.idx === 2 ? ['anchorguard', 'voideye', 'voidwisp'] : ['anchorguard', 'voidwisp'];
      list.forEach((type, k) => {
        const ang = (k / list.length) * Math.PI * 2;
        const e = new Enemy(G, type, V(a.x + Math.cos(ang) * 5, a.y, a.z + Math.sin(ang) * 5), { leash: a.r + 6, elite: type === 'anchorguard' && it.idx === 2 ? 'DARK' : undefined });
        e.aggro = true; e.anchorIdx = it.idx; e.realmMob = true;
        G.enemies.push(e); this.anchorWave[it.idx].push(e); G.vfx.pillar(e.pos, 0xa04aff, 6, 0.6);
      });
      return true;
    }
    return false;
  }

  onKilled(e) {
    const G = this.g, S = G.state;
    if (e.anchorIdx !== undefined) {
      const wave = this.anchorWave[e.anchorIdx];
      if (wave && wave.every((x) => x.dead)) {
        S.anchors[e.anchorIdx] = true; this._lightAnchor(e.anchorIdx); sfx.quest();
        G.ui.toast(`Jangkar Bintang aktif (${S.anchors.filter(Boolean).length}/3)`, 'gold');
        if (S.anchors.every(Boolean)) {
          G.ui.dialog(SCRIPTS.voidMid).then(() => { this._openCentral(); G._advance('void_boss'); });
        }
        G.save();
      }
    }
    if (e.type === 'ygg') this._victory();
  }

  _lightAnchor(i) {
    if (!this.built) return;
    const m = this.anchorMeshes[i];
    m.core.material.color.set(0xffe08a).multiplyScalar(2.5); m.beam.visible = true;
  }
  _openCentral(silent = false) {
    this.bridges[1].on = true;
    if (this.built) { this.bridgeMeshes[1].visible = true; this.dome.visible = false; }
    if (!silent) this.g.ui.toast('Jembatan cahaya ke pulau pusat terbentuk!', 'gold big');
  }

  async _victory() {
    const G = this.g, S = G.state;
    setMusicMood('normal');
    for (const e of G.enemies) if (e.isAdd && !e.dead) e.die();
    S.voidDone = true; S.asgardOpen = true; S.inv.fish += 12; S.inv.berry += 12;
    G.ui.toast('MENANG! Ygg-Naar dikalahkan', 'gold big');
    await new Promise((r) => setTimeout(r, 1800));
    await G.ui.dialog(SCRIPTS.voidVictory);
    G._advance('asgard_go');
  }

  mood(dt) {
    const W = this.g.world;
    W.clouds.visible = !this.active && !this.g.ch5?.active && !this.g.ch6?.active && !this.g.spire?.active;
    if (!this.active) return;
    W.scene.fog.color.set(0x2a1240); W.scene.fog.near = 60; W.scene.fog.far = 260;
    this.nebula.position.copy(this.g.camera.position);
  }

  update(dt) {
    const G = this.g, S = G.state, P = G.player;
    for (const e of this.mobs) if (!e.dead) e.root.visible = this.active;
    if (this.ygg && !this.ygg.dead) this.ygg.root.visible = this.active;
    if (!this.active) return;
    G.world.dayT = 0.5;
    const recruited = !!P.cache.gemora;
    this.gemNpc.root.visible = !recruited; this.micNpc.root.visible = !recruited;
    // fell into the abyss
    if (P.pos.y < 120 && !P.dead) {
      P.placeAt(P.lastLand && P.lastLand.y > 100 ? P.lastLand : V(VOIDR.gate.x, 0, VOIDR.gate.z + 6));
      P.iframes = 1; P.hp = Math.max(1, P.hp - P.maxHp * 0.12);
      G.ui.toast('Jatuh ke jurang void! (-12% HP)');
    }
    // jump pads → launch, then auto-glide toward the next island
    for (const pad of PADS) {
      if (P.grounded && Math.hypot(P.pos.x - pad.x, P.pos.z - pad.z) < 1.4 && !this.launch) {
        this.launch = pad; P.vy = 24; P.grounded = false; P.doubleUsed = true; P.action = null;
        sfx.dash(); G.vfx.shockwave(P.pos, 2, 0x8fffe0, 0.4);
        if (!S.padHint) { S.padHint = true; G.ui.toast('Melayang otomatis — arahkan dengan joystick/WASD', 'gold'); }
      }
    }
    if (this.launch) {
      if (P.vy < 2 && !P.gliding && !P.grounded) { P.gliding = true; }
      if (P.gliding) P.facing = Math.atan2(this.launch.target.x - P.pos.x, this.launch.target.z - P.pos.z) * 0.15 + P.facing * 0.85;
      if (P.grounded) this.launch = null;
    }
    if (G.inputLocked || P.dead) return;
    const B = this.ygg;
    if (B && S.step === 'void_boss' && !B.started && !B.dead && Math.hypot(P.pos.x - VOIDR.central.x, P.pos.z - VOIDR.central.z) < VOIDR.central.r - 4) {
      G.ui.dialog(S.yggIntro ? SCRIPTS.yggRetry : SCRIPTS.yggIntro).then(() => {
        S.yggIntro = true; B.started = true; B.aggro = true; B.state = 'rest'; B.t = 0;
        sfx.roar(); G.shake(0.7); setMusicMood('boss');
      });
    }
  }

  onRespawn() {
    const B = this.ygg, G = this.g;
    if (B && B.started && !B.dead) {
      B.started = false; B.hp = B.maxHp; B.pos.copy(B.home); B.state = 'idle'; B.invuln = false; B['eye0.66'] = B['eye0.33'] = false;
      for (const e of G.enemies) if (e.type === 'voidroot') { e.dead = true; e.deadT = 1; }
      setMusicMood('normal');
    }
  }

  onLoad() {
    const G = this.g, S = G.state;
    if (S.voidDone && this.ygg) { this.ygg.dead = true; this.ygg.remove(); G.enemies = G.enemies.filter((e) => e !== this.ygg); this.ygg = null; }
    if (S.anchors.every(Boolean)) this.bridges[1].on = true;
  }
  /** called when the realm is built for the first time after loading */
  syncVisuals() {
    const S = this.g.state;
    S.anchors.forEach((on, i) => on && this._lightAnchor(i));
    if (S.anchors.every(Boolean)) this._openCentral(true);
  }
}
