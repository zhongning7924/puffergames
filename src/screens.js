/**
 * 界面模块 - 菜单/选关/排行榜/胜负结算五个全屏界面
 * Screens - full-screen UIs (menu, level select, leaderboard, win/lose).
 *
 * 从 game.js 拆出（纯搬移，不改行为）。
 * 约定：每个函数以 game 实例为第一个参数；世界内绘制在 renderer.js。
 * 注意：按钮只创建一次（挂在 game.buttons），避免每帧重建丢失按下状态。
 */

const C = require('./config.js');
const U = require('./utils.js');
const E = require('./entities.js');
const AD = require('./ad.js');
const DAILY = require('./daily.js');

function drawMenu(game) {
  const ctx = game.ctx;
  const cx = C.SCREEN_WIDTH / 2;

  // 半透明覆盖
  ctx.fillStyle = 'rgba(33,33,33,0.5)';
  ctx.fillRect(0, 0, C.SCREEN_WIDTH, C.SCREEN_HEIGHT);

  // 标题
  const titleY = C.SCREEN_HEIGHT * 0.3;
  const bounce = Math.sin(game.frameCount * 0.05) * 5;

  // 河豚吉祥物（放在标题上方，避免与长标题文字重叠）
  ctx.save();
  ctx.translate(cx, titleY + bounce - 42);

  // 背刺
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.42;
    const bw = 0.13;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a - bw) * 19, Math.sin(a - bw) * 19);
    ctx.lineTo(Math.cos(a) * 25, Math.sin(a) * 25);
    ctx.lineTo(Math.cos(a + bw) * 19, Math.sin(a + bw) * 19);
    ctx.closePath();
    ctx.fillStyle = '#FF8F00';
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, 0, 20, 0, Math.PI * 2);
  ctx.fillStyle = C.COLORS.birdBody;
  ctx.fill();
  ctx.strokeStyle = C.COLORS.birdBodyDark;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-6, -3, 5, 0, Math.PI * 2);
  ctx.arc(6, -3, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#FFF';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-5, -3, 2.5, 0, Math.PI * 2);
  ctx.arc(7, -3, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = '#212121';
  ctx.fill();
  // 嘟嘴
  ctx.beginPath();
  ctx.arc(21, 3, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = C.COLORS.birdBeak;
  ctx.fill();
  ctx.strokeStyle = C.COLORS.birdBeakDark;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(22, 3, 1.8, 0, Math.PI * 2);
  ctx.fillStyle = C.COLORS.birdBeakDark;
  ctx.fill();
  ctx.restore();

  // 标题文字（新名称更长，字号略减并居中对齐，避免与上方小鸟图标重叠）
  ctx.font = 'bold 34px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 标题阴影
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillText('冲吧！小河豚', cx + 3, titleY + bounce + 3);

  // 标题渐变（河豚黄，海洋题材）
  const titleGrad = ctx.createLinearGradient(0, titleY - 20, 0, titleY + 40);
  titleGrad.addColorStop(0, '#FFD54F');
  titleGrad.addColorStop(1, '#FF8F00');
  ctx.fillStyle = titleGrad;
  ctx.fillText('冲吧！小河豚', cx, titleY + bounce);

  // 开始按钮（仅创建一次，避免每帧重建丢失按下状态）
  const btnW = 160;
  const btnH = 50;
  const btnX = cx - btnW / 2;
  const btnY = C.SCREEN_HEIGHT * 0.5;
  if (!game.buttons.play) {
    game.buttons.play = new E.Button(btnX, btnY, btnW, btnH, '开始游戏', C.COLORS.buttonBg);
  }
  game.buttons.play.draw(ctx);

  // 排行榜入口（好友排行是小游戏留存第一抓手，放主菜单一级入口）
  if (!game.buttons.leaderboard) {
    game.buttons.leaderboard = new E.Button(btnX, btnY + 62, btnW, 42, '好友排行榜', '#07C160');
  }
  game.buttons.leaderboard.draw(ctx);

  // 设置入口（音效/音乐/震动开关）
  if (!game.buttons.settings) {
    game.buttons.settings = new E.Button(btnX, btnY + 116, btnW, 42, '设置', '#5C6BC0');
  }
  game.buttons.settings.draw(ctx);

  // 副标题
  ctx.font = '14px Arial';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText('WeChat Mini Game', cx, C.SCREEN_HEIGHT * 0.5 + 178);

  // 最佳成绩
  let totalStars = 0;
  for (const k in game.progress.stars) totalStars += game.progress.stars[k];
  if (totalStars > 0) {
    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = C.COLORS.starGold;
    ctx.fillText('★ x ' + totalStars, cx, C.SCREEN_HEIGHT * 0.5 + 202);
  }
}

/**
 * 设置界面：音效/音乐/震动三个开关 + 返回。
 * 开关按钮文字与颜色每帧按当前设置刷新（Button 实体属性直接改写，不重建按钮）。
 */
function drawSettings(game) {
  const ctx = game.ctx;
  const cx = C.SCREEN_WIDTH / 2;

  // 半透明覆盖
  ctx.fillStyle = 'rgba(33,33,33,0.6)';
  ctx.fillRect(0, 0, C.SCREEN_WIDTH, C.SCREEN_HEIGHT);

  // 标题
  ctx.font = 'bold 30px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillText('设置', cx + 2, 122);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('设置', cx, 120);

  // 三个开关（绿=开，灰=关）
  const rows = [
    { key: 'tglSound', label: '音效', on: game.settings.sound },
    { key: 'tglMusic', label: '音乐', on: game.settings.music },
    { key: 'tglVibration', label: '震动', on: game.settings.vibration },
  ];
  const btnW = 200;
  const btnX = cx - btnW / 2;
  rows.forEach((row, i) => {
    if (!game.buttons[row.key]) {
      game.buttons[row.key] = new E.Button(btnX, 180 + i * 62, btnW, 46, '', C.COLORS.buttonBg);
    }
    const btn = game.buttons[row.key];
    btn.text = row.label + '：' + (row.on ? '开' : '关');
    btn.color = row.on ? '#07C160' : '#8A8A8A';
    btn.draw(ctx);
  });

  // 返回
  if (!game.buttons.back) {
    game.buttons.back = new E.Button(cx - 70, 180 + 3 * 62 + 24, 140, 44, '返回', C.COLORS.buttonBg);
  }
  game.buttons.back.draw(ctx);
}

function drawLeaderboard(game) {
  const ctx = game.ctx;
  const cx = C.SCREEN_WIDTH / 2;

  if (game.sharedCanvas) {
    // 绘制开放数据域渲染的好友榜（sharedCanvas 已是全屏尺寸）
    ctx.drawImage(game.sharedCanvas, 0, 0, C.SCREEN_WIDTH, C.SCREEN_HEIGHT);
  } else {
    // 预览/未支持环境降级
    ctx.fillStyle = '#1B2737';
    ctx.fillRect(0, 0, C.SCREEN_WIDTH, C.SCREEN_HEIGHT);
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFD54F';
    ctx.fillText('好友排行榜', cx, 90);
    ctx.font = '15px Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('排行榜需在微信小游戏中查看', cx, C.SCREEN_HEIGHT / 2 - 10);
    ctx.fillText('通关后成绩会自动上传，与好友一较高下', cx, C.SCREEN_HEIGHT / 2 + 20);
  }

  // 返回按钮
  const backW = 120;
  const backH = 42;
  if (!game.buttons.back) {
    game.buttons.back = new E.Button(cx - backW / 2, C.SCREEN_HEIGHT - 76, backW, backH, '返回', '#607D8B');
  }
  game.buttons.back.draw(ctx);
}

function drawLevelSelect(game) {
  const ctx = game.ctx;
  const cx = C.SCREEN_WIDTH / 2;

  // 半透明覆盖
  ctx.fillStyle = 'rgba(33,33,33,0.6)';
  ctx.fillRect(0, 0, C.SCREEN_WIDTH, C.SCREEN_HEIGHT);

  // 标题
  ctx.font = 'bold 28px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillText('选择关卡', cx + 2, 92);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('选择关卡', cx, 90);

  // 关卡按钮 (3列)
  const btnSize = 65;
  const gap = 18;
  const cols = 3;
  const startX = cx - ((cols * btnSize + (cols - 1) * gap) / 2) + btnSize / 2;
  const startY = 150;

  for (let i = 0; i < game.levels.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = startX + col * (btnSize + gap) - btnSize / 2;
    const y = startY + row * (btnSize + gap);
    const unlocked = i < game.progress.unlockedLevels;
    const stars = game.progress.stars[i] || 0;

    if (!game.buttons['level' + i]) {
      game.buttons['level' + i] = new E.Button(x, y, btnSize, btnSize, String(i + 1),
        unlocked ? C.COLORS.buttonBg : '#757575');
    }
    game.buttons['level' + i].draw(ctx);

    // 星级
    if (unlocked && stars > 0) {
      const starY = y + btnSize + 2;
      for (let s = 0; s < 3; s++) {
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillStyle = s < stars ? C.COLORS.starGold : 'rgba(255,255,255,0.2)';
        ctx.fillText('★', x + btnSize / 2 + (s - 1) * 14, starY);
      }
    }

    // 锁图标
    if (!unlocked) {
      ctx.font = '20px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillText('🔒', x + btnSize / 2, y + btnSize / 2 + 2);
    }
  }

  // 每日挑战入口（关卡网格下方）
  const rows = Math.ceil(game.levels.length / cols);
  const dailyW = 200;
  const dailyH = 44;
  const dailyY = startY + rows * (btnSize + gap) + 12;
  if (!game.buttons.daily) {
    game.buttons.daily = new E.Button(cx - dailyW / 2, dailyY, dailyW, dailyH, '每日挑战', '#7E57C2');
  }
  game.buttons.daily.draw(ctx);

  // 今日最佳成绩
  const today = DAILY.todayString();
  if (game.progress.daily && game.progress.daily.date === today) {
    ctx.font = '13px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText('今日最佳: ' + game.progress.daily.best, cx, dailyY + dailyH + 16);
  }

  // 返回按钮
  const backW = 100;
  const backH = 40;
  if (!game.buttons.back) {
    game.buttons.back = new E.Button(cx - backW / 2, C.SCREEN_HEIGHT - 80, backW, backH, '返回', '#607D8B');
  }
  game.buttons.back.draw(ctx);
}

function drawWinScreen(game) {
  const ctx = game.ctx;
  const cx = C.SCREEN_WIDTH / 2;
  const cy = C.SCREEN_HEIGHT / 2;

  // 覆盖层
  ctx.fillStyle = 'rgba(33,33,33,0.7)';
  ctx.fillRect(0, 0, C.SCREEN_WIDTH, C.SCREEN_HEIGHT);

  // 面板
  const panelW = 280;
  const panelH = 400;
  const panelX = cx - panelW / 2;
  const panelY = cy - panelH / 2;
  ctx.fillStyle = C.COLORS.panelBg;
  ctx.beginPath();
  U.roundRectPath(ctx, panelX, panelY, panelW, panelH, 16);
  ctx.fill();

  // 标题
  ctx.font = 'bold 32px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#4CAF50';
  ctx.fillText(game.isDaily ? '每日挑战完成！' : '通关！', cx, panelY + 45);

  // 结算仪式感动画状态（兜底：无动画对象时直接呈现最终态）
  const anim = game.winAnim || {
    phase: 'done', timer: 0, displayedScore: game.score,
    birdsTotal: game.birdsRemaining, birdsShown: game.birdsRemaining,
    starsShown: game.stars, starPop: 1,
  };

  // 星级（依次弹出：最新一颗带回弹缩放，已弹出的轻微呼吸，未弹出的暗色占位）
  const starY = panelY + 110;
  const starSize = 35;
  const starGap = 48;
  for (let i = 0; i < 3; i++) {
    const sx = cx + (i - 1) * starGap;
    const shown = i < anim.starsShown;
    let scale;
    if (shown && i === anim.starsShown - 1 && anim.starPop < 1) {
      // 弹出动画：快速冲到 1.35 倍再回弹到 1
      const p = anim.starPop;
      scale = p < 0.7 ? (p / 0.7) * 1.35 : 1.35 - ((p - 0.7) / 0.3) * 0.35;
    } else if (shown) {
      scale = 1 + Math.sin(game.frameCount * 0.1 + i * 0.5) * 0.06;
    } else {
      scale = 0.7;
    }

    ctx.save();
    ctx.translate(sx, starY);
    ctx.scale(scale, scale);
    ctx.font = starSize + 'px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = shown ? C.COLORS.starGold : 'rgba(255,255,255,0.15)';
    ctx.fillText('★', 0, 0);
    if (shown) {
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillText('★', 0, -1);
    }
    ctx.restore();
  }

  // 得分（滚动累计：显示动画当前值而非最终值）
  ctx.font = '16px Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText('得分', cx, panelY + 175);
  ctx.font = 'bold 28px Arial';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(Math.floor(anim.displayedScore), cx, panelY + 205);

  // 剩余小鸟奖励（逐只飞入：已飞入点亮，最新一只弹入，未飞入半透明占位）
  if (anim.birdsTotal > 0) {
    const iconGap = 26;
    const rowW = (anim.birdsTotal - 1) * iconGap;
    for (let i = 0; i < anim.birdsTotal; i++) {
      const bx = cx - rowW / 2 + i * iconGap;
      const by = panelY + 232;
      const type = game.birds[i] ? game.birds[i].type : 'normal';
      if (i < anim.birdsShown) {
        // 最新飞入的一只带弹入缩放
        const isNew = i === anim.birdsShown - 1 && anim.phase === 'birds';
        const s = isNew ? 1 + Math.max(0, 1 - anim.timer / 14) * 0.7 : 1;
        ctx.save();
        ctx.translate(bx, by);
        ctx.scale(s, s);
        E.drawBirdMini(ctx, 0, 0, 10, type);
        ctx.restore();
      } else {
        ctx.save();
        ctx.globalAlpha = 0.25;
        E.drawBirdMini(ctx, bx, by, 10, type);
        ctx.restore();
      }
    }
    ctx.font = '13px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = C.COLORS.starGold;
    ctx.fillText('剩豚奖励 +' + (anim.birdsShown * 5000) + ' / ' + (anim.birdsTotal * 5000), cx, panelY + 252);
  }

  // 最大连击
  if (game.maxCombo > 1) {
    ctx.font = 'bold 14px Arial';
    ctx.fillStyle = '#FF9F43';
    ctx.fillText('最大连击 x' + game.maxCombo, cx, panelY + 274);
  }

  // 操作区首行：分享战绩 + 双倍积分（广告点位，不可用时分享按钮独占整行）
  const shareY = panelY + panelH - 112;
  const showDouble = AD.available() && !game.adDoubleUsed;
  if (showDouble) {
    if (!game.buttons.share) {
      game.buttons.share = new E.Button(cx - 128, shareY, 124, 40, '分享战绩', '#07C160');
    }
    if (!game.buttons.double) {
      game.buttons.double = new E.Button(cx + 4, shareY, 124, 40, '双倍积分', '#FF9F43');
    }
    game.buttons.share.draw(ctx);
    game.buttons.double.draw(ctx);
  } else {
    delete game.buttons.double;
    if (!game.buttons.share) {
      game.buttons.share = new E.Button(cx - 90, shareY, 180, 40, '分享战绩 挑战好友', '#07C160');
    }
    game.buttons.share.draw(ctx);
  }

  // 按钮（仅创建一次，避免每帧重建丢失按下状态）
  const btnH = 38;
  const btnY = panelY + panelH - 60;
  // 每日挑战没有"下一关"（nextLevel 会回选关页，这里直接不显示该按钮）
  const isLastLevel = game.isDaily || game.currentLevelIndex >= game.levels.length - 1;

  if (!isLastLevel) {
    if (!game.buttons.next) {
      game.buttons.next = new E.Button(cx - 125, btnY, 85, btnH, '下一关', '#4CAF50');
    }
    if (!game.buttons.retry) {
      game.buttons.retry = new E.Button(cx - 32, btnY, 75, btnH, '重玩', '#FF9800');
    }
    if (!game.buttons.menu) {
      game.buttons.menu = new E.Button(cx + 51, btnY, 75, btnH, '菜单', '#607D8B');
    }
  } else {
    delete game.buttons.next;
    if (!game.buttons.retry) {
      game.buttons.retry = new E.Button(cx - 84, btnY, 80, btnH, '重玩', '#FF9800');
    }
    if (!game.buttons.menu) {
      game.buttons.menu = new E.Button(cx + 4, btnY, 80, btnH, '菜单', '#607D8B');
    }
  }

  for (const key of ['next', 'retry', 'menu']) {
    if (game.buttons[key]) game.buttons[key].draw(ctx);
  }
}

function drawLoseScreen(game) {
  const ctx = game.ctx;
  const cx = C.SCREEN_WIDTH / 2;
  const cy = C.SCREEN_HEIGHT / 2;

  // 覆盖层
  ctx.fillStyle = 'rgba(33,33,33,0.7)';
  ctx.fillRect(0, 0, C.SCREEN_WIDTH, C.SCREEN_HEIGHT);

  // 面板（广告可用时加高以容纳广告点位按钮）
  const panelW = 260;
  const panelH = AD.available() ? 330 : 240;
  const panelX = cx - panelW / 2;
  const panelY = cy - panelH / 2;
  ctx.fillStyle = C.COLORS.panelBg;
  ctx.beginPath();
  U.roundRectPath(ctx, panelX, panelY, panelW, panelH, 16);
  ctx.fill();

  // 标题
  ctx.font = 'bold 30px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#F44336';
  ctx.fillText('挑战失败', cx, panelY + 55);

  // 剩余章鱼
  const alivePigs = game.pigs.filter(p => p.alive && !p.dying).length;
  ctx.font = '15px Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText('还剩 ' + alivePigs + ' 只章鱼赖着不走', cx, panelY + 100);

  // 得分
  ctx.font = '14px Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText('本轮得分', cx, panelY + 135);
  ctx.font = 'bold 24px Arial';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(game.score, cx, panelY + 162);

  // 激励视频点位（仅广告可用时显示；奖励发放后按钮移除）
  if (AD.available()) {
    let adBtnY = panelY + 185;
    if (!game.reviveUsed) {
      if (!game.buttons.revive) {
        game.buttons.revive = new E.Button(cx - 85, adBtnY, 170, 36, '看视频 +1 只鸟', '#07C160');
      }
      game.buttons.revive.draw(ctx);
      adBtnY += 44;
    }
    const fails = game.failCounts[game.isDaily ? 'daily' : game.currentLevelIndex] || 0;
    if (fails >= 2 && !game.trajectoryBoost) {
      if (!game.buttons.boost) {
        game.buttons.boost = new E.Button(cx - 85, adBtnY, 170, 36, '看视频 弹道全显', '#7E57C2');
      }
      game.buttons.boost.draw(ctx);
    }
  }

  // 按钮（仅创建一次）
  const btnW = 90;
  const btnH = 38;
  const btnY = panelY + panelH - 55;
  delete game.buttons.next;
  if (!game.buttons.retry) {
    game.buttons.retry = new E.Button(cx - btnW - 8, btnY, btnW, btnH, '重玩', '#FF9800');
  }
  if (!game.buttons.menu) {
    game.buttons.menu = new E.Button(cx + 8, btnY, btnW, btnH, '菜单', '#607D8B');
  }

  game.buttons.retry.draw(ctx);
  game.buttons.menu.draw(ctx);
}

module.exports = {
  drawMenu,
  drawLeaderboard,
  drawSettings,
  drawLevelSelect,
  drawWinScreen,
  drawLoseScreen,
};
