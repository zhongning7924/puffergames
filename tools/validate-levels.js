/**
 * 关卡数据静态校验 - 几何合法性 + 难度指标
 * Level Validator - geometry checks (bounds/overlaps) + difficulty metrics.
 *
 * 运行：node tools/validate-levels.js
 * 退出码：0 = 全部通过；1 = 存在违规（可接入 CI / 提交前检查）。
 *
 * 校验范围：
 *  1. 手工关卡（levels.js）：章鱼-章鱼/方块-方块互叠、越界、珍珠可达性；
 *  2. 生成关卡（每日挑战 + 全部珍珠关）：同上（守护生成器回归）；
 *  3. 难度指标表（信息输出，不作失败判定）：材料硬度/豚-章鱼比/弹道/三星门槛占比。
 *
 * 注意：章鱼与方块的"贴靠/嵌墙"为既有设计（章鱼藏结构后受保护），只校验章鱼-章鱼
 * 互叠与越界，不校验章鱼-方块交叠。
 */

'use strict';

const { getLevels } = require('../src/levels.js');
const C = require('../src/config.js');
const U = require('../src/utils.js');
const DAILY = require('../src/daily.js');
const PEARLS = require('../src/pearls.js');

const SW = C.SCREEN_WIDTH;
const GY = C.GROUND_Y;
const PEARL_R = 9;          // 珍珠碰撞半径（与 game.checkPearlCollection 一致）
const BIRD_DISP_R = 17 * 0.85; // 候飞队列豚显示半径（越屏检查用）

let failures = 0;
function fail(msg) {
  failures++;
  console.error('  ✗ ' + msg);
}

/** 圆-矩形距离（珍珠 vs 方块用；utils.circleRect 需 rect 朝向，关卡数据无旋转，直接算） */
function circleRectDist(px, py, r) {
  const cx = Math.max(r.x, Math.min(px, r.x + r.width));
  const cy = Math.max(r.y, Math.min(py, r.y + r.height));
  return Math.hypot(px - cx, py - cy);
}

/** 章王怒吼阶段数：公式须与 combat.js onPigHurt 保持一致 */
function bossPhases(hp) {
  return hp >= 11 ? 3 : hp >= 8 ? 2 : hp >= 6 ? 1 : 0;
}

/** 单个关卡的几何校验（label 用于报错定位） */
function checkGeometry(label, level) {
  const pigs = level.pigs || [];
  const blocks = level.blocks || [];
  const pearls = level.pearls || [];

  // 章王（Boss）语义：每关至多 1 只，须具名且 hp≥5、radius≥26（巨物）
  const bosses = pigs.filter(p => p.boss);
  if (bosses.length > 1) fail(`${label} 存在 ${bosses.length} 只章王（每关至多 1 只）`);
  bosses.forEach((p) => {
    if (!p.name) fail(`${label} 章王缺少 name 字段`);
    if (!(p.hp >= 5)) fail(`${label} 章王 hp 非法（需 ≥5）：${p.hp}`);
    if (p.radius < 26) fail(`${label} 章王 radius 过小（巨物需 ≥26）：${p.radius}`);
  });
  const phases = bosses.length ? bossPhases(bosses[0].hp) : 0;

  // sleep 阶段物：必须预置屏外（y<-100，否则开局隐形无敌）；阶段号不得超过
  // 章王怒吼阶段数（睡眠章鱼计入通关判定，永不可唤醒 = 死局）；无章王则无人唤醒
  const checkSleep = (kind, i, e) => {
    if (!e.sleep) return;
    if (!bosses.length) fail(`${label} 休眠${kind}${i} 所在关卡没有章王（无人唤醒）`);
    if (e.y > -100) fail(`${label} 休眠${kind}${i} 必须预置屏外（y<-100），实际 y=${e.y}`);
    if (e.sleep > phases) {
      fail(`${label} 休眠${kind}${i} 的 sleep=${e.sleep} 超过章王阶段数 ${phases}（永不可唤醒 → 死局）`);
    }
  };

  // 章鱼-章鱼互叠
  pigs.forEach((a, i) => {
    checkSleep('章鱼', i, a);
    pigs.forEach((b, j) => {
      if (j <= i) return;
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      if (d < a.radius + b.radius - 0.01) {
        fail(`${label} 章鱼${i}与章鱼${j}互叠（距离 ${d.toFixed(1)} < ${a.radius + b.radius}）`);
      }
    });
  });

  // 章鱼越界（屏幕左右缘 / 沉入地面）
  pigs.forEach((p, i) => {
    if (p.x - p.radius < 0 || p.x + p.radius > SW) fail(`${label} 章鱼${i}水平越界 x=${p.x}`);
    if (p.y + p.radius > GY + 0.01) fail(`${label} 章鱼${i}沉入地面 y=${p.y}`);
  });

  // 方块-方块互叠
  blocks.forEach((a, i) => {
    checkSleep('方块', i, a);
    blocks.forEach((b, j) => {
      if (j <= i) return;
      const overlap = a.x < b.x + b.width - 0.01 && b.x < a.x + a.width - 0.01 &&
        a.y < b.y + b.height - 0.01 && b.y < a.y + a.height - 0.01;
      if (overlap) fail(`${label} 方块${i}(${a.type})与方块${j}(${b.type})互叠`);
    });
  });

  // 方块越界
  blocks.forEach((b, i) => {
    if (b.x < 0 || b.x + b.width > SW) fail(`${label} 方块${i}(${b.type})水平越界 x=${b.x}`);
    if (b.y + b.height > GY + 0.01) fail(`${label} 方块${i}(${b.type})沉入地面 y=${b.y}`);
  });

  // 珍珠：越界 / 嵌入方块（不可达）/ 贴章鱼（会被误拾）
  pearls.forEach((p, i) => {
    if (p.x - PEARL_R < 0 || p.x + PEARL_R > SW || p.y - PEARL_R < 0) {
      fail(`${label} 珍珠${i}(${p.id})越界 x=${p.x} y=${p.y}`);
    }
    blocks.forEach((b, j) => {
      if (circleRectDist(p.x, p.y, b) < PEARL_R - 0.01) {
        fail(`${label} 珍珠${i}(${p.id})嵌入方块${j}(${b.type})，不可达`);
      }
    });
    pigs.forEach((q, j) => {
      if (Math.hypot(p.x - q.x, p.y - q.y) < PEARL_R + q.radius) {
        fail(`${label} 珍珠${i}(${p.id})贴着章鱼${j}，开局即误拾`);
      }
    });
  });

  // 豚队列站位（越屏回归：单排 28px 间距曾导致 5-6 只豚出屏）
  const birdCount = Array.isArray(level.birds) ? level.birds.length : level.birds;
  for (let i = 0; i < birdCount - 1; i++) { // 弹弓上那只不算
    const x = C.SLINGSHOT_X - 35 - (i % 3) * 21;
    if (x - BIRD_DISP_R < 0) fail(`${label} 候飞豚 #${i} 越出左缘 x=${x}`);
  }
}

