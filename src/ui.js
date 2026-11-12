// HUD, dialog (visual-novel style), toasts, damage numbers, minimap, menu.
import * as THREE from 'three';
import { SPEAKERS, SIDE, QUESTS } from './story.js';
import { ELEMENT_COLOR } from './heroes.js';
import { LOC, MINIMAP } from './world.js';
import { RLOC } from './reef.js';
import { sfx } from './sfx.js';
import { performWish } from './gacha.js';
import { ARTIFACT_SETS, SLOTS, upgradeArtifact } from './artifacts.js';
import { WEAPON_BY_ID } from './gacha.js';
import { SPIRE_FLOORS } from './spire.js';
import { BOUNTIES } from './bounties.js';

const $ = (id) => document.getElementById(id);
const clean = (s) => s.replace(/\s*\(EO\)/g, '');

export class UI {
  constructor(game) {
    this.game = game;
    this.nums = [];
    this.mm = $('minimap').getContext('2d');
    this.mmTick = 0;
    this.dialogOpen = false;
    this._bindMenu();
  }

  // ---------------- small feedback ----------------
  toast(text, cls = '') {
    const el = document.createElement('div');
    el.className = 'toast ' + cls;
    el.textContent = text;
    $('toasts').appendChild(el);
    setTimeout(() => el.remove(), 2900);
    while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
  }
  voice(key) { const H = this.game.player.hero; if (H.voice[key]) this.toast(H.name + ': “' + H.voice[key] + '”'); }

  // ---------------- party ----------------
  buildParty() {
    const P = this.game.player, wrap = $('party');
    wrap.innerHTML = '';
    this.partyEls = P.members.map((m, i) => {
      const el = document.createElement('div');
      el.className = 'pm';
      el.style.setProperty('--c', m.def.color);
      el.innerHTML = `<span class="key">${i + 1}</span><div class="pinfo"><div class="pname"><span>${m.def.name}</span><span style="color:${ELEMENT_COLOR[m.def.element]}">✦</span></div><div class="pbar"><div></div></div><div class="pen"><div></div></div></div><div class="pimg"><img src="${m.def.portrait}" alt=""></div>`;
      const sw = (e) => { e.preventDefault(); e.stopPropagation(); this.game.input.events.push('sw' + i); };
      el.addEventListener('touchstart', sw, { passive: false });
      el.addEventListener('mousedown', sw);
      wrap.appendChild(el);
      return el;
    });
    wrap.classList.toggle('hidden', P.members.length < 2);
    this.onSwitch();
  }
  onSwitch() {
    const H = this.game.player.hero;
    $('char-img').src = H.portrait;
    $('char-nm').textContent = H.name;
    $('char-elem').textContent = '✦ ' + H.element;
    $('char-elem').style.color = ELEMENT_COLOR[H.element];
    $('char-portrait').style.borderColor = H.color;
    $('icon-e').textContent = H.icons.e;
    $('icon-q').textContent = H.icons.q;
    $('btn-e').style.borderColor = $('btn-q').style.borderColor = H.color;
    $('energy-fill').style.background = `linear-gradient(0deg, ${H.color}aa, ${H.color}22)`;
  }
  updateStarlightHUD() { const el = $('starlight-num'); if (el) el.textContent = this.game.state.starlight || 0; }
  banner(text) { this.bigText(String(text).split('\n')[0], '#ffd66b'); const rest = String(text).split('\n')[1]; if (rest) this.toast(rest, 'gold big'); }
  bigText(text, color = '#fff') {
    const el = $('bigtext'); el.textContent = text; el.style.color = color;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  }
  hurt() { const v = $('hurt-vignette'); v.classList.add('on'); clearTimeout(this._hv); this._hv = setTimeout(() => v.classList.remove('on'), 220); }
  flashSkill(k) { const el = $('btn-' + k); el.animate([{ transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'none' }], { duration: 180 }); }

  damageNumber(world, n, cls = '') {
    const el = document.createElement('div');
    el.className = 'dmg ' + cls;
    el.textContent = cls === 'crit' ? n + '!' : n;
    $('dmg-layer').appendChild(el);
    const jitter = new THREE.Vector3((Math.random() - 0.5) * 0.6, Math.random() * 0.3, (Math.random() - 0.5) * 0.6);
    this.nums.push({ el, pos: world.clone().add(jitter), t: 0 });
  }

  questFlash() { const q = $('quest-tracker'); q.classList.remove('flash'); void q.offsetWidth; q.classList.add('flash'); }

