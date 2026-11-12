// HUD icon set: small inline SVGs (24×24, stroke = currentColor) used on every button the player
// clicks or taps during play, instead of emoji. Colour/opacity come from CSS so the controls stay
// light and semi-transparent over the game.
const F = 'fill="currentColor" stroke="none"';
const P = {
  // controls
  paw: `<g ${F}><ellipse cx="5.6" cy="10.4" rx="2" ry="2.6"/><ellipse cx="9.6" cy="6" rx="2" ry="2.7"/><ellipse cx="14.4" cy="6" rx="2" ry="2.7"/><ellipse cx="18.4" cy="10.4" rx="2" ry="2.6"/><path d="M12 11.2c-3 0-6.2 3.7-6.2 6.4 0 1.7 1.4 2.7 3 2.7 1.3 0 2.1-.7 3.2-.7s1.9.7 3.2.7c1.6 0 3-1 3-2.7 0-2.7-3.2-6.4-6.2-6.4z"/></g>`,
  jump: '<path d="M12 17V5"/><path d="M6.5 10.5L12 5l5.5 5.5"/><path d="M5 20.5h14"/>',
  dash: '<path d="M5 6l6 6-6 6"/><path d="M13 6l6 6-6 6"/>',
  bolt: '<path d="M13.5 2.5L4.5 14h7l-1 7.5 9-11.5h-7z"/>',
  eye: '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  hand: '<path d="M8 13.5V6a1.5 1.5 0 013 0v5"/><path d="M11 10.5V4.5a1.5 1.5 0 013 0v6"/><path d="M14 10.5V6a1.5 1.5 0 013 0v5"/><path d="M17 10a1.5 1.5 0 013 0v4.5a7 7 0 01-7 7h-.6a7 7 0 01-5.5-2.7l-3.3-4.2a1.6 1.6 0 012.4-2.1L8 14.5"/>',
  target: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.4"/><path d="M12 2v3.5M12 18.5V22M2 12h3.5M18.5 12H22"/>',
  map: '<path d="M9 4.5L3 7v13l6-2.5 6 2.5 6-2.5v-13L15 7z"/><path d="M9 4.5v13M15 7v13"/>',
  camera: '<path d="M4 8h3l1.6-2.5h6.8L17 8h3a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z"/><circle cx="12" cy="13.2" r="3.4"/>',
  star: '<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5l-5.4 3 1.2-6-4.5-4.2 6.1-.7z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  sparkle: '<path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7z"/><path d="M19 2.5v4M17 4.5h4"/>',
  play: `<path ${F} d="M7.5 4.5l12 7.5-12 7.5z"/>`,
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  // menu entries
  shield: '<path d="M12 3l8 3v6c0 4.6-3.4 8-8 9-4.6-1-8-4.4-8-9V6z"/><path d="M12 8v8M8.5 11.5h7"/>',
  tower: '<path d="M8 21V9.5L12 3l4 6.5V21z"/><path d="M5 21h14M10.5 13h3M10.5 17h3"/>',
  scroll: '<path d="M8 3.5h10.5a2 2 0 012 2v1H17"/><path d="M17 5.5v13a2.5 2.5 0 01-2.5 2.5H6a2 2 0 01-2-2v-1.5h10"/><path d="M8 3.5a2 2 0 00-2 2v11.5M9.5 8.5h4.5M9.5 12.5h4.5"/>',
  pot: '<path d="M4 10.5h16v5.5a4.5 4.5 0 01-4.5 4.5h-7A4.5 4.5 0 014 16z"/><path d="M2 10.5h20M9 7c0-1.2 1-1.3 1-2.8M14 7c0-1.2 1-1.3 1-2.8"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6.3 8-6.3s7 2.3 8 6.3"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.3-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M16 4.7a3.5 3.5 0 010 6.6M18 14.8c1.8.7 3 2.5 3.5 5.2"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7.5a4 4 0 018 0V11"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
  save: '<path d="M5 3.5h11l4 4V20a1 1 0 01-1 1H5a1 1 0 01-1-1V4.5a1 1 0 011-1z"/><path d="M8 3.5v5h7M8 21v-7h8v7"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  // weather
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2 12h2.5M19.5 12H22M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>',
  rain: '<path d="M7 15a4 4 0 01-.4-8A5.5 5.5 0 0117 6.6a3.8 3.8 0 01.5 8.4z"/><path d="M8.5 18l-1 3M12.5 18l-1 3M16.5 18l-1 3"/>',
  storm: '<path d="M7 14.5a4 4 0 01-.4-8A5.5 5.5 0 0117 6.1a3.8 3.8 0 01.5 8.4"/><path d="M13 12l-2.5 4.5h3.5L11.5 21"/>',
  aurora: '<path d="M3 17c3-8 6-8 9-4s6 4 9-4"/><path d="M3 11.5c3-6 6-6 9-3s6 3 9-3" opacity=".55"/><path d="M4 21h16"/>',
  // food & items
  berry: '<circle cx="8.7" cy="14.5" r="4"/><circle cx="15.6" cy="15.2" r="3.6"/><path d="M12 10.5c0-3.3 2-5.5 5.5-5.5M12 10.5C11 8 9 7 7 7.5"/>',
  fish: '<path d="M2.5 12c3-5 9.5-6 13.5-2l5-3v10l-5-3c-4 4-10.5 3-13.5-2z"/><circle cx="7.5" cy="11" r="1" fill="currentColor"/>',
  skewer: '<path d="M3 21L21 3"/><circle cx="8" cy="16" r="2.5"/><circle cx="12" cy="12" r="2.5"/><circle cx="16" cy="8" r="2.5"/>',
  drink: '<path d="M6 5h12l-1.6 15a1 1 0 01-1 .9H8.6a1 1 0 01-1-.9z"/><path d="M6.6 10h10.8M14 5l2.5-3"/><path d="M10.5 13.5l3 3M13.5 13.5l-3 3" opacity=".7"/>',
  soup: '<path d="M3 12h18a9 9 0 01-18 0z"/><path d="M8 8.5c0-1.5 1-1.5 1-3M12 8.5c0-1.5 1-1.5 1-3M16 8.5c0-1.5 1-1.5 1-3"/>',
  pepper: '<path d="M17 7.5c-1.2-1-3.2-.8-4 1.2-1.8 4.3-4.8 8.6-9 10.6 6.3 1.4 12.3-2 14.2-7 .8-2 .1-3.8-1.2-4.8z"/><path d="M17 7.5c0-2 1-3.5 3.2-3.5"/>',
  cog: '<circle cx="12" cy="12" r="2.6"/><circle cx="12" cy="12" r="6.4"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  meat: '<path d="M14.5 3.5a6 6 0 016 6c0 4-4.6 6.3-7.6 4.6L10 17a2.2 2.2 0 11-3 3 2.2 2.2 0 11-3-3 2.2 2.2 0 113-3l2.9-2.9C8.2 8.1 10.5 3.5 14.5 3.5z"/>',
  // hero skills
  tornado: '<path d="M3 4.5h18M5 8.5h14M7.5 12.5h9M10 16.5h5.5M12 20.5h2"/>',
  wave: '<path d="M2 8c2.5 0 2.5-3 5-3s2.5 3 5 3 2.5-3 5-3 2.5 3 5 3"/><path d="M2 13.5c2.5 0 2.5-3 5-3s2.5 3 5 3 2.5-3 5-3 2.5 3 5 3"/><path d="M2 19c2.5 0 2.5-3 5-3s2.5 3 5 3 2.5-3 5-3 2.5 3 5 3"/>',
  hourglass: '<path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9"/>',
  tentacle: '<path d="M6.5 21c0-6 3.5-7 3.5-11a4 4 0 018 0c0 2.3-2.2 3.3-3.4 2"/><circle cx="9.2" cy="17" r=".9" fill="currentColor"/><circle cx="10.3" cy="13" r=".9" fill="currentColor"/>',
  vortex: '<path d="M12 12c0-1.1.9-2 2-2a3 3 0 013 3 5 5 0 01-5 5 7 7 0 01-7-7 9 9 0 019-9"/>',
  snake: '<path d="M4 20.5c4.5 0 4.5-4.5 8.5-4.5s4.5-4.5 0-4.5-4.5-4.5 0-4.5h3"/><path d="M15.5 7a2.5 2.5 0 015 0c0 1.4-1.1 2-2.5 2"/><circle cx="18.6" cy="6.2" r=".8" fill="currentColor"/>',
  cross: '<path d="M12 2.5v19M6.5 8h11"/>',
  coin: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v9M9.5 10a2.5 2 0 012.5-1.5c1.4 0 2.5.6 2.5 1.6s-1.1 1.4-2.5 1.6-2.5.6-2.5 1.6 1.1 1.7 2.5 1.7a2.5 2 0 002.5-1.5"/>',
  snowflake: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7"/><path d="M9.5 3.5L12 6l2.5-2.5M9.5 20.5L12 18l2.5 2.5"/>',
  crown: '<path d="M3 18h18L19.5 7.5l-4.5 4L12 5l-3 6.5-4.5-4z"/><path d="M4.5 21h15"/>',
  ribbon: '<path d="M4 20c6-2 10.3-7 12.3-14L20 4l-1.6 3.7C15 15.3 9.6 18.6 4 20z"/><path d="M8.5 15.5l4-4"/>',
  gem: '<path d="M6.5 4h11L21 9l-9 11L3 9z"/><path d="M3 9h18M9.5 4L12 20l2.5-16"/>',
  satellite: '<path d="M13 7l4 4-6 6-4-4z"/><path d="M8.5 6.5L5.5 3.5 3.5 5.5l3 3M17.5 15.5l3 3-2 2-3-3"/><path d="M15 21a6 6 0 006-6"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9M12 8v13"/><path d="M12 8C10.5 4.5 7 4 7 6.2S10 8 12 8c2 0 5 0 5-1.8S13.5 4.5 12 8z"/>',
  lips: '<path d="M2 12c3-4 6.5-5.2 10-3 3.5-2.2 7-1 10 3-3 4-6.3 6-10 6S5 16 2 12z"/><path d="M2 12h20"/>',
  dagger: '<path d="M12 2l2 3v10h-4V5z"/><path d="M7 15h10M12 15v4"/><circle cx="12" cy="20.5" r="1.3"/>',
  swords: '<path d="M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2"/><path d="M9.5 17.5L21 6V3h-3L6.5 14.5M11 19l-6-6M8 16l-4 4M5 21l-2-2"/>',
  starburst: '<path d="M12 5.5l1.9 4 4.4.5-3.3 3 .9 4.3L12 15.1l-3.9 2.2.9-4.3-3.3-3 4.4-.5z"/><path d="M12 1.5v2M12 20.5v2M1.5 12h2M20.5 12h2M4.6 4.6L6 6M18 18l1.4 1.4M4.6 19.4L6 18M18 6l1.4-1.4"/>',
};

