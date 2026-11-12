// Starlight Wish / Gacha Summon System for Euphoria Adventure
// Features 5-star Legendary Weapons, 5-star Artifacts, 4-star Equipment,
// Pity counter mechanics, and anime shooting star meteor summon animations!

import { dropRandomArtifact } from './artifacts.js';
import { sfx } from './sfx.js';

// ids are stable save keys; names and effects can change freely
export const FIVE_STAR_WEAPONS = [
  { id: 'mistsplitter', name: 'Bilah Fajar Kedua', icon: '⚡', type: 'Pedang', rarity: 5, desc: 'Damage Elemen +25% & Crit DMG +30%', stats: { elemDmg: 0.25, critDmg: 0.3 } },
  { id: 'skyward_harp', name: 'Busur Mata Bintang', icon: '🏹', type: 'Busur', rarity: 5, desc: 'Crit Rate +20% & Crit DMG +35%', stats: { critRate: 0.2, critDmg: 0.35 } },
  { id: 'staff_of_homa', name: 'Tombak Sumpah Pertama', icon: '🔱', type: 'Tombak', rarity: 5, desc: 'ATK +30% & Crit DMG +40%', stats: { atkPct: 0.3, critDmg: 0.4 } },
  { id: 'solaris_lunaris', name: 'Belati Kembar Eclipse', icon: '⚔️', type: 'Belati', rarity: 5, desc: 'Damage Serangan Biasa +30% & Burst +30%', stats: { normalDmg: 0.3, burstDmg: 0.3 } },
];

export const FOUR_STAR_WEAPONS = [
  { id: 'sacrificial_sword', name: 'Pedang Janji Ksatria', icon: '🗡️', type: 'Pedang', rarity: 4, desc: 'Cooldown Skill −20%', stats: { cdr: 0.2 } },
  { id: 'rust_bow', name: 'Busur Pemburu Tua', icon: '🏹', type: 'Busur', rarity: 4, desc: 'Damage Serangan Biasa +40%', stats: { normalDmg: 0.4 } },
  { id: 'widsith', name: 'Kitab Waktu Terlipat', icon: '📖', type: 'Kitab', rarity: 4, desc: 'ATK +25%', stats: { atkPct: 0.25 } },
  { id: 'deathmatch', name: 'Tombak Pengawal Asgard', icon: '🔱', type: 'Tombak', rarity: 4, desc: 'Crit Rate +24% & ATK +16%', stats: { critRate: 0.24, atkPct: 0.16 } },
];
export const WEAPON_BY_ID = Object.fromEntries([...FIVE_STAR_WEAPONS, ...FOUR_STAR_WEAPONS].map((w) => [w.id, w]));

export function performWish(game, count = 1) {
  const S = game.state;
  const cost = count * 160;
  if ((S.starlight || 0) < cost) {
    game.ui.toast(`Starlight Crystals tidak cukup! (Butuh ${cost} ✦)`, 'gold');
    return null;
  }

  S.starlight -= cost;
  S.pity4 = S.pity4 || 0;
  S.pity5 = S.pity5 || 0;
  if (!S.weapons) S.weapons = [];
  if (!S.inventoryArtifacts) S.inventoryArtifacts = [];

  const results = [];
  let highestRarity = 3;

  for (let i = 0; i < count; i++) {
    S.pity4++;
    S.pity5++;

    let rarity = 3;
    // 5-star chance (base 5%, guaranteed at 15 pity)
    if (Math.random() < 0.05 || S.pity5 >= 15) {
      rarity = 5;
      S.pity5 = 0;
      S.pity4 = 0;
    } else if (Math.random() < 0.15 || S.pity4 >= 8) { // 4-star chance (guaranteed at 8 pity)
      rarity = 4;
      S.pity4 = 0;
    }

    highestRarity = Math.max(highestRarity, rarity);

    if (rarity === 5) {
      // 5-Star Weapon or 5-Star Artifact
      if (Math.random() < 0.5) {
        const wp = FIVE_STAR_WEAPONS[Math.floor(Math.random() * FIVE_STAR_WEAPONS.length)];
        results.push({ kind: 'weapon', item: wp, rarity: 5 });
        // duplicates refund crystals instead of silently vanishing
        if (S.weapons.some((w) => w.id === wp.id)) { S.starlight += 80; game.ui.toast(`Duplikat ${wp.name}: +80 ✦`); } else S.weapons.push(wp);
      } else {
        const art = dropRandomArtifact(5);
        results.push({ kind: 'artifact', item: art, rarity: 5 });
        S.inventoryArtifacts.push(art);
      }
    } else if (rarity === 4) {
      // 4-Star Weapon or 4-Star Artifact
      if (Math.random() < 0.5) {
        const wp = FOUR_STAR_WEAPONS[Math.floor(Math.random() * FOUR_STAR_WEAPONS.length)];
        results.push({ kind: 'weapon', item: wp, rarity: 4 });
        // duplicates refund crystals instead of silently vanishing
        if (S.weapons.some((w) => w.id === wp.id)) { S.starlight += 30; game.ui.toast(`Duplikat ${wp.name}: +30 ✦`); } else S.weapons.push(wp);
      } else {
        const art = dropRandomArtifact(4);
        results.push({ kind: 'artifact', item: art, rarity: 4 });
        S.inventoryArtifacts.push(art);
      }
    } else {
      // 3-Star Item
      const consumables = [
        { name: '5× Ikan Bakar Gourmet', icon: '🍢', give: () => { S.inv.grilled = (S.inv.grilled || 0) + 5; } },
        { name: '5× Jus Sejuk', icon: '🧊', give: () => { S.inv.cool = (S.inv.cool || 0) + 5; } },
        { name: '5× Sup Pedas', icon: '🍲', give: () => { S.inv.soup = (S.inv.soup || 0) + 5; } },
        { name: '10× Berry Hutan', icon: '🫐', give: () => { S.inv.berry = (S.inv.berry || 0) + 10; } },
        { name: '10× Camilan Ikan', icon: '🐟', give: () => { S.inv.fish = (S.inv.fish || 0) + 10; } },
      ];
      const c = consumables[Math.floor(Math.random() * consumables.length)];
      c.give();
      results.push({ kind: 'item', item: c, rarity: 3 });
    }
  }

  // Play audio
  if (highestRarity === 5) sfx.wishGold();
  else if (highestRarity === 4) sfx.wishPurple();
  else sfx.pickup();

  return { results, highestRarity };
}
