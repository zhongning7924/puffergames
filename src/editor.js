/**
 * 造关师 - 关卡编辑器状态/输入逻辑（隔离模块，不污染既有玩法）。
 * Level editor: state + touch logic. Drafts produce plain level objects
 * identical in shape to src/levels.js, consumed directly by setupLevel().
 *
 * T4：状态骨架（进出 EDITOR / 试玩装载 / 三入口复位由 level-flow 负责）。
 * T5：物料栏/放置/选中/拖动/删除/实时校验/proven 重置。
 * 存档/分享/启动直达在 T7 填充（占位函数见文末导出）。
 */
'use strict';

const C = require('./config.js');
const E = require('./entities.js');
const CODEC = require('./level-codec.js');
const VALIDATE = require('./level-validate.js');
const LEVEL_FLOW = require('./level-flow.js');
const SOCIAL = require('./social.js');

// 注意：GROUND_Y 随 C.init() 随机型屏高变化（375×667→577、375×812→722），
// 不可在模块加载期冻结，用到的地方一律实时读 C.GROUND_Y（812 重 init 测试依赖此点）。
const GRID = CODEC.GRID;

// ==================== 布局常量 ====================
const TOP_CONTENT_H = 48;  // 顶栏内容带高（背景从 y=0 画到 SAFE_TOP+此值，盖住状态栏）
// 顶栏 4 分类分段控件：x/w/segW 为静态几何，y 是相对 SAFE_TOP 的偏移（真机随刘海下移）
const SEG = { x: 88, y: 6, w: 184, h: 36, segW: 46 };
const BAR_H = 84;          // 旧底栏总高（T12-3 将被大卡底栏替换，过渡期保留）
const TAB_H = 28;
const CHIP = 64;           // 物料 chip 宽
const CHIP_GAP = 8;
const ZONE_X = C.SCREEN_WIDTH * 0.33; // 弹弓禁放区（与 validateLevel 同公式）

// ==================== 物料表 ====================
const TABS = [
  { id: 'blocks', label: '方块' },
  { id: 'enemies', label: '敌人' },
  { id: 'birds', label: '河豚' },
  { id: 'items', label: '道具' },
];
const PALETTE = {
  blocks: [
    { id: 'wood-b', kind: 'block', type: 'wood', w: 80, h: 26, label: '木梁' },
    { id: 'wood-p', kind: 'block', type: 'wood', w: 28, h: 80, label: '木柱' },
    { id: 'wood-q', kind: 'block', type: 'wood', w: 28, h: 28, label: '木块' },
    { id: 'stone-b', kind: 'block', type: 'stone', w: 80, h: 26, label: '石梁' },
    { id: 'stone-p', kind: 'block', type: 'stone', w: 28, h: 80, label: '石柱' },
    { id: 'stone-q', kind: 'block', type: 'stone', w: 28, h: 28, label: '石块' },
    { id: 'ice-b', kind: 'block', type: 'ice', w: 80, h: 26, label: '冰梁' },
    { id: 'ice-p', kind: 'block', type: 'ice', w: 28, h: 80, label: '冰柱' },
    { id: 'ice-q', kind: 'block', type: 'ice', w: 28, h: 28, label: '冰块' },
    { id: 'burst', kind: 'block', type: 'burst', w: 26, h: 26, label: '爆裂果' },
  ],
  enemies: [
    { id: 'pig-s', kind: 'pig', radius: 17, label: '小章鱼' },
    { id: 'pig-l', kind: 'pig', radius: 22, label: '大章鱼' },
  ],
  birds: [
    { id: 'normal', kind: 'bird', type: 'normal', label: '嘟嘟' },
    { id: 'dash', kind: 'bird', type: 'dash', label: '梭梭' },
    { id: 'bomb', kind: 'bird', type: 'bomb', label: '砰砰' },
    { id: 'split', kind: 'bird', type: 'split', label: '三丸子' },
  ],
  items: [
    { id: 'pearl', kind: 'pearl', label: '珍珠' },
    { id: 'eraser', kind: 'eraser', label: '橡皮' },
  ],
};

