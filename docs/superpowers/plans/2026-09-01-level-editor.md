# 造关师（关卡编辑器）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增玩家自建关卡的「造关师」模式：移动端点选物料摆关 → 即时本地试玩 → 打通后生成关卡码经微信分享，好友卡片直达挑战。

**Architecture:** 编辑器逻辑全部隔离在 4 个新文件（`src/editor.js` 状态/输入、`src/editor-render.js` 绘制、`src/level-codec.js` 关卡码、`src/level-validate.js` 纯校验）；现有 8 个文件只做最小路由接线（状态转发、菜单按钮、isCustom 分支抑制）。编辑草稿产出与手写关卡同构的纯数据对象，直接喂现有 `setupLevel()`，战斗/物理零新逻辑。

**Tech Stack:** 微信小游戏（Canvas 2D）、CommonJS 模块、自研物理/渲染；测试用 Node + `tools/test-harness.js`（虚拟时钟 60Hz + fire/pump 无头驱动）。

**Spec:** `docs/superpowers/specs/2026-09-01-level-editor-design.md`

---

## 关键事实（实现前必读，均已对照代码核实）

- **关卡形状**（`src/levels.js:38`）：`{name, flavor, birds:['normal'|'dash'|'bomb'|'split'...], trajectory, stars:[s1,s2,s3], pigs:[{x,y,radius,boss?,hp?,sleep?}], blocks:[{x,y,width,height,type:'wood'|'stone'|'ice'|'burst',sleep?}], pearls:[{id,x,y}]}`。
- **装载**：`setupLevel(game, level)`（`src/level-flow.js:58`）吃纯对象；运行时动态关先例：`game.dailyLevel`+`isDaily`，`getCurrentLevel()`（`src/game.js:300`）分流。
- **三入口互斥复位**：`loadLevel/startDaily/startBonus`（`src/level-flow.js:15/27/44`）各自显式清 `isDaily/isBonus/...`——isCustom 复位照此办理。
- **底栏不挡世界**：`GROUND_Y = SCREEN_HEIGHT-90`（`src/config.js`）。底栏 84px 置于 `y∈[H-84,H]`，落在海床线（H-90）以下沙土区，**世界正常渲染、触摸不做坐标变换**（spec §5 的 84px translate 经核实不必要，省去）。顶栏 44px 半透明浮于顶部水区。
- **校验纯函数必须放 src/`**：`build-preview.js` 只打包 `game.js + src/*.js`，src 不得 require tools/。故校验纯函数落在 **`src/level-validate.js`**，`tools/validate-levels.js` 改为 require 它（spec 说"从 tools 抽出"，落点修正为 src，否则浏览器预览包会缺模块）。
- **校验必须区分编辑器/官方关**：编辑器专属检查（计数上下限、弹弓禁区）会误伤官方关卡——实测 L27 章鱼 x=126.25 r=14（左缘 112.25 < 禁区线 123.75）、L39 x=136.25 r=15 都会触发禁区。故 `validateLevel(level, {editor:true})` 第二参数控制编辑器专属检查；CLI 跑官方关时不传（只跑几何检查 + 保留 boss 检查）。
- **touchend 不带坐标**：`wx.onTouchEnd((e) => this.onTouchEnd())`（`game.js:394-396`）、`INPUT.onTouchEnd(game)`（`input.js:256`）都没有 x/y。编辑器须在 start/move 时把最后触摸点缓存进 `editor.touchX/touchY`，touchend 用缓存坐标。
- **结算新按钮必须接 input.js**：screens.js 画的按钮若不在 `input.js` WIN/LOSE case（:149-199 / :371-411）里加 press/release 分支就是死按钮。Task 6 文件清单含 input.js。
- **启动分流已有一半**：`game.js:73-77` constructor 已处理 `SOCIAL.getLaunchLevel()`；`handleLaunchQuery()` 是**替换**该块（加 custom 分支），不是并列新增，否则双重装载。
- **行号漂移**：level-flow 的 `startDaily` 在 :28、`startBonus` 在 :47（非 :27/:44）；其余锚点准确。
- **spec 偏差记录**：①选中浮条【删除】【取消】简化为橡皮模式 + 点空白取消；②问题列表展开+瞬移定位简化为常显红圈（世界单屏不滚动，红圈即定位）。两处已在 Task 5/8 注明，实现时不再补齐。
- **广告按钮现状只由 `AD.available()` 门控**（isDaily/isBonus 不抑制）：复活 `src/screens.js:1117`、双倍 `:1032`、弹道全显 `:1126`；插屏在 `goToMenu/goToLevelSelect` 的 `AD.onLevelExit()`（`src/game.js:323/336`）。自定义关需**新增** `!isCustom` 门控。
- **珍珠收集**：`collectPearl`（`src/combat.js:192`）无条件 `progress.pearls[id]=true` + `saveProgress()`，且场景珍珠**不给分**。自定义珍珠无 id，需 isCustom 分支（+2000 分、不写图鉴）。
- **流程分支点**：`nextLevel()`（`game.js:358`）、`retryLevel()`（`:369`）、WIN 页 `isLastLevel`（`screens.js:1054`）均无 custom 分支，不补会软锁/误跳战役第 1 关。
- **stars 公式**（仿 `src/daily.js:145`）：`base = pigs*1000 + blocks*250`；`stars=[round(base*.6), base, round(base*1.5)]`。
- **测试模式**：`tools/e2e-tests.js` 用 `test(name, fn)` 注册、`fresh()` 清档、直接调 `game.xxx()` + `env.fire('touchstart',x,y)`/`env.pump(n)`；断言用 node `assert`。新测试全部追加到该文件。
- **回归门**：`node tools/validate-levels.js` → `node tools/e2e-tests.js` → `node build-preview.js && node verify-preview.js`，全绿才算完成。

---

## 文件规划

**新增（4 个，编辑器全部逻辑隔离于此）：**

| 文件 | 职责 |
|---|---|
| `src/level-codec.js` | 纯函数：`encodeLevel(level)→str`（前缀 `PG1`）、`decodeLevel(str)→level\|null`。无游戏/wx 依赖。 |
| `src/level-validate.js` | 纯函数：`validateLevel(level)→{ok, issues:[{kind,x,y,msg}]}`。只用 config/utils。 |
| `src/editor.js` | EDITOR 状态：草稿维护、物料栏、放置/选中/拖动/删除、触摸处理、试玩往返、proven、存档读写。 |
| `src/editor-render.js` | 编辑器绘制：顶栏、底栏 tab/物料、选中浮条、网格预览、问题红圈、世界实体。 |

**修改（8 个，仅路由/分支）：** `src/game.js`、`src/input.js`、`src/screens.js`、`src/settle.js`、`src/combat.js`、`src/level-flow.js`、`src/social.js`、`tools/test-harness.js`、`tools/validate-levels.js`、`tools/e2e-tests.js`（测试）。

---

## Task 1: 扩充 test-harness 的 wx mock（测试基础设施）

**Files:**
- Modify: `tools/test-harness.js:72-90`（wx mock 对象）

- [ ] **Step 1: 写失败测试**

在 `tools/e2e-tests.js` 顶部 require 区后追加：

```js
const SOCIAL = require('../src/social.js');

test('harness：分享/启动/剪贴板 mock 齐备，social.available() 为 true', () => {
  assert.strictEqual(SOCIAL.available(), true, 'showShareMenu mock 后应可分享');
  assert.strictEqual(typeof wx.getLaunchOptionsSync, 'function');
  assert.strictEqual(typeof wx.getClipboardData, 'function');
  assert.strictEqual(typeof wx.shareAppMessage, 'function');
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node tools/e2e-tests.js 2>&1 | grep -A1 'harness'`
Expected: FAIL（`SOCIAL.available()` 为 false / wx.xxx undefined）。

- [ ] **Step 3: 在 wx mock 中补 4 个 API**

`tools/test-harness.js` 的 `global.wx = {...}`（:72）内追加：

```js
    // —— 编辑器/分享相关 mock（e2e 用）——
    showShareMenu: () => {},
    onShareAppMessage: () => {},
    shareAppMessage: (opts) => { ads.lastShare = opts; },
    getLaunchOptionsSync: () => ({ query: ads.launchQuery || {} }),
    getClipboardData: (opts) => { if (opts && opts.success) opts.success({ data: ads.clipboard || '' }); },
    setClipboardData: (opts) => { ads.clipboard = (opts && opts.data) || ''; if (opts && opts.success) opts.success(); },
```

并在 `ads` 计数器对象（:93）加字段：`lastShare: null, launchQuery: null, clipboard: ''`。

- [ ] **Step 4: 跑测试确认通过**

Run: `node tools/e2e-tests.js 2>&1 | tail -3`
Expected: `✅ N 通过, 0 失败`。

- [ ] **Step 5: Commit**

```bash
git add tools/test-harness.js tools/e2e-tests.js
git commit -m "造关师 T1：harness 补分享/启动参数/剪贴板 wx mock"
```

---

## Task 2: `src/level-codec.js`（关卡码纯函数，TDD）

**Files:**
- Create: `src/level-codec.js`
- Test: `tools/e2e-tests.js`（追加 test）

**编码设计**（紧凑、可校验、版本化）：
- 前缀 `PG1`；字符表 `B64 = A-Za-z0-9-_`（64 字符）。
- 坐标按网格 `GRID=4` 量化后存网格坐标（`gx=Math.round(x/4)`，范围 0~93）；每个非负整数编码为 1~2 个 B64 字符（`enc(n)`：n<64 单字符，否则两位 `[32+floor(n/64), n%64]`，高位字符占 32..63 共 32 档，上限 2047）。
- 段顺序：`birds`（每豚 1 字符枚举 `n/d/b/s`）、`blocks`（type 1 字符 `w/t/i/f`(wood/sTone/ice/burst) + gx + gy + 尺寸枚举 1 字符）、`pigs`（半径枚举 1 字符 `s`=17/`l`=22 + gx + gy）、`pearls`（gx + gy）。
- 每段以计数开头；段间无分隔（计数驱动解码）。尺寸枚举：`b`=80×26 梁、`p`=28×80 柱、`q`=28×28 块、`f`=26×26 爆裂果。

- [ ] **Step 1: 写失败测试**（追加到 e2e-tests.js）

```js
const CODEC = require('../src/level-codec.js');

test('codec：合法关卡往返深相等（量化到 4px）', () => {
  const lv = {
    birds: ['normal','dash','bomb','split'],
    blocks: [
      {x:200,y:500,width:80,height:26,type:'wood'},
      {x:160,y:540,width:28,height:80,type:'stone'},
      {x:240,y:580,width:26,height:26,type:'burst'},
    ],
    pigs: [{x:240,y:600,radius:17},{x:300,y:600,radius:22}],
    pearls: [{x:260,y:300}],
  };
  const code = CODEC.encodeLevel(lv);
  assert.ok(code.startsWith('PG1'), '前缀 PG1');
  assert.ok(code.length < 700, `关卡码过长: ${code.length}`);
  const back = CODEC.decodeLevel(code);
  assert.ok(back, '解码应成功');
  assert.deepStrictEqual(back.birds, lv.birds);
  assert.deepStrictEqual(back.blocks.map(b=>[b.x,b.y,b.width,b.height,b.type]),
    lv.blocks.map(b=>[b.x,b.y,b.width,b.height,b.type]));
  assert.deepStrictEqual(back.pigs.map(p=>[p.x,p.radius]), [[240,17],[300,22]]);
  assert.strictEqual(back.pearls.length, 1);
});

test('codec：坏码/截断码/非法枚举拒绝为 null', () => {
  assert.strictEqual(CODEC.decodeLevel('XXXX'), null);
  assert.strictEqual(CODEC.decodeLevel('PG1'), null); // 体太短
  const good = CODEC.encodeLevel({birds:['normal'],blocks:[],pigs:[{x:200,y:600,radius:17}],pearls:[]});
  assert.strictEqual(CODEC.decodeLevel(good.slice(0, good.length-2)), null); // 截断
  assert.strictEqual(CODEC.decodeLevel(good.replace(/[ndbs]/, 'z')), null); // 非法豚种(若命中)
});

test('codec：超上限配置拒绝编码', () => {
  const many = { birds: Array(7).fill('normal'), blocks: [], pigs: [{x:200,y:600,radius:17}], pearls: [] };
  assert.throws(() => CODEC.encodeLevel(many), /超限|too many/i);
});
```

- [ ] **Step 2: 跑确认失败**：`node tools/e2e-tests.js 2>&1 | grep codec` → FAIL（找不到模块）。

- [ ] **Step 3: 实现 `src/level-codec.js`**

```js
/**
 * 关卡码编解码 - 自制关卡 ↔ 紧凑字符串（微信分享 query 用）。
 * 纯函数，无 wx/游戏依赖。格式：PG1 + 计数驱动的变长段（见 plan/spec）。
 */
