/**
 * 音效合成器 - 程序化生成 WAV 音效，零外部依赖、零版权素材
 * Sound FX synthesizer - generates WAV files procedurally.
 *
 * 用法: node tools/gen-sounds.js
 * 输出: sounds/*.wav
 */
const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 22050;
const OUT_DIR = path.join(__dirname, '..', 'sounds');

// ---------- 基础合成工具 ----------

// 带包络的频率扫描音 (可用于 sine/square/triangle/saw)
function tone({ startFreq, endFreq, duration, type = 'sine', attack = 0.005, release = 0.05, gain = 0.3, bend = 'exp' }) {
  const n = Math.max(1, Math.floor(duration * SAMPLE_RATE));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const p = t / duration;
    // 频率包络
    let freq;
    if (bend === 'exp') {
      freq = startFreq * Math.pow(endFreq / startFreq, p);
    } else {
      freq = startFreq + (endFreq - startFreq) * p;
    }
    // 振幅包络 (attack - sustain - release)
    const rStart = duration - release;
    let env;
    if (p < attack) env = p / attack;
    else if (t > rStart) env = Math.max(0, (duration - t) / release);
    else env = 1;
    const angle = 2 * Math.PI * freq * t;
    let wave;
    if (type === 'square') wave = Math.sin(angle) >= 0 ? 1 : -1;
    else if (type === 'triangle') wave = (2 / Math.PI) * Math.asin(Math.sin(angle));
    else if (type === 'saw') wave = 2 * ((freq * t) % 1) - 1;
    else wave = Math.sin(angle);
    out[i] = wave * env * gain;
  }
  return out;
}

// 噪声脉冲 (带衰减)，可模拟打击/碎裂质感
function noiseBurst({ duration, gain = 0.3, attack = 0.002, release = 0.06 }) {
  const n = Math.max(1, Math.floor(duration * SAMPLE_RATE));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const p = t / duration;
    const rStart = duration - release;
    let env;
    if (p < attack) env = p / attack;
    else if (t > rStart) env = Math.max(0, (duration - t) / release);
    else env = 1;
    out[i] = (Math.random() * 2 - 1) * env * gain;
  }
  return out;
}

// 按时间顺序拼接多段音频 (sequence)
function concatSegments(segs) {
  let total = 0;
  for (const s of segs) total += s.length;
  const out = new Float32Array(total);
  let off = 0;
  for (const s of segs) {
    out.set(s, off);
    off += s.length;
  }
  return out;
}

// 混合 (叠加并裁剪到 [-1,1])，用于让多个声音同时发声
function mix(...segs) {
  let maxLen = 0;
  for (const s of segs) maxLen = Math.max(maxLen, s.length);
  const out = new Float32Array(maxLen);
  for (const s of segs) {
    for (let i = 0; i < s.length; i++) {
      out[i] += s[i];
    }
  }
  for (let i = 0; i < maxLen; i++) {
    out[i] = Math.max(-1, Math.min(1, out[i]));
  }
  return out;
}

// ---------- 各音效定义 ----------

