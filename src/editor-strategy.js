/**
 * 造关师策略核心 - 关卡设计的「官方视角」实时读数（T14）。
 * Editor strategy core: design-intelligence readings for custom levels.
 *
 * 纯函数层：不依赖 wx / test-harness，游戏运行时与 Node 测试双端可加载。
 * 所有阈值复算自引擎常量（config.js / combat.js / physics.js 实证），
 * 推导依据见 docs/editor-redesign-t14.md 与 src/levels.js L39 注释头（v5~v38 实证档案）。
 *
 * 四件套：
 *   ① 五维难度读数（P1 弹药 / P2 识别 / P3 精度 / P4 序列 / P5 方差）——tools/level-sim.js v2 尺子
 *      的 level 对象泛化版（不依赖 LEVELS 索引，P1 待 AI 试解回填）；
 *   ② 击杀组分析 killGroups——爆波连通分量：两豚可被同一发炸弹覆盖则同组
 *      （判据 d < 2*(110+min(rA,rB))，爆心中置双杀充要条件）；
 *   ③ 滚球连坐 rollPairs——normal/dash 撞豚贴地滚球双杀（实证滚 57px，判据 ≤60px 且贴地）；
 *   ④ 预警 warnings——一炮双杀风险 / 无炸弹破壳 / AI 未解 / 高置不可达。
 *
 * 用法：strategyRead(level, solved?) → { five, groups, rollPairs, warnings, fingerprint, tier }
 */
'use strict';

const C = require('./config.js');

const BOMB_R = 110;                 // combat.js BOMB_RADIUS
const BIRD_R = 17;                  // physics.js 鸟半径（起爆提前量的一半来源）
const ROLL_MAX = 60;                // physics.js 实证：撞豚反弹贴地实测滚 57px
const PIG_CHARGE = { 17: 's', 22: 'l', 28: 'b' }; // 与 level-codec 对齐的半径档位

// ==================== 静态指标（level-sim analyze 泛化）====================

const MAT_LABEL = { wood: '木', ice: '冰', stone: '石', fire: '火', burst: '爆' };
const STRUCT_MATS = Object.keys(C.BLOCK_TYPES).filter(m => m !== 'burst');
const hpOf = t => (C.BLOCK_TYPES[t] ? C.BLOCK_TYPES[t].health : 1);
const denOf = t => (C.BLOCK_TYPES[t] && C.BLOCK_TYPES[t].density != null ? C.BLOCK_TYPES[t].density : 1);

/** 章鱼血量：王取 hp 字段；否则按半径档（与 entities.js Octopus 构造一致：r>20 → hp2） */
function pigHp(p) {
  if (p.boss) return p.hp || 5;
  return p.hp || (p.radius > 26 ? 3 : p.radius > 20 ? 2 : 1);
}

/** 静态指标：鸟/豚比、主材占比、加权块血、均猪血、裸露豚、砰砰数（与 level-sim analyze 同公式） */
function analyzeLevel(level) {
  const blocks = (level.blocks || []).filter(b => !b.sleep);
  const awakePigs = (level.pigs || []).filter(p => !p.sleep);
  const birdsN = Array.isArray(level.birds) ? level.birds.length : (level.birds || 0);
  const cnt = {};
  for (const m of Object.keys(C.BLOCK_TYPES)) cnt[m] = 0;
  for (const b of blocks) if (cnt[b.type] != null) cnt[b.type]++;
  const hardness = blocks.length ? blocks.reduce((s, b) => s + hpOf(b.type) * denOf(b.type), 0) / blocks.length : 0;
  const avgPigHp = awakePigs.length ? awakePigs.reduce((s, p) => s + pigHp(p), 0) / awakePigs.length : 0;
  const bombN = Array.isArray(level.birds) ? level.birds.filter(t => t === 'bomb').length : 0;

  // 裸露豚：周围 r+8 无块且正上方无盖板
  let exposed = 0;
  for (const p of awakePigs) {
    if (p.boss) continue;
    const r = (p.radius || 16) + 8;
    const covered = blocks.some(b => {
      const nearX = b.x + b.width > p.x - r && b.x < p.x + r;
      const nearY = b.y + b.height > p.y - r && b.y < p.y + r;
      return nearX && nearY;
    });
    if (!covered) exposed++;
  }

  const structTotal = STRUCT_MATS.reduce((s, m) => s + cnt[m], 0);
  let mainType = STRUCT_MATS[0], mainMax = -1;
  for (const m of STRUCT_MATS) if (cnt[m] > mainMax) { mainMax = cnt[m]; mainType = m; }
  const mainRatio = structTotal ? mainMax / structTotal : 0;
  const matDetail = STRUCT_MATS.map(m => MAT_LABEL[m] + cnt[m]).join('') + '爆' + (cnt.burst || 0);

  return {
    birdsN, awake: awakePigs.length, ratio: birdsN / Math.max(1, awakePigs.length),
    cnt, matDetail, bombN, hardness, avgPigHp, exposed, mainType, mainRatio,
  };
}