'use strict';
const GRID = 4;
const PREFIX = 'PG1';
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const LIMITS = { blocks: 40, pigs: 10, birds: 6, pearls: 2 };
const BIRD_CHARS = { normal: 'n', dash: 'd', bomb: 'b', split: 's' };
const BIRD_TYPES = { n: 'normal', d: 'dash', b: 'bomb', s: 'split' };
const BLOCK_CHARS = { wood: 'w', stone: 't', ice: 'i', burst: 'f' };
const BLOCK_TYPES = { w: 'wood', t: 'stone', i: 'ice', f: 'burst' };
// 尺寸枚举：梁/柱/块/爆裂果
const SIZES = { b: [80, 26], p: [28, 80], q: [28, 28], f: [26, 26] };
const SIZE_KEY = (w, h, type) =>
  type === 'burst' ? 'f' : (w === 80 ? 'b' : h === 80 ? 'p' : 'q');
const PIG_CHARS = { 17: 's', 22: 'l' };
const PIG_RADII = { s: 17, l: 22 };

function enc(n) { // 非负整数 → 1~2 字符（两位高位字符占 32..63 共 32 档，上限 2047；网格坐标最大 ~167，够用）
  if (n < 0 || n > 2047) throw new Error('codec 数值越界');
  return n < 64 ? B64[n] : B64[32 + (n >> 6)] + B64[n & 63];
}
function dec(s, i) { // 返回 [value, nextIndex]；非法返回 null
  const c0 = B64.indexOf(s[i]);
  if (c0 < 0) return null;
  if (c0 < 32) return [c0, i + 1];
  const c1 = B64.indexOf(s[i + 1]);
  if (c1 < 0) return null;
  return [((c0 - 32) << 6) + c1, i + 2];
}

function encodeLevel(level) {
  const birds = level.birds || [];
  const blocks = level.blocks || [];
  const pigs = level.pigs || [];
  const pearls = level.pearls || [];
  if (birds.length > LIMITS.birds || blocks.length > LIMITS.blocks ||
      pigs.length > LIMITS.pigs || pearls.length > LIMITS.pearls) {
    throw new Error('关卡内容超限（blocks≤40/pigs≤10/birds≤6/pearls≤2）');
  }
  let out = PREFIX;
  out += enc(birds.length) + birds.map(b => BIRD_CHARS[b]).join('');
  out += enc(blocks.length);
  for (const b of blocks) {
    out += BLOCK_CHARS[b.type] + enc(Math.round(b.x / GRID)) + enc(Math.round(b.y / GRID))
      + SIZE_KEY(b.width, b.height, b.type);
  }
  out += enc(pigs.length);
  for (const p of pigs) {
    out += (PIG_CHARS[p.radius] || 's') + enc(Math.round(p.x / GRID)) + enc(Math.round(p.y / GRID));
  }
  out += enc(pearls.length);
  for (const p of pearls) out += enc(Math.round(p.x / GRID)) + enc(Math.round(p.y / GRID));
  return out;
}

function decodeLevel(code) {
  try {
    if (typeof code !== 'string' || !code.startsWith(PREFIX)) return null;
    const s = code.slice(PREFIX.length);
    let i = 0;
    const read = () => { const r = dec(s, i); if (!r) throw new Error('bad'); i = r[1]; return r[0]; };
    const nBirds = read();
    if (nBirds > LIMITS.birds) return null;
    const birds = [];
    for (let k = 0; k < nBirds; k++) {
      const t = BIRD_TYPES[s[i++]];
      if (!t) return null;
      birds.push(t);
    }
    const blocks = [];
    const nBlocks = read();
    if (nBlocks > LIMITS.blocks) return null;
    for (let k = 0; k < nBlocks; k++) {
      const type = BLOCK_TYPES[s[i++]];
      if (!type) return null;
      const gx = read(), gy = read();
      const size = SIZES[s[i++]];
      if (!size) return null;
      blocks.push({ x: gx * GRID, y: gy * GRID, width: size[0], height: size[1], type });
    }
    const pigs = [];
    const nPigs = read();
    if (nPigs > LIMITS.pigs) return null;
    for (let k = 0; k < nPigs; k++) {
      const radius = PIG_RADII[s[i++]];
      if (!radius) return null;
      const gx = read(), gy = read();
      pigs.push({ x: gx * GRID, y: gy * GRID, radius });
    }
    const pearls = [];
    const nPearls = read();
    if (nPearls > LIMITS.pearls) return null;
    for (let k = 0; k < nPearls; k++) {
      const gx = read(), gy = read();
      pearls.push({ x: gx * GRID, y: gy * GRID });
    }
    if (i !== s.length) return null; // 尾部有多余字符 = 坏码
    // 补展示/结算字段：挑战关（启动直达/剪贴板/挑战记录）都经此函数，
    // 不补则 settle.computeStars 读 level.stars[0] 崩溃、HUD 标题渲染 undefined
    const base = pigs.length * 1000 + blocks.length * 250;
    return { birds, blocks, pigs, pearls,
      name: '自制关', flavor: '玩家创作', trajectory: 70,
      stars: [Math.round(base * 0.6), base, Math.round(base * 1.5)] };
  } catch (e) {
    return null;
  }
}

