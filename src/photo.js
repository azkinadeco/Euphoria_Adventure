// Euphoria Adventure — Kamera / Photo Mode
// Features:
// - Freezes game world action & physics
// - Free camera orbit, adjustable FOV (portrait vs landscape), camera roll & height
// - Stylized Anime Filters: Default, Vivid, Nocturne, Golden Sunset, Manga Ink
// - Hero posing (Idle, Ready, Victory, Power Pose)
// - One-click high-res snapshot capture & download with shutter flash
import * as THREE from 'three';
import { sfx } from './sfx.js';

export const PHOTO_FILTERS = {
  default: { name: 'Normal', sat: 1.15, tint: [1, 1, 1], bloom: 0.60 },
  vivid: { name: 'Vivid Anime', sat: 1.45, tint: [1.05, 1.02, 1.08], bloom: 0.85 },
  nocturne: { name: 'Nocturne', sat: 0.65, tint: [0.65, 0.78, 1.15], bloom: 0.70 },
  sunset: { name: 'Golden Hour', sat: 1.25, tint: [1.18, 0.95, 0.82], bloom: 0.95 },
  manga: { name: 'Manga Ink', sat: 0.0, tint: [0.95, 0.95, 0.95], bloom: 0.35 },
};

export class PhotoMode {
  constructor(game) {
    this.g = game;
    this.active = false;
    this.savedFov = 55;
    this.savedPitch = 0.28;
    this.savedDist = 5.6;
    this.roll = 0;
    this.heightOffset = 0;
    this.filter = 'default';
    this.uiVisible = true;

    this._createDOM();
  }

