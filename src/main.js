// Euphoria Adventure — open-world action RPG prototype (web first, mobile later).
import * as THREE from 'three';
import { applyKit, pendingModels, modelsIdle } from './assets.js';
import { updateCull, setCullScale, zoneSweep, setActiveZone, getActiveZone } from './cull.js';
import { zoneOf, ZONES } from './zones.js';
import { World, LOC } from './world.js';
import { Player } from './player.js';
import { PurrBot, makeMora, makeFidelia } from './characters.js';
import { Enemy } from './enemies.js';
import { VFX } from './vfx.js';
import { UI } from './ui.js';
import { Input } from './input.js';
import { SCRIPTS, PART_NAMES, VOICE } from './story.js';
import { HEROES } from './heroes.js';
import { Chapter1 } from './chapter1.js';
import { Chapter2, heatAt, lavaAt } from './chapter2.js';
import { Chapter3, coldAt } from './chapter3.js';
import { Chapter4, VOIDR } from './chapter4.js';
import { Chapter5, ASGARD } from './chapter5.js';
import { Chapter6, ASH } from './chapter6.js';
import { Spire } from './spire.js';
import { WEAPON_BY_ID } from './gacha.js';
import { reviveArtifact } from './artifacts.js';
import { WildlifeManager } from './wildlife.js';
import { WeatherManager } from './weather.js';
import { FlightRings } from './flightrings.js';
import { ElementalSight } from './sight.js';
import { PhotoMode } from './photo.js';
import { BountyManager } from './bounties.js';
import { WorldMap } from './map.js';
import { FishingManager } from './fishing.js';
import { CookingManager } from './cooking.js';
import { FLOC } from './frost.js';
import { LightPool } from './lights.js';
import { Graphics, PRESETS, PRESET_ORDER, boostGlow } from './graphics.js';
import { Ambient } from './ambient.js';
import { applyRim } from './toon.js';
import { Combat } from './combat.js';
import { Rift } from './rift.js';
import { VLOC } from './volcano.js';
import { RLOC } from './reef.js';
import { QUEST_ORDER } from './story.js';
import { initAudio, sfx, setMusicMood } from './sfx.js';
import { toon, part, damp } from './toon.js';

const $ = (id) => document.getElementById(id);

