/**
 * 造关师渲染 - 编辑器画面绘制（顶栏/底栏/网格预览/问题红圈/草稿实体）。
 * Editor rendering. T4 为空壳，T5 填充。
 * 注意：底栏 84px 落在海床线（GROUND_Y = H-90）以下沙土区，世界正常渲染、
 * 触摸不做坐标变换（spec §5 的 translate 经核实不必要）。
 */
'use strict';

function drawEditor(game) {
  // T5 填充：背景 → 草稿实体 → 选中高亮 → 预览/红圈 → 顶栏 44px → 底栏 84px
}

module.exports = { drawEditor };
