/**
 * 官卡后台 · 前端
 * 三栏：关卡列表 / 画布编辑 / 属性
 *
 * 坐标约定（与 src/levels.js 完全一致）：
 *   block: x,y 是左上角，带 width / height
 *   pig  : x,y 是圆心，带 radius
 *   pearl: x,y 是圆心
 */
'use strict';

const CV = document.getElementById('cv');
const ctx = CV.getContext('2d');

const SW = 375;
const SH = 667;

const S = {
  levels: [],
  cur: 0,
  sel: null,              // { kind:'block'|'pig'|'pearl', index }
  meta: {
    bossStyles: {}, blockTypes: [], birdTypes: [], constants: { groundY: 577, slingshotX: 95, slingshotY: 467 },
  },
  version: 0,
  remoteVersion: 0,
  source: '',
  dirty: false,
  drag: null,
};

const BLOCK_COLORS = {
  wood: ['#D9C2A8', '#C4A88C'],
  stone: ['#B0C4D8', '#8FA8C4'],
  ice: ['#B3E5FC', '#81D4FA'],
  fire: ['#E8603C', '#8E2A1C'],
  burst: ['#FFAB91', '#F08A78'],
};
const BLOCK_NAMES = { wood: '木', stone: '石', ice: '冰', fire: '熔岩', burst: '爆裂果' };

// ==================== 工具 ====================

function $(id) { return document.getElementById(id); }

function toast(msg, kind, list) {
  const el = document.createElement('div');
  el.className = 'toast ' + (kind || '');
  el.innerHTML = String(msg) + (list && list.length ? '<ul>' + list.map((x) => '<li>' + x + '</li>').join('') + '</ul>' : '');
  document.body.appendChild(el);
  setTimeout(() => el.remove(), kind === 'err' ? 6000 : 2600);
}

function status(msg, kind) {
  const el = $('status');
  el.textContent = msg;
  el.className = kind || '';
}

function lv() { return S.levels[S.cur]; }

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function roundTo(v, step) { return Math.round(v / step) * step; }

// ==================== 启动 ====================

async function boot() {
  const r = await fetch('/api/state');
  const d = await r.json();
  S.levels = d.levels;
  S.version = d.version;
  S.remoteVersion = d.remoteVersion;
  S.source = d.source;
  S.dirty = d.dirty;
  S.meta = {
    bossStyles: d.bossStyles, blockTypes: d.blockTypes,
    birdTypes: d.birdTypes, constants: d.constants,
  };
  renderList();
  renderAll();
  status('已载入 ' + S.levels.length + ' 关（' + sourceLabel() + '）', '');
}

function sourceLabel() {
  return { builtin: '内置关卡', server: '服务器线上版本', draft: '本地草稿' }[S.source] || S.source;
}

// ==================== 关卡列表 ====================

function renderList() {
  const box = $('levelList');
  box.innerHTML = '';
  S.levels.forEach((level, i) => {
    const boss = (level.pigs || []).some((p) => p.boss);
    const el = document.createElement('div');
    el.className = 'level-item' + (i === S.cur ? ' active' : '') + (boss ? ' boss' : '');
    el.innerHTML =
      '<span class="no">' + (i + 1) + '</span>' +
      '<span class="nm">' + (level.flavor || level.name || '未命名') + '</span>' +
      '<span class="cnt">' + (level.pigs || []).length + '·' + (level.blocks || []).length + '</span>';
    el.onclick = () => { S.cur = i; S.sel = null; renderList(); renderAll(); };
    box.appendChild(el);
  });
}

// ==================== 画布 ====================

function setupCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  CV.width = SW * dpr;
  CV.height = SH * dpr;
  CV._dpr = dpr;
}

