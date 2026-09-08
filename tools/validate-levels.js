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
const DAILY = require('../src/daily.js');
const PEARLS = require('../src/pearls.js');
// 几何校验与编辑器共用纯函数（互叠/越界/沉地/珍珠可达性/候飞豚越屏）
const { validateLevel } = require('../src/level-validate.js');

let failures = 0;
function fail(msg) {
  failures++;
  console.error('  ✗ ' + msg);
}

/** 章王怒吼阶段数：公式须与 combat.js onPigHurt 保持一致 */
function bossPhases(hp) {
  return hp >= 11 ? 3 : hp >= 8 ? 2 : hp >= 6 ? 1 : 0;
}

/**
 * 单个关卡的校验（label 用于报错定位）。
 * 几何/可达性检查复用 src/level-validate.js（编辑器同源）；
 * 章王/sleep 语义为官方战役专属，保留在 CLI。
 */
function checkGeometry(label, level) {
  const pigs = level.pigs || [];
  const blocks = level.blocks || [];

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
  pigs.forEach((p, i) => checkSleep('章鱼', i, p));
  blocks.forEach((b, i) => checkSleep('方块', i, b));

  // 几何校验（与编辑器同源；官方关不传 editor，不做计数/禁区检查）
  const { issues } = validateLevel(level);
  issues.forEach((iss) => fail(`${label} ${iss.msg}`));
}

/** 难度指标（信息输出）；材料血量/密度动态读 config，新增材料（如火熔岩砖）自动纳入 */
const hpOf = t => (C.BLOCK_TYPES[t] ? C.BLOCK_TYPES[t].health : 1);
const denOf = t => (C.BLOCK_TYPES[t] && C.BLOCK_TYPES[t].density != null ? C.BLOCK_TYPES[t].density : 1);

function printMetrics(label, level) {
  const blocks = level.blocks || [];
  const pigs = level.pigs || [];
  const birds = Array.isArray(level.birds) ? level.birds.length : level.birds;
  const hard = blocks.length
    ? blocks.reduce((s, b) => s + hpOf(b.type) * denOf(b.type), 0) / blocks.length
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
