# 马卡龙海底 · 可爱主题改造设计

日期：2026-09-01
状态：已批准（brainstorming 阶段），经规格评审第 1 轮修订
范围：弹弓重做 + 全局视觉语言可爱化（纯绘制层，不动玩法/物理/数值）

## 1. 背景与目标

当前游戏（《冲吧！小河豚》，微信小游戏，Canvas 2D 纯矢量绘制、零图片素材）整体是海洋题材：河豚族弹射者 vs 章鱼怪，海底战场。玩家反馈「弹弓的样式太简单」——现状弹弓只是 3 笔棕色木叉 + 深棕橡皮筋（`src/renderer.js` 的 `drawSlingshotBack/Front`），且整体配色偏写实（深棕木、深灰岩、暗蓝深海），缺少二次元可爱感。

目标：把整体视觉语言升级为**梦幻马卡龙·治愈系**可爱风（低饱和粉彩、粗圆角描边、腮红高光、星星珍珠元素），弹弓重做为**粉珊瑚枝叉**。气质参考《动物森友会》的温柔软萌感，保留海底题材与河豚主角辨识度。

## 2. 范围

**在范围内：**
- 弹弓造型重做（珊瑚枝叉 + 粉白条纹海丝带 + 珍珠蝴蝶结 + 发射回弹/星星粒子）
- 全局配色换为马卡龙色板（`config.js` 的 `COLORS` 改值，键名不变）
- 新增 `src/theme.js`：可爱元素共享绘制工具（不持有色值，色值统一来自 `COLORS`）
- 角色细节升级：河豚/章鱼加腮红、强化已有眼睛高光
- 方块圆角化 + 高光头 + 柔描边
- 弹道预览点与上一发残影统一改小气泡（混小星星）
- 背景静态缓存加淡金光斑
- HUD/界面（`screens.js`）：玻璃面板改奶白、按钮厚黑描边柔化、高饱和实例色马卡龙化
- 粒子系统支持星形（`Particle` 加 `shape` 字段）

**不在范围内（YAGNI）：**
- 角色造型重绘/比例 Q 版化（现有河豚章鱼造型保留，只加细节）
- 贴图/AI 素材管线（包体敏感、风格难统一，明确不做）
- 物理、关卡、数值、弹弓锚点坐标、碰撞尺寸——全部不动
- BGM/音效改动
- 微信品牌绿 `#07C160`（微信按钮合规色，保留不动）

## 3. 技术方案：纯 Canvas 矢量升级

沿用现有技术栈，零图片素材、零包体增长、DPR 自适应不糊。

### 3.1 配色系统（`src/config.js`）

`COLORS` 对象**键名全部不变**（逻辑代码零改动），仅改值，并新增少量可爱元素专用色键。

| 元素 | 键 | 现值 | 新值 |
|---|---|---|---|
| 海水 上/中/下 | `waterTop/waterMid/waterDeep` | `#4FC3F7/#0288D1/#01579B` | `#C8EDF8/#8FD4EF/#5FB4E0`（保留上浅下深的水下感） |
| 远景礁石 | `reef` | `rgba(1,87,155,0.5)` | `rgba(95,180,224,0.45)` |
| 海床沙 | `sand/sandDark` | `#FFE0B2/#E6C08C` | `#FFF1E0/#F3D9BE`（奶杏色） |
| 岩层 | `rock` | `#455A64` | `#B8C4D6`（雾霾蓝灰） |
| 弹弓 | `slingWood/slingWoodLight` | `#5D4037/#795548` | `#F48FB1/#F8BBD0`（珊瑚粉，后深前浅） |
| 丝带 | `slingBand` | `#3E2723` | `#F06292`（粉底，白纹靠绘制） |
| 按钮主色 | `buttonBg/buttonBgDark` | `#FF7043/#E64A19` | `#FF9E9E/#F48FB1`（草莓奶霜） |
| 方块 木/石/冰 | `wood*/stone*/ice*` | 棕/灰/蓝 | 奶茶 `#D9C2A8`系 / 雾霾蓝 `#B0C4D8`系 / 冰晶 `#B3E5FC`系（材质靠色相保持可辨识） |
| 章鱼怪 | `pigBody` | `#BA68C8` | `#CE93D8`（薰衣草紫） |
| 章鱼怪暗部 | `pigBodyDark` | `#7B1FA2` | `#A569BD`（柔和深紫；**不可用 `#AB47BC`**——那是 `pigSnoutDark` 吸盘尖的现值，撞色会糊） |
| 河豚黄 | `birdBody` 等 | `#FFD54F` | **保留不动**（主角辨识度） |

**新增色键：**
- `blush: '#FF9E9E'`（腮红，以 `rgba(255,158,158,0.55)` 半透明使用）
- `ribbonWhite: '#FFF5F8'`（丝带白纹/蝴蝶结高光）
- `sparkleGold: '#FFE082'`（淡金，新星星/光斑专用）