/** 跨 tab 按 id 查物料定义 */
function findPalette(id) {
  for (const t of TABS) {
    const f = PALETTE[t.id].find(i => i.id === id);
    if (f) return f;
  }
  return null;
}

// ==================== 草稿模型 ====================

/** 全新草稿：1 只普通河豚，无方块/章鱼/珍珠 */
function newDraft() {
  return { blocks: [], pigs: [], pearls: [], birds: ['normal'] };
}

/** 从（解码出的）纯数据实体构造编辑器实体实例（草稿统一存实例，渲染直接 ent.draw） */
function instantiateDraft(data) {
  return {
    blocks: (data.blocks || []).map(b => new E.Block(b.x, b.y, b.width, b.height, b.type)),
    pigs: (data.pigs || []).map(p => new E.Pig(p.x, p.y, p.radius)),
    pearls: (data.pearls || []).map(p => ({ x: p.x, y: p.y })),
    birds: (data.birds && data.birds.length) ? data.birds.slice() : ['normal'],
  };
}

/** 草稿 → 可装载关卡对象（补展示/结算字段；stars 仿每日关公式） */
function deriveLevel(draft) {
  const level = {
    name: '自制关',
    flavor: '玩家创作',
    trajectory: 70,
    birds: draft.birds.slice(),
    blocks: draft.blocks.map(b => ({
      x: Math.round(b.x), y: Math.round(b.y), width: b.width, height: b.height, type: b.type,
    })),
    pigs: draft.pigs.map(p => ({ x: Math.round(p.x), y: Math.round(p.y), radius: p.radius })),
    pearls: draft.pearls.map(p => ({ x: Math.round(p.x), y: Math.round(p.y), reward: true })),
  };
  const base = level.pigs.length * 1000 + level.blocks.length * 250;
  level.stars = [Math.round(base * 0.6), base, Math.round(base * 1.5)];
  return level;
}

// ==================== 进出状态 ====================

/** 进入编辑器（保留已有草稿；首次进入初始化空草稿） */
function enterEditor(game) {
  if (!game.editor || !game.editor.draft) {
    game.editor = {
      draft: newDraft(),
      tab: 'blocks', palette: null, eraser: false,
      selected: null, drag: null, barDrag: null, scrollX: 0,
      proven: false, issues: [],
      touchX: 0, touchY: 0, rejectFlash: 0,
    };
  }
  game.isCustom = false;
  game.playOrigin = null;
  game.buttons = {};
  // 顶栏：退出/试玩为马卡龙 sketch 胶囊（热区 ≥36 高，随 SAFE_TOP 避开刘海）；
  // 中间 4 分类分段为自绘控件（不进 game.buttons，命中走 SEG 几何）。
  game.buttons.editorExit = new E.Button(8, C.SAFE_TOP + 6, 72, 36, '‹退出', '#5B8DB8',
    { sketch: true, radius: 18, fontSize: 14, shadowOffset: 3 });
  game.buttons.editorPlay = new E.Button(C.SCREEN_WIDTH - 95, C.SAFE_TOP + 4, 87, 40, '▶ 试玩', '#57C98E',
    { sketch: true, radius: 20, fontSize: 14, shadowOffset: 3 });
  // 清空运行时世界（避免上一关残留实体被物理 update / 主渲染画出；编辑器画自己的草稿）
  game.blocks = [];
  game.pigs = [];
  game.pearls = [];
  game.birds = [];
  game.extraBirds = [];
  game.particles = [];
  game.floatingTexts = [];
  game.currentBird = null;
  game.state = 'EDITOR';
  revalidate(game);
}

/** 退出编辑器回主菜单 */
function editorExit(game) {
  game.state = 'MENU';
  game.buttons = {};
}

/** 返回编辑器（作者流试玩结束后；草稿保留） */
function backToEditor(game) {
  enterEditor(game);
}

/** 装载自制关进入试玩/挑战。code 为关卡码（挑战流二次分享/成绩记录用；作者流为 null） */
function playCustom(game, level, origin, code) {
  game.customLevel = level;
  game.customCode = code || null;
  game.isCustom = true;
  game.playOrigin = origin || 'challenge';
  game.listView = null;
  game.launchError = '';
  game.clipboardError = '';
  game.msgTimer = 0;
  game.currentLevelIndex = -1;
  LEVEL_FLOW.setupLevel(game, level);
  game.state = 'READY';
}

