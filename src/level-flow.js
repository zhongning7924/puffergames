/**
 * 关卡流程模块 - 关卡装载/生成与候飞队列管理
 * Level Flow - level loading/generation and waiting-queue management.
 *
 * 从 game.js 拆出（纯搬移，不改行为）。
 * 约定：每个函数以 game 实例为第一个参数；Game 类保留同名薄委托方法。
 */

const C = require('./config.js');
const E = require('./entities.js');
const DAILY = require('./daily.js');
const PEARLS = require('./pearls.js');

/** 装载手工关卡（战役模式） */
function loadLevel(game, index) {
  const level = game.levels[index];
  if (!level) return;
  game.isDaily = false;
  game.dailyLevel = null;
  game.isBonus = false;
  game.bonusLevel = null;
  game.bonusMeta = null;
  // 自制关试玩/挑战返回战役：复位自定义关上下文（与 isDaily/isBonus 复位对称）
  game.isCustom = false;
  game.playOrigin = null;
  game.customLevel = null;
  game.currentLevelIndex = index;
  setupLevel(game, level);
}

/** 开始每日挑战：以当天日期为种子生成限定关卡（全体玩家同题） */
function startDaily(game) {
  game.isDaily = true;
  game.isBonus = false;
  game.bonusLevel = null;
  game.bonusMeta = null;
  game.isCustom = false;
  game.playOrigin = null;
  game.customLevel = null;
  game.currentLevelIndex = -1;
  game.dailyLevel = DAILY.generateLevel(DAILY.todayString(), game.levels);
  setupLevel(game, game.dailyLevel);
}

/** 进入下一个已解锁珍珠关（在解锁池中轮换） */
function startNextBonus(game) {
  const unlocked = PEARLS.unlockedMetas(game.progress);
  if (unlocked.length === 0) return;
  game.bonusCursor = (game.bonusCursor + 1) % unlocked.length;
  startBonus(game, unlocked[game.bonusCursor]);
}

/** 开始指定珍珠关（种子=珍珠 ID，确定性生成，重开内容一致） */
function startBonus(game, meta) {
  game.isDaily = false;
  game.dailyLevel = null;
  game.isBonus = true;
  game.bonusMeta = meta;
  game.isCustom = false;
  game.playOrigin = null;
  game.customLevel = null;
  game.currentLevelIndex = -1;
  game.bonusLevel = PEARLS.generateBonusLevel(meta, game.levels);
  setupLevel(game, game.bonusLevel);
}

/** 关卡初始化：清场回收、教学提示、生成章鱼/方块/珍珠/豚队列 */
function setupLevel(game, level) {
  game.score = 0;
  game.combo = 0;
  game.maxCombo = 0;
  game.extraBirds = [];
  game.pendingExplosions = [];
  // 未寿终的粒子/飘字直接回收进池（复用时 reset，无状态残留）
  for (const p of game.particles) {
    if (game.particlePool.length < 300) game.particlePool.push(p);
  }
  for (const t of game.floatingTexts) {
    if (game.textPool.length < 50) game.textPool.push(t);
  }
  game.particles = [];
  game.floatingTexts = [];
  game.shakeAmount = 0;
  // 教学提示：第 1 关每次进入显示拖拽教学；技能关首次进入显示对应技能教学（存档记录，看过即不再打扰）
  const isTutorial = !game.isDaily && game.currentLevelIndex === 0;
  const showSkillHint = !game.isDaily && !!level.hint && !game.progress.hintShown[game.currentLevelIndex];
  game.hintAlpha = (isTutorial || showSkillHint) ? 1 : 0;
  game.hintText = showSkillHint ? level.hint : null;
  if (showSkillHint) {
    game.progress.hintShown = { ...game.progress.hintShown, [game.currentLevelIndex]: true };
    game.saveProgress();
  }
  game.buttons = {};
  game.winAnim = null;
  game.reviveUsed = false;
  game.adDoubleUsed = false;
  game.trajectoryBoost = false;
  game.lastTrail = null;
  game.newPearlAwarded = null;

  // 场景珍珠（已入库的不再出现，保持"找隐藏"的一次性惊喜）
  game.pearls = (level.pearls || [])
    .map(p => ({ ...p, collected: !!game.progress.pearls[p.id] }));

  // 生成章鱼（章王：boss/hp/name；阶段援军：sleep 标记）
  game.pigs = level.pigs.map(p => new E.Pig(p.x, p.y, p.radius,
    { boss: p.boss, hp: p.hp, name: p.name, sleep: p.sleep, style: p.style }));

  // 生成方块（章王阶段掉落物：sleep 标记，预置屏幕外，怒吼时唤醒）
  game.blocks = level.blocks.map(b => new E.Block(b.x, b.y, b.width, b.height, b.type,
    { sleep: b.sleep, guard: b.guard }));

  // 生成河豚队列（支持数组豚种队列；兼容旧的数字形式 → 全小青）
  const birdTypes = Array.isArray(level.birds)
    ? level.birds
    : Array(level.birds).fill('normal');
  game.birdsRemaining = birdTypes.length;
  game.birds = birdTypes.map((t, i) => {
    const pos = queuePosition(i);
    return new E.Bird(pos.x, pos.y, t);
  });

  spawnBird(game);
  game.state = 'READY';
}

