/**
 * 社交分享模块 - 封装微信小游戏分享能力
 * Social Sharing - wraps wx share APIs with graceful degradation.
 *
 * 设计:
 *  - 被动分享：右上角菜单转发（showShareMenu + onShareAppMessage）。
 *  - 主动分享：结算页按钮调起分享面板（shareAppMessage），标题带关卡/星级战绩。
 *  - 分享链接带 query（level=N），好友点击可直达对应关卡。
 *  - 浏览器预览/未登录环境全部安全降级（no-op）。
 */

/** 运行环境是否支持分享 API */
function available() {
  try {
    return typeof wx !== 'undefined' && typeof wx.showShareMenu === 'function';
  } catch (e) {
    return false;
  }
}

/**
 * 初始化分享。游戏启动时调用一次。
 * @param {Function} getDefaultData 返回默认分享文案的回调（可读取当前进度）
 */
function init(getDefaultData) {
  if (!available()) return;
  try {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline'],
    });
    // 被动分享（右上角转发菜单）
    if (typeof wx.onShareAppMessage === 'function') {
      wx.onShareAppMessage(() => getDefaultData());
    }
  } catch (e) {
    // 降级：无分享能力不影响游戏
  }
}

/**
 * 主动分享战绩（结算页分享按钮）。
 * @param {number} levelIndex 关卡下标（0 起）；-1 表示每日挑战
 * @param {number} stars 本关星级
 */
function shareResult(levelIndex, stars) {
  if (!available() || typeof wx.shareAppMessage !== 'function') return;
  try {
    if (levelIndex < 0) {
      // 每日挑战：不带直达参数（每日内容按日期生成）
      wx.shareAppMessage({
        title: `我在「冲吧！小河豚」每日挑战拿下 ${stars} 星，今天这关你敢来吗？`,
      });
      return;
    }
    const levelNo = levelIndex + 1;
    wx.shareAppMessage({
      title: `我在「冲吧！小河豚」第 ${levelNo} 关拿下 ${stars} 星，敢来挑战吗？`,
      query: `level=${levelNo}`,
    });
  } catch (e) {
    // 忽略
  }
}

/**
 * 读取启动 query 中的直达关卡（分享卡片点击进入）。
 * @returns {number|null} 关卡下标（0 起），无则 null
 */
function getLaunchLevel() {
  try {
    if (typeof wx === 'undefined' || typeof wx.getLaunchOptionsSync !== 'function') return null;
    const opts = wx.getLaunchOptionsSync();
    const raw = opts && opts.query && opts.query.level;
    const levelNo = parseInt(raw, 10);
    if (!isNaN(levelNo) && levelNo >= 1) return levelNo - 1;
  } catch (e) {
    // 忽略
  }
  return null;
}

/**
 * 分享自制关卡片（挑战流二次分享 / 作者保存并分享）。
 * T6 占位：T7 填充（path 带 levelcode query，标题含成绩/创作署名）。
 */
function shareCustom(code, stars) {
  // T7 实现：wx.shareAppMessage({ title, path: 'game.js?levelcode=' + code })
}

module.exports = { available, init, shareResult, getLaunchLevel, shareCustom };
