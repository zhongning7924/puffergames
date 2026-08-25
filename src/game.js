/**
 * 主游戏控制器 - 状态机、关卡管理、输入、特效结算、主循环
 * Main Game Controller - State machine, level flow, input, effects, main loop.
 *
 * 模块边界（P3-14 拆分，纯搬移不改行为）：
 *  - src/physics.js  碰撞检测与响应（checkBirdCollisions / checkDynamicCollisions）
 *  - src/renderer.js 世界内绘制（背景/弹弓/弹道/HUD）
 *  - src/screens.js  全屏界面（菜单/选关/排行榜/胜负结算）
 */

// roundRect polyfill - 部分微信基础库/真机 Canvas 不支持原生 roundRect。
// 注：代码已改用 U.roundRectPath()（arcTo 手绘，全环境可用），此处 polyfill 仅作兜底，避免遗漏调用崩溃。
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    this.beginPath();
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
  };
}

const C = require('./config.js');
C.init(); // 尽早读取系统信息，避免模块加载时 jsbridge 未就绪报错
const U = require('./utils.js');
const E = require('./entities.js');
const { getLevels } = require('./levels.js');
const AUDIO = require('./audio.js');
const SOCIAL = require('./social.js');
const AD = require('./ad.js');
const LEVELFLOW = require('./level-flow.js');
const SETTLE = require('./settle.js');
const PHYSICS = require('./physics.js');
const RENDERER = require('./renderer.js');
const SCREENS = require('./screens.js');

class Game {
  constructor() {
    this.setupCanvas();
    this.initState();
    this.initClouds();
    RENDERER.initBackgroundCache(this); // 静态背景离屏缓存（失败自动降级逐帧直绘）
    this.loadProgress();
    this.setupInput();
    AUDIO.init(); // 初始化音频环境 (小游戏/真机/DevTools 才会出声，浏览器预览静默)
    this.loadSettings(); // 读取并应用 音效/音乐/震动 开关（依赖 AUDIO 已初始化）
    AD.init(); // 激励视频（占位广告位下自动降级为不可用）
    // 分享能力（被动分享菜单 + 战绩卡片，预览环境自动降级）
    SOCIAL.init(() => {
      let totalStars = 0;
      for (const k in this.progress.stars) totalStars += this.progress.stars[k];
      return totalStars > 0
        ? { title: `我在「冲吧！小河豚」收集了 ${totalStars} 颗星，来挑战我吧！`, query: '' }
        : { title: '「冲吧！小河豚」—— 一弹入魂的物理弹射小游戏', query: '' };
    });
    // 通过分享卡片进入 → 直达对应关卡（已解锁才跳转）
    const launchLevel = SOCIAL.getLaunchLevel();
    if (launchLevel !== null && launchLevel < this.progress.unlockedLevels) {
      this.loadLevel(launchLevel);
    }
    this.gameLoop();
  }

  // ==================== 初始化 ====================

  setupCanvas() {
    this.canvas = wx.createCanvas();
    this.ctx = this.canvas.getContext('2d');
    this.canvas.width = C.SCREEN_WIDTH * C.DPR;
    this.canvas.height = C.SCREEN_HEIGHT * C.DPR;
    this.ctx.scale(C.DPR, C.DPR);
    this.bgCanvas = null; // 静态背景离屏缓存（renderer.initBackgroundCache 填充）
  }

  initState() {
    this.state = 'MENU';
    this.currentLevelIndex = 0;
    this.score = 0;
    this.totalScore = 0;
    this.birdsRemaining = 0;
    this.birds = [];
    this.currentBird = null;
    this.extraBirds = [];   // 分裂技能产生的额外飞行小鸟
    this.pendingExplosions = []; // 爆裂果链式爆炸队列（下一逻辑步处理，避免递归）
    this.pigs = [];
    this.blocks = [];
    this.particles = [];
    this.floatingTexts = [];
    this.particlePool = [];  // 粒子对象池（死亡回收复用，避免 GC 卡顿）
    this.textPool = [];      // 飘字对象池
    this.shakeAmount = 0;
    this.settleTimer = 0;
    this.transitionTimer = 0;
    this.stars = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.maxCombo = 0;      // 本关最大连击（结算展示用）
    this.hintAlpha = 1;
    this.hintText = null;     // 当前教学提示文案（null = 默认拖拽教学）
    this.frameCount = 0;
    this.dragStart = null;
    this.buttons = {};
    this.pulseTimer = 0;
    this.hitSoundCooldown = 0; // 撞击音效帧冷却，避免每帧刷屏

    // 固定时间步长状态（见 gameLoop）
    this.accumulator = 0;
    this.lastFrameTime = 0;

    // 关卡数据
    this.levels = getLevels();
    this.progress = { unlockedLevels: 1, stars: {}, bestScores: {} };
    this.sharedCanvas = null; // 开放数据域共享画布（排行榜）

    // 每日挑战状态
    this.isDaily = false;        // 当前是否在进行每日挑战
    this.dailyLevel = null;      // 当日挑战关卡数据（日期种子生成）

    // 激励视频点位状态
    this.failCounts = {};        // 各关失败次数（卡关检测；每日挑战用 'daily' 键）
    this.reviveUsed = false;     // 本次关卡是否已用"+1 鸟"复活
    this.adDoubleUsed = false;   // 本次结算是否已用双倍积分
    this.trajectoryBoost = false;// 本关是否已解锁弹道全显

    // 设置项（设置界面三个开关；loadSettings 读取存档覆盖）
    this.settings = { sound: true, music: true, vibration: true };

    // 胜利结算仪式感动画（数据在 checkWinLose 立即定稿，此状态只驱动显示层）
    this.winAnim = null;

    // 珍珠收集系统（对标原版金蛋）
    this.pearls = [];            // 本关场景珍珠（collected = 已拾取/已入库）
    this.isBonus = false;        // 当前是否在进行珍珠关
    this.bonusLevel = null;      // 珍珠关数据（珍珠 ID 种子确定性生成）
    this.bonusMeta = null;       // 当前珍珠关对应的珍珠 meta
    this.newPearlAwarded = null; // 本次结算新解锁的章节珍珠（结算页展示用）
    this.lastMascotTapTime = 0;  // 主菜单吉祥物双击计时（隐藏珍珠彩蛋）
    this.bonusCursor = -1;       // 珍珠关轮换游标

    // 上一发完整弹道（ghost trail：发射下一只前保留，供瞄准修正）
    this.lastTrail = null;       // null = 无记录；[] = 正在记录本发
  }

