// Open world: "Whispering Woods" island — terrain, water, forests, landmarks, sky & day/night cycle.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toon, part, outlineMaterial , terrainMat } from './toon.js';
import { upgrade, flameLayers, flickerFlames, loadGeometry, scatter } from './assets.js';
import { broadTree, pineTree, plantForest, updateForest, addForestRoots, foliageMat, leafTexture, needleTexture, barkMat, rockGeo, rockMat, grassClump, grassMat, flowerGeo, flowerMat, softDot, bushGeo, weatherProps, collectFarCull, updateFarCull } from './nature.js';

import { fbm, rng, smooth } from './noise.js';
import { VLight } from './lights.js';
import { reefHeight, RLOC, bridgeDeck, buildReef } from './reef.js';
import { volcanoHeight, buildVolcano, VLOC, lavaAt } from './volcano.js';
import { frostHeight, buildFrost, floeAt, FLOC } from './frost.js';
export { fbm, rng };

// ---------------- key locations ----------------
export const LOC = {
  workshop: new THREE.Vector3(0, 0, 0),        // Sunbeam Rock — Luby's nap spot & scrap workshop
  camp: new THREE.Vector3(46, 0, -34),         // Mora & Fidelia's camp
  den: new THREE.Vector3(-52, 0, -96),         // Nine Tails Den (boss)
  parts: [new THREE.Vector3(-62, 0, 24), new THREE.Vector3(30, 0, 66), new THREE.Vector3(84, 0, 10)],
};
const MOUNTAINS = [
  { x: 120, z: -70, h: 48, r: 42 },
  { x: -120, z: 80, h: 32, r: 36 },
  { x: 40, z: 130, h: 24, r: 30 },
];
const ISLAND_R = 205;

function rawHeight(x, z) {
  const d = Math.hypot(x, z) / ISLAND_R;
  let h = 5 + fbm(x * 0.0075, z * 0.0075, 4) * 9 + fbm(x * 0.03, z * 0.03, 2) * 1.2;
  for (const m of MOUNTAINS) {
    const dd = ((x - m.x) ** 2 + (z - m.z) ** 2) / (m.r * m.r);
    h += m.h * Math.exp(-dd * 1.6) * (0.85 + 0.25 * fbm(x * 0.05, z * 0.05, 2));
  }
  const mask = 1 - smooth(0.66, 1.0, d);
  return h * mask - 9 * (1 - mask);
}
const FLATS = [
  { p: LOC.workshop, r: 16, h: 6.5 },
  { p: LOC.camp, r: 15, h: null },
  { p: LOC.den, r: 24, h: null },
];
for (const f of FLATS) if (f.h === null) f.h = Math.max(2.2, rawHeight(f.p.x, f.p.z));

export function heightAt(x, z) {
  return Math.max(mainHeight(x, z), reefHeight(x, z), volcanoHeight(x, z), frostHeight(x, z));
}
function mainHeight(x, z) {
  let h = rawHeight(x, z);
  for (const f of FLATS) {
    const d = Math.hypot(x - f.p.x, z - f.p.z);
    const w = 1 - smooth(f.r * 0.55, f.r, d);
    h = h + (f.h - h) * w;
  }
  return h;
}
for (const p of [LOC.workshop, LOC.camp, LOC.den, ...LOC.parts]) p.y = heightAt(p.x, p.z);

export const WATER_Y = 0;
export const MINIMAP = { N: 440, x0: -640, z0: -640, size: 1240 };

// ---------------- world ----------------
export class World {
  constructor(scene) {
    this.scene = scene;
    this.time = 0;
    this.dayT = 0.3;            // 0..1, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset
    this.DAY_LEN = 480;         // seconds per full day
    this.colliders = [];        // {x,z,r}
    this.grid = new Map();
    this.interactables = [];    // {pos, radius, label, onUse, enabled()}
    this.animated = [];         // objects with update(dt,t)
    this.windUniform = { value: 0 };
    this.forest = [];
    this.outlineMeshes = [];

    this._lights();
    this._sky();
    this._terrain();
    this._water();
    this._vegetation();
    this._landmarks();
    buildReef(this);
    buildVolcano(this);
    buildFrost(this);
    this._clouds();
    weatherProps(this.scene); // heroes and enemies join the scene later, so only the world is touched
    this.nearGrass = new NearGrass(this);
    this.minimapImage = this._minimapImage();
    collectFarCull(this);
  }

  heightAt(x, z) { return heightAt(x, z); }
  /** walkable ground (terrain + standable props like Sunbeam Rock) */
  groundAt(x, z) {
    if (this.realm) return this.realm.groundAt(x, z);
    const A = this.arenaFloor;
    if (A) { if ((x - A.x) ** 2 + (z - A.z) ** 2 < (A.r + 3) ** 2) return A.y; return A.y - 60; }
    let h = heightAt(x, z);
    const r = this.napRock;
    if (r && Math.hypot(x - r.x, z - r.z) < r.r) h = Math.max(h, r.top);
    const deck = bridgeDeck(x, z);
    if (deck !== null) h = Math.max(h, deck);
    if (x < -160 && x > -360) { const fl = floeAt(x, z); if (fl !== null) h = Math.max(h, fl); }
    if (this.ruinsTop && Math.hypot(x - RLOC.ruins.x, z - RLOC.ruins.z) < 2) h = Math.max(h, this.ruinsTop - 0.2);
    return h;
  }

  // ---------- lights ----------
  _lights() {
    const s = this.scene;
    // Ambient / Hemisphere light with lush meadow ground bounce and crisp anime sky zenith
    this.hemi = new THREE.HemisphereLight(0xdcf0ff, 0x6f7f58, 1.6);
    s.add(this.hemi);

    // Dynamic directional sun/moon light with high-resolution soft shadow mapping
    this.sun = new THREE.DirectionalLight(0xfff5e4, 2.45);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -28; sc.right = 28; sc.top = 28; sc.bottom = -28; sc.near = 1; sc.far = 220;
    this.sun.shadow.bias = -0.0003;
    this.sun.shadow.normalBias = 0.022;
    this.sun.shadow.radius = 2.0;
    s.add(this.sun); s.add(this.sun.target);
  }