// ==================== 决策点 / 链深 / 方差（level-sim v2 泛化）====================

/** 决策点分解：承重/掩护块（贴地且上方有块 resting 或邻猪 r+8）+ 壳猪 + 冻果 + 多段目标 */
function decisionPointsLevel(level) {
  const blocks = (level.blocks || []).filter(b => !b.sleep);
  const pigs = (level.pigs || []).filter(p => !p.sleep);
  const G = C.GROUND_Y;
  const pigNear = (b, p) => {
    const r = (p.radius || 16) + 8;
    return b.x + b.width > p.x - r && b.x < p.x + r && b.y + b.height > p.y - r && b.y < p.y + r;
  };
  let supports = 0;
  for (const b of blocks) {
    if (b.type === 'burst') continue;
    if (b.y + b.height <= G - 4) continue;                       // 非贴地不成柱
    const rests = blocks.some(o => o !== b && o.type !== 'burst' &&
      o.x < b.x + b.width && o.x + o.width > b.x && o.y + o.height <= b.y + 6 && o.y >= b.y - 220);
    if (rests || pigs.some(p => pigNear(b, p))) supports++;      // 承重柱或掩护墙
  }
  const burst = blocks.filter(b => b.type === 'burst').length;
  const shelled = pigs.filter(p => !p.boss && blocks.some(b => pigNear(b, p))).length;
  // 与 level-sim decisionPoints 同式：多段目标 = 血≥2 的豚，章王额外 +1（王既是多段又是阶段 Boss）
  const boss = pigs.find(p => p.boss);
  const multi = pigs.filter(p => pigHp(p) >= 2).length + (boss ? 1 : 0);
  return { supports, shelled, burst, multi, D: supports + shelled + burst + multi };
}

/** 依赖链深度：直射1 / 坍塌可达2 / 连锁可达3 / 章王按阶段 +1~2（非王 cap 3） */
function chainDepthLevel(level) {
  const dp = decisionPointsLevel(level);
  const boss = (level.pigs || []).some(p => p.boss);
  let L = 1;
  if (dp.supports > 0) L++;
  if (dp.burst >= 1) L++;
  if (boss) {
    const hp = ((level.pigs || []).find(p => p.boss) || {}).hp || 5;
    L += hp >= 11 ? 3 : hp >= 8 ? 2 : hp >= 6 ? 1 : 0;
  }
  return Math.min(5, L);
}

/** 方差源：冻果数 + sleep 实体（自制关无 sleep，恒为 burst 数） */
function varianceOfLevel(level) {
  const burst = (level.blocks || []).filter(b => b.type === 'burst' && !b.sleep).length;
  const sleep = (level.blocks || []).filter(b => b.sleep).length + (level.pigs || []).filter(p => p.sleep).length;
  return { burst, sleep, R: burst + sleep };
}

