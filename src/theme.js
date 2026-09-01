/**
 * 可爱主题绘制工具 - 马卡龙海底风格的共享「画法」
 * Cute theme drawing helpers (macaron ocean style).
 *
 * 约定：
 *  - 本模块只收口「怎么画得可爱」，不持有色值——颜色唯一来源是 config.js 的 COLORS；
 *  - 依赖方向 entities/renderer → theme → config，严禁 require entities（循环依赖）；
 *  - 所有函数纯绘制、无状态，以 ctx 为首参；调用方自行保证 save/restore 配对。
 */

const C = require('./config.js');

/** 粗圆角描边快捷设置（可爱风的轮廓语言：圆头、圆角、略粗） */
function strokeCute(ctx, width, color) {
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
}

/** 腮红：半透明粉椭圆，画在眼睛下方两侧（x/y 为一侧中心，r 为大致半径） */
function drawBlush(ctx, x, y, r) {
  ctx.save();
  ctx.fillStyle = 'rgba(255, 158, 158, 0.5)';
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** 椭圆高光（默认白色，斜置仿受光面） */
function drawHighlight(ctx, x, y, rx, ry, color) {
  ctx.save();
  ctx.fillStyle = color || '#FFFFFF';
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry || rx, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * 四角星（Sparkle）：二次元高光/庆祝粒子常用形。
 * 四瓣水滴用二次贝塞尔收束到中心，比五角星更「闪亮」而非「评级」。
 */
function drawStar(ctx, x, y, r, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color || C.COLORS.sparkleGold;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.quadraticCurveTo(0, 0, 0, r);
  ctx.quadraticCurveTo(0, 0, -r, 0);
  ctx.quadraticCurveTo(0, 0, 0, -r);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** 小气泡：白色描边圆 + 左上高光点（弹道预览/残影用，替代旧白点） */
function drawBubble(ctx, x, y, r, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha == null ? 0.8 : alpha;
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  // 左上高光点
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.arc(x - r * 0.32, y - r * 0.32, Math.max(0.7, r * 0.22), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * 蝴蝶结：两个圆瓣 + 中心结 + 两条短飘带。
 * size 为半幅宽度；调用方可先 translate/rotate 再调用（挂在弹弓上时摇摆用）。
 */
function drawBow(ctx, x, y, size, color) {
  ctx.save();
  ctx.translate(x, y);
  const main = color || C.COLORS.slingBand;
  // 飘带（在瓣后面先画）
  ctx.fillStyle = main;
  ctx.beginPath();
  ctx.moveTo(-size * 0.15, size * 0.1);
  ctx.lineTo(-size * 0.55, size * 0.62);
  ctx.lineTo(-size * 0.3, size * 0.7);
  ctx.lineTo(-size * 0.02, size * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(size * 0.15, size * 0.1);
  ctx.lineTo(size * 0.55, size * 0.62);
  ctx.lineTo(size * 0.3, size * 0.7);
  ctx.lineTo(size * 0.02, size * 0.2);
  ctx.closePath();
  ctx.fill();
  // 左右圆瓣
  ctx.fillStyle = main;
  ctx.beginPath();
  ctx.ellipse(-size * 0.42, 0, size * 0.42, size * 0.3, -0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(size * 0.42, 0, size * 0.42, size * 0.3, 0.25, 0, Math.PI * 2);
  ctx.fill();
  // 瓣面高光
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(-size * 0.5, -size * 0.1, size * 0.16, size * 0.1, -0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(size * 0.34, -size * 0.1, size * 0.16, size * 0.1, 0.25, 0, Math.PI * 2);
  ctx.fill();
  // 中心结
  ctx.fillStyle = C.COLORS.ribbonWhite;
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = main;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
}

/**
 * 珍珠珠身（底层画法）：白珠 + 淡粉描边 + 左上高光。
 * 场景珍珠 drawPearl 的光晕/星芒在其外层保留，珠身段委托本函数。
 */
function drawPearlBead(ctx, x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = '#FDFFFE';
  ctx.fill();
  ctx.strokeStyle = 'rgba(244, 143, 177, 0.85)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // 左上高光
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.arc(-r * 0.3, -r * 0.32, r * 0.24, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

module.exports = {
  strokeCute,
  drawBlush,
  drawHighlight,
  drawStar,
  drawBubble,
  drawBow,
  drawPearlBead,
};
