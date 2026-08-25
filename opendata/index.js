/**
 * 开放数据域入口 - 好友排行榜渲染
 * Open Data Context - renders the friends leaderboard onto the shared canvas.
 *
 * 运行在独立上下文中：只能访问微信关系链数据（getFriendCloudStorage），
 * 与主域通过 wx.onMessage / postMessage 通信，看不到主域任何变量。
 * 主域在进入排行榜界面时发送 { type: 'showFriendsRank', width, height, dpr }。
 */

const canvas = wx.getSharedCanvas();
const ctx = canvas.getContext('2d');

let screenW = 375;
let screenH = 667;
let dpr = 1;

// 头像缓存：url -> { img, ready }
const avatarCache = {};

wx.onMessage((data) => {
  if (!data || data.type !== 'showFriendsRank') return;
  screenW = data.width || 375;
  screenH = data.height || 667;
  dpr = data.dpr || 1;
  canvas.width = screenW * dpr;
  canvas.height = screenH * dpr;
  loadAndRender();
});

function getKV(friend, key) {
  const list = friend.KVDataList || [];
  for (const kv of list) {
    if (kv.key === key) return parseInt(kv.value, 10) || 0;
  }
  return 0;
}

function loadAndRender() {
  wx.getFriendCloudStorage({
    keyList: ['totalScore', 'totalStars'],
    success: (res) => renderRank(res.data || []),
    fail: () => renderRank([]),
  });
}

/** 加载头像（异步，加载完成后重绘） */
function ensureAvatar(url) {
  if (!url) return null;
  let entry = avatarCache[url];
  if (entry) return entry.ready ? entry.img : null;
  entry = { img: wx.createImage(), ready: false };
  entry.img.onload = () => {
    entry.ready = true;
    loadAndRender(); // 头像到位后重绘一次
  };
  entry.img.onerror = () => { entry.ready = false; };
  entry.img.src = url;
  avatarCache[url] = entry;
  return null;
}

function renderRank(list) {
  const rows = list.map((f) => ({
    nickname: f.nickname || '微信好友',
    avatarUrl: f.avatarUrl || '',
    score: getKV(f, 'totalScore'),
    stars: getKV(f, 'totalStars'),
  })).sort((a, b) => b.score - a.score || b.stars - a.stars);

  // 清屏（物理像素）→ 按 DPR 缩放后用 CSS 像素绘制
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // 背景
  const grad = ctx.createLinearGradient(0, 0, 0, screenH);
  grad.addColorStop(0, '#2B3A55');
  grad.addColorStop(1, '#1B2737');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, screenW, screenH);

  // 标题
  ctx.font = 'bold 26px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#FFD54F';
  ctx.fillText('好友排行榜', screenW / 2, 60);

  if (rows.length === 0) {
    ctx.font = '15px Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('还没有好友成绩，快分享游戏邀请好友吧！', screenW / 2, screenH / 2);
    return;
  }

  // 列表（最多显示 8 条）
  const rowH = 52;
  const startY = 105;
  const listW = screenW - 48;
  const listX = 24;
  const maxRows = Math.min(rows.length, 8);

  for (let i = 0; i < maxRows; i++) {
    const r = rows[i];
    const y = startY + i * rowH;

    // 行背景
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)';
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(listX, y, listW, rowH - 8, 8);
    } else {
      ctx.rect(listX, y, listW, rowH - 8);
    }
    ctx.fill();

    const cy = y + (rowH - 8) / 2;

    // 名次（前三用奖牌色）
    ctx.font = 'bold 17px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = i === 0 ? '#FFD54F' : i === 1 ? '#CFD8DC' : i === 2 ? '#FFAB91' : 'rgba(255,255,255,0.55)';
    ctx.fillText(String(i + 1), listX + 22, cy);

    // 头像（圆形裁切；未加载完成时画占位圆）
    const avatarSize = 32;
    const avatarX = listX + 42 + avatarSize / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX, cy, avatarSize / 2, 0, Math.PI * 2);
    ctx.clip();
    const img = ensureAvatar(r.avatarUrl);
    if (img) {
      ctx.drawImage(img, avatarX - avatarSize / 2, cy - avatarSize / 2, avatarSize, avatarSize);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(avatarX - avatarSize / 2, cy - avatarSize / 2, avatarSize, avatarSize);
    }
    ctx.restore();

    // 昵称
    ctx.font = '15px Arial';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#FFFFFF';
    const nick = r.nickname.length > 8 ? r.nickname.slice(0, 8) + '…' : r.nickname;
    ctx.fillText(nick, listX + 84, cy - 8);

    // 星数
    ctx.font = '12px Arial';
    ctx.fillStyle = '#FFD54F';
    ctx.fillText('★ ' + r.stars, listX + 84, cy + 11);

    // 总分
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(String(r.score), listX + listW - 14, cy);
  }

  // 底部说明
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillText('按通关总分排序 · 与好友一较高下', screenW / 2, startY + maxRows * rowH + 24);
}
