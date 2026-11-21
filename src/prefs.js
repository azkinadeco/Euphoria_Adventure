// Player preferences kept on this device (separate from the save so "Hapus save" keeps them).
const KEY = 'ea_prefs';
const DEF = {
  music: 0.7,   // 0..1
  sfx: 0.8,     // 0..1
  sens: 1,      // camera turn speed multiplier
  invY: false,  // invert vertical camera drag
  shake: 1,     // screen shake multiplier (0 = off)
  text: 1,      // dialog typing speed multiplier (0 = instant)
};
export const prefs = { ...DEF };
try { Object.assign(prefs, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { /* storage blocked */ }
for (const k of Object.keys(DEF)) if (typeof prefs[k] !== typeof DEF[k]) prefs[k] = DEF[k];

const subs = [];
/** call fn(key, value) whenever a preference changes */
export function onPref(fn) { subs.push(fn); }
export function setPref(k, v) {
  prefs[k] = v;
  try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { /* storage blocked */ }
  for (const f of subs) f(k, v);
}
