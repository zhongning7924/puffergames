/**
 * 官卡数据源模块 - 本地原始兜底 + 远端版本下发 + 一键恢复
 * Official level source: local original backup + remote version dispatch + restore.
 *
 * 需求（2026-10-20）：
 *  1. 原始官卡数据始终在用户本地存一份（原始副本，绝不被远端覆盖）；
 *  2. 服务器下发新版本号时，提醒用户「官卡玩法已更新」；
 *  3. 用户可随时把活动官卡恢复回「原始（随包内置）」数据。
 *
 * 三层数据模型：
 *  - 内置 builtin：随游戏二进制打包的 40 关（levels.getLevels()），是「原始」的来源；
 *  - 原始副本 original：首次启动/二进制版本升级时，把内置官卡落盘到本地存储，
 *    作为「原始」的持久兜底（远端更新不会碰它）；
 *  - 活动副本 active：当前实际生效的官卡（= 内置，或被远端下发的版本覆盖）。
 *
 * 远端契约：GET REMOTE_URL → { version: number, data: Level[] }。
 * 仅当 payload.version > 当前活动版本且 data 通过形状校验时才采纳。
 *
 * 全部 wx API 在无 wx / 预览 / 网络失败环境下静默降级，不抛错、不影响玩法。
 */
'use strict';

const { getLevels } = require('./levels.js');
const C = require('./config.js');

/** 内置官卡版本号：每次修改 levels.js 的关卡数据时 +1（驱动「原始副本」刷新） */
const BUILTIN_VERSION = 1;

/** 本地存储键 */
const ACTIVE_KEY = 'angryBirds_official_active';
const ORIGINAL_KEY = 'angryBirds_official_original';
/** 用户点过「恢复原版」后记住当时被拒的远端版本，避免下次启动又被推回来 */
const DISMISS_KEY = 'angryBirds_official_dismissed';

/** 远端下发端点（留空 = 不启用远端下发，仅本地兜底 + 恢复能力可用） */
let REMOTE_URL = '';
/** 是否已被显式指定过端点（显式指定优先于 config 默认值，便于测试与环境切换） */
let urlSettled = false;

// ==================== 存储 ====================

function storageGet(key) {
  try {
    if (typeof wx === 'undefined' || typeof wx.getStorageSync !== 'function') return null;
    const v = wx.getStorageSync(key);
    return v && typeof v === 'object' ? v : null;
  } catch (e) { return null; }
}
function storageSet(key, v) {
  try {
    if (typeof wx === 'undefined' || typeof wx.setStorageSync !== 'function') return;
    wx.setStorageSync(key, v);
  } catch (e) { /* 存储满/不可用：静默 */ }
}
/** 读标量值（版本号存的是 number，不能用上面的对象过滤器） */
function storageGetRaw(key) {
  try {
    if (typeof wx === 'undefined' || typeof wx.getStorageSync !== 'function') return null;
    const v = wx.getStorageSync(key);
    return (v === '' || v === null || v === undefined) ? null : v;
  } catch (e) { return null; }
}

// ==================== 状态 ====================

const state = {
  activeVersion: BUILTIN_VERSION,
  originalVersion: BUILTIN_VERSION,
  usingRemote: false,
  pendingUpdate: null, // { version }：本会话新采纳了远端版本，等 UI 提醒
};

/** 校验关卡数据形状（必须是数组且每关含 birds/pigs 数组），防坏数据覆盖本地 */
function isValidLevels(data) {
  return Array.isArray(data) && data.length > 0 &&
    data.every(lv => lv && Array.isArray(lv.birds) && Array.isArray(lv.pigs));
}

// ==================== 初始化 ====================

/**
 * 启动时调用一次（在 game.levels 已用内置数据初始化之后）。
 * 依次：落盘原始副本 → 装载活动副本 → 异步远端检查。
 */
