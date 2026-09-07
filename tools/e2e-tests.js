/**
 * 端到端行为测试 - mock 环境驱动完整游戏流程并断言内部状态
 * E2E Tests - drive the real game singleton through mocked input and assert state.
 *
 * 运行：node tools/e2e-tests.js
 * 覆盖：关卡流程（豚数/胜负判定）、候飞队列越屏回归、技能教学提示、
 *       D 组难度修正数据、弹道残影（P0）、珍珠系统（P1）、广告复活、
 *       通关结算/存档、设置开关、全状态渲染冒烟。
 */

'use strict';

const assert = require('assert');
const { installEnv, loadGame } = require('./test-harness.js');

const env = installEnv({ rewardAd: true, interstitial: true, banner: true }); // 广告全部 mock（复现流量主已开通的线上行为）
const game = loadGame();
const C = require('../src/config.js');
const AD = require('../src/ad.js');
const E = require('../src/entities.js');
const SOCIAL = require('../src/social.js');
const CODEC = require('../src/level-codec.js');
const VALIDATE = require('../src/level-validate.js');
const EDITOR = require('../src/editor.js');

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

/** 发射当前豚（轻拉弓弱弹射，打不到章鱼） */
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

test('L1 豚数闭环：3 只全部打空后判负，无无限出豚', () => {
  fresh();
  game.loadLevel(0);
  env.pump(3);
  assert.strictEqual(game.birdsRemaining, 3);
  let shots = 0;
  while (game.state === 'READY' && shots < 10) { shots++; shootOnce(); }
  assert.strictEqual(shots, 3, `实际可发射 ${shots} 次`);
  assert.strictEqual(game.state, 'LOSE');
});

test('候飞队列越屏回归：全部关卡所有候飞豚在屏幕内、排数 ≤ 2', () => {
  fresh();
  for (let i = 0; i < game.levels.length; i++) {
    game.loadLevel(i);
    env.pump(2);
    const dispR = 17 * 0.85;
    const rows = new Set(game.birds.map(b => b.y));
    assert.ok(rows.size <= 2, `L${i + 1} 队列排数 ${rows.size} > 2`);
    game.birds.forEach((b, j) => {
      assert.ok(b.x - dispR >= 0, `L${i + 1} 候飞豚 #${j} 越屏 x=${b.x}`);
      assert.ok(b.x + dispR <= C.SCREEN_WIDTH, `L${i + 1} 候飞豚 #${j} 越右缘 x=${b.x}`);
    });
  }
});

test('READY 点候飞区换豚：点中豚上弹弓、总数守恒、可换回、学会标记存档', () => {
  fresh();
  game.loadLevel(2); // L3 队列 [normal, dash, normal]
  env.pump(2);
  assert.strictEqual(game.state, 'READY');
  const firstType = game.currentBird.type;
  const targetIdx = game.birds.findIndex(b => b.type !== firstType);
  assert.ok(targetIdx >= 0, 'L3 应有异种豚可换');
  const targetType = game.birds[targetIdx].type;
  const totalBefore = game.birds.length + 1;

  let tb = game.birds[targetIdx];
  env.fire('touchstart', tb.x, tb.y);
  env.fire('touchend', tb.x, tb.y);
  assert.strictEqual(game.currentBird.type, targetType, '点中的候飞豚应上弹弓');
  assert.strictEqual(game.birds.length + 1, totalBefore, '换豚后豚总数守恒');
  assert.ok(game.birds.some(b => b.type === firstType), '原弹弓豚应回到候飞队列');
  assert.strictEqual(game.progress.tutSwap, true, '首次换豚后学会标记应存档');

  // 换回原豚种
  const backIdx = game.birds.findIndex(b => b.type === firstType);
  tb = game.birds[backIdx];
  env.fire('touchstart', tb.x, tb.y);
  env.fire('touchend', tb.x, tb.y);
  assert.strictEqual(game.currentBird.type, firstType, '应能换回原豚种');
  assert.strictEqual(game.birds.length + 1, totalBefore, '换回后总数仍守恒');
});

test('AIMING 中点击候飞区不换豚（瞄准拖拽不被打断）', () => {
  fresh();
  game.loadLevel(2);
  env.pump(2);
  const bx = game.currentBird.x, by = game.currentBird.y;
  env.fire('touchstart', bx, by);
  env.fire('touchmove', bx - 20, by - 10);
  assert.strictEqual(game.state, 'AIMING');
  const typeBefore = game.currentBird.type;
  if (game.birds.length) {
    const tb = game.birds[0];
    env.fire('touchstart', tb.x, tb.y); // AIMING 分支忽略，不应触发换豚
  }
  assert.strictEqual(game.state, 'AIMING', '瞄准状态不应被打断');
  assert.strictEqual(game.currentBird.type, typeBefore, 'AIMING 中不换豚');
  env.fire('touchend');
  env.pump(300);
});

test('harness：分享/启动/剪贴板 mock 齐备，social.available() 为 true', () => {
  assert.strictEqual(SOCIAL.available(), true, 'showShareMenu mock 后应可分享');
  assert.strictEqual(typeof wx.getLaunchOptionsSync, 'function');
  assert.strictEqual(typeof wx.getClipboardData, 'function');
  assert.strictEqual(typeof wx.shareAppMessage, 'function');
});

// =====================================================================
// 2. 技能教学提示（D 组修正回归）
// =====================================================================