**不动的既有键：** `starGold: '#FFD54F'` 已存在并被 combat.js（COMBO/讨伐飘字）、settle.js、physics.js（弱点飘字）、screens.js（设置页星星/面板文字）使用——**保持原值**，新装饰元素一律用 `sparkleGold`，避免连带改变既有金色文字。`white` 键复用，不新增 `pearl`。

**界面实例色（`screens.js` 中 `new E.Button` 等处硬编码）：** `#0288D1 / #9C27B0 / #FFA726 / #78909C / #AB47BC` 等高饱和色统一降饱和/调粉马卡龙化（如蓝→`#7FC8E8`、紫→`#CE93D8`、橙→`#FFCC80`、灰蓝→`#B0BEC5`）；微信绿 `#07C160` 保留。**计划阶段需 grep 一遍 `new E.Button` 的色参全量核对**（另有 `#26C6DA / #00ACC1 / #546E7A / #FF9F43` 等），避免漏网。

### 3.2 新增 `src/theme.js`（约 120 行）

收口「怎么画得可爱」的共享绘制工具，`renderer.js` 与 `entities.js` 都 require 它。**约定：theme.js 不持有色值**（色值唯一来源是 `config.js` 的 `COLORS`，theme.js require C 取色），也不 require entities.js（避免循环依赖）。每个函数纯绘制、无状态、以 `ctx` 为首参：

- `strokeCute(ctx, width, color)` —— 设置粗圆角描边（`lineWidth`/`lineCap='round'`/`lineJoin='round'`/`strokeStyle`）
- `drawBlush(ctx, x, y, r)` —— 腮红（半透明粉椭圆）
- `drawHighlight(ctx, x, y, rx, ry, color)` —— 椭圆高光（默认白）
- `drawStar(ctx, x, y, r, color)` —— 四角星（Sparkle，二次元高光常用形）
- `drawBubble(ctx, x, y, r, alpha)` —— 小气泡（圆描边 + 高光弧，弹道点用）
- `drawBow(ctx, x, y, size, color)` —— 蝴蝶结（两个圆瓣 + 中心结）
- `drawPearlBead(ctx, x, y, r)` —— 珍珠底层画法（白圆 + 高光点 + 淡粉描边）；`entities.js` 现有 `drawPearl`（pearls.js 场景珍珠在用）改为**委托调用** `T.drawPearlBead`，保持其签名与调用方不变，消除两套珍珠画法。

### 3.3 弹弓造型（重写 `drawSlingshotBack/Front`，`src/renderer.js`）

- **珊瑚枝叉**：`lineWidth` 8→11；枝丫由折线改二次贝塞尔曲线（圆润弯曲）；枝顶各 2 个小圆凸（珊瑚虫感）+ 白色高光点；
- **海丝带（橡皮筋）**：粉色线照旧连接叉顶与鸟身（锚点坐标不变），其上叠一层**白色虚线**（`setLineDash([5,5])`）→ 呈现粉白条纹；拖拽拉伸时条纹随线长自然变化，零额外计算；虚线绘制必须用 `ctx.save()/restore()` 包裹并复位 `setLineDash([])`，避免污染后续绘制；
- **珍珠蝴蝶结**：叉柄中部画 `drawBow` + 2 颗 `drawPearlBead` 挂饰；待机时随 `game.frameCount` 轻微摇摆（±0.05 rad，`sin(frameCount*0.05)`）；
- **前后遮挡关系不变**：back 画左叉+后丝带，front 画前丝带+右叉；
- **发射回弹与星星粒子（关键：触发时机）**：`currentBird` 在整个 FLYING 阶段都非空（飞行中的鸟还在），变 null 时已进入 SETTLING，**不能以「鸟为 null」判断发射瞬间**。做法：在发射转换点（`game.js` 中 `createLaunchParticles` 的同一钩子，约 `game.js:568`）设置 `game.slingSnap = 8`（帧），游戏循环每帧递减；`drawSlingshotFront` 在 `slingSnap > 0` 时于两叉顶间画一条短回弹丝带（水平偏移振幅随 snap 衰减，如 `sin` 抖动 × snap/8），呈现「啪」地回弹。同钩子 spawn 3~4 颗星形粒子（见 3.4）。

### 3.4 全局视觉语言改动清单

