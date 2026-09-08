/**
 * 难度量化器 - 全 40 关的「难度尺子」。
 * Level difficulty meter: static curve metrics + a replay-based greedy solver.
 *
 * 两件事：
 *   1) 静态指标：鸟/醒猪比（资源冗余）、主材占比、加权块血、均猪血、裸露猪数、
 *      砰砰配队数、冻果数 —— 对照分章目标曲线输出 PASS/WARN。
 *   2) 动态贪心模拟：白盒真实物理，重放式贪心（每步枚举「可用鸟种 × 智能目标点」，
 *      按杀豚/王伤/碎块选最优一发），报告「自动解用鸟数 / 配置鸟数」。
 *      - AI 打不过（用鸟数 > 配置鸟数 / 鸟尽未 WIN）→ 死局/过难报警；
 *      - AI 远少于配置鸟数就清场 → 资源冗余、关卡偏水。
 *
 * 运行：node tools/level-sim.js [关卡序号...]   不带参数跑全 40 关
 *   STATIC=1 只出静态指标（快）；默认静态 + 动态。
 */
'use strict';

const { installEnv, loadGame } = require('./test-harness.js');
const C = require('../src/config.js');
const { getLevels } = require('../src/levels.js');

const env = installEnv({ rewardAd: true, interstitial: true, banner: true });
const game = loadGame();
const LEVELS = getLevels();

const B = C.SCREEN_WIDTH * 0.55; // STRUCT_BASE_X
const G = C.GROUND_Y;
const AX = C.SLINGSHOT_X;
const AY = C.SLINGSHOT_Y - 15;
const PF = C.POWER_FACTOR;
const BOSS_IDX = [7, 15, 23, 31, 39];

// 分章目标曲线：[资源比下限, 上限, 主材(null=过渡不判；数组=复合章节任一即可)]
const CHAPTER = [
  { range: [0, 7], ratio: [1.25, 1.7], main: 'wood',  name: '一·新手湾' },
  { range: [8, 15], ratio: [0.95, 1.35], main: null,  name: '二·珊瑚海(木→冰)' },
  { range: [16, 23], ratio: [0.82, 1.12], main: 'ice', name: '三·深渊要塞(冰)' },
  { range: [24, 31], ratio: [0.7, 0.98], main: 'stone', name: '四·极境深渊(石)' },
  { range: [32, 39], ratio: [0.55, 0.88], main: ['stone', 'fire'], name: '五·潮汐王座(重石+火)' },
];
function chapterOf(idx) { return CHAPTER.find(c => idx >= c.range[0] && idx <= c.range[1]); }

// 材料动态读取 config（新增 fire 后尺子自动识别）；burst 是爆炸物不算结构主材
const MAT_LABEL = { wood: '木', ice: '冰', stone: '石', fire: '火', burst: '爆' };
const STRUCT_MATS = Object.keys(C.BLOCK_TYPES).filter(m => m !== 'burst');
const hpOf = t => (C.BLOCK_TYPES[t] ? C.BLOCK_TYPES[t].health : 1);
const denOf = t => (C.BLOCK_TYPES[t] && C.BLOCK_TYPES[t].density != null ? C.BLOCK_TYPES[t].density : 1);

// ==================== 静态指标 ====================
function analyze(idx) {
  const lv = LEVELS[idx];
  const blocks = (lv.blocks || []).filter(b => !b.sleep);
  const awakePigs = (lv.pigs || []).filter(p => !p.sleep);
  const birdsN = lv.birds.length;
  const cnt = {};
  for (const m of Object.keys(C.BLOCK_TYPES)) cnt[m] = 0;
  for (const b of blocks) if (cnt[b.type] != null) cnt[b.type]++;
  const hardness = blocks.length ? blocks.reduce((s, b) => s + hpOf(b.type) * denOf(b.type), 0) / blocks.length : 0;
  const pigHp = p => p.boss ? (p.hp || 9) : (p.hp || (p.radius > 26 ? 3 : p.radius > 20 ? 2 : 1));
  const avgPigHp = awakePigs.length ? (awakePigs.reduce((s, p) => s + pigHp(p), 0) / awakePigs.length) : 0;
  const bombN = lv.birds.filter(t => t === 'bomb').length;

  // 裸露猪：周围 r+8 无方块、且正上方无盖板
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
    idx, birdsN, awake: awakePigs.length, ratio: birdsN / Math.max(1, awakePigs.length),
    cnt, matDetail, bombN, hardness, avgPigHp, exposed, mainType, mainRatio,
    isBoss: BOSS_IDX.includes(idx),
  };
}