  // ---------------- dialog ----------------
  async dialog(lines) {
    const G = this.game;
    this.dialogOpen = true;
    G.inputLocked = true;
    document.exitPointerLock?.();
    const box = $('dialog');
    box.classList.remove('hidden');
    $('dlg-left').className = 'dlg-portrait left empty';
    $('dlg-right').className = 'dlg-portrait right empty';
    let skip = false;
    const onSkip = () => { skip = true; this._advance?.(true); };
    $('dlg-skip').onclick = onSkip;
    const queue = [...lines];
    while (queue.length && !skip) {
      const line = queue.shift();
      if (line[0] === '?') {
        const idx = await this._choice(line[1], line[2]);
        if (line[3] && line[3][idx]) queue.unshift(line[3][idx]);
        G.state.choices = G.state.choices || {};
        G.state.choices[line[1]] = idx;
        continue;
      }
      await this._line(line[0], clean(line[1]));
    }
    box.classList.add('hidden');
    this.dialogOpen = false;
    G.inputLocked = false;
    G.input.consume();
  }

  _setPortraits(spk) {
    const s = SPEAKERS[spk];
    const side = SIDE[spk];
    const L = $('dlg-left'), R = $('dlg-right');
    if (side && s.portrait) {
      const el = side === 'left' ? L : R;
      if (el.dataset.spk !== spk) { el.src = s.portrait; el.dataset.spk = spk; }
      el.classList.remove('empty');
    }
    L.classList.toggle('active', L.dataset.spk === spk);
    R.classList.toggle('active', R.dataset.spk === spk);
  }

  _line(spk, text) {
    return new Promise((resolve) => {
      const s = SPEAKERS[spk] || { name: spk, color: '#fff' };
      const nameEl = $('dlg-name'), textEl = $('dlg-text');
      nameEl.style.display = s.name ? '' : 'none';
      nameEl.textContent = s.name; nameEl.style.background = s.color;
      textEl.classList.toggle('narr', spk === 'nar');
      $('dlg-choices').innerHTML = '';
      $('dlg-hint').style.display = '';
      this._setPortraits(spk);
      let i = 0, done = false;
      textEl.textContent = '';
      const iv = setInterval(() => {
        i += 2;
        textEl.textContent = text.slice(0, i);
        if (i >= text.length) { clearInterval(iv); done = true; }
      }, 30);
      sfx.ui();
      const finish = () => { cleanup(); resolve(); };
      this._advance = (force) => {
        if (force) { clearInterval(iv); finish(); return; }
        if (!done) { clearInterval(iv); textEl.textContent = text; done = true; } else finish();
      };
      const onKey = (e) => { if (['Space', 'Enter', 'KeyF'].includes(e.code)) { e.preventDefault(); this._advance(); } };
      const onClick = () => this._advance();
      $('dlg-box').addEventListener('click', onClick);
      addEventListener('keydown', onKey);
      const cleanup = () => { $('dlg-box').removeEventListener('click', onClick); removeEventListener('keydown', onKey); this._advance = null; };
    });
  }

  _choice(spk, options) {
    return new Promise((resolve) => {
      this._setPortraits(spk);
      const s = SPEAKERS[spk];
      $('dlg-name').textContent = s.name; $('dlg-name').style.background = s.color; $('dlg-name').style.display = '';
      $('dlg-text').textContent = '';
      $('dlg-hint').style.display = 'none';
      const wrap = $('dlg-choices');
      wrap.innerHTML = '';
      options.forEach((o, i) => {
        const b = document.createElement('button');
        b.textContent = '▸ ' + o;
        b.onclick = (e) => { e.stopPropagation(); sfx.ui(); wrap.innerHTML = ''; this._advance = null; resolve(i); };
        wrap.appendChild(b);
      });
      this._advance = (force) => { if (force) { wrap.innerHTML = ''; resolve(0); } };
    });
  }

