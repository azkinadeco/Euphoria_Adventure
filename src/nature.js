// Euphoria Adventure — shared nature kit.
// Every region builds its ground, trees, rocks and grass from here, so textures,
// lighting response and wind stay consistent across the whole world.
// All textures are generated at load time: nothing is downloaded.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// ---------- tiling noise ----------
function makeTileNoise(seed, period) {
  const r = rng(seed), g = new Float32Array(period * period);
  for (let i = 0; i < g.length; i++) g[i] = r();
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const m = (n) => ((n % period) + period) % period;
    const a = g[m(yi) * period + m(xi)], b = g[m(yi) * period + m(xi + 1)];
    const c = g[m(yi + 1) * period + m(xi)], d = g[m(yi + 1) * period + m(xi + 1)];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}
function tileFbm(seed, base, oct, size) {
  const layers = [];
  for (let o = 0; o < oct; o++) layers.push({ n: makeTileNoise(seed + o * 17, base << o), f: (base << o) / size, a: 1 / (1 << o) });
  const total = layers.reduce((s, l) => s + l.a, 0);
  return (x, y) => { let v = 0; for (const l of layers) v += l.n(x * l.f, y * l.f) * l.a; return v / total; };
}

let _detail = null;
/** one tiling texture, one surface per channel: R grass, G soil, B rock, A sand/snow */
export function detailTexture() {
  if (_detail) return _detail;
  const S = 256, data = new Uint8Array(S * S * 4);
  const grass = tileFbm(11, 32, 3, S), soil = tileFbm(23, 16, 4, S), rock = tileFbm(37, 8, 5, S), crack = tileFbm(41, 8, 3, S), ripple = tileFbm(53, 8, 3, S);
  const b = (v) => Math.max(0, Math.min(255, v * 255));
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4;
    data[i] = b((grass(x, y) - 0.5) * 2.4 + 0.5);
    data[i + 1] = b((soil(x, y) - 0.5) * 2.2 + 0.5);
    const c = 1 - Math.min(1, Math.abs(crack(x, y) - 0.5) * 16);
    data[i + 2] = b((rock(x, y) - 0.5) * 2.2 + 0.55 - c * 0.45);
    data[i + 3] = b((ripple(x, y) - 0.5) * 2 + 0.5);
  }
  const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.anisotropy = 4; t.needsUpdate = true;
  return (_detail = t);
}

// ---------- painted cut-out textures ----------
function paint(size, draw, h = size) {
  const c = document.createElement('canvas'); c.width = size; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  draw(g, size, h);
  const img = g.getImageData(0, 0, size, h), d = img.data;
  // transparent pixels take the average colour, otherwise mipmaps grow dark halos
  let r = 0, gr = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) { r += d[i]; gr += d[i + 1]; b += d[i + 2]; n++; }
  n = Math.max(1, n); r /= n; gr /= n; b /= n;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] < 16) { d[i] = r; d[i + 1] = gr; d[i + 2] = b; }
  const t = new THREE.DataTexture(new Uint8Array(d.buffer.slice(0)), size, h, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.anisotropy = 4; t.needsUpdate = true;
  return t;
}
const memo = {};
const once = (k, f) => (memo[k] ||= f());