/** 指纹向量：同解骨架相同即同指纹（与 level-sim fingerprint 同构） */
function fingerprintLevel(level) {
  const a = analyzeLevel(level);
  const dp = decisionPointsLevel(level);
  const blocks = (level.blocks || []).filter(b => !b.sleep);
  const pigs = (level.pigs || []).filter(p => !p.sleep);
  const boss = pigs.some(p => p.boss);
  const big = pigs.filter(p => (p.radius || 16) > 20).length;
  const lintel = blocks.filter(b => b.type !== 'burst' && b.width >= 80 && b.height <= 30).length;
  const wallH = blocks.filter(b => b.type !== 'burst').reduce((m, b) => Math.max(m, b.height), 0);
  const fireTop = pigs.filter(p => blocks.some(b => b.type === 'fire' &&
    Math.abs((b.x + b.width / 2) - p.x) < b.width / 2 + 6 &&
    Math.abs(b.y - (p.y + (p.radius || 16))) < 10)).length;
  return [
    a.birdsN + '鸟', a.awake + '豚', '砰' + a.bombN, '大' + big,
    '壳' + dp.shelled, '孤' + (a.awake - dp.shelled - (boss ? 1 : 0)), '果' + dp.burst,
    '墙' + (Math.round(wallH / 10) * 10), '楣' + lintel, '火顶' + fireTop,
    boss ? '王' : '', a.matDetail,
  ].join('/');
}

/** P3 精度：自制关 trajectory 恒 70（deriveLevel）→ P3=1；泛化保留公式供挑战关复用 */
function p3OfLevel(level) {
  const t = level.trajectory != null ? level.trajectory : 70;
  return Math.min(5, Math.max(1, Math.round((70 - t) / 12)));
}

/** 五维读数；solved（AI 试解结果）可选，缺省 P1/W 记 null */
function fiveDimLevel(level, solved) {
  const dp = decisionPointsLevel(level);
  const P2 = Math.min(5, dp.D);
  const P3 = p3OfLevel(level);
  const P4 = chainDepthLevel(level);
  const P5 = Math.min(5, varianceOfLevel(level).R);
  let P1 = null, W = null;
  if (solved && solved.won) {
    W = solved.birdsN - solved.used;
    P1 = Math.min(5, Math.max(1, 5 - W));
  }
  const dims = P1 == null ? [P2, P3, P4, P5] : [P1, P2, P3, P4, P5];
  const comp = dims.reduce((s, v) => s + v, 0) / dims.length;
  return { P1, P2, P3, P4, P5, W, comp, dp };
}

/** comp → 官方章级映射（给创作者的情境感；与 CHAPTER_V2 五章对齐） */
function chapterTierOf(comp) {
  if (comp >= 4.0) return { name: '潮汐王座', color: '#FFCC80' };
  if (comp >= 3.5) return { name: '极境深渊', color: '#FF8A80' };
  if (comp >= 3.0) return { name: '深渊要塞', color: '#CE93D8' };
  if (comp >= 2.0) return { name: '珊瑚海', color: '#FFAB91' };
  return { name: '新手湾', color: '#7FDDE8' };
}

// ==================== 击杀组（爆波连通分量）====================

/**
 * 两豚是否可被同一发炸弹爆波覆盖。
 * 推导：炸弹瞄任一豚时撞点前 17+r 起爆（爆心距目标 ≤17+r）；杀豚需爆心距 < 110+r。
 * 爆心中置时距两豚各 d/2，双杀充要条件 d/2 < 110+min(rA,rB)，即 d < 2*(110+min(rA,rB))。
 * 「瞄 A 起爆」路径 d < 81+rB−rA 恒 ≤ 上式，已被覆盖。
 */
function blastLinked(a, b) {
  const d = Math.hypot(a.x - b.x, a.y - b.y);
  return d < 2 * (BOMB_R + Math.min(a.radius || 16, b.radius || 16));
}

/**
 * 击杀组：豚节点的爆波连通分量（并查集）。
 * 返回 [{ id, members:[idx], maxR }]，id 从 1 起按首个成员索引排序。
 */
