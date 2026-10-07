<script setup lang="ts">
// PiN 舞台下方的分布图：横轴与上面的器件逐点对齐（同一个 devX0、devW）。
// 电场图（view = 'field'，零偏 / 反偏）：N⁻ 区的电场三角形，面积就是电压；虚线是临界场强 E_C
// 浓度图（view = 'conc'，对数）
//  - 正偏：曲线为模型稳态，圆点为舞台上粒子的统计；虚线是施主 N_D
//  - 只算欧姆电阻（假想）：没有空穴注入，导电的只有 N_D 个电子
import { computed } from 'vue'
import { tx } from '../app/settings'
import { PIN, builtIn, criticalField, fieldAt, forward, reverseField } from '../engine/physics/pin'
import { PIN_SIM, type PinSimMode } from '../engine/physics/pinSim'
import { sci, sup } from '../engine/render/pin/common'
import { UI } from '../devices/power-diode/sections/ui'

const props = defineProps<{
  view: 'field' | 'conc'
  mode: PinSimMode
  urev: number
  current: number
  /** 与画布共用的器件位置（像素） */
  x0: number
  w: number
  width: number
  /** 舞台粒子统计的 p/N_D（N⁻ 区等分），没有时为空 */
  dots: number[]
}>()

const C = UI.chart
const H = 140
const TOP = 30
const BOT = 22
const { XA, XK } = PIN_SIM
/** N⁻ 区内的位置 ξ ∈ [0,1] → 像素 */
const X = (xi: number) => props.x0 + (XA + xi * (XK - XA)) * props.w
const xA = computed(() => X(0))
const xK = computed(() => X(1))
const N = 120

// ───────────── 电场 ─────────────
const EC = criticalField()
const yE = (E: number) => H - BOT - (E / (EC * 1.12)) * (H - TOP - BOT)
const field = computed(() => {
  if (props.view !== 'field') return null
  const urev = props.mode === 'reverse' ? props.urev : 0
  const U = urev + builtIn()
  const f = reverseField(U)
  let d = `M${xA.value.toFixed(1)} ${yE(0)}`
  for (let k = 0; k <= N; k++) d += ` L${X(k / N).toFixed(1)} ${yE(fieldAt((k / N) * PIN.W, U)).toFixed(1)}`
  const tipX = X(Math.min(1, f.w / PIN.W))
  return { line: d, area: `${d} L${xK.value} ${yE(0)} Z`, E1: f.E1, peakY: yE(f.E1), tipX, U: urev }
})

// ───────────── 浓度（对数） ─────────────
const LOG = [13, 18]
const yC = (c: number) => H - BOT - ((Math.log10(Math.max(c, 10 ** LOG[0])) - LOG[0]) / (LOG[1] - LOG[0])) * (H - TOP - BOT)
const decades = Array.from({ length: LOG[1] - LOG[0] + 1 }, (_, i) => LOG[0] + i)
const conc = computed(() => {
  if (props.view !== 'conc') return null
  if (props.mode !== 'forward') return { line: '', dots: [] }
  const st = forward(Math.max(0.01, props.current) / PIN.A, { n: N + 1 })
  let d = ''
  for (let k = 0; k <= N; k++) d += `${k ? ' L' : 'M'}${X(k / N).toFixed(1)} ${yC(st.p[k]).toFixed(1)}`
  const n = props.dots.length
  const dots = props.dots.map((v, k) => ({ x: X((k + 0.5) / n), y: yC(v * PIN.ND) }))
  return { line: d, dots }
})
const ndY = yC(PIN.ND)
const ndText = `N_D = ${sci(PIN.ND, 1)}`
</script>

