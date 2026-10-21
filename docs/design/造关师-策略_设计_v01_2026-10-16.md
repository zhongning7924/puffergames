# 造关师 2.0 重设计方案（T14）

> 交付物类型：Gameplay scheme + System spec（zxh-game-designer）
> 主设计目标（唯一）：**让玩家创作者获得「官方关卡设计师同款的策略视角」**——把 L39 v38 迭代 34 版沉淀的引擎机制实证（爆波杀伤半径、链爆传导、滚球双杀、abx 主动引爆、抛物线顶点限高、击杀组隔离）从代码注释里解放为编辑器内的实时设计智能。
> 次级目标（排序）：① 撤销/重做补齐编辑基建缺口；② UI 样式现代化；③ 难度量化反馈（AI 试解）。
> 命名玩家：「阿关」——25~40 岁休闲玩家，玩过官方 40 关，想造关给好友挑战；单次创作会话 10~20 分钟；成功信号 = 造出「AI 试解 W≥1 且自己打通」并分享。
> 平台约束：微信小游戏 375×667 竖屏、单指触摸、SAFE_TOP/SAFE_BOTTOM 随机型。

---

## 1. 现状审计（改什么、为什么）

| 层 | 现状 | 问题 | T14 动作 |
|---|---|---|---|
| 样式 | T12 已完成安全区/sketch 胶囊/大卡底栏 | 顶栏信息密度低；无撤销重做；无任何策略信息展示 | 顶栏加难度徽章+AI 试解+撤销重做；新增策略抽屉；世界区策略叠加层 |
| 校验 | level-validate：计数/禁区/重叠/越界 | 只挡「坏关」，不告诉创作者「关好不好」 | 保持（e2e 已锁），策略信息走独立通道不污染 issues |
| 策略 | 零——创作者裸手摆块，可解性只能靠自己试玩 | L39 v38 用 34 版实证才收敛的设计知识，玩家完全不可见 | 四件套：五维雷达/AI 试解/击杀组透视/弹道爆波可视化 |
| 基建 | 无历史栈，误删即丢 | 误删实体只能靠浮条复制重建 | 撤销/重做（draft 快照栈） |

## 2. 核心循环（一句话）

> 创作者放置实体 → 编辑器实时回显「该实体如何被击杀、与谁共死、关卡有多难」→ 创作者调整布局 → AI 试解确认非死局 → 亲自打通证明 → 分享。

意图层：把「造关」从**盲摆**变成**可验证的设计推演**；规则层：所有策略信号必须由引擎常量复算（§4）；数据层：draft 实体模型不变，策略读数全为派生值。

## 3. 玩家动词表（verbs）

| 动词 | 输入 | 系统响应 | 边界 |
|---|---|---|---|
| 放置/拖动/删除实体 | 世界区触摸（T12 现有） | 同现状 + 实时策略读数刷新 | 撤销栈压入 |
| 撤销 / 重做 | 顶栏 ↶ / ↷ 按钮 | draft 快照回退/前进 | 栈深 50；结构变异清 proven（同现状） |
| 查看击杀组 | 世界区常显叠加层 | 同爆波连通分量豚用虚线连 + 组号徽章 | 关开关（顶栏 👁） |
| 瞄具预览 | 挂载 bomb/burst 物料后手指在世界区 | 显示爆波圈（杀豚 R+猪半径 / 毁块 reach）或链爆圈 | 仅预览不放置（T12 吸附预览并存） |
| AI 试解 | 顶栏 🤖 按钮 | 分帧协程跑贪心 solver，进度条 → 结果卡（用鸟数/W/未解原因） | 编辑中/草稿变动自动作废上次结果 |
| 打开策略抽屉 | 顶栏 📊 按钮 | 右侧滑出：五维读数 + 指纹 + 击杀组清单 + 问题清单 | 抽屉打开时世界区触摸照常 |

## 4. 规则层：策略信号的精确定义（全部可复算）

### 4.1 击杀组分析（killGroups）

**定义**：以豚为节点，若两只豚可被**同一发炸弹爆波**同时杀伤则连边，求连通分量。