// ==================== 动态贪心模拟 ====================
function aimBot(tx, ty) {
  let best = null;
  for (let px = AX - 95; px <= AX - 15; px += 4) {
    for (let py = AY - 25; py <= AY + 115; py += 4) {
      const pts = game.calculateTrajectory(AX, AY, (AX - px) * PF, (AY - py) * PF, 90);
      let minD = Infinity;
      for (const p of pts) { const d = Math.hypot(p.x - tx, p.y - ty); if (d < minD) minD = d; }
      if (!best || minD < best.d) best = { px, py, d: minD };
    }
  }
  return best;
}

function shoot(type, tx, ty, abx) {
  // 想要的鸟可能已在弹弓上（currentBird 不在候飞队列 game.birds 里）；
  // 仅当弹弓上是别的鸟种时才从队列换鸟，队列里没有才算缺货。
  if (!game.currentBird || game.currentBird.type !== type) {
    const i = game.birds.findIndex(b => b.type === type);
    if (i < 0) return false;
    game.swapBird(i);
  }
  if (!game.currentBird) return false;
  const aim = aimBot(tx, ty);
  if (!aim) return false;
  env.fire('touchstart', AX, AY); env.fire('touchmove', aim.px, aim.py); env.fire('touchend');
  env.pump(2);
  if (abx != null) {
    for (let f = 0; f < 240; f++) {
      env.pump(1);
      const b = game.currentBird;
      if (!b) break;
      if (b.x >= abx) { env.fire('touchstart', 200, 300); env.fire('touchend'); break; }
    }
  }
  env.pump(320);
  return true;
}

/** 装载关卡并重放一串射击；返回结算度量 */
function replay(idx, shots) {
  env.resetProgress(game);
  game.loadLevel(idx);
  env.pump(30);
  // 基线：game.js 每帧把死透对象 filter 出数组（pigs/blocks），所以击杀数不能事后从
  // 残留数组里数「!alive」，要用「装载时总数 − 存活数」。睡眠援军/掉落物装载时 alive=true，
  // 未唤醒则一直存活、不计入击杀；唤醒后被杀死才移出数组 → 正确反映为击杀。
  const pigs0 = game.pigs.length;
  const blocks0 = game.blocks.length;
  const boss0 = game.pigs.find(p => p.isBoss);
  const bossMax = boss0 ? boss0.maxHealth : 0;
  for (const s of shots) shoot(s.type, s.tx, s.ty, s.abx);
  const boss = game.pigs.find(p => p.isBoss);
  const pigsAlive = game.pigs.filter(p => p.alive && !p.dying).length;
  const pigsDead = pigs0 - pigsAlive;
  const blocksGone = blocks0 - game.blocks.filter(b => b.alive).length;
  // 章王被打死会随死透对象一起移出数组（find 不到）→ 记满伤；仍在场则按掉血计
  const bossDmg = !boss0 ? 0 : (!boss ? bossMax : (boss.alive && !boss.dying ? bossMax - boss.health : bossMax));
  return {
    won: game.state === 'WIN',
    state: game.state,
    pigsDead,
    bossDmg,
    blocksGone,
    birdsLeft: game.birds.length,
    score: pigsDead * 100 + bossDmg * 30 + blocksGone * 2,
  };
}

/** 生成智能目标点：醒猪中心、每个方块中心、贴地承重基座点 */
function targetPoints(idx) {
  const lv = LEVELS[idx];
  const pts = [];
  for (const p of lv.pigs) { if (!p.sleep) pts.push({ x: p.x, y: p.y, kind: 'pig' }); }
  for (const b of lv.blocks) {
    if (b.sleep) continue;
    const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
    pts.push({ x: cx, y: cy, kind: b.type === 'burst' ? 'burst' : 'block' });
    // 承重基座点：贴地结构块的基脚（炸这里使整面坍塌）
    if (b.type !== 'burst' && b.y + b.height > G - 95) {
      pts.push({ x: cx, y: G - 55, kind: 'base' });
    }
  }
  const out = [];
  for (const p of pts) {
    if (!out.some(q => Math.hypot(q.x - p.x, q.y - p.y) < 24)) out.push(p);
  }
  return out;
}