  // ---------------- menu ----------------
  _bindMenu() {
    $('btn-menu').onclick = () => this.toggleMenu();
    $('m-resume').onclick = () => this.toggleMenu(false);
    $('m-save').onclick = () => { this.game.save(); this.toast('Tersimpan ✓'); };
    $('btn-sight').onclick = () => this.game.sight.toggle();
    $('weather-badge').onclick = () => this.game.weather.cycleNext();
    $('btn-wish').onclick = () => this.openWish();
    $('m-wish').onclick = () => { this.toggleMenu(false); this.openWish(); };
    $('wish-close').onclick = () => $('wish-modal').classList.add('hidden');
    $('wish-1').onclick = () => this._doWish(1);
    $('wish-10').onclick = () => this._doWish(10);

    $('m-artifacts').onclick = () => { this.toggleMenu(false); this.openArtifacts(); };
    $('art-close').onclick = () => $('artifact-modal').classList.add('hidden');

    $('m-spire').onclick = () => { this.toggleMenu(false); this.openSpire(); };
    $('spire-close').onclick = () => $('spire-modal').classList.add('hidden');
    $('btn-photo').onclick = () => this.game.photo.open();
    $('m-photo').onclick = () => { this.toggleMenu(false); this.game.photo.open(); };
    $('m-bounties').onclick = () => { this.toggleMenu(false); this.openBounties(); };
    $('bounty-close').onclick = () => $('bounty-modal').classList.add('hidden');
    $('btn-map').onclick = () => this.game.map.toggle();
    $('m-map').onclick = () => { this.toggleMenu(false); this.game.map.open(); };
    $('m-cook').onclick = () => { this.toggleMenu(false); this.game.cooking.open(); };
    $('minimap-wrap').onclick = (e) => {
      if (e.target.id === 'weather-badge' || e.target.closest('#weather-badge')) return;
      this.game.map.open();
    };
    $('m-reset').onclick = () => {
      const b = $('m-reset');
      if (b.dataset.armed !== '1') { b.dataset.armed = '1'; b.textContent = 'Yakin? Tekan lagi untuk hapus'; setTimeout(() => { b.dataset.armed = ''; b.textContent = 'Hapus save & ulang'; }, 3000); return; }
      try { localStorage.removeItem(this.game.SAVE_KEY); } catch (e) { /* storage blocked */ }
      location.reload();
    };
    $('m-gfx').onclick = () => {
      const order = ['low', 'med', 'high', 'ultra'];
      const next = order[(order.indexOf(this.game.gfx) + 1) % 3];
      this.game.applyGfx(next, true);
      this._gfxLabel();
    };
    $('m-profile').onclick = () => {
      const p = $('profile');
      p.classList.toggle('hidden');
      const P = this.game.player, H = P.hero, L = H.profile;
      p.innerHTML = `<b>${H.name}</b> — ${H.title}<br/>Elemen: <b style="color:${ELEMENT_COLOR[H.element]}">${H.element}</b> · Kelas: <b>${H.role}</b><br/>
        Ulang tahun: ${L.birthday} · Tinggi: ${L.height}<br/>Suka: ${L.likes}<br/>Tidak suka: ${L.dislikes}<br/>Hobi: ${L.hobby}<br/><br/>
        Lv.${P.level} · HP ${Math.ceil(P.hp)}/${P.maxHp} · ATK ${P.atk} · 🦪 Mutiara Laut ${this.game.state.pearls || 0}/${this.game.state.chestTotal || 8}<br/><br/>${H.kit.map((k) => '• ' + k).join('<br/>')}
        <br/><br/><b>Reaksi elemen</b><br/>• Pusaran — WIND mengenai musuh ber-aura WATER/LIGHT: damage area + menyebarkan aura.<br/>• Prism — WATER + LIGHT: damage ×1.75.<br/>Aura terlihat sebagai kristal berwarna di atas musuh.`;
    };
  }
  _buildTeamMenu() {
    const P = this.game.player, wrap = $('team');
    wrap.innerHTML = '';
    this._pick = new Set(P.members.map((m) => m.id));
    for (const m of P.roster) {
      const b = document.createElement('button');
      const paint = () => { b.classList.toggle('on', this._pick.has(m.id)); b.textContent = (this._pick.has(m.id) ? '✓ ' : '') + m.def.name + ' · ' + m.def.element; };
      b.onclick = () => {
        if (this._pick.has(m.id)) { if (this._pick.size > 1) this._pick.delete(m.id); }
        else if (this._pick.size < 4) this._pick.add(m.id);
        else this.toast('Party maksimal 4 hero');
        paint();
      };
      paint(); wrap.appendChild(b);
    }
    $('team-apply').onclick = () => { if (this.game.setTeam([...this._pick])) this.toggleMenu(false); };
    $('team-apply').parentElement.classList.toggle('hidden', P.roster.length <= 1);
  }
  _buildCookMenu() {
    const G = this.game, S = G.state, wrap = $('cook');
    wrap.innerHTML = '';
    const near = G.nearFire();
    $('cook-hint').textContent = near ? `(🫐 ${S.inv.berry} · 🐟 ${S.inv.fish} · 🌶️ ${S.inv.pepper || 0})` : '(dekati api unggun)';
    for (const [id, label] of [['grilled', '🍢 Ikan Bakar — 2🫐 1🐟 (pulih party 35%)'], ['cool', '🧊 Jus Sejuk — 3🫐 1🐟 (kebal panas 5 mnt)'], ['soup', '🍲 Sup Pedas — 1🫐 1🐟 1🌶️ (hangat 5 mnt)']]) {
      const b = document.createElement('button');
      b.textContent = label; b.disabled = !near;
      b.onclick = () => { if (G.cook(id)) this._buildCookMenu(); };
      wrap.appendChild(b);
    }
  }

