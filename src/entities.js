/**
 * 游戏实体类 - 河豚、章鱼、方块、粒子、按钮、云朵
 * Game Entities - Bird, Pig, Block, Particle, Button, Bubble
 */

const C = require('./config.js');
const U = require('./utils.js');
const T = require('./theme.js');

// ========== 河豚 Bird ==========

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
    this.puff = 0;         // 愤怒膨胀度 0→1（发射后鼓成刺球，纯视觉）
    this.puffT = 0;        // 膨胀动画帧计数
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
   *  - split：自身偏上偏转，返回 2 只偏转的新豚（调用方负责纳入管理）；
   *  - bomb：仅标记，爆炸效果由 game 层执行（需要访问方块/章鱼/粒子）。
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

    // 愤怒膨胀 Puff：发射后立马鼓成刺球（easeOutBack 带 overshoot，气鼓鼓 Q 弹）
    this.puffT++;
    const pt = Math.min(1, this.puffT / 9);
    this.puff = pt < 1
      ? 1 + 2.70158 * Math.pow(pt - 1, 3) + 1.70158 * Math.pow(pt - 1, 2)
      : 1;

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
    this.puff = 0;     // 发射瞬间从头鼓气
    this.puffT = 0;
  }

  draw(ctx) {
    const p = this.props;

    // 拖尾（颜色随豚种）
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

    // 愤怒膨胀：发射后整体鼓大（纯视觉，物理半径 this.radius 不变），鼓满后带气鼓鼓呼吸
    const breathe = this.puff >= 1 ? 1 + 0.028 * Math.sin(this.puffT * 0.18) : 1;
    const ps = (1 + 0.26 * this.puff) * breathe;
    const sx = (1 - this.squish) * ps;
    const sy = (1 + this.squish) * ps;
    ctx.scale(sx, sy);

    const r = this.radius;

    // 愤怒尖刺：膨胀时全身炸起一圈短棘（刺鲀气鼓鼓）——先画刺再画身体，刺根埋入体内被盖住、只露刺尖
    if (this.puff > 0.02) this.drawPuffSpikes(ctx, r, this.puff);

    // 身体 Body（颜色随豚种）
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

      // 眼神光（主高光 + 右下副高光，二次元大眼的水光感）
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(-eyeOffset + 0.3, eyeY - 0.9, 1.15, 0, Math.PI * 2);
      ctx.arc(eyeOffset + 0.3, eyeY - 0.9, 1.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-eyeOffset + 1.9, eyeY + 1, 0.5, 0, Math.PI * 2);
      ctx.arc(eyeOffset + 1.9, eyeY + 1, 0.5, 0, Math.PI * 2);
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

    // 腮红（眼睛下方两颊，粉扑扑是可爱风的第一信号）
    T.drawBlush(ctx, -eyeOffset - 3.5, eyeY + 6, 3);
    T.drawBlush(ctx, eyeOffset + 3.5, eyeY + 6, 3);

    // （原创海洋题材：河豚——无喙无怒眉，与豚类形象彻底区分）

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

  /** 愤怒尖刺：膨胀态沿全身一圈竖起的短棘（刺鲀炸刺）；跳过正前嘴/正后尾保持五官干净。
   *  刺根半径 base<r 埋进身体圆内，被后画的身体盖住，只露出 r 外的刺尖，天然贴合轮廓。 */
  drawPuffSpikes(ctx, r, puff) {
    const N = 16;
    const len = r * 0.34 * puff;  // 刺长随膨胀竖起
    const base = r * 0.7;         // 刺根半径（< r，被身体圆盖住）
    const halfW = 0.11;           // 刺底半宽（弧度）
    ctx.fillStyle = this.props.bodyDark;
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      if (i === 0 || i === N / 2) continue; // 跳过正前（嘟嘴）/正后（尾鳍）
      const a = (i / N) * Math.PI * 2;
      ctx.moveTo(Math.cos(a - halfW) * base, Math.sin(a - halfW) * base);
      ctx.lineTo(Math.cos(a) * (r + len), Math.sin(a) * (r + len));
      ctx.lineTo(Math.cos(a + halfW) * base, Math.sin(a + halfW) * base);
      ctx.closePath();
    }
    ctx.fill();
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
  // opts: { boss: 章王, hp: 自定义血量, name: 章王名, sleep: 阶段唤醒标记(1/2) }
  constructor(x, y, radius = 22, opts) {
    opts = opts || {};
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = radius;
    this.isBoss = !!opts.boss;
    this.bossName = opts.name || '';
    this.sleepMark = opts.sleep || 0;   // >0 = 休眠体，在章王第 N 阶段怒吼时唤醒
    this.sleeping = this.sleepMark > 0;
    const defaultHp = radius > 26 ? 3 : radius > 20 ? 2 : 1;
    this.maxHealth = this.isBoss && opts.hp ? opts.hp : defaultHp;
    this.health = this.maxHealth;
    this.alive = true;
    this.dynamic = false;
    this.phase = 0;                    // 章王已触发的怒吼阶段数
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
    if (this.sleeping) return; // 休眠援军/掉落物：冻结在屏幕外，等章王怒吼唤醒
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
    if (this.dying || this.sleeping) return false;
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
    if (this.isBoss || this.sleeping) return; // 章王是巨物不被打飞；休眠体保持冻结
    this.dynamic = true;
    this.vx += vx;
    this.vy += vy;
    this.stillFrames = 0;
  }

  isDead() {
    return this.dying && this.deathTimer > 20;
  }

  draw(ctx) {
    if (this.sleeping) return; // 休眠体在屏幕外，不画
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

    // 身体 Body（章王：深紫重甲色 + 更粗描边，巨物压场）
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    const bodyColor = this.hurtFlash > 0 ? '#FFEB3B'
      : (this.isBoss ? '#8E24AA' : C.COLORS.pigBody);
    ctx.fillStyle = bodyColor;
    ctx.fill();
    ctx.strokeStyle = C.COLORS.pigBodyDark;
    ctx.lineWidth = this.isBoss ? 3.5 : 1.5;
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

      // 眼神光（主高光 + 右下副高光）
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(-eyeOffset + 0.4, eyeY - r * 0.04, r * 0.045, 0, Math.PI * 2);
      ctx.arc(eyeOffset + 0.4, eyeY - r * 0.04, r * 0.045, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-eyeOffset + r * 0.13, eyeY + r * 0.06, r * 0.022, 0, Math.PI * 2);
      ctx.arc(eyeOffset + r * 0.13, eyeY + r * 0.06, r * 0.022, 0, Math.PI * 2);
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

    // 腮红（坏笑也要粉扑扑：凶萌感的来源）
    T.drawBlush(ctx, -eyeOffset - r * 0.14, eyeY + r * 0.24, r * 0.14);
    T.drawBlush(ctx, eyeOffset + r * 0.14, eyeY + r * 0.24, r * 0.14);

    // 受伤裂纹 Damage cracks（章王裂纹更粗，数量随掉血增多）
    if (this.health < this.maxHealth && !this.dying) {
      ctx.strokeStyle = C.COLORS.pigBodyDark;
      ctx.lineWidth = this.isBoss ? 2 : 1;
      const cracks = Math.min(this.maxHealth - this.health, this.isBoss ? 8 : 6);
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

    // 章王装饰：金色王冠 + 怒眉（王的识别符号）
    if (this.isBoss && !this.dying) {
      const crownBase = -r - 3;
      ctx.fillStyle = '#FFD54F';
      ctx.strokeStyle = '#5D4037';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-r * 0.52, crownBase);
      ctx.lineTo(-r * 0.52, crownBase - r * 0.42);
      ctx.lineTo(-r * 0.26, crownBase - r * 0.16);
      ctx.lineTo(0, crownBase - r * 0.52);
      ctx.lineTo(r * 0.26, crownBase - r * 0.16);
      ctx.lineTo(r * 0.52, crownBase - r * 0.42);
      ctx.lineTo(r * 0.52, crownBase);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // 怒眉
      ctx.strokeStyle = '#4A148C';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-r * 0.48, -r * 0.46);
      ctx.lineTo(-r * 0.16, -r * 0.34);
      ctx.moveTo(r * 0.48, -r * 0.46);
      ctx.lineTo(r * 0.16, -r * 0.34);
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ========== 方块 Block ==========

class Block {
  // opts: { sleep: 阶段唤醒标记(1/2)，>0 表示休眠的章王阶段掉落物，预置屏幕外 }
  constructor(x, y, width, height, type = 'wood', opts) {
    opts = opts || {};
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
    this.sleepMark = opts.sleep || 0;
    this.sleeping = this.sleepMark > 0;
    this.rotation = 0;
    this.angularVelocity = 0;
    this.stillFrames = 0;
    this.cracks = [];
    this.shake = 0;
    this.pigContacts = new Set(); // 当前正接触的章鱼：用于碰撞去重（一次持续接触只在撞上瞬间掉一次血，防方块压王碾压）
  }

  update() {
    if (this.sleeping) return; // 休眠掉落物：不受重力，等章王怒吼唤醒
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
    if (!this.alive || this.sleeping) return false;
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
    if (this.sleeping) return; // 休眠体唤醒前不受冲击
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
    if (!this.alive || this.sleeping) return;

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

    // 主体（圆角：马卡龙软糖感；碰撞尺寸不变，视觉圆角半径 4）
    ctx.fillStyle = p.color;
    ctx.beginPath();
    U.roundRectPath(ctx, -w / 2, -h / 2, w, h, 4);
    ctx.fill();

    // 边框（柔色描边，沿用主体圆角路径）
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

    // 高光 Highlight（顶部圆角光头条，跟随主体圆角）
    ctx.fillStyle = p.colorLight;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    U.roundRectPath(ctx, -w / 2 + 2, -h / 2 + 2, w - 4, 3, 1.5);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.restore();
  }
}

// ========== 粒子 Particle ==========

class Particle {
  // shape: 'square'（默认旋转方块）| 'star'（四角星，庆祝/闪光用）
  constructor(x, y, vx, vy, color, life, size, shape) {
    this.reset(x, y, vx, vy, color, life, size, shape);
  }

  /** 对象池复用：重置全部状态（gravity 为常量，旋转随机化；shape 必须显式重置，否则复用粒子会带着旧形状） */
  reset(x, y, vx, vy, color, life, size, shape) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.life = life;
    this.maxLife = life;
    this.size = size;
    this.shape = shape || 'square';
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
    const s = this.size * alpha;
    if (this.shape === 'star') {
      T.drawStar(ctx, 0, 0, s, this.color);
    } else {
      ctx.fillStyle = this.color;
      ctx.fillRect(-s / 2, -s / 2, s, s);
    }
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
  constructor(x, y, width, height, text, color, opts) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.text = text;
    this.color = color || C.COLORS.buttonBg;
    this.pressed = false;
    this.scale = 1;
    this.sketch = !!(opts && opts.sketch);
    this.locked = !!(opts && opts.locked);
    this.radius = (opts && opts.radius) || 12;
    this.fontSize = (opts && opts.fontSize) || Math.max(14, Math.floor(this.height * 0.36));
    this.strokeWidth = (opts && opts.strokeWidth) || 0;
    // 马卡龙主题：按钮无硬描边，果冻质感靠柔投影 + 渐变 + 高光；outlineColor 仅作文字柔影基色
    this.outlineColor = (opts && opts.outlineColor) || '#6D4C57';
    this.shadowOffset = (opts && opts.shadowOffset) || 3;
    this.textOutline = (opts && opts.textOutline) !== false;
  }

  _hexToRgb(hex) {
    const h = hex.replace('#', '');
    const bigint = parseInt(h, 16);
    return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
  }

  _rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(v => {
      const clamped = Math.max(0, Math.min(255, Math.round(v)));
      return clamped.toString(16).padStart(2, '0');
    }).join('');
  }

  _lightenColor(hex, percent) {
    const { r, g, b } = this._hexToRgb(hex);
    const amt = Math.round(2.55 * percent);
    return this._rgbToHex(r + amt, g + amt, b + amt);
  }

  _darkenColor(hex, percent) {
    const { r, g, b } = this._hexToRgb(hex);
    const amt = Math.round(2.55 * percent);
    return this._rgbToHex(r - amt, g - amt, b - amt);
  }

  // 底色是否偏浅（感知亮度 luma）：浅马卡龙底配深粉棕字，饱和深底配白字
  _isLight(hex) {
    const { r, g, b } = this._hexToRgb(hex);
    return 0.299 * r + 0.587 * g + 0.114 * b > 170;
  }

  contains(px, py) {
    return U.pointInRect(px, py, this);
  }

  update() {
    const target = this.pressed ? 0.93 : 1;
    this.scale += (target - this.scale) * 0.22;
  }

  draw(ctx) {
    ctx.save();
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    ctx.translate(cx, cy);
    const s = this.scale;
    ctx.scale(s, s);

    const hw = this.width / 2;
    const hh = this.height / 2;
    const r = this.radius;

    if (this.sketch) {
      // === 马卡龙果冻按钮：柔投影 + 渐变主体 + 弧形高光，无硬描边 ===
      const locked = this.locked;
      const baseColor = locked ? '#B0BEC5' : this.color;
      const sh = this.shadowOffset;

      // 1. 柔和偏移投影（双层粉棕调，按钮靠投影从背景浮起）
      ctx.fillStyle = 'rgba(141,90,110,0.16)';
      ctx.beginPath();
      U.roundRectPath(ctx, -hw + sh + 1, -hh + sh + 1,
        this.width, this.height, r);
      ctx.fill();
      ctx.fillStyle = 'rgba(141,90,110,0.26)';
      ctx.beginPath();
      U.roundRectPath(ctx, -hw + sh, -hh + sh,
        this.width, this.height, r);
      ctx.fill();

      // 2. 主体渐变（从亮到暗，增加立体感）
      const bodyGrad = ctx.createLinearGradient(0, -hh, 0, hh);
      if (locked) {
        bodyGrad.addColorStop(0, '#CFD8DC');
        bodyGrad.addColorStop(1, '#90A4AE');
      } else {
        bodyGrad.addColorStop(0, this._lightenColor(this.color, 20));
        bodyGrad.addColorStop(1, this._darkenColor(this.color, 15));
      }
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      U.roundRectPath(ctx, -hw, -hh, this.width, this.height, r);
      ctx.fill();

      // 3. 顶部高光（弧形渐变，更自然）
      const hiGrad = ctx.createRadialGradient(0, -hh + 4, 2, 0, -hh + 4, this.width * 0.7);
      hiGrad.addColorStop(0, 'rgba(255,255,255,0.7)');
      hiGrad.addColorStop(0.5, 'rgba(255,255,255,0.25)');
      hiGrad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = hiGrad;
      ctx.beginPath();
      U.roundRectPath(ctx, -hw + 2, -hh + 2, this.width - 4, this.height * 0.55, r - 2);
      ctx.fill();

      // 4. 底部阴影（轻微暗化底部边缘）
      const botGrad = ctx.createLinearGradient(0, hh - this.height * 0.35, 0, hh);
      botGrad.addColorStop(0, 'rgba(0,0,0,0)');
      botGrad.addColorStop(1, 'rgba(0,0,0,0.15)');
      ctx.fillStyle = botGrad;
      ctx.beginPath();
      U.roundRectPath(ctx, -hw + 2, hh - this.height * 0.35, this.width - 4, this.height * 0.35 - 2, r - 2);
      ctx.fill();

      // 5. 文字（按底色明暗自动选色 + 柔影：浅底深粉棕字 / 深底白字，替代硬描边）
      ctx.font = `bold ${this.fontSize}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const ty = (this.height * 0.06);
      const onLight = !locked && this._isLight(baseColor);
      if (this.textOutline) {
        ctx.shadowColor = onLight ? 'rgba(255,255,255,0.55)' : 'rgba(109,76,87,0.45)';
        ctx.shadowBlur = 2;
        ctx.shadowOffsetY = 1;
      }
      ctx.fillStyle = locked ? 'rgba(255,255,255,0.6)'
        : (onLight ? '#6D4C57' : '#FFFFFF');
      ctx.fillText(this.text, 0, ty);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    } else {
      // === 原普通样式 ===
      ctx.fillStyle = 'rgba(141,90,110,0.15)';
      ctx.beginPath();
      U.roundRectPath(ctx, -hw + 2, -hh + 3, this.width, this.height, r);
      ctx.fill();

      ctx.fillStyle = this.color;
      ctx.beginPath();
      U.roundRectPath(ctx, -hw, -hh, this.width, this.height, r);
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      U.roundRectPath(ctx, -hw + 3, -hh + 3, this.width - 6, this.height / 2 - 3, r - 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 18px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.text, 0, 1);
    }

    ctx.restore();
  }
}

// ========== 气泡 Bubble ==========

/**
 * 海洋主题化的「云朵」。
 *
 * 决定性的差异不是造型而是运动方向：云向左横飘，气泡向上浮并左右摆动。
 * 只改配色不改方向，眼睛仍会读成"天上有云"；方向一改，水下感立刻成立。
 * 重生位置也相应从「右侧屏幕外」改为「海床附近」。
 */
class Bubble {
  constructor(x, y, scale) {
    this.x = x;
    this.baseX = x;                             // 摆动围绕的基准 x
    this.y = y;
    this.scale = scale;
    this.speed = 0.35 * scale;                  // 上浮速度（比原云朵横飘快，气泡更轻快）
    this.wobblePhase = U.random(0, Math.PI * 2);
    this.wobbleAmp = U.random(4, 11);           // 左右摆动幅度
  }

  update() {
    this.y -= this.speed;
    this.wobblePhase += 0.03;
    this.x = this.baseX + Math.sin(this.wobblePhase) * this.wobbleAmp;

    // 浮出画面顶端后，从海床附近重新冒出
    if (this.y < -20) {
      this.y = C.GROUND_Y - U.random(0, 25);
      this.baseX = U.random(0, C.SCREEN_WIDTH);
    }
  }

  draw(ctx) {
    const r = 9 * this.scale;
    ctx.save();
    ctx.translate(this.x, this.y);

    // 泡体：刻意半透明，能透出背后的水色，才像"充气的泡"而不是"白点"
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 左上高光：气泡的标志性反光，缺了它会被看成普通圆圈
    ctx.beginPath();
    ctx.arc(-r * 0.32, -r * 0.32, r * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fill();

    ctx.restore();
  }
}

/**
 * 珍珠绘制（隐藏收集系统；世界内拾取物与 UI 图标共用）。
 * 白珠身 + 粉色珠光 + 旋转星芒，t 为帧计数（驱动星芒呼吸动画）。
 */
function drawPearl(ctx, x, y, r, t) {
  ctx.save();
  ctx.translate(x, y);

  // 柔光晕（淡粉，与珠身粉描边同系）
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.7, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 224, 235, 0.28)';
  ctx.fill();

  // 珠身（委托 theme 共享画法：白珠 + 淡粉描边 + 左上高光；与弹弓挂饰珍珠同一支笔）
  T.drawPearlBead(ctx, 0, 0, r);

  // 粉色珠光（右下，场景珍珠特有的一层，压在珠身上）
  ctx.beginPath();
  ctx.arc(r * 0.3, r * 0.3, r * 0.45, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(248, 187, 208, 0.5)';
  ctx.fill();

  // 旋转星芒（呼吸感）
  const a = (t || 0) * 0.05;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const ang = a + (i * Math.PI) / 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(ang) * r * 1.15, Math.sin(ang) * r * 1.15);
    ctx.lineTo(Math.cos(ang) * r * 1.55, Math.sin(ang) * r * 1.55);
    ctx.stroke();
  }

  ctx.restore();
}

module.exports = {
  Bird,
  Pig,
  Block,
  Particle,
  FloatingText,
  Button,
  Bubble,
  drawBirdMini,
  drawPearl,
};
