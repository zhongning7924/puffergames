/**
 * 特效模块 - 粒子发射、飘字、屏幕震动与撞击音效
 * Effects - particle emission, floating text, screen shake, hit sound.
 *
 * 从 game.js 拆出（纯搬移，不改行为）。
 * 约定：每个函数以 game 实例为第一个参数；Game 类保留同名薄委托方法。
 * 对象池（particlePool/textPool）挂在 game 上，此处只做存取。
 */

const C = require('./config.js');
const U = require('./utils.js');
const E = require('./entities.js');
const AUDIO = require('./audio.js');

/** 章鱼怪消灭：紫色碎屑两圈（浅色外散 + 深色内聚） */
function createPigParticles(game, x, y) {
  for (let i = 0; i < 12; i++) {
    const angle = (Math.PI * 2 * i) / 12 + U.random(-0.3, 0.3);
    const speed = U.random(2, 6);
    game.spawnParticle(
      x, y,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed - 2,
      C.COLORS.pigBody,
      U.randomInt(25, 45),
      U.random(4, 8)
    );
  }
  // 添加一些深色粒子
  for (let i = 0; i < 6; i++) {
    const angle = U.random(0, Math.PI * 2);
    const speed = U.random(1, 4);
    game.spawnParticle(
      x, y,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed - 1,
      C.COLORS.pigBodyDark,
      U.randomInt(20, 35),
      U.random(3, 6)
    );
  }
}

/** 方块碎裂：按材质配色的碎片（石头更多） */
function createBlockParticles(game, x, y, type) {
  const color = C.BLOCK_TYPES[type].color;
  const colorDark = C.BLOCK_TYPES[type].colorDark;
  const count = type === 'stone' ? 14 : 10;
  for (let i = 0; i < count; i++) {
    const angle = U.random(0, Math.PI * 2);
    const speed = U.random(1.5, 5);
    game.spawnParticle(
      x, y,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed - 2,
      i % 2 === 0 ? color : colorDark,
      U.randomInt(25, 40),
      U.random(3, 7)
    );
  }
}

/** 撞击火花（小鸟撞猪/方块未摧毁时的小反馈） */
function createImpactParticles(game, x, y, color) {
  for (let i = 0; i < 5; i++) {
    const angle = U.random(0, Math.PI * 2);
    const speed = U.random(1, 3);
    game.spawnParticle(
      x, y,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed - 1,
      color || '#FFFFFF',
      U.randomInt(15, 25),
      U.random(2, 4)
    );
  }
}

/** 发射尾焰（向后下扇形喷散） */
function createLaunchParticles(game, x, y) {
  for (let i = 0; i < 8; i++) {
    const angle = U.random(Math.PI * 0.7, Math.PI * 1.3);
    const speed = U.random(1, 4);
    game.spawnParticle(
      x, y,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed,
      C.COLORS.birdBody,
      U.randomInt(15, 25),
      U.random(2, 5)
    );
  }
}

/** 粒子发射（优先从对象池复用，池空才 new） */
function spawnParticle(game, x, y, vx, vy, color, life, size) {
  const p = game.particlePool.pop();
  if (p) {
    p.reset(x, y, vx, vy, color, life, size);
    game.particles.push(p);
  } else {
    game.particles.push(new E.Particle(x, y, vx, vy, color, life, size));
  }
}

/** 飘字（优先从对象池复用） */
function addFloatingText(game, x, y, text, color, size) {
  const t = game.textPool.pop();
  if (t) {
    t.reset(x, y, text, color, size);
    game.floatingTexts.push(t);
  } else {
    game.floatingTexts.push(new E.FloatingText(x, y, text, color, size));
  }
}

/** 屏幕震动（取更大值，避免连续小震互相覆盖） */
function screenShake(game, amount) {
  game.shakeAmount = Math.max(game.shakeAmount, amount);
}

/** 带帧冷却的撞击音效，避免高速碰撞时每帧重复触发刷屏 */
function playHitSound(game) {
  if (game.hitSoundCooldown > 0) return;
  AUDIO.play('hit');
  game.hitSoundCooldown = 4;
}

module.exports = {
  createPigParticles,
  createBlockParticles,
  createImpactParticles,
  createLaunchParticles,
  spawnParticle,
  addFloatingText,
  screenShake,
  playHitSound,
};
