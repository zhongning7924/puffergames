/**
 * 世界渲染模块 - 背景/地面/弹弓/弹道/HUD 等游戏世界内绘制
 * Renderer - in-world drawing (background, slingshot, trajectory, HUD).
 *
 * 从 game.js 拆出（纯搬移，不改行为）。
 * 约定：每个函数以 game 实例为第一个参数；界面类绘制在 screens.js。
 */

const C = require('./config.js');
const E = require('./entities.js');

// ===== 静态背景（天空/远山/地面不随帧变化，渲到离屏 canvas 每帧 blit） =====

function drawSky(ctx) {
  const grad = ctx.createLinearGradient(0, 0, 0, C.GROUND_Y);
  grad.addColorStop(0, C.COLORS.skyTop);
  grad.addColorStop(1, C.COLORS.skyBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, C.SCREEN_WIDTH, C.SCREEN_HEIGHT);
}

function drawMountains(ctx) {
  ctx.fillStyle = 'rgba(129, 199, 132, 0.4)';
  ctx.beginPath();
  ctx.moveTo(0, C.GROUND_Y);
  ctx.quadraticCurveTo(C.SCREEN_WIDTH * 0.15, C.GROUND_Y - 60, C.SCREEN_WIDTH * 0.3, C.GROUND_Y);
  ctx.quadraticCurveTo(C.SCREEN_WIDTH * 0.45, C.GROUND_Y - 45, C.SCREEN_WIDTH * 0.6, C.GROUND_Y);
  ctx.quadraticCurveTo(C.SCREEN_WIDTH * 0.8, C.GROUND_Y - 70, C.SCREEN_WIDTH, C.GROUND_Y);
  ctx.lineTo(C.SCREEN_WIDTH, C.GROUND_Y);
  ctx.closePath();
  ctx.fill();
}

/**
 * 初始化静态背景离屏缓存（启动时调用一次）。
 * 微信语义：wx.createCanvas() 首次返回上屏画布，之后返回离屏画布；
 * 若拿到的仍是主画布（浏览器预览 mock）则放弃缓存，走逐帧直绘兜底。
 */
function initBackgroundCache(game) {
  try {
    const bg = wx.createCanvas();
    if (!bg || bg === game.canvas) {
      game.bgCanvas = null;
      return;
    }
    bg.width = C.SCREEN_WIDTH * C.DPR;
    bg.height = C.SCREEN_HEIGHT * C.DPR;
    const bctx = bg.getContext('2d');
    if (!bctx) {
      game.bgCanvas = null;
      return;
    }
    bctx.scale(C.DPR, C.DPR);
    drawSky(bctx);
    drawMountains(bctx);
    drawGround(bctx);
    game.bgCanvas = bg;
  } catch (e) {
    game.bgCanvas = null;
  }
}

function drawBackground(game) {
  const ctx = game.ctx;
  if (game.bgCanvas) {
    // 一帧 blit 替代全量矢量重绘
    ctx.drawImage(game.bgCanvas, 0, 0, C.SCREEN_WIDTH, C.SCREEN_HEIGHT);
  } else {
    drawSky(ctx);
    drawMountains(ctx);
    drawGround(ctx);
  }
  // 云朵是动态的，不进缓存，逐帧绘制
  for (const cloud of game.clouds) cloud.draw(ctx);
}