class Game {
  constructor() {
    this.SAVE_KEY = 'euphoria_adventure_save_v1';
    const canvas = $('game');
    const mobile = matchMedia('(pointer: coarse)').matches;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 1.75));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 1500);
    this.cam = { yaw: 2.6, pitch: 0.28, dist: 5.6, distTarget: 5.6, target: new THREE.Vector3(), shake: 0 };

    this.input = new Input(canvas);
    this.vfx = new VFX(this.scene);
    this.world = new World(this.scene);
    this.ui = new UI(this);
    this.player = new Player(this);
    this.purrbot = new PurrBot(this.scene);
    this.enemies = [];
    this.projectiles = [];
    this.storms = [];
    this.shots = [];
    this.timeScale = 1; this.hitstopT = 0;
    this.inputLocked = true;
    this.paused = false;
    this.playing = false;
    this.nearInteract = null;

    this.gfxAuto = true;
    let saved = null;
    try { saved = localStorage.getItem('euphoria_adventure_gfx'); } catch (e) { saved = null; }
    if (saved) this.gfxAuto = false;
    // integrated / software GPUs choke on HIGH (retina pixel ratio + AO) — start them on LOW
    let gpu = '';
    try { const gl = this.renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info'); gpu = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)); } catch (e) { gpu = ''; }
    this.gpuName = gpu;
    const weakGpu = /intel|iris|uhd|hd graphics|swiftshader|llvmpipe|software|mali|adreno|powervr/i.test(gpu);
    this._gfxInit = saved && PRESETS[saved] ? saved : (weakGpu ? 'low' : mobile ? 'med' : 'high');
    this.fpsAcc = 0; this.fpsFrames = 0;

    this.state = this._defaultState();
    this._buildStoryObjects();
    this._setupSpawns();
    this.ch1 = new Chapter1(this);
    this.ch2 = new Chapter2(this);
    this.ch3 = new Chapter3(this);
    this.ch4 = new Chapter4(this);
    this.ch5 = new Chapter5(this);
    this.ch6 = new Chapter6(this);
    this.spire = new Spire(this);
    this.wildlife = new WildlifeManager(this);
    this.weather = new WeatherManager(this);
    this.flightRings = new FlightRings(this);
    this.sight = new ElementalSight(this);
    this.bounties = new BountyManager(this);
    this.photo = new PhotoMode(this);
    this.map = new WorldMap(this);
    this.fishing = new FishingManager(this);
    this.cooking = new CookingManager(this);
    this.lightPool = new LightPool(this.scene, 8);
    this.ambient = new Ambient(this);
    this.combat = new Combat(this);
    this.rift = new Rift(this);
    this._spawnElites();
    this.graphics = new Graphics(this.renderer, this.scene, this.camera);
    // HDR glow for everything built so far + anime rim light on heroes, NPCs & bosses
    boostGlow(this.scene);
    for (const m of Object.values(this.player.cache)) applyRim(m.rig.root, 0xffffff, 0.45);
    for (const npc of [this.mora, this.fidelia, this.ch1.hyeonxa, this.ch1.scyllaNpc.root, this.ch2.eroNpc.root, this.ch2.rumiNpc.root, this.ch3.valNpc.root, this.ch3.glyNpc.root]) applyRim(npc, 0xffffff, 0.4);
    applyRim(this.purrbot.root, 0xd8ffb0, 0.4);
    this.applyGfx(this._gfxInit);
    this.blizzard = 0;
    this.chestTotal = this.state.chestTotal;

    addEventListener('resize', () => {
      this._redrawFrozen = true; // canvas is cleared on resize: redraw the frozen frame once
      this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix();
      this.graphics.resize();
      this.map?.resize();
    });

    // place Luby napping on Sunbeam Rock for the title screen
    this.player.placeAt(new THREE.Vector3(LOC.workshop.x - 4, 0, LOC.workshop.z - 3), 0.6);
    this.clock = new THREE.Clock();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  _defaultState() {
    return { step: 'parts', parts: [false, false, false], kills: 0, purrbot: false, boss: false, inv: { berry: 2, fish: 0, grilled: 0, cool: 0, soup: 0, pepper: 0 }, crates: [], spawn: 'workshop', choices: {}, denIntro: false, party: ['luby'],
      samples: [false, false, false], spires: [false, false, false], chests: [], bridgeOpen: false, reefCamp: false, reefDone: false, pearls: 0,
      lanterns: [false, false, false, false, false], seals: [false, false, false], causewayOpen: false, volcCamp: false, volcDone: false, team: null,
      souls: [false, false, false, false], floesOpen: false, frostCamp: false, frostDone: false, shrineLit: false,
      voidOpen: false, voidCamp: false, voidDone: false, anchors: [false, false, false],
      asgardOpen: false, asgardCamp: false, asgardDone: false, prisms: [false, false, false],
      ashCamp: false, ashDone: false, ashBlades: [false, false, false, false, false],
      starlight: 1600, weapons: [], inventoryArtifacts: [], spireStars: {} };
  }
  after(step) { return QUEST_ORDER.indexOf(this.state.step) >= QUEST_ORDER.indexOf(step);
  }

  // ======================================================================
  // story objects: mecha parts, NPCs, quest beacon, workbench & campfire
  // ======================================================================
  _buildStoryObjects() {
    const W = this.world, S = this.scene;
    // mecha parts
    this.partObjs = LOC.parts.map((p, i) => {
      const g = new THREE.Group();
      const gear = part(new THREE.TorusGeometry(0.32, 0.11, 6, 10), toon(0xc9d0d4, { flatShading: true }), { ol: 0.02 });
      g.add(gear);
      applyKit('kit_mecha_part', g, { metal: gear.material }, [gear], { ol: 0.02 });
      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), new THREE.MeshBasicMaterial({ color: 0xb8ff4a }));
      g.add(core);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 30, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xb8ff4a, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
      beam.position.y = 15; g.add(beam);
      g.position.set(p.x, p.y + 1.1, p.z);
      S.add(g);
      const it = { pos: g.position, radius: 2.4, label: 'Ambil ' + PART_NAMES[i], kind: 'part', idx: i, obj: g };
      it.enabled = () => this.state.step === 'parts' && !this.state.parts[i];
      W.interactables.push(it);
      W.animated.push({ update: (dt, t) => { g.visible = it.enabled(); g.rotation.y = t * 1.5; gear.rotation.x = t; g.position.y = p.y + 1.1 + Math.sin(t * 2 + i) * 0.15; } });
      return g;
    });
    // workbench / nap
    const benchPos = new THREE.Vector3(LOC.workshop.x + 3, LOC.workshop.y, LOC.workshop.z + 1);
    const bench = { pos: benchPos, radius: 2.8, kind: 'bench' };
    Object.defineProperty(bench, 'label', { get: () => (this.state.step === 'rebuild' ? 'Perbaiki Purr-Bot' : 'Ngoprek (simpan)') });
    bench.enabled = () => true;
    W.interactables.push(bench);
    const nap = { pos: new THREE.Vector3(W.napRock.x, W.napRock.top, W.napRock.z), radius: 3.6, kind: 'nap', label: 'Tidur siang di sunbeam (pulihkan HP)' };
    nap.enabled = () => this.state.step !== 'parts' || this.state.parts.some(Boolean);
    W.interactables.push(nap);
    // campfire
    const cf = { pos: W.campfire.pos, radius: 3, kind: 'campfire', label: 'Istirahat di api unggun' };
    cf.enabled = () => this.after('clear');
    W.interactables.push(cf);

    // NPCs at camp
    const C = LOC.camp;
    this.mora = makeMora(); this.mora.position.set(C.x - 2.2, C.y, C.z + 2.4); this.mora.rotation.y = 2.2; S.add(this.mora);
    this.fidelia = makeFidelia(); this.fidelia.position.set(C.x + 2.6, C.y, C.z + 1.8); this.fidelia.rotation.y = -2.4; S.add(this.fidelia);
    W.addCollider(this.mora.position.x, this.mora.position.z, 0.4);
    W.addCollider(this.fidelia.position.x, this.fidelia.position.z, 0.4);
    W.animated.push({ update: (dt) => { this.mora.userData.update(dt); this.fidelia.userData.update(dt); } });
    const talk = (who, obj) => {
      const it = { pos: obj.position, radius: 2.6, kind: 'talk', who, label: 'Bicara dengan ' + (who === 'mora' ? 'Mora' : 'Fidelia') };
      it.enabled = () => this.after('clear') && obj.visible;
      W.interactables.push(it);
    };
    talk('mora', this.mora); talk('fidelia', this.fidelia);

    // quest beacon
    const bm = new THREE.MeshBasicMaterial({ color: 0xffd66b, transparent: true, opacity: 0.85, depthWrite: false });
    this.beacon = new THREE.Group();
    const dia = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), bm);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 60, 6, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd66b, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
    col.position.y = 30; dia.position.y = 4;
    this.beacon.add(dia, col);
    S.add(this.beacon);
    W.animated.push({ update: (dt, t) => { dia.rotation.y = t * 2; dia.position.y = 4 + Math.sin(t * 2) * 0.3; } });
  }

  questTarget() { return this.bounties?.target() || this._storyTarget(); }
  _storyTarget() {
    if (this.bounties?.activeBounty) return this.bounties.activeBounty.pos;
    const s = this.state;
    switch (s.step) {
      case 'parts': {
        let best = null, bd = Infinity;
        LOC.parts.forEach((p, i) => { if (!s.parts[i]) { const d = p.distanceTo(this.player.pos); if (d < bd) { bd = d; best = p; } } });
        return best;
      }
      case 'rebuild': return LOC.workshop;
      case 'camp': return LOC.camp;
      case 'clear': return null;
      case 'den': return LOC.den;
      default: return this.ch1.questTarget(s.step) || this.ch2.questTarget(s.step) || this.ch3.questTarget(s.step) || this.ch4.questTarget(s.step) || this.ch5.questTarget(s.step) || this.ch6.questTarget(s.step);
    }
  }

  // ======================================================================
  // enemies
  // ======================================================================
  _setupSpawns() {
    const v = (x, z) => new THREE.Vector3(x, 0, z);
    this.zones = [
      ...LOC.parts.map((p) => ({ c: p.clone(), r: 7, type: 'slime', n: 3 })),
      { c: v(22, -14), r: 9, type: 'slime', n: 3 },
      { c: v(-20, 40), r: 10, type: 'slime', n: 3 },
      { c: v(10, -62), r: 10, type: 'fox', n: 3 },
      { c: v(-30, -56), r: 9, type: 'fox', n: 2 },
      { c: v(-30, -56), r: 9, type: 'slime', n: 2 },
      { c: v(70, -60), r: 10, type: 'fox', n: 2 },
      { c: v(-26, -82), r: 8, type: 'fox', n: 2 },
      { c: v(-90, -20), r: 12, type: 'slime', n: 4 },
      { c: v(40, 95), r: 12, type: 'fox', n: 2 },
    ];
    for (const z of this.zones) { z.alive = []; z.respawnT = 0; for (let i = 0; i < z.n; i++) this._spawnIn(z); }
    // boss
    this.boss = new Enemy(this, 'boss', LOC.den.clone(), { leash: 60 });
    this.boss.facing = 0.5;
    this.enemies.push(this.boss);
  }

  /** elite enemies with elemental shields, one or two per region (respawn after 5 minutes) */
  _spawnElites() {
    const v = (x, z) => new THREE.Vector3(x, 0, z);
    const list = [
      { c: v(-60, -40), type: 'fox', elite: 'DARK', region: 'main' },
      { c: v(80, 80), type: 'slime', elite: 'DARK', region: 'main' },
      { c: v(470, 60), type: 'reefslime', elite: 'WATER', region: 'reef' },
      { c: v(500, -50), type: 'jelly', elite: 'WATER', region: 'reef', water: true },
      { c: v(-90, -440), type: 'lavafox', elite: 'FIRE', region: 'volc' },
      { c: v(30, -480), type: 'ghost', elite: 'DARK', region: 'volc' },
      { c: v(-500, -10), type: 'frostwolf', elite: 'ICE', region: 'frost' },
      { c: v(-560, 90), type: 'frostsoul', elite: 'ICE', region: 'frost' },
    ];
    for (const z of list) { Object.assign(z, { r: 4, n: 1, alive: [], respawnT: 0, respawnTime: 300 }); this.zones.push(z); this._spawnIn(z); }
  }

  _spawnIn(z) {
    for (let k = 0; k < 10; k++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * z.r;
      const x = z.c.x + Math.cos(a) * r, zz = z.c.z + Math.sin(a) * r;
      const h = this.world.heightAt(x, zz);
      if (h < (z.water ? -1.0 : 0.5)) continue;
      const e = new Enemy(this, z.type, new THREE.Vector3(x, h, zz), { zone: z, leash: 34, elite: z.elite });
      z.alive.push(e); this.enemies.push(e);
      return e;
    }
  }

  summonAdds(pos, n, type = 'fox') {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const p = pos.clone().add(new THREE.Vector3(Math.cos(a) * 6, 0, Math.sin(a) * 6));
      p.y = this.world.heightAt(p.x, p.z);
      p.y = Math.max(p.y, this.world.groundAt(p.x, p.z));
      const e = new Enemy(this, type, p, { leash: 60 });
      e.aggro = true; e.isAdd = true;
      this.enemies.push(e);
      this.vfx.pillar(p, 0xff5ce1, 5, 0.6);
    }
  }

  dealDamage(e, base, { knock = 0, stun = 0, critBonus = 0, element = null, noReact = false, poise, launch = 0 } = {}) {
    const foodCrit = this.cooking ? this.cooking.getCritBonus() : 0;
    const gear = this.player.m.getArtifactBonus(), sets = gear.setCounts;
    const frozen = e.stun > 0 || (e.aura && e.aura.el === 'ICE');
    const floorCrit = this.spire?.active ? this.spire.critBonus() : 0;
    const crit = Math.random() < 0.15 + critBonus + foodCrit + gear.critRate + floorCrit + (this.player.hero.id === 'gemora' ? 0.1 : 0) + ((sets.blizzard || 0) >= 4 && frozen ? 0.25 : 0);
    let mult = 1, react = null;
    const aura = e.aura ? e.aura.el : null;
    if (element && !noReact) {
      if (element === 'WIND' && aura && aura !== 'WIND') {
        // SWIRL: spreads the aura and bursts around the target
        react = 'SWIRL'; mult = 1.25; e.aura = null;
        this.vfx.shockwave(e.pos, 4.5, { WATER: 0x4fb4f0, LIGHT: 0xf5c542, FIRE: 0xff7a2a, ICE: 0x9ee8ff, LIGHTNING: 0xc07aff }[aura] || 0xffffff, 0.45);
        for (const o of this.enemies) {
          if (o === e || o.dead || o.dormant) continue;
          if (Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z) < 5) {
            o.aura = { el: aura, t: 6 };
            this.dealDamage(o, this.player.atk * 0.6, { element: aura, noReact: true });
          }
        }
      } else if ((element === 'FIRE' && aura === 'WATER') || (element === 'WATER' && aura === 'FIRE')) {
        react = 'VAPORIZE'; mult = element === 'FIRE' ? 2.0 : 1.6; e.aura = null;
        this.vfx.particles(e.pos.clone().setY(e.pos.y + 1), 30, 0xf0f4ff, { speed: 4, up: 6, life: 0.8, grav: -1 });
      } else if ((element === 'FIRE' && aura === 'LIGHT') || (element === 'LIGHT' && aura === 'FIRE')) {
        react = 'FLARE'; mult = 1.3; e.aura = null;
        this.vfx.shockwave(e.pos, 4, 0xffd06a, 0.45); this.vfx.pillar(e.pos, 0xffb040, 5, 0.5);
        for (const o of this.enemies) {
          if (o === e || o.dead || o.dormant) continue;
          if (Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z) < 4) this.dealDamage(o, this.player.atk * 0.9, { noReact: true });
        }
      } else if ((element === 'LIGHTNING' && aura === 'WATER') || (element === 'WATER' && aura === 'LIGHTNING')) {
        react = 'ELECTRO'; mult = 1.2; e.aura = { el: 'WATER', t: 3 };
        let n = 0;
        for (const o of this.enemies) {
          if (o === e || o.dead || o.dormant || n >= 4) continue;
          if (o.pos.distanceTo(e.pos) < 7) { n++; this.vfx.beamLine(e.pos.clone().setY(e.pos.y + 1), o.pos.clone().setY(o.pos.y + 1), 0xc07aff, 0.08, 0.25); this.dealDamage(o, this.player.atk * 0.5, { noReact: true, poise: 6 }); }
        }
      } else if ((element === 'LIGHTNING' && aura === 'FIRE') || (element === 'FIRE' && aura === 'LIGHTNING')) {
        react = 'OVERLOAD'; mult = 1.5; e.aura = null;
        this.vfx.shockwave(e.pos, 4, 0xff6aa0, 0.45); this.vfx.impact(e.pos.clone().setY(e.pos.y + 1), '#ff6aa0', true); this.shake(0.3);
        for (const o of this.enemies) {
          if (o === e || o.dead || o.dormant) continue;
          if (o.pos.distanceTo(e.pos) < 4) this.dealDamage(o, this.player.atk * 1.0, { noReact: true, knock: 12, poise: 20 });
        }
        knock = Math.max(knock, 12);
      } else if ((element === 'LIGHTNING' && aura === 'ICE') || (element === 'ICE' && aura === 'LIGHTNING')) {
        react = 'SUPERCONDUCT'; mult = 1.15; e.aura = null;
        this.vfx.shockwave(e.pos, 4, 0xb8c8ff, 0.45);
        for (const o of this.enemies) if (!o.dead && o.pos.distanceTo(e.pos) < 4.5) o.shredT = 8;
      } else if ((element === 'ICE' && aura === 'WATER') || (element === 'WATER' && aura === 'ICE')) {
        react = 'FREEZE'; e.aura = null;
        stun = Math.max(stun, e.isBoss ? 1.0 : 2.8);
        this.vfx.iceSpike(e.pos.clone(), 0.8 + e.radius * 0.5);
      } else if ((element === 'ICE' && aura === 'FIRE') || (element === 'FIRE' && aura === 'ICE')) {
        react = 'MELT'; mult = element === 'FIRE' ? 2.0 : 1.5; e.aura = null;
        this.vfx.particles(e.pos.clone().setY(e.pos.y + 1), 30, 0xffc890, { speed: 4, up: 4, life: 0.7 });
      } else if ((element === 'WATER' && aura === 'LIGHT') || (element === 'LIGHT' && aura === 'WATER')) {
        react = 'PRISM'; mult = 1.75; e.aura = null;
        this.vfx.particles(e.pos.clone().setY(e.pos.y + 1), 26, 0xc8f0ff, { speed: 6, up: 4, life: 0.6 });
      } else if (['WATER', 'LIGHT', 'FIRE', 'ICE', 'LIGHTNING'].includes(element)) {
        e.aura = { el: element, t: 7 };
      }
    } else if (['WATER', 'LIGHT', 'FIRE', 'ICE', 'LIGHTNING'].includes(element)) {
      e.aura = { el: element, t: 6 };
    }
    if (element === 'LIGHT') mult *= 1.2; // Purify: corrupted creatures are weak to light
    if (element === 'FIRE') { e.burnT = 3; e.burnDmg = Math.max(e.burnDmg || 0, this.player.atk * 0.12); }
    const hid = this.player.hero.id;
    if (hid === 'eropatra' && e.burnT > 0) mult *= 1.2;
    if (hid === 'rumi' && (e.type === 'ghost' || e.type === 'seal' || e.type === 'bloodcrystal')) mult *= 1.4;
    if (hid === 'rumi' && e.hp < e.maxHp * 0.35) mult *= 1.25;
    // gear, set bonuses and tower floor rules
    const isBurst = this.player.action === 'burst';
    if (element) mult *= 1 + gear.elemDmg;
    else mult *= 1 + gear.normalDmg + ((sets.gladiator || 0) >= 4 ? 0.35 : 0);
    if (isBurst) mult *= 1 + gear.burstDmg;
    if ((sets.viridescent || 0) >= 4 && react === 'SWIRL') { mult *= 1.6; e.shredT = 8; }
    if ((sets.crimson || 0) >= 4 && (react === 'VAPORIZE' || react === 'MELT')) mult *= 1.3;
    if ((sets.abyssal || 0) >= 4 && e.breakT > 0) mult *= 1.35;
    if (this.spire?.active) mult *= this.spire.damageMult(element, react, isBurst);
    const critMult = 1.9 + gear.critDmg + (this.cooking?.activeBuffs.master > 0 ? 0.3 : 0);
    const dmg = base * mult * (crit ? critMult : 1) * (0.92 + Math.random() * 0.16);
    const pz = poise ?? Math.round((base / Math.max(1, this.player.atk)) * 12);
    const dealt = e.hit(dmg, { crit, knock, stun, from: this.player.pos, element, poise: pz, launch });
    if (dealt > 0) this.combat.impact(e, dealt, crit || !!react, element);
    if (react) {
      this.ui.damageNumber(e.pos.clone().setY(e.pos.y + e.tall + 0.4), { SWIRL: 'Pusaran!', PRISM: 'Prism!', VAPORIZE: 'Uap Meledak!', FLARE: 'Flare!', FREEZE: 'Beku!', MELT: 'Lebur!', ELECTRO: 'Arus Berantai!', OVERLOAD: 'Ledakan Plasma!', SUPERCONDUCT: 'Retak Petir!' }[react], 'react ' + react.toLowerCase());
      this.state.reactions = (this.state.reactions || 0) + 1;
    }
    this.player.combatT = 0;
  }

  /** Mora's homing star bolts */
  spawnBolt(from, target, fwd, dmg, delay = 0, element = 'LIGHT') {
    const m = this.vfx.orb(element === 'DARK' ? 0xff3a4a : 0xffe08a, 0.16);
    m.position.copy(from);
    m.visible = delay <= 0;
    const v = fwd.clone().multiplyScalar(14); v.y = 1.5;
    this.shots.push({ m, v, target, dmg, life: 2.2, delay, element });
  }
  _updateShots(dt) {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      if (s.delay > 0) { s.delay -= dt; if (s.delay <= 0) s.m.visible = true; continue; }
      s.life -= dt;
      if (s.target && !s.target.dead) {
        const tp = s.target.pos.clone(); tp.y += s.target.tall * 0.45;
        const want = tp.sub(s.m.position).normalize().multiplyScalar(22);
        s.v.lerp(want, 1 - Math.exp(-7 * dt));
      }
      s.m.position.addScaledVector(s.v, dt);
      if (Math.random() < 0.6) this.vfx.particles(s.m.position, 1, 0xffe08a, { speed: 0.3, up: 0, life: 0.3, grav: 0 });
      let hit = null;
      for (const e of this.enemies) {
        if (e.dead || e.dormant) continue;
        const ey = e.pos.y + e.tall * 0.45;
        if (Math.hypot(e.pos.x - s.m.position.x, e.pos.z - s.m.position.z) < e.radius + 0.4 && Math.abs(ey - s.m.position.y) < Math.max(1.2, e.tall * 0.5)) { hit = e; break; }
      }
      if (hit) {
        this.dealDamage(hit, s.dmg, { element: s.element, knock: 1 });
        this.player._gainEnergy(2);
        this.vfx.particles(s.m.position, 10, 0xffe08a, { speed: 3, up: 2, life: 0.35 });
      }
      if (hit || s.life <= 0 || s.m.position.y < this.world.heightAt(s.m.position.x, s.m.position.z)) {
        this.scene.remove(s.m); this.shots.splice(i, 1);
      }
    }
  }

  onEnemyKilled(e) {
    const P = this.player, S = this.state;
    P.addExp(e.def.exp * (e.elite ? 4 : 1));
    if (this.combat?.lock === e) this.combat.lock = null;
    this.combat.dropOrbs(e.pos, P.hero.color, e.isBoss ? 10 : e.elite ? 6 : 2);
    if (e.elite) {
      S.inv.fish += 2; S.inv.berry += 3; S.eliteKills = (S.eliteKills || 0) + 1;
      if (e.zone?.region === 'volc') S.inv.pepper = (S.inv.pepper || 0) + 2;
      this.ui.toast(`Elite dikalahkan! +2 🐟 +3 🫐 · EXP besar`, 'gold');
      this.vfx.pillar(e.pos, 0xffd66b, 8, 1);
    }
    P._gainEnergy(5);
    for (const m of P.members) if (m !== P.m) m.energy = Math.min(m.def.burstCost, m.energy + 2);
    if (S.step === 'clear' && e.type !== 'boss') {
      S.kills++;
      if (S.kills >= 8) this._advance('den');
    }
    if (e.type !== 'boss' && Math.random() < 0.3) { S.inv.berry++; this.ui.toast('+1 🫐 Berry'); }
    if (e.type === 'fox' && Math.random() < 0.15) { S.inv.fish++; this.ui.toast('+1 🐟 Camilan ikan'); }
    if (e.bounty && !e.isBoss) { S.inv.fish++; S.inv.berry += 2; this.ui.toast('Rumi: “Bayaran diterima!” +1 🐟 +2 🫐'); }
    if (e.zone) e.zone.respawnT = e.zone.respawnTime || 45;
    if (e.type === 'boss') this._bossDefeated();
    if (e.isBountyBoss) this.bounties.onBountyKilled(e);
    // tower and bounty targets reuse story monsters: they must not trigger story scenes
    if (e.spireMob || e.isBountyBoss) return;
    this.ch1.onKilled(e);
    this.ch2.onKilled(e);
    this.ch3.onKilled(e);
    this.ch4.onKilled(e);
    this.ch5.onKilled(e);
    this.ch6.onKilled(e);
  }

  addPuddle(pos, r, life, color) { this.ch1.addPuddle(pos, r, life, color); }
  addBeam(o, a, sp, life, dmg, color, len) { this.ch2.addBeam(o, a, sp, life, dmg, color, len); }
  addTether(src, dur, dmg) { this.ch2.addTether(src, dur, dmg); }
  spawnBloodCrystals(c, n) { this.ch2.spawnBloodCrystals(c, n); }
  startBlizzard(d) { this.ch3.startBlizzard(d); }
  spawnVoidRoots(c, n) { this.ch4.spawnRoots(c, n); }
  coldAt(x, z) { return coldAt(x, z); }
  nearWarm(p) {
    const W = this.world;
    const list = [...(W.warmSources || []), W.campfire.pos, W.reefCampfire.pos, W.volcCampfire.pos];
    return list.some((q) => Math.hypot(p.x - q.x, p.z - q.z) < 6);
  }
  heatAt(x, z) { return heatAt(x, z); }
  lavaAt(x, z) { return lavaAt(x, z); }
  addWave(c, maxR, speed, dmg) { this.ch1.addWave(c, maxR, speed, dmg); }
  activeBoss() { return [this.boss, this.ch1?.queen, this.ch2?.sage, this.ch3?.phantom, this.ch4?.ygg, this.ch5?.boss, this.ch6?.boss, ...(this.spire?.enemies || []).filter((e) => e.isBoss)].find((b) => b && b.started && !b.dead) || null; }

  spawnProjectile(pos, target, { speed = 9, dmg = 10, homing = 0, life = 4, dir, color = 0xe070ff } = {}) {
    const m = this.vfx.orb(color, 0.32);
    m.position.copy(pos);
    const v = dir ? dir.clone().multiplyScalar(speed) : new THREE.Vector3().subVectors(target.pos.clone().setY(target.pos.y + 1), pos).normalize().multiplyScalar(speed);
    this.projectiles.push({ m, v, dmg, homing, life, speed });
  }

  _updateProjectiles(dt) {
    const P = this.player;
    const chest = P.pos.clone().setY(P.pos.y + 0.9);
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      if (p.homing) {
        const want = new THREE.Vector3().subVectors(chest, p.m.position).normalize().multiplyScalar(p.speed);
        p.v.lerp(want, 1 - Math.exp(-p.homing * dt));
      }
      p.m.position.addScaledVector(p.v, dt);
      if (Math.random() < 0.5) this.vfx.particles(p.m.position, 1, 0xd070ff, { speed: 0.5, up: 0.2, life: 0.4, grav: 0 });
      let gone = p.life <= 0 || p.m.position.y < this.world.heightAt(p.m.position.x, p.m.position.z);
      if (!gone && p.m.position.distanceTo(chest) < 0.85) { P.damage(p.dmg, p.m.position, 5); gone = true; }
      if (gone) {
        this.vfx.particles(p.m.position, 10, 0xd070ff, { speed: 3, up: 2, life: 0.4 });
        this.scene.remove(p.m); this.projectiles.splice(i, 1);
      }
    }
  }

  // ---------------- burst ----------------
  burstCinematic(H) {
    this.ui.toast(H.name + ': “' + H.voice.burst + '”', 'gold');
    this.combat.cutIn(H);
    this.combat.fovKick = 6;
    this.cam.distTarget = 3.6;
    setTimeout(() => (this.cam.distTarget = this.cam.userDist ?? 5.6), 900);
    if (H.id === 'luby') sfx.purr();
  }
  startStorm(center) {
    const c = center.clone(); c.y = this.world.heightAt(c.x, c.z);
    this.purrbot.startStorm(c, 4.5);
    this.storms.push({ c, t: 4.5, tick: 0, atk: this.player.atk });
    this.vfx.shockwave(c, 7, 0xb8ff4a, 0.6);
    this.shake(0.4);
  }
  _updateStorms(dt) {
    for (let i = this.storms.length - 1; i >= 0; i--) {
      const s = this.storms[i];
      s.t -= dt; s.tick -= dt;
      for (let k = 0; k < 3; k++) {
        const a = Math.random() * Math.PI * 2, r = 1 + Math.random() * 5;
        this.vfx.particles(s.c.clone().add(new THREE.Vector3(Math.cos(a) * r, Math.random() * 4, Math.sin(a) * r)), 1, 0xd8ff8a, { speed: 6, up: 3, life: 0.5, grav: 0 });
      }
      for (const e of this.enemies) {
        if (e.dead || e.dormant) continue;
        const d = Math.hypot(e.pos.x - s.c.x, e.pos.z - s.c.z);
        if (d < 7.5 && !e.isBoss && e.type !== 'spire') { // pull in
          const pull = new THREE.Vector3(s.c.x - e.pos.x, 0, s.c.z - e.pos.z).normalize().multiplyScalar(Math.min(d, 6) * dt * 1.6);
          e.pos.add(pull);
        }
        if (s.tick <= 0 && d < 7 + e.radius) this.dealDamage(e, s.atk * 0.6, { stun: 0.4, element: 'WIND' });
      }
      if (s.tick <= 0) s.tick = 0.35;
      if (s.t <= 0) this.storms.splice(i, 1);
    }
  }

  // ======================================================================
  // interactions & survival
  // ======================================================================
  _findInteract() {
    const P = this.player;
    let best = null, bd = Infinity;
    for (const it of this.world.interactables) {
      if (it.enabled && !it.enabled()) continue;
      const d = Math.hypot(it.pos.x - P.pos.x, it.pos.z - P.pos.z);
      if (d < it.radius && d < bd) { bd = d; best = it; }
    }
    this.nearInteract = best;
  }

  async interact() {
    const it = this.nearInteract, S = this.state, P = this.player;
    if (!it || this.inputLocked) return;
    P.startAction('interact', 0.5);
    switch (it.kind) {
      case 'berry': {
        const n = 2 + Math.floor(Math.random() * 3);
        S.inv.berry += n; it.berries.visible = false; it.regrowAt = this.world.time + 120;
        this.ui.toast(`+${n} 🫐 Berry`); sfx.pickup();
        break;
      }
      case 'fish': {
        it.opened = true; S.crates.push(it.id); it.group.children[2].visible = false;
        S.inv.fish += 2; this.ui.toast('+2 🐟 Camilan ikan!', 'gold'); this.ui.toast('Luby: “' + VOICE.fish + '”'); sfx.pickup();
        break;
      }
      case 'part': {
        S.parts[it.idx] = true; sfx.quest();
        this.vfx.pillar(it.obj.position, 0xb8ff4a, 6, 0.8);
        this.ui.toast(`Onderdil ditemukan: ${PART_NAMES[it.idx]} (${S.parts.filter(Boolean).length}/3)`, 'gold');
        if (S.parts.filter(Boolean).length === 1) await this.ui.dialog(SCRIPTS.part);
        if (S.parts.every(Boolean)) this._advance('rebuild');
        this.save();
        break;
      }
      case 'bench': {
        if (S.step === 'rebuild') {
          await this.ui.dialog(SCRIPTS.rebuild);
          S.purrbot = true;
          this.purrbot.setActive(true, P.pos.clone().add(new THREE.Vector3(1.5, 0, 0)));
          this.vfx.pillar(this.purrbot.root.position, 0xb8ff4a, 6, 1);
          sfx.purr();
          this.ui.toast('BURST TERBUKA: [Q] Blender Purr Storm', 'gold big');
          P.energy = 60;
          this._advance('camp');
        } else { this.ui.toast('Luby mengencangkan baut Purr-Bot. (Tersimpan)'); this.save(); }
        break;
      }
      case 'nap': {
        P.healAll(1, true); S.spawn = 'workshop';
        this.ui.toast('Zzz… tidur siang sebentar. HP pulih! (Tersimpan)', 'gold');
        this._sleepIfNight();
        this.save();
        break;
      }
      case 'campfire': {
        P.healAll(1, true); S.spawn = 'camp';
        this.ui.toast('Istirahat di api unggun. HP pulih! (Tersimpan)', 'gold');
        this._sleepIfNight();
        this.save();
        this.cooking.open();
        break;
      }
      case 'fishing_spot': {
        this.fishing.startFishing(it.spotId);
        break;
      }
      case 'talk': {
        const lines = it.who === 'mora'
          ? [['mora', ['Waktu terasa lambat setiap kau di dekat sini… eh, maksudku, hutan ini tenang hari ini.', 'Bintang-bintang bilang Commander masih hidup. Kita akan menemukannya.', 'Kalau malam tiba, binatang terkorupsi jadi lebih ganas. Hati-hati.'][Math.floor(Math.random() * 3)]]]
          : [['fidelia', ['Makanlah sesuatu. Hero yang lapar tidak bisa bertarung. (Tekan Z / X)', 'Lingkaran merah di tanah berarti serangan. Dash untuk menghindar!', 'Perisaiku untukmu, kucing kecil. Walau kau tak mau berdiri di belakangnya.'][Math.floor(Math.random() * 3)]]];
        await this.ui.dialog(lines);
        break;
      }
      case 'bounty_board': {
        this.bounties.openBoard();
        break;
      }
      default: if (!(await this.ch1.interact(it)) && !(await this.ch2.interact(it)) && !(await this.ch3.interact(it)) && !(await this.ch4.interact(it)) && !(await this.ch5.interact(it)) && !(await this.ch6.interact(it)) && !(await this.spire.interact(it))) await this.wildlife.interact(it);
        if (['reef_rest', 'volc_rest', 'frost_rest', 'void_rest', 'asgard_rest', 'ash_rest'].includes(it.kind)) this.cooking.open();
    }
  }

  waypoints() {
    const S = this.state;
    return [
      { id: 'workshop', name: 'Sunbeam Rock', pos: new THREE.Vector3(LOC.workshop.x + 1, 0, LOC.workshop.z + 3), ok: true },
      { id: 'camp', name: 'Api Unggun Hutan', pos: LOC.camp.clone().add(new THREE.Vector3(0, 0, 3)), ok: this.after('clear') },
      { id: 'bridge', name: 'Paviliun Jembatan Karang', pos: new THREE.Vector3(248.5, 0, 22), ok: S.bridgeOpen },
      { id: 'reef', name: 'Kemah Karang', pos: RLOC.camp.clone().add(new THREE.Vector3(0, 0, 3)), ok: S.reefCamp },
      { id: 'volc', name: 'Pos Depan Vulkanik', pos: VLOC.outpost.clone().add(new THREE.Vector3(0, 0, 3)), ok: S.volcCamp },
      { id: 'rift', name: '✦ Starlight Rift (Arena)', pos: null, ok: S.bridgeOpen },
      { id: 'void', name: '🌌 Void Rift (Gerbang)', pos: null, ok: S.voidCamp },
      { id: 'asgard', name: '👑 Celestial Asgard (Kota Langit)', pos: null, ok: S.asgardCamp || S.asgardOpen },
      { id: 'spire', name: '⚔️ Menara Ujian · Celestial Spire', pos: null, ok: S.asgardDone || S.asgardCamp || S.voidDone },
      { id: 'ash', name: '🗡️ Ashen Battlefield (Medan Abu)', pos: null, ok: S.ashCamp },
      { id: 'frost', name: 'Desa Frostvale', pos: FLOC.village.clone().add(new THREE.Vector3(6, 0, 0)), ok: S.frostCamp },
      { id: 'peak', name: 'Kuil Aurora (puncak)', pos: FLOC.peak.clone().add(new THREE.Vector3(0, 0, 3)), ok: S.shrineLit },
    ];
  }
  teleport(id, floor = 1) {
    if (this.player.dead) return;
    if (this.activeBoss()) { this.ui.toast('Tidak bisa teleport saat melawan bos'); return; }
    if (this.rift.active) { this.ui.toast('Selesaikan Starlight Rift dulu'); return; }
    if (this.spire.active) { this.ui.toast('Keluar dari Menara Ujian dulu'); return; }
    const w = this.waypoints().find((x) => x.id === id && x.ok);
    if (!w && id !== 'spire') return;
    // only one realm can be active at a time
    if (this.ch4.active && id !== 'void') this.ch4.exit();
    if (this.ch5.active && id !== 'asgard') this.ch5.exit();
    if (this.ch6.active && id !== 'ash') this.ch6.exit();
    if (id === 'rift') { this.ui.toggleMenu(false); this.rift.enter(); return; }
    if (id === 'void') { this.ui.toggleMenu(false); this.ch4.enter(true); return; }
    if (id === 'asgard') { this.ui.toggleMenu(false); this.ch5.enter(true); return; }
    if (id === 'ash') { this.ui.toggleMenu(false); this.ch6.enter(true); return; }
    if (id === 'spire') { this.ui.toggleMenu(false); this.spire.startFloor(floor); return; }
    const P = this.player;
    P.placeAt(w.pos); this.cam.target.copy(P.pos);
    this.vfx.pillar(P.pos, 0x8fe8ff, 8, 0.8); sfx.quest();
    this.ui.toast('Teleport: ' + w.name);
    this.ui.toggleMenu(false);
  }

  _sleepIfNight() {
    if (this.world.nightAmt > 0.3) { this.world.dayT = 0.27; this.ui.toast('…Pagi telah tiba ☀️'); }
  }

  eat(kind) {
    const S = this.state, P = this.player;
    if (!(S.inv[kind] > 0)) { this.ui.toast({ berry: 'Tidak punya berry', fish: 'Tidak punya camilan ikan', grilled: 'Tidak punya Ikan Bakar — masak di api unggun', cool: 'Tidak punya Jus Sejuk — masak di api unggun', soup: 'Tidak punya Sup Pedas — masak di api unggun' }[kind]); return; }
    if (P.action) return;
    S.inv[kind]--;
    if (kind === 'grilled') { P.healAll(0.35); P.hunger = Math.min(100, P.hunger + 55); this.ui.toast('🍢 Ikan Bakar! Seluruh party pulih 35%'); P.startAction('eat', 0.8); sfx.eat(); return; }
    if (kind === 'soup') { P.warmT = 300; P.hunger = Math.min(100, P.hunger + 30); P.healAll(0.1); this.ui.toast('🍲 Sup Pedas! Hangat selama 5 menit', 'gold'); P.startAction('eat', 0.8); sfx.eat(); return; }
    if (kind === 'cool') { P.coolT = 300; P.hunger = Math.min(100, P.hunger + 15); this.ui.toast('🧊 Jus Sejuk! Kebal panas selama 5 menit', 'gold'); P.startAction('eat', 0.8); sfx.eat(); return; }
    if (kind === 'berry') { P.hunger = Math.min(100, P.hunger + 18); P.hp = Math.min(P.maxHp, P.hp + 12); this.ui.damageNumber(P.pos.clone().setY(P.pos.y + 1.8), 12, 'heal'); }
    else { P.hunger = Math.min(100, P.hunger + 50); P.hp = Math.min(P.maxHp, P.hp + 40); this.ui.damageNumber(P.pos.clone().setY(P.pos.y + 1.8), 40, 'heal'); this.ui.toast('Luby: “Nyam! Ikan terbaik!”'); }
    P.startAction('eat', 0.8);
    sfx.eat();
  }

  /** cooking at a campfire */
  nearFire() { const it = this.nearInteract; return (!!it && ['campfire', 'reef_rest', 'volc_rest', 'frost_rest', 'void_rest', 'asgard_rest', 'ash_rest', 'nap'].includes(it.kind)) || this.nearWarm(this.player.pos); }
  cook(recipe) {
    const S = this.state, R = { grilled: { fish: 1, berry: 2, name: '🍢 Ikan Bakar' }, cool: { fish: 1, berry: 3, name: '🧊 Jus Sejuk' }, soup: { fish: 1, berry: 1, pepper: 1, name: '🍲 Sup Pedas' } }[recipe];
    if (!this.nearFire()) { this.ui.toast('Harus di dekat api unggun untuk memasak'); return false; }
    if (S.inv.fish < R.fish || S.inv.berry < R.berry || (S.inv.pepper || 0) < (R.pepper || 0)) { this.ui.toast(`Bahan kurang: perlu ${R.berry} 🫐 + ${R.fish} 🐟` + (R.pepper ? ` + ${R.pepper} 🌶️` : '')); return false; }
    S.inv.fish -= R.fish; S.inv.berry -= R.berry; if (R.pepper) S.inv.pepper -= R.pepper; S.inv[recipe] = (S.inv[recipe] || 0) + 1;
    sfx.pickup(); this.ui.toast(R.name + ' siap! (+1)', 'gold');
    return true;
  }
  setTeam(ids) {
    if (this.activeBoss()) { this.ui.toast('Tidak bisa mengganti party saat melawan bos'); return false; }
    if (this.player.swimming) { this.ui.toast('Tidak bisa mengganti party saat berenang'); return false; }
    if (!this.player.setTeam(ids)) return false;
    this.ui.buildParty(); this.save();
    this.ui.toast('Party diperbarui: ' + this.player.members.map((m) => m.def.name).join(', '));
    return true;
  }

  // ======================================================================
  // story flow
  // ======================================================================
  _advance(step) {
    this.state.step = step;
    this.ui.questFlash();
    sfx.quest();
    const titles = { rebuild: 'Semua onderdil terkumpul!', camp: 'Quest baru: Jejak Ungu', den: 'Jalan sudah bersih! Serbu sarangnya!', free: 'Prolog selesai!' };
    if (titles[step]) this.ui.toast(titles[step], 'gold');
    if (step === 'clear') this.ui.toast('Tip: istirahat di api unggun untuk memulihkan HP & menyimpan', '');
    this.save();
  }

  _checkTriggers() {
    const S = this.state, P = this.player;
    if (this.inputLocked || P.dead) return;
    if (S.step === 'camp' && P.pos.distanceTo(LOC.camp) < 10) {
      this.ui.dialog(SCRIPTS.camp).then(() => { S.spawn = 'camp'; this.joinParty(); this._advance('clear'); });
    }
    if (S.step === 'den' && !this.boss.started && !this.boss.dead && Math.hypot(P.pos.x - LOC.den.x, P.pos.z - LOC.den.z) < 22) {
      const script = S.denIntro ? SCRIPTS.denRetry : SCRIPTS.denIntro;
      this.cam.yaw = Math.atan2(P.pos.x - LOC.den.x, P.pos.z - LOC.den.z);
      this.ui.dialog(script).then(() => {
        S.denIntro = true;
        this.boss.started = true; this.boss.aggro = true; this.boss.state = 'howl'; this.boss.t = 0; this.boss.summonCD = 30;
        sfx.roar(); this.shake(0.6); setMusicMood('boss');
      });
    }
  }

  async _bossDefeated() {
    setMusicMood('normal');
    for (const e of this.enemies) if (e.isAdd && !e.dead) e.die();
    this.state.boss = true;
    this.state.inv.fish += 5;
    this.ui.toast('MENANG! Gumi Wolf · Nine Tails dikalahkan', 'gold big');
    this.ui.toast('+5 🐟 Camilan ikan', 'gold');
    await new Promise((r) => setTimeout(r, 1800));
    await this.ui.dialog(SCRIPTS.victory);
    this.state.bridgeOpen = true;
    this._advance('reef_go');
  }

  joinParty(silent = false) {
    const P = this.player;
    P.addMember('fidelia'); P.addMember('mora');
    for (const m of P.members) { m.level = P.level; m.maxHp = m.calcMaxHp(P.level); if (m.hp > m.maxHp || m.hp === m.calcMaxHp(1)) m.hp = m.maxHp; }
    this.mora.visible = false; this.fidelia.visible = false;
    this.state.party = P.members.map((m) => m.id);
    this.ui.buildParty();
    if (!silent) {
      this.ui.toast('Fidelia & Mora bergabung ke party!', 'gold big');
      this.ui.toast(this.input.touch ? 'Tap potret di kanan untuk ganti hero' : 'Tekan 1 / 2 / 3 untuk ganti hero', '');
      this.ui.toast('Kombinasikan elemen: WATER/LIGHT + WIND = Pusaran, WATER + LIGHT = Prism', '');
    }
  }

  respawn() {
    if (this.rift.active) this.rift.fail();
    if (this.spire.active) this.spire.exit(true);
    const P = this.player, S = this.state;
    P.dead = false; P.healAll(0.6, true); P.hunger = Math.max(P.hunger, 40); P.iframes = 2;
    P.m.rig.root.visible = false; P.active = 0; P.m.rig.root.visible = true; this.ui.onSwitch();
    if (S.spawn === 'asgard') { if (!this.ch5.active) this.ch5.enter(false); } else if (this.ch5.active) this.ch5.exit();
    if (S.spawn === 'void') { if (!this.ch4.active) this.ch4.enter(false); } else if (this.ch4.active) this.ch4.exit();
    if (S.spawn === 'ash') { if (!this.ch6.active) this.ch6.enter(false); } else if (this.ch6.active) this.ch6.exit();
    const sp = S.spawn === 'ash' ? new THREE.Vector3(ASH.camp.x, 0, ASH.camp.z - 6) : S.spawn === 'asgard' ? new THREE.Vector3(ASGARD.plaza.x, ASGARD.plaza.y + 0.5, ASGARD.plaza.z + 14) : S.spawn === 'void' ? new THREE.Vector3(VOIDR.gate.x, 0, VOIDR.gate.z + 6) : S.spawn === 'frost' ? FLOC.village.clone().add(new THREE.Vector3(6, 0, 0)) : S.spawn === 'volc' ? VLOC.outpost.clone().add(new THREE.Vector3(0, 0, 3)) : S.spawn === 'reef' ? RLOC.camp.clone().add(new THREE.Vector3(0, 0, 3)) : S.spawn === 'camp' ? LOC.camp.clone().add(new THREE.Vector3(0, 0, 3)) : new THREE.Vector3(LOC.workshop.x + 1, 0, LOC.workshop.z + 3);
    this.ch1.onRespawn();
    this.ch2.onRespawn();
    this.ch3.onRespawn();
    this.ch4.onRespawn();
    this.ch5.onRespawn();
    this.ch6.onRespawn();
    P.placeAt(sp);
    this.cam.target.copy(P.pos);
    // reset boss fight
    if (this.boss.started && !this.boss.dead) {
      this.boss.started = false; this.boss.hp = this.boss.maxHp; this.boss.pos.copy(LOC.den); this.boss.state = 'idle'; this.boss.enraged = false; this.boss.cancelTele();
      setMusicMood('normal');
    }
    for (const e of this.enemies) if (e.isAdd && !e.dead) { e.dead = true; e.deadT = 1; }
    this.ui.toast('Luby bangun dari tidur siang… 😼');
  }

  // ======================================================================
  // save / load
  // ======================================================================
  save() {
    const P = this.player;
    const sp = this.rift?.active ? this.rift.returnPos : this.ch4?.active ? this.ch4.returnPos : this.ch5?.active ? this.ch5.savePos : this.ch6?.active ? this.ch6.savePos : this.spire?.active ? this.spire.returnPos : P.pos;
    const data = { ...this.state, level: P.level, exp: P.exp, hunger: P.hunger, pos: [sp.x, sp.z], dayT: this.world.dayT,
      hps: Object.fromEntries(P.roster.map((m) => [m.id, m.hp])),
      heroArtifacts: Object.fromEntries(P.roster.map((m) => [m.id, m.artifacts])),
      heroWeapons: Object.fromEntries(P.roster.map((m) => [m.id, m.weapon])),
      active: P.m.id, team: P.members.map((m) => m.id) };
    try { localStorage.setItem(this.SAVE_KEY, JSON.stringify(data)); } catch (e) { /* storage unavailable */ }
  }
  load() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(this.SAVE_KEY)); } catch (e) { d = null; }
    if (!d) return false;
    const P = this.player;
    Object.assign(this.state, this._defaultState(), d);
    P.level = d.level || 1; P.exp = d.exp || 0; P.hunger = d.hunger ?? 100;
    // v0.2 saves finished the prologue at step 'free' — continue with Chapter 1
    if (this.state.step === 'free' && !this.state.reefDone && !this.state.reefCamp) this.state.step = 'reef_go';
    if (this.state.step === 'free' && this.state.reefDone && !this.state.volcDone && !this.state.volcCamp) this.state.step = 'volc_go';
    if (this.state.boss) this.state.bridgeOpen = true;
    if (this.state.reefDone) this.state.causewayOpen = true;
    if (this.state.step === 'free' && this.state.volcDone && !this.state.frostDone && !this.state.frostCamp) this.state.step = 'frost_go';
    if (this.state.volcDone) this.state.floesOpen = true;
    if (this.state.step === 'free' && this.state.frostDone && !this.state.voidDone && !this.state.voidCamp) this.state.step = 'void_go';
    if (this.state.frostDone) this.state.voidOpen = true;
    if (this.state.step === 'free' && this.state.voidDone && !this.state.asgardDone && !this.state.asgardCamp) this.state.step = 'asgard_go';
    if (this.state.voidDone) this.state.asgardOpen = true;
    if (this.state.step === 'free' && this.state.asgardDone && !this.state.ashDone && !this.state.ashCamp) this.state.step = 'ash_go';
    this.state.chestTotal = this.chestTotal;
    this.state.inv = { berry: 0, fish: 0, grilled: 0, cool: 0, soup: 0, pepper: 0, ...this.state.inv };
    if (this.after('clear')) this.joinParty(true);
    this.ch1.onLoad();
    if (this.state.volcCamp) { P.addMember('eropatra'); P.addMember('rumi'); }
    this.ch2.onLoad();
    if (this.state.frostCamp) { P.addMember('valeria'); P.addMember('glytta'); }
    this.ch3.onLoad();
    if (this.state.voidCamp) { P.addMember('gemora'); P.addMember('micca'); }
    this.ch4.onLoad();
    this.ch5.onLoad();
    if (this.state.asgardDone) { P.addMember('commander'); }
    this.ch6.onLoad();
    if (this.state.ashDone) P.addMember('kali');
    if (d.heroArtifacts) {
      for (const m of P.roster) {
        const src = d.heroArtifacts[m.id];
        if (src) for (const k of Object.keys(m.artifacts)) m.artifacts[k] = reviveArtifact(src[k]);
      }
    }
    for (const m of P.roster) m.weapon = d.heroWeapons?.[m.id] ?? null;
    this.state.inventoryArtifacts = (this.state.inventoryArtifacts || []).map(reviveArtifact).filter(Boolean);
    this.state.weapons = (this.state.weapons || []).map((w) => WEAPON_BY_ID[w.id]).filter(Boolean);
    this.bounties.onLoad();
    if (d.team) P.setTeam(d.team);
    for (const m of P.roster) { m.level = P.level; m.maxHp = m.calcMaxHp(P.level); m.hp = Math.max(1, d.hps?.[m.id] ?? d.hp ?? m.maxHp); }
    const ai = P.members.findIndex((m) => m.id === d.active);
    if (ai > 0) P.switchTo(ai, true);
    this.world.dayT = d.dayT ?? 0.3;
    if (d.pos) P.placeAt(new THREE.Vector3(d.pos[0], 0, d.pos[1]));
    if (this.state.purrbot) this.purrbot.setActive(true, P.pos.clone().add(new THREE.Vector3(1.2, 0, 0)));
    for (const it of this.world.interactables) if (it.kind === 'fish' && this.state.crates.includes(it.id)) { it.opened = true; it.group.children[2].visible = false; }
    if (this.state.boss) { this.boss.dead = true; this.boss.remove(); this.enemies = this.enemies.filter((e) => e !== this.boss); }
    return true;
  }
  hasSave() { try { return !!localStorage.getItem(this.SAVE_KEY); } catch (e) { return false; } }

  // ======================================================================
  // start
  // ======================================================================
  async start(fresh) {
    initAudio();
    if (fresh) { try { localStorage.removeItem(this.SAVE_KEY); } catch (e) { /* ignore */ } }
    const loaded = !fresh && this.load();
    $('title').classList.add('hidden');
    $('hud').classList.remove('hidden');
    this.ui.buildParty();
    if (this.input.touch) $('touch').classList.remove('hidden');
    { const p = this.player.pos; const z = zoneOf(p.x, p.y, p.z); if (z) this._enterZone(z, true); }
    this.playing = true;
    this.input.enabled = true;
    this.cam.target.copy(this.player.pos);
    if (!loaded) {
      this.player.placeAt(new THREE.Vector3(LOC.workshop.x - 4, 0, LOC.workshop.z - 3), 0.6);
      this.player.dead = false;
      await this.ui.dialog(SCRIPTS.prologue);
      this.ui.toast(this.input.touch ? 'Joystick untuk bergerak · geser layar untuk kamera' : 'Klik layar untuk mengunci kamera · WASD bergerak', '');
      this.ui.toast('Ikuti penanda kuning ◆ untuk quest', '');
      this.save();
    } else {
      this.inputLocked = false;
      this.ui.toast(this.player.hero.name + ': “' + this.player.hero.voice.greet + '”');
    }
    this.inputLocked = false;
  }

  // ======================================================================
  // loop
  // ======================================================================
  applyGfx(level, user = false) {
    this.gfx = level;
    this._redrawFrozen = true;
    setCullScale(level === 'low' ? 0.75 : 1);
    const P = PRESETS[level];
    this.graphics.apply(level);
    const sun = this.world.sun;
    sun.castShadow = P.shadow > 0;
    if (P.shadow && sun.shadow.mapSize.x !== P.shadow) { sun.shadow.mapSize.set(P.shadow, P.shadow); sun.shadow.map?.dispose(); sun.shadow.map = null; }
    const sc = sun.shadow.camera, ext = P.shadow >= 4096 ? 34 : 28;
    sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.updateProjectionMatrix();
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    sun.shadow.radius = P.shadow >= 2048 ? 2.0 : 1.5;
    this.world.setDetail(level);
    this.world.nearGrass.setDensity(P.grass);
    this.ambient.setDensity(P.life);
    this.lightPool.setSize(P.lights);
    this.world.fogFar = level === 'low' ? 380 : 540;
    this.camera.far = level === 'low' ? 800 : 1500; this.camera.updateProjectionMatrix();
    if (user) { this.gfxAuto = false; try { localStorage.setItem('euphoria_adventure_gfx', level); } catch (e) { /* ignore */ } }
  }

  _autoGfx(rawDt) {
    if (this.gfx === 'low') return;
    this._gfxFrames = (this._gfxFrames || 0) + 1;
    if (this._gfxFrames < 4) return; // first frames include shader compiles
    // a frame this slow makes buttons feel dead (the title screen included): drop to LOW
    // right away, even over a saved manual preset (not persisted, the setting stays as chosen)
    if (rawDt > 0.4) {
      this._slowFrames = (this._slowFrames || 0) + 1;
      if (this._slowFrames >= 3) {
        this._slowFrames = 0; this.fpsAcc = 0; this.fpsFrames = 0;
        this.applyGfx('low');
        if (this.playing) this.ui.toast('Grafis diturunkan ke LOW agar lebih lancar');
        return;
      }
    } else this._slowFrames = 0;
    if (!this.gfxAuto) return;
    this.fpsAcc += rawDt; this.fpsFrames++;
    if (this.fpsAcc >= (this.playing ? 5 : 2)) {
      const fps = this.fpsFrames / this.fpsAcc;
      this.fpsAcc = 0; this.fpsFrames = 0;
      if (fps < 26) {
        const next = PRESET_ORDER[Math.max(0, PRESET_ORDER.indexOf(this.gfx) - 1)];
        this.applyGfx(next);
        if (this.playing) this.ui.toast(`Grafis diturunkan ke ${next.toUpperCase()} agar lebih lancar (${Math.round(fps)} FPS)`);
      }
    }
  }

  hitstop(t) { this.hitstopT = Math.max(this.hitstopT, t); }
  shake(a) { this.cam.shake = Math.max(this.cam.shake, a); }

  _updateCamera(dt) {
    const C = this.cam, P = this.player;
    const look = this.input.takeLook();
    if (this.playing && !this.inputLocked) {
      C.yaw -= look.x * 0.0028;
      C.pitch = Math.min(1.25, Math.max(-0.35, C.pitch + look.y * 0.0022));
      if (this.input.wheel) { C.userDist = Math.min(10, Math.max(2.8, (C.userDist ?? 5.6) + this.input.wheel * 0.6)); C.distTarget = C.userDist; this.input.wheel = 0; }
    }
    if (!this.playing) { C.yaw += dt * 0.12; C.pitch = 0.22; C.distTarget = 4.2; }
    const L = this.combat?.lock;
    if (L && this.playing && !this.inputLocked) {
      // swing the camera behind the hero so the locked target stays in view
      const want = Math.atan2(P.pos.x - L.pos.x, P.pos.z - L.pos.z);
      let d = (want - C.yaw) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2;
      C.yaw += d * (1 - Math.exp(-4 * dt));
    }
    const fov = 55 + (this.combat?.fovKick || 0) + (P.sprinting ? 4 : 0);
    if (Math.abs(this.camera.fov - fov) > 0.05) { this.camera.fov += (fov - this.camera.fov) * (1 - Math.exp(-10 * dt)); this.camera.updateProjectionMatrix(); }
    C.dist = damp(C.dist, C.distTarget, 4, dt);
    const tgt = P.pos.clone(); tgt.y += 1.25;
    if (L && this.playing) tgt.lerp(L.pos.clone().setY(L.pos.y + Math.min(L.tall * 0.5, 3)), L.isBoss ? 0.3 : 0.22);
    C.target.x = damp(C.target.x, tgt.x, 12, dt);
    C.target.z = damp(C.target.z, tgt.z, 12, dt);
    C.target.y = damp(C.target.y, tgt.y, 8, dt);
    const cp = Math.cos(C.pitch);
    const pos = new THREE.Vector3(C.target.x + Math.sin(C.yaw) * cp * C.dist, C.target.y + Math.sin(C.pitch) * C.dist, C.target.z + Math.cos(C.yaw) * cp * C.dist);
    // keep the camera out of tree canopies: pull it in toward Luby when foliage is in the way
    let free = 1;
    for (let i = 3; i <= 10; i++) {
      const f = i / 10;
      if (this.world.canopyHit(C.target.x + (pos.x - C.target.x) * f, C.target.y + (pos.y - C.target.y) * f, C.target.z + (pos.z - C.target.z) * f)) { free = Math.max(0.3, f - 0.12); break; }
    }
    C.occ = damp(C.occ ?? 1, free, free < (C.occ ?? 1) ? 18 : 3, dt);
    pos.sub(C.target).multiplyScalar(C.occ).add(C.target);
    const gh = this.world.groundAt(pos.x, pos.z) + 0.5;
    if (pos.y < gh) pos.y = gh;
    if (pos.y < 0.6) pos.y = 0.6;
    this.camera.position.copy(pos);
    this.camera.lookAt(C.target);
    if (C.shake > 0) {
      C.shake = Math.max(0, C.shake - dt * 1.5);
      const s = C.shake * 0.35;
      this.camera.position.x += (Math.random() - 0.5) * s; this.camera.position.y += (Math.random() - 0.5) * s;
    }
  }

  /** test hook: advance the simulation without rendering (fixed 30 Hz steps) */
  debugStep(seconds) { const n = Math.round(seconds * 30); for (let i = 0; i < n; i++) this._tick(1 / 30); }

  // ---------------- world zones (Ragnarok-style area streaming) ----------------
  _zoneInit() {
    const W = this.world;
    const skip = new Set([W.terrain, W.water, W.sky, W.stars, W.clouds, this.player.root, this.purrbot?.root, this.beacon, this.vfx.points].filter(Boolean));
    this._zoned = zoneSweep(this.scene, skip);
    const p = this.player.pos;
    setActiveZone(zoneOf(p.x, p.y, p.z) || 'glade');
  }

  /** active world zone id (debug / tests) */
  zoneId() { return getActiveZone(); }
  /** debug / tests: turn area streaming off (everything drawn) or back on */
  setZonesEnabled(on) { this._zonesOff = !on; if (on) { const p = this.player.pos; setActiveZone(zoneOf(p.x, p.y, p.z) || 'glade'); } else setActiveZone(null); updateCull(this.camera.position, 0); }

  _updateZone(dt) {
    this._zoneT = (this._zoneT || 0) + dt;
    if (this._zoneT < 0.2 || this._zoneBusy || this._zonesOff) return;
    this._zoneT = 0;
    const p = this.player.pos, z = zoneOf(p.x, p.y, p.z);
    const jumped = this._zoneLast ? this._zoneLast.distanceTo(p) > 20 : false; // teleport / waypoint
    (this._zoneLast ||= p.clone()).copy(p);
    if (!z || z === getActiveZone()) { this._zoneCand = null; return; }
    if (this._zoneCand !== z) { this._zoneCand = z; this._zoneN = 0; }
    // walking: must stay in the new area for ~0.4 s so standing on the border line does not flicker
    if (++this._zoneN >= 2 || jumped) this._enterZone(z);
  }

  /** swap the drawn area behind a short loading fade */
  async _enterZone(z, instant = false) {
    this._zoneBusy = true;
    const el = $('zone-load'), Z = ZONES[z];
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const fade = !instant && this.playing;
    if (fade) {
      $('zone-name').textContent = Z.name; $('zone-sub').textContent = Z.sub;
      el.classList.remove('hidden'); void el.offsetWidth; el.classList.add('show');
      await wait(300);
    }
    setActiveZone(z);
    updateCull(this.camera.position, 0);
    if (fade) {
      // compile anything the new area needs while the screen is covered, then reveal it
      const R = this.renderer, prevRT = R.getRenderTarget();
      R.setRenderTarget(this.graphics.composer?.renderTarget1 ?? null);
      try { await R.compileAsync(this.scene, this.camera); } catch (e) { /* ignore */ } finally { R.setRenderTarget(prevRT); }
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      await wait(250);
      el.classList.remove('show');
      setTimeout(() => { if (!el.classList.contains('show')) el.classList.add('hidden'); }, 450);
    }
    this._zoneBusy = false;
  }

  /** a full-screen UI panel covers the world (menu, wish/artifact/spire/bounty modals, world map, kitchen) */
  _overlayOpen() {
    if (!this._overlays) this._overlays = [$('menu'), ...document.querySelectorAll('.custom-modal')];
    return this._overlays.some((m) => !m.classList.contains('hidden')) || !!this.map?.active || !!this.cooking?.active;
  }

  _loop() {
    requestAnimationFrame(this._loop);
    // phones on the title screen: draw at ~30 FPS so taps on the start button get through quickly
    if (!this.playing && this.input.touch) { this._titleSkip = !this._titleSkip; if (this._titleSkip) return; }
    const raw = this.clock.getDelta();
    const dt = Math.min(raw, 0.05);
    if (this.photo?.active) { this.photo.updateCamera(); this.graphics.render(); return; }
    // behind a menu/modal: freeze the world and keep the last frame on screen instead of re-rendering
    // the whole scene + bloom every frame (that is what made menus lag on phones)
    if (this.paused || (this.playing && this._overlayOpen())) {
      // the canvas keeps showing the last frame; only redraw if it was cleared (resize / graphics change)
      if (this._redrawFrozen) { this._redrawFrozen = false; this.graphics.render(); }
      return;
    }
    this._redrawFrozen = false;
    this._autoGfx(raw);
    if (this.playing) this._updateZone(raw);
    updateCull(this.camera.position, raw);
    this._tick(dt);
    this.graphics.render();
  }

  _tick(dt) {
    const realDt = dt;
    if (this.hitstopT > 0) { this.hitstopT -= dt; dt *= 0.08; }
    if (this.combat.globalSlowT > 0) dt *= this.combat.globalScale;
    this.combat.update(realDt);
    const edt = dt * this.combat.enemyScale;

    this.world.update(dt, this.player.pos);
    this.lightPool.update(dt, this.player.pos);
    this.ambient.update(dt);
    this.ch2.mood(dt);
    this.ch3.mood(dt);
    this.ch4.mood(dt);
    this.ch5.mood(dt);
    this.ch6.mood(dt);
    this.spire.mood();
    this.vfx.update(dt);
    this.weather.update(dt, this.player.pos);
    this.fishing.update(dt);
    this.cooking.update(dt);

    if (this.playing) {
      this.flightRings.update(dt, this.player);
      this.sight.update(dt, this.player.pos);
      this.player.update(dt, this.input, this.cam.yaw);
      this.purrbot.update(dt, this.player, this.world);
      if (!this.inputLocked) {
        for (let i = this.enemies.length - 1; i >= 0; i--) {
          const e = this.enemies[i];
          if (e.realmMob && !this.ch4.active && !this.ch5.active && !this.ch6.active && !this.spire.active && !e.dead) { e.root.visible = false; continue; }
          if (!e.isBoss && !e.dead && (e.pos.x - this.player.pos.x) ** 2 + (e.pos.z - this.player.pos.z) ** 2 > 14400) { e.root.visible = false; e.bar.visible = false; continue; }
          e.root.visible = true;
          // an outline is thinner than a pixel at this range; each one is a draw call
          const olFar = !e.isBoss && (e.pos.x - this.player.pos.x) ** 2 + (e.pos.z - this.player.pos.z) ** 2 > 1600;
          if (e.olFar !== olFar) {
            e.olFar = olFar;
            if (!e.outlines) { e.outlines = []; e.root.traverse((o) => { if (o.userData.isOutline) e.outlines.push(o); }); }
            for (const o of e.outlines) o.visible = !olFar;
          }
          if (e.update(edt)) {
            e.remove(); this.enemies.splice(i, 1);
            if (e.zone) e.zone.alive = e.zone.alive.filter((x) => x !== e);
          }
        }
        // zone respawn
        for (const z of this.zones) {
          if (z.alive.length < z.n) {
            z.respawnT -= dt;
            if (z.respawnT <= 0 && this.player.pos.distanceTo(z.c) > 35) { this._spawnIn(z); z.respawnT = 20; }
          }
        }
        this._updateProjectiles(edt);
        this._updateShots(dt);
        this._updateStorms(dt);
        this._checkTriggers();
        this.ch1.update(dt);
        this.ch2.update(dt);
        this.ch3.update(dt);
        this.ch4.update(dt);
        this.ch5.update(dt);
        this.ch6.update(dt);
        this.spire.update(dt);
        this.rift.update(dt);
      } else {
        for (const e of this.enemies) e.root.position.copy(e.pos);
      }
      this._findInteract();
      const qt = this.questTarget();
      this.beacon.visible = !!qt;
      if (qt) this.beacon.position.set(qt.x, this.world.groundAt(qt.x, qt.z), qt.z);
      this.ui.update(dt);
      this._autosaveT = (this._autosaveT || 0) + dt;
      if (this._autosaveT > 30) { this._autosaveT = 0; if (!this.player.dead) this.save(); }
    } else {
      // title screen: Luby napping in the sunbeam
      this.player.luby.update(dt, { speed: 0, grounded: true });
      this.beacon.visible = false;
    }
    this._updateCamera(dt);
  }
}

