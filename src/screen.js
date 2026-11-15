// Logical screen: the game is always landscape. On a phone held upright the whole page is turned 90°
// (index.html sets html.rot before the first paint), so the game's width is the phone's height.
// Use these instead of innerWidth / innerHeight / clientX / clientY.
const S = () => window.__scr;
export const VW = () => S()?.w ?? innerWidth;
export const VH = () => S()?.h ?? innerHeight;
export const rotated = () => !!S()?.rot;
/** screen (client) point -> game point */
export function pt(x, y) { return S()?.rot ? { x: y, y: innerWidth - x } : { x, y }; }
/** fires after the logical size really changed (rotation, toolbar, keyboard), already settled */
export const onResize = (fn) => addEventListener('appresize', fn);
