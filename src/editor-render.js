/**
 * 造关师渲染 - 编辑器画面绘制（顶栏/底栏/网格预览/问题红圈/草稿实体）。
 * Editor rendering.
 *
 * T12-1 地基：GROUND_Y / SAFE_* 实时读 C。
 * T12-2 顶栏：sketch 胶囊退出/试玩 + 4 分类分段控件。
 * T12-3 底栏重做：材质筛选行（blocks 专属）+ 透明井 + 橡皮固定槽 + 72×56 大卡行。
 * T14 策略视角：击杀组叠加层 / 爆裂果链爆圈 / 顶栏工具组（撤销重做+AI 试解+抽屉）
 *      + 难度徽章 + 策略抽屉（五维横条/指纹/击杀组/预警）。
 */
'use strict';

const C = require('./config.js');
const E = require('./entities.js');
const RENDERER = require('./renderer.js');
const EDITOR = require('./editor.js');

const {
  TABS,
  TOP_CONTENT_H, SEG, SEG_H,
  CARD_W, CARD_H, CARD_GAP, CARD_PITCH, CARD_X,
  FILTER, FILTER_H, CARD_AREA_H,
  ERASER_SLOT, ZONE_X,
  TB, TB_KEYS, DRAWER,
  barLayout, visibleItems, floatingBarRect, drawerRect,
  MATERIALS, ERASER_ITEM, FLOAT_BAR,
} = EDITOR;

/** 物料卡的主题色块（方块按材质、敌人/道具按语义；橡皮用粉红） */
function cardColor(item) {
  if (item.kind === 'block') {
    return { wood: '#B07A4A', stone: '#8A8F98', ice: '#9FD8E8', burst: '#E8654B' }[item.type] || '#B07A4A';
  }
  if (item.kind === 'pig') return item.boss ? '#FFB74D' : '#B76BD6';   // 章王金 / 章鱼紫
  if (item.kind === 'bird') return '#F2A03D';  // 河豚橙
  if (item.kind === 'pearl') return '#F6E7A1'; // 珍珠金
  if (item.kind === 'eraser') return '#E87A7A';// 橡皮粉红
  return '#888';
}

/** 材质筛选段色（与方块材质色一致） */
function matColor(id) {
  return { wood: '#B07A4A', stone: '#8A8F98', ice: '#9FD8E8', fruit: '#E8654B' }[id] || '#888';
}