  initClouds() {
    this.clouds = [];
    for (let i = 0; i < 4; i++) {
      this.clouds.push(new E.Cloud(
        U.random(0, C.SCREEN_WIDTH),
        U.random(30, C.SCREEN_HEIGHT * 0.35),
        U.random(0.6, 1.2)
      ));
    }
  }

  loadProgress() {
    try {
      const saved = wx.getStorageSync('angryBirds_progress');
      if (saved) {
        this.progress = saved;
      }
    } catch (e) {
      // 使用默认进度
    }
    // 旧存档迁移：补充后加的字段
    if (!this.progress.bestScores) this.progress.bestScores = {};
    if (!this.progress.stars) this.progress.stars = {};
    if (!this.progress.hintShown) this.progress.hintShown = {}; // 已看过的技能教学关卡
    if (!this.progress.pearls) this.progress.pearls = {};       // 已收集的隐藏珍珠
  }

  saveProgress() {
    try {
      wx.setStorageSync('angryBirds_progress', this.progress);
    } catch (e) {
      // 存储失败忽略
    }
  }

  // ==================== 设置 ====================

  loadSettings() {
    try {
      const saved = wx.getStorageSync('angryBirds_settings');
      if (saved) Object.assign(this.settings, saved);
    } catch (e) {
      // 使用默认设置
    }
    AUDIO.setEnabled(this.settings.sound);
    AUDIO.setMusicEnabled(this.settings.music);
  }

  saveSettings() {
    try {
      wx.setStorageSync('angryBirds_settings', this.settings);
    } catch (e) {
      // 存储失败忽略
    }
  }

  /** 切换设置项并立即生效（sound/music 直通音频管理器，vibration 仅查标志） */
  toggleSetting(key) {
    this.settings[key] = !this.settings[key];
    if (key === 'sound') AUDIO.setEnabled(this.settings.sound);
    if (key === 'music') AUDIO.setMusicEnabled(this.settings.music);
    this.saveSettings();
  }

  /** 震动统一入口：受设置开关控制（type: light/medium/heavy/long） */
  vibrate(type) {
    if (!this.settings.vibration) return;
    try {
      if (type === 'long') wx.vibrateLong();
      else wx.vibrateShort({ type });
    } catch (e) {}
  }

  /** 上传总成绩到微信云托管 KV（好友排行榜数据源；预览环境自动降级） */
  uploadScore() {
    try {
      if (typeof wx.setUserCloudStorage !== 'function') return;
      let totalScore = 0;
      let totalStars = 0;
      for (const k in this.progress.bestScores) totalScore += this.progress.bestScores[k];
      for (const k in this.progress.stars) totalStars += this.progress.stars[k];
      wx.setUserCloudStorage({
        KVDataList: [
          { key: 'totalScore', value: String(totalScore) },
          { key: 'totalStars', value: String(totalStars) },
        ],
      });
    } catch (e) {
      // 未登录/不支持时静默
    }
  }

  /** 进入好友排行榜（开放数据域） */
  goToLeaderboard() {
    this.state = 'LEADERBOARD';
    this.buttons = {};
    this.sharedCanvas = null;
    try {
      if (typeof wx.getOpenDataContext === 'function') {
        const odc = wx.getOpenDataContext();
        this.sharedCanvas = odc.canvas;
        odc.postMessage({
          type: 'showFriendsRank',
          width: C.SCREEN_WIDTH,
          height: C.SCREEN_HEIGHT,
          dpr: C.DPR,
        });
      }
    } catch (e) {
      this.sharedCanvas = null;
    }
  }

  // ==================== 关卡管理 ====================

  /** 当前进行中的关卡数据（每日挑战/珍珠关时为对应生成关卡） */
  getCurrentLevel() {
    if (this.isDaily) return this.dailyLevel;
    if (this.isBonus) return this.bonusLevel;
    return this.levels[this.currentLevelIndex];
  }

