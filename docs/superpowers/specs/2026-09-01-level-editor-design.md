# 造关师（UGC 关卡编辑器）设计文档

日期：2026-09-01　状态：待评审

## 1. 背景与目标

游戏当前为纯单机 40 关战役 + 每日/珍珠生成关，长线内容消耗完后无新增关卡来源，且玩家无创作/社交链路。本设计新增**关卡编辑器「造关师」**：玩家在手机端自建关卡、立即本地试玩、打通后生成关卡码经微信分享，好友点开即挑战。

目标：
- 给玩家**创作能力**，关卡池由 UGC 无限供给；
- 借微信分享做**社交传播**（好友间异步挑战比星）；
- 编辑器产出与手写关卡同构，零新游戏逻辑。

非目标（v1 不做）：章王/sleep 阶段物编辑、AI 试关员、云端关卡广场、自定义星级门槛/弹道长度、手动命名。

## 2. 核心设计原则

1. **编辑器产出 = 手写关卡同构的纯数据对象**（形状同 `levels.js`：`{name, flavor, birds, trajectory, stars, pigs[], blocks[], pearls[]}`），直接喂现有 `setupLevel(game, level)`，**关卡装载/物理/战斗零新逻辑**。运行时动态关卡已有先例：每日挑战（`game.dailyLevel` + `isDaily`，`game.js:301` 分流）。注意：结算页按钮、广告点位、珍珠收集等**外围流程需要 isCustom 门控分支**（见 §4/§7），这些是分支抑制而非新玩法。
2. **隔离开发**：编辑器全部代码在独立新文件，现有文件只做最小路由接线（状态转发 + 菜单按钮），不污染既有模块。
3. **能赢才能考别人**：关卡必须自己试玩打通（`proven=true`）才允许保存/分享，天然过滤无解关卡。
4. **移动端优先**：点选物料 → 画布点放（不从栏位拖拽，避免手指遮挡）；拇指热区在底部。

## 3. 玩家旅程

```
主菜单 →【造关】→ EDITOR（摆货/实时校验）→【试玩▶】→ READY→…→WIN/LOSE
                ↑                              │            │
                └────────【返回编辑】←───────────┴────────────┘
                │
                └→ WIN 后【保存】→「我造的关」列表；【分享】→ 微信卡片带关卡码
微信好友点开卡片（query.custom=<code>）→ 解码 → 直接挑战该关
菜单【输码挑战】→ 读剪贴板一键填码 → 挑战；通关成绩存「挑战记录」
```

## 4. 文件规划（隔离原则）

**新增文件：**

| 文件 | 行数估 | 职责 |
|---|---|---|
| `src/editor.js` | ~400 | EDITOR 状态全部逻辑：level 对象维护、物料栏状态、放置/选中/拖动/删除、触摸处理、试玩往返、校验调用、存档读写 |
| `src/editor-render.js` | ~250 | 编辑器 UI 绘制：顶栏、底栏 tab/物料、选中浮条、网格吸附预览、问题红圈、世界偏移渲染 |
| `src/level-codec.js` | ~120 | 关卡对象 ↔ 关卡码：序列化、反序列化、解码校验（纯函数，无游戏依赖） |

**最小接线（现有文件，每处仅路由/入口，不含编辑器逻辑）：**