// ==================== 编辑操作 ====================

function snap(v) { return Math.round(v / GRID) * GRID; }

/** 落点支撑：该 x 处最高（y 最小）的可承托方块顶面；否则海床 */
function groundYAt(draft, x) {
  let top = C.GROUND_Y;
  for (const b of draft.blocks) {
    if (x >= b.x - 2 && x <= b.x + b.width + 2 && b.y < top) top = b.y;
  }
  return top;
}

/** 重新跑编辑器校验，问题红圈由渲染层常显 */
function revalidate(game) {
  game.editor.issues = VALIDATE.validateLevel(deriveLevel(game.editor.draft), { editor: true }).issues;
}

/** 任何结构变异：通关证明作废（须重新试玩取胜才能分享） */
function touchStructure(game) { game.editor.proven = false; }

/** 红闪反馈（非法放置/试玩被拒）；update 中衰减 */
function flashReject(game) { game.editor.rejectFlash = 20; }

/** 禁区判定与 validateLevel 一致：方块看左缘、圆体看左缘（中心-半径） */
function zoneBlocked(x, radius) { return radius ? (x - radius < ZONE_X) : (x < ZONE_X); }

function blocksOverlap(a, b) {
  return a.x < b.x + b.width - 0.01 && b.x < a.x + a.width - 0.01 &&
    a.y < b.y + b.height - 0.01 && b.y < a.y + a.height - 0.01;
}

function pigOverlap(ent, pigs) {
  return pigs.some(p => Math.hypot(p.x - ent.x, p.y - ent.y) < p.radius + ent.radius - 0.01);
}

/**
 * 物料将落的位置（网格吸附 + 防沉地钳制）。placeAt 与吸附预览共用同一公式，
 * 保证「所见即所放」。悬空不钳（放高空保持原位，试玩时物理下落）；
 * 仅当底边会穿支撑面（柱顶/地面）时抬到支撑面，snap 量化最多再抬 2px。
 */
function placePosition(draft, item, x, y) {
  if (item.kind === 'block') {
    const bx = snap(x - item.w / 2);
    const support = groundYAt(draft, x);
    let by = snap(Math.min(y - item.h / 2, support - item.h));
    by = Math.min(by, support - item.h);
    return { x: bx, y: by };
  }
  if (item.kind === 'pig') {
    const px = snap(x);
    const support = groundYAt(draft, px);
    let py = snap(Math.min(y, support) - item.radius);
    py = Math.min(py, support - item.radius);
    return { x: px, y: py };
  }
  if (item.kind === 'pearl') return { x: snap(x), y: snap(y) };
  return null;
}

/** 在世界坐标 (x,y) 放置物料（grid 吸附 / 支撑面 / 禁区 / 重叠 / 数量门限） */
function placeAt(game, x, y, item) {
  const d = game.editor;
  if (!item || item.kind === 'eraser') return;
  if (item.kind === 'bird') { addBird(game, item.type); return; }
  const pos = placePosition(d.draft, item, x, y);
  if (!pos) return;
  if (item.kind === 'block') {
    if (d.draft.blocks.length >= CODEC.LIMITS.blocks) return;
    if (zoneBlocked(pos.x)) { flashReject(game); return; }
    const ent = new E.Block(pos.x, pos.y, item.w, item.h, item.type); // 草稿存实体实例
    if (d.draft.blocks.some(b => blocksOverlap(ent, b))) { flashReject(game); return; }
    d.draft.blocks.push(ent);
  } else if (item.kind === 'pig') {
    if (d.draft.pigs.length >= CODEC.LIMITS.pigs) return;
    if (zoneBlocked(pos.x, item.radius)) { flashReject(game); return; }
    const ent = new E.Pig(pos.x, pos.y, item.radius);
    if (pigOverlap(ent, d.draft.pigs)) { flashReject(game); return; }
    d.draft.pigs.push(ent);
  } else if (item.kind === 'pearl') {
    if (d.draft.pearls.length >= CODEC.LIMITS.pearls) return;
    if (zoneBlocked(pos.x, 9)) { flashReject(game); return; }
    d.draft.pearls.push({ x: pos.x, y: pos.y });
  }
  touchStructure(game);
  revalidate(game);
}

