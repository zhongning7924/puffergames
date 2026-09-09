/**
 * 游戏全局配置 - 屏幕尺寸、物理常量、颜色、尺寸等
 * Game Configuration - Screen dimensions, physics constants, colors, sizes
 */

// 屏幕参数 Screen parameters
// 先给安全默认值，避免模块加载时 jsbridge 未就绪就调用 wx API 报错。
// 真实值由 init() 在游戏入口中调用后写入。
let systemInfo = { screenWidth: 375, screenHeight: 667, devicePixelRatio: 2, safeTop: 0 };
let SCREEN_WIDTH = systemInfo.screenWidth;
let SCREEN_HEIGHT = systemInfo.screenHeight;
let DPR = systemInfo.devicePixelRatio || 1;
// 顶部安全区（灵动岛/刘海高度）：HUD 内容需整体下移该值，否则真机上被遮挡
let SAFE_TOP = 0;

/**
 * 功能开关 Feature flags
 *
 * leaderboard（好友排行榜）默认关闭：
 *  - 好友榜依赖「开放数据域 + 微信关系链（getFriendCloudStorage）」，需要在小程序后台
 *    填写「用户隐私保护指引」声明采集好友/用户数据，本项目尚未配置用户信息管理；
 *  - 成绩上传依赖 wx.setUserCloudStorage（托管 KV），属于用户数据外传，同理需后台与合规支撑；
 *  - 因此入口、状态页、成绩上传三处全部关闭，代码保留以便日后补齐合规后一键开启。
 *
 * 重新开启的完整步骤（缺一不可）：
 *  1. 把这里改成 true；
 *  2. game.json 恢复 "openDataContext": "opendata"；
 *  3. project.config.json 的 packOptions.ignore 移除 opendata 条目（否则开放数据域不进包）；
 *  4. 小程序后台「设置 → 用户隐私保护指引」勾选关系链/好友数据相关条目并通过审核。
 */
const FEATURES = {
  leaderboard: false,
};

// 物理常量 Physics constants
const GRAVITY = 0.45;           // 重力加速度
const AIR_FRICTION = 0.999;     // 空气阻力
const GROUND_BOUNCE = 0.35;     // 地面弹力
const WALL_BOUNCE = 0.4;        // 墙壁弹力
const REST_THRESHOLD = 0.8;     // 静止阈值

// 地面 Ground
const GROUND_HEIGHT = 90;
let GROUND_Y = SCREEN_HEIGHT - GROUND_HEIGHT;

// 弹弓 Slingshot
const SLINGSHOT_X = 95;
let SLINGSHOT_Y = GROUND_Y - 110;
const SLINGSHOT_HEIGHT = 110;

/**
 * 读取屏幕参数。
 * 优先使用新版 wx.getWindowInfo()（不读取 deviceOrientation，避免引擎内部 getter 抛错）；
 * 旧版基础库无此 API 时回退到 wx.getSystemInfoSync()，最后才用安全默认值。
 */
function getScreenInfo() {
  try {
    if (typeof wx.getWindowInfo === 'function') {
      const w = wx.getWindowInfo();
      return {
        screenWidth: w.screenWidth || w.windowWidth || 375,
        screenHeight: w.screenHeight || w.windowHeight || 667,
        devicePixelRatio: w.pixelRatio || w.devicePixelRatio || 2,
        safeTop: (w.safeArea && w.safeArea.top) || w.statusBarHeight || 0,
      };
    }
  } catch (e) {
    console.warn('[config] wx.getWindowInfo failed, fallback:', e && e.message);
  }
  try {
    if (typeof wx.getSystemInfoSync === 'function') {
      const s = wx.getSystemInfoSync();
      return {
        screenWidth: s.screenWidth || s.windowWidth || 375,
        screenHeight: s.screenHeight || s.windowHeight || 667,
        devicePixelRatio: s.devicePixelRatio || 2,
        safeTop: (s.safeArea && s.safeArea.top) || s.statusBarHeight || 0,
      };
    }
  } catch (e) {
    console.warn('[config] wx.getSystemInfoSync failed, using defaults:', e && e.message);
  }
  return { screenWidth: 375, screenHeight: 667, devicePixelRatio: 2, safeTop: 0 };
}

/**
 * 初始化屏幕参数。
 * 必须在 game.js 入口中尽早调用，确保读取系统信息时 jsbridge 已 ready。
 */
