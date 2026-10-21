/**
 * 广告模块 - 激励视频 / 插屏 / Banner
 * Ads - rewarded video, interstitial and banner, all with graceful degradation.
 *
 * ⚠️ 上线前必做：把 AD_UNIT 里的三个占位 ID 替换为微信公众平台
 *    「流量主 → 广告位管理」中创建的真实广告位 ID（需企业主体 + 开通流量主）。
 *    占位 ID 下加载会失败，模块自动降级为不可用（相关按钮/位次不显示），不影响玩法。
 *
 * 设计原则（点位策略见 docs/product/广告接入_方案_v01_2026-08-31.md）：
 *  - 激励视频：玩家主动、有奖励、eCPM 最高 → 失败复活 / 结算双倍 / 卡关弹道全显
 *  - 插屏：只在「退出关卡回到选关或菜单」时按频次出现，绝不打断 WIN→下一关 的连闯心流
 *  - 底部横幅：只常驻选关页底部，进战斗/结算即隐藏；选关页内容区自动上移避让
 *    ⚠️ 2026 年起微信小游戏后台不再支持新建 Banner 广告位，需创建「原生模板广告」，
 *       代码用 wx.createCustomAd（基础库 2.11.1+）；老基础库回退 wx.createBannerAd。
 *       原生模板是原生组件，层级最高、盖在 Canvas 之上 → 必须靠 bannerInset() 做布局避让。
 *
 * 全部 API 在无 wx / 无流量主 / 预览环境 下静默降级，不抛错。
 */

const AD_UNIT = {
  reward: 'adunit-0000000000000000',       // 激励视频
  interstitial: 'adunit-0000000000000001', // 插屏
  banner: 'adunit-0000000000000002',       // 原生模板（底部横幅）
};

// ── 插屏频控（保守策略，兼顾体验与审核）──────────────────────────
const INTERSTITIAL_WARMUP = 2;          // 本局前 N 次退出关卡不弹（保护首启体验）
const INTERSTITIAL_EVERY_N = 3;         // 之后每 N 次退出弹 1 次
const INTERSTITIAL_MIN_INTERVAL = 60000;// 两次插屏最小间隔（毫秒）
const BANNER_REFRESH_SEC = 30;          // 横幅自动刷新间隔（微信要求 ≥30）
const BANNER_TPL_W = 360;               // 横幅模板 100% 缩放宽（官方口径 360×106）
const BANNER_TPL_H = 106;               // 同比例缩放：height = 106 * (width / 360)

// ── Banner 常驻页面（只放非战斗页，避免遮挡操作区）──────────────
const BANNER_SCREENS = ['LEVEL_SELECT'];

let rewarded = null, rewardedReady = false;
let interstitial = null, interstitialReady = false;
let banner = null, bannerReady = false;
let bannerHeight = 0, bannerVisible = false, bannerScreen = null, bannerToken = 0;

let exitCount = 0;            // 退出关卡次数（插屏计数）
let lastInterstitialAt = 0;   // 上次插屏展示时间

/** 游戏启动时调用一次（三種广告各自 try/catch，互不牵连） */
function init() {
  warnIfPlaceholder();
  initRewarded();
  initInterstitial();
  initBanner();
}

/**
 * 占位 ID 判定：真实 adUnitId 是 `adunit-` + 16 位随机 hex；
 * 模板占位是「一串 0 + 序号」（adunit-0000000000000000 / …0001 / …0002），
 * 这里按「前缀 + 16 位 + 全数字且前 10 位为 0」识别，避免误伤真实 ID。
 */
function isPlaceholderId(id) {
  if (typeof id !== 'string' || id.indexOf('adunit-') !== 0) return true;
  const body = id.slice(7);
  if (body.length !== 16) return true;
  return /^0{10,}\d*$/.test(body);
}

/**
 * 占位 ID 自检：三个 ID 只要还是模板占位，就明确告警。
 * 占位 ID 不会产生任何收益（且会拉低账号填充率/质量分），
 * 这里不静默禁用（避免掩盖配置问题），但保证开发者能在控制台第一眼看到。
 */
