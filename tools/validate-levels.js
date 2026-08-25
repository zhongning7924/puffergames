/**
 * 关卡数据静态校验 - 几何合法性 + 难度指标
 * Level Validator - geometry checks (bounds/overlaps) + difficulty metrics.
 *
 * 运行：node tools/validate-levels.js
 * 退出码：0 = 全部通过；1 = 存在违规（可接入 CI / 提交前检查）。
 *
 * 校验范围：
 *  1. 手工关卡（levels.js）：猪-猪/方块-方块互叠、越界、珍珠可达性；
 *  2. 生成关卡（每日挑战 + 全部珍珠关）：同上（守护生成器回归）；
 *  3. 难度指标表（信息输出，不作失败判定）：材料硬度/鸟猪比/弹道/三星门槛占比。
 *
 * 注意：猪与方块的"贴靠/嵌墙"为既有设计（猪藏结构后受保护），只校验猪-猪
 * 互叠与越界，不校验猪-方块交叠。
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
const BIRD_DISP_R = 17 * 0.85; // 候飞队列鸟显示半径（越屏检查用）

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

/** 单个关卡的几何校验（label 用于报错定位） */
function checkGeometry(label, level) {
  const pigs = level.pigs || [];
  const blocks = level.blocks || [];
  const pearls = level.pearls || [];

  // 猪-猪互叠
  pigs.forEach((a, i) => {
    pigs.forEach((b, j) => {
      if (j <= i) return;
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      if (d < a.radius + b.radius - 0.01) {
        fail(`${label} 猪${i}与猪${j}互叠（距离 ${d.toFixed(1)} < ${a.radius + b.radius}）`);
      }
    });
  });

  // 猪越界（屏幕左右缘 / 沉入地面）
  pigs.forEach((p, i) => {
    if (p.x - p.radius < 0 || p.x + p.radius > SW) fail(`${label} 猪${i}水平越界 x=${p.x}`);
    if (p.y + p.radius > GY + 0.01) fail(`${label} 猪${i}沉入地面 y=${p.y}`);
  });

  // 方块-方块互叠
  blocks.forEach((a, i) => {
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

  // 珍珠：越界 / 嵌入方块（不可达）/ 贴猪（会被误拾）
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
        fail(`${label} 珍珠${i}(${p.id})贴着猪${j}，开局即误拾`);
      }
    });
  });

  // 鸟队列站位（越屏回归：单排 28px 间距曾导致 5-6 只鸟出屏）
  const birdCount = Array.isArray(level.birds) ? level.birds.length : level.birds;
  for (let i = 0; i < birdCount - 1; i++) { // 弹弓上那只不算
    const x = C.SLINGSHOT_X - 35 - (i % 3) * 21;
    if (x - BIRD_DISP_R < 0) fail(`${label} 候飞鸟 #${i} 越出左缘 x=${x}`);
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
  // 理论满分：N 猪全连击 N(N+1)/2×1000 + 方块×500 + 剩鸟(鸟数-1)×5000
  const max = n * (n + 1) / 2 * 1000 + blocks.length * 500 + (birds - 1) * 5000;
  const r3 = Math.round(level.stars[2] / max * 100);
  console.log(
    `  ${label}  硬度=${hard.toFixed(1)}  鸟/猪=${(birds / Math.max(1, n)).toFixed(2)}  ` +
    `弹道=${level.trajectory}  3星门槛=${level.stars[2]}（占满分 ${r3}%）`
  );
}

// ===== 1. 手工关卡 =====
console.log('== 手工关卡几何校验 ==');
const levels = getLevels();
levels.forEach((lv, i) => checkGeometry(`L${i + 1}`, lv));

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