function drawGround(ctx) {
  // 草地
  ctx.fillStyle = C.COLORS.grass;
  ctx.fillRect(0, C.GROUND_Y, C.SCREEN_WIDTH, C.GROUND_HEIGHT);

  // 草地顶部亮线
  ctx.fillStyle = C.COLORS.grassDark;
  ctx.fillRect(0, C.GROUND_Y, C.SCREEN_WIDTH, 4);

  // 草纹理
  ctx.strokeStyle = C.COLORS.grassDark;
  ctx.lineWidth = 1;
  for (let x = 0; x < C.SCREEN_WIDTH; x += 8) {
    const h = 3 + Math.sin(x * 0.5) * 2;
    ctx.beginPath();
    ctx.moveTo(x, C.GROUND_Y);
    ctx.lineTo(x + 1, C.GROUND_Y - h);
    ctx.stroke();
  }

  // 泥土
  ctx.fillStyle = C.COLORS.dirt;
  ctx.fillRect(0, C.GROUND_Y + 20, C.SCREEN_WIDTH, C.GROUND_HEIGHT - 20);

  // 泥土纹理
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  for (let i = 0; i < 20; i++) {
    const x = (i * 37) % C.SCREEN_WIDTH;
    const y = C.GROUND_Y + 30 + (i * 13) % (C.GROUND_HEIGHT - 30);
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawWaitingBirds(game) {
  const ctx = game.ctx;
  // 倒序绘制：后排（站高处）先画、前排压在上面，符合遮挡关系；
  // 数组顺序即站位顺序（i 越大 y 越小），倒序恰好是 y 从小到大。
  for (let i = game.birds.length - 1; i >= 0; i--) {
    const bird = game.birds[i];
    // 候飞队列按鸟种着色（身体/彩冠来自该鸟种的原创配色）
    E.drawBirdMini(ctx, bird.x, bird.y, bird.radius * 0.85, bird.type);
  }
}

function drawSlingshotBack(game) {
  const ctx = game.ctx;
  const sx = C.SLINGSHOT_X;
  const sy = C.GROUND_Y;
  const topY = C.SLINGSHOT_Y;
  const forkOffset = 16;

  // 左叉（后）
  ctx.strokeStyle = C.COLORS.slingWood;
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(sx, topY);
  ctx.lineTo(sx - forkOffset, topY - 12);
  ctx.stroke();

  // 橡皮筋 - 后（从左叉到小鸟）
  if (game.currentBird && (game.state === 'READY' || game.state === 'AIMING')) {
    ctx.strokeStyle = C.COLORS.slingBand;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(sx - forkOffset, topY - 12);
    ctx.lineTo(game.currentBird.x - 5, game.currentBird.y);
    ctx.stroke();
  }
}

function drawSlingshotFront(game) {
  const ctx = game.ctx;
  const sx = C.SLINGSHOT_X;
  const topY = C.SLINGSHOT_Y;
  const forkOffset = 16;

  // 橡皮筋 - 前（从右叉到小鸟）
  if (game.currentBird && (game.state === 'READY' || game.state === 'AIMING')) {
    ctx.strokeStyle = C.COLORS.slingBand;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(sx + forkOffset, topY - 12);
    ctx.lineTo(game.currentBird.x + 5, game.currentBird.y);
    ctx.stroke();
  }

  // 右叉（前）
  ctx.strokeStyle = C.COLORS.slingWoodLight;
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(sx, topY);
  ctx.lineTo(sx + forkOffset, topY - 12);
  ctx.stroke();
}

/** 上一发完整弹道残影（原版同款学习工具：发射下一只前保留白点轨迹，便于修正瞄准） */
function drawLastTrail(game) {
  if (!game.lastTrail || game.lastTrail.length === 0) return;
  const ctx = game.ctx;
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  for (let i = 0; i < game.lastTrail.length; i += 2) {
    const p = game.lastTrail[i];
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** 场景珍珠（只画未拾取的；已入库的不再出现，保持隐藏探索的一次性） */
function drawPearls(game) {
  const ctx = game.ctx;
  for (const p of game.pearls) {
    if (!p.collected) E.drawPearl(ctx, p.x, p.y, 9, game.frameCount);
  }
}

function drawTrajectory(game) {
  if (!game.currentBird) return;
  const ctx = game.ctx;

  const dx = C.SLINGSHOT_X - game.currentBird.x;
  const dy = (C.SLINGSHOT_Y - 15) - game.currentBird.y;
  const vx = dx * C.POWER_FACTOR;
  const vy = dy * C.POWER_FACTOR;

  const level = game.getCurrentLevel();
  const points = game.calculateTrajectory(
    game.currentBird.x,
    game.currentBird.y,
    vx,
    vy,
    game.trajectoryBoost ? 70 : (level.trajectory || 70)
  );

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const size = 4 * (1 - i / points.length) + 1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha * 0.7})`;
    ctx.fill();
  }
}

function drawUI(game) {
  const ctx = game.ctx;

  if (game.state === 'MENU' || game.state === 'LEVEL_SELECT' ||
      game.state === 'LEADERBOARD' || game.state === 'SETTINGS') return;

  // 顶栏背景
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(0, 0, C.SCREEN_WIDTH, 40);

  // 分数
  ctx.font = 'bold 18px Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillText('得分: ' + game.score, 14, 22);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('得分: ' + game.score, 13, 21);

  // 关卡名（带风味名时合并显示，字号收窄避免与左侧得分重叠）
  const level = game.getCurrentLevel();
  const levelLabel = level.flavor ? `${level.name}·${level.flavor}` : level.name;
  ctx.font = level.flavor ? 'bold 15px Arial' : 'bold 18px Arial';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillText(levelLabel, C.SCREEN_WIDTH / 2 + 1, 22);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(levelLabel, C.SCREEN_WIDTH / 2, 21);

  // 剩余小鸟图标（按候飞队列实际鸟种着色，最右为下一只上场）
  const birdIconX = C.SCREEN_WIDTH - 14;
  for (let i = 0; i < game.birds.length; i++) {
    const bx = birdIconX - (game.birds.length - 1 - i) * 22;
    E.drawBirdMini(ctx, bx, 21, 7, game.birds[i].type);
  }

  // 当前小鸟信息（名字 + 技能提示）
  if (game.currentBird && (game.state === 'READY' || game.state === 'AIMING')) {
    const p = game.currentBird.props;
    ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    const label = p.ability ? `${p.name} · 空中点击放技能` : p.name;
    ctx.fillText(label, C.SLINGSHOT_X + 1, C.GROUND_Y - 139);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(label, C.SLINGSHOT_X, C.GROUND_Y - 140);
  }

  // 飞行中技能可释放提示
  if (game.state === 'FLYING' && game.currentBird && game.currentBird.canUseAbility()) {
    ctx.font = 'bold 15px Arial';
    ctx.textAlign = 'center';
    const blink = 0.6 + Math.sin(game.frameCount * 0.15) * 0.4;
    ctx.fillStyle = `rgba(255,255,255,${blink})`;
    ctx.fillText('点击屏幕释放技能！', C.SCREEN_WIDTH / 2, 70);
  }

  // 提示文字（第 1 关拖拽教学 / 技能关首通的技能教学，文案由 game.hintText 提供）
  if (game.hintAlpha > 0.01 && game.state === 'READY') {
    const hintText = game.hintText || '拖动河豚瞄准发射！';
    ctx.globalAlpha = game.hintAlpha;
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillText(hintText, C.SLINGSHOT_X + 80, C.SLINGSHOT_Y - 50);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(hintText, C.SLINGSHOT_X + 79, C.SLINGSHOT_Y - 51);

    // 指向河豚的箭头（仅默认拖拽教学需要；技能教学为纯文字）
    if (!game.hintText) {
      const arrowPulse = Math.sin(game.frameCount * 0.08) * 5;
      ctx.strokeStyle = `rgba(255,255,255,${game.hintAlpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(C.SLINGSHOT_X + 40, C.SLINGSHOT_Y - 40 + arrowPulse);
      ctx.lineTo(C.SLINGSHOT_X + 20, C.SLINGSHOT_Y - 25 + arrowPulse);
      ctx.lineTo(C.SLINGSHOT_X + 28, C.SLINGSHOT_Y - 30 + arrowPulse);
      ctx.moveTo(C.SLINGSHOT_X + 20, C.SLINGSHOT_Y - 25 + arrowPulse);
      ctx.lineTo(C.SLINGSHOT_X + 28, C.SLINGSHOT_Y - 20 + arrowPulse);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

module.exports = {
  initBackgroundCache,
  drawBackground,
  drawLastTrail,
  drawWaitingBirds,
  drawSlingshotBack,
  drawSlingshotFront,
  drawPearls,
  drawTrajectory,
  drawUI,
};
