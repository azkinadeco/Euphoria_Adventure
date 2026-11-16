// Euphoria Adventure — Gourmet Culinary Cooking System
// cooking minigame with timing slider, gourmet recipes, and combat buff management.
import { sfx } from './sfx.js';
import { icon } from './icons.js';

export const RECIPES = [
  {
    id: 'skewer',
    short: 'Sate Ikan Bakar', icon: 'skewer', color: '#ffb36b', fx: 'HP +50% · Kenyang +50',
    name: '🍢 Crispy Grilled Skewer',
    desc: 'Tusukan ikan panggang dengan bumbu berry karamel. Renyah di luar, lembut di dalam.',
    req: { fish: 1, berry: 2, pepper: 0 },
    buff: { type: 'heal', hpPct: 0.5, hunger: 50 },
    buffDesc: 'Memulihkan 50% Max HP & +50 Kenyang',
  },
  {
    id: 'frost_juice',
    short: 'Es Mint Gletser', icon: 'drink', color: '#7fd8ff', fx: 'Kebal panas · 4 mnt',
    name: '🧊 Chilled Mint Frost',
    desc: 'Minuman dingin menyegarkan dengan sari berry gletser. Meredakan sengatan panas lava.',
    req: { fish: 1, berry: 3, pepper: 0 },
    buff: { type: 'heatImmune', dur: 240 },
    buffDesc: 'Kebal terhadap hawa panas Pulau Vulkanik selama 240 detik',
  },
  {
    id: 'chili_stew',
    short: 'Sup Cabai Pedas', icon: 'soup', color: '#ff7a5a', fx: 'Kebal dingin · 4 mnt',
    name: '🍲 Sizzling Chili Stew',
    desc: 'Sup rempah pedas membakar yang menghangatkan sekujur tubuh hingga ke tulang.',
    req: { fish: 1, berry: 1, pepper: 1 },
    buff: { type: 'coldImmune', dur: 240 },
    buffDesc: 'Kebal terhadap hawa beku Frostvale selama 240 detik',
  },
  {
    id: 'sunfin_delight',
    short: 'Ikan Mentega Madu', icon: 'fish', color: '#ffd66b', fx: 'ATK +25% · Crit +15% · 5 mnt',
    name: '🐟 Golden Sunfin Delight',
    desc: 'Fillet ikan berlapis mentega madu selestial. Mengobarkan semangat juang para petualang.',
    req: { fish: 2, berry: 3, pepper: 0 },
    buff: { type: 'combat', atkPct: 0.25, critPct: 0.15, dur: 300 },
    buffDesc: 'ATK +25% & CRIT Rate +15% selama 300 detik',
  },
  {
    id: 'adeptus_stew',
    short: 'Pesta Agung', icon: 'crown', color: '#e8a8ff', fx: 'ATK +35% · Crit +15% · CDMG +30%',
    name: '👑 Pesta Agung Euphoria',
    desc: 'Hidangan legendaris yang memadukan kehangatan rempah dan kelembutan daging pilihan.',
    req: { fish: 3, berry: 4, pepper: 2 },
    buff: { type: 'master', atkPct: 0.35, critDmgPct: 0.30, hpPct: 0.25, dur: 300 },
    buffDesc: 'Party ATK +35%, Crit Rate +15% & Crit DMG +30% selama 300 detik',
  },
  {
    id: 'sunbeam_salad',
    short: 'Salad Padang', icon: 'berry', color: '#9fe86a', fx: 'Stamina -40% · 5 mnt',
    name: '🥗 Sunbeam Meadow Salad',
    desc: 'Campuran berry segar dan dedaunan beraroma mint liar. Meringankan setiap langkah kaki.',
    req: { fish: 0, berry: 4, pepper: 0 },
    buff: { type: 'stamina', costReduction: 0.40, dur: 300 },
    buffDesc: 'Konsumsi stamina sprint & gliding berkurang 40% selama 300 detik',
  },
];

export class CookingManager {
  constructor(game) {
    this.g = game;
    this.active = false;
    this.currentRecipe = null;
    this.needle = 0; // 0..100
    this.needleDir = 1;
    this.needleSpeed = 95;
    this.perfectMin = 42;
    this.perfectMax = 58;

    // Active food buffs
    this.activeBuffs = {
      combat: 0,
      master: 0,
      coldImmune: 0,
      heatImmune: 0,
      stamina: 0,
    };

    this._createDOM();
  }

