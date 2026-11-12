// Euphoria Adventure — High-Definition Anime Cel-Shading & Stylized Toon Shaders.
// Stylized anime cel-shading:
// - Multi-tone cel-shading with warm subsurface terminator & cool lavender shadow tinting
// - Stylized Fresnel rim lighting with backlight bias
// - Custom anime specular highlights (angel ring for hair, metallic glints for armor/weapons)
// - Subsurface Scattering (SSS) transmission glow for skin and translucent hair tips
// - Face-flattering lighting mode to eliminate harsh polygonal shadow artifacts on faces
// - View-space distance-compensated anime ink outlines with depth biasing
// - Multi-layered painterly terrain shader with geological cliff banding
import * as THREE from 'three';

let _grad = null;

/**
 * High-definition 256-step anime ramp texture.
 * Implements multi-tone shading:
 * 1. Deep shadow: cool lavender/indigo tint to avoid muddy blacks
 * 2. Mid shadow: soft stylized shadow tone
 * 3. Terminator step: warm subsurface peach/amber feathering
 * 4. Mid lit: crisp anime base tone
 * 5. Highlight: bright anime sunlight
 */
export function gradientMap() {
  if (_grad) return _grad;
  const width = 256;
  const data = new Uint8Array(width * 4);

  for (let i = 0; i < width; i++) {
    const t = i / (width - 1);
    let r, g, b;

    if (t < 0.38) {
      // Deep shadow -> mid shadow (cool anime lavender-indigo tint)
      const f = t / 0.38;
      r = THREE.MathUtils.lerp(105, 142, f);
      g = THREE.MathUtils.lerp(110, 146, f);
      b = THREE.MathUtils.lerp(138, 172, f);
    } else if (t < 0.44) {
      // Warm subsurface terminator step
      const f = (t - 0.38) / 0.06;
      r = THREE.MathUtils.lerp(142, 222, f);
      g = THREE.MathUtils.lerp(146, 204, f);
      b = THREE.MathUtils.lerp(172, 192, f);
    } else if (t < 0.82) {
      // Mid lit anime tone (clean, vibrant)
      const f = (t - 0.44) / 0.38;
      r = THREE.MathUtils.lerp(222, 246, f);
      g = THREE.MathUtils.lerp(204, 246, f);
      b = THREE.MathUtils.lerp(192, 248, f);
    } else {
      // Full highlight
      const f = (t - 0.82) / 0.18;
      r = THREE.MathUtils.lerp(246, 255, f);
      g = THREE.MathUtils.lerp(246, 255, f);
      b = THREE.MathUtils.lerp(248, 255, f);
    }

    const idx = i * 4;
    data[idx] = Math.round(r);
    data[idx + 1] = Math.round(g);
    data[idx + 2] = Math.round(b);
    data[idx + 3] = 255;
  }

  _grad = new THREE.DataTexture(data, width, 1, THREE.RGBAFormat);
  _grad.minFilter = THREE.LinearFilter;
  _grad.magFilter = THREE.LinearFilter;
  _grad.generateMipmaps = false;
  _grad.needsUpdate = true;
  return _grad;
}

/**
 * Creates an HD anime cel-shaded material with:
 * - Multi-tone cel gradient ramp
 * - Stylized Fresnel rim lighting with backlight bias
 * - Stylized specular highlights (for glossy hair & metallic surfaces)
 * - Subsurface Scattering (SSS) transmission glow
 * - Face-flattering shading option
 * - Subtle cool shadow tinting to prevent muddy blacks
 */