  // ---------------- wish ----------------
  openWish() {
    const S = this.game.state;
    $('wish-modal').classList.remove('hidden');
    $('wish-pity-text').textContent = `Pity Garansi Bintang 5: ${15 - (S.pity5 || 0)} tarikan`;
  }
  _doWish(count) {
    const res = performWish(this.game, count);
    if (!res) return;
    const S = this.game.state;
    $('wish-pity-text').textContent = `Pity Garansi Bintang 5: ${15 - (S.pity5 || 0)} tarikan`;
    const wrap = $('wish-results-wrap');
    const grid = $('wish-results-grid');
    wrap.classList.remove('hidden');
    grid.innerHTML = '';
    for (const r of res.results) {
      const card = document.createElement('div');
      card.className = `wish-card r-${r.rarity}`;
      const icon = r.item.icon || (r.kind === 'artifact' ? (SLOTS[r.item.slot]?.icon || '🛡️') : '✦');
      const name = r.item.name || `${r.item.setName} (${r.item.slotName})`;
      card.innerHTML = `<div class="icon">${icon}</div><div class="name">${name}</div><div class="stars">${'★'.repeat(r.rarity)}</div>`;
      grid.appendChild(card);
    }
  }

  // ---------------- weapons ----------------
  _renderWeapons(heroMem) {
    const G = this.game, S = G.state, wrap = $('art-weapons');
    wrap.innerHTML = '';
    const owned = S.weapons || [];
    const head = document.createElement('div');
    head.className = 'art-weapon-head';
    const cur = WEAPON_BY_ID[heroMem.weapon];
    head.innerHTML = `<b>Senjata ${heroMem.def.name}:</b> ${cur ? `${cur.icon} ${cur.name} — ${cur.desc}` : 'belum ada'}`;
    wrap.appendChild(head);
    if (!owned.length) { const n = document.createElement('div'); n.className = 'art-weapon-empty'; n.textContent = 'Belum punya senjata. Dapatkan dari Doa Bintang.'; wrap.appendChild(n); return; }
    for (const w of owned) {
      const b = document.createElement('button');
      const holder = G.player.roster.find((m) => m.weapon === w.id);
      b.className = 'art-weapon-btn' + (holder === heroMem ? ' on' : '');
      b.textContent = `${w.icon} ${w.name} ${'★'.repeat(w.rarity)}` + (holder && holder !== heroMem ? ` (dipakai ${holder.def.name})` : '');
      b.title = w.desc;
      b.onclick = () => {
        if (holder) holder.weapon = null;
        if (holder !== heroMem) heroMem.weapon = w.id;
        sfx.ui(); this._renderArtifactsUI();
      };
      wrap.appendChild(b);
    }
  }

