/**
 * 玩法说明页（HELP 状态）—— 设置页内独立可滚动子页
 * 单一数据源：河豚图鉴 / 章王图鉴，提炼自 config.js BIRD_TYPES 与 levels.js。
 * 纯 Canvas 程序绘制（河豚复用 entities.drawBirdMini；章王自带迷你章鱼绘制），
 * 不引入任何图片资源，保证上传包 < 4MB。
 */

const C = require('./config.js');
const E = require('./entities.js');

// 深海蓝调压暗（与设置页同系；drawOceanDim 未从 theme 导出，这里自带）
function drawOceanDim(game, alpha) {
  const ctx = game.ctx;
  const g = ctx.createLinearGradient(0, 0, 0, C.SCREEN_HEIGHT);
  g.addColorStop(0, 'rgba(125, 80, 105, ' + alpha + ')');
  g.addColorStop(1, 'rgba(95, 58, 82, ' + Math.min(1, alpha + 0.12) + ')');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, C.SCREEN_WIDTH, C.SCREEN_HEIGHT);
}

// ============ 单一数据源 ============

// 河豚图鉴：name 名称 / bodyColor 主色 / abilityName 技能名 / abilityDesc 技能效果 / damageVs 材质克制
const HELP_PUFFERS = [
  {
    type: 'normal',
    name: '嘟嘟',
    bodyColor: C.BIRD_TYPES.normal.body,
    abilityName: '无技能',
    abilityDesc: '标准弹射，适合新手熟悉手感与关卡几何。',
    damageVs: { ...C.BIRD_TYPES.normal.damageVs },
  },
  {
    type: 'dash',
    name: '梭梭',
    bodyColor: C.BIRD_TYPES.dash.body,
    abilityName: '疾翎冲刺',
    abilityDesc: '空中点击 → 沿当前方向极速冲刺（速度 ×2.1），直捣远处掩体。',
    damageVs: { ...C.BIRD_TYPES.dash.damageVs },
  },
  {
    type: 'bomb',
    name: '砰砰',
    bodyColor: C.BIRD_TYPES.bomb.body,
    abilityName: '岩轰爆炸',
    abilityDesc: '空中点击或首次撞击 → 范围爆炸（半径 110），一发清场。',
    damageVs: { ...C.BIRD_TYPES.bomb.damageVs },
  },
  {
    type: 'split',
    name: '三丸子',
    bodyColor: C.BIRD_TYPES.split.body,
    abilityName: '三胞分裂',
    abilityDesc: '空中点击 → 一分为三（上下偏转），一发覆盖三处。',
    damageVs: { ...C.BIRD_TYPES.split.damageVs },
  },
];

// 章王图鉴：name 章王名 / level 所在关 / hp 血量 / shell 外壳 / style 配色 id
// （与战斗内同源 config.BOSS_STYLE，改色只改 config 一处）/ trait 机制特点
const HELP_BOSSES = [
  {
    name: '滩涂章王',
    level: 8,
    hp: 5,
    shell: '木壳',
    style: 'marsh',
    trait: '首个 Boss（教学战，无怒吼）。免疫击退，需多次直击破壳。',
  },
  {
    name: '冰壳章王',
    level: 16,
    hp: 7,
    shell: '冰壳',
    style: 'ice',
    trait: '半血触发怒吼，从屏外天降「爆裂果」援军，注意走位躲避。',
  },
  {
    name: '岩甲章王',
    level: 24,
    hp: 9,
    shell: '石壳',
    style: 'stone',
    trait: '两阶段；两度怒吼天降「落石」，用砰砰（克石）破壳最快。',
  },
  {
    name: '深渊章王',
    level: 32,
    hp: 11,
    shell: '混合壳',
    style: 'abyss',
    trait: '石墙 + 木墙 + 冰顶混合壳；三度怒吼，需轮换河豚克制。',
  },
  {
    name: '潮汐王座·章王',
    level: 40,
    hp: 14,
    shell: '王座双层壳',
    style: 'throne',
    trait: '最终 Boss，血量最高；三度怒吼（落石 + 爆裂果 + 召唤援军）。',
  },
];

// ============ 绘制辅助 ============

// 章鱼迷你图标（Boss 专用，无外部依赖）
function drawOctopusMini(ctx, x, y, r, tint) {
  ctx.save();
  ctx.translate(x, y);
  // 触手
  ctx.strokeStyle = tint;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(i * r * 0.34, r * 0.4);
    ctx.quadraticCurveTo(i * r * 0.5, r * 1.15, i * r * 0.34 + Math.sin(i) * r * 0.2, r * 1.3);
    ctx.stroke();
  }
  // 头
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = tint;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();
  // 眼睛
  ctx.beginPath();
  ctx.arc(-r * 0.3, -r * 0.15, r * 0.22, 0, Math.PI * 2);
  ctx.arc(r * 0.3, -r * 0.15, r * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = '#FFF';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-r * 0.27, -r * 0.12, r * 0.1, 0, Math.PI * 2);
  ctx.arc(r * 0.33, -r * 0.12, r * 0.1, 0, Math.PI * 2);
  ctx.fillStyle = '#212121';
  ctx.fill();
  ctx.restore();
}