**公式**（源自 combat.js `explode` 实证）：
- 爆心 `(bx,by)` 对豚 `(px,py,r)` 杀伤条件：`d = hypot(px-bx, py-by) < 110 + r`（force>4 才掉血，d=110+r 时 force=4 不致死，故严格小于）
- 炸弹爆心可行域近似：瞄任意豚 `(tx,ty)` 时，撞点前 `17+r` px 起爆 → 爆心在以目标为圆心、`17+r_target` 为半径的圆上；贪心 solver 会优选覆盖最多豚的爆心。
- 简化可复算判据（编辑器用）：**两豚间距 `d < 2*(110 + min(rA, rB))` 判为同组**（爆心中置双杀的充要条件：爆心距两豚各 d/2，小豚需 d/2 < 110+r_min；该式已覆盖「瞄 A 起爆」路径 d < 81+rB−rA 的全部情形）。
  - 小豚 r12×2：`d < 244` 同组；小+大 r22：`d < 244`；大+大：`d < 264`；王 r28 参与取 min。
- **输出**：`[{ id, members:[豚索引], maxR }]` + 每豚的 `groupSize`（组员数）。组员 ≥2 且配队 bomb 数 < 组数 → **预警**「一炮双杀风险：组 G2 有 3 豚可被一发覆盖」。

**实证校准记录**（L39 v5~v38）：v5 滩前双豚 36px 一鸟双杀（knockback 连坐，非爆波）；v6 70px 滚球双杀；v13 B 距右垣 201px < 244 被同爆心覆盖。→ 组判定取**爆波连通**（炸弹轴），滚球连坐（normal 轴 ≤60px）另作 `rollPair` 提示。

### 4.2 滚球连坐提示（rollPairs）

**公式**（physics.js 实证）：normal/dash 撞豚后沿法线反弹贴地滚动，实测滚 57px；判据 `d12 ≤ 60` 且两豚都贴地（`y + r ≥ GROUND_Y − 4`）→ 提示「一鸟滚球双杀」。

### 4.3 五维难度读数（复用 level-sim v2，泛化到 level 对象）

| 维 | 公式 | 数据来源 |
|---|---|---|
| P1 弹药 | `5 − W`（W=配置鸟数−AI 用鸟数；未解记 null） | AI 试解 |
| P2 识别 | `min(5, D)`，D=承重柱+壳猪+冻果+多段目标 | 静态（decisionPoints 泛化） |
| P3 精度 | `clamp(round((70−trajectory)/12),1,5)`，自制关 trajectory=70 → **P3=1 恒定** | deriveLevel |
| P4 序列 | 直射1/坍塌2/连锁3（非王） | 静态（chainDepth 泛化） |
| P5 方差 | `min(5, R)`，R=暴露冻果数+sleep 实体 | 静态（varianceOf 泛化） |
| comp | 五维均值 | 派生 |

**章级映射**（给创作者的情境感）：comp 1.0~1.9=新手湾 / 2.0~2.9=珊瑚海 / 3.0~3.4=深渊要塞 / 3.5~3.9=极境深渊 / 4.0~5.0=潮汐王座。

### 4.4 AI 试解（影子对局，shadowReplay）

**算法**（与 tools/level-sim.js `solve()` 同构，泛化到 level 对象）：
1. 快照 game 编辑器上下文（editor/state/buttons/draft 引用不变）→ `setupLevel(game, deriveLevel(draft))`
2. 每步枚举「剩余鸟种 × 智能目标点」（醒猪心/块心/基座点/冻果心，bomb 对非猪目标设 abx），`aimBot` 网格瞄准（px∈[AX−95,AX−15] 步 4，py∈[AY−25,AY+115] 步 4）→ 逐候选 `shadowStep` 重放
3. 候选评分 `pigsDead*100 + bossDmg*30 + blocksGone*2`，贪心选最优
4. 结束恢复编辑器上下文；返回 `{ used, won, birdsN, W, state }`
5. **分帧协程**：每渲染帧执行预算 240 update 步（`game.update()` 直调，不走 rAF），进度 `done/total` 供 UI 进度条；结构变异（放置/删除/拖动/配队）立即使本次结果作废（`simDirty`）

**失败条件**（系统必须定义的行为）：
- 鸟尽未 WIN → 报「AI 未解」：非死局判据（贪心短视），但给创作者 🔶 提示「可能需要更直观的解法或减豚」
- 0 章鱼 → level-validate 已挡（no-pig），AI 试解按钮在 issues>0 时置灰
- 影子对局中用户继续编辑 → 对局在下一步边界检测 `simDirty` 即中止并恢复，不留半程状态

### 4.5 弹道/爆波可视化（overlay）

