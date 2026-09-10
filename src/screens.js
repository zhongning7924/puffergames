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
const T = require('./theme.js');
const AD = require('./ad.js');
const DAILY = require('./daily.js');
const PEARLS = require('./pearls.js');
const EDITOR = require('./editor.js');

// 马卡龙界面实例色（高饱和旧色 → 低饱和粉彩色；微信绿 #07C160 为合规色不在此列）
const UI = {
  blue: '#7FC8E8',      // 旧 #0288D1（设置/返回）
  mint: '#7FDDE8',      // 旧 #26C6DA（开关开/下一关）
  gray: '#A8B0C0',      // 旧 #78909C（开关关/菜单）
  grayDeep: '#9AA8BC',  // 旧 #546E7A（选关返回）
  orange: '#FFCC80',    // 旧 #FFA726（重玩）
  apricot: '#FFB78A',   // 旧 #FF9F43（双倍积分）
  lavender: '#CE93D8',  // 旧 #9C27B0/#AB47BC（每日/弹道全显）
  lavenderDeep: '#BC7FCB',
  cyan: '#8FDCE8',      // 旧 #00ACC1（珍珠卡）
  cyanDeep: '#76CFE0',  // 旧 #006064
  coral: '#FF8A80',     // 旧 #EF5350（失败语义）
  ink: '#6D4C57',       // 浅底面板上的深粉棕文字（替代白字）
};
// 章节专属色（马卡龙五色系：薄荷青/珊瑚橙/薰衣草/草莓红/奶黄）
const CHAPTER_ACCENTS = ['#7FDDE8', '#FFAB91', '#CE93D8', '#FF8A80', '#FFCC80'];

// ============================================================
// 海洋风共享件：深海遮罩 + 玻璃面板（选关页设计语言的弹窗延伸）
// ============================================================

/** #RRGGBB + alpha → rgba() 字符串（章节色做泛光/渐变用） */
function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha + ')';
}

/** 暖粉纱压暗（马卡龙主题：冷深海蓝 → 暖粉棕柔纱，托住奶白面板） */
function drawOceanDim(game, alpha) {
  const ctx = game.ctx;
  const g = ctx.createLinearGradient(0, 0, 0, C.SCREEN_HEIGHT);
  g.addColorStop(0, 'rgba(125, 80, 105, ' + alpha + ')');
  g.addColorStop(1, 'rgba(95, 58, 82, ' + Math.min(1, alpha + 0.12) + ')');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, C.SCREEN_WIDTH, C.SCREEN_HEIGHT);
}

/**
 * 奶白玻璃面板：双层柔投影 + 磨砂描边 + 奶白→浅粉渐变 +
 * 顶部主题色条 + 内部粉泡/粉光氛围。accent 传 null 则不画主题条。
 * 注意：浅底面板，内部文字必须用深粉棕（UI.ink），白字会隐形。
 */
