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

    // ====== 第2关：平沙练靶 —— 第一座木屋：屋中章鱼要先破木 ======
    // 木 hp3 已能扛住普通嘟嘟的弱撞，正面平射被左柱挡住，得撞柱/塌顶或高抛。
    {
      name: '第 2 关',
      flavor: '平沙练靶',
      birds: ['normal', 'normal', 'normal', 'normal'],
      trajectory: 65,
      stars: [2500, 5000, 7500],
      pigs: [
        { x: STRUCT_BASE_X - 22, y: GROUND_Y - 18, radius: 18 },            // 屋前裸豚（直射练靶）
        { x: STRUCT_BASE_X + 82, y: GROUND_Y - 16, radius: 15 },            // 紧贴立木后（碎木即撞猪，一发带走）
        { x: STRUCT_BASE_X + 140, y: GROUND_Y - 96, radius: 15 },           // 木柱顶（高抛目标，顶上无遮蔽）
      ],
      blocks: [
        // 挡在中路豚前的立木（贴紧猪，满力撞碎后余势立刻撞到猪）
        { x: STRUCT_BASE_X + 44, y: GROUND_Y - 56, width: 28, height: 56, type: 'wood' },
        // 托高柱顶豚的木柱（猪在柱顶裸露，可高抛直砸）
        { x: STRUCT_BASE_X + 126, y: GROUND_Y - 80, width: 28, height: 80, type: 'wood' },
      ],
    },

    // ====== 第3关：孤屿木屋 —— 梭梭冲刺教学：克木一撞断柱、木楼坍塌 ======
    {
      name: '第 3 关',
      flavor: '孤屿木屋',   // 风味名（HUD 与关卡主题）
      hint: '新技能：梭梭空中点击极速冲刺！', // 首次进入显示技能教学
      birds: ['dash', 'normal', 'normal', 'normal'],
      trajectory: 60,
      stars: [3000, 6000, 9000],
      pigs: [
        { x: STRUCT_BASE_X + 64, y: GROUND_Y - 17, radius: 15 },            // 下层木屋里
        { x: STRUCT_BASE_X + 67, y: GROUND_Y - 113, radius: 15 },           // 二层楼板上
        { x: STRUCT_BASE_X + 150, y: GROUND_Y - 16, radius: 16 },           // 远处地面
      ],
      blocks: [
        // 下层四柱两柱
        { x: STRUCT_BASE_X + 14, y: GROUND_Y - 72, width: 28, height: 72, type: 'wood' },
        { x: STRUCT_BASE_X + 86, y: GROUND_Y - 72, width: 28, height: 72, type: 'wood' },
        // 一层楼板
        { x: STRUCT_BASE_X + 6, y: GROUND_Y - 98, width: 116, height: 26, type: 'wood' },
        // 上层两柱（梭梭断下柱即整体坍塌）
        { x: STRUCT_BASE_X + 26, y: GROUND_Y - 148, width: 28, height: 50, type: 'wood' },
        { x: STRUCT_BASE_X + 80, y: GROUND_Y - 148, width: 28, height: 50, type: 'wood' },
        // 屋顶
        { x: STRUCT_BASE_X + 18, y: GROUND_Y - 174, width: 98, height: 26, type: 'wood' },
      ],
      // 隐藏珍珠：木屋后上方（高抛过顶才够得到）
      pearls: [{ id: 'lv1', x: STRUCT_BASE_X + 150, y: GROUND_Y - 205 }],
    },

    // ====== 第4关：潮间演武 —— 梭梭冲刺：冲穿一整面长木墙带走墙后豚，再够远豚 ======
    {
      name: '第 4 关',
      flavor: '潮间演武',
      birds: ['dash', 'normal', 'normal', 'normal'],
      trajectory: 55,
      stars: [3500, 7000, 10500],
      pigs: [
        { x: STRUCT_BASE_X - 30, y: GROUND_Y - 18, radius: 18 },            // 墙前裸豚
        { x: STRUCT_BASE_X + 78, y: GROUND_Y - 16, radius: 15 },            // 长木墙后紧贴（梭梭冲穿连猪）
        { x: STRUCT_BASE_X + 144, y: GROUND_Y - 75, radius: 15 },           // 远处柱顶裸豚（冲刺够远/高抛）
      ],
      blocks: [
        // 长木墙（高大；梭梭冲刺 wood×2 一穿即碎，普通嘟嘟狠撞也可）
        { x: STRUCT_BASE_X + 40, y: GROUND_Y - 92, width: 28, height: 92, type: 'wood' },
        // 远处托柱（柱顶豚裸露，可直接砸）
        { x: STRUCT_BASE_X + 130, y: GROUND_Y - 60, width: 28, height: 60, type: 'wood' },
      ],
    },

    // ====== 第5关：石塔守望 —— 砰砰爆炸教学：一爆塌木塔（顺带炸碎石墩） ======
    {
      name: '第 5 关',
      flavor: '石塔守望',   // 风味名（HUD 与关卡主题）
      hint: '新技能：砰砰空中点击范围爆炸！', // 首次进入显示技能教学
      birds: ['normal', 'bomb', 'normal', 'normal'],
      trajectory: 50,
      stars: [4000, 8000, 12000],
      pigs: [
        { x: STRUCT_BASE_X - 28, y: GROUND_Y - 16, radius: 16 },            // 塔前裸豚
        { x: STRUCT_BASE_X + 68, y: GROUND_Y - 17, radius: 16 },            // 塔中
        { x: STRUCT_BASE_X + 140, y: GROUND_Y - 16, radius: 16 },           // 塔后地面
      ],
      blocks: [
        // 木塔两柱（砰䂵木×1.2，断基即塌）
        { x: STRUCT_BASE_X + 20, y: GROUND_Y - 96, width: 28, height: 96, type: 'wood' },
        { x: STRUCT_BASE_X + 88, y: GROUND_Y - 96, width: 28, height: 96, type: 'wood' },
        // 楼板
        { x: STRUCT_BASE_X + 10, y: GROUND_Y - 122, width: 116, height: 26, type: 'wood' },
        // 楼上压一块石墩（砰䂵石×2 一发碎，演示砰䂵克石；也加重坍塌）
        { x: STRUCT_BASE_X + 48, y: GROUND_Y - 150, width: 28, height: 28, type: 'stone' },
      ],
      // 隐藏珍珠：木塔正上方（高抛过顶才能碰到）
      pearls: [{ id: 'lv2', x: STRUCT_BASE_X + 50, y: GROUND_Y - 260 }],
    },

    // ====== 第6关：碎礁木垒 —— 炸基座课：木堆压在两只「脚墩」上，断脚全塌 ======
    {
      name: '第 6 关',
      flavor: '碎礁木垒',
      birds: ['normal', 'dash', 'bomb', 'normal'],
      trajectory: 49,
      stars: [4200, 8400, 12600],
      pigs: [
        { x: STRUCT_BASE_X - 30, y: GROUND_Y - 16, radius: 16 },            // 垒前裸豚
        { x: STRUCT_BASE_X + 80, y: GROUND_Y - 17, radius: 15 },            // 木垒下方
        { x: STRUCT_BASE_X + 70, y: GROUND_Y - 140, radius: 14 },           // 梁上（随塌落砸下）
      ],
      blocks: [
        // 两根承重木柱（脚墩）
        { x: STRUCT_BASE_X + 24, y: GROUND_Y - 100, width: 28, height: 100, type: 'wood' },
        { x: STRUCT_BASE_X + 108, y: GROUND_Y - 100, width: 28, height: 100, type: 'wood' },
        // 长横梁
        { x: STRUCT_BASE_X + 14, y: GROUND_Y - 126, width: 132, height: 26, type: 'wood' },
        // 梁上木堆（断脚后整片砸落）
        { x: STRUCT_BASE_X + 50, y: GROUND_Y - 154, width: 28, height: 28, type: 'wood' },
        { x: STRUCT_BASE_X + 90, y: GROUND_Y - 154, width: 28, height: 28, type: 'wood' },
      ],
    },

    // ====== 第7关：双礁哨塔 —— 两座木哨塔分兵，各自断柱塌顶 ======
    {
      name: '第 7 关',
      flavor: '双礁哨塔',
      birds: ['dash', 'normal', 'bomb', 'normal'],
      trajectory: 48,
      stars: [4500, 9000, 13500],
      pigs: [
        { x: STRUCT_BASE_X - 40, y: GROUND_Y - 16, radius: 16 },            // 两塔之间前裸豚
        { x: STRUCT_BASE_X + 36, y: GROUND_Y - 16, radius: 15 },            // A 塔下
        { x: STRUCT_BASE_X + 126, y: GROUND_Y - 16, radius: 15 },           // B 塔下
      ],
      blocks: [
        // A 塔（左）
        { x: STRUCT_BASE_X + 0, y: GROUND_Y - 86, width: 28, height: 86, type: 'wood' },
        { x: STRUCT_BASE_X + 44, y: GROUND_Y - 86, width: 28, height: 86, type: 'wood' },
        { x: STRUCT_BASE_X - 6, y: GROUND_Y - 112, width: 84, height: 26, type: 'wood' },
        // B 塔（右）
        { x: STRUCT_BASE_X + 88, y: GROUND_Y - 86, width: 28, height: 86, type: 'wood' },
        { x: STRUCT_BASE_X + 132, y: GROUND_Y - 86, width: 28, height: 86, type: 'wood' },
        { x: STRUCT_BASE_X + 80, y: GROUND_Y - 112, width: 84, height: 26, type: 'wood' },
      ],
    },

    // ====== 第8关：滩涂章王（新）—— 章节收官：首个 Boss，坍塌启蒙「悬木吊脚楼」======
    // 解法不在正面硬壳：章王头顶一座木架平台、平台堆着石块，仅由左右两根细木柱撑住。
    // 用梭梭冲刺（克木）撞断两根承重柱，整座石堆木楼平拍下来砸压章王。断一根会砸偏。
    {
      name: '第 8 关',
      flavor: '悬木吊脚楼',
      hint: '章王头顶压着石堆木楼！换砰砰炸断两根木柱，让石堆整个砸下来！',
      birds: ['normal', 'bomb', 'dash', 'bomb', 'normal'],
      trajectory: 46,
      stars: [5200, 10000, 15000],
      pigs: [
        // 滩涂章王（Boss）：站在两根承重柱之间，免疫击退；头顶悬石堆，拆柱塌楼杀
        { x: STRUCT_BASE_X + 92, y: GROUND_Y - 30, radius: 30, boss: true, hp: 5, name: '滩涂章王' },
        // 阵前地面章鱼
        { x: STRUCT_BASE_X - 34, y: GROUND_Y - 16, radius: 16 },
      ],
      blocks: [
        // 左承重木柱（两段叠放，梭梭冲刺克木一撞即断）
        { x: STRUCT_BASE_X + 32, y: GROUND_Y - 78, width: 26, height: 78, type: 'wood' },
        { x: STRUCT_BASE_X + 32, y: GROUND_Y - 156, width: 26, height: 78, type: 'wood' },
        // 右承重木柱
        { x: STRUCT_BASE_X + 126, y: GROUND_Y - 78, width: 26, height: 78, type: 'wood' },
        { x: STRUCT_BASE_X + 126, y: GROUND_Y - 156, width: 26, height: 78, type: 'wood' },
        // 木架平台梁（压在两柱顶上，柱断即平拍）
        { x: STRUCT_BASE_X + 28, y: GROUND_Y - 182, width: 130, height: 26, type: 'wood' },
        // 平台上的石块重物（塌落后高速砸压章王）
        { x: STRUCT_BASE_X + 50, y: GROUND_Y - 210, width: 28, height: 28, type: 'stone' },
        { x: STRUCT_BASE_X + 85, y: GROUND_Y - 210, width: 28, height: 28, type: 'stone' },
        { x: STRUCT_BASE_X + 120, y: GROUND_Y - 210, width: 28, height: 28, type: 'stone' },
        // 石块间埋一颗爆裂果（塌压时连锁爆炸补伤害）
        { x: STRUCT_BASE_X + 86, y: GROUND_Y - 236, width: 26, height: 26, type: 'burst' },
      ],
    },

    // ============================================================
    // 第二章：珊瑚海（idx 8-15）—— 混合材质，分裂教学收官
    // ============================================================

    // 第二章难度主线（珊瑚海 木→冰）：
    //   - 章鱼从「挤一座堡垒」拆成「各占一个独立掩体」并拉开间距，一发最多带走一只 → 省弹药；
    //   - 不配砰砰：木/冰是软材料，dash/嘟嘟足以碎，且砰砰 110px 爆径在 200px 宽阵上会一发全清（作弊解）；
    //   - 可靠可解基元（白盒实测）：裸地猪（直射）、低矮棚屋（两短柱 h60~66+顶，高抛破顶/穿柱）、
    //     柱高 ≤108 的单柱顶猪（高抛，猪位 ≤G-124）。薄墙挡地猪、双塔夹豚、高于 G-125 的柱顶均实测落空，不用。
    // ====== 第9关：浅礁初探（3 豚）—— 裸猪 / 木棚 / 高柱顶，教「一发一豚」 ======
    {
      name: '第 9 关',
      flavor: '浅礁初探',
      birds: ['dash', 'normal', 'normal', 'normal'],
      trajectory: 48,
      stars: [4300, 8600, 13000],
      pigs: [
        { x: STRUCT_BASE_X - 44, y: GROUND_Y - 16, radius: 16 },            // 前左裸猪（直射热身）
        { x: STRUCT_BASE_X + 42, y: GROUND_Y - 13, radius: 13 },            // 木棚内
        { x: STRUCT_BASE_X + 129, y: GROUND_Y - 118, radius: 14 },          // 高柱顶（高抛）
      ],
      blocks: [
        // 木棚：两短柱 + 顶盖
        { x: STRUCT_BASE_X + 2, y: GROUND_Y - 66, width: 26, height: 66, type: 'wood' },
        { x: STRUCT_BASE_X + 56, y: GROUND_Y - 66, width: 26, height: 66, type: 'wood' },
        { x: STRUCT_BASE_X - 4, y: GROUND_Y - 90, width: 92, height: 24, type: 'wood' },
        // 右侧高柱（柱顶裸猪）
        { x: STRUCT_BASE_X + 116, y: GROUND_Y - 104, width: 26, height: 104, type: 'wood' },
      ],
    },

    // ====== 第10关：珊瑚回廊（4 豚）—— 木棚首次盖「冰顶」（冰脆，过渡）+ 两根高柱顶豚 ======
    {
      name: '第 10 关',
      flavor: '珊瑚回廊',
      birds: ['dash', 'normal', 'normal', 'normal'],
      trajectory: 47,
      stars: [4500, 9000, 13500],
      pigs: [
        { x: STRUCT_BASE_X - 52, y: GROUND_Y - 16, radius: 16 },            // 裸猪
        { x: STRUCT_BASE_X + 30, y: GROUND_Y - 12, radius: 12 },            // 木柱冰顶棚内
        { x: STRUCT_BASE_X + 96, y: GROUND_Y - 117, radius: 13 },           // 高柱顶
        { x: STRUCT_BASE_X + 140, y: GROUND_Y - 113, radius: 13 },          // 远高柱顶
      ],
      blocks: [
        // 木柱 + 冰顶
        { x: STRUCT_BASE_X - 6, y: GROUND_Y - 64, width: 24, height: 64, type: 'wood' },
        { x: STRUCT_BASE_X + 42, y: GROUND_Y - 64, width: 24, height: 64, type: 'wood' },
        { x: STRUCT_BASE_X - 12, y: GROUND_Y - 88, width: 80, height: 24, type: 'ice' },
        // 两根木高柱
        { x: STRUCT_BASE_X + 83, y: GROUND_Y - 104, width: 26, height: 104, type: 'wood' },
        { x: STRUCT_BASE_X + 127, y: GROUND_Y - 100, width: 26, height: 100, type: 'wood' },
      ],
    },

    // ====== 第11关：海葵冰堡（4 豚）—— 木冰对半：前排一根冰高柱、两座棚（木柱冰顶 / 全冰棚） ======
    {
      name: '第 11 关',
      flavor: '海葵冰堡',
      birds: ['normal', 'dash', 'normal', 'normal'],
      trajectory: 46,
      stars: [4700, 9400, 14000],
      pigs: [
        { x: STRUCT_BASE_X - 81, y: GROUND_Y - 101, radius: 13 },           // 前冰高柱顶
        { x: STRUCT_BASE_X - 44, y: GROUND_Y - 16, radius: 16 },            // 裸猪
        { x: STRUCT_BASE_X + 30, y: GROUND_Y - 12, radius: 12 },            // 木柱冰顶棚内
        { x: STRUCT_BASE_X + 132, y: GROUND_Y - 12, radius: 12 },           // 全冰棚内
      ],
      blocks: [
        // 前冰高柱
        { x: STRUCT_BASE_X - 94, y: GROUND_Y - 88, width: 26, height: 88, type: 'ice' },
        // 棚 A：木柱 + 冰顶
        { x: STRUCT_BASE_X - 6, y: GROUND_Y - 64, width: 24, height: 64, type: 'wood' },
        { x: STRUCT_BASE_X + 42, y: GROUND_Y - 64, width: 24, height: 64, type: 'wood' },
        { x: STRUCT_BASE_X - 12, y: GROUND_Y - 88, width: 80, height: 24, type: 'ice' },
        // 棚 B：全冰
        { x: STRUCT_BASE_X + 96, y: GROUND_Y - 64, width: 24, height: 64, type: 'ice' },
        { x: STRUCT_BASE_X + 144, y: GROUND_Y - 64, width: 24, height: 64, type: 'ice' },
        { x: STRUCT_BASE_X + 90, y: GROUND_Y - 88, width: 78, height: 24, type: 'ice' },
      ],
    },

    // ====== 第12关：浪花三哨（4 豚）—— 一棚两柱、一高一矮：高冰柱顶豚 + 矮木柱顶豚的高抛差 ======
    {
      name: '第 12 关',
      flavor: '浪花三哨',
      birds: ['dash', 'normal', 'normal', 'normal'],
      trajectory: 45,
      stars: [4900, 9800, 14600],
      pigs: [
        { x: STRUCT_BASE_X - 52, y: GROUND_Y - 16, radius: 16 },            // 裸猪
        { x: STRUCT_BASE_X + 30, y: GROUND_Y - 12, radius: 12 },            // 木柱冰顶棚内
        { x: STRUCT_BASE_X + 96, y: GROUND_Y - 121, radius: 13 },           // 高冰柱顶
        { x: STRUCT_BASE_X + 140, y: GROUND_Y - 99, radius: 13 },           // 矮木柱顶
      ],
      blocks: [
        // 木柱 + 冰顶
        { x: STRUCT_BASE_X - 6, y: GROUND_Y - 64, width: 24, height: 64, type: 'wood' },
        { x: STRUCT_BASE_X + 42, y: GROUND_Y - 64, width: 24, height: 64, type: 'wood' },
        { x: STRUCT_BASE_X - 12, y: GROUND_Y - 88, width: 80, height: 24, type: 'ice' },
        // 高冰柱
        { x: STRUCT_BASE_X + 83, y: GROUND_Y - 108, width: 26, height: 108, type: 'ice' },
        // 矮木柱
        { x: STRUCT_BASE_X + 127, y: GROUND_Y - 86, width: 26, height: 86, type: 'wood' },
      ],
    },

    // ====== 第13关：礁堡迷阵（4 豚）—— 进入全冰：掩体皆冰；柱顶豚分置阵列两端（前低柱/远高柱），互不波及 ======
    {
      name: '第 13 关',
      flavor: '礁堡迷阵',   // 风味名（HUD 与关卡主题）
      birds: ['normal', 'dash', 'normal', 'normal'],
      trajectory: 44,
      stars: [5000, 10000, 15000],
      pigs: [
        { x: STRUCT_BASE_X - 81, y: GROUND_Y - 101, radius: 13 },           // 前低冰柱顶
        { x: STRUCT_BASE_X - 40, y: GROUND_Y - 16, radius: 16 },            // 裸豚
        { x: STRUCT_BASE_X + 46, y: GROUND_Y - 12, radius: 12 },            // 矮冰棚内
        { x: STRUCT_BASE_X + 130, y: GROUND_Y - 12, radius: 12 },           // 高冰棚内（顶更高，高抛需更陡）
      ],
      blocks: [
        // 前低冰柱
        { x: STRUCT_BASE_X - 94, y: GROUND_Y - 88, width: 26, height: 88, type: 'ice' },
        // 矮冰棚
        { x: STRUCT_BASE_X + 10, y: GROUND_Y - 64, width: 24, height: 64, type: 'ice' },
        { x: STRUCT_BASE_X + 58, y: GROUND_Y - 64, width: 24, height: 64, type: 'ice' },
        { x: STRUCT_BASE_X + 4, y: GROUND_Y - 88, width: 80, height: 24, type: 'ice' },
        // 高冰棚（柱高 92、顶更高）
        { x: STRUCT_BASE_X + 96, y: GROUND_Y - 92, width: 24, height: 92, type: 'ice' },
        { x: STRUCT_BASE_X + 140, y: GROUND_Y - 92, width: 24, height: 92, type: 'ice' },
        { x: STRUCT_BASE_X + 90, y: GROUND_Y - 116, width: 78, height: 24, type: 'ice' },
      ],
    },

    // ====== 第14关：珊瑚要塞（4 豚）—— 全冰分兵：前低柱顶豚 + 裸豚 + 两座拉开间距的冰棚（切断坍塌串杀） ======
    {
      name: '第 14 关',
      flavor: '珊瑚要塞',   // 风味名（HUD 与关卡主题）
      birds: ['normal', 'dash', 'normal', 'normal'],
      trajectory: 42,
      stars: [6000, 12000, 20000],
      pigs: [
        { x: STRUCT_BASE_X - 81, y: GROUND_Y - 101, radius: 13 },           // 前低冰柱顶
        { x: STRUCT_BASE_X - 44, y: GROUND_Y - 16, radius: 16 },            // 裸豚
        { x: STRUCT_BASE_X + 30, y: GROUND_Y - 12, radius: 12 },            // 冰棚 A 内
        { x: STRUCT_BASE_X + 128, y: GROUND_Y - 12, radius: 12 },           // 冰棚 B 内
      ],
      blocks: [
        // 前低冰柱
        { x: STRUCT_BASE_X - 94, y: GROUND_Y - 88, width: 26, height: 88, type: 'ice' },
        // 冰棚 A
        { x: STRUCT_BASE_X - 6, y: GROUND_Y - 64, width: 24, height: 64, type: 'ice' },
        { x: STRUCT_BASE_X + 42, y: GROUND_Y - 64, width: 24, height: 64, type: 'ice' },
        { x: STRUCT_BASE_X - 12, y: GROUND_Y - 88, width: 80, height: 24, type: 'ice' },
        // 冰棚 B（与 A 拉开 ~18px，坍塌不串杀）
        { x: STRUCT_BASE_X + 92, y: GROUND_Y - 64, width: 24, height: 64, type: 'ice' },
        { x: STRUCT_BASE_X + 140, y: GROUND_Y - 64, width: 24, height: 64, type: 'ice' },
        { x: STRUCT_BASE_X + 86, y: GROUND_Y - 88, width: 78, height: 24, type: 'ice' },
      ],
      // 隐藏珍珠：阵前高空（高抛射程奖励）
      pearls: [{ id: 'lv4', x: STRUCT_BASE_X + 10, y: GROUND_Y - 178 }],
    },

    // ====== 第15关：双子冰哨（4 豚）—— 全冰：前柱顶豚 + 裸豚 + 两座冰棚，棚间一颗冻果 ======
    {
      name: '第 15 关',
      flavor: '双子冰哨',   // 风味名（HUD 与关卡主题）
      birds: ['normal', 'dash', 'normal', 'normal'],
      trajectory: 40,
      stars: [7000, 13000, 19000],
      pigs: [
        { x: STRUCT_BASE_X - 81, y: GROUND_Y - 101, radius: 13 },           // 前冰柱顶
        { x: STRUCT_BASE_X - 38, y: GROUND_Y - 15, radius: 14 },            // 裸豚
        { x: STRUCT_BASE_X + 30, y: GROUND_Y - 12, radius: 12 },            // 冰棚 A 内
        { x: STRUCT_BASE_X + 132, y: GROUND_Y - 12, radius: 12 },           // 冰棚 B 内
      ],
      blocks: [
        // 前冰柱
        { x: STRUCT_BASE_X - 94, y: GROUND_Y - 88, width: 26, height: 88, type: 'ice' },
        // 冰棚 A
        { x: STRUCT_BASE_X - 6, y: GROUND_Y - 64, width: 24, height: 64, type: 'ice' },
        { x: STRUCT_BASE_X + 42, y: GROUND_Y - 64, width: 24, height: 64, type: 'ice' },
        { x: STRUCT_BASE_X - 12, y: GROUND_Y - 88, width: 80, height: 24, type: 'ice' },
        // 冰棚 B
        { x: STRUCT_BASE_X + 96, y: GROUND_Y - 64, width: 24, height: 64, type: 'ice' },
        { x: STRUCT_BASE_X + 144, y: GROUND_Y - 64, width: 24, height: 64, type: 'ice' },
        { x: STRUCT_BASE_X + 90, y: GROUND_Y - 88, width: 78, height: 24, type: 'ice' },
        // 冻果：裸豚与冰棚 A 之间地面，坍塌可压爆（效率奖励）
        { x: STRUCT_BASE_X - 28, y: GROUND_Y - 22, width: 20, height: 20, type: 'burst' },
      ],
    },

    // ====== 第16关：冰壳章王（锚点）—— 三丸子分裂教学 + 章末 Boss：冰壳 ======
    {
      name: '第 16 关',
      flavor: '冻果冰穹',   // 风味名（HUD 与关卡主题）
      hint: '新技能：三丸子空中点击一分为三！', // 首次进入显示技能教学
      birds: ['normal', 'split', 'dash', 'bomb', 'normal'],
      trajectory: 30,
      stars: [8000, 14000, 21000],
      pigs: [
        // 冰壳章王（Boss）：冻果冰穹正下方，hp7；半血怒吼天降爆裂果（sleep 阶段物）
        { x: STRUCT_BASE_X + 120, y: GROUND_Y - 26, radius: 26, boss: true, hp: 7, name: '冰壳章王' },
        // 冰穹顶哨章鱼（坐中央冻果上）
        { x: STRUCT_BASE_X + 120, y: GROUND_Y - 159, radius: 13 },
        // 前左地面
        { x: STRUCT_BASE_X - 28, y: GROUND_Y - 18, radius: 18 },
      ],
      blocks: [
        // 冰壳左墙 / 右墙（三丸子一分为三、一发碎多冰的教学锚点）
        { x: STRUCT_BASE_X + 72, y: GROUND_Y - 44, width: 20, height: 44, type: 'ice' },
        { x: STRUCT_BASE_X + 72, y: GROUND_Y - 88, width: 20, height: 44, type: 'ice' },
        { x: STRUCT_BASE_X + 150, y: GROUND_Y - 44, width: 18, height: 44, type: 'ice' },
        { x: STRUCT_BASE_X + 150, y: GROUND_Y - 88, width: 18, height: 44, type: 'ice' },
        // 冰穹承重板：横压章王头顶，托着一排冻果（砰砰一炸，冰碎果连锁）
        { x: STRUCT_BASE_X + 44, y: GROUND_Y - 120, width: 122, height: 24, type: 'ice' },
        // 冻果 ×4：沿冰穹顶排开，间距 32 可连锁；逐颗引爆都在章王头顶 ~110px 内，各扣 1 血
        { x: STRUCT_BASE_X + 44, y: GROUND_Y - 146, width: 26, height: 26, type: 'burst' },
        { x: STRUCT_BASE_X + 76, y: GROUND_Y - 146, width: 26, height: 26, type: 'burst' },
        { x: STRUCT_BASE_X + 108, y: GROUND_Y - 146, width: 26, height: 26, type: 'burst' },
        { x: STRUCT_BASE_X + 140, y: GROUND_Y - 146, width: 26, height: 26, type: 'burst' },
        // 浮冰靶 ×3（分裂教学锚点）：冰穹前檐下水平排开的三帽，三丸子近垂直下落横散、一发各碎一冰
        // （split 对冰 2.0 克制自解释）；位于冻果弹道下方 ~50px，不干扰砰砰冻果连锁主解
        { x: STRUCT_BASE_X - 39, y: GROUND_Y - 92, width: 28, height: 24, type: 'ice' },
        { x: STRUCT_BASE_X - 11, y: GROUND_Y - 92, width: 54, height: 24, type: 'ice' },
        { x: STRUCT_BASE_X + 43, y: GROUND_Y - 92, width: 28, height: 24, type: 'ice' },
        // 阶段 1（半血怒吼）：天降爆裂果 ×2（落点刻意放阵前空地竖线、只砸地面——
        // burst 一碰冰穹/冻果即碎爆，会自爆头顶冻果链把章王自己炸残，故绝不能落在冰穹正上方）
        { x: STRUCT_BASE_X - 80, y: -260, width: 26, height: 26, type: 'burst', sleep: 1 },
        { x: STRUCT_BASE_X - 100, y: -320, width: 26, height: 26, type: 'burst', sleep: 1 },
      ],
      // 隐藏珍珠：冰穹上方高空（极限高抛射程）
      pearls: [{ id: 'lv6', x: STRUCT_BASE_X + 130, y: GROUND_Y - 190 }],
    },

    // ============================================================
    // 第三章：深渊要塞（idx 16-23）—— 冰石混构，难度抬升
    // ============================================================

    // ====== 第17关：冰幕初启（新）—— 分裂首秀：全冰双棚，三丸子横扫两座冰棚 ======
    {
      name: '第 17 关',
      flavor: '冰幕初启',
      birds: ['split', 'dash', 'normal', 'normal'],
      trajectory: 29,
      stars: [8200, 14400, 21200],
      pigs: [
        { x: STRUCT_BASE_X - 81, y: GROUND_Y - 101, radius: 13 },           // 前低冰柱顶
        { x: STRUCT_BASE_X - 40, y: GROUND_Y - 16, radius: 16 },            // 裸豚
        { x: STRUCT_BASE_X + 30, y: GROUND_Y - 12, radius: 12 },            // 冰棚 A 内
        { x: STRUCT_BASE_X + 128, y: GROUND_Y - 12, radius: 12 },           // 冰棚 B 内
      ],
      blocks: [
        // 前低冰柱
        { x: STRUCT_BASE_X - 94, y: GROUND_Y - 88, width: 26, height: 88, type: 'ice' },
        // 冰棚 A
        { x: STRUCT_BASE_X - 6, y: GROUND_Y - 64, width: 24, height: 64, type: 'ice' },
        { x: STRUCT_BASE_X + 42, y: GROUND_Y - 64, width: 24, height: 64, type: 'ice' },
        { x: STRUCT_BASE_X - 12, y: GROUND_Y - 88, width: 80, height: 24, type: 'ice' },
        // 冰棚 B
        { x: STRUCT_BASE_X + 92, y: GROUND_Y - 64, width: 24, height: 64, type: 'ice' },
        { x: STRUCT_BASE_X + 140, y: GROUND_Y - 64, width: 24, height: 64, type: 'ice' },
        { x: STRUCT_BASE_X + 86, y: GROUND_Y - 88, width: 78, height: 24, type: 'ice' },
      ],
    },

    // ====== 第18关：寒晶双柱（新）—— 高承重冰梁：两柱一梁压两豚，断柱/穿梁坍塌 ======
    {
      name: '第 18 关',
      flavor: '寒晶双柱',
      birds: ['split', 'split', 'dash', 'normal'],
      trajectory: 29,
      stars: [8500, 14700, 21500],
      pigs: [
        { x: STRUCT_BASE_X - 81, y: GROUND_Y - 101, radius: 13 },           // 前低冰柱顶
        { x: STRUCT_BASE_X - 44, y: GROUND_Y - 16, radius: 16 },            // 裸豚
        { x: STRUCT_BASE_X + 54, y: GROUND_Y - 13, radius: 13 },            // 高冰梁下豚（左）
        { x: STRUCT_BASE_X + 100, y: GROUND_Y - 13, radius: 13 },           // 高冰梁下豚（右）
      ],
      blocks: [
        // 前低冰柱
        { x: STRUCT_BASE_X - 94, y: GROUND_Y - 88, width: 26, height: 88, type: 'ice' },
        // 高承重冰梁（柱 h96，梁顶 G-120；断柱或穿梁均可压杀梁下两豚）
        { x: STRUCT_BASE_X + 14, y: GROUND_Y - 96, width: 26, height: 96, type: 'ice' },
        { x: STRUCT_BASE_X + 124, y: GROUND_Y - 96, width: 26, height: 96, type: 'ice' },
        { x: STRUCT_BASE_X + 8, y: GROUND_Y - 120, width: 148, height: 24, type: 'ice' },
      ],
    },

    // ====== 第19关：冰晶宫殿（锚点）—— 全冰高梁大殿压三豚，屋脊双石镇（恰 2 石，挡直取屋脊的平射） ======
    {
      name: '第 19 关',
      flavor: '冰晶宫殿',   // 风味名（HUD 与关卡主题）
      birds: ['split', 'split', 'dash', 'normal'],
      trajectory: 28,
      stars: [9000, 15000, 20000],
      pigs: [
        { x: STRUCT_BASE_X - 30, y: GROUND_Y - 18, radius: 16 },            // 殿前裸豚
        { x: STRUCT_BASE_X + 54, y: GROUND_Y - 13, radius: 13 },            // 殿内梁下豚（左）
        { x: STRUCT_BASE_X + 90, y: GROUND_Y - 13, radius: 13 },            // 殿内梁下豚（中）
        { x: STRUCT_BASE_X + 120, y: GROUND_Y - 13, radius: 12 },           // 殿内梁下豚（右）
      ],
      blocks: [
        // 高梁大殿（柱 h100、梁顶 G-124；穿梁/断柱坍塌压杀殿内三豚）
        { x: STRUCT_BASE_X + 6, y: GROUND_Y - 100, width: 26, height: 100, type: 'ice' },
        { x: STRUCT_BASE_X + 134, y: GROUND_Y - 100, width: 26, height: 100, type: 'ice' },
        { x: STRUCT_BASE_X + 0, y: GROUND_Y - 124, width: 166, height: 24, type: 'ice' },
        // 屋脊中宝顶（冰，脆）
        { x: STRUCT_BASE_X + 68, y: GROUND_Y - 124 - 24, width: 30, height: 24, type: 'ice' },
        // 屋脊左右石镇 ×2（石压冰角：挡直取屋脊的平射、抬高材料硬度；本关恰 2 石，锚点）
        { x: STRUCT_BASE_X + 14, y: GROUND_Y - 124 - 26, width: 28, height: 26, type: 'stone' },
        { x: STRUCT_BASE_X + 124, y: GROUND_Y - 124 - 26, width: 28, height: 26, type: 'stone' },
      ],
    },

    // ====== 第20关：冰骨长阶（新）—— 分兵四掩体：柱顶/裸/低棚/高承重棚（低→高阶差） ======
    {
      name: '第 20 关',
      flavor: '冰骨长阶',
      birds: ['split', 'split', 'dash', 'normal'],
      trajectory: 29,
      stars: [9500, 16000, 22000],
      pigs: [
        { x: STRUCT_BASE_X - 81, y: GROUND_Y - 101, radius: 13 },           // 前低冰柱顶
        { x: STRUCT_BASE_X - 40, y: GROUND_Y - 16, radius: 16 },            // 裸豚
        { x: STRUCT_BASE_X + 36, y: GROUND_Y - 12, radius: 12 },            // 低冰棚内（阶下）
        { x: STRUCT_BASE_X + 128, y: GROUND_Y - 13, radius: 12 },           // 高承重棚内（阶上）
      ],
      blocks: [
        // 前低冰柱
        { x: STRUCT_BASE_X - 94, y: GROUND_Y - 88, width: 26, height: 88, type: 'ice' },
        // 低冰棚（阶下，柱 h64）
        { x: STRUCT_BASE_X + 0, y: GROUND_Y - 64, width: 24, height: 64, type: 'ice' },
        { x: STRUCT_BASE_X + 48, y: GROUND_Y - 64, width: 24, height: 64, type: 'ice' },
        { x: STRUCT_BASE_X - 6, y: GROUND_Y - 88, width: 80, height: 24, type: 'ice' },
        // 高承重棚（阶上，柱 h96、梁顶 G-120）
        { x: STRUCT_BASE_X + 90, y: GROUND_Y - 96, width: 26, height: 96, type: 'ice' },
        { x: STRUCT_BASE_X + 140, y: GROUND_Y - 96, width: 26, height: 96, type: 'ice' },
        { x: STRUCT_BASE_X + 84, y: GROUND_Y - 120, width: 82, height: 24, type: 'ice' },
      ],
    },

    // ====== 第21关：玄冰方阵（锚点）—— 两座高承重冰棚并肩（方阵），三丸子高抛穿梁主场 ======
    {
      name: '第 21 关',
      flavor: '玄冰方阵',   // 风味名（HUD 与关卡主题）
      birds: ['split', 'split', 'dash', 'normal'],
      trajectory: 30,
      stars: [10000, 17000, 23000],
      pigs: [
        { x: STRUCT_BASE_X - 81, y: GROUND_Y - 101, radius: 13 },           // 前低冰柱顶
        { x: STRUCT_BASE_X - 40, y: GROUND_Y - 16, radius: 16 },            // 裸豚
        { x: STRUCT_BASE_X + 39, y: GROUND_Y - 13, radius: 12 },            // 高棚 A 内
        { x: STRUCT_BASE_X + 128, y: GROUND_Y - 13, radius: 12 },           // 高棚 B 内
      ],
      blocks: [
        // 前低冰柱
        { x: STRUCT_BASE_X - 94, y: GROUND_Y - 88, width: 26, height: 88, type: 'ice' },
        // 高承重冰棚 A（柱 h96）
        { x: STRUCT_BASE_X + 0, y: GROUND_Y - 96, width: 26, height: 96, type: 'ice' },
        { x: STRUCT_BASE_X + 52, y: GROUND_Y - 96, width: 26, height: 96, type: 'ice' },
        { x: STRUCT_BASE_X - 6, y: GROUND_Y - 120, width: 90, height: 24, type: 'ice' },
        // 高承重冰棚 B
        { x: STRUCT_BASE_X + 90, y: GROUND_Y - 96, width: 26, height: 96, type: 'ice' },
        { x: STRUCT_BASE_X + 140, y: GROUND_Y - 96, width: 26, height: 96, type: 'ice' },
        { x: STRUCT_BASE_X + 84, y: GROUND_Y - 120, width: 82, height: 24, type: 'ice' },
      ],
      // 隐藏珍珠：高棚梁脊上方（越过梁顶的高点）
      pearls: [{ id: 'lv8', x: STRUCT_BASE_X + 108, y: GROUND_Y - 170 }],
    },

    // ====== 第22关：渊涡门阵（新）—— 两座高承重冰棚 + 阵前冻果阵眼（引爆连锁） ======
    {
      name: '第 22 关',
      flavor: '渊涡门阵',
      birds: ['split', 'split', 'dash', 'normal'],
      trajectory: 27,
      stars: [10500, 18000, 25000],
      pigs: [
        { x: STRUCT_BASE_X - 81, y: GROUND_Y - 101, radius: 13 },           // 前低冰柱顶
        { x: STRUCT_BASE_X - 40, y: GROUND_Y - 16, radius: 16 },            // 裸豚
        { x: STRUCT_BASE_X + 39, y: GROUND_Y - 13, radius: 12 },            // 高棚门 A 内
        { x: STRUCT_BASE_X + 128, y: GROUND_Y - 13, radius: 12 },           // 高棚门 B 内
      ],
      blocks: [
        // 前低冰柱
        { x: STRUCT_BASE_X - 94, y: GROUND_Y - 88, width: 26, height: 88, type: 'ice' },
        // 高承重冰棚门 A
        { x: STRUCT_BASE_X + 0, y: GROUND_Y - 96, width: 26, height: 96, type: 'ice' },
        { x: STRUCT_BASE_X + 52, y: GROUND_Y - 96, width: 26, height: 96, type: 'ice' },
        { x: STRUCT_BASE_X - 6, y: GROUND_Y - 120, width: 90, height: 24, type: 'ice' },
        // 高承重冰棚门 B
        { x: STRUCT_BASE_X + 90, y: GROUND_Y - 96, width: 26, height: 96, type: 'ice' },
        { x: STRUCT_BASE_X + 140, y: GROUND_Y - 96, width: 26, height: 96, type: 'ice' },
        { x: STRUCT_BASE_X + 84, y: GROUND_Y - 120, width: 82, height: 24, type: 'ice' },
        // 冻果阵眼（阵前最左，引爆波及前柱/裸豚、震松棚门）
        { x: STRUCT_BASE_X - 120, y: GROUND_Y - 24, width: 24, height: 24, type: 'burst' },
      ],
    },

    // ====== 第23关：暗礁城垛（新）—— 低棚 + 高承重城壁，城壁梁脊带冰垛（城垛造型） ======
    {
      name: '第 23 关',
      flavor: '暗礁城垛',
      birds: ['split', 'split', 'dash', 'normal'],
      trajectory: 25,
      stars: [11000, 19000, 27000],
      pigs: [
        { x: STRUCT_BASE_X - 81, y: GROUND_Y - 101, radius: 13 },           // 前低冰柱顶
        { x: STRUCT_BASE_X - 40, y: GROUND_Y - 16, radius: 16 },            // 裸豚
        { x: STRUCT_BASE_X + 36, y: GROUND_Y - 12, radius: 12 },            // 低冰棚内
        { x: STRUCT_BASE_X + 128, y: GROUND_Y - 13, radius: 12 },           // 高城壁内
      ],
      blocks: [
        // 前低冰柱
        { x: STRUCT_BASE_X - 94, y: GROUND_Y - 88, width: 26, height: 88, type: 'ice' },
        // 低冰棚
        { x: STRUCT_BASE_X + 0, y: GROUND_Y - 64, width: 24, height: 64, type: 'ice' },
        { x: STRUCT_BASE_X + 48, y: GROUND_Y - 64, width: 24, height: 64, type: 'ice' },
        { x: STRUCT_BASE_X - 6, y: GROUND_Y - 88, width: 80, height: 24, type: 'ice' },
        // 高承重城壁（柱 h96）
        { x: STRUCT_BASE_X + 90, y: GROUND_Y - 96, width: 26, height: 96, type: 'ice' },
        { x: STRUCT_BASE_X + 140, y: GROUND_Y - 96, width: 26, height: 96, type: 'ice' },
        { x: STRUCT_BASE_X + 84, y: GROUND_Y - 120, width: 82, height: 24, type: 'ice' },
        // 城壁梁脊冰垛 ×2（城垛造型）
        { x: STRUCT_BASE_X + 100, y: GROUND_Y - 120 - 20, width: 16, height: 20, type: 'ice' },
        { x: STRUCT_BASE_X + 132, y: GROUND_Y - 120 - 20, width: 16, height: 20, type: 'ice' },
      ],
    },

    // ====== 第24关：岩甲章王（锚点，综合）—— 章节收官：Boss 战，石壳两阶段 ======
    {
      name: '第 24 关',
      flavor: '石拱断桥',   // 风味名（HUD 与关卡主题）
      birds: ['normal', 'dash', 'bomb', 'split', 'bomb', 'normal'],
      trajectory: 22,
      stars: [12000, 20000, 30000],
      pigs: [
        // 岩甲章王（Boss）：压在断桥正下方，hp9；两度怒吼天降落石
        { x: STRUCT_BASE_X + 100, y: GROUND_Y - 32, radius: 32, boss: true, hp: 9, name: '岩甲章王' },
        // 桥面哨章鱼（站桥面左段、贴左墩：第一发炸左墩时爆炸直接波及，不依赖随桥坠落）
        { x: STRUCT_BASE_X + 48, y: GROUND_Y - 164, radius: 14 },
        // 阵前地面章鱼
        { x: STRUCT_BASE_X - 32, y: GROUND_Y - 16, radius: 16 },
      ],
      blocks: [
        // 桥面：厚重石板横压章王头顶（双墩齐断才整面平拍，断单侧只会掀偏）
        { x: STRUCT_BASE_X + 24, y: GROUND_Y - 150, width: 144, height: 26, type: 'stone' },
        // 桥面载石 ×2：随桥平拍的配重（左段留空给桥面哨章鱼站位；炸点在墩基，载石在爆炸边缘幸存下坠）
        { x: STRUCT_BASE_X + 82, y: GROUND_Y - 178, width: 28, height: 28, type: 'stone' },
        { x: STRUCT_BASE_X + 130, y: GROUND_Y - 178, width: 28, height: 28, type: 'stone' },
        // 桥下悬空冻果（双墩之间、桥面下，鸟打不进）：双墩齐断桥面整面平落时压爆连锁，
        // 补「承重坍塌」之外的稳定固定伤害（方块碾压已去重，靠冻果连锁逐颗扣血）。
        // 上层 ×2 贴桥面底、下层 ×1 骑章王额（两层 y 错开防互叠，连锁间距 <118 全连通）
        { x: STRUCT_BASE_X + 62, y: GROUND_Y - 100, width: 26, height: 26, type: 'burst' },
        { x: STRUCT_BASE_X + 108, y: GROUND_Y - 100, width: 26, height: 26, type: 'burst' },
        { x: STRUCT_BASE_X + 86, y: GROUND_Y - 68, width: 26, height: 26, type: 'burst' },
        // 章王脚边贴脸冻果 ×2（连锁末段贴脸爆，把固定伤害补足到两发机关可收，少靠残血补刀）
        { x: STRUCT_BASE_X + 74, y: GROUND_Y - 26, width: 26, height: 26, type: 'burst' },
        { x: STRUCT_BASE_X + 106, y: GROUND_Y - 26, width: 26, height: 26, type: 'burst' },
        // 左石桥墩（上下两段，砰砰炸基即断）
        { x: STRUCT_BASE_X + 30, y: GROUND_Y - 62, width: 28, height: 62, type: 'stone' },
        { x: STRUCT_BASE_X + 30, y: GROUND_Y - 124, width: 28, height: 62, type: 'stone' },
        // 右石桥墩（上下两段）
        { x: STRUCT_BASE_X + 134, y: GROUND_Y - 62, width: 28, height: 62, type: 'stone' },
        { x: STRUCT_BASE_X + 134, y: GROUND_Y - 124, width: 28, height: 62, type: 'stone' },
        // 天降落石：落点刻意放在「阵前空地」竖线（弹弓↔阵前猪、阵前猪↔左墩之间的空档，
        // 下方只有地面）——落石自由落体末速 ~28px/帧，碰 hp1 冻果一碰即碎会自爆连锁，
        // 故绝不能落在章王/冻果/桥墩正上方（否则章王残血怒吼把自己脚下冻果全点了）。
        // 阶段 1（2/3 血怒吼）：天降落石 ×2
        { x: STRUCT_BASE_X - 78, y: -380, width: 28, height: 40, type: 'stone', sleep: 1 },
        { x: STRUCT_BASE_X + 7, y: -440, width: 28, height: 40, type: 'stone', sleep: 1 },
        // 阶段 2（1/3 血怒吼）：天降落石 ×2（同两条空地竖线，分批落下）
        { x: STRUCT_BASE_X - 78, y: -260, width: 24, height: 36, type: 'stone', sleep: 2 },
        { x: STRUCT_BASE_X + 7, y: -320, width: 24, height: 36, type: 'stone', sleep: 2 },
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
      flavor: '双塔悬闸',
      birds: ['bomb', 'split', 'dash', 'bomb', 'split', 'normal'],
      trajectory: 16,
      stars: [12800, 20500, 27000],
      pigs: [
        // 深渊章王（Boss）：悬闸正下方，hp11，三度怒吼（落石+召唤）
        { x: STRUCT_BASE_X + 98, y: GROUND_Y - 33, radius: 33, boss: true, hp: 11, name: '深渊章王' },
        // 悬闸顶哨章鱼（站闸面上）
        { x: STRUCT_BASE_X + 90, y: GROUND_Y - 198, radius: 13 },
        // 阵前地面章鱼
        { x: STRUCT_BASE_X - 46, y: GROUND_Y - 16, radius: 16 },
        // 阶段 2 召唤：援军小章鱼 ×2（预置屏外，怒吼时落下，被悬闸碾压）
        { x: STRUCT_BASE_X + 74, y: -250, radius: 14, sleep: 2 },
        { x: STRUCT_BASE_X + 119, y: -310, radius: 14, sleep: 2 },
        // 阶段 3 召唤：援军小章鱼 ×1
        { x: STRUCT_BASE_X + 99, y: -370, radius: 15, sleep: 3 },
      ],
      blocks: [
        // 悬闸：巨型石板横空（双塔齐断才整面平落）
        { x: STRUCT_BASE_X + 16, y: GROUND_Y - 185, width: 150, height: 28, type: 'stone' },
        // 闸下悬空冻果 ×3（悬在闸下、双塔之间，鸟打不进）：悬闸平落压碎即连锁，
        // 炸塔冲击波扫到也提前连锁；引爆点距章王头顶 ~60px，逐颗各扣 1 血
        { x: STRUCT_BASE_X + 50, y: GROUND_Y - 107, width: 26, height: 26, type: 'burst' },
        { x: STRUCT_BASE_X + 78, y: GROUND_Y - 107, width: 26, height: 26, type: 'burst' },
        { x: STRUCT_BASE_X + 106, y: GROUND_Y - 107, width: 26, height: 26, type: 'burst' },
        // 贴脸冻果 ×2（连锁从闸下传到章王头顶/左脸，稳定固定伤害，不靠方块碾压）：
        // 头顶果骑章王额、左脸果贴腮（block 贴猪合法）；间距 <118，闸下果一爆即串到
        { x: STRUCT_BASE_X + 96, y: GROUND_Y - 72, width: 26, height: 26, type: 'burst' },
        { x: STRUCT_BASE_X + 54, y: GROUND_Y - 48, width: 26, height: 26, type: 'burst' },
        // 左塔（木，两段；砰砰炸基即断）
        { x: STRUCT_BASE_X + 22, y: GROUND_Y - 78, width: 28, height: 78, type: 'wood' },
        { x: STRUCT_BASE_X + 22, y: GROUND_Y - 156, width: 28, height: 78, type: 'wood' },
        // 右塔（石，两段）
        { x: STRUCT_BASE_X + 134, y: GROUND_Y - 78, width: 28, height: 78, type: 'stone' },
        { x: STRUCT_BASE_X + 134, y: GROUND_Y - 156, width: 28, height: 78, type: 'stone' },
        // 天降落石：落点刻意放阵前空地竖线（下方只有地面），绝不落在章王/冻果/双塔正上方——
        // 落石末速 ~28px/帧，碰 hp1 冻果一碰即碎会引爆全连锁，残血怒吼会把章王自己炸死。
        // 阶段 1：天降落石 ×2
        { x: STRUCT_BASE_X - 88, y: -380, width: 28, height: 40, type: 'stone', sleep: 1 },
        { x: STRUCT_BASE_X - 7, y: -440, width: 28, height: 40, type: 'stone', sleep: 1 },
        // 阶段 3：天降落石 ×1（同条空地竖线，晚落）
        { x: STRUCT_BASE_X - 88, y: -300, width: 26, height: 38, type: 'stone', sleep: 3 },
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
      flavor: '多米诺王座',
      birds: ['bomb', 'split', 'dash', 'bomb', 'split', 'normal'],
      trajectory: 12,
      stars: [16000, 25000, 34000],
      pigs: [
        // 潮汐王座·章王（最终 Boss）：三层石堡王座下，hp14，三度怒吼
        { x: STRUCT_BASE_X + 96, y: GROUND_Y - 34, radius: 34, boss: true, hp: 14, name: '潮汐王座·章王' },
        // 王座外层哨章鱼（站最高石檐上）
        { x: STRUCT_BASE_X + 140, y: GROUND_Y - 244, radius: 14 },
        // 阵前地面章鱼
        { x: STRUCT_BASE_X - 56, y: GROUND_Y - 16, radius: 16 },
        // 阶段 2 召唤：援军小章鱼 ×2（被逐层坍塌的石堡碾压）
        { x: STRUCT_BASE_X + 69, y: -260, radius: 14, sleep: 2 },
        { x: STRUCT_BASE_X + 124, y: -330, radius: 15, sleep: 2 },
        // 阶段 3 召唤：援军小章鱼 ×1
        { x: STRUCT_BASE_X + 94, y: -380, radius: 16, sleep: 3 },
      ],
      blocks: [
        // —— 三层石堡：外/中石檐悬空逐级抬高，内层王座盖由双石柱落地 ——
        // 内层王座盖（章王头顶）
        { x: STRUCT_BASE_X + 40, y: GROUND_Y - 110, width: 120, height: 26, type: 'stone' },
        // 王座双石柱（落地门柱）
        { x: STRUCT_BASE_X + 44, y: GROUND_Y - 84, width: 26, height: 84, type: 'stone' },
        { x: STRUCT_BASE_X + 130, y: GROUND_Y - 84, width: 26, height: 84, type: 'stone' },
        // 中层石檐（悬空）
        { x: STRUCT_BASE_X + 30, y: GROUND_Y - 170, width: 130, height: 26, type: 'stone' },
        // 外层石檐（悬空）
        { x: STRUCT_BASE_X + 20, y: GROUND_Y - 230, width: 140, height: 26, type: 'stone' },
        // —— 冻果多米诺链：一发引爆，从外檐逐级连爆到王座盖、再传到章王头顶 ——
        // b0 外檐顶（高抛触发点）
        { x: STRUCT_BASE_X + 40, y: GROUND_Y - 256, width: 26, height: 26, type: 'burst' },
        // b1 中檐顶
        { x: STRUCT_BASE_X + 52, y: GROUND_Y - 196, width: 26, height: 26, type: 'burst' },
        // 王座盖顶一排冻果（链腰，平射可及；打中即双向引爆全链；贴王 ~90，各扣 1 血）
        { x: STRUCT_BASE_X + 38, y: GROUND_Y - 136, width: 26, height: 26, type: 'burst' },
        { x: STRUCT_BASE_X + 64, y: GROUND_Y - 136, width: 26, height: 26, type: 'burst' },
        { x: STRUCT_BASE_X + 94, y: GROUND_Y - 136, width: 26, height: 26, type: 'burst' },
        { x: STRUCT_BASE_X + 120, y: GROUND_Y - 136, width: 26, height: 26, type: 'burst' },
        // 章王头顶贴果（王座盖下悬挂）
        { x: STRUCT_BASE_X + 72, y: GROUND_Y - 84, width: 26, height: 26, type: 'burst' },
        { x: STRUCT_BASE_X + 98, y: GROUND_Y - 84, width: 26, height: 26, type: 'burst' },
        // 章王身侧 / 脚边贴脸果（连锁末段贴脸爆，固定伤害，少靠坍塌随机）
        { x: STRUCT_BASE_X + 72, y: GROUND_Y - 58, width: 26, height: 26, type: 'burst' },
        { x: STRUCT_BASE_X + 104, y: GROUND_Y - 58, width: 26, height: 26, type: 'burst' },
        { x: STRUCT_BASE_X + 72, y: GROUND_Y - 26, width: 26, height: 26, type: 'burst' },
        { x: STRUCT_BASE_X + 104, y: GROUND_Y - 26, width: 26, height: 26, type: 'burst' },
        // 天降落石/爆裂果：落点刻意放阵前空地竖线（下方只有地面），绝不落在王座/冻果链正上方——
        // 落石末速 ~28px/帧碰 hp1 冻果一碰即碎、burst 碰石檐即爆，都会自爆多米诺链把章王自己炸死。
        // 爆裂果只放最左竖线（离王座冻果 > 连锁距离），落石可落两条空地竖线。
        // 阶段 1：天降落石 ×2
        { x: STRUCT_BASE_X - 100, y: -400, width: 30, height: 42, type: 'stone', sleep: 1 },
        { x: STRUCT_BASE_X - 12, y: -470, width: 30, height: 42, type: 'stone', sleep: 1 },
        // 阶段 2：天降爆裂果 ×1（最左空地，落地只在空地爆、不连王座链）
        { x: STRUCT_BASE_X - 100, y: -340, width: 28, height: 28, type: 'burst', sleep: 2 },
        // 阶段 3：天降落石 ×2
        { x: STRUCT_BASE_X - 100, y: -300, width: 28, height: 40, type: 'stone', sleep: 3 },
        { x: STRUCT_BASE_X - 12, y: -380, width: 28, height: 40, type: 'stone', sleep: 3 },
      ],
    },
  ];
}

module.exports = { getLevels };
