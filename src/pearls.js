/**
 * 珍珠收集系统 - 隐藏珍珠定义、章节奖励判定与珍珠关生成
 * Pearls - hidden collectibles, chapter awards and bonus level generation.
 *
 * 设计（对标原版愤怒的小鸟金蛋系统）：
 *  - 共 12 颗：6 颗藏于关卡场景（飞行途中触碰拾取）、
 *    5 颗为章节全三星奖励（五章各一）、1 颗为主菜单双击吉祥物彩蛋；
 *  - 每颗珍珠解锁 1 个珍珠关（独立生成器，与每日挑战解耦：
 *    拥有专属基底池、豚种组合、主题色、难度系数，让 12 关各有区分度）。
 */
const C = require('./config.js');
const U = require('./utils.js');

// 章节划分（新手湾 / 珊瑚海 / 深渊要塞 / 极境深渊 / 潮汐王座，5 章 × 8 关 = 40 关）
const CHAPTERS = [
  { id: 'ch1', label: '新手湾', levels: [0, 1, 2, 3, 4, 5, 6, 7] },
  { id: 'ch2', label: '珊瑚海', levels: [8, 9, 10, 11, 12, 13, 14, 15] },
  { id: 'ch3', label: '深渊要塞', levels: [16, 17, 18, 19, 20, 21, 22, 23] },
  { id: 'ch4', label: '极境深渊', levels: [24, 25, 26, 27, 28, 29, 30, 31] },
  { id: 'ch5', label: '潮汐王座', levels: [32, 33, 34, 35, 36, 37, 38, 39] },
];

// 全部珍珠（数组顺序 = 珍珠关轮换顺序）
const PEARLS = [
  { id: 'lv0', type: 'level', label: '云端珍珠' },
  { id: 'lv1', type: 'level', label: '屋后珍珠' },
  { id: 'lv2', type: 'level', label: '塔尖珍珠' },
  { id: 'ch1', type: 'chapter', label: '新手湾之珠' },
  { id: 'lv4', type: 'level', label: '桥下珍珠' },
  { id: 'ch2', type: 'chapter', label: '珊瑚海之珠' },
  { id: 'lv6', type: 'level', label: '尽头珍珠' },
  { id: 'lv8', type: 'level', label: '檐上珍珠' },
  { id: 'ch3', type: 'chapter', label: '深渊要塞之珠' },
  { id: 'ch4', type: 'chapter', label: '极境深渊之珠' },
  { id: 'ch5', type: 'chapter', label: '潮汐王座之珠' },
  { id: 'ui', type: 'ui', label: '彩蛋珍珠' },
];

const TOTAL = PEARLS.length;

// ============================================================
// 珍珠关专属配置：12 颗珍珠对应 12 个独立 profile
// 难度递进（按 PEARLS 数组顺序），主题色按珍珠类型分段：
//   0-3 新手湾系列（青色） / 4-7 珊瑚海系列（橙红） /
//   8-9 深渊系列（紫红）  / 10-11 王座系列（金琥珀）
// 每颗珍珠：基底范围 + 专属豚种 + 主题色 + 难度系数 + 弹道长度 + 额外章鱼
// ============================================================
const BONUS_PROFILES = [
  // 新手湾系列（珍珠 0-3）—— 入门体验，3 豚简单关
  // （baseRange 为 40 关新下标：新手湾锚点区 12-15 = 原礁堡迷阵~双子灯塔）
  { baseRange: [12, 14], birdSet: ['normal', 'dash', 'normal'],
    themeColor: '#26C6DA', hardness: 1.0, trajectory: 36, extraPigs: 0 },
  { baseRange: [12, 14], birdSet: ['dash', 'normal', 'bomb'],
    themeColor: '#26C6DA', hardness: 1.0, trajectory: 34, extraPigs: 0 },
  { baseRange: [13, 15], birdSet: ['normal', 'bomb', 'dash'],
    themeColor: '#4FC3F7', hardness: 1.1, trajectory: 32, extraPigs: 1 },
  { baseRange: [13, 15], birdSet: ['dash', 'normal', 'bomb', 'normal'],
    themeColor: '#4FC3F7', hardness: 1.1, trajectory: 30, extraPigs: 0 },

  // 珊瑚海系列（珍珠 4-7）—— 中等挑战，4 豚混合技能
  // （潮阶塔林 15 → 钢铁方阵 20 → 深渊王座 23 区段）
  { baseRange: [15, 20], birdSet: ['bomb', 'split', 'dash'],
    themeColor: '#FF7043', hardness: 1.2, trajectory: 28, extraPigs: 1 },
  { baseRange: [15, 20], birdSet: ['split', 'bomb', 'dash', 'normal'],
    themeColor: '#FF7043', hardness: 1.2, trajectory: 26, extraPigs: 0 },
  { baseRange: [18, 23], birdSet: ['bomb', 'split', 'dash', 'normal'],
    themeColor: '#FF8A65', hardness: 1.3, trajectory: 24, extraPigs: 1 },
  { baseRange: [18, 23], birdSet: ['split', 'bomb', 'dash', 'bomb'],
    themeColor: '#FF8A65', hardness: 1.3, trajectory: 22, extraPigs: 0 },

  // 深渊系列（珍珠 8-9）—— 硬核挑战，4 豚全技能
  // （深渊王座 23 → 断崖炮台 28；漩涡碉堡 27 → 冰火长城 29）
  { baseRange: [23, 28], birdSet: ['bomb', 'split', 'dash', 'bomb'],
    themeColor: '#AB47BC', hardness: 1.4, trajectory: 22, extraPigs: 1 },
  { baseRange: [27, 29], birdSet: ['split', 'bomb', 'dash', 'split'],
    themeColor: '#EF5350', hardness: 1.5, trajectory: 20, extraPigs: 1 },

  // 王座系列（珍珠 10-11）—— 终极挑战，5 豚极限关
  // （冰火长城 29 → 潮汐要塞 36）
  { baseRange: [29, 36], birdSet: ['bomb', 'split', 'dash', 'bomb', 'split'],
    themeColor: '#FFA726', hardness: 1.7, trajectory: 20, extraPigs: 1 },
  { baseRange: [29, 36], birdSet: ['split', 'bomb', 'dash', 'bomb', 'split'],
    themeColor: '#FFD54F', hardness: 1.9, trajectory: 18, extraPigs: 2 },
];