module.exports = { encodeLevel, decodeLevel, GRID, LIMITS };
```

- [ ] **Step 4: 跑确认通过**：`node tools/e2e-tests.js 2>&1 | grep -A1 codec` → 3 项全 ✓，总计 0 失败。

- [ ] **Step 5: Commit**

```bash
git add src/level-codec.js tools/e2e-tests.js
git commit -m "造关师 T2：level-codec 关卡码编解码（PG1 紧凑格式 + 坏码拒绝）"
```

---

## Task 3: `src/level-validate.js` 纯校验函数（TDD）

**Files:**
- Create: `src/level-validate.js`（从 `tools/validate-levels.js` 的 `checkGeometry` 搬运为 issue 收集）
- Modify: `tools/validate-levels.js`（CLI 改为 require 纯函数）
- Test: `tools/e2e-tests.js`

- [ ] **Step 1: 写失败测试**（追加）

```js
const VALIDATE = require('../src/level-validate.js');
const GY = 577; // C.GROUND_Y = 667-90；站立坐标：柱 y=GY-80=497，章鱼 y=GY-17=560
const goodLevel = () => ({
  birds: ['normal','normal'],
  blocks: [{x:200,y:497,width:28,height:80,type:'wood'}],   // 柱底=GY
  pigs: [{x:240,y:560,radius:17}],                          // 底=GY
  pearls: [],
});
test('validate：合法关卡 ok 无 issue（编辑器模式）', () => {
  const r = VALIDATE.validateLevel(goodLevel(), {editor:true});
  assert.strictEqual(r.ok, true, JSON.stringify(r.issues));
});
test('validate：官方关不带 editor 选项时不误报禁区/计数', () => {
  const lv = goodLevel();
  lv.pigs[0].x = 128; // 靠近禁区但官方关允许
  const r = VALIDATE.validateLevel(lv); // 无 editor 选项
  assert.ok(!r.issues.some(i=>i.kind==='no-build-zone'), '官方关不查禁区');
  assert.ok(!r.issues.some(i=>i.kind==='no-pig' || i.kind==='bird-count'), '官方关不查计数');
});
test('validate：各类违规各产出 issue（编辑器模式）', () => {
  const V = (lv) => VALIDATE.validateLevel(lv, {editor:true});
  let lv = goodLevel(); lv.pigs.push({x:240,y:560,radius:17}); // 章鱼互叠
  assert.ok(V(lv).issues.some(i=>i.kind==='pig-overlap'));
  lv = goodLevel(); lv.pigs = [];                                   // 无章鱼
  assert.ok(V(lv).issues.some(i=>i.kind==='no-pig'));
  lv = goodLevel(); lv.birds = [];                                  // 无河豚
  assert.ok(V(lv).issues.some(i=>i.kind==='bird-count'));
  lv = goodLevel(); lv.blocks.push({x:10,y:497,width:28,height:80,type:'wood'}); // 禁区
  assert.ok(V(lv).issues.some(i=>i.kind==='no-build-zone'));
  lv = goodLevel(); lv.blocks = Array(41).fill(0).map((_,k)=>({x:140+(k%8)*29,y:300+Math.floor(k/8)*30,width:28,height:28,type:'wood'}));
  assert.ok(V(lv).issues.some(i=>i.kind==='block-limit'));
});
```

- [ ] **Step 2: 跑确认失败**：`node tools/e2e-tests.js 2>&1 | grep validate` → FAIL（无模块）。

- [ ] **Step 3: 实现 `src/level-validate.js`**

搬运 `tools/validate-levels.js:37-133` 的几何检查，把 `fail(msg)` 改为 `issues.push({kind,x,y,msg})`。复用现有全部检查（章鱼互叠/越界/沉地、方块互叠/越界、珍珠越界/嵌方块/贴章鱼、候飞豚越屏），**新增**编辑器专属检查。结构：

```js
'use strict';
const C = require('./config.js');
const PEARL_R = 9;
const BIRD_DISP_R = 17 * 0.85;
const LIMITS = require('./level-codec.js').LIMITS;

function circleRectDist(px, py, r) { /* 同 validate-levels.js:37 */ }

function validateLevel(level, opts) {
  const editor = !!(opts && opts.editor); // 编辑器专属检查（计数/禁区）仅编辑器模式启用
  const issues = [];
  const push = (kind, x, y, msg) => issues.push({ kind, x, y, msg });
  const pigs = level.pigs || [], blocks = level.blocks || [], pearls = level.pearls || [];
  const birdCount = Array.isArray(level.birds) ? level.birds.length : (level.birds || 0);
  const SW = C.SCREEN_WIDTH, GY = C.GROUND_Y, ZONE = SW * 0.33;

  // —— 编辑器专属：计数 / 禁区（CLI 跑官方关时跳过）——
  if (editor) {
    if (pigs.length === 0) push('no-pig', 0, 0, '至少放 1 只章鱼');
    if (birdCount < 1 || birdCount > 6) push('bird-count', 0, 0, '河豚数量需 1~6 只');
    if (blocks.length > LIMITS.blocks) push('block-limit', 0, 0, '方块超过 40 个');
    if (pigs.length > LIMITS.pigs) push('pig-limit', 0, 0, '章鱼超过 10 只');
    if (pearls.length > LIMITS.pearls) push('pearl-limit', 0, 0, '珍珠超过 2 颗');
    // 禁区判定一律按"实体左缘"（与 placeAt 拒绝逻辑一致）
    blocks.forEach((b,i)=>{ if (b.x < ZONE) push('no-build-zone', b.x, b.y, `方块${i}在弹弓禁区`); });
    pigs.forEach((p,i)=>{ if (p.x - p.radius < ZONE) push('no-build-zone', p.x, p.y, `章鱼${i}在弹弓禁区`); });
    pearls.forEach((p,i)=>{ if (p.x - 9 < ZONE) push('no-build-zone', p.x, p.y, `珍珠${i}在弹弓禁区`); });
  }

  // —— 几何（搬自 validate-levels.checkGeometry，fail→push；boss/sleep 检查保留但自定义关不产生）——
  // 章鱼互叠
  pigs.forEach((a,i)=>pigs.forEach((b,j)=>{ if(j<=i)return;
    if (Math.hypot(b.x-a.x,b.y-a.y) < a.radius+b.radius-0.01)
      push('pig-overlap', a.x, a.y, `章鱼${i}与章鱼${j}互叠`); }));
  // 章鱼越界/沉地
  pigs.forEach((p,i)=>{
    if (p.x-p.radius<0 || p.x+p.radius>SW) push('pig-bounds', p.x, p.y, `章鱼${i}水平越界`);
    if (p.y+p.radius>GY+0.01) push('pig-ground', p.x, p.y, `章鱼${i}沉入地面`);
  });
  // 方块互叠
  blocks.forEach((a,i)=>blocks.forEach((b,j)=>{ if(j<=i)return;
    const ov = a.x<b.x+b.width-0.01 && b.x<a.x+a.width-0.01 && a.y<b.y+b.height-0.01 && b.y<a.y+a.height-0.01;
    if (ov) push('block-overlap', a.x, a.y, `方块${i}与方块${j}互叠`); }));
  // 方块越界/沉地
  blocks.forEach((b,i)=>{
    if (b.x<0 || b.x+b.width>SW) push('block-bounds', b.x, b.y, `方块${i}水平越界`);
    if (b.y+b.height>GY+0.01) push('block-ground', b.x, b.y, `方块${i}沉入地面`);
  });
  // 珍珠：越界/嵌方块/贴章鱼
  pearls.forEach((p,i)=>{
    if (p.x-PEARL_R<0 || p.x+PEARL_R>SW || p.y-PEARL_R<0) push('pearl-bounds', p.x, p.y, `珍珠${i}越界`);
    blocks.forEach(b=>{ if (circleRectDist(p.x,p.y,b) < PEARL_R-0.01) push('pearl-in-block', p.x, p.y, `珍珠${i}嵌在方块里`); });
    pigs.forEach(q=>{ if (Math.hypot(p.x-q.x,p.y-q.y) < PEARL_R+q.radius) push('pearl-on-pig', p.x, p.y, `珍珠${i}贴着章鱼`); });
  });
  // 候飞豚越屏
  for (let i=0;i<birdCount-1;i++){ const x=C.SLINGSHOT_X-35-(i%3)*21;
    if (x-BIRD_DISP_R<0) push('bird-offscreen', x, 0, `候飞豚 #${i} 越屏`); }

  return { ok: issues.length === 0, issues };
}
module.exports = { validateLevel };
```

> 注：boss/sleep 专属检查（章王名/hp、休眠体屏外）自定义关不产生（编辑器 v1 不放 boss），纯函数可不搬这部分；CLI 脚本里保留对官方关卡的 boss 校验（见 Step 4）。

- [ ] **Step 4: `tools/validate-levels.js` 改为复用纯函数**

把 `checkGeometry(label, level)`（:49-133）替换为：调用 `VALIDATE.validateLevel(level)`（**不传 editor 选项**，官方关只跑几何检查），把 `issues` 逐条 `fail(label + ' ' + issue.msg)`；官方 40 关的 boss 语义检查（:55-73 章王计数/命名/hp/sleep）保留在 CLI（对 levels 跑，不对自定义关）。`require('../src/level-validate.js')`。CLI 输出与退出码不变（实测：L27/L39 章鱼左缘伸入禁区线，正是不能让 CLI 传 editor 的原因）。

- [ ] **Step 5: 跑两个校验确认全绿**

Run: `node tools/validate-levels.js 2>&1 | tail -2` → `✅ 关卡校验全部通过`
Run: `node tools/e2e-tests.js 2>&1 | tail -2` → `0 失败`

- [ ] **Step 6: Commit**

```bash
git add src/level-validate.js tools/validate-levels.js tools/e2e-tests.js
git commit -m "造关师 T3：level-validate 纯校验函数（几何+计数+禁区），CLI 复用"
```

---

## Task 4: game 状态机骨架接线（EDITOR 状态可进出）

**Files:**
- Modify: `src/game.js`（字段、getCurrentLevel、update/render/input 转发、状态转换）
- Modify: `src/input.js`（EDITOR case）
- Modify: `src/level-flow.js`（三入口复位 isCustom/playOrigin）
- Create: `src/editor.js`、`src/editor-render.js`（此任务先建空壳导出，Task 5 填充）

- [ ] **Step 1: 写失败测试**（追加）

```js
const EDITOR = require('../src/editor.js');
test('编辑器：enterEditor 进 EDITOR 态并初始化空草稿', () => {
  fresh();
  game.enterEditor();
  env.pump(2);
  assert.strictEqual(game.state, 'EDITOR');
  assert.ok(game.editor && game.editor.draft, '草稿已初始化');
  assert.deepStrictEqual(game.editor.draft.blocks, []);
});
test('编辑器：退出回 MENU；进自定义关三入口复位 isCustom', () => {
  game.enterEditor(); env.pump(1);
  game.editorExit();
  assert.strictEqual(game.state, 'MENU');
  // 自定义关后加载战役关，标志必须复位
  game.playCustom({ birds:['normal'], blocks:[], pigs:[{x:240,y:560,radius:17}], pearls:[] }, 'challenge');
  assert.strictEqual(game.isCustom, true);
  game.loadLevel(0);
  assert.strictEqual(game.isCustom, false);
  assert.strictEqual(game.playOrigin, null);
});
```

- [ ] **Step 2: 跑确认失败**：`node tools/e2e-tests.js 2>&1 | grep 编辑器` → FAIL。

- [ ] **Step 3: 建 editor 空壳**

`src/editor.js`：

```js
/**
 * 造关师 - 关卡编辑器状态/输入逻辑（隔离模块，不污染既有玩法）。
 */