function draw() {
  const dpr = CV._dpr || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, SW, SH);

  const level = lv();
  if (!level) return;
  const groundY = S.meta.constants.groundY;

  // 水体
  const g = ctx.createLinearGradient(0, 0, 0, SH);
  g.addColorStop(0, '#14222b');
  g.addColorStop(0.6, '#0f1a22');
  g.addColorStop(1, '#0b141a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SW, SH);

  // 网格
  ctx.strokeStyle = 'rgba(127,221,232,0.07)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= SW; x += 25) {
    ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, SH); ctx.stroke();
  }
  for (let y = 0; y <= SH; y += 25) {
    ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(SW, y + 0.5); ctx.stroke();
  }

  // 地面
  ctx.fillStyle = '#2a2f22';
  ctx.fillRect(0, groundY, SW, SH - groundY);
  ctx.strokeStyle = '#5d6b47';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, groundY + 1); ctx.lineTo(SW, groundY + 1); ctx.stroke();

  // 弹弓
  const sx = S.meta.constants.slingshotX;
  const sy = S.meta.constants.slingshotY;
  ctx.strokeStyle = '#F48FB1';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(sx, groundY); ctx.lineTo(sx, sy + 26);
  ctx.moveTo(sx, sy + 26); ctx.lineTo(sx - 12, sy + 6);
  ctx.moveTo(sx, sy + 26); ctx.lineTo(sx + 12, sy + 6);
  ctx.stroke();

  // 方块
  (level.blocks || []).forEach((b, i) => {
    const pal = BLOCK_COLORS[b.type] || ['#9aa5b8', '#6b7688'];
    ctx.fillStyle = pal[0];
    ctx.strokeStyle = pal[1];
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(b.x, b.y, b.width, b.height);
    ctx.fill();
    ctx.stroke();
    // 材质缩写
    ctx.fillStyle = 'rgba(20,24,30,0.55)';
    ctx.font = '9px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (b.width >= 22 && b.height >= 18) {
      ctx.fillText(BLOCK_NAMES[b.type] || b.type, b.x + b.width / 2, b.y + b.height / 2);
    }
    if (isSel('block', i)) highlightRect(b);
  });

  // 珍珠
  (level.pearls || []).forEach((p, i) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#FFE082';
    ctx.fill();
    ctx.strokeStyle = '#B08A2E';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (isSel('pearl', i)) highlightCircle(p.x, p.y, 7);
  });

  // 章鱼
  (level.pigs || []).forEach((p, i) => {
    const isBoss = !!p.boss;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = isBoss ? '#A569BD' : '#CE93D8';
    ctx.fill();
    ctx.strokeStyle = isBoss ? '#4A148C' : '#9B59B6';
    ctx.lineWidth = isBoss ? 3.5 : 2;
    ctx.stroke();

    // 眼睛
    const er = Math.max(2, p.radius * 0.16);
    const ex = p.radius * 0.34;
    const ey = -p.radius * 0.12;
    ctx.fillStyle = '#2b1a33';
    ctx.beginPath(); ctx.arc(p.x - ex, p.y + ey, er, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(p.x + ex, p.y + ey, er, 0, Math.PI * 2); ctx.fill();

    if (isBoss) {
      ctx.fillStyle = '#FFF8E1';
      ctx.font = 'bold 10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('HP' + (p.hp || '?'), p.x, p.y + p.radius * 0.52);
    }
    if (isSel('pig', i)) highlightCircle(p.x, p.y, p.radius);
  });

  drawHud(level);
}

function drawHud(level) {
  ctx.fillStyle = 'rgba(10,16,22,0.78)';
  ctx.fillRect(6, 6, 232, 40);
  ctx.fillStyle = '#7FDDE8';
  ctx.font = 'bold 12px ui-monospace, monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('#' + (S.cur + 1) + '  ' + (level.name || ''), 12, 11);
  ctx.fillStyle = '#9aa5b8';
  ctx.font = '11px ui-monospace, monospace';
  ctx.fillText(
    '鸟 ' + (level.birds || []).length + ' · 章鱼 ' + (level.pigs || []).length +
    ' · 方块 ' + (level.blocks || []).length,
    12, 28
  );
}