  _createDOM() {
    let wrap = document.getElementById('cooking-modal');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'cooking-modal';
      wrap.className = 'custom-modal hidden';
      wrap.innerHTML = `
        <div class="modal-card cooking-card">
          <button class="modal-close" id="cook-close">✕</button>
          <div class="ck-head"><i class="ck-pot">${icon('pot')}</i><div><h2>Dapur</h2><div id="ck-inv" class="ck-inv"></div></div></div>
          <div class="cook-body">
            <div id="cook-recipe-list" class="cook-recipe-list"></div>
            <div id="cook-station" class="cook-station hidden">
              <div class="cs-header">
                <div id="cs-dish-name" class="cs-dish-name">Nama Masakan</div>
                <div id="cs-dish-desc" class="cs-dish-desc">Deskripsi masakan</div>
              </div>
              <div class="cs-timing-bar">
                <div class="cs-perfect-zone" id="cs-perfect-zone"></div>
                <div class="cs-needle" id="cs-needle"></div>
              </div>
              <div class="cs-hint">Hentikan di zona emas untuk hasil sempurna (+30% durasi)</div>
              <div class="cs-row"><button id="cs-btn-back" class="cs-btn-back">Batal</button><button id="cs-btn-cook" class="cs-btn-cook">MASAK</button></div>
            </div>
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

    $('cook-close')?.addEventListener('click', () => this.close());

    const triggerStop = () => {
      if (this.active && this.currentRecipe) {
        this.finishCooking();
      }
    };

    $('cs-btn-cook')?.addEventListener('click', triggerStop);
    $('cs-btn-back')?.addEventListener('click', () => { this.currentRecipe = null; $('cook-station').classList.add('hidden'); $('cook-recipe-list').classList.remove('hidden'); });
    window.addEventListener('keydown', (e) => {
      if (this.active && this.currentRecipe && e.code === 'Space') {
        triggerStop();
      }
    });
  }

  open() {
    if (this.active) return;
    this.active = true;
    this.currentRecipe = null;
    this.g.inputLocked = true;
    document.exitPointerLock?.();
    this.dom.classList.remove('hidden');
    document.getElementById('cook-station').classList.add('hidden');
    this._renderRecipeList();
    sfx.ui();
  }

  close() {
    if (!this.active) return;
    this.active = false;
    this.currentRecipe = null;
    this.g.inputLocked = false;
    this.dom.classList.add('hidden');
    sfx.ui();
  }

  _renderRecipeList() {
    const wrap = document.getElementById('cook-recipe-list');
    wrap.innerHTML = '';
    wrap.classList.remove('hidden');
    const inv = this.g.state.inv, have = (k) => inv[k] || 0;
    const chip = (k, n) => `<span class="ck-chip ${n ? (have(k) >= n ? 'ok' : 'no') : ''}">${icon(k)}${n !== undefined ? n : have(k)}</span>`;
    document.getElementById('ck-inv').innerHTML = chip('fish') + chip('berry') + chip('pepper');
    for (const r of RECIPES) {
      const can = ['fish', 'berry', 'pepper'].every((k) => have(k) >= (r.req[k] || 0));
      const card = document.createElement('button');
      card.className = 'ck-card' + (can ? '' : ' off');
      card.style.setProperty('--c', r.color);
      card.title = r.desc;
      card.innerHTML = `<i class="ck-ico">${icon(r.icon)}</i><span class="ck-txt"><b>${r.short}</b><small>${r.fx}</small></span>
        <span class="ck-req">${['fish', 'berry', 'pepper'].filter((k) => r.req[k]).map((k) => chip(k, r.req[k])).join('')}</span>`;
      card.onclick = () => { if (can) this.startMinigame(r); else { sfx.ui(); this.g.ui.toast('Bahan belum cukup'); } };
      wrap.appendChild(card);
    }
  }

  startMinigame(recipe) {
    this.currentRecipe = recipe;
    this.needle = 10;
    this.needleDir = 1;

    document.getElementById('cook-station').classList.remove('hidden');
    document.getElementById('cook-recipe-list').classList.add('hidden');
    document.getElementById('cook-station').style.setProperty('--c', recipe.color);
    document.getElementById('cs-dish-name').innerHTML = `<i class="ck-ico">${icon(recipe.icon)}</i>${recipe.short}`;
    document.getElementById('cs-dish-desc').textContent = recipe.fx;

    const pz = document.getElementById('cs-perfect-zone');
    pz.style.left = `${this.perfectMin}%`;
    pz.style.width = `${this.perfectMax - this.perfectMin}%`;

    sfx.swing();
  }

  finishCooking() {
    const r = this.currentRecipe;
    if (!r) return;

    // Deduct ingredients
    const S = this.g.state;
    S.inv.fish -= r.req.fish;
    S.inv.berry -= r.req.berry;
    if (r.req.pepper) S.inv.pepper -= r.req.pepper;

    const inPerfect = this.needle >= this.perfectMin && this.needle <= this.perfectMax;
    const isDelicious = inPerfect;

    // Apply Food Buff
    this.applyFoodBuff(r, isDelicious);

    if (isDelicious) {
      sfx.wishGold();
      this.g.ui.toast(`Sempurna! ${r.short} · +30% durasi`, 'gold');
    } else {
      sfx.wishPurple();
      this.g.ui.toast(`${r.short} siap`, 'gold');
    }

    this.g.vfx.particles(this.g.player.pos.clone(), 25, isDelicious ? 0xffd700 : 0x70d6ff, { speed: 4, up: 5, life: 0.6 });
    this.currentRecipe = null;
    document.getElementById('cook-station').classList.add('hidden');
    this._renderRecipeList();
    this.g.save();
  }

  applyFoodBuff(recipe, isDelicious) {
    const mult = isDelicious ? 1.3 : 1.0;
    const b = recipe.buff;

    if (b.type === 'heal') {
      const P = this.g.player;
      const healAmt = P.maxHp * b.hpPct * mult;
      P.healAll ? P.healAll(b.hpPct * mult, false) : (P.hp = Math.min(P.maxHp, P.hp + healAmt));
      P.hunger = Math.min(100, P.hunger + b.hunger);
      this.g.ui.damageNumber(P.pos.clone().setY(P.pos.y + 1.8), Math.round(healAmt), 'heal');
    } else if (b.type === 'combat') {
      this.activeBuffs.combat = b.dur * mult;
    } else if (b.type === 'master') {
      this.activeBuffs.master = b.dur * mult;
    } else if (b.type === 'coldImmune') {
      this.activeBuffs.coldImmune = b.dur * mult;
    } else if (b.type === 'heatImmune') {
      this.activeBuffs.heatImmune = b.dur * mult;
    } else if (b.type === 'stamina') {
      this.activeBuffs.stamina = b.dur * mult;
    }
  }

  getAtkMultiplier() {
    let mul = 1.0;
    if (this.activeBuffs.combat > 0) mul += 0.25;
    if (this.activeBuffs.master > 0) mul += 0.35;
    return mul;
  }

  getCritBonus() {
    let bonus = 0;
    if (this.activeBuffs.combat > 0) bonus += 0.15;
    if (this.activeBuffs.master > 0) bonus += 0.15;
    return bonus;
  }

  getStaminaCostMultiplier() {
    return this.activeBuffs.stamina > 0 ? 0.60 : 1.0;
  }

  isColdImmune() {
    return this.activeBuffs.coldImmune > 0;
  }

  isHeatImmune() {
    return this.activeBuffs.heatImmune > 0;
  }

  update(dt) {
    // Tick down active buffs
    for (const key of Object.keys(this.activeBuffs)) {
      if (this.activeBuffs[key] > 0) {
        this.activeBuffs[key] = Math.max(0, this.activeBuffs[key] - dt);
      }
    }

    if (!this.active || !this.currentRecipe) return;

    // Needle sweep
    this.needle += this.needleDir * this.needleSpeed * dt;
    if (this.needle >= 98) {
      this.needle = 98;
      this.needleDir = -1;
    } else if (this.needle <= 2) {
      this.needle = 2;
      this.needleDir = 1;
    }

    const needleEl = document.getElementById('cs-needle');
    if (needleEl) needleEl.style.left = `${this.needle}%`;
  }
}
