/**
 * 章王关「可通关」实战模拟器 - 真实物理 + 白盒瞄准 AI。
 * Boss WIN simulator: drives the real game with an aimbot that targets the
 * designed structural weak-points (承重柱 / 爆裂果), proving each boss level is
 * solvable via the intended 坍塌/连锁 solution rather than brute force.
 *
 * 运行：node tools/boss-sim.js [关卡下标...]
 *   不带参数跑全部 5 个章王关（idx 7/15/23/31/39）。
 *
 * 每关 plan.shots 描述「最优解」的射击序列：豚种 + 瞄准点 + 可选空中技能。
 * 瞄准点用与 levels.js 相同的 STRUCT_BASE_X 偏移表达，改关时同步更新。
 */
'use strict';

const { installEnv, loadGame } = require('./test-harness.js');
const C = require('../src/config.js');

const env = installEnv({ rewardAd: true, interstitial: true, banner: true });
const game = loadGame();

const B = C.SCREEN_WIDTH * 0.55; // = STRUCT_BASE_X
const G = C.GROUND_Y;
const AX = C.SLINGSHOT_X;
const AY = C.SLINGSHOT_Y - 15;
const PF = C.POWER_FACTOR;

/** 瞄准 AI：搜索拉弓拖拽点，使无碰撞抛物线经过目标（返回拖拽点 + 最近距离） */
function aimBot(tx, ty) {
  let best = null;
  for (let px = AX - 95; px <= AX - 15; px += 4) {
    for (let py = AY - 25; py <= AY + 115; py += 4) {
      const vx = (AX - px) * PF;
      const vy = (AY - py) * PF;
      const pts = game.calculateTrajectory(AX, AY, vx, vy, 90);
      let minD = Infinity;
      for (const p of pts) {
        const d = Math.hypot(p.x - tx, p.y - ty);
        if (d < minD) minD = d;
      }
      if (!best || minD < best.d) best = { px, py, d: minD };
    }
  }
  return best;
}

/** 把指定豚种换到弹弓（READY 态）；FORCE 模式下队列没有就强改当前豚类型（白盒验证机制用） */
const FORCE = !!process.env.FORCE;
function ensureBird(type) {
  if (game.currentBird && game.currentBird.type === type) return true;
  const i = game.birds.findIndex(b => b.type === type);
  if (i >= 0) { game.swapBird(i); return game.currentBird && game.currentBird.type === type; }
  if (FORCE && game.currentBird) { game.currentBird.type = type; game.currentBird.abilityUsed = false; return true; }
  return false;
}

/** 发射一发：换豚 → 瞄准 → 拉弓释放 → （可选）空中技能；pump 到回合结束 */
function shoot(shot) {
  if (!ensureBird(shot.type)) {
    return { ok: false, reason: `队列无 ${shot.type}（剩 ${game.birds.map(b => b.type).join(',')}）` };
  }
  const aim = aimBot(shot.tx, shot.ty);
  if (!aim) return { ok: false, reason: '瞄准失败' };
  // 拉弓：鸟被拖到 (px,py)，与玩家手势一致
  env.fire('touchstart', AX, AY);
  env.fire('touchmove', aim.px, aim.py);
  env.fire('touchend');
  env.pump(2);
  // 空中技能：飞到触发 x（或延时）时点屏
  if (shot.ability) {
    let fired = false;
    for (let f = 0; f < 240 && !fired; f++) {
      env.pump(1);
      const b = game.currentBird;
      if (!b) break;
      const atX = shot.ability.x != null && b.x >= shot.ability.x;
      const atDelay = shot.ability.delay != null && f >= shot.ability.delay;
      if (atX || atDelay) { env.fire('touchstart', 200, 300); env.fire('touchend'); fired = true; }
    }
  }
  // 回合收尾：等鸟落地/爆炸/出屏，下一只上弓
  env.pump(420);
  return { ok: true, aimDist: Math.round(aim.d) };
}

function bossStatus() {
  const boss = game.pigs.find(p => p.isBoss);
  if (!boss) return '章王已灭';
  return `章王 hp ${boss.health}/${boss.maxHealth}（phase ${boss.phase}）`;
}

/** 场景结构快照：剩余醒着的块（按材质）与章鱼，用于诊断连锁/坍塌是否吃完 */
function sceneSnap() {
  const alive = game.blocks.filter(b => b.alive && !b.sleeping);
  const c = t => alive.filter(b => b.type === t).length;
  const pigs = game.pigs.filter(p => p.alive && !p.sleeping).length;
  return `块${alive.length}(木${c('wood')}石${c('stone')}冰${c('ice')}爆${c('burst')}) 猪${pigs}`;
}