// FNV-1a 哈希：珍珠 ID → 32 位种子
function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// mulberry32 PRNG：确定性随机数生成
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 已收集珍珠数 */
function totalCollected(progress) {
  const collected = progress.pearls || {};
  return PEARLS.filter(m => collected[m.id]).length;
}

/** 已收集珍珠的 meta 列表（按定义顺序），即珍珠关的解锁池 */
function unlockedMetas(progress) {
  const collected = progress.pearls || {};
  return PEARLS.filter(m => collected[m.id]);
}

/**
 * 章节全三星 → 奖励章节珍珠。
 * @param {object} progress 玩家进度（含 stars / pearls）
 * @param {number} levelIndex 刚通关的关卡下标（用于定位所属章节）
 * @returns 新获奖珍珠 meta（含展示 label），无新奖则 null
 */
function checkChapterAward(progress, levelIndex) {
  const collected = progress.pearls || {};
  for (const ch of CHAPTERS) {
    if (!ch.levels.includes(levelIndex)) continue;
    const full = ch.levels.every(i => (progress.stars[i] || 0) >= 3);
    if (full && !collected[ch.id]) return { id: ch.id, label: ch.label + '全三星' };
  }
  return null;
}

/**
 * 生成珍珠关（确定性：同一珍珠 ID 永远生成同一关卡）
 *
 * 与每日挑战的区别：
 *  - 独立的基底池选择（按珍珠序号分段，而非固定第 3-10 关）
 *  - 专属豚种组合（每颗珍珠固定豚队列，而非基底数量随机抽）
 *  - 专属主题色、难度系数、弹道长度
 *  - 难度递进（hardness 1.0 → 1.9，额外章鱼 0 → 2）
 */
