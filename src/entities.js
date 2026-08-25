/**
 * 游戏实体类 - 小鸟、猪、方块、粒子、按钮、云朵
 * Game Entities - Bird, Pig, Block, Particle, Button, Cloud
 */

const C = require('./config.js');
const U = require('./utils.js');

// ========== 小鸟 Bird ==========

class Bird {
  constructor(x, y, type = 'normal') {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.type = type;
    this.props = C.BIRD_TYPES[type] || C.BIRD_TYPES.normal;
    this.radius = C.BIRD_RADIUS;
    this.launched = false;
    this.alive = true;
    this.rotation = 0;
    this.trail = [];
    this.squish = 0;       // 弹性形变动画
    this.onGround = false;
    this.stillFrames = 0;  // 静止帧计数
    this.blinkTimer = 0;
    this.blinking = false;
    this.abilityUsed = false; // 技能是否已释放（每次飞行限一次）
  }

  /** 是否可在空中释放技能 */
  canUseAbility() {
    return this.launched && !this.abilityUsed && !!this.props.ability;
  }

  /**
   * 释放技能。返回 { ability, extraBirds? }：
   *  - dash：自身沿当前方向加速；
   *  - split：自身偏上偏转，返回 2 只偏转的新鸟（调用方负责纳入管理）；
   *  - bomb：仅标记，爆炸效果由 game 层执行（需要访问方块/猪/粒子）。
   */
  activateAbility() {
    if (!this.canUseAbility()) return null;
    this.abilityUsed = true;
    const ability = this.props.ability;

    if (ability === 'dash') {
      const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
      const boosted = Math.max(speed * C.DASH_BOOST, C.DASH_MIN_SPEED);
      const angle = Math.atan2(this.vy, this.vx);
      this.vx = Math.cos(angle) * boosted;
      this.vy = Math.sin(angle) * boosted;
      this.trail = [];
      return { ability };
    }

    if (ability === 'split') {
      const angle = Math.atan2(this.vy, this.vx);
      const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
      // 自身向上偏转
      this.vx = Math.cos(angle - C.SPLIT_ANGLE) * speed;
      this.vy = Math.sin(angle - C.SPLIT_ANGLE) * speed;
      // 另外两只：直行 + 向下偏转
      const extraBirds = [];
      for (const offset of [0, C.SPLIT_ANGLE]) {
        const b = new Bird(this.x, this.y, this.type);
        b.vx = Math.cos(angle + offset) * speed;
        b.vy = Math.sin(angle + offset) * speed;
        b.launched = true;
        b.abilityUsed = true;
        extraBirds.push(b);
      }
      return { ability, extraBirds };
    }

    return { ability }; // bomb：由 game 层处理爆炸
  }

  update() {
    if (!this.launched) return;

    // 物理 Physics
    this.vy += C.GRAVITY;
    this.vx *= C.AIR_FRICTION;
    this.x += this.vx;
    this.y += this.vy;
    this.rotation = Math.atan2(this.vy, this.vx);

    // 拖尾 Trail
    if (this.trail.length === 0 || U.distance(this.x, this.y, this.trail[this.trail.length - 1].x, this.trail[this.trail.length - 1].y) > 4) {
      this.trail.push({ x: this.x, y: this.y, alpha: 1 });
      if (this.trail.length > 12) this.trail.shift();
    }
    for (let i = 0; i < this.trail.length; i++) {
      this.trail[i].alpha = (i + 1) / this.trail.length * 0.5;
    }

    // 地面碰撞 Ground collision
    if (this.y + this.radius > C.GROUND_Y) {
      this.y = C.GROUND_Y - this.radius;
      if (Math.abs(this.vy) > 1) {
        this.vy = -this.vy * C.GROUND_BOUNCE;
        this.squish = Math.min(Math.abs(this.vy) * 0.04, 0.3);
      } else {
        this.vy = 0;
        this.onGround = true;
      }
      this.vx *= 0.7;
    }

    // 左右边界 Left/Right boundary
    if (this.x - this.radius < 0) {
      this.x = this.radius;
      this.vx = -this.vx * C.WALL_BOUNCE;
    }
    if (this.x + this.radius > C.SCREEN_WIDTH) {
      this.x = C.SCREEN_WIDTH - this.radius;
      this.vx = -this.vx * C.WALL_BOUNCE;
    }

    // 形变恢复 Squish recovery
    this.squish *= 0.85;

    // 静止检测 Still detection (不限于地面，停在方块上也算)
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (speed < C.REST_THRESHOLD) {
      this.stillFrames++;
    } else {
      this.stillFrames = 0;
    }

    // 眨眼 Blink
    this.blinkTimer++;
    if (this.blinkTimer > 120 + Math.random() * 120) {
      this.blinking = true;
      this.blinkTimer = 0;
    }
    if (this.blinking && this.blinkTimer > 8) {
      this.blinking = false;
    }
  }

