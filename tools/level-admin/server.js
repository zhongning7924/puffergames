#!/usr/bin/env node
/**
 * 官卡后台服务（本地）
 * Local admin server for official levels.
 *
 * 只监听 127.0.0.1，不暴露公网，无需登录：本机即权限。
 * 职责：读写「官卡下发包」，一键发布到服务器（scp + 校验）。
 *
 * 启动：node tools/level-admin/server.js
 * 打开：http://127.0.0.1:7788
 *
 * 为什么它不改 src/levels.js：
 *   内置关卡只用于「首次启动无网」的兜底；线上以本后台发布的 JSON 为准。
 *   改源码需要重打包发版，与本工具「不发版就能改关」的目标相反。
 *
 * 环境变量（都有默认值，一般不用管）：
 *   PORT=7788
 *   SCP_KEY=~/.ssh/aiclub_deploy
 *   SCP_TARGET=root@43.142.39.49:/opt/zoo-rank/data/official-levels.json
 *   REMOTE_URL=https://aiclub.hk.cn/puffer/api/v1/levels/official
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { execFile } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'outputs');
const WORK_FILE = path.join(OUT_DIR, 'official-levels.working.json');
const PORT = Number(process.env.PORT || 7788);
const SCP_KEY = process.env.SCP_KEY || path.join(process.env.HOME || '', '.ssh', 'aiclub_deploy');
const SCP_TARGET = process.env.SCP_TARGET || 'root@43.142.39.49:/opt/zoo-rank/data/official-levels.json';
const REMOTE_URL = process.env.REMOTE_URL || 'https://aiclub.hk.cn/puffer/api/v1/levels/official';

const state = { version: 0, levels: [], source: 'builtin', dirty: false, remoteVersion: 0 };

// ==================== 数据 ====================

function builtinLevels() {
  const { getLevels } = require(path.join(ROOT, 'src', 'levels.js'));
  return JSON.parse(JSON.stringify(getLevels()));
}
function bossStyles() {
  const C = require(path.join(ROOT, 'src', 'config.js'));
  const out = {};
  for (const k of C.BOSS_ORDER) {
    const s = C.BOSS_STYLE[k];
    out[k] = { name: s.name, hp: s.hp, radius: s.radius };
  }
  return out;
}
function blockTypes() {
  const C = require(path.join(ROOT, 'src', 'config.js'));
  return Object.keys(C.BLOCK_TYPES);
}
function birdTypes() {
  const C = require(path.join(ROOT, 'src', 'config.js'));
  return Object.keys(C.BIRD_TYPES).map((k) => ({ key: k, name: C.BIRD_TYPES[k].name }));
}
function constants() {
  const C = require(path.join(ROOT, 'src', 'config.js'));
  return {
    screenWidth: 375,
    screenHeight: 667,
    groundY: 667 - C.GROUND_HEIGHT,
    slingshotX: C.SLINGSHOT_X,
    slingshotY: 667 - C.GROUND_HEIGHT - C.SLINGSHOT_HEIGHT,
  };
}

function fetchRemote() {
  return new Promise((resolve) => {
    const req = https.get(REMOTE_URL, { timeout: 6000 }, (res) => {
      let buf = '';
      res.on('data', (c) => { buf += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(buf)); } catch (e) { resolve(null); }
      });
    });
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
  });
}

async function loadState() {
  const remote = await fetchRemote();
  const remoteVersion = (remote && typeof remote.version === 'number') ? remote.version : 0;
  state.remoteVersion = remoteVersion;

  if (fs.existsSync(WORK_FILE)) {
    try {
      const w = JSON.parse(fs.readFileSync(WORK_FILE, 'utf8'));
      if (Array.isArray(w.data) && w.data.length) {
        state.levels = w.data;
        state.version = Math.max(w.version || 0, remoteVersion) || 1;
        state.source = 'draft';
        state.dirty = true;
        return;
      }
    } catch (e) { /* 坏草稿忽略，回落 */ }
  }
  if (remote && Array.isArray(remote.data) && remote.data.length) {
    state.levels = remote.data;
    state.version = remoteVersion;
    state.source = 'server';
    state.dirty = false;
    return;
  }
  state.levels = builtinLevels();
  state.version = 1;              // 内置 BUILTIN_VERSION
  state.source = 'builtin';
  state.dirty = false;
}

// ==================== 校验 ====================

function validate(levels) {
  const problems = [];
  if (!Array.isArray(levels) || levels.length === 0) return ['关卡数据为空'];
  levels.forEach((lv, i) => {
    const at = '第 ' + (i + 1) + ' 关';
    if (!lv || typeof lv !== 'object') { problems.push(at + ' 不是对象'); return; }
    if (typeof lv.name !== 'string' || !lv.name) problems.push(at + ' 缺少 name');
    if (!Array.isArray(lv.birds) || lv.birds.length === 0) problems.push(at + ' 没有用鸟序列');
    if (!Array.isArray(lv.pigs) || lv.pigs.length === 0) problems.push(at + ' 没有章鱼（无法通关）');
    if (!Array.isArray(lv.blocks)) problems.push(at + ' blocks 不是数组');
    const st = lv.stars;
    if (!Array.isArray(st) || st.length !== 3) problems.push(at + ' 星级门槛必须是 3 个数');
    else if (!(st[0] < st[1] && st[1] < st[2])) problems.push(at + ' 星级门槛必须递增');
    for (const b of (lv.blocks || [])) {
      if (![b.x, b.y, b.width, b.height].every((n) => typeof n === 'number')) {
        problems.push(at + ' 有方块的坐标/尺寸不是数字');
        break;
      }
      if (b.width <= 0 || b.height <= 0) { problems.push(at + ' 有方块宽或高 <= 0'); break; }
    }
    for (const p of (lv.pigs || [])) {
      if (typeof p.x !== 'number' || typeof p.y !== 'number' || typeof p.radius !== 'number') {
        problems.push(at + ' 有章鱼坐标/半径不是数字');
        break;
      }
    }
  });
  return problems;
}

