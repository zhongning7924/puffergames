/**
 * 世界渲染模块 - 背景/地面/弹弓/弹道/HUD 等游戏世界内绘制
 * Renderer - in-world drawing (background, slingshot, trajectory, HUD).
 *
 * 从 game.js 拆出（纯搬移，不改行为）。
 * 约定：每个函数以 game 实例为第一个参数；界面类绘制在 screens.js。
 */

const C = require('./config.js');
const U = require('./utils.js');
const E = require('./entities.js');
const T = require('./theme.js');

// ===== 静态背景（天空/远山/地面不随帧变化，渲到离屏 canvas 每帧 blit） =====

/** 水面光柱（丁达尔效应）：从水面向斜下方投下的光带。最强的"在水里"视觉线索。 */
function drawLightRays(ctx) {
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  for (let i = 0; i < 3; i++) {
    const topX = C.SCREEN_WIDTH * (0.18 + i * 0.32);
    const w = C.SCREEN_WIDTH * 0.09;
    const skew = C.SCREEN_WIDTH * 0.13; // 斜射角度
    ctx.beginPath();
    ctx.moveTo(topX, 0);
    ctx.lineTo(topX + w, 0);
    ctx.lineTo(topX + w + skew, C.GROUND_Y);
    ctx.lineTo(topX + skew, C.GROUND_Y);
    ctx.closePath();
    ctx.fill();
  }
}

function drawWater(ctx) {
  const grad = ctx.createLinearGradient(0, 0, 0, C.GROUND_Y);
  grad.addColorStop(0, C.COLORS.waterTop);
  grad.addColorStop(0.55, C.COLORS.waterMid);
  grad.addColorStop(1, C.COLORS.waterDeep);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, C.SCREEN_WIDTH, C.SCREEN_HEIGHT);
  drawLightRays(ctx);
  drawGoldSparkles(ctx);
}

/**
 * 淡金「星粉」光斑：马卡龙海底的梦幻金粉（四角星 + 小圆光斑）。
 * 位置确定性排布（不用随机，截图可复现）；随 drawWater 进离屏缓存，零运行时成本。
 */
