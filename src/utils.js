/**
 * 数学工具函数 - 向量运算、碰撞检测、辅助函数
 * Math Utilities - Vector operations, collision detection, helpers
 */

// ========== 基础数学 Basic Math ==========

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const lerp = (a, b, t) => a + (b - a) * t;

const distance = (x1, y1, x2, y2) => Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));

const dist2 = (x1, y1, x2, y2) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
};

const angle = (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1);

const random = (min, max) => Math.random() * (max - min) + min;

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const map = (v, inMin, inMax, outMin, outMax) => {
  return ((v - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin;
};

// ========== 向量运算 Vector Operations ==========

const vec = {
  create: (x = 0, y = 0) => ({ x, y }),
  add: (a, b) => ({ x: a.x + b.x, y: a.y + b.y }),
  sub: (a, b) => ({ x: a.x - b.x, y: a.y - b.y }),
  mul: (a, s) => ({ x: a.x * s, y: a.y * s }),
  len: (a) => Math.sqrt(a.x * a.x + a.y * a.y),
  normalize: (a) => {
    const l = Math.sqrt(a.x * a.x + a.y * a.y);
    if (l === 0) return { x: 0, y: 0 };
    return { x: a.x / l, y: a.y / l };
  },
  dot: (a, b) => a.x * b.x + a.y * b.y,
};

// ========== 碰撞检测 Collision Detection ==========

/**
 * 圆与圆碰撞检测
 * Circle vs Circle collision
 */
function circleCircle(a, b) {
  const d = distance(a.x, a.y, b.x, b.y);
  const minDist = a.radius + b.radius;
  if (d < minDist) {
    return {
      collided: true,
      normal: { x: d > 0 ? (a.x - b.x) / d : 0, y: d > 0 ? (a.y - b.y) / d : -1 },
      depth: minDist - d,
    };
  }
  return { collided: false };
}

/**
 * 圆与矩形碰撞检测（矩形不旋转）
 * Circle vs AABB (Axis-Aligned Bounding Box) collision
 */
function circleRect(circle, rect) {
  // rect: {x, y, width, height} - 左上角坐标
  const closestX = clamp(circle.x, rect.x, rect.x + rect.width);
  const closestY = clamp(circle.y, rect.y, rect.y + rect.height);

  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  const distSq = dx * dx + dy * dy;

  if (distSq < circle.radius * circle.radius) {
    const dist = Math.sqrt(distSq);
    return {
      collided: true,
      normal: {
        x: dist > 0 ? dx / dist : 0,
        y: dist > 0 ? dy / dist : -1,
      },
      depth: circle.radius - dist,
      point: { x: closestX, y: closestY },
    };
  }
  return { collided: false };
}

/**
 * 矩形与矩形碰撞检测（AABB）
 * AABB vs AABB collision
 */
function rectRect(a, b) {
  if (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  ) {
    // 计算各轴重叠
    const overlapX = Math.min(a.x + a.width - b.x, b.x + b.width - a.x);
    const overlapY = Math.min(a.y + a.height - b.y, b.y + b.height - a.y);

    if (overlapX < overlapY) {
      // 水平方向碰撞
      const dir = a.x + a.width / 2 < b.x + b.width / 2 ? -1 : 1;
      return { collided: true, axis: 'x', overlap: overlapX, direction: dir };
    } else {
      // 垂直方向碰撞
      const dir = a.y + a.height / 2 < b.y + b.height / 2 ? -1 : 1;
      return { collided: true, axis: 'y', overlap: overlapY, direction: dir };
    }
  }
  return { collided: false };
}

// ========== SAT 旋转碰撞（OBB） ==========
// 方块绕自身中心旋转（见 entities.js Block.draw），以下函数按真实朝向检测，
// 替换旧的 getAABB() 近似（旋转方块会穿透/隔空碰撞）。

/** 矩形（可旋转）的四个角点，绕中心旋转 */
function getOBBCorners(rect) {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const hw = rect.width / 2;
  const hh = rect.height / 2;
  const rot = rect.rotation || 0;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const local = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
  return local.map(([lx, ly]) => ({
    x: cx + lx * cos - ly * sin,
    y: cy + lx * sin + ly * cos,
  }));
}

/** 旋转角是否约等于 k·π（此时 OBB 与 AABB 重合，可走快速路径） */
function isAxisAligned(rot) {
  return Math.abs(Math.sin(rot || 0)) < 1e-6;
}

/**
 * 圆与旋转矩形碰撞检测（OBB）
 * 思路：把圆心变换到矩形局部坐标系（绕中心反向旋转），
 * 在局部系做 circle vs AABB，再把法线/接触点旋转回世界系。
 * 返回结构与 circleRect 一致：{ collided, normal, depth, point }
 */
function circleOBB(circle, rect) {
  const rot = rect.rotation || 0;
  if (isAxisAligned(rot)) return circleRect(circle, rect);

  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);

  // 圆心 → 局部坐标
  const dx = circle.x - cx;
  const dy = circle.y - cy;
  const lx = dx * cos + dy * sin;
  const ly = -dx * sin + dy * cos;

  const hw = rect.width / 2;
  const hh = rect.height / 2;
  const closestX = clamp(lx, -hw, hw);
  const closestY = clamp(ly, -hh, hh);
  const ddx = lx - closestX;
  const ddy = ly - closestY;
  const distSq = ddx * ddx + ddy * ddy;

  if (distSq >= circle.radius * circle.radius) return { collided: false };

  let nx, ny, depth;
  if (distSq > 1e-12) {
    const dist = Math.sqrt(distSq);
    nx = ddx / dist;
    ny = ddy / dist;
    depth = circle.radius - dist;
  } else {
    // 圆心在矩形内部：沿最小穿透面推出
    const px = hw - Math.abs(lx);
    const py = hh - Math.abs(ly);
    if (px < py) {
      nx = lx >= 0 ? 1 : -1; ny = 0; depth = circle.radius + px;
    } else {
      nx = 0; ny = ly >= 0 ? 1 : -1; depth = circle.radius + py;
    }
  }

  // 局部法线/接触点 → 世界坐标（正向旋转）
  return {
    collided: true,
    normal: { x: nx * cos - ny * sin, y: nx * sin + ny * cos },
    depth,
    point: {
      x: cx + closestX * cos - closestY * sin,
      y: cy + closestX * sin + closestY * cos,
    },
  };
}

/**
 * 旋转矩形 vs 旋转矩形碰撞检测（分离轴定理 SAT）
 * 在 4 条候选分离轴（两个矩形各自的边法线）上投影，全部重叠才判定碰撞。
 * 返回结构与 rectRect 一致：{ collided, axis: 'x'|'y', overlap, direction }
 * —— 最小穿透轴映射到最近的世界主轴，保持调用方的分离响应逻辑不变。
 */
function obbObb(a, b) {
  // 快速路径：两者都轴对齐 → AABB 检测
  if (isAxisAligned(a.rotation) && isAxisAligned(b.rotation)) {
    return rectRect(a, b);
  }

  const ca = getOBBCorners(a);
  const cb = getOBBCorners(b);

  // 候选分离轴：每个矩形两条邻边的法线
  const axes = [];
  for (const corners of [ca, cb]) {
    for (let i = 0; i < 2; i++) {
      const p1 = corners[i];
      const p2 = corners[(i + 1) % 4];
      const ex = p2.x - p1.x;
      const ey = p2.y - p1.y;
      const len = Math.hypot(ex, ey) || 1;
      axes.push({ x: -ey / len, y: ex / len });
    }
  }

  let minOverlap = Infinity;
  let mtv = null;
  for (const axis of axes) {
    let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity;
    for (const p of ca) {
      const d = p.x * axis.x + p.y * axis.y;
      if (d < minA) minA = d;
      if (d > maxA) maxA = d;
    }
    for (const p of cb) {
      const d = p.x * axis.x + p.y * axis.y;
      if (d < minB) minB = d;
      if (d > maxB) maxB = d;
    }
    const overlap = Math.min(maxA, maxB) - Math.max(minA, minB);
    if (overlap <= 0) return { collided: false }; // 找到分离轴
    if (overlap < minOverlap) {
      minOverlap = overlap;
      mtv = axis;
    }
  }

  // 映射到最近的世界主轴（分离响应按帧迭代收敛，斜轴近似可接受）
  const acx = a.x + a.width / 2;
  const acy = a.y + a.height / 2;
  const bcx = b.x + b.width / 2;
  const bcy = b.y + b.height / 2;
  const axis = Math.abs(mtv.x) >= Math.abs(mtv.y) ? 'x' : 'y';
  const direction = (axis === 'x' ? acx - bcx : acy - bcy) < 0 ? -1 : 1;
  return { collided: true, axis, overlap: minOverlap, direction };
}

/**
 * 判断点是否在矩形内
 * Point in rectangle test
 */
function pointInRect(px, py, rect) {
  return (
    px >= rect.x &&
    px <= rect.x + rect.width &&
    py >= rect.y &&
    py <= rect.y + rect.height
  );
}

/**
 * 判断点是否在圆内
 * Point in circle test
 */
function pointInCircle(px, py, circle) {
  return dist2(px, py, circle.x, circle.y) < circle.radius * circle.radius;
}

/**
 * 手绘圆角矩形路径（不依赖 ctx.roundRect，兼容微信小游戏真机）
 * Draw rounded-rect path using only arcTo (works on all Canvas2D implementations)
 * 注意：调用前需先 ctx.beginPath()，调用后由调用方 fill/stroke
 */
function roundRectPath(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

module.exports = {
  clamp,
  lerp,
  distance,
  dist2,
  angle,
  random,
  randomInt,
  map,
  vec,
  circleCircle,
  circleRect,
  circleOBB,
  obbObb,
  getOBBCorners,
  rectRect,
  pointInRect,
  pointInCircle,
  roundRectPath,
};