/** 难度指标（信息输出） */
const HP = { wood: 2, stone: 4, ice: 1, burst: 1 };
const DENS = { wood: 1.0, stone: 2.0, ice: 0.5, burst: 0.8 };

function printMetrics(label, level) {
  const blocks = level.blocks || [];
  const pigs = level.pigs || [];
  const birds = Array.isArray(level.birds) ? level.birds.length : level.birds;
  const hard = blocks.length
    ? blocks.reduce((s, b) => s + HP[b.type] * DENS[b.type], 0) / blocks.length
    : 0;
  const n = pigs.length;
  // 理论满分：N 章鱼全连击 N(N+1)/2×1000 + 方块×500 + 剩豚(豚数-1)×5000
  const max = n * (n + 1) / 2 * 1000 + blocks.length * 500 + (birds - 1) * 5000;
  const r3 = Math.round(level.stars[2] / max * 100);
  console.log(
    `  ${label}  硬度=${hard.toFixed(1)}  豚/章鱼=${(birds / Math.max(1, n)).toFixed(2)}  ` +
    `弹道=${level.trajectory}  3星门槛=${level.stars[2]}（占满分 ${r3}%）`
  );
}

// ===== 1. 手工关卡 =====
console.log('== 手工关卡几何校验 ==');
const levels = getLevels();
const BOSS_LEVELS = [7, 15, 23, 31, 39]; // 章末 Boss 关（idx）
levels.forEach((lv, i) => {
  checkGeometry(`L${i + 1}`, lv);
  const hasBoss = (lv.pigs || []).some(p => p.boss);
  if (BOSS_LEVELS.includes(i) && !hasBoss) fail(`L${i + 1} 是章末关但缺少章王（boss:true）`);
  if (!BOSS_LEVELS.includes(i) && hasBoss) fail(`L${i + 1} 非章末关却配置了章王`);
});

console.log('\n== 难度指标（手工关卡） ==');
levels.forEach((lv, i) => printMetrics(`L${i + 1}`, lv));

// ===== 2. 生成关卡（每日挑战 + 珍珠关） =====
console.log('\n== 生成关卡几何校验 ==');
checkGeometry('每日挑战', DAILY.generateLevel(DAILY.todayString(), levels));
PEARLS.PEARLS.forEach((m) => {
  checkGeometry(`珍珠关[${m.id}]`, PEARLS.generateBonusLevel(m, levels));
});

// ===== 结果 =====
console.log('');
if (failures === 0) {
  console.log('✅ 关卡校验全部通过');
  process.exit(0);
} else {
  console.error(`❌ 关卡校验发现 ${failures} 处违规`);
  process.exit(1);
}