function killGroups(level) {
  const pigs = (level.pigs || []).filter(p => !p.sleep);
  const n = pigs.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (blastLinked(pigs[i], pigs[j])) parent[find(i)] = find(j);
    }
  }
  const byRoot = new Map();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    if (!byRoot.has(r)) byRoot.set(r, []);
    byRoot.get(r).push(i);
  }
  const groups = [...byRoot.values()]
    .sort((a, b) => a[0] - b[0])
    .map((members, id) => ({
      id: id + 1,
      members,
      maxR: Math.max(...members.map(i => pigs[i].radius || 16)),
    }));
  return { pigs, groups };
}

// ==================== 滚球连坐对 ====================

/**
 * normal/dash 撞豚后沿法线反弹贴地左滚（v6 实证滚 57px 杀死 70px 外左豚）。
 * 判据：两豚间距 ≤60px 且都贴地（底边落在海床 ±4px）。
 * 返回 [[i, j], ...]（原关卡 pigs 数组下标，含 sleep 过滤前的映射）。
 */
function rollPairs(level) {
  const G = C.GROUND_Y;
  const out = [];
  const pigs = level.pigs || [];
  for (let i = 0; i < pigs.length; i++) {
    for (let j = i + 1; j < pigs.length; j++) {
      const a = pigs[i], b = pigs[j];
      if (a.sleep || b.sleep) continue;
      const groundA = a.y + (a.radius || 16) >= G - 4;
      const groundB = b.y + (b.radius || 16) >= G - 4;
      if (!groundA || !groundB) continue;
      if (Math.hypot(a.x - b.x, a.y - b.y) <= ROLL_MAX) out.push([i, j]);
    }
  }
  return out;
}

// ==================== 汇总读数 + 预警 ====================

/**
 * 策略总读数。solved 为 AI 试解结果 { used, won, birdsN } 或 null。
 * warnings 与 level-validate 的 issues 分离：issues 挡试玩，warnings 只提示不拦截。
 */
function strategyRead(level, solved) {
  const five = fiveDimLevel(level, solved);
  const { pigs, groups } = killGroups(level);
  const rolls = rollPairs(level);
  const a = analyzeLevel(level);
  const tier = chapterTierOf(five.comp);
  const warnings = [];

  // 一炮双杀风险：多豚组数 > bomb 数（贪心可合并的击杀被配队容量逼宫）
  const multiGroups = groups.filter(g => g.members.length >= 2);
  if (multiGroups.length && a.bombN < multiGroups.length) {
    const worst = multiGroups.reduce((m, g) => g.members.length > m.members.length ? g : m);
    warnings.push({
      kind: 'group-risk',
      msg: `一炮双杀风险：${worst.members.length} 豚可被同一发砰砰覆盖，配队仅 ${a.bombN} 只砰砰`,
      x: pigs[worst.members[0]].x, y: pigs[worst.members[0]].y,
    });
  }

  // 滚球连坐：贴地近距双豚（normal/dash 轴）
  if (rolls.length) {
    const [i, j] = rolls[0];
    warnings.push({
      kind: 'roll-risk',
      msg: `一鸟滚球双杀：豚${i}与豚${j}贴地相距 ≤60px，普通豚撞一只会连坐另一只`,
      x: pigs[i].x, y: pigs[i].y,
    });
  }

  // 无炸弹破壳：存在壳猪（被块掩护）但配队无 bomb 且无 burst
  const dp = five.dp;
  if (dp.shelled > 0 && a.bombN === 0 && dp.burst === 0) {
    warnings.push({
      kind: 'no-bomb',
      msg: `${dp.shelled} 只壳猪被方块掩护，配队没有砰砰/爆裂果难以破壳`,
      x: 0, y: 0,
    });
  }

  // AI 未解（试解跑过且未 WIN）
  if (solved && !solved.won) {
    warnings.push({
      kind: 'unsolved',
      msg: 'AI 试解未通关（贪心短视，非死局判据）——可尝试更直观的解法或减少章鱼',
      x: 0, y: 0,
    });
  }

  // 全裸且高置：所有豚距爆波可达域外且无 bomb（静态粗判：最近豚对间距 >244 且无 bomb）
  if (a.bombN === 0 && dp.burst === 0 && pigs.length >= 2) {
    const { groups: g2 } = killGroups(level);
    if (g2.every(g => g.members.length === 1)) {
      warnings.push({
        kind: 'unreachable',
        msg: '章鱼两两相距 >244px（爆波不可覆盖）且没有砰砰/爆裂果，每只都需精准直瞄',
        x: 0, y: 0,
      });
    }
  }

  return {
    five, groups, groupOf: groupIndexOf(pigs, groups), rollPairs: rolls,
    warnings, fingerprint: fingerprintLevel(level), tier, analyze: a,
  };
}

