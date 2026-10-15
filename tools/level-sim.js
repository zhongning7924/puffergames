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
  { range: [24, 31], ratio: [0.55, 0.98], main: 'stone', name: '四·极境深渊(石)' },
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

// ==================== 五维压强尺子（v2，2026-10-14） ====================
// 刻度统一 1~5，5 = 最压。每个维都可从关卡数据 + 贪心解复算：
//   P1 弹药压强 = 5 − W；W = 配置鸟数 − 最优解用鸟数（solve 贪心自动解）
//   P2 识别压强 = 决策点数 D = 承重柱 + 壳猪 + 冻果 + 多段目标（静态可数）
//   P3 精度压强 = clamp(round((70 − trajectory)/12), 1, 5)（弹道提示长度映射）
//   P4 序列压强 = 依赖链深度：直射1 / 坍塌可达2 / 连锁可达3 / 章王按阶段 +1~2
//   P5 方差压强 = 随机源计数 R = 暴露冻果 + sleep 实体；王关另报贴脸果保底
// 章内三幕：课(idx%8∈0..2) / 练(3..5) / 考(6) / 王(7)

const ACTS = ['课', '课', '课', '练', '练', '练', '考', '王'];
const actOf = idx => ACTS[idx % 8];

// 分章目标（v2 模型）：W=最优解容错（配置鸟数−用鸟数；教学章放宽、考/王关收紧）；p5cap=非王关方差上限
const CHAPTER_V2 = [
  { range: [0, 7],   w: [1, 3], p5cap: 0, name: '一·新手湾' },
  { range: [8, 15],  w: [0, 2], p5cap: 1, name: '二·珊瑚海' },
  { range: [16, 23], w: [0, 1], p5cap: 2, name: '三·深渊要塞' },
  { range: [24, 31], w: [0, 1], p5cap: 2, name: '四·极境深渊' },
  { range: [32, 39], w: [0, 1], p5cap: 3, name: '五·潮汐王座' },
];
function chapterV2Of(idx) { return CHAPTER_V2.find(c => idx >= c.range[0] && idx <= c.range[1]); }

function p3Of(idx) {
  const t = LEVELS[idx].trajectory;
  return Math.min(5, Math.max(1, Math.round((70 - t) / 12)));
}

/** 章王阶段数（公式与 combat.onPigHurt 同步：hp≥11 三段 / ≥8 两段 / ≥6 一段） */
function bossPhases(idx) {
  const boss = (LEVELS[idx].pigs || []).find(p => p.boss);
  if (!boss) return 0;
  const hp = boss.hp || 9;
  return hp >= 11 ? 3 : hp >= 8 ? 2 : hp >= 6 ? 1 : 0;
}

/** 决策点分解：承重/掩护块（贴地且上方有块 resting 或邻猪 r+8）+ 壳猪 + 冻果 + 多段目标 */
function decisionPoints(idx) {
  const lv = LEVELS[idx];
  const blocks = (lv.blocks || []).filter(b => !b.sleep);
  const pigs = (lv.pigs || []).filter(p => !p.sleep);
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
  const boss = pigs.find(p => p.boss);
  const shelled = pigs.filter(p => !p.boss && blocks.some(b => pigNear(b, p))).length;
  const pigHp = p => p.boss ? (p.hp || 9) : (p.hp || (p.radius > 26 ? 3 : p.radius > 20 ? 2 : 1));
  const multi = pigs.filter(p => pigHp(p) >= 2).length + (boss ? 1 : 0);
  return { supports, shelled, burst, multi, D: supports + shelled + burst + multi };
}

function chainDepth(idx) {
  const dp = decisionPoints(idx);
  const boss = (LEVELS[idx].pigs || []).some(p => p.boss);
  let L = 1;
  if (dp.supports > 0) L++;                 // 坍塌可达（断柱→塌压）
  if (dp.burst >= 1) L++;                   // 连锁可达
  if (boss) L += Math.min(2, bossPhases(idx));
  return Math.min(5, L);
}

/** 方差源：暴露冻果 + sleep 实体（落石/援军漂移）；王关附贴脸冻果保底数 */
function varianceOf(idx) {
  const lv = LEVELS[idx];
  const burst = (lv.blocks || []).filter(b => b.type === 'burst' && !b.sleep).length;
  const sleep = (lv.blocks || []).filter(b => b.sleep).length + (lv.pigs || []).filter(p => p.sleep).length;
  const boss = (lv.pigs || []).find(p => p.boss);
  let hug = 0;
  if (boss) {
    hug = (lv.blocks || []).filter(b => b.type === 'burst' && !b.sleep &&
      Math.hypot(b.x + b.width / 2 - boss.x, b.y + b.height / 2 - boss.y) <= 100).length;
  }
  return { burst, sleep, R: burst + sleep, hug };
}