function highlightRect(b) {
  ctx.save();
  ctx.strokeStyle = '#7FDDE8';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 3]);
  ctx.strokeRect(b.x - 2, b.y - 2, b.width + 4, b.height + 4);
  ctx.restore();
}
function highlightCircle(x, y, r) {
  ctx.save();
  ctx.strokeStyle = '#7FDDE8';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 3]);
  ctx.beginPath();
  ctx.arc(x, y, r + 3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function isSel(kind, index) {
  return S.sel && S.sel.kind === kind && S.sel.index === index;
}

// ==================== 命中与拖拽 ====================

function toLocal(ev) {
  const r = CV.getBoundingClientRect();
  return {
    x: (ev.clientX - r.left) * SW / r.width,
    y: (ev.clientY - r.top) * SH / r.height,
  };
}

function hitTest(pt) {
  const level = lv();
  const pigs = level.pigs || [];
  for (let i = pigs.length - 1; i >= 0; i--) {
    const p = pigs[i];
    if (Math.hypot(pt.x - p.x, pt.y - p.y) <= p.radius + 3) return { kind: 'pig', index: i };
  }
  const pearls = level.pearls || [];
  for (let i = pearls.length - 1; i >= 0; i--) {
    const p = pearls[i];
    if (Math.hypot(pt.x - p.x, pt.y - p.y) <= 10) return { kind: 'pearl', index: i };
  }
  const blocks = level.blocks || [];
  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i];
    if (pt.x >= b.x && pt.x <= b.x + b.width && pt.y >= b.y && pt.y <= b.y + b.height) {
      return { kind: 'block', index: i };
    }
  }
  return null;
}

function selectedObj() {
  if (!S.sel) return null;
  const level = lv();
  const list = S.sel.kind === 'pig' ? level.pigs : S.sel.kind === 'pearl' ? (level.pearls || []) : level.blocks;
  return (list || [])[S.sel.index] || null;
}

CV.addEventListener('pointerdown', (ev) => {
  const pt = toLocal(ev);
  const hit = hitTest(pt);
  S.sel = hit;
  renderProps();
  draw();
  if (!hit) return;

  const obj = selectedObj();
  S.drag = { kind: hit.kind, index: hit.index, px: pt.x, py: pt.y, ox: obj.x, oy: obj.y };
  CV.setPointerCapture(ev.pointerId);
});

CV.addEventListener('pointermove', (ev) => {
  if (!S.drag) return;
  const pt = toLocal(ev);
  const obj = selectedObj();
  if (!obj) return;
  const step = ev.altKey ? 0.25 : 1;
  let nx = S.drag.ox + (pt.x - S.drag.px);
  let ny = S.drag.oy + (pt.y - S.drag.py);
  obj.x = clamp(roundTo(nx, step), 0, SW);
  obj.y = clamp(roundTo(ny, step), 0, SH);
  draw();
  syncNumberInputs();
});

CV.addEventListener('pointerup', (ev) => {
  if (!S.drag) return;
  S.drag = null;
  try { CV.releasePointerCapture(ev.pointerId); } catch (e) { /* 忽略 */ }
  markDirty();
  renderProps();
});

document.addEventListener('keydown', (ev) => {
  const tag = (ev.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'select' || tag === 'textarea') return;

  if ((ev.key === 'Delete' || ev.key === 'Backspace') && S.sel) {
    ev.preventDefault();
    delSelected();
    return;
  }
  const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (arrows[ev.key] && S.sel) {
    ev.preventDefault();
    const obj = selectedObj();
    if (!obj) return;
    const d = ev.shiftKey ? 10 : 1;
    obj.x = clamp(roundTo(obj.x + arrows[ev.key][0] * d, 1), 0, SW);
    obj.y = clamp(roundTo(obj.y + arrows[ev.key][1] * d, 1), 0, SH);
    markDirty();
    draw();
    renderProps();
  }
});