// ==================== 发布 ====================

function scpUpload(file, cb) {
  execFile('scp', ['-i', SCP_KEY, '-o', 'StrictHostKeyChecking=no', file, SCP_TARGET],
    { timeout: 60000 }, (e, stdout, stderr) => cb(e, (stderr || '').trim()));
}

async function publish(levels) {
  const problems = validate(levels);
  if (problems.length) return { ok: false, error: '校验未通过', problems };

  const remote = await fetchRemote();
  const remoteVersion = (remote && typeof remote.version === 'number') ? remote.version : 0;
  const version = Math.max(remoteVersion, state.version) + 1;

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, 'official-levels.v' + version + '.json');
  fs.writeFileSync(file, JSON.stringify({ version, data: levels }), 'utf8');

  const up = await new Promise((r) => scpUpload(file, (e, stderr) => r({ e, stderr })));
  if (up.e) {
    return { ok: false, error: '上传失败（文件已生成，可手动重传）', file, detail: up.stderr || String(up.e) };
  }

  const after = await fetchRemote();
  const live = (after && after.version) || 0;
  state.levels = levels;
  state.version = version;
  state.source = 'server';
  state.remoteVersion = live;
  state.dirty = false;
  try { fs.unlinkSync(WORK_FILE); } catch (e) { /* 无草稿 */ }

  return {
    ok: true, version, file,
    live,
    consistent: live === version,
  };
}

// ==================== HTTP ====================

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let buf = '';
    req.on('data', (c) => { buf += c; if (buf.length > 20 * 1024 * 1024) reject(new Error('body too large')); });
    req.on('end', () => { try { resolve(buf ? JSON.parse(buf) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

const STATIC = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'application/javascript; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8'],
};

const server = http.createServer(async (req, res) => {
  const url = (req.url || '/').split('?')[0];

  try {
    if (req.method === 'GET' && STATIC[url]) {
      const [name, type] = STATIC[url];
      const p = path.join(__dirname, name);
      if (!fs.existsSync(p)) { res.writeHead(404); res.end('missing ' + name); return; }
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
      fs.createReadStream(p).pipe(res);
      return;
    }

    if (req.method === 'GET' && url === '/api/state') {
      sendJson(res, 200, {
        version: state.version,
        remoteVersion: state.remoteVersion,
        source: state.source,
        dirty: state.dirty,
        levels: state.levels,
        bossStyles: bossStyles(),
        blockTypes: blockTypes(),
        birdTypes: birdTypes(),
        constants: constants(),
        workFile: path.relative(ROOT, WORK_FILE),
      });
      return;
    }

    if (req.method === 'GET' && url === '/api/builtin') {
      // 供「回滚内置」用：把 src/levels.js 的原版 40 关交给前端当新版本发布
      sendJson(res, 200, { levels: builtinLevels() });
      return;
    }

    if (req.method === 'POST' && url === '/api/save') {
      const body = await readBody(req);
      const levels = body.levels;
      const problems = validate(levels);
      if (problems.length) { sendJson(res, 400, { ok: false, error: '校验未通过', problems }); return; }
      fs.mkdirSync(OUT_DIR, { recursive: true });
      fs.writeFileSync(WORK_FILE, JSON.stringify({ version: state.version, data: levels, savedAt: Date.now() }), 'utf8');
      state.levels = levels;
      state.dirty = true;
      state.source = 'draft';
      sendJson(res, 200, { ok: true, workFile: path.relative(ROOT, WORK_FILE) });
      return;
    }

    if (req.method === 'POST' && url === '/api/publish') {
      const body = await readBody(req);
      const result = await publish(body.levels);
      sendJson(res, result.ok ? 200 : 400, result);
      return;
    }

    if (req.method === 'POST' && url === '/api/discard') {
      try { fs.unlinkSync(WORK_FILE); } catch (e) { /* 无草稿 */ }
      await loadState();
      sendJson(res, 200, { ok: true, version: state.version, source: state.source, levels: state.levels });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('not found');
  } catch (e) {
    sendJson(res, 500, { ok: false, error: String(e && e.message || e) });
  }
});

loadState().then(() => {
  server.listen(PORT, '127.0.0.1', () => {
    console.log('');
    console.log('  官卡后台已启动');
    console.log('  地址   http://127.0.0.1:' + PORT);
    console.log('  数据   ' + state.source + '（版本 ' + state.version + '，服务器当前 ' + state.remoteVersion + '）');
    console.log('  上传   ' + SCP_TARGET);
    console.log('  按 Ctrl+C 退出');
    console.log('');
  });
});
