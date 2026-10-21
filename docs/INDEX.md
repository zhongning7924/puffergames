# 文档索引

> 本文件是项目文档的**唯一导航入口**。任何 AI 会话或新人接手，先读这里再读具体文档。
> 新增、移动、改名文档时**必须**在此登记；未登记视为治理违规。
> 最后更新：2026-10-20（文件治理批次 plan_id `7770a2e86d48`）

---

## 一、按用途找（最快路径）

| 我想…… | 看这份 |
|---|---|
| 第一次上手项目 | [`../README.md`](../README.md) |
| 查某一版改了什么 | [`../overview.md`](../overview.md) |
| 调关卡难度 / 加新关 | [`superpowers/plans/2026-10-14-difficulty-curve-v2.md`](superpowers/plans/2026-10-14-difficulty-curve-v2.md) |
| 改造关师编辑器（策略/读数/AI 试解） | [`design/造关师-策略_设计_v01_2026-10-16.md`](design/造关师-策略_设计_v01_2026-10-16.md) |
| 改造关师界面布局 | [`design/造关师-界面_设计_v01_2026-09-10.md`](design/造关师-界面_设计_v01_2026-09-10.md) |
| 调广告点位 / 频控 | [`product/广告接入_方案_v01_2026-08-31.md`](product/广告接入_方案_v01_2026-08-31.md) |
| **改 40 关官卡的某几关 / 发到线上 / 回滚** | [`product/官卡下发_方案_v01_2026-10-20.md`](product/官卡下发_方案_v01_2026-10-20.md) |
| 看美术与配色约定 | [`superpowers/specs/2026-09-01-cute-theme-design.md`](superpowers/specs/2026-09-01-cute-theme-design.md) |
| 看造关师最初的规格 | [`superpowers/specs/2026-09-01-level-editor-design.md`](superpowers/specs/2026-09-01-level-editor-design.md) |
| 看造关师最初的分步计划 | [`superpowers/plans/2026-09-01-level-editor.md`](superpowers/plans/2026-09-01-level-editor.md) |
| 看早期的难度曲线方案 | [`superpowers/plans/2026-09-07-difficulty-curve.md`](superpowers/plans/2026-09-07-difficulty-curve.md) |

---

## 二、文档清单

| 路径 | 主题 | 类型 | 状态 | 一句话内容 |
|---|---|---|---|---|
| `../README.md` | 项目总入口 | 说明 | 现行 | 上手、目录结构、回归门、发版注意事项 |
| `../overview.md` | 迭代史 | 记录 | 现行 | T1 起逐轮记录，含每轮机制改动与遗留项 |
| `design/造关师-策略_设计_v01_2026-10-16.md` | 造关师 2.0 | 设计 | 已定稿 | 五维难度读数、击杀组、滚球对、AI 影子对局、撤销重做（原 T14 文档） |
| `design/造关师-界面_设计_v01_2026-09-10.md` | 造关师界面 | 设计 | 已定稿 | 顶栏/底栏/分段控件/大卡布局（原 T12 文档） |
| `product/广告接入_方案_v01_2026-08-31.md` | 广告 | 方案 | 现行 | 三类广告形态、点位与频控、避让规则、上线与变现检查表（含「为何现在收益为 0」） |
| `product/官卡下发_方案_v01_2026-10-20.md` | 官卡下发 | 方案 | 现行 | 三条改关路径、本地后台 `tools/level-admin/` 用法、版本号规则、回滚与排错 |
| `superpowers/plans/2026-10-14-difficulty-curve-v2.md` | 难度曲线 v2 | 方案 | 已执行 | 五维压强预算、章内三幕节律、§13 执行记录 + 引擎机制库 |
| `superpowers/plans/2026-09-07-difficulty-curve.md` | 难度曲线 v1 | 方案 | 历史 | 已被 v2 取代，保留用于追溯 |
| `superpowers/plans/2026-09-01-level-editor.md` | 造关师 v1 计划 | 方案 | 历史 | 造关师最初的分步实施计划（66KB 合集） |
| `superpowers/specs/2026-09-01-level-editor-design.md` | 造关师 v1 规格 | 规范 | 历史 | 造关师最初的功能规格 |
| `superpowers/specs/2026-09-01-cute-theme-design.md` | 可爱化主题 | 规范 | 现行 | 海洋可爱风配色与绘制约定 |