function leaf(g, x, y, l, w, a, shade) {
  g.save(); g.translate(x, y); g.rotate(a);
  g.fillStyle = `rgb(${shade * 0.86 | 0},${shade | 0},${shade * 0.74 | 0})`;
  g.beginPath(); g.moveTo(0, -l); g.quadraticCurveTo(w, 0, 0, l); g.quadraticCurveTo(-w, 0, 0, -l); g.fill();
  g.restore();
}
/** cluster of broad leaves; neutral colour so each tree's tint shows through */
export const leafTexture = () => once('leaf', () => paint(256, (g, S) => {
  const r = rng(7);
  for (let pass = 0; pass < 3; pass++) {
    const n = [46, 54, 40][pass], shade = [135, 195, 245][pass], R = S * [0.46, 0.42, 0.36][pass];
    for (let i = 0; i < n; i++) {
      const a = r() * 6.283, d = Math.sqrt(r()) * R;
      leaf(g, S / 2 + Math.cos(a) * d, S / 2 + Math.sin(a) * d, 13 + r() * 11, 6 + r() * 4, a + (r() - 0.5) * 1.6, shade * (0.88 + r() * 0.24));
    }
  }
}));
/** conifer bough: base at v=0, tip at v=1 */
export const needleTexture = () => once('needle', () => paint(256, (g, W, H) => {
  const r = rng(19);
  g.lineCap = 'round'; g.scale(2, 2); W /= 2; H /= 2;
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < 340; i++) {
    const t = r(), half = (1 - t) * 0.42 * W + 4, x0 = W / 2 + (r() - 0.5) * 2 * half * 0.72, y0 = t * H * 0.97;
    const shade = (pass ? 225 : 140) * (0.85 + r() * 0.3), side = x0 < W / 2 ? -1 : 1;
    g.strokeStyle = `rgb(${shade * 0.8 | 0},${shade | 0},${shade * 0.82 | 0})`;
    g.lineWidth = 1.1 + r() * 1.1;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + side * (7 + r() * 9), y0 + 9 + r() * 12); g.stroke();
  }
  g.strokeStyle = 'rgb(120,105,90)'; g.lineWidth = 4;
  g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W / 2, H * 0.9); g.stroke();
}, 512));
/** palm frond: rib along v with leaflets to both sides */
export const frondTexture = () => once('frond', () => paint(128, (g, W, H) => {
  const r = rng(29);
  for (let i = 0; i < 70; i++) {
    const t = i / 70, y = t * H, l = Math.sin(Math.min(1, t * 1.25 + 0.12) * Math.PI) * W * 0.47 + 5, shade = 195 + r() * 55;
    g.strokeStyle = `rgb(${shade * 0.86 | 0},${shade | 0},${shade * 0.68 | 0})`; g.lineWidth = 3;
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(W / 2, y); g.quadraticCurveTo(W / 2 + s * l * 0.6, y + 4, W / 2 + s * l, y + 16); g.stroke(); }
  }
  g.strokeStyle = 'rgb(170,175,110)'; g.lineWidth = 3; g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W / 2, H); g.stroke();
}, 256));
export const flowerTexture = () => once('flower', () => paint(64, (g, S) => {
  g.translate(S / 2, S / 2);
  for (let k = 0; k < 6; k++) { g.rotate(1.047); g.fillStyle = k % 2 ? '#fff' : '#eee'; g.beginPath(); g.ellipse(0, -15, 8, 14, 0, 0, 6.3); g.fill(); }
  g.fillStyle = '#d8a92e'; g.beginPath(); g.arc(0, 0, 7, 0, 6.3); g.fill();
}));
const barkTexture = () => once('bark', () => {
  const S = 128, data = new Uint8Array(S * S * 4), n = tileFbm(61, 4, 3, S), v = tileFbm(67, 4, 3, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const k = 196 + (n(x * 4, y) - 0.5) * 260 + (v(x * 2, y) - 0.5) * 60, i = (y * S + x) * 4, c = Math.max(70, Math.min(255, k));
    data[i] = data[i + 1] = data[i + 2] = c; data[i + 3] = 255;
  }
  const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; // a brightness mask, so it stays linear
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
  return t;
});
/** soft round particle; PointsMaterial draws hard squares without one */
export const softDot = () => once('dot', () => {
  const S = 64, data = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const d = Math.hypot(x + 0.5 - S / 2, y + 0.5 - S / 2) / (S / 2), i = (y * S + x) * 4, a = Math.max(0, 1 - d);
    data[i] = data[i + 1] = data[i + 2] = 255; data[i + 3] = Math.min(255, a * a * (3 - 2 * a) * 330);
  }
  const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
  return t;
});

