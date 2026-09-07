/**
 * 物理碰撞模块 - 河豚/方块/章鱼之间的碰撞检测与响应
 * Physics - collision detection & response (bird / block / pig).
 *
 * 从 game.js 拆出（纯搬移，不改行为）。
 * 约定：每个函数以 game 实例为第一个参数，读写其状态（pigs/blocks/特效结算等）。
 */

const C = require('./config.js');
const U = require('./utils.js');

/**
 * 飞行河豚的碰撞检测（对传入的豚）。
 * 返回 true 表示岩轰触发爆炸、河豚消散（调用方负责移除）。
 */
function checkBirdCollisions(game, bird) {
  if (!bird) return false;
  const isArmedBomb = bird.type === 'bomb' && !bird.abilityUsed;

  // 河豚 vs 章鱼
  for (const pig of game.pigs) {
    if (!pig.alive || pig.dying || pig.sleeping) continue;
    const col = U.circleCircle(bird, pig);
    if (col.collided) {
      // 岩轰首次撞击 → 直接爆炸
      if (isArmedBomb) {
        bird.abilityUsed = true;
        game.explode(bird.x, bird.y);
        return true;
      }

      const impactForce = Math.sqrt(
        (bird.vx - pig.vx) ** 2 + (bird.vy - pig.vy) ** 2
      );

      // 分离
      bird.x += col.normal.x * col.depth;
      bird.y += col.normal.y * col.depth;

      // 反弹
      const dot = bird.vx * col.normal.x + bird.vy * col.normal.y;
      if (dot < 0) {
        bird.vx -= (1 + C.GROUND_BOUNCE) * dot * col.normal.x;
        bird.vy -= (1 + C.GROUND_BOUNCE) * dot * col.normal.y;
      }

      // 章鱼受伤
      const killed = pig.takeDamage(impactForce);
      if (killed) {
        game.onPigKilled(pig);
      } else {
        game.onPigHurt(pig);
        if (impactForce > 4) {
          game.createImpactParticles(bird.x, bird.y, C.COLORS.particlePurple);
          game.screenShake(2);
          game.playHitSound();
        }
      }

      // 章鱼被击退
      pig.knockback(col.normal.x * impactForce * 0.3, col.normal.y * impactForce * 0.3);
      bird.squish = Math.min(impactForce * 0.03, 0.25);
      break;
    }
  }

  // 河豚 vs 方块
  for (const block of game.blocks) {
    if (!block.alive || block.sleeping) continue;
    const col = U.circleOBB(bird, block);
    if (col.collided) {
      // 岩轰首次撞击 → 直接爆炸
      if (isArmedBomb) {
        bird.abilityUsed = true;
        game.explode(bird.x, bird.y);
        return true;
      }

      const impactForce = Math.sqrt(
        (bird.vx - block.vx) ** 2 + (bird.vy - block.vy) ** 2
      );

      // 分离
      bird.x += col.normal.x * col.depth;
      bird.y += col.normal.y * col.depth;

      // 反弹
      const dot = bird.vx * col.normal.x + bird.vy * col.normal.y;
      if (dot < 0) {
        bird.vx -= (1 + C.GROUND_BOUNCE) * dot * col.normal.x;
        bird.vy -= (1 + C.GROUND_BOUNCE) * dot * col.normal.y;
      }

      // 方块受伤（应用豚种 × 材质克制矩阵）
      const mult = (bird.props.damageVs && bird.props.damageVs[block.type]) || 1;
      const destroyed = block.takeDamage(impactForce * mult);
      if (destroyed) {
        game.onBlockDestroyed(block);
        if (mult >= 1.5) {
          game.addFloatingText(block.x + block.width / 2, block.y - 22, '弱点打击！', C.COLORS.starGold, 16);
        }
      } else if (impactForce > 3) {
        game.createImpactParticles(col.point.x, col.point.y, block.props.particle);
        game.screenShake(1.5);
        game.playHitSound();
      }

      // 方块击退
      block.knockback(
        col.normal.x * impactForce * 0.25,
        col.normal.y * impactForce * 0.25,
        col.point.x,
        col.point.y
      );

      bird.squish = Math.min(impactForce * 0.03, 0.2);
      break;
    }
  }

  return false;
}

