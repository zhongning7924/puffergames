#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""操作手册插图：系统架构图 + 主流程图（依据本项目真实模块与状态机绘制）。"""
import math
import os

from PIL import Image, ImageDraw, ImageFont

OUT = os.path.dirname(os.path.abspath(__file__))

FONT = '/System/Library/Fonts/Hiragino Sans GB.ttc'
INK = (40, 62, 74)
PAPER = (243, 251, 254)
BOX = (255, 255, 255)
EDGE = (126, 196, 222)
ACCENT = (240, 150, 180)
HEAD = (214, 240, 249)
DECI = (255, 244, 214)


def F(size, idx=0):
    return ImageFont.truetype(FONT, size, index=idx)


def rbox(d, xy, text, fsize=28, fill=BOX, edge=EDGE, tcolor=INK, width=3, radius=14):
    d.rounded_rectangle(xy, radius=radius, fill=fill, outline=edge, width=width)
    x0, y0, x1, y1 = xy
    lines = text.split('\n')
    lh = int(fsize * 1.45)
    total = lh * len(lines)
    cy = (y0 + y1 - total) / 2
    f = F(fsize)
    for ln in lines:
        w = d.textlength(ln, font=f)
        d.text(((x0 + x1 - w) / 2, cy), ln, font=f, fill=tcolor)
        cy += lh


def arrow(d, x0, y0, x1, y1, color=ACCENT, width=4):
    d.line([(x0, y0), (x1, y1)], fill=color, width=width)
    ang = math.atan2(y1 - y0, x1 - x0)
    L = 18
    for s in (2.55, 3.55):
        d.line([(x1, y1), (x1 - L * math.cos(ang - s), y1 - L * math.sin(ang - s))], fill=color, width=width)


def label(d, text, x, y, size=24, color=(120, 140, 150)):
    d.text((x, y), text, font=F(size), fill=color)


def architecture():
    W, H = 1600, 1180
    im = Image.new('RGB', (W, H), PAPER)
    d = ImageDraw.Draw(im)
    title = '图 1  系统架构图'
    d.text(((W - d.textlength(title, font=F(42))) / 2, 26), title, font=F(42), fill=INK)

    # 运行环境
    rbox(d, (110, 110, 1490, 210),
         '微信小游戏运行环境：Canvas 2D 画布 · wx 触摸 API · 小游戏基础库（game.json 竖屏配置）',
         30, fill=HEAD, edge=EDGE)
    arrow(d, 800, 210, 800, 252)

    # 界面层
    rbox(d, (110, 258, 1490, 392),
         '界面层\nscreens.js（菜单 / 选关 / 设置 / 结算 / 全服榜） · renderer.js（世界与 HUD 绘制）\n'
         'theme.js（海洋主题） · help.js（图鉴） · editor-render.js（编辑器绘制）',
         27)
    arrow(d, 800, 392, 800, 434)

    # 业务逻辑层
    rbox(d, (110, 440, 1490, 588),
         '业务逻辑层\ngame.js（状态机与主循环） · level-flow.js（装填与候飞队列） · combat.js（技能与伤害）\n'
         'settle.js（胜负判定与存档） · pearls.js（珍珠） · daily.js（每日挑战）\n'
         'editor.js / editor-strategy.js / level-validate.js（造关师与试解）',
         26)
    arrow(d, 800, 588, 800, 630)

    # 基础组件层
    rbox(d, (110, 636, 1490, 776),
         '基础组件层\nphysics.js（碰撞与响应） · entities.js（河豚 / 章鱼 / 方块 / 粒子 / 按钮）\n'
         'effects.js（粒子 / 飘字 / 震屏） · input.js（触摸分发） · utils.js（向量与几何）\n'
         'audio.js（音效） · ad.js（激励视频 / 插屏 / 横幅） · config.js（常量与配色）',
         26)
    arrow(d, 800, 776, 800, 818)

    # 数据层
    rbox(d, (110, 824, 800, 986),
         '数据层（随包资源）\nlevels.js：40 个官方关卡数据\n'
         'level-codec.js：关卡分享码编解码\nlevel-source.js：内置 / 原始 / 活动副本',
         25)
    rbox(d, (830, 824, 1490, 986),
         '数据层（本地与远端）\nwx 本地存储：angryBirds_progress / settings /\n'
         'official_* / rank_token\nHTTPS：aiclub.hk.cn/puffer/api（全服榜、官卡下发）',
         25, fill=(255, 250, 240), edge=(238, 208, 150))

    label(d, '箭头表示调用方向：上层通过 require 调用下层模块，下层不反向依赖上层。', 110, 1010, 24)
    label(d, '全服榜与官卡下发均为可选链路，请求失败时由调用方静默降级，不阻断单机流程。', 110, 1052, 24)
    im.save(os.path.join(OUT, '图1_系统架构图.png'))
    print('图1 ok')