| 位置 | 改动 |
|---|---|
| `entities.js` 粒子 `Particle.draw`（917-927 行） | 现画**旋转实心方块**且 `spawnParticle` 无形状参数。新增 `shape` 字段（默认 `'square'` 保持现状），`'star'` 时画四角星（调 `T.drawStar`）；`effects.spawnParticle(game,x,y,vx,vy,color,life,size,shape)` 末参透传 shape，**池化 reset 签名同步加参**（漏传会让复用粒子形状不重置）。**透传链有两段**：`game.spawnParticle` 包装器（`game.js` ~569，与发射钩子紧邻；effects.js 内部所有调用都走它）也要加末参透传，否则 shape 永远到不了粒子 |
| 发射钩子（`game.js` ~568） | spawn 3~4 颗 `shape:'star'`、`sparkleGold` 色粒子（经 `game.spawnParticle` 透传） |
| `entities.js` 河豚/章鱼 `draw` | 两颊加 `T.drawBlush`；眼睛**已有**白色高光点（215-220、569-574 行），改为放大/强化（高光半径加大、加副高光点），不是新增 |
| `entities.js` 方块 `draw`（751 行起） | 直角→圆角（复用 `U.roundRectPath`）；顶部 2px 高光头；柔色描边；碰撞尺寸不变 |
| `renderer.js` `drawTrajectory` | 白点 → `T.drawBubble`；每 5 个点混 1 颗 `T.drawStar`（`sparkleGold`） |
| `renderer.js` `drawLastTrail`（254-264 行） | 上一发弹道残影的纯白圆点**同步**改为气泡，与预览弹道视觉统一 |
| `renderer.js` 背景缓存 | `drawWater` 加几粒淡金小光斑/星光（进离屏缓存，零运行时成本）；气泡已在逐帧层 |
| `renderer.js` `drawBossBar` | 紫填充 → 粉紫渐变（`#CE93D8→#F48FB1`）；槽底硬编码深棕 `#3E2723`（329 行）→ 柔色 `#8D6E63`；残血红 `#EF5350` 柔化为 `#FF8A80`（脉动逻辑不变） |
| `screens.js` `drawGlassPanel`（42-99 行） | **`COLORS.panelBg` 是死键（全库无引用），不改它**。真正要改：`drawGlassPanel` 硬编码的深海渐变 `#0277BD→#01487E` → 奶白/浅粉半透明渐变；`drawOceanDim` 的 `rgba(2,60,102,…)` 柔化为暖色暗纱；选关卡片硬编码填充同步马卡龙化 |
| `screens.js`/`entities.js` sketch 按钮 | 按钮圆角**已经是 14**（`entities.js` Button 默认 12、sketchOpts 传 14），无 radius=8 可改。真正杠杆：厚黑描边配方（`outlineColor:'#1A1A1A'`、strokeWidth 3、硬投影，entities.js 1041-1066）→ 描边改柔深色（深粉棕 `#AD6E87`）、硬投影改低透明柔和投影；按钮实例色按 3.1 节清单马卡龙化 |

### 3.5 不动的部分

物理常量、关卡数据、鸟/猪/方块碰撞半径与血量、弹弓锚点（`SLINGSHOT_X/Y`）、输入与状态机、广告/社交/每日挑战等系统模块。

## 4. 用户参与点

配色的唯一数据源是 **`src/config.js` 的 `COLORS` 块**（theme.js 只 require 它、不另建色表，避免两份会漂移的色值源）。实现时先完成全部结构与绘制工具，**`COLORS` 块中本次改值的 8~10 个马卡龙色值留给用户填写/微调**：每个色值上方写清用途与约束（如「不可与 pigSnoutDark 同值」），用户在默认值基础上调整粉度/亮度——这是主题「口味」的核心决策，属于有意义的设计输入而非样板代码。

## 5. 测试与回归

1. **E2E 无异常**：`node verify-preview.js`（Node 模拟浏览器跑 preview/bundle.js：菜单→选关→瞄准→发射全链路）+ `node tools/e2e-tests.js` + `node tools/validate-levels.js`，确认零运行时异常、零行为回归；
2. **视觉回归**：改前用 `preview/`（浏览器预览 + `_shot-bundle.js` 截图 bundle）截基线图，改后同关卡截图对比，重点看：弹弓前后遮挡、拖拽时丝带条纹、蝴蝶结摇摆、发射回弹与星星粒子、弹道/残影气泡、方块圆角、腮红位置、面板与按钮配色、**场景珍珠**（`drawPearl` 委托 `drawPearlBead` 后描边由蓝 `#81D4FA` 变淡粉，是有意变化，需确认观感）；
3. **真机预览**：微信开发者工具真机看 DPR 下描边粗细与粉色表现（真机发色偏艳，必要时降饱和）；
4. 性能：弹弓每帧新增绘制调用 < 15 个，背景光斑进离屏缓存，粒子复用现有对象池，无逐帧分配压力。

## 6. 风险与缓解

- **粉色撞河豚黄**：河豚黄 `#FFD54F` 保留高饱和，珊瑚粉 `#F48FB1` 与其色相差大，不撞；沙色改奶杏后仍与黄有明度差；
- **方块材质不可辨**：圆角后靠色相（奶茶/雾霾蓝/冰晶蓝）+ 冰的半透明感区分，关卡克制矩阵（木/石/冰）玩法不受影响；
- **丝带虚线污染上下文**：`setLineDash` 必须 `save/restore` 包裹并复位；
- **回弹时机判断错误**：严禁以 `currentBird === null` 判定发射（FLYING 时鸟非空），必须用发射钩子 + `slingSnap` 计时器；
- **粒子池化形状残留**：`shape` 必须穿过 effects.js 池化 reset，否则复用的旧粒子会带着 'star' 形状出现在别的爆炸里；
- **改了死键零效果**：`panelBg` 无引用、按钮 radius 已是 14——界面改动必须落到 3.4 节点名的硬编码位置；
- **真机过艳**：色值预留降饱和空间，真机预览后微调。
