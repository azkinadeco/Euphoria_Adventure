// Euphoria Adventure — Gourmet Culinary Cooking System
// cooking minigame with timing slider, gourmet recipes, and combat buff management.
import { sfx } from './sfx.js';

export const RECIPES = [
  {
    id: 'skewer',
    name: '🍢 Crispy Grilled Skewer',
    desc: 'Tusukan ikan panggang dengan bumbu berry karamel. Renyah di luar, lembut di dalam.',
    req: { fish: 1, berry: 2, pepper: 0 },
    buff: { type: 'heal', hpPct: 0.5, hunger: 50 },
    buffDesc: 'Memulihkan 50% Max HP & +50 Kenyang',
  },
  {
    id: 'frost_juice',
    name: '🧊 Chilled Mint Frost',
    desc: 'Minuman dingin menyegarkan dengan sari berry gletser. Meredakan sengatan panas lava.',
    req: { fish: 1, berry: 3, pepper: 0 },
    buff: { type: 'heatImmune', dur: 240 },
    buffDesc: 'Kebal terhadap hawa panas Pulau Vulkanik selama 240 detik',
  },
  {
    id: 'chili_stew',
    name: '🍲 Sizzling Chili Stew',
    desc: 'Sup rempah pedas membakar yang menghangatkan sekujur tubuh hingga ke tulang.',
    req: { fish: 1, berry: 1, pepper: 1 },
    buff: { type: 'coldImmune', dur: 240 },
    buffDesc: 'Kebal terhadap hawa beku Frostvale selama 240 detik',
  },
  {
    id: 'sunfin_delight',
    name: '🐟 Golden Sunfin Delight',
    desc: 'Fillet ikan berlapis mentega madu selestial. Mengobarkan semangat juang para petualang.',
    req: { fish: 2, berry: 3, pepper: 0 },
    buff: { type: 'combat', atkPct: 0.25, critPct: 0.15, dur: 300 },
    buffDesc: 'ATK +25% & CRIT Rate +15% selama 300 detik',
  },
  {
    id: 'adeptus_stew',
    name: '👑 Pesta Agung Euphoria',
    desc: 'Hidangan legendaris yang memadukan kehangatan rempah dan kelembutan daging pilihan.',
    req: { fish: 3, berry: 4, pepper: 2 },
    buff: { type: 'master', atkPct: 0.35, critDmgPct: 0.30, hpPct: 0.25, dur: 300 },
    buffDesc: 'Party ATK +35%, Crit Rate +15% & Crit DMG +30% selama 300 detik',
  },
  {
    id: 'sunbeam_salad',
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
          <h2>🍳 Dapur Petualang (Gourmet Cooking)</h2>
          <p class="modal-sub">Masak hidangan lezat di atas api unggun untuk mendapatkan berkah statistik petualangan!</p>
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
              <div class="cs-hint">Tekan <b>SPASI</b> atau tombol <b>MASAK SEKARANG</b> saat sendok berada di area kuning!</div>
              <button id="cs-btn-cook" class="cs-btn-cook">MASAK SEKARANG!</button>
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
    const S = this.g.state;

    for (const r of RECIPES) {
      const card = document.createElement('div');
      card.className = 'cook-item-card';

      const hasFish = (S.inv.fish || 0) >= r.req.fish;
      const hasBerry = (S.inv.berry || 0) >= r.req.berry;
      const hasPepper = (S.inv.pepper || 0) >= r.req.pepper;
      const canCook = hasFish && hasBerry && hasPepper;

      card.innerHTML = `
        <div class="cook-item-info">
          <div class="cook-item-name">${r.name}</div>
          <div class="cook-item-desc">${r.desc}</div>
          <div class="cook-item-buff">✨ ${r.buffDesc}</div>
          <div class="cook-item-reqs">
            <span class="${hasFish ? 'ok' : 'missing'}">🐟 ${r.req.fish} (${S.inv.fish || 0})</span>
            <span class="${hasBerry ? 'ok' : 'missing'}">🫐 ${r.req.berry} (${S.inv.berry || 0})</span>
            ${r.req.pepper > 0 ? `<span class="${hasPepper ? 'ok' : 'missing'}">🌶️ ${r.req.pepper} (${S.inv.pepper || 0})</span>` : ''}
          </div>
        </div>
        <button class="cook-item-btn ${canCook ? 'active' : 'disabled'}">${canCook ? 'Pilih Masak' : 'Bahan Kurang'}</button>
      `;

      card.querySelector('button').onclick = () => {
        if (canCook) {
          this.startMinigame(r);
        } else {
          this.g.ui.toast('Bahan tidak mencukupi untuk hidangan ini!');
        }
      };

      wrap.appendChild(card);
    }
  }

  startMinigame(recipe) {
    this.currentRecipe = recipe;
    this.needle = 10;
    this.needleDir = 1;

    document.getElementById('cook-station').classList.remove('hidden');
    document.getElementById('cs-dish-name').textContent = recipe.name;
    document.getElementById('cs-dish-desc').textContent = `${recipe.desc} — Efek: ${recipe.buffDesc}`;

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
      this.g.ui.toast(`🌟 MASAKAN SEMPURNA! ${r.name} (Lezat +30% Durasi)!`, 'gold');
    } else {
      sfx.wishPurple();
      this.g.ui.toast(`Berhasil memasak ${r.name}!`, 'gold');
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
