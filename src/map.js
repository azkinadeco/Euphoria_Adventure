// Euphoria Adventure — Full-Screen Interactive World Map & Fast Travel System
// cartographic world map with pan, zoom, waypoint pins, and one-click teleportation.
import { sfx } from './sfx.js';
import { MINIMAP, LOC } from './world.js';
import { RLOC } from './reef.js';
import { VLOC } from './volcano.js';
import { FLOC } from './frost.js';

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
          <div class="map-title">🗺️ Peta Benua Euphoria</div>
          <div class="map-hint">Tarik untuk menggeser · Putar roda untuk zoom · Klik pin untuk Teleport</div>
          <button id="map-close" class="map-close-btn">✕ Tutup (M)</button>
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
      this.dragStart = { x: e.clientX, y: e.clientY };
      this.panStart = { x: this.pan.x, y: this.pan.y };
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.active || !this.isDragging) return;
      this.pan.x = this.panStart.x + (e.clientX - this.dragStart.x);
      this.pan.y = this.panStart.y + (e.clientY - this.dragStart.y);
      this.render();
    });

    window.addEventListener('mouseup', (e) => {
      if (this.isDragging) {
        this.isDragging = false;
        // Check click on markers if drag distance was minimal
        const dist = Math.hypot(e.clientX - this.dragStart.x, e.clientY - this.dragStart.y);
        if (dist < 6) {
          this._handleClick(e.clientX, e.clientY);
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
        this.dragStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
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
        this.pan.x = this.panStart.x + (e.touches[0].clientX - this.dragStart.x);
        this.pan.y = this.panStart.y + (e.touches[0].clientY - this.dragStart.y);
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
      if (this.isDragging && e.touches.length === 0) {
        this.isDragging = false;
      }
    });
  }

  zoom(factor) {
    const newScale = Math.min(3.2, Math.max(0.65, this.scale * factor));
    this.scale = newScale;
    this.render();
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
    this.recenterOnPlayer();
    sfx.ui();
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
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.render();
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
    const mx = clientX - rect.left;
    const my = clientY - rect.top;

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
    const x = Math.min(window.innerWidth - cardW - 20, Math.max(20, screenX - cardW / 2));
    const y = Math.min(window.innerHeight - cardH - 30, Math.max(70, screenY - cardH - 20));

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

    // Region Name Labels
    const regions = [
      { name: 'WHISPERING WOODS', sub: 'Hutan Bisikan', x: 20, z: -20, col: '#8fe63a' },
      { name: 'SUNKEN REEF', sub: 'Karang Tenggelam', x: 420, z: 40, col: '#4fb4f0' },
      { name: 'CALDERA CRATER', sub: 'Kawah Membara', x: -140, z: 310, col: '#ff7a2a' },
      { name: 'FROSTVALE GLACIER', sub: 'Gletser Salju Abadi', x: -280, z: -270, col: '#9ee8ff' },
      { name: 'CELESTIAL ASGARD', sub: 'Benteng Langit', x: 0, z: -980, col: '#ffd700' },
    ];

    for (const r of regions) {
      const [cx, cz] = this._worldToCanvas(r.x, r.z);
      ctx.save();
      ctx.font = 'bold 16px "Cinzel", "Trajan Pro", Georgia, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = r.col;
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 6;
      ctx.fillText(r.name, cx, cz - 10);
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#e0d8ea';
      ctx.fillText(r.sub, cx, cz + 8);
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
      ctx.fillText(w.name, cx, cz + 20);

      ctx.restore();
    }

    // Spire & Bounty Board pins
    const poi = [
      { name: '⚔️ Menara Ujian (Spire)', x: 0, z: -1200, col: '#bf55ec' },
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
      ctx.fillText(p.name, cx, cz);
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

    // Player location and orientation arrow
    const P = this.g.player;
    if (P) {
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
}