  // ---------------- artifacts ----------------
  openArtifacts() {
    $('artifact-modal').classList.remove('hidden');
    const P = this.game.player;
    this._selectedArtHero = this._selectedArtHero || P.m.id;
    this._renderArtifactsUI();
  }
  _renderArtifactsUI() {
    const P = this.game.player, S = this.game.state;
    const heroMem = P.roster.find((x) => x.id === this._selectedArtHero) || P.m;
    const tabs = $('art-hero-tabs');
    tabs.innerHTML = '';
    for (const h of P.roster) {
      const b = document.createElement('button');
      b.className = `art-hero-tab ${h.id === heroMem.id ? 'active' : ''}`;
      b.textContent = h.def.name;
      b.onclick = () => { this._selectedArtHero = h.id; this._renderArtifactsUI(); };
      tabs.appendChild(b);
    }

    const slotsWrap = $('art-slots');
    slotsWrap.innerHTML = '';
    const slots = ['flower', 'plume', 'sands', 'goblet', 'circlet'];
    for (const s of slots) {
      const art = heroMem.artifacts[s];
      const card = document.createElement('div');
      card.className = `art-slot-card ${art ? 'equipped' : ''}`;
      const slotDef = SLOTS[s];
      if (art) {
        card.innerHTML = `<div style="font-size:20px">${slotDef.icon}</div><b>${art.setName}</b><div style="color:#ffd700;font-size:11px">${'★'.repeat(art.rarity)} +${art.level}</div><div style="color:#9fe8ff">${art.mainStatName}: ${art.statLabel}</div>`;
        const unequipBtn = document.createElement('button');
        unequipBtn.textContent = 'Lepas';
        unequipBtn.style.cssText = 'margin-top:6px;padding:2px 8px;font-size:11px;border-radius:10px;background:#ff4d6d;border:none;color:#fff;cursor:pointer;';
        unequipBtn.onclick = () => {
          if (!S.inventoryArtifacts) S.inventoryArtifacts = [];
          S.inventoryArtifacts.push(art);
          heroMem.artifacts[s] = null;
          heroMem.refreshHp();
          this._renderArtifactsUI();
        };
        card.appendChild(unequipBtn);
      } else {
        card.innerHTML = `<div style="font-size:20px;opacity:0.4">${slotDef.icon}</div><div style="opacity:0.6">${slotDef.name}</div><div style="color:#888;font-size:11px">Kosong</div>`;
      }
      slotsWrap.appendChild(card);
    }

    this._renderWeapons(heroMem);
    const bonus = heroMem.getArtifactBonus();
    const bonusBox = $('art-bonus-box');
    const setList = Object.entries(bonus.setCounts || {}).map(([k, count]) => {
      const sDef = ARTIFACT_SETS[k];
      return `<b style="color:${sDef?.color || '#fff'}">${sDef?.name} (${count} pcs):</b> ${count >= 2 ? `[2P] ${sDef.twoPiece} ` : ''}${count >= 4 ? `| [4P] ${sDef.fourPiece}` : ''}`;
    }).filter(Boolean);
    bonusBox.innerHTML = `<b>Stat Bonus Artifak:</b> HP +${Math.round(bonus.flatHp)} | ATK +${Math.round(bonus.flatAtk)} (${(bonus.atkPct * 100).toFixed(1)}%) | Crit Rate +${(bonus.critRate * 100).toFixed(1)}% | Crit DMG +${(bonus.critDmg * 100).toFixed(1)}%<br/>${setList.length ? setList.join('<br/>') : '<i>Belum ada set bonus aktif (pasang minimal 2 artifak dari set yang sama).</i>'}`;

    const invList = $('art-inv-list');
    invList.innerHTML = '';
    const inv = S.inventoryArtifacts || [];
    if (!inv.length) {
      invList.innerHTML = '<div style="color:#888;grid-column:1/-1;text-align:center;padding:16px;">Tidak ada artifak di inventaris. Dapatkan dari Doa Bintang (Wish) atau Menara Ujian (Spire)!</div>';
    } else {
      inv.forEach((art, idx) => {
        const itemCard = document.createElement('div');
        itemCard.className = `art-item-card r-${art.rarity}`;
        itemCard.innerHTML = `<div><div style="display:flex;justify-content:space-between"><b>${art.setName}</b><span style="color:#ffd700">${'★'.repeat(art.rarity)}</span></div><div style="color:#ccc;font-size:11px">${art.slotName} (+${art.level})</div><div style="color:#9fe8ff;font-weight:700">${art.mainStatName}: ${art.statLabel}</div></div>`;
        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:6px;margin-top:8px;';

        const eqBtn = document.createElement('button');
        eqBtn.textContent = 'Pasang';
        eqBtn.style.cssText = 'flex:1;padding:4px;font-size:11px;border-radius:8px;background:#ffd700;color:#100;font-weight:700;border:none;cursor:pointer;';
        eqBtn.onclick = () => {
          const old = heroMem.artifacts[art.slot];
          if (old) inv.push(old);
          heroMem.artifacts[art.slot] = art;
          inv.splice(idx, 1);
          heroMem.refreshHp();
          this._renderArtifactsUI();
          this.toast(`Artifak dipasang pada ${heroMem.def.name}!`);
        };

        const upBtn = document.createElement('button');
        upBtn.textContent = `Tingkatkan (+1)`;
        upBtn.style.cssText = 'flex:1;padding:4px;font-size:11px;border-radius:8px;background:#4fb4f0;color:#fff;border:none;cursor:pointer;';
        upBtn.onclick = () => {
          if (upgradeArtifact(art, S)) {
            sfx.pickup();
            this._renderArtifactsUI();
            this.toast(`Artifak ditingkatkan ke Lv.${art.level}!`, 'gold');
          } else {
            this.toast('Bahan tidak cukup (Butuh 1🐟 / 2🫐)');
          }
        };

        btnRow.appendChild(eqBtn);
        btnRow.appendChild(upBtn);
        itemCard.appendChild(btnRow);
        invList.appendChild(itemCard);
      });
    }
  }

