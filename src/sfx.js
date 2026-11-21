// Procedural sound effects + a gentle ambient loop (WebAudio, no asset files needed).
import { prefs, onPref } from './prefs.js';
let ctx = null, master = null, musicGain = null, sfxBus = null, musicBus = null;
const vol = (v) => Math.max(0.0001, v * v); // sliders feel even on a squared curve
export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.gain.value = vol(prefs.sfx); sfxBus.connect(master);
  musicBus = ctx.createGain(); musicBus.gain.value = vol(prefs.music); musicBus.connect(master);
  startMusic();
}
function noiseBuf(len = 0.3) {
  const b = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
function tone(freq, dur, { type = 'sine', vol = 0.3, slide = 0, delay = 0, dest } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest || sfxBus); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, { vol = 0.3, freq = 1200, q = 1, type = 'bandpass', sweep = 0, delay = 0, dest } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf(dur + 0.05);
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(60, freq + sweep), t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(dest || sfxBus); s.start(t); s.stop(t + dur + 0.05);
}

export const sfx = {
  swing: () => noise(0.16, { vol: 0.25, freq: 2400, sweep: -1600, q: 0.8 }),
  hit: (crit) => { noise(0.1, { vol: 0.35, freq: 900, q: 0.7 }); tone(crit ? 880 : 520, 0.09, { type: 'square', vol: 0.08, slide: -200 }); },
  pounce: () => { noise(0.35, { vol: 0.3, freq: 600, sweep: 2400, q: 0.6 }); tone(330, 0.2, { type: 'triangle', vol: 0.15, slide: 400 }); },
  land: () => { noise(0.4, { vol: 0.45, freq: 300, type: 'lowpass', q: 0.5 }); tone(90, 0.3, { vol: 0.35, slide: -40 }); },
  burst: () => { noise(1.4, { vol: 0.35, freq: 400, sweep: 2600, q: 1.2 }); [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, { type: 'triangle', vol: 0.12, delay: i * 0.07 })); },
  purr: () => { for (let i = 0; i < 6; i++) tone(60 + (i % 2) * 8, 0.09, { type: 'sawtooth', vol: 0.08, delay: i * 0.08 }); },
  jump: () => tone(420, 0.12, { type: 'triangle', vol: 0.12, slide: 300 }),
  dash: () => noise(0.22, { vol: 0.25, freq: 1800, sweep: -1200 }),
  pickup: () => { tone(880, 0.1, { type: 'triangle', vol: 0.15 }); tone(1320, 0.14, { type: 'triangle', vol: 0.15, delay: 0.08 }); },
  hurt: () => { tone(300, 0.18, { type: 'square', vol: 0.12, slide: -180 }); noise(0.12, { vol: 0.2, freq: 500 }); },
  enemyDie: () => { tone(400, 0.3, { type: 'triangle', vol: 0.12, slide: -300 }); noise(0.3, { vol: 0.2, freq: 700, sweep: -500 }); },
  quest: () => [659, 784, 988, 1318].forEach((f, i) => tone(f, 0.35, { type: 'triangle', vol: 0.13, delay: i * 0.1 })),
  ui: () => { // one tick per tap even when a handler and the global button listener both ask
    if (!ctx || ctx.currentTime - (sfx._uiT || -1) < 0.06) return;
    sfx._uiT = ctx.currentTime;
    tone(1000, 0.05, { type: 'triangle', vol: 0.08 }); tone(1500, 0.04, { type: 'sine', vol: 0.03, delay: 0.015 });
  },
  roar: () => { noise(1.0, { vol: 0.4, freq: 250, sweep: 300, q: 2 }); tone(110, 0.8, { type: 'sawtooth', vol: 0.12, slide: -40 }); },
  perfect: () => { noise(0.6, { vol: 0.35, freq: 3000, sweep: -2600, q: 0.6 }); [1318, 1760, 2093].forEach((f, i) => tone(f, 0.4, { type: 'sine', vol: 0.1, delay: i * 0.05 })); },
  orb: () => tone(1500 + Math.random() * 400, 0.06, { type: 'sine', vol: 0.05 }),
  hitEl: (el, crit) => {
    noise(0.08, { vol: 0.32, freq: 1100, q: 0.8 });
    tone(crit ? 980 : 560, 0.07, { type: 'square', vol: 0.06, slide: -260 });
    if (el === 'FIRE') noise(0.25, { vol: 0.18, freq: 500, sweep: 900, q: 0.4 });
    else if (el === 'ICE') { tone(2600, 0.12, { type: 'triangle', vol: 0.05 }); tone(3300, 0.1, { type: 'triangle', vol: 0.04, delay: 0.03 }); }
    else if (el === 'WATER') noise(0.2, { vol: 0.16, freq: 700, sweep: -400, q: 2 });
    else if (el === 'WIND') noise(0.22, { vol: 0.14, freq: 2400, sweep: -1800, q: 0.7 });
    else if (el === 'LIGHT') tone(1760, 0.15, { type: 'sine', vol: 0.06 });
    else if (el === 'DARK') tone(140, 0.2, { type: 'sawtooth', vol: 0.05, slide: -60 });
    if (crit) noise(0.12, { vol: 0.25, freq: 4000, q: 0.5, delay: 0.02 });
  },
  heavy: () => { noise(0.5, { vol: 0.5, freq: 200, type: 'lowpass', q: 0.6 }); tone(70, 0.4, { vol: 0.4, slide: -30 }); noise(0.2, { vol: 0.25, freq: 1800, delay: 0.02 }); },
  charge: () => tone(300, 0.35, { type: 'triangle', vol: 0.08, slide: 600 }),
  breakS: () => { noise(0.5, { vol: 0.4, freq: 900, sweep: -700, q: 1 }); [784, 587, 392].forEach((f, i) => tone(f, 0.25, { type: 'square', vol: 0.06, delay: i * 0.06 })); },
  eat: () => { for (let i = 0; i < 3; i++) noise(0.05, { vol: 0.2, freq: 2500, delay: i * 0.12 }); },
  portal: () => { noise(0.8, { vol: 0.35, freq: 300, sweep: 1200, q: 1.5 }); [440, 554, 659, 880].forEach((f, i) => tone(f, 0.4, { type: 'sine', vol: 0.1, delay: i * 0.08 })); },
  wishGold: () => [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => tone(f, 0.45, { type: 'sine', vol: 0.14, delay: i * 0.08 })),
  wishPurple: () => [440, 554, 659, 880].forEach((f, i) => tone(f, 0.35, { type: 'triangle', vol: 0.12, delay: i * 0.09 })),
  thunder: () => {
    noise(1.8, { vol: 0.45, freq: 140, type: 'lowpass', q: 1.2 });
    tone(55, 1.2, { type: 'sawtooth', vol: 0.25, slide: -25 });
    noise(1.2, { vol: 0.3, freq: 280, type: 'bandpass', q: 2.0, delay: 0.15 });
  },
  lightning: () => {
    noise(0.3, { vol: 0.6, freq: 3500, sweep: -2800, q: 0.6 });
    tone(180, 0.4, { type: 'square', vol: 0.35, slide: -120 });
    noise(1.6, { vol: 0.4, freq: 180, type: 'lowpass', q: 1.5, delay: 0.08 });
    tone(48, 1.4, { type: 'sine', vol: 0.3, slide: -15, delay: 0.1 });
  },
  windRing: () => {
    noise(0.65, { vol: 0.32, freq: 2200, sweep: -1400, q: 0.7 });
    [880, 1174, 1318, 1760].forEach((f, i) => tone(f, 0.28, { type: 'sine', vol: 0.09, delay: i * 0.05 }));
  },
  sightOn: () => {
    tone(587, 0.4, { type: 'sine', vol: 0.12 });
    tone(880, 0.5, { type: 'sine', vol: 0.14, delay: 0.08 });
    tone(1174, 0.7, { type: 'triangle', vol: 0.16, delay: 0.16 });
    noise(0.5, { vol: 0.18, freq: 1800, sweep: 800, q: 2 });
  },
  sightOff: () => {
    tone(880, 0.3, { type: 'sine', vol: 0.09 });
    tone(587, 0.35, { type: 'sine', vol: 0.08, delay: 0.08 });
  },
  shutter: () => {
    noise(0.04, { vol: 0.3, freq: 3000, sweep: -1000 });
    tone(1200, 0.05, { type: 'triangle', vol: 0.15, delay: 0.04 });
    noise(0.08, { vol: 0.25, freq: 2400, sweep: -1600, delay: 0.09 });
  },
  /** one quiet footstep; the surface picks the colour (grass / sand / snow / stone / wood / water) */
  step: (surf, hard) => {
    const k = hard ? 1.35 : 1, j = 0.85 + Math.random() * 0.3;
    if (surf === 'snow') { noise(0.11, { vol: 0.07 * k, freq: 2600 * j, q: 0.9, sweep: -900 }); noise(0.05, { vol: 0.04 * k, freq: 5200, q: 2, delay: 0.02 }); }
    else if (surf === 'sand') noise(0.09, { vol: 0.055 * k, freq: 1500 * j, q: 0.6, sweep: -600 });
    else if (surf === 'stone') { noise(0.05, { vol: 0.06 * k, freq: 1900 * j, q: 2.2 }); tone(150 * j, 0.05, { type: 'triangle', vol: 0.025 * k }); }
    else if (surf === 'wood') { tone(210 * j, 0.07, { type: 'triangle', vol: 0.05 * k, slide: -50 }); noise(0.04, { vol: 0.03 * k, freq: 900, q: 2 }); }
    else if (surf === 'water') noise(0.16, { vol: 0.07 * k, freq: 900 * j, q: 1.4, sweep: 700 });
    else noise(0.07, { vol: 0.045 * k, freq: 1100 * j, q: 0.8, sweep: -500, type: 'lowpass' });
  },
};

