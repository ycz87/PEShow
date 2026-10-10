<script setup lang="ts">
// 1.3 的反向特性图，与完整的 V-A 曲线一致画在第三象限：横轴 −1500…0 V（0 在右边），
// 纵轴是反向电流的大小（对数，10⁻³…10⁴ µA，越往下越大）。标出 U_RRM、击穿电压、两者之间的裕量与击穿区；
// 可选 25 °C 虚线对照与工作点。hl 高亮参数表里选中的那一项（URRM / UBR / IR）
import { computed } from 'vue'
import { fillBi, tx } from '../app/settings'
import { BV_PIN, matAt, reverseI, T_REF_PIN } from '../engine/physics/pin'
import { BV_SHOWN, REV, logTicks, pow10Label, revCurve, toPath } from '../devices/power-diode/staticCurves'
import { UI_STATIC as U } from '../devices/power-diode/sections/uiStatic'

const props = withDefaults(defineProps<{ t?: number; ref25?: boolean; op?: number | null; hl?: string | null }>(), {
  t: T_REF_PIN,
  ref25: false,
  op: null,
  hl: null,
})

const W = 520
const H = 330
const m = { l: 14, r: 56, t: 34, b: 14 }
const L0 = Math.log10(REV.iMin)
const L1 = Math.log10(REV.iMax)
/** u：反向电压的大小（V，正值），画在原点左边 */
const x = (u: number) => W - m.r - (Math.min(u, REV.uMax) / REV.uMax) * (W - m.l - m.r)
/** 反向电流的大小（µA），越大越往下 */
const y = (iuA: number) => m.t + ((Math.min(Math.max(Math.log10(Math.max(iuA, 1e-30)), L0), L1) - L0) / (L1 - L0)) * (H - m.t - m.b)
const TX = [1500, 1200, 900, 600, 300]
const ticks = logTicks(REV.iMin, REV.iMax)
const URRM = 1200

/** 曲线只画到图的下边（击穿时电流趋于无穷） */
const clip = (pts: [number, number][]) => {
  const k = pts.findIndex(([, i]) => i >= REV.iMax)
  return k < 0 ? pts : pts.slice(0, k + 1)
}
const main = computed(() => toPath(clip(revCurve(props.t)), x, y))
const ref25 = computed(() => (props.ref25 && props.t !== T_REF_PIN ? toPath(clip(revCurve(T_REF_PIN)), x, y) : null))

const opPt = computed(() => {
  if (props.op === null) return null
  const i = reverseI(props.op, matAt(props.t)) * 1e6
  return i < REV.iMax ? { x: x(props.op), y: y(i) } : null
})
const bvText = tx(fillBi(U.plot.bv, { v: BV_SHOWN }))
</script>