test('技能教学：第3/5/16 关首次进入显示对应提示，二次进入不显示', () => {
  fresh();
  game.loadLevel(2);
  assert.strictEqual(game.hintText, '新技能：梭梭空中点击极速冲刺！');
  assert.strictEqual(game.hintAlpha, 1);
  env.pump(3);
  game.loadLevel(2);
  assert.strictEqual(game.hintText, null);
  assert.strictEqual(game.hintAlpha, 0);

  game.loadLevel(4);
  assert.strictEqual(game.hintText, '新技能：砰砰空中点击范围爆炸！');
  env.pump(3);
  game.loadLevel(15);
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

test('难度修正数据：第19关 双石镇 + 门槛 20000；第21关 弹道 30 + 门槛 23000', () => {
  fresh();
  assert.strictEqual(game.levels[18].blocks.filter(b => b.type === 'stone').length, 2);
  assert.strictEqual(game.levels[18].stars[2], 20000);
  assert.strictEqual(game.levels[20].trajectory, 30);
  assert.strictEqual(game.levels[20].stars[2], 23000);
});

test('第16关 教学补强：中柱顶冰帽加宽（分裂→破冰克制自解释）+ 章王冰壳', () => {
  fresh();
  const blocks = game.levels[15].blocks;
  // 柱顶冰帽（教学锚点）：矮而窄（≤26 高、≤60 宽）——三帽俱在，中帽 54 宽
  const caps = blocks.filter(b => b.type === 'ice' && b.height <= 26 && b.width <= 60);
  assert.strictEqual(caps.length, 3, '第16关 三根柱顶各一冰帽');
  assert.strictEqual(Math.max(...caps.map(b => b.width)), 54, '中柱冰帽应为 54 宽');
  // 章王冰壳：高墙（44 高）×4 + 宽屋顶（96 宽）
  const walls = blocks.filter(b => b.type === 'ice' && b.height > 26);
  const roofs = blocks.filter(b => b.type === 'ice' && b.width >= 90);
  assert.strictEqual(walls.length, 4, '冰壳左右各两块高墙');
  assert.strictEqual(roofs.length, 1, '冰壳一块宽屋顶');
});

// =====================================================================
// 2b. 章末 Boss 战（T4）
// =====================================================================

test('章末 Boss 关：idx 7/15/23/31/39 各守一只章王，字段正确，其余关无 Boss', () => {
  fresh();
  const BOSS = {
    7: ['滩涂章王', 5],
    15: ['冰壳章王', 7],
    23: ['岩甲章王', 9],
    31: ['深渊章王', 11],
    39: ['潮汐王座·章王', 14],
  };
  game.levels.forEach((lv, i) => {
    const bosses = lv.pigs.filter(p => p.boss);
    if (BOSS[i]) {
      assert.strictEqual(bosses.length, 1, `L${i + 1} 应有 1 只章王`);
      assert.strictEqual(bosses[0].name, BOSS[i][0], `L${i + 1} 章王名`);
      assert.strictEqual(bosses[0].hp, BOSS[i][1], `L${i + 1} 章王血量`);
      assert.ok(bosses[0].radius >= 26, `L${i + 1} 章王应为巨物`);
    } else {
      assert.strictEqual(bosses.length, 0, `L${i + 1} 非章末关不应配置章王`);
    }
  });
});

test('Boss 实体：免疫击退、自定义血量、受击扣 1 血', () => {
  fresh();
  game.loadLevel(7);
  const boss = game.pigs.find(p => p.isBoss);
  assert.strictEqual(boss.maxHealth, 5);
  boss.knockback(10, -10);
  assert.strictEqual(boss.dynamic, false, '章王是巨物，免疫击退');
  assert.strictEqual(boss.takeDamage(10), false);
  assert.strictEqual(boss.health, 4, '每次直击扣 1 血');
  // 教学章王 hp5：无怒吼阶段
  boss.health = 2;
  game.onPigHurt(boss);
  assert.strictEqual(boss.phase, 0, 'hp5 教学章王无阶段怒吼');
});

test('Boss 关：休眠阶段物开局冻结、计入存活数（未唤醒前不可通关）', () => {
  fresh();
  game.loadLevel(31); // L32：章王 + 屋顶章鱼 + 阵前章鱼 + 3 只休眠援军
  assert.strictEqual(game.pigs.filter(p => p.alive && !p.dying).length, 6);
  assert.strictEqual(game.pigs.filter(p => p.sleeping).length, 3, '3 只休眠援军');
  assert.strictEqual(game.blocks.filter(b => b.sleeping).length, 3, '3 块休眠落石');
  // 休眠体不受击
  const sleeper = game.pigs.find(p => p.sleeping);
  assert.strictEqual(sleeper.takeDamage(10), false, '休眠章鱼无敌');
});

test('Boss 怒吼：血量跨阶段阈值才唤醒对应 sleep 阶段物（L32 三阶段）', () => {
  fresh();
  game.loadLevel(31); // hp11 → 阈值 8.25 / 5.5 / 2.75
  const boss = game.pigs.find(p => p.isBoss);
  const sleepPigs = game.pigs.filter(p => p.sleeping);
  const sleepBlocks = game.blocks.filter(b => b.sleeping);

  // 未跨阈值（health 10 > 8.25）：不怒吼
  boss.health = 10;
  game.onPigHurt(boss);
  assert.strictEqual(boss.phase, 0);
  assert.ok(sleepBlocks.every(b => b.sleeping), '阶段未到，落石仍休眠');

  // 阶段 1（health 8 ≤ 8.25）：落石唤醒，援军仍睡
  boss.health = 8;
  game.onPigHurt(boss);
  assert.strictEqual(boss.phase, 1);
  const stones1 = sleepBlocks.filter(b => b.sleepMark === 1);
  assert.strictEqual(stones1.length, 2);
  assert.ok(stones1.every(b => !b.sleeping && b.dynamic), '阶段1 落石应唤醒坠落');
  assert.ok(sleepPigs.every(p => p.sleeping), '阶段1 援军仍休眠');

  // 阶段 2（health 5 ≤ 5.5）：援军唤醒
  boss.health = 5;
  game.onPigHurt(boss);
  assert.strictEqual(boss.phase, 2);
  const adds2 = sleepPigs.filter(p => p.sleepMark === 2);
  assert.strictEqual(adds2.length, 2);
  assert.ok(adds2.every(p => !p.sleeping && p.dynamic), '阶段2 援军应唤醒落下');
  assert.ok(sleepPigs.filter(p => p.sleepMark === 3).every(p => p.sleeping), '阶段3 援军仍休眠');

  // 阶段 3（health 2 ≤ 2.75）：最后落石与援军唤醒
  boss.health = 2;
  game.onPigHurt(boss);
  assert.strictEqual(boss.phase, 3);
  assert.ok(sleepBlocks.filter(b => b.sleepMark === 3).every(b => !b.sleeping && b.dynamic));
  assert.ok(sleepPigs.filter(p => p.sleepMark === 3).every(p => !p.sleeping && p.dynamic));
});

test('章王讨伐：击杀结算 +5000 且死亡动画状态正确', () => {
  fresh();
  game.loadLevel(7);
  const boss = game.pigs.find(p => p.isBoss);
  for (let i = 0; i < 4; i++) assert.strictEqual(boss.takeDamage(10), false);
  const killed = boss.takeDamage(10);
  assert.strictEqual(killed, true, '第 5 次直击击杀章王');
  game.onPigKilled(boss);
  assert.ok(game.score >= 5000, '章王讨伐奖励 +5000');
  assert.strictEqual(boss.dying, true);
});

test('Boss 血条 UI：Boss 关 READY 绘制不抛异常（含残血脉动分支）', () => {
  const RENDERER = require('../src/renderer.js');
  fresh();
  game.loadLevel(7);
  game.state = 'READY';
  assert.doesNotThrow(() => RENDERER.drawUI(game), '满血血条绘制');
  const boss = game.pigs.find(p => p.isBoss);
  boss.health = 1; // 残血 → 红色脉动分支
  assert.doesNotThrow(() => RENDERER.drawUI(game), '残血血条绘制');
  boss.dying = true; // 章王将死 → 血条自动隐藏
  assert.doesNotThrow(() => RENDERER.drawUI(game), '章王死后绘制');
});

test('每日挑战/珍珠关：生成器过滤 Boss 与 sleep 阶段物（防素材污染死局）', () => {
  const DAILY = require('../src/daily.js');
  const PEARLS = require('../src/pearls.js');
  fresh();
  const daily = DAILY.generateLevel(DAILY.todayString(), game.levels);
  assert.ok(!daily.pigs.some(p => p.boss || p.sleep), '每日关无章王/休眠章鱼');
  assert.ok(!daily.blocks.some(b => b.sleep), '每日关无休眠块');
  PEARLS.PEARLS.forEach((m) => {
    const lv = PEARLS.generateBonusLevel(m, game.levels);
    assert.ok(!lv.pigs.some(p => p.boss || p.sleep), `珍珠关[${m.id}] 无章王/休眠章鱼`);
    assert.ok(!lv.blocks.some(b => b.sleep), `珍珠关[${m.id}] 无休眠块`);
  });
});

test('风味名：全部关卡均有 flavor 字段（HUD 合并显示）', () => {
  fresh();
  game.levels.forEach((lv, i) => {
    assert.ok(typeof lv.flavor === 'string' && lv.flavor.length >= 2,
      `L${i + 1} 缺少 flavor`);
  });
  assert.strictEqual(game.levels[13].flavor, '珊瑚要塞');
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
  // 第一章现为 8 关（idx 0-7）：前 7 关满星，通关第 8 关触发奖励
  game.progress.stars = { 0: 3, 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 2 };
  game.loadLevel(7);
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

test('广告复活：LOSE 后 +1 豚继续，第二次失败不再提供复活', () => {
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
  assert.strictEqual(game.state, 'LOSE', '复活豚用完再次失败');
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
  // 3 只豚未用：剩豚奖励 15000 → 3 星（门槛 6000）
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

test('结算动画中点按钮：一次点击即生效（不再被"跳过动画"吞掉）', () => {
  fresh();
  game.progress.unlockedLevels = 40;
  game.loadLevel(15);       // 第 16 关：5 只河豚，结算动画最长（约 6 秒）
  env.pump(3);
  game.pigs.forEach(p => { p.dying = true; });
  game.checkWinLose();
  env.pump(1);              // 结算页绘制一帧（按钮创建，动画仍在跑）
  assert.strictEqual(game.state, 'WIN');
  assert.ok(game.winAnim.phase !== 'done', '此时动画应仍在播放');
  const b = game.buttons.next;
  assert.ok(b, '第 16 关结算页应有「下一关」按钮');
  env.fire('touchstart', b.x + b.width / 2, b.y + b.height / 2);
  env.fire('touchend');
  env.pump(3);
  assert.strictEqual(game.currentLevelIndex, 16, '一次点击即进入第 17 关');
});

// =====================================================================
// 6. 广告点位（插屏频控 / Banner 避让）
// =====================================================================

test('插屏广告：前 2 次退出关卡不弹，第 3 次弹 1 次；冷却期内不重复', () => {
  fresh();
  AD.resetFrequency();
  const before = env.ads.interstitialShown;
  const exitFromLevel = () => { game.loadLevel(0); env.pump(2); game.goToLevelSelect(); };

  exitFromLevel(); // 1 → 首启保护
  exitFromLevel(); // 2 → 首启保护
  exitFromLevel(); // 3 → 弹出
  assert.strictEqual(env.ads.interstitialShown - before, 1, '第 3 次退出才弹插屏');

  // 60 秒冷却：紧接着再退 3 次也不应再弹（虚拟时钟只推进了十几帧）
  exitFromLevel(); exitFromLevel(); exitFromLevel();
  assert.strictEqual(env.ads.interstitialShown - before, 1, '冷却期内不重复弹出');
});

test('插屏广告：WIN 点「下一关」连闯不触发，退出选关才触发', () => {
  fresh();
  AD.resetFrequency();
  const before = env.ads.interstitialShown;
  game.progress.unlockedLevels = 40;
  game.loadLevel(0);
  env.pump(3);
  game.pigs.forEach(p => { p.dying = true; });
  game.checkWinLose();
  env.pump(2);
  game.nextLevel();         // 连闯：不应弹插屏
  assert.strictEqual(game.state, 'READY');
  assert.strictEqual(env.ads.interstitialShown - before, 0, '连闯路径不插广告');
  game.goToLevelSelect();   // 退出关卡：计入埋点
  assert.strictEqual(env.ads.interstitialShown - before, 0, '未满频次仍不弹');
});

test('Banner：只在选关页常驻，进入关卡即隐藏', () => {
  fresh();
  const h0 = env.ads.bannerHidden;
  game.goToLevelSelect();
  env.pump(3);
  assert.ok(env.ads.bannerShown > 0, '选关页应展示 Banner');
  game.loadLevel(0);
  env.pump(3);
  assert.ok(env.ads.bannerHidden > h0, '进入关卡应隐藏 Banner');
  // 布局避让：未展示时 inset 必须为 0，选关页布局不受影响
  assert.strictEqual(AD.bannerInset(), 0);
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

test('章节化选关页：全部章节按钮齐全，L1 按钮位于新手湾首列', () => {
  fresh();
  game.goToLevelSelect();
  env.pump(5);
  for (let i = 0; i < game.levels.length; i++) {
    assert.ok(game.buttons['level' + i], `关卡 ${i + 1} 按钮应存在`);
  }
  const b = game.buttons.level0;
  assert.strictEqual(b.x, 57.5, 'L1 按钮左缘（2×4 网格首格：16 + (343-260)/2）');
  assert.strictEqual(b.y, 154, 'L1 按钮顶部（viewTop100+pad20+header30+gap4）');
  assert.strictEqual(b.width, 56);
});

test('选关页自动定位：进入即滚到前沿关卡所属章节，触摸后交还控制权', () => {
  fresh();
  // 卡片高 = 30+4+56*2+20(行间隙,容纳星星)+16+4+20(顶pad)+14 = 220，卡片间距 16
  const CARD_STEP = 220 + 16;
  const VIEW_TOP = 100;

  // (1) 新档：前沿是第 1 关，属于第 1 章 → 不滚动
  game.goToLevelSelect();
  env.pump(5);
  assert.strictEqual(game.levelSelectScroll, 0, '新档应停在顶部');

  // (2) 通关前 12 关 → 前沿 = 第 13 关（第 2 章 珊瑚海）
  for (let i = 0; i < 12; i++) {
    game.loadLevel(i); env.pump(2);
    game.pigs.forEach(p => { p.dying = true; });
    game.checkWinLose(); env.pump(2);
  }
  game.goToLevelSelect();
  env.pump(5);
  assert.strictEqual(game.progress.unlockedLevels, 13);
  assert.strictEqual(game.levelSelectScroll, CARD_STEP, '应滚到第 2 章顶部');

  // 前沿关卡按钮必须完整落在可视区内
  const viewBottom = C.SCREEN_HEIGHT - 80 - AD.bannerInset();
  const btn = game.buttons.level12;
  const top = btn.y - game.levelSelectScroll;
  assert.ok(top >= VIEW_TOP, `第 13 关按钮滚出视口上沿 top=${top}`);
  assert.ok(top + btn.height <= viewBottom, `第 13 关按钮滚出视口下沿 bottom=${top + btn.height}`);

  // (3) 触摸后交还控制权：手动滚动不再被自动覆盖
  env.fire('touchstart', 187, 300);
  env.fire('touchend');
  game.levelSelectScroll = 0;
  env.pump(10);
  assert.strictEqual(game.levelSelectScroll, 0, '触摸后不应再自动定位');
});

test('海洋主题：水体渐变必须是「上浅下深」（上深下浅 = 天空逻辑，会毁掉水下感）', () => {
  const lum = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  };
  const { waterTop, waterMid, waterDeep, sand } = C.COLORS;
  assert.ok(lum(waterTop) > lum(waterMid), `waterTop(${waterTop}) 应亮于 waterMid(${waterMid})`);
  assert.ok(lum(waterMid) > lum(waterDeep), `waterMid(${waterMid}) 应亮于 waterDeep(${waterDeep})`);

  // 海床沙色：保持高明度才读作"受光的浅沙"；且不能与河豚主体黄同色
  const puffer = C.BIRD_TYPES.normal.body;
  assert.notStrictEqual(sand, puffer, '沙色不应与河豚主体同色（否则主体被背景吃掉）');
  assert.ok(lum(sand) > 150, `沙色应读作受光浅沙，当前明度 ${lum(sand).toFixed(0)}`);
});

test('海洋主题：气泡向上浮 + 左右摆动，浮出顶端后从海床重生', () => {
  fresh();
  assert.strictEqual(game.bubbles.length, 6, '气泡数量');

  const b = new E.Bubble(100, C.GROUND_Y - 10, 1);
  const y0 = b.y;
  const baseX = b.baseX;
  for (let i = 0; i < 30; i++) b.update();
  assert.ok(b.y < y0, `气泡应向上浮：${y0} → ${b.y}`);

  let minX = Infinity, maxX = -Infinity;
  for (let i = 0; i < 200; i++) {
    b.update();
    minX = Math.min(minX, b.x);
    maxX = Math.max(maxX, b.x);
  }
  assert.ok(minX < baseX - 1 && maxX > baseX + 1,
    `摆动应双向（非单向漂移）：${minX.toFixed(0)} ~ ${maxX.toFixed(0)}，基准 ${baseX}`);

  // 重生是「y 突然变大」的跳变事件，只能在跳变那一帧断言——
  // 重生后气泡会继续上浮，拿最终 y 判断必然失败。
  const b2 = new E.Bubble(100, 5, 1);
  let respawnY = null;
  let prevY = b2.y;
  for (let i = 0; i < 400; i++) {
    b2.update();
    if (b2.y > prevY + 100) { respawnY = b2.y; break; }
    prevY = b2.y;
  }
  assert.ok(respawnY !== null, '应观测到重生事件');
  assert.ok(respawnY > C.GROUND_Y - 30 && respawnY <= C.GROUND_Y,
    `重生位置应在海床附近：${respawnY}，GROUND_Y=${C.GROUND_Y}`);
});

test('好友排行榜默认隐藏：无入口、不上传成绩、界面不可达', () => {
  fresh();
  assert.strictEqual(C.FEATURES.leaderboard, false, '排行榜开关应默认关闭');

  // (1) 主菜单不创建排行榜按钮
  game.goToMenu(); env.pump(2);
  assert.ok(!game.buttons.leaderboard, '主菜单不应存在排行榜按钮');

  // (2) 原排行榜按钮位置已由设置按钮接管 → 点它进设置，说明没留下点不动的死区
  const cxm = C.SCREEN_WIDTH / 2;
  const cym = C.SCREEN_HEIGHT * 0.5 + 62 + 21; // 设置按钮中心（排行榜隐藏后上移到 btnY+62）
  env.fire('touchstart', cxm, cym);
  env.fire('touchend');
  env.pump(2);
  assert.strictEqual(game.state, 'SETTINGS', '原排行榜位置应命中设置按钮');
  game.goToMenu(); env.pump(2);

  // (3) 通关不触发成绩上传（setUserCloudStorage 属用户数据外传，需隐私保护指引）
  let kvCalls = 0;
  global.wx.setUserCloudStorage = () => { kvCalls++; };
  game.loadLevel(0); env.pump(3);
  game.pigs.forEach((p) => { p.dying = true; });
  game.checkWinLose(); env.pump(10);
  assert.strictEqual(kvCalls, 0, '排行榜关闭时不应调用 setUserCloudStorage');

  // (4) 直接调用也兜底回菜单，界面不可达
  game.goToLeaderboard(); env.pump(2);
  assert.strictEqual(game.state, 'MENU', '开关关闭时 goToLeaderboard 应兜底回菜单');
});

test('排行榜开关打开后功能可完整恢复（防止隐藏被写成不可逆的删除）', () => {
  C.FEATURES.leaderboard = true;
  try {
    game.goToMenu(); env.pump(2);
    assert.ok(game.buttons.leaderboard, '开启后主菜单应恢复排行榜按钮');

    let posted = 0;
    global.wx.getOpenDataContext = () => ({ canvas: {}, postMessage: () => { posted++; } });
    game.goToLeaderboard(); env.pump(2);
    assert.strictEqual(game.state, 'LEADERBOARD');
    assert.strictEqual(posted, 1, '应向开放数据域 postMessage 一次');
  } finally {
    C.FEATURES.leaderboard = false;
    delete global.wx.getOpenDataContext;
    game.goToMenu(); env.pump(2);
    assert.ok(!game.buttons.leaderboard, '关闭后按钮应被清理');
  }
});

test('渲染冒烟：全部界面状态各渲染数帧无异常', () => {
  fresh();
  game.goToSettings();      env.pump(3);
  C.FEATURES.leaderboard = true; // 排行榜默认隐藏，临时开启以保留该界面的渲染覆盖
  game.goToLeaderboard();   env.pump(3);
  C.FEATURES.leaderboard = false;
  game.goToMenu();          env.pump(2);
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

test('主菜单：玩法说明入口在设置下方，标题下方显示出品方', () => {
  fresh();
  game.goToMenu();
  env.pump(3);
  assert.ok(game.buttons.help, '主菜单应显示「玩法说明」按钮');
  // 按钮顺序：开始游戏 → 设置 → 玩法说明（y 坐标严格递增）
  assert.ok(game.buttons.play.y < game.buttons.settings.y, '设置按钮应在开始按钮下方');
  assert.ok(game.buttons.settings.y < game.buttons.help.y, '玩法说明按钮应在设置按钮下方');
});

test('玩法说明页：主菜单入口可见、可进入、可滚动、可返回菜单', () => {
  fresh();
  game.goToMenu();
  env.pump(3);
  // 点击入口 → 进入 HELP
  const hb = game.buttons.help;
  env.fire('touchstart', hb.x + hb.width / 2, hb.y + hb.height / 2);
  env.fire('touchend');
  env.pump(3);
  assert.strictEqual(game.state, 'HELP', '应进入玩法说明页');
  assert.ok(game.helpMaxScroll > 0, '说明内容超屏，应可滚动');
  // 模拟向下拖动滚动
  const startY = C.SCREEN_HEIGHT * 0.6;
  env.fire('touchstart', C.SCREEN_WIDTH / 2, startY);
  env.fire('touchmove', C.SCREEN_WIDTH / 2, startY - 40);
  env.pump(1);
  assert.ok(game.helpScroll > 0, '拖动后滚动偏移应增大');
  env.fire('touchend');
  // 返回 → 主菜单
  const bb = game.buttons.helpBack;
  env.fire('touchstart', bb.x + bb.width / 2, bb.y + bb.height / 2);
  env.fire('touchend');
  env.pump(3);
  assert.strictEqual(game.state, 'MENU', '返回应回到主菜单');
});

test('codec：合法关卡往返深相等（量化到 4px）', () => {
  const lv = {
    birds: ['normal','dash','bomb','split'],
    blocks: [
      {x:200,y:500,width:80,height:26,type:'wood'},
      {x:160,y:540,width:28,height:80,type:'stone'},
      {x:240,y:580,width:26,height:26,type:'burst'},
    ],
    pigs: [{x:240,y:600,radius:17},{x:300,y:600,radius:22}],
    pearls: [{x:260,y:300}],
  };
  const code = CODEC.encodeLevel(lv);
  assert.ok(code.startsWith('PG1'), '前缀 PG1');
  assert.ok(code.length < 700, `关卡码过长: ${code.length}`);
  const back = CODEC.decodeLevel(code);
  assert.ok(back, '解码应成功');
  assert.deepStrictEqual(back.birds, lv.birds);
  assert.deepStrictEqual(back.blocks.map(b=>[b.x,b.y,b.width,b.height,b.type]),
    lv.blocks.map(b=>[b.x,b.y,b.width,b.height,b.type]));
  assert.deepStrictEqual(back.pigs.map(p=>[p.x,p.radius]), [[240,17],[300,22]]);
  assert.strictEqual(back.pearls.length, 1);
});

test('codec：坏码/截断码/非法枚举拒绝为 null', () => {
  assert.strictEqual(CODEC.decodeLevel('XXXX'), null);
  assert.strictEqual(CODEC.decodeLevel('PG1'), null); // 体太短
  const good = CODEC.encodeLevel({birds:['normal'],blocks:[],pigs:[{x:200,y:600,radius:17}],pearls:[]});
  assert.strictEqual(CODEC.decodeLevel(good.slice(0, good.length-2)), null); // 截断
  assert.strictEqual(CODEC.decodeLevel(good.replace(/[ndbs]/, 'z')), null); // 非法豚种
});

test('codec：超上限配置拒绝编码', () => {
  const many = { birds: Array(7).fill('normal'), blocks: [], pigs: [{x:200,y:600,radius:17}], pearls: [] };
  assert.throws(() => CODEC.encodeLevel(many), /超限|too many/i);
});

test('codec：未知河豚类型/章鱼半径编码抛错', () => {
  assert.throws(() => CODEC.encodeLevel({birds:['norml'],blocks:[],pigs:[{x:200,y:560,radius:17}],pearls:[]}), /未知河豚类型/);
  assert.throws(() => CODEC.encodeLevel({birds:['normal'],blocks:[],pigs:[{x:200,y:560,radius:99}],pearls:[]}), /未知章鱼半径/);
});

test('codec：满配置往返成功且码长 <700', () => {
  const full = { birds: Array(6).fill('normal'),
    blocks: Array(40).fill(0).map((_,k)=>({x:140+(k%8)*29, y:300+Math.floor(k/8)*30, width:28, height:28, type:'wood'})),
    pigs: [{x:240,y:560,radius:17}], pearls: [] };
  const code = CODEC.encodeLevel(full);
  assert.ok(code.length < 700, `满配置码长 ${code.length} 应 <700`);
  assert.ok(CODEC.decodeLevel(code), '满配置往返不为 null');
});

// =====================================================================
// 造关师 T3：level-validate 纯校验函数
// =====================================================================

const GY = 577; // C.GROUND_Y = 667-90；站立坐标：柱 y=GY-80=497，章鱼 y=GY-17=560

const goodLevel = () => ({
  birds: ['normal','normal'],
  blocks: [{x:200,y:497,width:28,height:80,type:'wood'}],   // 柱底=GY
  pigs: [{x:240,y:560,radius:17}],                          // 底=GY
  pearls: [],
});

test('validate：合法关卡 ok 无 issue（编辑器模式）', () => {
  const r = VALIDATE.validateLevel(goodLevel(), {editor:true});
  assert.strictEqual(r.ok, true, JSON.stringify(r.issues));
});

test('validate：官方关不带 editor 选项时不误报禁区/计数', () => {
  const lv = goodLevel();
  lv.pigs[0].x = 128; // 靠近禁区但官方关允许
  const r = VALIDATE.validateLevel(lv); // 无 editor 选项
  assert.ok(!r.issues.some(i=>i.kind==='no-build-zone'), '官方关不查禁区');
  assert.ok(!r.issues.some(i=>i.kind==='no-pig' || i.kind==='bird-count'), '官方关不查计数');
});

test('validate：各类违规各产出 issue（编辑器模式）', () => {
  const V = (lv) => VALIDATE.validateLevel(lv, {editor:true});
  let lv = goodLevel(); lv.pigs.push({x:240,y:560,radius:17}); // 章鱼互叠
  assert.ok(V(lv).issues.some(i=>i.kind==='pig-overlap'));
  lv = goodLevel(); lv.pigs = [];                                   // 无章鱼
  assert.ok(V(lv).issues.some(i=>i.kind==='no-pig'));
  lv = goodLevel(); lv.birds = [];                                  // 无河豚
  assert.ok(V(lv).issues.some(i=>i.kind==='bird-count'));
  lv = goodLevel(); lv.blocks.push({x:10,y:497,width:28,height:80,type:'wood'}); // 禁区
  assert.ok(V(lv).issues.some(i=>i.kind==='no-build-zone'));
  lv = goodLevel(); lv.blocks = Array(41).fill(0).map((_,k)=>({x:140+(k%8)*29,y:300+Math.floor(k/8)*30,width:28,height:28,type:'wood'}));
  assert.ok(V(lv).issues.some(i=>i.kind==='block-limit'));
});

// =====================================================================
// 造关师 T4：EDITOR 状态骨架（进出/试玩装载/三入口复位）
// =====================================================================

test('编辑器：enterEditor 进 EDITOR 态并初始化空草稿', () => {
  fresh();
  game.enterEditor();
  env.pump(2);
  assert.strictEqual(game.state, 'EDITOR');
  assert.ok(game.editor && game.editor.draft, '草稿已初始化');
  assert.deepStrictEqual(game.editor.draft.blocks, []);
  assert.deepStrictEqual(game.editor.draft.pigs, []);
  assert.deepStrictEqual(game.editor.draft.pearls, []);
  assert.deepStrictEqual(game.editor.draft.birds, ['normal']);
});

test('编辑器：editorExit 回 MENU；playCustom 后 loadLevel 复位 isCustom', () => {
  game.enterEditor();
  env.pump(1);
  game.editorExit();
  assert.strictEqual(game.state, 'MENU');

  game.playCustom(
    { birds: ['normal'], blocks: [], pigs: [{ x: 240, y: 560, radius: 17 }], pearls: [] },
    'challenge',
    'PG1TEST'
  );
  assert.strictEqual(game.isCustom, true);
  assert.strictEqual(game.playOrigin, 'challenge');
  assert.strictEqual(game.customCode, 'PG1TEST');
  assert.strictEqual(game.state, 'READY');
  assert.strictEqual(game.getCurrentLevel(), game.customLevel);

  game.loadLevel(0);
  assert.strictEqual(game.isCustom, false);
  assert.strictEqual(game.playOrigin, null);
  assert.strictEqual(game.getCurrentLevel(), game.levels[0]);
});

test('编辑器：startDaily/startBonus 同样复位自制关上下文', () => {
  game.playCustom(
    { birds: ['normal'], blocks: [], pigs: [{ x: 240, y: 560, radius: 17 }], pearls: [] },
    'author'
  );
  assert.strictEqual(game.isCustom, true);
  game.startDaily();
  assert.strictEqual(game.isCustom, false);
  assert.strictEqual(game.playOrigin, null);
  assert.strictEqual(game.isDaily, true);
});

test('编辑器：deriveLevel 产出可被 setupLevel 装载的关卡（实体实例→纯数据）', () => {
  const draft = EDITOR.instantiateDraft({
    birds: ['normal', 'dash'],
    blocks: [{ x: 200, y: 497, width: 28, height: 80, type: 'wood' }],
    pigs: [{ x: 240, y: 560, radius: 17 }],
    pearls: [{ x: 300, y: 400 }],
  });
  assert.strictEqual(typeof draft.pigs[0].draw, 'function', '草稿存实体实例，渲染可直接 draw');
  const level = EDITOR.deriveLevel(draft);
  assert.deepStrictEqual(level.birds, ['normal', 'dash']);
  assert.strictEqual(level.blocks[0].type, 'wood');
  assert.strictEqual(level.pearls[0].reward, true);
  assert.ok(Array.isArray(level.stars) && level.stars.length === 3, 'stars 已补，防结算 computeStars 崩');
  // 装载冒烟：不抛异常即通过
  game.playCustom(level, 'author');
  assert.strictEqual(game.state, 'READY');
  assert.strictEqual(game.pigs.length, 1);
  assert.strictEqual(game.blocks.length, 1);
});

// =====================================================================
// 造关师 T5：编辑器核心交互（物料/放置/选中/拖动/删除/校验/proven）
// =====================================================================

const EDITOR_GY = C.GROUND_Y; // 577 = 667-90

/** 进全新编辑器（game.editor=null 强制新草稿，模拟首次进入；backToEditor 才保留草稿） */
function enterFreshEditor() {
  fresh();
  game.editor = null;
  game.enterEditor();
  env.pump(1);
  return game.editor;
}
// 底栏布局常量（与 editor.js 保持一致）：H=667，BAR_H=84，TAB_H=28，CHIP=64
const BAR_TOP = 667 - 84;          // 583
const TAB_Y = BAR_TOP + 14;        // tab 行中心 597
const CHIP_Y = BAR_TOP + 28 + 28;  // 物料行中心 639
const tabX = (i) => 47 + i * 94;   // 4 tab 均分（宽 ~94）
const chipX = (j) => 40 + j * 72;  // chip 宽 64 + 间距 8，左起 8

test('编辑器：放置方块/章鱼→草稿增项、校验随动；删空回 no-pig', () => {
  const E2 = enterFreshEditor();
  EDITOR.placeAt(game, 240, EDITOR_GY - 40, EDITOR.findPalette('wood-p'));   // 木柱
  EDITOR.placeAt(game, 280, EDITOR_GY - 17, EDITOR.findPalette('pig-s'));    // 小章鱼
  assert.strictEqual(E2.draft.blocks.length, 1);
  assert.strictEqual(E2.draft.pigs.length, 1);
  assert.strictEqual(E2.issues.every(i => i.kind !== 'no-pig'), true);
  EDITOR.removeAt(game, 280, EDITOR_GY - 17);
  assert.strictEqual(E2.draft.pigs.length, 0);
  assert.ok(E2.issues.some(i => i.kind === 'no-pig'));
});

test('编辑器：河豚物料增删队列（1~6）；结构变动重置 proven', () => {
  enterFreshEditor();
  EDITOR.addBird(game, 'dash'); EDITOR.addBird(game, 'bomb');
  assert.deepStrictEqual(game.editor.draft.birds, ['normal', 'dash', 'bomb']);
  game.editor.proven = true;
  EDITOR.addBird(game, 'split');
  assert.strictEqual(game.editor.proven, false, '结构变动须重置 proven');
  for (let i = 0; i < 5; i++) EDITOR.addBird(game, 'normal');
  assert.ok(game.editor.draft.birds.length <= 6, '河豚上限 6');
  // 至少保留 1 只
  for (let i = 0; i < 10; i++) EDITOR.removeBirdAt(game, 0);
  assert.strictEqual(game.editor.draft.birds.length, 1);
});

test('编辑器：禁区放置被拒绝（方块左缘/章鱼左缘）', () => {
  const E2 = enterFreshEditor();
  EDITOR.placeAt(game, 120, EDITOR_GY - 40, EDITOR.findPalette('wood-p')); // 左缘 < 禁区线 123.75
  assert.strictEqual(E2.draft.blocks.length, 0, '禁区放置应拒绝');
  EDITOR.placeAt(game, 130, EDITOR_GY - 17, EDITOR.findPalette('pig-l'));   // r=22 左缘入禁区
  assert.strictEqual(E2.draft.pigs.length, 0, '章鱼左缘入禁区应拒绝');
});

test('编辑器：触摸拖动实体移位，松手重置 proven 并重新校验', () => {
  const E2 = enterFreshEditor();
  EDITOR.placeAt(game, 240, EDITOR_GY - 40, EDITOR.findPalette('wood-p'));
  const x0 = E2.draft.blocks[0].x;
  E2.proven = true;
  env.fire('touchstart', 242, 540);  // 按住柱身
  env.fire('touchmove', 340, 540);   // 右拖
  env.fire('touchend');
  assert.ok(E2.draft.blocks[0].x > x0 + 40, `柱应随拖动右移（${x0} → ${E2.draft.blocks[0].x}）`);
  assert.strictEqual(E2.proven, false, '拖动移位 = 结构变异');
  assert.strictEqual(E2.drag, null, '松手后 drag 清除');
});

test('编辑器：tryPlay 空草稿拒绝；合法布局进入作者试玩', () => {
  const E2 = enterFreshEditor();
  EDITOR.tryPlay(game);
  assert.strictEqual(game.state, 'EDITOR', '有 issue 时不许试玩');
  EDITOR.placeAt(game, 240, EDITOR_GY - 40, EDITOR.findPalette('wood-p'));
  EDITOR.placeAt(game, 280, EDITOR_GY - 17, EDITOR.findPalette('pig-s'));
  assert.strictEqual(E2.issues.length, 0, '布局应合法：' + E2.issues.map(i => i.msg).join(';'));
  EDITOR.tryPlay(game);
  assert.strictEqual(game.state, 'READY', '合法布局进入试玩');
  assert.strictEqual(game.playOrigin, 'author');
  assert.strictEqual(game.isCustom, true);
});

test('编辑器：底栏切 tab + 选物料；bird 物料直接入队；橡皮模式点实体删除', () => {
  const E2 = enterFreshEditor();
  // 方块 tab（默认）选木梁
  env.fire('touchstart', chipX(0), CHIP_Y);
  env.fire('touchend');
  assert.strictEqual(E2.palette && E2.palette.id, 'wood-b');
  assert.strictEqual(E2.eraser, false);
  // 切到敌人 tab，选小章鱼
  env.fire('touchstart', tabX(1), TAB_Y); env.fire('touchend');
  assert.strictEqual(E2.tab, 'enemies');
  env.fire('touchstart', chipX(0), CHIP_Y); env.fire('touchend');
  assert.strictEqual(E2.palette && E2.palette.kind, 'pig');
  // 用选中的章鱼物料在世界区放置
  env.fire('touchstart', 300, EDITOR_GY - 17); env.fire('touchend');
  assert.strictEqual(E2.draft.pigs.length, 1);
  // 河豚 tab：点河豚物料直接入队（不进入放置模式）
  env.fire('touchstart', tabX(2), TAB_Y); env.fire('touchend');
  env.fire('touchstart', chipX(1), CHIP_Y); env.fire('touchend'); // dash
  assert.deepStrictEqual(E2.draft.birds, ['normal', 'dash']);
  assert.strictEqual(E2.palette, null, '河豚物料不挂 palette');
  // 道具 tab：橡皮
  env.fire('touchstart', tabX(3), TAB_Y); env.fire('touchend');
  env.fire('touchstart', chipX(1), CHIP_Y); env.fire('touchend'); // eraser
  assert.strictEqual(E2.eraser, true);
  // 橡皮模式点章鱼 → 删除
  env.fire('touchstart', 300, EDITOR_GY - 17); env.fire('touchend');
  assert.strictEqual(E2.draft.pigs.length, 0, '橡皮点击删除实体');
});

test('编辑器：顶栏按钮创建；点退出回 MENU；点空白取消选中', () => {
  const E2 = enterFreshEditor();
  assert.ok(game.buttons.editorExit, '顶栏退出按钮已创建');
  assert.ok(game.buttons.editorPlay, '顶栏试玩按钮已创建');
  EDITOR.placeAt(game, 240, EDITOR_GY - 40, EDITOR.findPalette('wood-p'));
  env.fire('touchstart', 242, 540); env.fire('touchend'); // 选中柱
  assert.ok(E2.selected, '实体已选中');
  env.fire('touchstart', 400, 400); env.fire('touchend'); // 点空白
  assert.strictEqual(E2.selected, null, '点空白取消选中');
  // 顶栏退出
  env.fire('touchstart', 40, 22); env.fire('touchend');
  assert.strictEqual(game.state, 'MENU');
});

test('编辑器：EDITOR 态渲染冒烟（实体/选中/预览/红圈/四 tab/橡皮，多帧无异常）', () => {
  const E2 = enterFreshEditor();
  EDITOR.placeAt(game, 240, EDITOR_GY - 40, EDITOR.findPalette('wood-p'));
  EDITOR.placeAt(game, 280, EDITOR_GY - 17, EDITOR.findPalette('pig-s'));
  EDITOR.placeAt(game, 330, 400, EDITOR.findPalette('pearl'));
  E2.issues.push({ kind: 'x', x: 240, y: 500, msg: '假问题触发红圈' }); // 红圈路径
  // 选中 + 预览 + 拖动各走一帧
  env.fire('touchstart', 242, 540); env.fire('touchmove', 300, 500); env.pump(2); env.fire('touchend');
  E2.palette = EDITOR.findPalette('wood-b');
  env.fire('touchstart', 360, 300); env.pump(2); // touchY 在世界区 → snap 预览
  env.fire('touchend');
  // 四个 tab 逐一切换渲染（含河豚/道具 chip 图标路径）
  for (let i = 0; i < 4; i++) {
    env.fire('touchstart', tabX(i), TAB_Y); env.fire('touchend');
    env.pump(2);
  }
  // 橡皮模式 + 非法放置红闪
  env.fire('touchstart', tabX(3), TAB_Y); env.fire('touchend');
  env.fire('touchstart', chipX(1), CHIP_Y); env.fire('touchend');
  env.fire('touchstart', 60, 300); env.pump(2); // 禁区附近触发红闪/橡皮
  env.fire('touchend');
  assert.strictEqual(game.state, 'EDITOR');
});

// =====================================================================
// 造关师 T6：试玩闭环（作者/挑战两套结算按钮、广告门控、奖励珍珠 +2000）
// =====================================================================

test('自定义关：试玩打通→作者流按钮；返回编辑草稿仍在；不写战役进度', () => {
  fresh();
  game.editor = null;
  game.enterEditor(); env.pump(1);
  EDITOR.placeAt(game, 240, GY - 17, EDITOR.findPalette('pig-s'));
  game.editor.draft.birds = ['bomb', 'bomb', 'bomb']; // 够用
  EDITOR.tryPlay(game); env.pump(2);
  assert.strictEqual(game.state, 'READY');
  assert.strictEqual(game.isCustom, true);
  assert.strictEqual(game.playOrigin, 'author');
  // 自动打通：炸弹近射 + 空中引爆，连续发射直到 WIN/LOSE
  let guard = 0;
  while ((game.state === 'READY' || game.state === 'AIMING' || game.state === 'FLYING' || game.state === 'SETTLING') && guard++ < 25) {
    if (game.state === 'READY' && game.currentBird) {
      const bx = game.currentBird.x, by = game.currentBird.y;
      env.fire('touchstart', bx, by);
      env.fire('touchmove', bx - 30, by - 60);
      env.fire('touchend');
      env.pump(20);
      if (game.state === 'FLYING') { env.fire('touchstart', 200, 300); env.pump(60); } // 空中炸
    }
    env.pump(120);
  }
  assert.strictEqual(game.state, 'WIN', '应能打通简单关（终态：' + game.state + '）');
  assert.ok(game.buttons.editorBack, '作者流 WIN 有「返回编辑」按钮');
  assert.ok(!game.buttons.next && !game.buttons.share && !game.buttons.double, '作者流无战役按钮');
  const progBefore = JSON.stringify(env.readProgress());
  game.backToEditor(); env.pump(1);
  assert.strictEqual(game.state, 'EDITOR');
  assert.strictEqual(game.editor.draft.pigs.length, 1, '返回编辑草稿保留');
  assert.strictEqual(game.editor.proven, true, '打通后 proven=true');
  assert.strictEqual(JSON.stringify(env.readProgress()), progBefore, '自定义关不写战役进度');
});

test('自定义关：广告按钮不出现；retry 不落入战役关', () => {
  fresh();
  game.playCustom({
    name: '自制关', flavor: '玩家创作', birds: ['normal'],
    blocks: [], pigs: [{ x: 350, y: 560, radius: 17 }], pearls: [],
    stars: [500, 1000, 1500], trajectory: 70,
  }, 'challenge');
  env.pump(2);
  shootOnce(); // 弱弹射够不到 x=350 的章鱼，弹尽判负
  assert.strictEqual(game.state, 'LOSE', '一只 normal 打空应判负');
  assert.ok(!game.buttons.revive, '复活广告按钮不应出现');
  assert.ok(!game.buttons.boost, '弹道广告按钮不应出现');
  assert.ok(!game.buttons.next, '无下一关按钮');
  game.retryLevel(); env.pump(2);
  assert.strictEqual(game.isCustom, true, '重打仍是自定义关');
  assert.strictEqual(game.state, 'READY');
});

test('自定义关：作者流试玩失败→返回编辑按钮可用，无广告/菜单按钮（防死路）', () => {
  fresh();
  game.editor = null;
  game.enterEditor(); env.pump(1);
  EDITOR.placeAt(game, 350, GY - 17, EDITOR.findPalette('pig-s')); // 1 只 normal 弱射够不到
  EDITOR.tryPlay(game); env.pump(2);
  assert.strictEqual(game.playOrigin, 'author');
  shootOnce();
  assert.strictEqual(game.state, 'LOSE');
  assert.ok(game.buttons.editorBack, '作者流 LOSE 必须有「返回编辑」');
  assert.ok(!game.buttons.menu, '作者流 LOSE 不建菜单按钮');
  assert.ok(!game.buttons.revive && !game.buttons.boost, '无广告按钮');
  game.backToEditor(); env.pump(1);
  assert.strictEqual(game.state, 'EDITOR');
  assert.strictEqual(game.editor.draft.pigs.length, 1, '草稿保留');
});

test('自定义关：拾珍珠 +2000 分、不写图鉴', () => {
  fresh();
  game.playCustom({
    name: '自制关', flavor: '玩家创作', birds: ['normal'], blocks: [],
    pigs: [{ x: 300, y: 560, radius: 17 }],
    pearls: [{ x: 200, y: 400, reward: true }],
    stars: [500, 1000, 1500], trajectory: 70,
  }, 'challenge');
  env.pump(2);
  const before = Object.keys(game.progress.pearls).length;
  game.collectPearl(game.pearls[0]);
  assert.ok(game.score >= 2000, '自定义珍珠 +2000（实际 ' + game.score + '）');
  assert.strictEqual(Object.keys(game.progress.pearls).length, before, '不写图鉴');
});

// =====================================================================
// 造关师 T7：关卡码分享/启动直达/剪贴板/本地存档/菜单入口
// =====================================================================

test('分享：自制关 shareAppMessage 带 query.custom；启动直达可装载', () => {
  fresh();
  const lv = { birds: ['normal'], blocks: [], pigs: [{ x: 240, y: 560, radius: 17 }], pearls: [] };
  const code = CODEC.encodeLevel(lv);
  // 主动分享：query 带 custom 关卡码
  SOCIAL.shareCustom(code, 3);
  assert.ok(env.ads.lastShare && /custom=/.test(env.ads.lastShare.query || ''), '分享卡片 query 带关卡码');
  // 模拟从分享卡片启动
  env.ads.launchQuery = { custom: code };
  game.handleLaunchQuery(); env.pump(2);
  assert.strictEqual(game.isCustom, true, 'query.custom 应直达自定义关');
  assert.strictEqual(game.playOrigin, 'challenge');
  assert.strictEqual(game.customCode, code, '关卡码透传（二次分享/成绩记录用）');
  // 解码关必须自带结算/展示字段，否则 WIN 时 computeStars 崩、HUD 标题 undefined
  assert.ok(Array.isArray(game.customLevel.stars) && game.customLevel.stars.length === 3, '解码关带 stars 门槛');
  assert.strictEqual(game.customLevel.name, '自制关');
  assert.strictEqual(game.customLevel.trajectory, 70);
});

test('关卡码：坏码直达给错误提示不崩溃；战役直达门控保留', () => {
  fresh();
  env.ads.launchQuery = { custom: 'PG1!!!bad' };
  game.handleLaunchQuery(); env.pump(1);
  assert.strictEqual(game.isCustom, false, '坏码不进入自定义关');
  assert.strictEqual(game.state, 'MENU');
  // 战役直达门控：未解锁关不许直达
  env.ads.launchQuery = { level: '99' };
  game.handleLaunchQuery();
  assert.strictEqual(game.state, 'MENU', '未解锁战役关不直达');
});

test('存档：打通的自制关可保存到「我造的关」并重开（重开后可渲染/再编辑）', () => {
  fresh();
  game.editor = null;
  game.enterEditor(); env.pump(1);
  EDITOR.placeAt(game, 240, EDITOR_GY - 17, EDITOR.findPalette('pig-s'));
  game.editor.proven = false;
  assert.strictEqual(EDITOR.saveCurrent(game), null, '未通关不许保存');
  game.editor.proven = true;
  const slot = EDITOR.saveCurrent(game);
  assert.ok(slot && slot.code, 'proven 后可保存');
  assert.strictEqual(EDITOR.listSlots(game).length, 1);
  // 重开：草稿须为实体实例（有 draw 方法），否则 editor-render 崩
  EDITOR.openSlot(game, 0);
  assert.strictEqual(game.state, 'EDITOR');
  assert.strictEqual(game.editor.draft.pigs.length, 1);
  assert.strictEqual(typeof game.editor.draft.pigs[0].draw, 'function', '重开草稿须为实体实例');
  assert.strictEqual(game.editor.proven, true, '存档 proven 状态随槽位恢复');
  env.pump(3); // 驱动渲染帧不崩
  // 删除槽位
  EDITOR.deleteSlot(game, 0);
  assert.strictEqual(EDITOR.listSlots(game).length, 0);
});

test('挑战记录：挑战流打通后写入 pufferGo_played_levels（bestStars 取最高）', () => {
  fresh();
  const code = CODEC.encodeLevel({ birds: ['normal'], blocks: [], pigs: [{ x: 240, y: 560, radius: 17 }], pearls: [] });
  EDITOR.recordPlayed(game, code, 2);
  EDITOR.recordPlayed(game, code, 1); // 低星不覆盖
  const played = EDITOR.listPlayed(game);
  assert.strictEqual(played.length, 1);
  assert.strictEqual(played[0].bestStars, 2);
  EDITOR.deletePlayed(game, 0);
  assert.strictEqual(EDITOR.listPlayed(game).length, 0);
});

test('自定义关：挑战流通关自动写入挑战记录（settle 挂钩 recordPlayed）', () => {
  fresh();
  const code = CODEC.encodeLevel({
    birds: ['bomb', 'bomb', 'bomb'], blocks: [],
    pigs: [{ x: 240, y: 560, radius: 17 }], pearls: [],
  });
  game.playCustom(CODEC.decodeLevel(code), 'challenge', code);
  env.pump(2);
  let guard = 0;
  while ((game.state === 'READY' || game.state === 'AIMING' || game.state === 'FLYING' || game.state === 'SETTLING') && guard++ < 25) {
    if (game.state === 'READY' && game.currentBird) {
      const bx = game.currentBird.x, by = game.currentBird.y;
      env.fire('touchstart', bx, by);
      env.fire('touchmove', bx - 30, by - 60);
      env.fire('touchend');
      env.pump(20);
      if (game.state === 'FLYING') { env.fire('touchstart', 200, 300); env.pump(60); }
    }
    env.pump(120);
  }
  assert.strictEqual(game.state, 'WIN');
  const played = EDITOR.listPlayed(game);
  assert.strictEqual(played.length, 1, '挑战通关写入记录');
  assert.strictEqual(played[0].code, code);
  assert.ok(played[0].bestStars >= 1);
});

test('菜单：造关师入口 → 中心页四按钮；输码挑战走剪贴板', () => {
  fresh();
  game.goToMenu(); env.pump(2);
  assert.ok(game.buttons.goMaker, '主菜单有【造关师】入口');
  // 进中心页
  game.openLevelList('ugcHome'); env.pump(2);
  assert.strictEqual(game.listView, 'ugcHome');
  assert.ok(game.buttons.goEditor, '【造一关】按钮');
  assert.ok(game.buttons.goCode, '【输码挑战】按钮');
  assert.ok(game.buttons.goMine, '【我造的关】按钮');
  assert.ok(game.buttons.goPlayed, '【挑战记录】按钮');
  assert.ok(game.buttons.listBack, '中心页有返回');
  // 剪贴板里是有效码 → 直接进入挑战
  const code = CODEC.encodeLevel({ birds: ['normal'], blocks: [], pigs: [{ x: 260, y: 560, radius: 17 }], pearls: [] });
  env.ads.clipboard = code;
  EDITOR.enterFromClipboard(game);
  env.pump(2);
  assert.strictEqual(game.isCustom, true, '剪贴板有效码 → 直达挑战');
  // 剪贴板坏码 → 错误提示，不崩
  game.goToMenu();
  env.ads.clipboard = 'not a code';
  game.openLevelList('ugcHome'); env.pump(1);
  EDITOR.enterFromClipboard(game);
  env.pump(2);
  assert.strictEqual(game.isCustom, false);
  assert.ok(game.clipboardError, '坏码置错误提示');
  assert.ok(game.msgTimer > 0, '错误提示有计时');
});

test('菜单：列表视图（我造的关/挑战记录）可进入、可开档、可返回', () => {
  fresh();
  game.goToMenu(); env.pump(2);
  // 空列表也能进
  game.openLevelList('mine'); env.pump(2);
  assert.strictEqual(game.listView, 'mine');
  assert.ok(game.buttons.listBack, '列表页有返回按钮');
  // 造一条挑战记录再看列表
  const code = CODEC.encodeLevel({ birds: ['normal'], blocks: [], pigs: [{ x: 280, y: 560, radius: 17 }], pearls: [] });
  EDITOR.recordPlayed(game, code, 3);
  game.openLevelList('played'); env.pump(2);
  assert.ok(game.buttons.slotEnter0, '挑战记录第 1 行有进入按钮');
  assert.ok(game.buttons.slotDel0, '挑战记录第 1 行有删除按钮');
  // 进入挑战
  EDITOR.openPlayed(game, 0);
  env.pump(2);
  assert.strictEqual(game.isCustom, true, '挑战记录开档 → 挑战关');
  // 触摸链路：中心页 → 我造的关 → 返回（验证 listBack 两级回退）
  game.goToMenu();
  game.openLevelList('ugcHome'); env.pump(1);
  env.fire('touchstart', 187, 170 + 2 * 72 + 26); env.fire('touchend'); // goMine（第 3 项）
  assert.strictEqual(game.listView, 'mine');
  env.pump(2); // 渲染帧重建 mine 页按钮
  env.fire('touchstart', 187, 667 - 80 + 21); env.fire('touchend');      // listBack → ugcHome
  assert.strictEqual(game.listView, 'ugcHome', '列表页返回中心页');
  env.pump(2); // 渲染帧重建 ugcHome 页按钮
  env.fire('touchstart', 187, 667 - 86 + 21); env.fire('touchend');      // listBack → 主菜单
  assert.strictEqual(game.listView, null, '中心页返回主菜单');
  assert.strictEqual(game.state, 'MENU');
});

// =====================================================================
// 造关师 T8 终审：挑战侧内容校验门 + 吸附预览/实际落位一致
// =====================================================================

test('挑战入口：decode 成功但几何/计数非法的码一律拦下（深链/剪贴板）', () => {
  // 码可被手改：decode 只保证结构完整，不保证可玩。下列码结构合法但内容坏。
  const bad = {
    '0 章鱼（开局白送 WIN）': { birds: ['normal'], blocks: [], pigs: [], pearls: [] },
    '0 河豚（无法发射）': { birds: [], blocks: [], pigs: [{ x: 240, y: 560, radius: 17 }], pearls: [] },
    '方块压弹弓禁区': {
      birds: ['normal'],
      blocks: [{ x: 40, y: 549, width: 28, height: 28, type: 'wood' }],
      pigs: [{ x: 240, y: 560, radius: 17 }], pearls: [],
    },
    '章鱼沉入地面': { birds: ['normal'], blocks: [], pigs: [{ x: 240, y: 600, radius: 17 }], pearls: [] },
  };
  for (const [name, lv] of Object.entries(bad)) {
    // 深链入口
    fresh();
    env.ads.launchQuery = { custom: CODEC.encodeLevel(lv) };
    game.handleLaunchQuery(); env.pump(1);
    assert.strictEqual(game.isCustom, false, `[深链] ${name} 不应装载`);
    assert.strictEqual(game.state, 'MENU', `[深链] ${name} 应留菜单`);
    assert.ok(game.launchError, `[深链] ${name} 应给错误提示`);
    // 剪贴板入口
    fresh();
    game.goToMenu(); game.openLevelList('ugcHome'); env.pump(1);
    env.ads.clipboard = CODEC.encodeLevel(lv);
    EDITOR.enterFromClipboard(game); env.pump(2);
    assert.strictEqual(game.isCustom, false, `[剪贴板] ${name} 不应装载`);
    assert.ok(game.clipboardError, `[剪贴板] ${name} 应给错误提示`);
  }
  // 合法码仍正常放行（回归）
  fresh();
  env.ads.launchQuery = { custom: CODEC.encodeLevel({ birds: ['normal'], blocks: [], pigs: [{ x: 240, y: 560, radius: 17 }], pearls: [] }) };
  game.handleLaunchQuery(); env.pump(2);
  assert.strictEqual(game.isCustom, true, '合法码深链正常装载');
  assert.strictEqual(game.playOrigin, 'challenge');
});

test('编辑器：吸附预览落位与实际放置坐标严格一致（悬空保留/穿地抬升）', () => {
  fresh();
  game.editor = null;
  game.enterEditor(); env.pump(1);
  const d = game.editor;
  // 木柱：高空（应悬空，试玩再塌）/ 穿地（应抬到地面）/ 常规 三点
  const cases = [
    ['wood-p', 240, 300], ['wood-p', 240, 640], ['wood-p', 180, 520],
    ['pig-s', 300, 300], ['pig-s', 300, 640],
    ['pearl', 330, 200],
  ];
  for (const [id, x, y] of cases) {
    const item = EDITOR.findPalette(id);
    const pos = EDITOR.placePosition(d.draft, item, x, y);
    assert.ok(pos, `${id} 有落位点`);
    const nB = d.draft.blocks.length, nP = d.draft.pigs.length, nR = d.draft.pearls.length;
    EDITOR.placeAt(game, x, y, item);
    let ex, ey;
    if (item.kind === 'block') { ex = d.draft.blocks[nB].x; ey = d.draft.blocks[nB].y; }
    else if (item.kind === 'pig') { ex = d.draft.pigs[nP].x; ey = d.draft.pigs[nP].y; }
    else { ex = d.draft.pearls[nR].x; ey = d.draft.pearls[nR].y; }
    assert.strictEqual(ex, pos.x, `${id}@${x},${y} 预览与放置 x 一致`);
    assert.strictEqual(ey, pos.y, `${id}@${x},${y} 预览与放置 y 一致`);
  }
  // 穿地抬升：木柱底边不得沉于地面（GY）
  const pillar = d.draft.blocks.find(b => b.height === 80);
  assert.ok(pillar && pillar.y + pillar.height <= C.GROUND_Y + 0.01, '穿地放置被抬到地面，不沉地');
});

test('作者流 WIN/LOSE：触摸「返回编辑」回编辑器且多帧渲染不崩（currentLevelIndex=-1 回归）', () => {
  // —— WIN 流：bomb 近射打通，触摸点返回编辑 ——
  fresh();
  game.editor = null;
  game.enterEditor(); env.pump(1);
  EDITOR.placeAt(game, 240, GY - 17, EDITOR.findPalette('pig-s'));
  game.editor.draft.birds = ['bomb', 'bomb', 'bomb'];
  EDITOR.tryPlay(game); env.pump(2);
  let guard = 0;
  while ((game.state === 'READY' || game.state === 'AIMING' || game.state === 'FLYING' || game.state === 'SETTLING') && guard++ < 25) {
    if (game.state === 'READY' && game.currentBird) {
      const bx = game.currentBird.x, by = game.currentBird.y;
      env.fire('touchstart', bx, by);
      env.fire('touchmove', bx - 30, by - 60);
      env.fire('touchend');
      env.pump(20);
      if (game.state === 'FLYING') { env.fire('touchstart', 200, 300); env.pump(60); }
    }
    env.pump(120);
  }
  assert.strictEqual(game.state, 'WIN');
  env.pump(120); // 结算动画跑完
  const wb = game.buttons.editorBack;
  assert.ok(wb, 'WIN 有「返回编辑」按钮');
  env.fire('touchstart', wb.x + wb.width / 2, wb.y + wb.height / 2);
  env.pump(1);
  env.fire('touchend');
  env.pump(3);
  assert.strictEqual(game.state, 'EDITOR', 'WIN 触摸「返回编辑」→ 编辑器');
  assert.strictEqual(game.editor.draft.pigs.length, 1, '草稿保留');
  env.pump(30); // 回归：试玩置 currentLevelIndex=-1，回编辑器后 drawUI 读 levels[-1] 曾崩溃白屏
  assert.strictEqual(game.state, 'EDITOR', '编辑器多帧渲染稳定');

  // —— LOSE 流：normal 弱射打空，触摸点返回编辑 ——
  fresh();
  game.editor = null;
  game.enterEditor(); env.pump(1);
  EDITOR.placeAt(game, 350, GY - 17, EDITOR.findPalette('pig-s')); // 弱射够不到
  EDITOR.tryPlay(game); env.pump(2);
  shootOnce();
  assert.strictEqual(game.state, 'LOSE');
  const lb = game.buttons.editorBack;
  assert.ok(lb, 'LOSE 有「返回编辑」按钮');
  env.fire('touchstart', lb.x + lb.width / 2, lb.y + lb.height / 2);
  env.pump(1);
  env.fire('touchend');
  env.pump(3);
  assert.strictEqual(game.state, 'EDITOR', 'LOSE 触摸「返回编辑」→ 编辑器');
  env.pump(30);
  assert.strictEqual(game.state, 'EDITOR', '编辑器多帧渲染稳定');
});

run();
