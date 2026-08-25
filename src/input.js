/**
 * 输入模块 - 触摸事件分发（按下选中/抬起重放，瞄准拖拽，技能触发）
 * Input - touch dispatch (press-select / release-fire, aiming drag, ability).
 *
 * 从 game.js 拆出（纯搬移，不改行为）。
 * 约定：每个函数以 game 实例为第一个参数；Game 类保留同名薄委托方法。
 * 按钮采用"按下标记 + 抬起触发"两段式，避免滑动误触。
 */

const C = require('./config.js');
const U = require('./utils.js');
const AUDIO = require('./audio.js');
const SOCIAL = require('./social.js');

/** 触摸按下：按状态机分发（菜单/设置/排行榜/选关选中按钮；READY→AIMING；FLYING→技能） */
function onTouchStart(game, x, y) {
  game.pulseTimer = 0;
  AUDIO.startBGM(); // 首次用户手势启动循环 BGM（幂等）

  switch (game.state) {
    case 'MENU':
      // 隐藏珍珠彩蛋：快速双击主菜单吉祥物（河豚）收集"彩蛋珍珠"
      const mascotX = C.SCREEN_WIDTH / 2;
      const mascotY = C.SCREEN_HEIGHT * 0.3 - 42;
      if (U.distance(x, y, mascotX, mascotY) < 32 && !game.progress.pearls.ui) {
        const now = Date.now();
        if (now - game.lastMascotTapTime < 500) {
          game.progress.pearls = { ...game.progress.pearls, ui: true };
          game.saveProgress();
          game.addFloatingText(mascotX, mascotY - 45, '发现隐藏珍珠！', '#E1F5FE', 18);
          AUDIO.play('ding');
          game.vibrate('light');
          game.lastMascotTapTime = 0;
        } else {
          game.lastMascotTapTime = now;
        }
      }
      if (game.buttons.play && game.buttons.play.contains(x, y)) {
        game.buttons.play.pressed = true;
        AUDIO.play('tap');
      }
      if (game.buttons.leaderboard && game.buttons.leaderboard.contains(x, y)) {
        game.buttons.leaderboard.pressed = true;
        AUDIO.play('tap');
      }
      if (game.buttons.settings && game.buttons.settings.contains(x, y)) {
        game.buttons.settings.pressed = true;
        AUDIO.play('tap');
      }
      break;

    case 'SETTINGS':
      for (const key of ['tglSound', 'tglMusic', 'tglVibration']) {
        if (game.buttons[key] && game.buttons[key].contains(x, y)) {
          game.buttons[key].pressed = true;
          AUDIO.play('tap');
        }
      }
      if (game.buttons.back && game.buttons.back.contains(x, y)) {
        game.buttons.back.pressed = true;
        AUDIO.play('tap');
      }
      break;

    case 'LEADERBOARD':
      if (game.buttons.back && game.buttons.back.contains(x, y)) {
        game.buttons.back.pressed = true;
        AUDIO.play('tap');
      }
      break;

    case 'LEVEL_SELECT':
      for (let i = 0; i < game.levels.length; i++) {
        const btn = game.buttons['level' + i];
        if (btn && btn.contains(x, y) && i < game.progress.unlockedLevels) {
          btn.pressed = true;
          AUDIO.play('tap');
        }
      }
      if (game.buttons.daily && game.buttons.daily.contains(x, y)) {
        game.buttons.daily.pressed = true;
        AUDIO.play('tap');
      }
      if (game.buttons.bonus && game.buttons.bonus.contains(x, y)) {
        game.buttons.bonus.pressed = true;
        AUDIO.play('tap');
      }
      if (game.buttons.back && game.buttons.back.contains(x, y)) {
        game.buttons.back.pressed = true;
        AUDIO.play('tap');
      }
      break;

    case 'READY':
      if (game.currentBird) {
        const d = U.distance(x, y, game.currentBird.x, game.currentBird.y);
        if (d < 60) {
          game.state = 'AIMING';
          game.dragStart = { x, y };
          game.hintAlpha = 0;
        }
      }
      break;

    case 'AIMING':
      // 已经在瞄准中，保持状态
      break;

    case 'FLYING':
      // 空中点击：释放当前小鸟技能（每次飞行限一次）
      game.tryActivateAbility();
      break;

    case 'WIN':
      // 结算动画播放中：首次点击仅跳过动画，不触发任何按钮（防误触）
      if (game.winAnim && game.winAnim.phase !== 'done') {
        game.skipWinAnim();
        break;
      }
      if (game.buttons.next && game.buttons.next.contains(x, y)) {
        game.buttons.next.pressed = true;
        AUDIO.play('tap');
      }
      if (game.buttons.retry && game.buttons.retry.contains(x, y)) {
        game.buttons.retry.pressed = true;
        AUDIO.play('tap');
      }
      if (game.buttons.menu && game.buttons.menu.contains(x, y)) {
        game.buttons.menu.pressed = true;
        AUDIO.play('tap');
      }
      if (game.buttons.share && game.buttons.share.contains(x, y)) {
        game.buttons.share.pressed = true;
        AUDIO.play('tap');
      }
      if (game.buttons.double && game.buttons.double.contains(x, y)) {
        game.buttons.double.pressed = true;
        AUDIO.play('tap');
      }
      break;

    case 'LOSE':
      if (game.buttons.retry && game.buttons.retry.contains(x, y)) {
        game.buttons.retry.pressed = true;
        AUDIO.play('tap');
      }
      if (game.buttons.menu && game.buttons.menu.contains(x, y)) {
        game.buttons.menu.pressed = true;
        AUDIO.play('tap');
      }
      if (game.buttons.revive && game.buttons.revive.contains(x, y)) {
        game.buttons.revive.pressed = true;
        AUDIO.play('tap');
      }
      if (game.buttons.boost && game.buttons.boost.contains(x, y)) {
        game.buttons.boost.pressed = true;
        AUDIO.play('tap');
      }
      break;
  }
}

