/** 诊断：底栏面板顶 vs 地面线 —— 放在地面的实体是否被面板遮住 */
'use strict';
const { installEnv, loadGame } = require('./test-harness.js');
const env = installEnv({});
const game = loadGame();
const C = require('../src/config.js');
const EDITOR = require('../src/editor.js');

game.editor = null;
game.enterEditor();
env.pump(1);

const L = EDITOR.barLayout(game.editor);
console.log('screen', C.SCREEN_WIDTH, 'x', C.SCREEN_HEIGHT);
console.log('GROUND_Y      =', C.GROUND_Y);
console.log('barTop(panel) =', L.barTop);
console.log('topH          =', L.topH);
console.log('GROUND 是否被面板遮挡 =', L.barTop < C.GROUND_Y);
console.log('遮挡高度 =', C.GROUND_Y - L.barTop);

// 放在「地面」的章鱼中心与包围盒
const pig = EDITOR.placePosition(game.editor.draft, EDITOR.findPalette('pig-s'), 280, 600);
console.log('\n放在 y=600 的章鱼 → 中心', pig.y, '底', pig.y + 17,
  '被面板盖住 =', pig.y + 17 > L.barTop);

// 面板总高 & 各行
console.log('\n面板总高 =', C.SCREEN_HEIGHT - L.barTop);
console.log('seg行   =', L.segTop, '~', L.segTop + EDITOR.SEG_H);
console.log('filter行=', L.filterTop, '~', L.cardTop, '(仅 blocks)');
console.log('card行  =', L.cardTop, '~', L.cardBottom);
console.log('\n世界区高度 =', L.barTop - L.topH);
