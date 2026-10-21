/**
 * 造关师 UI 截图（无头 Chrome）。
 * 用途：T15 视觉回归——底栏/顶栏重排后肉眼复核间距、图标与配色。
 * 用法：node tools/shot-editor.js [outDir]
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, process.argv[2] || 'outputs/editor-shots');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// 375×667 舞台 → 2x 截图（与商店截图同宽高比，便于直接比对）
const W = 750, H = 1334;

const SHOTS = [
  { name: 'editor-blocks', q: 'scene=editor&tab=blocks&mat=wood&fill=1' },
  { name: 'editor-blocks-stone', q: 'scene=editor&tab=blocks&mat=stone' },
  { name: 'editor-enemies', q: 'scene=editor&tab=enemies&sel=pig-boss' },
  { name: 'editor-birds', q: 'scene=editor&tab=birds' },
  { name: 'editor-items', q: 'scene=editor&tab=items' },
];

function url(q) {
  const p = path.join(ROOT, 'preview', 'index.html');
  return 'file://' + p + '?' + q + `&dpr=${(W / 375).toFixed(2)}`;
}

function shot(q, out) {
  return new Promise((resolve) => {
    const profile = fs.mkdtempSync('/tmp/wb-chrome-');
    const args = [
      '--headless=new', '--disable-gpu', '--hide-scrollbars',
      '--no-sandbox', '--force-device-scale-factor=1',
      `--user-data-dir=${profile}`,
      `--window-size=${W},${H}`,
      '--virtual-time-budget=12000',
      `--screenshot=${out}`,
      url(q),
    ];
    const p = spawn(CHROME, args, { stdio: 'ignore' });
    const done = () => { try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {} resolve(); };
    p.on('close', done);
    p.on('error', () => { console.error('  ✗ Chrome 启动失败'); done(); });
  });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const s of SHOTS) {
    const out = path.join(OUT, s.name + '.png');
    await shot(s.q, out);
    const ok = fs.existsSync(out) && fs.statSync(out).size > 1000;
    console.log(`${ok ? '✓' : '✗'} ${s.name}.png${ok ? ' ' + (fs.statSync(out).size / 1024).toFixed(0) + 'KB' : ''}`);
  }
  console.log('输出目录:', OUT);
})();