'use strict';
const C = require('./config.js');

function newDraft() {
  return { blocks: [], pigs: [], pearls: [], birds: ['normal'] };
}
function enterEditor(game) {
  if (!game.editor || !game.editor.draft) {
    game.editor = { draft: newDraft(), tab: 'blocks', palette: null, eraser: false,
      selected: null, drag: null, scrollX: 0, proven: false, issues: [] };
  }
  game.isCustom = false; game.playOrigin = null;
  game.buttons = {};
  game.state = 'EDITOR';
}
function editorExit(game) { game.state = 'MENU'; game.buttons = {}; }

module.exports = { enterEditor, editorExit, newDraft };
```

`src/editor-render.js`：先导出空 `drawEditor(game) {}`。

- [ ] **Step 4: game.js 接线**

- 顶部 require：`const EDITOR = require('./editor.js'); const EDITOR_R = require('./editor-render.js');`
- constructor 字段（:134 附近 isDaily 旁）：`this.isCustom = false; this.playOrigin = null; this.customLevel = null; this.customCode = null; this.editor = null; this.listView = null; this.launchError = '';`
- 委托方法（:307 附近）：
```js
  enterEditor() { EDITOR.enterEditor(this); }
  editorExit() { EDITOR.editorExit(this); }
  playCustom(level, origin, code) { EDITOR.playCustom(this, level, origin, code); } // 第 3 参必须透传，否则 customCode 恒为 null
  backToEditor() { EDITOR.backToEditor(this); }
  openLevelList(kind) { this.listView = kind; }
  handleLaunchQuery() { EDITOR.handleLaunchQuery(this); }
```
- `getCurrentLevel()`（:300）首行加：`if (this.isCustom) return this.customLevel;`
- `update()` 的状态 switch（:478）加：`case 'EDITOR': EDITOR.update(this); break;`
- `render()` 的覆盖层 switch（:672）加：`case 'EDITOR': EDITOR_R.drawEditor(this); break;`
- 输入委托（:404）onTouchStart/Move/End 已走 INPUT；在 `src/input.js` 的 switch 加：
```js
    case 'EDITOR':
      EDITOR.onTouchStart(game, x, y);
      break;
```
（onTouchMove/End 同样加 EDITOR case 转发 `EDITOR.onTouchMove/onTouchEnd`；input.js 顶部 require EDITOR。）

- [ ] **Step 5: level-flow 三入口复位**

`loadLevel`（:15）、`startDaily`（:28）、`startBonus`（:47）函数体各加：
```js
  game.isCustom = false;
  game.playOrigin = null;
  game.customLevel = null;
```

- [ ] **Step 6: editor.js 补 playCustom/backToEditor/update/onTouch* 空转实现**

```js
const VALIDATE = require('./level-validate.js');
const LEVEL_FLOW = require('./level-flow.js');
const CODEC = require('./level-codec.js');
const E = require('./entities.js');
const C = require('./config.js');
const SOCIAL = require('./social.js');
const GY = C.GROUND_Y;
const GRID = CODEC.GRID;

/** 从（解码出的）纯数据实体构造编辑器实体实例（草稿统一存实例，渲染直接 ent.draw） */
function instantiateDraft(data) {
  return {
    blocks: (data.blocks || []).map(b => new E.Block(b.x, b.y, b.width, b.height, b.type)),
    pigs: (data.pigs || []).map(p => new E.Pig(p.x, p.y, p.radius)),
    pearls: (data.pearls || []).map(p => ({ x: p.x, y: p.y })),
    birds: (data.birds && data.birds.length) ? data.birds.slice() : ['normal'],
  };
}
function deriveLevel(draft) {
  const level = {
    name: '自制关', flavor: '玩家创作', trajectory: 70,
    birds: draft.birds.slice(),
    blocks: draft.blocks.map(b => ({ x: Math.round(b.x), y: Math.round(b.y), width: b.width, height: b.height, type: b.type })),
    pigs: draft.pigs.map(p => ({ x: Math.round(p.x), y: Math.round(p.y), radius: p.radius })),
    pearls: draft.pearls.map(p => ({ x: Math.round(p.x), y: Math.round(p.y), reward: true })),
  };
  const base = level.pigs.length * 1000 + level.blocks.length * 250;
  level.stars = [Math.round(base * 0.6), base, Math.round(base * 1.5)];
  return level;
}
function playCustom(game, level, origin, code) {
  game.customLevel = level;
  game.customCode = code || null; // 挑战流【分享给朋友】转发用原码；作者流为 null
  game.isCustom = true; game.playOrigin = origin || 'challenge';
  game.currentLevelIndex = -1;
  LEVEL_FLOW.setupLevel(game, level);
  game.state = 'READY';
}
function backToEditor(game) { enterEditor(game); }
function update(game) { /* Task5 填充：预览/动画 */ }
function onTouchStart() {} function onTouchMove() {} function onTouchEnd() {}
```
> editor.js 顶部统一 require level-flow/codec/entities/config（level-flow 不 require editor，无循环依赖）。
> **editor.js 完整导出**（各 Task 逐步填充，测试/跨模块调用依赖这些键，每加一个函数同步补进 exports）：
> `module.exports = { enterEditor, editorExit, playCustom, backToEditor, newDraft, deriveLevel, instantiateDraft, placeAt, removeAt, addBird, removeBirdAt, findPalette, hitTest, tryPlay, saveCurrent, listSlots, deleteSlot, openSlot, recordPlayed, listPlayed, deletePlayed, onSaveShare, handleLaunchQuery, enterFromClipboard, onTouchStart, onTouchMove, onTouchEnd, update, TABS, PALETTE };`
> （`deletePlayed`/`enterFromClipboard`/`handleLaunchQuery`/`onSaveShare` 在 Task 7 实现；Task 4 骨架先导出占位函数，避免委托方法 undefined。）

- [ ] **Step 7: 跑测试**：`node tools/e2e-tests.js 2>&1 | grep 编辑器` → 2 项 ✓；`node build-preview.js` 确认打包含新模块无报错。

- [ ] **Step 8: Commit**

```bash
git add src/editor.js src/editor-render.js src/game.js src/input.js src/level-flow.js
git commit -m "造关师 T4：EDITOR 状态骨架 + isCustom/playOrigin 接线与三入口复位"
```

---

## Task 5: 编辑器核心交互（物料/放置/选中/拖动/删除/proven）

**Files:**
- Modify: `src/editor.js`（填充状态与触摸）
- Modify: `src/editor-render.js`（填充绘制）
- Test: `tools/e2e-tests.js`

**物料表**（editor.js 常量；`C/E/CODEC/GY/GRID` 已在 Task 4 骨架顶部 require）：

```js
const TABS = [
  { id: 'blocks', label: '方块' },
  { id: 'enemies', label: '敌人' },
  { id: 'birds', label: '河豚' },
  { id: 'items', label: '道具' },
];
const PALETTE = {
  blocks: [
    { id: 'wood-b', kind: 'block', type: 'wood', w: 80, h: 26, label: '木梁' },
    { id: 'wood-p', kind: 'block', type: 'wood', w: 28, h: 80, label: '木柱' },
    { id: 'wood-q', kind: 'block', type: 'wood', w: 28, h: 28, label: '木块' },
    { id: 'stone-b', kind: 'block', type: 'stone', w: 80, h: 26, label: '石梁' },
    { id: 'stone-p', kind: 'block', type: 'stone', w: 28, h: 80, label: '石柱' },
    { id: 'stone-q', kind: 'block', type: 'stone', w: 28, h: 28, label: '石块' },
    { id: 'ice-b', kind: 'block', type: 'ice', w: 80, h: 26, label: '冰梁' },
    { id: 'ice-p', kind: 'block', type: 'ice', w: 28, h: 80, label: '冰柱' },
    { id: 'ice-q', kind: 'block', type: 'ice', w: 28, h: 28, label: '冰块' },
    { id: 'burst', kind: 'block', type: 'burst', w: 26, h: 26, label: '爆裂果' },
  ],
  enemies: [
    { id: 'pig-s', kind: 'pig', radius: 17, label: '小章鱼' },
    { id: 'pig-l', kind: 'pig', radius: 22, label: '大章鱼' },
  ],
  birds: [
    { id: 'normal', kind: 'bird', type: 'normal', label: '嘟嘟' },
    { id: 'dash', kind: 'bird', type: 'dash', label: '梭梭' },
    { id: 'bomb', kind: 'bird', type: 'bomb', label: '砰砰' },
    { id: 'split', kind: 'bird', type: 'split', label: '三丸子' },
  ],
  items: [
    { id: 'pearl', kind: 'pearl', label: '珍珠' },
    { id: 'eraser', kind: 'eraser', label: '橡皮' },
  ],
};
```

**布局常量**：`TOPBAR_H=44`，`BAR_H=84`，`TAB_H=28`，`CHIP=64`（物料 chip 宽），`ZONE_X = C.SCREEN_WIDTH*0.33`。

**辅助导出**（测试用）：

```js
function findPalette(id) { // 跨 tab 按 id 查物料定义
  for (const t of TABS) { const f = PALETTE[t.id].find(i => i.id === id); if (f) return f; }
  return null;
}
```

- [ ] **Step 1: 写失败测试**（用 fire/pump 无头驱动）

```js
const EDITOR_GY = require('../src/config.js').GROUND_Y; // 577
test('编辑器：放置方块/章鱼→草稿增项、校验随动；删空回 no-pig', () => {
  fresh(); game.enterEditor(); env.pump(1);
  const E2 = game.editor;
  // 直接调内部放置函数（坐标为世界坐标，禁区外、地面上）
  EDITOR.placeAt(game, 240, EDITOR_GY - 40, EDITOR.findPalette('wood-p'));   // 木柱
  EDITOR.placeAt(game, 280, EDITOR_GY - 17, EDITOR.findPalette('pig-s'));    // 小章鱼站地
  assert.strictEqual(E2.draft.blocks.length, 1);
  assert.strictEqual(E2.draft.pigs.length, 1);
  assert.strictEqual(E2.issues.every(i=>i.kind!=='no-pig'), true);
  // 删除章鱼 → 回到 no-pig
  EDITOR.removeAt(game, 280, EDITOR_GY - 17);
  assert.strictEqual(E2.draft.pigs.length, 0);
  assert.ok(E2.issues.some(i => i.kind === 'no-pig'));
});
test('编辑器：河豚物料增删队列（1~6）；结构变动重置 proven', () => {
  fresh(); game.enterEditor(); env.pump(1);
  EDITOR.addBird(game, 'dash'); EDITOR.addBird(game, 'bomb');
  assert.deepStrictEqual(game.editor.draft.birds, ['normal','dash','bomb']);
  game.editor.proven = true;
  EDITOR.addBird(game, 'split');
  assert.strictEqual(game.editor.proven, false, '结构变动须重置 proven');
  // 超 6 拒绝
  for (let i=0;i<5;i++) EDITOR.addBird(game, 'normal');
  assert.ok(game.editor.draft.birds.length <= 6);
});
test('编辑器：禁区放置被拒绝（方块左缘/章鱼左缘）', () => {
  fresh(); game.enterEditor(); env.pump(1);
  EDITOR.placeAt(game, 120, EDITOR_GY - 40, EDITOR.findPalette('wood-p')); // 左缘≈106 < 禁区线 123.75
  assert.strictEqual(game.editor.draft.blocks.length, 0, '禁区放置应拒绝');
  EDITOR.placeAt(game, 130, EDITOR_GY - 17, EDITOR.findPalette('pig-l')); // r=22，左缘 108 < 123.75
  assert.strictEqual(game.editor.draft.pigs.length, 0, '章鱼左缘入禁区应拒绝');
});
```

- [ ] **Step 2: 跑确认失败**：`grep 编辑器` → FAIL。

- [ ] **Step 3: 实现 editor.js 操作函数**

```js
function snap(v) { return Math.round(v / GRID) * GRID; }
function groundYAt(draft, x, halfW) {
  // 落点支撑：返回该 x 处最高的可承托方块顶面；否则海床
  let top = GY;
  for (const b of draft.blocks) {
    if (x >= b.x - 2 && x <= b.x + b.width + 2 && b.y < top) top = b.y;
  }
  return top;
}
function revalidate(game) {
  game.editor.issues = VALIDATE.validateLevel(deriveLevel(game.editor.draft), { editor: true }).issues;
}
function touchStructure(game) { game.editor.proven = false; } // 任何结构变异

