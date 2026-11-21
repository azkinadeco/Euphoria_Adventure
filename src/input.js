// Unified input: keyboard + mouse (pointer lock) + touch (virtual joystick, camera drag, buttons).
import { pt } from './screen.js';

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.events = [];            // one-shot actions: attack, skill, burst, jump, dash, interact, eat1, eat2, menu
    this.look = { x: 0, y: 0 };  // accumulated camera delta
    this.move = { x: 0, y: 0 };  // touch joystick
    this.sprintToggle = false;
    this.touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.enabled = false;
    this.wheel = 0;
    this.pinch = 0;             // accumulated two-finger spread (px): + = zoom in
    this.freeLook = false;      // eye held: the camera looks around, the walk keeps its heading
    this.attackHeld = false;
    this._bind();
  }

  _bind() {
    const map = { KeyE: 'skill', KeyQ: 'burst', Space: 'jump', KeyF: 'interact', Digit1: 'sw0', Digit2: 'sw1', Digit3: 'sw2', Digit4: 'sw3', KeyZ: 'eat1', KeyX: 'eat2', KeyC: 'eat3', KeyV: 'eat4', KeyB: 'eat5', Tab: 'lock', KeyP: 'photo', KeyM: 'map', ControlLeft: 'dash', Escape: 'menu', KeyR: 'dash' };
    const lookKey = (c) => c === 'KeyT' || c === 'AltLeft' || c === 'AltRight';
    addEventListener('keydown', (e) => {
      if (lookKey(e.code)) { this.freeLook = true; e.preventDefault(); }
      if (e.repeat) return;
      this.keys.add(e.code);
      if (map[e.code]) { this.events.push(map[e.code]); if (e.code === 'Space' || e.code === 'Tab') e.preventDefault(); }
    });
    addEventListener('keyup', (e) => { this.keys.delete(e.code); if (lookKey(e.code)) this.freeLook = false; });
    addEventListener('blur', () => { this.keys.clear(); this.attackHeld = false; this.freeLook = false; });
    // HUD eye button (PC): hold = look around
    const eye = document.getElementById('btn-sight');
    if (eye) {
      eye.addEventListener('mousedown', (e) => { e.preventDefault(); this.freeLook = true; });
      addEventListener('mouseup', () => { if (!this.keys.has('KeyT') && !this.keys.has('AltLeft') && !this.keys.has('AltRight')) this.freeLook = false; });
    }

    const c = this.canvas;
    c.addEventListener('mousedown', (e) => {
      if (this.touch || !this.enabled) return;
      if (document.pointerLockElement !== c) { c.requestPointerLock?.(); return; }
      if (e.button === 0) { this.events.push('attack'); this.attackHeld = true; }
      if (e.button === 1) { this.events.push('lock'); e.preventDefault(); }
      if (e.button === 2) this.events.push('dash');
    });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mouseup', (e) => { if (e.button === 0) this.attackHeld = false; });
    addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === c) { this.look.x += e.movementX; this.look.y += e.movementY; }
    });
    c.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); }, { passive: true });

    // ---------- touch ----------
    if (!this.touch) return;
    document.body.classList.add('touch');
    const joy = document.getElementById('joy'), knob = document.getElementById('joy-knob');
    let joyId = null, jc = { x: 0, y: 0 };
    joy.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0]; joyId = t.identifier;
      const r = joy.getBoundingClientRect(); jc = pt(r.left + r.width / 2, r.top + r.height / 2); // centre maps exactly, even turned
      this._joy(t, jc, knob); joy.classList.add('on'); e.preventDefault();
    }, { passive: false });
    joy.addEventListener('touchmove', (e) => { for (const t of e.changedTouches) if (t.identifier === joyId) this._joy(t, jc, knob); e.preventDefault(); }, { passive: false });
    const endJoy = (e) => { for (const t of e.changedTouches) if (t.identifier === joyId) { joyId = null; this.move.x = this.move.y = 0; knob.style.transform = ''; joy.classList.remove('on'); } };
    joy.addEventListener('touchend', endJoy); joy.addEventListener('touchcancel', endJoy);

    // camera drag on canvas (anywhere not on a control); two fingers = pinch zoom (no turning then)
    const camTouches = new Map();
    let pinchD = 0;
    const spread = () => { const [a, b] = camTouches.values(); return Math.hypot(a.x - b.x, a.y - b.y); };
    c.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) camTouches.set(t.identifier, pt(t.clientX, t.clientY));
      if (camTouches.size === 2) pinchD = spread();
      e.preventDefault();
    }, { passive: false });
    c.addEventListener('touchmove', (e) => {
      const two = camTouches.size >= 2;
      for (const t of e.changedTouches) {
        const p = camTouches.get(t.identifier); if (!p) continue;
        const q = pt(t.clientX, t.clientY);
        if (!two) { this.look.x += (q.x - p.x) * 1.6; this.look.y += (q.y - p.y) * 1.6; }
        p.x = q.x; p.y = q.y;
      }
      if (two) { const d = spread(); this.pinch += d - pinchD; pinchD = d; }
      e.preventDefault();
    }, { passive: false });
    const endCam = (e) => { for (const t of e.changedTouches) camTouches.delete(t.identifier); if (camTouches.size === 2) pinchD = spread(); };
    c.addEventListener('touchend', endCam); c.addEventListener('touchcancel', endCam);

    const btn = (id, ev) => {
      const el = document.getElementById(id);
      el.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); if (typeof ev === 'function') ev(); else this.events.push(ev); el.classList.add('down'); el.classList.remove('ping'); void el.offsetWidth; el.classList.add('ping'); }, { passive: false });
      el.addEventListener('touchend', () => el.classList.remove('down'));
    };
    btn('t-attack', () => { this.events.push('attack'); this.attackHeld = true; }); btn('t-jump', 'jump'); btn('t-lock', 'lock'); btn('t-dash', 'dash'); btn('t-interact', 'interact');
    // eye: hold to look around while the walk keeps its heading; drag the same finger to turn the view
    const eyeT = document.getElementById('t-sight');
    let eyeId = null, eyeP = null;
    eyeT.addEventListener('touchstart', (e) => {
      e.preventDefault(); e.stopPropagation();
      const t = e.changedTouches[0]; eyeId = t.identifier; eyeP = pt(t.clientX, t.clientY);
      this.freeLook = true; eyeT.classList.add('down', 'on');
    }, { passive: false });
    eyeT.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) if (t.identifier === eyeId) {
        const q = pt(t.clientX, t.clientY);
        this.look.x += (q.x - eyeP.x) * 2.2; this.look.y += (q.y - eyeP.y) * 1.6; eyeP = q;
      }
      e.preventDefault();
    }, { passive: false });
    const endEye = (e) => { for (const t of e.changedTouches) if (t.identifier === eyeId) { eyeId = null; this.freeLook = false; eyeT.classList.remove('down', 'on'); } };
    eyeT.addEventListener('touchend', endEye); eyeT.addEventListener('touchcancel', endEye);
    btn('t-sprint', () => { this.sprintToggle = !this.sprintToggle; document.getElementById('t-sprint').classList.toggle('on', this.sprintToggle); });
    btn('btn-e', 'skill'); btn('btn-q', 'burst');
    // hold attack button = charged attack
    const atk = document.getElementById('t-attack');
    const rel = () => { this.attackHeld = false; };
    atk.addEventListener('touchend', rel); atk.addEventListener('touchcancel', rel);
  }

  _joy(t, c, knob) {
    const q = pt(t.clientX, t.clientY);
    let dx = q.x - c.x, dy = q.y - c.y;
    const L = Math.hypot(dx, dy), R = 55;
    if (L > R) { dx *= R / L; dy *= R / L; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    this.move.x = dx / R; this.move.y = dy / R;
  }

  /** movement axis in camera space: x = right, y = forward */
  axis() {
    let x = 0, y = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    x += this.move.x; y -= this.move.y;
    const L = Math.hypot(x, y);
    if (L > 1) { x /= L; y /= L; }
    return { x, y, mag: Math.min(1, L) };
  }
  get sprint() { return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.sprintToggle; }
  consume() { const e = this.events; this.events = []; return e; }
  takeLook() { const l = { ...this.look }; this.look.x = this.look.y = 0; return l; }
}