/** 每豚 → 组 id 映射（渲染层画组连线用；孤豚映射到 0） */
function groupIndexOf(pigs, groups) {
  const map = new Array(pigs.length).fill(0);
  for (const g of groups) for (const i of g.members) map[i] = g.id;
  return map;
}

// ==================== AI 试解辅助（目标点 / 网格瞄准）====================

const AX = C.SLINGSHOT_X;
const AY = C.SLINGSHOT_Y - 15;
const PF = C.POWER_FACTOR;

/**
 * 智能目标点：醒猪中心、每个方块中心、贴地承重基座点（炸基座使整面坍塌）。
 * 与 tools/level-sim.js targetPoints 同构（level 对象泛化）。
 */
function simTargets(level) {
  const pts = [];
  for (const p of (level.pigs || [])) { if (!p.sleep) pts.push({ x: p.x, y: p.y, kind: 'pig' }); }
  for (const b of (level.blocks || [])) {
    if (b.sleep) continue;
    const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
    pts.push({ x: cx, y: cy, kind: b.type === 'burst' ? 'burst' : 'block' });
    if (b.type !== 'burst' && b.y + b.height > C.GROUND_Y - 95) {
      pts.push({ x: cx, y: C.GROUND_Y - 55, kind: 'base' });
    }
  }
  const out = [];
  for (const p of pts) {
    if (!out.some(q => Math.hypot(q.x - p.x, q.y - p.y) < 24)) out.push(p);
  }
  return out;
}

/**
 * 网格瞄准：在合法拉弓域内搜最接近 (tx,ty) 的预测弹道。
 * 与 tools/level-sim.js aimBot 同网格参数（px 步 4 / py 步 4，calculateTrajectory 90 步），
 * 但**起点用拖动位而非弹弓锚点**——与 renderer.drawTrajectory（currentBird.x/y）和
 * input.js 真实发射链路严格一致：鸟从拖动位起飞，锚点起算会带 ≤95px 恒定偏移导致必歪。
 * （tools/level-sim.js 的 aimBot 保留锚点起算：其 W 读数是难度曲线既定基线，不联动。）
 * game 需已装载关卡（只读 calculateTrajectory，无状态依赖）。
 */
function simAim(game, tx, ty) {
  let best = null;
  for (let px = AX - 95; px <= AX - 15; px += 4) {
    for (let py = AY - 25; py <= AY + 115; py += 4) {
      // 与 input.js onTouchMove 同钳制：MAX_DRAG 限长 + 只向后拉
      let dx = px - AX, dy = py - AY;
      const dist = Math.hypot(dx, dy);
      if (dist > C.MAX_DRAG) { dx = (dx / dist) * C.MAX_DRAG; dy = (dy / dist) * C.MAX_DRAG; }
      if (dx > 0) dx = 0;
      const bx = AX + dx, by = AY + dy;   // 真实拖动位 = 鸟起飞点
      const pts = game.calculateTrajectory(bx, by, (AX - bx) * C.POWER_FACTOR, (AY - by) * C.POWER_FACTOR, 90);
      let minD = Infinity;
      for (const p of pts) { const d = Math.hypot(p.x - tx, p.y - ty); if (d < minD) minD = d; }
      if (!best || minD < best.d) best = { px, py, d: minD };
    }
  }
  return best;
}

module.exports = {
  BOMB_R, ROLL_MAX,
  analyzeLevel, decisionPointsLevel, chainDepthLevel, varianceOfLevel,
  fingerprintLevel, fiveDimLevel, chapterTierOf, pigHp,
  blastLinked, killGroups, rollPairs, strategyRead,
  simTargets, simAim,
};
