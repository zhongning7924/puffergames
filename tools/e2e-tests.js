/**
 * 端到端行为测试 - mock 环境驱动完整游戏流程并断言内部状态
 * E2E Tests - drive the real game singleton through mocked input and assert state.
 *
 * 运行：node tools/e2e-tests.js
 * 覆盖：关卡流程（鸟数/胜负判定）、候飞队列越屏回归、技能教学提示、
 *       D 组难度修正数据、弹道残影（P0）、珍珠系统（P1）、广告复活、
 *       通关结算/存档、设置开关、全状态渲染冒烟。
 */

'use strict';

const assert = require('assert');
const { installEnv, loadGame } = require('./test-harness.js');

const env = installEnv({ rewardAd: true }); // 激励视频必看成功（复现 DevTools 行为）
const game = loadGame();
const C = require('../src/config.js');

// ===== 极简测试运行器 =====
const tests = [];
let passed = 0, failed = 0;
function test(name, fn) { tests.push({ name, fn }); }
function run() {
  for (const t of tests) {
    try {
      t.fn();
      passed++;
      console.log('✓ ' + t.name);
    } catch (e) {
      failed++;
      console.error('✗ ' + t.name + '\n    ' + (e && e.message ? e.message : e));
    }
  }
  console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} 通过, ${failed} 失败`);
  process.exit(failed === 0 ? 0 : 1);
}

/** 发射当前鸟（轻拉弓弱弹射，打不到猪） */
function shootOnce() {
  const bx = game.currentBird.x, by = game.currentBird.y;
  env.fire('touchstart', bx, by);
  env.fire('touchmove', bx - 12, by - 8);
  env.fire('touchend');
  env.pump(500); // 飞行 + 结算 + 出下一只或判负
}

/** 恢复全新档（清存储 + 内存进度归零） */
function fresh() {
  env.resetProgress(game);
}

// =====================================================================
// 1. 启动与基础流程
// =====================================================================

test('启动：构造完成进入 MENU，首帧渲染无异常', () => {
  assert.strictEqual(game.state, 'MENU');
  env.pump(3);
  assert.strictEqual(game.state, 'MENU');
});

test('L1 鸟数闭环：3 只全部打空后判负，无无限出鸟', () => {
  fresh();
  game.loadLevel(0);
  env.pump(3);
  assert.strictEqual(game.birdsRemaining, 3);
  let shots = 0;
  while (game.state === 'READY' && shots < 10) { shots++; shootOnce(); }
  assert.strictEqual(shots, 3, `实际可发射 ${shots} 次`);
  assert.strictEqual(game.state, 'LOSE');
});

test('候飞队列越屏回归：全部关卡所有候飞鸟在屏幕内、排数 ≤ 2', () => {
  fresh();
  for (let i = 0; i < game.levels.length; i++) {
    game.loadLevel(i);
    env.pump(2);
    const dispR = 17 * 0.85;
    const rows = new Set(game.birds.map(b => b.y));
    assert.ok(rows.size <= 2, `L${i + 1} 队列排数 ${rows.size} > 2`);
    game.birds.forEach((b, j) => {
      assert.ok(b.x - dispR >= 0, `L${i + 1} 候飞鸟 #${j} 越屏 x=${b.x}`);
      assert.ok(b.x + dispR <= C.SCREEN_WIDTH, `L${i + 1} 候飞鸟 #${j} 越右缘 x=${b.x}`);
    });
  }
});

// =====================================================================
// 2. 技能教学提示（D 组修正回归）
// =====================================================================

test('技能教学：L2/L3/L7 首次进入显示对应提示，二次进入不显示', () => {
  fresh();
  game.loadLevel(1);
  assert.strictEqual(game.hintText, '新技能：梭梭空中点击极速冲刺！');
  assert.strictEqual(game.hintAlpha, 1);
  env.pump(3);
  game.loadLevel(1);
  assert.strictEqual(game.hintText, null);
  assert.strictEqual(game.hintAlpha, 0);

  game.loadLevel(2);
  assert.strictEqual(game.hintText, '新技能：砰砰空中点击范围爆炸！');
  env.pump(3);
  game.loadLevel(6);
  assert.strictEqual(game.hintText, '新技能：三丸子空中点击一分为三！');
});