function init(game) {
  const builtin = getLevels();

  // 0. 端点接线：调用方未显式指定时，用 config.LEVELS.remoteUrl（留空 = 不启用）
  if (!urlSettled) {
    REMOTE_URL = (C.LEVELS && C.LEVELS.remoteUrl) || '';
    urlSettled = true;
  }

  // 1. 原始兜底：首启或二进制版本升级时，把内置官卡落盘为「原始」副本
  const orig = storageGet(ORIGINAL_KEY);
  if (!orig || orig.version !== BUILTIN_VERSION || !isValidLevels(orig.data)) {
    storageSet(ORIGINAL_KEY, { version: BUILTIN_VERSION, data: builtin });
    state.originalVersion = BUILTIN_VERSION;
  } else {
    state.originalVersion = orig.version;
  }

  // 2. 活动副本：有合法存档就用（可能是远端下发的），否则用内置并落盘
  const act = storageGet(ACTIVE_KEY);
  if (act && typeof act.version === 'number' && isValidLevels(act.data)) {
    game.levels = act.data;
    state.activeVersion = act.version;
    state.usingRemote = act.version !== BUILTIN_VERSION;
  } else {
    storageSet(ACTIVE_KEY, { version: BUILTIN_VERSION, data: builtin });
    game.levels = builtin;
    state.activeVersion = BUILTIN_VERSION;
    state.usingRemote = false;
  }

  // 3. 远端版本检查（异步；无端点/无 wx.request 则跳过）
  checkRemote(game);
}

// ==================== 远端下发 ====================

/** 设置远端端点（上线配置用；测试注入用）。传空串 = 关闭远端下发。 */
function setRemoteUrl(url) {
  REMOTE_URL = url || '';
  urlSettled = true;
}

/**
 * 异步拉取远端版本。仅当版本更新且数据合法才采纳：
 * 落地活动副本 → 替换 game.levels → 置 pendingUpdate 供 UI 提醒。
 * 兼容两种返回形态：裸 { version, data } 与后端通用包装 { ok, data:{ version, data } }。
 */
function checkRemote(game) {
  if (!REMOTE_URL) return;
  try {
    if (typeof wx === 'undefined' || typeof wx.request !== 'function') return;
    wx.request({
      url: REMOTE_URL,
      method: 'GET',
      success(res) {
        const raw = res && res.data;
        const payload = (raw && typeof raw.ok === 'boolean' && raw.data) ? raw.data : raw;
        if (!payload || typeof payload.version !== 'number' || !isValidLevels(payload.data)) return;
        if (payload.version <= state.activeVersion) return; // 无新版
        // 用户曾点「恢复原版」拒绝过该版本（或更旧版本）→ 不再打扰
        const dismissed = Number(storageGetRaw(DISMISS_KEY)) || 0;
        if (payload.version <= dismissed) return;
        storageSet(ACTIVE_KEY, { version: payload.version, data: payload.data });
        game.levels = payload.data;
        state.activeVersion = payload.version;
        state.usingRemote = true;
        state.pendingUpdate = { version: payload.version };
      },
      fail() { /* 网络失败：沿用本地，静默 */ },
    });
  } catch (e) { /* 忽略 */ }
}

// ==================== 恢复 ====================

/**
 * 恢复原始官卡：把活动副本重置回「原始副本」（内置随包数据）。
 * 原始副本缺失时回退到内置 getLevels()（幂等安全）。
 * @returns {number} 恢复后的版本号
 */
function restoreOriginal(game) {
  const orig = storageGet(ORIGINAL_KEY);
  const builtin = getLevels();
  const data = (orig && isValidLevels(orig.data)) ? orig.data : builtin;
  const version = (orig && typeof orig.version === 'number') ? orig.version : BUILTIN_VERSION;
  // 用户明确拒绝当前远端版本 → 记住它，否则下次启动 checkRemote 又会把同一版推回来
  if (state.usingRemote) storageSet(DISMISS_KEY, state.activeVersion);
  storageSet(ACTIVE_KEY, { version, data });
  game.levels = data;
  state.activeVersion = version;
  state.usingRemote = false;
  state.pendingUpdate = null;
  return version;
}

// ==================== 查询 ====================

function getActiveVersion() { return state.activeVersion; }
function getOriginalVersion() { return state.originalVersion; }
function usingRemote() { return state.usingRemote; }
function hasPendingUpdate() { return !!state.pendingUpdate; }
/** UI 消费完提醒后调用，清掉本次「已更新」标记 */
function ackUpdate() { state.pendingUpdate = null; }

module.exports = {
  init,
  checkRemote,
  restoreOriginal,
  setRemoteUrl,
  getActiveVersion,
  getOriginalVersion,
  usingRemote,
  hasPendingUpdate,
  ackUpdate,
  BUILTIN_VERSION,
};