def flow():
    W, H = 1600, 1500
    im = Image.new('RGB', (W, H), PAPER)
    d = ImageDraw.Draw(im)
    title = '图 2  游戏主流程图'
    d.text(((W - d.textlength(title, font=F(42))) / 2, 26), title, font=F(42), fill=INK)

    cx = 800
    rbox(d, (cx - 300, 110, cx + 300, 190), '主菜单（MENU）', 30, fill=HEAD)
    arrow(d, cx, 190, cx, 232)

    rbox(d, (cx - 340, 238, cx + 340, 318),
         '选择关卡：战役 40 关 / 每日挑战 / 自制关 / 珍珠关', 27)
    arrow(d, cx, 318, cx, 360)

    rbox(d, (cx - 320, 366, cx + 320, 470),
         '装填（READY）\n候飞河豚排队 · 点击换序 · 显示隐藏珍珠位置', 27)
    arrow(d, cx, 470, cx, 512)

    rbox(d, (cx - 300, 518, cx + 300, 598), '拖拽弹弓瞄准（AIMING，拖拽上限 95 像素）', 26)
    arrow(d, cx, 598, cx, 640)

    rbox(d, (cx - 360, 646, cx + 360, 750),
         '发射与飞行（FLYING）\n技能触发 · 方块受击 / 坍塌 · 爆裂果链式引爆 · 珍珠拾取', 26)
    arrow(d, cx, 750, cx, 792)

    rbox(d, (cx - 260, 798, cx + 260, 878), '静置结算（SETTLING）', 27)
    arrow(d, cx, 878, cx, 918)

    # 判定 1
    d.polygon([(cx, 918), (cx + 330, 1010), (cx, 1102), (cx - 330, 1010)], fill=DECI, outline=(226, 190, 120))
    f = F(27)
    t1 = '章鱼怪是否\n全部击破？'
    for i, ln in enumerate(t1.split('\n')):
        d.text((cx - d.textlength(ln, font=f) / 2, 980 + i * 38), ln, font=f, fill=INK)

    # 是 → 通关
    d.line([(cx + 330, 1010), (1230, 1010)], fill=ACCENT, width=4)
    arrow(d, 1230, 1010, 1230, 1062)
    label(d, '是', cx + 340, 972, 26, (220, 120, 150))
    rbox(d, (930, 1068, 1530, 1210),
         '通关结算（WIN）\n按分数门槛评 1~3 星 · 写入本地存档\n累计珍珠奖励 · 上报全服榜 · 每日挑战记分', 24)
    arrow(d, 1230, 1210, 1230, 1252)
    rbox(d, (930, 1258, 1530, 1330), '下一关 / 重玩 / 返回菜单', 26)

    # 否 → 是否还有河豚
    d.line([(cx - 330, 1010), (330, 1010)], fill=ACCENT, width=4)
    arrow(d, 330, 1010, 330, 1062)
    label(d, '否', cx - 380, 972, 26, (220, 120, 150))
    d.polygon([(330, 1062), (560, 1148), (330, 1234), (100, 1148)], fill=DECI, outline=(226, 190, 120))
    t2 = '是否还有\n候飞河豚？'
    for i, ln in enumerate(t2.split('\n')):
        d.text((330 - d.textlength(ln, font=f) / 2, 1118 + i * 38), ln, font=f, fill=INK)

    # 还有 → 回到装填
    d.line([(100, 1148), (60, 1148), (60, 418), (cx - 320, 418)], fill=ACCENT, width=4)
    arrow(d, 60, 418, cx - 322, 418)
    label(d, '是', 74, 1108, 26, (220, 120, 150))

    # 没有 → 失败
    arrow(d, 330, 1234, 330, 1276)
    rbox(d, (100, 1282, 640, 1400),
         '失败结算（LOSE）\n可选观看激励视频 +1 河豚复活一次\n否则重试本关或返回菜单', 24, fill=(255, 246, 246), edge=(232, 168, 168))

    label(d, '状态机集中在 src/game.js，状态取值为 MENU / LEVEL_SELECT / READY / AIMING / FLYING / '
             'SETTLING / WIN / LOSE / EDITOR。', 110, 1432, 23)
    im.save(os.path.join(OUT, '图2_游戏主流程图.png'))
    print('图2 ok')


if __name__ == '__main__':
    architecture()
    flow()