> `superpowers/` 下的文件由外部工具（superpowers 计划/规格工作流）生成与读取，**禁止改名或移动**，否则插件会找不到。

---

## 三、2026-10-20 文件治理记录（旧路径 → 新路径）

本次治理只做**摆放与命名**，未删除任何文件、未改写任何文档内容（除一处标题随改名同步）。

| 旧路径 | 新路径 | 变更原因 |
|---|---|---|
| `docs/editor-redesign-t14.md` | `docs/design/造关师-策略_设计_v01_2026-10-16.md` | docs 根平铺 → design 象限；主题去内部代号 T14，补类型段/版本/日期 |
| `docs/editor-ui-t12.md` | `docs/design/造关师-界面_设计_v01_2026-09-10.md` | 同上，去代号 T12 |
| `docs/广告接入方案.md` | `docs/product/广告接入_方案_v01_2026-08-31.md` | 属产品方案 → product 象限，补日期 |
| `dbg.html` | `tools/probes/probe-editor-state.html` | 调试探针离开仓库根 |
| `preview/probe-geom.html` | `tools/probes/probe-editor-geom.html` | 探针离开预览目录，集中管理 |
| `tools/tmp-layout-probe.js` | `tools/probes/probe-editor-layout.js` | 去 `tmp-` 临时语义，正式命名 |

**如果你的链接、书签或记忆仍指向左列旧路径，一律按右列新路径解析。**

- 撤销日志（可逐条回滚）：`../.file-governor/undo-7770a2e86d48.jsonl`
- 已同步更新的引用：`src/editor-strategy.js`、`src/ad.js`、`tools/e2e-tests.js`、`README.md`（2 处）、`superpowers/plans/2026-10-14-difficulty-curve-v2.md`、`outputs/audit-content-20260901.md`

---

## 四、保留原名（例外登记）

| 路径 | 违反条款 | 原因 | 处置 |
|---|---|---|---|
| `../overview.md` | 根目录只放入口级文件 | CHANGELOG 性质，被 README 链接与 `project.config.json` 的 ignore 白名单引用 | 保留原名 |
| `../outputs/audit-content-20260901.md` | 日期段非 ISO 格式 | 已对外提交的备案文案，被 `.gitignore` 白名单 glob 引用 | 保留原名 |
| `../outputs/release-materials-20260907.md` | 日期段非 ISO 格式 | 已发布发版物料 | 保留原名 |
| `superpowers/plans/*.md`、`superpowers/specs/*.md` | 缺类型段 / 非中文主题 | 外部工具约定目录与命名，改动即断链 | 保留原名 |

责任人：项目 owner；计划解决时间：`overview.md` 待根目录进一步收敛时处理，其余「永不适用」（原因见上）。

---

## 五、新增文档的命名规则

```text
<主题>_<类型>_vNN[_YYYY-MM-DD].md
```

| 落点 | 规则 | 示例 |
|---|---|---|
| `docs/design/` | 主题-限定_设计_vNN_日期 | `造关师-手感_设计_v01_2026-10-20.md` |
| `docs/product/` | 主题_方案_vNN_日期 | `每日挑战_方案_v01_2026-10-20.md` |
| `tools/probes/` | probe-用途（纯 ASCII 小写连字符） | `probe-editor-hitbox.js` |

- 长期有效的规范类文档带版本号、**不带日期**；一次性方案/记录带日期。
- 禁用词：`final`、`latest`、`new`、`最新`、`最终`、`备份`、`copy`、`old`、`正式版`。
- 段落之间用下划线，段落内部用连字符；ASCII 部分一律小写。