// ---------------- boot ----------------
let game = null;
try {
  game = new Game();
  window.__game = game;
} catch (err) {
  console.error(err);
  window.__bootErr?.(err?.message || String(err));
}
if (game) {
  window.__booted = true;
  const startBtn = $('btn-start');
  // Start stays disabled until the Blender models are in and their shaders are compiled: those
  // first seconds freeze the page on phones, and a tap during a freeze feels like a dead button
  const loadEl = $('loading');
  const tickLoad = setInterval(() => { const n = pendingModels(); loadEl.textContent = n ? `Memuat model… (${n} tersisa)` : 'Menyiapkan shader…'; }, 250);
  const ready = () => {
    clearInterval(tickLoad);
    loadEl.textContent = '';
    startBtn.disabled = false;
    startBtn.textContent = game.hasSave() ? 'LANJUTKAN' : 'MULAI PETUALANGAN';
    if (game.hasSave()) $('btn-new').classList.remove('hidden');
  };
  const warm = (async () => {
    await modelsIdle();
    await new Promise((r) => setTimeout(r, 60)); // let upgrade() attach the freshly loaded models
    game._zoneInit();
    // compile for the target the scene is really drawn into (post-processing buffer: linear, no tone
    // mapping) — compiling for the screen would build a different, unused set of programs
    const R = game.renderer, prevRT = R.getRenderTarget();
    R.setRenderTarget(game.graphics.composer?.renderTarget1 ?? null);
    try { await R.compileAsync(game.scene, game.camera); } finally { R.setRenderTarget(prevRT); }
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); // first frames (post-processing)
  })();
  Promise.race([warm, new Promise((r) => setTimeout(r, 30000))]).catch((e) => console.warn('[boot] warm-up', e)).finally(ready);
  // one tap = one start, even if the browser fires both touch and click
  let starting = false;
  const go = (fresh) => (e) => {
    e?.preventDefault?.();
    if (starting || startBtn.disabled) return; // touch events still reach a disabled button
    starting = true;
    // show the press right away, let the browser paint it, then do the heavy start work
    const b = e?.currentTarget || startBtn;
    b.textContent = 'MEMULAI…'; b.classList.add('pressed');
    requestAnimationFrame(() => setTimeout(() => {
      game.start(fresh).catch((err) => { console.error(err); game.ui?.toast?.('Error: ' + (err?.message || err)); });
    }, 0));
  };
  for (const [id, fresh] of [['btn-start', false], ['btn-new', true]]) {
    $(id).addEventListener('click', go(fresh));
    $(id).addEventListener('touchend', go(fresh), { passive: false });
  }
}