<template>
  <svg class="profile" :viewBox="`0 0 ${width} ${H}`" :height="H" role="img" :aria-label="tx(field ? C.fieldAxis : C.concAxis)">
    <!-- N 区的两端 -->
    <g class="bounds">
      <line :x1="xA" :x2="xA" :y1="TOP - 6" :y2="H - BOT" />
      <line :x1="xK" :x2="xK" :y1="TOP - 6" :y2="H - BOT" />
      <line :x1="x0" :x2="x0 + w" :y1="H - BOT" :y2="H - BOT" class="base" />
    </g>

    <template v-if="field">
      <line class="ec" :x1="xA" :x2="xK" :y1="yE(EC)" :y2="yE(EC)" />
      <text class="ec-t" :x="xK - 4" :y="yE(EC) - 5" text-anchor="end">{{ tx(C.critical) }} E_C ≈ {{ sci(EC, 1) }} V/cm</text>
      <path class="e-area" :d="field.area" />
      <path class="e-line" :d="field.line" />
      <text v-if="field.U > 0" class="area-t" :x="(xA + field.tipX) / 2" :y="Math.max(field.peakY + 16, (field.peakY + H - BOT) / 2 + 5)" text-anchor="middle">
        {{ tx(C.areaIsU) }} ≈ {{ field.U.toFixed(0) }} V
      </text>
      <text class="peak-t" :x="xA + 6" :y="Math.max(TOP + 10, field.peakY - 5)">E_max = {{ sci(field.E1, 2) }} V/cm</text>
      <text class="axis" :x="x0" :y="TOP - 6">{{ tx(C.fieldAxis) }}</text>
    </template>

    <template v-else-if="conc">
      <g class="ticks">
        <template v-for="e in decades" :key="e">
          <line :x1="xA" :x2="xK" :y1="yC(10 ** e)" :y2="yC(10 ** e)" class="grid" />
          <text :x="xA - 5" :y="yC(10 ** e) + 4" text-anchor="end">10{{ sup(e) }}</text>
        </template>
      </g>
      <line class="nd" :x1="xA" :x2="xK" :y1="ndY" :y2="ndY" />
      <text class="nd-t" :x="xK - 4" :y="ndY + 13" text-anchor="end">{{ ndText }}</text>
      <path class="c-line" :d="conc.line" />
      <circle v-for="(d, k) in conc.dots" :key="k" class="c-dot" :cx="d.x" :cy="d.y" r="3.6" />
      <text class="axis" :x="x0" :y="TOP - 6">{{ tx(C.concAxis) }}</text>
      <text v-if="mode === 'forward'" class="key" :x="xK" :y="TOP - 6" text-anchor="end">{{ tx(C.keys) }}</text>
      <text v-else class="ohm-t" :x="(xA + xK) / 2" :y="ndY - 10" text-anchor="middle">{{ tx(C.ohmic) }}</text>
    </template>
  </svg>
</template>

<style scoped>
.profile {
  display: block;
  width: 100%;
  overflow: visible;
  font-size: 11px;
}
.profile text { fill: var(--ink-soft); }
.bounds line {
  stroke: var(--ink);
  stroke-opacity: 0.3;
  stroke-dasharray: 3 4;
}
.bounds .base { stroke-dasharray: none; stroke-opacity: 0.35; }
.grid { stroke: var(--ink); stroke-opacity: 0.07; }
.ticks text { font-size: 10px; }
.axis { font-weight: 700; fill: var(--ink) !important; }
.ec { stroke: var(--danger); stroke-width: 1.5; stroke-dasharray: 6 4; }
.ec-t { fill: var(--danger) !important; font-weight: 700; }
.e-area { fill: var(--field); fill-opacity: 0.22; }
.e-line { fill: none; stroke: var(--field); stroke-width: 2.5; stroke-linejoin: round; }
.area-t { fill: var(--field) !important; font-weight: 700; font-size: 12px; }
.peak-t { fill: var(--ink) !important; font-weight: 700; }
.nd { stroke: var(--n-region); stroke-width: 1.5; stroke-dasharray: 5 4; }
.nd-t { fill: var(--n-region) !important; font-weight: 700; }
.c-line { fill: none; stroke: var(--hole); stroke-width: 2.5; }
.c-dot { fill: var(--electron); fill-opacity: 0.85; stroke: var(--surface); stroke-width: 1; }
.ohm-t { fill: var(--ink) !important; font-weight: 700; }
.key { font-size: 10.5px; }
</style>