  _sky() {
    this.skyUniforms = {
      zenith: { value: new THREE.Color(0x185ac2) },
      top: null,
      midSky: { value: new THREE.Color(0x5cb4ff) },
      horizon: { value: new THREE.Color(0xd6efff) },
      sunDir: { value: new THREE.Vector3(0, 1, 0) },
      sunCol: { value: new THREE.Color(0xfff4d0) },
      night: { value: 0 },
      time: { value: 0 },
    };
    this.skyUniforms.top = this.skyUniforms.zenith;

    // Multi-stop stylized anime sky dome (deep azure zenith -> vibrant cerulean -> warm golden-peach horizon)
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, uniforms: this.skyUniforms,
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }`,
      fragmentShader: `uniform vec3 zenith; uniform vec3 midSky; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunCol; uniform float night; uniform float time; varying vec3 vDir;
        void main(){
          float y = max(vDir.y, 0.0);
          // Multi-stop anime celestial gradient
          vec3 c = mix(horizon, midSky, pow(y, 0.45));
          c = mix(c, zenith, pow(y, 1.6));

          // Stylized Sun with anime corona & subtle glare
          vec3 sDir = normalize(sunDir);
          float sd = max(dot(normalize(vDir), sDir), 0.0);
          float sunDisc = smoothstep(0.9993, 0.9998, sd) * 4.5;
          float sunCorona = pow(sd, 42.0) * 0.55 + pow(sd, 10.0) * 0.18;
          c += sunCol * (sunDisc + sunCorona) * (1.0 - night);

          // Stylized Moon with lunar halo
          vec3 mDir = normalize(-sunDir);
          float md = max(dot(normalize(vDir), mDir), 0.0);
          float moonDisc = smoothstep(0.9986, 0.9996, md) * 2.8;
          float moonHalo = pow(md, 36.0) * 0.35 + pow(md, 8.0) * 0.12;
          c += vec3(0.85, 0.92, 1.0) * (moonDisc + moonHalo) * night;

          // Atmospheric ground wrap below horizon
          if (vDir.y < 0.0) {
            c = mix(horizon, horizon * 0.72, min(-vDir.y * 3.5, 1.0));
          }

          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), mat);
    this.sky.renderOrder = -1;
    this.scene.add(this.sky);
    this.scene.fog = new THREE.Fog(0xd6efff, 85, 540);

    // stars with subtle celestial twinkling
    const r = rng(7), pos = [];
    for (let i = 0; i < 1800; i++) {
      const u = r() * 2 - 1, th = r() * Math.PI * 2, y = Math.abs(u);
      const rr = Math.sqrt(1 - y * y);
      pos.push(Math.cos(th) * rr * 850, y * 850, Math.sin(th) * rr * 850);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    this.stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    this.scene.add(this.stars);
  }

  // ---------- terrain ----------
  _terrain() {
    const SIZE = 460, SEG = 230;
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, heightAt(p.getX(i), p.getZ(i)));
    geo.computeVertexNormals();
    const n = geo.attributes.normal;
    const cols = new Float32Array(p.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      groundColor(p.getX(i), p.getY(i), p.getZ(i), n.getY(i), c);
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    this.terrain = new THREE.Mesh(geo, terrainMat());
    this.terrain.receiveShadow = true;
    this.scene.add(this.terrain);
  }

  // ---------- baked height grid (fast lookups for water depth, near-grass, minimap) ----------
  _bakeHeights() {
    const B = this.hgrid = { x0: -640, z0: -640, step: 2, nx: 621, nz: 441 };
    const data = new Float32Array(B.nx * B.nz);
    for (let j = 0; j < B.nz; j++) for (let i = 0; i < B.nx; i++) data[j * B.nx + i] = heightAt(B.x0 + i * B.step, B.z0 + j * B.step);
    B.data = data;
    const half = new Uint16Array(data.length);
    for (let k = 0; k < data.length; k++) half[k] = THREE.DataUtils.toHalfFloat(Math.max(-60, Math.min(60, data[k])));
    const tex = new THREE.DataTexture(half, B.nx, B.nz, THREE.RedFormat, THREE.HalfFloatType);
    tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.needsUpdate = true;
    B.tex = tex;
  }
  /** nearest dry spot to (x,z), spiralling outward */
  findLand(x, z, maxR = 60, minH = 1) {
    for (let r = 0; r <= maxR; r += 2) for (let a = 0; a < 6.28; a += r ? 2 / r + 0.1 : 7) {
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r, h = this.fastHeight(px, pz);
      if (h >= minH && h < 30) return new THREE.Vector3(px, h, pz);
    }
    return null;
  }
  /** nearest shoreline to (x,z): dry ground with water close by; yaw faces the water */
  findShore(x, z, maxR = 90) {
    for (let r = 0; r <= maxR; r += 2) for (let a = 0; a < 6.28; a += r ? 2 / r + 0.1 : 7) {
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r, h = this.fastHeight(px, pz);
      if (h < 0.5 || h > 2.5) continue;
      for (let k = 0; k < 8; k++) {
        const b = (k / 8) * Math.PI * 2, wx = Math.sin(b), wz = Math.cos(b);
        if (this.fastHeight(px + wx * 6, pz + wz * 6) < -0.4 && this.fastHeight(px + wx * 10, pz + wz * 10) < -0.6) return { pos: new THREE.Vector3(px, h, pz), yaw: b };
      }
    }
    return null;
  }
  /** bilinear height from the baked grid (outside → open sea) */
  fastHeight(x, z) {
    const B = this.hgrid;
    const fx = (x - B.x0) / B.step, fz = (z - B.z0) / B.step;
    if (fx < 0 || fz < 0 || fx >= B.nx - 1 || fz >= B.nz - 1) return -9;
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, d = B.data, n = B.nx;
    const a = d[j * n + i], b = d[j * n + i + 1], c = d[(j + 1) * n + i], e = d[(j + 1) * n + i + 1];
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + e * u) * v;
  }

  _water() {
    this._bakeHeights();
    const geo = new THREE.PlaneGeometry(1800, 1800, 1, 1);
    geo.rotateX(-Math.PI / 2);
    const B = this.hgrid;
    this.waterUniforms = {
      uTime: { value: 0 }, uH: { value: B.tex },
      uB: { value: new THREE.Vector4(B.x0, B.z0, (B.nx - 1) * B.step, (B.nz - 1) * B.step) },
      uSun: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(1, 0.95, 0.85) },
      uSkyTop: this.skyUniforms.midSky, uSkyHor: this.skyUniforms.horizon, uNight: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: true,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]),
      vertexShader: `#include <common>
        #include <fog_pars_vertex>
        varying vec3 vW;
        void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `uniform float uTime; uniform sampler2D uH; uniform vec4 uB; uniform vec3 uSun; uniform vec3 uSunCol; uniform vec3 uSkyTop; uniform vec3 uSkyHor; uniform float uNight;
        varying vec3 vW;
        #include <common>
        #include <fog_pars_fragment>
        float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
        float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
        float hgt(vec2 p){ vec2 uv = (p - uB.xy) / uB.zw; if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return -9.0; return texture2D(uH, uv).r; }
        void main(){
          vec2 p = vW.xz; float t = uTime;
          float th = hgt(p);
          float depth = max(0.0, -th);

          // Multi-frequency wave normal for anime water flow
          vec2 g = vec2(cos(p.x * 0.35 + t * 1.3), cos(p.y * 0.30 - t * 1.1)) * 0.09;
          g += vec2(cos((p.x + p.y) * 0.85 + t * 2.1), cos((p.x - p.y) * 0.65 - t * 1.7)) * 0.05;
          float e = 0.15, n0 = vn(p * 0.7 + t * 0.35);
          g += vec2(vn(p * 0.7 + vec2(e, 0.0) + t * 0.35) - n0, vn(p * 0.7 + vec2(0.0, e) + t * 0.35) - n0) * 1.5;
          float m0 = vn(p * 2.2 - t * 0.5);
          g += vec2(vn(p * 2.2 + vec2(e, 0.0) - t * 0.5) - m0, vn(p * 2.2 + vec2(0.0, e) - t * 0.5) - m0) * 0.65;
          vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
          vec3 V = normalize(cameraPosition - vW);
          float fres = pow(1.0 - max(dot(N, V), 0.0), 3.8);

          // Stylized anime depth gradient (crystal turquoise shallows -> vivid cerulean -> deep anime sapphire)
          vec3 crystalAqua = vec3(0.2, 0.72, 0.66);
          vec3 animeCyan = vec3(0.08, 0.43, 0.56);
          vec3 deepSapphire = vec3(0.03, 0.17, 0.33);
          vec3 col = mix(crystalAqua, animeCyan, smoothstep(0.0, 1.6, depth));
          col = mix(col, deepSapphire, smoothstep(1.6, 9.5, depth));

          // Sky Fresnel reflection
          vec3 R = reflect(-V, N);
          vec3 sky = mix(uSkyHor, uSkyTop, clamp(R.y * 1.8, 0.0, 1.0));
          col = mix(col, sky, 0.08 + fres * 0.5);

          // Stylized animated caustics in shallow waters
          // where two drifting noise fields cross they trace the thin web of refracted light
          float ca1 = vn(p * 1.5 + vec2(t * 0.45, -t * 0.32));
          float ca2 = vn(p * 1.5 + 7.3 - vec2(t * 0.38, t * 0.27));
          float web = clamp(1.0 - abs(ca1 - ca2) * 7.0, 0.0, 1.0);
          col += vec3(0.65, 0.95, 0.9) * web * web * web * (1.0 - smoothstep(0.1, 2.6, depth)) * 0.3;

          // Stylized anime diamond specular glints
          float specDot = max(dot(R, normalize(uSun)), 0.0);
          float animeSpec = smoothstep(0.97, 0.995, pow(specDot, 120.0)) * 4.5;
          col += uSunCol * animeSpec * (1.0 - uNight);

          // Stylized dynamic shoreline and intersection foam lines
          float shore = smoothstep(0.9, 0.0, depth) * step(-8.0, th);
          float lace = vn(p * 3.4 + t * 0.3) * 0.65 + vn(p * 9.0 - t * 0.5) * 0.35;
          float bend = vn(p * 0.45 + t * 0.05) * 5.0;
          // waves roll in as thin broken lines, and a lacy rim hugs the sand
          float crest = smoothstep(0.78, 0.97, sin(depth * 8.0 + bend + t * 1.15)) * smoothstep(0.34, 0.6, lace);
          float rim = smoothstep(0.2, 0.02, depth) * smoothstep(0.3, 0.52, lace);
          float foamBand = max(crest * shore, rim) * step(-8.0, th);
          vec3 foamColor = vec3(0.93, 0.97, 0.98);
          col = mix(col, foamColor, clamp(foamBand * 0.88, 0.0, 1.0));

          col *= mix(1.0, 0.32, uNight);
          float alpha = mix(0.46, 0.95, smoothstep(0.0, 2.8, depth));
          alpha = max(alpha, foamBand * 0.9);
          gl_FragColor = vec4(col, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    });
    Object.assign(mat.uniforms, this.waterUniforms);
    this.water = new THREE.Mesh(geo, mat);
    this.water.position.y = WATER_Y;
    this.water.renderOrder = 1;
    this.scene.add(this.water);
  }

  // ---------- vegetation ----------
  _vegetation() {
    const r = rng(1337);
    const avoid = [LOC.workshop, LOC.camp, LOC.den, ...LOC.parts];
    const near = (x, z, rad) => avoid.some((p, i) => Math.hypot(x - p.x, z - p.z) < (i === 2 ? 20 : rad));
    const slopeAt = (x, z) => {
      const e = 1.2;
      return Math.hypot(heightAt(x + e, z) - heightAt(x - e, z), heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
    };

    // --- trees ---
    const broad = [], pines = [];
    for (let i = 0; i < 4200 && broad.length + pines.length < 900; i++) {
      const x = (r() * 2 - 1) * 200, z = (r() * 2 - 1) * 200;
      const h = heightAt(x, z);
      if (h < 1.8 || h > 30 || slopeAt(x, z) > 0.9 || near(x, z, 11)) continue;
      const dens = fbm(x * 0.02, z * 0.02, 3);
      if (dens < -0.05 && r() > 0.12) continue;
      if (segNear(x, z, 3.5)) continue;
      const s = 0.8 + r() * 0.7;
      const pine = h > 14 || fbm(x * 0.01 + 99, z * 0.01, 2) > 0.25;
      (pine ? pines : broad).push({ x, z, y: h, s, rot: r() * Math.PI * 2, tint: r() });
    }
    const addInst = (geo, mat, list, colorFn, ol = 0) => {
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
      list.forEach((t, i) => {
        ps.set(t.x, t.y - 0.2, t.z); q.setFromAxisAngle(UP, t.rot); sc.setScalar(t.s);
        m.compose(ps, q, sc); im.setMatrixAt(i, m);
        if (colorFn) im.setColorAt(i, colorFn(t));
      });
      im.castShadow = true; im.receiveShadow = true;
      this.scene.add(im);
      if (ol) {
        const o = new THREE.InstancedMesh(geo, outlineMaterial(ol, 0x1d2a14), list.length);
        o.instanceMatrix = im.instanceMatrix;
        this.scene.add(o);
        this.outlineMeshes.push(o);
      }
      return im;
    };
    const leafA = new THREE.Color(0x4f8a3a), leafB = new THREE.Color(0x86a84c), leafC = new THREE.Color(0xb5a24e);
    const pineA = new THREE.Color(0x2c5f43), pineB = new THREE.Color(0x4a7a52);
    const bark = barkMat(0x8d6e52), pineBark = barkMat(0x6e5543);
    const leafMat = foliageMat(this.windUniform, leafTexture(), { key: 'broad' });
    const needleMat = foliageMat(this.windUniform, needleTexture(), { key: 'pine', lift: 0.07, sway: 0.6 });
    const broadColor = (t) => leafA.clone().lerp(leafB, t.tint).lerp(leafC, t.tint > 0.86 ? 0.5 : 0);
    const pineColor = (t) => pineA.clone().lerp(pineB, t.tint);
    const splitBy = (list, n) => Array.from({ length: n }, (_, k) => list.filter((_t, i) => i % n === k));
    const broadShapes = [{ height: 5.2, spread: 2.3 }, { height: 6.2, spread: 2.0, blobs: 6 }, { height: 4.6, spread: 2.8, blobs: 9 }];
    plantForest(this, [
      ...splitBy(broad, 3).map((list, k) => ({ list, geo: broadTree(101 + k * 7, broadShapes[k]), trunkMat: bark, leafMat, color: broadColor, roots: 1 })),
      ...splitBy(pines, 2).map((list, k) => ({ list, geo: pineTree(301 + k * 5, { height: 8 + k * 1.4 }), trunkMat: pineBark, leafMat: needleMat, color: pineColor, roots: 0.74 })),
    ]);
    loadGeometry('tree_roots').then((g) => g && addForestRoots(this, g));
    for (const t of broad) { const c = this.addCollider(t.x, t.z, 0.45 * t.s); c.canopy = 3.0 * t.s; c.y0 = t.y + 3.2 * t.s; c.y1 = t.y + 8.4 * t.s; }
    for (const t of pines) { const c = this.addCollider(t.x, t.z, 0.45 * t.s); c.canopy = 2.2 * t.s; c.y0 = t.y + 1.6 * t.s; c.y1 = t.y + 8.4 * t.s; }
    this.trees = [...broad, ...pines];
    for (const t of this.trees) this.addClearing(t.x, t.z, 1.05 * t.s);

    // --- rocks ---
    const rocks = [];
    for (let i = 0; i < 1600 && rocks.length < 260; i++) {
      const x = (r() * 2 - 1) * 200, z = (r() * 2 - 1) * 200;
      const h = heightAt(x, z);
      if (h < 0.6 || near(x, z, 8) || segNear(x, z, 2.5)) continue;
      const s = slopeAt(x, z) > 0.6 || r() < 0.25 ? 0.6 + r() * 2.2 : 0.3 + r() * 0.6;
      rocks.push({ x, z, y: h, s, rot: r() * 6, tint: r() });
    }
    const rA = new THREE.Color(0x8d8a84), rB = new THREE.Color(0xb3ada0), mossy = rockMat({ cover: 0x5f8a3e, amount: 0.75 });
    [0, 1, 2].forEach((k) => {
      const im = addInst(rockGeo(11 + k * 3), mossy, rocks.filter((_t, i) => i % 3 === k), (t) => rA.clone().lerp(rB, t.tint));
      // chiselled Blender boulders replace the noise spheres once loaded
      loadGeometry('rock_' + 'abc'[k]).then((g) => { if (g) { im.geometry = g; im.computeBoundingSphere(); } });
    });
    for (const k of rocks) if (k.s > 1.1) this.addCollider(k.x, k.z, k.s * 0.9);

    // --- forest floor: stumps, fallen logs, mushroom rings (Blender models) ---
    {
      const taken = [];
      const free = (x, z, rad) => !taken.some((p) => Math.hypot(x - p.x, z - p.z) < rad + p.r);
      const treeNear = (x, z, rad) => this.trees.some((t) => Math.abs(t.x - x) < rad && Math.abs(t.z - z) < rad && Math.hypot(t.x - x, t.z - z) < rad);
      const ok = (x, z, clear) => {
        const h = heightAt(x, z);
        return h > 1.8 && h < 30 && slopeAt(x, z) < 0.55 && !near(x, z, 12) && !segNear(x, z, 3.2) && free(x, z, clear);
      };
      const pick = (count, clear, tries, fn) => {
        const out = [];
        for (let i = 0; i < tries && out.length < count; i++) {
          const t = this.trees[Math.floor(r() * this.trees.length)];
          const a = r() * Math.PI * 2, d = 1.4 + r() * 3.2;
          const x = t.x + Math.cos(a) * d, z = t.z + Math.sin(a) * d;
          if (!ok(x, z, clear)) continue;
          const it = fn(x, z);
          if (!it) continue;
          taken.push({ x, z, r: clear }); out.push(it);
        }
        return out;
      };
      const stumps = pick(36, 1.2, 600, (x, z) => (treeNear(x, z, 1.3) ? null : { x, z, y: heightAt(x, z) - 0.08, rot: r() * 6.3, s: 0.8 + r() * 0.5 }));
      const logs = pick(22, 2.2, 900, (x, z) => {
        const rot = r() * Math.PI, dx = Math.cos(rot) * 1.6, dz = -Math.sin(rot) * 1.6;
        if (treeNear(x, z, 1.6) || treeNear(x + dx, z + dz, 1.2) || treeNear(x - dx, z - dz, 1.2)) return null;
        if (segNear(x + dx, z + dz, 3) || segNear(x - dx, z - dz, 3)) return null;
        const h = Math.min(heightAt(x, z), heightAt(x + dx, z + dz), heightAt(x - dx, z - dz));
        if (Math.max(heightAt(x + dx, z + dz), heightAt(x - dx, z - dz)) - h > 0.6) return null;
        return { x, z, y: h - 0.06, rot, s: 0.85 + r() * 0.3 };
      });
      const shrooms = (n) => pick(n, 0.5, n * 12, (x, z) => ({ x, z, y: heightAt(x, z) - 0.02, rot: r() * 6.3, s: 1.3 + r() * 1.0 }));
      const red = shrooms(60), brown = shrooms(90);
      for (const t of stumps) { this.addCollider(t.x, t.z, 0.5 * t.s); this.addClearing(t.x, t.z, 1.1 * t.s); }
      for (const t of logs) for (const k of [-1.4, -0.7, 0, 0.7, 1.4]) this.addClearing(t.x + Math.cos(t.rot) * k * t.s, t.z - Math.sin(t.rot) * k * t.s, 0.75 * t.s);
      for (const t of [...red, ...brown]) this.addClearing(t.x, t.z, 0.42 * t.s);
      for (const t of logs) for (const k of [-1, 0, 1]) this.addCollider(t.x + Math.cos(t.rot) * 1.1 * k * t.s, t.z - Math.sin(t.rot) * 1.1 * k * t.s, 0.45 * t.s);
      scatter(this.scene, 'stump', stumps);
      scatter(this.scene, 'fallen_log', logs);
      scatter(this.scene, 'mushrooms_red', red, { shadow: false });
      scatter(this.scene, 'mushrooms_brown', brown, { shadow: false });
      this.forestFloor = { stumps, logs, red, brown };
    }

    // --- grass clumps with stylized wind wave animation ---
    const grassGeo = grassClump();
    this.grassGeoLow = grassClump(4, 2.1); // phones get fewer, wider blades
    const grassMaterial = grassMat(this.windUniform);
    const grass = [];
    for (let i = 0; i < 40000 && grass.length < 11000; i++) {
      const a = r() * Math.PI * 2, rad = Math.sqrt(r()) * 170;
      const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
      const h = heightAt(x, z);
      if (h < 1.6 || h > 22 || slopeAt(x, z) > 0.7 || segNear(x, z, 1.6) || this.isCleared(x, z)) continue;
      if (fbm(x * 0.05, z * 0.05, 2) < -0.15) continue;
      grass.push({ x, z, y: h + 0.15, s: 0.7 + r() * 0.8, rot: r() * 6 });
    }
    this.grassGeo = grassGeo; this.grassMat = grassMaterial;
    const gc = new THREE.Color();
    const gim = addInst(grassGeo, grassMaterial, grass, (g) => this.grassColor(g.x, g.y, g.z, gc));
    this.grassMesh = gim; this.grassTotal = grass.length;
    gim.userData.noAO = true;
    gim.castShadow = false;
    // --- flowers ---
    const fl = [];
    for (let i = 0; i < 6000 && fl.length < 1800; i++) {
      const x = (r() * 2 - 1) * 170, z = (r() * 2 - 1) * 170;
      const h = heightAt(x, z);
      if (h < 2 || h > 18 || segNear(x, z, 1.5)) continue;
      if (fbm(x * 0.06 + 5, z * 0.06, 2) < 0.15) continue;
      fl.push({ x, z, y: h - 0.05, s: 0.8 + r() * 0.5, rot: r() * 6, tint: r() });
    }
    const fCols = [new THREE.Color(0xf4f0e6), new THREE.Color(0xeccb55), new THREE.Color(0xe486a8), new THREE.Color(0x9a84dc)];
    this.flowerMesh = addInst(flowerGeo(), flowerMat(this.windUniform), fl, (t) => fCols[Math.floor(t.tint * 4)]);
    this.flowerMesh.castShadow = false; this.flowerTotal = fl.length;
  }

  /** ground colour lifted a little toward sunlit green: the blade's tint */
  /** bare-earth discs where grass must not grow (tree bases, logs, stumps, mushrooms) */
  addClearing(x, z, r) {
    this.clearings = this.clearings || new Map();
    const c0x = Math.floor((x - r) / 8), c1x = Math.floor((x + r) / 8), c0z = Math.floor((z - r) / 8), c1z = Math.floor((z + r) / 8);
    for (let cx = c0x; cx <= c1x; cx++) for (let cz = c0z; cz <= c1z; cz++) {
      const k = cx + ',' + cz; (this.clearings.get(k) || this.clearings.set(k, []).get(k)).push(x, z, r);
    }
  }
  isCleared(x, z) {
    const l = this.clearings?.get(Math.floor(x / 8) + ',' + Math.floor(z / 8));
    if (!l) return false;
    for (let i = 0; i < l.length; i += 3) { const dx = x - l[i], dz = z - l[i + 1]; if (dx * dx + dz * dz < l[i + 2] * l[i + 2]) return true; }
    return false;
  }

  grassColor(x, y, z, c) {
    groundColor(x, y, z, 1, c);
    return c.multiplyScalar(1.12);
  }

  addCollider(x, z, r) {
    const c = { x, z, r };
    this.colliders.push(c);
    const k = cellKey(x, z);
    if (!this.grid.has(k)) this.grid.set(k, []);
    this.grid.get(k).push(c);
    return c;
  }

  /** push a position out of static colliders (in place) */
  collide(pos, radius) {
    const cx = Math.floor(pos.x / 8), cz = Math.floor(pos.z / 8);
    for (let i = -1; i <= 1; i++) for (let k = -1; k <= 1; k++) {
      const list = this.grid.get((cx + i) + ',' + (cz + k));
      if (!list) continue;
      for (const c of list) {
        if (c.disabled) continue;
        const dx = pos.x - c.x, dz = pos.z - c.z, d = Math.hypot(dx, dz), m = c.r + radius;
        if (d < m && d > 1e-4) { pos.x = c.x + dx / d * m; pos.z = c.z + dz / d * m; }
      }
    }
  }

  /** is this point inside a tree canopy? (used to keep the camera out of foliage) */
  canopyHit(x, y, z) {
    const cx = Math.floor(x / 8), cz = Math.floor(z / 8);
    for (let i = -1; i <= 1; i++) for (let k = -1; k <= 1; k++) {
      const list = this.grid.get((cx + i) + ',' + (cz + k));
      if (!list) continue;
      for (const c of list) {
        if (!c.canopy) continue;
        if (y < c.y0 - 0.6 || y > c.y1) continue;
        if ((x - c.x) ** 2 + (z - c.z) ** 2 < (c.canopy + 0.3) ** 2) return true;
      }
    }
    return false;
  }

  /** graphics preset: grass/flower density + foliage outlines */
  setDetail(level) {
    const g = { low: 0.25, med: 0.6, high: 1 }[level] ?? 1;
    this.grassMesh.count = Math.floor(this.grassTotal * g);
    this.flowerMesh.count = Math.floor(this.flowerTotal * Math.max(g, 0.4));
    for (const o of this.outlineMeshes) o.visible = level !== 'low';
    this.forestNear = { low: 0, med: 100 }[level] ?? 140;
    const blades = level === 'low' ? this.grassGeoLow : this.grassGeo;
    this.grassMesh.geometry = blades;
    if (this.nearGrass) this.nearGrass.im.geometry = blades;
    this.forestAt = null;
  }

  // ---------- landmarks ----------
  _landmarks() {
    const s = this.scene;
    // ===== Sunbeam Rock (Luby's workshop) =====
    const W = LOC.workshop;
    const rock = part(new THREE.CylinderGeometry(4.2, 5.2, 1.4, 9), toon(0xa7a090, { flatShading: true }), { ol: 0.06 });
    rock.position.set(W.x - 4, W.y + 0.3, W.z - 3); rock.receiveShadow = true; s.add(rock);
    this.napRock = { x: W.x - 4, z: W.z - 3, r: 4.6, top: W.y + 1.0 };
    upgrade('sunbeam_rock', s, rock, (m) => { m.position.set(W.x - 4, W.y, W.z - 3); m.rotation.y = 0.4; }, { outline: 0.05 });
    // workbench
    const bench = new THREE.Group();
    const top = part(new THREE.BoxGeometry(2.2, 0.15, 1.1), toon(0x8a5a36), { ol: 0.03 }); top.position.y = 0.9; bench.add(top);
    for (const [x, z] of [[-1, -0.45], [1, -0.45], [-1, 0.45], [1, 0.45]]) {
      const l = part(new THREE.BoxGeometry(0.12, 0.9, 0.12), toon(0x6b4428), { ol: 0.02 }); l.position.set(x, 0.45, z); bench.add(l);
    }
    const gearMat = toon(0xb9c0c4, { flatShading: true });
    for (let i = 0; i < 3; i++) {
      const g = part(new THREE.TorusGeometry(0.16 + i * 0.05, 0.05, 6, 10), gearMat, { ol: 0.015 });
      g.position.set(-0.6 + i * 0.5, 1.02, 0.1 * i); g.rotation.x = Math.PI / 2; bench.add(g);
    }
    const wrench = part(new THREE.BoxGeometry(0.5, 0.05, 0.08), toon(0xd04040), { ol: 0.01 }); wrench.position.set(0.7, 1.0, -0.2); wrench.rotation.y = 0.6; bench.add(wrench);
    // scrap pile
    for (let i = 0; i < 9; i++) {
      const b = part(new THREE.BoxGeometry(0.3 + Math.random() * 0.4, 0.2 + Math.random() * 0.3, 0.3 + Math.random() * 0.4), toon([0x8d9aa0, 0x6f7b80, 0xc4a35a][i % 3], { flatShading: true }), { ol: 0.015 });
      b.position.set(-1.8 + Math.random() * 0.8, 0.15 + Math.random() * 0.3, -0.6 + Math.random() * 1.2); b.rotation.set(Math.random(), Math.random(), Math.random()); bench.add(b);
    }
    bench.position.set(W.x + 3, W.y, W.z + 1); bench.rotation.y = -0.5;
    s.add(bench);
    this.addCollider(W.x + 3, W.z + 1, 1.2);
    this.bench = bench;
    upgrade('workbench', bench, [...bench.children], () => {}, { outline: 0.02 });
    // the famous sunbeam
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 2.6, 40, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff1a8, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    beam.position.set(W.x - 4, W.y + 20, W.z - 3); beam.rotation.z = 0.18;
    s.add(beam); this.sunbeam = beam;

    // ===== Camp =====
    const Cp = LOC.camp;
    const tent = part(new THREE.ConeGeometry(2.6, 3.0, 4, 1), toon(0xc9b596), { ol: 0.05 });
    tent.position.set(Cp.x - 5, Cp.y + 1.5, Cp.z - 4); tent.rotation.y = Math.PI / 4; s.add(tent);
    this.addCollider(Cp.x - 5, Cp.z - 4, 2.2);
    const flag = part(new THREE.PlaneGeometry(0.9, 0.5), toon(0x8a5cff, { side: THREE.DoubleSide }), { ol: 0 });
    flag.position.set(Cp.x - 5 + 0.45, Cp.y + 3.6, Cp.z - 4); s.add(flag);
    {
      const tx = Cp.x - 5, tz = Cp.z - 4, ry = Math.atan2(-(Cp.z - tz), Cp.x - tx); // door faces the fire
      upgrade('tent', s, [tent, flag], (m) => { m.position.set(tx, Cp.y, tz); m.rotation.y = ry; }, { outline: 0.035 });
      const sx = -0.1, sz = 2.55; // supply stack beside the tent (model space)
      this.addCollider(tx + sx * Math.cos(ry) + sz * Math.sin(ry), tz - sx * Math.sin(ry) + sz * Math.cos(ry), 1.3);
    }
    // campfire
    const fire = new THREE.Group();
    const fireProps = [];
    for (let i = 0; i < 5; i++) {
      const l = part(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 6), toon(0x6b4428), { ol: 0.02 });
      l.rotation.z = Math.PI / 2 - 0.25; l.rotation.y = (i / 5) * Math.PI * 2; l.position.y = 0.15; fire.add(l); fireProps.push(l);
    }
    for (let i = 0; i < 8; i++) {
      const st = part(new THREE.DodecahedronGeometry(0.2, 0), toon(0x8a8378, { flatShading: true }), { ol: 0.02 });
      const a = (i / 8) * Math.PI * 2; st.position.set(Math.cos(a) * 0.8, 0.1, Math.sin(a) * 0.8); fire.add(st); fireProps.push(st);
    }
    const flames = flameLayers(fire);
    const fl = new VLight(0xff9a3a, 0, 14, 1.6); fl.position.y = 1.2; fire.add(fl);
    fire.position.set(Cp.x, Cp.y, Cp.z); s.add(fire);
    upgrade('campfire', fire, fireProps, () => {}, { outline: 0.02 });
    this.campfire = { group: fire, light: fl, pos: new THREE.Vector3(Cp.x, Cp.y, Cp.z) };
    this.animated.push({ update: (dt, t) => {
      flickerFlames(flames, t);
      fl.intensity = (this.nightAmt * 30 + 6) * (0.85 + Math.sin(t * 17) * 0.1);
    } });
    this.addCollider(Cp.x, Cp.z, 0.7);
    for (const [dx, dz] of [[2.4, 1.6], [-2.2, 2.0]]) { // log seats
      const seat = part(new THREE.CylinderGeometry(0.3, 0.3, 1.6, 8), toon(0x7a5235), { ol: 0.02 });
      seat.rotation.z = Math.PI / 2; seat.rotation.y = Math.atan2(dx, dz); seat.position.set(Cp.x + dx, Cp.y + 0.3, Cp.z + dz); s.add(seat);
      upgrade('log_seat', s, seat, (m) => { m.rotation.y = Math.atan2(dx, dz); m.position.set(Cp.x + dx, Cp.y, Cp.z + dz); }, { outline: 0.02 });
    }

    // ===== Nine Tails Den =====
    const D = LOC.den;
    const pill = toon(0x6f6680, { flatShading: true });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const h = 3 + ((i * 7) % 4) * 1.4 - (i % 3 === 0 ? 2.2 : 0);
      const p = part(new THREE.CylinderGeometry(0.7, 0.9, h, 6), pill, { ol: 0.05 });
      p.position.set(D.x + Math.cos(a) * 17, D.y + h / 2 - 0.3, D.z + Math.sin(a) * 17);
      p.rotation.z = (i % 4 === 0 ? 0.25 : 0.04); s.add(p);
      this.addCollider(p.position.x, p.position.z, 0.95);
      // Blender rune menhir: tall stacked stones, or the broken stump for short pillars
      const tall = h >= 3.8, sy = h / (tall ? 6 : 3), sxz = tall ? 1 : Math.min(1.1, Math.max(0.85, Math.sqrt(sy)));
      upgrade(tall ? 'den_pillar' : 'den_pillar_broken', s, p, (m) => {
        m.position.set(p.position.x, D.y - 0.3, p.position.z);
        m.rotation.set(0, i * 1.7, p.rotation.z * 0.6);
        m.scale.set(sxz, Math.max(sy, 0.45), sxz);
      }, { outline: 0.04 });
    }
    const crysMat = new THREE.MeshToonMaterial({ color: 0xb86bff, emissive: 0x7a2fd0, emissiveIntensity: 1.2, gradientMap: null });
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2, rr = 8 + Math.random() * 16;
      const sz = 0.4 + Math.random() * 0.8;
      const c = part(new THREE.OctahedronGeometry(sz, 0), crysMat, { ol: 0.03 });
      c.position.set(D.x + Math.cos(a) * rr, D.y + 0.5, D.z + Math.sin(a) * rr);
      c.scale.y = 2.2; c.rotation.set(Math.random() * 0.5, Math.random() * 3, Math.random() * 0.5); s.add(c);
      const cx = c.position.x, cz = c.position.z, ry = c.rotation.y;
      upgrade('crystal_violet', s, c, (m) => { m.position.set(cx, D.y - 0.05, cz); m.rotation.y = ry; m.scale.setScalar(sz * 1.5); }, { outline: 0.03 });
    }
    const denLight = new VLight(0xb86bff, 40, 40, 1.5); denLight.position.set(D.x, D.y + 4, D.z); s.add(denLight);
    // corruption motes
    const mg = new THREE.BufferGeometry(), mp = [];
    for (let i = 0; i < 260; i++) mp.push(D.x + (Math.random() * 2 - 1) * 28, D.y + Math.random() * 8, D.z + (Math.random() * 2 - 1) * 28);
    mg.setAttribute('position', new THREE.Float32BufferAttribute(mp, 3));
    const motes = new THREE.Points(mg, new THREE.PointsMaterial({ map: softDot(), color: 0xd59bff, size: 0.25, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.add(motes);
    this.animated.push({ update: (dt, t) => { motes.rotation.y = t * 0.05; motes.position.y = Math.sin(t * 0.7) * 0.5; } });

    // ===== berry bushes & fish crates =====
    const r = rng(99);
    const bushLeaf = foliageMat(this.windUniform, leafTexture(), { key: 'bush', lift: 0.12, sway: 0.3 }), berryMat = toon(0xd8264a, { emissive: 0x400010 });
    bushLeaf.color.set(0x5b9440);
    const bushShapes = [bushGeo(5), bushGeo(9), bushGeo(13)];
    let made = 0;
    for (let i = 0; i < 400 && made < 30; i++) {
      const a = r() * Math.PI * 2, rad = 10 + r() * 140;
      const x = Math.cos(a) * rad, z = Math.sin(a) * rad, h = heightAt(x, z);
      if (h < 2 || h > 16) continue;
      if (Math.hypot(x - LOC.den.x, z - LOC.den.z) < 30) continue;
      made++;
      const g = new THREE.Group();
      for (let k = 0; k < 3; k++) {
        const b = new THREE.Mesh(bushShapes[k], bushLeaf); b.castShadow = true;
        b.position.set((k - 1) * 0.45, 0.2, (k % 2) * 0.3); g.add(b);
      }
      const berries = new THREE.Group();
      for (let k = 0; k < 9; k++) {
        const be = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), berryMat);
        const aa = r() * Math.PI * 2;
        be.position.set(Math.cos(aa) * 0.6 + (r() - 0.5) * 0.5, 0.35 + r() * 0.5, Math.sin(aa) * 0.5); berries.add(be);
      }
      g.add(berries);
      g.position.set(x, h, z); s.add(g);
      const item = { pos: g.position, radius: 2.2, label: 'Petik Berry', kind: 'berry', regrowAt: 0, berries };
      item.enabled = () => berries.visible;
      this.interactables.push(item);
    }
    const crateSpots = [[14, 22], [-30, -12], [62, -50], [-80, 40], [100, 60], [-20, 90], [60, 40]];
    for (const [x, z] of crateSpots) {
      const h = Math.max(heightAt(x, z), 0.5);
      const g = new THREE.Group();
      const box = part(new THREE.BoxGeometry(0.9, 0.7, 0.7), toon(0xb07a45), { ol: 0.025 }); box.position.y = 0.35; g.add(box);
      const lid = part(new THREE.BoxGeometry(0.95, 0.08, 0.75), toon(0x8a5a32), { ol: 0.02 }); lid.position.y = 0.72; g.add(lid);
      const fish = part(new THREE.ConeGeometry(0.14, 0.45, 6), toon(0x7fb8e0), { ol: 0.015 }); fish.rotation.z = Math.PI / 2; fish.position.set(0, 0.85, 0); g.add(fish);
      // keep children[0..2] in place (main.js hides children[2] = the fish once looted); just hide the primitives
      upgrade('fish_crate', g, [], () => { box.visible = false; lid.visible = false; }, { outline: 0.02 });
      upgrade('fish_prop', fish, [...fish.children], (m) => { fish.material = fish.material.clone(); fish.material.visible = false; m.rotation.z = -Math.PI / 2; m.position.set(-0.1, 0, 0); }, { outline: 0.012 });
      g.position.set(x, h, z); g.rotation.y = x; s.add(g);
      const item = { pos: g.position, radius: 2.2, label: 'Buka Peti Ikan', kind: 'fish', opened: false, group: g, id: 'crate' + x + '_' + z };
      item.enabled = () => !item.opened;
      this.interactables.push(item);
    }
  }

  _clouds() {
    // Stylized painterly anime clouds with layered billowing puffs
    const tex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const g = c.getContext('2d');
      // Multi-lobed painterly cumulus cloud puff
      const lobes = [
        { x: 128, y: 138, r: 64 },
        { x: 88, y: 148, r: 52 },
        { x: 168, y: 148, r: 52 },
        { x: 110, y: 104, r: 48 },
        { x: 148, y: 108, r: 46 },
        { x: 62, y: 162, r: 38 },
        { x: 194, y: 162, r: 38 },
      ];
      for (const lb of lobes) {
        const gr = g.createRadialGradient(lb.x, lb.y, lb.r * 0.15, lb.x, lb.y, lb.r);
        gr.addColorStop(0, 'rgba(255,255,255,0.78)');
        gr.addColorStop(0.65, 'rgba(255,255,255,0.48)');
        gr.addColorStop(0.95, 'rgba(255,255,255,0.08)');
        gr.addColorStop(1.0, 'rgba(255,255,255,0)');
        g.fillStyle = gr;
        g.beginPath();
        g.arc(lb.x, lb.y, lb.r, 0, Math.PI * 2);
        g.fill();
      }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();

    const r = rng(21);
    this.cloudMat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, color: 0xfffef4 });
    this.cloudShade = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, color: 0xbecae0 });
    this.clouds = new THREE.Group();
    for (let i = 0; i < 46; i++) {
      const c = new THREE.Group();
      const n = 5 + Math.floor(r() * 6), w = 22 + r() * 32;
      for (let k = 0; k < n; k++) {
        const isShade = k % 3 === 0;
        const sp = new THREE.Sprite(isShade ? this.cloudShade : this.cloudMat);
        const sz = 24 + r() * 34;
        sp.scale.set(sz * 1.65, sz * 1.05, 1);
        sp.position.set((r() - 0.5) * w * 2, (isShade ? -5 : 0) + r() * 6, (r() - 0.5) * w);
        c.add(sp);
      }
      c.position.set((r() * 2 - 1) * 650, 115 + r() * 65, (r() * 2 - 1) * 650);
      this.clouds.add(c);
    }
    this.scene.add(this.clouds);
  }

  _minimapImage() {
    const { N, x0, z0, size } = MINIMAP, c = document.createElement('canvas'); c.width = c.height = N;
    const g = c.getContext('2d'), img = g.createImageData(N, N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const wx = x0 + (x / N) * size, wz = z0 + (y / N) * size, h = this.fastHeight(wx, wz);
      let col;
      if (bridgeDeck(wx, wz) !== null) col = [170, 120, 70];
      else if (h < -1.1) col = [40, 120, 180]; else if (h < 0) col = [110, 210, 200]; else if (h < 1.5) col = [236, 222, 170];
      else if (h > 34) col = [235, 240, 250]; else if (h > 22) col = [150, 140, 130];
      else { const v = Math.min(1, h / 22); col = [90 - v * 20, 170 - v * 40, 80 - v * 20]; }
      if (Math.hypot(wx - LOC.den.x, wz - LOC.den.z) < 28 && h > 0) col = [120, 80, 150];
      if (Math.hypot(wx - RLOC.lair.x, wz - RLOC.lair.z) < 23) col = [150, 90, 190];
      if (wx > 300 && h > 1.5 && h < 22) col = [200, 220, 140];
      if (wx < -330 && h > 0.6) { const v = Math.min(1, h / 50); col = [235 - v * 40, 242 - v * 40, 255 - v * 20]; }
      if (Math.hypot(wx - FLOC.lake.x, wz - FLOC.lake.z) < 30) col = [160, 220, 245];
      if (wx < -160 && wx > -360 && floeAt(wx, wz) !== null) col = [235, 245, 255];
      if (wz < -300 && h > 0.6) { const v = Math.min(1, h / 40); col = [70 + v * 60, 58 + v * 40, 60 + v * 30]; }
      if (wz < -300 && lavaAt(wx, wz)) col = [255, 110, 30];
      if (Math.hypot(wx - VLOC.citadel.x, wz - VLOC.citadel.z) < 27 && h > 4) col = [110, 60, 60];
      const i = (y * N + x) * 4; img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  get nightAmt() {
    const sunH = Math.sin((this.dayT - 0.25) * Math.PI * 2);
    return smooth(0.15, -0.2, sunH);
  }
  clockString() {
    const h = (this.dayT * 24 + 0) % 24;
    return String(Math.floor(h)).padStart(2, '0') + ':' + String(Math.floor((h % 1) * 60)).padStart(2, '0');
  }

  update(dt, focus) {
    this.time += dt;
    // fog baseline every frame; regions and weather adjust from here, so nothing sticks after leaving them
    this.scene.fog.near = 85; this.scene.fog.far = this.fogFar ?? 540;
    this.dayT = (this.dayT + dt / this.DAY_LEN) % 1;
    this.windUniform.value = this.time;
    this.waterUniforms.uTime.value = this.time;

    // Dynamic sun/moon orbit
    const ang = (this.dayT - 0.25) * Math.PI * 2;
    const sunDir = new THREE.Vector3(Math.cos(ang) * 0.8, Math.sin(ang), 0.45).normalize();
    const night = this.nightAmt;
    const lightDir = night > 0.5 ? sunDir.clone().negate() : sunDir; // moon light at night
    this.sun.position.copy(focus).addScaledVector(lightDir, 90);
    this.sun.target.position.copy(focus);
    const golden = smooth(0.45, 0.05, Math.abs(Math.sin(ang)));

    // Dynamic HD Anime Lighting Palette
    const daySun = new THREE.Color(0xfff6e6);
    const goldSun = new THREE.Color(0xffad6c);
    const moonSun = new THREE.Color(0x8cb6ff);
    this.sun.color.copy(daySun).lerp(goldSun, golden * (1 - night)).lerp(moonSun, night);
    this.sun.intensity = (2.45 * (1 - night) + 0.75 * night) * (1 - golden * 0.15);

    // Natural Anime Hemisphere Bounce
    const dayHemiSky = new THREE.Color(0xdcf0ff);
    const goldHemiSky = new THREE.Color(0xffd2c0);
    const nightHemiSky = new THREE.Color(0x242e50);
    const dayHemiGnd = new THREE.Color(0x6f7f58);
    const goldHemiGnd = new THREE.Color(0x6e6238);
    const nightHemiGnd = new THREE.Color(0x141a24);

    this.hemi.color.copy(dayHemiSky).lerp(goldHemiSky, golden * (1 - night)).lerp(nightHemiSky, night);
    this.hemi.groundColor.copy(dayHemiGnd).lerp(goldHemiGnd, golden * (1 - night)).lerp(nightHemiGnd, night);
    this.hemi.intensity = 1.6 * (1 - night) + 0.5 * night;

    // Stylized Celestial Skybox
    const su = this.skyUniforms;
    su.sunDir.value.copy(sunDir);
    su.night.value = night;
    su.time.value = this.time;
    su.zenith.value.set(0x185ac2).lerp(new THREE.Color(0x060c22), night);
    su.midSky.value.set(0x5cb4ff).lerp(new THREE.Color(0xff8464), golden * (1 - night)).lerp(new THREE.Color(0x101c3e), night);
    su.horizon.value.set(0xd6efff).lerp(new THREE.Color(0xffaa70), golden * (1 - night)).lerp(new THREE.Color(0x1a264a), night);

    // Volumetric Horizon Fog sync
    this.scene.fog.color.copy(su.horizon.value);
    this.stars.material.opacity = night;
    this.sky.position.copy(focus);
    this.stars.position.copy(focus);
    this.sunbeam.material.opacity = 0.08 * (1 - night);

    this.clouds.children.forEach((c, i) => { c.position.x += dt * (1.5 + (i % 3)); if (c.position.x > 700) c.position.x = -700; });
    const cloudSunlit = new THREE.Color(0xfffef4).lerp(new THREE.Color(0xffd2b4), golden * (1 - night)).lerp(new THREE.Color(0x788aa8), night);
    const cloudShadow = new THREE.Color(0xbecae0).lerp(new THREE.Color(0x7c5d76), golden * (1 - night)).lerp(new THREE.Color(0x1c2438), night);
    this.cloudMat.color.copy(cloudSunlit);
    this.cloudShade.color.copy(cloudShadow);

    this.waterUniforms.uSun.value.copy(lightDir.y > 0 ? sunDir : lightDir);
    this.waterUniforms.uSunCol.value.copy(this.sun.color);
    this.waterUniforms.uNight.value = night;
    if (this.nearGrass) this.nearGrass.update(focus);
    if ((this.farTick = (this.farTick || 0) + 1) % 20 === 0) updateFarCull(this, focus);
    if (!this.forestAt || this.forestAt.distanceToSquared(focus) > 100) { this.forestAt = focus.clone(); updateForest(this, focus); }
    for (const a of this.animated) a.update(dt, this.time);

    // regrow berries
    for (const it of this.interactables) if (it.kind === 'berry' && !it.berries.visible && this.time > it.regrowAt) it.berries.visible = true;
  }
}

// ---------- helpers ----------
const UP = new THREE.Vector3(0, 1, 0);
function cellKey(x, z) { return Math.floor(x / 8) + ',' + Math.floor(z / 8); }
const G_A = new THREE.Color(0x5c9440), G_B = new THREE.Color(0x7fa34f), G_C = new THREE.Color(0x44793a);
const G_SAND = new THREE.Color(0xd8c791), G_ROCK = new THREE.Color(0x7d766b), G_SNOW = new THREE.Color(0xdfe6f0);
const G_CORRUPT = new THREE.Color(0x5e4678), G_PATH = new THREE.Color(0xa8926a), G_UNDER = new THREE.Color(0x6f7a52);
/** main island ground palette; grass reads this too so blades match the soil they grow from */
function groundColor(x, y, z, ny, c) {
  const v = fbm(x * 0.04, z * 0.04, 2) * 0.5 + 0.5;
  c.copy(G_A).lerp(G_B, v);
  c.lerp(G_C, smooth(0.55, 0.85, fbm(x * 0.012 + 40, z * 0.012, 2) * 0.5 + 0.5));
  if (y < 1.9) c.lerp(G_SAND, smooth(1.9, 0.8, y + fbm(x * 0.09, z * 0.09, 2) * 0.5));
  if (y < -0.5) c.copy(G_UNDER);
  if (ny < 0.8) c.lerp(G_ROCK, smooth(0.8, 0.62, ny));
  if (y > 24) c.lerp(G_ROCK, smooth(24, 30, y));
  if (y > 36) c.lerp(G_SNOW, smooth(36, 42, y));
  const dd = Math.hypot(x - LOC.den.x, z - LOC.den.z);
  if (dd < 34) c.lerp(G_CORRUPT, smooth(34, 16, dd) * 0.85);
  const pd = Math.min(
    segDist(x, z, LOC.workshop, LOC.camp), segDist(x, z, LOC.camp, LOC.den),
    segDist(x, z, LOC.workshop, LOC.parts[0]), segDist(x, z, LOC.workshop, LOC.parts[1]), segDist(x, z, LOC.camp, LOC.parts[2]));
  const wob = fbm(x * 0.1, z * 0.1, 2) * 0.8;
  if (pd < 2.2 + wob && y > 1.2) c.lerp(G_PATH, smooth(2.2 + wob, 1.0, pd) * 0.85);
  return c;
}

function sphereAt(r, x, y, z) { const g = new THREE.IcosahedronGeometry(r, 1); g.translate(x, y, z); return g; }
function coneAt(r, h, y) { const g = new THREE.ConeGeometry(r, h, 8); g.translate(0, y, 0); return g; }
function segDist(x, z, a, b) {
  const abx = b.x - a.x, abz = b.z - a.z, t = Math.max(0, Math.min(1, ((x - a.x) * abx + (z - a.z) * abz) / (abx * abx + abz * abz)));
  return Math.hypot(x - (a.x + abx * t), z - (a.z + abz * t));
}
function segNear(x, z, d) {
  return segDist(x, z, LOC.workshop, LOC.camp) < d || segDist(x, z, LOC.camp, LOC.den) < d ||
    segDist(x, z, LOC.workshop, LOC.parts[0]) < d || segDist(x, z, LOC.workshop, LOC.parts[1]) < d || segDist(x, z, LOC.camp, LOC.parts[2]) < d;
}

/** Dense grass carpet that follows the player (cells are generated once and cached). */
class NearGrass {
  constructor(world) {
    this.w = world;
    this.MAX = 26000;
    this.im = new THREE.InstancedMesh(world.grassGeo, world.grassMat, this.MAX);
    this.im.count = 0; this.im.frustumCulled = false; this.im.receiveShadow = true;
    this.im.userData.noAO = true;
    this.im.setColorAt(0, new THREE.Color(1, 1, 1));
    this.tint = new THREE.Color();
    world.scene.add(this.im);
    this.cells = new Map();
    this.center = null;
    this.density = 1;
    this.R = 36;
  }
  setDensity(k) { this.density = k; this.cells.clear(); this.center = null; this.im.visible = k > 0; }
  _cell(cx, cz) {
    const key = cx + ',' + cz;
    let list = this.cells.get(key);
    if (list) return list;
    list = [];
    const n = Math.round(290 * this.density);
    let seed = (cx * 73856093) ^ (cz * 19349663);
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const W = this.w;
    for (let k = 0; k < n; k++) {
      const x = cx * 8 + rnd() * 8, z = cz * 8 + rnd() * 8;
      if (x * x + z * z > 188 * 188) continue;
      const h = W.fastHeight(x, z);
      if (h < 1.7 || h > 21) continue;
      const sl = Math.abs(W.fastHeight(x + 1.5, z) - h) + Math.abs(W.fastHeight(x, z + 1.5) - h);
      if (sl > 1.1) continue;
      if (segNear(x, z, 1.7) || W.isCleared(x, z)) continue;
      if (Math.hypot(x - LOC.den.x, z - LOC.den.z) < 30) continue;
      if (W.napRock && Math.hypot(x - W.napRock.x, z - W.napRock.z) < W.napRock.r) continue;
      W.grassColor(x, h, z, this.tint);
      list.push([x, h + 0.02, z, rnd() * 6.28, 0.8 + rnd() * 0.7, this.tint.r, this.tint.g, this.tint.b]);
    }
    this.cells.set(key, list);
    if (this.cells.size > 900) this.cells.delete(this.cells.keys().next().value);
    return list;
  }
  update(focus) {
    if (this.density <= 0) return;
    if (this.center && Math.hypot(focus.x - this.center.x, focus.z - this.center.z) < 6) return;
    this.center = focus.clone();
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const R = this.R, c0x = Math.floor((focus.x - R) / 8), c1x = Math.floor((focus.x + R) / 8), c0z = Math.floor((focus.z - R) / 8), c1z = Math.floor((focus.z + R) / 8);
    let n = 0;
    for (let cx = c0x; cx <= c1x; cx++) for (let cz = c0z; cz <= c1z; cz++) {
      for (const g of this._cell(cx, cz)) {
        if (n >= this.MAX) break;
        const dx = g[0] - focus.x, dz = g[2] - focus.z;
        if (dx * dx + dz * dz > R * R) continue;
        // blades shrink into the ground at the edge, so the carpet has no visible rim
        const fade = Math.min(1, (R - Math.sqrt(dx * dx + dz * dz)) / 9);
        ps.set(g[0], g[1], g[2]); q.setFromAxisAngle(up, g[3]); sc.set(g[4], g[4] * (0.9 + (g[3] % 0.4)) * fade, g[4]);
        m.compose(ps, q, sc); this.im.setMatrixAt(n, m);
        this.im.setColorAt(n++, this.tint.setRGB(g[5], g[6], g[7]));
      }
    }
    this.im.count = n;
    this.im.instanceMatrix.needsUpdate = true;
    if (this.im.instanceColor) this.im.instanceColor.needsUpdate = true;
  }
}
