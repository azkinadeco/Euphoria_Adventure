// Dev tool (viewer.html, not part of the game build): one hero rig under the game's daylight, next to
// her key art. ?hero=id&yaw=0.4&action=attack&combo=1&t=0.4&speed=0&zoom=1&y=0.9&ref=0
// window.__view.set({ ... }) changes any of those live; window.__view.ready resolves once models are in.
import * as THREE from 'three';
import { HEROES, PARTY_ORDER } from './heroes.js';
import { modelsIdle } from './assets.js';
import { applyRim } from './toon.js';
import { boostGlow } from './graphics.js';
import { VFX } from './vfx.js';
import { HyeonxaRig } from './heroes3d.js';

const NPCS = { hyeonxa: { make: () => new HyeonxaRig(), portrait: 'assets/portraits/hyeonxa.png' } }; // story NPC rigs

const q = new URLSearchParams(location.search);
const num = (k, d) => (q.has(k) ? parseFloat(q.get(k)) : d);
const P = {
  hero: q.get('hero') || 'luby', yaw: num('yaw', 0.35), action: q.get('action') || '', combo: num('combo', 1), t: num('t', 0.4),
  speed: num('speed', 0), zoom: num('zoom', 1), y: num('y', 0.92), pitch: num('pitch', 0.06), ref: num('ref', 1), sprint: num('sprint', 0),
  air: num('air', 0), freeze: num('freeze', 0),
};

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 0.98;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x3a3a48);
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
scene.add(new THREE.HemisphereLight(0xdcf0ff, 0x6f7f58, 1.6));
const sun = new THREE.DirectionalLight(0xfff5e4, 2.45);
sun.position.set(3, 6, 5); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.022; sun.shadow.radius = 2.0; // same as the game's sun
Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 4, bottom: -1, near: 1, far: 20 });
scene.add(sun);
const floor = new THREE.Mesh(new THREE.CircleGeometry(6, 48), new THREE.MeshLambertMaterial({ color: 0x4a4a5a }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const vfx = new VFX(scene);

let rig = null, ready;
function load(id) {
  if (rig) scene.remove(rig.root);
  const def = NPCS[id] || HEROES[id] || HEROES.luby;
  rig = def.make();
  scene.add(rig.root);
  document.getElementById('ref').src = def.portrait;
  ready = modelsIdle().then(() => new Promise((r) => setTimeout(r, 80))).then(() => { boostGlow(rig.root); applyRim(rig.root, 0xffffff, 0.45); });
  view.ready = ready; view.rig = rig;
}
const view = window.__view = {
  P, scene, camera, renderer, vfx, THREE,
  set(o) { const h = o.hero && o.hero !== P.hero; Object.assign(P, o); if (h) load(P.hero); return view.ready; },
};
load(P.hero);

const bar = document.getElementById('bar');
const sel = document.createElement('select');
for (const id of PARTY_ORDER) sel.add(new Option(HEROES[id].name, id, false, id === P.hero));
sel.onchange = () => view.set({ hero: sel.value });
bar.append(sel);
for (const a of ['', 'attack', 'cast', 'fang', 'spin', 'burst', 'dash', 'bash', 'pounce']) {
  const b = document.createElement('button'); b.textContent = a || 'idle';
  b.onclick = () => { P.action = a; P.t = a ? 0 : 0.4; view.play = !!a; };
  bar.append(b);
}
let drag = null;
canvas.addEventListener('pointerdown', (e) => { drag = [e.clientX, P.yaw]; });
addEventListener('pointerup', () => { drag = null; });
addEventListener('pointermove', (e) => { if (drag) P.yaw = drag[1] + (e.clientX - drag[0]) * 0.01; });
canvas.addEventListener('wheel', (e) => { P.zoom = Math.min(4, Math.max(0.4, P.zoom * (e.deltaY > 0 ? 0.92 : 1.08))); });

const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  const w = innerWidth, h = innerHeight;
  if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  document.getElementById('ref').style.display = bar.style.display = P.ref ? '' : 'none';
  if (view.play) { P.t += dt * 1.4; if (P.t >= 1) { P.t = 0.4; P.action = ''; view.play = false; } }
  if (rig && P.idle != null) rig.idleT = P.idle;
  if (rig && !P.freeze) {
    rig.root.rotation.y = P.yaw;
    rig.update(dt, { speed: P.speed, sprint: !!P.sprint, grounded: !P.air, vy: P.air > 1 ? -2 : 3, action: P.action || null, actionT: P.t, combo: P.combo, hurtT: P.hurt ? 1 : 0, look: P.look ?? null, glide: !!P.glide,  dead: !!P.dead, dt });
  }
  vfx.update?.(dt);
  const d = 5.2 / P.zoom;
  camera.position.set(0, P.y + Math.sin(P.pitch) * d, Math.cos(P.pitch) * d);
  camera.lookAt(0, P.y, 0);
  renderer.render(scene, camera);
}
frame();