| 模式 | 绘制 | 公式 |
|---|---|---|
| 挂 bomb 瞄具 | 双圈：内圈 R=110+r_preview（杀豚，r 取 12 小豚）实线红；外圈 reach=110+max(w,h)/2（毁块，取预放置尺寸）虚线橙 | combat.explode |
| 挂 burst 瞄具 | 单圈 R=118（链爆传导实证半径）虚线红 | T6 实证「果心间距 ≤~118 可传递」 |
| 挂 normal/dash/split 瞄具 | 预测抛物线 90 步（`game.calculateTrajectory(AX,AY,vx,vy,90)`，取 45° 最大拉力代表弧线）半透明黄 | 官方 trajectory 提示同款 |
| 候飞豚选中 | 该豚种代表抛物线（同左） | 同上 |

## 5. 数据 schema（editor-strategy.js 输出）

```js
strategyRead(level) → {
  five: { P1, P2, P3, P4, P5, comp, W },   // P1/W 未试解时 null
  groups: [{ id, members:[idx], maxR }],    // 击杀组（爆波连通）
  rollPairs: [[i, j]],                       // 滚球双杀对（≤60px 贴地）
  warnings: [{ kind, msg, x, y }],           // 'group-risk' | 'no-bomb' | 'unsolved' | 'unreachable'
  fingerprint: string,                        // 复用 v2 指纹
}
```

## 6. 状态机增量（不新增 game.state 节点）

```
EDITOR（现有）
 ├─ strategyDrawer: bool      # 策略抽屉开合（渲染+命中分区）
 ├─ overlay: bool             # 击杀组叠加层开关（默认开）
 ├─ undoStack / redoStack: Draft[]   # 快照栈（实体实例深拷贝：blocks/pigs/pearls/birds）
 └─ sim: null | { running, done, total, result }   # AI 试解协程状态
```

触摸路由增量（editor.js onTouchStart）：
1. 顶栏带：退出 / ↶ / ↷ / 👁 / 🤖 / 📊 / 试玩（胶囊序列，几何走新 TOP_BAR 常量表）
2. 抽屉打开时：抽屉面板区优先（关闭按钮 + 列表滚动），世界区不穿透
3. 世界区：浮条优先 → 叠加层开关不影响命中 → 现有 hitTest/drag/place 链不变
4. 底栏：T12 结构不动（e2e 锁定）

## 7. 样式规范（马卡龙海洋风延续）

- 顶栏：深海军蓝 `rgba(18,40,66,0.92)` 底 + sketch 胶囊；难度徽章按章级取色（新手湾薄荷 / 珊瑚海珊瑚 / 深渊薰衣草 / 极境草莓 / 王座奶黄），徽章显示 `comp` 一位小数
- 击杀组叠加层：同组豚两两虚线（组色循环 5 色，α0.5），组号徽章（白字深底小圆）悬于组质心；孤豚（组员=1）不画
- 爆波圈：杀豚圈 `rgba(232,64,64,α)` 实线 2px；毁块圈 `rgba(255,167,38,α)` 虚线 2px；链爆圈 `rgba(232,100,100,α)` 虚线
- 策略抽屉：右滑入 300px 宽（屏高−顶栏），奶白玻璃面板（screens.js `drawGlassPanel` 同款语言），五维用横条（非雷达图——375 宽屏竖空间贵，横条信息密度高）
- 进度条：AI 试解时顶栏 🤖 按钮下方 2px 细条 + 百分比

## 8. 撤销/重做规则

- 压栈点：placeAt 成功 / removeAt 成功 / duplicateEntity / deleteSelected / moveEntity 松手（moved）/ addBird / removeBirdAt / 换队
- 快照 = draft 深拷贝（Block/Octopus 实例重建 + pearls/birds 浅拷贝）；栈深 50，超出丢最旧
- 撤销/重做后：selected/drag/palette/eraser 清空、revalidate、proven=false、sim 作废
- 不做：跨退出持久化（v1 语义不变）

## 9. 验收测试（回归门新增）

1. `strategyRead` 纯函数：L35 官方关 → groups/rollPairs/five 数值与 level-sim 静态部分一致（P2/P3/P4/P5 对齐）
2. 击杀组：构造 3 豚间距 36px → 1 组 size3；间距 300px → 3 组 size1
3. 滚球对：两贴地豚 50px → rollPairs=[[0,1]]；60px 以上 → 空
4. 影子对局：e2e 内对已知可解布局（1 豚 + 1 normal）→ won=true used=1；对局后 game.state==='EDITOR' 且草稿实体数不变（状态完整恢复）
5. 协程：sim.running 期间继续放置 → 下一步边界中止，无半程污染
6. 撤销重做：放置 3 实体 → ↶×3 回空 → ↷ 回 3
7. UI 触摸：👁 切 overlay、📊 开合抽屉命中区、🤖 在 issues>0 时置灰点击无响应
8. 全量回归：validate-levels ✓ / e2e 全绿 / build+verify-preview ✓