function addBird(game, type) {
  const d = game.editor;
  if (d.draft.birds.length >= 6) return;
  d.draft.birds.push(type);
  touchStructure(game);
}

function removeBirdAt(game, queueIndex) {
  const d = game.editor;
  if (d.draft.birds.length <= 1) return; // 至少 1 只
  d.draft.birds.splice(queueIndex, 1);
  touchStructure(game);
  revalidate(game);
}

/** 候飞豚站位（与 level-flow.queuePosition 同公式；编辑器里全部豚排队列、不站弹弓） */
function queueBirdPos(i) {
  return {
    x: C.SLINGSHOT_X - 35 - (i % 3) * 21,
    y: C.GROUND_Y - C.BIRD_RADIUS - Math.floor(i / 3) * 28,
  };
}

/** 命中测试：章鱼 → 方块 → 珍珠 → 候飞豚（后画的在上，倒序查） */
function hitTest(game, x, y) {
  const d = game.editor;
  for (let i = d.draft.pigs.length - 1; i >= 0; i--) {
    const p = d.draft.pigs[i];
    if (Math.hypot(x - p.x, y - p.y) < p.radius + 6) return { kind: 'pig', index: i };
  }
  for (let i = d.draft.blocks.length - 1; i >= 0; i--) {
    const b = d.draft.blocks[i];
    if (x >= b.x - 6 && x <= b.x + b.width + 6 && y >= b.y - 6 && y <= b.y + b.height + 6) {
      return { kind: 'block', index: i };
    }
  }
  for (let i = d.draft.pearls.length - 1; i >= 0; i--) {
    const p = d.draft.pearls[i];
    if (Math.hypot(x - p.x, y - p.y) < 16) return { kind: 'pearl', index: i };
  }
  for (let i = 0; i < d.draft.birds.length; i++) {
    const pos = queueBirdPos(i);
    if (Math.hypot(x - pos.x, y - pos.y) < 18) return { kind: 'queuebird', index: i };
  }
  return null;
}

/** 删除命中实体（橡皮模式 / 浮条删除共用） */
function removeAt(game, x, y) {
  const h = hitTest(game, x, y);
  if (!h) return;
  const d = game.editor;
  if (h.kind === 'block') d.draft.blocks.splice(h.index, 1);
  else if (h.kind === 'pig') d.draft.pigs.splice(h.index, 1);
  else if (h.kind === 'pearl') d.draft.pearls.splice(h.index, 1);
  else if (h.kind === 'queuebird') return removeBirdAt(game, h.index);
  d.selected = null;
  touchStructure(game);
  revalidate(game);
}

/** 试玩门：校验全绿才装载；否则红闪（问题红圈已常显） */
function tryPlay(game) {
  const d = game.editor;
  revalidate(game);
  if (d.issues.length) { flashReject(game); return; }
  playCustom(game, deriveLevel(d.draft), 'author');
}

// ==================== 触摸状态机 ====================
// 注意：wx.onTouchEnd 回调不带坐标，start/move 时缓存 touchX/touchY，end 用缓存值。

function cacheTouch(d, x, y) { d.touchX = x; d.touchY = y; }

/** 切换顶栏分类：清已挂物料、复位横滚；eraser 刻意保留（橡皮跨分类武装，删任意类实体） */
function switchTab(d, id) {
  d.tab = id;
  d.palette = null;
  d.barDrag = null;
  d.scrollX = 0;
}

function barMaxScroll(d) {
  const n = (PALETTE[d.tab] || []).length;
  const contentW = 8 + n * (CHIP + CHIP_GAP) + 8;
  return Math.max(0, contentW - C.SCREEN_WIDTH);
}

/** 底栏选中物料：河豚直接入队；橡皮切换；其余挂 palette 进入放置模式 */
function selectPalette(game, item) {
  const d = game.editor;
  if (item.kind === 'bird') { addBird(game, item.type); d.palette = null; d.eraser = false; return; }
  if (item.kind === 'eraser') { d.eraser = !d.eraser; d.palette = null; return; }
  d.palette = item;
  d.eraser = false;
}

