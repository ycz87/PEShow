<script setup lang="ts">
// 1.3-2 几个正向电流的区别与联系：左边是正常工作时每个周期都有的电流（示意：50 Hz 正弦半波，平均 30 A），
// 标出峰值、有效值、平均值；右边是偶尔一次的 10 ms 浪涌（I_FSM）。纵轴按比例画（0–230 A）
import { tx } from '../app/settings'
import { UI_STATIC } from '../devices/power-diode/sections/uiStatic'

defineProps<{ active: string | null }>()
const U = UI_STATIC.fwd.wave

const W = 640
const H = 230
const m = { l: 40, r: 16, t: 22, b: 24 }
const T_END = 100 // ms
const I_TOP = 230 // A
const x = (t: number) => m.l + (t / T_END) * (W - m.l - m.r)
const y = (i: number) => H - m.b - (i / I_TOP) * (H - m.t - m.b)

const I_AV = 30
const I_M = I_AV * Math.PI // 正弦半波：平均值 = I_m/π
const I_RMS = I_M / 2
const I_FSM = 210

/** 从 t0 开始、宽 10 ms、峰值 ip 的正弦半波 */
const half = (t0: number, ip: number) => {
  let d = ''
  for (let k = 0; k <= 30; k++) {
    const t = t0 + (10 * k) / 30
    d += ` L${x(t).toFixed(1)} ${y(ip * Math.sin((Math.PI * k) / 30)).toFixed(1)}`
  }
  return d
}
const normal = `M${x(0)} ${y(0)}${half(0, I_M)} L${x(20)} ${y(0)}${half(20, I_M)} L${x(58)} ${y(0)}`
const surge = `M${x(68)} ${y(0)} L${x(70)} ${y(0)}${half(70, I_FSM)} L${x(T_END)} ${y(0)}`
const LX = x(31)
</script>

<template>
  <svg class="plot fcur" :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="tx(UI_STATIC.fwd.curTitle)">
    <text :x="x(5)" :y="m.t - 8" class="cap">{{ tx(U.normal) }}</text>
    <text :x="x(75)" :y="m.t - 8" text-anchor="middle" class="cap">{{ tx(U.surge) }}</text>

    <g class="ticks">
      <text v-for="i in [0, 100, 200]" :key="i" :x="m.l - 6" :y="y(i) + 4" text-anchor="end">{{ i }}</text>
      <text :x="m.l + 4" :y="m.t + 6" class="axis-name">I / A</text>
      <text :x="W - m.r" :y="H - 6" text-anchor="end" class="axis-name">{{ tx(U.t) }}</text>
    </g>
    <g class="axis">
      <line :x1="m.l" :x2="W - m.r" :y1="y(0)" :y2="y(0)" />
      <line :x1="m.l" :x2="m.l" :y1="m.t" :y2="y(0)" />
      <!-- 时间轴断口：中间省略了很长的正常工作时间 -->
      <path :d="`M${x(61)} ${y(0) + 6} l5 -12 M${x(63)} ${y(0) + 6} l5 -12`" />
    </g>

    <path :d="normal" class="wave" />
    <path :d="surge" class="wave surge" :class="{ on: active === 'IFSM' }" />

    <g class="lvl pk">
      <line :x1="x(0)" :x2="x(58)" :y1="y(I_M)" :y2="y(I_M)" />
      <text :x="LX" :y="y(I_M) - 5">{{ tx(U.peak) }}</text>
    </g>
    <g class="lvl rms" :class="{ on: active === 'IRMS' }">
      <line :x1="x(0)" :x2="x(58)" :y1="y(I_RMS)" :y2="y(I_RMS)" />
      <text :x="LX" :y="y(I_RMS) - 5">{{ tx(U.rms) }}</text>
    </g>
    <g class="lvl avg" :class="{ on: active === 'IAV' }">
      <line :x1="x(0)" :x2="x(58)" :y1="y(I_AV)" :y2="y(I_AV)" />
      <text :x="LX" :y="y(I_AV) + 14">{{ tx(U.avg) }}</text>
    </g>
    <text :x="x(75)" :y="y(I_FSM) - 6" text-anchor="middle" class="fsm" :class="{ on: active === 'IFSM' }">{{ tx(U.fsm) }}</text>
  </svg>
</template>

<style scoped>
.axis line, .axis path { stroke: var(--ink); stroke-width: 1.6; fill: none; }
.cap { font-size: 11.5px; font-weight: 700; fill: var(--ink-soft); }
.wave { fill: color-mix(in srgb, var(--accent) 16%, transparent); stroke: var(--accent); stroke-width: 2.4; stroke-linejoin: round; }
.wave.surge { fill: color-mix(in srgb, var(--heat-out) 16%, transparent); stroke: var(--heat-out); }
.wave.surge.on { stroke-width: 4; fill: color-mix(in srgb, var(--heat-out) 32%, transparent); }
.lvl line { stroke-width: 1.6; stroke-dasharray: 6 4; }
.lvl text { font-size: 11.5px; font-weight: 700; }
.lvl.on line { stroke-width: 3.2; stroke-dasharray: none; }
.lvl.pk line { stroke: var(--ink-soft); }
.lvl.pk text { fill: var(--ink-soft); }
.lvl.rms line { stroke: var(--danger); }
.lvl.rms text { fill: var(--danger); }
.lvl.avg line { stroke: var(--potential); }
.lvl.avg text { fill: var(--potential); }
.fsm { font-size: 12px; font-weight: 700; fill: var(--heat-out); }
.fsm.on { font-size: 13.5px; }
</style>
