// Unified input: keyboard + mouse (pointer lock) + touch (virtual joystick, camera drag, buttons).
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
    this.attackHeld = false;
    this._bind();
  }

  _bind() {
    const map = { KeyE: 'skill', KeyQ: 'burst', Space: 'jump', KeyF: 'interact', Digit1: 'sw0', Digit2: 'sw1', Digit3: 'sw2', Digit4: 'sw3', KeyZ: 'eat1', KeyX: 'eat2', KeyC: 'eat3', KeyV: 'eat4', KeyB: 'eat5', Tab: 'lock', KeyT: 'sight', KeyP: 'photo', KeyM: 'map', ControlLeft: 'dash', Escape: 'menu', KeyR: 'dash' };
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (map[e.code]) { this.events.push(map[e.code]); if (e.code === 'Space' || e.code === 'Tab') e.preventDefault(); }
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.attackHeld = false; });

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
      const r = joy.getBoundingClientRect(); jc = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      this._joy(t, jc, knob); e.preventDefault();
    }, { passive: false });
    joy.addEventListener('touchmove', (e) => { for (const t of e.changedTouches) if (t.identifier === joyId) this._joy(t, jc, knob); e.preventDefault(); }, { passive: false });
    const endJoy = (e) => { for (const t of e.changedTouches) if (t.identifier === joyId) { joyId = null; this.move.x = this.move.y = 0; knob.style.transform = ''; } };
    joy.addEventListener('touchend', endJoy); joy.addEventListener('touchcancel', endJoy);

    // camera drag on canvas (anywhere not on a control)
    const camTouches = new Map();
    c.addEventListener('touchstart', (e) => { for (const t of e.changedTouches) camTouches.set(t.identifier, { x: t.clientX, y: t.clientY }); e.preventDefault(); }, { passive: false });
    c.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        const p = camTouches.get(t.identifier); if (!p) continue;
        this.look.x += (t.clientX - p.x) * 1.6; this.look.y += (t.clientY - p.y) * 1.6;
        p.x = t.clientX; p.y = t.clientY;
      }
      e.preventDefault();
    }, { passive: false });
    const endCam = (e) => { for (const t of e.changedTouches) camTouches.delete(t.identifier); };
    c.addEventListener('touchend', endCam); c.addEventListener('touchcancel', endCam);

    const btn = (id, ev) => {
      const el = document.getElementById(id);
      el.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); if (typeof ev === 'function') ev(); else this.events.push(ev); el.classList.add('down'); }, { passive: false });
      el.addEventListener('touchend', () => el.classList.remove('down'));
    };
    btn('t-attack', () => { this.events.push('attack'); this.attackHeld = true; }); btn('t-jump', 'jump'); btn('t-lock', 'lock'); btn('t-dash', 'dash'); btn('t-interact', 'interact'); btn('t-sight', 'sight');
    btn('t-sprint', () => { this.sprintToggle = !this.sprintToggle; document.getElementById('t-sprint').style.background = this.sprintToggle ? 'rgba(255,225,77,.5)' : ''; });
    btn('btn-e', 'skill'); btn('btn-q', 'burst');
    // hold attack button = charged attack
    const atk = document.getElementById('t-attack');
    const rel = () => { this.attackHeld = false; };
    atk.addEventListener('touchend', rel); atk.addEventListener('touchcancel', rel);
  }

  _joy(t, c, knob) {
    let dx = t.clientX - c.x, dy = t.clientY - c.y;
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
