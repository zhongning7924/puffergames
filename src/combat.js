/**
 * 战斗事件模块 - 技能释放、爆炸、击杀/摧毁结算与珍珠拾取
 * Combat Events - ability activation, explosion, kill/destruction settle, pearl pickup.
 *
 * 从 game.js 拆出（纯搬移，不改行为）。
 * 约定：每个函数以 game 实例为第一个参数；Game 类保留同名薄委托方法。
 * physics.js 通过 game.xxx 薄委托回调这里（explode/onPigKilled/onBlockDestroyed）。
 */

const C = require('./config.js');
const U = require('./utils.js');
const AUDIO = require('./audio.js');

/** 空中点击释放当前河豚技能 */
function tryActivateAbility(game) {
  const bird = game.currentBird;
  if (!bird || !bird.canUseAbility()) return;
  const result = bird.activateAbility();
  if (!result) return;

  if (result.ability === 'dash') {
    game.createLaunchParticles(bird.x, bird.y); // 冲刺尾焰
    AUDIO.play('launch');
    game.vibrate('light');
    game.addFloatingText(bird.x, bird.y - 25, '冲刺！', C.COLORS.white, 16);
  } else if (result.ability === 'split') {
    for (const b of result.extraBirds) game.extraBirds.push(b);
    AUDIO.play('tap');
    game.addFloatingText(bird.x, bird.y - 25, '分身！', C.COLORS.white, 16);
  } else if (result.ability === 'bomb') {
    game.explode(bird.x, bird.y);
    // 爆炸后河豚消散
    game.currentBird = null;
  }
}

/**
 * 岩轰爆炸：范围伤害 + 击退 + 特效。
 * 冲击力随距离衰减，同时作用章鱼与方块。
 */
function explode(game, x, y) {
  const R = C.BOMB_RADIUS;
  game.screenShake(8);
  AUDIO.play('boom');
  game.vibrate('heavy');

  // 爆炸粒子（火心 + 浓烟双层，原创橙棕配色）
  for (let i = 0; i < 16; i++) {
    const angle = U.random(0, Math.PI * 2);
    const speed = U.random(3, 9);
    game.spawnParticle(
      x, y,
      Math.cos(angle) * speed, Math.sin(angle) * speed - 1,
      i % 2 === 0 ? '#FF9F43' : '#FF5252',
      U.randomInt(20, 35), U.random(5, 10)
    );
  }
  for (let i = 0; i < 10; i++) {
    const angle = U.random(0, Math.PI * 2);
    const speed = U.random(1, 4);
    game.spawnParticle(
      x, y,
      Math.cos(angle) * speed, Math.sin(angle) * speed - 2,
      '#8D6E63',
      U.randomInt(30, 50), U.random(6, 12)
    );
  }

  // 章鱼：范围伤害 + 向外击退
  for (const pig of game.pigs) {
    if (!pig.alive || pig.dying || pig.sleeping) continue;
    const d = U.distance(x, y, pig.x, pig.y);
    if (d > R + pig.radius) continue;
    const force = C.BOMB_FORCE * (1 - d / (R + pig.radius)) + 4;
    const killed = pig.takeDamage(force);
    const nx = (pig.x - x) / (d || 1);
    const ny = (pig.y - y) / (d || 1);
    pig.knockback(nx * force * 0.6, ny * force * 0.6 - 2);
    if (killed) {
      game.onPigKilled(pig);
    } else {
      game.onPigHurt(pig);
    }
  }

  // 方块：范围伤害 + 向外击退（激活为动态）
  for (const block of game.blocks) {
    if (!block.alive || block.sleeping) continue;
    const bx = block.x + block.width / 2;
    const by = block.y + block.height / 2;
    const d = U.distance(x, y, bx, by);
    const reach = R + Math.max(block.width, block.height) / 2;
    if (d > reach) continue;
    const force = C.BOMB_FORCE * (1 - d / reach) + 3;
    // 爆炸对石头有克制加成（岩轰 damageVs.stone = 2）
    const mult = (C.BIRD_TYPES.bomb.damageVs[block.type]) || 1;
    const destroyed = block.takeDamage(force * mult);
    const nx = (bx - x) / (d || 1);
    const ny = (by - y) / (d || 1);
    block.knockback(nx * force * 0.5, ny * force * 0.5 - 1.5, bx + nx * 5, by + ny * 5);
    if (destroyed) game.onBlockDestroyed(block);
  }
}

