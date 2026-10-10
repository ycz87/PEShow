<script setup lang="ts">
// 1.3-3 几个反向电压的区别与联系：二极管两端电压 u(t)（反向为负，与 V-A 曲线一致），示意、不按比例。
// 左边是直流反压 U_R；右边是整流电路里的交流反压：正常的峰值 U_RWM、每个周期都会出现的尖峰 U_RRM、
// 偶尔一次的尖峰 U_RSM；最下面是器件本身的击穿电压 U_(BR)
import { tx } from '../app/settings'
import { UI_STATIC } from '../devices/power-diode/sections/uiStatic'

defineProps<{ active: string | null }>()
const U = UI_STATIC.rev.wave

const W = 640
const H = 250
const m = { l: 30, r: 16, t: 34, b: 14 }
const T_END = 100
const x = (t: number) => m.l + (t / T_END) * (W - m.l - m.r)
/** f：反压占击穿电压的比例（0 在零线，1 在击穿线） */
const y = (f: number) => m.t + f * (H - m.t - m.b - 18)

const LV = { UR: 0.52, URWM: 0.6, URRM: 0.75, URSM: 0.88, UBR: 1 }
type Key = keyof typeof LV
const LEVELS: { key: Key; name: string }[] = [
  { key: 'UR', name: 'U_R' },
  { key: 'URWM', name: 'U_RWM' },
  { key: 'URRM', name: 'U_RRM' },
  { key: 'URSM', name: 'U_RSM' },
  { key: 'UBR', name: 'U_(BR)' },
]

const HALF = 10 // 反向半周的宽度
const STARTS = [26, 42, 58, 74]
/** 交流部分：正向半周压降很小（画在零线上），反向半周是正弦，起头有一个每周期都有的尖峰；第三个半周顶上多一个偶尔的尖峰 */
function acPath() {
  let d = `M${x(24)} ${y(0)}`
  for (let t = 24; t <= 84; t += 0.1) {
    let f = 0
    for (const [n, t0] of STARTS.entries()) {
      if (t < t0 || t > t0 + HALF) continue
      const s = (t - t0) / HALF
      f = LV.URWM * Math.sin(Math.PI * s)
      const tc = t0 + 1.2
      const base = LV.URWM * Math.sin((Math.PI * 1.2) / HALF)
      f += (LV.URRM - base) * Math.exp(-(((t - tc) / 0.32) ** 2))
      if (n === 2) f += (LV.URSM - LV.URWM) * Math.exp(-(((t - (t0 + HALF / 2)) / 0.4) ** 2))
    }
    d += ` L${x(t).toFixed(1)} ${y(f).toFixed(1)}`
  }
  return d
}
const ac = acPath()
const dc = `M${x(2)} ${y(0)} L${x(3)} ${y(LV.UR)} L${x(17)} ${y(LV.UR)} L${x(18)} ${y(0)}`
</script>

<template>
  <svg class="plot rvol" :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="tx(UI_STATIC.rev.volTitle)">
    <text :x="x(10)" :y="m.t - 10" text-anchor="middle" class="cap">{{ tx(U.dc) }}</text>
    <text :x="x(54)" :y="m.t - 10" text-anchor="middle" class="cap">{{ tx(U.ac) }}</text>
    <text :x="x(STARTS[2] + HALF / 2) + 10" :y="y(LV.URSM) + 4" class="cap once">{{ tx(U.once) }}</text>
    <text :x="x(STARTS[0] + 1.2) + 4" :y="y(LV.URRM) + 16" class="cap spike">{{ tx(U.spike) }}</text>

    <rect :x="m.l" :y="y(1)" :width="W - m.l - m.r" :height="18" class="bdzone" />

    <g v-for="l in LEVELS" :key="l.key" class="lvl" :class="[l.key, { on: active === l.key }]">
      <line :x1="m.l" :x2="W - m.r" :y1="y(LV[l.key])" :y2="y(LV[l.key])" />
      <text :x="W - m.r" :y="y(LV[l.key]) - 4" text-anchor="end">{{ l.name }}</text>
    </g>

    <g class="axis">
      <line :x1="m.l" :x2="W - m.r" :y1="y(0)" :y2="y(0)" />
      <line :x1="m.l" :x2="m.l" :y1="m.t - 14" :y2="H - m.b" />
      <path :d="`M${x(20)} ${y(0) - 6} l4 12 M${x(21.5)} ${y(0) - 6} l4 12`" />
    </g>
    <g class="ticks">
      <text :x="m.l - 6" :y="y(0) + 4" text-anchor="end">0</text>
      <text :x="m.l + 6" :y="m.t - 16" class="axis-name">{{ tx(U.u) }}</text>
      <text :x="W - m.r" :y="y(0) - 6" text-anchor="end" class="axis-name">{{ tx(U.t) }}</text>
      <text :x="m.l - 6" :y="y(1) + 4" text-anchor="end">−</text>
    </g>

    <path :d="dc" class="wave" :class="{ on: active === 'UR' }" />
    <path :d="ac" class="wave" />
  </svg>
</template>

<style scoped>
.axis line, .axis path { stroke: var(--ink); stroke-width: 1.6; fill: none; }
.cap { font-size: 11.5px; font-weight: 700; fill: var(--ink-soft); }
.cap.once { fill: var(--heat-out); }
.cap.spike { fill: var(--potential); }
.wave { fill: none; stroke: var(--potential); stroke-width: 2.4; stroke-linejoin: round; }
.wave.on { stroke-width: 4; }
.bdzone { fill: color-mix(in srgb, var(--danger) 14%, transparent); }
.lvl line { stroke-width: 1.3; stroke-dasharray: 6 4; stroke: var(--ink-soft); }
.lvl text { font-size: 12px; font-weight: 700; fill: var(--ink-soft); }
.lvl.URRM line { stroke: var(--heat-out); }
.lvl.URRM text { fill: var(--heat-out); }
.lvl.UBR line { stroke: var(--danger); stroke-dasharray: none; }
.lvl.UBR text { fill: var(--danger); }
.lvl.on line { stroke-width: 3; stroke-dasharray: none; stroke: var(--accent); }
.lvl.on text { fill: var(--accent); font-size: 13.5px; }
</style>