// ---------------- music: one procedural theme per area ----------------
// Each theme = chord roots (one per bar of 16 steps), a lead scale, tempo and timbre.
// A theme change waits for the next bar and dips the volume so it crossfades instead of jumping.
const THEMES = {
  forest: { roots: [196, 174.6, 220, 164.8], tri: [1, 1.5, 2], scale: [392, 440, 523.25, 587.33, 659.25, 783.99, 880], step: 240, p: 0.55, lead: 'triangle', lv: 0.09, gain: 0.12 },
  reef: { roots: [146.8, 164.8, 130.8, 174.6], tri: [1, 1.5, 2.5], scale: [587.33, 659.25, 739.99, 880, 987.77, 1174.66], step: 300, p: 0.45, lead: 'sine', lv: 0.1, gain: 0.12, echo: 0.45 },
  volcano: { roots: [110, 116.5, 98, 103.8], tri: [1, 1.5, 2], scale: [220, 233.08, 261.63, 293.66, 329.63, 349.23, 392], step: 230, p: 0.4, lead: 'sawtooth', lv: 0.035, gain: 0.11, drum: 4 },
  frost: { roots: [164.8, 130.8, 146.8, 123.5], tri: [1, 1.5, 2], scale: [659.25, 783.99, 880, 987.77, 1174.66, 1318.5], step: 320, p: 0.32, lead: 'triangle', lv: 0.08, gain: 0.11, echo: 0.5, bell: true },
  void: { roots: [130.8, 116.5, 138.6, 110], tri: [1, 1.414, 2], scale: [261.63, 293.66, 329.63, 369.99, 415.3, 466.16, 523.25], step: 340, p: 0.35, lead: 'sine', lv: 0.09, gain: 0.11, echo: 0.55 },
  asgard: { roots: [261.6, 293.7, 220, 246.9], tri: [1, 1.25, 1.5], scale: [523.25, 587.33, 659.25, 739.99, 783.99, 880, 987.77], step: 250, p: 0.5, lead: 'triangle', lv: 0.085, gain: 0.12, echo: 0.35, bell: true },
  ashen: { roots: [146.8, 116.5, 130.8, 110], tri: [1, 1.5, 2], scale: [293.66, 349.23, 392, 440, 523.25, 587.33], step: 220, p: 0.42, lead: 'square', lv: 0.03, gain: 0.11, drum: 4 },
  arena: { roots: [164.8, 146.8, 130.8, 146.8], tri: [1, 1.5, 2], scale: [329.63, 392, 440, 493.88, 587.33, 659.25], step: 190, p: 0.6, lead: 'square', lv: 0.03, gain: 0.11, drum: 2 },
  camp: { roots: [196, 164.8, 174.6, 146.8], tri: [1, 1.5, 2.5], scale: [392, 440, 493.88, 587.33, 659.25, 783.99], step: 300, p: 0.38, lead: 'triangle', lv: 0.08, gain: 0.1, echo: 0.3 },
};
let theme = THEMES.forest, wantTheme = 'forest', themeId = 'forest', boss = false, echoBus = null;
function startMusic() {
  musicGain = ctx.createGain(); musicGain.gain.value = theme.gain; musicGain.connect(musicBus);
  // one shared soft echo for every theme (gain set per theme)
  const dl = ctx.createDelay(1); dl.delayTime.value = 0.36;
  const fb = ctx.createGain(); fb.gain.value = 0.32;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
  echoBus = ctx.createGain(); echoBus.gain.value = theme.echo || 0;
  echoBus.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(musicGain);
  let step = 0;
  const tick = () => {
    if (!ctx) return;
    const T = theme;
    if (ctx.state === 'running') {
      if (step % 16 === 0 && wantTheme !== themeId) {
        // crossfade: dip, swap on the bar line, rise again
        themeId = wantTheme; theme = THEMES[themeId] || THEMES.forest;
        musicGain.gain.cancelScheduledValues(ctx.currentTime);
        musicGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.25);
        musicGain.gain.setTargetAtTime(boss ? 0.13 : theme.gain, ctx.currentTime + 0.9, 0.8);
        echoBus.gain.setTargetAtTime(theme.echo || 0, ctx.currentTime, 0.5);
        step = 0; setTimeout(tick, theme.step); return;
      }
      const bar = Math.floor(step / 16) % T.roots.length, root = T.roots[bar];
      const toMusic = (f, d, o) => { tone(f, d, { ...o, dest: musicGain }); if (T.echo) tone(f, d, { ...o, vol: o.vol * 0.6, dest: echoBus }); };
      if (step % 16 === 0) T.tri.forEach((m) => tone(root * m, T.step * 0.015, { type: 'sine', vol: 0.12, dest: musicGain }));
      if (Math.random() < T.p * (boss ? 1.25 : 1)) toMusic(T.scale[Math.floor(Math.random() * T.scale.length)] * (Math.random() < 0.3 ? 2 : 1), T.bell ? 1.4 : 0.9, { type: T.lead, vol: T.lv });
      const drum = boss ? 2 : T.drum;
      if (drum && step % drum === 0) {
        tone(root / 2, 0.28, { type: 'sine', vol: step % 8 === 0 ? 0.22 : 0.12, slide: -30, dest: musicGain });
        if (boss && step % 4 === 2) noise(0.06, { vol: 0.05, freq: 5000, q: 0.7, dest: musicGain });
      }
      step++;
    }
    setTimeout(tick, boss ? T.step * 0.85 : T.step);
  };
  tick();
}
export function setMusicMood(mood) {
  boss = mood === 'boss';
  if (!musicGain) return;
  musicGain.gain.setTargetAtTime(boss ? 0.13 : theme.gain, ctx.currentTime, 0.8);
}
/** which area's theme plays (forest / reef / volcano / frost / void / asgard / ashen / arena / camp) */
export function setMusicArea(id) { if (THEMES[id]) wantTheme = id; }
export function musicArea() { return themeId; }

/** the app went to the background / came back: silence everything and stop the clock */
export function suspendAudio() { if (ctx && ctx.state === 'running') ctx.suspend(); }
export function resumeAudio() { if (ctx && ctx.state === 'suspended') ctx.resume(); }

onPref((k, v) => {
  if (!ctx) return;
  if (k === 'music') musicBus.gain.setTargetAtTime(vol(v), ctx.currentTime, 0.05);
  if (k === 'sfx') sfxBus.gain.setTargetAtTime(vol(v), ctx.currentTime, 0.05);
});