/** 指纹向量：同解骨架（鸟/豚/砰砰/大猪/壳/孤/冻果/墙高/横楣/火顶豚/材料）相同即同指纹 */
function fingerprint(idx) {
  const a = analyze(idx);
  const dp = decisionPoints(idx);
  const lv = LEVELS[idx];
  const boss = (lv.pigs || []).some(p => p.boss);
  const blocks = (lv.blocks || []).filter(b => !b.sleep);
  const big = (lv.pigs || []).filter(p => !p.sleep && (p.radius || 16) > 20).length;
  const lintel = blocks.filter(b => b.type !== 'burst' && b.width >= 80 && b.height <= 30).length;
  const wallH = blocks.filter(b => b.type !== 'burst').reduce((m, b) => Math.max(m, b.height), 0);
  const fireTop = (lv.pigs || []).filter(p => !p.sleep && blocks.some(b => b.type === 'fire' &&
    Math.abs((b.x + b.width / 2) - p.x) < b.width / 2 + 6 &&
    Math.abs(b.y - (p.y + (p.radius || 16))) < 10)).length;
  const sig = [
    a.birdsN + '鸟', a.awake + '豚', '砰' + a.bombN, '大' + big,
    '壳' + dp.shelled, '孤' + (a.awake - dp.shelled - (boss ? 1 : 0)), '果' + dp.burst,
    '墙' + (Math.round(wallH / 10) * 10), '楣' + lintel, '火顶' + fireTop,
    boss ? '王' : '', a.matDetail,
  ].join('/');
  return { sig, wallH, lintel, fireTop, big };
}

