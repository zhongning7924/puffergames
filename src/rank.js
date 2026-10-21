/**
 * 全服榜网络模块 - 静默登录 + 闯关进度上报 + 榜单查询
 * Server rank module: silent login + progress report + leaderboard query.
 *
 * 复用 zoo-rank 服务（https://aiclub.hk.cn/puffer/api/，app='puffer'）：
 *  - 静默登录：wx.login 拿 code → POST /v1/login { code, app:'puffer' } → 缓存 HMAC 令牌；
 *  - 上报：POST /v1/progress（单关星/分/用鸟数）、/v1/daily、/v1/ugc；
 *  - 查榜：GET /v1/rank/stars、/v1/rank/score。
 *
 * 设计约束（与 level-source.js 同风格）：
 *  - 全部 wx API 在无 wx / 预览 / 网络失败环境下静默降级，不抛错、不影响玩法；
 *  - 令牌持久化到本地存储，避免每次启动都走登录；401 时清令牌下次重登。
 */
'use strict';

const C = require('./config.js');

const BASE_URL = C.RANK.baseUrl;
const APP = C.RANK.app;
const TOKEN_KEY = 'angryBirds_rank_token';

// ==================== 存储 ====================

function storageGet(key) {
  try {
    if (typeof wx === 'undefined' || typeof wx.getStorageSync !== 'function') return null;
    return wx.getStorageSync(key) || null;
  } catch (e) { return null; }
}
function storageSet(key, v) {
  try {
    if (typeof wx === 'undefined' || typeof wx.setStorageSync !== 'function') return;
    wx.setStorageSync(key, v);
  } catch (e) { /* 存储满/不可用：静默 */ }
}

// ==================== 状态 ====================

const state = {
  token: null,
  uid: null,
  nickname: '',
  ready: false,      // 已有有效令牌
  loggingIn: false,  // 登录请求进行中
  waiters: [],       // 登录完成前排队等待的回调
};

// ==================== 请求封装 ====================

/**
 * 统一请求。resp 约定：{ ok:true, data } 或 { ok:false, error:{code} }。
 * 401 时清令牌并标记未就绪，下次 ensureLogin 重新登录。
 */
function request(path, method, data, cb) {
  try {
    if (typeof wx === 'undefined' || typeof wx.request !== 'function') {
      if (cb) cb(null);
      return;
    }
    const header = { 'Content-Type': 'application/json' };
    if (state.token) header.Authorization = 'Bearer ' + state.token;
    wx.request({
      url: BASE_URL + path,
      method: method || 'GET',
      data: data || undefined,
      header: header,
      success(res) {
        const resp = res && res.data;
        if (resp && resp.ok === false && resp.error && resp.error.code === 'unauthorized') {
          state.token = null;
          state.ready = false;
          storageSet(TOKEN_KEY, null);
        }
        if (cb) cb(resp || null);
      },
      fail() { if (cb) cb(null); },
    });
  } catch (e) { if (cb) cb(null); }
}

// ==================== 静默登录 ====================

/** 确保已登录（必要时静默 wx.login）。cb(登录态对象 | null) */
function ensureLogin(cb) {
  if (state.ready) {
    if (cb) cb(state);
    return;
  }
  if (state.loggingIn) {
    state.waiters.push(cb);
    return;
  }

  // 先尝试恢复本地令牌（避免每次启动都登录）
  const saved = storageGet(TOKEN_KEY);
  if (saved && saved.token) {
    state.token = saved.token;
    state.uid = saved.uid || '';
    state.nickname = saved.nickname || '';
    state.ready = true;
    if (cb) cb(state);
    return;
  }

  state.loggingIn = true;
  try {
    if (typeof wx === 'undefined' || typeof wx.login !== 'function') {
      state.loggingIn = false;
      if (cb) cb(null);
      return;
    }
    wx.login({
      success(res) {
        if (!res || !res.code) {
          state.loggingIn = false;
          flushWaiters(null);
          if (cb) cb(null);
          return;
        }
        request('/v1/login', 'POST', { code: res.code, app: APP }, (resp) => {
          if (resp && resp.ok && resp.data && resp.data.token) {
            state.token = resp.data.token;
            state.uid = resp.data.uid || '';
            state.nickname = resp.data.nickname || '';
            state.ready = true;
            storageSet(TOKEN_KEY, { token: state.token, uid: state.uid, nickname: state.nickname });
            state.loggingIn = false;
            flushWaiters(state);
            if (cb) cb(state);
          } else {
            state.loggingIn = false;
            flushWaiters(null);
            if (cb) cb(null);
          }
        });
      },
      fail() {
        state.loggingIn = false;
        flushWaiters(null);
        if (cb) cb(null);
      },
    });
  } catch (e) {
    state.loggingIn = false;
    flushWaiters(null);
    if (cb) cb(null);
  }
}

function flushWaiters(result) {
  const q = state.waiters;
  state.waiters = [];
  for (const f of q) if (f) f(result);
}

// ==================== 对外接口 ====================

/** 上报单关进度（尽力而为，静默失败）。levelIndex 0-based，stars 0-3。 */
function reportProgress(levelIndex, stars, score, birds) {
  ensureLogin((s) => {
    if (!s) return;
    request('/v1/progress', 'POST', { levelIndex, stars, score, birds });
  });
}

/**
 * 批量补录进度（尽力而为）。entries = [{levelIndex, stars, score, birds}]。
 * 用于「历史进度对齐」：老玩家通关时还没有上报功能，进榜时把本地存档一次性补齐。
 * 服务端语义与单条上报一致（只升不降），重复调用幂等。
 * cb(respData | null)，无论成功失败都会回调，方便串接后续查榜。
 */
function reportProgressBatch(entries, cb) {
  if (!entries || !entries.length) { if (cb) cb(null); return; }
  ensureLogin((s) => {
    if (!s) { if (cb) cb(null); return; }
    request('/v1/progress/batch', 'POST', { items: entries }, (resp) => {
      if (cb) cb(resp && resp.ok ? resp.data : null);
    });
  });
}

/** 上报每日挑战分数（尽力而为）。 */
function reportDaily(score) {
  ensureLogin((s) => {
    if (!s) return;
    request('/v1/daily', 'POST', { score });
  });
}

/** 上报造关事件（action: create|play|clear|like）。 */
function reportUgc(action, shareCode, dataHash) {
  ensureLogin((s) => {
    if (!s) return;
    request('/v1/ugc', 'POST', { action, shareCode, dataHash });
  });
}

/**
 * 查榜。kind: 'stars' | 'score'。
 * cb(data)：成功时 data = { list:[{rank,nickname,totalStars,totalScore,clearedCount}], me, total }。
 */
function fetchRank(kind, cb) {
  ensureLogin((s) => {
    if (!s) { if (cb) cb(null); return; }
    request('/v1/rank/' + kind, 'GET', null, (resp) => {
      if (cb) cb(resp && resp.ok ? resp.data : null);
    });
  });
}

/** 是否已就绪（供 UI 显示「离线」态判断） */
function isReady() { return state.ready; }

module.exports = {
  ensureLogin,
  reportProgress,
  reportProgressBatch,
  reportDaily,
  reportUgc,
  fetchRank,
  isReady,
};