// ==================== 增删 ====================

function addBlock() {
  const level = lv();
  level.blocks = level.blocks || [];
  const b = { x: 240, y: S.meta.constants.groundY - 56, width: 28, height: 56, type: 'wood' };
  level.blocks.push(b);
  S.sel = { kind: 'block', index: level.blocks.length - 1 };
  afterEdit();
}

function addPig() {
  const level = lv();
  level.pigs = level.pigs || [];
  const p = { x: 260, y: S.meta.constants.groundY - 16, radius: 16 };
  level.pigs.push(p);
  S.sel = { kind: 'pig', index: level.pigs.length - 1 };
  afterEdit();
}

function addPearl() {
  const level = lv();
  level.pearls = level.pearls || [];
  const p = { id: 'p' + Date.now().toString(36), x: 200, y: 300 };
  level.pearls.push(p);
  S.sel = { kind: 'pearl', index: level.pearls.length - 1 };
  afterEdit();
}

function delSelected() {
  if (!S.sel) return;
  const level = lv();
  const key = S.sel.kind === 'block' ? 'blocks' : S.sel.kind === 'pig' ? 'pigs' : 'pearls';
  if (!level[key] || !level[key].length) return;
  if (key === 'pigs' && level[key].length <= 1) {
    toast('至少要留一只章鱼，否则这关无法通关', 'err');
    return;
  }
  level[key].splice(S.sel.index, 1);
  S.sel = null;
  afterEdit();
}

function afterEdit() {
  markDirty();
  renderList();
  renderAll();
}

// ==================== 属性面板 ====================

function field(label, inputHtml) {
  return '<div class="field"><label>' + label + '</label>' + inputHtml + '</div>';
}

function numInput(id, value, step) {
  return '<input type="number" id="' + id + '" step="' + (step || 1) + '" value="' + value + '">';
}

function renderProps() {
  const level = lv();
  if (!level) return;
  const body = $('propBody');
  let html = '';

  // ---- 关卡级 ----
  html += '<div class="group"><div class="group-title">关卡</div>';
  html += field('名称', '<input type="text" id="pName" value="' + esc(level.name || '') + '">');
  html += field('副标题', '<input type="text" id="pFlavor" value="' + esc(level.flavor || '') + '">');
  html += field('提示', '<input type="text" id="pHint" value="' + esc(level.hint || '') + '">');
  html += field('弹道档位', numInput('pTraj', level.trajectory || 0, 1));
  html += '</div>';

  html += '<div class="group"><div class="group-title">星级门槛（低 → 高）</div>';
  const st = level.stars || [0, 0, 0];
  html += '<div class="row3">' +
    '<input type="number" id="pStar0" step="100" value="' + (st[0] || 0) + '">' +
    '<input type="number" id="pStar1" step="100" value="' + (st[1] || 0) + '">' +
    '<input type="number" id="pStar2" step="100" value="' + (st[2] || 0) + '">' +
    '</div></div>';

  html += '<div class="group"><div class="group-title">用鸟序列（逗号分隔）</div>';
  html += '<div class="field"><input type="text" id="pBirds" value="' + esc((level.birds || []).join(',')) + '"></div>';
  html += '<div class="empty" style="padding:0;font-size:11px">可用：' +
    S.meta.birdTypes.map((b) => b.key + '(' + b.name + ')').join('、') + '</div>';
  html += '</div>';

  // ---- 选中对象 ----
  const obj = selectedObj();
  if (obj) {
    const k = S.sel.kind;
    const title = k === 'block' ? '选中方块' : k === 'pig' ? '选中章鱼' : '选中珍珠';
    html += '<div class="group"><div class="group-title">' + title + ' #' + (S.sel.index + 1) + '</div>';
    html += field('X', numInput('oX', fmt(obj.x), 0.25));
    html += field('Y', numInput('oY', fmt(obj.y), 0.25));

    if (k === 'block') {
      html += field('宽', numInput('oW', obj.width, 1));
      html += field('高', numInput('oH', obj.height, 1));
      html += field('材质', '<select id="oType">' + S.meta.blockTypes.map((t) =>
        '<option value="' + t + '"' + (obj.type === t ? ' selected' : '') + '>' + t + ' ' + (BLOCK_NAMES[t] || '') + '</option>'
      ).join('') + '</select>');
    }

    if (k === 'pig') {
      html += field('半径', numInput('oR', obj.radius, 1));
      html += field('章王', '<label style="width:auto;display:flex;gap:6px;align-items:center;color:var(--ink)">' +
        '<input type="checkbox" id="oBoss"' + (obj.boss ? ' checked' : '') + ' style="flex:none"> 是（关卡末位 Boss）</label>');
      if (obj.boss) {
        html += field('风格', '<select id="oStyle">' + Object.keys(S.meta.bossStyles).map((s) =>
          '<option value="' + s + '"' + (obj.style === s ? ' selected' : '') + '>' + s + ' ' + S.meta.bossStyles[s].name + '</option>'
        ).join('') + '</select>');
        html += field('HP', numInput('oHp', obj.hp || 1, 1));
        html += field('名字', '<input type="text" id="oBossName" value="' + esc(obj.name || '') + '">');
      }
    }
    html += '</div>';
  }

  body.innerHTML = html;
  $('selHint').textContent = obj
    ? (S.sel.kind === 'block' ? '方块' : S.sel.kind === 'pig' ? '章鱼' : '珍珠') + ' #' + (S.sel.index + 1)
    : '未选中';

  bindProps();
}