  // 关卡流程实现在 level-flow.js（此处为薄委托，保持对外方法签名不变）
  loadLevel(index) { LEVELFLOW.loadLevel(this, index); }
  startDaily() { LEVELFLOW.startDaily(this); }
  startNextBonus() { LEVELFLOW.startNextBonus(this); }
  startBonus(meta) { LEVELFLOW.startBonus(this, meta); }
  setupLevel(level) { LEVELFLOW.setupLevel(this, level); }
  queuePosition(i) { return LEVELFLOW.queuePosition(i); }
  spawnBird() { LEVELFLOW.spawnBird(this); }

  // ==================== 状态转换 ====================

  goToMenu() {
    this.state = 'MENU';
    this.buttons = {};
  }

  goToLevelSelect() {
    this.state = 'LEVEL_SELECT';
    this.buttons = {};
  }

  goToSettings() {
    this.state = 'SETTINGS';
    this.buttons = {};
  }

  startLevel(index) {
    if (index < this.progress.unlockedLevels) {
      this.loadLevel(index);
    }
  }

  nextLevel() {
    if (this.isDaily || this.isBonus) {
      // 每日挑战/珍珠关无"下一关"，回到选关页
      this.goToLevelSelect();
    } else if (this.currentLevelIndex < this.levels.length - 1) {
      this.loadLevel(this.currentLevelIndex + 1);
    } else {
      this.goToMenu();
    }
  }

  retryLevel() {
    if (this.isDaily) {
      this.startDaily(); // 重新生成当日关卡（同种子，内容一致）
    } else if (this.isBonus) {
      this.startBonus(this.bonusMeta); // 同种子确定性重开
    } else {
      this.loadLevel(this.currentLevelIndex);
    }
  }

  // ==================== 输入处理 ====================

  setupInput() {
    wx.onTouchStart((e) => {
      if (e.touches.length === 0) return;
      const t = e.touches[0];
      this.onTouchStart(t.clientX, t.clientY);
    });

    wx.onTouchMove((e) => {
      if (e.touches.length === 0) return;
      const t = e.touches[0];
      this.onTouchMove(t.clientX, t.clientY);
    });

    wx.onTouchEnd((e) => {
      this.onTouchEnd();
    });

    wx.onTouchCancel(() => {
      this.onTouchEnd();
    });
  }

  onTouchStart(x, y) {
    this.pulseTimer = 0;
    AUDIO.startBGM(); // 首次用户手势启动循环 BGM（幂等）

    switch (this.state) {
      case 'MENU':
        // 隐藏珍珠彩蛋：快速双击主菜单吉祥物（河豚）收集"彩蛋珍珠"
        const mascotX = C.SCREEN_WIDTH / 2;
        const mascotY = C.SCREEN_HEIGHT * 0.3 - 42;
        if (U.distance(x, y, mascotX, mascotY) < 32 && !this.progress.pearls.ui) {
          const now = Date.now();
          if (now - this.lastMascotTapTime < 500) {
            this.progress.pearls = { ...this.progress.pearls, ui: true };
            this.saveProgress();
            this.addFloatingText(mascotX, mascotY - 45, '发现隐藏珍珠！', '#E1F5FE', 18);
            AUDIO.play('ding');
            this.vibrate('light');
            this.lastMascotTapTime = 0;
          } else {
            this.lastMascotTapTime = now;
          }
        }
        if (this.buttons.play && this.buttons.play.contains(x, y)) {
          this.buttons.play.pressed = true;
          AUDIO.play('tap');
        }
        if (this.buttons.leaderboard && this.buttons.leaderboard.contains(x, y)) {
          this.buttons.leaderboard.pressed = true;
          AUDIO.play('tap');
        }
        if (this.buttons.settings && this.buttons.settings.contains(x, y)) {
          this.buttons.settings.pressed = true;
          AUDIO.play('tap');
        }
        break;

      case 'SETTINGS':
        for (const key of ['tglSound', 'tglMusic', 'tglVibration']) {
          if (this.buttons[key] && this.buttons[key].contains(x, y)) {
            this.buttons[key].pressed = true;
            AUDIO.play('tap');
          }
        }
        if (this.buttons.back && this.buttons.back.contains(x, y)) {
          this.buttons.back.pressed = true;
          AUDIO.play('tap');
        }
        break;

      case 'LEADERBOARD':
        if (this.buttons.back && this.buttons.back.contains(x, y)) {
          this.buttons.back.pressed = true;
          AUDIO.play('tap');
        }
        break;

      case 'LEVEL_SELECT':
        for (let i = 0; i < this.levels.length; i++) {
          const btn = this.buttons['level' + i];
          if (btn && btn.contains(x, y) && i < this.progress.unlockedLevels) {
            btn.pressed = true;
            AUDIO.play('tap');
          }
        }
        if (this.buttons.daily && this.buttons.daily.contains(x, y)) {
          this.buttons.daily.pressed = true;
          AUDIO.play('tap');
        }
        if (this.buttons.bonus && this.buttons.bonus.contains(x, y)) {
          this.buttons.bonus.pressed = true;
          AUDIO.play('tap');
        }
        if (this.buttons.back && this.buttons.back.contains(x, y)) {
          this.buttons.back.pressed = true;
          AUDIO.play('tap');
        }
        break;

      case 'READY':
        if (this.currentBird) {
          const d = U.distance(x, y, this.currentBird.x, this.currentBird.y);
          if (d < 60) {
            this.state = 'AIMING';
            this.dragStart = { x, y };
            this.hintAlpha = 0;
          }
        }
        break;

      case 'AIMING':
        // 已经在瞄准中，保持状态
        break;

      case 'FLYING':
        // 空中点击：释放当前小鸟技能（每次飞行限一次）
        this.tryActivateAbility();
        break;

      case 'WIN':
        // 结算动画播放中：首次点击仅跳过动画，不触发任何按钮（防误触）
        if (this.winAnim && this.winAnim.phase !== 'done') {
          this.skipWinAnim();
          break;
        }
        if (this.buttons.next && this.buttons.next.contains(x, y)) {
          this.buttons.next.pressed = true;
          AUDIO.play('tap');
        }
        if (this.buttons.retry && this.buttons.retry.contains(x, y)) {
          this.buttons.retry.pressed = true;
          AUDIO.play('tap');
        }
        if (this.buttons.menu && this.buttons.menu.contains(x, y)) {
          this.buttons.menu.pressed = true;
          AUDIO.play('tap');
        }
        if (this.buttons.share && this.buttons.share.contains(x, y)) {
          this.buttons.share.pressed = true;
          AUDIO.play('tap');
        }
        if (this.buttons.double && this.buttons.double.contains(x, y)) {
          this.buttons.double.pressed = true;
          AUDIO.play('tap');
        }
        break;

      case 'LOSE':
        if (this.buttons.retry && this.buttons.retry.contains(x, y)) {
          this.buttons.retry.pressed = true;
          AUDIO.play('tap');
        }
        if (this.buttons.menu && this.buttons.menu.contains(x, y)) {
          this.buttons.menu.pressed = true;
          AUDIO.play('tap');
        }
        if (this.buttons.revive && this.buttons.revive.contains(x, y)) {
          this.buttons.revive.pressed = true;
          AUDIO.play('tap');
        }
        if (this.buttons.boost && this.buttons.boost.contains(x, y)) {
          this.buttons.boost.pressed = true;
          AUDIO.play('tap');
        }
        break;
    }
  }

