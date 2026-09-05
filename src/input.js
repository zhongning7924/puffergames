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
const EDITOR = require('./editor.js');

/** 触摸按下：按状态机分发（菜单/设置/排行榜/选关选中按钮；READY→AIMING；FLYING→技能） */
function onTouchStart(game, x, y) {
  game.pulseTimer = 0;
  AUDIO.startBGM(); // 首次用户手势启动循环 BGM（幂等）

  switch (game.state) {
    case 'EDITOR':
      EDITOR.onTouchStart(game, x, y);
      break;
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
      if (game.buttons.help && game.buttons.help.contains(x, y)) {
        game.buttons.help.pressed = true;
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

    case 'HELP':
      // 记录手势起点（区分点击与拖动滚动）
      game.helpTouch = { y, scroll: game.helpScroll || 0, moved: false };
      if (game.buttons.helpBack && game.buttons.helpBack.contains(x, y)) {
        game.buttons.helpBack.pressed = true;
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
      // 玩家已上手：交还滚动控制权，停止自动定位（此后手动滚到哪就是哪）
      game.levelSelectAutoFocus = false;
      // 记录手势起点（区分点击与拖动滚动）；滚动后按钮采用「内容坐标 + 当前偏移」做命中
      game.levelSelTouch = { y, scroll: game.levelSelectScroll || 0, moved: false };
      const scroll = game.levelSelectScroll || 0;
      for (let i = 0; i < game.levels.length; i++) {
        const btn = game.buttons['level' + i];
        if (btn && btn.contains(x, y + scroll) && i < game.progress.unlockedLevels) {
          btn.pressed = true;
          AUDIO.play('tap');
        }
      }
      if (game.buttons.daily && game.buttons.daily.contains(x, y + scroll)) {
        game.buttons.daily.pressed = true;
        AUDIO.play('tap');
      }
      if (game.buttons.bonus && game.buttons.bonus.contains(x, y + scroll)) {
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
          break;
        }
      }
      // 点候飞区：把该豚换到弹弓（自由规划出豚顺序，搭配材质克制）
      if (Array.isArray(game.birds)) {
        for (let k = 0; k < game.birds.length; k++) {
          const b = game.birds[k];
          if (U.distance(x, y, b.x, b.y) < b.radius + 14) {
            game.swapBird(k);
            AUDIO.play('tap');
            game.vibrate('light');
            if (!game.progress.tutSwap) {
              game.progress.tutSwap = true;
              game.saveProgress();
            }
            break;
          }
        }
      }
      break;

    case 'AIMING':
      // 已经在瞄准中，保持状态
      break;

    case 'FLYING':
      // 空中点击：释放当前河豚技能（每次飞行限一次）
      game.tryActivateAbility();
      break;

    case 'WIN':
      // 结算动画播放中：首次点击先跳过动画。
      // 若这一下恰好落在按钮上，则跳过的同时照常触发该按钮——
      // 旧行为是整次点击只用于跳过、直接 return，玩家会以为「点了下一关没反应」，
      // 在剩豚奖励多的关卡（结算动画最长约 6 秒）尤其明显。
      if (game.winAnim && game.winAnim.phase !== 'done') {
        game.skipWinAnim();
        const onButton = ['next', 'retry', 'menu', 'share', 'double',
          'editorBack', 'saveShare', 'challengeShare']
          .some(k => game.buttons[k] && game.buttons[k].contains(x, y));
        if (!onButton) break; // 点在空白处：仅跳过，防误触
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
      // 自制关结算按钮（作者流 editorBack/saveShare；挑战流 challengeShare）
      if (game.buttons.editorBack && game.buttons.editorBack.contains(x, y)) {
        game.buttons.editorBack.pressed = true;
        AUDIO.play('tap');
      }
      if (game.buttons.saveShare && game.buttons.saveShare.contains(x, y)) {
        game.buttons.saveShare.pressed = true;
        AUDIO.play('tap');
      }
      if (game.buttons.challengeShare && game.buttons.challengeShare.contains(x, y)) {
        game.buttons.challengeShare.pressed = true;
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
      // 作者流 LOSE 页也有「返回编辑」（接不到就成死路）
      if (game.buttons.editorBack && game.buttons.editorBack.contains(x, y)) {
        game.buttons.editorBack.pressed = true;
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
  if (game.state === 'EDITOR') {
    EDITOR.onTouchMove(game, x, y);
    return;
  }

  if (game.state === 'LEVEL_SELECT' && game.levelSelTouch) {
    const t = game.levelSelTouch;
    const dy = y - t.y;
    if (!t.moved && Math.abs(dy) > 6) {
      // 判定为拖动滚动：取消已按压按钮，避免滚动被误判成点击
      t.moved = true;
      for (const k in game.buttons) {
        if (game.buttons[k]) game.buttons[k].pressed = false;
      }
    }
    if (t.moved) {
      const max = game.levelSelectMaxScroll || 0;
      game.levelSelectScroll = Math.max(0, Math.min(max, t.scroll - dy));
    }
    return;
  }

  if (game.state === 'HELP' && game.helpTouch) {
    const t = game.helpTouch;
    const dy = y - t.y;
    if (!t.moved && Math.abs(dy) > 6) {
      t.moved = true;
      if (game.buttons.helpBack) game.buttons.helpBack.pressed = false;
    }
    if (t.moved) {
      const max = game.helpMaxScroll || 0;
      game.helpScroll = Math.max(0, Math.min(max, t.scroll - dy));
    }
    return;
  }

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
    case 'EDITOR':
      // 触摸抬起事件不带坐标，编辑器用 start/move 缓存的 touchX/touchY
      EDITOR.onTouchEnd(game);
      break;

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
      if (game.buttons.help && game.buttons.help.pressed) {
        game.buttons.help.pressed = false;
        game.goToHelp();
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

    case 'HELP':
      if (game.helpTouch && game.helpTouch.moved) {
        game.helpTouch = null;
        break;
      }
      if (game.buttons.helpBack && game.buttons.helpBack.pressed) {
        game.buttons.helpBack.pressed = false;
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
      // 若本次手势是拖动滚动，则不触发任何按钮
      if (game.levelSelTouch && game.levelSelTouch.moved) {
        game.levelSelTouch = null;
        break;
      }
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
      if (game.buttons.editorBack && game.buttons.editorBack.pressed) {
        game.buttons.editorBack.pressed = false;
        game.backToEditor();
      }
      if (game.buttons.saveShare && game.buttons.saveShare.pressed) {
        game.buttons.saveShare.pressed = false;
        EDITOR.onSaveShare(game);
      }
      if (game.buttons.challengeShare && game.buttons.challengeShare.pressed) {
        game.buttons.challengeShare.pressed = false;
        SOCIAL.shareCustom(game.customCode, game.stars);
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
      if (game.buttons.editorBack && game.buttons.editorBack.pressed) {
        game.buttons.editorBack.pressed = false;
        game.backToEditor();
      }
      break;
  }

  // 重置所有按钮状态
  for (const key in game.buttons) {
    if (game.buttons[key]) game.buttons[key].pressed = false;
  }
}

module.exports = { onTouchStart, onTouchMove, onTouchEnd };