| 文件 | 改动 |
|---|---|
| `src/game.js` | 状态机加 `EDITOR`；`update/render/触摸` 在 EDITOR 态转发 editor 模块；加 `customLevel/isCustom/editorDraft/playOrigin` 字段与 `enterEditor()/playCustom(level, origin)`；`getCurrentLevel()` 加 custom 分流（仿 `game.js:301`）；**`nextLevel()`（:358）/`retryLevel()`（:369）加 isCustom 分支**（挑战流：重打同一 customLevel；作者流：回编辑器，见 §7）；**`goToMenu()/goToLevelSelect()` 的 `AD.onLevelExit()` 插屏调用（:323/:336）在自定义关/编辑器过渡时绕开** |
| `src/input.js` | 加 `EDITOR` case，触摸事件转发 `editor.onTouch*` |
| `src/screens.js` | 主菜单加【造关】【输码挑战】两按钮；WIN/LOSE 页按 `playOrigin` 渲染两套按钮（见 §7）；**`isLastLevel` 判断（:1054）加 isCustom**（自定义关不显示「下一关」）；**三个广告按钮（复活 :1117 / 双倍 :1032 / 弹道全显 :1126）加 `!isCustom` 门控**——现状仅 `AD.available()` 门控，isDaily/isBonus 并不抑制广告，不能"仿照" |
| `src/settle.js` | isCustom 分流：不写战役进度、不解锁、不上传排行榜；胜负后按 playOrigin 走对应按钮流（见 §7） |
| `src/level-flow.js` | `setupLevel` 本身零改动（吃 level 对象）；但 **`loadLevel/startDaily/startBonus` 三个入口要显式 `isCustom=false; playOrigin=null`**（仿现有 isDaily/isBonus 互斥复位，:18/:29/:48），防止自定义关返回后标志残留、污染战役模式（不写存档/广告消失/按钮错套） |
| `src/combat.js` | **`collectPearl`（:192-209）加 isCustom 分支**：自定义关珍珠触碰 → +2000 分 + 飘字（走现有 floatingText/音效），**不写 `progress.pearls`、不调 saveProgress**（现状无条件写图鉴存档，自定义珍珠无 id 会污染存档） |
| `src/social.js` | `getLaunchOptionsSync` 识别 `query.custom` → 解码后进自定义关（playOrigin='challenge'）；分享标题区分自制关 |
| `tools/validate-levels.js` | 把几何校验抽成纯函数 `validateLevel(level) → {ok, issues:[{kind,x,y,msg}]}` 导出，**复用现有全部检查**（章鱼/方块互叠越界、沉地、珍珠贴章鱼、珍珠嵌入方块不可达、候飞豚越屏），再新增计数上限与弹弓禁区检查；脚本 CLI 行为不变 |
| `tools/test-harness.js` | wx mock 补 `getLaunchOptionsSync`/`getClipboardData`/`shareAppMessage`/`showShareMenu`（现状 social.available() 在 harness 中为 false，分享/直达两条 e2e 的前置基础设施） |

## 5. UI 布局（竖屏 375px 宽）

```
┌───────────────────────────────┐
│ ‹退出   🟢 0问题·12物    ▶试玩 │ 顶栏 44px
├───────────────────────────────┤
│                               │
│    ～·～·～  （编辑时不画弹道）  │
│     ／                        │
│    ●─→   ┌────┐               │
│   弹弓   │ 木梁│   🐙 章鱼     │
│          └────┘   ▣ 石块      │
│ 候飞 ●●● （点豚=移除）          │
│≡≡≡≡≡≡≡≡ 海床 ≡≡≡≡≡≡≡≡≡│
├───────────────────────────────┤
│ 方块│敌人│河豚●│道具           │ 分组 tab 28px
│ [梁][柱][块][石梁][石柱]…   → │ 物料横滚 56px
└───────────────────────────────┘
```

- **顶栏 44px**：左【‹退出】（回菜单，未保存提示）；中校验灯（🟢 n 物 / 🔴 n 问题，点击展开问题列表，点条目瞬移定位+红圈闪烁）；右【▶试玩】（校验红灯时置灰）。
- **世界区**：编辑模式世界整体上移 84px 渲染（`ctx.translate(0, -84)`，海床露在底栏上缘之上），触摸坐标做逆变换（`y + 84`）；试玩态正常渲染。
- **底栏 84px**：tab 行 28px（方块 / 敌人 / 河豚 / 道具）+ 物料横滚行 56px（chips 宽 ~64px，图标+小字）。
- **选中浮条**：点已放物体 → 物体上方浮出 `[🗑 删除] [✕ 取消]`，按住拖动可移位（网格吸附）。
- **放置预览**：选中物料后手指在画布移动，画半透明预览体 + 4px 网格吸附；落点非法（禁区/互叠/越界）时预览变红闪，拒绝放置。

