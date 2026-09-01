/**
 * 关卡数据 - 40 个递进难度的关卡（5 章 × 8 关）
 * Level Data - 40 progressively challenging levels (5 chapters × 8).
 *
 * 章节下标范围：
 *   新手湾 0-7 / 珊瑚海 8-15 / 深渊要塞 16-23 / 极境深渊 24-31 / 潮汐王座 32-39
 *
 * 编排原则：
 *   - 16 个原有锚点关数据保持不变（仅重编序号），靠后摆放作为章节高潮；
 *   - 24 个新关卡填补章节前段，难度在相邻锚点之间插值；
 *   - 教学顺序：idx0 拖拽教学 → idx2 梭梭冲刺 → idx4 砰砰爆炸 → idx7 章王/换豚 → idx15 三丸子分裂；
 *   - 章末 Boss 战：idx 7/15/23/31/39 各守一只章王（boss:true 巨章鱼，免疫击退、
 *     自定义 hp、顶部血条）；护甲用木/冰/石方块拼壳，章王血量跨阈值时怒吼，
 *     唤醒预置屏外（y<0）的 sleep 阶段物（落石/爆裂果/援军章鱼，sleep 为阶段号）；
 *   - sleep 阶段物不计入每日/珍珠生成器素材（生成器过滤，见 daily.js/pearls.js）；
 *   - 候飞队列上限 6 只豚（3 列 × 2 排）。
 */

const C = require('./config.js');

// 基于屏幕尺寸计算关卡布局
// Base X for structures (right side of screen)
const STRUCT_BASE_X = C.SCREEN_WIDTH * 0.55;
const GROUND_Y = C.GROUND_Y;

/**
 * 生成关卡布局
 * Generate level layout based on screen dimensions
 */