function init() {
  systemInfo = getScreenInfo();
  SCREEN_WIDTH = systemInfo.screenWidth;
  SCREEN_HEIGHT = systemInfo.screenHeight;
  DPR = systemInfo.devicePixelRatio;
  SAFE_TOP = systemInfo.safeTop || 0;
  GROUND_Y = SCREEN_HEIGHT - GROUND_HEIGHT;
  SLINGSHOT_Y = GROUND_Y - 110;
}
const MAX_DRAG = 95;            // 最大拖拽距离
const POWER_FACTOR = 0.19;      // 力度系数
const MIN_DRAG = 10;            // 最小有效拖拽

// 河豚 Bird
const BIRD_RADIUS = 17;

// 颜色定义 Colors
// ── 马卡龙海底主题（2026-09 可爱化改造）──────────────────────
// 🎨 主题口味调色区：以下色值即整体「可爱度」的核心，可自由微调——
//    想更粉 → 各色往红相偏、明度提高；想更奶 → 降低饱和。
//    约束：pigBodyDark 不可与 pigSnoutDark(#AB47BC) 同值（吸盘尖会糊）。
const COLORS = {
  // 水体 Water（马卡龙婴儿蓝，仍保留「上浅下深」的水下透光逻辑）
  waterTop: '#C8EDF8',            // 近水面：透亮奶蓝
  waterMid: '#8FD4EF',
  waterDeep: '#5FB4E0',           // 近海床：柔蓝（不再压暗画面）
  reef: 'rgba(95, 180, 224, 0.45)',  // 远景礁石剪影

  // 海床 Seabed（奶杏色沙；与河豚黄 #FFD54F 保持明度差，不撞主体）
  sand: '#FFF1E0',                // 浅沙：奶杏
  sandDark: '#F3D9BE',            // 沙脊线 / 沙纹
  rock: '#B8C4D6',                // 岩石层：雾霾蓝灰

  // 弹弓 Slingshot（粉珊瑚枝 + 草莓粉丝带）
  slingWood: '#F48FB1',           // 珊瑚粉（后叉/主干，深）
  slingWoodLight: '#F8BBD0',      // 浅珊瑚粉（前叉/枝顶凸点）
  slingBand: '#F06292',           // 海丝带粉底（白条纹靠绘制叠虚线）

  // 弹射者（原创海洋题材：河豚族，圆身+背刺+嘟嘴）
  birdBody: '#FFD54F',
  birdBodyDark: '#F9A825',
  birdBelly: '#FFF8E1',
  birdBeak: '#FF7043',     // 嘟嘴（键名保留，形象已改为鱼嘴）
  birdBeakDark: '#E64A19',

  // 敌人（原创海洋题材：章鱼怪，薰衣草紫——凶萌不吓人）
  pigBody: '#CE93D8',
  pigBodyDark: '#A569BD',   // 柔和深紫（⚠️ 不可用 #AB47BC，那是吸盘尖 pigSnoutDark 的色，撞色会糊）
  pigSnout: '#F3E5F5',     // 吸盘/触手尖（键名保留，形象已改为章鱼）
  pigSnoutDark: '#AB47BC',

  // 方块 Blocks（材质靠色相区分：奶茶木 / 雾霾蓝石 / 冰晶蓝 / 熔岩砖火）
  wood: '#D9C2A8',
  woodDark: '#C4A88C',
  woodLight: '#EFE0D0',
  stone: '#B0C4D8',
  stoneDark: '#8FA8C4',
  stoneLight: '#D6E2F0',
  ice: '#B3E5FC',
  iceDark: '#81D4FA',
  iceLight: '#F0FAFF',
  // 火/熔岩砖 Fire（第四材料，纯材质无环境燃烧机制；嘟嘟铁头重击 fire×2 克制）
  fire: '#E8603C',          // 熔岩砖身：砖红
  fireDark: '#8E2A1C',      // 火山岩暗部/砖缝
  fireLight: '#FFC46B',     // 熔融裂纹/亮边（发光橙）

  // UI
  white: '#FFFFFF',
  black: '#212121',
  textShadow: 'rgba(0,0,0,0.3)',
  buttonBg: '#FF9E9E',      // 草莓奶霜（主按钮）
  buttonBgDark: '#F48FB1',
  panelBg: 'rgba(255,243,248,0.92)',  // 奶白粉面板（注：历史死键，界面实际用 screens.js 硬编码）
  starGold: '#FFD54F',      // 既有金星/飘字在用，保持不动
  starDark: '#8D6E63',

  // 可爱元素专用（马卡龙主题新增）
  blush: '#FF9E9E',         // 腮红（以 rgba(255,158,158,0.5) 半透明使用）
  ribbonWhite: '#FFF5F8',   // 丝带白纹 / 蝴蝶结高光
  sparkleGold: '#FFE082',   // 淡金：新装饰星星/光斑（勿与 starGold 混用）

  // 粒子 Particles
  particleRed: '#EF5350',
  particleGreen: '#66BB6A',
  particlePurple: '#9B6DFF',
  particleBrown: '#8D6E63',
  particleGray: '#B0BEC5',
  particleBlue: '#4FC3F7',
  particleYellow: '#FFD54F',
  particleOrange: '#FF8A45',  // 熔岩砖碎屑
};

