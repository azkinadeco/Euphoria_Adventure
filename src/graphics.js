// Euphoria Adventure — High-Definition Anime Post-Processing Pipeline.
// Stylized anime look:
// - High-fidelity soft UnrealBloom for elemental glow, skills, and sun glints
// - Subtle Ambient Occlusion (GTAO) tuned specifically for stylized anime grounding
// - High-sample FXAA edge smoothing for clean outlines and silhouette edges
// - Anime color grading: ACES-filmic curve shaping, lush fantasy greens,
//   crystalline skies, golden sunlight warmth, lifted lavender shadows, and subtle lens dispersion
import * as THREE from 'three';
import { wantedVisible } from './cull.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';

export const PRESETS = {
  low: { post: true, pr: 1.15, shadow: 1024, bloom: true, ao: false, msaa: 0, fxaa: true, grass: 0.45, lights: 4, life: 0.5 },
  med: { post: true, pr: 1.45, shadow: 2048, bloom: true, ao: false, msaa: 0, fxaa: true, grass: 0.75, lights: 6, life: 0.8 },
  high: { post: true, pr: 1.85, shadow: 2048, bloom: true, ao: true, msaa: 0, fxaa: true, grass: 1.0, lights: 8, life: 1.0 },
  ultra: { post: true, pr: 2.0, shadow: 4096, bloom: true, ao: true, msaa: 4, fxaa: true, grass: 1.4, lights: 8, life: 1.0 },
};
export const PRESET_ORDER = ['low', 'med', 'high', 'ultra'];

/**
 * Anime color grading shader:
 * - Subtle cinematic chromatic aberration on screen edges
 * - Selective saturation boost for lush fantasy foliage and crystalline skies
 * - Lifted cool-toned (lavender/indigo) shadows to prevent flat murky blacks
 * - Warm golden sunlight highlight compression
 * - Film-style S-curve contrast preserving delicate anime gradients
 * - Soft cinematic vignette
 */
const AnimeGradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uSat: { value: 1.02 },
    uContrast: { value: 1.04 },
    uVignette: { value: 0.22 },
    uWarm: { value: 0.038 },
    uTint: { value: new THREE.Color(1, 1, 1) },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uSat;
    uniform float uContrast;
    uniform float uVignette;
    uniform float uWarm;
    uniform vec3 uTint;
    varying vec2 vUv;

    // ACES Filmic tone mapping curve
    vec3 acesFilmic(vec3 x) {
      const float a = 2.51;
      const float b = 0.03;
      const float c = 2.43;
      const float d = 0.59;
      const float e = 0.14;
      return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
    }

    void main() {
      vec2 d = vUv - 0.5;
      float distSq = dot(d, d);

      // Subtle lens dispersion (chromatic aberration) on screen perimeter
      vec2 caOff = d * (distSq * 0.0032);
      float rCh = texture2D(tDiffuse, vUv + caOff).r;
      float gCh = texture2D(tDiffuse, vUv).g;
      float bCh = texture2D(tDiffuse, vUv - caOff).b;
      float aCh = texture2D(tDiffuse, vUv).a;
      vec3 c = vec3(rCh, gCh, bCh);

      // Relative luminance
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));

      // 1. Selective Anime Vibrance (boosts greens and cyans without over-saturating skin)
      float maxC = max(c.r, max(c.g, c.b));
      float minC = min(c.r, min(c.g, c.b));
      float satDelta = (maxC - minC) / (maxC + 1e-4);
      float satFactor = uSat + (1.0 - satDelta) * 0.05;
      c = mix(vec3(l), c, satFactor);

      // 2. Lifted Anime Shadows (subtle lavender cool tint in the deepest crevices)
      vec3 shadowLift = vec3(0.018, 0.015, 0.034) * (1.0 - smoothstep(0.0, 0.35, l));
      c += shadowLift;

      // 3. Contrast adjustment with filmic response
      c = (c - 0.5) * uContrast + 0.5;
      c = mix(c, acesFilmic(clamp(c, 0.0, 1.0)), 0.22);

      // 4. Golden Highlight Warmth (mimics anime late-morning sun reflection)
      float hiMask = smoothstep(0.48, 1.0, l);
      c += vec3(uWarm, uWarm * 0.45, -uWarm * 0.38) * hiMask;

      // 5. Region mood tint
      c *= uTint;

      // 6. Subtle cinematic vignette
      float vig = 1.0 - uVignette * smoothstep(0.26, 0.90, distSq * 2.0);
      c *= vig;

      gl_FragColor = vec4(clamp(c, 0.0, 1.0), aCh);
    }
  `,
};

export class Graphics {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 0.98;
    this.preset = null;
  }

  apply(name) {
    const P = PRESETS[name] || PRESETS.high;
    this.preset = name;
    this.P = P;
    const r = this.renderer;
    const mobile = matchMedia('(pointer: coarse)').matches;

    r.setPixelRatio(Math.min(devicePixelRatio, mobile ? Math.min(P.pr, 1.75) : P.pr));
    r.setSize(innerWidth, innerHeight);

    this.composer?.dispose?.();
    this.composer = null;

    if (!P.post) return;

    const size = r.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType,
      samples: P.msaa || 0,
    });

    const c = new EffectComposer(r, rt);
    c.addPass(new RenderPass(this.scene, this.camera));

    // Stylized Ambient Occlusion (GTAOPass)
    // Tuned specifically for cel-shaded art: grounds objects without dirtying anime skin or clean textures
    if (P.ao) {
      const ao = new GTAOPass(this.scene, this.camera, size.x, size.y);
      ao.blendIntensity = 0.42;
      ao.updateGtaoMaterial({
        radius: 0.65,
        distanceExponent: 1.8,
        thickness: 1.4,
        scale: 1.0,
      });
      // the AO pre-pass draws solid shapes, so cut-outs and glass would print as boxes;
      // grass is skipped as well because its blades are thinner than the AO radius
      ao.overrideVisibility = function () {
        const cache = this._visibilityCache;
        this.scene.traverse((o) => {
          cache.set(o, wantedVisible(o)); // not the streamed value, or a far object would stay hidden after restore
          const m = o.material;
          if (o.isPoints || o.isLine || o.isSprite || o.userData.noAO || o.userData.isOutline || (m && (m.transparent || m.alphaTest > 0))) o.visible = false;
        });
      };
      c.addPass(ao);
      this.aoPass = ao;
    }

    // High-Fidelity Soft Anime Bloom
    // Only HDR light sources cross the threshold; lit snow and marble stay clean
    if (P.bloom) {
      const scale = mobile ? 0.6 : 1.0;
      this.bloom = new UnrealBloomPass(
        new THREE.Vector2(size.x * scale, size.y * scale),
        0.42, // strength
        0.6,  // radius
        1.3   // threshold: above sunlit white, so only real light sources glow
      );
      c.addPass(this.bloom);
    }

    c.addPass(new OutputPass());

    // Anime color grading
    this.grade = new ShaderPass(AnimeGradeShader);
    c.addPass(this.grade);

    // High-Sample FXAA Anti-Aliasing Pass
    // Eliminates stair-stepping on inverted-hull outlines and mesh silhouettes
    if (P.fxaa) {
      this.fxaa = new ShaderPass(FXAAShader);
      this.fxaa.material.uniforms.resolution.value.set(1 / size.x, 1 / size.y);
      c.addPass(this.fxaa);
    } else {
      this.fxaa = null;
    }

    this.composer = c;
  }

  resize() {
    this.renderer.setSize(innerWidth, innerHeight);
    if (!this.composer) return;
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.composer.setSize(innerWidth, innerHeight);
    if (this.fxaa) {
      this.fxaa.material.uniforms.resolution.value.set(1 / size.x, 1 / size.y);
    }
  }

  /** mood hooks for regions (tint/saturation/bloom) */
  mood({ tint, sat, bloom } = {}) {
    if (this.grade) {
      if (tint) this.grade.uniforms.uTint.value.copy(tint);
      if (sat !== undefined) this.grade.uniforms.uSat.value = sat;
    }
    if (this.bloom && bloom !== undefined) {
      this.bloom.strength = bloom;
    }
  }

  render() {
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}

/**
 * Push glowing surfaces into HDR so the bloom pass picks them up:
 * bright unlit materials (flames, crystals, eyes, lava, runes…) and emissive toon materials.
 */
export function boostGlow(root, k = 2.4) {
  root.traverse((o) => {
    if (!o.material || o.isInstancedMesh || o.renderOrder >= 10 || o.userData.isOutline) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (m.userData.hdr || m.userData.noGlow) continue;
      if (m.isMeshBasicMaterial || m.isPointsMaterial) {
        const c = m.color;
        const mx = Math.max(c.r, c.g, c.b);
        if (mx > 0.55 && !(c.r > 0.8 && c.g > 0.8 && c.b > 0.8 && !m.blending)) {
          c.multiplyScalar(k);
          m.userData.hdr = true;
        }
      } else if (m.emissive && (m.emissive.r + m.emissive.g + m.emissive.b) > 0.05) {
        m.emissiveIntensity = (m.emissiveIntensity || 1) * k;
        m.userData.hdr = true;
      }
    }
  });
}