const SOUNDS = {
  // 弹弓发射: 上扬的 "嘣" + 起手高频噪声
  launch: () => mix(
    tone({ startFreq: 220, endFreq: 900, duration: 0.16, type: 'triangle', gain: 0.32, attack: 0.004, release: 0.07 }),
    noiseBurst({ duration: 0.03, gain: 0.18 })
  ),

  // 撞击: 低频 "咚" + 短噪声拍击
  hit: () => mix(
    tone({ startFreq: 200, endFreq: 70, duration: 0.11, type: 'sine', gain: 0.5, attack: 0.002, release: 0.05 }),
    noiseBurst({ duration: 0.04, gain: 0.22 })
  ),

  // 猪被消灭: 俏皮的上滑 "啵"
  pop: () => concatSegments([
    tone({ startFreq: 350, endFreq: 880, duration: 0.09, type: 'sine', gain: 0.42, attack: 0.003, release: 0.04 }),
    tone({ startFreq: 880, endFreq: 600, duration: 0.06, type: 'sine', gain: 0.28, attack: 0.002, release: 0.04 }),
  ]),

  // 方块碎裂: 噪声爆裂 + 木质 "咔"
  break: () => mix(
    noiseBurst({ duration: 0.14, gain: 0.38, release: 0.1 }),
    tone({ startFreq: 320, endFreq: 110, duration: 0.12, type: 'square', gain: 0.3, attack: 0.002, release: 0.06 })
  ),

  // 胜利: 上行琶音 C5-E5-G5-C6
  win: () => concatSegments([
    tone({ startFreq: 523, endFreq: 523, duration: 0.13, type: 'triangle', gain: 0.34 }),
    tone({ startFreq: 659, endFreq: 659, duration: 0.13, type: 'triangle', gain: 0.34 }),
    tone({ startFreq: 784, endFreq: 784, duration: 0.13, type: 'triangle', gain: 0.34 }),
    tone({ startFreq: 1046, endFreq: 1046, duration: 0.32, type: 'triangle', gain: 0.36, release: 0.2 }),
  ]),

  // 失败: 下行 "唉" 三连降
  lose: () => concatSegments([
    tone({ startFreq: 523, endFreq: 466, duration: 0.18, type: 'triangle', gain: 0.3, bend: 'lin' }),
    tone({ startFreq: 392, endFreq: 349, duration: 0.18, type: 'triangle', gain: 0.3, bend: 'lin' }),
    tone({ startFreq: 294, endFreq: 262, duration: 0.34, type: 'triangle', gain: 0.3, release: 0.22, bend: 'lin' }),
  ]),

  // UI 点击: 短促清脆
  tap: () => tone({ startFreq: 1100, endFreq: 1100, duration: 0.045, type: 'sine', gain: 0.18, attack: 0.001, release: 0.02 }),

  // 星星弹出: 清脆高音 "叮"（基音 + 高八度泛音闪光）
  ding: () => mix(
    tone({ startFreq: 1568, endFreq: 1568, duration: 0.1, type: 'sine', gain: 0.3, attack: 0.002, release: 0.07 }),
    tone({ startFreq: 3136, endFreq: 3136, duration: 0.14, type: 'sine', gain: 0.16, attack: 0.002, release: 0.11 })
  ),

  // 爆炸: 低频轰击 + 宽噪声气浪 + 次低频余震（原创合成）
  boom: () => mix(
    tone({ startFreq: 130, endFreq: 35, duration: 0.45, type: 'sine', gain: 0.55, attack: 0.003, release: 0.3 }),
    noiseBurst({ duration: 0.3, gain: 0.4, attack: 0.002, release: 0.22 }),
    tone({ startFreq: 70, endFreq: 28, duration: 0.6, type: 'triangle', gain: 0.3, attack: 0.01, release: 0.45 })
  ),
};