// 河豚族种类 Puffer types（键名 bird/BIRD_TYPES 保留，题材已迁移为海洋）
// 全部为原创命名与配色（河豚族形象：圆身+背刺+嘟嘴），仅技能机制为通用物理玩法。
// damageVs 为种类 × 材质克制矩阵：>1 克制加伤，<1 被抵抗减值。
const BIRD_TYPES = {
  normal: {
    name: '嘟嘟',
    body: '#FFD54F', bodyDark: '#F9A825', belly: '#FFF8E1',
    crest: ['#FF8F00'], // 背刺
    trail: '255, 213, 79',
    damageVs: { wood: 1.0, stone: 1.0, ice: 1.0, fire: 2.0 },
    ability: null, // 无技能；铁头重击专克熔岩砖（fire×2），给无技能嘟嘟专属主场
  },
  dash: {
    name: '梭梭',
    body: '#B3E5FC', bodyDark: '#039BE5', belly: '#E1F5FE',
    crest: ['#039BE5'], // 背刺（鳍色）
    trail: '179, 229, 252',
    damageVs: { wood: 2.0, stone: 0.6, ice: 1.2, fire: 0.6 },
    ability: 'dash', // 空中点击：沿当前方向冲刺加速
  },
  bomb: {
    name: '砰砰',
    body: '#A1887F', bodyDark: '#5D4037', belly: '#D7CCC8',
    crest: ['#FF9F43', '#FF5252'], // 背刺（警示色）
    trail: '161, 136, 127',
    damageVs: { wood: 1.2, stone: 2.0, ice: 1.2, fire: 1.0 },
    ability: 'bomb', // 空中点击或首次撞击：范围爆炸（熔岩抗爆，火砖不被砰䂵全碎）
  },
  split: {
    name: '三丸子',
    body: '#FF8A65', bodyDark: '#E64A19', belly: '#FBE9E7',
    crest: ['#4FC3F7', '#FFD54F', '#FF8A65'], // 三色背刺
    trail: '255, 138, 101',
    damageVs: { wood: 0.8, stone: 0.5, ice: 2.0, fire: 0.6 },
    ability: 'split', // 空中点击：一分为三
  },
};

// 技能参数 Ability tuning
const DASH_BOOST = 2.1;        // 疾翎冲刺速度倍率
const DASH_MIN_SPEED = 16;     // 冲刺后的保底速度
const BOMB_RADIUS = 110;       // 岩轰爆炸半径
const BOMB_FORCE = 14;         // 爆炸中心冲击力（随距离衰减）
const SPLIT_ANGLE = 0.28;      // 三翎分裂的上下偏转角（弧度）