function solve(idx) {
  const birdsN = LEVELS[idx].birds.length;
  const roster = LEVELS[idx].birds;
  const stock = {}; // 各鸟种库存（真实配队约束，不许多发）
  for (const t of roster) stock[t] = (stock[t] || 0) + 1;
  const targets = targetPoints(idx);
  const shots = [];
  let last = replay(idx, shots);

  for (let step = 0; step < birdsN; step++) {
    if (last.won) break;
    const avail = Object.keys(stock).filter(t => stock[t] > 0);
    let best = null;
    for (const type of avail) {
      for (const t of targets) {
        // bomb 对非猪目标（基座/冻果/块）飞临主动引爆；猪目标靠首撞爆
        const abx = (type === 'bomb' && t.kind !== 'pig') ? t.x : null;
        const cand = { type, tx: t.x, ty: t.y, abx };
        const r = replay(idx, [...shots, cand]);
        if (!best || r.score > best.r.score) best = { cand, r, type };
      }
    }
    if (!best) break;
    shots.push(best.cand);
    stock[best.type]--;
    last = best.r;
    if (last.won) break;
  }
  return { used: shots.length, won: last.won, state: last.state, birdsN };
}

// ==================== 主流程 ====================
function run() {
const args = process.argv.slice(2).map(Number).filter(n => !isNaN(n)).map(n => n - 1);
const idxs = args.length ? args : LEVELS.map((_, i) => i);
const STATIC_ONLY = !!process.env.STATIC;

console.log('关  章  鸟/猪 资源比  主材(占比)  砰砰 冻果 块血 均猪血 裸猪 | 静态判定');
let warns = [];
const results = [];
for (const idx of idxs) {
  const a = analyze(idx);
  const ch = chapterOf(idx);
  const tags = [];
  if (!a.isBoss) {
    const [lo, hi] = ch.ratio;
    if (a.ratio < lo) tags.push(`资源偏紧<${lo}`);
    if (a.ratio > hi) tags.push(`资源冗余>${hi}`);
    const wantMain = [].concat(ch.main || []);
    const mainOk = !ch.main || wantMain.includes(a.mainType);
    if (!mainOk) tags.push(`主材应为${wantMain.map(m => MAT_LABEL[m]).join('/')}实${MAT_LABEL[a.mainType]}`);
    else if (ch.main && a.mainRatio < 0.55) tags.push(`主材占比低${(a.mainRatio * 100) | 0}%`);
    if (a.bombN > 2) tags.push(`砰砰×${a.bombN}过多`);
    if (a.exposed === a.awake && a.awake >= 3 && idx >= 16) tags.push('猪全裸露');
  }
  if (tags.length) warns.push(`L${idx + 1}: ${tags.join('，')}`);
  const ratioStr = a.isBoss ? ' 王  ' : a.ratio.toFixed(2);
  console.log(
    `L${String(idx + 1).padStart(2)} ${a.isBoss ? 'BOSS' : '    '} ` +
    `${a.birdsN}/${a.awake}  ${ratioStr}  ` +
    `${MAT_LABEL[a.mainType]}${(a.mainRatio * 100) | 0}% ${a.matDetail}  ` +
    `砰×${a.bombN}  ${a.hardness.toFixed(1)}  猪${a.avgPigHp.toFixed(1)}  裸${a.exposed}/${a.awake} | ` +
    (tags.length ? '⚠ ' + tags.join('；') : '✓')
  );
  results.push(a);
}

if (!STATIC_ONLY) {
  console.log('\n== 动态贪心模拟（自动解用鸟数 / 配置鸟数）==');
  let unsolved = [], easy = [];
  for (const idx of idxs) {
    const s = solve(idx);
    let flag;
    if (!s.won) { flag = '◐ AI 未解(需人工/boss-sim 确认，非死局判据)'; unsolved.push(`L${idx + 1}`); }
    else if (s.used <= s.birdsN - 2) { flag = '💧冗余(偏易)'; easy.push(`L${idx + 1}`); }
    else flag = '✓';
    console.log(`L${String(idx + 1).padStart(2)} ${BOSS_IDX.includes(idx) ? 'BOSS' : '    '} 用鸟 ${s.used}/${s.birdsN}  ${s.state}  ${flag}`);
  }
  console.log(`\n偏易(AI 省 ≥2 鸟清场)：${easy.length ? easy.join(' ') : '无'}`);
  console.log(`AI 未解(贪心短视/瞄准粗，不等于死局；死局以 boss-sim + 人工为准)：${unsolved.length ? unsolved.join(' ') : '无'}`);
}

console.log(`\n静态目标曲线 WARN：${warns.length ? '\n  ' + warns.join('\n  ') : '无（全部贴合目标曲线）'}`);
}

// 供 e2e 难度曲线断言复用静态尺子（require 时不跑慢模拟；仅直接执行才跑）
module.exports = {
  CHAPTER, chapterOf, analyze, MAT_LABEL, STRUCT_MATS, hpOf, BOSS_IDX, LEVELS,
};

if (require.main === module) run();