/** 瞄准拖拽：限制最大拉距、只允许向后拉 */
function onTouchMove(game, x, y) {
  if (game.state === 'AIMING' && game.currentBird) {
    // 计算拖拽位置（限制在最大拖拽范围内）
    let dx = x - C.SLINGSHOT_X;
    let dy = y - (C.SLINGSHOT_Y - 15);
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > C.MAX_DRAG) {
      dx = (dx / dist) * C.MAX_DRAG;
      dy = (dy / dist) * C.MAX_DRAG;
    }

    // 限制不能往前拖（只能往后拉）
    if (dx > 0) dx = 0;

    game.currentBird.x = C.SLINGSHOT_X + dx;
    game.currentBird.y = (C.SLINGSHOT_Y - 15) + dy;
  }
}

/** 触摸抬起：重放按下的按钮；瞄准中则按拉距决定发射或回位 */
function onTouchEnd(game) {
  switch (game.state) {
    case 'MENU':
      if (game.buttons.play && game.buttons.play.pressed) {
        game.buttons.play.pressed = false;
        game.goToLevelSelect();
      }
      if (game.buttons.leaderboard && game.buttons.leaderboard.pressed) {
        game.buttons.leaderboard.pressed = false;
        game.goToLeaderboard();
      }
      if (game.buttons.settings && game.buttons.settings.pressed) {
        game.buttons.settings.pressed = false;
        game.goToSettings();
      }
      break;

    case 'SETTINGS':
      if (game.buttons.tglSound && game.buttons.tglSound.pressed) {
        game.buttons.tglSound.pressed = false;
        game.toggleSetting('sound');
      }
      if (game.buttons.tglMusic && game.buttons.tglMusic.pressed) {
        game.buttons.tglMusic.pressed = false;
        game.toggleSetting('music');
      }
      if (game.buttons.tglVibration && game.buttons.tglVibration.pressed) {
        game.buttons.tglVibration.pressed = false;
        game.toggleSetting('vibration');
      }
      if (game.buttons.back && game.buttons.back.pressed) {
        game.buttons.back.pressed = false;
        game.goToMenu();
      }
      break;

    case 'LEADERBOARD':
      if (game.buttons.back && game.buttons.back.pressed) {
        game.buttons.back.pressed = false;
        game.goToMenu();
      }
      break;

    case 'LEVEL_SELECT':
      if (game.buttons.daily && game.buttons.daily.pressed) {
        game.buttons.daily.pressed = false;
        game.startDaily();
        return;
      }
      if (game.buttons.bonus && game.buttons.bonus.pressed) {
        game.buttons.bonus.pressed = false;
        game.startNextBonus();
        return;
      }
      for (let i = 0; i < game.levels.length; i++) {
        const btn = game.buttons['level' + i];
        if (btn && btn.pressed && i < game.progress.unlockedLevels) {
          btn.pressed = false;
          game.startLevel(i);
          return;
        }
      }
      if (game.buttons.back && game.buttons.back.pressed) {
        game.buttons.back.pressed = false;
        game.goToMenu();
      }
      break;

    case 'AIMING':
      if (game.currentBird) {
        const dx = C.SLINGSHOT_X - game.currentBird.x;
        const dy = (C.SLINGSHOT_Y - 15) - game.currentBird.y;
        const dragDist = Math.sqrt(dx * dx + dy * dy);

        if (dragDist > C.MIN_DRAG) {
          // 发射！
          const vx = dx * C.POWER_FACTOR;
          const vy = dy * C.POWER_FACTOR;
          game.currentBird.launch(vx, vy);
          game.birdsRemaining--;
          game.state = 'FLYING';
          game.lastTrail = []; // 开始记录本发完整弹道（上一发残影被替换）
          game.createLaunchParticles(game.currentBird.x, game.currentBird.y);
          game.combo = 0;
          AUDIO.play('launch');
          game.vibrate('light');
        } else {
          // 拖拽距离不够，回到弹弓
          game.currentBird.x = C.SLINGSHOT_X;
          game.currentBird.y = C.SLINGSHOT_Y - 15;
          game.state = 'READY';
        }
      }
      break;

    case 'WIN':
      if (game.buttons.next && game.buttons.next.pressed) {
        game.buttons.next.pressed = false;
        game.nextLevel();
      }
      if (game.buttons.retry && game.buttons.retry.pressed) {
        game.buttons.retry.pressed = false;
        game.retryLevel();
      }
      if (game.buttons.menu && game.buttons.menu.pressed) {
        game.buttons.menu.pressed = false;
        game.goToMenu();
      }
      if (game.buttons.share && game.buttons.share.pressed) {
        game.buttons.share.pressed = false;
        SOCIAL.shareResult(game.isDaily ? -1 : game.currentLevelIndex, game.stars);
      }
      if (game.buttons.double && game.buttons.double.pressed) {
        game.buttons.double.pressed = false;
        game.watchAdDoubleScore();
      }
      break;

    case 'LOSE':
      if (game.buttons.retry && game.buttons.retry.pressed) {
        game.buttons.retry.pressed = false;
        game.retryLevel();
      }
      if (game.buttons.menu && game.buttons.menu.pressed) {
        game.buttons.menu.pressed = false;
        game.goToMenu();
      }
      if (game.buttons.revive && game.buttons.revive.pressed) {
        game.buttons.revive.pressed = false;
        game.watchAdRevive();
      }
      if (game.buttons.boost && game.buttons.boost.pressed) {
        game.buttons.boost.pressed = false;
        game.watchAdTrajectoryBoost();
      }
      break;
  }

  // 重置所有按钮状态
  for (const key in game.buttons) {
    if (game.buttons[key]) game.buttons[key].pressed = false;
  }
}

module.exports = { onTouchStart, onTouchMove, onTouchEnd };