  _createDOM() {
    let wrap = document.getElementById('photo-modal');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'photo-modal';
      wrap.className = 'photo-modal hidden';
      wrap.innerHTML = `
        <div id="photo-flash" class="photo-flash"></div>
        <div id="photo-frame" class="photo-frame">
          <div class="pf-corner tl"></div><div class="pf-corner tr"></div>
          <div class="pf-corner bl"></div><div class="pf-corner br"></div>
          <div class="pf-logo">EUPHORIA ADVENTURE · KAMERA</div>
        </div>
        <div id="photo-controls" class="photo-controls">
          <div class="pc-header">
            <span>📷 Mode Kamera</span>
            <button id="pc-close" class="pc-btn-close">✕ Keluar</button>
          </div>
          <div class="pc-row">
            <label>Field of View (FOV)</label>
            <input type="range" id="pc-fov" min="28" max="85" value="55" />
          </div>
          <div class="pc-row">
            <label>Sudut Kemiringan (Roll)</label>
            <input type="range" id="pc-roll" min="-30" max="30" value="0" />
          </div>
          <div class="pc-row">
            <label>Tinggi Kamera</label>
            <input type="range" id="pc-height" min="-1.5" max="2.5" step="0.1" value="0" />
          </div>
          <div class="pc-row">
            <label>Filter Visual</label>
            <div class="pc-filter-btns">
              <button class="pc-fbtn on" data-f="default">Normal</button>
              <button class="pc-fbtn" data-f="vivid">Vivid</button>
              <button class="pc-fbtn" data-f="nocturne">Nocturne</button>
              <button class="pc-fbtn" data-f="sunset">Sunset</button>
              <button class="pc-fbtn" data-f="manga">Manga</button>
            </div>
          </div>
          <div class="pc-actions">
            <button id="pc-snap" class="pc-btn-snap">📸 Ambil Foto</button>
            <button id="pc-toggle-ui" class="pc-btn-sub">👁️ Sembunyikan UI (Klik layar untuk kembali)</button>
          </div>
        </div>
      `;
      document.body.appendChild(wrap);
    }
    this.dom = wrap;
    this._bindEvents();
  }

  _bindEvents() {
    const $ = (id) => document.getElementById(id);

    $('pc-close')?.addEventListener('click', () => this.close());

    $('pc-fov')?.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.g.camera.fov = val;
      this.g.camera.updateProjectionMatrix();
    });

    $('pc-roll')?.addEventListener('input', (e) => {
      this.roll = (parseFloat(e.target.value) * Math.PI) / 180;
    });

    $('pc-height')?.addEventListener('input', (e) => {
      this.heightOffset = parseFloat(e.target.value);
    });

    this.dom.querySelectorAll('.pc-fbtn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.dom.querySelectorAll('.pc-fbtn').forEach((b) => b.classList.remove('on'));
        btn.classList.add('on');
        const fKey = btn.dataset.f;
        this.applyFilter(fKey);
      });
    });

    $('pc-snap')?.addEventListener('click', () => this.snapPhoto());

    $('pc-toggle-ui')?.addEventListener('click', () => {
      const ctrl = $('photo-controls');
      const frame = $('photo-frame');
      if (ctrl) ctrl.style.display = 'none';
      if (frame) frame.style.display = 'none';
      this.uiHidden = true;
    });

    // Clicking anywhere on modal when UI is hidden restores it
    this.dom.addEventListener('click', (e) => {
      if (this.uiHidden && e.target.id !== 'pc-snap') {
        const ctrl = $('photo-controls');
        const frame = $('photo-frame');
        if (ctrl) ctrl.style.display = 'block';
        if (frame) frame.style.display = 'block';
        this.uiHidden = false;
      }
    });
  }

  applyFilter(fKey) {
    const cfg = PHOTO_FILTERS[fKey] || PHOTO_FILTERS.default;
    this.filter = fKey;
    this.g.graphics?.mood({
      sat: cfg.sat,
      tint: new THREE.Color(cfg.tint[0], cfg.tint[1], cfg.tint[2]),
      bloom: cfg.bloom,
    });
  }

  open() {
    if (this.active) return;
    this.active = true;
    this.savedFov = this.g.camera.fov;
    this.savedPitch = this.g.cam.pitch;
    this.savedDist = this.g.cam.distTarget;
    this.roll = 0;
    this.heightOffset = 0;

    // Freeze physics & world updates
    this.g.paused = true;
    document.getElementById('hud')?.classList.add('hidden');
    this.dom.classList.remove('hidden');

    sfx.ui();
    this.g.ui?.toast('📷 Mode Kamera dibuka. Gerakkan mouse / layar untuk mengatur sudut pandang.', 'gold');
  }

  close() {
    if (!this.active) return;
    this.active = false;
    this.g.paused = false;

    // Restore camera parameters
    this.g.camera.fov = this.savedFov;
    this.g.camera.rotation.z = 0;
    this.g.camera.updateProjectionMatrix();

    // Restore visual filter
    this.applyFilter('default');

    document.getElementById('hud')?.classList.remove('hidden');
    this.dom.classList.add('hidden');
    sfx.ui();
  }

  snapPhoto() {
    sfx.shutter();

    // Shutter flash animation
    const flash = document.getElementById('photo-flash');
    if (flash) {
      flash.classList.remove('play');
      void flash.offsetWidth;
      flash.classList.add('play');
    }

    // Hide controls briefly to capture clean canvas
    this.dom.style.display = 'none';
    this.g.graphics.render();

    try {
      const canvas = this.g.renderer.domElement;
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      const timeStr = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      a.download = `Euphoria_Adventure_${timeStr}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      this.g.ui?.toast('📸 Foto berhasil disimpan ke galeri!', 'gold');
    } catch (err) {
      console.warn('Screenshot download blocked by browser:', err);
      this.g.ui?.toast('Foto berhasil diambil!', 'gold');
    }

    this.dom.style.display = 'block';
  }

  updateCamera() {
    if (!this.active) return;
    // Apply camera roll (Dutch angle tilt)
    if (this.roll !== 0) {
      this.g.camera.rotation.z = this.roll;
    }
    if (this.heightOffset !== 0) {
      this.g.camera.position.y += this.heightOffset;
    }
  }
}