function drawEditor(game) {
  const ctx = game.ctx;
  const d = game.editor;
  if (!d) return;
  const W = C.SCREEN_WIDTH;
  const H = C.SCREEN_HEIGHT;
  const L = barLayout(d);
  const topH = L.topH;

  // 1. 世界背景（海洋/海床照常用，底栏盖在沙土区上）
  RENDERER.drawBackground(game);

  // 弹弓禁放区提示（淡色虚线 + 文案），不画弹弓/弹道
  ctx.save();
  ctx.strokeStyle = 'rgba(255,120,120,0.55)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(ZONE_X, topH);
  ctx.lineTo(ZONE_X, C.GROUND_Y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255,120,120,0.7)';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('弹弓区·禁放', ZONE_X / 2, topH + 26);
  ctx.restore();

  // 2. 草稿实体（方块/章鱼是实体实例，直接 draw；珍珠用同款 drawPearl）
  for (const b of d.draft.blocks) b.draw(ctx);
  for (const p of d.draft.pigs) p.draw(ctx);
  for (const p of d.draft.pearls) E.drawPearl(ctx, p.x, p.y, 9, game.frameCount);

  // 2b. T14 击杀组叠加层（同爆波连通分量豚虚线连 + 组号徽章；👁 可关）
  if (d.overlay && d.strategy) drawKillGroups(ctx, d);

  // 3. 选中高亮（拖动中半透明）
  if (d.selected && !d.drag) {
    drawSelection(ctx, d);
    drawFloatingBar(ctx, d);
  }

  // 4. 网格吸附预览（选中物料 + 手指在世界区；barTop 以下不预览）
  if (d.palette && d.touchY > topH && d.touchY < L.barTop) {
    drawSnapPreview(ctx, game);
    // 4b. T14 瞄具预览：挂载爆裂果时显示链爆传导圈（R=118 实证半径）
    drawChainPreview(ctx, game);
  }

  // 5. 问题红圈（常显；闪烁由 frameCount 驱动）
  const blink = 0.55 + 0.45 * Math.sin(game.frameCount * 0.25);
  ctx.save();
  ctx.strokeStyle = `rgba(232,64,64,${blink})`;
  ctx.lineWidth = 3;
  for (const iss of d.issues) {
    if (!iss.x && !iss.y) continue; // 计数类问题（无坐标）在顶栏灯体现
    ctx.beginPath();
    ctx.arc(iss.x, iss.y, 22, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // 6. 顶栏（0..SAFE_TOP 状态栏盖底 + 40 内容带，仅导航胶囊）
  ctx.save();
  ctx.fillStyle = 'rgba(18,40,66,0.92)';
  ctx.fillRect(0, 0, W, topH);
  game.buttons.editorExit && game.buttons.editorExit.draw(ctx);
  const playBtn = game.buttons.editorPlay;
  if (playBtn) {
    const n = d.issues.length;
    playBtn.locked = n > 0;
    playBtn.text = n > 0 ? `🔴 ${Math.min(n, 99)}` : (d.proven ? '✓ 可分享' : '▶ 试玩');
    playBtn.draw(ctx);
  }
  // 6b. T14 策略工具组（↶ ↷ 👁 🤖 📊）+ 难度徽章 + AI 进度
  drawTopTools(ctx, game, d);
  ctx.restore();

  // 非法操作红闪（屏缘红光）
  if (d.rejectFlash > 0) {
    ctx.save();
    ctx.strokeStyle = `rgba(232,64,64,${d.rejectFlash / 20 * 0.8})`;
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, W - 8, H - 8);
    ctx.restore();
  }

  // 7. 底栏：分段控件 + 材质筛选行 + 大卡行（含橡皮槽）+ SAFE_BOTTOM 留白
  drawBottomBar(ctx, game, L);

  // 8. 候飞豚队列（画在底栏面板之后，确保始终不被面板遮挡）
  ctx.save();
  for (let i = 0; i < d.draft.birds.length; i++) {
    const pos = EDITOR.queueBirdPos(i);
    E.drawPufferMini(ctx, pos.x, pos.y, 15, d.draft.birds[i]);
  }
  ctx.restore();

  // 选中态操作提示（底栏上方一行小字）
  if (d.selected) {
    ctx.save();
    ctx.fillStyle = 'rgba(18,40,66,0.85)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('拖动移动 · 橡皮删除 · 点空白取消', W / 2, L.barTop - 8);
    ctx.restore();
  }

  // 9. T14 策略抽屉（最上层；打开时盖世界区，底栏仍可编辑）
  if (d.drawer) drawStrategyDrawer(ctx, game, drawerRect(d));
}

/** 底栏：背景 + 分段控件行 + 材质筛选行 + 橡皮槽 + 大卡行 */
function drawBottomBar(ctx, game, L) {
  const d = game.editor;
  if (!d) return;
  const W = C.SCREEN_WIDTH;
  const H = C.SCREEN_HEIGHT;

  // ---- 背景（从 barTop 到屏底，含 SAFE_BOTTOM）----
  ctx.save();
  ctx.fillStyle = 'rgba(18,40,66,0.96)';
  ctx.fillRect(0, L.barTop, W, H - L.barTop);

  // ---- 分段控件行（方块/敌人/河豚/道具，底栏第一行）----
  drawSegmented(ctx, d, L.segTop);

  // ---- 材质筛选行（仅 blocks 分类显示；面板 x≥80）----
  if (L.showFilter) {
    drawFilterRow(ctx, d, L);
  }

  // ---- 橡皮固定槽（卡行坐标，x: 8-64）----
  drawEraserSlot(ctx, d, L);

  // ---- 大卡行（x≥80，横滚裁剪）----
  drawCardRow(ctx, game, d, L);

  ctx.restore();
}

/** blocks 材质子筛选：木/石/冰/果 四段，面板缩进 x≥FILTER.x */
function drawFilterRow(ctx, d, L) {
  const top = L.filterTop;
  const h = FILTER_H;
  ctx.save();

  // 面板背景（x≥FILTER.x）
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(FILTER.x, top, L.filterW, h);

  // 四段
  ctx.textAlign = 'center';
  ctx.font = '13px sans-serif';
  MATERIALS.forEach((m, i) => {
    const fx = FILTER.x + i * L.filterSegW;
    const active = d.matFilter === m.id;
    if (active) {
      // 激活段：白底 + 材质色下划线
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      roundRect(ctx, fx + 3, top + 4, L.filterSegW - 6, h - 8, 6);
      ctx.fill();
      ctx.fillStyle = matColor(m.id);
      roundRect(ctx, fx + L.filterSegW * 0.25, top + h - 6, L.filterSegW * 0.5, 3, 1.5);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
    }
    ctx.fillText(m.label, fx + L.filterSegW / 2, top + h / 2 + 5);
  });

  ctx.restore();
}

/** 橡皮固定槽（卡行左端；武装时高亮） */
function drawEraserSlot(ctx, d, L) {
  const x = ERASER_SLOT.x;
  const y = L.cardTop + ERASER_SLOT.y;
  const w = ERASER_SLOT.w;
  const h = ERASER_SLOT.h;

  ctx.save();

  // 槽位背景
  ctx.fillStyle = d.eraser ? 'rgba(232,122,122,0.35)' : 'rgba(255,255,255,0.10)';
  roundRect(ctx, x, y, w, h, 10);
  ctx.fill();
  if (d.eraser) {
    ctx.strokeStyle = 'rgba(232,122,122,0.7)';
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, w, h, 10);
    ctx.stroke();
  }

  // 橡皮图标（粉红圆角方块）
  const iconSz = 22;
  ctx.fillStyle = '#E87A7A';
  roundRect(ctx, x + (w - iconSz) / 2, y + 8, iconSz, iconSz, 5);
  ctx.fill();

  // 标签
  ctx.fillStyle = d.eraser ? '#FFFFFF' : 'rgba(255,255,255,0.65)';
  ctx.font = `${d.eraser ? 'bold ' : ''}11px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(ERASER_ITEM.label, x + w / 2, y + h - 6);

  ctx.restore();
}

/** 大卡行：72×56 物料卡，x≥64 横滚裁剪 */
function drawCardRow(ctx, game, d, L) {
  const items = visibleItems(d);
  if (!items.length) return;

  ctx.save();

  // 裁剪到卡行视口（x≥80）
  ctx.beginPath();
  ctx.rect(CARD_X, L.cardTop, C.SCREEN_WIDTH - CARD_X, CARD_AREA_H);
  ctx.clip();

  items.forEach((item, j) => {
    const cx = CARD_X + j * CARD_PITCH + CARD_W / 2 - d.scrollX;
    const cy = L.cardTop + CARD_AREA_H / 2;

    // 跳过完全滚出视口的卡
    if (cx + CARD_W / 2 < CARD_X - 8 || cx - CARD_W / 2 > C.SCREEN_WIDTH + 8) return;

    const active = (d.palette && d.palette.id === item.id) ||
      (d.eraser && item.id === 'eraser');

    // 卡背景
    ctx.fillStyle = active ? '#FFFFFF' : 'rgba(255,255,255,0.12)';
    roundRect(ctx, cx - CARD_W / 2, cy - CARD_H / 2, CARD_W, CARD_H, 10);
    ctx.fill();

    // 图标（居中偏上）
    const iconCY = cy - 8;
    if (item.kind === 'bird') {
      E.drawPufferMini(ctx, cx, iconCY, 14, item.type);
    } else if (item.kind === 'pearl') {
      E.drawPearl(ctx, cx, iconCY, 10, game.frameCount);
    } else if (item.kind === 'pig') {
      ctx.fillStyle = cardColor(item);
      ctx.beginPath();
      ctx.arc(cx, iconCY, 14, 0, Math.PI * 2);
      ctx.fill();
      if (item.boss) {
        // 王冠小三角
        ctx.fillStyle = '#5D4037';
        ctx.beginPath();
        ctx.moveTo(cx - 5, iconCY - 12);
        ctx.lineTo(cx - 2, iconCY - 18);
        ctx.lineTo(cx, iconCY - 14);
        ctx.lineTo(cx + 2, iconCY - 18);
        ctx.lineTo(cx + 5, iconCY - 12);
        ctx.closePath();
        ctx.fill();
      }
    } else {
      // 方块/橡皮：色块
      ctx.fillStyle = cardColor(item);
      const sz = 22;
      roundRect(ctx, cx - sz / 2, iconCY - sz / 2, sz, sz, 5);
      ctx.fill();
    }

    // 标签
    ctx.fillStyle = active ? '#1F3A5F' : '#FFFFFF';
    ctx.font = `${active ? 'bold ' : ''}11px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(item.label, cx, cy + 22);
  });

  ctx.restore();
}

