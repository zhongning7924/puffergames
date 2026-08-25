/**
 * 每日挑战 - 以日期为种子生成当日限定关卡
 * Daily Challenge - deterministic level variant from a date seed.
 *
 * 设计:
 *  - 种子 = 日期字符串哈希 + mulberry32 PRNG，全体玩家当日同题（可比拼）；
 *  - 从第 3~10 关中选一关做基底：方块结构沿用，猪位置/大小抖动，
 *    鸟队列从四种鸟中随机抽取，弹道预览长度随机；
 *  - 不用 Math.random，保证确定性。
 */

const C = require('./config.js');
const U = require('./utils.js');

// FNV-1a 哈希：日期字符串 → 32 位种子
function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// mulberry32：小巧的确定性 PRNG
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 本地日期字符串 YYYY-MM-DD（每日挑战的种子） */
function todayString() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const BIRD_POOL = ['normal', 'dash', 'bomb', 'split'];

/**
 * 生成当日挑战关卡。
 * @param {string} dateStr 日期种子
 * @param {Array} baseLevels 全部关卡（从 index 2 起抽基底，跳过前两关教学关）
 */
function generateLevel(dateStr, baseLevels) {
  const rng = mulberry32(hashString('angryAgainDaily:' + dateStr));
  const GROUND_Y = C.GROUND_Y;

  // 基底关卡（第 3~10 关）
  const baseIdx = 2 + Math.floor(rng() * Math.max(1, baseLevels.length - 2));
  const base = baseLevels[Math.min(baseIdx, baseLevels.length - 1)];

  // 猪：大小变化 ±3，位置抖动；候选位置撞方块则先用基底原位
  const blocks = base.blocks.map((b) => ({ ...b }));
  const basePigs = base.pigs;
  const pigs = basePigs.map((p) => {
    const radius = Math.max(13, Math.min(24, p.radius + Math.floor(rng() * 7) - 3));
    const cand = {
      x: p.x + (rng() * 40 - 20),
      y: Math.min(p.y + (rng() * 20 - 10), GROUND_Y - radius),
      radius,
    };
    for (const b of blocks) {
      if (U.circleRect(cand, b).collided) {
        return { x: p.x, y: p.y, radius: p.radius };
      }
    }
    return cand;
  });

  // 迭代修复：分离互叠 → 夹取边界 → 撞方块的猪"锁定"退回基底原位。
  // 锁定猪不再移动；基底布局本身合法（互不重叠、不撞方块），每轮至多
  // 新增一头锁定猪，必然收敛。
  const locked = new Array(pigs.length).fill(false);
  for (let iter = 0; iter < 30; iter++) {
    let stable = true;
    // 猪两两防重叠（锁定猪不动，对方承受全部推力）
    for (let i = 0; i < pigs.length; i++) {
      for (let j = i + 1; j < pigs.length; j++) {
        const a = pigs[i];
        const b = pigs[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const minD = a.radius + b.radius + 4;
        const d = Math.hypot(dx, dy) || 1;
        if (d >= minD) continue;
        stable = false;
        const ux = dx / d;
        const uy = dy / d;
        const push = minD - d;
        if (locked[i] && locked[j]) continue; // 基底互不重叠，不会发生
        if (locked[i]) {
          b.x += ux * push; b.y += uy * push;
        } else if (locked[j]) {
          a.x -= ux * push; a.y -= uy * push;
        } else {
          a.x -= (ux * push) / 2; a.y -= (uy * push) / 2;
          b.x += (ux * push) / 2; b.y += (uy * push) / 2;
        }
      }
    }
    // 夹取边界 + 撞方块锁定回退
    for (let i = 0; i < pigs.length; i++) {
      if (locked[i]) continue;
      const p = pigs[i];
      p.x = Math.max(C.SCREEN_WIDTH * 0.5, Math.min(C.SCREEN_WIDTH - p.radius - 4, p.x));
      p.y = Math.min(p.y, GROUND_Y - p.radius);
      for (const b of blocks) {
        if (U.circleRect(p, b).collided) {
          pigs[i] = { x: basePigs[i].x, y: basePigs[i].y, radius: basePigs[i].radius };
          locked[i] = true;
          stable = false;
          break;
        }
      }
    }
    if (stable) break;
  }
  // 兜底：极端情况下仍未分离的对，后者退回基底原位
  for (let i = 0; i < pigs.length; i++) {
    for (let j = i + 1; j < pigs.length; j++) {
      const a = pigs[i];
      const b = pigs[j];
      if (Math.hypot(b.x - a.x, b.y - a.y) < a.radius + b.radius) {
        pigs[j] = { x: basePigs[j].x, y: basePigs[j].y, radius: basePigs[j].radius };
      }
    }
  }

  // 鸟队列：沿用基底数量，随机抽鸟种
  const birdCount = Array.isArray(base.birds) ? base.birds.length : base.birds;
  const birds = [];
  for (let i = 0; i < birdCount; i++) {
    birds.push(BIRD_POOL[Math.floor(rng() * BIRD_POOL.length)]);
  }

  // 星级门槛按内容量估算
  const baseScore = pigs.length * 1000 + blocks.length * 250;
  const stars = [
    Math.round(baseScore * 0.6),
    Math.round(baseScore * 1.0),
    Math.round(baseScore * 1.5),
  ];

  return {
    name: '每日挑战',
    daily: true,
    baseIndex: baseIdx, // 基底关卡下标（测试/调试用，游戏逻辑不读取）
    birds,
    trajectory: 20 + Math.floor(rng() * 25),
    stars,
    pigs,
    blocks,
  };
}

module.exports = { generateLevel, todayString };