// ---------- materials ----------
/** ground for every region: vertex colours pick the palette, the shader adds surface detail */
export function terrainMat() {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  const tex = detailTexture();
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uDetail = { value: tex };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTW;\nvarying float vUp;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vTW = (modelMatrix * vec4(transformed, 1.0)).xyz; vUp = normal.y;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uDetail;\nvarying vec3 vTW;\nvarying float vUp;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 base = diffuseColor.rgb;
        vec2 p = vTW.xz;
        vec4 d1 = texture2D(uDetail, p * 0.21);
        vec4 d1b = texture2D(uDetail, p * 0.21 + vec2(0.0035, 0.0035));
        vec4 d2 = texture2D(uDetail, p * 0.047 + 0.37);
        vec4 d3 = texture2D(uDetail, p * 0.0097 + 0.71);
        vec4 d0 = texture2D(uDetail, p * 0.93 + 0.13);
        float lo = min(base.r, min(base.g, base.b));
        float wGreen = clamp((base.g - max(base.r * 0.95, base.b)) * 9.0, 0.0, 1.0);
        float wSnow = smoothstep(0.42, 0.68, lo);
        float wSand = clamp((base.r - base.b) * 4.0, 0.0, 1.0) * (1.0 - wGreen) * smoothstep(0.16, 0.34, base.r);
        float wRock = 1.0 - smoothstep(0.58, 0.76, vUp + (d2.b - 0.5) * 0.3 + wGreen * 0.06);
        // height of each surface, used for both tone and fake relief
        float hG = d1.r * 0.65 + d2.r * 0.35, hS = d1.g * 0.6 + d2.g * 0.4, hD = d1.a * 0.7 + d2.a * 0.3;
        float hG2 = d1b.r * 0.65 + d2.r * 0.35, hS2 = d1b.g * 0.6 + d2.g * 0.4, hD2 = d1b.a * 0.7 + d2.a * 0.3;
        float tone = mix(0.72 + 0.56 * hS, 0.66 + 0.68 * hG, wGreen);
        tone = mix(tone, 0.86 + 0.28 * hD, max(wSand, wSnow));
        float relief = mix(hS - hS2, hG - hG2, wGreen);
        relief = mix(relief, hD - hD2, max(wSand, wSnow) * 0.6);
        tone *= mix(0.8 + 0.4 * d0.g, 0.74 + 0.52 * d0.r, wGreen);
        vec3 ground = base * tone * (1.0 + relief * 1.4);
        // sand darkens where the tide reaches
        ground *= mix(1.0, 0.7, (1.0 - smoothstep(0.1, 0.85 + d2.a * 0.5, vTW.y)) * wSand);
        // broad meadow variation: dry warm patches and cooler damp ones
        ground *= mix(vec3(1.0), mix(vec3(1.14, 1.03, 0.72), vec3(0.82, 0.98, 0.92), smoothstep(0.34, 0.68, d3.r)), wGreen);
        // real meadows sit nearer olive than pure green
        ground = mix(ground, vec3(dot(ground, vec3(0.3, 0.6, 0.1))) * vec3(0.95, 1.02, 0.76), 0.26 * wGreen);
        if (wRock > 0.01) {
          vec4 cl = texture2D(uDetail, vec2(p.x + p.y, vTW.y * 2.6) * 0.085);
          vec4 cl2 = texture2D(uDetail, vec2(p.x - p.y, vTW.y * 1.4) * 0.31);
          vec3 stone = mix(base, vec3(dot(base, vec3(0.34))) * vec3(1.02, 0.98, 0.93) + 0.03, 0.55 * (1.0 - wSnow)) * (0.42 + 0.8 * cl.b * (0.6 + 0.8 * cl2.b)) * (0.76 + 0.48 * d0.b);
          ground = mix(ground, stone, wRock);
        }
        diffuseColor.rgb = ground;`);
  };
  m.customProgramCacheKey = () => 'natureTerrainV3';
  return m;
}

function normalsFromAttribute(sh) {
  // faked crown normals must survive double-sided rendering
  sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', 'vec3 normal = normalize(vNormal); vec3 nonPerturbedNormal = normal;');
}
/** cut-out foliage with wind and optional snow on upward faces */
export function foliageMat(wind, tex, { snow = 0, lift = 0.1, key = 'a', sway = 1 } = {}) {
  const m = new THREE.MeshLambertMaterial({ map: tex, vertexColors: true, alphaTest: 0.42, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uWind = wind;
    normalsFromAttribute(sh);
    sh.vertexShader = 'uniform float uWind;\nvarying float vUp;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vUp = normal.y;
      #ifdef USE_INSTANCING
        vec4 tp = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      #else
        vec4 tp = vec4(0.0);
      #endif
      float bend = sin(uWind * 1.1 + tp.x * 0.11 + tp.z * 0.13) * 0.6 + sin(uWind * 2.3 + tp.x * 0.27) * 0.3;
      float flut = sin(uWind * 5.1 + position.x * 2.3 + position.z * 2.9 + position.y * 1.7);
      float hgt = position.y * 0.012 * ${sway.toFixed(2)};
      transformed.x += bend * hgt * position.y * 0.5 + flut * 0.03;
      transformed.z += bend * hgt * position.y * 0.3 + flut * 0.03;
      transformed.y += flut * 0.02;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vUp;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        ${snow > 0 ? `diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.9, 0.96), smoothstep(0.05, 0.6, vUp) * smoothstep(0.3, 0.62, sampledDiffuseColor.g) * ${snow.toFixed(2)});` : ''}`)
      .replace('#include <opaque_fragment>', `outgoingLight += diffuseColor.rgb * ${lift.toFixed(2)};
        #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => `natureLeaf_${key}_${snow}_${lift}_${sway}`;
  return m;
}
export function barkMat(color = 0x8a6a4e) {
  const t = barkTexture().clone(); t.repeat.set(2, 2); t.needsUpdate = true;
  return new THREE.MeshLambertMaterial({ color, map: t, vertexColors: true });
}
/** boulders: rock detail, with moss or snow gathering on top when asked */
export function rockMat({ cover = null, amount = 0.7 } = {}) {
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const tex = detailTexture(), col = new THREE.Color(cover ?? 0xffffff);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uDetail = { value: tex }; sh.uniforms.uCover = { value: col };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vP;\nvarying float vUp;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvP = position; vUp = normal.y;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uDetail;\nuniform vec3 uCover;\nvarying vec3 vP;\nvarying float vUp;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float a = texture2D(uDetail, vP.xz * 0.45 + vP.y * 0.13).b, b = texture2D(uDetail, vP.xy * 0.9 + 0.3).b;
        diffuseColor.rgb *= 0.55 + 0.95 * a * (0.6 + 0.8 * b);
        ${cover === null ? '' : `float cv = smoothstep(0.35, 0.8, vUp + (b - 0.5) * 0.7) * ${amount.toFixed(2)};
        diffuseColor.rgb = mix(diffuseColor.rgb, uCover * (0.7 + 0.6 * a), cv);`}`);
  };
  m.customProgramCacheKey = () => `natureRock_${cover}_${amount}`;
  return m;
}
/** grass shares the ground's normal and colour, so it melts into the terrain */
export function grassMat(wind) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uWind = wind;
    normalsFromAttribute(sh);
    sh.vertexShader = 'uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 ip = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      float gust = sin(uWind * 0.8 + (ip.x + ip.z) * 0.06) * 0.5 + 0.5;
      float w = sin(uWind * 2.1 + ip.x * 0.23 + ip.z * 0.17) + sin(uWind * 3.6 + ip.x * 0.5 - ip.z * 0.34) * 0.4;
      float k = position.y * position.y * (0.25 + gust * 0.55);
      transformed.x += w * k * 0.5 + gust * k * 0.35;
      transformed.z += w * k * 0.28;`);
  };
  m.customProgramCacheKey = () => 'natureGrass';
  return m;
}

/**
 * Gives built props (wood, stone, cloth, metal) the same weathered surface as the
 * landscape, so nothing reads as a flat-painted block. Runs on toon materials of a
 * finished group; glowing, see-through and face materials stay clean.
 */
export function weatherProps(root, amount = 1) {
  const tex = detailTexture();
  root.traverse((o) => {
    if (!o.isMesh || o.userData.isOutline) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m.isMeshToonMaterial || m.userData.weathered || m.transparent || m.userData.isFace) continue;
      if (m.emissive && m.emissive.r + m.emissive.g + m.emissive.b > 0.02) continue;
      m.userData.weathered = true;
      const compile = m.onBeforeCompile, key = m.customProgramCacheKey();
      m.onBeforeCompile = (sh, r) => {
        compile(sh, r);
        sh.uniforms.uDetail = { value: tex };
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vPropP;\nvarying vec3 vPropN;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPropP = (modelMatrix * vec4(position, 0.0)).xyz; vPropN = mat3(modelMatrix) * normal;');
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform sampler2D uDetail;\nvarying vec3 vPropP;\nvarying vec3 vPropN;')
          .replace('#include <color_fragment>', `#include <color_fragment>
            vec3 pw = pow(abs(normalize(vPropN)), vec3(4.0)); pw /= pw.x + pw.y + pw.z;
            vec4 pd = texture2D(uDetail, vPropP.zy * 0.55) * pw.x + texture2D(uDetail, vPropP.xz * 0.55) * pw.y + texture2D(uDetail, vPropP.xy * 0.55) * pw.z;
            diffuseColor.rgb *= ${(1 - 0.28 * amount).toFixed(3)} + ${(0.56 * amount).toFixed(3)} * (pd.b * 0.6 + pd.g * 0.4);`);
      };
      m.customProgramCacheKey = () => key + ':weathered' + amount;
      m.needsUpdate = true;
    }
  });
}

// ---------- geometry ----------
export function grassClump(blades = 9, thick = 1) {
  const r = rng(91), pos = [], col = [], idx = [];
  const seg = 2;
  for (let b = 0; b < blades; b++) {
    const a = r() * 6.283, base = pos.length / 3, ox = (r() - 0.5) * 0.46, oz = (r() - 0.5) * 0.46;
    const h = 0.34 + r() * 0.36, wdt = (0.022 + r() * 0.016) * thick, lean = 0.12 + r() * 0.26, warm = r(), dx = Math.cos(a), dz = Math.sin(a), sx = -dz, sz = dx;
    for (let i = 0; i <= seg; i++) {
      const t = i / seg, w = wdt * (1 - t * t), bx = ox + dx * lean * t * t, bz = oz + dz * lean * t * t, y = h * t, shade = 0.5 + t * 0.72;
      pos.push(bx - sx * w, y, bz - sz * w, bx + sx * w, y, bz + sz * w);
      const cr = shade * (0.9 + warm * 0.26), cb = shade * (1.26 - warm * 0.34);
      col.push(cr, shade, cb, cr, shade, cb);
      if (i < seg) { const k = base + i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const n = new Float32Array(pos.length); for (let i = 1; i < n.length; i += 3) n[i] = 1;
  g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  g.setIndex(idx);
  return g;
}
export function flowerGeo() {
  const quads = [0, 1.05, 2.1].map((a) => { const q = new THREE.PlaneGeometry(0.3, 0.3); q.rotateX(-1.1); q.rotateY(a); q.translate(0, 0.34, 0); return q; });
  const g = mergeGeometries(quads);
  const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  const c = new Float32Array(n.count * 3).fill(1); g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}
export function flowerMat(wind) { return foliageMat(wind, flowerTexture(), { key: 'flower', lift: 0.16 }); }

/** a boulder: chipped planes then noise, nothing like a dice */
export function rockGeo(seed = 1, squash = 0.72) {
  const r = rng(seed);
  let g = new THREE.IcosahedronGeometry(1, 3); g.deleteAttribute('uv'); g.deleteAttribute('normal');
  g = mergeVertices(g, 1e-3);
  const planes = [];
  for (let i = 0; i < 9; i++) { const v = new THREE.Vector3(r() - 0.5, r() - 0.35, r() - 0.5).normalize(); planes.push({ v, d: 0.62 + r() * 0.3 }); }
  const p = g.attributes.position, t = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    t.fromBufferAttribute(p, i);
    for (const { v, d } of planes) { const k = t.dot(v); if (k > d) t.addScaledVector(v, -(k - d) * 0.9); }
    t.multiplyScalar(1 + Math.sin(t.x * 5.1 + seed) * Math.sin(t.y * 4.3) * Math.sin(t.z * 4.7) * 0.07);
    p.setXYZ(i, t.x, t.y * squash, t.z * 1.08);
  }
  g.computeVertexNormals();
  return g;
}

function tube(points, radii, sides = 7, vScale = 0.5) {
  const pos = [], nor = [], uv = [], col = [], idx = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), dir = new THREE.Vector3();
  let len = 0;
  points.forEach((pt, i) => {
    dir.subVectors(points[Math.min(i + 1, points.length - 1)], points[Math.max(i - 1, 0)]).normalize();
    // carry the previous frame along the curve, so the tube never twists
    if (i === 0) a.set(Math.abs(dir.x) < 0.9 ? 1 : 0, 0, Math.abs(dir.x) < 0.9 ? 0 : 1);
    a.addScaledVector(dir, -a.dot(dir)).normalize(); b.crossVectors(dir, a);
    if (i) len += pt.distanceTo(points[i - 1]);
    for (let s = 0; s <= sides; s++) {
      const th = (s / sides) * Math.PI * 2, nx = a.x * Math.cos(th) + b.x * Math.sin(th), ny = a.y * Math.cos(th) + b.y * Math.sin(th), nz = a.z * Math.cos(th) + b.z * Math.sin(th);
      pos.push(pt.x + nx * radii[i], pt.y + ny * radii[i], pt.z + nz * radii[i]); nor.push(nx, ny, nz);
      uv.push(s / sides, len * vScale);
      const ao = 0.6 + Math.min(1, pt.y / 2.5) * 0.45; col.push(ao, ao, ao);
    }
  });
  const row = sides + 1;
  for (let i = 0; i < points.length - 1; i++) for (let s = 0; s < sides; s++) { const k = i * row + s; idx.push(k, k + row, k + 1, k + 1, k + row, k + row + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

class Cards {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.col = []; this.idx = []; }
  /** c = centre, right/up = half extents; shade(corner) gives [normal, brightness] */
  quad(c, right, up, shade) {
    const k = this.pos.length / 3, v = new THREE.Vector3();
    [[-1, -1, 0, 0], [1, -1, 1, 0], [1, 1, 1, 1], [-1, 1, 0, 1]].forEach(([sx, sy, u, w]) => {
      v.copy(c).addScaledVector(right, sx).addScaledVector(up, sy);
      const [n, l] = shade(v);
      this.pos.push(v.x, v.y, v.z); this.nor.push(n.x, n.y, n.z); this.uv.push(u, w); this.col.push(l, l, l);
    });
    this.idx.push(k, k + 1, k + 2, k, k + 2, k + 3);
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    return g;
  }
}
const randDir = (r) => { const a = r() * 6.283, y = r() * 2 - 1, s = Math.sqrt(1 - y * y); return new THREE.Vector3(Math.cos(a) * s, y, Math.sin(a) * s); };

/** broadleaf tree: bent trunk, real branches, leaf clusters with a rounded crown normal */
export function broadTree(seed, { height = 5.2, spread = 2.3, blobs = 7 } = {}) {
  const r = rng(seed), top = new THREE.Vector3((r() - 0.5) * 0.7, height, (r() - 0.5) * 0.7);
  const trunkPts = [0, 0.3, 0.62, 1].map((t) => new THREE.Vector3(top.x * t * t + Math.sin(t * 4 + seed) * 0.08, height * t, top.z * t * t));
  const parts = [tube(trunkPts, [0.46, 0.3, 0.24, 0.13])];
  const list = [{ c: new THREE.Vector3(top.x, height + spread * 0.5, top.z), r: spread * 0.72 }];
  for (let i = 0; i < blobs; i++) {
    const a = (i / blobs) * 6.283 + r() * 0.6, d = spread * (0.55 + r() * 0.45);
    const c = new THREE.Vector3(top.x + Math.cos(a) * d, height + (r() - 0.35) * spread * 0.8, top.z + Math.sin(a) * d);
    list.push({ c, r: spread * (0.46 + r() * 0.22) });
    const from = trunkPts[2].clone().lerp(trunkPts[3], r()), mid = from.clone().lerp(c, 0.55); mid.y += 0.25;
    parts.push(tube([from, mid, c.clone().lerp(mid, 0.2)], [0.13, 0.08, 0.03], 5));
  }
  const crown = new THREE.Vector3(top.x, height + spread * 0.1, top.z), reach = spread * 1.5;
  const make = (cards, size) => {
    const C = new Cards(), nv = new THREE.Vector3();
    const shade = (v) => {
      nv.subVectors(v, crown).normalize();
      const hgt = (v.y - (crown.y - reach * 0.5)) / reach, out = v.distanceTo(crown) / reach;
      return [nv.clone().lerp(new THREE.Vector3(0, 1, 0), 0.28).normalize(), Math.max(0.42, Math.min(1.2, 0.46 + hgt * 0.56 + out * 0.2))];
    };
    for (let i = 0; i < cards; i++) {
      const b = list[i % list.length], d = randDir(r); if (d.y < -0.35) d.y *= -0.3;
      d.normalize();
      const c = b.c.clone().addScaledVector(d, b.r * (0.45 + r() * 0.55));
      const n = d.clone().add(randDir(r).multiplyScalar(0.75)).normalize();
      const right = new THREE.Vector3().crossVectors(n, randDir(r)).normalize().multiplyScalar(size * (0.8 + r() * 0.4));
      const up = new THREE.Vector3().crossVectors(n, right).normalize().multiplyScalar(size * (0.8 + r() * 0.4));
      C.quad(c, right, up, shade);
    }
    return C.build();
  };
  return { trunk: mergeGeometries(parts), trunkFar: tube(trunkPts, [0.46, 0.3, 0.24, 0.13], 4), near: make(110, 0.98), far: make(22, 2.0) };
}

/** low shrub: leaf cards on a dome, with a soft dark core so it reads solid */
export function bushGeo(seed = 5, radius = 0.72) {
  const r = rng(seed), C = new Cards(), core = new THREE.Vector3(0, radius * 0.2, 0), nv = new THREE.Vector3();
  const shade = (v) => { nv.subVectors(v, core).normalize(); return [nv.clone(), Math.max(0.45, Math.min(1.2, 0.62 + (v.y / radius) * 0.5))]; };
  for (let i = 0; i < 40; i++) {
    const d = randDir(r); d.y = Math.abs(d.y) * 0.85 + 0.05; d.normalize();
    const c = core.clone().addScaledVector(d, radius * (0.5 + r() * 0.5));
    const n = d.clone().add(randDir(r).multiplyScalar(0.7)).normalize();
    const right = new THREE.Vector3().crossVectors(n, randDir(r)).normalize().multiplyScalar(radius * (0.55 + r() * 0.25));
    const up = new THREE.Vector3().crossVectors(n, right).normalize().multiplyScalar(radius * (0.55 + r() * 0.25));
    C.quad(c, right, up, shade);
  }
  return C.build();
}

/** conifer built from drooping boughs */
export function pineTree(seed, { height = 8.4, radius = 2.7 } = {}) {
  const r = rng(seed);
  const pts = [0, 0.3, 0.7, 1].map((t) => new THREE.Vector3(Math.sin(t * 3 + seed) * 0.05, height * t, 0));
  const trunk = tube(pts, [0.34, 0.24, 0.12, 0.02], 6);
  const make = (levels, per, wide) => {
    const C = new Cards(), up = new THREE.Vector3(0, 1, 0);
    for (let l = 0; l < levels; l++) {
      const t = l / (levels - 1), y = height * (0.2 + t * 0.78), R = radius * Math.pow(1 - t, 0.85) + 0.32, n = Math.max(3, Math.round(per * (1 - t * 0.5)));
      for (let k = 0; k < n; k++) {
        const a = (k / n) * 6.283 + l * 1.1 + r() * 0.5, out = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
        const dir = out.clone().multiplyScalar(R).setY(-R * (0.34 + r() * 0.26)), half = dir.clone().multiplyScalar(0.5);
        const c = new THREE.Vector3(0, y, 0).add(half);
        const side = new THREE.Vector3().crossVectors(dir, up).normalize().multiplyScalar(wide * (0.42 + R * 0.2));
        const lit = 0.5 + t * 0.32;
        const shade = (v) => { const e = Math.min(1, Math.hypot(v.x, v.z) / (R + 0.01)); return [new THREE.Vector3(v.x, R * 0.6, v.z).normalize(), lit + e * 0.42]; };
        C.quad(c, side, half, shade);
        C.quad(c, new THREE.Vector3().crossVectors(dir, side).normalize().multiplyScalar(wide * 0.3), half, shade);
      }
    }
    return C.build();
  };
  return { trunk, near: make(11, 7, 1), far: make(5, 4, 1.9) };
}

/** leaning palm trunk with ring-like swellings; `top` is where the crown sits */
export function palmTrunk(top) {
  const pts = [], radii = [], N = 14;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    pts.push(new THREE.Vector3(top.x * t * t, top.y * t, top.z * t * t));
    radii.push((0.27 - t * 0.14 + Math.pow(1 - t, 5) * 0.14) * (i % 2 ? 0.93 : 1.02));
  }
  return tube(pts, radii, 7, 0.9);
}

/** palm crown as bent strips; top = where the trunk ends */
export function palmFronds(top, count = 11) {
  const r = rng(31), pos = [], nor = [], uv = [], col = [], idx = [];
  for (let k = 0; k < count; k++) {
    const a = (k / count) * 6.283 + r() * 0.3, dx = Math.cos(a), dz = Math.sin(a), L = 3.1 + r() * 0.7, w = 0.62, base = pos.length / 3, rise = 0.5 + r() * 0.55;
    const S = 6;
    for (let i = 0; i <= S; i++) {
      const t = i / S, d = L * t, y = top.y + rise * d * 0.62 - d * d * 0.2, ww = w * Math.sin(Math.min(1, t * 1.15 + 0.14) * Math.PI) + 0.04;
      const x = top.x + dx * d, z = top.z + dz * d, l = 0.7 + t * 0.42;
      pos.push(x + dz * ww, y - ww * 0.3, z - dx * ww, x - dz * ww, y - ww * 0.3, z + dx * ww);
      nor.push(dx * 0.3, 0.95, dz * 0.3, dx * 0.3, 0.95, dz * 0.3);
      uv.push(0, t, 1, t); col.push(l, l, l, l, l, l);
      if (i < S) { const q = base + i * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

// ---------- planting ----------
/**
 * Plants instanced trees split into map chunks, so off-screen chunks are culled
 * and distant chunks switch to the light foliage.
 * kinds: [{ list, geo: {trunk, near, far}, trunkMat, leafMat, color(t) }]
 */
export function plantForest(world, kinds, chunk = 128) {
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
  for (const k of kinds) {
    const cells = new Map();
    for (const t of k.list) { const key = Math.floor(t.x / chunk) + ',' + Math.floor(t.z / chunk); (cells.get(key) || cells.set(key, []).get(key)).push(t); }
    for (const list of cells.values()) {
      const mk = (geo, mat, tint) => {
        const im = new THREE.InstancedMesh(geo, mat, list.length);
        list.forEach((t, i) => {
          ps.set(t.x, t.y - 0.1, t.z); e.set(t.rx || 0, t.rot || 0, t.rz || 0); q.setFromEuler(e);
          sc.set(t.s, t.s * (t.sy || 1), t.s); m.compose(ps, q, sc); im.setMatrixAt(i, m);
          if (tint) im.setColorAt(i, k.color(t));
        });
        im.computeBoundingSphere();
        im.castShadow = true; im.receiveShadow = true;
        world.scene.add(im);
        return im;
      };
      const cx = list.reduce((s, t) => s + t.x, 0) / list.length, cz = list.reduce((s, t) => s + t.z, 0) / list.length;
      const trunk = mk(k.geo.trunk, k.trunkMat, false), trunkFar = k.geo.trunkFar ? mk(k.geo.trunkFar, k.trunkMat, false) : null;
      const near = mk(k.geo.near, k.leafMat, true), far = mk(k.geo.far, k.leafMat, true);
      near.visible = false;
      if (trunkFar) trunk.visible = false;
      world.forest.push({ x: cx, z: cz, near, far, trunk, trunkFar, list, kind: k });
    }
    // the sun's shadow map only reaches the area around the player, so a soft
    // pool of shade keeps far trees sitting on the ground
    const pool = new THREE.PlaneGeometry(1, 1); pool.rotateX(-Math.PI / 2);
    const shade = new THREE.MeshBasicMaterial({ map: softDot(), color: k.shadeColor ?? 0x14241a, transparent: true, opacity: 0.34, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    shade.userData.noGlow = true;
    const im = new THREE.InstancedMesh(pool, shade, k.list.length);
    k.list.forEach((t, i) => {
      const d = (k.shadeSize ?? 7.5) * t.s;
      ps.set(t.x, t.y + 0.06, t.z); q.identity(); sc.set(d, 1, d); m.compose(ps, q, sc); im.setMatrixAt(i, m);
    });
    im.computeBoundingSphere();
    world.scene.add(im);
  }
}
/** switch chunks between detailed and light foliage around the player */
export function updateForest(world, focus) {
  const d = world.forestNear ?? 120;
  for (const c of world.forest) {
    const n = Math.hypot(c.x - focus.x, c.z - focus.z) < d;
    c.near.visible = n; c.far.visible = !n;
    if (c.trunkFar) { c.trunk.visible = n; c.trunkFar.visible = !n; }
    if (c.roots) c.roots.visible = n;
  }
}

/**
 * Root flares (a Blender model) under every tree of the kinds that ask for them
 * (`kind.roots` = scale of the shared geometry). Only drawn in near chunks.
 */
export function addForestRoots(world, geo) {
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
  const scaled = new Map();
  for (const c of world.forest) {
    const k = c.kind; if (!k?.roots || !c.list) continue;
    if (!scaled.has(k.roots)) scaled.set(k.roots, k.roots === 1 ? geo : geo.clone().scale(k.roots, k.roots, k.roots));
    const im = new THREE.InstancedMesh(scaled.get(k.roots), k.trunkMat, c.list.length);
    c.list.forEach((t, i) => {
      ps.set(t.x, t.y - 0.1, t.z); e.set(0, t.rot || 0, 0); q.setFromEuler(e);
      sc.setScalar(t.s); m.compose(ps, q, sc); im.setMatrixAt(i, m);
    });
    im.computeBoundingSphere();
    im.castShadow = true; im.receiveShadow = true;
    im.visible = c.near.visible;
    world.scene.add(im);
    c.roots = im;
  }
}

/**
 * Anything wholly behind the fog cannot be seen, so it should cost nothing.
 * Layers are used instead of `visible`, which game logic and forest LOD already own.
 */
export function collectFarCull(world) {
  const list = [], v = new THREE.Vector3();
  world.scene.updateMatrixWorld(true);
  world.scene.traverse((o) => {
    if (!o.isMesh || !o.frustumCulled || o.renderOrder < 0) return;
    let bs;
    if (o.isInstancedMesh) { if (!o.boundingSphere) o.computeBoundingSphere(); bs = o.boundingSphere; }
    else { if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); bs = o.geometry.boundingSphere; }
    const r = bs.radius * o.matrixWorld.getMaxScaleOnAxis();
    if (r > 240) return; // terrain and water always stay
    v.copy(bs.center).applyMatrix4(o.matrixWorld);
    list.push({ o, x: v.x, y: v.y, z: v.z, r, on: true });
  });
  world.farList = list;
}
export function updateFarCull(world, eye) {
  const fog = world.scene.fog; if (!fog) return;
  const far = fog.far * 1.04 + 12;
  for (const e of world.farList) {
    // outlines fall below a pixel long before the object itself, and pebbles soon after
    const lim = e.o.userData.isOutline ? Math.min(far, 70) : e.r < 2 ? Math.min(far, 170) : far;
    const on = Math.hypot(e.x - eye.x, e.y - eye.y, e.z - eye.z) - e.r < lim;
    if (on !== e.on) { e.on = on; e.o.layers.set(on ? 0 : 1); }
  }
}