function drawGoldSparkles(ctx) {
  const spots = [
    [0.07, 0.10, 3.2], [0.20, 0.30, 2.2], [0.36, 0.08, 2.8], [0.52, 0.22, 2.0],
    [0.66, 0.07, 3.0], [0.82, 0.24, 2.4], [0.93, 0.12, 1.8], [0.14, 0.46, 1.9],
    [0.58, 0.44, 2.2], [0.76, 0.50, 1.8],
  ];
  for (const [fx, fy, r] of spots) {
    const x = C.SCREEN_WIDTH * fx;
    const y = C.GROUND_Y * fy;
    ctx.save();
    ctx.globalAlpha = 0.5;
    T.drawStar(ctx, x, y, r, C.COLORS.sparkleGold);
    ctx.restore();
    // 星旁小圆光斑（星粉的余辉）
    ctx.fillStyle = 'rgba(255,224,130,0.30)';
    ctx.beginPath();
    ctx.arc(x + r * 2.2, y + r * 0.8, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * 远景礁石剪影。
 * 用折线而非二次曲线——山丘是圆滑的，礁石是嶙峋的，
 * 沿用原来的曲线轮廓会一直读作"远处的绿色小山"。
 */
function drawReef(ctx) {
  const gy = C.GROUND_Y;
  const SW = C.SCREEN_WIDTH;
  const ridge = [
    [0.00, 0], [0.06, -34], [0.13, -12], [0.21, -58], [0.29, -22],
    [0.37, -46], [0.45, -10], [0.55, -66], [0.63, -30], [0.71, -50],
    [0.80, -18], [0.88, -40], [0.94, -14], [1.00, 0],
  ];
  ctx.fillStyle = C.COLORS.reef;
  ctx.beginPath();
  ctx.moveTo(0, gy);
  for (let i = 0; i < ridge.length; i++) {
    ctx.lineTo(SW * ridge[i][0], gy + ridge[i][1]);
  }
  ctx.lineTo(SW, gy);
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
    drawWater(bctx);
    drawReef(bctx);
    drawSeabed(bctx);
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
    drawWater(ctx);
    drawReef(ctx);
    drawSeabed(ctx);
  }
  // 气泡是动态的，不进缓存，逐帧绘制
  for (const bubble of game.bubbles) bubble.draw(ctx);
}

function drawSeabed(ctx) {
  // 浅沙层
  ctx.fillStyle = C.COLORS.sand;
  ctx.fillRect(0, C.GROUND_Y, C.SCREEN_WIDTH, C.GROUND_HEIGHT);

  // 沙脊线：水体与海床的分界，给弹道落点一个明确的视觉参考
  ctx.fillStyle = C.COLORS.sandDark;
  ctx.fillRect(0, C.GROUND_Y, C.SCREEN_WIDTH, 4);

  // 沙纹：起伏的短脊线。注意画在沙面「内侧」——
  // 原来的草纹理是向上戳出地面的，沙纹不该，否则会读作水草。
  ctx.strokeStyle = C.COLORS.sandDark;
  ctx.lineWidth = 1;
  for (let x = 0; x < C.SCREEN_WIDTH; x += 14) {
    const h = 2 + Math.sin(x * 0.35) * 1.5;
    ctx.beginPath();
    ctx.moveTo(x, C.GROUND_Y + 8);
    ctx.lineTo(x + 5, C.GROUND_Y + 8 - h);
    ctx.stroke();
  }

  // 岩石层
  ctx.fillStyle = C.COLORS.rock;
  ctx.fillRect(0, C.GROUND_Y + 20, C.SCREEN_WIDTH, C.GROUND_HEIGHT - 20);

  // 卵石点缀（沿用原泥土纹理的分布算法，避免改动后画面密度突变）
  ctx.fillStyle = 'rgba(0,0,0,0.14)';
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
  // READY 且队列里有多种豚时，候飞区可点击换豚（自由规划出豚顺序）
  const types = new Set();
  if (game.currentBird) types.add(game.currentBird.type);
  for (const b of game.birds) types.add(b.type);
  const canSwap = game.state === 'READY' && types.size > 1;

  // 倒序绘制：后排（站高处）先画、前排压在上面，符合遮挡关系；
  // 数组顺序即站位顺序（i 越大 y 越小），倒序恰好是 y 从小到大。
  for (let i = game.birds.length - 1; i >= 0; i--) {
    const bird = game.birds[i];
    let oy = 0;
    if (canSwap) {
      // 轻点浮动（相位错开避免齐摆）+ 脚下圆垫，强化"可点"暗示
      oy = Math.sin(game.frameCount * 0.08 + i * 1.3) * 2;
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.beginPath();
      ctx.arc(bird.x, bird.y + bird.radius * 0.55, bird.radius * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
    // 候飞队列按豚种着色（身体/彩冠来自该豚种的原创配色）
    E.drawBirdMini(ctx, bird.x, bird.y + oy, bird.radius * 0.85, bird.type);
  }

  // 「点我换豚」教学气泡：首次遇到多豚种队列时出现，换过一次（tutSwap）后永久消失
  if (canSwap && !game.progress.tutSwap && game.birds.length > 0) {
    const anchor = game.birds[0];
    const bx = anchor.x - 2;
    const by = anchor.y - 46;
    const label = '点我换豚';
    ctx.save();
    ctx.font = 'bold 12px Arial';
    const w = ctx.measureText(label).width + 20;
    const h = 22;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    U.roundRectPath(ctx, bx - w / 2, by - h / 2, w, h, 11);
    ctx.fill();
    // 气泡小三角（指向候飞区）
    ctx.beginPath();
    ctx.moveTo(bx - 5, by + h / 2 - 2);
    ctx.lineTo(bx + 5, by + h / 2 - 2);
    ctx.lineTo(bx, by + h / 2 + 7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, bx, by + 1);
    ctx.restore();
  }
}

// ===== 珊瑚弹弓（马卡龙主题：粉珊瑚枝叉 + 海丝带领结 + 珍珠挂饰）=====

/**
 * 海丝带：粉底实线 + 白色虚线叠出粉白条纹。
 * setLineDash 必须由调用方/本函数的 save-restore 包裹复位，否则虚线会污染后续所有描边。
 */
function drawRibbon(ctx, x1, y1, x2, y2) {
  T.strokeCute(ctx, 4, C.COLORS.slingBand);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.save();
  ctx.strokeStyle = C.COLORS.ribbonWhite;
  ctx.lineWidth = 1.6;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

/**
 * 枝顶珊瑚虫小凸点：两个小圆球 + 白色高光（珊瑚枝的「虫栖」感）。
 * direction：-1 左叉（凸点偏左）/ +1 右叉（凸点偏右）。
 */
function drawCoralTips(ctx, tipX, tipY, direction) {
  ctx.fillStyle = C.COLORS.slingWoodLight;
  ctx.beginPath();
  ctx.arc(tipX + direction * 2, tipY - 5, 3.4, 0, Math.PI * 2);
  ctx.arc(tipX + direction * 7, tipY - 1, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.beginPath();
  ctx.arc(tipX + direction * 1, tipY - 6, 1.2, 0, Math.PI * 2);
  ctx.arc(tipX + direction * 6.2, tipY - 1.8, 0.9, 0, Math.PI * 2);
  ctx.fill();
}

function drawSlingshotBack(game) {
  const ctx = game.ctx;
  const sx = C.SLINGSHOT_X;
  const sy = C.GROUND_Y;
  const topY = C.SLINGSHOT_Y;
  const forkOffset = 16;
  const tipL = { x: sx - forkOffset, y: topY - 12 };

  // 主干 + 左叉（后层，深珊瑚粉）：折线改二次贝塞尔，圆润弯曲读作珊瑚枝而非木叉
  T.strokeCute(ctx, 11, C.COLORS.slingWood);
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.quadraticCurveTo(sx - 5, sy - 55, sx - 1, topY + 6);
  ctx.quadraticCurveTo(sx - 5, topY - 4, tipL.x, tipL.y);
  ctx.stroke();
  drawCoralTips(ctx, tipL.x, tipL.y, -1);

  // 海丝带 - 后（左叉顶 → 河豚左缘）
  if (game.currentBird && (game.state === 'READY' || game.state === 'AIMING')) {
    drawRibbon(ctx, tipL.x, tipL.y, game.currentBird.x - 5, game.currentBird.y);
  }
}

function drawSlingshotFront(game) {
  const ctx = game.ctx;
  const sx = C.SLINGSHOT_X;
  const topY = C.SLINGSHOT_Y;
  const forkOffset = 16;
  const tipL = { x: sx - forkOffset, y: topY - 12 };
  const tipR = { x: sx + forkOffset, y: topY - 12 };

  // 海丝带 - 前（右叉顶 → 河豚右缘）
  if (game.currentBird && (game.state === 'READY' || game.state === 'AIMING')) {
    drawRibbon(ctx, tipR.x, tipR.y, game.currentBird.x + 5, game.currentBird.y);
  }

  // 发射回弹丝带：slingSnap 8 帧倒计时内，两叉顶间一条抖动衰减的短带（「啪」地回弹）
  if (game.slingSnap > 0) {
    const k = game.slingSnap / 8;
    const wobble = Math.sin(game.frameCount * 1.3) * 7 * k;
    const midY = topY - 12 + 10 * k;
    ctx.save();
    ctx.globalAlpha = 0.55 + k * 0.45;
    T.strokeCute(ctx, 3.5, C.COLORS.slingBand);
    ctx.beginPath();
    ctx.moveTo(tipL.x, tipL.y);
    ctx.quadraticCurveTo(sx + wobble, midY + Math.abs(wobble) * 0.4, tipR.x, tipR.y);
    ctx.stroke();
    ctx.strokeStyle = C.COLORS.ribbonWhite;
    ctx.lineWidth = 1.3;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(tipL.x, tipL.y);
    ctx.quadraticCurveTo(sx + wobble, midY + Math.abs(wobble) * 0.4, tipR.x, tipR.y);
    ctx.stroke();
    ctx.restore();
  }

  // 右叉（前层，浅珊瑚粉）：从主干分叉点弯出，接缝藏在 11px 粗线内
  T.strokeCute(ctx, 11, C.COLORS.slingWoodLight);
  ctx.beginPath();
  ctx.moveTo(sx, topY + 6);
  ctx.quadraticCurveTo(sx + 5, topY - 4, tipR.x, tipR.y);
  ctx.stroke();
  drawCoralTips(ctx, tipR.x, tipR.y, 1);

  // 珍珠蝴蝶结挂饰（叉柄中部，待机随帧轻摆 ±0.05rad）
  const sway = Math.sin(game.frameCount * 0.05) * 0.05;
  ctx.save();
  ctx.translate(sx, topY + 54);
  ctx.rotate(sway);
  T.drawBow(ctx, 0, 0, 9);
  // 挂绳（结心 → 珍珠）
  ctx.strokeStyle = C.COLORS.slingBand;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-3, 7);
  ctx.lineTo(-5, 10);
  ctx.moveTo(3, 7);
  ctx.lineTo(5, 10);
  ctx.stroke();
  T.drawPearlBead(ctx, -5, 13, 3.2);
  T.drawPearlBead(ctx, 5, 13, 3.2);
  ctx.restore();
}

/** 上一发完整弹道残影（学习工具：发射下一只前保留轨迹，便于修正瞄准；与预览弹道同为小气泡） */
function drawLastTrail(game) {
  if (!game.lastTrail || game.lastTrail.length === 0) return;
  const ctx = game.ctx;
  for (let i = 0; i < game.lastTrail.length; i += 2) {
    const p = game.lastTrail[i];
    T.drawBubble(ctx, p.x, p.y, 2.5, 0.35);
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

  // 小气泡弹道（每 5 个点混 1 颗淡金四角星，瞄准线也带「星光」）
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const size = 4 * (1 - i / points.length) + 1;
    if (i % 5 === 2) {
      ctx.save();
      ctx.globalAlpha = p.alpha * 0.85;
      T.drawStar(ctx, p.x, p.y, size + 0.6, C.COLORS.sparkleGold);
      ctx.restore();
    } else {
      T.drawBubble(ctx, p.x, p.y, size, p.alpha * 0.75);
    }
  }
}

/** 章王血条：Boss 关顶栏下方显示名牌 + 血量横条，残血变红脉动 */
function drawBossBar(game) {
  const boss = (game.pigs || []).find(p => p.isBoss && p.alive && !p.dying);
  if (!boss) return;
  const ctx = game.ctx;
  const safeTop = C.SAFE_TOP || 0;
  const w = 196, h = 13;
  const x = (C.SCREEN_WIDTH - w) / 2;
  const y = 48 + safeTop;
  const pct = Math.max(0, boss.health / boss.maxHealth);
  const low = pct < 0.34;

  ctx.save();
  // 名牌
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = boss.bossName || '章王';
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillText(label, C.SCREEN_WIDTH / 2 + 1, y - 10);
  ctx.fillStyle = low ? '#FF8A80' : '#FFD54F';
  ctx.fillText(label, C.SCREEN_WIDTH / 2, y - 11);
  // 血条外框
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  U.roundRectPath(ctx, x - 2, y - 2, w + 4, h + 4, 8);
  ctx.fill();
  ctx.fillStyle = '#8D6E63'; // 槽底：深棕 → 柔奶茶棕
  ctx.beginPath();
  U.roundRectPath(ctx, x, y, w, h, 6);
  ctx.fill();
  // 血量填充（残血草莓红脉动；常态薰衣草紫→珊瑚粉渐变）
  if (pct > 0) {
    ctx.globalAlpha = low ? (0.7 + Math.sin(game.frameCount * 0.2) * 0.3) : 1;
    if (low) {
      ctx.fillStyle = '#FF8A80';
    } else {
      const hpGrad = ctx.createLinearGradient(x, y, x + w, y);
      hpGrad.addColorStop(0, '#CE93D8');
      hpGrad.addColorStop(1, '#F48FB1');
      ctx.fillStyle = hpGrad;
    }
    ctx.beginPath();
    U.roundRectPath(ctx, x, y, Math.max(h, w * pct), h, 6);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawUI(game) {
  const ctx = game.ctx;

  // 编辑器自绘顶栏/底栏，不画战役 HUD；且试玩返回后 currentLevelIndex=-1（playCustom 置），
  // isCustom 已被 enterEditor 复位，此处若继续读 getCurrentLevel() 会取到 levels[-1]=undefined 崩溃
  if (game.state === 'MENU' || game.state === 'LEVEL_SELECT' ||
      game.state === 'LEADERBOARD' || game.state === 'SETTINGS' ||
      game.state === 'EDITOR') return;

  // 顶栏背景（向下延伸盖住安全区，形成状态栏 scrim；内容避开灵动岛/刘海）
  const safeTop = C.SAFE_TOP || 0;
  const hudY = 21 + safeTop;
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(0, 0, C.SCREEN_WIDTH, 40 + safeTop);

  // 分数
  ctx.font = 'bold 15px Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillText('得分: ' + game.score, 14, hudY + 1);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('得分: ' + game.score, 13, hudY);

  // 关卡名（带风味名时合并显示，字号收窄避免与左侧得分重叠）
  const level = game.getCurrentLevel();
  const levelLabel = level.flavor ? `${level.name}·${level.flavor}` : level.name;
  ctx.font = level.flavor ? 'bold 14px Arial' : 'bold 15px Arial';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillText(levelLabel, C.SCREEN_WIDTH / 2 + 1, hudY + 1);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(levelLabel, C.SCREEN_WIDTH / 2, hudY);

  // 剩余河豚图标（按候飞队列实际豚种着色，最右为下一只上场）
  const birdIconX = C.SCREEN_WIDTH - 14;
  for (let i = 0; i < game.birds.length; i++) {
    const bx = birdIconX - (game.birds.length - 1 - i) * 22;
    E.drawBirdMini(ctx, bx, hudY, 7, game.birds[i].type);
  }

  // 章王血条（Boss 关：顶栏下方居中）
  drawBossBar(game);

  // 当前河豚信息（名字 + 技能提示）
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
    ctx.fillText('点击屏幕释放技能！', C.SCREEN_WIDTH / 2, 70 + safeTop);
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
