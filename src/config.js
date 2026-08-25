/**
 * 游戏全局配置 - 屏幕尺寸、物理常量、颜色、尺寸等
 * Game Configuration - Screen dimensions, physics constants, colors, sizes
 */

// 屏幕参数 Screen parameters
// 先给安全默认值，避免模块加载时 jsbridge 未就绪就调用 wx API 报错。
// 真实值由 init() 在游戏入口中调用后写入。
let systemInfo = { screenWidth: 375, screenHeight: 667, devicePixelRatio: 2 };
let SCREEN_WIDTH = systemInfo.screenWidth;
let SCREEN_HEIGHT = systemInfo.screenHeight;
let DPR = systemInfo.devicePixelRatio || 1;

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
      };
    }
  } catch (e) {
    console.warn('[config] wx.getSystemInfoSync failed, using defaults:', e && e.message);
  }
  return { screenWidth: 375, screenHeight: 667, devicePixelRatio: 2 };
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
  GROUND_Y = SCREEN_HEIGHT - GROUND_HEIGHT;
  SLINGSHOT_Y = GROUND_Y - 110;
}
const MAX_DRAG = 95;            // 最大拖拽距离
const POWER_FACTOR = 0.19;      // 力度系数
const MIN_DRAG = 10;            // 最小有效拖拽

// 小鸟 Bird
const BIRD_RADIUS = 17;

// 颜色定义 Colors
const COLORS = {
  // 天空 Sky
  skyTop: '#4FC3F7',
  skyBottom: '#B3E5FC',

  // 地面 Ground
  grass: '#7CB342',
  grassDark: '#558B2F',
  dirt: '#6D4C41',

  // 弹弓 Slingshot
  slingWood: '#5D4037',
  slingWoodLight: '#795548',
  slingBand: '#3E2723',

  // 弹射者（原创海洋题材：河豚族，圆身+背刺+嘟嘴）
  birdBody: '#FFD54F',
  birdBodyDark: '#F9A825',
  birdBelly: '#FFF8E1',
  birdBeak: '#FF7043',     // 嘟嘴（键名保留，形象已改为鱼嘴）
  birdBeakDark: '#E64A19',

  // 敌人（原创海洋题材：章鱼怪，紫粉圆头+卷触手）
  pigBody: '#BA68C8',
  pigBodyDark: '#7B1FA2',
  pigSnout: '#E1BEE7',     // 吸盘/触手尖（键名保留，形象已改为章鱼）
  pigSnoutDark: '#AB47BC',

  // 方块 Blocks
  wood: '#A1887F',
  woodDark: '#795548',
  woodLight: '#BCAAA4',
  stone: '#90A4AE',
  stoneDark: '#607D8B',
  stoneLight: '#B0BEC5',
  ice: '#81D4FA',
  iceDark: '#4FC3F7',
  iceLight: '#E1F5FE',

  // UI
  white: '#FFFFFF',
  black: '#212121',
  textShadow: 'rgba(0,0,0,0.3)',
  buttonBg: '#FF7043',
  buttonBgDark: '#E64A19',
  panelBg: 'rgba(33,33,33,0.85)',
  starGold: '#FFD54F',
  starDark: '#5D4037',

  // 粒子 Particles
  particleRed: '#EF5350',
  particleGreen: '#66BB6A',
  particlePurple: '#9B6DFF',
  particleBrown: '#8D6E63',
  particleGray: '#B0BEC5',
  particleBlue: '#4FC3F7',
  particleYellow: '#FFD54F',
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
    damageVs: { wood: 1.0, stone: 1.0, ice: 1.0 },
    ability: null, // 无技能
  },
  dash: {
    name: '梭梭',
    body: '#B3E5FC', bodyDark: '#039BE5', belly: '#E1F5FE',
    crest: ['#039BE5'], // 背刺（鳍色）
    trail: '179, 229, 252',
    damageVs: { wood: 2.0, stone: 0.6, ice: 1.2 },
    ability: 'dash', // 空中点击：沿当前方向冲刺加速
  },
  bomb: {
    name: '砰砰',
    body: '#A1887F', bodyDark: '#5D4037', belly: '#D7CCC8',
    crest: ['#FF9F43', '#FF5252'], // 背刺（警示色）
    trail: '161, 136, 127',
    damageVs: { wood: 1.2, stone: 2.0, ice: 1.2 },
    ability: 'bomb', // 空中点击或首次撞击：范围爆炸
  },
  split: {
    name: '三丸子',
    body: '#FF8A65', bodyDark: '#E64A19', belly: '#FBE9E7',
    crest: ['#4FC3F7', '#FFD54F', '#FF8A65'], // 三色背刺
    trail: '255, 138, 101',
    damageVs: { wood: 0.8, stone: 0.5, ice: 2.0 },
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
    health: 2,
    density: 1.0,
    color: COLORS.wood,
    colorDark: COLORS.woodDark,
    colorLight: COLORS.woodLight,
    particle: COLORS.particleBrown,
  },
  stone: {
    health: 4,
    density: 2.0,
    color: COLORS.stone,
    colorDark: COLORS.stoneDark,
    colorLight: COLORS.stoneLight,
    particle: COLORS.particleGray,
  },
  ice: {
    health: 1,
    density: 0.5,
    color: COLORS.ice,
    colorDark: COLORS.iceDark,
    colorLight: COLORS.iceLight,
    particle: COLORS.particleBlue,
  },
  // 爆裂果（原创爆炸物：橙色浆果造型，非炸药桶表达）
  // 被摧毁时触发范围爆炸，可链式引爆其他爆裂果
  burst: {
    health: 1,
    density: 0.8,
    color: '#FF8A50',
    colorDark: '#D84315',
    colorLight: '#FFCCBC',
    particle: '#FF7043',
  },
};

module.exports = {
  init,
  get SCREEN_WIDTH() { return SCREEN_WIDTH; },
  get SCREEN_HEIGHT() { return SCREEN_HEIGHT; },
  get DPR() { return DPR; },
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
  get DASH_BOOST() { return DASH_BOOST; },
  get DASH_MIN_SPEED() { return DASH_MIN_SPEED; },
  get BOMB_RADIUS() { return BOMB_RADIUS; },
  get BOMB_FORCE() { return BOMB_FORCE; },
  get SPLIT_ANGLE() { return SPLIT_ANGLE; },
};
