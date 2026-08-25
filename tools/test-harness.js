/**
 * 自动化测试环境 harness - Node 端浏览器/微信 mock + 虚拟时钟
 * Test Harness - browser/WeChat mocks with a virtual clock, for e2e-tests.js.
 *
 * 用法：
 *   const { installEnv, loadGame } = require('./test-harness.js');
 *   installEnv({ rewardAd: true });   // 必须在 loadGame 之前安装
 *   const game = loadGame();          // 首次 require 触发 new Game()
 *   env.pump(10);                     // 推进 10 个渲染帧（虚拟时钟每帧 +16ms）
 *   env.fire('touchstart', x, y);     // 模拟触摸事件
 *
 * 设计：
 *  - 虚拟时钟：Date.now 可控推进，让 gameLoop 的固定 60Hz 步长逻辑真正运转；
 *  - Canvas 全部 Proxy 吞掉（绘制冒烟即可，不校验像素）；
 *  - storage 用内存对象模拟 localStorage（wx.getStorageSync 走 JSON 解析语义）；
 *  - rewardAd: true 时注入"必看成功"的激励视频 mock（复现 DevTools 行为）。
 */

'use strict';

function installEnv(options = {}) {
  const storage = {};

  // ===== Canvas / DOM mock =====
  const canvas = {
    style: {},
    width: 0, height: 0,
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 667 }),
    addEventListener: () => {},
  };
  const ctx = new Proxy({}, {
    get(t, p) {
      if (p === 'createLinearGradient') return () => ({ addColorStop() {} });
      if (p === 'measureText') return () => ({ width: 10 });
      if (p === 'roundRect') return function () { return this; };
      if (p === 'canvas') return canvas;
      return () => {};
    },
    set() { return true; },
  });
  global.window = { devicePixelRatio: 2, innerWidth: 375, innerHeight: 667, addEventListener: () => {} };
  global.document = { getElementById: () => canvas, createElement: () => canvas };
  // Node ≥21 的 global.navigator 为 getter-only，strict mode 下直接赋值会抛错
  try { global.navigator = { vibrate: () => {} }; } catch (e) { /* 已有只读 navigator，保持 */ }
  global.localStorage = {
    getItem: (k) => (k in storage ? storage[k] : null),
    setItem: (k, v) => { storage[k] = String(v); },
  };

  // ===== 虚拟时钟（驱动 gameLoop 固定步长 + 双击计时）=====
  let fakeNow = 1000000;
  Date.now = () => fakeNow;
  let pendingCb = null;
  global.requestAnimationFrame = (cb) => { pendingCb = cb; return 1; };
  global.cancelAnimationFrame = () => {};
  let frameNo = 0;

  /** 推进 n 个渲染帧（每帧虚拟时钟 +16ms，逻辑按 60Hz 步长推进） */
  function pump(n) {
    for (let i = 0; i < n; i++) {
      if (!pendingCb) return;
      const cb = pendingCb; pendingCb = null; frameNo++;
      fakeNow += 16;
      cb(fakeNow);
    }
  }

  // ===== wx API mock =====
  const touchHandlers = {};
  global.wx = {
    createCanvas: () => canvas,
    getSystemInfoSync: () => ({
      screenWidth: 375, screenHeight: 667, devicePixelRatio: 2,
      windowWidth: 375, windowHeight: 667,
    }),
    getStorageSync: (k) => {
      try { return k in storage ? JSON.parse(storage[k]) : null; } catch (e) { return null; }
    },
    setStorageSync: (k, v) => {
      try { storage[k] = JSON.stringify(v); } catch (e) { /* 忽略，与真机语义一致 */ }
    },
    vibrateShort: () => {},
    vibrateLong: () => {},
    onTouchStart: (cb) => { touchHandlers.touchstart = cb; },
    onTouchMove: (cb) => { touchHandlers.touchmove = cb; },
    onTouchEnd: (cb) => { touchHandlers.touchend = cb; },
    onTouchCancel: (cb) => { touchHandlers.touchcancel = cb; },
  };

  // 激励视频 mock：show() 同步回调 onClose({isEnded:true})，即"完整看完发奖励"
  if (options.rewardAd) {
    global.wx.createRewardedVideoAd = () => {
      const closeHandlers = [];
      return {
        onClose: (cb) => closeHandlers.push(cb),
        offClose: (cb) => {
          const i = closeHandlers.indexOf(cb);
          if (i >= 0) closeHandlers.splice(i, 1);
        },
        onError: () => {},
        show: () => {
          closeHandlers.slice().forEach(cb => cb({ isEnded: true }));
          return Promise.resolve();
        },
        load: () => Promise.resolve(),
      };
    };
  }

  /** 模拟触摸事件（touchend/touchcancel 无坐标） */
  function fire(type, x, y) {
    const evt = {
      touches: (type === 'touchend' || type === 'touchcancel') ? [] : [{ clientX: x, clientY: y }],
      changedTouches: [{ clientX: x, clientY: y }],
    };
    if (touchHandlers[type]) touchHandlers[type](evt);
  }

  /** 清空存档并把游戏内存进度恢复为全新档 */
  function resetProgress(game) {
    for (const k of Object.keys(storage)) delete storage[k];
    game.progress = { unlockedLevels: 1, stars: {}, bestScores: {}, hintShown: {}, pearls: {} };
    game.failCounts = {};
  }

  /** 读取底层存储中的进度存档（校验持久化用） */
  function readProgress() {
    try { return JSON.parse(storage.angryBirds_progress); } catch (e) { return null; }
  }

  return { pump, fire, storage, resetProgress, readProgress };
}

/** 加载游戏单例（首次调用触发 new Game()，之后返回同一实例） */
function loadGame() {
  return require('../src/game.js');
}

module.exports = { installEnv, loadGame };
