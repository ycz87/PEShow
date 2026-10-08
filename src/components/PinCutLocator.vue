<script setup lang="ts">
// 1.2-2 的"剖切位置"示意图（SVG）：一小块芯片沿中线竖直切开，移走前半，露出的切面就是剖面；
// 切面中间的一小条（黄框）是下面两列叠层画的内容，右边缘圈出的地方是下面"终端结构"放大的位置。
// 芯片厚度画得比真实厚得多（真实只有约 0.1–0.3 mm，宽几毫米）。斜投影，不按比例。
import { tx } from '../app/settings'
import { UI_SECTION as U } from '../devices/power-diode/sections/uiSection'

// 切面（后半块的前表面）：x 92…242、y 56…104；向后（右上）的投影位移 (DX, DY)
const X0 = 92
const X1 = 242
const Y0 = 56
const H = 48
const DX = 18
const DY = -12
const P = 7 // P⁺ 层厚度（画出来的）
const N = 11 // N⁺
const SX = 160 // 黄框小条
const SW = 14

const pts = (a: [number, number][]) => a.map(([x, y]) => `${x},${y}`).join(' ')
const TOP = pts([[X0, Y0], [X1, Y0], [X1 + DX, Y0 + DY], [X0 + DX, Y0 + DY]])
const SIDE = pts([[X1, Y0], [X1 + DX, Y0 + DY], [X1 + DX, Y0 + DY + H], [X1, Y0 + H]])
// 被移走的前半块：在切面的前面（左下），只画虚线轮廓
const GHOST = [
  pts([[X0, Y0], [X0 - DX, Y0 - DY], [X1 - DX, Y0 - DY], [X1, Y0]]),
  pts([[X0 - DX, Y0 - DY], [X1 - DX, Y0 - DY], [X1 - DX, Y0 - DY + H], [X0 - DX, Y0 - DY + H]]),
  pts([[X1, Y0], [X1 - DX, Y0 - DY], [X1 - DX, Y0 - DY + H], [X1, Y0 + H]]),
]
</script>

<template>
  <svg class="loc" viewBox="0 14 270 134" role="img" :aria-label="tx(U.cut.text)">
    <!-- 移走的前半块 -->
    <g class="ghost">
      <polygon v-for="g in GHOST" :key="g" :points="g" />
    </g>

    <!-- 后半块：顶面、右侧面、切面 -->
    <polygon :points="TOP" class="top" />
    <polygon :points="SIDE" class="side" />
    <g class="face">
      <rect :x="X0" :y="Y0" :width="X1 - X0" :height="3" class="metal" />
      <rect :x="X0" :y="Y0 + 3" :width="X1 - X0" :height="P" class="p" />
      <rect :x="X0" :y="Y0 + 3 + P" :width="X1 - X0" :height="H - 3 - P - N" class="nm" />
      <rect :x="X0" :y="Y0 + H - N" :width="X1 - X0" :height="N" class="np" />
      <rect :x="X0" :y="Y0" :width="X1 - X0" :height="H" class="frame" />
    </g>

    <!-- 下面两列画的那一条 -->
    <rect :x="SX" :y="Y0 - 3" :width="SW" :height="H + 6" class="strip" />
    <path :d="`M${SX + SW / 2},${Y0 + H + 4} v14`" class="lead" />
    <text :x="SX + SW / 2" :y="Y0 + H + 32" class="lbl mid">{{ tx(U.cut.strip) }}</text>

    <!-- 边缘：下方"终端结构"放大的位置 -->
    <ellipse :cx="X1 - 2" :cy="Y0 + 14" rx="15" ry="19" class="edge" />
    <path :d="`M${X1 - 2},${Y0 - 6} V${Y0 - 20}`" class="lead" />
    <text :x="X1 + DX" :y="Y0 - 26" class="lbl end">{{ tx(U.cut.edge) }}</text>

    <!-- 标注 -->
    <text :x="X0 + 6" :y="Y0 - 26" class="lbl">{{ tx(U.cut.face) }}</text>
    <path :d="`M${X0 + 30},${Y0 - 22} L${X0 + 42},${Y0 + 12}`" class="lead" />
    <text :x="2" :y="132" class="lbl soft">{{ tx(U.cut.removed) }}</text>
    <path :d="`M44,122 L${X0 - DX + 2},${Y0 - DY + H - 4}`" class="lead" />

    <!-- 电流方向：自正面到背面 -->
    <g class="flow">
      <path :d="`M${X0 - 14},${Y0 + 2} V${Y0 + H - 2}`" />
      <path :d="`M${X0 - 19},${Y0 + H - 9} L${X0 - 14},${Y0 + H - 1} L${X0 - 9},${Y0 + H - 9} Z`" class="head" />
      <text :x="X0 - 22" :y="Y0 + 8" class="lbl end">{{ tx(U.cut.front) }}</text>
      <text :x="X0 - 22" :y="Y0 + H" class="lbl end">{{ tx(U.cut.back) }}</text>
    </g>
  </svg>
</template>

<style scoped>
.loc { width: 100%; height: auto; display: block; font-family: var(--font-body); }
.ghost polygon { fill: none; stroke: var(--ink-soft); stroke-width: 1.2px; stroke-dasharray: 4 3; stroke-linejoin: round; }
.top { fill: color-mix(in srgb, var(--ink) 30%, var(--surface)); stroke: var(--line); stroke-width: 1.6px; stroke-linejoin: round; }
.side { fill: color-mix(in srgb, var(--ink) 18%, var(--surface)); stroke: var(--line); stroke-width: 1.6px; stroke-linejoin: round; }
.face rect { stroke: none; }
.metal { fill: color-mix(in srgb, var(--ink) 38%, var(--surface)); }
.p { fill: var(--p-region); }
.nm { fill: color-mix(in srgb, var(--n-region) 38%, #fff); }
.np { fill: var(--n-region); }
.face .frame { fill: none; stroke: var(--line); stroke-width: var(--bw, 2px); }
.strip { fill: none; stroke: var(--accent); stroke-width: 2.4px; rx: 2; }
.edge { fill: none; stroke: var(--danger); stroke-width: 2px; stroke-dasharray: 4 3; }
.lead { fill: none; stroke: var(--ink-soft); stroke-width: 1.2px; }
.flow path:not(.head) { fill: none; stroke: var(--ink-soft); stroke-width: 2px; stroke-dasharray: 4 3; }
.flow .head { fill: var(--ink-soft); }
.lbl { font-size: 11px; font-weight: 700; fill: var(--ink); paint-order: stroke; stroke: var(--bg); stroke-width: 3px; stroke-linejoin: round; }
.lbl.mid { text-anchor: middle; fill: var(--accent); }
.lbl.end { text-anchor: end; fill: var(--ink-soft); font-weight: 400; }
.lbl.soft { fill: var(--ink-soft); font-weight: 400; }
</style>
