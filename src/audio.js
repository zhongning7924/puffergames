/**
 * 音效管理器 - 封装微信小游戏音频播放
 * Sound Manager - wraps wx.createInnerAudioContext for the mini-game.
 *
 * 设计（音效池）:
 *  - 每个音效维护一个有上限的实例池，播放时轮用池内实例（stop + play 重置），
 *    避免原先"每次播放新建 context、播完销毁"在高频碰撞时的创建/销毁开销，
 *    以及 iOS 上 InnerAudioContext 实例过多的隐性风险。
 *  - 池实例按需懒创建（首次播放时才 new），池上限按音效频率分级：
 *    高频音（撞击）3 个，中频（发射/消灭/碎裂）2 个，低频（胜负/点击）1 个。
 *  - 对浏览器预览 mock 或未就绪环境安全降级 (全部 no-op，不报错)。
 *  - 仅在真正的小游戏运行环境才会出声；DevTools 模拟器与真机均可播放。
 */

// 音效文件名映射 (相对包根目录的路径，供 wx.createInnerAudioContext 使用)
const SOUND_FILES = {
  launch: 'sounds/launch.wav', // 弹弓发射
  hit: 'sounds/hit.wav',       // 撞击
  pop: 'sounds/pop.wav',       // 章鱼被消灭
  break: 'sounds/break.wav',   // 方块碎裂
  win: 'sounds/win.wav',       // 胜利
  lose: 'sounds/lose.wav',     // 失败
  tap: 'sounds/tap.wav',       // UI 点击
  boom: 'sounds/boom.wav',     // 岩轰爆炸
  ding: 'sounds/ding.wav',     // 结算星星弹出
};

// 循环 BGM（独立通道播放，不进音效池；由 tools/gen-sounds.js 程序化生成）
const BGM_FILE = 'sounds/bgm.wav';

// 各音效的池上限：高频音效需要更多实例支持重叠播放
const POOL_SIZES = {
  launch: 2,
  hit: 3,
  pop: 2,
  break: 2,
  win: 1,
  lose: 1,
  tap: 1,
  boom: 2,
  ding: 2,
};

class SoundManager {
  constructor() {
    this.enabled = true;     // 是否允许播放
    this.ready = false;      // 运行环境是否支持音频
    this.available = false;  // 微信音频 API 是否可用
    this.pools = {};         // name -> InnerAudioContext[]
    this.poolCursor = {};    // name -> 下次轮用的下标
    this.musicEnabled = true; // 音乐开关（独立于音效开关）
    this.bgmCtx = null;      // BGM 专用循环通道（懒创建）
    this.bgmStarted = false; // 是否已在用户手势中启动过 BGM
  }

  /**
   * 初始化。在游戏入口尽早调用一次。
   * 仅检测运行环境是否支持 wx.createInnerAudioContext，池实例懒创建。
   */
  init() {
    try {
      if (typeof wx !== 'undefined' && typeof wx.createInnerAudioContext === 'function') {
        this.available = true;
        this.ready = true;
        for (const name in SOUND_FILES) {
          this.pools[name] = [];
          this.poolCursor[name] = 0;
        }
      }
    } catch (e) {
      this.available = false;
      this.ready = false;
    }
  }

  /** 创建一个池实例（失败返回 null） */
  _createContext(src) {
    try {
      const ctx = wx.createInnerAudioContext();
      ctx.src = src;
      ctx.onError(() => {
        // 资源加载/解码失败时静默，避免刷屏
      });
      return ctx;
    } catch (e) {
      return null;
    }
  }

  /**
   * 播放指定音效。name 必须是 SOUND_FILES 的键。
   * 池未满时创建新实例；池满后轮用实例（stop 归零后 play）。
   */
  play(name) {
    if (!this.enabled || !this.ready || !this.available) return;
    const src = SOUND_FILES[name];
    if (!src) return;
    const pool = this.pools[name];
    const maxSize = POOL_SIZES[name] || 1;

    try {
      // 池未满：懒创建新实例
      if (pool.length < maxSize) {
        const ctx = this._createContext(src);
        if (!ctx) return;
        pool.push(ctx);
        ctx.play();
        return;
      }

      // 池已满：轮用下一个实例
      const idx = this.poolCursor[name] % pool.length;
      this.poolCursor[name] = idx + 1;
      const ctx = pool[idx];
      ctx.stop();  // stop 会归零播放位置，实现"从头重播"
      ctx.play();
    } catch (e) {
      // 单个音效失败不影响游戏
    }
  }

  setEnabled(v) {
    this.enabled = !!v;
    if (!this.enabled) this._stopAll();
  }

  /**
   * 启动循环 BGM。微信自动播放策略要求音频在用户手势中启动，
   * 因此在游戏 onTouchStart 顶部每次调用（幂等：只生效一次）。
   */
  startBGM() {
    if (!this.ready || !this.available || !this.musicEnabled || this.bgmStarted) return;
    try {
      if (!this.bgmCtx) {
        this.bgmCtx = this._createContext(BGM_FILE);
        if (!this.bgmCtx) return;
        this.bgmCtx.loop = true;
        this.bgmCtx.volume = 0.45; // BGM 垫在音效之下
      }
      this.bgmCtx.play();
      this.bgmStarted = true;
    } catch (e) {
      // BGM 启动失败不影响游戏
    }
  }

  /** 音乐开关：关闭即暂停，开启且已启动过则恢复播放 */
  setMusicEnabled(v) {
    this.musicEnabled = !!v;
    if (!this.bgmCtx) return;
    try {
      if (this.musicEnabled) {
        if (this.bgmStarted) this.bgmCtx.play();
      } else {
        this.bgmCtx.pause();
      }
    } catch (e) {}
  }

  /** 停止所有池内正在播放的音效（关闭声音时立即静音） */
  _stopAll() {
    if (!this.available) return;
    for (const name in this.pools) {
      for (const ctx of this.pools[name]) {
        try { ctx.stop(); } catch (e) {}
      }
    }
  }

  toggle() {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }
}

module.exports = new SoundManager();
