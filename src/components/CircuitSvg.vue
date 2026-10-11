<script setup lang="ts">
// 电阻法测试电路图（0.8、1.4 共用）：正向电源 U₁、反向电源 U_R 经单刀双掷开关 S、电阻 R、回路电感 L 接二极管 D。
// 只负责画：开关拨向哪边、回路电流的箭头（粗细 ∝ 电流大小，反向电流换色）、二极管电压
import { computed } from 'vue'
import { tx } from '../app/settings'
import { signedV } from '../app/format'
import { UI } from '../devices/pn-junction/sections/ui'

const props = defineProps<{
  /** 开关拨在 +U₁ */
  toU1: boolean
  /** 回路电流（A）、二极管电压（V） */
  i: number
  u: number
  /** 箭头粗细的参考电流（A） */
  iRef: number
  /** 电流的显示单位 */
  unit: 'mA' | 'A'
  U1: number
  UR: number
  /** R、L 的标注（已带单位） */
  R: string
  L: string
}>()
const U = UI.circ

const BOT = 214
const X1 = 60
const X2 = 118
const YA = 62
const YB = 112
const XC = 170
const XP = 214
const YP = 87
const XD = 400

const V1 = (v: number) => `${v >= 100 ? v.toFixed(0) : v.toFixed(1)} V`
const amp = (i: number) => {
  const v = props.unit === 'mA' ? i * 1e3 : i
  return `${v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)} ${props.unit}`
}

/** 回路电流箭头：R 上横向（正向电流向右）、二极管旁竖向（正向电流向下） */
const arrow = computed(() => {
  const width = Math.abs(props.i) < 0.02 * props.iRef ? 0 : 1.6 + 5 * Math.min(1.4, Math.abs(props.i) / props.iRef)
  return { width, fwd: props.i >= 0, text: amp(props.i) }
})
function hArrow(x: number, y: number, dir: number, width: number) {
  const L = 40
  const h = 7 + width
  const x1 = x + (dir * L) / 2
  return { line: `M${x - (dir * L) / 2} ${y} L${x1 - dir * h * 0.8} ${y}`, head: `M${x1} ${y} L${x1 - dir * h} ${y - h * 0.6} L${x1 - dir * h} ${y + h * 0.6} Z` }
}
function vArrow(x: number, y: number, dir: number, width: number) {
  const L = 34
  const h = 7 + width
  const y1 = y + (dir * L) / 2
  return { line: `M${x} ${y - (dir * L) / 2} L${x} ${y1 - dir * h * 0.8}`, head: `M${x} ${y1} L${x - h * 0.6} ${y1 - dir * h} L${x + h * 0.6} ${y1 - dir * h} Z` }
}
const arrows = computed(() => {
  const a = arrow.value
  if (!a.width) return []
  const dir = a.fwd ? 1 : -1
  return [hArrow(280, YP - 22, dir, a.width), vArrow(XD + 26, 150, dir, a.width)]
})
</script>