  // ---------------- spire ----------------
  openSpire() {
    $('spire-modal').classList.remove('hidden');
    const wrap = $('spire-floors-list');
    wrap.innerHTML = '';
    const S = this.game.state;
    for (const fl of SPIRE_FLOORS) {
      const card = document.createElement('div');
      card.className = 'spire-floor-card';
      const stars = S.spireStars?.[fl.floor] || 0;
      card.innerHTML = `
        <div class="spire-info">
          <div class="fl-title">${fl.name}</div>
          <div style="font-size:12px;color:#d0c0e8;margin-bottom:4px;">${fl.desc}</div>
          <div class="fl-disorder">${fl.disorder}</div>
        </div>
        <div style="display:flex;align-items:center;">
          <div class="spire-stars">${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>
          <button style="padding:8px 16px;border-radius:12px;background:#ffd700;color:#201000;font-weight:800;border:none;cursor:pointer;">Tantang</button>
        </div>
      `;
      card.querySelector('button').onclick = () => {
        $('spire-modal').classList.add('hidden');
        this.game.teleport('spire', fl.floor);
      };
      wrap.appendChild(card);
    }
  }

  // ---------------- bounties ----------------
  openBounties() {
    $('bounty-modal').classList.remove('hidden');
    const wrap = $('bounty-list');
    wrap.innerHTML = '';
    const S = this.game.state;
    for (const b of BOUNTIES) {
      const card = document.createElement('div');
      card.className = 'bounty-item-card';
      const done = this.game.bounties.isCompleted(b.id);
      const isTarget = S.activeBountyId === b.id;
      const open = this.game.bounties.isUnlocked(b);
      card.innerHTML = `
        <div class="bounty-item-icon" style="background:${b.color}22; border: 2px solid ${b.color};">${b.icon}</div>
        <div class="bounty-item-info">
          <div class="bounty-item-title"><span style="color:${b.color}; font-weight:800; font-size:16px;">${b.name}</span> · <small style="color:#d0c0e8;">${b.title}</small></div>
          <div class="bounty-item-loc" style="font-size:12px; color:#ffd700; margin: 3px 0;">📍 ${b.locName}</div>
          <div class="bounty-item-desc" style="font-size:12px; color:#d8d0e8; margin-bottom: 6px;">${b.desc}</div>
          <div class="bounty-item-traits" style="display:flex; gap:8px; margin-bottom: 6px; font-size:11px;">
            <span style="background:rgba(255,75,75,0.2); border:1px solid #ff4757; color:#ff7070; padding:2px 8px; border-radius:10px;">⚡ ${b.weakness}</span>
            <span style="background:rgba(80,140,255,0.2); border:1px solid #54a0ff; color:#70b0ff; padding:2px 8px; border-radius:10px;">🛡️ ${b.resist}</span>
          </div>
          <div class="bounty-item-rewards" style="font-size:12px; color:#ffd700;">
            Hadiah: <b>✦ ${b.rewardStarlight} Starlight</b> + <b>1 Artifak 5★ ${ARTIFACT_SETS[b.rewardArtifactSet].name}</b>
          </div>
        </div>
        <div class="bounty-item-action">
          <button class="bounty-hunt-btn ${done ? 'done' : isTarget ? 'tracking' : ''}">${done ? '✓ Selesai' : !open ? '🔒 ' + b.unlockText : isTarget ? 'Sedang Diburu' : 'Mulai Berburu'}</button>
        </div>
      `;
      const btn = card.querySelector('.bounty-hunt-btn');
      if (!done && open) {
        btn.onclick = () => {
          $('bounty-modal').classList.add('hidden');
          this.game.bounties.startBounty(b.id);
        };
      } else {
        btn.disabled = true;
      }
      wrap.appendChild(card);
    }
  }

  _gfxLabel() { $('m-gfx').textContent = 'Grafis: ' + this.game.gfx.toUpperCase() + (this.game.gfxAuto ? ' (otomatis)' : ''); }
  toggleMenu(force) {
    const m = $('menu');
    const show = force ?? m.classList.contains('hidden');
    if (this.dialogOpen) return;
    m.classList.toggle('hidden', !show);
    if (show) {
      this._gfxLabel();
      this._buildTeamMenu(); this._buildCookMenu();
      const tp = $('tp'); tp.innerHTML = '';
      for (const w of this.game.waypoints()) {
        const b = document.createElement('button');
        b.textContent = (w.ok ? '◆ ' : '🔒 ') + w.name; b.disabled = !w.ok;
        b.onclick = () => this.game.teleport(w.id);
        tp.appendChild(b);
      }
    }
    this.game.paused = show;
    if (show) document.exitPointerLock?.();
  }