  onTouchMove(x, y) {
    if (this.state === 'AIMING' && this.currentBird) {
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

      this.currentBird.x = C.SLINGSHOT_X + dx;
      this.currentBird.y = (C.SLINGSHOT_Y - 15) + dy;
    }
  }

  onTouchEnd() {
    switch (this.state) {
      case 'MENU':
        if (this.buttons.play && this.buttons.play.pressed) {
          this.buttons.play.pressed = false;
          this.goToLevelSelect();
        }
        if (this.buttons.leaderboard && this.buttons.leaderboard.pressed) {
          this.buttons.leaderboard.pressed = false;
          this.goToLeaderboard();
        }
        if (this.buttons.settings && this.buttons.settings.pressed) {
          this.buttons.settings.pressed = false;
          this.goToSettings();
        }
        break;

      case 'SETTINGS':
        if (this.buttons.tglSound && this.buttons.tglSound.pressed) {
          this.buttons.tglSound.pressed = false;
          this.toggleSetting('sound');
        }
        if (this.buttons.tglMusic && this.buttons.tglMusic.pressed) {
          this.buttons.tglMusic.pressed = false;
          this.toggleSetting('music');
        }
        if (this.buttons.tglVibration && this.buttons.tglVibration.pressed) {
          this.buttons.tglVibration.pressed = false;
          this.toggleSetting('vibration');
        }
        if (this.buttons.back && this.buttons.back.pressed) {
          this.buttons.back.pressed = false;
          this.goToMenu();
        }
        break;

      case 'LEADERBOARD':
        if (this.buttons.back && this.buttons.back.pressed) {
          this.buttons.back.pressed = false;
          this.goToMenu();
        }
        break;

      case 'LEVEL_SELECT':
        if (this.buttons.daily && this.buttons.daily.pressed) {
          this.buttons.daily.pressed = false;
          this.startDaily();
          return;
        }
        if (this.buttons.bonus && this.buttons.bonus.pressed) {
          this.buttons.bonus.pressed = false;
          this.startNextBonus();
          return;
        }
        for (let i = 0; i < this.levels.length; i++) {
          const btn = this.buttons['level' + i];
          if (btn && btn.pressed && i < this.progress.unlockedLevels) {
            btn.pressed = false;
            this.startLevel(i);
            return;
          }
        }
        if (this.buttons.back && this.buttons.back.pressed) {
          this.buttons.back.pressed = false;
          this.goToMenu();
        }
        break;

      case 'AIMING':
        if (this.currentBird) {
          const dx = C.SLINGSHOT_X - this.currentBird.x;
          const dy = (C.SLINGSHOT_Y - 15) - this.currentBird.y;
          const dragDist = Math.sqrt(dx * dx + dy * dy);

          if (dragDist > C.MIN_DRAG) {
            // 发射！
            const vx = dx * C.POWER_FACTOR;
            const vy = dy * C.POWER_FACTOR;
            this.currentBird.launch(vx, vy);
            this.birdsRemaining--;
            this.state = 'FLYING';
            this.lastTrail = []; // 开始记录本发完整弹道（上一发残影被替换）
            this.createLaunchParticles(this.currentBird.x, this.currentBird.y);
            this.combo = 0;
            AUDIO.play('launch');
            this.vibrate('light');
          } else {
            // 拖拽距离不够，回到弹弓
            this.currentBird.x = C.SLINGSHOT_X;
            this.currentBird.y = C.SLINGSHOT_Y - 15;
            this.state = 'READY';
          }
        }
        break;

      case 'WIN':
        if (this.buttons.next && this.buttons.next.pressed) {
          this.buttons.next.pressed = false;
          this.nextLevel();
        }
        if (this.buttons.retry && this.buttons.retry.pressed) {
          this.buttons.retry.pressed = false;
          this.retryLevel();
        }
        if (this.buttons.menu && this.buttons.menu.pressed) {
          this.buttons.menu.pressed = false;
          this.goToMenu();
        }
        if (this.buttons.share && this.buttons.share.pressed) {
          this.buttons.share.pressed = false;
          SOCIAL.shareResult(this.isDaily ? -1 : this.currentLevelIndex, this.stars);
        }
        if (this.buttons.double && this.buttons.double.pressed) {
          this.buttons.double.pressed = false;
          this.watchAdDoubleScore();
        }
        break;

      case 'LOSE':
        if (this.buttons.retry && this.buttons.retry.pressed) {
          this.buttons.retry.pressed = false;
          this.retryLevel();
        }
        if (this.buttons.menu && this.buttons.menu.pressed) {
          this.buttons.menu.pressed = false;
          this.goToMenu();
        }
        if (this.buttons.revive && this.buttons.revive.pressed) {
          this.buttons.revive.pressed = false;
          this.watchAdRevive();
        }
        if (this.buttons.boost && this.buttons.boost.pressed) {
          this.buttons.boost.pressed = false;
          this.watchAdTrajectoryBoost();
        }
        break;
    }

    // 重置所有按钮状态
    for (const key in this.buttons) {
      if (this.buttons[key]) this.buttons[key].pressed = false;
    }
  }