function fmt(v) { return Math.round(v * 100) / 100; }

function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function bindProps() {
  const level = lv();

  const bindLevel = (id, fn) => {
    const el = $(id);
    if (!el) return;
    el.onchange = () => { fn(el.value); markDirty(); renderList(); draw(); };
  };

  bindLevel('pName', (v) => { level.name = v; });
  bindLevel('pFlavor', (v) => { level.flavor = v; });
  bindLevel('pHint', (v) => { level.hint = v; });
  bindLevel('pTraj', (v) => { level.trajectory = Number(v) || 0; });
  bindLevel('pStar0', (v) => { level.stars[0] = Number(v) || 0; });
  bindLevel('pStar1', (v) => { level.stars[1] = Number(v) || 0; });
  bindLevel('pStar2', (v) => { level.stars[2] = Number(v) || 0; });
  bindLevel('pBirds', (v) => {
    const allowed = S.meta.birdTypes.map((b) => b.key);
    const list = v.split(',').map((s) => s.trim()).filter(Boolean).filter((s) => allowed.indexOf(s) >= 0);
    level.birds = list.length ? list : ['normal'];
  });

  const obj = selectedObj();
  if (!obj) return;
  const k = S.sel.kind;

  const upd = () => { markDirty(); draw(); };

  const oX = $('oX'), oY = $('oY');
  if (oX) oX.onchange = () => { obj.x = Number(oX.value) || 0; upd(); };
  if (oY) oY.onchange = () => { obj.y = Number(oY.value) || 0; upd(); };

  if (k === 'block') {
    $('oW').onchange = (e) => { obj.width = Math.max(1, Number(e.target.value) || 1); upd(); };
    $('oH').onchange = (e) => { obj.height = Math.max(1, Number(e.target.value) || 1); upd(); };
    $('oType').onchange = (e) => { obj.type = e.target.value; upd(); };
  }

  if (k === 'pig') {
    $('oR').onchange = (e) => { obj.radius = Math.max(4, Number(e.target.value) || 4); upd(); };
    $('oBoss').onchange = (e) => {
      if (e.target.checked) {
        obj.boss = true;
        obj.hp = obj.hp || 5;
        obj.style = obj.style || 'marsh';
        obj.name = obj.name || S.meta.bossStyles[obj.style].name;
        obj.radius = Math.max(obj.radius, 26);
      } else {
        delete obj.boss; delete obj.hp; delete obj.style; delete obj.name;
      }
      markDirty(); renderProps(); draw(); renderList();
    };
    const st = $('oStyle');
    if (st) st.onchange = (e) => {
      const style = e.target.value;
      const meta = S.meta.bossStyles[style];
      obj.style = style;
      obj.name = meta.name;
      obj.hp = meta.hp;
      obj.radius = meta.radius;
      markDirty(); renderProps(); draw();
    };
    const hp = $('oHp');
    if (hp) hp.onchange = (e) => { obj.hp = Math.max(1, Number(e.target.value) || 1); upd(); };
    const bn = $('oBossName');
    if (bn) bn.onchange = (e) => { obj.name = e.target.value; upd(); };
  }
}

