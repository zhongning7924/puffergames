/**
 * 结算模块 - 胜负判定、进度存档、结算动画与激励视频点位
 * Settle - win/lose resolution, progress saving, ceremony anim, rewarded ads.
 *
 * 从 game.js 拆出（纯搬移，不改行为）。
 * 约定：每个函数以 game 实例为第一个参数；Game 类保留同名薄委托方法。
 */

const C = require('./config.js');
const E = require('./entities.js');
const AD = require('./ad.js');
const DAILY = require('./daily.js');
const PEARLS = require('./pearls.js');
const AUDIO = require('./audio.js');

/** 按当前得分重算星级 */
function computeStars(game) {
  const level = game.getCurrentLevel();
  game.stars = 0;
  if (game.score >= level.stars[0]) game.stars = 1;
  if (game.score >= level.stars[1]) game.stars = 2;
  if (game.score >= level.stars[2]) game.stars = 3;
}

/** 保存通关进度（星级/最高分）并上传排行榜成绩 */
function saveWinProgress(game) {
  if (game.isBonus) return; // 珍珠关不计战役档（纯挑战内容）
  if (game.isDaily) {
    // 每日挑战：只记当日最佳分，不计入战役星级/排行榜总分
    const today = DAILY.todayString();
    if (!game.progress.daily ||
        game.progress.daily.date !== today ||
        game.score > game.progress.daily.best) {
      game.progress.daily = { date: today, best: game.score };
    }
    game.saveProgress();
    return;
  }
  const prevStars = game.progress.stars[game.currentLevelIndex] || 0;
  if (game.stars > prevStars) {
    game.progress.stars[game.currentLevelIndex] = game.stars;
  }
  const prevBest = game.progress.bestScores[game.currentLevelIndex] || 0;
  if (game.score > prevBest) {
    game.progress.bestScores[game.currentLevelIndex] = game.score;
  }
  // 章节全三星 → 奖励章节珍珠（结算页提示，珍珠关解锁池扩充）
  const award = PEARLS.checkChapterAward(game.progress, game.currentLevelIndex);
  if (award) {
    game.progress.pearls = { ...game.progress.pearls, [award.id]: true };
    game.newPearlAwarded = award.label;
  }
  game.saveProgress();
  game.uploadScore();
}

/** 激励视频点位 1：失败后 +1 只鸟继续（挽回流失，eCPM 最高点位） */
function watchAdRevive(game) {
  AD.show(() => {
    game.reviveUsed = true;
    game.birdsRemaining += 1;
    const pos = game.queuePosition(game.birds.length);
    game.birds.push(new E.Bird(pos.x, pos.y, 'normal'));
    game.buttons = {};
    game.spawnBird();
    game.state = 'READY';
  });
}

/** 激励视频点位 2：胜利结算双倍积分（加倍后重算星级并存档） */
function watchAdDoubleScore(game) {
  AD.show(() => {
    game.adDoubleUsed = true;
    game.score *= 2;
    game.computeStars();
    game.saveWinProgress();
    game.buttons = {}; // 重建按钮（双倍按钮消失）
    // 同步结算动画显示态（双倍可能带来新星，直接呈现）
    if (game.winAnim) {
      game.winAnim.displayedScore = game.score;
      game.winAnim.starsShown = game.stars;
      game.winAnim.starPop = 1;
    }
  });
}

/** 激励视频点位 3：卡关解锁本关弹道全显，并立即重开本关 */
function watchAdTrajectoryBoost(game) {
  AD.show(() => {
    game.retryLevel();
    game.trajectoryBoost = true; // retryLevel 会重置标志，需在重开后设置
  });
}

/**
 * 结算仪式感动画推进（60Hz 逻辑帧驱动）：
 *  count 45帧：得分从 0 缓动滚动到击杀分
 *  birds 32帧/只：剩豚逐只飞入，每只 +5000 并飘字
 *  stars 34帧/颗：三星依次弹出（节奏放缓），弹出音 + 轻震动
 */