// 顶栏 4 分类分段控件的激活色条（方块木色 / 章鱼紫 / 河豚橙 / 道具金）
const SEG_ACTIVE = { blocks: '#C4A88C', enemies: '#CE93D8', birds: '#FFB74D', items: '#F6E08C' };

/** 分段控件：居中半透容器 + 激活段白底墨字 + 色条；top 由调用方传入（顶栏或底栏） */
function drawSegmented(ctx, d, top) {
  const vPad = (SEG_H - SEG.h) / 2; // 段内垂直居中
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  roundRect(ctx, SEG.x, top + vPad, SEG.w, SEG.h, 10);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.font = 'bold 13px sans-serif';
  TABS.forEach((t, i) => {
    const sx = SEG.x + i * SEG.segW;
    if (d.tab === t.id) {
      ctx.fillStyle = '#FFFFFF';
      roundRect(ctx, sx + 3, top + vPad + 3, SEG.segW - 6, SEG.h - 6, 8);
      ctx.fill();
      ctx.fillStyle = SEG_ACTIVE[t.id];
      roundRect(ctx, sx + 12, top + vPad + 6, SEG.segW - 24, 3, 1.5);
      ctx.fill();
      ctx.fillStyle = '#1F3A5F';
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.62)';
    }
    ctx.fillText(t.label, sx + SEG.segW / 2, top + vPad + 22);
  });
  ctx.restore();
}

