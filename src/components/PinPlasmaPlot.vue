<script setup lang="ts">
// 1.4 的 N⁻ 区载流子分布：模型算出的等离子体浓度 p(x)（= n − N_D），两端画出 P⁺、N⁺；
// 关断时阳极一侧的空间电荷区画成阴影（前沿 x_L）。线性纵轴，N_D 只有约 10¹⁴，贴近横轴
import { computed } from 'vue'
import { tx } from '../app/settings'
import { PIN } from '../engine/physics/pin'
import type { PinFrame } from '../engine/physics/pinTransient'
import { UI_DYN as U } from '../devices/power-diode/sections/uiDyn'

const props = defineProps<{ frame: PinFrame; x: Float32Array; pMax: number }>()

const W = 560
const H = 200
const m = { l: 74, r: 74, t: 22, b: 34 }
const pw = W - m.l - m.r
const ph = H - m.t - m.b
const X = (cm: number) => m.l + (cm / PIN.W) * pw
const Y = (p: number) => H - m.b - (Math.min(p, props.pMax) / props.pMax) * ph
const UNIT = 1e16
const yTicks = computed(() => {
  const top = props.pMax / UNIT
  const step = top > 4 ? 2 : 1
  const list: number[] = []
  for (let v = 0; v <= top + 1e-9; v += step) list.push(v)
  return list
})
const xTicks = [0, 30, 60, 90, 120]

const area = computed(() => {
  const { p } = props.frame
  let d = `M${X(0)} ${Y(0)}`
  for (let k = 0; k < p.length; k++) d += `L${X(props.x[k]).toFixed(1)} ${Y(p[k]).toFixed(1)}`
  return `${d}L${X(PIN.W)} ${Y(0)}Z`
})
const xL = computed(() => props.frame.xL)
</script>

<template>
  <svg class="plot" :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="tx(U.plasma)">
    <!-- P⁺、N⁺（只示意位置，浓度在图外） -->
    <rect :x="m.l - 34" :y="m.t" width="30" :height="ph" class="pp" rx="4" />
    <text :x="m.l - 19" :y="m.t + ph / 2 + 5" text-anchor="middle" class="reg">P⁺</text>
    <rect :x="m.l + pw + 4" :y="m.t" width="30" :height="ph" class="nn" rx="4" />
    <text :x="m.l + pw + 19" :y="m.t + ph / 2 + 5" text-anchor="middle" class="reg">N⁺</text>
    <text :x="m.l - 19" :y="m.t - 6" text-anchor="middle" class="sub2">A</text>
    <text :x="m.l + pw + 19" :y="m.t - 6" text-anchor="middle" class="sub2">K</text>

    <g class="grid">
      <line v-for="v in yTicks" :key="'gy' + v" :x1="m.l" :x2="m.l + pw" :y1="Y(v * UNIT)" :y2="Y(v * UNIT)" />
    </g>
    <rect v-if="xL > 0" :x="X(0)" :y="m.t" :width="X(xL) - X(0)" :height="ph" class="scr" />
    <text v-if="xL > 8e-4" :x="(X(0) + X(xL)) / 2" :y="m.t + 16" text-anchor="middle" class="scr-t">{{ tx(U.scr) }}</text>
    <path :d="area" class="plasma" />
    <line :x1="m.l" :x2="m.l + pw" :y1="Y(PIN.ND)" :y2="Y(PIN.ND)" class="nd" />
    <g class="axis">
      <line :x1="m.l" :x2="m.l + pw" :y1="H - m.b" :y2="H - m.b" />
      <line :x1="m.l" :x2="m.l" :y1="m.t" :y2="H - m.b" />
    </g>
    <g class="ticks">
      <text v-for="v in yTicks" :key="'ty' + v" :x="m.l - 40" :y="Y(v * UNIT) + 4" text-anchor="end" class="yt">{{ v }}</text>
      <text v-for="v in xTicks" :key="'tx' + v" :x="X(v * 1e-4)" :y="H - m.b + 14" text-anchor="middle">{{ v }}</text>
      <text :x="m.l + pw / 2" :y="H - 4" text-anchor="middle" class="axis-name">{{ tx(U.axisX) }}</text>
      <text :x="m.l + 6" :y="m.t - 8" class="axis-name">{{ tx(U.axisP) }}</text>
    </g>
  </svg>
</template>

<style scoped>
.pp { fill: color-mix(in srgb, var(--p-region) 45%, transparent); }
.nn { fill: color-mix(in srgb, var(--n-region) 45%, transparent); }
.reg { font-family: var(--font-display); font-weight: 700; font-size: 13px; fill: var(--ink); }
.sub2 { font-size: 11px; font-weight: 700; fill: var(--ink-soft); }
.axis line { stroke: var(--ink); stroke-width: 1.4; }
.plasma {
  fill: color-mix(in srgb, var(--hole) 38%, color-mix(in srgb, var(--electron) 38%, transparent));
  stroke: var(--accent);
  stroke-width: 2;
  stroke-linejoin: round;
}
.scr { fill: color-mix(in srgb, var(--field) 22%, transparent); }
.scr-t { font-size: 11px; font-weight: 700; fill: var(--field); }
.nd { stroke: var(--n-region); stroke-width: 1.4; stroke-dasharray: 4 3; }
.yt { font-size: 11px; }
</style>