function warnIfPlaceholder() {
  const bad = Object.keys(AD_UNIT).filter((k) => isPlaceholderId(AD_UNIT[k]));
  if (bad.length) {
    try {
      console.warn('[ad] 广告位 ID 仍是占位符：' + bad.join(' / ') +
        '。广告不会产生任何收益，上线前必须在公众平台「流量主 → 广告位管理」创建后替换 src/ad.js 的 AD_UNIT。');
    } catch (e) { /* 无 console 环境忽略 */ }
  }
}

// ============================================================
// 激励视频
// ============================================================

function initRewarded() {
  try {
    if (typeof wx !== 'undefined' && typeof wx.createRewardedVideoAd === 'function') {
      rewarded = wx.createRewardedVideoAd({ adUnitId: AD_UNIT.reward });
      rewarded.onError(() => { rewardedReady = false; });
      rewardedReady = true;
      // 提前拉取素材：玩家点「看广告」时才 load 很可能来不及（尤其弱网），
      // 提前预热能显著提高展示成功率与填充率。失败不影响后续 show 里重试。
      try { rewarded.load().catch(() => {}); } catch (e) { /* 老基础库无 load 或同步抛错 */ }
    }
  } catch (e) {
    rewarded = null;
    rewardedReady = false;
  }
}

/** 激励视频是否可用（不可用时不应展示广告按钮） */
function available() {
  return rewardedReady && !!rewarded;
}

/**
 * 播放激励视频。
 * @param {Function} onReward 完整看完，发放奖励
 * @param {Function} [onSkip] 中途关闭或加载失败（无奖励）
 */
function show(onReward, onSkip) {
  if (!available()) {
    if (onSkip) onSkip();
    return;
  }
  const closeHandler = (res) => {
    try { rewarded.offClose(closeHandler); } catch (e) {}
    if (res && res.isEnded) {
      if (onReward) onReward();
    } else if (onSkip) {
      onSkip();
    }
  };
  try {
    rewarded.onClose(closeHandler);
    rewarded.show().catch(() => {
      rewarded.load()
        .then(() => rewarded.show())
        .catch(() => {
          try { rewarded.offClose(closeHandler); } catch (e) {}
          if (onSkip) onSkip();
        });
    });
  } catch (e) {
    try { rewarded.offClose(closeHandler); } catch (e2) {}
    if (onSkip) onSkip();
  }
}

// ============================================================
// 插屏广告
// ============================================================

function initInterstitial() {
  try {
    if (typeof wx !== 'undefined' && typeof wx.createInterstitialAd === 'function') {
      interstitial = wx.createInterstitialAd({ adUnitId: AD_UNIT.interstitial });
      interstitial.onError(() => { interstitialReady = false; });
      interstitial.onClose(() => {
        // 插屏关闭后按当前页面恢复 Banner（若在战斗中则保持隐藏）
        applyBanner(bannerScreen, true);
      });
      interstitialReady = true;
    }
  } catch (e) {
    interstitial = null;
    interstitialReady = false;
  }
}

/**
 * 「退出关卡」埋点：从关卡内（含结算页）返回选关/菜单时调用。
 * 内部做频控，不满足条件直接返回 false（调用方无需判断）。
 * @returns {boolean} 本次是否真的展示了插屏
 */
function onLevelExit() {
  exitCount++;
  if (!interstitialReady || !interstitial) return false;
  if (exitCount <= INTERSTITIAL_WARMUP) return false;         // 首启保护
  if (exitCount % INTERSTITIAL_EVERY_N !== 0) return false;   // 每 N 次 1 次
  const now = Date.now();
  if (now - lastInterstitialAt < INTERSTITIAL_MIN_INTERVAL) return false; // 冷却
  lastInterstitialAt = now;
  return showInterstitial();
}

/** 插屏是否可用 */
function interstitialAvailable() {
  return interstitialReady && !!interstitial;
}

function showInterstitial() {
  if (!interstitialAvailable()) return false;
  try {
    // 与 Banner 互斥：插屏展示期间隐藏 Banner，避免叠放触发审核风险
    hideBanner();
    interstitial.show().catch(() => {
      interstitial.load().then(() => interstitial.show()).catch(() => {});
    });
    return true;
  } catch (e) {
    return false;
  }
}