/** 跑一关：按 plan 射击，返回结果 */
function runLevel(plan) {
  env.resetProgress(game);
  game.loadLevel(plan.idx);
  env.pump(30);
  const log = [];
  let idx = 0;
  for (const shot of plan.shots) {
    if (game.state === 'WIN' || game.state === 'LOSE') break;
    const r = shoot(shot);
    idx++;
    log.push(`  发${idx} ${shot.type}→(${shot.tx},${shot.ty}${shot.ability ? '+' + (shot.ability.x != null ? 'x' + shot.ability.x : 'd' + shot.ability.delay) : ''}) ${r.ok ? '瞄距' + r.aimDist : '失败:' + r.reason} | ${bossStatus()} | ${sceneSnap()}`);
    if (!r.ok) break;
  }
  const win = game.state === 'WIN';
  return { win, state: game.state, log, boss: bossStatus() };
}

// ==================== 各章王关解法脚本（瞄准点 = 设计的机关触发点）====================
// 坐标用 B(=STRUCT_BASE_X≈206) / G(=GROUND_Y=577) 表达，与 levels.js 偏移保持一致。
const PLANS = [
  {
    idx: 7, name: '第8关 滩涂章王·悬木吊脚楼',
    shots: [
      // 砰砰撞断左承重木柱（首次撞击即炸，范围爆炸断柱）
      { type: 'bomb', tx: B + 45, ty: G - 100 },
      // 炸断右承重柱 → 木楼石堆平拍
      { type: 'bomb', tx: B + 139, ty: G - 100 },
      // 兜底
      { type: 'dash', tx: B + 92, ty: G - 40 },
      { type: 'normal', tx: B + 92, ty: G - 30 },
    ],
  },
  {
    idx: 15, name: '第16关 冰壳章王·冻果冰穹',
    shots: [
      // 砰砰撞冰穹冻果排：冰板碎 → 4 冻果连锁（各扣1血）+ 爆炸 1 血
      { type: 'bomb', tx: B + 88, ty: G - 148 },
      // 三丸子一分为三碎残余冰壳（教学锚点）
      { type: 'split', tx: B + 110, ty: G - 95, ability: { x: B + 55 } },
      // 兜底
      { type: 'dash', tx: B + 120, ty: G - 30 },
      { type: 'normal', tx: B + 120, ty: G - 30 },
    ],
  },
  {
    idx: 23, name: '第24关 岩甲章王·石拱断桥',
    shots: [
      // 砰砰在飞临左墩基时主动引爆（爆炸点≈瞄点）：炸断左墩 + 波及阵前章鱼 + 压爆桥下冻果
      { type: 'bomb', tx: B + 44, ty: G - 55, ability: { x: B + 44 } },
      // 砰砰在右墩基上方引爆 → 双墩齐断，载石桥面整面平拍
      { type: 'bomb', tx: B + 148, ty: G - 55, ability: { x: B + 148 } },
      // 兜底：瞄章王头部（避开脚下坍塌碎石），split 三丸子覆盖 + dash/normal 连补
      { type: 'split', tx: B + 100, ty: G - 70, ability: { x: B + 40 } },
      { type: 'dash', tx: B + 100, ty: G - 60 },
      { type: 'normal', tx: B + 100, ty: G - 50 },
      { type: 'normal', tx: B + 100, ty: G - 40 },
    ],
  },
  {
    idx: 31, name: '第32关 深渊章王·双塔悬闸',
    shots: [
      // 砰砰炸左木塔基
      { type: 'bomb', tx: B + 36, ty: G - 55 },
      // 砰砰炸右石塔基 → 双塔齐断，悬闸平落 + 冻果连锁
      { type: 'bomb', tx: B + 148, ty: G - 55 },
      // 兜底
      { type: 'dash', tx: B + 98, ty: G - 40 },
      { type: 'split', tx: B + 98, ty: G - 60, ability: { x: B + 40 } },
      { type: 'normal', tx: B + 98, ty: G - 30 },
    ],
  },
  {
    idx: 39, name: '第40关 潮汐王座·章王·多米诺王座',
    shots: [
      // 砰砰引爆冻果链腰（王座盖顶 b2）→ 双向连锁：向外传外檐、向内传贴脸果
      { type: 'bomb', tx: B + 77, ty: G - 123 },
      // 第二发补炸王座基座 / 唤醒援军后的清场
      { type: 'bomb', tx: B + 96, ty: G - 60 },
      // 兜底
      { type: 'dash', tx: B + 96, ty: G - 40 },
      { type: 'split', tx: B + 96, ty: G - 60, ability: { x: B + 40 } },
      { type: 'normal', tx: B + 96, ty: G - 30 },
    ],
  },
];

// ==================== 运行 ====================
const args = process.argv.slice(2).map(Number).filter(n => !isNaN(n));
const plans = args.length ? PLANS.filter(p => args.includes(p.idx)) : PLANS;
let allWin = true;
for (const plan of plans) {
  const r = runLevel(plan);
  console.log(`\n${r.win ? '✅' : '❌'} ${plan.name}（idx ${plan.idx}）→ ${r.state}`);
  r.log.forEach(l => console.log(l));
  if (!r.win) { allWin = false; console.log('  终态：' + r.boss); }
}
console.log(`\n${allWin ? '🎉 全部可通关' : '⚠️ 有关卡未能通关（需调机关坐标/鸟序）'}`);
process.exit(allWin ? 0 : 1);