// 禁区判定与 validateLevel 一致：方块看左缘、圆体看左缘（中心-半径）
function zoneBlocked(x, radius) { return radius ? (x - radius < ZONE_X) : (x < ZONE_X); }

function placeAt(game, x, y, item) {
  const d = game.editor;
  if (!item || item.kind === 'eraser') return;
  if (item.kind === 'bird') { addBird(game, item.type); return; }
  if (item.kind === 'block') {
    if (d.draft.blocks.length >= 40) return;
    const bx = snap(x - item.w / 2);
    if (zoneBlocked(bx)) { flashReject(game); return; }
    const support = groundYAt(d.draft, x, item.w / 2);
    const by = snap(Math.min(y - item.h / 2, support - item.h));
    const ent = new E.Block(bx, by, item.w, item.h, item.type); // 草稿存实体实例
    if (overlapsExisting(ent, d)) { flashReject(game); return; }
    d.draft.blocks.push(ent);
  } else if (item.kind === 'pig') {
    if (d.draft.pigs.length >= 10) return;
    const px = snap(x);
    if (zoneBlocked(px, item.radius)) { flashReject(game); return; }
    const support = groundYAt(d.draft, px, item.radius);
    const py = snap(Math.min(y, support) - item.radius);
    const ent = new E.Pig(px, py, item.radius);
    if (pigOverlap(ent, d.draft.pigs)) { flashReject(game); return; }
    d.draft.pigs.push(ent);
  } else if (item.kind === 'pearl') {
    if (d.draft.pearls.length >= 2) return;
    if (zoneBlocked(snap(x), 9)) { flashReject(game); return; }
    d.draft.pearls.push({ x: snap(x), y: snap(y) });
  }
  touchStructure(game); revalidate(game);
}
function addBird(game, type) {
  const d = game.editor;
  if (d.draft.birds.length >= 6) return;
  d.draft.birds.push(type); touchStructure(game);
}
function removeBirdAt(game, queueIndex) {
  if (game.editor.draft.birds.length <= 1) return; // 至少 1 只
  game.editor.draft.birds.splice(queueIndex, 1); touchStructure(game); revalidate(game);
}
function hitTest(game, x, y) {
  const d = game.editor;
  for (let i = d.draft.pigs.length - 1; i >= 0; i--) {
    const p = d.draft.pigs[i];
    if (Math.hypot(x - p.x, y - p.y) < p.radius + 6) return { kind: 'pig', index: i };
  }
  for (let i = d.draft.blocks.length - 1; i >= 0; i--) {
    const b = d.draft.blocks[i];
    if (x >= b.x - 6 && x <= b.x + b.width + 6 && y >= b.y - 6 && y <= b.y + b.height + 6)
      return { kind: 'block', index: i };
  }
  for (let i = d.draft.pearls.length - 1; i >= 0; i--) {
    const p = d.draft.pearls[i];
    if (Math.hypot(x - p.x, y - p.y) < 16) return { kind: 'pearl', index: i };
  }
  // 候飞豚（屏幕坐标：候飞网格）
  for (let i = 0; i < d.draft.birds.length; i++) {
    const pos = queueBirdPos(i);
    if (Math.hypot(x - pos.x, y - pos.y) < 18) return { kind: 'queuebird', index: i };
  }
  return null;
}
function removeAt(game, x, y) {
  const h = hitTest(game, x, y);
  if (!h) return;
  const d = game.editor;
  if (h.kind === 'block') d.draft.blocks.splice(h.index, 1);
  else if (h.kind === 'pig') d.draft.pigs.splice(h.index, 1);
  else if (h.kind === 'pearl') d.draft.pearls.splice(h.index, 1);
  else if (h.kind === 'queuebird') return removeBirdAt(game, h.index);
  touchStructure(game); revalidate(game);
}
```

`onTouchStart/Move/End` 状态机。**注意 `wx.onTouchEnd` 不带坐标**（game.js:394），故 start/move 时把坐标缓存进 `d.touchX/touchY`，end 用缓存值：

```js
function cacheTouch(d, x, y) { d.touchX = x; d.touchY = y; }
function onTouchStart(game, x, y) {
  const d = game.editor;
  cacheTouch(d, x, y);
  // 1. 顶栏按钮（game.buttons.editorExit/editorPlay/editorIssues）
  for (const k of ['editorExit', 'editorPlay', 'editorIssues']) {
    if (game.buttons[k] && game.buttons[k].contains(x, y)) { game.buttons[k].pressed = true; return; }
  }
  // 2. 底栏区域
  if (y > C.SCREEN_HEIGHT - BAR_H) { onBarTouch(game, x, y); return; }
  // 3. 世界区
  const h = hitTest(game, x, y);
  if (d.eraser) { if (h) removeAt(game, x, y); return; }
  if (h) {
    if (h.kind === 'queuebird') return; // 候飞豚点按在 touchend 处理移除（避免误触）
    d.selected = h; d.drag = { ...h, startX: x, startY: y, moved: false };
  } else if (d.palette) {
    placeAt(game, x, y, d.palette);
  } else {
    d.selected = null; // 点空白取消选中
  }
}
function onTouchMove(game, x, y) {
  const d = game.editor;
  cacheTouch(d, x, y);
  if (d.drag) { d.drag.moved = true; moveEntity(game, d.drag, x, y); }
  else if (y > C.SCREEN_HEIGHT - BAR_H) { onBarDrag(game, x); } // 物料横滚
}
function onTouchEnd(game) {
  const d = game.editor;
  const x = d.touchX, y = d.touchY; // touchend 无坐标，用缓存
  // 顶栏按钮释放
  if (game.buttons.editorExit && game.buttons.editorExit.pressed) { game.buttons.editorExit.pressed=false; return editorExit(game); }
  if (game.buttons.editorPlay && game.buttons.editorPlay.pressed) { game.buttons.editorPlay.pressed=false; return tryPlay(game); }
  if (game.buttons.editorIssues && game.buttons.editorIssues.pressed) { game.buttons.editorIssues.pressed=false; d.showIssues = !d.showIssues; return; }
  const wasDrag = d.drag;
  if (wasDrag) {
    if (wasDrag.moved) { touchStructure(game); revalidate(game); } // 拖动位移 = 结构变异
    d.drag = null;
  }
  // 点候飞豚移除（touchend 且未拖动）
  if (!wasDrag && y != null && y < C.SCREEN_HEIGHT - BAR_H) {
    const h = hitTest(game, x, y);
    if (h && h.kind === 'queuebird') removeBirdAt(game, h.index);
  }
}
```

`onBarTouch`：tab 行（y 在上 28px）切 tab；物料行点 chip → 若 `kind==='bird'` 直接 addBird；`'eraser'` 切换 `d.eraser`（再点其他物料取消）；其余设 `d.palette=item`、`d.eraser=false`。chip 命中考虑 `d.scrollX`（横滚偏移）。`tryPlay`：`revalidate`；若 `issues.length` 则红闪拒绝；否则 `playCustom(game, deriveLevel(d.draft), 'author')`。

`queueBirdPos(i)`：复用候飞网格（与 `level-flow.queuePosition` 同公式：`x=SLINGSHOT_X-35-(i%3)*21`（注意队列第 0 只在弹弓上，编辑器候飞从 i=0 排网格），`y=GROUND_Y-BIRD_RADIUS-floor(i/3)*28`）。

- [ ] **Step 4: 实现 editor-render.js `drawEditor(game)`**

绘制顺序：
1. 世界：`RENDERER.drawBackground(game)`；草稿方块/章鱼实例化绘制——用 `E = require('./entities.js')` 缓存临时实体（`draft.blocks` 已是数据，渲染时 `new E.Block(...)` 太重；改为直接调静态绘制或在草稿里存实体）。**简化决策：草稿直接存实体实例**（`placeAt` 时 `new E.Block(x,y,w,h,type)` / `new E.Pig(x,y,radius)`），`deriveLevel` 从实体读 `x/y/width/height/type/radius`；渲染直接 `ent.draw(ctx)`。珍珠用 `RENDERER.drawPearls` 同款绘制（或画圆）。候飞豚用 `E.drawBirdMini(ctx, pos.x, pos.y, 15, type)`。
2. 选中高亮：选中实体画白色描边矩形/圆；拖动中画半透明。
3. 网格吸附预览：`d.palette` 且手指在世界区时，画半透明预览体（合法绿/非法红）。
4. 问题红圈：`d.issues` 每项在 `(x,y)` 画红色闪烁圈（`game.frameCount` 驱动）。
5. 顶栏 44px：半透明深色条；左【‹退出】按钮、中校验灯（`issues.length? '🔴 '+n+' 问题':'🟢 可试玩'`，可点）、右【▶试玩】（有 issues 时置灰）。用 `E.Button`（`game.buttons.editorExit/editorPlay/editorIssues`，在 enterEditor/update 时创建一次）。
6. 底栏 84px：深色条；tab 行 4 个标签（当前 tab 高亮）；物料行按 `d.tab` 横滚画 chips（图标用 `drawBirdMini`/简单色块 + 文字 label），`scrollX` 偏移。
7. 选中浮条：选中实体上方画【删除】【取消】两个小按钮（或直接用底栏橡皮 + 点空白取消；v1 简化：选中态下顶部提示「拖动移动 · 点橡皮删除 · 点空白取消」，点空白即 `selected=null`）。

> 注：编辑器不画弹弓/弹道/残影（`drawSlingshot*`/`drawTrajectory` 不调用）；弹弓位置画一个淡色占位提示「← 弹弓区（禁放）」。

- [ ] **Step 5: 跑测试 + 预览手测**

Run: `node tools/e2e-tests.js 2>&1 | grep 编辑器` → 5 项全 ✓。
Run: `node build-preview.js`，双击 `preview/index.html`：菜单暂未加入口（Task 7），可在控制台 `game.enterEditor()` 进入，验证摆货/拖动/删除/校验灯/试玩按钮置灰逻辑。

- [ ] **Step 6: Commit**

```bash
git add src/editor.js src/editor-render.js tools/e2e-tests.js
git commit -m "造关师 T5：编辑器核心交互（物料栏/放置/选中/拖动/删除/实时校验/proven 重置）"
```

---

## Task 6: 试玩闭环（两套结算按钮 + 广告门控 + 珍珠 +2000）

**Files:**
- Modify: `src/settle.js`（胜负后按 playOrigin）
- Modify: `src/screens.js`（WIN/LOSE 按钮两套、isLastLevel、广告按钮 !isCustom 门控）
- Modify: `src/input.js`（WIN/LOSE case 新增 editorBack/saveShare/challengeShare 三个键的 press/release——现有键 next/retry/menu/share/double/revive/boost 在 :160-196/:372-411）
- Modify: `src/game.js`（nextLevel/retryLevel/goToMenu·goToLevelSelect 分支）
- Modify: `src/combat.js`（collectPearl isCustom 分支）
- Modify: `src/editor.js`（proven 标记由 settle 回写；tryPlay 见 Task 5）
- Test: `tools/e2e-tests.js`

- [ ] **Step 1: 写失败测试**

```js
test('自定义关：试玩打通→作者流按钮；返回编辑草稿仍在；不写战役进度', () => {
  fresh(); game.enterEditor(); env.pump(1);
  EDITOR.placeAt(game, 240, GY - 17, EDITOR.findPalette('pig-s'));
  game.editor.draft.birds = ['bomb','bomb','bomb']; // 够用
  EDITOR.tryPlay(game); env.pump(2);
  assert.strictEqual(game.state, 'READY');
  assert.strictEqual(game.isCustom, true);
  assert.strictEqual(game.playOrigin, 'author');
  // 自动打通：用炸弹近射章鱼（简化测试：直接把章鱼打到死——连续发射直到 WIN/LOSE）
  let guard = 0;
  while ((game.state === 'READY' || game.state === 'AIMING' || game.state === 'FLYING' || game.state === 'SETTLING') && guard++ < 20) {
    if (game.state === 'READY' && game.currentBird) {
      const bx = game.currentBird.x, by = game.currentBird.y;
      env.fire('touchstart', bx, by); env.fire('touchmove', bx - 30, by - 60); env.fire('touchend');
      env.pump(20);
      if (game.state === 'FLYING') { env.fire('touchstart', 200, 300); env.pump(200); } // 空中炸
    }
    env.pump(200);
  }
  assert.strictEqual(game.state, 'WIN', '应能打通简单关');
  const progBefore = JSON.stringify(env.readProgress());
  game.backToEditor(); env.pump(1);
  assert.strictEqual(game.state, 'EDITOR');
  assert.strictEqual(game.editor.draft.pigs.length, 1, '返回编辑草稿保留');
  assert.strictEqual(game.editor.proven, true, '打通后 proven=true');
  assert.strictEqual(JSON.stringify(env.readProgress()), progBefore, '自定义关不写战役进度');
});