// 文本自动换行，返回占用的行数（基于当前 ctx.font）
function wrapText(ctx, text, x, y, maxW, lineH) {
  const chars = text.split('');
  let line = '';
  let lines = 0;
  for (let i = 0; i < chars.length; i++) {
    const test = line + chars[i];
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y + lines * lineH);
      line = chars[i];
      lines++;
    } else {
      line = test;
    }
  }
  if (line) {
    ctx.fillText(line, x, y + lines * lineH);
    lines++;
  }
  return lines;
}

// 一张图鉴卡片（图标 + 标题 + 描述行）
function drawPufferCard(ctx, x, y, w, p) {
  // 卡片底
  ctx.fillStyle = 'rgba(255,255,255,0.86)';
  roundRect(ctx, x, y, w, 96, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, 96, 12);
  ctx.stroke();

  // 左：河豚图标
  E.drawBirdMini(ctx, x + 38, y + 48, 24, p.type);

  // 右：名称（粗体）
  ctx.textAlign = 'left';
  ctx.fillStyle = '#212121';
  ctx.font = 'bold 17px Arial';
  ctx.fillText(p.name, x + 76, y + 26);

  // 技能名
  ctx.fillStyle = '#E65100';
  ctx.font = '13px Arial';
  ctx.fillText('技能 · ' + p.abilityName, x + 76, y + 46);

  // 技能描述（自动换行）
  ctx.fillStyle = '#424242';
  ctx.font = '12px Arial';
  wrapText(ctx, p.abilityDesc, x + 76, y + 64, w - 92, 16);

  // 底部：材质克制
  ctx.fillStyle = '#607D8B';
  ctx.font = '11px Arial';
  ctx.fillText(
    '克制 ' +
      damageText(p.damageVs),
    x + 76, y + 90
  );
}

function drawBossCard(ctx, x, y, w, b) {
  ctx.fillStyle = 'rgba(255,243,248,0.92)';
  roundRect(ctx, x, y, w, 96, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, 96, 12);
  ctx.stroke();

  drawOctopusMini(ctx, x + 38, y + 48, 24, C.BOSS_STYLE[b.style].body);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#212121';
  ctx.font = 'bold 17px Arial';
  ctx.fillText(b.name, x + 76, y + 26);

  ctx.fillStyle = '#6A1B9A';
  ctx.font = '13px Arial';
  ctx.fillText('第 ' + b.level + ' 关 · HP ' + b.hp + ' · ' + b.shell, x + 76, y + 46);

  ctx.fillStyle = '#424242';
  ctx.font = '12px Arial';
  wrapText(ctx, b.trait, x + 76, y + 64, w - 92, 16);
}

function damageText(d) {
  const parts = [];
  if (d.wood > 1) parts.push('木×' + d.wood);
  if (d.stone > 1) parts.push('石×' + d.stone);
  if (d.ice > 1) parts.push('冰×' + d.ice);
  if (d.fire > 1) parts.push('火×' + d.fire);
  return parts.length ? parts.join(' ') : '全材质均衡';
}

// 圆角矩形路径
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ============ 说明页主绘制 ============

function drawHelp(game) {
  const ctx = game.ctx;
  const W = C.SCREEN_WIDTH;
  const H = C.SCREEN_HEIGHT;
  const cx = W / 2;

  // 深海蓝调压暗（与设置页同系）
  drawOceanDim(game, 0.55);

  // 固定标题
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 30px Arial';
  drawStrokedTitle(ctx, '玩法说明', cx, 64);

  // 滚动内容区（顶部留 96，底部留 84 给返回按钮）
  const top = 100;
  const bottom = H - 84;
  const contentW = 320;
  const cardX = cx - contentW / 2;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, top, W, bottom - top);
  ctx.clip();
  ctx.translate(0, -game.helpScroll);

  let y = top + 8;
  // —— 河豚图鉴 ——
  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 20px Arial';
  ctx.fillText('河豚图鉴', cardX, y + 18);
  y += 36;
  for (const p of HELP_PUFFERS) {
    drawPufferCard(ctx, cardX, y, contentW, p);
    y += 110;
  }

  // —— 章王图鉴 ——
  y += 6;
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 20px Arial';
  ctx.fillText('章王图鉴（Boss）', cardX, y + 18);
  y += 36;
  for (const b of HELP_BOSSES) {
    drawBossCard(ctx, cardX, y, contentW, b);
    y += 110;
  }

  const contentBottom = y + 8;
  // 实时更新最大滚动量
  game.helpMaxScroll = Math.max(0, contentBottom - bottom);
  if (game.helpScroll > game.helpMaxScroll) game.helpScroll = game.helpMaxScroll;

  ctx.restore();

  // 固定返回按钮（不随滚动）
  if (!game.buttons.helpBack) {
    game.buttons.helpBack = new E.Button(cx - 70, H - 60, 140, 44, '返回', '#7FC8E8',
      { sketch: true, strokeWidth: 3, shadowOffset: 4, radius: 14 });
  }
  game.buttons.helpBack.draw(ctx);

  // 顶部滚动提示
  if (game.helpMaxScroll > 0) {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font = '12px Arial';
    ctx.fillText('↑ 上下拖动查看全部', cx, H - 8);
  }
}

function drawStrokedTitle(ctx, text, x, y) {
  ctx.save();
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
  ctx.restore();
}

module.exports = {
  HELP_PUFFERS,
  HELP_BOSSES,
  damageText,
  drawHelp,
};
