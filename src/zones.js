// World zones (Ragnarok-style): the starting island is split into 5 areas and every other land
// mass is its own area. Only the area the player stands in is drawn (plus whatever is right next to
// the player), and crossing into another area plays a short "loading" fade while it is swapped in.
import { REEF } from './reef.js';
import { VOLC } from './volcano.js';
import { FROST } from './frost.js';

const MAIN = { x: 12, z: -12, r: 215 };   // Whispering Woods island
const GLADE_R = 80;                        // central area around Sunbeam Rock & the camp

export const ZONES = {
  glade: { name: 'Sunbeam Glade', sub: 'Whispering Woods · Lembah Mentari' },
  north: { name: 'Foxfire Thicket', sub: 'Whispering Woods · Belukar Ekor Sembilan' },
  east: { name: 'Eastern Cliffs', sub: 'Whispering Woods · Tebing Timur' },
  south: { name: 'Mossy Meadow', sub: 'Whispering Woods · Padang Lumut' },
  west: { name: 'Hollow Grove', sub: 'Whispering Woods · Rimba Sunyi' },
  reef: { name: 'Sunken Reef', sub: 'Karang Tenggelam' },
  volcano: { name: 'Infernal Citadel', sub: 'Benteng Membara' },
  frost: { name: 'Frostvale Expanse', sub: 'Gletser Salju Abadi' },
};

const OUTER = [
  ['reef', REEF], ['volcano', VOLC], ['frost', FROST],
];

/** zone id at a world position, or null (sky realms, open sea, the floes between islands) */
export function zoneOf(x, y, z) {
  if (y > 60) return null; // floating realms keep their own enter/leave logic
  const dm = Math.hypot(x - MAIN.x, z - MAIN.z);
  if (dm < MAIN.r) {
    if (Math.hypot(x - MAIN.x, z - MAIN.z) < GLADE_R) return 'glade';
    const a = Math.atan2(x - MAIN.x, -(z - MAIN.z)); // 0 = north (-z), clockwise
    if (a >= -Math.PI / 4 && a < Math.PI / 4) return 'north';
    if (a >= Math.PI / 4 && a < Math.PI * 3 / 4) return 'east';
    if (a >= -Math.PI * 3 / 4 && a < -Math.PI / 4) return 'west';
    return 'south';
  }
  let best = null, bd = Infinity;
  for (const [id, c] of OUTER) {
    const d = Math.hypot(x - c.x, z - c.z) - c.r;
    if (d < bd) { bd = d; best = id; }
  }
  return bd < 60 ? best : null;
}

export const ZONE_BIT = Object.fromEntries(Object.keys(ZONES).map((id, i) => [id, 1 << i]));
const SECTORS = [['north', -Math.PI / 4, Math.PI / 4], ['east', Math.PI / 4, Math.PI * 3 / 4], ['south', Math.PI * 3 / 4, Math.PI * 5 / 4], ['west', -Math.PI * 3 / 4, -Math.PI / 4]];

/**
 * Bitmask of every zone this point belongs to, counting a `margin` (m) past each zone's edge,
 * so scenery right across a border is still drawn while you stand next to it. 0 = no zone.
 */
export function zoneMask(x, y, z, margin = 0) {
  if (y > 60) return 0;
  let mask = 0;
  const dx = x - MAIN.x, dz = z - MAIN.z, dm = Math.hypot(dx, dz);
  if (dm < MAIN.r + margin) {
    if (dm < GLADE_R + margin) mask |= ZONE_BIT.glade;
    if (dm > GLADE_R - margin) {
      const a = Math.atan2(dx, -dz), am = margin / Math.max(dm, 1);
      for (const [id, a0, a1] of SECTORS) {
        const mid = (a0 + a1) / 2, half = (a1 - a0) / 2 + am;
        let d = a - mid; d = Math.atan2(Math.sin(d), Math.cos(d));
        if (Math.abs(d) <= half) mask |= ZONE_BIT[id];
      }
    }
  }
  for (const [id, c] of OUTER) if (Math.hypot(x - c.x, z - c.z) - c.r < 60 + margin) mask |= ZONE_BIT[id];
  return mask;
}
