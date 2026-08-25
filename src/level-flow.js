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
  game.currentLevelIndex = index;
  setupLevel(game, level);
}

/** 开始每日挑战：以当天日期为种子生成限定关卡（全体玩家同题） */
function startDaily(game) {
  game.isDaily = true;
  game.isBonus = false;
  game.bonusLevel = null;
  game.bonusMeta = null;
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
  game.currentLevelIndex = -1;
  game.bonusLevel = PEARLS.generateBonusLevel(meta, game.levels);
  setupLevel(game, game.bonusLevel);
}

/** 关卡初始化：清场回收、教学提示、生成猪/方块/珍珠/鸟队列 */
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

  // 生成猪
  game.pigs = level.pigs.map(p => new E.Pig(p.x, p.y, p.radius));

  // 生成方块
  game.blocks = level.blocks.map(b => new E.Block(b.x, b.y, b.width, b.height, b.type));

  // 生成小鸟队列（支持数组鸟种队列；兼容旧的数字形式 → 全小青）
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
 * 原先单排 28px 间距，5~6 只鸟时 x 越出屏幕左缘（L9 六只时 3 只不可见，
 * 玩家会误以为"用完又凭空出鸟"）。网格布局保证全部鸟始终可见。
 */
function queuePosition(i) {
  const col = i % 3;
  const row = Math.floor(i / 3);
  return {
    x: C.SLINGSHOT_X - 35 - col * 21,
    y: C.GROUND_Y - C.BIRD_RADIUS - row * 28,
  };
}

/** 把队列下一只鸟搬上弹弓并重置飞行状态 */
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
};