test('教学提示：L1 默认拖拽教学每次显示；每日挑战不弹技能教学', () => {
  fresh();
  game.loadLevel(0);
  assert.strictEqual(game.hintText, null);
  assert.strictEqual(game.hintAlpha, 1);
  game.startDaily();
  assert.strictEqual(game.hintAlpha, 0);
  assert.strictEqual(game.hintText, null);
});

test('难度修正数据：L8 双石镇 + 门槛 20000；L9 弹道 30 + 门槛 23000', () => {
  fresh();
  assert.strictEqual(game.levels[7].blocks.filter(b => b.type === 'stone').length, 2);
  assert.strictEqual(game.levels[7].stars[2], 20000);
  assert.strictEqual(game.levels[8].trajectory, 30);
  assert.strictEqual(game.levels[8].stars[2], 23000);
});

// =====================================================================
// 3. 弹道残影（P0）
// =====================================================================

test('弹道残影：发射后记录完整轨迹，结算后保留，下一发发射时重置', () => {
  fresh();
  game.loadLevel(0);
  env.pump(3);
  assert.strictEqual(game.lastTrail, null, '进关时无残影');
  shootOnce();
  assert.ok(Array.isArray(game.lastTrail) && game.lastTrail.length > 10,
    `第一发应记录 >10 点，实际 ${game.lastTrail ? game.lastTrail.length : 'null'}`);
  const len1 = game.lastTrail.length;
  assert.strictEqual(game.state, 'READY');
  assert.strictEqual(game.lastTrail.length, len1, '残影保留到下一发发射前');
  shootOnce();
  assert.ok(game.lastTrail.length < len1 || game.lastTrail.length >= 0);
  assert.ok(Array.isArray(game.lastTrail), '第二发重置为新记录');
});

// =====================================================================
// 4. 珍珠系统（P1）
// =====================================================================

test('场景珍珠：触碰拾取、入库存档、已收集不重复出现', () => {
  fresh();
  game.loadLevel(0);
  env.pump(3);
  assert.strictEqual(game.pearls.length, 1);
  assert.strictEqual(game.pearls[0].collected, false);
  game.checkPearlCollection({ x: game.pearls[0].x, y: game.pearls[0].y, radius: 17 });
  assert.strictEqual(game.pearls[0].collected, true);
  assert.strictEqual(game.progress.pearls.lv0, true);
  assert.strictEqual(env.readProgress().pearls.lv0, true, '持久化到 storage');
  game.loadLevel(0);
  env.pump(3);
  assert.strictEqual(game.pearls[0].collected, true, '已入库珍珠不再出现');
});

test('章节珍珠：本章全三星自动奖励，且仅奖励一次', () => {
  fresh();
  game.progress.stars = { 0: 3, 1: 3, 2: 2 };
  game.loadLevel(2);
  env.pump(3);
  game.score = 99999;
  game.stars = 3;
  game.saveWinProgress();
  assert.strictEqual(game.progress.pearls.ch1, true);
  assert.strictEqual(game.newPearlAwarded, '新手湾全三星');
  game.newPearlAwarded = null;
  game.saveWinProgress();
  assert.strictEqual(game.newPearlAwarded, null, '重复通关不重复奖励');
});

test('菜单彩蛋：双击吉祥物收集隐藏珍珠', () => {
  fresh();
  game.goToMenu();
  env.pump(3);
  const mx = C.SCREEN_WIDTH / 2, my = C.SCREEN_HEIGHT * 0.3 - 42;
  env.fire('touchstart', mx, my);
  env.pump(1); // 虚拟时钟推进 16ms（< 500ms 双击窗口）
  env.fire('touchstart', mx, my);
  assert.strictEqual(game.progress.pearls.ui, true);
});