/** 五维读数；solve 结果（used/won）可选，缺省 P1 记 null */
function fiveDim(idx, solved) {
  const dp = decisionPoints(idx);
  const P2 = Math.min(5, dp.D);
  const P3 = p3Of(idx);
  const P4 = chainDepth(idx);
  const P5 = Math.min(5, varianceOf(idx).R);
  let P1 = null, W = null;
  if (solved && solved.won) {
    W = solved.birdsN - solved.used;
    P1 = Math.min(5, Math.max(1, 5 - W));
  }
  const dims = P1 == null ? [P2, P3, P4, P5] : [P1, P2, P3, P4, P5];
  const comp = dims.reduce((s, v) => s + v, 0) / dims.length;
  return { idx, P1, P2, P3, P4, P5, W, comp, dp, var_: varianceOf(idx), fp: fingerprint(idx), solved };
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
const solvedMap = new Map();

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
    solvedMap.set(idx, s);
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

// ==================== v2 五维压强报告 ====================
console.log('\n== 五维压强尺子 v2（P1弹药 P2识别 P3精度 P4序列 P5方差 → 综合；W=配置鸟数−最优解用鸟数）==');
const v2 = [];
for (const idx of idxs) {
  const solved = STATIC_ONLY ? null : (solvedMap.get(idx) || solve(idx));
  const f = fiveDim(idx, solved);
  v2.push(f);
  const p1 = f.P1 == null ? ' —' : ` ${f.P1}`;
  const mark = f.solved && !f.solved.won ? '◐' : ' ';
  console.log(
    `L${String(idx + 1).padStart(2)}${mark}${BOSS_IDX.includes(idx) ? '王' : ' '} ` +
    `P1${p1} P2=${f.P2} P3=${f.P3} P4=${f.P4} P5=${f.P5} ` +
    `综合=${f.comp.toFixed(1)} W=${f.W == null ? '—' : f.W} | ${f.fp.sig}`
  );
}

console.log('\n== 分章曲线校验（峰不降 / 谷不降 / 章内波幅≤1.2 / 指纹唯一率≥80% / W 落区间 / P5≤章上限）==');
let lawOk = true;
const chStats = [];
for (const ch of CHAPTER_V2) {
  const levels = v2.filter(f => f.idx >= ch.range[0] && f.idx <= ch.range[1]);
  const nonBoss = levels.filter(f => !BOSS_IDX.includes(f.idx));
  const compOf = f => f.comp;
  const cls = nonBoss.filter(f => actOf(f.idx) === '课').map(compOf);
  const lians = nonBoss.filter(f => actOf(f.idx) === '练').map(compOf);
  const exams = nonBoss.filter(f => actOf(f.idx) === '考').map(compOf);
  const bossComps = levels.filter(f => BOSS_IDX.includes(f.idx)).map(compOf);
  if (!lians.length || !exams.length) continue;
  const trough = Math.min(...cls, ...lians);      // 谷 = 课/练幕最低（章际比较）
  const examPeak = Math.max(...exams);            // 峰 = 考关（王关为独立尖峰，另由 boss-sim 守）
  const wave = examPeak - Math.min(...lians);     // 章内波幅 = 考峰 − 练谷
  const sigs = new Set(nonBoss.map(f => f.fp.sig));
  const uniq = sigs.size / nonBoss.length;
  const wVals = nonBoss.filter(f => f.W != null).map(f => f.W);
  const wBad = wVals.filter(w => w < ch.w[0] || w > ch.w[1]);
  const p5max = nonBoss.reduce((m, f) => Math.max(m, f.P5), 0);
  const p5Bad = nonBoss.filter(f => f.P5 > ch.p5cap);
  const dup = nonBoss.map(f => 'L' + (f.idx + 1) + ':' + f.fp.sig)
    .filter((s, i, arr) => arr.indexOf(s) !== i);
  const flags = [];
  if (wave > 1.2) { flags.push(`波幅${wave.toFixed(1)}>1.2`); lawOk = false; }
  if (examPeak < Math.min(...lians)) { flags.push(`考${examPeak.toFixed(1)}低于练谷`); lawOk = false; }
  if (uniq < 0.8) { flags.push(`指纹唯一率${(uniq * 100) | 0}%<80%${dup.length ? '（重复:' + dup.join(' ') + '）' : ''}`); lawOk = false; }
  if (wBad.length) {
    const solvedLevels = nonBoss.filter(f => f.W != null);
    flags.push(`W 越界:${wBad.map(w => 'L' + (solvedLevels.find(f => f.W === w).idx + 1) + '=' + w).join(',')}(目标${ch.w[0]}~${ch.w[1]})`);
    lawOk = false;
  }
  if (p5Bad.length) { flags.push(`P5 超章上限:${p5Bad.map(f => 'L' + (f.idx + 1) + '=' + f.P5).join(',')}(上限${ch.p5cap})`); lawOk = false; }
  chStats.push({ ch, trough, peak: examPeak, wave, uniq, bossComp: bossComps.length ? Math.max(...bossComps) : null });
  console.log(
    `${ch.name}  谷=${trough.toFixed(1)} 考峰=${examPeak.toFixed(1)} 波幅=${wave.toFixed(1)} ` +
    `王尖峰=${bossComps.length ? Math.max(...bossComps).toFixed(1) : '—'} ` +
    `指纹唯一=${(uniq * 100) | 0}%(${sigs.size}/${nonBoss.length}) ` +
    `W=${wVals.length ? wVals.join(',') : '—'}(目标${ch.w[0]}~${ch.w[1]}) P5max=${p5max}${p5max > ch.p5cap ? '>' : '≤'}${ch.p5cap} ` +
    (flags.length ? '⚠ ' + flags.join('；') : '✓')
  );
}
for (let i = 1; i < chStats.length; i++) {
  if (chStats[i].peak < chStats[i - 1].peak) { console.log(`⚠ 峰递减违律：${chStats[i].ch.name} 峰 ${chStats[i].peak.toFixed(1)} < 上一章 ${chStats[i - 1].peak.toFixed(1)}`); lawOk = false; }
  if (chStats[i].trough < chStats[i - 1].trough) { console.log(`⚠ 谷递减违律：${chStats[i].ch.name} 谷 ${chStats[i].trough.toFixed(1)} < 上一章 ${chStats[i - 1].trough.toFixed(1)}`); lawOk = false; }
}
console.log(lawOk ? '三律 + 指纹 + W + 方差：全部通过' : '三律/指纹/W/方差存在违律项（见上）');

// 王关贴脸果保底：hp≥9 的王关须有 ≥2 颗贴脸冻果（距王 ≤100px），防连锁方差吞固定伤害
for (const f of v2) {
  if (!BOSS_IDX.includes(f.idx)) continue;
  const hp = (LEVELS[f.idx].pigs.find(p => p.boss) || {}).hp || 9;
  const need = hp >= 9 ? 2 : 0;
  const ok = f.var_.hug >= need;
  console.log(`L${f.idx + 1} 王关 hp${hp} 贴脸冻果=${f.var_.hug}${need ? `(需≥${need})` : ''} ${ok ? '✓' : '⚠ 保底不足'}`);
}
}

// 供 e2e 难度曲线断言复用静态尺子（require 时不跑慢模拟；仅直接执行才跑）
module.exports = {
  CHAPTER, chapterOf, analyze, MAT_LABEL, STRUCT_MATS, hpOf, BOSS_IDX, LEVELS,
  // v2 五维尺子
  ACTS, actOf, CHAPTER_V2, chapterV2Of, p3Of, bossPhases, decisionPoints, chainDepth,
  varianceOf, fingerprint, fiveDim, solve,
};

if (require.main === module) run();