function onTouchStart(game, x, y) {
  const d = game.editor;
  cacheTouch(d, x, y);
  const topH = C.SAFE_TOP + TOP_CONTENT_H;
  // 1. 顶栏带（背景从 y=0 画起盖住状态栏；0..SAFE_TOP 状态栏区只吞不响应）
  if (y < topH) {
    // 退出/试玩胶囊
    for (const k of ['editorExit', 'editorPlay']) {
      if (game.buttons[k] && game.buttons[k].contains(x, y)) { game.buttons[k].pressed = true; return; }
    }
    // 4 分类分段（命中带放宽到整条内容高度，单段 46×48 好过手指）
    if (y >= C.SAFE_TOP && x >= SEG.x && x < SEG.x + SEG.w) {
      const i = Math.floor((x - SEG.x) / SEG.segW);
      if (TABS[i]) switchTab(d, TABS[i].id);
    }
    return;
  }
  // 2. 旧底栏（T12-3 将被大卡底栏替换）：tab 行立即切；物料行记手势，抬手未滚动才选 chip
  if (y > C.SCREEN_HEIGHT - BAR_H) {
    const barTop = C.SCREEN_HEIGHT - BAR_H;
    if (y <= barTop + TAB_H) {
      const i = Math.floor(x / (C.SCREEN_WIDTH / TABS.length));
      if (TABS[i]) switchTab(d, TABS[i].id);
      return;
    }
    d.barDrag = { startX: x, scrollStart: d.scrollX, moved: false };
    return;
  }
  // 3. 世界区
  const h = hitTest(game, x, y);
  if (d.eraser) { if (h) removeAt(game, x, y); return; }
  if (h) {
    if (h.kind === 'queuebird') return; // 候飞豚点按在 touchend 处理移除（避免误触）
    d.selected = h;
    let offX = 0, offY = 0;
    if (h.kind === 'block') { const b = d.draft.blocks[h.index]; offX = x - b.x; offY = y - b.y; }
    else if (h.kind === 'pig') { const p = d.draft.pigs[h.index]; offX = x - p.x; offY = y - p.y; }
    else if (h.kind === 'pearl') { const p = d.draft.pearls[h.index]; offX = x - p.x; offY = y - p.y; }
    d.drag = { ...h, startX: x, startY: y, offX, offY, moved: false };
  } else if (d.palette) {
    placeAt(game, x, y, d.palette);
  } else {
    d.selected = null; // 点空白取消选中
  }
}

function onTouchMove(game, x, y) {
  const d = game.editor;
  cacheTouch(d, x, y);
  if (d.drag) {
    d.drag.moved = true;
    moveEntity(game, d.drag, x, y);
  } else if (d.barDrag) {
    const dx = x - d.barDrag.startX;
    if (Math.abs(dx) > 6) d.barDrag.moved = true;
    d.scrollX = Math.max(0, Math.min(barMaxScroll(d), d.barDrag.scrollStart - dx));
  }
}

function onTouchEnd(game) {
  const d = game.editor;
  const x = d.touchX, y = d.touchY; // touchend 无坐标，用缓存
  // 顶栏按钮释放
  if (game.buttons.editorExit && game.buttons.editorExit.pressed) {
    game.buttons.editorExit.pressed = false; return editorExit(game);
  }
  if (game.buttons.editorPlay && game.buttons.editorPlay.pressed) {
    game.buttons.editorPlay.pressed = false; return tryPlay(game);
  }
  // 底栏 chip 点按（未滚动才触发）
  if (d.barDrag) {
    const bd = d.barDrag;
    d.barDrag = null;
    if (!bd.moved && bd.startX > 0) {
      const items = PALETTE[d.tab] || [];
      const localX = bd.startX + bd.scrollStart; // 点击瞬间无滚动，用起始 scroll 反算
      for (let j = 0; j < items.length; j++) {
        const left = 8 + j * (CHIP + CHIP_GAP);
        if (localX >= left && localX <= left + CHIP) { selectPalette(game, items[j]); break; }
      }
    }
    return;
  }
  // 世界区拖动收尾
  const wasDrag = d.drag;
  if (wasDrag) {
    if (wasDrag.moved) { touchStructure(game); revalidate(game); }
    d.drag = null;
  }
  // 点候飞豚移除（touchend 且未拖动）
  if (!wasDrag && y != null && y < C.SCREEN_HEIGHT - BAR_H) {
    const h = hitTest(game, x, y);
    if (h && h.kind === 'queuebird') removeBirdAt(game, h.index);
  }
}

