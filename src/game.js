/**
 * 主游戏控制器 - 状态机骨架、进度/设置存档、主循环与渲染编排
 * Main Game Controller - state machine skeleton, progress/settings, main loop, render orchestration.
 *
 * 模块边界（历次拆分均为纯搬移，Game 类保留同名薄委托方法）：
 *  - src/level-flow.js  关卡装载/生成与候飞队列（loadLevel/startDaily/startBonus/setupLevel）
 *  - src/settle.js      胜负判定、进度存档、结算动画、激励视频点位（checkWinLose/watchAd*）
 *  - src/combat.js      战斗事件：技能/爆炸/击杀/摧毁/珍珠拾取（explode/onPigKilled/...）
 *  - src/effects.js     粒子/飘字/震屏/撞击音效（对象池在 game 上）
 *  - src/input.js       触摸事件分发（onTouchStart/Move/End）
 *  - src/physics.js     碰撞检测与响应（checkBirdCollisions / checkDynamicCollisions）
 *  - src/renderer.js    世界内绘制（背景/弹弓/弹道/HUD）
 *  - src/screens.js     全屏界面（菜单/选关/排行榜/胜负结算）
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
const EFFECTS = require('./effects.js');
const COMBAT = require('./combat.js');
const INPUT = require('./input.js');
const PHYSICS = require('./physics.js');
const RENDERER = require('./renderer.js');
const SCREENS = require('./screens.js');
const HELP = require('./help.js');
const EDITOR = require('./editor.js');
const EDITOR_R = require('./editor-render.js');

/** 关卡内状态（含结算页）：用于判断"是否从关卡退出"，作为插屏广告的触发口径 */
const IN_LEVEL_STATES = ['READY', 'AIMING', 'FLYING', 'SETTLING', 'WIN', 'LOSE'];