## 10. 开放问题（不默认填）

- 影子对局在低端机性能：每候选 ~350 帧 update，总帧数万级 → 已用分帧协程缓解；若真机仍卡，降级为「仅静态分析 + 官方关题库对照」。实现后用 e2e 计时断言总帧预算。
- AI 试解结果与「真人难度」的差距（贪心短视）已注明为提示非判据；是否展示「AI 差几步」的细化文案，真机试玩后定。

## 11. 实施批次

- **批 A**（T14.1）：editor-strategy.js 纯函数层（五维泛化 + 击杀组 + 滚球对 + 预警）+ e2e 纯函数断言
- **批 B**（T14.2 上）：影子对局 + 协程 + 撤销重做（editor.js 逻辑）
- **批 C**（T14.2 下）：UI 重做（editor-render.js + editor.js 触摸路由）
- **批 D**（T14.3）：e2e UI 断言 + 三门回归 + overview T14 + 提交

## 12. 实施记录与偏差（T14 定稿）

**交付文件**：`src/editor-strategy.js`（新，纯函数层）/ `src/editor.js`（逻辑）/ `src/editor-render.js`（渲染）/ `tools/e2e-tests.js`（+12 断言）/ `tools/test-harness.js`（幂等护栏）。

**验收成绩**：e2e **106/106**（旧 94 + T14 新增 12）；validate-levels ✓；level-sim 静态全章运行正常（唯一 ⚠「三章考峰 2.8 < 二章 3.0」为 9cc5162 之前既有的容忍项，王尖峰仍递增 4.3→4.8，非本轮引入）。策略纯函数五维 + 指纹与 level-sim 全 40 关逐一比对一致。

**与设计的偏差（实现决策记录）**：

1. **瞄具预览只做爆裂果链爆圈**（§4.5 的 bomb 双圈未做）：bomb 的杀豚圈/毁块圈依赖「预放置尺寸 + 起爆前 17+r」，而编辑器放置前无实体可测；且链爆圈（burst R=118）是 T6 实证半径、信息密度更高。bomb 挂载时沿用 T12 吸附预览，不画双圈。
2. **抽屉只盖世界区**（§6 触摸路由 2 的设计为「抽屉打开时世界区触摸照常」）：实现改为抽屉面板区（含关闭按钮 + 滚动态）优先吞掉，世界区与底栏均不穿透；底栏常驻可继续编辑（barTop 以下不受抽屉影响）。
3. **移除预沉降**：引擎实体静态语义实证——`Octopus.update` 仅当 `dynamic`（碰撞触发）才施加重力，悬空放置的豚/块不会自主落定。影子对局不做事前沉降，直接按草稿坐标求解。
4. **瞄准起点修正（关键）**：`renderer.drawTrajectory` 与 `input.js` 真实发射均从**拖动位**起算；编辑器原 `simAim` 与 `level-sim` 的 `aimBot` 从**弹弓锚点**起算，带 ≤95px 恒定偏移——悬空豚必歪。编辑器侧已改为钳制后从拖动位起算（`calculateTrajectory(bx, by, (AX-bx)*PF, (AY-by)*PF, 90)`）。**level-sim 的偏移是难度曲线既定基线，不可动**——两套起点差异是既有事实，编辑器以真实发射语义为准。
5. **P2 章王 multi +1**：`decisionPointsLevel` 的多段目标计数对章王额外 +1，与 level-sim 对齐（修 L8 P2 差 1）。
6. **置灰门依赖 render 维护**：`locked` 由 `drawTopTools` 每帧刷新（视觉与门同一数据源）。测试中任何「变异 → 立即点按钮」的场景必须先补一帧 `game.render()`，否则读到的是上一帧的旧置灰态（真实游戏 60fps 渲染无此窗口）。
7. **test-harness 幂等护栏**：e2e 中途 `require('./level-sim.js')` 会二次执行 `installEnv()`，换掉 `requestAnimationFrame` 闭包——游戏循环随后注册进新闭包的 `pendingCb`，而先装者的 `env.pump` 读旧闭包（永远 null），整条帧链静默断裂（表现为 pump 空转、locked 不刷新）。`installEnv` 已加 `global.__wbTestEnv` 复用护栏；options 以首次调用为准。

**遗留（不阻断）**： bomb 双圈瞄具（偏差 1）；「AI 差几步」细化文案待真机试玩定（§10）。
