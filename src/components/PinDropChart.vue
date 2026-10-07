<script setup lang="ts">
// 1.1-5、1.1-6 的小图：N⁻ 区压降随正向电流的变化。
//  - 红色虚线：没有空穴注入（只靠 N⁻ 自己的电子，单极型）：压降与电流成正比，到约 62 A 电子跑到饱和速度，电流再也上不去
//  - 蓝色实线：有空穴注入（电导调制）：电流越大，注入的载流子越多，N⁻ 区的电阻越小，压降几乎不变
// 工作点跟着舞台上的电流滑块走；1.1-5 只画红线（先提出问题），1.1-6 红蓝两条一起画
import { computed } from 'vue'
import Bi from './Bi.vue'
import { tx } from '../app/settings'
import { I_SAT_OHMIC, PIN, forward, ohmicDrop } from '../engine/physics/pin'
import { UI } from '../devices/power-diode/sections/ui'
import type { PinState, Step } from '../devices/power-diode/sections/types'

const props = defineProps<{ step: Step; s: PinState }>()
const U = UI.drop

const W = 640
const H = 300
const m = { l: 52, r: 24, t: 30, b: 40 }
const I_MAX = 90
const U_MAX = 90
const x = (i: number) => m.l + (i / I_MAX) * (W - m.l - m.r)
const y = (u: number) => H - m.b - (Math.min(u, U_MAX) / U_MAX) * (H - m.t - m.b)

/** 没有注入：低场迁移率的直线，画到电流上限 */
const noInject = (I: number) => ohmicDrop(I / PIN.A)
/** 有注入：模型的 N⁻ 区压降 */
const inject = (I: number) => forward(I / PIN.A, { n: 61 }).UM

const path = (f: (i: number) => number, i0: number, i1: number, step: number) => {
  let d = ''
  for (let i = i0; i <= i1 + 1e-9; i += step) d += `${d ? ' L' : 'M'}${x(i).toFixed(1)} ${y(f(i)).toFixed(1)}`
  return d
}
const redPath = path(noInject, 0, I_SAT_OHMIC, 2)
const bluePath = path(inject, 1, I_MAX, 2)

const showBlue = computed(() => props.step.mode !== 'ohmic')
const I = computed(() => props.s.current)
const red = computed(() => (I.value <= I_SAT_OHMIC ? { x: x(I.value), y: y(noInject(I.value)), u: noInject(I.value) } : null))
const blue = computed(() => ({ x: x(I.value), y: y(inject(I.value)), u: inject(I.value) }))
const fmt = (u: number) => (u < 10 ? u.toFixed(2) : u.toFixed(1))
const readout = computed(() => {
  const r = red.value ? `${tx(U.none)} ${fmt(red.value.u)} V` : `${tx(U.none)} ${tx(U.beyond)}`
  return showBlue.value ? `I = ${I.value.toFixed(0)} A：${r} → ${tx(U.with)} ${fmt(blue.value.u)} V` : `I = ${I.value.toFixed(0)} A：${r}`
})
</script>

<template>
  <section class="chart panel">
    <h3 class="panel-title"><Bi :t="U.title" /></h3>
    <svg class="plot" :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="U.title.zh">
      <g class="grid">
        <line v-for="u in [30, 60, 90]" :key="'gu' + u" :x1="m.l" :x2="W - m.r" :y1="y(u)" :y2="y(u)" />
        <line v-for="i in [30, 60, 90]" :key="'gi' + i" :x1="x(i)" :x2="x(i)" :y1="m.t" :y2="H - m.b" />
      </g>
      <g class="ticks">
        <text v-for="u in [0, 30, 60, 90]" :key="'tu' + u" :x="m.l - 6" :y="y(u) + 4" text-anchor="end">{{ u }}</text>
        <text v-for="i in [0, 30, 60, 90]" :key="'ti' + i" :x="x(i)" :y="H - m.b + 16" text-anchor="middle">{{ i }}</text>
        <text :x="m.l" :y="m.t - 12" class="axis-name">{{ tx(U.yAxis) }}</text>
        <text :x="W - m.r" :y="H - 6" text-anchor="end" class="axis-name">{{ tx(U.xAxis) }}</text>
      </g>
      <g class="axis">
        <line :x1="m.l" :x2="W - m.r" :y1="H - m.b" :y2="H - m.b" />
        <line :x1="m.l" :x2="m.l" :y1="m.t - 4" :y2="H - m.b" />
      </g>

      <path :d="redPath" class="curve none" />
      <!-- 电流上限：电子跑到饱和速度 -->
      <line :x1="x(I_SAT_OHMIC)" :x2="x(I_SAT_OHMIC)" :y1="m.t" :y2="H - m.b" class="sat" />
      <text :x="x(I_SAT_OHMIC) + 6" :y="m.t + 12" class="tag danger">{{ tx(U.sat) }} {{ I_SAT_OHMIC.toFixed(0) }} A</text>
      <path v-if="showBlue" :d="bluePath" class="curve with" />
      <text v-if="showBlue" :x="x(62)" :y="y(inject(62)) - 12" class="tag acc">{{ tx(U.flat) }}</text>

      <g v-if="red" class="op none" :transform="`translate(${red.x} ${red.y})`">
        <circle r="11" class="halo" />
        <circle r="6.5" class="dot" />
      </g>
      <g v-if="showBlue" class="op" :transform="`translate(${blue.x} ${blue.y})`">
        <circle r="11" class="halo" />
        <circle r="6.5" class="dot" />
      </g>
    </svg>

    <ul class="keys">
      <li><i class="sw none" /><Bi :t="U.none" />：<Bi :t="U.noneWhy" /></li>
      <li v-if="showBlue"><i class="sw with" /><Bi :t="U.with" />：<Bi :t="U.withWhy" /></li>
    </ul>
    <div class="controls"><span class="readout">{{ readout }}</span></div>
  </section>
</template>

<style scoped>
.axis line {
  stroke: var(--ink);
  stroke-width: 1.6;
}
.axis-name {
  font-weight: 700;
  fill: var(--ink);
  font-size: 12px;
}
.curve {
  fill: none;
  stroke-width: 3;
  stroke-linejoin: round;
}
.curve.none {
  stroke: var(--danger);
  stroke-width: 2.4;
  stroke-dasharray: 7 5;
}
.curve.with { stroke: var(--accent); }
.sat {
  stroke: var(--danger);
  stroke-width: 1.4;
  stroke-dasharray: 4 4;
  opacity: 0.7;
}
.tag { font-size: 11px; font-weight: 700; }
.tag.danger { fill: var(--danger); }
.tag.acc { fill: var(--accent); }
.op.none .halo,
.op.none .dot { fill: var(--danger); }
.sw.none {
  border-color: var(--danger);
  border-top-style: dashed;
}
.sw.with { border-color: var(--accent); }
</style>
