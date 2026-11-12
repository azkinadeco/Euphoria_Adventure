// Artifact & Relic Equipment System for Euphoria Adventure
// 5 seal slots (HP, ATK, ATK%/energy, elemental damage, crit) and 6 sets with 2- and 4-piece bonuses.

export const ARTIFACT_SETS = {
  gladiator: {
    id: 'gladiator',
    name: "Sumpah Petarung",
    color: '#ffaa33',
    icon: '⚔️',
    twoPiece: 'ATK +18%',
    fourPiece: 'Damage Serangan Normal +35%',
  },
  viridescent: {
    id: 'viridescent',
    name: "Napas Hutan Berbisik",
    color: '#8fe63a',
    icon: '🍃',
    twoPiece: 'Damage WIND +15%',
    fourPiece: 'Damage reaksi Pusaran +60% & musuh menerima +30% damage 8 dtk',
  },
  crimson: {
    id: 'crimson',
    name: "Bara Infernal Citadel",
    color: '#ff5533',
    icon: '🔥',
    twoPiece: 'Damage FIRE +15%',
    fourPiece: 'Damage Burning, Uap Meledak & Lebur +30%',
  },
  blizzard: {
    id: 'blizzard',
    name: "Mahkota Frostvale",
    color: '#66ccff',
    icon: '❄️',
    twoPiece: 'Damage ICE +15%',
    fourPiece: 'Crit Rate +25% saat musuh Terkena Es / Membeku',
  },
  celestial: {
    id: 'celestial',
    name: "Cahaya Asgard",
    color: '#ffd700',
    icon: '👑',
    twoPiece: 'Damage Elemental Burst +20%',
    fourPiece: 'Setelah melancarkan Burst, seluruh party mendapat ATK +25% selama 12 dtk',
  },
  abyssal: {
    id: 'abyssal',
    name: "Kedaulatan Kehampaan",
    color: '#b06bff',
    icon: '🌌',
    twoPiece: 'Damage DARK & LIGHTNING +15%',
    fourPiece: 'Damage +35% saat musuh dalam kondisi Terguncang (BREAK)',
  },
};

export const SLOTS = {
  flower: { id: 'flower', name: 'Segel Hati', icon: '💠', mainStat: 'flat_hp', label: 'HP' },
  plume: { id: 'plume', name: 'Segel Taring', icon: '🦷', mainStat: 'flat_atk', label: 'ATK' },
  sands: { id: 'sands', name: 'Segel Jam', icon: '⏳', mainStats: ['atk_pct', 'er'], labels: { atk_pct: 'ATK%', er: 'Isi Energi%' } },
  goblet: { id: 'goblet', name: 'Segel Elemen', icon: '🔮', mainStats: ['elem_dmg', 'atk_pct'], labels: { elem_dmg: 'Bonus Elemental DMG%', atk_pct: 'ATK%' } },
  circlet: { id: 'circlet', name: 'Segel Bintang', icon: '⭐', mainStats: ['crit_rate', 'crit_dmg'], labels: { crit_rate: 'Crit Rate%', crit_dmg: 'Crit DMG%' } },
};

let _artId = 1;

export function createArtifact(setKey = 'gladiator', slotKey = 'flower', rarity = 5, level = 0) {
  const S = ARTIFACT_SETS[setKey] || ARTIFACT_SETS.gladiator;
  const slotDef = SLOTS[slotKey] || SLOTS.flower;
  let mainStat = slotDef.mainStat;
  if (slotDef.mainStats) {
    mainStat = slotDef.mainStats[Math.floor(Math.random() * slotDef.mainStats.length)];
  }

  // Calculate base values
  const baseVals = {
    flat_hp: rarity === 5 ? 240 : 160,
    flat_atk: rarity === 5 ? 45 : 30,
    atk_pct: rarity === 5 ? 0.08 : 0.05,
    er: rarity === 5 ? 0.10 : 0.07,
    elem_dmg: rarity === 5 ? 0.09 : 0.06,
    crit_rate: rarity === 5 ? 0.06 : 0.04,
    crit_dmg: rarity === 5 ? 0.12 : 0.08,
  };

  const growths = {
    flat_hp: rarity === 5 ? 18 : 12,
    flat_atk: rarity === 5 ? 4.5 : 3.0,
    atk_pct: rarity === 5 ? 0.016 : 0.012,
    er: rarity === 5 ? 0.018 : 0.014,
    elem_dmg: rarity === 5 ? 0.016 : 0.012,
    crit_rate: rarity === 5 ? 0.012 : 0.009,
    crit_dmg: rarity === 5 ? 0.024 : 0.018,
  };

  const id = `art_${Date.now()}_${_artId++}`;
  const base = baseVals[mainStat] || 50;
  const growth = growths[mainStat] || 5;

  return {
    id,
    set: setKey,
    setName: S.name,
    slot: slotKey,
    slotName: slotDef.name,
    rarity,
    level,
    maxLevel: rarity === 5 ? 20 : 16,
    mainStat,
    base,
    growth,
    get mainVal() {
      return this.base + this.level * this.growth;
    },
    get statLabel() {
      const v = this.mainVal;
      if (['atk_pct', 'er', 'elem_dmg', 'crit_rate', 'crit_dmg'].includes(this.mainStat)) {
        return `+${(v * 100).toFixed(1)}%`;
      }
      return `+${Math.round(v)}`;
    },
    get mainStatName() {
      return slotDef.labels ? slotDef.labels[this.mainStat] : slotDef.label;
    },
  };
}

export function upgradeArtifact(art, state) {
  if (art.level >= art.maxLevel) return false;
  if ((state.inv.fish || 0) < 1 && (state.inv.berry || 0) < 2) return false;
  
  if (state.inv.fish > 0) state.inv.fish--;
  else state.inv.berry = Math.max(0, state.inv.berry - 2);

  art.level++;
  return true;
}

/** saves flatten the live getters into stale numbers: rebuild a working artifact from its data */
export function reviveArtifact(d) {
  if (!d || !d.set || !d.slot) return null;
  const a = createArtifact(d.set, d.slot, d.rarity || 4, d.level || 0);
  a.id = d.id || a.id;
  if (d.mainStat) a.mainStat = d.mainStat;
  if (typeof d.base === 'number') a.base = d.base;
  if (typeof d.growth === 'number') a.growth = d.growth;
  return a;
}

export function dropRandomArtifact(minRarity = 4, setKey = null) {
  const setKeys = Object.keys(ARTIFACT_SETS);
  const slotKeys = Object.keys(SLOTS);
  const set = setKey || setKeys[Math.floor(Math.random() * setKeys.length)];
  const slot = slotKeys[Math.floor(Math.random() * slotKeys.length)];
  const rarity = Math.random() < 0.4 ? 5 : minRarity;
  return createArtifact(set, slot, rarity, 0);
}
