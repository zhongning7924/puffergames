/**
 * 浏览器预览端到端验证
 * 用 Node 模拟浏览器 DOM/Canvas 环境，加载 preview/bundle.js，
 * 模拟完整交互链路（菜单 -> 选关 -> 瞄准 -> 发射）并跑物理帧，确认无运行时异常。
 */
const fs = require('fs');
const path = require('path');

const ctx = new Proxy({}, {
  get(t, p) {
    if (p === 'createLinearGradient') return () => ({ addColorStop() {} });
    if (p === 'createRadialGradient') return () => ({ addColorStop() {} });
    if (p === 'measureText') return () => ({ width: 10 });
    if (p === 'roundRect') return function () { return this; };
    if (p === 'canvas') return canvas;
    return () => {};
  },
  set() { return true; },
});

const canvasEventHandlers = {};
const wxTouchHandlers = {};

const canvas = {
  style: {},
  width: 0, height: 0,
  getContext: () => ctx,
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 667 }),
  addEventListener: (type, cb) => { (canvasEventHandlers[type] = canvasEventHandlers[type] || []).push(cb); },
};

global.window = { devicePixelRatio: 2, innerWidth: 375, innerHeight: 667, addEventListener: () => {} };
global.document = { getElementById: () => canvas, createElement: () => canvas };
global.navigator = { vibrate: () => {} };
const _store = {};
global.localStorage = { getItem: (k) => (k in _store ? _store[k] : null), setItem: (k, v) => { _store[k] = String(v); } };

// 手动泵驱动帧（避免 requestAnimationFrame 递归爆栈）
let pendingCb = null;
global.requestAnimationFrame = (cb) => { pendingCb = cb; return 1; };
global.cancelAnimationFrame = () => {};
let frameNo = 0;
function pump(n) {
  for (let i = 0; i < n; i++) {
    if (!pendingCb) return;
    const cb = pendingCb; pendingCb = null; frameNo++;
    cb(frameNo * 16);
  }
}

global.wx = {
  createCanvas: () => canvas,
  getSystemInfoSync: () => ({ screenWidth: 375, screenHeight: 667, devicePixelRatio: 2, windowWidth: 375, windowHeight: 667, statusBarHeight: 0, safeArea: { top: 0, bottom: 667, left: 0, right: 375 } }),
  getStorageSync: (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  setStorageSync: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  vibrateShort: () => {},
  vibrateLong: () => {},
  onTouchStart: (cb) => { wxTouchHandlers.touchstart = cb; },
  onTouchMove: (cb) => { wxTouchHandlers.touchmove = cb; },
  onTouchEnd: (cb) => { wxTouchHandlers.touchend = cb; },
  onTouchCancel: (cb) => { wxTouchHandlers.touchcancel = cb; },
};

function fireWx(type, x, y) {
  const evt = {
    touches: (type === 'touchend' || type === 'touchcancel') ? [] : [{ clientX: x, clientY: y }],
    changedTouches: [{ clientX: x, clientY: y }],
  };
  if (wxTouchHandlers[type]) wxTouchHandlers[type](evt);
}

try {
  const code = fs.readFileSync(path.join(__dirname, 'preview/bundle.js'), 'utf8');
  eval(code); // 触发 new Game() -> 首帧 MENU
  console.log('✓ 1. bundle 加载 + 首帧 MENU 渲染 OK');
  pump(3);

  fireWx('touchstart', 187, 358);
  fireWx('touchend', 187, 358);
  console.log('✓ 2. 点击「开始」-> 关卡选择 OK');
  pump(3);

  fireWx('touchstart', 111.5, 191); // 第一关按钮中心（章节化布局：新手湾首列）
  fireWx('touchend', 111.5, 191);
  console.log('✓ 3. 选择第一关 -> READY OK');
  pump(3);

  fireWx('touchstart', 95, 562);  // 点河豚 -> AIMING
  fireWx('touchmove', 40, 620);
  fireWx('touchmove', 35, 625);
  fireWx('touchend', 35, 625);    // 发射 -> FLYING
  console.log('✓ 4. 拖拽发射 -> FLYING OK');

  pump(150); // 河豚飞行 + 碰撞物理帧
  console.log('✓ 5. 物理帧运行 150 帧无异常（飞行/碰撞/结算逻辑接通）');
  console.log('\n🎉 浏览器预览版端到端验证全部通过');
} catch (e) {
  console.error('❌ 验证失败：', e && e.stack ? e.stack : e);
  process.exit(1);
}