export function toon(color, opts = {}) {
  const {
    rimColor = 0xffffff,
    rimStrength = 0.38,
    rimPower = 2.8,
    specColor = 0xffffff,
    specStrength = opts.shininess ? 0.65 : 0.0,
    specPower = opts.shininess ? opts.shininess * 2 : 48.0,
    specThreshold = 0.72,
    sssColor = 0xffa080,
    sssStrength = 0.0,
    isFace = false,
    ...rest
  } = opts;
  delete rest.flatShading; // toon materials have no flat mode; the option only reaches the cache key

  const mat = new THREE.MeshToonMaterial({
    color,
    gradientMap: gradientMap(),
    ...rest,
  });

  mat.userData.rimColor = new THREE.Color(rimColor);
  mat.userData.rimStrength = rimStrength;
  mat.userData.rimPower = rimPower;
  mat.userData.specColor = new THREE.Color(specColor);
  mat.userData.specStrength = specStrength;
  mat.userData.specPower = specPower;
  mat.userData.specThreshold = specThreshold;
  mat.userData.sssColor = new THREE.Color(sssColor);
  mat.userData.sssStrength = sssStrength;
  mat.userData.isFace = isFace;

  const origCompile = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    if (origCompile) origCompile(shader, renderer);

    shader.uniforms.uRimCol = { value: mat.userData.rimColor };
    shader.uniforms.uRimStr = { value: mat.userData.rimStrength };
    shader.uniforms.uRimPow = { value: mat.userData.rimPower };
    shader.uniforms.uSpecCol = { value: mat.userData.specColor };
    shader.uniforms.uSpecStr = { value: mat.userData.specStrength };
    shader.uniforms.uSpecPow = { value: mat.userData.specPower };
    shader.uniforms.uSpecThresh = { value: mat.userData.specThreshold };
    shader.uniforms.uSssCol = { value: mat.userData.sssColor };
    shader.uniforms.uSssStr = { value: mat.userData.sssStrength };
    shader.uniforms.uIsFace = { value: mat.userData.isFace ? 1.0 : 0.0 };

    shader.fragmentShader = `
      uniform vec3 uRimCol;
      uniform float uRimStr;
      uniform float uRimPow;
      uniform vec3 uSpecCol;
      uniform float uSpecStr;
      uniform float uSpecPow;
      uniform float uSpecThresh;
      uniform vec3 uSssCol;
      uniform float uSssStr;
      uniform float uIsFace;
    ` + shader.fragmentShader;

    // Inject custom anime shading chunks before opaque_fragment
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `
      vec3 viewDir = normalize(vViewPosition);
      vec3 lightViewDir = normalize(vec3(0.35, 0.85, 0.4));
      #if ( NUM_DIR_LIGHTS > 0 )
        lightViewDir = normalize((viewMatrix * vec4(directionalLights[0].direction, 0.0)).xyz);
      #endif

      // --- Face-Flattering Shading ---
      // Flattens harsh triangular polygon shadow steps across the face plane
      if (uIsFace > 0.5) {
        float faceLight = clamp(dot(vec3(0.0, 0.0, 1.0), lightViewDir) * 0.5 + 0.5, 0.0, 1.0);
        outgoingLight = mix(outgoingLight, diffuseColor.rgb * (0.85 + 0.25 * faceLight), 0.65);
      }

      // --- Anime Cel Specular Highlight (Angel Ring & Metal Glints) ---
      if (uSpecStr > 0.0) {
        vec3 halfDir = normalize(lightViewDir + viewDir);
        float NdotH = max(dot(normalize(normal), halfDir), 0.0);
        float specHighlight = smoothstep(uSpecThresh - 0.04, uSpecThresh + 0.04, pow(NdotH, uSpecPow));
        outgoingLight += uSpecCol * specHighlight * uSpecStr;
      }

      // --- Anime Rim Lighting (Fresnel with back-light emphasis) ---
      if (uRimStr > 0.0) {
        vec3 viewNorm = normalize(normal);
        float rimF = pow(1.0 - clamp(dot(viewNorm, viewDir), 0.0, 1.0), uRimPow);
        // Boost rim on silhouettes oriented opposite to main light
        float backLight = clamp(dot(-lightViewDir, viewDir), 0.0, 1.0) * 0.45 + 0.55;
        float rimMask = smoothstep(0.28, 0.78, rimF);
        outgoingLight += uRimCol * (rimMask * backLight) * uRimStr;
      }

      // --- Subsurface Scattering (SSS) Transmission Glow ---
      if (uSssStr > 0.0) {
        float sssDot = max(dot(-lightViewDir, viewDir), 0.0);
        outgoingLight += uSssCol * pow(sssDot, 3.2) * uSssStr;
      }

      // --- Stylized Shadow Tint (cool ambient bounce in crevices) ---
      vec3 coolShadowTint = vec3(0.045, 0.05, 0.08);
      outgoingLight = max(outgoingLight, diffuseColor.rgb * coolShadowTint);

      #include <opaque_fragment>
      `
    );
  };

  const origKey = mat.customProgramCacheKey ? mat.customProgramCacheKey.bind(mat) : () => '';
  mat.customProgramCacheKey = () => origKey() + ':hdAnimeCel:' + (opts.flatShading ? 'flat:' : 'smooth:') + specStrength + ':' + (isFace ? 'face' : 'body');

  return mat;
}

/** Specialized anime hair material with crisp specular hair ring highlight and SSS tip glow */
export function animeHair(color, opts = {}) {
  return toon(color, {
    rimColor: 0xffffff,
    rimStrength: 0.52,
    rimPower: 2.5,
    specColor: 0xffffff,
    specStrength: 0.85,
    specPower: 32.0,
    specThreshold: 0.68,
    sssColor: 0xffb888,
    sssStrength: 0.22,
    ...opts,
  });
}

