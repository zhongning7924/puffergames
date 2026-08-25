/**
 * 激励视频广告模块 - 封装 wx.createRewardedVideoAd
 * Rewarded Video Ad - the monetization entry points.
 *
 * ⚠️ 上线前必做：把 AD_UNIT_ID 替换为微信公众平台「流量主 → 广告位管理」
 *    中创建的真实激励视频广告位 ID（需企业主体 + 开通流量主）。
 *    占位 ID 下广告加载会失败，模块自动降级为不可用（相关按钮不显示）。
 *
 * 设计:
 *  - 单例广告实例，onError 后标记不可用；
 *  - show() 带完整回调：看完 → onReward；中途关闭/加载失败 → onSkip；
 *  - 浏览器预览/未开通环境全部安全降级。
 */

// TODO(上线): 替换为真实激励视频广告位 ID
const AD_UNIT_ID = 'adunit-0000000000000000';

let ad = null;
let ready = false;

/** 游戏启动时调用一次 */
function init() {
  try {
    if (typeof wx !== 'undefined' && typeof wx.createRewardedVideoAd === 'function') {
      ad = wx.createRewardedVideoAd({ adUnitId: AD_UNIT_ID });
      ad.onError(() => { ready = false; });
      ready = true;
    }
  } catch (e) {
    ad = null;
    ready = false;
  }
}

/** 广告是否可用（不可用时不应展示广告按钮） */
function available() {
  return ready && !!ad;
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
    try { ad.offClose(closeHandler); } catch (e) {}
    if (res && res.isEnded) {
      if (onReward) onReward();
    } else if (onSkip) {
      onSkip();
    }
  };
  try {
    ad.onClose(closeHandler);
    ad.show().catch(() => {
      // 展示失败时尝试重新加载后再播一次
      ad.load()
        .then(() => ad.show())
        .catch(() => {
          try { ad.offClose(closeHandler); } catch (e) {}
          if (onSkip) onSkip();
        });
    });
  } catch (e) {
    try { ad.offClose(closeHandler); } catch (e2) {}
    if (onSkip) onSkip();
  }
}

module.exports = { init, available, show };
