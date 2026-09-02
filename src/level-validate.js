/**
 * 关卡几何校验 - 纯函数，供编辑器与 CLI 复用
 * Level validation - pure function, shared by editor and CLI validator.
 *
 * 注：章王 Boss / sleep 阶段物为官方战役专属，不在此模块校验（CLI 另行检查）。
 */

'use strict';

const C = require('./config.js');
const PEARL_R = 9;          // 珍珠碰撞半径（与 game.checkPearlCollection 一致）
const BIRD_DISP_R = 17 * 0.85; // 候飞队列豚显示半径（越屏检查用）
const LIMITS = require('./level-codec.js').LIMITS;

/** 圆-矩形距离（珍珠 vs 方块用；utils.circleRect 需 rect 朝向，关卡数据无旋转，直接算） */
function circleRectDist(px, py, r) {
  const cx = Math.max(r.x, Math.min(px, r.x + r.width));
  const cy = Math.max(r.y, Math.min(py, r.y + r.height));
  return Math.hypot(px - cx, py - cy);
}

function validateLevel(level, opts) {
  const editor = !!(opts && opts.editor); // 编辑器专属检查（计数/禁区）仅编辑器模式启用
  const issues = [];
  const push = (kind, x, y, msg) => issues.push({ kind, x, y, msg });
  const pigs = level.pigs || [];
  const blocks = level.blocks || [];
  const pearls = level.pearls || [];
  const birdCount = Array.isArray(level.birds) ? level.birds.length : (level.birds || 0);
  const SW = C.SCREEN_WIDTH;
  const GY = C.GROUND_Y;
  const ZONE = SW * 0.33;

  // —— 编辑器专属：计数 / 禁区（CLI 跑官方关时跳过）——
  if (editor) {
    if (pigs.length === 0) push('no-pig', 0, 0, '至少放 1 只章鱼');
    if (birdCount < 1 || birdCount > 6) push('bird-count', 0, 0, '河豚数量需 1~6 只');
    if (blocks.length > LIMITS.blocks) push('block-limit', 0, 0, '方块超过 40 个');
    if (pigs.length > LIMITS.pigs) push('pig-limit', 0, 0, '章鱼超过 10 只');
    if (pearls.length > LIMITS.pearls) push('pearl-limit', 0, 0, '珍珠超过 2 颗');
    // 禁区判定一律按"实体左缘"（与编辑器放置拒绝逻辑一致）
    blocks.forEach((b, i) => {
      if (b.x < ZONE) push('no-build-zone', b.x, b.y, `方块${i}在弹弓禁区`);
    });
    pigs.forEach((p, i) => {
      if (p.x - p.radius < ZONE) push('no-build-zone', p.x, p.y, `章鱼${i}在弹弓禁区`);
    });
    pearls.forEach((p, i) => {
      if (p.x - PEARL_R < ZONE) push('no-build-zone', p.x, p.y, `珍珠${i}在弹弓禁区`);
    });
  }

  // —— 几何检查（搬自 tools/validate-levels.js checkGeometry）——

  // 章鱼-章鱼互叠
  pigs.forEach((a, i) => {
    pigs.forEach((b, j) => {
      if (j <= i) return;
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      if (d < a.radius + b.radius - 0.01) {
        push('pig-overlap', a.x, a.y,
          `章鱼${i}与章鱼${j}互叠（距离 ${d.toFixed(1)} < ${a.radius + b.radius}）`);
      }
    });
  });

  // 章鱼越界（屏幕左右缘 / 沉入地面）
  pigs.forEach((p, i) => {
    if (p.x - p.radius < 0 || p.x + p.radius > SW) {
      push('pig-bounds', p.x, p.y, `章鱼${i}水平越界 x=${p.x}`);
    }
    if (p.y + p.radius > GY + 0.01) {
      push('pig-ground', p.x, p.y, `章鱼${i}沉入地面 y=${p.y}`);
    }
  });

  // 方块-方块互叠
  blocks.forEach((a, i) => {
    blocks.forEach((b, j) => {
      if (j <= i) return;
      const overlap = a.x < b.x + b.width - 0.01 && b.x < a.x + a.width - 0.01 &&
        a.y < b.y + b.height - 0.01 && b.y < a.y + a.height - 0.01;
      if (overlap) {
        push('block-overlap', a.x, a.y, `方块${i}(${a.type})与方块${j}(${b.type})互叠`);
      }
    });
  });

  // 方块越界
  blocks.forEach((b, i) => {
    if (b.x < 0 || b.x + b.width > SW) {
      push('block-bounds', b.x, b.y, `方块${i}(${b.type})水平越界 x=${b.x}`);
    }
    if (b.y + b.height > GY + 0.01) {
      push('block-ground', b.x, b.y, `方块${i}(${b.type})沉入地面 y=${b.y}`);
    }
  });

  // 珍珠：越界 / 嵌入方块（不可达）/ 贴章鱼（会被误拾）
  pearls.forEach((p, i) => {
    const tag = p.id != null ? `(${p.id})` : ''; // 自定义珍珠无 id
    if (p.x - PEARL_R < 0 || p.x + PEARL_R > SW || p.y - PEARL_R < 0) {
      push('pearl-bounds', p.x, p.y, `珍珠${i}${tag}越界 x=${p.x} y=${p.y}`);
    }
    blocks.forEach((b, j) => {
      if (circleRectDist(p.x, p.y, b) < PEARL_R - 0.01) {
        push('pearl-in-block', p.x, p.y, `珍珠${i}${tag}嵌入方块${j}(${b.type})，不可达`);
      }
    });
    pigs.forEach((q, j) => {
      if (Math.hypot(p.x - q.x, p.y - q.y) < PEARL_R + q.radius) {
        push('pearl-on-pig', p.x, p.y, `珍珠${i}${tag}贴着章鱼${j}，开局即误拾`);
      }
    });
  });

  // 豚队列站位（越屏回归：单排 28px 间距曾导致 5-6 只豚出屏）
  for (let i = 0; i < birdCount - 1; i++) { // 弹弓上那只不算
    const x = C.SLINGSHOT_X - 35 - (i % 3) * 21;
    if (x - BIRD_DISP_R < 0) {
      push('bird-offscreen', x, GY - 110, `候飞豚 #${i} 越出左缘 x=${x}`);
    }
  }

  return { ok: issues.length === 0, issues };
}

module.exports = { validateLevel };