function drawGlassPanel(ctx, x, y, w, h, accent, frame) {
  // 1. 双层柔投影（粉棕调，与选关页卡片同一配方）
  ctx.fillStyle = 'rgba(120,70,90,0.15)';
  ctx.beginPath();
  U.roundRectPath(ctx, x + 5, y + 5, w, h, 18);
  ctx.fill();
  ctx.fillStyle = 'rgba(120,70,90,0.22)';
  ctx.beginPath();
  U.roundRectPath(ctx, x + 3, y + 3, w, h, 18);
  ctx.fill();

  // 2. 磨砂白描边
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  U.roundRectPath(ctx, x - 1.5, y - 1.5, w + 3, h + 3, 19);
  ctx.fill();

  // 3. 主体：奶白 → 浅粉渐变（草莓奶霜面板）
  const body = ctx.createLinearGradient(x, y, x, y + h);
  body.addColorStop(0, 'rgba(255, 250, 252, 0.97)');
  body.addColorStop(1, 'rgba(255, 232, 240, 0.97)');
  ctx.fillStyle = body;
  ctx.beginPath();
  U.roundRectPath(ctx, x, y, w, h, 18);
  ctx.fill();

  // 4. 顶部粉光（给标题一点仪式感）
  const light = ctx.createRadialGradient(x + w / 2, y + 30, 4, x + w / 2, y + 30, w * 0.65);
  light.addColorStop(0, 'rgba(244,143,177,0.18)');
  light.addColorStop(1, 'rgba(244,143,177,0)');
  ctx.fillStyle = light;
  ctx.beginPath();
  U.roundRectPath(ctx, x, y, w, h, 18);
  ctx.fill();

  // 5. 内部粉泡（3 颗，随帧上浮摆动，密度远低于世界背景不抢戏）
  if (typeof frame === 'number') {
    const t = frame * 0.012;
    const seeds = [[0.16, 0.78, 4], [0.85, 0.62, 5], [0.72, 0.86, 3]];
    for (let i = 0; i < seeds.length; i++) {
      const [fx, fy, r] = seeds[i];
      const bx = x + w * fx + Math.sin(t + i * 2.1) * 5;
      const by = y + h * fy - ((frame * 0.35 + i * 37) % (h * 0.5));
      ctx.beginPath();
      ctx.arc(bx, by, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(244,143,177,0.13)';
      ctx.fill();
    }
  }

  // 6. 顶部主题色条（胜利=金 / 失败=珊瑚红 / 珍珠关=主题色）
  if (accent) {
    ctx.fillStyle = accent;
    ctx.beginPath();
    U.roundRectPath(ctx, x + 4, y + 3, w - 8, 5, 3);
    ctx.fill();
  }
}

/** 白字黑边标题（选关页同款描边文字配方） */
function drawStrokedText(ctx, text, cx, cy, font, fillStyle, strokeStyle, lineWidth) {
  ctx.save();
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = lineWidth || 3;
  ctx.strokeStyle = strokeStyle || 'rgba(0,0,0,0.5)';
  ctx.strokeText(text, cx, cy);
  ctx.fillStyle = fillStyle;
  ctx.fillText(text, cx, cy);
  ctx.restore();
}

function drawMenu(game) {
  const ctx = game.ctx;
  const cx = C.SCREEN_WIDTH / 2;

  // 造关师页面（中心页/我造的关/挑战记录）：复用 MENU 态 + listView 字段，不新增状态机
  if (game.listView) { drawLevelList(game); return; }

  // 深海蓝调压暗（保留水下世界的可读性）
  drawOceanDim(game, 0.45);

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

  // 标题文字（新名称更长，字号略减并居中对齐，避免与上方河豚图标重叠）
  ctx.font = 'bold 34px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 标题阴影
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillText('愤怒河豚的弹弓', cx + 3, titleY + bounce + 3);

  // 标题渐变（河豚黄，海洋题材）
  const titleGrad = ctx.createLinearGradient(0, titleY - 20, 0, titleY + 40);
  titleGrad.addColorStop(0, '#FFD54F');
  titleGrad.addColorStop(1, '#FF8F00');
  ctx.fillStyle = titleGrad;
  ctx.fillText('愤怒河豚的弹弓', cx, titleY + bounce);

  // 副标题：紧贴标题（随标题同步 bounce，与吉祥物/标题组成顶部 logo 区）
  ctx.font = '14px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText('我爱玩团队出品', cx, titleY + 38 + bounce);

  // 开始按钮（仅创建一次，避免每帧重建丢失按下状态）
  const btnW = 160;
  const btnH = 50;
  const btnX = cx - btnW / 2;
  const btnY = C.SCREEN_HEIGHT * 0.5 - 30; // 按钮组（开始游戏及下方全部入口）整体上移 30px
  const sketchOpts = { sketch: true, strokeWidth: 3, shadowOffset: 4, radius: 14 };
  if (!game.buttons.play) {
    game.buttons.play = new E.Button(btnX, btnY, btnW, btnH, '开始游戏', C.COLORS.buttonBg, sketchOpts);
  }
  game.buttons.play.draw(ctx);

  // 造关师入口（紧跟「开始游戏」下方；UGC 中心：造关/输码挑战/我造的关/挑战记录）
  const makerY = btnY + 62;
  if (!game.buttons.goMaker) {
    game.buttons.goMaker = new E.Button(btnX, makerY, btnW, 42, '🎨 造关师', '#07C160', sketchOpts);
  }
  game.buttons.goMaker.y = makerY;
  game.buttons.goMaker.draw(ctx);

  // 排行榜入口（需关系链数据 + 用户隐私保护指引，默认关闭；见 config.js FEATURES）
  // 开启时插在造关师与设置之间；关闭时不创建按钮，input 层不会命中，入口彻底不可达。
  if (C.FEATURES.leaderboard) {
    const leaderY = makerY + 54;
    if (!game.buttons.leaderboard) {
      game.buttons.leaderboard = new E.Button(btnX, leaderY, btnW, 42, '好友排行榜', '#07C160', sketchOpts);
    }
    game.buttons.leaderboard.y = leaderY; // 每帧同步，支持开关切换后重排
    game.buttons.leaderboard.draw(ctx);
  } else if (game.buttons.leaderboard) {
    delete game.buttons.leaderboard; // 开关关闭后清残留（如设置页返回菜单时）
  }

  // 设置入口（音效/音乐/震动开关）：排行榜隐藏时上移一位，避免菜单中间留一空格
  const settingsY = C.FEATURES.leaderboard ? makerY + 108 : makerY + 54;
  if (!game.buttons.settings) {
    game.buttons.settings = new E.Button(btnX, settingsY, btnW, 42, '设置', UI.blue, sketchOpts);
  }
  game.buttons.settings.y = settingsY; // 每帧同步，支持开关切换后重排
  game.buttons.settings.draw(ctx);

  // 玩法说明入口（紧跟设置下方，独立可滚动图鉴页：河豚技能 + 章王机制）
  const helpY = settingsY + 54;
  if (!game.buttons.help) {
    game.buttons.help = new E.Button(btnX, helpY, btnW, 42, '玩法说明', UI.lavender, sketchOpts);
  }
  game.buttons.help.y = helpY; // 跟随设置同步，避免开关切换后留错位
  game.buttons.help.draw(ctx);

  // 底部两行（星数/珍珠）跟随按钮组下移，保持与最后一个按钮的间距一致
  const tailBase = helpY + 64;

  // 最佳成绩
  let totalStars = 0;
  for (const k in game.progress.stars) totalStars += game.progress.stars[k];
  if (totalStars > 0) {
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = C.COLORS.starGold;
    ctx.fillText('★ x ' + totalStars, cx, tailBase);
  }

  // 珍珠收集进度（隐藏收集系统；收集到第一颗后才显示，保持发现感）
  const pearlCount = PEARLS.totalCollected(game.progress);
  if (pearlCount > 0) {
    const pearlY = tailBase + 24;
    E.drawPearl(ctx, cx - 36, pearlY, 7, game.frameCount);
    ctx.font = 'bold 15px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFF5F8';
    ctx.fillText(pearlCount + ' / ' + PEARLS.TOTAL, cx + 8, pearlY + 1);
  }
}

/**
 * 造关师页面（MENU 态 + game.listView）：
 *  - 'ugcHome'：造关师中心（造关/输码挑战/我造的关/挑战记录 四入口）
 *  - 'mine'：我造的关（本地存档槽位，进入/删除）
 *  - 'played'：挑战记录（好友关卡成绩，进入/删除）
 * 行按钮只创建不重建（保留按下态）；槽位删除后多余按钮回收。
 */
function drawLevelList(game) {
  const ctx = game.ctx;
  const cx = C.SCREEN_WIDTH / 2;
  drawOceanDim(game, 0.62);
  const sketchOpts = { sketch: true, strokeWidth: 3, shadowOffset: 3, radius: 12 };

  // 输码/启动错误提示（msgTimer 驱动，~4 秒）
  if (game.msgTimer > 0 && (game.clipboardError || game.launchError)) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, game.msgTimer / 60);
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FF8A80';
    ctx.fillText(game.clipboardError || game.launchError, cx, 130);
    ctx.restore();
  }

  if (game.listView === 'ugcHome') {
    drawStrokedText(ctx, '造关师', cx, 110, 'bold 30px Arial', '#FFD54F', 'rgba(0,0,0,0.5)', 3);
    const items = [
      ['goEditor', '🔨 造一关', UI.mint],
      ['goCode', '📋 输码挑战', UI.lavender],
      ['goMine', '📦 我造的关', UI.blue],
      ['goPlayed', '🏆 挑战记录', UI.orange],
    ];
    items.forEach(([key, label, color], i) => {
      const y = 170 + i * 72;
      if (!game.buttons[key]) {
        game.buttons[key] = new E.Button(cx - 90, y, 180, 52, label, color, sketchOpts);
      }
      game.buttons[key].y = y;
      game.buttons[key].draw(ctx);
    });
    if (!game.buttons.listBack) {
      game.buttons.listBack = new E.Button(cx - 70, C.SCREEN_HEIGHT - 86, 140, 42, '返回菜单', UI.gray, sketchOpts);
    }
    game.buttons.listBack.draw(ctx);
    return;
  }

  // —— 列表页（mine / played）——
  const isMine = game.listView === 'mine';
  drawStrokedText(ctx, isMine ? '我造的关' : '挑战记录', cx, 90, 'bold 26px Arial', '#FFD54F', 'rgba(0,0,0,0.5)', 3);
  // 中心页入口按钮在列表页不显示
  for (const k of ['goEditor', 'goCode', 'goMine', 'goPlayed']) delete game.buttons[k];

  const rows = isMine ? EDITOR.listSlots(game) : EDITOR.listPlayed(game);
  const top = 130, rowH = 52;
  if (!rows.length) {
    ctx.font = '15px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(isMine ? '还没有保存的自制关' : '还没有挑战记录', cx, 292);
    ctx.fillText(isMine ? '去「造一关」做一个吧！' : '输码或点好友分享卡片来挑战', cx, 316);
  }
  rows.forEach((r, i) => {
    const y = top + i * rowH;
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(16, y, C.SCREEN_WIDTH - 32, 44);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    const label = isMine ? r.name : ('挑战关卡 · ' + formatMMDD(r.playedAt));
    ctx.fillText(label, 30, y + 28);
    ctx.textAlign = 'right';
    if (isMine) {
      ctx.fillStyle = r.proven ? '#7FDDE8' : 'rgba(255,255,255,0.5)';
      ctx.fillText(r.proven ? '已通关' : '未通关', C.SCREEN_WIDTH - 150, y + 28);
    } else {
      ctx.fillStyle = C.COLORS.starGold;
      ctx.fillText('★ ' + (r.bestStars || 0), C.SCREEN_WIDTH - 150, y + 28);
    }
    const keyE = 'slotEnter' + i, keyD = 'slotDel' + i;
    if (!game.buttons[keyE]) {
      game.buttons[keyE] = new E.Button(C.SCREEN_WIDTH - 132, y + 6, 64, 32, '进入', UI.mint, { fontSize: 13, radius: 8 });
    }
    if (!game.buttons[keyD]) {
      game.buttons[keyD] = new E.Button(C.SCREEN_WIDTH - 62, y + 6, 46, 32, '删除', UI.coral, { fontSize: 13, radius: 8 });
    }
    game.buttons[keyE].y = y + 6;
    game.buttons[keyD].y = y + 6;
    game.buttons[keyE].draw(ctx);
    game.buttons[keyD].draw(ctx);
  });
  // 回收多余行按钮（槽位删除后）
  for (let i = rows.length; i < 12; i++) {
    delete game.buttons['slotEnter' + i];
    delete game.buttons['slotDel' + i];
  }
  if (!game.buttons.listBack) {
    game.buttons.listBack = new E.Button(cx - 70, C.SCREEN_HEIGHT - 80, 140, 42, '返回', UI.gray, sketchOpts);
  }
  game.buttons.listBack.draw(ctx);
}