  isStill() {
    return this.stillFrames > 30;
  }

  isOffScreen() {
    return this.y > C.SCREEN_HEIGHT + 100 || this.x > C.SCREEN_WIDTH + 100 || this.x < -100;
  }

  launch(vx, vy) {
    this.vx = vx;
    this.vy = vy;
    this.launched = true;
    this.trail = [];
  }

  draw(ctx) {
    const p = this.props;

    // 拖尾（颜色随鸟种）
    for (let i = 0; i < this.trail.length; i++) {
      const t = this.trail[i];
      ctx.beginPath();
      ctx.arc(t.x, t.y, this.radius * 0.4 * (i / this.trail.length), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.trail}, ${t.alpha * 0.3})`;
      ctx.fill();
    }

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    const sx = 1 - this.squish;
    const sy = 1 + this.squish;
    ctx.scale(sx, sy);

    const r = this.radius;

    // 身体 Body（颜色随鸟种）
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = p.body;
    ctx.fill();
    ctx.strokeStyle = p.bodyDark;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 肚皮 Belly
    ctx.beginPath();
    ctx.ellipse(2, 5, r * 0.6, r * 0.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = p.belly;
    ctx.fill();

    // 眼睛 Eyes
    const eyeY = -4;
    const eyeOffset = 5;

    // 左眼 Left eye
    ctx.beginPath();
    ctx.arc(-eyeOffset, eyeY, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    // 右眼 Right eye
    ctx.beginPath();
    ctx.arc(eyeOffset, eyeY, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    if (!this.blinking) {
      // 瞳孔 Pupils
      ctx.beginPath();
      ctx.arc(-eyeOffset + 1, eyeY, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#212121';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(eyeOffset + 1, eyeY, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#212121';
      ctx.fill();
    } else {
      // 眨眼线条 Blink lines
      ctx.strokeStyle = '#212121';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-eyeOffset - 3, eyeY);
      ctx.lineTo(-eyeOffset + 3, eyeY);
      ctx.moveTo(eyeOffset - 3, eyeY);
      ctx.lineTo(eyeOffset + 3, eyeY);
      ctx.stroke();
    }

    // （原创海洋题材：河豚——无喙无怒眉，与鸟类形象彻底区分）

    // 尾鳍 Tail fin（背部，随飞行方向摆动）
    ctx.beginPath();
    ctx.moveTo(-r + 2, 0);
    ctx.quadraticCurveTo(-r - 9, -7, -r - 7, -1);
    ctx.quadraticCurveTo(-r - 9, 5, -r + 2, 5);
    ctx.closePath();
    ctx.fillStyle = p.bodyDark;
    ctx.fill();

    // 嘟嘴 Puckered lips（河豚标志性圆嘴，朝飞行方向）
    ctx.beginPath();
    ctx.arc(r + 1, 3, 4, 0, Math.PI * 2);
    ctx.fillStyle = C.COLORS.birdBeak;
    ctx.fill();
    ctx.strokeStyle = C.COLORS.birdBeakDark;
    ctx.lineWidth = 1;
    ctx.stroke();
    // 唇心
    ctx.beginPath();
    ctx.arc(r + 2, 3, 1.6, 0, Math.PI * 2);
    ctx.fillStyle = C.COLORS.birdBeakDark;
    ctx.fill();

    // 头顶背刺（河豚特征，按种类变色）
    this.drawCrest(ctx, r);

    // 梭梭：后掠鳍纹（速度感，原创）
    if (this.type === 'dash') {
      ctx.strokeStyle = p.bodyDark;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, -r * 0.55);
      ctx.lineTo(-r * 0.95, -r * 0.4);
      ctx.moveTo(-r * 0.62, -r * 0.2);
      ctx.lineTo(-r * 1.0, -r * 0.1);
      ctx.stroke();
    }

    // 砰砰：礁石斑纹（厚重感，原创）
    if (this.type === 'bomb') {
      ctx.strokeStyle = p.bodyDark;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-r * 0.6, -r * 0.5);
      ctx.lineTo(-r * 0.3, -r * 0.2);
      ctx.lineTo(-r * 0.55, r * 0.05);
      ctx.moveTo(-r * 0.7, r * 0.35);
      ctx.lineTo(-r * 0.4, r * 0.55);
      ctx.stroke();
    }

    // 三丸子：腰间三瓣鳍纹（分裂意象，原创）
    if (this.type === 'split') {
      ctx.strokeStyle = p.bodyDark;
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-r * 0.55, r * 0.15);
      ctx.lineTo(-r * 0.25, r * 0.35);
      ctx.moveTo(-r * 0.6, r * 0.35);
      ctx.lineTo(-r * 0.3, r * 0.55);
      ctx.stroke();
    }

    ctx.restore();
  }

  /** 背刺绘制：沿头顶弧线排布 5 根小三角刺，单种纯色、多种颜色循环（如三丸子三色刺） */
  drawCrest(ctx, r) {
    const colors = this.props.crest;
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.42; // 顶部扇形排布
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const bw = 0.13; // 刺底半宽（弧度）
      ctx.beginPath();
      ctx.moveTo(Math.cos(a - bw) * r * 0.96, Math.sin(a - bw) * r * 0.96);
      ctx.lineTo(ca * (r + 5), sa * (r + 5));
      ctx.lineTo(Math.cos(a + bw) * r * 0.96, Math.sin(a + bw) * r * 0.96);
      ctx.closePath();
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();
    }
  }
}

/**
 * 迷你河豚图标（候飞队列 / HUD / 结算剩豚奖励用），颜色随种类。
 * 独立函数避免为画图标而实例化 Bird。
 */
function drawBirdMini(ctx, x, y, r, type) {
  const p = C.BIRD_TYPES[type] || C.BIRD_TYPES.normal;
  ctx.save();
  ctx.translate(x, y);

  // 背刺（3 根小三角，迷你尺寸简化）
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + (i - 1) * 0.5;
    const bw = 0.16;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a - bw) * r * 0.95, Math.sin(a - bw) * r * 0.95);
    ctx.lineTo(Math.cos(a) * (r + 3.5), Math.sin(a) * (r + 3.5));
    ctx.lineTo(Math.cos(a + bw) * r * 0.95, Math.sin(a + bw) * r * 0.95);
    ctx.closePath();
    ctx.fillStyle = p.crest[i % p.crest.length];
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = p.body;
  ctx.fill();
  ctx.strokeStyle = p.bodyDark;
  ctx.lineWidth = 1;
  ctx.stroke();

  // 眼睛
  ctx.beginPath();
  ctx.arc(-r * 0.2, -r * 0.15, r * 0.22, 0, Math.PI * 2);
  ctx.arc(r * 0.25, -r * 0.15, r * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = '#FFF';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-r * 0.18, -r * 0.15, r * 0.1, 0, Math.PI * 2);
  ctx.arc(r * 0.27, -r * 0.15, r * 0.1, 0, Math.PI * 2);
  ctx.fillStyle = '#212121';
  ctx.fill();

  // 嘟嘴（小圆点）
  ctx.beginPath();
  ctx.arc(r * 0.82, r * 0.2, r * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = C.COLORS.birdBeak;
  ctx.fill();

  ctx.restore();
}

// ========== 章鱼怪 Octopus（类名 Pig 保留，题材已迁移为海洋） ==========

class Pig {
  constructor(x, y, radius = 22) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = radius;
    this.maxHealth = radius > 26 ? 3 : radius > 20 ? 2 : 1;
    this.health = this.maxHealth;
    this.alive = true;
    this.dynamic = false;
    this.squish = 0;
    this.stillFrames = 0;
    this.deathTimer = 0;
    this.dying = false;
    this.hurtFlash = 0;
    this.blinkTimer = U.randomInt(0, 100);
    this.blinking = false;
    this.rotation = 0;
  }

  update() {
    if (this.dying) {
      this.deathTimer++;
      this.radius *= 1.03;
      return;
    }

    if (this.hurtFlash > 0) this.hurtFlash--;
    this.squish *= 0.85;

    if (this.dynamic) {
      this.vy += C.GRAVITY;
      this.vx *= 0.98;
      this.x += this.vx;
      this.y += this.vy;

      // 地面碰撞
      if (this.y + this.radius > C.GROUND_Y) {
        this.y = C.GROUND_Y - this.radius;
        this.vy = -this.vy * C.GROUND_BOUNCE;
        this.vx *= 0.6;
        if (Math.abs(this.vy) < 1) {
          this.vy = 0;
          this.dynamic = false;
        }
      }

      const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
      if (speed < C.REST_THRESHOLD) {
        this.stillFrames++;
        if (this.stillFrames > 30) {
          this.dynamic = false;
          this.vx = 0;
          this.vy = 0;
        }
      } else {
        this.stillFrames = 0;
      }
    }

    // 眨眼
    this.blinkTimer++;
    if (this.blinkTimer > 150 + Math.random() * 100) {
      this.blinking = true;
      this.blinkTimer = 0;
    }
    if (this.blinking && this.blinkTimer > 6) {
      this.blinking = false;
    }
  }

  takeDamage(force) {
    if (this.dying) return false;
    if (force > 4) {
      this.health--;
      this.hurtFlash = 8;
      this.squish = 0.3;
      if (this.health <= 0) {
        this.dying = true;
        return true; // killed
      }
    }
    return false;
  }

  knockback(vx, vy) {
    this.dynamic = true;
    this.vx += vx;
    this.vy += vy;
    this.stillFrames = 0;
  }

  isDead() {
    return this.dying && this.deathTimer > 20;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    if (this.dying) {
      // 死亡动画 - 放大淡出
      ctx.globalAlpha = Math.max(0, 1 - this.deathTimer / 20);
      ctx.scale(1 + this.deathTimer * 0.03, 1 + this.deathTimer * 0.03);
    }

    const sx = 1 - this.squish;
    const sy = 1 + this.squish;
    ctx.scale(sx, sy);

    const r = this.radius;

    // 身体 Body
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    const bodyColor = this.hurtFlash > 0 ? '#FFEB3B' : C.COLORS.pigBody;
    ctx.fillStyle = bodyColor;
    ctx.fill();
    ctx.strokeStyle = C.COLORS.pigBodyDark;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 头顶卷触手 Curled tentacle（章鱼特征，螺旋卷 + 吸盘尖）
    ctx.strokeStyle = C.COLORS.pigBodyDark;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(1, -r - 4, 5, Math.PI * 0.6, Math.PI * 2.2); // 螺旋卷
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(6, -r - 6.5, 2.5, 0, Math.PI * 2); // 吸盘尖
    ctx.fillStyle = this.hurtFlash > 0 ? '#FFF176' : C.COLORS.pigSnout;
    ctx.fill();

    // 底部小触手 Bottom tentacles（4 个半圆小足，贴身体下缘）
    for (let i = 0; i < 4; i++) {
      const tx = (-0.55 + i * 0.37) * r;
      const ty = r * 0.82;
      ctx.beginPath();
      ctx.arc(tx, ty, r * 0.16, 0, Math.PI * 2);
      ctx.fillStyle = this.hurtFlash > 0 ? '#FFEB3B' : C.COLORS.pigBody;
      ctx.fill();
      ctx.strokeStyle = C.COLORS.pigBodyDark;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      // 吸盘点
      ctx.beginPath();
      ctx.arc(tx, ty, r * 0.06, 0, Math.PI * 2);
      ctx.fillStyle = C.COLORS.pigSnout;
      ctx.fill();
    }

    // 嘴巴 Mouth（ω 形坏笑，章鱼赖皮相）
    ctx.strokeStyle = C.COLORS.pigBodyDark;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(-r * 0.13, r * 0.08, r * 0.13, Math.PI * 0.1, Math.PI * 0.95);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(r * 0.13, r * 0.08, r * 0.13, Math.PI * 0.05, Math.PI * 0.9);
    ctx.stroke();

    // 眼睛 Eyes
    const eyeY = -r * 0.2;
    const eyeOffset = r * 0.3;

    if (!this.blinking) {
      ctx.beginPath();
      ctx.arc(-eyeOffset, eyeY, r * 0.18, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(eyeOffset, eyeY, r * 0.18, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(-eyeOffset + 1, eyeY, r * 0.09, 0, Math.PI * 2);
      ctx.fillStyle = '#212121';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(eyeOffset + 1, eyeY, r * 0.09, 0, Math.PI * 2);
      ctx.fillStyle = '#212121';
      ctx.fill();
    } else {
      ctx.strokeStyle = '#212121';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-eyeOffset - r * 0.12, eyeY);
      ctx.lineTo(-eyeOffset + r * 0.12, eyeY);
      ctx.moveTo(eyeOffset - r * 0.12, eyeY);
      ctx.lineTo(eyeOffset + r * 0.12, eyeY);
      ctx.stroke();
    }

    // 受伤裂纹 Damage cracks
    if (this.health < this.maxHealth && !this.dying) {
      ctx.strokeStyle = C.COLORS.pigBodyDark;
      ctx.lineWidth = 1;
      const cracks = this.maxHealth - this.health;
      for (let i = 0; i < cracks; i++) {
        const a = (i / cracks) * Math.PI * 2 + Math.PI / 4;
        const r1 = r * 0.5;
        const r2 = r * 0.85;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
        ctx.lineTo(Math.cos(a + 0.2) * r2, Math.sin(a + 0.2) * r2);
        ctx.stroke();
      }
    }

    ctx.restore();
  }
}

// ========== 方块 Block ==========

class Block {
  constructor(x, y, width, height, type = 'wood') {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.type = type;
    this.props = C.BLOCK_TYPES[type];
    this.maxHealth = this.props.health;
    this.health = this.maxHealth;
    this.vx = 0;
    this.vy = 0;
    this.dynamic = false;
    this.alive = true;
    this.rotation = 0;
    this.angularVelocity = 0;
    this.stillFrames = 0;
    this.cracks = [];
    this.shake = 0;
  }

  update() {
    if (this.shake > 0) this.shake *= 0.9;

    if (!this.dynamic) return;

    this.vy += C.GRAVITY;
    this.vx *= 0.98;
    this.angularVelocity *= 0.97;

    this.x += this.vx;
    this.y += this.vy;
    this.rotation += this.angularVelocity;

    // 地面碰撞
    if (this.y + this.height > C.GROUND_Y) {
      this.y = C.GROUND_Y - this.height;
      if (Math.abs(this.vy) > 1) {
        this.vy = -this.vy * C.GROUND_BOUNCE;
      } else {
        this.vy = 0;
      }
      this.vx *= 0.5;
      this.angularVelocity *= 0.3;
    }

    // 边界
    if (this.x < 0) {
      this.x = 0;
      this.vx = -this.vx * 0.3;
    }
    if (this.x + this.width > C.SCREEN_WIDTH) {
      this.x = C.SCREEN_WIDTH - this.width;
      this.vx = -this.vx * 0.3;
    }

    // 静止检测
    const speed = Math.abs(this.vx) + Math.abs(this.vy);
    if (speed < C.REST_THRESHOLD && Math.abs(this.angularVelocity) < 0.01) {
      this.stillFrames++;
      if (this.stillFrames > 20) {
        this.dynamic = false;
        this.vx = 0;
        this.vy = 0;
        this.angularVelocity = 0;
      }
    } else {
      this.stillFrames = 0;
    }
  }

  takeDamage(force) {
    if (!this.alive) return false;
    if (force > 3) {
      this.health -= Math.floor(force / 4);
      this.shake = 0.5;
      // 添加裂纹
      this.cracks.push({
        x1: U.random(0.2, 0.8) * this.width,
        y1: U.random(0.2, 0.8) * this.height,
        x2: U.random(0, 1) * this.width,
        y2: U.random(0, 1) * this.height,
      });
      if (this.health <= 0) {
        this.alive = false;
        return true; // destroyed
      }
    }
    return false;
  }

  knockback(vx, vy, pointX, pointY) {
    this.dynamic = true;
    this.vx += vx;
    this.vy += vy;
    // 根据击中位置添加旋转
    const centerX = this.x + this.width / 2;
    const centerY = this.y + this.height / 2;
    const offset = (pointX - centerX) / (this.width / 2);
    this.angularVelocity += offset * 0.05 * Math.abs(vx);
    this.stillFrames = 0;
  }

  // 碰撞检测直接使用本对象的 {x, y, width, height, rotation}，
  // 由 utils.js 的 circleOBB / obbObb（SAT）按真实朝向计算。

  draw(ctx) {
    if (!this.alive) return;

    ctx.save();

    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;

    ctx.translate(cx, cy);
    ctx.rotate(this.rotation);

    if (this.shake > 0) {
      ctx.translate(U.random(-this.shake, this.shake), U.random(-this.shake, this.shake));
    }

    const w = this.width;
    const h = this.height;
    const p = this.props;

    // 爆裂果：圆形浆果造型（原创表达：果身 + 叶子 + 果粉斑点，无炸药桶元素）
    if (this.type === 'burst') {
      const r = Math.min(w, h) / 2;
      // 果身
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.strokeStyle = p.colorDark;
      ctx.lineWidth = 2;
      ctx.stroke();
      // 叶子
      ctx.fillStyle = '#7CB342';
      ctx.beginPath();
      ctx.ellipse(2, -r - 2, 5, 2.5, -0.5, 0, Math.PI * 2);
      ctx.fill();
      // 果粉斑点
      ctx.fillStyle = p.colorLight;
      const dots = [[-r * 0.35, -r * 0.1], [r * 0.2, r * 0.25], [r * 0.05, -r * 0.4]];
      for (const d of dots) {
        ctx.beginPath();
        ctx.arc(d[0], d[1], r * 0.12, 0, Math.PI * 2);
        ctx.fill();
      }
      // 星形高光
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.arc(-r * 0.3, -r * 0.35, r * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    // 主体
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.rect(-w / 2, -h / 2, w, h);
    ctx.fill();

    // 边框
    ctx.strokeStyle = p.colorDark;
    ctx.lineWidth = 2;
    ctx.stroke();

    // 材质纹理
    if (this.type === 'wood') {
      // 木纹
      ctx.strokeStyle = p.colorDark;
      ctx.lineWidth = 0.8;
      const grainCount = Math.max(2, Math.floor(h / 12));
      for (let i = 1; i < grainCount; i++) {
        const gy = -h / 2 + (h / grainCount) * i;
        ctx.beginPath();
        ctx.moveTo(-w / 2 + 3, gy);
        ctx.lineTo(w / 2 - 3, gy);
        ctx.stroke();
      }
    } else if (this.type === 'stone') {
      // 石头斑点
      ctx.fillStyle = p.colorDark;
      const spotCount = Math.max(3, Math.floor((w * h) / 400));
      for (let i = 0; i < spotCount; i++) {
        const sx = U.random(-w / 2 + 4, w / 2 - 4);
        const sy = U.random(-h / 2 + 4, h / 2 - 4);
        const sr = U.random(1, 2.5);
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (this.type === 'ice') {
      // 冰块反光
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.moveTo(-w / 2 + 3, -h / 2 + 3);
      ctx.lineTo(-w / 2 + w * 0.3, -h / 2 + 3);
      ctx.lineTo(-w / 2 + 3, -h / 2 + h * 0.3);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = p.colorLight;
      ctx.beginPath();
      ctx.moveTo(-w / 2 + 2, -h / 2 + 2);
      ctx.lineTo(w / 2 - 2, -h / 2 + 2);
      ctx.lineTo(w / 2 - 2, -h / 2 + 4);
      ctx.lineTo(-w / 2 + 2, -h / 2 + 4);
      ctx.closePath();
      ctx.fill();
    }

    // 裂纹 Cracks
    if (this.cracks.length > 0) {
      ctx.strokeStyle = this.type === 'ice' ? 'rgba(255,255,255,0.7)' : p.colorDark;
      ctx.lineWidth = 1.2;
      for (const crack of this.cracks) {
        ctx.beginPath();
        ctx.moveTo(crack.x1 - w / 2, crack.y1 - h / 2);
        ctx.lineTo(crack.x2 - w / 2, crack.y2 - h / 2);
        ctx.stroke();
      }
    }

    // 高光 Highlight
    ctx.fillStyle = p.colorLight;
    ctx.globalAlpha = 0.3;
    ctx.fillRect(-w / 2 + 2, -h / 2 + 2, w - 4, 2);
    ctx.fillRect(-w / 2 + 2, -h / 2 + 2, 2, h - 4);
    ctx.globalAlpha = 1;

    ctx.restore();
  }
}

// ========== 粒子 Particle ==========

class Particle {
  constructor(x, y, vx, vy, color, life, size) {
    this.reset(x, y, vx, vy, color, life, size);
  }

  /** 对象池复用：重置全部状态（gravity 为常量，旋转随机化） */
  reset(x, y, vx, vy, color, life, size) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.life = life;
    this.maxLife = life;
    this.size = size;
    this.gravity = 0.15;
    this.rotation = U.random(0, Math.PI * 2);
    this.rotSpeed = U.random(-0.2, 0.2);
  }

  update() {
    this.vy += this.gravity;
    this.vx *= 0.97;
    this.x += this.vx;
    this.y += this.vy;
    this.rotation += this.rotSpeed;
    this.life--;
  }

  isDead() {
    return this.life <= 0;
  }

  draw(ctx) {
    const alpha = this.life / this.maxLife;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    const s = this.size * alpha;
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.restore();
  }
}

// ========== 飘字 FloatingText ==========

class FloatingText {
  constructor(x, y, text, color = '#FFFFFF', size = 20) {
    this.reset(x, y, text, color, size);
  }

  /** 对象池复用：重置全部状态 */
  reset(x, y, text, color = '#FFFFFF', size = 20) {
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color;
    this.size = size;
    this.life = 60;
    this.maxLife = 60;
    this.vy = -1.5;
  }

  update() {
    this.y += this.vy;
    this.vy *= 0.96;
    this.life--;
  }

  isDead() {
    return this.life <= 0;
  }

  draw(ctx) {
    const alpha = this.life / this.maxLife;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `bold ${this.size}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillText(this.text, this.x + 2, this.y + 2);
    ctx.fillStyle = this.color;
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
}

// ========== 按钮 Button ==========

class Button {
  constructor(x, y, width, height, text, color) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.text = text;
    this.color = color || C.COLORS.buttonBg;
    this.pressed = false;
    this.scale = 1;
  }

