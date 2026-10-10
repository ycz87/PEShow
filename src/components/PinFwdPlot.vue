<script setup lang="ts">
// 1.3 的正向特性图：端电压（芯片 + 串联电阻）随电流的曲线，横轴 0–2.6 V、纵轴 0–90 A。
// 可选：25 °C 虚线对照、过两点的直线近似（U_TO 截距 + 斜率 r_T）、工作点、与 25 °C 曲线的温度交点
import { computed } from 'vue'
import { fillBi, tx } from '../app/settings'
import { crossover, lineFit, terminalU, T_REF_PIN } from '../engine/physics/pin'
import { FWD, fwdCurve, toPath } from '../devices/power-diode/staticCurves'
import { UI_STATIC as U } from '../devices/power-diode/sections/uiStatic'

const props = withDefaults(
  defineProps<{
    t?: number
    ref25?: boolean
    fit?: { i1: number; i2: number } | null
    op?: number | null
    cross?: boolean
    hl?: string | null
  }>(),
  { t: T_REF_PIN, ref25: false, fit: null, op: null, cross: false, hl: null },
)

const W = 520
const H = 330
const m = { l: 46, r: 14, t: 18, b: 40 }
const x = (u: number) => m.l + (Math.min(u, FWD.uMax) / FWD.uMax) * (W - m.l - m.r)
const y = (i: number) => H - m.b - (Math.min(i, FWD.iMax) / FWD.iMax) * (H - m.t - m.b)
const TX = [0, 0.5, 1, 1.5, 2, 2.5]
const TY = [0, 30, 60, 90]
const RATED = 30

const main = computed(() => toPath(fwdCurve(props.t), x, y))
const ref25 = computed(() => (props.ref25 && props.t !== T_REF_PIN ? toPath(fwdCurve(T_REF_PIN), x, y) : null))

/** 直线近似：从横轴截距 U_TO 画到图的上边或右边 */
const line = computed(() => {
  if (!props.fit) return null
  const { i1, i2 } = props.fit
  const f = lineFit(i1, i2, props.t)
  const iEnd = Math.min(FWD.iMax, (FWD.uMax - f.UTO) / f.rT)
  return {
    ...f,
    d: `M${x(f.UTO)} ${y(0)} L${x(f.UTO + f.rT * iEnd)} ${y(iEnd)}`,
    p1: { x: x(terminalU(i1, props.t)), y: y(i1) },
    p2: { x: x(terminalU(i2, props.t)), y: y(i2) },
    band: { y: y(i2), h: y(i1) - y(i2) },
  }
})

const opPt = computed(() => (props.op ? { x: x(terminalU(props.op, props.t)), y: y(props.op) } : null))

const cross = computed(() => {
  if (!props.cross) return null
  const I = crossover(props.t)
  return I ? { x: x(terminalU(I, props.t)), y: y(I), text: tx(fillBi(U.plot.cross, { i: I.toFixed(0) })) } : null
})
</script>