  // ---------------- per-frame HUD ----------------
  update(dt) {
    const G = this.game, P = G.player, S = G.state;
    if ($('starlight-num')) $('starlight-num').textContent = S.starlight || 0;
    // bars
    const hpP = Math.max(0, P.hp / P.maxHp);
    $('hp-fill').style.width = hpP * 100 + '%';
    $('hp-fill').classList.toggle('low', hpP < 0.3);
    $('hp-text').textContent = `${Math.ceil(Math.max(0, P.hp))}/${P.maxHp}`;
    $('hunger-fill').style.width = P.hunger + '%';
    $('exp-fill').style.width = (P.exp / P.expNeed()) * 100 + '%';
    $('char-lv').textContent = 'Lv.' + P.level;
    const ring = $('stamina-ring');
    ring.classList.toggle('show', P.stamina < 99.5);
    $('stamina-arc').style.strokeDashoffset = 100.5 * (1 - P.stamina / 100);
    $('stamina-arc').classList.toggle('low', P.exhausted);

    // skills
    const e = $('btn-e'), q = $('btn-q');
    const H = P.hero;
    e.querySelector('.cd').style.setProperty('--p', (P.cd.skill / H.skillCD) * 100 + '%');
    e.querySelector('.cd').textContent = P.cd.skill > 0 ? P.cd.skill.toFixed(1) : '';
    q.querySelector('.cd').style.setProperty('--p', (P.cd.burst / H.burstCD) * 100 + '%');
    q.querySelector('.cd').textContent = P.cd.burst > 0 ? P.cd.burst.toFixed(1) : '';
    $('energy-fill').style.height = (P.energy / H.burstCost) * 100 + '%';
    const burstOk = H.id !== 'luby' || S.purrbot;
    q.classList.toggle('locked', !burstOk);
    q.classList.toggle('ready', burstOk && P.energy >= H.burstCost && P.cd.burst <= 0);
    $('shield-fill').style.width = Math.min(100, (P.m.shield / P.maxHp) * 100) + '%';
    if (this.partyEls) P.members.forEach((m, i) => {
      const el = this.partyEls[i];
      el.classList.toggle('active', i === P.active);
      el.classList.toggle('dead', m.dead);
      el.querySelector('.pbar div').style.width = Math.max(0, m.hp / m.maxHp) * 100 + '%';
      el.querySelector('.pen div').style.width = (m.energy / m.def.burstCost) * 100 + '%';
    });

    // inventory
    $('cnt-berry').textContent = S.inv.berry;
    $('cnt-fish').textContent = S.inv.fish;
    $('cnt-grilled').textContent = S.inv.grilled || 0; $('cnt-cool').textContent = S.inv.cool || 0;
    $('cnt-soup').textContent = S.inv.soup || 0; $('cnt-pepper').textContent = S.inv.pepper || 0;
    $('inv-soup').classList.toggle('hidden', !(S.inv.soup > 0) && !S.frostCamp);
    $('inv-pepper').classList.toggle('hidden', !(S.inv.pepper > 0));
    $('inv-grilled').classList.toggle('hidden', !(S.inv.grilled > 0) && !S.volcCamp);
    $('inv-cool').classList.toggle('hidden', !(S.inv.cool > 0) && !S.volcCamp);
    const st = [];
    if (P.hot) st.push('<span class="st hot">🔥 Kepanasan</span>');
    if (P.coolT > 0) st.push(`<span class="st cool">🧊 Sejuk ${Math.floor(P.coolT / 60)}:${String(Math.floor(P.coolT % 60)).padStart(2, '0')}</span>`);
    if (P.swimming) st.push('<span class="st cool">🌊 Berenang</span>');
    if (P.freezing) st.push('<span class="st cold">❄ Kedinginan</span>');
    if (P.warmT > 0) st.push(`<span class="st warm">🍲 Hangat ${Math.floor(P.warmT / 60)}:${String(Math.floor(P.warmT % 60)).padStart(2, '0')}</span>`);
    if (P.gliding) st.push('<span class="st cool">🪁 Glider</span>');
    const html = st.join('');
    if (html !== this._st) { this._st = html; $('status-line').innerHTML = html; }
    $('cnt-scrap').textContent = S.parts.filter(Boolean).length + '/3';
    $('inv-scrap').classList.toggle('hidden', S.step !== 'parts');

    // quest
    const Q = QUESTS[S.step];
    $('quest-chapter').textContent = Q.ch || 'PROLOG · WHISPERING WOODS';
    $('quest-title').textContent = Q.title;
    $('quest-desc').textContent = Q.desc(S);

    // prompt
    const it = G.nearInteract;
    $('prompt').classList.toggle('hidden', !it || this.dialogOpen);
    $('t-interact').classList.toggle('hidden', !it || this.dialogOpen);
    if (it) $('prompt-text').textContent = it.label;

    // boss
    const boss = G.activeBoss();
    const bossOn = !!boss;
    if (bossOn) $('boss-name').textContent = boss.def.name;
    $('boss-bar').classList.toggle('hidden', !bossOn);
    if (bossOn) $('boss-fill').style.width = (boss.hp / boss.maxHp) * 100 + '%';

    $('clock').textContent = (G.world.nightAmt > 0.5 ? '🌙 ' : '☀️ ') + G.world.clockString();

    // damage numbers follow world positions
    const cam = G.camera, w = innerWidth, h = innerHeight, v = new THREE.Vector3();
    for (let i = this.nums.length - 1; i >= 0; i--) {
      const n = this.nums[i];
      n.t += dt;
      if (n.t > 0.9) { n.el.remove(); this.nums.splice(i, 1); continue; }
      v.copy(n.pos).project(cam);
      if (v.z > 1) { n.el.style.display = 'none'; continue; }
      n.el.style.display = '';
      n.el.style.left = ((v.x + 1) / 2) * w + 'px';
      n.el.style.top = ((1 - v.y) / 2) * h + 'px';
    }

    if ((this.mmTick += dt) > 0.08) { this.mmTick = 0; this._minimap(); }
  }