  contains(px, py) {
    return U.pointInRect(px, py, this);
  }

  update() {
    this.scale += ((this.pressed ? 0.95 : 1) - this.scale) * 0.2;
  }

  draw(ctx) {
    ctx.save();
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    ctx.translate(cx, cy);
    ctx.scale(this.scale, this.scale);

    // 阴影
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    U.roundRectPath(ctx, -this.width / 2 + 2, -this.height / 2 + 3, this.width, this.height, 12);
    ctx.fill();

    // 按钮主体
    ctx.fillStyle = this.color;
    ctx.beginPath();
    U.roundRectPath(ctx, -this.width / 2, -this.height / 2, this.width, this.height, 12);
    ctx.fill();

    // 高光
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    U.roundRectPath(ctx, -this.width / 2 + 3, -this.height / 2 + 3, this.width - 6, this.height / 2 - 3, 10);
    ctx.fill();

    // 文字
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.text, 0, 1);

    ctx.restore();
  }
}

// ========== 云朵 Cloud ==========

class Cloud {
  constructor(x, y, scale) {
    this.x = x;
    this.y = y;
    this.scale = scale;
    this.speed = 0.15 * scale;
  }

  update() {
    this.x += this.speed;
    if (this.x > C.SCREEN_WIDTH + 80) {
      this.x = -80;
      this.y = U.random(30, C.SCREEN_HEIGHT * 0.35);
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.scale, this.scale);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';

    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.arc(20, -5, 22, 0, Math.PI * 2);
    ctx.arc(42, 0, 18, 0, Math.PI * 2);
    ctx.arc(20, 8, 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

module.exports = {
  Bird,
  Pig,
  Block,
  Particle,
  FloatingText,
  Button,
  Cloud,
  drawBirdMini,
};