test('自定义关：广告按钮不出现；retry 不落入战役关', () => {
  fresh();
  game.playCustom({ name:'自制关', flavor:'玩家创作', birds:['normal'], blocks:[], pigs:[{x:350,y:560,radius:17}], pearls:[], stars:[500,1000,1500], trajectory:70 }, 'challenge');
  env.pump(2);
  // READY 不会自动发射：必须先轻拉打空（shootOnce 弱弹射够不到 x=350 的章鱼），弹尽才 LOSE
  shootOnce();
  assert.strictEqual(game.state, 'LOSE', '一只 normal 打空应判负');
  assert.ok(!game.buttons.revive, '复活广告按钮不应出现');
  assert.ok(!game.buttons.double && !game.buttons.boost, '双倍/弹道广告按钮不应出现');
  game.retryLevel(); env.pump(2);
  assert.strictEqual(game.isCustom, true, '重打仍是自定义关');
  assert.strictEqual(game.state, 'READY');
});

test('自定义关：拾珍珠 +2000 分、不写图鉴', () => {
  fresh();
  const lv = { name:'自制关', flavor:'玩家创作', birds:['normal'], blocks:[],
    pigs:[{x:300,y:560,radius:17}], pearls:[{x:200,y:400,reward:true}], stars:[500,1000,1500], trajectory:70 };
  game.playCustom(lv, 'challenge'); env.pump(2);
  const before = Object.keys(game.progress.pearls).length;
  game.collectPearl(game.pearls[0]);
  assert.ok(game.score >= 2000, '自定义珍珠 +2000');
  assert.strictEqual(Object.keys(game.progress.pearls).length, before, '不写图鉴');
});
```

- [ ] **Step 2: 跑确认失败**：`grep 自定义关` → FAIL。

- [ ] **Step 3: combat.js 珍珠分支**

`collectPearl`（`src/combat.js:192`）函数体开头加：

```js
function collectPearl(game, pearl) {
  pearl.collected = true;
  if (game.isCustom) {
    // 自制奖励珍珠：+2000 分 + 粒子/飘字/音效，不写图鉴、不存档
    game.score += 2000;
    game.addFloatingText(pearl.x, pearl.y - 22, '珍珠 +2000', '#E1F5FE', 18);
    for (let i = 0; i < 10; i++) {
      const angle = U.random(0, Math.PI * 2), speed = U.random(1, 3.5);
      game.spawnParticle(pearl.x, pearl.y, Math.cos(angle)*speed, Math.sin(angle)*speed-1,
        i % 2 ? '#F8BBD0' : '#E1F5FE', U.randomInt(20,35), U.random(2,4));
    }
    AUDIO.play('ding'); game.vibrate('light');
    return;
  }
  // ……原有图鉴逻辑保持不变
}
```

- [ ] **Step 4: game.js 流程分支**

`nextLevel()`（:358）首行加：
```js
    if (this.isCustom) { this.playOrigin === 'author' ? this.backToEditor() : this.goToMenu(); return; }
```
`retryLevel()`（:369）首行加：
```js
    if (this.isCustom) { this.setupLevel(this.customLevel); this.state='READY'; return; }