  _minimap() {
    const G = this.game, P = G.player, g = this.mm, N = 180;
    const RANGE = 150; // meters across
    const img = G.world.minimapImage, ppm = MINIMAP.N / MINIMAP.size; // image px per meter
    const ix = (P.pos.x - MINIMAP.x0) * ppm, iz = (P.pos.z - MINIMAP.z0) * ppm, sw = RANGE * ppm;
    g.save();
    g.clearRect(0, 0, N, N);
    g.beginPath(); g.arc(N / 2, N / 2, N / 2, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#2a6f98'; g.fillRect(0, 0, N, N);
    g.imageSmoothingEnabled = true;
    g.drawImage(img, ix - sw / 2, iz - sw / 2, sw, sw, 0, 0, N, N);
    const toMap = (x, z) => [N / 2 + (x - P.pos.x) * (N / RANGE), N / 2 + (z - P.pos.z) * (N / RANGE)];
    const icon = (x, z, txt, size = 14) => {
      let [mx, my] = toMap(x, z);
      const dx = mx - N / 2, dy = my - N / 2, d = Math.hypot(dx, dy);
      if (d > N / 2 - 10) { mx = N / 2 + dx / d * (N / 2 - 10); my = N / 2 + dy / d * (N / 2 - 10); }
      g.font = size + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(txt, mx, my);
    };
    icon(LOC.workshop.x, LOC.workshop.z, '🔧', 12);
    icon(LOC.camp.x, LOC.camp.z, '🔥', 12);
    icon(LOC.den.x, LOC.den.z, '💀', 13);
    if (G.state.bridgeOpen) { icon(RLOC.camp.x, RLOC.camp.z, '⛺', 12); icon(RLOC.lair.x, RLOC.lair.z, '👑', 13); }
    if (G.state.floesOpen) { icon(-362, 26, '🏘', 12); icon(-540, -52, '⛰', 12); }
    for (const e of G.enemies) {
      if (e.dead) continue;
      const [mx, my] = toMap(e.pos.x, e.pos.z);
      if (Math.hypot(mx - N / 2, my - N / 2) > N / 2) continue;
      g.fillStyle = e.isBoss ? '#ff5ce1' : e.type === 'spire' ? '#c07aff' : '#ff4d6d';
      g.beginPath(); g.arc(mx, my, e.isBoss ? 5 : e.type === 'spire' ? 4 : 2.5, 0, Math.PI * 2); g.fill();
    }
    const qm = G.questTarget();
    if (qm) {
      let [mx, my] = toMap(qm.x, qm.z);
      const dx = mx - N / 2, dy = my - N / 2, d = Math.hypot(dx, dy);
      if (d > N / 2 - 10) { mx = N / 2 + dx / d * (N / 2 - 10); my = N / 2 + dy / d * (N / 2 - 10); }
      g.fillStyle = '#ffd66b'; g.strokeStyle = '#000'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(mx, my - 7); g.lineTo(mx + 6, my); g.lineTo(mx, my + 7); g.lineTo(mx - 6, my); g.closePath(); g.fill(); g.stroke();
    }
    // camera view cone + player arrow
    const cy = G.cam.yaw;
    g.fillStyle = 'rgba(255,255,255,.18)';
    g.beginPath(); g.moveTo(N / 2, N / 2);
    const a0 = Math.atan2(-Math.cos(cy), -Math.sin(cy));
    g.arc(N / 2, N / 2, 46, a0 - 0.6, a0 + 0.6); g.closePath(); g.fill();
    g.translate(N / 2, N / 2);
    g.rotate(Math.atan2(Math.cos(P.facing), Math.sin(P.facing)) - Math.PI / 2);
    g.fillStyle = '#b8ff4a'; g.strokeStyle = '#0b120c'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, 9); g.lineTo(6, -6); g.lineTo(0, -2); g.lineTo(-6, -6); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }
}