  /** 空中点击释放当前小鸟技能 */
  tryActivateAbility() {
    const bird = this.currentBird;
    if (!bird || !bird.canUseAbility()) return;
    const result = bird.activateAbility();
    if (!result) return;

    if (result.ability === 'dash') {
      this.createLaunchParticles(bird.x, bird.y); // 冲刺尾焰
      AUDIO.play('launch');
      this.vibrate('light');
      this.addFloatingText(bird.x, bird.y - 25, '冲刺！', C.COLORS.white, 16);
    } else if (result.ability === 'split') {
      for (const b of result.extraBirds) this.extraBirds.push(b);
      AUDIO.play('tap');
      this.addFloatingText(bird.x, bird.y - 25, '分身！', C.COLORS.white, 16);
    } else if (result.ability === 'bomb') {
      this.explode(bird.x, bird.y);
      // 爆炸后小鸟消散
      this.currentBird = null;
    }
  }

  /**
   * 岩轰爆炸：范围伤害 + 击退 + 特效。
   * 冲击力随距离衰减，同时作用猪与方块。
   */
  explode(x, y) {
    const R = C.BOMB_RADIUS;
    this.screenShake(8);
    AUDIO.play('boom');
    this.vibrate('heavy');

    // 爆炸粒子（火心 + 浓烟双层，原创橙棕配色）
    for (let i = 0; i < 16; i++) {
      const angle = U.random(0, Math.PI * 2);
      const speed = U.random(3, 9);
      this.spawnParticle(
        x, y,
        Math.cos(angle) * speed, Math.sin(angle) * speed - 1,
        i % 2 === 0 ? '#FF9F43' : '#FF5252',
        U.randomInt(20, 35), U.random(5, 10)
      );
    }
    for (let i = 0; i < 10; i++) {
      const angle = U.random(0, Math.PI * 2);
      const speed = U.random(1, 4);
      this.spawnParticle(
        x, y,
        Math.cos(angle) * speed, Math.sin(angle) * speed - 2,
        '#8D6E63',
        U.randomInt(30, 50), U.random(6, 12)
      );
    }

    // 猪：范围伤害 + 向外击退
    for (const pig of this.pigs) {
      if (!pig.alive || pig.dying) continue;
      const d = U.distance(x, y, pig.x, pig.y);
      if (d > R + pig.radius) continue;
      const force = C.BOMB_FORCE * (1 - d / (R + pig.radius)) + 4;
      const killed = pig.takeDamage(force);
      const nx = (pig.x - x) / (d || 1);
      const ny = (pig.y - y) / (d || 1);
      pig.knockback(nx * force * 0.6, ny * force * 0.6 - 2);
      if (killed) {
        this.onPigKilled(pig);
      }
    }

    // 方块：范围伤害 + 向外击退（激活为动态）
    for (const block of this.blocks) {
      if (!block.alive) continue;
      const bx = block.x + block.width / 2;
      const by = block.y + block.height / 2;
      const d = U.distance(x, y, bx, by);
      const reach = R + Math.max(block.width, block.height) / 2;
      if (d > reach) continue;
      const force = C.BOMB_FORCE * (1 - d / reach) + 3;
      // 爆炸对石头有克制加成（岩轰 damageVs.stone = 2）
      const mult = (C.BIRD_TYPES.bomb.damageVs[block.type]) || 1;
      const destroyed = block.takeDamage(force * mult);
      const nx = (bx - x) / (d || 1);
      const ny = (by - y) / (d || 1);
      block.knockback(nx * force * 0.5, ny * force * 0.5 - 1.5, bx + nx * 5, by + ny * 5);
      if (destroyed) this.onBlockDestroyed(block);
    }
  }