/** svg markup for an icon name */
export function icon(name, cls = '') {
  const body = P[name] || P.sparkle;
  return `<svg class="ico${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

// hero data keeps its emoji (story text, profiles); the HUD maps them onto the icon set
const EMOJI = {
  '🐾': 'paw', '🌪️': 'tornado', '🛡️': 'shield', '🌊': 'wave', '⏳': 'hourglass', '✨': 'sparkle',
  '🦑': 'tentacle', '🌀': 'vortex', '🐍': 'snake', '☀️': 'sun', '✝️': 'cross', '💰': 'coin',
  '❄️': 'snowflake', '👑': 'crown', '💃': 'ribbon', '💎': 'gem', '⚡': 'bolt', '🛰️': 'satellite',
  '🎁': 'gift', '👄': 'lips', '🗡️': 'dagger', '⚔️': 'swords', '🌟': 'starburst',
};
export const iconFor = (emoji, cls) => icon(EMOJI[emoji] || 'sparkle', cls);

export const WEATHER_ICON = { sunny: 'sun', rain: 'rain', thunderstorm: 'storm', aurora: 'aurora' };

/** replace every <i data-ico="name"> placeholder under root with its svg */
export function hydrateIcons(root = document) {
  for (const el of root.querySelectorAll('[data-ico]')) {
    if (el.dataset.icoDone) continue;
    el.innerHTML = icon(el.dataset.ico);
    el.dataset.icoDone = '1';
    el.classList.add('ico-wrap');
  }
}
