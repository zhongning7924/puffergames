/**
 * 造关师渲染 - 编辑器画面绘制（顶栏/底栏/网格预览/问题红圈/草稿实体）。
 * Editor rendering.
 *
 * T12-1 地基：GROUND_Y / SAFE_* 实时读 C。
 * T12-2 顶栏：sketch 胶囊退出/试玩 + 4 分类分段控件。
 * T12-3 底栏重做：材质筛选行（blocks 专属）+ 透明井 + 橡皮固定槽 + 72×56 大卡行。
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
  barLayout, visibleItems, floatingBarRect,
  MATERIALS, ERASER_ITEM, FLOAT_BAR,
} = EDITOR;

/** 物料卡的主题色块（方块按材质、敌人/道具按语义；橡皮用粉红） */
function cardColor(item) {
  if (item.kind === 'block') {
    return { wood: '#B07A4A', stone: '#8A8F98', ice: '#9FD8E8', burst: '#E8654B' }[item.type] || '#B07A4A';
  }
  if (item.kind === 'pig') return '#B76BD6';   // 章鱼紫
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

  // 3. 选中高亮（拖动中半透明）
  if (d.selected && !d.drag) {
    drawSelection(ctx, d);
    drawFloatingBar(ctx, d);
  }

  // 4. 网格吸附预览（选中物料 + 手指在世界区；barTop 以下不预览）
  if (d.palette && d.touchY > topH && d.touchY < L.barTop) {
    drawSnapPreview(ctx, game);
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
    E.drawBirdMini(ctx, pos.x, pos.y, 15, d.draft.birds[i]);
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
}

/** 底栏：背景 + 分段控件行 + 材质筛选行 + 橡皮槽 + 大卡行（透明井 x<80 不画任何 UI） */
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

/** blocks 材质子筛选：木/石/冰/果 四段，面板缩进 x≥80 */
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

/** 大卡行：72×56 物料卡，x≥80 横滚裁剪，透明井 x<80 留空 */
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
      E.drawBirdMini(ctx, cx, iconCY, 14, item.type);
    } else if (item.kind === 'pearl') {
      E.drawPearl(ctx, cx, iconCY, 10, game.frameCount);
    } else if (item.kind === 'pig') {
      ctx.fillStyle = cardColor(item);
      ctx.beginPath();
      ctx.arc(cx, iconCY, 14, 0, Math.PI * 2);
      ctx.fill();
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