#!/usr/bin/env node
/**
 * 官卡下发文件导出器
 * Export official levels payload for server dispatch.
 *
 * 用法：
 *   node tools/export-levels.js --version 2
 *   node tools/export-levels.js --version 2 --pretty      # 带缩进，便于 diff 审阅
 *   node tools/export-levels.js --version 2 --out /tmp/x.json
 *
 * 产物结构（客户端 src/level-source.js 契约）：
 *   { "version": 2, "data": [ Level, ... ] }
 *
 * 版本号规则：
 *   - 必须 **大于** 客户端当前生效版本才会被采纳（内置为 BUILTIN_VERSION，见 level-source.js）；
 *   - 每次正式下发都用新号（2、3、4…），不要复用旧号，否则老客户端不会更新。
 *
 * 上传（与服务器约定）：
 *   scp outputs/official-levels.v2.json root@43.142.39.49:/opt/zoo-rank/data/official-levels.json
 *   —— 文件名固定为 official-levels.json，服务端按 mtime 自动换缓存，无需重启。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { getLevels } = require('../src/levels.js');

const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const out = { version: null, out: null, pretty: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--version' || a === '-v') out.version = parseInt(argv[++i], 10);
    else if (a === '--out' || a === '-o') out.out = argv[++i];
    else if (a === '--pretty') out.pretty = true;
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function fail(msg) {
  console.error('✗ ' + msg);
  process.exit(1);
}

/** 形状自检：缺字段的关卡在客户端会被整包丢弃，必须提前拦住 */
function inspectLevels(levels) {
  const problems = [];
  levels.forEach((lv, i) => {
    const where = 'L' + (i + 1);
    if (!lv || typeof lv !== 'object') { problems.push(where + ' 不是对象'); return; }
    for (const key of ['birds', 'pigs', 'blocks']) {
      if (!Array.isArray(lv[key])) problems.push(where + ' 缺少 ' + key + ' 数组');
    }
    if (typeof lv.name !== 'string' || !lv.name) problems.push(where + ' 缺少 name');
    if (!lv.stars || typeof lv.stars !== 'object') problems.push(where + ' 缺少 stars 门槛');
  });
  return problems;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0]);
    return;
  }
  if (!Number.isInteger(args.version) || args.version <= 0) {
    fail('必须用 --version 指定正整数版本号，例如：node tools/export-levels.js --version 2');
  }

  const levels = getLevels();
  if (!Array.isArray(levels) || levels.length === 0) fail('levels.getLevels() 返回空');

  const problems = inspectLevels(levels);
  if (problems.length) {
    console.error('✗ 关卡数据形状不合格，客户端会整包拒绝：');
    problems.forEach((p) => console.error('  - ' + p));
    process.exit(1);
  }

  const payload = { version: args.version, data: levels };
  const text = args.pretty ? JSON.stringify(payload, null, 2) : JSON.stringify(payload);

  const outPath = args.out
    ? path.resolve(args.out)
    : path.join(ROOT, 'outputs', 'official-levels.v' + args.version + '.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, text, 'utf8');

  // —— 摘要 ——
  let starTotal = 0;
  const birds = { normal: 0 };
  for (const lv of levels) {
    for (const k in (lv.stars || {})) starTotal += lv.stars[k] || 0;
    for (const b of (lv.birds || [])) {
      const t = typeof b === 'string' ? b : (b && b.type) || 'normal';
      birds[t] = (birds[t] || 0) + 1;
    }
  }

  console.log('✓ 已导出官卡下发包');
  console.log('  版本号   : ' + args.version);
  console.log('  关卡数   : ' + levels.length + '（' + (levels[0].name || '?') + ' … ' + (levels[levels.length - 1].name || '?') + '）');
  console.log('  3星门槛和: ' + starTotal);
  console.log('  用鸟分布 : ' + Object.entries(birds).map(([k, v]) => k + '×' + v).join(' '));
  console.log('  体积     : ' + (Buffer.byteLength(text, 'utf8') / 1024).toFixed(1) + ' KB');
  console.log('  输出     : ' + outPath);
  console.log('');
  console.log('下一步（上传后客户端下次启动即可收到，无需发版）：');
  console.log('  scp "' + outPath + '" root@43.142.39.49:/opt/zoo-rank/data/official-levels.json');
  console.log('  自检: curl -s https://aiclub.hk.cn/puffer/api/v1/levels/official | head -c 120');
  console.log('');
  console.log('注意：version 必须大于客户端当前生效版本（内置 BUILTIN_VERSION=1，首次下发用 2）。');
}

main();