// 方块属性 Block properties
const BLOCK_TYPES = {
  wood: {
    health: 3,
    density: 1.0,
    color: COLORS.wood,
    colorDark: COLORS.woodDark,
    colorLight: COLORS.woodLight,
    particle: COLORS.particleBrown,
  },
  // stone 血量 6（批 E 落地）：石头加厚，把砰砰（石×2、爆力 14）顶成唯一高效破石手段——
  // 梭梭/三丸子对石 0.6/0.5 刮痧、嘟嘟直撞也要多发；石壳掩体逼玩家把稀缺的砰砰用在
  // 承重石基上引爆坍塌。砰砰配队同步稀有化（每关 ≤1），与「石头加厚」共同约束砰砰平衡。
  stone: {
    health: 6,
    density: 2.0,
    color: COLORS.stone,
    colorDark: COLORS.stoneDark,
    colorLight: COLORS.stoneLight,
    particle: COLORS.particleGray,
  },
  ice: {
    health: 2,
    density: 0.5,
    color: COLORS.ice,
    colorDark: COLORS.iceDark,
    colorLight: COLORS.iceLight,
    particle: COLORS.particleBlue,
  },
  // 火/熔岩砖 Fire：第四材料。硬度高（hp5、密度1.5），砰砰爆炸仅 ×1 抗爆、
  // 梭梭/三丸子 ×0.6 刮痧，唯嘟嘟铁头高速直撞 fire×2 一发碎——逼玩家换无技能嘟嘟精准点杀。
  fire: {
    health: 5,
    density: 1.5,
    color: COLORS.fire,
    colorDark: COLORS.fireDark,
    colorLight: COLORS.fireLight,
    particle: COLORS.particleOrange,
  },
  // 爆裂果（原创爆炸物：橙色浆果造型，非炸药桶表达）
  // 被摧毁时触发范围爆炸，可链式引爆其他爆裂果
  burst: {
    health: 1,
    density: 0.8,
    color: '#FFAB91',    // 马卡龙珊瑚橙果身
    colorDark: '#F08A78',
    colorLight: '#FFE3D6',
    particle: '#FFAB91',
  },
};

// 章王配色 Boss styles（战斗内本体与图鉴头像的单一数据源）
// body 取深一档：避免与同色壳材质方块「融壳」、避免图鉴浅色卡片上浅色发飘；
// dark 用于描边/卷触手/嘴线/裂纹/怒眉；flash 为受伤闪色（琥珀王黄闪不可见 → 白闪）。
// 缺省/未知 style 一律回退 abyss（历史深紫，即旧硬编码色）。
const BOSS_STYLE = {
  marsh:  { body: '#8D6E63', dark: '#5D4037' },                    // L8 滩涂章王（木壳系暖棕）
  ice:    { body: '#4FC3F7', dark: '#0277BD' },                    // L16 冰壳章王
  stone:  { body: '#78909C', dark: '#37474F' },                    // L24 岩甲章王
  abyss:  { body: '#8E24AA', dark: '#4A148C' },                    // L32 深渊章王（兼 fallback）
  throne: { body: '#FF8F00', dark: '#E65100', flash: '#FFF8E1' },  // L40 潮汐王座（琥珀橙）
};

module.exports = {
  init,
  FEATURES,
  get SCREEN_WIDTH() { return SCREEN_WIDTH; },
  get SCREEN_HEIGHT() { return SCREEN_HEIGHT; },
  get DPR() { return DPR; },
  get SAFE_TOP() { return SAFE_TOP; },
  get GRAVITY() { return GRAVITY; },
  get AIR_FRICTION() { return AIR_FRICTION; },
  get GROUND_BOUNCE() { return GROUND_BOUNCE; },
  get WALL_BOUNCE() { return WALL_BOUNCE; },
  get REST_THRESHOLD() { return REST_THRESHOLD; },
  get GROUND_HEIGHT() { return GROUND_HEIGHT; },
  get GROUND_Y() { return GROUND_Y; },
  get SLINGSHOT_X() { return SLINGSHOT_X; },
  get SLINGSHOT_Y() { return SLINGSHOT_Y; },
  get SLINGSHOT_HEIGHT() { return SLINGSHOT_HEIGHT; },
  get MAX_DRAG() { return MAX_DRAG; },
  get POWER_FACTOR() { return POWER_FACTOR; },
  get MIN_DRAG() { return MIN_DRAG; },
  get BIRD_RADIUS() { return BIRD_RADIUS; },
  get COLORS() { return COLORS; },
  get BLOCK_TYPES() { return BLOCK_TYPES; },
  get BIRD_TYPES() { return BIRD_TYPES; },
  get BOSS_STYLE() { return BOSS_STYLE; },
  get DASH_BOOST() { return DASH_BOOST; },
  get DASH_MIN_SPEED() { return DASH_MIN_SPEED; },
  get BOMB_RADIUS() { return BOMB_RADIUS; },
  get BOMB_FORCE() { return BOMB_FORCE; },
  get SPLIT_ANGLE() { return SPLIT_ANGLE; },
};