// ---------- 循环 BGM（原创旋律：C 宫五声音阶，120BPM 四小节循环） ----------
// 三角波主旋律 + 正弦贝斯，8 秒无缝循环；不走音效池，游戏内独立循环通道播放。
function genBGM() {
  const BPM = 120;
  const beat = 60 / BPM;   // 0.5s
  const slot = beat / 2;   // 八分音符 0.25s

  // 音符频率（C 宫五声：C D E G A）
  const F = {
    G4: 392.00, A4: 440.00,
    C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.00,
    F2: 87.31, G2: 98.00, A2: 110.00, C3: 130.81,
  };

  // 主旋律：32 个八分音符槽（0 = 休止），4 小节，起承转合
  const melody = [
    F.C5, F.E5, F.G5, F.E5,  F.A4, F.C5, F.E5, F.C5,   // 第 1 小节（起）
    F.D5, F.E5, F.G5, F.E5,  F.D5, F.C5, F.D5, 0,      // 第 2 小节（承）
    F.C5, F.E5, F.G5, F.A5,  F.G5, F.E5, F.D5, F.E5,   // 第 3 小节（转，推到最高音）
    F.C5, F.D5, F.E5, F.C5,  F.A4, 0,    F.G4, 0,      // 第 4 小节（合，落回主音）
  ];
  // 贝斯：8 个二分音符（每小节 2 个），I-vi-IV-V 走向
  const bass = [F.C3, F.C3, F.A2, F.A2, F.F2, F.F2, F.G2, F.G2];

  const duration = melody.length * slot; // 8s
  const n = Math.floor(duration * SAMPLE_RATE);
  const out = new Float32Array(n);
  const tri = (f, t) => (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * f * t));

  // 铺一个音符层：wave 波形函数 + 起音/衰减包络，避免音符边缘咔哒
  function layNote(freq, startSec, noteLen, gain, wave) {
    const s0 = Math.floor(startSec * SAMPLE_RATE);
    const sn = Math.floor(noteLen * SAMPLE_RATE);
    for (let k = 0; k < sn && s0 + k < n; k++) {
      const t = k / SAMPLE_RATE;
      const p = k / sn;
      const env = Math.min(1, p / 0.05) * Math.pow(1 - p, 0.55);
      out[s0 + k] += wave(freq, t) * env * gain;
    }
  }

  melody.forEach((f, i) => { if (f) layNote(f, i * slot, slot * 0.92, 0.30, tri); });
  const sine = (f, t) => Math.sin(2 * Math.PI * f * t);
  bass.forEach((f, i) => { if (f) layNote(f, i * beat * 2, beat * 2 * 0.95, 0.20, sine); });

  // 软限幅，防止叠加削波
  for (let i = 0; i < n; i++) out[i] = Math.tanh(out[i] * 1.2) * 0.85;

  // 循环点抗咔哒：首尾 10ms 交叉淡化（循环处波形连续）
  const fadeN = Math.floor(0.01 * SAMPLE_RATE);
  for (let i = 0; i < fadeN; i++) {
    const g = i / fadeN;
    out[i] *= g;
    out[n - 1 - i] *= g;
  }
  return out;
}

// ---------- WAV 写出 ----------

function writeWav(filename, samples) {
  const numSamples = samples.length;
  const buffer = Buffer.alloc(44 + numSamples * 2);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);      // PCM 块大小
  buffer.writeUInt16LE(1, 20);       // PCM 格式
  buffer.writeUInt16LE(1, 22);       // 单声道
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28); // 字节率
  buffer.writeUInt16LE(2, 32);       // 块对齐
  buffer.writeUInt16LE(16, 34);      // 位深
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);
  for (let i = 0; i < numSamples; i++) {
    let s = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.floor(s * 32767), 44 + i * 2);
  }
  fs.writeFileSync(filename, buffer);
}

// ---------- 执行 ----------

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

for (const [name, gen] of Object.entries(SOUNDS)) {
  const samples = gen();
  const file = path.join(OUT_DIR, name + '.wav');
  writeWav(file, samples);
  const kb = (fs.statSync(file).size / 1024).toFixed(1);
  console.log(`✓ ${name}.wav  (${(samples.length / SAMPLE_RATE).toFixed(2)}s, ${kb} KB)`);
}

// 循环 BGM（独立通道播放，不进音效池）
{
  const bgm = genBGM();
  const file = path.join(OUT_DIR, 'bgm.wav');
  writeWav(file, bgm);
  const kb = (fs.statSync(file).size / 1024).toFixed(1);
  console.log(`✓ bgm.wav  (${(bgm.length / SAMPLE_RATE).toFixed(2)}s, ${kb} KB)`);
}
console.log(`\n全部音效已生成到 ${OUT_DIR}`);