  /** 猪被消灭的统一结算（分数/连击/特效/音效） */
  onPigKilled(pig) {
    this.combo++;
    this.comboTimer = 120;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    // 连击数值化：第 N 连击得分 = 1000 × N
    const points = 1000 * this.combo;
    this.score += points;
    this.createPigParticles(pig.x, pig.y);
    this.addFloatingText(pig.x, pig.y - 30, '+' + points, C.COLORS.particlePurple, 22);
    if (this.combo > 1) {
      this.addFloatingText(pig.x, pig.y - 55, 'COMBO x' + this.combo + '!', C.COLORS.starGold, 18);
    }
    this.screenShake(4);
    AUDIO.play('pop');
    this.vibrate('medium');
  }

  /** 飞行小鸟触碰场景珍珠 → 拾取入库 */
  checkPearlCollection(bird) {
    if (!bird) return;
    for (const pearl of this.pearls) {
      if (pearl.collected) continue;
      if (U.distance(bird.x, bird.y, pearl.x, pearl.y) < bird.radius + 9) {
        this.collectPearl(pearl);
      }
    }
  }

  /** 珍珠拾取结算（入库存档 + 珠光粒子 + 飘字提示） */
  collectPearl(pearl) {
    pearl.collected = true;
    this.progress.pearls = { ...this.progress.pearls, [pearl.id]: true };
    this.saveProgress();
    this.addFloatingText(pearl.x, pearl.y - 22, '发现珍珠！', '#E1F5FE', 18);
    for (let i = 0; i < 10; i++) {
      const angle = U.random(0, Math.PI * 2);
      const speed = U.random(1, 3.5);
      this.spawnParticle(
        pearl.x, pearl.y,
        Math.cos(angle) * speed, Math.sin(angle) * speed - 1,
        i % 2 === 0 ? '#E1F5FE' : '#F8BBD0',
        U.randomInt(20, 35), U.random(2, 4)
      );
    }
    AUDIO.play('ding');
    this.vibrate('light');
  }

  /** 方块被摧毁的统一结算（分数/特效/音效） */
  onBlockDestroyed(block) {
    this.score += 500;
    this.createBlockParticles(block.x + block.width / 2, block.y + block.height / 2, block.type);
    this.addFloatingText(block.x + block.width / 2, block.y, '+500', block.props.color, 18);
    this.screenShake(3);
    AUDIO.play('break');
    // 爆裂果被摧毁 → 链式爆炸（入队，下一逻辑步处理，避免爆炸递归过深）
    if (block.type === 'burst') {
      this.pendingExplosions.push({
        x: block.x + block.width / 2,
        y: block.y + block.height / 2,
      });
    }
  }

  // ==================== 更新 ====================

  update() {
    this.frameCount++;
    this.pulseTimer++;
    if (this.hitSoundCooldown > 0) this.hitSoundCooldown--;

    // 处理爆裂果链式爆炸队列
    if (this.pendingExplosions.length > 0) {
      const queue = this.pendingExplosions.splice(0);
      for (const e of queue) this.explode(e.x, e.y);
    }

    // 更新云朵
    for (const cloud of this.clouds) cloud.update();

    // 更新粒子（死亡个体回收进对象池，避免每帧 filter 重建数组）
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.update();
      if (p.isDead()) {
        this.particles.splice(i, 1);
        if (this.particlePool.length < 300) this.particlePool.push(p);
      }
    }

