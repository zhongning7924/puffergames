/**
 * 造关师 - 关卡编辑器状态/输入逻辑（隔离模块，不污染既有玩法）。
 * Level editor: state + touch logic. Drafts produce plain level objects
 * identical in shape to src/levels.js, consumed directly by setupLevel().
 *
 * T4：状态骨架（进出 EDITOR / 试玩装载 / 三入口复位由 level-flow 负责）。
 * 物料栏/放置/拖动/存档/分享在后续任务填充（占位函数见文末导出）。
 */
'use strict';

const C = require('./config.js');
const E = require('./entities.js');
const CODEC = require('./level-codec.js');
const VALIDATE = require('./level-validate.js');
const LEVEL_FLOW = require('./level-flow.js');
const SOCIAL = require('./social.js');

const GY = C.GROUND_Y;
const GRID = CODEC.GRID;

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

/** 进入编辑器（保留已有草稿；首次进入初始化空草稿） */
function enterEditor(game) {
  if (!game.editor || !game.editor.draft) {
    game.editor = {
      draft: newDraft(),
      tab: 'blocks', palette: null, eraser: false,
      selected: null, drag: null, scrollX: 0,
      proven: false, issues: [], showIssues: false,
      touchX: 0, touchY: 0, rejectFlash: 0,
    };
  }
  game.isCustom = false;
  game.playOrigin = null;
  game.buttons = {};
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
  game.currentLevelIndex = -1;
  LEVEL_FLOW.setupLevel(game, level);
  game.state = 'READY';
}

// ==================== 以下为后续任务填充的占位 ====================

function update(game) { /* T5：预览动画/红圈闪烁/拒绝反馈计时 */ }
function onTouchStart(game, x, y) { /* T5 */ }
function onTouchMove(game, x, y) { /* T5 */ }
function onTouchEnd(game) { /* T5 */ }

// T6 占位（screens/input 接线先于实现，避免 undefined）
function onSaveShare(game) { /* T7 填实现 */ }

// T7 占位
function saveCurrent(game) { return null; }
function listSlots(game) { return []; }
function deleteSlot(game, i) { /* T7 */ }
function openSlot(game, i) { /* T7 */ }
function recordPlayed(game, code, stars) { /* T7 */ }
function listPlayed(game) { return []; }
function deletePlayed(game, i) { /* T7 */ }
function handleLaunchQuery(game) { /* T7 */ }
function enterFromClipboard(game) { /* T7 */ }

// T5 填充的操作函数（先占位，避免跨模块委托 undefined）
function placeAt() {} function removeAt() {} function addBird() {} function removeBirdAt() {}
function findPalette() { return null; } function hitTest() { return null; } function tryPlay() {}
const TABS = [];
const PALETTE = {};

module.exports = {
  enterEditor, editorExit, playCustom, backToEditor, newDraft,
  deriveLevel, instantiateDraft,
  placeAt, removeAt, addBird, removeBirdAt,
  findPalette, hitTest, tryPlay,
  saveCurrent, listSlots, deleteSlot, openSlot,
  recordPlayed, listPlayed, deletePlayed,
  onSaveShare, handleLaunchQuery, enterFromClipboard,
  onTouchStart, onTouchMove, onTouchEnd, update,
  TABS, PALETTE,
};