/** 拖拽时只同步坐标输入框，避免整块重建导致焦点丢失 */
function syncNumberInputs() {
  const obj = selectedObj();
  if (!obj) return;
  const oX = $('oX'), oY = $('oY');
  if (oX) oX.value = fmt(obj.x);
  if (oY) oY.value = fmt(obj.y);
}

// ==================== 脏标记 / 状态 ====================

function markDirty() {
  S.dirty = true;
  updateChips();
}

function updateChips() {
  const cs = $('chipSource');
  cs.textContent = sourceLabel();
  cs.className = 'chip' + (S.dirty ? ' dirty' : '');
  $('chipVersion').textContent = '本地 v' + S.version + ' · 线上 v' + S.remoteVersion;
  $('statusRight').textContent = '第 ' + (S.cur + 1) + ' 关 / 共 ' + S.levels.length + ' 关' +
    ' · 鸟' + (lv() ? (lv().birds || []).length : 0) +
    ' 章鱼' + (lv() ? (lv().pigs || []).length : 0) +
    ' 方块' + (lv() ? (lv().blocks || []).length : 0);
}

function renderAll() {
  const level = lv();
  if (level) {
    $('stageTitle').innerHTML = '#' + (S.cur + 1) + ' ' + esc(level.name || '') +
      '<span class="flavor">' + esc(level.flavor || '') + '</span>';
  }
  updateChips();
  renderProps();
  draw();
}

// ==================== 保存 / 发布 ====================

async function doSave() {
  status('保存中…');
  const r = await fetch('/api/save', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ levels: S.levels }),
  });
  const d = await r.json();
  if (!d.ok) {
    status('保存失败：' + d.error, 'err');
    toast('保存失败：' + d.error, 'err', d.problems);
    return;
  }
  S.dirty = false;
  S.source = 'draft';
  updateChips();
  status('草稿已保存到 ' + d.workFile + '（还没上线）', 'ok');
  toast('草稿已保存', 'ok');
}

async function doPublish() {
  const problems = quickProblems();
  if (problems.length) {
    toast('发布前检查未通过', 'err', problems);
    return;
  }
  const ok = confirm(
    '将把当前 ' + S.levels.length + ' 关上传到服务器，服务端版本号自动 +1。\n\n' +
    '· 小程序无需发版，玩家下次启动生效\n' +
    '· 玩家可在设置里「恢复原版官卡」回退\n\n继续发布？'
  );
  if (!ok) return;

  status('发布中…（生成文件 → 上传 → 回读校验）');
  $('btnPublish').disabled = true;
  const r = await fetch('/api/publish', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ levels: S.levels }),
  });
  const d = await r.json();
  $('btnPublish').disabled = false;

  if (!d.ok) {
    status('发布失败：' + d.error, 'err');
    toast('发布失败：' + d.error + (d.detail ? '（' + d.detail + '）' : ''), 'err', d.problems);
    return;
  }
  S.version = d.version;
  S.remoteVersion = d.live;
  S.dirty = false;
  S.source = 'server';
  updateChips();
  if (d.consistent) {
    status('已发布 v' + d.version + '，线上回读一致', 'ok');
    toast('发布成功 · 线上版本 v' + d.version, 'ok');
  } else {
    status('已上传 v' + d.version + '，但线上回读为 v' + d.live + '（可能缓存延迟）', 'err');
    toast('上传完成，但回读版本是 v' + d.live + '，稍后刷新确认', 'err');
  }
}