/** 动态方块 vs 章鱼 / 其他方块的碰撞（结算阶段调用） */
function checkDynamicCollisions(game) {
  // 动态方块 vs 章鱼
  for (const block of game.blocks) {
    if (!block.alive || !block.dynamic) continue;
    const blockSpeed = Math.sqrt(block.vx ** 2 + block.vy ** 2);
    if (blockSpeed < 1) continue;
    if (!block.pigContacts) block.pigContacts = new Set(); // 旧实例兜底
    const touched = new Set();

    for (const pig of game.pigs) {
      if (!pig.alive || pig.dying || pig.sleeping) continue;
      const pigCircle = { x: pig.x, y: pig.y, radius: pig.radius };
      const col = U.circleOBB(pigCircle, block);
      if (col.collided) {
        touched.add(pig);
        const isNewImpact = !block.pigContacts.has(pig);
        // 物理推开（普通章鱼被弹开；章王免疫击退保持原位，方块会堆在它身上）
        pig.knockback(block.vx * 0.3, block.vy * 0.3);
        block.vx *= 0.7;
        block.vy *= 0.7;
        // 伤害：仅「新接触的冲击瞬间」且速度够快才掉血。
        // 章王不被击退，方块会持续压在它身上——若每帧都掉血，一块石板压着就能碾压秒杀；
        // 故一次持续接触只在撞上的瞬间算一次，方块真正分离（腾空）后再砸才算下一次。
        if (isNewImpact && blockSpeed > 5) {
          const killed = pig.takeDamage(blockSpeed);
          if (killed) {
            game.onPigKilled(pig);
          } else {
            game.onPigHurt(pig);
          }
        }
      }
    }

    // 更新接触集：本帧仍接触的保留，已分离的移除（分离后再撞才算新冲击）
    for (const pig of [...block.pigContacts]) {
      if (!touched.has(pig)) block.pigContacts.delete(pig);
    }
    for (const pig of touched) block.pigContacts.add(pig);
  }

  // 动态方块 vs 其他方块（每对只检查一次，至少一个动态才检测）
  for (let i = 0; i < game.blocks.length; i++) {
    const a = game.blocks[i];
    if (!a.alive || a.sleeping) continue;
    for (let j = i + 1; j < game.blocks.length; j++) {
      const b = game.blocks[j];
      if (!b.alive || b.sleeping) continue;
      if (!a.dynamic && !b.dynamic) continue;
      const col = U.obbObb(a, b);
      if (col.collided) {
        const speed = Math.max(
          Math.abs(a.vx) + Math.abs(a.vy),
          Math.abs(b.vx) + Math.abs(b.vy)
        );

        // 分离 - 移动动态方块
        if (col.axis === 'y') {
          if (a.dynamic && b.dynamic) {
            const half = col.overlap / 2;
            a.y += col.direction * half;
            b.y -= col.direction * half;
            if (col.direction < 0) { a.vy = 0; } else { a.vy = Math.max(0, a.vy); }
            if (col.direction > 0) { b.vy = 0; } else { b.vy = Math.max(0, b.vy); }
            a.vx *= 0.7; a.angularVelocity *= 0.3;
            b.vx *= 0.7; b.angularVelocity *= 0.3;
          } else if (a.dynamic) {
            a.y += col.direction * col.overlap;
            if (col.direction < 0) { a.vy = 0; a.vx *= 0.6; a.angularVelocity *= 0.3; }
            else { a.vy = Math.max(0, a.vy); }
          } else if (b.dynamic) {
            b.y -= col.direction * col.overlap;
            if (col.direction > 0) { b.vy = 0; b.vx *= 0.6; b.angularVelocity *= 0.3; }
            else { b.vy = Math.max(0, b.vy); }
          }
        } else {
          if (a.dynamic && b.dynamic) {
            const half = col.overlap / 2;
            a.x += col.direction * half;
            b.x -= col.direction * half;
            a.vx *= -0.3; b.vx *= -0.3;
          } else if (a.dynamic) {
            a.x += col.direction * col.overlap;
            a.vx *= -0.3;
          } else if (b.dynamic) {
            b.x -= col.direction * col.overlap;
            b.vx *= -0.3;
          }
        }

        // 碰撞伤害
        if (speed > 5) {
          if (a.takeDamage(speed * 0.5)) game.onBlockDestroyed(a);
          if (b.takeDamage(speed * 0.5)) game.onBlockDestroyed(b);
          game.playHitSound();
        }
      }
    }
  }

  // 动态方块 vs 地面已在 Block.update 中处理
}

module.exports = { checkBirdCollisions, checkDynamicCollisions };