/** Specialized anime metallic material with sharp cel reflection bands */
export function animeMetal(color, opts = {}) {
  return toon(color, {
    rimColor: 0xd8eeff,
    rimStrength: 0.65,
    rimPower: 2.2,
    specColor: 0xffffff,
    specStrength: 1.15,
    specPower: 56.0,
    specThreshold: 0.75,
    ...opts,
  });
}

/** Specialized anime skin material with soft peach rim and subsurface scattering */
export function animeSkin(color, opts = {}) {
  return toon(color, {
    rimColor: 0xffe8df,
    rimStrength: 0.32,
    rimPower: 3.2,
    specStrength: 0.0,
    sssColor: 0xffa080,
    sssStrength: 0.18,
    ...opts,
  });
}

/** Specialized anime fabric / cloth material with soft fabric rim */
export function animeCloth(color, opts = {}) {
  return toon(color, {
    rimColor: 0xf0f4ff,
    rimStrength: 0.35,
    rimPower: 3.0,
    specStrength: 0.12,
    specPower: 16.0,
    specThreshold: 0.82,
    ...opts,
  });
}

// Inverted-hull outline cache
const _outlineCache = new Map();

/**
 * Creates an inverted-hull anime ink outline material.
 * Features:
 * - View-space normal extrusion with camera distance compensation (Arc System Works / Hoyoverse style)
 *   ensuring outlines remain clean and constant in apparent width across zoom levels
 * - Warm dark indigo/sepia tones (0x221a2d) typical of hand-inked anime illustrations
 * - PolygonOffset and depth bias to completely eliminate z-fighting
 */
export function outlineMaterial(thickness = 0.01, color = 0x221a2d) {
  const key = thickness.toFixed(4) + ':' + color;
  if (_outlineCache.has(key)) return _outlineCache.get(key);

  const m = new THREE.MeshBasicMaterial({
    color,
    side: THREE.BackSide,
    polygonOffset: true,
    polygonOffsetFactor: 1.2,
    polygonOffsetUnits: 1.2,
  });

  m.onBeforeCompile = (s) => {
    s.uniforms.uThick = { value: thickness };
    s.vertexShader = `
      uniform float uThick;
    ` + s.vertexShader.replace(
      '#include <begin_vertex>',
      `
      vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
      vec3 vNorm = normalize(mat3(modelViewMatrix) * normal);
      // View-space normal extrusion with subtle distance compensation
      float distFactor = clamp(length(mvPos.xyz) * 0.09, 0.45, 2.2);
      mvPos.xyz += vNorm * (uThick * distFactor);
      vec3 transformed = position;
      gl_Position = projectionMatrix * mvPos;
      `
    );
  };

  m.customProgramCacheKey = () => 'animeOutlineV2:' + key;
  _outlineCache.set(key, m);
  return m;
}

/** Adds an outline shell to a mesh */
export function outline(mesh, thickness = 0.01, color) {
  const o = new THREE.Mesh(mesh.geometry, outlineMaterial(thickness, color));
  o.raycast = () => {};
  o.userData.isOutline = true;
  mesh.add(o);
  return mesh;
}

/** Convenience: create a mesh with toon material + outline + shadow */
export function part(geo, mat, { ol = 0.008, shadow = true, olColor } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = shadow;
  if (ol > 0) outline(m, ol, olColor);
  return m;
}

export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

/**
 * Anime rim light (view-space Fresnel) configurator for character roots and boss models.
 * Updates custom shader parameters on all toon materials under root.
 */
export function applyRim(root, color = 0xffffff, strength = 0.55, power = 2.8) {
  const col = new THREE.Color(color);
  root.traverse((o) => {
    if (!o.isMesh || o.userData.isOutline) return;
    const m = o.material;
    if (!m || !m.isMeshToonMaterial) return;

    m.userData.rimColor = col;
    m.userData.rimStrength = strength;
    m.userData.rimPower = power;

    // If shader is already compiled, update active uniforms directly
    if (m.userData.shaderRef) {
      if (m.userData.shaderRef.uniforms.uRimCol) m.userData.shaderRef.uniforms.uRimCol.value.copy(col);
      if (m.userData.shaderRef.uniforms.uRimStr) m.userData.shaderRef.uniforms.uRimStr.value = strength;
      if (m.userData.shaderRef.uniforms.uRimPow) m.userData.shaderRef.uniforms.uRimPow.value = power;
    } else {
      const prev = m.onBeforeCompile;
      m.onBeforeCompile = (sh, r) => {
        if (prev) prev(sh, r);
        m.userData.shaderRef = sh;
        if (sh.uniforms.uRimCol) sh.uniforms.uRimCol.value.copy(col);
        if (sh.uniforms.uRimStr) sh.uniforms.uRimStr.value = strength;
        if (sh.uniforms.uRimPow) sh.uniforms.uRimPow.value = power;
      };
      m.needsUpdate = true;
    }
  });
}

export { terrainMat } from './nature.js';
