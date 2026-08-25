/**
 * 珍珠收集系统 - 隐藏珍珠定义、章节奖励判定与珍珠关生成
 * Pearls - hidden collectibles, chapter awards and bonus level generation.
 *
 * 设计（对标原版愤怒的小鸟金蛋系统）：
 *  - 共 10 颗：6 颗藏于关卡场景（飞行途中触碰拾取）、
 *    3 颗为章节全三星奖励、1 颗为主菜单双击吉祥物彩蛋；
 *  - 每颗珍珠解锁 1 个珍珠关（复用每日挑战的确定性 remix 生成器，
 *    种子 = 珍珠 ID：同一珍珠的关卡永远一致，可复现重开）。
 */
const DAILY = require('./daily.js');

// 章节划分（新手湾 / 珊瑚海 / 深渊要塞，与关卡难度带对应）
const CHAPTERS = [
  { id: 'ch1', label: '新手湾', levels: [0, 1, 2] },
  { id: 'ch2', label: '珊瑚海', levels: [3, 4, 5, 6] },
  { id: 'ch3', label: '深渊要塞', levels: [7, 8, 9] },
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
  { id: 'ui', type: 'ui', label: '彩蛋珍珠' },
];

const TOTAL = PEARLS.length;

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

/** 生成珍珠关（确定性：同一珍珠 ID 永远生成同一关卡） */
function generateBonusLevel(meta, baseLevels) {
  const level = DAILY.generateLevel('pearl:' + meta.id, baseLevels);
  return { ...level, name: '珍珠关 · ' + meta.label, bonus: true };
}

module.exports = {
  CHAPTERS,
  PEARLS,
  TOTAL,
  totalCollected,
  unlockedMetas,
  checkChapterAward,
  generateBonusLevel,
};