/** 拖动中实体跟手（网格吸附；底不穿海床；禁区/重叠不拦，抬手 revalidate 红圈兜底） */
function moveEntity(game, drag, x, y) {
  const d = game.editor;
  if (drag.kind === 'block') {
    const b = d.draft.blocks[drag.index];
    if (!b) return;
    b.x = snap(x - drag.offX);
    b.y = Math.min(snap(y - drag.offY), C.GROUND_Y - b.height);
  } else if (drag.kind === 'pig') {
    const p = d.draft.pigs[drag.index];
    if (!p) return;
    p.x = snap(x - drag.offX);
    p.y = Math.min(snap(y - drag.offY), C.GROUND_Y - p.radius);
  } else if (drag.kind === 'pearl') {
    const p = d.draft.pearls[drag.index];
    if (!p) return;
    p.x = snap(x - drag.offX);
    p.y = snap(y - drag.offY);
  }
}

/** 每帧：红闪衰减 + 顶栏/浮条按钮缩放动画（仅可见按钮） */
function update(game) {
  const d = game.editor;
  if (!d) return;
  if (d.rejectFlash > 0) d.rejectFlash--;
  for (const k of ['editorExit', 'editorPlay']) {
    if (game.buttons[k]) game.buttons[k].update();
  }
}

// ==================== 本地存档（我造的关 / 挑战记录） ====================

const SLOT_KEY = 'pufferGo_editor_levels';
const PLAYED_KEY = 'pufferGo_played_levels';
const MAX_SLOTS = 12; // v1 本地槽位上限（单码 <700 字符，存储压力极小）

function readStore(key) {
  try { return wx.getStorageSync(key) || []; } catch (e) { return []; }
}
function writeStore(key, list) {
  try { wx.setStorageSync(key, list); } catch (e) { /* 存储满/不可用：静默 */ }
}

/** 保存当前草稿到「我造的关」（须 proven；返回槽位对象，未通关返回 null） */
function saveCurrent(game) {
  const d = game.editor;
  if (!d || !d.proven) return null;
  const slots = listSlots(game);
  if (slots.length >= MAX_SLOTS) return null;
  const code = CODEC.encodeLevel(deriveLevel(d.draft));
  const now = new Date();
  const name = `自制·${String(now.getMonth() + 1).padStart(2, '0')}-` +
    `${String(now.getDate()).padStart(2, '0')} #${slots.length + 1}`;
  const slot = { name, code, proven: true, createdAt: Date.now() };
  slots.push(slot);
  writeStore(SLOT_KEY, slots);
  d.lastCode = code;
  return slot;
}

function listSlots(game) { return readStore(SLOT_KEY); }

function deleteSlot(game, i) {
  const slots = listSlots(game);
  slots.splice(i, 1);
  writeStore(SLOT_KEY, slots);
}

/** 重开槽位：解码 → 实体实例化草稿 → 进编辑器（proven 随槽位恢复） */
function openSlot(game, i) {
  const slots = listSlots(game);
  if (!slots[i]) return;
  const lv = CODEC.decodeLevel(slots[i].code);
  if (!lv) return;
  // 关键：草稿必须实体实例化，否则 editor-render 调 ent.draw 崩
  game.editor = {
    draft: instantiateDraft(lv),
    tab: 'blocks', palette: null, eraser: false,
    selected: null, drag: null, barDrag: null, scrollX: 0,
    proven: !!slots[i].proven, issues: [],
    touchX: 0, touchY: 0, rejectFlash: 0,
  };
  enterEditor(game); // 复用状态设置（草稿已存在，不会被重置）
  revalidate(game);
}