class Game {
  constructor() {
    this.setupCanvas();
    this.initState();
    this.initBubbles();
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
        ? { title: `我在「愤怒河豚的弹弓」收集了 ${totalStars} 颗星，来挑战我吧！`, query: '' }
        : { title: '「愤怒河豚的弹弓」—— 一弹入魂的物理弹射小游戏', query: '' };
    });
    // 通过分享卡片进入 → 直达关卡：战役关(query.level，已解锁门控)/自制关(query.custom)
    // 分流逻辑在 editor.handleLaunchQuery（坏码留菜单 + launchError 提示）
    this.handleLaunchQuery();
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
    this.extraBirds = [];   // 分裂技能产生的额外飞行河豚
    this.pendingExplosions = []; // 爆裂果链式爆炸队列（下一逻辑步处理，避免递归）
    this.pigs = [];
    this.blocks = [];
    this.particles = [];
    this.floatingTexts = [];
    this.particlePool = [];  // 粒子对象池（死亡回收复用，避免 GC 卡顿）
    this.textPool = [];      // 飘字对象池
    this.shakeAmount = 0;
    this.slingSnap = 0;       // 发射后丝带回弹计时（帧）；发射钩子置 8，每帧递减
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

    // 造关师（自制关卡）状态
    this.isCustom = false;       // 当前是否在进行自制关（试玩/挑战）
    this.playOrigin = null;      // 'author'（编辑器试玩）| 'challenge'（卡片/输码/列表）
    this.customLevel = null;     // 自制关关卡数据
    this.customCode = null;      // 挑战流的关卡码（二次分享/成绩记录用）
    this.editor = null;          // 编辑器状态对象（草稿/物料栏/选中/拖动…）
    this.listView = null;        // 主菜单列表视图：'mine' | 'played' | null
    this.launchError = '';       // 启动直达坏码提示
    this.clipboardError = '';    // 输码挑战失败提示
    this.msgTimer = 0;           // 菜单错误提示剩余帧（逐帧递减）

    // 激励视频点位状态
    this.failCounts = {};        // 各关失败次数（卡关检测；每日挑战用 'daily' 键）
    this.reviveUsed = false;     // 本次关卡是否已用"+1 豚"复活
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

    // 选关页滚动（关卡增多后章节列表需要纵向滚动）
    this.levelSelectScroll = 0;      // 当前滚动偏移（像素，0 = 顶部）
    this.levelSelectMaxScroll = 0;   // 最大可滚动距离（绘制时更新）
    this.levelSelTouch = null;       // 滚动手势状态 { y, scroll, moved }
    // 进入选关页后置 true，持续自动滚到前沿关卡所属章节，玩家一触摸即交还控制权
    this.levelSelectAutoFocus = false;

    // 玩法说明页滚动状态（HELP 状态，复用选关页滚动范式）
    this.helpScroll = 0;
    this.helpMaxScroll = 0;
    this.helpTouch = null;
  }

  initBubbles() {
    this.bubbles = [];
    // 6 只：气泡体积比云朵小，数量太少会显得空、读不出"水下有气泡在冒"
    for (let i = 0; i < 6; i++) {
      this.bubbles.push(new E.Bubble(
        U.random(0, C.SCREEN_WIDTH),
        // 沿整个水柱分布（云朵只在上 35%，气泡应散布在视野各处）
        U.random(C.SCREEN_HEIGHT * 0.12, C.GROUND_Y),
        U.random(0.5, 1.3)
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
    if (this.progress.tutSwap === undefined) this.progress.tutSwap = false; // 已学会换豚
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
    // 排行榜关闭时不做任何用户数据外传（setUserCloudStorage 需隐私保护指引 + 后台支撑）
    if (!C.FEATURES.leaderboard) return;
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
    // 开关关闭时兜底回菜单：即便有人直接调该方法也不会进入已下线界面
    if (!C.FEATURES.leaderboard) {
      this.goToMenu();
      return;
    }
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

  /** 当前进行中的关卡数据（自制关/每日挑战/珍珠关时为对应关卡） */
  getCurrentLevel() {
    if (this.isCustom) return this.customLevel;
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
  swapBird(i) { LEVELFLOW.swapBird(this, i); }

  // 造关师（editor.js 薄委托；逻辑隔离在编辑器模块）
  enterEditor() { EDITOR.enterEditor(this); }
  editorExit() { EDITOR.editorExit(this); }
  playCustom(level, origin, code) { EDITOR.playCustom(this, level, origin, code); }
  backToEditor() { EDITOR.backToEditor(this); }
  /** 打开造关师子页；挑战记录关闭时不允许切到 played（回到中心页） */
  openLevelList(kind) {
    if (kind === 'played' && !C.FEATURES.ugcChallengeLog) kind = 'ugcHome';
    this.listView = kind;
  }
  handleLaunchQuery() { EDITOR.handleLaunchQuery(this); }

  // ==================== 状态转换 ====================

  goToMenu() {
    const fromLevel = IN_LEVEL_STATES.indexOf(this.state) >= 0;
    // 挑战流返回菜单：清自制关上下文（作者流走 backToEditor 不经此）
    if (this.isCustom) { this.isCustom = false; this.playOrigin = null; this.customLevel = null; }
    this.state = 'MENU';
    this.buttons = {};
    // 退出关卡（含结算页点「菜单」）→ 插屏广告埋点，内部有频控；
    // 自制关挑战返回不打广告（UGC 心流，且广告点位本就按战役关设计）
    if (fromLevel && !this.isCustom) AD.onLevelExit();
  }

  goToLevelSelect() {
    const fromLevel = IN_LEVEL_STATES.indexOf(this.state) >= 0;
    this.state = 'LEVEL_SELECT';
    this.buttons = {};
    this.levelSelectScroll = 0;
    this.levelSelTouch = null;
    // 自动滚到「前沿关卡」所属章节（40 关跨度大，避免每次都从第一章翻起）
    this.levelSelectAutoFocus = true;
    // 退出关卡回到选关页 → 插屏广告埋点，内部有频控
    // 注意：WIN 状态点「下一关」走 loadLevel，不经过这里，连闯心流不被打断
    if (fromLevel && !this.isCustom) AD.onLevelExit();
  }

  goToSettings() {
    this.state = 'SETTINGS';
    this.buttons = {};
  }

  goToHelp() {
    this.state = 'HELP';
    this.buttons = {};
    this.helpScroll = 0;
    this.helpMaxScroll = 0;
    this.helpTouch = null;
  }

  startLevel(index) {
    if (index < this.progress.unlockedLevels) {
      this.loadLevel(index);
    }
  }

  nextLevel() {
    if (this.isCustom) {
      // 自制关无"下一关"：作者流回编辑器，挑战流回菜单
      if (this.playOrigin === 'author') this.backToEditor();
      else this.goToMenu();
      return;
    }
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
    if (this.isCustom) {
      // 自制关重打：同一份关卡数据重新装载（作者流草稿不变，挑战流码不变）
      LEVELFLOW.setupLevel(this, this.customLevel);
      this.state = 'READY';
      return;
    }
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

  // 输入分发实现在 input.js（此处为薄委托，setupInput 注册的 wx 回调走这里）
  onTouchStart(x, y) { INPUT.onTouchStart(this, x, y); }
  onTouchMove(x, y) { INPUT.onTouchMove(this, x, y); }
  onTouchEnd() { INPUT.onTouchEnd(this); }

  // 战斗事件（技能/爆炸/击杀/摧毁/珍珠拾取）实现在 combat.js（薄委托）
  tryActivateAbility() { COMBAT.tryActivateAbility(this); }
  explode(x, y) { COMBAT.explode(this, x, y); }
  onPigKilled(pig) { COMBAT.onPigKilled(this, pig); }
  onPigHurt(pig) { COMBAT.onPigHurt(this, pig); }
  checkPearlCollection(bird) { COMBAT.checkPearlCollection(this, bird); }
  collectPearl(pearl) { COMBAT.collectPearl(this, pearl); }
  onBlockDestroyed(block) { COMBAT.onBlockDestroyed(this, block); }

  // ==================== 更新 ====================

  update() {
    this.frameCount++;
    this.pulseTimer++;
    if (this.hitSoundCooldown > 0) this.hitSoundCooldown--;
    if (this.slingSnap > 0) this.slingSnap--;
    if (this.msgTimer > 0) this.msgTimer--;

    // 处理爆裂果链式爆炸队列
    if (this.pendingExplosions.length > 0) {
      const queue = this.pendingExplosions.splice(0);
      for (const e of queue) this.explode(e.x, e.y);
    }

    // 更新气泡
    for (const bubble of this.bubbles) bubble.update();

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
      case 'EDITOR':
        EDITOR.update(this);
        break;
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

    // 更新所有方块和章鱼（即使非飞行状态也要更新动态对象）
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
    // 记录本发完整弹道（ghost trail；仅记主豚——分裂豚路径近似，够用于瞄准修正）
    if (this.currentBird && Array.isArray(this.lastTrail)) {
      this.lastTrail.push({ x: this.currentBird.x, y: this.currentBird.y });
    }
    // 飞行途中触碰场景珍珠 → 拾取
    this.checkPearlCollection(this.currentBird);

    // 更新主豚（可能因爆炸已被移除）
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

    // 更新分裂出的额外河豚
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

    // 全部飞行河豚消失后进入结算
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

  // ==================== 特效（实现在 effects.js，此处为薄委托） ====================

  createPigParticles(x, y) { EFFECTS.createPigParticles(this, x, y); }
  createBlockParticles(x, y, type) { EFFECTS.createBlockParticles(this, x, y, type); }
  createImpactParticles(x, y, color) { EFFECTS.createImpactParticles(this, x, y, color); }
  createLaunchParticles(x, y) { EFFECTS.createLaunchParticles(this, x, y); }
  spawnParticle(x, y, vx, vy, color, life, size, shape) { EFFECTS.spawnParticle(this, x, y, vx, vy, color, life, size, shape); }
  addFloatingText(x, y, text, color, size) { EFFECTS.addFloatingText(this, x, y, text, color, size); }
  screenShake(amount) { EFFECTS.screenShake(this, amount); }
  playHitSound() { EFFECTS.playHitSound(this); }

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

    // 绘制等待中的河豚
    RENDERER.drawWaitingBirds(this);

    // 弹弓后部
    RENDERER.drawSlingshotBack(this);

    // 方块
    for (const block of this.blocks) block.draw(ctx);

    // 章鱼
    for (const pig of this.pigs) pig.draw(ctx);

    // 场景珍珠（未拾取的）
    RENDERER.drawPearls(this);

    // 弹弓前部 + 橡皮筋
    RENDERER.drawSlingshotFront(this);

    // 当前河豚 + 分裂出的额外河豚
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
      case 'EDITOR':
        EDITOR_R.drawEditor(this);
        break;
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
      case 'HELP':
        HELP.drawHelp(this);
        break;
      case 'WIN':
        SCREENS.drawWinScreen(this);
        break;
      case 'LOSE':
        SCREENS.drawLoseScreen(this);
        break;
    }

    // Banner 显隐同步（内部按状态去重；仅选关页常驻，其余页面自动隐藏）
    AD.syncBanner(this.state);
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