function getLevels() {
  // 常用方块尺寸
  const BLOCK_W = 28;
  const BLOCK_H_LONG = 80;
  const BLOCK_H_SHORT = 28;
  const BLOCK_W_LONG = 80;

  return [
    // ============================================================
    // 第一章：新手湾（idx 0-7）—— 教学与木结构入门
    // ============================================================

    // ====== 第1关：教程 - 地面上的章鱼（锚点） ======
    {
      name: '第 1 关',
      flavor: '晨滩初醒',   // 风味名（HUD 与关卡主题）
      birds: ['normal', 'normal', 'normal'],
      trajectory: 70,
      stars: [2000, 4000, 6000],
      pigs: [
        { x: STRUCT_BASE_X + 30, y: GROUND_Y - 20, radius: 20 },
        { x: STRUCT_BASE_X + 90, y: GROUND_Y - 20, radius: 20 },
      ],
      blocks: [],
      // 隐藏珍珠：高抛弧线顶点附近（教玩家"抬头看看"）
      pearls: [{ id: 'lv0', x: STRUCT_BASE_X + 60, y: GROUND_Y - 320 }],
    },

    // ====== 第2关：平沙练靶（新）—— 单间小木屋，巩固基础弹射 ======
    {
      name: '第 2 关',
      flavor: '平沙练靶',
      birds: ['normal', 'normal', 'normal'],
      trajectory: 65,
      stars: [2500, 5000, 7500],
      pigs: [
        { x: STRUCT_BASE_X + 73, y: GROUND_Y - 17, radius: 17 },
        { x: STRUCT_BASE_X + 150, y: GROUND_Y - 18, radius: 18 },
      ],
      blocks: [
        // 左柱
        { x: STRUCT_BASE_X + 30, y: GROUND_Y - 70, width: BLOCK_W, height: 70, type: 'wood' },
        // 右柱
        { x: STRUCT_BASE_X + 96, y: GROUND_Y - 70, width: BLOCK_W, height: 70, type: 'wood' },
        // 顶梁
        { x: STRUCT_BASE_X + 30, y: GROUND_Y - 70 - 26, width: 94, height: 26, type: 'wood' },
      ],
    },

    // ====== 第3关：简单木屋（锚点）—— 梭梭冲刺教学 ======
    {
      name: '第 3 关',
      flavor: '孤屿木屋',   // 风味名（HUD 与关卡主题）
      hint: '新技能：梭梭空中点击极速冲刺！', // 首次进入显示技能教学
      birds: ['normal', 'dash', 'normal'],
      trajectory: 60,
      stars: [3000, 6000, 9000],
      pigs: [
        { x: STRUCT_BASE_X + 40, y: GROUND_Y - 18, radius: 18 },
        { x: STRUCT_BASE_X + 95, y: GROUND_Y - 18, radius: 18 },
        { x: STRUCT_BASE_X + 68, y: GROUND_Y - 70, radius: 18 },
      ],
      blocks: [
        // 左柱
        { x: STRUCT_BASE_X + 10, y: GROUND_Y - BLOCK_H_LONG, width: BLOCK_W, height: BLOCK_H_LONG, type: 'wood' },
        // 右柱
        { x: STRUCT_BASE_X + 98, y: GROUND_Y - BLOCK_H_LONG, width: BLOCK_W, height: BLOCK_H_LONG, type: 'wood' },
        // 顶梁
        { x: STRUCT_BASE_X + 10, y: GROUND_Y - BLOCK_H_LONG - BLOCK_H_SHORT, width: BLOCK_W_LONG + 18, height: BLOCK_H_SHORT, type: 'wood' },
      ],
      // 隐藏珍珠：木屋后方（需翻越屋顶或反弹墙后的刁钻角度）
      pearls: [{ id: 'lv1', x: STRUCT_BASE_X + 135, y: GROUND_Y - 30 }],
    },

    // ====== 第4关：潮间演武（新）—— 冲刺够远处的梁上章鱼 ======
    {
      name: '第 4 关',
      flavor: '潮间演武',
      birds: ['normal', 'dash', 'normal'],
      trajectory: 55,
      stars: [3500, 7000, 10500],
      pigs: [
        { x: STRUCT_BASE_X - 10, y: GROUND_Y - 16, radius: 16 },
        { x: STRUCT_BASE_X + 48, y: GROUND_Y - 90 - 26 - 16, radius: 16 },
        { x: STRUCT_BASE_X + 140, y: GROUND_Y - 18, radius: 18 },
      ],
      blocks: [
        // 木柱
        { x: STRUCT_BASE_X + 20, y: GROUND_Y - 90, width: BLOCK_W, height: 90, type: 'wood' },
        // 顶冰板（冲刺低平抽射可破）
        { x: STRUCT_BASE_X + 20, y: GROUND_Y - 90 - 26, width: 56, height: 26, type: 'ice' },
      ],
    },

    // ====== 第5关：石塔（锚点）—— 砰砰爆炸教学 ======
    {
      name: '第 5 关',
      flavor: '石塔守望',   // 风味名（HUD 与关卡主题）
      hint: '新技能：砰砰空中点击范围爆炸！', // 首次进入显示技能教学
      birds: ['normal', 'normal', 'bomb', 'normal'],
      trajectory: 50,
      stars: [4000, 8000, 12000],
      pigs: [
        { x: STRUCT_BASE_X + 50, y: GROUND_Y - 20, radius: 20 },
        { x: STRUCT_BASE_X + 50, y: GROUND_Y - 110, radius: 20 },
        { x: STRUCT_BASE_X + 50, y: GROUND_Y - 200, radius: 18 },
      ],
      blocks: [
        // 底层 石柱
        { x: STRUCT_BASE_X + 20, y: GROUND_Y - BLOCK_H_LONG, width: BLOCK_W, height: BLOCK_H_LONG, type: 'stone' },
        { x: STRUCT_BASE_X + 76, y: GROUND_Y - BLOCK_H_LONG, width: BLOCK_W, height: BLOCK_H_LONG, type: 'stone' },
        // 底层石板
        { x: STRUCT_BASE_X + 20, y: GROUND_Y - BLOCK_H_LONG - BLOCK_H_SHORT, width: 84, height: BLOCK_H_SHORT, type: 'stone' },
        // 中层木柱
        { x: STRUCT_BASE_X + 20, y: GROUND_Y - BLOCK_H_LONG - BLOCK_H_SHORT - 60, width: BLOCK_W, height: 60, type: 'wood' },
        { x: STRUCT_BASE_X + 76, y: GROUND_Y - BLOCK_H_LONG - BLOCK_H_SHORT - 60, width: BLOCK_W, height: 60, type: 'wood' },
        // 中层木板
        { x: STRUCT_BASE_X + 20, y: GROUND_Y - BLOCK_H_LONG - BLOCK_H_SHORT - 60 - BLOCK_H_SHORT, width: 84, height: BLOCK_H_SHORT, type: 'wood' },
        // 顶层冰块
        { x: STRUCT_BASE_X + 35, y: GROUND_Y - BLOCK_H_LONG - BLOCK_H_SHORT - 60 - BLOCK_H_SHORT - 25, width: 54, height: 25, type: 'ice' },
      ],
      // 隐藏珍珠：石塔正上方（高抛过顶才能碰到）
      pearls: [{ id: 'lv2', x: STRUCT_BASE_X + 50, y: GROUND_Y - 260 }],
    },

    // ====== 第6关：碎礁石墙（新）—— 首次石材质，砰砰破墙 ======
    {
      name: '第 6 关',
      flavor: '碎礁石墙',
      birds: ['normal', 'dash', 'bomb', 'normal'],
      trajectory: 49,
      stars: [4200, 8400, 12600],
      pigs: [
        { x: STRUCT_BASE_X + 70, y: GROUND_Y - 16, radius: 16 },
        { x: STRUCT_BASE_X - 20, y: GROUND_Y - 16, radius: 16 },
        { x: STRUCT_BASE_X + 70, y: GROUND_Y - 100 - 26 - 16, radius: 16 },
        { x: STRUCT_BASE_X + 150, y: GROUND_Y - 18, radius: 18 },
      ],
      blocks: [
        // 左石墙
        { x: STRUCT_BASE_X + 10, y: GROUND_Y - 100, width: 26, height: 100, type: 'stone' },
        // 右石墙
        { x: STRUCT_BASE_X + 104, y: GROUND_Y - 100, width: 26, height: 100, type: 'stone' },
        // 木横梁
        { x: STRUCT_BASE_X + 10, y: GROUND_Y - 100 - 26, width: 120, height: 26, type: 'wood' },
      ],
    },

    // ====== 第7关：双礁哨塔（新）—— 两座小木塔，练习逐个击破 ======
    {
      name: '第 7 关',
      flavor: '双礁哨塔',
      birds: ['dash', 'normal', 'bomb', 'normal'],
      trajectory: 48,
      stars: [4500, 9000, 13500],
      pigs: [
        { x: STRUCT_BASE_X + 32, y: GROUND_Y - 15, radius: 15 },
        { x: STRUCT_BASE_X + 32, y: GROUND_Y - 80 - 26 - 15, radius: 15 },
        { x: STRUCT_BASE_X + 122, y: GROUND_Y - 15, radius: 15 },
        { x: STRUCT_BASE_X - 25, y: GROUND_Y - 16, radius: 16 },
      ],
      blocks: [
        // A 塔
        { x: STRUCT_BASE_X + 0, y: GROUND_Y - 80, width: 26, height: 80, type: 'wood' },
        { x: STRUCT_BASE_X + 44, y: GROUND_Y - 80, width: 26, height: 80, type: 'wood' },
        { x: STRUCT_BASE_X + 0, y: GROUND_Y - 80 - 26, width: 70, height: 26, type: 'wood' },
        // B 塔
        { x: STRUCT_BASE_X + 90, y: GROUND_Y - 80, width: 26, height: 80, type: 'wood' },
        { x: STRUCT_BASE_X + 134, y: GROUND_Y - 80, width: 26, height: 80, type: 'wood' },
        { x: STRUCT_BASE_X + 90, y: GROUND_Y - 80 - 26, width: 70, height: 26, type: 'ice' },
      ],
    },

    // ====== 第8关：滩涂章王（新）—— 章节收官：首个 Boss 战，木壳教学 ======
    {
      name: '第 8 关',
      flavor: '浮木门楼',
      hint: '巨型章王！先破壳，再直击本体！点候飞区能换豚！',
      birds: ['normal', 'dash', 'bomb', 'normal', 'normal'],
      trajectory: 46,
      stars: [4700, 9500, 14200],
      pigs: [
        // 滩涂章王（Boss）：木壳掩体中，免疫击退，需多次直击（教学章王无怒吼阶段）
        { x: STRUCT_BASE_X + 92, y: GROUND_Y - 30, radius: 30, boss: true, hp: 5, name: '滩涂章王' },
        // 屋顶哨章鱼
        { x: STRUCT_BASE_X + 92, y: GROUND_Y - 114 - 14, radius: 14 },
        // 阵前地面章鱼
        { x: STRUCT_BASE_X - 30, y: GROUND_Y - 16, radius: 16 },
      ],
      blocks: [
        // 木壳左墙（梭梭冲刺克木，破口后直击本体）
        { x: STRUCT_BASE_X + 34, y: GROUND_Y - 44, width: 26, height: 44, type: 'wood' },
        { x: STRUCT_BASE_X + 34, y: GROUND_Y - 88, width: 26, height: 44, type: 'wood' },
        // 木壳右墙
        { x: STRUCT_BASE_X + 124, y: GROUND_Y - 44, width: 26, height: 44, type: 'wood' },
        { x: STRUCT_BASE_X + 124, y: GROUND_Y - 88, width: 26, height: 44, type: 'wood' },
        // 木壳屋顶
        { x: STRUCT_BASE_X + 34, y: GROUND_Y - 114, width: 116, height: 26, type: 'wood' },
        // 爆裂果（阵前地面，引爆可掀开屋顶）
        { x: STRUCT_BASE_X - 3, y: GROUND_Y - 26, width: 26, height: 26, type: 'burst' },
      ],
    },

    // ============================================================
    // 第二章：珊瑚海（idx 8-15）—— 混合材质，分裂教学收官
    // ============================================================

    // ====== 第9关：浅礁初试（新）—— 木柱冰梁小屋 ======
    {
      name: '第 9 关',
      flavor: '浅礁初试',
      birds: ['normal', 'dash', 'normal', 'bomb'],
      trajectory: 48,
      stars: [4300, 8600, 13000],
      pigs: [
        { x: STRUCT_BASE_X + 76, y: GROUND_Y - 16, radius: 16 },
        { x: STRUCT_BASE_X + 145, y: GROUND_Y - 18, radius: 18 },
        { x: STRUCT_BASE_X + 76, y: GROUND_Y - 75 - 24 - 14, radius: 14 },
      ],
      blocks: [
        // 左柱
        { x: STRUCT_BASE_X + 40, y: GROUND_Y - 75, width: 26, height: 75, type: 'wood' },
        // 右柱
        { x: STRUCT_BASE_X + 100, y: GROUND_Y - 75, width: 26, height: 75, type: 'wood' },
        // 冰梁
        { x: STRUCT_BASE_X + 40, y: GROUND_Y - 75 - 24, width: 86, height: 24, type: 'ice' },
      ],
    },

    // ====== 第10关：珊瑚回廊（新）—— 双木塔 + 冰梁 ======
    {
      name: '第 10 关',
      flavor: '珊瑚回廊',
      birds: ['dash', 'normal', 'bomb', 'normal'],
      trajectory: 47,
      stars: [4500, 9000, 13500],
      pigs: [
        { x: STRUCT_BASE_X + 26, y: GROUND_Y - 15, radius: 15 },
        { x: STRUCT_BASE_X + 121, y: GROUND_Y - 15, radius: 15 },
        { x: STRUCT_BASE_X - 30, y: GROUND_Y - 16, radius: 16 },
        { x: STRUCT_BASE_X + 121, y: GROUND_Y - 85 - 24 - 15, radius: 15 },
      ],
      blocks: [
        // A 塔
        { x: STRUCT_BASE_X + 0, y: GROUND_Y - 85, width: 26, height: 85, type: 'wood' },
        { x: STRUCT_BASE_X + 40, y: GROUND_Y - 85, width: 26, height: 85, type: 'wood' },
        { x: STRUCT_BASE_X + 0, y: GROUND_Y - 85 - 24, width: 66, height: 24, type: 'ice' },
        // B 塔
        { x: STRUCT_BASE_X + 95, y: GROUND_Y - 85, width: 26, height: 85, type: 'wood' },
        { x: STRUCT_BASE_X + 135, y: GROUND_Y - 85, width: 26, height: 85, type: 'wood' },
        { x: STRUCT_BASE_X + 95, y: GROUND_Y - 85 - 24, width: 66, height: 24, type: 'ice' },
      ],
    },

    // ====== 第11关：海葵石堡（新）—— 首次重石结构 ======
    {
      name: '第 11 关',
      flavor: '海葵石堡',
      birds: ['normal', 'bomb', 'dash', 'normal', 'normal'],
      trajectory: 46,
      stars: [4700, 9400, 14000],
      pigs: [
        { x: STRUCT_BASE_X + 57, y: GROUND_Y - 16, radius: 16 },
        { x: STRUCT_BASE_X - 25, y: GROUND_Y - 16, radius: 16 },
        { x: STRUCT_BASE_X + 100, y: GROUND_Y - 90 - 26 - 15, radius: 15 },
        { x: STRUCT_BASE_X + 140, y: GROUND_Y - 17, radius: 17 },
      ],
      blocks: [
        // 左石柱
        { x: STRUCT_BASE_X + 15, y: GROUND_Y - 90, width: BLOCK_W, height: 90, type: 'stone' },
        // 右石柱
        { x: STRUCT_BASE_X + 85, y: GROUND_Y - 90, width: BLOCK_W, height: 90, type: 'stone' },
        // 石门楣
        { x: STRUCT_BASE_X + 15, y: GROUND_Y - 90 - 26, width: 98, height: 26, type: 'stone' },
        // 门楣冰帽（破冰克制入口）
        { x: STRUCT_BASE_X + 45, y: GROUND_Y - 90 - 26 - 22, width: 30, height: 22, type: 'ice' },
      ],
    },

    // ====== 第12关：浪花三塔（新）—— 三座小塔混合材质 ======
    {
      name: '第 12 关',
      flavor: '浪花三塔',
      birds: ['normal', 'dash', 'bomb', 'normal', 'normal'],
      trajectory: 45,
      stars: [4900, 9800, 14600],
      pigs: [
        { x: STRUCT_BASE_X + 22, y: GROUND_Y - 14, radius: 14 },
        { x: STRUCT_BASE_X + 92, y: GROUND_Y - 15, radius: 15 },
        { x: STRUCT_BASE_X + 92, y: GROUND_Y - 90 - 24 - 15, radius: 15 },
        { x: STRUCT_BASE_X - 30, y: GROUND_Y - 16, radius: 16 },
      ],
      blocks: [
        // T1 木塔
        { x: STRUCT_BASE_X + 0, y: GROUND_Y - 70, width: 24, height: 70, type: 'wood' },
        { x: STRUCT_BASE_X + 32, y: GROUND_Y - 70, width: 24, height: 70, type: 'wood' },
        { x: STRUCT_BASE_X + 0, y: GROUND_Y - 70 - 24, width: 56, height: 24, type: 'ice' },
        // T2 石塔（更高）
        { x: STRUCT_BASE_X + 70, y: GROUND_Y - 90, width: 24, height: 90, type: 'stone' },
        { x: STRUCT_BASE_X + 102, y: GROUND_Y - 90, width: 24, height: 90, type: 'stone' },
        { x: STRUCT_BASE_X + 70, y: GROUND_Y - 90 - 24, width: 56, height: 24, type: 'stone' },
        // T3 右侧冰柱
        { x: STRUCT_BASE_X + 140, y: GROUND_Y - 40, width: 24, height: 40, type: 'ice' },
        { x: STRUCT_BASE_X + 138, y: GROUND_Y - 40 - 20, width: 28, height: 20, type: 'ice' },
      ],
    },

    // ====== 第13关：混合堡垒（锚点） ======
    {
      name: '第 13 关',
      flavor: '礁堡迷阵',   // 风味名（HUD 与关卡主题）
      birds: ['dash', 'normal', 'bomb', 'normal'],
      trajectory: 45,
      stars: [5000, 10000, 15000],
      pigs: [
        { x: STRUCT_BASE_X + 15, y: GROUND_Y - 18, radius: 18 },
        { x: STRUCT_BASE_X + 90, y: GROUND_Y - 18, radius: 18 },
        { x: STRUCT_BASE_X + 52, y: GROUND_Y - 60, radius: 20 },
        { x: STRUCT_BASE_X + 52, y: GROUND_Y - 140, radius: 18 },
      ],
      blocks: [
        // 左石柱
        { x: STRUCT_BASE_X, y: GROUND_Y - BLOCK_H_LONG, width: BLOCK_W, height: BLOCK_H_LONG, type: 'stone' },
        // 右石柱
        { x: STRUCT_BASE_X + 78, y: GROUND_Y - BLOCK_H_LONG, width: BLOCK_W, height: BLOCK_H_LONG, type: 'stone' },
        // 横梁木
        { x: STRUCT_BASE_X, y: GROUND_Y - BLOCK_H_LONG - BLOCK_H_SHORT, width: 106, height: BLOCK_H_SHORT, type: 'wood' },
        // 二层左木柱
        { x: STRUCT_BASE_X + 5, y: GROUND_Y - BLOCK_H_LONG - BLOCK_H_SHORT - 55, width: BLOCK_W, height: 55, type: 'wood' },
        // 二层右木柱
        { x: STRUCT_BASE_X + 73, y: GROUND_Y - BLOCK_H_LONG - BLOCK_H_SHORT - 55, width: BLOCK_W, height: 55, type: 'wood' },
        // 二层顶冰板
        { x: STRUCT_BASE_X + 5, y: GROUND_Y - BLOCK_H_LONG - BLOCK_H_SHORT - 55 - BLOCK_H_SHORT, width: 96, height: BLOCK_H_SHORT, type: 'ice' },
        // 顶层小冰块
        { x: STRUCT_BASE_X + 35, y: GROUND_Y - BLOCK_H_LONG - BLOCK_H_SHORT - 55 - BLOCK_H_SHORT - 30, width: 36, height: 30, type: 'ice' },
      ],
    },

    // ====== 第14关：珊瑚要塞（锚点） ======
    {
      name: '第 14 关',
      flavor: '珊瑚要塞',   // 风味名（HUD 与关卡主题）
      birds: ['normal', 'dash', 'bomb', 'normal', 'normal'],
      trajectory: 40,
      stars: [6000, 12000, 20000],
      pigs: [
        // 左侧结构
        { x: STRUCT_BASE_X - 5, y: GROUND_Y - 18, radius: 18 },
        { x: STRUCT_BASE_X + 25, y: GROUND_Y - 80, radius: 18 },
        // 右侧结构
        { x: STRUCT_BASE_X + 95, y: GROUND_Y - 20, radius: 20 },
        { x: STRUCT_BASE_X + 95, y: GROUND_Y - 100, radius: 18 },
        // 顶部
        { x: STRUCT_BASE_X + 55, y: GROUND_Y - 170, radius: 16 },
      ],
      blocks: [
        // === 左侧小塔 ===
        { x: STRUCT_BASE_X - 20, y: GROUND_Y - 70, width: BLOCK_W, height: 70, type: 'wood' },
        { x: STRUCT_BASE_X + 12, y: GROUND_Y - 70, width: BLOCK_W, height: 70, type: 'wood' },
        { x: STRUCT_BASE_X - 20, y: GROUND_Y - 70 - BLOCK_H_SHORT, width: 60, height: BLOCK_H_SHORT, type: 'stone' },

        // === 右侧石塔 ===
        { x: STRUCT_BASE_X + 70, y: GROUND_Y - 80, width: BLOCK_W, height: 80, type: 'stone' },
        { x: STRUCT_BASE_X + 112, y: GROUND_Y - 80, width: BLOCK_W, height: 80, type: 'stone' },
        { x: STRUCT_BASE_X + 70, y: GROUND_Y - 80 - BLOCK_H_SHORT, width: 70, height: BLOCK_H_SHORT, type: 'wood' },

        // === 顶部桥 ===
        { x: STRUCT_BASE_X + 5, y: GROUND_Y - 160, width: 120, height: BLOCK_H_SHORT, type: 'ice' },
        { x: STRUCT_BASE_X + 20, y: GROUND_Y - 160 - 35, width: 90, height: 35, type: 'ice' },

        // === 装饰冰块 ===
        { x: STRUCT_BASE_X + 48, y: GROUND_Y - 160 - 35 - 20, width: 34, height: 20, type: 'ice' },
      ],
      // 隐藏珍珠：冰桥下方、双塔之间（低平抽射角度）
      pearls: [{ id: 'lv4', x: STRUCT_BASE_X + 20, y: GROUND_Y - 121 }],
    },

    // ====== 第15关：双子塔（锚点） ======
    {
      name: '第 15 关',
      flavor: '双子灯塔',   // 风味名（HUD 与关卡主题）
      birds: ['dash', 'normal', 'bomb', 'normal', 'normal'],
      trajectory: 35,
      stars: [7000, 13000, 19000],
      pigs: [
        // 前左地面
        { x: STRUCT_BASE_X - 25, y: GROUND_Y - 18, radius: 18 },
        // 左塔顶（桥未覆盖处）
        { x: STRUCT_BASE_X - 2, y: GROUND_Y - 90 - 26 - 18, radius: 16 },
        // 桥左
        { x: STRUCT_BASE_X + 45, y: GROUND_Y - 90 - 26 - 22 - 16, radius: 16 },
        // 桥右
        { x: STRUCT_BASE_X + 90, y: GROUND_Y - 90 - 26 - 22 - 16, radius: 16 },
      ],
      blocks: [
        // 左塔
        { x: STRUCT_BASE_X + 0, y: GROUND_Y - 90, width: 28, height: 90, type: 'wood' },
        { x: STRUCT_BASE_X + 30, y: GROUND_Y - 90, width: 28, height: 90, type: 'wood' },
        { x: STRUCT_BASE_X + 0, y: GROUND_Y - 90 - 26, width: 58, height: 26, type: 'stone' },
        // 右塔
        { x: STRUCT_BASE_X + 78, y: GROUND_Y - 90, width: 28, height: 90, type: 'wood' },
        { x: STRUCT_BASE_X + 108, y: GROUND_Y - 90, width: 28, height: 90, type: 'wood' },
        { x: STRUCT_BASE_X + 78, y: GROUND_Y - 90 - 26, width: 58, height: 26, type: 'stone' },
        // 桥
        { x: STRUCT_BASE_X + 28, y: GROUND_Y - 90 - 26 - 22, width: 80, height: 22, type: 'ice' },
        // 爆裂果（吊在冰桥下方，引爆可震断双塔）
        { x: STRUCT_BASE_X + 58, y: GROUND_Y - 90 - 26, width: 20, height: 20, type: 'burst' },
      ],
    },

    // ====== 第16关：冰壳章王（锚点）—— 三丸子分裂教学 + 章末 Boss：冰壳 ======
    {
      name: '第 16 关',
      flavor: '潮阶塔林',   // 风味名（HUD 与关卡主题）
      hint: '新技能：三丸子空中点击一分为三！', // 首次进入显示技能教学
      birds: ['normal', 'split', 'dash', 'bomb', 'normal'],
      trajectory: 30,
      stars: [8000, 14000, 21000],
      pigs: [
        // 冰壳章王（Boss）：冰壳掩体中，hp7；半血怒吼天降爆裂果（sleep 阶段物）
        { x: STRUCT_BASE_X + 120, y: GROUND_Y - 26, radius: 26, boss: true, hp: 7, name: '冰壳章王' },
        // 冰壳屋顶哨章鱼
        { x: STRUCT_BASE_X + 120, y: GROUND_Y - 114 - 12, radius: 12 },
        // 前左地面
        { x: STRUCT_BASE_X - 28, y: GROUND_Y - 18, radius: 18 },
      ],
      blocks: [
        // 左柱（石+木+冰）
        { x: STRUCT_BASE_X + 0, y: GROUND_Y - 120, width: 30, height: 120, type: 'stone' },
        { x: STRUCT_BASE_X + 0, y: GROUND_Y - 120 - 70, width: 30, height: 70, type: 'wood' },
        { x: STRUCT_BASE_X - 2, y: GROUND_Y - 120 - 70 - 26, width: 34, height: 26, type: 'ice' },
        // 中柱（木+石+冰）——柱顶冰帽加宽：本关首只即三丸子（分裂对冰 2 倍克制），
        // 宽冰帽让"分裂→破冰"的解法在关卡结构里自解释，技能教学即关卡本身
        { x: STRUCT_BASE_X + 41, y: GROUND_Y - 90, width: 30, height: 90, type: 'wood' },
        { x: STRUCT_BASE_X + 41, y: GROUND_Y - 90 - 60, width: 30, height: 60, type: 'stone' },
        // 中冰帽保持原 x（柱身左移 4px 给冰壳让位，宽帽视觉余量足够）
        { x: STRUCT_BASE_X + 33, y: GROUND_Y - 90 - 60 - 24, width: 54, height: 24, type: 'ice' },
        // 右柱顶冰帽（柱身让位给章王冰壳，冰帽悬浮——分裂破冰教学锚点保留）
        { x: STRUCT_BASE_X + 93, y: GROUND_Y - 60 - 24, width: 34, height: 24, type: 'ice' },
        // 章王冰壳：左墙 / 右墙 / 屋顶（三丸子一分为三，一发碎三块冰）
        { x: STRUCT_BASE_X + 72, y: GROUND_Y - 44, width: 20, height: 44, type: 'ice' },
        { x: STRUCT_BASE_X + 72, y: GROUND_Y - 88, width: 20, height: 44, type: 'ice' },
        { x: STRUCT_BASE_X + 150, y: GROUND_Y - 44, width: 18, height: 44, type: 'ice' },
        { x: STRUCT_BASE_X + 150, y: GROUND_Y - 88, width: 18, height: 44, type: 'ice' },
        { x: STRUCT_BASE_X + 72, y: GROUND_Y - 114, width: 96, height: 26, type: 'ice' },
        // 阶段 1（半血怒吼）：天降爆裂果 ×2（预置屏外，唤醒后坠落砸开冰壳）
        { x: STRUCT_BASE_X + 94, y: -260, width: 26, height: 26, type: 'burst', sleep: 1 },
        { x: STRUCT_BASE_X + 138, y: -320, width: 26, height: 26, type: 'burst', sleep: 1 },
      ],
      // 隐藏珍珠：画面右尽头、冰壳上方（极限射程）
      pearls: [{ id: 'lv6', x: STRUCT_BASE_X + 130, y: GROUND_Y - 170 }],
    },

    // ============================================================
    // 第三章：深渊要塞（idx 16-23）—— 冰石混构，难度抬升
    // ============================================================

    // ====== 第17关：冰幕初启（新）—— 分裂首秀：冰门楣 ======
    {
      name: '第 17 关',
      flavor: '冰幕初启',
      birds: ['split', 'normal', 'dash', 'bomb', 'normal'],
      trajectory: 29,
      stars: [8200, 14400, 21200],
      pigs: [
        { x: STRUCT_BASE_X + 45, y: GROUND_Y - 16, radius: 16 },
        { x: STRUCT_BASE_X + 80, y: GROUND_Y - 14, radius: 14 },
        { x: STRUCT_BASE_X - 25, y: GROUND_Y - 16, radius: 16 },
        { x: STRUCT_BASE_X + 70, y: GROUND_Y - 95 - 24 - 15, radius: 15 },
      ],
      blocks: [
        // 左冰墙
        { x: STRUCT_BASE_X + 10, y: GROUND_Y - 95, width: 26, height: 95, type: 'ice' },
        // 右冰墙
        { x: STRUCT_BASE_X + 110, y: GROUND_Y - 95, width: 26, height: 95, type: 'ice' },
        // 冰门楣
        { x: STRUCT_BASE_X + 10, y: GROUND_Y - 95 - 24, width: 126, height: 24, type: 'ice' },
        // 门楣石镇 ×2
        { x: STRUCT_BASE_X + 22, y: GROUND_Y - 95 - 24 - 24, width: 28, height: 24, type: 'stone' },
        { x: STRUCT_BASE_X + 92, y: GROUND_Y - 95 - 24 - 24, width: 28, height: 24, type: 'stone' },
      ],
    },

    // ====== 第18关：寒晶双柱（新）—— 石柱冰帽 + 矮桥 ======
    {
      name: '第 18 关',
      flavor: '寒晶双柱',
      birds: ['split', 'dash', 'normal', 'bomb', 'normal'],
      trajectory: 29,
      stars: [8500, 14700, 21500],
      pigs: [
        { x: STRUCT_BASE_X - 30, y: GROUND_Y - 16, radius: 16 },
        { x: STRUCT_BASE_X + 64, y: GROUND_Y - 14, radius: 14 },
        { x: STRUCT_BASE_X + 19, y: GROUND_Y - 90 - 24 - 15, radius: 15 },
        { x: STRUCT_BASE_X + 145, y: GROUND_Y - 17, radius: 17 },
      ],
      blocks: [
        // A 柱（石+冰帽）
        { x: STRUCT_BASE_X + 5, y: GROUND_Y - 90, width: BLOCK_W, height: 90, type: 'stone' },
        { x: STRUCT_BASE_X + 1, y: GROUND_Y - 90 - 24, width: 36, height: 24, type: 'ice' },
        // B 柱（石+冰帽）
        { x: STRUCT_BASE_X + 95, y: GROUND_Y - 90, width: BLOCK_W, height: 90, type: 'stone' },
        { x: STRUCT_BASE_X + 91, y: GROUND_Y - 90 - 24, width: 36, height: 24, type: 'ice' },
        // 矮冰墩 + 冰桥（桥下藏章鱼）
        { x: STRUCT_BASE_X + 45, y: GROUND_Y - 40, width: 20, height: 40, type: 'ice' },
        { x: STRUCT_BASE_X + 37, y: GROUND_Y - 40 - 20, width: 58, height: 20, type: 'ice' },
      ],
    },

    // ====== 第19关：冰晶宫（锚点，全冰，脆） ======
    {
      name: '第 19 关',
      flavor: '冰晶宫殿',   // 风味名（HUD 与关卡主题）
      birds: ['split', 'split', 'dash', 'normal', 'normal'],
      trajectory: 28,
      stars: [9000, 15000, 20000],
      pigs: [
        // 宫内左地面
        { x: STRUCT_BASE_X + 40, y: GROUND_Y - 16, radius: 16 },
        // 宫内右地面
        { x: STRUCT_BASE_X + 72, y: GROUND_Y - 16, radius: 16 },
        // 屋顶
        { x: STRUCT_BASE_X + 57, y: GROUND_Y - 100 - 22 - 18, radius: 16 },
        // 前左地面
        { x: STRUCT_BASE_X - 25, y: GROUND_Y - 18, radius: 16 },
      ],
      blocks: [
        // 左墙
        { x: STRUCT_BASE_X + 0, y: GROUND_Y - 100, width: 24, height: 100, type: 'ice' },
        // 右墙
        { x: STRUCT_BASE_X + 90, y: GROUND_Y - 100, width: 24, height: 100, type: 'ice' },
        // 屋顶
        { x: STRUCT_BASE_X + 0, y: GROUND_Y - 100 - 22, width: 114, height: 22, type: 'ice' },
        // 屋顶左右石镇（石压冰角：挡住直取屋顶的抛射线，同时抬高本关材料硬度，避免纯放松关）
        { x: STRUCT_BASE_X + 8, y: GROUND_Y - 100 - 22 - 26, width: 28, height: 26, type: 'stone' },
        { x: STRUCT_BASE_X + 78, y: GROUND_Y - 100 - 22 - 26, width: 28, height: 26, type: 'stone' },
      ],
    },

    // ====== 第20关：冰骨长阶（新）—— 石台基 + 冰柱冰梁 ======
    {
      name: '第 20 关',
      flavor: '冰骨长阶',
      birds: ['split', 'bomb', 'dash', 'normal', 'normal'],
      trajectory: 29,
      stars: [9500, 16000, 22000],
      pigs: [
        { x: STRUCT_BASE_X + 60, y: GROUND_Y - 60 - 16, radius: 16 },
        { x: STRUCT_BASE_X - 25, y: GROUND_Y - 16, radius: 16 },
        { x: STRUCT_BASE_X + 145, y: GROUND_Y - 18, radius: 18 },
        { x: STRUCT_BASE_X + 60, y: GROUND_Y - 60 - 80 - 22 - 14, radius: 14 },
        { x: STRUCT_BASE_X + 120, y: GROUND_Y - 60 - 16, radius: 16 },
      ],
      blocks: [
        // 石台基
        { x: STRUCT_BASE_X + 0, y: GROUND_Y - 60, width: 140, height: 60, type: 'stone' },
        // 台基冰柱 ×2
        { x: STRUCT_BASE_X + 10, y: GROUND_Y - 60 - 80, width: 26, height: 80, type: 'ice' },
        { x: STRUCT_BASE_X + 100, y: GROUND_Y - 60 - 80, width: 26, height: 80, type: 'ice' },
        // 冰梁
        { x: STRUCT_BASE_X + 10, y: GROUND_Y - 60 - 80 - 22, width: 116, height: 22, type: 'ice' },
      ],
    },

    // ====== 第21关：钢铁方阵（锚点，全石，硬） ======
    {
      name: '第 21 关',
      flavor: '钢铁方阵',   // 风味名（HUD 与关卡主题）
      birds: ['bomb', 'bomb', 'normal', 'dash', 'normal', 'normal'],
      trajectory: 30,
      stars: [10000, 17000, 23000],
      pigs: [
        // 宫内左地面
        { x: STRUCT_BASE_X + 43, y: GROUND_Y - 16, radius: 16 },
        // 宫内右地面
        { x: STRUCT_BASE_X + 77, y: GROUND_Y - 16, radius: 16 },
        // 屋顶章鱼 1
        { x: STRUCT_BASE_X + 40, y: GROUND_Y - 100 - 24 - 18, radius: 16 },
        // 屋顶章鱼 2
        { x: STRUCT_BASE_X + 80, y: GROUND_Y - 100 - 24 - 18, radius: 14 },
        // 前左地面
        { x: STRUCT_BASE_X - 25, y: GROUND_Y - 18, radius: 16 },
      ],
      blocks: [
        // 左墙
        { x: STRUCT_BASE_X + 0, y: GROUND_Y - 100, width: 26, height: 100, type: 'stone' },
        // 右墙
        { x: STRUCT_BASE_X + 95, y: GROUND_Y - 100, width: 26, height: 100, type: 'stone' },
        // 屋顶
        { x: STRUCT_BASE_X + 0, y: GROUND_Y - 100 - 24, width: 121, height: 24, type: 'stone' },
        // 爆裂果（阵前地面，引爆可清掉前排并震松石墙）
        { x: STRUCT_BASE_X - 75, y: GROUND_Y - 30, width: 30, height: 30, type: 'burst' },
      ],
      // 隐藏珍珠：石檐正上方（越过檐上双章鱼的高点）
      pearls: [{ id: 'lv8', x: STRUCT_BASE_X + 60, y: GROUND_Y - 170 }],
    },

    // ====== 第22关：渊涡门阵（新）—— 双塔夹爆裂果 ======
    {
      name: '第 22 关',
      flavor: '渊涡门阵',
      birds: ['bomb', 'split', 'dash', 'bomb', 'normal', 'normal'],
      trajectory: 27,
      stars: [10500, 18000, 25000],
      pigs: [
        { x: STRUCT_BASE_X + 26, y: GROUND_Y - 15, radius: 15 },
        { x: STRUCT_BASE_X + 26, y: GROUND_Y - 95 - 24 - 14, radius: 14 },
        { x: STRUCT_BASE_X + 116, y: GROUND_Y - 15, radius: 15 },
        { x: STRUCT_BASE_X + 116, y: GROUND_Y - 95 - 24 - 14, radius: 14 },
        { x: STRUCT_BASE_X - 30, y: GROUND_Y - 16, radius: 16 },
      ],
      blocks: [
        // 左石塔
        { x: STRUCT_BASE_X + 0, y: GROUND_Y - 95, width: 26, height: 95, type: 'stone' },
        { x: STRUCT_BASE_X + 36, y: GROUND_Y - 95, width: 26, height: 95, type: 'stone' },
        { x: STRUCT_BASE_X + 0, y: GROUND_Y - 95 - 24, width: 62, height: 24, type: 'stone' },
        // 右冰塔
        { x: STRUCT_BASE_X + 90, y: GROUND_Y - 95, width: 26, height: 95, type: 'ice' },
        { x: STRUCT_BASE_X + 130, y: GROUND_Y - 95, width: 26, height: 95, type: 'ice' },
        { x: STRUCT_BASE_X + 90, y: GROUND_Y - 95 - 24, width: 66, height: 24, type: 'ice' },
        // 爆裂果（双塔之间，链爆破阵眼；塔间净空 B+62..B+90，果宽 26 正好嵌入）
        { x: STRUCT_BASE_X + 63, y: GROUND_Y - 26, width: 26, height: 26, type: 'burst' },
      ],
    },

    // ====== 第23关：暗礁城垛（新）—— 长石台 + 冰垛 ======
    {
      name: '第 23 关',
      flavor: '暗礁城垛',
      birds: ['split', 'bomb', 'dash', 'bomb', 'normal', 'normal'],
      trajectory: 25,
      stars: [11000, 19000, 27000],
      pigs: [
        { x: STRUCT_BASE_X + 48, y: GROUND_Y - 50 - 12, radius: 12 },
        { x: STRUCT_BASE_X + 102, y: GROUND_Y - 50 - 12, radius: 12 },
        { x: STRUCT_BASE_X + 75, y: GROUND_Y - 50 - 24 - 14, radius: 14 },
        { x: STRUCT_BASE_X + 20, y: GROUND_Y - 50 - 24 - 13, radius: 13 },
        { x: STRUCT_BASE_X - 25, y: GROUND_Y - 16, radius: 16 },
      ],
      blocks: [
        // 长石台基
        { x: STRUCT_BASE_X + 0, y: GROUND_Y - 50, width: 150, height: 50, type: 'stone' },
        // 冰垛 ×3（垛间藏小章鱼）
        { x: STRUCT_BASE_X + 5, y: GROUND_Y - 50 - 24, width: 30, height: 24, type: 'ice' },
        { x: STRUCT_BASE_X + 60, y: GROUND_Y - 50 - 24, width: 30, height: 24, type: 'ice' },
        { x: STRUCT_BASE_X + 115, y: GROUND_Y - 50 - 24, width: 30, height: 24, type: 'ice' },
      ],
    },

    // ====== 第24关：岩甲章王（锚点，综合）—— 章节收官：Boss 战，石壳两阶段 ======
    {
      name: '第 24 关',
      flavor: '深渊王座',   // 风味名（HUD 与关卡主题）
      birds: ['normal', 'dash', 'bomb', 'split', 'bomb', 'normal'],
      trajectory: 22,
      stars: [12000, 20000, 30000],
      pigs: [
        // 岩甲章王（Boss）：石壳掩体中，hp9；两度怒吼天降落石（砰砰爆炸克石）
        { x: STRUCT_BASE_X + 100, y: GROUND_Y - 32, radius: 32, boss: true, hp: 9, name: '岩甲章王' },
        // 石壳屋顶哨章鱼
        { x: STRUCT_BASE_X + 100, y: GROUND_Y - 120 - 14, radius: 14 },
        // 阵前地面章鱼
        { x: STRUCT_BASE_X - 32, y: GROUND_Y - 16, radius: 16 },
      ],
      blocks: [
        // 石壳左墙
        { x: STRUCT_BASE_X + 36, y: GROUND_Y - 46, width: 28, height: 46, type: 'stone' },
        { x: STRUCT_BASE_X + 36, y: GROUND_Y - 92, width: 28, height: 46, type: 'stone' },
        // 石壳右墙
        { x: STRUCT_BASE_X + 134, y: GROUND_Y - 46, width: 28, height: 46, type: 'stone' },
        { x: STRUCT_BASE_X + 134, y: GROUND_Y - 92, width: 28, height: 46, type: 'stone' },
        // 石壳屋顶
        { x: STRUCT_BASE_X + 36, y: GROUND_Y - 120, width: 126, height: 28, type: 'stone' },
        // 阶段 1（2/3 血怒吼）：天降落石 ×2
        { x: STRUCT_BASE_X + 74, y: -380, width: 28, height: 40, type: 'stone', sleep: 1 },
        { x: STRUCT_BASE_X + 129, y: -440, width: 28, height: 40, type: 'stone', sleep: 1 },
        // 阶段 2（1/3 血怒吼）：天降落石 ×2
        { x: STRUCT_BASE_X + 54, y: -260, width: 24, height: 36, type: 'stone', sleep: 2 },
        { x: STRUCT_BASE_X + 134, y: -320, width: 24, height: 36, type: 'stone', sleep: 2 },
      ],
    },

    // ============================================================
    // 第四章：极境深渊（idx 24-31）—— 硬关连发，章节开局稍作喘息
    // ============================================================

    // ====== 第25关：深海峡谷（新）—— 喘息关：石桥峡谷 ======
    {
      name: '第 25 关',
      flavor: '深海峡谷',
      birds: ['bomb', 'dash', 'normal', 'split', 'normal'],
      trajectory: 21,
      stars: [10500, 17000, 23000],
      pigs: [
        { x: STRUCT_BASE_X + 72, y: GROUND_Y - 16, radius: 16 },
        { x: STRUCT_BASE_X - 20, y: GROUND_Y - 16, radius: 16 },
        { x: STRUCT_BASE_X + 72, y: GROUND_Y - 85 - 22 - 15, radius: 15 },
        { x: STRUCT_BASE_X + 150, y: GROUND_Y - 14, radius: 14 },
      ],
      blocks: [
        // 左石壁
        { x: STRUCT_BASE_X + 20, y: GROUND_Y - 85, width: 26, height: 85, type: 'stone' },
        // 右石壁
        { x: STRUCT_BASE_X + 110, y: GROUND_Y - 85, width: 26, height: 85, type: 'stone' },
        // 木桥面
        { x: STRUCT_BASE_X + 20, y: GROUND_Y - 85 - 22, width: 116, height: 22, type: 'wood' },
      ],
    },

    // ====== 第26关：绝渊礁柱（新）—— 三根高低柱 + 冰帽 ======
    {
      name: '第 26 关',
      flavor: '绝渊礁柱',
      birds: ['split', 'bomb', 'dash', 'normal', 'normal'],
      trajectory: 21,
      stars: [10800, 17500, 23500],
      pigs: [
        { x: STRUCT_BASE_X - 25, y: GROUND_Y - 16, radius: 16 },
        { x: STRUCT_BASE_X + 48, y: GROUND_Y - 14, radius: 14 },
        { x: STRUCT_BASE_X + 105, y: GROUND_Y - 14, radius: 14 },
        { x: STRUCT_BASE_X + 23, y: GROUND_Y - 100 - 22 - 14, radius: 14 },
        { x: STRUCT_BASE_X + 138, y: GROUND_Y - 100 - 22 - 14, radius: 14 },
      ],
      blocks: [
        // 柱 1（石+冰帽，高）
        { x: STRUCT_BASE_X + 10, y: GROUND_Y - 100, width: 26, height: 100, type: 'stone' },
        { x: STRUCT_BASE_X + 6, y: GROUND_Y - 100 - 22, width: 34, height: 22, type: 'ice' },
        // 柱 2（木+冰帽，矮）
        { x: STRUCT_BASE_X + 70, y: GROUND_Y - 75, width: 26, height: 75, type: 'wood' },
        { x: STRUCT_BASE_X + 66, y: GROUND_Y - 75 - 22, width: 34, height: 22, type: 'ice' },
        // 柱 3（石+冰帽，高）
        { x: STRUCT_BASE_X + 125, y: GROUND_Y - 100, width: 26, height: 100, type: 'stone' },
        { x: STRUCT_BASE_X + 121, y: GROUND_Y - 100 - 22, width: 34, height: 22, type: 'ice' },
      ],
    },

    // ====== 第27关：寒流闸门（新）—— 重石门 + 爆裂果 ======
    {
      name: '第 27 关',
      flavor: '寒流闸门',
      birds: ['bomb', 'split', 'dash', 'normal', 'normal'],
      trajectory: 20,
      stars: [11200, 18000, 24000],
      pigs: [
        { x: STRUCT_BASE_X + 62, y: GROUND_Y - 16, radius: 16 },
        { x: STRUCT_BASE_X - 45, y: GROUND_Y - 15, radius: 15 },
        { x: STRUCT_BASE_X + 62, y: GROUND_Y - 95 - 26 - 15, radius: 15 },
        { x: STRUCT_BASE_X + 140, y: GROUND_Y - 16, radius: 16 },
        { x: STRUCT_BASE_X - 80, y: GROUND_Y - 14, radius: 14 },
      ],
      blocks: [
        // 左石门柱
        { x: STRUCT_BASE_X + 30, y: GROUND_Y - 95, width: BLOCK_W, height: 95, type: 'stone' },
        // 右石门柱
        { x: STRUCT_BASE_X + 95, y: GROUND_Y - 95, width: BLOCK_W, height: 95, type: 'stone' },
        // 石门楣
        { x: STRUCT_BASE_X + 30, y: GROUND_Y - 95 - 26, width: 93, height: 26, type: 'stone' },
        // 爆裂果（阵前）
        { x: STRUCT_BASE_X - 15, y: GROUND_Y - 24, width: 24, height: 24, type: 'burst' },
      ],
    },

    // ====== 第28关：漩涡碉堡（锚点） ======
    {
      name: '第 28 关',
      flavor: '漩涡碉堡',
      birds: ['bomb', 'dash', 'normal', 'normal', 'normal'],
      trajectory: 22,
      stars: [10000, 16000, 22500],
      pigs: [
        { x: STRUCT_BASE_X - 14, y: GROUND_Y - 16, radius: 16 },
        { x: STRUCT_BASE_X + 116, y: GROUND_Y - 18, radius: 18 },
        { x: STRUCT_BASE_X + 30, y: GROUND_Y - 16, radius: 16 },
        { x: STRUCT_BASE_X + 56, y: GROUND_Y - 80 - 28 - 55 - 28 - 16, radius: 16 },
        { x: STRUCT_BASE_X + 16, y: GROUND_Y - 80 - 28 - 14, radius: 14 },
      ],
      blocks: [
        // 两岸石柱
        { x: STRUCT_BASE_X, y: GROUND_Y - 80, width: 28, height: 80, type: 'stone' },
        { x: STRUCT_BASE_X + 90, y: GROUND_Y - 80, width: 28, height: 80, type: 'stone' },
        // 下石梁
        { x: STRUCT_BASE_X, y: GROUND_Y - 80 - 28, width: 118, height: 28, type: 'stone' },
        // 上木柱
        { x: STRUCT_BASE_X + 8, y: GROUND_Y - 80 - 28 - 55, width: 28, height: 55, type: 'wood' },
        { x: STRUCT_BASE_X + 80, y: GROUND_Y - 80 - 28 - 55, width: 28, height: 55, type: 'wood' },
        // 上冰梁
        { x: STRUCT_BASE_X + 8, y: GROUND_Y - 80 - 28 - 55 - 28, width: 100, height: 28, type: 'ice' },
        // 爆裂果（冰梁顶）
        { x: STRUCT_BASE_X + 44, y: GROUND_Y - 80 - 28 - 55 - 28 - 26, width: 26, height: 26, type: 'burst' },
      ],
    },

    // ====== 第29关：断崖炮台（锚点） ======
    {
      name: '第 29 关',
      flavor: '断崖炮台',
      birds: ['bomb', 'split', 'dash', 'normal', 'normal'],
      trajectory: 20,
      stars: [10500, 16500, 23000],
      pigs: [
        { x: STRUCT_BASE_X - 15, y: GROUND_Y - 16, radius: 16 },
        { x: STRUCT_BASE_X + 135, y: GROUND_Y - 18, radius: 18 },
        { x: STRUCT_BASE_X + 60, y: GROUND_Y - 16, radius: 16 },
        { x: STRUCT_BASE_X + 72, y: GROUND_Y - 95 - 28 - 22 - 16, radius: 16 },
        { x: STRUCT_BASE_X + 20, y: GROUND_Y - 95 - 28 - 14, radius: 14 },
      ],
      blocks: [
        // 三石柱
        { x: STRUCT_BASE_X, y: GROUND_Y - 95, width: 28, height: 95, type: 'stone' },
        { x: STRUCT_BASE_X + 60, y: GROUND_Y - 95, width: 28, height: 95, type: 'stone' },
        { x: STRUCT_BASE_X + 118, y: GROUND_Y - 95, width: 28, height: 95, type: 'stone' },
        // 下石梁
        { x: STRUCT_BASE_X, y: GROUND_Y - 95 - 28, width: 146, height: 28, type: 'stone' },
        // 上冰桥
        { x: STRUCT_BASE_X + 28, y: GROUND_Y - 95 - 28 - 22, width: 90, height: 22, type: 'ice' },
        // 爆裂果
        { x: STRUCT_BASE_X + 60, y: GROUND_Y - 95 - 28 - 22 - 26, width: 26, height: 26, type: 'burst' },
      ],
    },

    // ====== 第30关：冰火长城（锚点） ======
    {
      name: '第 30 关',
      flavor: '冰火长城',
      birds: ['split', 'bomb', 'dash', 'normal', 'normal'],
      trajectory: 18,
      stars: [11000, 17000, 23500],
      pigs: [
        { x: STRUCT_BASE_X - 16, y: GROUND_Y - 16, radius: 16 },
        { x: STRUCT_BASE_X + 142, y: GROUND_Y - 18, radius: 18 },
        { x: STRUCT_BASE_X + 58, y: GROUND_Y - 16, radius: 16 },
        { x: STRUCT_BASE_X + 34, y: GROUND_Y - 95 - 28 - 26 - 16, radius: 16 },
        { x: STRUCT_BASE_X + 104, y: GROUND_Y - 95 - 28 - 26 - 16, radius: 16 },
      ],
      blocks: [
        // 冰柱 + 中石柱
        { x: STRUCT_BASE_X, y: GROUND_Y - 95, width: 26, height: 95, type: 'ice' },
        { x: STRUCT_BASE_X + 112, y: GROUND_Y - 95, width: 26, height: 95, type: 'ice' },
        { x: STRUCT_BASE_X + 58, y: GROUND_Y - 95, width: 26, height: 95, type: 'stone' },
        // 冰横梁
        { x: STRUCT_BASE_X, y: GROUND_Y - 95 - 28, width: 138, height: 28, type: 'ice' },
        // 石顶（左/右）
        { x: STRUCT_BASE_X + 14, y: GROUND_Y - 95 - 28 - 26, width: 40, height: 26, type: 'stone' },
        { x: STRUCT_BASE_X + 84, y: GROUND_Y - 95 - 28 - 26, width: 40, height: 26, type: 'stone' },
      ],
    },

    // ====== 第31关：赤渊门阵（新）—— 双石塔 + 冰墩桥 ======
    {
      name: '第 31 关',
      flavor: '赤渊门阵',
      birds: ['bomb', 'bomb', 'split', 'dash', 'normal', 'normal'],
      trajectory: 17,
      stars: [11800, 18500, 25000],
      pigs: [
        { x: STRUCT_BASE_X + 25, y: GROUND_Y - 14, radius: 14 },
        { x: STRUCT_BASE_X + 120, y: GROUND_Y - 14, radius: 14 },
        { x: STRUCT_BASE_X + 70, y: GROUND_Y - 35 - 18 - 15, radius: 15 },
        { x: STRUCT_BASE_X + 25, y: GROUND_Y - 90 - 24 - 14, radius: 14 },
        { x: STRUCT_BASE_X - 30, y: GROUND_Y - 16, radius: 16 },
      ],
      blocks: [
        // T1 石塔
        { x: STRUCT_BASE_X + 0, y: GROUND_Y - 90, width: 26, height: 90, type: 'stone' },
        { x: STRUCT_BASE_X + 34, y: GROUND_Y - 90, width: 26, height: 90, type: 'stone' },
        { x: STRUCT_BASE_X + 0, y: GROUND_Y - 90 - 24, width: 60, height: 24, type: 'stone' },
        // T2 石塔
        { x: STRUCT_BASE_X + 95, y: GROUND_Y - 90, width: 26, height: 90, type: 'stone' },
        { x: STRUCT_BASE_X + 129, y: GROUND_Y - 90, width: 26, height: 90, type: 'stone' },
        { x: STRUCT_BASE_X + 95, y: GROUND_Y - 90 - 24, width: 60, height: 24, type: 'stone' },
        // 中央冰墩 + 矮冰桥（塔间净空 B+60..B+95，桥不触塔）
        { x: STRUCT_BASE_X + 66, y: GROUND_Y - 35, width: 20, height: 35, type: 'ice' },
        { x: STRUCT_BASE_X + 62, y: GROUND_Y - 35 - 18, width: 32, height: 18, type: 'ice' },
      ],
    },

    // ====== 第32关：深渊章王（新）—— 章节收官：Boss 战，混合壳三阶段（落石+召唤） ======
    {
      name: '第 32 关',
      flavor: '梦魇海脊',
      birds: ['bomb', 'split', 'dash', 'bomb', 'split', 'normal'],
      trajectory: 16,
      stars: [12800, 20500, 27000],
      pigs: [
        // 深渊章王（Boss）：石墙木墙冰顶混合壳，hp11，三度怒吼
        { x: STRUCT_BASE_X + 98, y: GROUND_Y - 33, radius: 33, boss: true, hp: 11, name: '深渊章王' },
        // 屋顶哨章鱼
        { x: STRUCT_BASE_X + 98, y: GROUND_Y - 120 - 13, radius: 13 },
        // 阵前地面章鱼
        { x: STRUCT_BASE_X - 46, y: GROUND_Y - 16, radius: 16 },
        // 阶段 2 召唤：援军小章鱼 ×2（预置屏外，怒吼时落下）
        { x: STRUCT_BASE_X + 74, y: -250, radius: 14, sleep: 2 },
        { x: STRUCT_BASE_X + 119, y: -310, radius: 14, sleep: 2 },
        // 阶段 3 召唤：援军小章鱼 ×1
        { x: STRUCT_BASE_X + 99, y: -370, radius: 15, sleep: 3 },
      ],
      blocks: [
        // 混合壳：左石墙（砰砰破）
        { x: STRUCT_BASE_X + 31, y: GROUND_Y - 46, width: 28, height: 46, type: 'stone' },
        { x: STRUCT_BASE_X + 31, y: GROUND_Y - 92, width: 28, height: 46, type: 'stone' },
        // 右木墙（梭梭破）
        { x: STRUCT_BASE_X + 133, y: GROUND_Y - 46, width: 28, height: 46, type: 'wood' },
        { x: STRUCT_BASE_X + 133, y: GROUND_Y - 92, width: 28, height: 46, type: 'wood' },
        // 冰顶（三丸子破）
        { x: STRUCT_BASE_X + 31, y: GROUND_Y - 120, width: 130, height: 28, type: 'ice' },
        // 阶段 1：天降落石 ×2
        { x: STRUCT_BASE_X + 69, y: -380, width: 28, height: 40, type: 'stone', sleep: 1 },
        { x: STRUCT_BASE_X + 124, y: -440, width: 28, height: 40, type: 'stone', sleep: 1 },
        // 阶段 3：天降落石 ×1
        { x: STRUCT_BASE_X + 99, y: -300, width: 26, height: 38, type: 'stone', sleep: 3 },
      ],
    },

    // ============================================================
    // 第五章：潮汐王座（idx 32-39）—— 终章：重石结构与豚队列极限
    // ============================================================

    // ====== 第33关：曜海三台（新）—— 三层石阶递进 ======
    {
      name: '第 33 关',
      flavor: '曜海三台',
      birds: ['bomb', 'split', 'dash', 'bomb', 'normal', 'normal'],
      trajectory: 15,
      stars: [12500, 20000, 26500],
      pigs: [
        { x: STRUCT_BASE_X + 12, y: GROUND_Y - 45 - 14, radius: 14 },
        { x: STRUCT_BASE_X + 128, y: GROUND_Y - 45 - 14, radius: 14 },
        { x: STRUCT_BASE_X + 105, y: GROUND_Y - 45 - 45 - 13, radius: 13 },
        { x: STRUCT_BASE_X + 63, y: GROUND_Y - 45 - 45 - 45 - 14, radius: 14 },
        { x: STRUCT_BASE_X - 30, y: GROUND_Y - 16, radius: 16 },
      ],
      blocks: [
        // 一层台基
        { x: STRUCT_BASE_X + 0, y: GROUND_Y - 45, width: 140, height: 45, type: 'stone' },
        // 二层台基
        { x: STRUCT_BASE_X + 25, y: GROUND_Y - 45 - 45, width: 90, height: 45, type: 'stone' },
        // 三层台基
        { x: STRUCT_BASE_X + 45, y: GROUND_Y - 45 - 45 - 45, width: 36, height: 45, type: 'stone' },
      ],
    },

    // ====== 第34关：沉殿王厅（新）—— 石柱大厅 + 内冰龛 ======
    {
      name: '第 34 关',
      flavor: '沉殿王厅',
      birds: ['bomb', 'split', 'dash', 'bomb', 'split', 'normal'],
      trajectory: 15,
      stars: [13000, 20500, 27500],
      pigs: [
        { x: STRUCT_BASE_X + 35, y: GROUND_Y - 14, radius: 14 },
        { x: STRUCT_BASE_X + 110, y: GROUND_Y - 14, radius: 14 },
        { x: STRUCT_BASE_X + 79, y: GROUND_Y - 30 - 13, radius: 13 },
        { x: STRUCT_BASE_X + 40, y: GROUND_Y - 100 - 26 - 14, radius: 14 },
        { x: STRUCT_BASE_X + 105, y: GROUND_Y - 100 - 26 - 14, radius: 14 },
        { x: STRUCT_BASE_X - 30, y: GROUND_Y - 16, radius: 16 },
      ],
      blocks: [
        // 左石柱
        { x: STRUCT_BASE_X + 10, y: GROUND_Y - 100, width: BLOCK_W, height: 100, type: 'stone' },
        // 右石柱
        { x: STRUCT_BASE_X + 120, y: GROUND_Y - 100, width: BLOCK_W, height: 100, type: 'stone' },
        // 石门楣
        { x: STRUCT_BASE_X + 10, y: GROUND_Y - 100 - 26, width: 138, height: 26, type: 'stone' },
        // 内冰龛（地面小章鱼的掩体）
        { x: STRUCT_BASE_X + 65, y: GROUND_Y - 30, width: 28, height: 30, type: 'ice' },
      ],
    },

    // ====== 第35关：王座前奏（新）—— 木塔石塔对望 + 爆裂果 ======
    {
      name: '第 35 关',
      flavor: '王座前奏',
      birds: ['split', 'bomb', 'dash', 'bomb', 'split', 'normal'],
      trajectory: 14,
      stars: [13200, 21000, 28000],
      pigs: [
        { x: STRUCT_BASE_X + 22, y: GROUND_Y - 13, radius: 13 },
        { x: STRUCT_BASE_X + 22, y: GROUND_Y - 85 - 22 - 13, radius: 13 },
        { x: STRUCT_BASE_X + 125, y: GROUND_Y - 14, radius: 14 },
        { x: STRUCT_BASE_X + 125, y: GROUND_Y - 95 - 24 - 14, radius: 14 },
        { x: STRUCT_BASE_X - 30, y: GROUND_Y - 16, radius: 16 },
        { x: STRUCT_BASE_X + 60, y: GROUND_Y - 13, radius: 13 },
      ],
      blocks: [
        // 左木塔
        { x: STRUCT_BASE_X + 0, y: GROUND_Y - 85, width: 24, height: 85, type: 'wood' },
        { x: STRUCT_BASE_X + 32, y: GROUND_Y - 85, width: 24, height: 85, type: 'wood' },
        { x: STRUCT_BASE_X + 0, y: GROUND_Y - 85 - 22, width: 56, height: 22, type: 'wood' },
        // 右石塔
        { x: STRUCT_BASE_X + 100, y: GROUND_Y - 95, width: 26, height: 95, type: 'stone' },
        { x: STRUCT_BASE_X + 136, y: GROUND_Y - 95, width: 26, height: 95, type: 'stone' },
        { x: STRUCT_BASE_X + 100, y: GROUND_Y - 95 - 24, width: 62, height: 24, type: 'stone' },
        // 爆裂果（两塔之间）
        { x: STRUCT_BASE_X + 75, y: GROUND_Y - 24, width: 24, height: 24, type: 'burst' },
      ],
    },

    // ====== 第36关：三重堡垒（锚点） ======
    {
      name: '第 36 关',
      flavor: '三重堡垒',
      birds: ['bomb', 'dash', 'split', 'bomb', 'normal', 'normal'],
      trajectory: 16,
      stars: [13500, 21500, 29500],
      pigs: [
        { x: STRUCT_BASE_X - 16, y: GROUND_Y - 16, radius: 16 },
        { x: STRUCT_BASE_X + 8, y: GROUND_Y - 70 - 26 - 16, radius: 16 },
        { x: STRUCT_BASE_X + 45, y: GROUND_Y - 16, radius: 16 },
        { x: STRUCT_BASE_X + 59, y: GROUND_Y - 95 - 60 - 26 - 16, radius: 16 },
        { x: STRUCT_BASE_X + 131, y: GROUND_Y - 18, radius: 18 },
        { x: STRUCT_BASE_X + 120, y: GROUND_Y - 80 - 26 - 16, radius: 16 },
      ],
      blocks: [
        // A 塔（短）
        { x: STRUCT_BASE_X - 5, y: GROUND_Y - 70, width: 26, height: 70, type: 'stone' },
        { x: STRUCT_BASE_X - 5, y: GROUND_Y - 70 - 26, width: 30, height: 26, type: 'wood' },
        // B 塔（高）
        { x: STRUCT_BASE_X + 45, y: GROUND_Y - 95, width: 28, height: 95, type: 'wood' },
        { x: STRUCT_BASE_X + 45, y: GROUND_Y - 95 - 60, width: 28, height: 60, type: 'stone' },
        { x: STRUCT_BASE_X + 43, y: GROUND_Y - 95 - 60 - 26, width: 32, height: 26, type: 'ice' },
        // C 塔（中）
        { x: STRUCT_BASE_X + 105, y: GROUND_Y - 80, width: 26, height: 80, type: 'stone' },
        { x: STRUCT_BASE_X + 105, y: GROUND_Y - 80 - 26, width: 30, height: 26, type: 'wood' },
      ],
    },

    // ====== 第37关：潮汐要塞（锚点） ======
    {
      name: '第 37 关',
      flavor: '潮汐要塞',
      birds: ['bomb', 'bomb', 'split', 'dash', 'normal', 'normal'],
      trajectory: 14,
      stars: [14000, 22500, 30500],
      pigs: [
        { x: STRUCT_BASE_X - 16, y: GROUND_Y - 16, radius: 16 },
        { x: STRUCT_BASE_X + 140, y: GROUND_Y - 18, radius: 18 },
        { x: STRUCT_BASE_X + 58, y: GROUND_Y - 16, radius: 16 },
        { x: STRUCT_BASE_X + 72, y: GROUND_Y - 100 - 28 - 18, radius: 18 },
        { x: STRUCT_BASE_X + 40, y: GROUND_Y - 100 - 28 - 55 - 26 - 16, radius: 16 },
        { x: STRUCT_BASE_X + 104, y: GROUND_Y - 100 - 28 - 55 - 26 - 16, radius: 16 },
      ],
      blocks: [
        // 双石门塔 + 门楣
        { x: STRUCT_BASE_X, y: GROUND_Y - 100, width: 28, height: 100, type: 'stone' },
        { x: STRUCT_BASE_X + 118, y: GROUND_Y - 100, width: 28, height: 100, type: 'stone' },
        { x: STRUCT_BASE_X, y: GROUND_Y - 100 - 28, width: 146, height: 28, type: 'stone' },
        // 上木柱
        { x: STRUCT_BASE_X + 20, y: GROUND_Y - 100 - 28 - 55, width: 28, height: 55, type: 'wood' },
        { x: STRUCT_BASE_X + 96, y: GROUND_Y - 100 - 28 - 55, width: 28, height: 55, type: 'wood' },
        // 上冰檐
        { x: STRUCT_BASE_X + 20, y: GROUND_Y - 100 - 28 - 55 - 26, width: 104, height: 26, type: 'ice' },
        // 爆裂果（冰檐顶）
        { x: STRUCT_BASE_X + 60, y: GROUND_Y - 100 - 28 - 55 - 26 - 26, width: 26, height: 26, type: 'burst' },
      ],
    },

    // ====== 第38关：终潮堡垒（新）======
    // TODO(由你设计，可选)：这一关与下一关是全游戏难度顶点，当前给出可玩的
    // 默认实现（双重石门 + 内庭冰龛，7 章鱼 6 豚）。真正的取舍留给你：
    //   1) 结构：重石门楣硬抗（当前） vs 多重内庭层层保护？
    //   2) 豚队列：双 bomb 正面破墙（当前）还是 双 split 扫冰檐？
    //   3) 爆裂果位置：内庭中央（连锁清场）vs 门前（先手消耗）？
    // 直接改下面的 pigs / blocks / birds 即可（改完跑 node tools/validate-levels.js）。
    // 建议数值区间：trajectory 12-13；stars [14500-15500, 23000-24000, 31000-32500]。
    {
      name: '第 38 关',
      flavor: '终潮堡垒',
      birds: ['bomb', 'bomb', 'split', 'dash', 'normal', 'normal'],
      trajectory: 13,
      stars: [15000, 23500, 32000],
      pigs: [
        { x: STRUCT_BASE_X + 78, y: GROUND_Y - 15, radius: 15 },   // 内庭中央
        { x: STRUCT_BASE_X + 78, y: GROUND_Y - 60 - 22 - 14, radius: 14 }, // 冰龛檐上
        { x: STRUCT_BASE_X + 20, y: GROUND_Y - 13, radius: 13 },   // 门内左
        { x: STRUCT_BASE_X + 78, y: GROUND_Y - 100 - 26 - 14, radius: 14 }, // 门楣上
        { x: STRUCT_BASE_X + 120, y: GROUND_Y - 100 - 26 - 13, radius: 13 }, // 门楣右
        { x: STRUCT_BASE_X - 35, y: GROUND_Y - 16, radius: 16 },   // 阵前
      ],
      blocks: [
        // 外石门（重石）
        { x: STRUCT_BASE_X + 0, y: GROUND_Y - 100, width: BLOCK_W, height: 100, type: 'stone' },
        { x: STRUCT_BASE_X + 130, y: GROUND_Y - 100, width: BLOCK_W, height: 100, type: 'stone' },
        { x: STRUCT_BASE_X + 0, y: GROUND_Y - 100 - 26, width: 158, height: 26, type: 'stone' },
        // 内庭冰龛（保护中央章鱼）
        { x: STRUCT_BASE_X + 40, y: GROUND_Y - 60, width: 22, height: 60, type: 'ice' },
        { x: STRUCT_BASE_X + 95, y: GROUND_Y - 60, width: 22, height: 60, type: 'ice' },
        { x: STRUCT_BASE_X + 40, y: GROUND_Y - 60 - 22, width: 77, height: 22, type: 'ice' },
      ],
    },

    // ====== 第39关：王庭之门（新）======
    // TODO(由你设计，可选)：终章前哨。默认实现为「巨石门 + 冰神龛 + 爆裂果」，
    // 7 章鱼全技能队列。可调整方向同上一关；注意 7 章鱼是全游戏最大章鱼数，
    // 三星门槛 33000 已接近理论满分上限，别再上调。
    {
      name: '第 39 关',
      flavor: '王庭之门',
      birds: ['bomb', 'split', 'dash', 'bomb', 'split', 'normal'],
      trajectory: 12,
      stars: [15500, 24000, 33000],
      pigs: [
        { x: STRUCT_BASE_X + 47, y: GROUND_Y - 13, radius: 13 },   // 龛左地面
        { x: STRUCT_BASE_X + 67, y: GROUND_Y - 50 - 20 - 12, radius: 12 }, // 龛顶
        { x: STRUCT_BASE_X + 45, y: GROUND_Y - 110 - 28 - 13, radius: 13 }, // 门楣左
        { x: STRUCT_BASE_X + 78, y: GROUND_Y - 110 - 28 - 12, radius: 12 }, // 门楣中
        { x: STRUCT_BASE_X + 110, y: GROUND_Y - 110 - 28 - 13, radius: 13 }, // 门楣右
        { x: STRUCT_BASE_X - 35, y: GROUND_Y - 16, radius: 16 },   // 阵前左
        { x: STRUCT_BASE_X - 70, y: GROUND_Y - 15, radius: 15 },   // 阵前更左
      ],
      blocks: [
        // 巨型石门柱
        { x: STRUCT_BASE_X + 5, y: GROUND_Y - 110, width: 30, height: 110, type: 'stone' },
        { x: STRUCT_BASE_X + 125, y: GROUND_Y - 110, width: 30, height: 110, type: 'stone' },
        // 巨石门楣
        { x: STRUCT_BASE_X + 5, y: GROUND_Y - 110 - 28, width: 150, height: 28, type: 'stone' },
        // 内冰龛
        { x: STRUCT_BASE_X + 55, y: GROUND_Y - 50, width: 24, height: 50, type: 'ice' },
        { x: STRUCT_BASE_X + 51, y: GROUND_Y - 50 - 20, width: 32, height: 20, type: 'ice' },
        // 爆裂果（龛右侧，引爆连锁清内庭）
        { x: STRUCT_BASE_X + 95, y: GROUND_Y - 24, width: 24, height: 24, type: 'burst' },
      ],
    },

    // ====== 第40关：王座终焉（锚点）—— 终极 Boss：潮汐王座·章王，三阶段收官 ======
    {
      name: '第 40 关',
      flavor: '王座终焉',
      birds: ['bomb', 'split', 'dash', 'bomb', 'split', 'normal'],
      trajectory: 12,
      stars: [16000, 25000, 34000],
      pigs: [
        // 潮汐王座·章王（最终 Boss）：双层壳，hp14，三度怒吼（落石+爆裂果+召唤）
        { x: STRUCT_BASE_X + 96, y: GROUND_Y - 34, radius: 34, boss: true, hp: 14, name: '潮汐王座·章王' },
        // 屋顶哨章鱼
        { x: STRUCT_BASE_X + 96, y: GROUND_Y - 120 - 14, radius: 14 },
        // 阵前地面章鱼
        { x: STRUCT_BASE_X - 56, y: GROUND_Y - 16, radius: 16 },
        // 阶段 2 召唤：援军小章鱼 ×2
        { x: STRUCT_BASE_X + 69, y: -260, radius: 14, sleep: 2 },
        { x: STRUCT_BASE_X + 124, y: -330, radius: 15, sleep: 2 },
        // 阶段 3 召唤：援军小章鱼 ×1
        { x: STRUCT_BASE_X + 94, y: -380, radius: 16, sleep: 3 },
      ],
      blocks: [
        // 双石墙 + 石主梁
        { x: STRUCT_BASE_X + 24, y: GROUND_Y - 46, width: 28, height: 46, type: 'stone' },
        { x: STRUCT_BASE_X + 24, y: GROUND_Y - 92, width: 28, height: 46, type: 'stone' },
        { x: STRUCT_BASE_X + 132, y: GROUND_Y - 46, width: 28, height: 46, type: 'stone' },
        { x: STRUCT_BASE_X + 132, y: GROUND_Y - 92, width: 28, height: 46, type: 'stone' },
        { x: STRUCT_BASE_X + 24, y: GROUND_Y - 120, width: 136, height: 28, type: 'stone' },
        // 内层冰顶（双层壳：先碎冰再炸石）
        { x: STRUCT_BASE_X + 56, y: GROUND_Y - 148, width: 74, height: 24, type: 'ice' },
        // 阶段 1：天降落石 ×2
        { x: STRUCT_BASE_X + 64, y: -400, width: 30, height: 42, type: 'stone', sleep: 1 },
        { x: STRUCT_BASE_X + 129, y: -470, width: 30, height: 42, type: 'stone', sleep: 1 },
        // 阶段 2：天降爆裂果 ×1
        { x: STRUCT_BASE_X + 102, y: -340, width: 28, height: 28, type: 'burst', sleep: 2 },
        // 阶段 3：天降落石 ×2
        { x: STRUCT_BASE_X + 84, y: -300, width: 28, height: 40, type: 'stone', sleep: 3 },
        { x: STRUCT_BASE_X + 139, y: -380, width: 28, height: 40, type: 'stone', sleep: 3 },
      ],
    },
  ];
}

module.exports = { getLevels };
