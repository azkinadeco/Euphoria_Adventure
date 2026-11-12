// Euphoria Adventure — Dynamic Atmospheric Weather & Environmental System
// Implements 4 distinct weather states:
// - SUNNY: Crisp anime skies, warm golden sunbeams, high vibrance
// - RAIN: Procedural rain streak particles, wet puddles, status Basah on outdoor enemies
// - THUNDERSTORM: Heavy rain, dark tempest clouds, real-time lightning strikes & shockwaves
// - AURORA: Shimmering undulating celestial ribbons across the night sky
import * as THREE from 'three';
import { sfx } from './sfx.js';

export const WEATHERS = {
  sunny: { id: 'sunny', name: 'Cerah', icon: '☀️', desc: 'Langit cerah & hangat. Gerakan lincah.' },
  rain: { id: 'rain', name: 'Hujan', icon: '🌧️', desc: 'Hujan deras. Musuh terkena status Basah.' },
  thunderstorm: { id: 'thunderstorm', name: 'Badai Petir', icon: '⛈️', desc: 'Petir menyambar! Musuh basah & rentan reaksi elemental.' },
  aurora: { id: 'aurora', name: 'Aurora', icon: '🌌', desc: 'Tirai cahaya langit mistis. Pengisian energi bertambah.' },
};

export class WeatherManager {
  constructor(game) {
    this.g = game;
    this.current = 'sunny';
    this.target = 'sunny';
    this.blend = 1.0;
    this.timer = 180; // auto-cycle timer in seconds
    this.wetTick = 0;
    this.lightningTimer = 8 + Math.random() * 8;
    this.flashIntensity = 0;

    this._initRain();
    this._initAurora();
    this._initLightning();
  }

  // ---------- Procedural Rain Simulation ----------
  _initRain() {
    const COUNT = 1600;
    const positions = new Float32Array(COUNT * 6); // 2 vertices per line (top & bottom of drop)
    this.rainData = [];
    for (let i = 0; i < COUNT; i++) {
      const x = (Math.random() - 0.5) * 70;
      const y = Math.random() * 45;
      const z = (Math.random() - 0.5) * 70;
      const len = 0.9 + Math.random() * 0.8;
      const spd = 36 + Math.random() * 12;
      this.rainData.push({ x, y, z, len, spd });
      const idx = i * 6;
      positions[idx] = x;
      positions[idx + 1] = y;
      positions[idx + 2] = z;
      positions[idx + 3] = x - 0.12 * len;
      positions[idx + 4] = y - len;
      positions[idx + 5] = z - 0.08 * len;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.rainMat = new THREE.LineBasicMaterial({
      color: 0xcee7ff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.rainLines = new THREE.LineSegments(geo, this.rainMat);
    this.rainLines.frustumCulled = false;
    this.g.scene.add(this.rainLines);
  }

  // ---------- Celestial Aurora Ribbons ----------
  _initAurora() {
    const geom = new THREE.PlaneGeometry(360, 48, 48, 12);
    this.auroraMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0 },
        uColA: { value: new THREE.Color(0x1affb0) }, // neon teal/emerald
        uColB: { value: new THREE.Color(0x9d4edd) }, // vibrant amethyst/violet
      },
      vertexShader: `
        uniform float uTime;
        varying vec2 vUv;
        varying float vElev;
        void main() {
          vUv = uv;
          vec3 p = position;
          // Organic undulating wave
          float wave = sin(p.x * 0.02 + uTime * 0.7) * 9.0
                     + cos(p.z * 0.03 + uTime * 0.5) * 6.0;
          p.y += wave * (1.0 - uv.y);
          p.z += sin(p.x * 0.015 + uTime * 0.4) * 14.0;
          vElev = wave;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        uniform vec3 uColA;
        uniform vec3 uColB;
        varying vec2 vUv;
        varying float vElev;
        void main() {
          // Vertical soft fade (zero at top and bottom, highest at middle-lower)
          float vertFade = smoothstep(0.0, 0.35, vUv.y) * (1.0 - smoothstep(0.65, 1.0, vUv.y));
          // Horizontal edge softening
          float horizFade = smoothstep(0.0, 0.15, vUv.x) * (1.0 - smoothstep(0.85, 1.0, vUv.x));
          vec3 col = mix(uColA, uColB, vUv.y + sin(vUv.x * 6.0) * 0.2);
          gl_FragColor = vec4(col, vertFade * horizFade * uOpacity * 0.65);
        }
      `,
    });