/**
 * 候飞队列站位：3 列 × 2 排网格（前排站地面，后排站高处）。
 * 原先单排 28px 间距，5~6 只豚时 x 越出屏幕左缘（L9 六只时 3 只不可见，
 * 玩家会误以为"用完又凭空出豚"）。网格布局保证全部豚始终可见。
 */
function queuePosition(i) {
  const col = i % 3;
  const row = Math.floor(i / 3);
  return {
    x: C.SLINGSHOT_X - 35 - col * 21,
    y: C.GROUND_Y - C.BIRD_RADIUS - row * 28,
  };
}

/**
 * 换豚：READY 时把候飞队列中第 queueIndex 只豚换到弹弓上。
 * 弹弓上的豚回队、与目标交换，玩家由此可自由规划出豚顺序——
 * 让「豚种 × 材质克制」（dash 克木 / bomb 克石 / split 克冰）从关卡预设变为玩家决策。
 * AIMING/FLYING 中不可换（由 state 判断拦截）。
 */
function swapBird(game, queueIndex) {
  if (game.state !== 'READY' || !game.currentBird || game.birds.length === 0) return;
  const k = Math.max(0, Math.min(queueIndex, game.birds.length - 1));
  game.birds.unshift(game.currentBird);      // 弹弓上的豚回队首
  const target = k + 1;                       // 选中豚在 unshift 后数组中的位置
  const tmp = game.birds[0];
  game.birds[0] = game.birds[target];
  game.birds[target] = tmp;
  spawnBird(game);                            // 队首（选中豚）搬上弹弓
  for (let i = 0; i < game.birds.length; i++) { // 候飞队列按站位网格重排
    const pos = queuePosition(i);
    game.birds[i].x = pos.x;
    game.birds[i].y = pos.y;
  }
}

/** 把队列下一只豚搬上弹弓并重置飞行状态 */
function spawnBird(game) {
  if (game.birds.length === 0) return;
  game.currentBird = game.birds.shift();
  game.currentBird.x = C.SLINGSHOT_X;
  game.currentBird.y = C.SLINGSHOT_Y - 15;
  game.currentBird.launched = false;
  game.currentBird.vx = 0;
  game.currentBird.vy = 0;
  game.currentBird.trail = [];
  game.currentBird.stillFrames = 0;
  game.currentBird.onGround = false;
  game.currentBird.abilityUsed = false;
}

module.exports = {
  loadLevel,
  startDaily,
  startNextBonus,
  startBonus,
  setupLevel,
  queuePosition,
  spawnBird,
  swapBird,
};