    // 更新飘字（同样池化回收）
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const t = this.floatingTexts[i];
      t.update();
      if (t.isDead()) {
        this.floatingTexts.splice(i, 1);
        if (this.textPool.length < 50) this.textPool.push(t);
      }
    }

    // 屏幕震动衰减
    this.shakeAmount *= 0.9;
    if (this.shakeAmount < 0.1) this.shakeAmount = 0;

    // 提示淡出
    if (this.hintAlpha > 0 && this.state !== 'READY') {
      this.hintAlpha *= 0.95;
    }

    // Combo 计时器
    if (this.comboTimer > 0) {
      this.comboTimer--;
      if (this.comboTimer === 0) this.combo = 0;
    }

    // 胜利结算仪式感动画推进
    this.updateWinAnim();

    // 按钮动画
    for (const key in this.buttons) {
      if (this.buttons[key]) this.buttons[key].update();
    }

    // 状态相关更新
    switch (this.state) {
      case 'READY':
        break;
      case 'AIMING':
        break;
      case 'FLYING':
        this.updateFlying();
        break;
      case 'SETTLING':
        this.updateSettling();
        break;
    }

    // 更新所有方块和猪（即使非飞行状态也要更新动态对象）
    for (const block of this.blocks) {
      if (block.alive) block.update();
    }
    for (const pig of this.pigs) {
      if (pig.alive) pig.update();
    }

    // 清理死亡对象
    this.pigs = this.pigs.filter(p => !(p.isDead && p.isDead()));
    this.blocks = this.blocks.filter(b => b.alive);
  }

  updateFlying() {
    // 记录本发完整弹道（ghost trail；仅记主鸟——分裂鸟路径近似，够用于瞄准修正）
    if (this.currentBird && Array.isArray(this.lastTrail)) {
      this.lastTrail.push({ x: this.currentBird.x, y: this.currentBird.y });
    }
    // 飞行途中触碰场景珍珠 → 拾取
    this.checkPearlCollection(this.currentBird);

    // 更新主鸟（可能因爆炸已被移除）
    if (this.currentBird) {
      this.currentBird.update();
      const exploded = PHYSICS.checkBirdCollisions(this, this.currentBird);
      if (exploded) {
        this.currentBird = null;
      } else {
        const speed = Math.sqrt(this.currentBird.vx ** 2 + this.currentBird.vy ** 2);
        if (this.currentBird.isStill() || this.currentBird.isOffScreen() ||
            (speed < C.REST_THRESHOLD && this.currentBird.stillFrames > 30)) {
          this.currentBird = null;
        }
      }
    }

    // 更新分裂出的额外小鸟
    for (let i = this.extraBirds.length - 1; i >= 0; i--) {
      const b = this.extraBirds[i];
      b.update();
      this.checkPearlCollection(b);
      const exploded = PHYSICS.checkBirdCollisions(this, b);
      const speed = Math.sqrt(b.vx ** 2 + b.vy ** 2);
      if (exploded || b.isStill() || b.isOffScreen() ||
          (speed < C.REST_THRESHOLD && b.stillFrames > 30)) {
        this.extraBirds.splice(i, 1);
      }
    }

    // 全部飞行小鸟消失后进入结算
    if (!this.currentBird && this.extraBirds.length === 0) {
      this.state = 'SETTLING';
      this.settleTimer = 0;
    }
  }

  updateSettling() {
    this.settleTimer++;

    // 检查动态对象碰撞
    PHYSICS.checkDynamicCollisions(this);

    // 等待所有对象静止
    if (this.settleTimer > 40 && this.isSettled()) {
      this.checkWinLose();
    }
  }

  isSettled() {
    for (const block of this.blocks) {
      if (block.alive && block.dynamic) return false;
    }
    for (const pig of this.pigs) {
      if (pig.alive && !pig.dying && pig.dynamic) return false;
    }
    return true;
  }

  // 结算与激励视频实现在 settle.js（此处为薄委托，保持对外方法签名不变）
  computeStars() { SETTLE.computeStars(this); }
  saveWinProgress() { SETTLE.saveWinProgress(this); }
  watchAdRevive() { SETTLE.watchAdRevive(this); }
  watchAdDoubleScore() { SETTLE.watchAdDoubleScore(this); }
  watchAdTrajectoryBoost() { SETTLE.watchAdTrajectoryBoost(this); }
  updateWinAnim() { SETTLE.updateWinAnim(this); }
  skipWinAnim() { SETTLE.skipWinAnim(this); }
  checkWinLose() { SETTLE.checkWinLose(this); }

  // ==================== 粒子系统 ====================

  createPigParticles(x, y) {
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12 + U.random(-0.3, 0.3);
      const speed = U.random(2, 6);
      this.spawnParticle(
        x, y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed - 2,
        C.COLORS.pigBody,
        U.randomInt(25, 45),
        U.random(4, 8)
      );
    }
    // 添加一些深色粒子
    for (let i = 0; i < 6; i++) {
      const angle = U.random(0, Math.PI * 2);
      const speed = U.random(1, 4);
      this.spawnParticle(
        x, y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed - 1,
        C.COLORS.pigBodyDark,
        U.randomInt(20, 35),
        U.random(3, 6)
      );
    }
  }

  createBlockParticles(x, y, type) {
    const color = C.BLOCK_TYPES[type].color;
    const colorDark = C.BLOCK_TYPES[type].colorDark;
    const count = type === 'stone' ? 14 : 10;
    for (let i = 0; i < count; i++) {
      const angle = U.random(0, Math.PI * 2);
      const speed = U.random(1.5, 5);
      this.spawnParticle(
        x, y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed - 2,
        i % 2 === 0 ? color : colorDark,
        U.randomInt(25, 40),
        U.random(3, 7)
      );
    }
  }

  createImpactParticles(x, y, color) {
    for (let i = 0; i < 5; i++) {
      const angle = U.random(0, Math.PI * 2);
      const speed = U.random(1, 3);
      this.spawnParticle(
        x, y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed - 1,
        color || '#FFFFFF',
        U.randomInt(15, 25),
        U.random(2, 4)
      );
    }
  }

  createLaunchParticles(x, y) {
    for (let i = 0; i < 8; i++) {
      const angle = U.random(Math.PI * 0.7, Math.PI * 1.3);
      const speed = U.random(1, 4);
      this.spawnParticle(
        x, y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        C.COLORS.birdBody,
        U.randomInt(15, 25),
        U.random(2, 5)
      );
    }
  }

  /** 粒子发射（优先从对象池复用，池空才 new） */
  spawnParticle(x, y, vx, vy, color, life, size) {
    const p = this.particlePool.pop();
    if (p) {
      p.reset(x, y, vx, vy, color, life, size);
      this.particles.push(p);
    } else {
      this.particles.push(new E.Particle(x, y, vx, vy, color, life, size));
    }
  }

  addFloatingText(x, y, text, color, size) {
    const t = this.textPool.pop();
    if (t) {
      t.reset(x, y, text, color, size);
      this.floatingTexts.push(t);
    } else {
      this.floatingTexts.push(new E.FloatingText(x, y, text, color, size));
    }
  }

  screenShake(amount) {
    this.shakeAmount = Math.max(this.shakeAmount, amount);
  }

  // 带帧冷却的撞击音效，避免高速碰撞时每帧重复触发刷屏
  playHitSound() {
    if (this.hitSoundCooldown > 0) return;
    AUDIO.play('hit');
    this.hitSoundCooldown = 4;
  }

  // ==================== 弹道计算 ====================

  /**
   * 弹道预览模拟。maxSteps 控制预览长度：
   * 关卡越靠后预览越短（level.trajectory），把弹道估算还给玩家，形成技巧梯度。
   */
  calculateTrajectory(x, y, vx, vy, maxSteps = 70) {
    const points = [];
    let px = x, py = y;
    let pvx = vx, pvy = vy;
    for (let i = 0; i < maxSteps; i++) {
      pvy += C.GRAVITY;
      pvx *= C.AIR_FRICTION;
      px += pvx;
      py += pvy;
      if (i % 3 === 0) {
        points.push({ x: px, y: py, alpha: 1 - i / maxSteps });
      }
      if (py > C.GROUND_Y || px > C.SCREEN_WIDTH || px < 0) break;
    }
    return points;
  }

  // ==================== 渲染（编排；具体绘制在 renderer.js / screens.js） ====================

  render() {
    const ctx = this.ctx;

    // 屏幕震动偏移
    let shakeX = 0, shakeY = 0;
    if (this.shakeAmount > 0) {
      shakeX = U.random(-this.shakeAmount, this.shakeAmount);
      shakeY = U.random(-this.shakeAmount, this.shakeAmount);
    }

    ctx.save();
    ctx.translate(shakeX, shakeY);

    RENDERER.drawBackground(this);

    // 上一发弹道残影（垫在结构下层，作为瞄准参照）
    RENDERER.drawLastTrail(this);

    // 绘制等待中的小鸟
    RENDERER.drawWaitingBirds(this);

    // 弹弓后部
    RENDERER.drawSlingshotBack(this);

    // 方块
    for (const block of this.blocks) block.draw(ctx);

    // 猪
    for (const pig of this.pigs) pig.draw(ctx);

    // 场景珍珠（未拾取的）
    RENDERER.drawPearls(this);

    // 弹弓前部 + 橡皮筋
    RENDERER.drawSlingshotFront(this);

    // 当前小鸟 + 分裂出的额外小鸟
    if (this.currentBird) this.currentBird.draw(ctx);
    for (const b of this.extraBirds) b.draw(ctx);

    // 粒子
    for (const p of this.particles) p.draw(ctx);

    // 弹道预览
    if (this.state === 'AIMING' && this.currentBird) {
      RENDERER.drawTrajectory(this);
    }

    // 飘字
    for (const t of this.floatingTexts) t.draw(ctx);

    ctx.restore();

    // UI（不受震动影响）
    RENDERER.drawUI(this);

    // 状态覆盖层
    switch (this.state) {
      case 'MENU':
        SCREENS.drawMenu(this);
        break;
      case 'LEVEL_SELECT':
        SCREENS.drawLevelSelect(this);
        break;
      case 'LEADERBOARD':
        SCREENS.drawLeaderboard(this);
        break;
      case 'SETTINGS':
        SCREENS.drawSettings(this);
        break;
      case 'WIN':
        SCREENS.drawWinScreen(this);
        break;
      case 'LOSE':
        SCREENS.drawLoseScreen(this);
        break;
    }
  }

  // ==================== 游戏循环 ====================

  /**
   * 固定时间步长主循环（fixed timestep + accumulator）。
   * 逻辑以 60Hz 恒定步长推进，与设备刷新率解耦：
   *  - 90/120Hz 高刷设备上游戏不会变快（原先 rAF 直驱会 1.5~2 倍速）；
   *  - 低端机掉帧时最多每帧补 MAX_STEPS 步，避免"死亡螺旋"；
   *  - 所有按"帧"定义的物理常量（GRAVITY 等）语义不变，60Hz 下手感与原版一致。
   */
  gameLoop() {
    const STEP = 1000 / 60; // 逻辑步长（ms）
    const MAX_STEPS = 5;    // 每帧最多补偿的逻辑步数

    const now = Date.now();
    if (!this.lastFrameTime) this.lastFrameTime = now;
    let delta = now - this.lastFrameTime;
    this.lastFrameTime = now;

    // 切后台/长时间卡顿后回来，丢弃超出部分，避免一次性补算过多
    if (delta > 100) delta = 100;

    this.accumulator += delta;
    let steps = 0;
    while (this.accumulator >= STEP && steps < MAX_STEPS) {
      this.update();
      this.accumulator -= STEP;
      steps++;
    }
    // 设备持续跟不上 60Hz 时丢弃残余时间，保持实时（宁可慢动作，不可越落越后）
    if (steps === MAX_STEPS) this.accumulator = 0;

    this.render();
    requestAnimationFrame(() => this.gameLoop());
  }
}

// 启动游戏（导出实例便于自动化测试注入 mock 后检视内部状态）
const game = new Game();
module.exports = game;