async function doRollback() {
  const ok = confirm(
    '把内置 40 关（src/levels.js 原版）作为**新版本**发布到服务器。\n\n' +
    '· 用于撤销线上改动（版本号仍会 +1，删服务器文件无法让已更新的玩家回退）\n' +
    '· 玩家下次启动拉回原版关卡\n\n继续？'
  );
  if (!ok) return;

  status('读取内置关卡…');
  const br = await fetch('/api/builtin');
  const bd = await br.json();
  if (!bd.levels || !bd.levels.length) { status('读取内置关卡失败', 'err'); return; }

  status('发布回滚包…（上传 → 回读校验）');
  $('btnRollback').disabled = true;
  const r = await fetch('/api/publish', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ levels: bd.levels }),
  });
  const d = await r.json();
  $('btnRollback').disabled = false;

  if (!d.ok) {
    status('回滚失败：' + d.error, 'err');
    toast('回滚失败：' + d.error + (d.detail ? '（' + d.detail + '）' : ''), 'err', d.problems);
    return;
  }
  S.levels = bd.levels;
  S.version = d.version;
  S.remoteVersion = d.live;
  S.dirty = false;
  S.source = 'server';
  S.sel = null;
  S.cur = Math.min(S.cur, S.levels.length - 1);
  updateChips();
  renderList();
  renderAll();
  status(d.consistent ? '已回滚：线上 v' + d.version + ' = 内置原版' : '已上传 v' + d.version + '，回读 v' + d.live, d.consistent ? 'ok' : 'err');
  toast(d.consistent ? '回滚成功 · 线上 v' + d.version : '回滚上传完成，版本回读不一致', d.consistent ? 'ok' : 'err');
}

function quickProblems() {
  const out = [];
  if (!S.levels.length) out.push('没有关卡数据');
  S.levels.forEach((l, i) => {
    if (!(l.pigs || []).length) out.push('第 ' + (i + 1) + ' 关没有章鱼');
    if (!(l.birds || []).length) out.push('第 ' + (i + 1) + ' 关没有用鸟序列');
    const st = l.stars || [];
    if (st.length !== 3 || !(st[0] < st[1] && st[1] < st[2])) out.push('第 ' + (i + 1) + ' 关星级门槛不递增');
  });
  return out.slice(0, 8);
}

async function doDiscard() {
  if (!confirm('丢弃本地草稿，重新从服务器/内置读取？未发布的改动会丢失。')) return;
  const r = await fetch('/api/discard', { method: 'POST' });
  const d = await r.json();
  S.levels = d.levels;
  S.version = d.version;
  S.source = d.source;
  S.dirty = false;
  S.sel = null;
  S.cur = 0;
  renderList();
  renderAll();
  status('已丢弃草稿（' + sourceLabel() + '）');
}

// ==================== 绑定 ====================

$('btnSave').onclick = doSave;
$('btnPublish').onclick = doPublish;
$('btnRollback').onclick = doRollback;
$('btnDiscard').onclick = doDiscard;
$('addBlock').onclick = addBlock;
$('addPig').onclick = addPig;
$('addPearl').onclick = addPearl;
$('delSel').onclick = delSelected;

window.addEventListener('resize', () => { draw(); });

setupCanvas();
boot().catch((e) => {
  document.body.innerHTML = '<pre style="color:#FF8A80;padding:20px">启动失败：' + e.message + '</pre>';
});
