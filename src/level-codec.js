/**
 * 关卡码编解码 - 自制关卡 ↔ 紧凑字符串（微信分享 query 用）。
 * 纯函数，无 wx/游戏依赖。格式：PG1 + 计数驱动的变长段（见 plan/spec）。
 */
'use strict';
const GRID = 4;
const PREFIX = 'PG1';
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const LIMITS = { blocks: 40, pigs: 10, birds: 6, pearls: 2 };
const BIRD_CHARS = { normal: 'n', dash: 'd', bomb: 'b', split: 's' };
const BIRD_TYPES = { n: 'normal', d: 'dash', b: 'bomb', s: 'split' };
const BLOCK_CHARS = { wood: 'w', stone: 't', ice: 'i', burst: 'f' };
const BLOCK_TYPES = { w: 'wood', t: 'stone', i: 'ice', f: 'burst' };
// 尺寸枚举：梁/柱/块/爆裂果
const SIZES = { b: [80, 26], p: [28, 80], q: [28, 28], f: [26, 26] };
const SIZE_KEY = (w, h, type) =>
  type === 'burst' ? 'f' : (w === 80 ? 'b' : h === 80 ? 'p' : 'q');
const PIG_CHARS = { 17: 's', 22: 'l' };
const PIG_RADII = { s: 17, l: 22 };

function enc(n) { // 非负整数 → 1~2 字符；低位数字 0..31，高位标记 32..63，上限 1023（网格坐标 max ~167，够用）
  if (n < 0 || n > 1023) throw new Error('codec 数值越界');
  return n < 32 ? B64[n] : B64[32 + (n >> 5)] + B64[n & 31];
}
function dec(s, i) { // 返回 [value, nextIndex]；非法返回 null
  const c0 = B64.indexOf(s[i]);
  if (c0 < 0) return null;
  if (c0 < 32) return [c0, i + 1];
  const c1 = B64.indexOf(s[i + 1]);
  if (c1 < 0 || c1 >= 32) return null; // 低位必须是 0..31
  return [((c0 - 32) << 5) + c1, i + 2];
}

function encodeLevel(level) {
  const birds = level.birds || [];
  const blocks = level.blocks || [];
  const pigs = level.pigs || [];
  const pearls = level.pearls || [];
  if (birds.length > LIMITS.birds || blocks.length > LIMITS.blocks ||
      pigs.length > LIMITS.pigs || pearls.length > LIMITS.pearls) {
    throw new Error('关卡内容超限（blocks≤40/pigs≤10/birds≤6/pearls≤2）');
  }
  let out = PREFIX;
  out += enc(birds.length) + birds.map(b => BIRD_CHARS[b]).join('');
  out += enc(blocks.length);
  for (const b of blocks) {
    out += BLOCK_CHARS[b.type] + enc(Math.round(b.x / GRID)) + enc(Math.round(b.y / GRID))
      + SIZE_KEY(b.width, b.height, b.type);
  }
  out += enc(pigs.length);
  for (const p of pigs) {
    out += (PIG_CHARS[p.radius] || 's') + enc(Math.round(p.x / GRID)) + enc(Math.round(p.y / GRID));
  }
  out += enc(pearls.length);
  for (const p of pearls) out += enc(Math.round(p.x / GRID)) + enc(Math.round(p.y / GRID));
  return out;
}

function decodeLevel(code) {
  try {
    if (typeof code !== 'string' || !code.startsWith(PREFIX)) return null;
    const s = code.slice(PREFIX.length);
    let i = 0;
    const read = () => { const r = dec(s, i); if (!r) throw new Error('bad'); i = r[1]; return r[0]; };
    const nBirds = read();
    if (nBirds > LIMITS.birds) return null;
    const birds = [];
    for (let k = 0; k < nBirds; k++) {
      const t = BIRD_TYPES[s[i++]];
      if (!t) return null;
      birds.push(t);
    }
    const blocks = [];
    const nBlocks = read();
    if (nBlocks > LIMITS.blocks) return null;
    for (let k = 0; k < nBlocks; k++) {
      const type = BLOCK_TYPES[s[i++]];
      if (!type) return null;
      const gx = read(), gy = read();
      const size = SIZES[s[i++]];
      if (!size) return null;
      blocks.push({ x: gx * GRID, y: gy * GRID, width: size[0], height: size[1], type });
    }
    const pigs = [];
    const nPigs = read();
    if (nPigs > LIMITS.pigs) return null;
    for (let k = 0; k < nPigs; k++) {
      const radius = PIG_RADII[s[i++]];
      if (!radius) return null;
      const gx = read(), gy = read();
      pigs.push({ x: gx * GRID, y: gy * GRID, radius });
    }
    const pearls = [];
    const nPearls = read();
    if (nPearls > LIMITS.pearls) return null;
    for (let k = 0; k < nPearls; k++) {
      const gx = read(), gy = read();
      pearls.push({ x: gx * GRID, y: gy * GRID });
    }
    if (i !== s.length) return null; // 尾部有多余字符 = 坏码
    // 补展示/结算字段：挑战关（启动直达/剪贴板/挑战记录）都经此函数，
    // 不补则 settle.computeStars 读 level.stars[0] 崩溃、HUD 标题渲染 undefined
    const base = pigs.length * 1000 + blocks.length * 250;
    return { birds, blocks, pigs, pearls,
      name: '自制关', flavor: '玩家创作', trajectory: 70,
      stars: [Math.round(base * 0.6), base, Math.round(base * 1.5)] };
  } catch (e) {
    return null;
  }
}

module.exports = { encodeLevel, decodeLevel, GRID, LIMITS };