/**
 * 造关师渲染 - 编辑器画面绘制（顶栏/底栏/网格预览/问题红圈/草稿实体）。
 * Editor rendering.
 * 注意：底栏 84px 落在海床线（GROUND_Y = H-90）以下沙土区，世界正常渲染、
 * 触摸不做坐标变换（spec §5 的 translate 经核实不必要）。
 */
'use strict';

const C = require('./config.js');
const E = require('./entities.js');
const RENDERER = require('./renderer.js');
const EDITOR = require('./editor.js');

const { TABS, PALETTE, BAR_H, TAB_H, CHIP, CHIP_GAP, ZONE_X } = EDITOR;

/** 物料 chip 的主题色块（方块按材质、敌人/道具按语义） */
function chipColor(item) {
  if (item.kind === 'block') {
    return { wood: '#B07A4A', stone: '#8A8F98', ice: '#9FD8E8', burst: '#E8654B' }[item.type] || '#B07A4A';
  }
  if (item.kind === 'pig') return '#B76BD6';   // 章鱼紫
  if (item.kind === 'bird') return '#F2A03D';  // 河豚橙
  if (item.kind === 'pearl') return '#F6E7A1'; // 珍珠金
  return '#D66B6B';                            // 橡皮红
}

function drawEditor(game) {
  const ctx = game.ctx;
  const d = game.editor;
  if (!d) return;
  const W = C.SCREEN_WIDTH;
  const H = C.SCREEN_HEIGHT;
  const barTop = H - BAR_H;

  // 1. 世界背景（海洋/海床照常用，底栏盖在沙土区上）
  RENDERER.drawBackground(game);

  // 弹弓禁放区提示（淡色虚线 + 文案），不画弹弓/弹道
  ctx.save();
  ctx.strokeStyle = 'rgba(255,120,120,0.55)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(ZONE_X, 44);
  ctx.lineTo(ZONE_X, C.GROUND_Y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255,120,120,0.7)';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('弹弓区·禁放', ZONE_X / 2, 90);
  ctx.restore();

  // 2. 草稿实体（方块/章鱼是实体实例，直接 draw；珍珠用同款 drawPearl）
  for (const b of d.draft.blocks) b.draw(ctx);
  for (const p of d.draft.pigs) p.draw(ctx);
  for (const p of d.draft.pearls) E.drawPearl(ctx, p.x, p.y, 9, game.frameCount);
  // 候飞豚队列（编辑器里全部排队列网格，不站弹弓）
  for (let i = 0; i < d.draft.birds.length; i++) {
    const pos = EDITOR.queueBirdPos(i);
    E.drawBirdMini(ctx, pos.x, pos.y, 15, d.draft.birds[i]);
  }

  // 3. 选中高亮（拖动中半透明）
  if (d.selected && !d.drag) {
    drawSelection(ctx, d);
  }

  // 4. 网格吸附预览（选中物料 + 手指在世界区）
  if (d.palette && d.touchY < barTop && d.touchY > 44) {
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

  // 6. 顶栏 44px
  ctx.save();
  ctx.fillStyle = 'rgba(18,40,66,0.92)';
  ctx.fillRect(0, 0, W, 44);
  // 校验灯文案
  const n = d.issues.length;
  const issuesBtn = game.buttons.editorIssues;
  if (issuesBtn) {
    issuesBtn.text = n ? `🔴 ${n} 个问题` : (d.proven ? '🟢 已通关可分享' : '🟢 可试玩');
    issuesBtn.color = n ? '#8A3B3B' : '#2F6E55';
    issuesBtn.draw(ctx);
  }
  game.buttons.editorExit && game.buttons.editorExit.draw(ctx);
  const playBtn = game.buttons.editorPlay;
  if (playBtn) {
    playBtn.locked = n > 0; // 有问题置灰
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

  // 7. 底栏 84px
  ctx.save();
  ctx.fillStyle = 'rgba(18,40,66,0.96)';
  ctx.fillRect(0, barTop, W, BAR_H);
  // tab 行
  const tabW = W / TABS.length;
  ctx.textAlign = 'center';
  ctx.font = '14px sans-serif';
  TABS.forEach((t, i) => {
    const cx = i * tabW + tabW / 2;
    if (d.tab === t.id) {
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(i * tabW + 4, barTop + 3, tabW - 8, TAB_H - 6);
      ctx.fillStyle = '#FFFFFF';
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
    }
    ctx.fillText(t.label, cx, barTop + 19);
  });
  // 物料行（横滚裁剪）
  ctx.beginPath();
  ctx.rect(0, barTop + TAB_H, W, BAR_H - TAB_H);
  ctx.clip();
  const items = PALETTE[d.tab] || [];
  items.forEach((item, j) => {
    const cx = 8 + j * (CHIP + CHIP_GAP) + CHIP / 2 - d.scrollX;
    const cy = barTop + TAB_H + (BAR_H - TAB_H) / 2;
    const active = d.palette && d.palette.id === item.id || (d.eraser && item.id === 'eraser');
    ctx.fillStyle = active ? '#FFFFFF' : 'rgba(255,255,255,0.12)';
    roundRect(ctx, cx - CHIP / 2, cy - 23, CHIP, 46, 8);
    ctx.fill();
    // 图标：河豚用 mini 形象；其余画色块；珍珠画金圆；橡皮画红块
    if (item.kind === 'bird') {
      E.drawBirdMini(ctx, cx, cy - 6, 12, item.type);
    } else if (item.kind === 'pearl') {
      E.drawPearl(ctx, cx, cy - 6, 9, game.frameCount);
    } else {
      ctx.fillStyle = chipColor(item);
      const sz = item.kind === 'pig' ? 16 : 18;
      if (item.kind === 'pig') {
        ctx.beginPath(); ctx.arc(cx, cy - 6, sz / 2, 0, Math.PI * 2); ctx.fill();
      } else {
        roundRect(ctx, cx - sz / 2, cy - 6 - sz / 2, sz, sz, 4);
        ctx.fill();
      }
    }
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '11px sans-serif';
    ctx.fillText(item.label, cx, cy + 18);
  });
  ctx.restore();

  // 选中态操作提示（底栏上方一行小字）
  if (d.selected) {
    ctx.save();
    ctx.fillStyle = 'rgba(18,40,66,0.85)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('拖动移动 · 橡皮删除 · 点空白取消', W / 2, barTop - 8);
    ctx.restore();
  }
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

/** 手指位置的吸附预览体（合法绿/非法红） */
function drawSnapPreview(ctx, game) {
  const d = game.editor;
  const item = d.palette;
  const x = d.touchX, y = d.touchY;
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#5FD68A';
  if (item.kind === 'block') {
    const bx = Math.round((x - item.w / 2) / 4) * 4;
    const by = Math.round((y - item.h / 2) / 4) * 4;
    if (bx < ZONE_X) ctx.fillStyle = '#E86060';
    ctx.fillRect(bx, by, item.w, item.h);
  } else if (item.kind === 'pig') {
    if (x - item.radius < ZONE_X) ctx.fillStyle = '#E86060';
    ctx.beginPath(); ctx.arc(Math.round(x / 4) * 4, y, item.radius, 0, Math.PI * 2); ctx.fill();
  } else if (item.kind === 'pearl') {
    if (x - 9 < ZONE_X) ctx.fillStyle = '#E86060';
    ctx.beginPath(); ctx.arc(Math.round(x / 4) * 4, Math.round(y / 4) * 4, 9, 0, Math.PI * 2); ctx.fill();
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
