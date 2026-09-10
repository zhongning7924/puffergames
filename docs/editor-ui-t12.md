# 造关师编辑器 UI 重做 (T12)

> 截止 `main` 分支，T12.1–T12.4 已全部合入。

## 概览

T12 将编辑器从硬编码、单层底栏升级为**安全区感知**的现代 UI：

| 子任务 | 内容 | 状态 |
|--------|------|------|
| T12.1 | 地基：`C.SAFE_TOP` / `C.SAFE_BOTTOM` 配置，`GROUND_Y` 实时读 | ✅ |
| T12.2 | 顶栏重做：sketch 胶囊退出/试玩 + 4 分类分段控件 | ✅ |
| T12.3 | 底栏重做：材质筛选 + 透明井 + 大卡 + 橡皮槽 | ✅ |
| T12.4 | 选中浮条：复制/删除按钮 + `canAddEntity` 抽取 | ✅ |

## 架构

### 两文件分工

```
src/editor.js        # 逻辑层：状态模型、触摸状态机、布局常量、校验、编辑操作
src/editor-render.js # 渲染层：读取 editor.js 导出的布局函数和常量，纯绘制
```

渲染层**不硬编码几何值**——调用 `barLayout(d)` 获得实时布局矩形，由逻辑层保证与触摸命中一致。

### 安全区模型

```
┌──────────────────────────────┐ y=0
│  C.SAFE_TOP (刘海/状态栏)    │
├──────────────────────────────┤ SAFE_TOP
│  顶栏内容带 (48px)           │ exit/play 胶囊 + 4 分段
├──────────────────────────────┤ SAFE_TOP + 48
│                              │
│  世界区 (编辑画布)           │ ← 弹弓禁放虚线、候飞豚、草稿实体
│                              │
├──────────────────────────────┤ barTop = filterTop (blocks) / cardTop (非 blocks)
│  材质筛选行 (36px, 仅blocks) │ 木·石·冰·果 四段，面板 x≥80
├──────────────────────────────┤ cardTop = H - SAFE_BOTTOM - 64
│  [橡皮] [大卡]...[大卡]      │ 卡行：橡皮槽 x8-64 + 72×56 大卡 x≥80
└──────────────────────────────┘ H
   SAFE_BOTTOM 留白（Home 指示条）
```

### 透明井 (Transparent Well)

卡行 `x < 80` 区域不绘制任何 UI 元素：
- **橡皮槽**：`x ∈ [8, 64]`——常驻固定槽，任何分类下可见
- **透明井**：`x ∈ [0, 8)` 和 `x ∈ [64, 80)`——触摸穿透到世界区，用于操作候飞豚队列、橡皮模式擦除实体
- 材质筛选行 `x < 80` 同样穿透到世界区

## 关键数据流

### 布局计算

```js
// barLayout(d) — 编辑态实时调用，不缓存
barLayout(d) → {
  topH,         // SAFE_TOP + 48
  cardTop,      // H - SAFE_BOTTOM - 64
  filterTop,    // cardTop - 36
  showFilter,   // d.tab === 'blocks'
  barTop,       // showFilter ? filterTop : cardTop
  filterW,      // SCREEN_WIDTH - FILTER.x - 8
  filterSegW,   // filterW / 4
}
```

### 物料可见性

```js
// blocks 分类：材质子筛选
visibleItems(d) → MAT_GROUPS[d.matFilter] 过滤后的 PALETTE 项

// 其他分类：全量
visibleItems(d) → PALETTE[d.tab]
```

### 放置校验

```js
canAddEntity(draft, ent) → { ok, reason }
// ent 辨识：width → Block, radius → Pig, 其他 → Pearl
// reason: 'limit' | 'zone' | 'overlap'
// placeAt 与 duplicateEntity 共用，非 limit 类失败闪红反馈
```

## 导出接口（editor-render 消费）

```js
// 布局常量
TOP_CONTENT_H, SEG, FILTER_H, CARD_AREA_H, CARD_W, CARD_H, CARD_GAP, CARD_PITCH,
CARD_X, FILTER, ERASER_SLOT, ZONE_X, FLOAT_BAR

// 布局函数
barLayout(d), visibleItems(d), barMaxScroll(d), floatingBarRect(d)

// 物料常量
MAT_GROUPS, MATERIALS, ERASER_ITEM

// 编辑操作
placeAt, removeAt, canAddEntity, duplicateEntity, deleteSelected
```

## 触摸状态机

```
touchstart(x,y)
  ├─ y < topH → 顶栏（胶囊 / 分段）
  ├─ y ≥ barTop → 底栏
  │   ├─ 筛选行, x ≥ 80 → 材质过滤
  │   ├─ 筛选行, x < 80  → ▼ 穿透
  │   ├─ 卡行, 橡皮槽     → toggleEraser
  │   ├─ 卡行, x ≥ 80    → barDrag（横滚手势）
  │   └─ 卡行, x < 80     → ▼ 穿透到世界区
  └─ 世界区
      ├─ 浮条命中        → copy / delete
      ├─ worldDown=true
      ├─ 橡皮模式 + 命中  → removeAt
      ├─ 命中实体         → 选中 / 拖动
      └─ palette 挂载     → placeAt → canAddEntity
```

## 回归门

- **e2e 测试**：`node tools/e2e-tests.js` — 90 项全部通过
- **关卡校验**：`node tools/validate-levels.js` — 40 关几何 + 生成关卡通过
- **新增 5 项 T12-3/4 专项回归**：材质筛选、透明井路由、canAdd 校验、浮条复制/删除