```
`goToMenu()`（:318）/`goToLevelSelect()`（:326）：把 `if (fromLevel) AD.onLevelExit();` 改为 `if (fromLevel && !this.isCustom && this.state!=='EDITOR') AD.onLevelExit();`（回编辑器/自定义关不打插屏）。

editor.js 补：`tryPlay` 打通后由 settle 置 proven；`backToEditor` 已在 Task4。试玩 WIN 时在 settle 标记 `game.editor.proven = true`（仅 author 流）。

- [ ] **Step 5: settle.js + screens.js 结算按钮两套**

`settle.checkWinLose` 胜利分支（:185 附近 `if (!this.isDaily && !this.isBonus ...)`）：自定义关跳过解锁/存档；author 流 WIN 时 `if (this.playOrigin==='author' && this.editor) this.editor.proven = true;`。

`screens.js` WIN/LOSE 按钮区（用现有 `E.Button` + `game.buttons.*` 模式，参照现有按钮创建代码）：
- WIN 页 **`isLastLevel` 表达式（:1054）改为** `const isLastLevel = game.isDaily || game.isBonus || game.isCustom || game.currentLevelIndex >= game.levels.length - 1;`——注意方向：custom 时 `currentLevelIndex = -1` 恒使旧表达式为 false，会走进 `!isLastLevel` 分支创建「下一关」，必须把 isCustom 加进 true 侧。
- WIN 页战役分享按钮（:1045 附近键 `share`，`SOCIAL.available()` 块）加 `&& !game.isCustom`；广告双倍按钮（:1032 `AD.available()`，键 `double`）加 `&& !game.isCustom`。
- LOSE 页复活（:1117，键 `revive`）/弹道全显（:1126，键 `boost`）外层 `if (AD.available())` 改为 `if (AD.available() && !game.isCustom)`。
- 自定义关按钮集（在现有按钮创建块之后追加 `if (game.isCustom)` 分支；challenge 复用 else 分支已建的 `retry`/`menu`，author 先 `delete game.buttons.menu` 再建自己的键）：
  - author：WIN 建 `editorBack`【返回编辑】+ `saveShare`【保存并分享】（仅 `game.editor && game.editor.proven` 时建）；LOSE 建 `editorBack`【返回编辑】，复用 `retry`【再试一次】。
  - challenge：WIN 复用 `retry`（文案改「再来一次」）、`menu`（文案「返回菜单」），建 `challengeShare`【分享给朋友】（本任务建按钮，回调 Step 6 已挂 `SOCIAL.shareCustom`）；LOSE 复用 `retry`/`menu`。
  - author 流两种结局都不建 `next`/`share`/`double`/`revive`/`boost`。

- [ ] **Step 6: input.js 接新按钮（否则按钮画了点不动）**

**WIN 和 LOSE 两个 case 都要加**（author 流 LOSE 页也有【返回编辑】，只接 WIN 会导致试玩失败后回不了编辑器——死路）：

press 块（WIN :160 附近、LOSE :182 附近）各加：

```js
      if (game.buttons.editorBack && game.buttons.editorBack.contains(x, y)) {
        game.buttons.editorBack.pressed = true;
      }
      if (game.buttons.saveShare && game.buttons.saveShare.contains(x, y)) {
        game.buttons.saveShare.pressed = true;
      }
      if (game.buttons.challengeShare && game.buttons.challengeShare.contains(x, y)) {
        game.buttons.challengeShare.pressed = true;
      }
```

release 块（WIN :372 起、LOSE :394 起）各加对应释放分支。**注意用 `game` 参数不是 `this`**——处理器签名是 `onTouchEnd(game)`，`this` 是 INPUT 模块：

```js
      if (game.buttons.editorBack && game.buttons.editorBack.pressed) {
        game.buttons.editorBack.pressed = false; game.backToEditor();
      }
      if (game.buttons.saveShare && game.buttons.saveShare.pressed) {
        game.buttons.saveShare.pressed = false; EDITOR.onSaveShare(game);
      }
      if (game.buttons.challengeShare && game.buttons.challengeShare.pressed) {
        game.buttons.challengeShare.pressed = false; SOCIAL.shareCustom(game.customCode, game.stars);
      }