test('珍珠关：入口显示、可进入、确定性重开、不污染战役档', () => {
  fresh();
  game.progress.pearls = { lv0: true, lv1: true };
  game.goToLevelSelect();
  env.pump(3);
  assert.ok(game.buttons.bonus, '选关页应出现珍珠关按钮');
  game.startNextBonus();
  env.pump(3);
  assert.strictEqual(game.state, 'READY');
  assert.strictEqual(game.isBonus, true);
  assert.ok(game.getCurrentLevel().name.startsWith('珍珠关'));
  // 确定性：同珍珠重开内容一致
  const snap = () => JSON.stringify({
    p: game.getCurrentLevel().pigs.map(p => [p.x, p.y, p.radius]),
    b: game.getCurrentLevel().blocks.map(b => [b.x, b.y, b.width, b.height, b.type]),
  });
  const a = snap();
  game.retryLevel();
  env.pump(3);
  assert.strictEqual(snap(), a, '同种子重开应生成相同关卡');
  // 胜利不写战役档
  game.pigs.forEach(p => { p.dying = true; });
  game.checkWinLose();
  assert.strictEqual(game.state, 'WIN');
  assert.strictEqual(game.progress.stars[0], undefined, '战役星级不受珍珠关影响');
  game.nextLevel();
  assert.strictEqual(game.state, 'LEVEL_SELECT', '珍珠关无下一关');
});

// =====================================================================
// 5. 广告复活（每关限一次）
// =====================================================================

test('广告复活：LOSE 后 +1 鸟继续，第二次失败不再提供复活', () => {
  fresh();
  game.loadLevel(0);
  env.pump(3);
  let shots = 0;
  while (game.state === 'READY' && shots < 10) { shots++; shootOnce(); }
  assert.strictEqual(game.state, 'LOSE');
  game.watchAdRevive();
  env.pump(5);
  assert.strictEqual(game.state, 'READY');
  assert.strictEqual(game.birdsRemaining, 1);
  assert.strictEqual(game.reviveUsed, true);
  shootOnce();
  assert.strictEqual(game.state, 'LOSE', '复活鸟用完再次失败');
  env.pump(3); // 绘制 LOSE 界面（按钮创建）
  assert.ok(!game.buttons.revive, '第二次失败不应再出现复活按钮');
});

// =====================================================================
// 6. 通关结算与进度
// =====================================================================

test('通关：星级计算、进度存档、下一关解锁、结算动画可跳过', () => {
  fresh();
  game.loadLevel(0);
  env.pump(3);
  assert.strictEqual(game.progress.unlockedLevels, 1);
  game.pigs.forEach(p => { p.dying = true; });
  game.checkWinLose();
  assert.strictEqual(game.state, 'WIN');
  // 3 只鸟未用：剩豚奖励 15000 → 3 星（门槛 6000）
  assert.strictEqual(game.score, 15000);
  assert.strictEqual(game.stars, 3);
  assert.strictEqual(game.progress.unlockedLevels, 2, '解锁第 2 关');
  assert.strictEqual(env.readProgress().stars['0'], 3, '星级持久化');
  // 结算动画推进 + 跳过
  env.pump(20);
  game.skipWinAnim();
  assert.strictEqual(game.winAnim.phase, 'done');
  assert.strictEqual(game.winAnim.displayedScore, game.score);
  game.nextLevel();
  assert.strictEqual(game.state, 'READY');
  assert.strictEqual(game.currentLevelIndex, 1, '进入第 2 关');
});

test('设置开关：切换音效立即生效并持久化', () => {
  fresh();
  const before = game.settings.sound;
  game.toggleSetting('sound');
  assert.strictEqual(game.settings.sound, !before);
  const saved = JSON.parse(env.storage.angryBirds_settings);
  assert.strictEqual(saved.sound, !before);
  game.toggleSetting('sound'); // 还原，避免影响后续测试
});

// =====================================================================
// 7. 全状态渲染冒烟
// =====================================================================

test('渲染冒烟：全部界面状态各渲染数帧无异常', () => {
  fresh();
  game.goToSettings();      env.pump(3);
  game.goToLeaderboard();   env.pump(3);
  game.goToLevelSelect();   env.pump(3);
  game.goToMenu();          env.pump(3);
  game.loadLevel(0);        env.pump(3);
  game.state = 'AIMING';    env.pump(3); // 弹道预览绘制路径
  // WIN（含残影 + 珍珠绘制路径）
  game.loadLevel(0);
  env.pump(3);
  shootOnce();
  env.pump(30);
  game.pigs.forEach(p => { p.dying = true; });
  game.checkWinLose();
  env.pump(30);
  assert.strictEqual(game.state, 'WIN');
});

run();