/** 重置频控（测试用） */
function resetFrequency() {
  exitCount = 0;
  lastInterstitialAt = 0;
}

// ============================================================
// Banner 广告
// ============================================================

function initBanner() {
  try {
    if (typeof wx === 'undefined') return;
    const info = windowInfo();
    const w = Math.min(info.width, BANNER_TPL_W);   // 不超过模板 100% 宽度，也不超过屏宽
    const estH = Math.round(BANNER_TPL_H * (w / BANNER_TPL_W));
    bannerHeight = estH;                            // 先给一个估算值，onResize 后修正
    const style = { left: (info.width - w) / 2, top: info.height - estH, width: w };

    // 优先原生模板广告（现行唯一可新建的横幅形态），老基础库回退 BannerAd
    if (typeof wx.createCustomAd === 'function') {
      banner = wx.createCustomAd({ adUnitId: AD_UNIT.banner, adIntervals: BANNER_REFRESH_SEC, style });
    } else if (typeof wx.createBannerAd === 'function') {
      banner = wx.createBannerAd({ adUnitId: AD_UNIT.banner, adIntervals: BANNER_REFRESH_SEC, style });
    } else {
      return;
    }

    banner.onError(() => {
      bannerReady = false; banner = null; bannerVisible = false; bannerHeight = 0;
    });
    // 真实高度由微信回调给出（模板/机型不同高度不同）：据此贴底并回传给布局避让
    banner.onResize((res) => {
      if (res && res.height) bannerHeight = res.height;
      try {
        banner.style = {
          left: (info.width - w) / 2,
          top: info.height - bannerHeight,
          width: w,
        };
      } catch (e) { /* 部分基础库不支持改 style，忽略 */ }
    });
    bannerReady = true;
  } catch (e) {
    banner = null;
    bannerReady = false;
    bannerHeight = 0;
  }
}

function windowInfo() {
  let info = { width: 375, height: 667 };
  try {
    if (typeof wx !== 'undefined') {
      const s = (typeof wx.getWindowInfo === 'function')
        ? wx.getWindowInfo()
        : (typeof wx.getSystemInfoSync === 'function' ? wx.getSystemInfoSync() : null);
      if (s) {
        info.width = s.windowWidth || s.screenWidth || info.width;
        info.height = s.windowHeight || s.screenHeight || info.height;
      }
    }
  } catch (e) { /* 保持默认 */ }
  return info;
}

/** 每帧调用：按当前界面状态决定 Banner 显隐（内部做状态去重，不会每帧操作） */
function syncBanner(state) {
  applyBanner(state, false);
}

function applyBanner(state, force) {
  if (!force && state === bannerScreen) return;
  bannerScreen = state;
  if (!bannerReady || !banner) { bannerVisible = false; return; }
  if (BANNER_SCREENS.indexOf(state) >= 0) {
    // token 机制：show() 是异步的，期间若已切走（hideBanner 会自增 token），
    // 迟到的回调不得再把它显示为可见，否则会遮挡战斗画面。
    const token = ++bannerToken;
    bannerVisible = true; // 乐观置位：布局立刻预留避让空间
    try {
      banner.show()
        .then(() => { if (token === bannerToken) bannerVisible = true; })
        .catch(() => { if (token === bannerToken) bannerVisible = false; });
    } catch (e) {
      bannerVisible = false;
    }
  } else {
    hideBanner();
  }
}

function hideBanner() {
  bannerToken++;           // 作废可能还在飞行中的 show() 回调
  bannerVisible = false;
  if (bannerReady && banner) {
    try { banner.hide(); } catch (e) { /* 忽略 */ }
  }
}

/**
 * 布局避让：Banner 可见时返回其高度（逻辑 px），否则 0。
 * 选关页据此上移内容区底部与「返回」按钮，避免被 Banner 遮挡。
 */
function bannerInset() {
  return bannerVisible ? bannerHeight : 0;
}

module.exports = {
  init,
  // 激励视频
  available,
  show,
  // 插屏
  onLevelExit,
  interstitialAvailable,
  resetFrequency,
  // Banner
  syncBanner,
  bannerInset,
};