/** 章鱼被消灭的统一结算（分数/连击/特效/音效） */
function onPigKilled(game, pig) {
  game.combo++;
  game.comboTimer = 120;
  if (game.combo > game.maxCombo) game.maxCombo = game.combo;
  // 连击数值化：第 N 连击得分 = 1000 × N
  const points = 1000 * game.combo;
  game.score += points;
  game.createPigParticles(pig.x, pig.y);
  game.addFloatingText(pig.x, pig.y - 30, '+' + points, C.COLORS.particlePurple, 22);
  if (game.combo > 1) {
    game.addFloatingText(pig.x, pig.y - 55, 'COMBO x' + game.combo + '!', C.COLORS.starGold, 18);
  }
  game.screenShake(4);
  AUDIO.play('pop');
  game.vibrate('medium');

  // 章王讨伐：大额奖励 + 全屏爆炸粒子雨 + 重震感
  if (pig.isBoss) {
    game.score += 5000;
    game.addFloatingText(pig.x, pig.y - 84, '章王讨伐！+5000', C.COLORS.starGold, 26);
    for (let i = 0; i < 40; i++) {
      const angle = U.random(0, Math.PI * 2);
      const speed = U.random(2, 10);
      game.spawnParticle(
        pig.x, pig.y,
        Math.cos(angle) * speed, Math.sin(angle) * speed - 2,
        i % 3 === 0 ? '#FFD54F' : (i % 3 === 1 ? '#FF5252' : '#BA68C8'),
        U.randomInt(30, 55), U.random(5, 11)
      );
    }
    game.screenShake(16);
    game.vibrate('long');
    AUDIO.play('win');
  }
}

/**
 * 章王受伤检查：血量跨阶段阈值时触发「怒吼」演出。
 * 阶段数随血量增厚：hp≥11 三阶段、≥8 两阶段、≥6 一阶段、教学章王无阶段。
 */
function onPigHurt(game, pig) {
  if (!pig.isBoss || pig.dying) return;
  const totalPhases = pig.maxHealth >= 11 ? 3 : pig.maxHealth >= 8 ? 2 : pig.maxHealth >= 6 ? 1 : 0;
  while (pig.phase < totalPhases) {
    const threshold = pig.maxHealth * (1 - (pig.phase + 1) / (totalPhases + 1));
    if (pig.health > threshold) break;
    pig.phase++;
    triggerBossPhase(game, pig, pig.phase);
  }
}

/** 章王怒吼：震屏 + 低频音 + 唤醒本阶段休眠的掉落物/援军（sleepMark === phase） */
function triggerBossPhase(game, boss, phase) {
  game.screenShake(12);
  AUDIO.play('boom');
  game.vibrate('heavy');
  game.addFloatingText(boss.x, boss.y - boss.radius - 26, '章王怒吼！', '#FF8A80', 24);
  for (const b of game.blocks) {
    if (b.sleeping && b.sleepMark === phase) {
      b.sleeping = false;
      b.dynamic = true;
      b.vx = U.random(-1.5, 1.5);
      b.stillFrames = 0;
    }
  }
  for (const p of game.pigs) {
    if (p.sleeping && p.sleepMark === phase) {
      p.sleeping = false;
      p.dynamic = true;
      p.stillFrames = 0;
    }
  }
}

/** 飞行河豚触碰场景珍珠 → 拾取入库 */
function checkPearlCollection(game, bird) {
  if (!bird) return;
  for (const pearl of game.pearls) {
    if (pearl.collected) continue;
    if (U.distance(bird.x, bird.y, pearl.x, pearl.y) < bird.radius + 9) {
      game.collectPearl(pearl);
    }
  }
}

/** 珍珠拾取结算（入库存档 + 珠光粒子 + 飘字提示） */
function collectPearl(game, pearl) {
  pearl.collected = true;
  game.progress.pearls = { ...game.progress.pearls, [pearl.id]: true };
  game.saveProgress();
  game.addFloatingText(pearl.x, pearl.y - 22, '发现珍珠！', '#E1F5FE', 18);
  for (let i = 0; i < 10; i++) {
    const angle = U.random(0, Math.PI * 2);
    const speed = U.random(1, 3.5);
    game.spawnParticle(
      pearl.x, pearl.y,
      Math.cos(angle) * speed, Math.sin(angle) * speed - 1,
      i % 2 === 0 ? '#E1F5FE' : '#F8BBD0',
      U.randomInt(20, 35), U.random(2, 4)
    );
  }
  AUDIO.play('ding');
  game.vibrate('light');
}

/** 方块被摧毁的统一结算（分数/特效/音效） */
function onBlockDestroyed(game, block) {
  game.score += 500;
  game.createBlockParticles(block.x + block.width / 2, block.y + block.height / 2, block.type);
  game.addFloatingText(block.x + block.width / 2, block.y, '+500', block.props.color, 18);
  game.screenShake(3);
  AUDIO.play('break');
  // 爆裂果被摧毁 → 链式爆炸（入队，下一逻辑步处理，避免爆炸递归过深）
  if (block.type === 'burst') {
    game.pendingExplosions.push({
      x: block.x + block.width / 2,
      y: block.y + block.height / 2,
    });
  }
}

module.exports = {
  tryActivateAbility,
  explode,
  onPigKilled,
  onPigHurt,
  checkPearlCollection,
  collectPearl,
  onBlockDestroyed,
};
