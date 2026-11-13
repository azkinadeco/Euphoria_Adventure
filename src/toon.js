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
const _shaders = new WeakMap(); // toon material -> its compiled shader (live uniform updates)

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
    shadeMix = 0, // 0 = world look (ramp only); characters get coloured cel shadows via charaLook()
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
  mat.userData.shadeMix = shadeMix;
  mat.userData.shadeTint = new THREE.Color(0.93, 0.88, 1.0);
  mat.userData.shadeParams = new THREE.Vector3(1.35, 1.15, 0); // saturation, lift, unused

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
    shader.uniforms.uShadeMix = { value: mat.userData.shadeMix };
    shader.uniforms.uShadeTint = { value: mat.userData.shadeTint };
    shader.uniforms.uShadeParams = { value: mat.userData.shadeParams };
    _shaders.set(mat, shader);

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
      uniform float uShadeMix;
      uniform vec3 uShadeTint;
      uniform vec3 uShadeParams;
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

      // how much key light really arrives here (cel ramp x cast shadow), 0..1
      const vec3 LUM = vec3(0.299, 0.587, 0.114);
      float cKey = 0.0;
      vec3 cSun = vec3(0.0);
      #if ( NUM_DIR_LIGHTS > 0 )
        cSun = directionalLights[0].color * RECIPROCAL_PI;
        cKey = dot(reflectedLight.directDiffuse, LUM) / max(dot(diffuseColor.rgb * cSun, LUM), 0.0013);
      #endif

      // --- Character cel shading: lighting only sets the brightness; the colour comes from the
      // material itself - its own hue where lit, a saturated hue-shifted shade in shadow (anime key
      // art never goes grey), and only a hint of the light's colour (so night stays readable) ---
      if (uShadeMix > 0.0) {
        float cSh = 1.0 - smoothstep(0.6, 0.74, cKey);
        float cDl = dot(diffuseColor.rgb, LUM);
        vec3 cCol = clamp(vec3(cDl) + (diffuseColor.rgb - vec3(cDl)) * uShadeParams.x, 0.0, 1.0) * uShadeTint;
        vec3 cBase = mix(diffuseColor.rgb, cCol, cSh);
        vec3 cLit = outgoingLight - totalEmissiveRadiance;
        vec3 cRep = cBase * (dot(cLit, LUM) / max(dot(cBase, LUM), 0.03)) * mix(1.0, uShadeParams.y, cSh);
        outgoingLight = mix(cLit, cRep, uShadeMix * mix(0.88, 1.0, cSh)) + totalEmissiveRadiance;
      }

      // --- Anime face: no cel step across the face. The head and its painted decal share this
      // soft light (ambient + sun faded by a half-lambert and by cast shadows), so they blend as one ---
      if (uIsFace > 0.5) {
        float fHl = dot(normalize(normal), lightViewDir) * 0.5 + 0.5;
        float fLit = smoothstep(0.2, 0.72, fHl) * clamp(cKey / 0.38, 0.0, 1.0);
        vec3 fAmb = min(reflectedLight.indirectDiffuse / max(diffuseColor.rgb, vec3(0.01)), vec3(3.0));
        vec3 fLight = fAmb * 1.3 + cSun * mix(0.42, 0.93, fLit);
        fLight = mix(fLight, vec3(dot(fLight, LUM)), 0.85); // mostly neutral light, like the body
        outgoingLight = diffuseColor.rgb * fLight * mix(uShadeTint, vec3(1.0), fLit) + totalEmissiveRadiance;
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

  // three's default key is the *current* onBeforeCompile source, which applyRim() later wraps — that
  // would split identical shaders into separate programs, so only keep a key someone set explicitly
  const origKey = Object.prototype.hasOwnProperty.call(mat, 'customProgramCacheKey') ? mat.customProgramCacheKey.bind(mat) : () => '';
  // spec/face/rim are uniforms (flatShading is already part of three's own key): one program per variant
  mat.customProgramCacheKey = () => origKey() + ':hdAnimeCel';

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
    // extrude AFTER three's own projection (replacing begin_vertex got overwritten by project_vertex,
    // so the shells never showed); works for plain, instanced and skinned meshes
    s.vertexShader = 'uniform float uThick;\n' + s.vertexShader.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      {
        vec3 oN = normal;
        #ifdef USE_SKINNING
          oN = objectNormal;
        #endif
        #ifdef USE_INSTANCING
          oN = mat3(instanceMatrix) * oN;
        #endif
        vec3 vN = normalize(mat3(modelViewMatrix) * oN);
        // view-space extrusion with distance compensation: near-constant apparent width
        float distFactor = clamp(-mvPosition.z * 0.09, 0.45, 2.2);
        mvPosition.xyz += vN * (uThick * distFactor);
        gl_Position = projectionMatrix * mvPosition;
      }`
    );
  };

  // thickness is a uniform and colour is the material colour: every outline can share one program
  m.customProgramCacheKey = () => 'animeOutlineV4';
  m.userData.thick = thickness;
  _outlineCache.set(key, m);
  return m;
}

/** Adds an outline shell to a mesh */
export function outline(mesh, thickness = 0.01, color = mesh.material?.userData?.olColor) {
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

/**
 * Anime head shape: narrow V jaw and a small pointed chin. Skull-local (sphere r ~0.12, centre 0).
 * Apply the same call to the skull AND its face decal so the painted face follows the new shape.
 */
export function animeHead(geo) {
  const p = geo.attributes.position;
  const sm = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const t = Math.min(1, Math.max(0, (-y - 0.01) / 0.11)); // 0 at the eyes .. 1 at the chin
    const fw = sm((z / 0.12 + 0.3) / 0.9); // front of the face
    x *= 1 - 0.3 * Math.pow(t, 1.4) * (0.35 + 0.65 * fw);
    y -= 0.02 * t * t * fw;
    z *= 1 - 0.08 * t * (1 - fw);
    p.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  // weld normals across the UV seam / poles (duplicated vertices) so no lighting crease shows
  const n = geo.attributes.normal, acc = new Map();
  const key = (i) => `${Math.round(p.getX(i) * 1e4)},${Math.round(p.getY(i) * 1e4)},${Math.round(p.getZ(i) * 1e4)}`;
  for (let i = 0; i < p.count; i++) { const k = key(i), a = acc.get(k) || [0, 0, 0]; a[0] += n.getX(i); a[1] += n.getY(i); a[2] += n.getZ(i); acc.set(k, a); }
  for (let i = 0; i < p.count; i++) { const a = acc.get(key(i)), l = Math.hypot(a[0], a[1], a[2]) || 1; n.setXYZ(i, a[0] / l, a[1] / l, a[2] / l); }
  return geo;
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
    const str = Math.min(strength, m.userData.rimCap ?? 9); // skin keeps a subtle rim (charaLook)
    m.userData.rimStrength = str;
    m.userData.rimPower = power;

    // If shader is already compiled, update active uniforms directly
    if (m.userData.shaderRef) {
      if (m.userData.shaderRef.uniforms.uRimCol) m.userData.shaderRef.uniforms.uRimCol.value.copy(col);
      if (m.userData.shaderRef.uniforms.uRimStr) m.userData.shaderRef.uniforms.uRimStr.value = str;
      if (m.userData.shaderRef.uniforms.uRimPow) m.userData.shaderRef.uniforms.uRimPow.value = power;
    } else {
      const prev = m.onBeforeCompile;
      m.onBeforeCompile = (sh, r) => {
        if (prev) prev(sh, r);
        m.userData.shaderRef = sh;
        if (sh.uniforms.uRimCol) sh.uniforms.uRimCol.value.copy(col);
        if (sh.uniforms.uRimStr) sh.uniforms.uRimStr.value = str;
        if (sh.uniforms.uRimPow) sh.uniforms.uRimPow.value = power;
      };
      m.needsUpdate = true;
    }
  });
}

const _hsl = { h: 0, s: 0, l: 0 };
const _c = new THREE.Color();
/**
 * Anime character look for every toon material under `root`: coloured cel shadows (warm on skin,
 * cool on whites, saturated on colours) and ink outlines tinted with a dark shade of the base colour.
 * Kits that load later pick the outline colour up from material.userData.olColor.
 * @param {THREE.Material[]} skins materials to treat as skin
 */
export function charaLook(root, skins = []) {
  const done = new Set();
  const conf = (m) => {
    if (done.has(m) || !m?.isMeshToonMaterial) return;
    done.add(m);
    const u = m.userData;
    m.color.getHSL(_hsl);
    const skin = skins.includes(m) || (!m.map && _hsl.l > 0.72 && _hsl.h > 0.02 && _hsl.h < 0.11 && _hsl.s > 0.3);
    if (u.isFace) { u.shadeMix = 0; u.shadeTint.setRGB(1.0, 0.8, 0.77); u.rimCap = 0.12; u.rimStrength = Math.min(u.rimStrength, 0.12); u.olColor = 0x7a3b33; return; }
    if (skin) {
      u.shadeMix = 1; u.shadeTint.setRGB(1.0, 0.77, 0.73); u.shadeParams.set(1.35, 1.5, 0);
      u.rimCap = 0.2; u.rimStrength = Math.min(u.rimStrength, 0.2);
      u.olColor = 0x7a3b33;
    } else if (m.map) {
      u.shadeMix = 0.8; u.shadeTint.setRGB(0.9, 0.86, 1.0); u.shadeParams.set(1.3, 1.15, 0);
      u.olColor = 0x2a2030;
    } else if (_hsl.s < 0.12 && _hsl.l > 0.55) { // whites / silver: cool lilac shadow
      u.shadeMix = 1; u.shadeTint.setRGB(0.85, 0.88, 1.0); u.shadeParams.set(1.0, 1.75, 0);
      u.olColor = 0x4a4660;
    } else if (_hsl.l < 0.16) { // blacks stay inky, slightly violet
      u.shadeMix = 0.6; u.shadeTint.setRGB(0.85, 0.8, 1.0); u.shadeParams.set(1.2, 1.3, 0);
      u.olColor = 0x0c0810;
    } else {
      u.shadeMix = 1; u.shadeTint.setRGB(0.94, 0.86, 0.98); u.shadeParams.set(1.45, 1.18, 0);
      u.olColor = _c.setHSL((_hsl.h + 0.98) % 1, Math.min(1, _hsl.s * 1.15 + 0.05), Math.max(0.06, _hsl.l * 0.26)).getHex();
    }
    const sh = _shaders.get(m);
    if (sh?.uniforms.uShadeMix) { sh.uniforms.uShadeMix.value = u.shadeMix; sh.uniforms.uRimStr.value = u.rimStrength; }
  };
  root.traverse((o) => { if (o.isMesh && !o.userData.isOutline) conf(o.material); });
  root.traverse((o) => { // retint outline shells that were built before the look was applied
    if (!o.userData.isOutline || !o.parent?.material?.userData?.olColor) return;
    o.material = outlineMaterial(o.material.userData.thick ?? 0.006, o.parent.material.userData.olColor);
  });
}

export { terrainMat } from './nature.js';