```

另外，胜利动画跳过白名单（input.js:156 `['next','retry','menu','share','double']`）追加三个新键：`'editorBack','saveShare','challengeShare'`，否则动画期间首次点新按钮只跳动画不触发。

（input.js 顶部 `const EDITOR = require('./editor.js'); const SOCIAL = require('./social.js');`。跨任务顺序占位：`onSaveShare` 在 Task 7 才有实现，本任务先在 editor.js 加 `function onSaveShare(game){}` 并导出；`SOCIAL.shareCustom` 同理，本任务先在 social.js 加 `function shareCustom(){}` 空函数并导出，Task 7 Step 3 填实现。）

- [ ] **Step 7: 跑测试**：`node tools/e2e-tests.js 2>&1 | grep 自定义关` → 3 项 ✓；全量 0 失败。`node validate-levels.js` 不受影响。

- [ ] **Step 8: Commit**

```bash
git add src/settle.js src/screens.js src/input.js src/game.js src/combat.js src/editor.js tools/e2e-tests.js
git commit -m "造关师 T6：试玩闭环（作者/挑战两套结算按钮+输入接线、广告门控、流程分支、奖励珍珠+2000）"
```

---

## Task 7: 关卡码分享、启动直达、本地存档与菜单入口

**Files:**
- Modify: `src/social.js`（getLaunchCustom / shareCustom）
- Modify: `src/screens.js`（主菜单【造关】【输码挑战】【我造的关】【挑战记录】按钮 + listView 列表页；WIN【保存并分享】/【分享给朋友】）
- Modify: `src/game.js`（constructor 改调 handleLaunchQuery；openLevelList 委托）
- Modify: `src/input.js`（MENU case 新按钮 + 列表页 slotEnter{i}/slotDel{i}/listBack 命中）
- Modify: `src/editor.js`（saveCurrent/listSlots/deleteSlot/openSlot/recordPlayed/listPlayed/deletePlayed/onSaveShare/handleLaunchQuery/enterFromClipboard）
- Test: `tools/e2e-tests.js`

- [ ] **Step 1: 写失败测试**

```js
const CODEC = require('../src/level-codec.js');
test('分享：自制关 shareAppMessage 带 query.custom；启动直达可装载', () => {
  fresh();
  const lv = { birds:['normal'], blocks:[], pigs:[{x:240,y:625,radius:17}], pearls:[] };
  const code = CODEC.encodeLevel(lv);
  // 模拟从分享卡片启动
  env.ads.launchQuery = { custom: code };
  game.handleLaunchQuery(); env.pump(2);
  assert.strictEqual(game.isCustom, true, 'query.custom 应直达自定义关');
  assert.strictEqual(game.playOrigin, 'challenge');
  // 解码关必须自带结算/展示字段，否则 WIN 时 computeStars 崩、HUD 标题 undefined
  assert.ok(Array.isArray(game.customLevel.stars) && game.customLevel.stars.length === 3, '解码关带 stars 门槛');
  assert.strictEqual(game.customLevel.name, '自制关');
  assert.strictEqual(game.customLevel.trajectory, 70);
});
test('关卡码：坏码直达给错误提示不崩溃', () => {
  fresh();
  env.ads.launchQuery = { custom: 'PG1!!!bad' };
  game.handleLaunchQuery(); env.pump(1);
  assert.strictEqual(game.isCustom, false, '坏码不进入自定义关');
  assert.strictEqual(game.state, 'MENU');
});
test('存档：打通的自制关可保存到「我造的关」并重开（重开后可渲染/再编辑）', () => {
  fresh(); game.enterEditor(); env.pump(1);
  EDITOR.placeAt(game, 240, EDITOR_GY - 17, EDITOR.findPalette('pig-s'));
  game.editor.proven = true;
  const slot = EDITOR.saveCurrent(game);
  assert.ok(slot && slot.code, 'proven 后可保存');
  assert.strictEqual(EDITOR.listSlots(game).length, 1);
  // 重开：草稿须为实体实例（有 draw 方法），否则 editor-render 崩
  EDITOR.openSlot(game, 0);
  assert.strictEqual(game.state, 'EDITOR');
  assert.strictEqual(game.editor.draft.pigs.length, 1);
  assert.strictEqual(typeof game.editor.draft.pigs[0].draw, 'function', '重开草稿须为实体实例');
  env.pump(3); // 驱动渲染帧不崩
});
test('挑战记录：挑战流打通后写入 pufferGo_played_levels（bestStars 取最高）', () => {
  fresh();
  const code = CODEC.encodeLevel({ birds:['normal'], blocks:[], pigs:[{x:240,y:560,radius:17}], pearls:[] });
  EDITOR.recordPlayed(game, code, 2);
  EDITOR.recordPlayed(game, code, 1); // 低星不覆盖
  const played = EDITOR.listPlayed(game);
  assert.strictEqual(played.length, 1);
  assert.strictEqual(played[0].bestStars, 2);
});
```

- [ ] **Step 2: 跑确认失败**：`grep 分享\|关卡码\|存档` → FAIL。

- [ ] **Step 3: social.js 加两个函数**

```js
/** 主动分享自制关卡（query 带关卡码） */
function shareCustom(code, stars) {
  if (!available() || typeof wx.shareAppMessage !== 'function') return;
  try {
    wx.shareAppMessage({
      title: stars ? `我造的关被拿下 ${stars} 星，你能超过吗？` : '我造了一关「冲吧！小河豚」，你能打通吗？',
      query: 'custom=' + encodeURIComponent(code),
    });
  } catch (e) {}
}
/** 读取启动 query 中的自制关卡码 */
function getLaunchCustom() {
  try {
    if (typeof wx === 'undefined' || typeof wx.getLaunchOptionsSync !== 'function') return null;
    const q = wx.getLaunchOptionsSync().query || {};
    return q.custom ? decodeURIComponent(q.custom) : null;
  } catch (e) { return null; }
}
module.exports = { init, shareResult, getLaunchLevel, shareCustom, getLaunchCustom };
```

- [ ] **Step 4: editor.js 存档与分享**

```js
const SLOT_KEY = 'pufferGo_editor_levels';
const PLAYED_KEY = 'pufferGo_played_levels';
function saveCurrent(game) {
  const d = game.editor;
  if (!d.proven) return null;
  const code = CODEC.encodeLevel(deriveLevel(d.draft));
  const slots = listSlots(game);
  const now = new Date();
  const name = `自制·${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} #${slots.length+1}`;
  const slot = { name, code, proven: true, createdAt: Date.now() };
  slots.push(slot);
  wx.setStorageSync(SLOT_KEY, slots);
  d.lastCode = code;
  return slot;
}
function listSlots(game) {
  try { return wx.getStorageSync(SLOT_KEY) || []; } catch (e) { return []; }
}
function deleteSlot(game, i) {
  const slots = listSlots(game);
  slots.splice(i, 1);
  wx.setStorageSync(SLOT_KEY, slots);
}
function openSlot(game, i) {
  const slots = listSlots(game);
  const lv = CODEC.decodeLevel(slots[i].code);
  if (!lv) return;
  // 关键：草稿必须实体实例化（Task 5 决策），否则 editor-render 调 ent.draw 崩
  game.editor = { draft: instantiateDraft(lv),
    tab:'blocks', palette:null, eraser:false, selected:null, drag:null, scrollX:0,
    proven: slots[i].proven, issues: [] };
  enterEditor(game); // 复用状态设置（保留草稿）
  revalidate(game);
}
/** 挑战流结算记录：同码 bestStars 取最高 */
function recordPlayed(game, code, stars) {
  const list = listPlayed(game);
  const found = list.find(r => r.code === code);
  if (found) { found.bestStars = Math.max(found.bestStars || 0, stars); found.playedAt = Date.now(); }
  else list.push({ code, bestStars: stars, playedAt: Date.now() });
  wx.setStorageSync(PLAYED_KEY, list);
}
function listPlayed(game) {
  try { return wx.getStorageSync(PLAYED_KEY) || []; } catch (e) { return []; }
}
/** WIN【保存并分享】按钮回调（作者流） */
function onSaveShare(game) {
  const slot = saveCurrent(game) || { code: game.editor && game.editor.lastCode };
  if (slot && slot.code) SOCIAL.shareCustom(slot.code, game.stars);
}
```
（`new Date()` 在游戏运行时可用；harness 虚拟时钟不影响。`SOCIAL` 在 editor.js 顶部 require。）
挑战流 WIN 时记录成绩：在 settle.js 胜利分支加 `if (this.isCustom && this.playOrigin==='challenge' && this.customCode) EDITOR.recordPlayed(this, this.customCode, this.stars);`。

- [ ] **Step 5: 启动直达（替换现有块）+ 菜单入口**

`handleLaunchQuery` 实现在 editor.js（Task 4 已在 game.js 挂好委托 `handleLaunchQuery() { EDITOR.handleLaunchQuery(this); }`）：

```js
/** 启动参数分流：战役直达(query.level，保留解锁门控) / 自制关直达(query.custom)，坏码留菜单 */
function handleLaunchQuery(game) {
  const lvl = SOCIAL.getLaunchLevel();
  // 门控必须保留（原 game.js:74-77 逻辑）：分享卡片不能直达未解锁战役关
  if (typeof lvl === 'number' && lvl < game.progress.unlockedLevels) { game.loadLevel(lvl); return; }
  const code = SOCIAL.getLaunchCustom();
  if (!code) return;
  const lv = CODEC.decodeLevel(code);
  if (lv) game.playCustom(lv, 'challenge', code); // 第 3 参透传关卡码：二次分享 + recordPlayed 都靠它
  else { game.state = 'MENU'; game.launchError = '关卡码损坏'; }
}
/** 菜单【输码挑战】：读剪贴板 → 解码 → 挑战；失败返回 false 供飘字 */
function enterFromClipboard(game) {
  try {
    wx.getClipboardData({
      success: (res) => {
        const lv = CODEC.decodeLevel((res.data || '').trim());
        if (lv) game.playCustom(lv, 'challenge', (res.data || '').trim());
        else game.clipboardError = '剪贴板里没有有效关卡码';
      },
    });
  } catch (e) { game.clipboardError = '剪贴板不可用'; }
}
function deletePlayed(game, i) {
  const list = listPlayed(game);
  list.splice(i, 1);
  wx.setStorageSync(PLAYED_KEY, list);
}
```

**替换** game.js constructor 中现有的战役直达块（`game.js:73-77`，当前直接调 `SOCIAL.getLaunchLevel()`）为一行 `this.handleLaunchQuery();`——不要并列保留旧块（否则双重装载）。
- 主菜单（`screens.drawMenu`）加四个按钮（键名 `goEditor`/`goCode`/`goMine`/`goPlayed`），输入在 `input.js` MENU case（参照现有 play 按钮 :38 模式，press+release 成对）加命中：
  - 【造关】→ `game.enterEditor()`
  - 【输码挑战】→ `EDITOR.enterFromClipboard(game)`（Step 5 上半已实现；失败读 `game.clipboardError` 在菜单飘字，渲染后清空）
  - 【我造的关】→ `game.openLevelList('mine')`
  - 【挑战记录】→ `game.openLevelList('played')`
- **列表页（v1 简单列表，spec §9）**：不新增状态机状态，用 MENU 态 + `game.listView` 字段（`'mine'|'played'|null`）实现：
  - `openLevelList(kind)`：设 `this.listView = kind`；screens.drawMenu 检测 listView 时改画全屏列表（深色底 + 每行：名称 + 星数 + 【进入】+【删除】按钮，键 `slotEnter{i}`/`slotDel{i}`；底部【返回】键 `listBack`）。
  - mine 行：`EDITOR.listSlots(game)`，进入 → `EDITOR.openSlot(game, i)`，删除 → `EDITOR.deleteSlot(game, i)` 并重绘。
  - played 行：`EDITOR.listPlayed(game)`，进入 → `CODEC.decodeLevel(code)` + `playCustom(lv,'challenge',code)`，删除同模式（editor.js 加 `deletePlayed(game,i)`）；无名称时显示「挑战关卡 · MM-DD」。
  - input.js MENU case 加 `slotEnter{i}`/`slotDel{i}`/`listBack` 的 press/release 命中（i 范围 0..11，遍历时检测键存在）。
- WIN 按钮回调：【保存并分享】→ `EDITOR.onSaveShare(game)`（Step 4 已实现）；【分享给朋友】→ `SOCIAL.shareCustom(game.customCode, game.stars)`（Task 6 input.js 已挂）。

- [ ] **Step 6: 跑测试**：`node tools/e2e-tests.js 2>&1 | grep -E '分享|关卡码|存档|挑战记录'` → 4 项 ✓；全量 0 失败。

- [ ] **Step 7: Commit**

```bash
git add src/social.js src/screens.js src/game.js src/editor.js src/input.js tools/e2e-tests.js
git commit -m "造关师 T7：关卡码微信分享/启动直达/剪贴板输码 + 自制关本地存档与菜单入口"
```

---

## Task 8: 全量回归 + 预览端到端验证

**Files:** 无新增（验证与收尾）

- [ ] **Step 1: 回归门三连**

```bash
node tools/validate-levels.js   # 期望：✅ 关卡校验全部通过
node tools/e2e-tests.js         # 期望：✅ 全部通过, 0 失败
node build-preview.js && node verify-preview.js  # 期望：预览包构建+无头验证通过
```

- [ ] **Step 2: 浏览器手动验收**（双击 `preview/index.html`）

清单：
1. 主菜单出现【造关】【输码挑战】【我造的关】【挑战记录】；后两者打开列表页，列表【进入】【删除】【返回】可用，空列表有提示。
2. 进造关：底栏切 tab、点木梁/木柱/方块在世界点放（网格吸附、落地面/柱顶）；放小/大章鱼；河豚 tab 点种加候飞、点候飞豚移除（touchend 缓存坐标准确）；道具放珍珠、橡皮删物。
3. 实时校验：不放章鱼时红灯「至少 1 只章鱼」；互叠/禁区红闪拒绝；【▶试玩】红灯置灰。
4. 摆合法关 → 试玩 → 真实物理打通 → WIN 显示【返回编辑】【保存并分享】；返回编辑草稿仍在、proven 标记；改动结构后 proven 重置（分享按钮消失直到再打通）。
5. 挑战流：分享卡片（或输码）进入 → WIN 显示【再来一次】【分享给朋友】【返回菜单】，无「下一关」、无广告按钮。
6. 自制关内拾珍珠 +2000；重打不弹插屏；回菜单打战役关正常（isCustom 复位、广告/存档恢复）。

- [ ] **Step 3: 更新 overview.md**

在「迭代记录」追加 T5 条目：造关师模式（新文件、玩法、回归门结果）。

- [ ] **Step 4: 最终 Commit**

```bash
git add overview.md
git commit -m "造关师 T8：overview.md 迭代记录 + 全量回归通过"
```

---

## 实现注意事项汇总

- **隔离原则**：编辑器逻辑只在 4 个新文件；对现有文件的改动全部是「状态转发 / isCustom 分支抑制 / 菜单按钮」，不得把编辑器业务逻辑写进 game.js/input.js/screens.js。
- **循环依赖**：editor.js 需要 level-flow 的 setupLevel 时，在函数内 `require('./level-flow.js')`；game.js 顶部 require editor 无环（editor 不 require game）。
- **草稿存实体实例**：`draft.blocks/pigs` 直接存 `new E.Block()/new E.Pig()`（复用 draw 与几何），`deriveLevel` 从实例读字段；删除/移动直接改实例。
- **proven 重置唯一入口**：所有增/删/移动/豚队列变更都经过 `touchStructure(game)`；纯视图操作（切 tab、选物料、滚栏、选中）不调用。
- **不碰的东西**：存储键 `angryBirds_progress/settings` 不动；编辑器用独立新键 `pufferGo_editor_levels`；BOSS_LEVELS/sleep 机制编辑器不产生。
- **每个 Task 结束必须跑回归门**（至少 e2e + validate），全绿才 commit。