function drawSelection(ctx, d) {
  ctx.save();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([5, 4]);
  const h = d.selected;
  if (h.kind === 'block') {
    const b = d.draft.blocks[h.index];
    if (b) ctx.strokeRect(b.x - 3, b.y - 3, b.width + 6, b.height + 6);
  } else if (h.kind === 'pig') {
    const p = d.draft.pigs[h.index];
    if (p) { ctx.beginPath(); ctx.arc(p.x, p.y, p.radius + 5, 0, Math.PI * 2); ctx.stroke(); }
  } else if (h.kind === 'pearl') {
    const p = d.draft.pearls[h.index];
    if (p) { ctx.beginPath(); ctx.arc(p.x, p.y, 15, 0, Math.PI * 2); ctx.stroke(); }
  }
  ctx.restore();
}

/** 选中浮条：实体上方浮动 [复制] [删除] 按钮 */
function drawFloatingBar(ctx, d) {
  const r = floatingBarRect(d);
  if (!r) return;
  ctx.save();

  // 浮条背景
  ctx.fillStyle = 'rgba(30,50,80,0.92)';
  roundRect(ctx, r.x - 6, r.y - 5, r.w + 12, FLOAT_BAR.btnH + 10, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  roundRect(ctx, r.x - 6, r.y - 5, r.w + 12, FLOAT_BAR.btnH + 10, 8);
  ctx.stroke();

  // 复制按钮（绿色调）
  ctx.fillStyle = 'rgba(87,201,142,0.22)';
  roundRect(ctx, r.copyX, r.y, FLOAT_BAR.btnW, FLOAT_BAR.btnH, 6);
  ctx.fill();
  ctx.fillStyle = '#57C98E';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('复制', r.copyX + FLOAT_BAR.btnW / 2, r.y + FLOAT_BAR.btnH / 2 + 5);

  // 分隔线
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(r.copyX + FLOAT_BAR.btnW + FLOAT_BAR.gap / 2, r.y + 6);
  ctx.lineTo(r.copyX + FLOAT_BAR.btnW + FLOAT_BAR.gap / 2, r.y + FLOAT_BAR.btnH - 6);
  ctx.stroke();

  // 删除按钮（红色调）
  ctx.fillStyle = 'rgba(232,100,100,0.22)';
  roundRect(ctx, r.delX, r.y, FLOAT_BAR.btnW, FLOAT_BAR.btnH, 6);
  ctx.fill();
  ctx.fillStyle = '#E86464';
  ctx.fillText('删除', r.delX + FLOAT_BAR.btnW / 2, r.y + FLOAT_BAR.btnH / 2 + 5);

  // 三角指示器（指向选中实体）
  ctx.fillStyle = 'rgba(30,50,80,0.92)';
  ctx.beginPath();
  ctx.moveTo(r.centerX - 6, r.y + FLOAT_BAR.btnH + 5);
  ctx.lineTo(r.centerX + 6, r.y + FLOAT_BAR.btnH + 5);
  ctx.lineTo(r.centerX, r.y + FLOAT_BAR.btnH + 12);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/** 手指位置的吸附预览体（与实际放置同公式：悬空保留、穿地抬升；合法绿/禁区红） */
function drawSnapPreview(ctx, game) {
  const d = game.editor;
  const item = d.palette;
  const pos = EDITOR.placePosition(d.draft, item, d.touchX, d.touchY);
  if (!pos) return;
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#5FD68A';
  if (item.kind === 'block') {
    if (pos.x < ZONE_X) ctx.fillStyle = '#E86060';
    ctx.fillRect(pos.x, pos.y, item.w, item.h);
  } else if (item.kind === 'pig') {
    if (pos.x - item.radius < ZONE_X) ctx.fillStyle = '#E86060';
    ctx.beginPath(); ctx.arc(pos.x, pos.y, item.radius, 0, Math.PI * 2); ctx.fill();
  } else if (item.kind === 'pearl') {
    if (pos.x - 9 < ZONE_X) ctx.fillStyle = '#E86060';
    ctx.beginPath(); ctx.arc(pos.x, pos.y, 9, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// ==================== T14 策略视角渲染 ====================

// 击杀组配色（5 色循环；同组豚虚线连 + 组号徽章）
const GROUP_COLORS = ['#E86464', '#5B8DB8', '#57C98E', '#B07A4A', '#9B6BD6'];
const CHAIN_R = 118;   // T6 实证：爆裂果心间距 ≤~118 可链爆传导
const DIM_LABELS = [['P1', '弹药'], ['P2', '识别'], ['P3', '精度'], ['P4', '序列'], ['P5', '方差']];

/** 字符宽度估算（全角 ≈ fs、ASCII ≈ 0.56fs；harness 的 measureText 恒返回 10，禁依赖） */
function textW(s, fs) {
  let w = 0;
  for (const ch of String(s)) w += ch.charCodeAt(0) > 255 ? fs : fs * 0.56;
  return w;
}

/** 按估算宽度折行（中文无空格，逐字断行） */
function wrapCn(text, fs, maxW) {
  const lines = [];
  let line = '';
  for (const ch of String(text)) {
    if (line && textW(line + ch, fs) > maxW) { lines.push(line); line = ch; }
    else line += ch;
  }
  if (line) lines.push(line);
  return lines;
}

/** hex → rgba（难度徽章/横条按章级取色） */
function hexA(hex, a) {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** 击杀组叠加层：同爆波连通分量豚两两虚线 + 质心组号徽章（孤豚不画） */
function drawKillGroups(ctx, d) {
  const st = d.strategy;
  const pigs = d.draft.pigs;
  if (!st || !st.groups) return;
  ctx.save();
  for (const g of st.groups) {
    if (g.members.length < 2) continue;
    const pts = g.members.map(i => pigs[i]).filter(Boolean);
    if (pts.length < 2) continue;
    const color = GROUP_COLORS[(g.id - 1) % GROUP_COLORS.length];
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        ctx.beginPath();
        ctx.moveTo(pts[i].x, pts[i].y);
        ctx.lineTo(pts[j].x, pts[j].y);
        ctx.stroke();
      }
    }
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    ctx.globalAlpha = 0.92;
    ctx.setLineDash([]);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(g.id), cx, cy + 0.5);
  }
  ctx.restore();
}

/** 瞄具预览：挂载爆裂果 → 链爆传导圈（与吸附预览同落位） */
function drawChainPreview(ctx, game) {
  const d = game.editor;
  const item = d.palette;
  if (!item || item.kind !== 'block' || item.type !== 'burst') return;
  const pos = EDITOR.placePosition(d.draft, item, d.touchX, d.touchY);
  if (!pos) return;
  const cx = pos.x + item.w / 2, cy = pos.y + item.h / 2;
  ctx.save();
  ctx.strokeStyle = 'rgba(232,100,100,0.85)';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  ctx.beginPath(); ctx.arc(cx, cy, CHAIN_R, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

/** 顶栏策略工具组：置灰态维护 + 激活白环 + 难度徽章 + AI 进度/结果 */
function drawTopTools(ctx, game, d) {
  const b = game.buttons;
  if (b.editorUndo) b.editorUndo.locked = !(d.undoStack && d.undoStack.length);
  if (b.editorRedo) b.editorRedo.locked = !(d.redoStack && d.redoStack.length);
  if (b.editorSim) b.editorSim.locked = d.issues.length > 0;
  for (const k of TB_KEYS) if (b[k]) b[k].draw(ctx);

  // 激活态白环（叠加层常显 / 抽屉打开）
  const ring = (k) => {
    const btn = b[k];
    if (!btn) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    roundRect(ctx, btn.x - 2, btn.y - 2, btn.width + 4, btn.height + 4, btn.radius + 3);
    ctx.stroke();
    ctx.restore();
  };
  if (d.overlay) ring('editorOverlay');
  if (d.drawer) ring('editorDrawer');

  drawCompBadge(ctx, d);
  drawSimStatus(ctx, game, d);
}

/** 难度徽章：comp 一位小数 + 章级取色（无豚显示 —） */
function drawCompBadge(ctx, d) {
  const st = d.strategy;
  const w = 22, h = 20;
  const x = TB.x0 + TB_KEYS.length * (TB.size + TB.gap) + 4;
  const y = C.SAFE_TOP + TB.yOff + (TB.size - h) / 2;
  const hasPigs = !!(st && st.analyze && st.analyze.awake > 0);
  const tier = st ? st.tier : null;
  ctx.save();
  ctx.fillStyle = hasPigs && tier ? hexA(tier.color, 0.28) : 'rgba(255,255,255,0.12)';
  roundRect(ctx, x, y, w, h, 10); ctx.fill();
  ctx.fillStyle = hasPigs && tier ? tier.color : 'rgba(255,255,255,0.5)';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(hasPigs ? st.five.comp.toFixed(1) : '—', x + w / 2, y + h / 2 + 0.5);
  ctx.restore();
}

/** AI 试解状态：协程跑时 🤖 下方 2px 进度条；结束后右上角结果点（绿 WIN/红未解） */
function drawSimStatus(ctx, game, d) {
  const btn = game.buttons.editorSim;
  if (!btn) return;
  const sim = d.sim;
  ctx.save();
  if (sim && sim.running) {
    const p = sim.total ? Math.min(1, sim.done / sim.total) : 0;
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    roundRect(ctx, btn.x, btn.y + btn.height + 2, btn.width, 3, 1.5); ctx.fill();
    ctx.fillStyle = '#FFD54F';
    roundRect(ctx, btn.x, btn.y + btn.height + 2, Math.max(2, btn.width * p), 3, 1.5); ctx.fill();
  } else if (sim && sim.result) {
    ctx.fillStyle = sim.result.won ? '#57C98E' : '#E86464';
    ctx.beginPath(); ctx.arc(btn.x + btn.width - 1, btn.y + 1, 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/** 抽屉小节标题 */
function sectionLabel(ctx, x, y, text, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, y + 11);
  ctx.restore();
}

/** 策略抽屉：难度块 + 五维横条 + AI 试解 + 指纹 + 击杀组 + 滚球 + 设计预警 */
function drawStrategyDrawer(ctx, game, r) {
  const d = game.editor;
  const st = d.strategy;
  ctx.save();
  // 奶白玻璃面板
  ctx.fillStyle = 'rgba(245,248,252,0.97)';
  roundRect(ctx, r.x, r.y, r.w, r.h, 14); ctx.fill();
  ctx.strokeStyle = 'rgba(18,40,66,0.28)';
  ctx.lineWidth = 1;
  roundRect(ctx, r.x, r.y, r.w, r.h, 14); ctx.stroke();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();

  const pad = DRAWER.pad;
  const cw = r.w - pad * 2;
  const ink = '#1F3A5F', sub = '#5A6B82', line = 'rgba(18,40,66,0.12)';
  let y = r.y + 10 - d.drawerScroll;
  ctx.textBaseline = 'alphabetic';

  // —— 头部：标题 + 关闭（命中区见 editor.js onTouchStart）——
  ctx.fillStyle = ink;
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('🧭 策略视角', r.x + pad, y + 16);
  ctx.fillStyle = sub;
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('✕', r.x + r.w - pad - 8, y + 16);
  y += 26;
  ctx.strokeStyle = line;
  ctx.beginPath(); ctx.moveTo(r.x + pad, y); ctx.lineTo(r.x + r.w - pad, y); ctx.stroke();
  y += 10;

  if (!st) { ctx.restore(); return; }
  const five = st.five, tier = st.tier;

  // —— 难度块 ——
  ctx.fillStyle = '#FFFFFF';
  roundRect(ctx, r.x + pad, y, cw, 62, 10); ctx.fill();
  ctx.strokeStyle = line;
  roundRect(ctx, r.x + pad, y, cw, 62, 10); ctx.stroke();
  ctx.fillStyle = tier.color;
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(five.comp.toFixed(1), r.x + pad + 12, y + 38);
  ctx.fillStyle = sub;
  ctx.font = '10px sans-serif';
  ctx.fillText('综合难度', r.x + pad + 12, y + 53);
  ctx.fillStyle = ink;
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(`相当于官方「${tier.name}」章`, r.x + pad + 68, y + 22);
  const sim = d.sim;
  ctx.font = '11px sans-serif';
  ctx.fillStyle = sub;
  let aiLine = '点顶栏 🤖 让 AI 试解';
  if (sim && sim.running) {
    aiLine = `AI 试解中… ${sim.total ? Math.round(sim.done / sim.total * 100) : 0}%`;
  } else if (sim && sim.result) {
    aiLine = sim.result.won
      ? `AI 用鸟 ${sim.result.used}/${sim.result.birdsN} · 剩余 W=${five.W}`
      : `AI 未通关（用鸟 ${sim.result.used}/${sim.result.birdsN}）`;
  }
  ctx.fillText(aiLine, r.x + pad + 68, y + 40);
  ctx.fillText(`豚 ${st.analyze.awake} · 鸟 ${st.analyze.birdsN} · 砰 ${st.analyze.bombN}`,
    r.x + pad + 68, y + 54);
  y += 62 + 12;

  // —— 五维横条 ——
  DIM_LABELS.forEach(([k, label]) => {
    const v = five[k];
    ctx.fillStyle = sub;
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${k} ${label}`, r.x + pad, y + 13);
    const bx = r.x + pad + 56, bw = cw - 56 - 26;
    ctx.fillStyle = '#E3E8F0';
    roundRect(ctx, bx, y + 3, bw, 10, 5); ctx.fill();
    if (v != null) {
      ctx.fillStyle = tier.color;
      roundRect(ctx, bx, y + 3, Math.max(4, bw * v / 5), 10, 5); ctx.fill();
    }
    ctx.fillStyle = v != null ? ink : '#9AA7B8';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(v != null ? String(v) : '—', r.x + r.w - pad, y + 13);
    y += 26;
  });
  y += 6;

  // —— 指纹 ——
  sectionLabel(ctx, r.x + pad, y, '指纹', sub); y += 16;
  ctx.fillStyle = sub;
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'left';
  for (const ln of wrapCn(st.fingerprint, 10, cw)) {
    ctx.fillText(ln, r.x + pad, y + 10);
    y += 14;
  }
  y += 8;

  // —— 击杀组 ——
  sectionLabel(ctx, r.x + pad, y, '击杀组（爆波连通）', sub); y += 16;
  const multi = st.groups.filter(g => g.members.length >= 2);
  if (!multi.length) {
    ctx.fillStyle = sub; ctx.font = '11px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('无多豚组：每只章鱼都需单独击杀', r.x + pad, y + 11);
    y += 18;
  } else {
    for (const g of multi) {
      ctx.fillStyle = GROUP_COLORS[(g.id - 1) % GROUP_COLORS.length];
      ctx.beginPath(); ctx.arc(r.x + pad + 5, y + 6, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = ink; ctx.font = '11px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(`组${g.id}：${g.members.length} 豚可被一发砰砰覆盖`, r.x + pad + 16, y + 10);
      y += 18;
    }
  }
  y += 6;

  // —— 滚球连坐 ——
  if (st.rollPairs.length) {
    sectionLabel(ctx, r.x + pad, y, '滚球连坐', sub); y += 16;
    for (const [i, j] of st.rollPairs) {
      ctx.fillStyle = ink; ctx.font = '11px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(`豚${i} × 豚${j} 贴地 ≤60px → 一鸟连坐`, r.x + pad, y + 10);
      y += 18;
    }
    y += 6;
  }

  // —— 设计预警 ——
  if (st.warnings.length) {
    sectionLabel(ctx, r.x + pad, y, '设计预警', sub); y += 16;
    for (const w of st.warnings) {
      ctx.fillStyle = '#C0392B';
      ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText('⚠', r.x + pad, y + 10);
      ctx.fillStyle = '#7B3A32';
      ctx.font = '11px sans-serif';
      for (const ln of wrapCn(w.msg, 11, cw - 18)) {
        ctx.fillText(ln, r.x + pad + 18, y + 10);
        y += 15;
      }
      y += 6;
    }
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

module.exports = { drawEditor };