    this.auroraGroup = new THREE.Group();
    // 3 layered ribbon strips across the northern sky
    for (let i = 0; i < 3; i++) {
      const mesh = new THREE.Mesh(geom, this.auroraMat);
      mesh.position.set(-60 + i * 40, 160 + i * 22, -340 - i * 60);
      mesh.rotation.y = (i - 1) * 0.25;
      mesh.rotation.x = -0.2;
      this.auroraGroup.add(mesh);
    }
    this.g.scene.add(this.auroraGroup);
  }

  // ---------- Dynamic Lightning Mesh & Bolts ----------
  _initLightning() {
    this.lightningMesh = new THREE.Group();
    this.g.scene.add(this.lightningMesh);
    this.lightningMesh.visible = false;
  }

  strikeLightning(pos) {
    sfx.lightning();
    this.flashIntensity = 1.0;

    // Remove old bolt segments
    while (this.lightningMesh.children.length > 0) {
      const ch = this.lightningMesh.children.pop();
      ch.geometry?.dispose?.();
    }

    // Build procedural branching bolt
    const points = [];
    let cur = new THREE.Vector3(pos.x + (Math.random() - 0.5) * 15, pos.y + 110, pos.z + (Math.random() - 0.5) * 15);
    points.push(cur.clone());
    const steps = 18;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const targetY = (1 - t) * (pos.y + 110) + t * pos.y;
      cur = new THREE.Vector3(
        (1 - t) * cur.x + t * pos.x + (Math.random() - 0.5) * 8 * (1 - t),
        targetY,
        (1 - t) * cur.z + t * pos.z + (Math.random() - 0.5) * 8 * (1 - t)
      );
      points.push(cur.clone());
    }

    const boltGeo = new THREE.BufferGeometry().setFromPoints(points);
    const boltMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      linewidth: 3,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
    });
    const bolt = new THREE.Line(boltGeo, boltMat);
    this.lightningMesh.add(bolt);
    this.lightningMesh.visible = true;
    this.lightningLife = 0.28;

    // Impact shockwave & particles
    this.g.vfx.shockwave(pos, 6, 0xc0e8ff, 0.45);
    this.g.vfx.particles(pos.clone().add(new THREE.Vector3(0, 0.5, 0)), 35, 0xaadaff, { speed: 8, up: 7, life: 0.6 });
    this.g.shake(0.38);

    // Damage enemies near the lightning impact zone!
    for (const e of this.g.enemies) {
      if (e.dead || e.dormant) continue;
      const dist = e.pos.distanceTo(pos);
      if (dist < 6.5) {
        e.aura = { el: 'LIGHTNING', t: 6.0 };
        this.g.dealDamage(e, this.g.player.atk * 1.5, { element: 'LIGHTNING', poise: 25, knock: 10 });
      }
    }
  }

  setWeather(wId) {
    if (!WEATHERS[wId]) return;
    this.target = wId;
    this.blend = 0.0;
    this.g.ui?.toast(`Cuaca berubah: ${WEATHERS[wId].icon} ${WEATHERS[wId].name}`);
    this._updateHUD();
  }

  cycleNext() {
    const list = ['sunny', 'rain', 'thunderstorm', 'aurora'];
    const idx = list.indexOf(this.current);
    const next = list[(idx + 1) % list.length];
    this.setWeather(next);
  }

  _updateHUD() {
    const el = document.getElementById('weather-badge');
    if (!el) return;
    const info = WEATHERS[this.current] || WEATHERS.sunny;
    el.innerHTML = `<span class="w-icon">${info.icon}</span><span class="w-name">${info.name}</span>`;
    el.title = `${info.name}: ${info.desc} (Klik untuk ganti cuaca)`;
  }

  update(dt, playerPos) {
    const G = this.g, W = G.world;
    if (!W) return;

    // Transition blend
    if (this.blend < 1.0) {
      this.blend = Math.min(1.0, this.blend + dt * 0.4);
      if (this.blend >= 1.0) {
        this.current = this.target;
        this._updateHUD();
      }
    }

    // Auto weather cycling (only in main open world, not inside Spire or Realm boss fights)
    if (!W.realm) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = 140 + Math.random() * 80;
        // Night favours aurora, day favours sunny/rain
        const night = W.nightAmt || 0;
        let pick = 'sunny';
        const r = Math.random();
        if (night > 0.5) {
          if (r < 0.35) pick = 'aurora';
          else if (r < 0.65) pick = 'thunderstorm';
          else pick = 'rain';
        } else {
          if (r < 0.55) pick = 'sunny';
          else if (r < 0.82) pick = 'rain';
          else pick = 'thunderstorm';
        }
        if (pick !== this.current) this.setWeather(pick);
      }
    }

    const isRain = this.current === 'rain' || this.current === 'thunderstorm' || this.target === 'rain' || this.target === 'thunderstorm';
    const isThunder = this.current === 'thunderstorm' || this.target === 'thunderstorm';
    const isAurora = this.current === 'aurora' || this.target === 'aurora';

    // 1. Rain particles simulation
    const rainTargetOpacity = isThunder ? 0.75 : (isRain ? 0.55 : 0.0);
    this.rainMat.opacity = THREE.MathUtils.lerp(this.rainMat.opacity, rainTargetOpacity, dt * 2.5);
    this.rainLines.visible = this.rainMat.opacity > 0.02 && !W.realm;

    if (this.rainLines.visible) {
      const pAttr = this.rainLines.geometry.attributes.position;
      const arr = pAttr.array;
      const count = this.rainData.length;
      for (let i = 0; i < count; i++) {
        const d = this.rainData[i];
        d.y -= d.spd * dt;
        if (d.y < 0) {
          d.y = 40 + Math.random() * 8;
          d.x = (Math.random() - 0.5) * 70;
          d.z = (Math.random() - 0.5) * 70;
        }
        const wx = playerPos.x + d.x;
        const wy = playerPos.y + d.y;
        const wz = playerPos.z + d.z;
        const idx = i * 6;
        arr[idx] = wx;
        arr[idx + 1] = wy;
        arr[idx + 2] = wz;
        arr[idx + 3] = wx - 0.15 * d.len;
        arr[idx + 4] = wy - d.len;
        arr[idx + 5] = wz - 0.1 * d.len;
      }
      pAttr.needsUpdate = true;
    }

    // 2. Aurora ribbons
    this.auroraMat.uniforms.uTime.value += dt;
    const auroraTargetOpacity = isAurora ? (W.nightAmt || 0.8) : 0.0;
    this.auroraMat.uniforms.uOpacity.value = THREE.MathUtils.lerp(
      this.auroraMat.uniforms.uOpacity.value,
      auroraTargetOpacity,
      dt * 1.5
    );
    this.auroraGroup.visible = this.auroraMat.uniforms.uOpacity.value > 0.01 && !W.realm;
    if (this.auroraGroup.visible) {
      this.auroraGroup.position.set(playerPos.x * 0.2, 0, playerPos.z * 0.2);
    }

    // 3. Thunderstorm lightning strikes
    if (isThunder && !W.realm) {
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        this.lightningTimer = 9 + Math.random() * 11;
        const ang = Math.random() * Math.PI * 2;
        const dist = 12 + Math.random() * 26;
        const strikePos = new THREE.Vector3(
          playerPos.x + Math.cos(ang) * dist,
          0,
          playerPos.z + Math.sin(ang) * dist
        );
        strikePos.y = W.groundAt ? W.groundAt(strikePos.x, strikePos.z) : 0;
        this.strikeLightning(strikePos);
      }
    }

    // Lightning bolt dissipation & screen flash
    if (this.lightningMesh.visible) {
      this.lightningLife -= dt;
      if (this.lightningLife <= 0) {
        this.lightningMesh.visible = false;
      }
    }
    if (this.flashIntensity > 0) {
      this.flashIntensity = Math.max(0, this.flashIntensity - dt * 3.5);
      if (W.sun) {
        W.sun.intensity += this.flashIntensity * 3.0;
      }
    }

    // 4. Wet aura during Rain / Thunderstorm
    if (isRain && !W.realm) {
      this.wetTick -= dt;
      if (this.wetTick <= 0) {
        this.wetTick = 1.8;
        for (const e of G.enemies) {
          if (e.dead || e.dormant || !e.root.visible || e.realmMob) continue;
          if (e.pos.distanceTo(playerPos) < 55) {
            // Apply or refresh the wet aura
            if (!e.aura || e.aura.el !== 'WATER') {
              e.aura = { el: 'WATER', t: 4.5 };
            } else {
              e.aura.t = Math.max(e.aura.t, 4.5);
            }
          }
        }
      }
    }

    // 5. Environmental Lighting & Fog Modulations
    const fogTarget = W.realm || W.arenaFloor ? 0 : isThunder ? 1 : isRain ? 0.6 : 0;
    this.fogK = (this.fogK || 0) + (fogTarget - (this.fogK || 0)) * Math.min(1, dt * 0.7);
    if (this.fogK > 0.01 && G.scene.fog) { G.scene.fog.near *= 1 - 0.4 * this.fogK; G.scene.fog.far *= 1 - 0.4 * this.fogK; }
    if (!W.realm) {
      if (isThunder) {
        W.cloudMat.color.lerp(new THREE.Color(0x323a48), 0.08);
        W.cloudShade.color.lerp(new THREE.Color(0x1a1e28), 0.08);
      } else if (isRain) {
        W.cloudMat.color.lerp(new THREE.Color(0x76889d), 0.06);
        W.cloudShade.color.lerp(new THREE.Color(0x404a57), 0.06);
      } else if (isAurora) {
        if (W.skyUniforms) {
          W.skyUniforms.zenith.value.lerp(new THREE.Color(0x0a1a36), dt * 0.5);
        }
      }
    }
  }
}
