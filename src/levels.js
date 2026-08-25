/**
 * 关卡数据 - 10个递进难度的关卡
 * Level Data - 10 progressively challenging levels
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
    // ====== 第1关：教程 - 地面上的猪 ======
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

    // ====== 第2关：简单木屋 ======
    {
      name: '第 2 关',
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

    // ====== 第3关：石塔 ======
    {
      name: '第 3 关',
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

    // ====== 第4关：混合堡垒 ======
    {
      name: '第 4 关',
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

    // ====== 第5关：珊瑚要塞 ======
    {
      name: '第 5 关',
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

    // ====== 第6关：双子塔 ======
    {
      name: '第 6 关',
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

    // ====== 第7关：阶梯塔 ======
    {
      name: '第 7 关',
      flavor: '潮阶塔林',   // 风味名（HUD 与关卡主题）
      hint: '新技能：三丸子空中点击一分为三！', // 首次进入显示技能教学
      birds: ['normal', 'split', 'dash', 'bomb', 'normal'],
      trajectory: 30,
      stars: [8000, 14000, 21000],
      pigs: [
        // 前左地面
        { x: STRUCT_BASE_X - 28, y: GROUND_Y - 18, radius: 18 },
        // 左柱顶
        { x: STRUCT_BASE_X + 13, y: GROUND_Y - 120 - 70 - 26 - 18, radius: 16 },
        // 中柱顶
        { x: STRUCT_BASE_X + 60, y: GROUND_Y - 90 - 60 - 24 - 18, radius: 16 },
        // 右柱顶
        { x: STRUCT_BASE_X + 110, y: GROUND_Y - 60 - 24 - 18, radius: 16 },
      ],
      blocks: [
        // 左柱（石+木+冰）
        { x: STRUCT_BASE_X + 0, y: GROUND_Y - 120, width: 30, height: 120, type: 'stone' },
        { x: STRUCT_BASE_X + 0, y: GROUND_Y - 120 - 70, width: 30, height: 70, type: 'wood' },
        { x: STRUCT_BASE_X - 2, y: GROUND_Y - 120 - 70 - 26, width: 34, height: 26, type: 'ice' },
        // 中柱（木+石+冰）——柱顶冰帽加宽：本关首只即三丸子（分裂对冰 2 倍克制），
        // 宽冰帽让"分裂→破冰"的解法在关卡结构里自解释，技能教学即关卡本身
        { x: STRUCT_BASE_X + 45, y: GROUND_Y - 90, width: 30, height: 90, type: 'wood' },
        { x: STRUCT_BASE_X + 45, y: GROUND_Y - 90 - 60, width: 30, height: 60, type: 'stone' },
        { x: STRUCT_BASE_X + 33, y: GROUND_Y - 90 - 60 - 24, width: 54, height: 24, type: 'ice' },
        // 右柱（木+冰）
        { x: STRUCT_BASE_X + 95, y: GROUND_Y - 60, width: 30, height: 60, type: 'wood' },
        { x: STRUCT_BASE_X + 93, y: GROUND_Y - 60 - 24, width: 34, height: 24, type: 'ice' },
      ],
      // 隐藏珍珠：画面右尽头、右柱上方（极限射程）
      pearls: [{ id: 'lv6', x: STRUCT_BASE_X + 130, y: GROUND_Y - 120 }],
    },

    // ====== 第8关：冰晶宫（全冰，脆） ======
    {
      name: '第 8 关',
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

    // ====== 第9关：钢铁方阵（全石，硬） ======
    {
      name: '第 9 关',
      flavor: '钢铁方阵',   // 风味名（HUD 与关卡主题）
      birds: ['bomb', 'bomb', 'normal', 'dash', 'normal', 'normal'],
      trajectory: 30,
      stars: [10000, 17000, 23000],
      pigs: [
        // 宫内左地面
        { x: STRUCT_BASE_X + 43, y: GROUND_Y - 16, radius: 16 },
        // 宫内右地面
        { x: STRUCT_BASE_X + 77, y: GROUND_Y - 16, radius: 16 },
        // 屋顶猪 1
        { x: STRUCT_BASE_X + 40, y: GROUND_Y - 100 - 24 - 18, radius: 16 },
        // 屋顶猪 2
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
      // 隐藏珍珠：石檐正上方（越过檐上双猪的高点）
      pearls: [{ id: 'lv8', x: STRUCT_BASE_X + 60, y: GROUND_Y - 170 }],
    },

    // ====== 第10关：终极要塞（综合） ======
    {
      name: '第 10 关',
      flavor: '深渊王座',   // 风味名（HUD 与关卡主题）
      birds: ['normal', 'dash', 'bomb', 'split', 'bomb', 'normal'],
      trajectory: 22,
      stars: [12000, 20000, 30000],
      pigs: [
        // 左塔顶（桥未覆盖的左端）
        { x: STRUCT_BASE_X - 2, y: GROUND_Y - 90 - 24 - 18, radius: 16 },
        // 右堡顶猪 1
        { x: STRUCT_BASE_X + 112, y: GROUND_Y - 100 - 24 - 18, radius: 16 },
        // 右堡顶猪 2
        { x: STRUCT_BASE_X + 142, y: GROUND_Y - 100 - 24 - 18, radius: 14 },
        // 桥上
        { x: STRUCT_BASE_X + 55, y: GROUND_Y - 90 - 24 - 20 - 16, radius: 14 },
        // 前左地面
        { x: STRUCT_BASE_X - 35, y: GROUND_Y - 18, radius: 16 },
        // 中央地面
        { x: STRUCT_BASE_X + 69, y: GROUND_Y - 18, radius: 16 },
      ],
      blocks: [
        // 左塔（石）
        { x: STRUCT_BASE_X - 10, y: GROUND_Y - 90, width: 26, height: 90, type: 'stone' },
        { x: STRUCT_BASE_X + 18, y: GROUND_Y - 90, width: 26, height: 90, type: 'stone' },
        { x: STRUCT_BASE_X - 10, y: GROUND_Y - 90 - 24, width: 54, height: 24, type: 'wood' },
        // 右堡（石）
        { x: STRUCT_BASE_X + 95, y: GROUND_Y - 100, width: 28, height: 100, type: 'stone' },
        { x: STRUCT_BASE_X + 128, y: GROUND_Y - 100, width: 28, height: 100, type: 'stone' },
        { x: STRUCT_BASE_X + 95, y: GROUND_Y - 100 - 24, width: 61, height: 24, type: 'stone' },
        // 中央桥（冰）
        { x: STRUCT_BASE_X + 14, y: GROUND_Y - 90 - 24 - 20, width: 81, height: 20, type: 'ice' },
      ],
    },
  ];
}

module.exports = { getLevels };