<template>
<svg viewBox="0 0 470 250" class="plot" role="img" :aria-label="tx(U.title)">
  <!-- 地线：两个电源的另一端与二极管阴极 -->
  <path :d="`M${X1} ${BOT} H${XD}`" class="wire" />
  <!-- 正向电源 U₁（长线为正极，在上） -->
  <path :d="`M${X1} ${YA} V134 M${X1} 146 V${BOT} M${X1} ${YA} H${XC}`" class="wire" />
  <path :d="`M${X1 - 16} 134 H${X1 + 16} M${X1 - 9} 146 H${X1 + 9}`" class="battery" />
  <text :x="X1 - 22" y="138" class="lbl" text-anchor="end">U₁</text>
  <text :x="X1 - 22" y="154" class="sub" text-anchor="end">{{ V1(U1) }}</text>
  <text :x="X1 - 12" y="126" class="sub" text-anchor="end">+</text>
  <!-- 反向电源 U_R（长线为正极，在下：上端是 −U_R） -->
  <path :d="`M${X2} ${YB} V158 M${X2} 170 V${BOT} M${X2} ${YB} H${XC}`" class="wire" />
  <path :d="`M${X2 - 9} 158 H${X2 + 9} M${X2 - 16} 170 H${X2 + 16}`" class="battery" />
  <text :x="X2 + 22" y="166" class="lbl">U<tspan class="sb" dy="4">R</tspan></text>
  <text :x="X2 + 22" y="182" class="sub">{{ V1(UR) }}</text>
  <text :x="X2 - 12" y="184" class="sub" text-anchor="end">+</text>
  <text :x="X1" y="238" class="sub" text-anchor="middle">{{ tx(U.src1) }}</text>
  <text :x="X2 + 26" y="238" class="sub" text-anchor="middle">{{ tx(U.srcR) }}</text>

  <!-- 单刀双掷开关 S：两个触点、刀片 -->
  <circle :cx="XC" :cy="YA" r="3.2" class="node" :class="{ on: toU1 }" />
  <circle :cx="XC" :cy="YB" r="3.2" class="node" :class="{ on: !toU1 }" />
  <text :x="XC - 6" :y="YA - 8" class="tag" text-anchor="end">+U₁</text>
  <text :x="XC - 6" :y="YB + 18" class="tag" text-anchor="end">−U<tspan class="sb" dy="3">R</tspan></text>
  <circle :cx="XP" :cy="YP" r="3.2" class="node on" />
  <path :d="`M${XP} ${YP} L${XC + 4} ${toU1 ? YA + 2 : YB - 2}`" class="switch" />
  <text :x="XP - 6" :y="YP + 22" class="lbl" text-anchor="middle">S</text>

  <!-- 限流电阻 R -->
  <path :d="`M${XP} ${YP} H250 M310 ${YP} H330 M374 ${YP} H${XD} V124 M${XD} 150 V${BOT}`" class="wire" />
  <!-- 回路电感 L（导线等） -->
  <path :d="`M330 ${YP} a5.5 5.5 0 0 1 11 0 a5.5 5.5 0 0 1 11 0 a5.5 5.5 0 0 1 11 0 a5.5 5.5 0 0 1 11 0`" class="part-line" />
  <text x="352" :y="YP - 12" class="lbl" text-anchor="middle">L</text>
  <text x="352" :y="YP + 20" class="sub" text-anchor="middle">{{ L }}</text>
  <text x="352" :y="YP - 30" class="sub" text-anchor="middle">{{ tx(U.loop) }}</text>
  <path :d="`M250 ${YP} l4.3 -6 l8.6 12 l8.6 -12 l8.6 12 l8.6 -12 l8.6 12 l8.6 -12 l4.3 6`" class="part-line" />
  <text x="280" :y="YP + 24" class="lbl" text-anchor="middle">R</text>
  <text x="280" :y="YP + 38" class="sub" text-anchor="middle">{{ R }}</text>

  <!-- 二极管 D（阳极在上） -->
  <path :d="`M${XD - 15} 124 H${XD + 15} L${XD} 150 Z`" class="diode" :class="{ rev: i < 0 }" />
  <path :d="`M${XD - 15} 150 H${XD + 15}`" class="part-line" />
  <text :x="XD - 22" y="134" class="lbl" text-anchor="end">D</text>
  <text :x="XD - 22" y="152" class="val" text-anchor="end" :class="u >= 0 ? 'fwd' : 'rev'">{{ signedV(u) }}</text>

  <!-- 回路电流：粗细 ∝ 电流大小，反向电流换色 -->
  <g v-if="arrow" class="arrow" :class="{ rev: !arrow.fwd }">
    <template v-for="(a, k) in arrows" :key="k">
      <path :d="a.line" :stroke-width="arrow.width" />
      <path :d="a.head" />
    </template>
    <text :x="XD + 26" y="186" text-anchor="middle" class="amp">{{ arrow.text }}</text>
  </g>
</svg>
</template>

<style scoped>
.plot {
  width: 100%;
  height: auto;
  display: block;
}
.wire {
  fill: none;
  stroke: var(--ink-soft);
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.part-line {
  fill: none;
  stroke: var(--ink);
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.diode {
  fill: color-mix(in srgb, var(--accent) 35%, var(--surface));
  stroke: var(--ink);
  stroke-width: 2;
  stroke-linejoin: round;
  transition: fill 0.2s;
}
.diode.rev { fill: color-mix(in srgb, var(--hole) 45%, var(--surface)); }
.node { fill: var(--surface); stroke: var(--ink); stroke-width: 1.8; }
.node.on { fill: var(--ink); }
.switch {
  stroke: var(--accent);
  stroke-width: 3.4;
  stroke-linecap: round;
  transition: d 0.15s;
}
.battery {
  stroke: var(--ink);
  stroke-width: 2.6;
  stroke-linecap: round;
}
.lbl {
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 700;
  fill: var(--ink);
}
.sb { font-size: 0.75em; }
.tag {
  font-size: 11.5px;
  font-weight: 700;
  fill: var(--ink-soft);
}
.sub {
  font-size: 11px;
  fill: var(--ink-soft);
}
.val {
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.val.fwd { fill: var(--accent); }
.val.rev { fill: var(--hole); }
.arrow path {
  fill: var(--accent);
  stroke: var(--accent);
  stroke-linecap: round;
}
.arrow.rev path {
  fill: var(--hole);
  stroke: var(--hole);
}
.arrow path:nth-child(odd) { fill: none; }
.amp {
  font-size: 11px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  fill: var(--ink);
}
</style>