/** 挑战流成绩记录：同码 bestStars 取最高 */
function recordPlayed(game, code, stars) {
  if (!code) return;
  const list = listPlayed(game);
  const found = list.find(r => r.code === code);
  if (found) {
    found.bestStars = Math.max(found.bestStars || 0, stars);
    found.playedAt = Date.now();
  } else {
    if (list.length >= MAX_SLOTS) list.shift(); // 超上限丢最旧
    list.push({ code, bestStars: stars, playedAt: Date.now() });
  }
  writeStore(PLAYED_KEY, list);
}

function listPlayed(game) { return readStore(PLAYED_KEY); }

function deletePlayed(game, i) {
  const list = listPlayed(game);
  list.splice(i, 1);
  writeStore(PLAYED_KEY, list);
}

/** 挑战记录开档：解码+校验 → 挑战流装载（码坏/被篡改则静默留在列表页） */
function openPlayed(game, i) {
  const list = listPlayed(game);
  if (!list[i]) return;
  const lv = decodePlayable(list[i].code);
  if (lv) game.playCustom(lv, 'challenge', list[i].code);
}

// ==================== 分享 / 启动直达 / 剪贴板 ====================

/**
 * 挑战流解码：decode 通过后再跑编辑器同款全量校验。
 * 关卡码是可手改的字符串（PG1 无校验和），结构合法 ≠ 可玩：0 章鱼会开局白送 WIN、
 * 0 河豚无法发射、方块压弹弓区发射即撞、沉地/互叠是坏关。装载挑战前必须挡下。
 */
function decodePlayable(code) {
  const lv = CODEC.decodeLevel(code);
  if (!lv) return null;
  return VALIDATE.validateLevel(lv, { editor: true }).ok ? lv : null;
}

/** WIN【保存并分享】按钮回调（作者流）：先存档再拉分享卡片 */
function onSaveShare(game) {
  const slot = saveCurrent(game);
  const code = (slot && slot.code) || (game.editor && game.editor.lastCode);
  if (code) SOCIAL.shareCustom(code, game.stars);
}

/** 启动参数分流：战役直达(query.level，保留解锁门控) / 自制关直达(query.custom)，坏码留菜单 */
function handleLaunchQuery(game) {
  const lvl = SOCIAL.getLaunchLevel();
  // 门控必须保留（原构造函数逻辑）：分享卡片不能直达未解锁战役关
  if (typeof lvl === 'number' && lvl < game.progress.unlockedLevels) {
    game.loadLevel(lvl);
    return;
  }
  const code = SOCIAL.getLaunchCustom();
  if (!code) return;
  const lv = decodePlayable(code);
  if (lv) {
    game.playCustom(lv, 'challenge', code); // 第 3 参透传关卡码：二次分享 + recordPlayed 都靠它
  } else {
    game.state = 'MENU';
    game.isCustom = false;
    game.playOrigin = null;
    game.launchError = '关卡码损坏，无法装载';
    game.msgTimer = 240;
  }
}

/** 菜单【输码挑战】：读剪贴板 → 解码 → 挑战；失败置 clipboardError 供菜单飘字 */
function enterFromClipboard(game) {
  try {
    wx.getClipboardData({
      success: (res) => {
        const code = (res.data || '').trim();
        const lv = decodePlayable(code);
        if (lv) game.playCustom(lv, 'challenge', code);
        else { game.clipboardError = '剪贴板里没有有效关卡码'; game.msgTimer = 240; }
      },
    });
  } catch (e) {
    game.clipboardError = '剪贴板不可用';
    game.msgTimer = 240;
  }
}

module.exports = {
  enterEditor, editorExit, playCustom, backToEditor, newDraft,
  deriveLevel, instantiateDraft,
  placeAt, placePosition, removeAt, addBird, removeBirdAt,
  findPalette, hitTest, tryPlay, decodePlayable,
  saveCurrent, listSlots, deleteSlot, openSlot,
  recordPlayed, listPlayed, deletePlayed, openPlayed,
  onSaveShare, handleLaunchQuery, enterFromClipboard,
  onTouchStart, onTouchMove, onTouchEnd, update,
  queueBirdPos,
  TABS, PALETTE,
  // 布局常量（editor-render 共用）
  TOP_CONTENT_H, SEG, BAR_H, TAB_H, CHIP, CHIP_GAP, ZONE_X,
};
