// Euphoria Adventure — Full-Screen Interactive World Map & Fast Travel System
// cartographic world map with pan, zoom, waypoint pins, and one-click teleportation.
import { sfx } from './sfx.js';
import { VW, VH, pt, rotated } from './screen.js';
import { MINIMAP, LOC } from './world.js';
import { RLOC } from './reef.js';
import { VLOC } from './volcano.js';
import { FLOC } from './frost.js';
import { MAIN, GLADE_R, ZONES } from './zones.js';
import { REEF } from './reef.js';
import { VOLC } from './volcano.js';
import { FROST } from './frost.js';

export class WorldMap {
  constructor(game) {
    this.g = game;
    this.active = false;
    this.scale = 1.2;
    this.pan = { x: 0, y: 0 };
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.panStart = { x: 0, y: 0 };
    this.selectedWp = null;

    this._createDOM();
  }

  _createDOM() {
    let wrap = document.getElementById('map-modal');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'map-modal';
      wrap.className = 'map-modal hidden';
      wrap.innerHTML = `
        <div class="map-header">
          <div class="map-title">Peta Euphoria<small id="map-where"></small></div>
          <div class="map-hint">Geser untuk melihat · ketuk pin untuk teleport</div>
          <button id="map-close" class="map-close-btn" aria-label="Tutup peta">✕</button>
        </div>
        <div id="map-canvas-container" class="map-canvas-container">
          <canvas id="map-canvas"></canvas>
        </div>
        <div id="map-teleport-card" class="map-teleport-card hidden">
          <div class="mt-header">
            <span id="mt-icon">📍</span>
            <div id="mt-name">Nama Waypoint</div>
          </div>
          <div id="mt-desc" class="mt-desc">Deskripsi lokasi waypoint.</div>
          <div id="mt-status" class="mt-status">Status: Aktif</div>
          <button id="mt-btn-teleport" class="mt-btn-teleport">Teleport Sekarang</button>
        </div>
        <div class="map-controls">
          <button id="map-btn-zin" class="map-ctrl-btn" title="Perbesar">+</button>
          <button id="map-btn-zout" class="map-ctrl-btn" title="Perkecil">−</button>
          <button id="map-btn-recenter" class="map-ctrl-btn" title="Fokus ke Hero">🎯</button>
        </div>
      `;
      document.body.appendChild(wrap);
    }
    this.dom = wrap;
    this.canvas = document.getElementById('map-canvas');
    this.ctx = this.canvas.getContext('2d');
    this._bindEvents();
  }

  _bindEvents() {
    const $ = (id) => document.getElementById(id);

    $('map-close')?.addEventListener('click', () => this.close());
    // the game loop is frozen while the map is open, so the map closes itself on M / Esc
    addEventListener('keydown', (e) => { if (this.active && (e.code === 'KeyM' || e.code === 'Escape')) { e.preventDefault(); e.stopPropagation(); this.close(); } }, true);
    $('map-btn-zin')?.addEventListener('click', () => this.zoom(1.3));
    $('map-btn-zout')?.addEventListener('click', () => this.zoom(0.77));
    $('map-btn-recenter')?.addEventListener('click', () => this.recenterOnPlayer());

    $('mt-btn-teleport')?.addEventListener('click', () => {
      if (this.selectedWp) {
        const id = this.selectedWp.id;
        this.close();
        this.g.teleport(id);
      }
    });

    const container = $('map-canvas-container');

    // Pan with mouse
    container.addEventListener('mousedown', (e) => {
      if (e.target.closest('#map-teleport-card')) return;
      this.isDragging = true;
      this.dragStart = pt(e.clientX, e.clientY);
      this.panStart = { x: this.pan.x, y: this.pan.y };
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.active || !this.isDragging) return;
      const q = pt(e.clientX, e.clientY);
      this.pan.x = this.panStart.x + (q.x - this.dragStart.x);
      this.pan.y = this.panStart.y + (q.y - this.dragStart.y);
      this.render();
    });

    window.addEventListener('mouseup', (e) => {
      if (this.isDragging) {
        this.isDragging = false;
        // Check click on markers if drag distance was minimal
        const q = pt(e.clientX, e.clientY), dist = Math.hypot(q.x - this.dragStart.x, q.y - this.dragStart.y);
        if (dist < 6) {
          this._handleClick(q.x, q.y);
        }
      }
    });

    // Zoom with wheel
    container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 0.87;
      this.zoom(factor);
    }, { passive: false });

    // Touch controls
    let touchStartDist = 0;
    container.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.dragStart = pt(e.touches[0].clientX, e.touches[0].clientY);
        this.panStart = { x: this.pan.x, y: this.pan.y };
      } else if (e.touches.length === 2) {
        touchStartDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    }, { passive: false });

    container.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && this.isDragging) {
        const q = pt(e.touches[0].clientX, e.touches[0].clientY);
        this.pan.x = this.panStart.x + (q.x - this.dragStart.x);
        this.pan.y = this.panStart.y + (q.y - this.dragStart.y);
        this.render();
      } else if (e.touches.length === 2 && touchStartDist > 0) {
        const curDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const factor = curDist / touchStartDist;
        if (Math.abs(factor - 1) > 0.05) {
          this.zoom(factor > 1 ? 1.05 : 0.95);
          touchStartDist = curDist;
        }
      }
      e.preventDefault();
    }, { passive: false });

    container.addEventListener('touchend', (e) => {
      if (e.touches.length === 1) {
        // one finger left after a pinch: continue panning from here instead of jumping
        this.isDragging = true; touchStartDist = 0;
        this.dragStart = pt(e.touches[0].clientX, e.touches[0].clientY);
        this.panStart = { x: this.pan.x, y: this.pan.y };
      } else if (e.touches.length === 0 && this.isDragging) {
        this.isDragging = false;
        // a short tap on a pin opens its card (touch has no mouseup)
        const t = e.changedTouches[0], q = t && pt(t.clientX, t.clientY);
        if (q && Math.hypot(q.x - this.dragStart.x, q.y - this.dragStart.y) < 8) {
          // consume the tap: otherwise the browser's emulated click lands on the card that just
          // opened under the finger and presses "Teleport" by itself (scoped to the map only)
          e.preventDefault();
          this._handleClick(q.x, q.y);
        }
      }
    });
  }

  zoom(factor) {
    // keep the world point under the screen centre where it is
    const cw = this.canvas.width, ch = this.canvas.height;
    const [wx, wz] = this._canvasToWorld(cw / 2, ch / 2);
    this.scale = Math.min(3.2, Math.max(0.65, this.scale * factor));
    const ppm = (MINIMAP.N / MINIMAP.size) * this.scale;
    this.pan.x = cw / 2 - (wx - MINIMAP.x0) * ppm;
    this.pan.y = ch / 2 - (wz - MINIMAP.z0) * ppm;
    this.render();
  }

  /** name of the sky / pocket realm the hero is in, or null on the islands */
  realmName() {
    const G = this.g;
    return G.ch4?.active ? 'Void Rift' : G.ch5?.active ? 'Celestial Asgard' : G.ch6?.active ? 'Ashen Battlefield' : G.spire?.active ? 'Celestial Spire' : G.rift?.active ? 'Starlight Rift' : null;
  }

  recenterOnPlayer() {
    const P = this.g.player.pos;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const ppm = (MINIMAP.N / MINIMAP.size) * this.scale;
    const ix = (P.x - MINIMAP.x0) * ppm;
    const iz = (P.z - MINIMAP.z0) * ppm;
    this.pan.x = cw / 2 - ix;
    this.pan.y = ch / 2 - iz;
    this.render();
  }

  open() {
    if (this.active) return;
    this.active = true;
    this.selectedWp = null;
    this.dom.classList.remove('hidden');
    document.getElementById('map-teleport-card')?.classList.add('hidden');

    this.resize();
    const realm = this.realmName();
    document.getElementById('map-where').textContent = realm ? 'Kamu di ' + realm + ' · pilih pin untuk kembali' : '';
    if (realm) { this.pan.x = 0; this.pan.y = 0; this.scale = 1; this.zoom(1); this._center(LOC.workshop.x, LOC.workshop.z); } else this.recenterOnPlayer();
    sfx.ui();
    // light 2D loop while open: the quest diamond pulses
    const loop = () => { if (!this.active) return; this.render(); this._raf = requestAnimationFrame(loop); };
    cancelAnimationFrame(this._raf); this._raf = requestAnimationFrame(loop);
  }

  _center(x, z) {
    const ppm = (MINIMAP.N / MINIMAP.size) * this.scale;
    this.pan.x = this.canvas.width / 2 - (x - MINIMAP.x0) * ppm;
    this.pan.y = this.canvas.height / 2 - (z - MINIMAP.z0) * ppm;
    this.render();
  }

  close() {
    if (!this.active) return;
    this.active = false;
    this.dom.classList.add('hidden');
    document.getElementById('map-teleport-card')?.classList.add('hidden');
    sfx.ui();
  }

  toggle() {
    if (this.active) this.close();
    else this.open();
  }

  resize() {
    if (!this.canvas) return;
    this.canvas.width = VW();
    this.canvas.height = VH();
    this.render();
  }

  /** queue a text label; _flushLabels draws them by priority (1 = most important) and drops any
   * that would overlap one already placed, after trying a nudge below / above */
  _label(text, x, y, font, color, prio, alpha = 1) { this._labels.push({ text, x, y, font, color, prio, alpha }); }
  _flushLabels(ctx) {
    const boxes = [], hit = (b) => boxes.some((o) => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0);
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.shadowColor = 'rgba(0,0,0,.9)'; ctx.shadowBlur = 4;
    for (const L of this._labels.sort((a, b) => a.prio - b.prio)) {
      ctx.font = L.font;
      const w = ctx.measureText(L.text).width + 6, h = (parseFloat(L.font.match(/(\d+(\.\d+)?)px/)?.[1]) || 12) + 2;
      let placed = null;
      for (const dy of [0, h * 0.9, -h * 0.9]) {
        const b = { x0: L.x - w / 2, x1: L.x + w / 2, y0: L.y + dy - h / 2, y1: L.y + dy + h / 2 };
        if (!hit(b)) { placed = b; L.y += dy; break; }
      }
      if (!placed) continue;
      boxes.push(placed);
      ctx.globalAlpha = L.alpha; ctx.fillStyle = L.color;
      ctx.fillText(L.text, L.x, L.y);
    }
    ctx.restore();
  }

  _worldToCanvas(wx, wz) {
    const ppm = (MINIMAP.N / MINIMAP.size) * this.scale;
    const cx = (wx - MINIMAP.x0) * ppm + this.pan.x;
    const cz = (wz - MINIMAP.z0) * ppm + this.pan.y;
    return [cx, cz];
  }

  _canvasToWorld(cx, cz) {
    const ppm = (MINIMAP.N / MINIMAP.size) * this.scale;
    const wx = (cx - this.pan.x) / ppm + MINIMAP.x0;
    const wz = (cz - this.pan.y) / ppm + MINIMAP.z0;
    return [wx, wz];
  }

  _handleClick(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const o = rotated() ? pt(rect.right, rect.top) : { x: rect.left, y: rect.top }; // the canvas' own top-left corner
    const mx = clientX - o.x;
    const my = clientY - o.y;

    // Check click on waypoints
    const wps = this.g.waypoints();
    let clicked = null;
    let bestDist = 24;

    for (const w of wps) {
      if (!w.pos) continue;
      const [cx, cz] = this._worldToCanvas(w.pos.x, w.pos.z);
      const d = Math.hypot(mx - cx, my - cz);
      if (d < bestDist) {
        bestDist = d;
        clicked = w;
      }
    }

    if (clicked) {
      this._selectWaypoint(clicked, mx, my);
    } else {
      document.getElementById('map-teleport-card')?.classList.add('hidden');
      this.selectedWp = null;
      this.render();
    }
  }

  _selectWaypoint(wp, screenX, screenY) {
    this.selectedWp = wp;
    sfx.ui();

    const card = document.getElementById('map-teleport-card');
    if (!card) return;

    document.getElementById('mt-name').textContent = wp.name;
    document.getElementById('mt-desc').textContent = wp.ok
      ? 'Waypoint aktif. Siap untuk perpindahan instan antar-wilayah.'
      : 'Waypoint ini belum dibuka dalam perjalanan petualanganmu.';

    const statusEl = document.getElementById('mt-status');
    statusEl.textContent = wp.ok ? '✓ Terbuka' : '🔒 Terkunci';
    statusEl.className = 'mt-status ' + (wp.ok ? 'ok' : 'locked');

    const btn = document.getElementById('mt-btn-teleport');
    btn.disabled = !wp.ok;
    btn.textContent = wp.ok ? 'Teleport Sekarang' : 'Terkunci';

    // Position card near clicked point (clamped to screen boundaries)
    const cardW = 260;
    const cardH = 160;
    const x = Math.min(VW() - cardW - 20, Math.max(20, screenX - cardW / 2));
    const y = Math.min(VH() - cardH - 30, Math.max(70, screenY - cardH - 20));

    card.style.left = `${x}px`;
    card.style.top = `${y}px`;
    card.classList.remove('hidden');

    this.render();
  }

  render() {
    if (!this.active || !this.ctx) return;
    const ctx = this.ctx;
    const cw = this.canvas.width;
    const ch = this.canvas.height;

    this._labels = [];
    // Background deep ocean
    ctx.fillStyle = '#0a1420';
    ctx.fillRect(0, 0, cw, ch);

    // Draw world terrain minimap image with scaling
    const img = this.g.world?.minimapImage;
    if (img) {
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      const imgSize = (MINIMAP.N * (MINIMAP.size / MINIMAP.N)) * ((MINIMAP.N / MINIMAP.size) * this.scale);
      const wSize = MINIMAP.size * ((MINIMAP.N / MINIMAP.size) * this.scale);
      ctx.drawImage(img, this.pan.x, this.pan.y, wSize, wSize);
      ctx.restore();
    }

    // Grid coordinates lines (subtle fantasy map lat/long)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let x = -600; x <= 600; x += 150) {
      const [cx] = this._worldToCanvas(x, 0);
      ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, ch); ctx.stroke();
    }
    for (let z = -600; z <= 600; z += 150) {
      const [, cz] = this._worldToCanvas(0, z);
      ctx.beginPath(); ctx.moveTo(0, cz); ctx.lineTo(cw, cz); ctx.stroke();
    }

    this._drawZones(ctx);

    // Region Name Labels
    const regions = [
      { name: 'WHISPERING WOODS', sub: 'Hutan Bisikan', x: MAIN.x, z: MAIN.z - MAIN.r * 0.82, col: '#8fe63a' },
      { name: 'SUNKEN REEF', sub: 'Karang Tenggelam', x: REEF.x, z: REEF.z - REEF.r * 0.75, col: '#4fb4f0' },
      { name: 'INFERNAL CITADEL', sub: 'Pulau Vulkanik', x: VOLC.x, z: VOLC.z - VOLC.r * 0.75, col: '#ff7a2a' },
      { name: 'FROSTVALE', sub: 'Gletser Salju Abadi', x: FROST.x, z: FROST.z - FROST.r * 0.8, col: '#9ee8ff' },
    ];

    for (const r of regions) {
      const [cx, cz] = this._worldToCanvas(r.x, r.z);
      ctx.save();
      ctx.font = 'bold 16px "Cinzel", "Trajan Pro", Georgia, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = r.col;
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 6;
      this._label(r.name, cx, cz - 10, ctx.font, r.col, 2);
      this._label(r.sub, cx, cz + 8, '12px sans-serif', '#e0d8ea', 4);
      ctx.restore();
    }

    // Landmarks / POI Pins
    const wps = this.g.waypoints();
    for (const w of wps) {
      if (!w.pos) continue;
      const [cx, cz] = this._worldToCanvas(w.pos.x, w.pos.z);
      const isSelected = this.selectedWp && this.selectedWp.id === w.id;

      ctx.save();
      // Outer glow ring
      if (isSelected) {
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cz, 18, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Pin background circle
      ctx.fillStyle = w.ok ? (isSelected ? '#ffd700' : '#4facfe') : '#485460';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(cx, cz, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Pin icon
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(w.ok ? '📍' : '🔒', cx, cz);

      // Name tooltip under pin
      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 4;
      this._label(w.name, cx, cz + 20, ctx.font, '#ffffff', 1);

      ctx.restore();
    }

    // Spire & Bounty Board pins
    const poi = [
      { name: '📜 Papan Buronan', x: LOC.workshop.x + 3.8, z: LOC.workshop.z - 2.8, col: '#ffaa00' },
      { name: '🎣 Danau Bintang', x: 55, z: -105, col: '#00d2d3' },
      { name: '🎣 Dermaga Laguna', x: 420, z: 45, col: '#00d2d3' },
    ];
    for (const p of poi) {
      const [cx, cz] = this._worldToCanvas(p.x, p.z);
      ctx.save();
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = p.col;
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 5;
      this._label(p.name, cx, cz, ctx.font, p.col, 3);
      ctx.restore();
    }

    // Active Quest Target Beacon (animated golden diamond)
    const qt = this.g.questTarget();
    if (qt) {
      const [qx, qz] = this._worldToCanvas(qt.x, qt.z);
      const t = performance.now() * 0.003;
      const pulse = Math.sin(t * 3) * 3;
      ctx.save();
      ctx.fillStyle = '#ffd700';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#ffaa00';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(qx, qz - 14 - pulse);
      ctx.lineTo(qx + 10 + pulse, qz);
      ctx.lineTo(qx, qz + 14 + pulse);
      ctx.lineTo(qx - 10 - pulse, qz);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd700';
      ctx.fillText('MISI', qx, qz + 24);
      ctx.restore();
    }

    this._flushLabels(ctx);
    // Player location and orientation arrow
    const P = this.g.player;
    if (P && !this.realmName()) { // in a sky realm the island map has no "you are here"
      const [px, pz] = this._worldToCanvas(P.pos.x, P.pos.z);
      const cy = this.g.cam.yaw;

      ctx.save();
      // View cone
      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.beginPath();
      ctx.moveTo(px, pz);
      const a0 = Math.atan2(-Math.cos(cy), -Math.sin(cy));
      ctx.arc(px, pz, 48 * this.scale, a0 - 0.55, a0 + 0.55);
      ctx.closePath();
      ctx.fill();

      // Hero indicator ring
      ctx.fillStyle = '#b8ff4a';
      ctx.strokeStyle = '#0b120c';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(px, pz, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Heading arrow
      ctx.translate(px, pz);
      ctx.rotate(Math.atan2(Math.cos(P.facing), Math.sin(P.facing)) - Math.PI / 2);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(0, 14);
      ctx.lineTo(6, -4);
      ctx.lineTo(0, 0);
      ctx.lineTo(-6, -4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  /** the five Whispering Woods areas: borders, names, waystones; the area you stand in is lit up */
  _drawZones(ctx) {
    const ppm = (MINIMAP.N / MINIMAP.size) * this.scale;
    const [mx, mz] = this._worldToCanvas(MAIN.x, MAIN.z);
    const R = MAIN.r * ppm * 0.93, g = GLADE_R * ppm;
    const cur = this.g.zoneId?.();
    const hex = (c) => '#' + c.toString(16).padStart(6, '0');
    // canvas angle of a zone bearing (0 = north/-z, clockwise)
    const ang = (a) => a - Math.PI / 2;
    ctx.save();
    // active area tint
    if (['glade', 'north', 'east', 'south', 'west'].includes(cur)) {
      ctx.fillStyle = hex(ZONES[cur].col) + '2a';
      ctx.beginPath();
      if (cur === 'glade') ctx.arc(mx, mz, g, 0, Math.PI * 2);
      else {
        const a = ZONES[cur].a;
        ctx.arc(mx, mz, R, ang(a - Math.PI / 4), ang(a + Math.PI / 4));
        ctx.arc(mx, mz, g, ang(a + Math.PI / 4), ang(a - Math.PI / 4), true);
        ctx.closePath();
      }
      ctx.fill();
    }
    // borders
    ctx.strokeStyle = 'rgba(255, 244, 214, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 5]);
    ctx.beginPath(); ctx.arc(mx, mz, g, 0, Math.PI * 2); ctx.stroke();
    for (let k = 0; k < 4; k++) {
      const a = ang(Math.PI / 4 + k * Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(mx + Math.cos(a) * g, mz + Math.sin(a) * g);
      ctx.lineTo(mx + Math.cos(a) * R, mz + Math.sin(a) * R);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // names
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 5;
    const fs = Math.max(9, Math.min(14, 11 * this.scale));
    for (const id of ['glade', 'north', 'east', 'south', 'west']) {
      const Z = ZONES[id];
      let x = mx, y = mz + g * 0.62;
      if (Z.a !== null) { const r = (g + R) * 0.5; x = mx + Math.cos(ang(Z.a)) * r; y = mz + Math.sin(ang(Z.a)) * r; }
      ctx.font = `${id === cur ? 'bold ' : ''}${fs}px "Cinzel", Georgia, sans-serif`;
      ctx.fillStyle = hex(Z.col);
      ctx.globalAlpha = id === cur ? 1 : 0.8;
      this._label(Z.name.toUpperCase(), x, y, ctx.font, hex(Z.col), id === cur ? 3 : 5, ctx.globalAlpha);
    }
    ctx.globalAlpha = 1;
    // waystones
    for (const w of this.g.world?.waystones || []) {
      const [x, y] = this._worldToCanvas(w.x, w.z);
      ctx.fillStyle = hex(ZONES[w.zone].col);
      ctx.strokeStyle = '#1b1720';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y - 6); ctx.lineTo(x + 3.5, y); ctx.lineTo(x, y + 6); ctx.lineTo(x - 3.5, y);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }
}