### 物料表

| tab | 物料 | 放置行为 |
|---|---|---|
| 方块 | 木/石/冰 × 梁(80×26)、柱(28×80)、块(28×28) + 爆裂果（block 记录 26×26、type:'burst'，渲染为圆果，codec 按 block 枚举） | 画布点放 |
| 敌人 | 小章鱼 r17、大章鱼 r22 | 画布点放，自动落地面/方块顶面 |
| 河豚 | 嘟嘟/梭梭/砰砰/三丸子 | **不占画布**：点一下候飞队列加一只（上限 6）；点候飞区的豚移除 |
| 道具 | 奖励珍珠（上限 2，自定义关内触碰 +2000 分、不入图鉴不写存档，见 §7）、橡皮（删除模式：点物体即删） | 珍珠放画布 |

### 数量与禁区

- 上限：方块 40、章鱼 10、河豚 1~6、珍珠 2。顶栏计数实时显示 `方块 n/40`。
- 禁区：`x < SCREEN_WIDTH × 0.33`（弹弓/弹道区）禁放方块/章鱼/珍珠；落点非法红闪拒绝。

## 6. 关卡数据与实时校验

编辑过程中关卡就是一个内存 level 对象，每次增删/移动后调 `validateLevel(level)`（从 `tools/validate-levels.js` 抽出的纯函数，脚本与编辑器共用）：

- 复用现有全部检查：章鱼-章鱼互叠/水平越界/沉地、方块-方块互叠/越界、珍珠贴章鱼（开局即误拾）、珍珠嵌入方块（不可达）、候飞豚越屏；
- 新增编辑器检查：章鱼 ≥ 1 只；河豚 1~6 只；方块 ≤ 40；弹弓禁区（x < 屏宽×0.33）无物体；
- issue 带 `{kind, x, y, msg}`，供编辑器定位高亮。

试玩前自动补字段：`name: '自制关'`、`flavor: '玩家创作'`（HUD 标题读 `level.name/flavor`，`renderer.js:476`，缺字段会渲染 undefined）；`trajectory: 70`（满弹道，创作友好）；`stars` 用每日关现成公式：满分 = 章鱼×1000 + 方块×250，门槛 = 满分 × [0.6, 1.0, 1.5] 取整。

## 7. 试玩闭环

- 【▶试玩】→ `game.customLevel = level`、`isCustom = true`、`playOrigin = 'author'`（编辑器进入）或 `'challenge'`（好友卡片/输码/存档关进入，此时 `editorDraft` 为空）→ 现有 `setupLevel()` 装载 → READY，同一套物理/渲染/结算。
- 自定义关内：不写战役存档、不解锁、不上传排行榜。**广告点位全部不出现**（复活/双倍/弹道全显按钮加 `!isCustom` 门控；返回编辑/重打等过渡绕开 `AD.onLevelExit()` 插屏——注意现状广告仅由 `AD.available()` 门控，isDaily/isBonus 并不抑制，这是新增门控）。
- 珍珠：自定义关内触碰珍珠 → +2000 分 + 飘字，不写图鉴、不 saveProgress（`combat.collectPearl` 加 isCustom 分支）。
- **结算页按钮按入口分两套**：
  - 作者流（playOrigin='author'）：WIN →【返回编辑】【保存并分享】；LOSE →【返回编辑】【再试一次】（重打本关）。
  - 挑战流（playOrigin='challenge'）：WIN →【再来一次】【分享给朋友】（转发同一关卡码，二次传播）【返回菜单】；LOSE →【再来一次】【返回菜单】。挑战流不提供"保存到我造的关"（他人作品不进自己的创作列表）；v1 不做 remix 改写他人关卡。
