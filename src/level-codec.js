/**
 * 关卡码编解码 - 自制关卡 ↔ 紧凑字符串（微信分享 query 用）。
 * 纯函数，无 wx 依赖（仅 require config 取章王元数据，config 模块期不触 wx）。
 *
 * 格式演进：
 *  - PG1（历史）：章王由半径 28 隐式判定，无 style/name，解码后统一回退深渊紫。
 *  - PG2（现行）：章王编码为 'b' + style 字符 + hp，配色/名字/体型按 style 从
 *    config.BOSS_STYLE 单一数据源还原，与玩法五色章王同源。
 *  decodeLevel 同时兼容 PG1 / PG2；encodeLevel 一律产出 PG2。
 *  返回值附带 name/flavor/trajectory/stars 展示字段（挑战关直装载用），非纯数据往返。
 */
'use strict';
const C = require('./config.js');

const GRID = 4;
const PREFIX = 'PG2';
const LEGACY_PREFIX = 'PG1';
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
// 普通章鱼半径（章王不再走半径枚举，改由 style 决定体型）
const PIG_CHARS = { 17: 's', 22: 'l' };
const PIG_RADII = { s: 17, l: 22 };
// 章王 style 字符（PG2 起）：'b' 为章王标记，后接 1 个 style 字符
const BOSS_STYLE_CHARS = { marsh: 'M', ice: 'I', stone: 'S', abyss: 'A', throne: 'T' };
const BOSS_STYLE_KEYS = { M: 'marsh', I: 'ice', S: 'stone', A: 'abyss', T: 'throne' };

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
  out += enc(birds.length);
  for (const b of birds) {
    const bc = BIRD_CHARS[b];
    if (!bc) throw new Error('codec 未知河豚类型: ' + b);
    out += bc;
  }
  out += enc(blocks.length);
  for (const b of blocks) {
    out += BLOCK_CHARS[b.type] + enc(Math.round(b.x / GRID)) + enc(Math.round(b.y / GRID))
      + SIZE_KEY(b.width, b.height, b.type);
  }
  out += enc(pigs.length);
  for (const p of pigs) {
    if (p.boss) {
      // 章王：'b' 标记 + style 字符 + hp（体型/名字随 style 从 config 还原，不占码位）
      const sc = BOSS_STYLE_CHARS[p.style] || BOSS_STYLE_CHARS.abyss;
      out += 'b' + sc + enc(p.hp || 5);
    } else {
      const pc = PIG_CHARS[p.radius];
      if (!pc) throw new Error('codec 未知章鱼半径: ' + p.radius);
      out += pc;
    }
    out += enc(Math.round(p.x / GRID)) + enc(Math.round(p.y / GRID));
  }
  out += enc(pearls.length);
  for (const p of pearls) out += enc(Math.round(p.x / GRID)) + enc(Math.round(p.y / GRID));
  return out;
}

function decodeLevel(code) {
  try {
    if (typeof code !== 'string') return null;
    let s, legacy = false;
    if (code.startsWith(PREFIX)) s = code.slice(PREFIX.length);
    else if (code.startsWith(LEGACY_PREFIX)) { s = code.slice(LEGACY_PREFIX.length); legacy = true; }
    else return null;
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
      const rch = s[i++];
      if (legacy) {
        // PG1：半径 17/22 普通豚；半径 28 隐式章王（无 style，回退深渊紫）
        const radius = PIG_RADII[rch] !== undefined ? PIG_RADII[rch] : (rch === 'b' ? 28 : null);
        if (!radius) return null;
        const pig = { x: 0, y: 0, radius };
        if (rch === 'b') { pig.boss = true; pig.hp = read(); pig.name = '章鱼王'; pig.style = 'abyss'; }
        const gx = read(), gy = read();
        pig.x = gx * GRID;
        pig.y = gy * GRID;
        pigs.push(pig);
      } else if (rch === 'b') {
        // PG2 章王：style 字符 + hp；体型/名字由 style 单一数据源还原
        const styleKey = BOSS_STYLE_KEYS[s[i++]];
        if (!styleKey) return null;
        const meta = C.BOSS_STYLE[styleKey];
        if (!meta) return null;
        const hp = read();
        const gx = read(), gy = read();
        pigs.push({ x: gx * GRID, y: gy * GRID, radius: meta.radius, boss: true, hp, name: meta.name, style: styleKey });
      } else {
        const radius = PIG_RADII[rch];
        if (!radius) return null;
        const gx = read(), gy = read();
        pigs.push({ x: gx * GRID, y: gy * GRID, radius });
      }
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
