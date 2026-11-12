// Procedural sound effects + a gentle ambient loop (WebAudio, no asset files needed).
let ctx = null, master = null, musicGain = null;
export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
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
  o.connect(g); g.connect(dest || master); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, { vol = 0.3, freq = 1200, q = 1, type = 'bandpass', sweep = 0, delay = 0 } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf(dur + 0.05);
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(60, freq + sweep), t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.05);
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
  ui: () => tone(1000, 0.05, { type: 'triangle', vol: 0.08 }),
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
};

// soft pentatonic ambient (forest)
function startMusic() {
  musicGain = ctx.createGain(); musicGain.gain.value = 0.12; musicGain.connect(master);
  const scale = [392, 440, 523.25, 587.33, 659.25, 783.99, 880];
  let step = 0;
  const tick = () => {
    if (!ctx) return;
    if (ctx.state === 'running') {
      const chordRoot = [196, 174.6, 220, 164.8][Math.floor(step / 16) % 4];
      if (step % 16 === 0) [1, 1.5, 2].forEach((m) => tone(chordRoot * m, 3.6, { type: 'sine', vol: 0.12, dest: musicGain }));
      if (Math.random() < 0.55) tone(scale[Math.floor(Math.random() * scale.length)] * (Math.random() < 0.3 ? 2 : 1), 0.9, { type: 'triangle', vol: 0.09, dest: musicGain });
      step++;
    }
    setTimeout(tick, 240);
  };
  tick();
}
export function setMusicMood(mood) {
  if (!musicGain) return;
  musicGain.gain.setTargetAtTime(mood === 'boss' ? 0.05 : 0.12, ctx.currentTime, 0.8);
}