- `nextLevel()`/`retryLevel()` 加 isCustom 分支：自定义关无"下一关"（WIN 页不显示该按钮）；重打 = 重新 `setupLevel(customLevel)`，不得落入 `loadLevel(战役下标)`。
- **proven 规则**：作者流试玩打通 → `proven = true`。返回编辑后，**任何结构变异**（增/删/移动方块·章鱼·珍珠，以及河豚队列增删/换种）都将 `proven` 重置为 false——仅移动位置同样改变可通关性，必须重新证明。纯视图操作（选中、切换 tab、滚动物料栏）不重置。

## 8. 关卡码与分享

- `level-codec.js`：坐标量化到 4px 网格；类型/尺寸/半径全部枚举为数字；自定义 64 字符表编码（每数 1~2 字符）；前缀 `PG1`。
- 长度目标：上限配置（40/10/6/2）内 < 700 字符，微信分享 query（限 ~1024）安全；超上限/解码失败拒绝并提示。
- 分享：`wx.shareAppMessage` 带 `query: 'custom=<code>'`，标题如「我造了一关「自制·09-01」，你能拿 3 星吗？」。
- 直达：`social.js` 启动参数识别 `query.custom` → 解码（失败弹「关卡码损坏」）→ 直接进自定义关。
- 【输码挑战】：`wx.getClipboardData` 一键填入剪贴板中的码。

## 9. 本地存档（新 key，不动旧存档）

- `pufferGo_editor_levels`：我造的关 `[{name, code, proven, createdAt}]`，name 自动命名「自制·MM-DD #n」。
- `pufferGo_played_levels`：挑战过的关 `[{code, bestStars, playedAt}]`。
- 「我造的关」/「挑战记录」从主菜单入口进入列表（v1 简单列表：名称 + 星数 + 进入/删除）。
- 旧 key `angryBirds_progress` / `angryBirds_settings` 一律不动。

## 10. 测试计划

回归门不变：`node tools/validate-levels.js` → `node tools/e2e-tests.js` → `node build-preview.js && node verify-preview.js`，全绿才算完成。

新增测试（0 号为前置基础设施）：
0. **test-harness 扩 mock**：`getLaunchOptionsSync`（可注入 query）/`getClipboardData`/`shareAppMessage`/`showShareMenu`，使 `social.available()` 在 harness 中为 true。
1. **codec 纯函数**：随机 level 往返（encode→decode 深相等）；坏码/截断码/非法枚举拒绝；超上限配置拒绝。
2. **validateLevel 纯函数**：每种 issue 构造样例（互叠/越界/沉地/贴珍珠/珍珠嵌入方块/无章鱼/无河豚/超上限/禁区有物）。
3. **e2e（用 test-harness 的 fire/pump 无头驱动）**：
   - 放置 3 物 → 校验绿 → 试玩 → 自动发射打通简单关 → WIN（作者流按钮：返回编辑/保存并分享）→ 返回编辑物体仍在；
   - 未通关时【保存并分享】不出现；proven 后**移动**一只章鱼（或换豚种）→ proven 重置；
   - 挑战流（query.custom 直达）：能装载且字段完整、WIN 按钮为再来一次/分享/返回菜单、**无「下一关」且 nextLevel 不落入战役关**；坏码给错误提示；
   - 自定义关内：不写战役进度、三个广告按钮均不出现、重打不触发插屏频控；
   - 自定义关内拾珍珠：+2000 分、`progress.pearls` 无新增 key、无 saveProgress 写入。

## 11. v1.1+ 预留（不实现）

- AI 试关员：无头蒙特卡洛自动试射（harness + calculateTrajectory 基础设施现成），报可通关/预估难度；
- 章王/sleep 阶段物编辑（需设计阶段号在 2D 画布上的 UX）；
- 云端关卡广场（微信云存储）；
- 罗格列克模式等其他方向（本次 Brainstorm 已记录，独立 spec）。