<template>
  <svg class="plot" :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="tx(U.axis.ir)">
    <!-- 击穿区、裕量（击穿到 U_RRM）、阻断区 -->
    <rect :x="m.l" :y="m.t" :width="x(BV_PIN) - m.l" :height="H - m.t - m.b" class="zone bd" />
    <rect :x="x(BV_PIN)" :y="m.t" :width="x(URRM) - x(BV_PIN)" :height="H - m.t - m.b" class="zone margin" :class="{ hl: hl === 'URRM' }" />
    <g class="grid">
      <line v-for="u in TX" :key="'gx' + u" :x1="x(u)" :x2="x(u)" :y1="m.t" :y2="H - m.b" />
      <line v-for="k in ticks.majors" :key="'gy' + k" :x1="m.l" :x2="W - m.r" :y1="y(10 ** k)" :y2="y(10 ** k)" />
    </g>
    <g class="ticks">
      <text v-for="u in TX" :key="'tx' + u" :x="x(u)" :y="m.t - 6" text-anchor="middle">−{{ u }}</text>
      <text :x="W - m.r" :y="m.t - 6" text-anchor="middle">0</text>
      <text v-for="k in ticks.majors" :key="'ty' + k" :x="W - m.r + 6" :y="y(10 ** k) + 4">−{{ pow10Label(k) }}</text>
      <line v-for="v in ticks.minors" :key="'mn' + v" :x1="W - m.r - 4" :x2="W - m.r" :y1="y(v)" :y2="y(v)" class="minor" />
      <text :x="m.l" :y="m.t - 20" class="axis-name">{{ tx(U.axis.ur) }}</text>
      <text :x="W - m.r - 6" :y="H - m.b - 8" text-anchor="end" class="axis-name">{{ tx(U.axis.ir) }}</text>
    </g>

    <text :x="(x(URRM) + W - m.r) / 2" :y="m.t + 16" text-anchor="middle" class="zlab">{{ tx(U.plot.blockZone) }}</text>
    <text :x="(x(URRM) + x(BV_PIN)) / 2" :y="m.t + 16" text-anchor="middle" class="zlab warn">{{ tx(U.plot.margin) }}</text>
    <text :x="(m.l + x(BV_PIN)) / 2" :y="m.t + 16" text-anchor="middle" class="zlab danger">{{ tx(U.plot.bdZone) }}</text>

    <g class="mark rrm" :class="{ hl: hl === 'URRM' }">
      <line :x1="x(URRM)" :x2="x(URRM)" :y1="m.t" :y2="H - m.b" />
      <text :x="x(URRM) + 4" :y="H - m.b - 8">{{ tx(U.plot.urrm) }}</text>
    </g>
    <g class="mark bv" :class="{ hl: hl === 'UBR' }">
      <line :x1="x(BV_PIN)" :x2="x(BV_PIN)" :y1="m.t" :y2="H - m.b" />
      <text :x="x(BV_PIN) + 4" :y="H - m.b - 24">{{ bvText }}</text>
    </g>

    <g class="axis">
      <line :x1="m.l" :x2="W - m.r" :y1="m.t" :y2="m.t" />
      <line :x1="W - m.r" :x2="W - m.r" :y1="m.t" :y2="H - m.b" />
    </g>

    <path v-if="ref25" :d="ref25" class="curve ref" />
    <path :d="main" class="curve" :class="{ hl: hl === 'IR' }" />

    <g v-if="opPt" class="op" :transform="`translate(${opPt.x} ${opPt.y})`">
      <circle r="11" class="halo" />
      <circle r="6.5" class="dot" />
    </g>
  </svg>
</template>

<style scoped>
.axis line { stroke: var(--ink); stroke-width: 1.6; }
.minor { stroke: var(--ink); stroke-width: 1; opacity: 0.5; }
.curve { fill: none; stroke: var(--potential); stroke-width: 3; stroke-linejoin: round; }
.curve.hl { stroke-width: 5; }
.curve.ref { stroke: var(--ink-soft); stroke-width: 2; stroke-dasharray: 6 5; }
.zone.margin { fill: color-mix(in srgb, var(--heat-out) 12%, transparent); }
.zone.margin.hl { fill: color-mix(in srgb, var(--heat-out) 28%, transparent); }
.zone.bd { fill: color-mix(in srgb, var(--danger) 12%, transparent); }
.zlab { font-size: 11px; font-weight: 700; fill: var(--ink-soft); }
.zlab.warn { fill: var(--heat-out); }
.zlab.danger { fill: var(--danger); }
.mark line { stroke-width: 1.6; }
.mark text { font-size: 11.5px; font-weight: 700; }
.rrm line { stroke: var(--heat-out); }
.rrm text { fill: var(--heat-out); }
.rrm.hl line { stroke-width: 3.2; }
.bv line { stroke: var(--danger); stroke-dasharray: 5 4; }
.bv text { fill: var(--danger); }
.bv.hl line { stroke-width: 3.2; stroke-dasharray: none; }
.op .halo { fill: var(--potential); }
.op .dot { fill: var(--potential); }
</style>