function updateWinAnim(game) {
  const a = game.winAnim;
  if (!a || a.phase === 'done') return;
  a.timer++;

  if (a.phase === 'count') {
    const p = Math.min(1, a.timer / 45);
    const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
    a.displayedScore = Math.floor(a.baseScore * eased);
    if (p >= 1) {
      a.phase = a.birdsTotal > 0 ? 'birds' : 'stars';
      a.timer = 0;
    }
  } else if (a.phase === 'birds') {
    if (a.timer >= 32) {
      a.timer = 0;
      a.birdsShown++;
      a.displayedScore += 5000;
      AUDIO.play('pop');
      game.addFloatingText(C.SCREEN_WIDTH / 2 + 60, C.SCREEN_HEIGHT / 2 - 30, '+5000', C.COLORS.starGold, 18);
      if (a.birdsShown >= a.birdsTotal) {
        a.phase = 'stars';
        a.timer = 0;
      }
    }
  } else if (a.phase === 'stars') {
    if (a.timer >= 34) {
      a.timer = 0;
      if (a.starsShown < game.stars) {
        a.starsShown++;
        a.starPop = 0;
        AUDIO.play('ding');
        game.vibrate('light');
      } else {
        a.phase = 'done';
      }
    }
  }

  // 最新一颗星的弹出进度（drawWinScreen 据此做回弹缩放）
  if (a.starPop < 1) a.starPop = Math.min(1, a.starPop + 1 / 18);
}

/** 跳过结算动画：立即呈现最终态（动画期间首次点击仅跳过，不触发按钮） */
function skipWinAnim(game) {
  const a = game.winAnim;
  if (!a || a.phase === 'done') return;
  a.phase = 'done';
  a.displayedScore = game.score;
  a.birdsShown = a.birdsTotal;
  a.starsShown = game.stars;
  a.starPop = 1;
}

/** 胜负判定：章鱼全灭→胜利；鸟尽→失败；否则出下一只鸟 */
function checkWinLose(game) {
  const alivePigs = game.pigs.filter(p => p.alive && !p.dying);

  if (alivePigs.length === 0) {
    // 胜利
    game.state = 'WIN';
    game.buttons = {};
    // 剩余小鸟奖励
    const bonus = game.birdsRemaining * 5000;
    if (bonus > 0) {
      game.score += bonus;
    }
    // 计算星级
    game.computeStars();

    // 结算仪式感动画：击杀分滚动累计 → 剩豚逐只飞入加分 → 三星依次弹出。
    // 数据已定稿（存档/分享/双倍均用最终值），这里只是显示层的表演进度。
    game.winAnim = {
      phase: 'count',              // count → birds → stars → done
      timer: 0,
      baseScore: game.score - bonus, // 击杀得分（滚动目标值）
      displayedScore: 0,           // 当前显示分
      birdsTotal: game.birdsRemaining,
      birdsShown: 0,               // 已飞入加分的鸟数
      starsShown: 0,               // 已弹出的星数
      starPop: 1,                  // 当前星的弹出动画进度 0→1
    };

    // 解锁下一关（每日挑战/珍珠关不涉及战役解锁）
    if (!game.isDaily && !game.isBonus &&
        game.currentLevelIndex + 1 >= game.progress.unlockedLevels &&
        game.currentLevelIndex + 1 < game.levels.length) {
      game.progress.unlockedLevels = game.currentLevelIndex + 2;
    }
    // 保存最佳星级与最高分并上传排行榜
    game.saveWinProgress();

    AUDIO.play('win');
    game.vibrate('medium');
  } else if (game.birdsRemaining <= 0) {
    // 失败（记录卡关次数，>=2 次时结算页出现"弹道全显"广告点位；每日/珍珠关单独计）
    const failKey = game.isDaily ? 'daily' : game.isBonus ? 'bonus' : game.currentLevelIndex;
    game.failCounts[failKey] = (game.failCounts[failKey] || 0) + 1;
    game.state = 'LOSE';
    game.buttons = {};
    AUDIO.play('lose');
    game.vibrate('long');
  } else {
    // 继续 - 加载下一只鸟
    game.spawnBird();
    game.state = 'READY';
  }
}

module.exports = {
  computeStars,
  saveWinProgress,
  watchAdRevive,
  watchAdDoubleScore,
  watchAdTrajectoryBoost,
  updateWinAnim,
  skipWinAnim,
  checkWinLose,
};