<template>
  <svg class="plot" :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="tx(U.axis.uf)">
    <g class="grid">
      <line v-for="u in TX" :key="'gx' + u" :x1="x(u)" :x2="x(u)" :y1="m.t" :y2="H - m.b" />
      <line v-for="i in TY" :key="'gy' + i" :x1="m.l" :x2="W - m.r" :y1="y(i)" :y2="y(i)" />
    </g>
    <g class="ticks">
      <text v-for="u in TX" :key="'tx' + u" :x="x(u)" :y="H - m.b + 15" text-anchor="middle">{{ u }}</text>
      <text v-for="i in TY" :key="'ty' + i" :x="m.l - 6" :y="y(i) + 4" text-anchor="end">{{ i }}</text>
      <text :x="W - m.r" :y="H - 6" text-anchor="end" class="axis-name">{{ tx(U.axis.uf) }}</text>
      <text :x="m.l + 6" :y="m.t + 4" class="axis-name">{{ tx(U.axis.if) }}</text>
    </g>

    <g class="rated" :class="{ hl: hl === 'IAV' }">
      <line :x1="m.l" :x2="W - m.r" :y1="y(RATED)" :y2="y(RATED)" />
      <text :x="m.l + 6" :y="y(RATED) - 5">{{ tx(U.plot.rated) }}</text>
    </g>

    <g v-if="line" class="fit" :class="{ hl: hl === 'line' }">
      <rect :x="m.l" :y="line.band.y" :width="W - m.l - m.r" :height="line.band.h" class="band" />
      <path :d="line.d" class="fit-line" />
      <circle :cx="line.p1.x" :cy="line.p1.y" r="4.5" class="fit-pt" />
      <circle :cx="line.p2.x" :cy="line.p2.y" r="4.5" class="fit-pt" />
      <path :d="`M${x(line.UTO)} ${y(0) - 7} V${y(0) + 4}`" class="uto-tick" />
      <text :x="x(line.UTO)" :y="y(0) - 10" text-anchor="middle" class="uto">{{ tx(U.plot.uto) }}</text>
    </g>

    <g class="axis">
      <line :x1="m.l" :x2="W - m.r" :y1="H - m.b" :y2="H - m.b" />
      <line :x1="m.l" :x2="m.l" :y1="m.t - 4" :y2="H - m.b" />
    </g>

    <path v-if="ref25" :d="ref25" class="curve ref" />
    <path :d="main" class="curve" />

    <g v-if="opPt" class="guide" :class="{ hl: hl === 'UF' }">
      <path :d="`M${opPt.x} ${opPt.y} V${H - m.b} M${opPt.x} ${opPt.y} H${m.l}`" />
    </g>
    <g v-if="opPt" class="op" :class="{ pulse: hl === 'UF' }" :transform="`translate(${opPt.x} ${opPt.y})`">
      <circle r="11" class="halo" />
      <circle r="6.5" class="dot" />
    </g>

    <g v-if="cross" class="cross" :transform="`translate(${cross.x} ${cross.y})`">
      <circle r="9" />
      <text x="-12" y="-12" text-anchor="end">{{ cross.text }}</text>
    </g>
  </svg>
</template>

<style scoped>
.axis line { stroke: var(--ink); stroke-width: 1.6; }
.curve { fill: none; stroke: var(--accent); stroke-width: 3; stroke-linejoin: round; }
.curve.ref { stroke: var(--ink-soft); stroke-width: 2; stroke-dasharray: 6 5; }
.rated line { stroke: var(--ink-soft); stroke-width: 1.2; stroke-dasharray: 3 4; }
.rated text { font-size: 11px; fill: var(--ink-soft); }
.rated.hl line { stroke: var(--danger); stroke-width: 2.4; stroke-dasharray: none; }
.rated.hl text { fill: var(--danger); font-weight: 700; }
.fit .band { fill: color-mix(in srgb, var(--potential) 10%, transparent); }
.fit-line { fill: none; stroke: var(--potential); stroke-width: 2.2; stroke-dasharray: 8 4; }
.fit-pt { fill: var(--potential); stroke: var(--line); stroke-width: 1.5; }
.uto-tick { stroke: var(--potential); stroke-width: 2.4; }
.uto { font-size: 12px; font-weight: 700; fill: var(--potential); }
.fit.hl .fit-line { stroke-width: 3.4; stroke-dasharray: none; }
.fit.hl .band { fill: color-mix(in srgb, var(--potential) 20%, transparent); }
.guide path { fill: none; stroke: var(--accent); stroke-width: 1.2; stroke-dasharray: 3 3; opacity: 0.6; }
.guide.hl path { stroke-width: 2; opacity: 1; }
.op.pulse .halo { animation: pulse 1.2s ease-in-out infinite; transform-origin: center; }
@keyframes pulse { 50% { transform: scale(1.6); opacity: 0.1; } }
.cross circle { fill: none; stroke: var(--danger); stroke-width: 2.4; }
.cross text { font-size: 12px; font-weight: 700; fill: var(--danger); }
</style>
