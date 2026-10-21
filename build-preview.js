/**
 * 浏览器预览打包器
 * 把微信小游戏的 CommonJS 模块（game.js + src/*）打包为浏览器可用的 IIFE。
 * 浏览器原生不支持 require，这里内置一个极简 CommonJS 运行时，按相对路径解析模块。
 * 运行：node build-preview.js  -> 生成 preview/bundle.js
 */
const fs = require('fs');
const path = require('path');

const root = __dirname;
const srcDir = path.join(root, 'src');
const outDir = path.join(root, 'preview');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

// 入口 + src/ 下全部模块（自动扫描，新增模块无需手动登记，
// 避免曾出现的 audio.js 漏登记导致预览包运行时报错的问题）
const files = { 'game.js': read('game.js') };
for (const name of fs.readdirSync(srcDir).filter(f => f.endsWith('.js')).sort()) {
  files['src/' + name] = read('src/' + name);
}

// 将每个源文件包成 function(require, module, exports){ <源码> }
function wrap(name, code) {
  return `registry[${JSON.stringify(name)}] = function(require, module, exports){\n${code}\n};`;
}

const moduleDefs = Object.entries(files).map(([n, c]) => wrap(n, c)).join('\n');

const bundle = `(function(){
  const registry = {};
  const cache = {};
  ${moduleDefs}

  let currentModule = '';
  function resolve(base, p) {
    if (p[0] !== '.') return p;
    const idx = base.lastIndexOf('/');
    const baseDir = idx >= 0 ? base.slice(0, idx) : '';
    const parts = (baseDir ? baseDir.split('/') : []).concat(p.split('/'));
    const stack = [];
    for (const part of parts) {
      if (part === '.' || part === '') continue;
      if (part === '..') stack.pop();
      else stack.push(part);
    }
    return stack.join('/');
  }
  function __require(name) {
    const key = resolve(currentModule, name);
    if (cache[key]) return cache[key].exports;
    const module = { exports: {} };
    cache[key] = module;
    const prev = currentModule;
    currentModule = key;
    registry[key](__require, module, module.exports);
    currentModule = prev;
    return module.exports;
  }
  // 入口：根目录 game.js 只做 require('./src/game.js') 不导出，故直接取 src 模块的实例
  // （src/game.js 的 module.exports = new Game()，e2e 亦依赖此约定）
  __require('./game.js');
  window.__wbGame = __require('./src/game.js');
  try { window.__wbEditor = __require('./src/editor.js'); } catch (e) { window.__wbEditor = null; }
})();
`;

fs.writeFileSync(path.join(outDir, 'bundle.js'), bundle, 'utf8');
console.log('✓ 已生成 preview/bundle.js （' + (bundle.length / 1024).toFixed(1) + ' KB）');