function generateBonusLevel(meta, baseLevels) {
  const idx = PEARLS.findIndex(p => p.id === meta.id);
  const profile = BONUS_PROFILES[idx] || BONUS_PROFILES[0];
  const rng = mulberry32(hashString('pufferBonus:' + meta.id));

  // === 基底关卡（按 profile 范围随机选）===
  const [baseMin, baseMax] = profile.baseRange;
  const baseIdx = baseMin + Math.floor(rng() * (baseMax - baseMin + 1));
  const base = baseLevels[Math.min(baseIdx, baseLevels.length - 1)];

  // === 方块：沿用基底结构 ===
  // 章末 Boss 关的 sleep 阶段物（屏外预置的落石/援军）不属于结构素材，过滤掉，
  // 否则沉睡实体泄漏进珍珠关：睡眠章鱼无敌且计入通关判定 → 死局
  const blocks = base.blocks.filter(b => !b.sleep).map(b => ({ ...b }));

  // === 章鱼生成 ===（Boss 本体同样不取：它是壳内定制巨物，普通生成布局容不下）
  const basePigs = base.pigs.filter(p => !p.sleep && !p.boss);
  const hardnessShrink = Math.floor((profile.hardness - 1.0) * 4); // 难度越高章鱼越小
  const pigs = basePigs.map((p) => {
    const radius = Math.max(13, Math.min(22, p.radius - hardnessShrink));
    const cand = {
      x: p.x + (rng() * 40 - 20),
      y: Math.min(p.y + (rng() * 20 - 10), C.GROUND_Y - radius),
      radius,
    };
    for (const b of blocks) {
      if (U.circleRect(cand, b).collided) {
        return { x: p.x, y: p.y, radius: p.radius };
      }
    }
    return cand;
  });

  // === 额外章鱼（难度高时新增地面章鱼）===
  for (let i = 0; i < profile.extraPigs; i++) {
    pigs.push({
      x: C.SCREEN_WIDTH * 0.55 + rng() * (C.SCREEN_WIDTH * 0.38),
      y: C.GROUND_Y - 18,
      radius: 16,
    });
  }

  // === 防互叠迭代修复（与 daily.js 一致的稳定算法）===
  // 注意：pigs 长度 = basePigs.length + extraPigs
  //  - 基底章鱼（i < basePigCount）：撞方块退回基底原位（基底本身合法）
  //  - 额外章鱼（i >= basePigCount）：撞方块向右推到方块群右边界之外
  const basePigCount = basePigs.length;
  const locked = new Array(pigs.length).fill(false);
  const blockRightEdge = blocks.reduce((m, b) => Math.max(m, b.x + b.width), C.SCREEN_WIDTH * 0.5);
  for (let iter = 0; iter < 30; iter++) {
    let stable = true;
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
        if (locked[i] && locked[j]) continue;
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
    for (let i = 0; i < pigs.length; i++) {
      if (locked[i]) continue;
      const p = pigs[i];
      p.x = Math.max(C.SCREEN_WIDTH * 0.5, Math.min(C.SCREEN_WIDTH - p.radius - 4, p.x));
      p.y = Math.min(p.y, C.GROUND_Y - p.radius);
      let collided = false;
      for (const b of blocks) {
        if (U.circleRect(p, b).collided) { collided = true; break; }
      }
      if (collided) {
        if (i < basePigCount) {
          // 基底章鱼：退回基底原位（合法位置）
          pigs[i] = { x: basePigs[i].x, y: basePigs[i].y, radius: basePigs[i].radius };
        } else {
          // 额外章鱼：推到方块群右边界之外，y 设为地面
          pigs[i].x = blockRightEdge + 4 + (i - basePigCount) * 30;
          pigs[i].y = C.GROUND_Y - pigs[i].radius;
        }
        locked[i] = true;
        stable = false;
      }
    }
    if (stable) break;
  }
  // 兜底：极端情况下仍未分离的对，后者同样按基底/额外分别处理
  for (let i = 0; i < pigs.length; i++) {
    for (let j = i + 1; j < pigs.length; j++) {
      const a = pigs[i];
      const b = pigs[j];
      if (Math.hypot(b.x - a.x, b.y - a.y) < a.radius + b.radius) {
        if (j < basePigCount) {
          pigs[j] = { x: basePigs[j].x, y: basePigs[j].y, radius: basePigs[j].radius };
        } else {
          pigs[j].x = Math.min(C.SCREEN_WIDTH - 30, pigs[j].x + 40);
        }
      }
    }
  }

  // 额外章鱼最终整理：确保不越界、不互相叠、不与基底章鱼叠
  // 按 x 从小到大排序，依次确保每个额外章鱼与前一个（基底或额外）保持半径和 + 间隔
  const extraIdx = [];
  for (let i = basePigCount; i < pigs.length; i++) extraIdx.push(i);
  if (extraIdx.length > 0) {
    // 起始 x = blockRightEdge + 8（避开方块群）
    let nextX = blockRightEdge + 8;
    for (const idx of extraIdx) {
      const r = pigs[idx].radius;
      // 防止 x 越界：若超过屏幕右侧 30px 内，回退到方块群左侧（屏幕中部）
      const maxX = C.SCREEN_WIDTH - r - 4;
      if (nextX > maxX) {
        // 改放在基底群左侧最右方块之外、屏幕中部之前
        nextX = C.SCREEN_WIDTH * 0.5 - 30 - r;
      }
      pigs[idx].x = nextX;
      pigs[idx].y = C.GROUND_Y - r;
      nextX = pigs[idx].x + r * 2 + 8;
    }
    // 检查额外章鱼与所有其他章鱼（含基底章鱼）的互叠，互叠则上抬额外章鱼避开
    for (const idx of extraIdx) {
      const me = pigs[idx];
      for (let j = 0; j < pigs.length; j++) {
        if (j === idx) continue;
        const o = pigs[j];
        if (Math.hypot(o.x - me.x, o.y - me.y) < me.radius + o.radius) {
          // 把额外章鱼上抬到 o 上方
          me.y = Math.min(me.y, o.y - me.radius - o.radius - 4);
          // 但不能高过屏幕顶部
          if (me.y < 100) me.y = 100;
        }
      }
    }
  }

  // === 豚队列：固定 profile.birdSet（不再随机抽取）===
  const birds = profile.birdSet.slice();

  // === 星级门槛：按难度系数加成 ===
  const baseScore = (pigs.length * 1000 + blocks.length * 250) * profile.hardness;
  const stars = [
    Math.round(baseScore * 0.6),
    Math.round(baseScore * 1.0),
    Math.round(baseScore * 1.5),
  ];

  return {
    name: '珍珠关 · ' + meta.label,
    bonus: true,
    bonusThemeColor: profile.themeColor,
    bonusIndex: idx,
    bonusTotal: PEARLS.length,
    birds,
    trajectory: profile.trajectory,
    stars,
    pigs,
    blocks,
    // 珍珠关不再嵌入场景珍珠（避免循环奖励）
    pearls: [],
  };
}

module.exports = {
  CHAPTERS,
  PEARLS,
  TOTAL,
  BONUS_PROFILES,
  totalCollected,
  unlockedMetas,
  checkChapterAward,
  generateBonusLevel,
};