function formatMMDD(ts) {
  const d = new Date(ts || Date.now());
  return String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/**
 * 设置界面：音效/音乐/震动三个开关 + 返回。
 * 开关按钮文字与颜色每帧按当前设置刷新（Button 实体属性直接改写，不重建按钮）。
 */
function drawSettings(game) {
  const ctx = game.ctx;
  const cx = C.SCREEN_WIDTH / 2;

  // 深海蓝调压暗
  drawOceanDim(game, 0.55);

  // 标题
  drawStrokedText(ctx, '设置', cx, 120, 'bold 30px Arial', '#FFFFFF', 'rgba(0,0,0,0.5)', 4);

  // 三个开关（海浪青=开，礁石灰=关）
  const rows = [
    { key: 'tglSound', label: '音效', on: game.settings.sound },
    { key: 'tglMusic', label: '音乐', on: game.settings.music },
    { key: 'tglVibration', label: '震动', on: game.settings.vibration },
  ];
  const btnW = 200;
  const btnX = cx - btnW / 2;
  const sketchOpts = { sketch: true, strokeWidth: 3, shadowOffset: 4, radius: 14 };
  rows.forEach((row, i) => {
    if (!game.buttons[row.key]) {
      game.buttons[row.key] = new E.Button(btnX, 180 + i * 62, btnW, 46, '', UI.mint, sketchOpts);
    }
    const btn = game.buttons[row.key];
    btn.text = row.label + '：' + (row.on ? '开' : '关');
    btn.color = row.on ? UI.mint : UI.gray;
    btn.draw(ctx);
  });

  // 返回
  if (!game.buttons.back) {
    game.buttons.back = new E.Button(cx - 70, 180 + 3 * 62 + 24, 140, 44, '返回', UI.blue, sketchOpts);
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
    // 预览/未支持环境降级（马卡龙浅水渐变，与选关页同色系）
    const bg = ctx.createLinearGradient(0, 0, 0, C.SCREEN_HEIGHT);
    bg.addColorStop(0, C.COLORS.waterTop);
    bg.addColorStop(1, C.COLORS.waterMid);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, C.SCREEN_WIDTH, C.SCREEN_HEIGHT);
    drawStrokedText(ctx, '好友排行榜', cx, 90, 'bold 24px Arial', '#FFD54F', 'rgba(0,0,0,0.5)', 3);
    ctx.font = '15px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = UI.ink;
    ctx.fillText('排行榜需在微信小游戏中查看', cx, C.SCREEN_HEIGHT / 2 - 10);
    ctx.fillText('通关后成绩会自动上传，与好友一较高下', cx, C.SCREEN_HEIGHT / 2 + 20);
  }

  // 返回按钮
  const backW = 120;
  const backH = 42;
  if (!game.buttons.back) {
    game.buttons.back = new E.Button(cx - backW / 2, C.SCREEN_HEIGHT - 76, backW, backH, '返回', UI.gray,
      { sketch: true, strokeWidth: 3, shadowOffset: 4, radius: 14 });
  }
  game.buttons.back.draw(ctx);
}

/**
 * 选关页自动定位：算出「前沿关卡」所属章节应停在视口顶部的滚动偏移。
 *
 * 前沿关卡 = 已解锁的最后一关（下标 unlockedLevels - 1），它必然是尚未通关的那一关
 * （通关第 i 关会把 unlockedLevels 推进到 i+2）。全 40 关通关时退化为最后一关。
 *
 * 之所以在绘制阶段算而不是进页面时算：卡片高度依赖 Banner inset，
 * 而 inset 要等原生模板广告 onResize 回调才知道，只有绘制时数值才稳定。
 *
 * @param {object} game 游戏实例
 * @param {Array} chapters 章节定义（PEARLS.CHAPTERS）
 * @param {number} cardStep 单张卡片占的高度（cardH + CARD_GAP）
 * @param {number} maxScroll 最大可滚动距离
 * @returns {number} 滚动偏移（已 clamp 到 [0, maxScroll]）
 */
function frontierChapterScroll(game, chapters, cardStep, maxScroll) {
  const total = (game.levels && game.levels.length) || 40;
  const unlocked = game.progress.unlockedLevels || 1;
  const frontier = Math.max(0, Math.min(total - 1, unlocked - 1));
  let ci = 0;
  for (let k = 0; k < chapters.length; k++) {
    if (chapters[k].levels.indexOf(frontier) >= 0) { ci = k; break; }
  }
  return Math.max(0, Math.min(maxScroll, ci * cardStep));
}

function drawLevelSelect(game) {
  const ctx = game.ctx;
  const cx = C.SCREEN_WIDTH / 2;
  const SW = C.SCREEN_WIDTH;
  const SH = C.SCREEN_HEIGHT;
  const frame = game.frameCount;

  // ============================================================
  // 背景：明亮的海洋晨光渐变
  // ============================================================
  const bg = ctx.createLinearGradient(0, 0, SW, SH);
  bg.addColorStop(0, '#C8EDF8');
  bg.addColorStop(0.35, '#A8E0F5');
  bg.addColorStop(0.75, '#8FD4EF');
  bg.addColorStop(1, '#7FC6E8');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SW, SH);

  // 水面光束（caustic lights）
  const causticTime = frame * 0.008;
  for (let i = 0; i < 3; i++) {
    const lx = SW * (0.2 + i * 0.3) + Math.sin(causticTime + i * 2) * 20;
    const ly = 60 + i * 40;
    const grad = ctx.createRadialGradient(lx, ly, 5, lx, ly, 140);
    grad.addColorStop(0, 'rgba(255,255,255,0.22)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.08)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(lx, ly, 140, 0, Math.PI * 2);
    ctx.fill();
  }

  // 气泡群（更多、更亮、颜色微变）
  const bubbleTime = frame * 0.01;
  const bubbles = [
    { x: 45, y: 90, r: 6, c: 'rgba(255,255,255,0.35)' },
    { x: 310, y: 75, r: 8, c: 'rgba(255,255,255,0.28)' },
    { x: 200, y: 130, r: 5, c: 'rgba(255,255,255,0.3)' },
    { x: 80, y: 200, r: 10, c: 'rgba(179,229,252,0.25)' },
    { x: 330, y: 280, r: 7, c: 'rgba(255,255,255,0.28)' },
    { x: 30, y: 370, r: 6, c: 'rgba(255,255,255,0.32)' },
    { x: 350, y: 450, r: 9, c: 'rgba(179,229,252,0.22)' },
    { x: 180, y: 520, r: 5, c: 'rgba(255,255,255,0.3)' },
    { x: 60, y: 580, r: 7, c: 'rgba(255,255,255,0.26)' },
    { x: 290, y: 610, r: 6, c: 'rgba(255,255,255,0.3)' },
  ];
  bubbles.forEach((b, i) => {
    const offset = Math.sin(bubbleTime + i * 1.3) * 12;
    ctx.beginPath();
    ctx.arc(b.x + offset * 0.3, b.y + offset, b.r, 0, Math.PI * 2);
    ctx.fillStyle = b.c;
    ctx.fill();
    // 气泡高光
    ctx.beginPath();
    ctx.arc(b.x + offset * 0.3 - b.r * 0.3, b.y + offset - b.r * 0.3, b.r * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fill();
  });

  // 底部海草剪影
  ctx.save();
  ctx.fillStyle = 'rgba(27,94,32,0.3)';
  for (let i = 0; i < 5; i++) {
    const sx = 20 + i * 80;
    const sway = Math.sin(bubbleTime * 0.5 + i) * 8;
    ctx.beginPath();
    ctx.moveTo(sx, SH);
    ctx.quadraticCurveTo(sx + sway, SH - 35, sx + sway * 0.5, SH - 55);
    ctx.quadraticCurveTo(sx + sway * 0.3, SH - 30, sx - 5, SH);
    ctx.fill();
  }
  ctx.restore();

  // ============================================================
  // 标题区
  // ============================================================
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // 主标题（字号收敛：36→25，标题区整体压缩，给滚动区让空间）
  ctx.font = 'bold 25px Arial';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.strokeText('选择关卡', cx, 52);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('选择关卡', cx, 52);
  // 副标题
  ctx.font = 'bold 13px Arial';
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.strokeText('探索海底秘境，收集闪亮珍珠！', cx, 76);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillText('探索海底秘境，收集闪亮珍珠！', cx, 76);
  ctx.restore();

  // ============================================================
  // 布局常量
  // ============================================================
  const PAD_X = 16;
  const CARD_W = SW - PAD_X * 2;
  const CARD_PAD_TOP = 20;   // 顶部留白：容纳内嵌章节色条
  const CARD_PAD_BOT = 14;
  const CARD_PAD_SIDE = 14;
  const BTN_SIZE = 56;
  const BTN_GAP = 12;
  const HEADER_H = 30;
  const STAR_H = 16;
  const CARD_GAP = 16;
  const CARD_RADIUS = 18;
  // 每章 8 关：按钮按 2 行 × 4 列网格排布（4×56+3×12=260px，屏宽内居中；
  // 单行 8 按钮需 532px 超出屏宽，故分行）
  const GRID_COLS = 4;
  // 行间隙必须容纳「上一行按钮下方的三星行」（星星 13px + 上下余量 ≈ 20px），
  // 否则星星会被下一行按钮盖住（曾为 10px 导致第一行星星被遮）
  const ROW_GAP = 20;

  const viewTop = 100;
  // 底部预留 Banner 高度（仅选关页常驻 Banner，其余页面 inset 为 0，布局不变）
  const bannerInset = AD.bannerInset();
  const viewBottom = SH - 80 - bannerInset;
  const viewH = viewBottom - viewTop;

  // 章节专属色（马卡龙五色系：薄荷青/珊瑚橙/薰衣草/草莓红/奶黄）
  const chapterAccents = CHAPTER_ACCENTS;

  const chapters = PEARLS.CHAPTERS;
  const numChapters = chapters.length;
  const pearlCount = PEARLS.totalCollected(game.progress);

  // 计算每张卡片高度（含两行按钮 + 行间距）
  const cardH = HEADER_H + 4 + BTN_SIZE * 2 + ROW_GAP + STAR_H + 4 + CARD_PAD_TOP + CARD_PAD_BOT;
  const totalCardsH = cardH * numChapters + CARD_GAP * (numChapters - 1);
  const dailyH = 50;
  const dailyGap = 12;
  const bonusH = 46;
  const totalExtraH = dailyH + dailyGap + (pearlCount > 0 ? bonusH + dailyGap : 0);
  const contentBottom = viewTop + totalCardsH + dailyGap + totalExtraH + 12;

  const maxScroll = Math.max(0, contentBottom - viewBottom);
  game.levelSelectMaxScroll = maxScroll;

  // 进入选关页后持续自动定位到前沿关卡所属章节，直到玩家第一次触摸（见 input.js）。
  // 每帧重算而不只算一次：Banner 高度由 wx onResize 异步回传，首帧 inset 可能是 0，
  // 高度到位后 maxScroll 会变，持续定位才能在布局稳定后停到正确位置。
  if (game.levelSelectAutoFocus) {
    game.levelSelectScroll = frontierChapterScroll(
      game, chapters, cardH + CARD_GAP, maxScroll
    );
  }
  let scroll = Math.max(0, Math.min(maxScroll, game.levelSelectScroll || 0));

  // ============================================================
  // 滚动内容区
  // ============================================================
  ctx.save();
  ctx.beginPath();
  U.roundRectPath(ctx, 0, viewTop, SW, viewH, 0);
  ctx.clip();
  ctx.translate(0, -scroll);

  let cardY = viewTop;

  chapters.forEach((ch, ci) => {
    const accent = chapterAccents[ci % chapterAccents.length];
    const cardX = PAD_X;

    // ---- 奶白糖霜卡片（sketch 风：深粉棕柔边 + 粉棕柔影，与关卡按钮同一视觉语言）----
    // 1. 柔边投影（双层，与 Button 一致）
    ctx.fillStyle = 'rgba(120,70,90,0.13)';
    ctx.beginPath();
    U.roundRectPath(ctx, cardX + 6, cardY + 7, CARD_W, cardH, CARD_RADIUS);
    ctx.fill();
    ctx.fillStyle = 'rgba(120,70,90,0.20)';
    ctx.beginPath();
    U.roundRectPath(ctx, cardX + 3, cardY + 4, CARD_W, cardH, CARD_RADIUS);
    ctx.fill();

    // 2. 主体（奶白 → 浅粉糖霜渐变，托住马卡龙彩色按钮；无硬描边，靠双层柔投影浮起）
    const cardGrad = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
    cardGrad.addColorStop(0, '#FFFDFE');
    cardGrad.addColorStop(1, '#FFF0F5');
    ctx.fillStyle = cardGrad;
    ctx.beginPath();
    U.roundRectPath(ctx, cardX, cardY, CARD_W, cardH, CARD_RADIUS);
    ctx.fill();

    // 3. 内部质感（裁剪在圆角内）：章节色泛光 + 顶部高光 + 底部暗化
    ctx.save();
    ctx.beginPath();
    U.roundRectPath(ctx, cardX, cardY, CARD_W, cardH, CARD_RADIUS);
    ctx.clip();
    // 章节色顶部泛光（若有若无的章节氛围）
    const glow = ctx.createRadialGradient(cardX + CARD_W / 2, cardY, 8,
      cardX + CARD_W / 2, cardY, CARD_W * 0.62);
    glow.addColorStop(0, hexToRgba(accent, 0.20));
    glow.addColorStop(1, hexToRgba(accent, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(cardX, cardY, CARD_W, cardH * 0.62);
    // 顶部高光
    const sheen = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH * 0.5);
    sheen.addColorStop(0, 'rgba(255,255,255,0.14)');
    sheen.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(cardX, cardY, CARD_W, cardH * 0.5);
    // 底部柔化（粉棕调）
    const shade = ctx.createLinearGradient(cardX, cardY + cardH * 0.62, cardX, cardY + cardH);
    shade.addColorStop(0, 'rgba(141,90,110,0)');
    shade.addColorStop(1, 'rgba(141,90,110,0.10)');
    ctx.fillStyle = shade;
    ctx.fillRect(cardX, cardY + cardH * 0.62, CARD_W, cardH * 0.38);
    ctx.restore();

    // 4. 顶部章节色条（深粉棕边圆头内嵌，替代旧的贴边细条 + 左侧竖边）
    ctx.fillStyle = '#AD6E87';
    ctx.beginPath();
    U.roundRectPath(ctx, cardX + 12, cardY + 8, CARD_W - 24, 9, 4.5);
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.beginPath();
    U.roundRectPath(ctx, cardX + 13.5, cardY + 9.5, CARD_W - 27, 6, 3);
    ctx.fill();

    // ---- 章节标题行 ----
    const headerY = cardY + CARD_PAD_TOP + HEADER_H / 2;

    // 章节标签胶囊
    const labelW = Math.min(120, ch.label.length * 14 + 30);
    const labelH = 26;
    const labelX = cardX + CARD_PAD_SIDE;
    ctx.save();
    // 胶囊阴影
    ctx.fillStyle = 'rgba(120,70,90,0.18)';
    ctx.beginPath();
    U.roundRectPath(ctx, labelX + 2, headerY - labelH / 2 + 2, labelW, labelH, 13);
    ctx.fill();
    // 胶囊主体（无描边，靠胶囊阴影浮起）
    ctx.fillStyle = accent;
    ctx.beginPath();
    U.roundRectPath(ctx, labelX, headerY - labelH / 2, labelW, labelH, 13);
    ctx.fill();
    // 胶囊文字（白字 + 深粉棕柔影，浅马卡龙胶囊上也清晰）
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(109,76,87,0.4)';
    ctx.shadowBlur = 2;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(ch.label, labelX + labelW / 2, headerY + 1);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.restore();

    // 右侧星数统计
    let chStars = 0;
    for (const i of ch.levels) chStars += game.progress.stars[i] || 0;
    const totalStars = ch.levels.length * 3;
    const starText = '★ ' + chStars + '/' + totalStars;
    ctx.save();
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(109,76,87,0.35)';
    ctx.strokeText(starText, cardX + CARD_W - CARD_PAD_SIDE, headerY);
    // 根据完成度变色（奶白卡上：全满深金 / 进行中中金 / 未动灰粉）
    const pct = chStars / totalStars;
    ctx.fillStyle = pct >= 1 ? '#F0A030' : (pct > 0 ? '#E8B04B' : 'rgba(109,76,87,0.38)');
    ctx.fillText(starText, cardX + CARD_W - CARD_PAD_SIDE, headerY);
    ctx.restore();

    // ---- 关卡按钮网格（2 行 × 4 列）----
    const rowW = GRID_COLS * BTN_SIZE + (GRID_COLS - 1) * BTN_GAP;
    const rowStartX = cardX + (CARD_W - rowW) / 2;
    const gridTopY = cardY + CARD_PAD_TOP + HEADER_H + 4;

    ch.levels.forEach((i, idx) => {
      const col = idx % GRID_COLS;
      const row = Math.floor(idx / GRID_COLS);
      const btnX = rowStartX + col * (BTN_SIZE + BTN_GAP);
      const btnY = gridTopY + row * (BTN_SIZE + ROW_GAP);
      const unlocked = i < game.progress.unlockedLevels;
      const stars = game.progress.stars[i] || 0;

      // 按钮：章节专属色
      const btnColor = unlocked ? accent : '#B0BEC5';
      const needsCreate = !game.buttons['level' + i] ||
        game.buttons['level' + i].x !== btnX ||
        game.buttons['level' + i].y !== btnY ||
        game.buttons['level' + i].color !== btnColor;

      if (needsCreate) {
        game.buttons['level' + i] = new E.Button(btnX, btnY, BTN_SIZE, BTN_SIZE, String(i + 1),
          btnColor,
          { sketch: true, locked: !unlocked, strokeWidth: 3, shadowOffset: 4,
            radius: 14, fontSize: 22 });
      } else {
        game.buttons['level' + i].locked = !unlocked;
      }
      game.buttons['level' + i].draw(ctx);

      // 星级（按钮下方，居中于两行按钮之间的 ROW_GAP 间隙）
      const starY = btnY + BTN_SIZE + 10;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let s = 0; s < 3; s++) {
        const sx = btnX + BTN_SIZE / 2 + (s - 1) * 14;
        if (unlocked && s < stars) {
          ctx.font = 'bold 13px Arial';
          ctx.lineWidth = 2;
          ctx.strokeStyle = 'rgba(109,76,87,0.55)';
          ctx.strokeText('★', sx, starY);
          ctx.fillStyle = '#FFB300';
          ctx.fillText('★', sx, starY);
        } else if (unlocked) {
          ctx.font = '13px Arial';
          ctx.fillStyle = 'rgba(109,76,87,0.22)';
          ctx.fillText('★', sx, starY);
        } else {
          ctx.font = '13px Arial';
          ctx.fillStyle = 'rgba(109,76,87,0.12)';
          ctx.fillText('★', sx, starY);
        }
      }
      ctx.restore();
    });

    cardY += cardH + CARD_GAP;
  });

  // ---- 每日挑战卡片 ----
  const dailyY = cardY;
  const dailyW = CARD_W;
  const dailyCardX = PAD_X;

  // 双层柔投影（与章节卡一致）
  ctx.fillStyle = 'rgba(120,70,90,0.13)';
  ctx.beginPath();
  U.roundRectPath(ctx, dailyCardX + 6, dailyY + 7, dailyW, dailyH, 14);
  ctx.fill();
  ctx.fillStyle = 'rgba(120,70,90,0.20)';
  ctx.beginPath();
  U.roundRectPath(ctx, dailyCardX + 3, dailyY + 4, dailyW, dailyH, 14);
  ctx.fill();
  // 主体（薰衣草紫渐变，无描边靠柔投影浮起）
  const dailyGrad = ctx.createLinearGradient(dailyCardX, dailyY, dailyCardX, dailyY + dailyH);
  dailyGrad.addColorStop(0, UI.lavender);
  dailyGrad.addColorStop(1, UI.lavenderDeep);
  ctx.fillStyle = dailyGrad;
  ctx.beginPath();
  U.roundRectPath(ctx, dailyCardX, dailyY, dailyW, dailyH, 14);
  ctx.fill();
  // 高光
  const dailyHi = ctx.createLinearGradient(dailyCardX, dailyY, dailyCardX, dailyY + dailyH * 0.5);
  dailyHi.addColorStop(0, 'rgba(255,255,255,0.3)');
  dailyHi.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = dailyHi;
  ctx.beginPath();
  U.roundRectPath(ctx, dailyCardX + 2, dailyY + 2, dailyW - 4, dailyH * 0.45, 12);
  ctx.fill();

  // 闪电图标
  ctx.save();
  ctx.translate(dailyCardX + 26, dailyY + dailyH / 2);
  // 圆形背景
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath();
  ctx.arc(0, 0, 16, 0, Math.PI * 2);
  ctx.fill();
  // 闪电
  ctx.fillStyle = '#FFD54F';
  ctx.strokeStyle = '#AD6E87';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-3, -10);
  ctx.lineTo(5, -2);
  ctx.lineTo(0, 0);
  ctx.lineTo(4, 10);
  ctx.lineTo(-5, 2);
  ctx.lineTo(0, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // 文字
  const todayBest = game.progress.daily && game.progress.daily.date === DAILY.todayString()
    ? game.progress.daily.best : null;
  const dailyText = todayBest !== null
    ? '每日挑战 · 今日最佳 ' + todayBest
    : '每日挑战 · 每日一题';
  ctx.font = 'bold 15px Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(109,76,87,0.4)';
  ctx.shadowBlur = 2;
  ctx.shadowOffsetY = 1;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(dailyText, dailyCardX + 52, dailyY + dailyH / 2 + 1);

  // 右侧箭头
  ctx.font = 'bold 18px Arial';
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fillText('→', dailyCardX + dailyW - 18, dailyY + dailyH / 2 + 1);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // 同步点击命中
  if (!game.buttons.daily || Math.abs(game.buttons.daily.x - dailyCardX) > 1 ||
      Math.abs(game.buttons.daily.y - dailyY) > 1) {
    game.buttons.daily = new E.Button(dailyCardX, dailyY, dailyW, dailyH, '',
      UI.lavender, { sketch: true, strokeWidth: 3, shadowOffset: 0, radius: 14, fontSize: 1 });
  } else {
    game.buttons.daily.color = UI.lavender;
  }

  // ---- 珍珠关卡片 ----
  if (pearlCount > 0) {
    const bonusY = dailyY + dailyH + dailyGap;
    const bonusCardX = PAD_X;
    const bonusW = CARD_W;

    ctx.fillStyle = 'rgba(120,70,90,0.13)';
    ctx.beginPath();
    U.roundRectPath(ctx, bonusCardX + 6, bonusY + 7, bonusW, bonusH, 14);
    ctx.fill();
    ctx.fillStyle = 'rgba(120,70,90,0.20)';
    ctx.beginPath();
    U.roundRectPath(ctx, bonusCardX + 3, bonusY + 4, bonusW, bonusH, 14);
    ctx.fill();
    const bonusGrad = ctx.createLinearGradient(bonusCardX, bonusY, bonusCardX, bonusY + bonusH);
    bonusGrad.addColorStop(0, UI.cyan);
    bonusGrad.addColorStop(1, UI.cyanDeep);
    ctx.fillStyle = bonusGrad;
    ctx.beginPath();
    U.roundRectPath(ctx, bonusCardX, bonusY, bonusW, bonusH, 14);
    ctx.fill();
    // 高光
    const bonusHi = ctx.createLinearGradient(bonusCardX, bonusY, bonusCardX, bonusY + bonusH * 0.5);
    bonusHi.addColorStop(0, 'rgba(255,255,255,0.3)');
    bonusHi.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = bonusHi;
    ctx.beginPath();
    U.roundRectPath(ctx, bonusCardX + 2, bonusY + 2, bonusW - 4, bonusH * 0.45, 12);
    ctx.fill();

    // 珍珠图标（与世界珍珠/弹弓挂饰同一支笔：白珠粉边）
    ctx.save();
    ctx.translate(bonusCardX + 26, bonusY + bonusH / 2);
    // 外圈
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.fill();
    // 珍珠主体（共享画法）
    T.drawPearlBead(ctx, -1, -1, 9);
    ctx.restore();

    const bonusText = '珍珠关 · 已收集 ' + pearlCount + ' / ' + PEARLS.TOTAL;
    ctx.font = 'bold 15px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(109,76,87,0.4)';
    ctx.shadowBlur = 2;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(bonusText, bonusCardX + 52, bonusY + bonusH / 2 + 1);

    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fillText('→', bonusCardX + bonusW - 18, bonusY + bonusH / 2 + 1);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    if (!game.buttons.bonus || Math.abs(game.buttons.bonus.x - bonusCardX) > 1 ||
        Math.abs(game.buttons.bonus.y - bonusY) > 1) {
      game.buttons.bonus = new E.Button(bonusCardX, bonusY, bonusW, bonusH, '',
        UI.cyan, { sketch: true, strokeWidth: 3, shadowOffset: 0, radius: 14, fontSize: 1 });
    } else {
      game.buttons.bonus.color = UI.cyan;
    }
  } else {
    delete game.buttons.bonus;
  }

  ctx.restore();

  // ============================================================
  // 返回按钮（固定底部）
  // ============================================================
  const backW = 120;
  const backH = 46;
  const backX = cx - backW / 2;
  const backY = SH - 68 - bannerInset; // 跟随 Banner 上移，避免被遮挡
  // 命中矩形随 Banner 高度变化，故 x/y 任一变化都要重建按钮
  if (!game.buttons.back ||
      game.buttons.back.x !== backX || game.buttons.back.y !== backY) {
    game.buttons.back = new E.Button(backX, backY, backW, backH, '返回', UI.grayDeep,
      { sketch: true, strokeWidth: 3, shadowOffset: 4, radius: 16, fontSize: 18 });
  } else {
    game.buttons.back.color = UI.grayDeep;
  }
  game.buttons.back.draw(ctx);
}

function drawWinScreen(game) {
  const ctx = game.ctx;
  const cx = C.SCREEN_WIDTH / 2;
  const cy = C.SCREEN_HEIGHT / 2;

  // 深海蓝调压暗（世界仍在水下，只是更深）
  drawOceanDim(game, 0.62);

  // 面板
  const panelW = 280;
  const panelH = 400;
  const panelX = cx - panelW / 2;
  const panelY = cy - panelH / 2;
  // 珍珠关使用专属主题色作为面板描边，让玩家直观感知当前是哪一关
  const bonusTheme = (game.isBonus && game.bonusLevel && game.bonusLevel.bonusThemeColor) || null;
  const bonusIdx = (game.isBonus && game.bonusLevel && typeof game.bonusLevel.bonusIndex === 'number')
    ? game.bonusLevel.bonusIndex + 1 : null;
  const bonusTotal = (game.isBonus && game.bonusLevel && typeof game.bonusLevel.bonusTotal === 'number')
    ? game.bonusLevel.bonusTotal : null;
  if (bonusTheme) {
    // 主题色外描边（在磨砂描边之外再套一层）
    ctx.fillStyle = bonusTheme;
    ctx.beginPath();
    U.roundRectPath(ctx, panelX - 5, panelY - 5, panelW + 10, panelH + 10, 21);
    ctx.fill();
  }
  // 深海玻璃面板：胜利=金色主题条，珍珠关=专属主题色
  drawGlassPanel(ctx, panelX, panelY, panelW, panelH, bonusTheme || '#FFD54F', game.frameCount);

  // 标题：河豚金渐变 + 黑边（与主菜单标题同一配方）
  const titleGrad = ctx.createLinearGradient(0, panelY + 28, 0, panelY + 62);
  titleGrad.addColorStop(0, '#FFD54F');
  titleGrad.addColorStop(1, '#FF8F00');
  drawStrokedText(ctx,
    game.isDaily ? '每日挑战完成！' : game.isBonus ? '珍珠关完成！' : '通关！',
    cx, panelY + 45, 'bold 34px Arial', titleGrad, 'rgba(0,0,0,0.55)', 4);

  // 珍珠关序号副标题（让玩家知道是第几颗珍珠对应的关）
  if (bonusIdx && bonusTotal) {
    drawStrokedText(ctx, '珍珠 ' + bonusIdx + ' / ' + bonusTotal,
      cx, panelY + 72, 'bold 13px Arial', bonusTheme || '#5DA9C9', 'rgba(255,255,255,0.8)', 2.5);
  }

  // 章节珍珠解锁提示（本章全三星时）
  if (game.newPearlAwarded) {
    drawStrokedText(ctx, '珍珠解锁：' + game.newPearlAwarded,
      cx, panelY + 92, 'bold 14px Arial', '#5DA9C9', 'rgba(255,255,255,0.8)', 2.5);
  }

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
    if (shown) {
      // 金星 + 深粉棕细描边（奶白面板上托住金色，不再飘）
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(109,76,87,0.4)';
      ctx.strokeText('★', 0, 0);
      ctx.fillStyle = '#FFB300';
      ctx.fillText('★', 0, 0);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillText('★', 0, -1);
    } else {
      ctx.fillStyle = 'rgba(109,76,87,0.15)';
      ctx.fillText('★', 0, 0);
    }
    ctx.restore();
  }

  // 得分（滚动累计：显示动画当前值而非最终值；奶白面板上用深粉棕字 + 白描边）
  drawStrokedText(ctx, String(Math.floor(anim.displayedScore)),
    cx, panelY + 196, 'bold 30px Arial', UI.ink, 'rgba(255,255,255,0.8)', 3.5);

  // 剩余河豚奖励（逐只飞入：已飞入点亮，最新一只弹入，未飞入半透明占位）
  if (anim.birdsTotal > 0) {
    const iconGap = 26;
    const rowW = (anim.birdsTotal - 1) * iconGap;
    for (let i = 0; i < anim.birdsTotal; i++) {
      const bx = cx - rowW / 2 + i * iconGap;
      const by = panelY + 230;
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
  }

  // 奖励与连击合并为一行（缓解中段堆叠：原「奖励 + 连击」两行 → 一行）
  const infoParts = [];
  if (anim.birdsTotal > 0) {
    infoParts.push('剩豚 +' + (anim.birdsShown * 5000) + '/' + (anim.birdsTotal * 5000));
  }
  if (game.maxCombo > 1) {
    infoParts.push('连击 x' + game.maxCombo);
  }
  if (infoParts.length) {
    drawStrokedText(ctx, infoParts.join(' · '),
      cx, panelY + 258, 'bold 13px Arial', '#D99520', 'rgba(255,255,255,0.8)', 2.5);
  }

  // 操作区首行：分享战绩 + 双倍积分（广告点位，不可用时分享按钮独占整行）
  // 自制关：战役分享/双倍均不出现；挑战流在此位置放「分享给朋友」
  const shareY = panelY + panelH - 112;
  const sketchOpts = { sketch: true, strokeWidth: 3, shadowOffset: 4, radius: 14 };
  const showDouble = AD.available() && !game.adDoubleUsed && !game.isCustom;
  if (game.isCustom) {
    if (game.playOrigin === 'challenge' && !game.buttons.challengeShare) {
      game.buttons.challengeShare = new E.Button(cx - 90, shareY, 180, 40, '分享给朋友', '#07C160', sketchOpts);
    }
  } else if (showDouble) {
    if (!game.buttons.share) {
      game.buttons.share = new E.Button(cx - 128, shareY, 124, 40, '分享战绩', '#07C160', sketchOpts);
    }
    if (!game.buttons.double) {
      game.buttons.double = new E.Button(cx + 4, shareY, 124, 40, '双倍积分', UI.apricot, sketchOpts);
    }
    game.buttons.share.draw(ctx);
    game.buttons.double.draw(ctx);
  } else {
    delete game.buttons.double;
    if (!game.buttons.share) {
      game.buttons.share = new E.Button(cx - 90, shareY, 180, 40, '分享战绩 挑战好友', '#07C160', sketchOpts);
    }
    game.buttons.share.draw(ctx);
  }

  // 按钮（仅创建一次，避免每帧重建丢失按下状态）
  const btnH = 38;
  const btnY = panelY + panelH - 60;
  // 每日挑战/珍珠关/自制关没有"下一关"（custom 时 currentLevelIndex=-1 恒使旧表达式为 false，必须显式纳入）
  const isLastLevel = game.isDaily || game.isBonus || game.isCustom ||
    game.currentLevelIndex >= game.levels.length - 1;

  if (game.isCustom && game.playOrigin === 'author') {
    // 作者流 WIN：返回编辑 + 保存并分享（proven 门控视觉；回调侧 T7 再卡一次）
    if (!game.buttons.editorBack) {
      game.buttons.editorBack = new E.Button(cx - 100, btnY, 92, btnH, '返回编辑', UI.gray, sketchOpts);
    }
    if (!game.buttons.saveShare) {
      game.buttons.saveShare = new E.Button(cx + 8, btnY, 112, btnH, '保存并分享', '#07C160', sketchOpts);
    }
    game.buttons.saveShare.locked = !(game.editor && game.editor.proven);
  } else if (game.isCustom) {
    // 挑战流 WIN：再来一次 + 返回菜单（首行另有「分享给朋友」）
    delete game.buttons.next;
    if (!game.buttons.retry) {
      game.buttons.retry = new E.Button(cx - 84, btnY, 80, btnH, '再来一次', UI.orange, sketchOpts);
    }
    if (!game.buttons.menu) {
      game.buttons.menu = new E.Button(cx + 4, btnY, 80, btnH, '返回菜单', UI.gray, sketchOpts);
    }
  } else if (!isLastLevel) {
    if (!game.buttons.next) {
      game.buttons.next = new E.Button(cx - 125, btnY, 85, btnH, '下一关', UI.mint, sketchOpts);
    }
    if (!game.buttons.retry) {
      game.buttons.retry = new E.Button(cx - 32, btnY, 75, btnH, '重玩', UI.orange, sketchOpts);
    }
    if (!game.buttons.menu) {
      game.buttons.menu = new E.Button(cx + 51, btnY, 75, btnH, '菜单', UI.gray, sketchOpts);
    }
  } else {
    delete game.buttons.next;
    if (!game.buttons.retry) {
      game.buttons.retry = new E.Button(cx - 84, btnY, 80, btnH, '重玩', UI.orange, sketchOpts);
    }
    if (!game.buttons.menu) {
      game.buttons.menu = new E.Button(cx + 4, btnY, 80, btnH, '菜单', UI.gray, sketchOpts);
    }
  }

  for (const key of ['next', 'retry', 'menu', 'editorBack', 'saveShare', 'challengeShare']) {
    if (game.buttons[key]) game.buttons[key].draw(ctx);
  }
}

function drawLoseScreen(game) {
  const ctx = game.ctx;
  const cx = C.SCREEN_WIDTH / 2;
  const cy = C.SCREEN_HEIGHT / 2;

  // 深海蓝调压暗
  drawOceanDim(game, 0.62);

  // 面板（广告可用时加高以容纳广告点位按钮）；失败=珊瑚红主题条
  const panelW = 260;
  const panelH = AD.available() ? 330 : 240;
  const panelX = cx - panelW / 2;
  const panelY = cy - panelH / 2;
  drawGlassPanel(ctx, panelX, panelY, panelW, panelH, UI.coral, game.frameCount);

  // 标题：草莓红 + 黑边（失败语义色，奶白面板上高饱和红仍醒目）
  drawStrokedText(ctx, '挑战失败', cx, panelY + 55, 'bold 30px Arial',
    UI.coral, 'rgba(0,0,0,0.55)', 4);

  // 剩余章鱼
  const alivePigs = game.pigs.filter(p => p.alive && !p.dying).length;
  ctx.font = '15px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(109,76,87,0.85)';
  ctx.fillText('还剩 ' + alivePigs + ' 只章鱼赖着不走', cx, panelY + 100);

  // 得分
  ctx.font = '14px Arial';
  ctx.fillStyle = 'rgba(109,76,87,0.7)';
  ctx.fillText('本轮得分', cx, panelY + 135);
  drawStrokedText(ctx, String(game.score), cx, panelY + 163, 'bold 26px Arial',
    UI.ink, 'rgba(255,255,255,0.8)', 3);

  // 激励视频点位（仅广告可用时显示；奖励发放后按钮移除；自制关无广告点位）
  const sketchOpts = { sketch: true, strokeWidth: 3, shadowOffset: 4, radius: 14 };
  if (AD.available() && !game.isCustom) {
    let adBtnY = panelY + 185;
    if (!game.reviveUsed) {
      if (!game.buttons.revive) {
        game.buttons.revive = new E.Button(cx - 85, adBtnY, 170, 36, '看视频 +1 只河豚', '#07C160', sketchOpts);
      }
      game.buttons.revive.draw(ctx);
      adBtnY += 44;
    }
    const fails = game.failCounts[game.isDaily ? 'daily' : game.currentLevelIndex] || 0;
    if (fails >= 2 && !game.trajectoryBoost) {
      if (!game.buttons.boost) {
        game.buttons.boost = new E.Button(cx - 85, adBtnY, 170, 36, '看视频 弹道全显', UI.lavender, sketchOpts);
      }
      game.buttons.boost.draw(ctx);
    }
  }

  // 按钮（仅创建一次）
  const btnW = 90;
  const btnH = 38;
  const btnY = panelY + panelH - 55;
  delete game.buttons.next;
  if (game.isCustom && game.playOrigin === 'author') {
    // 作者流试玩失败：返回编辑 + 再试一次（不回菜单，草稿在编辑器里）
    delete game.buttons.menu;
    if (!game.buttons.editorBack) {
      game.buttons.editorBack = new E.Button(cx - btnW - 8, btnY, btnW, btnH, '返回编辑', UI.gray, sketchOpts);
    }
    if (!game.buttons.retry) {
      game.buttons.retry = new E.Button(cx + 8, btnY, btnW, btnH, '再试一次', UI.orange, sketchOpts);
    }
  } else {
    if (!game.buttons.retry) {
      game.buttons.retry = new E.Button(cx - btnW - 8, btnY, btnW, btnH,
        game.isCustom ? '再试一次' : '重玩', UI.orange, sketchOpts);
    }
    if (!game.buttons.menu) {
      game.buttons.menu = new E.Button(cx + 8, btnY, btnW, btnH,
        game.isCustom ? '返回菜单' : '菜单', UI.gray, sketchOpts);
    }
  }

  for (const key of ['retry', 'menu', 'editorBack']) {
    if (game.buttons[key]) game.buttons[key].draw(ctx);
  }
}

module.exports = {
  drawMenu,
  drawLeaderboard,
  drawSettings,
  drawLevelSelect,
  drawWinScreen,
  drawLoseScreen,
};
