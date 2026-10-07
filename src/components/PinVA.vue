<script setup lang="ts">
// 示例 PiN 的 V-A 曲线（1.1）：原点居中，正向段在第一象限（V、A），反向段在第三象限（kV、µA），
// 两半用各自的比例（坐标轴上画断口）；正向段对比"没有电导调制、只算欧姆电阻"的直线。按步骤逐段解锁
import { computed, ref, watch } from 'vue'
import Bi from './Bi.vue'
import { tx } from '../app/settings'
import { BV_PIN, R_OHMIC, UJ_OHMIC, forwardU, ohmicU, reverseI } from '../engine/physics/pin'
import { UI } from '../devices/power-diode/sections/ui'
import type { PinState, Step } from '../devices/power-diode/sections/types'

const props = defineProps<{ step: Step; s: PinState }>()
const U = UI.va
const va = computed(() => props.step.va ?? {})

const W = 640
const H = 320
/** 原点位置与四边留白 */
const O = { x: 270, y: 196 }
const m = { l: 34, r: 18, t: 24, b: 24 }
const REV = { umin: -1500, imax: 1.6 }
const I_MAX = 90

/** 正向横轴：0–45 V 能看到欧姆直线到 30 A；0–2 V 看清 PiN 的曲线 */
const wide = ref(true)
watch(() => props.step.id, () => (wide.value = true))
const uMax = computed(() => (wide.value ? 45 : 2))

const xF = (u: number) => O.x + (Math.min(u, uMax.value) / uMax.value) * (W - m.r - O.x)
const yF = (i: number) => O.y - (Math.min(i, I_MAX) / I_MAX) * (O.y - m.t)
const xR = (u: number) => O.x - (Math.max(u, REV.umin) / REV.umin) * (O.x - m.l)
const yR = (iuA: number) => O.y + (Math.min(iuA, REV.imax) / REV.imax) * (H - m.b - O.y)

const UJ0 = UJ_OHMIC
const R_OHM = R_OHMIC

const pinPts: [number, number][] = []
for (let e = -3; e <= Math.log10(I_MAX) + 1e-9; e += 0.05) pinPts.push([forwardU(10 ** e), 10 ** e])
const revPts: [number, number][] = []
for (let u = 0; u <= BV_PIN * 0.9999; u += BV_PIN / 300) revPts.push([-u, reverseI(u) * 1e6])

const path = (pts: [number, number][], X: (u: number) => number, Y: (i: number) => number) =>
  pts.map(([u, i], k) => `${k ? 'L' : 'M'}${X(u).toFixed(1)} ${Y(i).toFixed(1)}`).join(' ')

const pinPath = computed(() => path([[0, 0], ...pinPts.filter(([u]) => u <= uMax.value)], xF, yF))
const ohmPath = computed(() => {
  const iEnd = Math.min(I_MAX, (uMax.value - UJ0) / R_OHM)
  return `M${xF(0)} ${yF(0)} L${xF(UJ0)} ${yF(0)} L${xF(ohmicU(iEnd))} ${yF(iEnd)}`
})
const revPath = path(revPts.filter(([, i]) => i <= REV.imax), xR, yR)

const ticksF = computed(() => (wide.value ? [10, 20, 30, 40] : [0.5, 1, 1.5, 2]))
const ticksR = [-500, -1000, -1500]

/** 工作点：反偏时在反向段；正偏时落在 PiN 曲线上（1.1-5 假想没有空穴注入，落在欧姆直线上）；小结同时标出两个 */
interface Op { x: number; y: number; hidden: boolean; text: string }
const revOp = (): Op => {
  const i = reverseI(props.s.urev) * 1e6
  return { x: xR(-props.s.urev), y: yR(i), text: `U = −${props.s.urev.toFixed(0)} V，I ≈ −${i.toFixed(3)} µA`, hidden: i > REV.imax }
}
const fwdOp = (ohmic: boolean): Op => {
  const I = props.s.current
  const u = ohmic ? ohmicU(I) : forwardU(I)
  return { x: xF(u), y: yF(I), text: `I = ${I.toFixed(0)} A，U = ${u.toFixed(u > 10 ? 1 : 2)} V`, hidden: u > uMax.value }
}
const ops = computed<Op[]>(() => {
  switch (props.step.mode) {
    case 'reverse': return [revOp()]
    case 'ohmic': return [fwdOp(true)]
    case 'forward': return [fwdOp(false)]
    case 'result': return [revOp(), fwdOp(false)]
    default: return []
  }
})
const readout = computed(() => ops.value.map((o) => o.text).join('　　'))
</script>

<template>
  <section class="chart panel va">
    <h3 class="panel-title"><Bi :t="U.title" /></h3>
    <svg class="plot" :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="U.title.zh">
      <!-- 第一象限：正向 -->
      <g :class="{ locked: !va.ohmic && !va.fwd }">
        <g class="grid">
          <line v-for="u in ticksF" :key="'gf' + u" :x1="xF(u)" :x2="xF(u)" :y1="m.t" :y2="O.y" />
          <line v-for="i in [30, 60, 90]" :key="'gi' + i" :x1="O.x" :x2="W - m.r" :y1="yF(i)" :y2="yF(i)" />
        </g>
        <g class="ticks">
          <text v-for="u in ticksF" :key="'tf' + u" :x="xF(u)" :y="O.y + 15" text-anchor="middle">{{ u }}</text>
          <text v-for="i in [30, 60, 90]" :key="'ti' + i" :x="O.x - 6" :y="yF(i) + 4" text-anchor="end">{{ i }}</text>
          <text :x="W - m.r" :y="O.y - 8" text-anchor="end" class="axis-name">U / V</text>
          <text :x="O.x + 8" :y="m.t + 2" class="axis-name">I / A</text>
          <text :x="W - m.r" :y="m.t + 2" text-anchor="end" class="quad">{{ tx(U.fwd) }}</text>
        </g>
        <path v-if="va.ohmic" :d="ohmPath" class="curve ohmic" />
        <path v-if="va.fwd" :d="pinPath" class="curve" />
      </g>

      <!-- 第三象限：反向 -->
      <g :class="{ locked: !va.rev }">
        <g class="grid">
          <line v-for="u in ticksR" :key="'gr' + u" :x1="xR(u)" :x2="xR(u)" :y1="O.y" :y2="H - m.b" />
        </g>
        <g class="ticks">
          <text v-for="u in ticksR" :key="'tr' + u" :x="xR(u)" :y="O.y - 6" text-anchor="middle">{{ `−${-u}` }}</text>
          <text :x="O.x - 6" :y="yR(1) + 4" text-anchor="end">−1</text>
          <text :x="m.l" :y="O.y - 20" class="axis-name">U / V</text>
          <text :x="O.x + 8" :y="H - m.b + 2" class="axis-name">I / µA</text>
          <text :x="m.l" :y="H - m.b + 2" class="quad">{{ tx(U.rev) }}</text>
        </g>
        <template v-if="va.rev">
          <line :x1="xR(-BV_PIN)" :x2="xR(-BV_PIN)" :y1="O.y" :y2="H - m.b" class="bv" />
          <text :x="xR(-BV_PIN) + 4" :y="H - m.b - 26" class="tag danger">{{ tx(U.bv) }} {{ BV_PIN.toFixed(0) }} V</text>
          <path :d="revPath" class="curve" />
          <text :x="(m.l + O.x) / 2 + 20" :y="O.y + 18" text-anchor="middle" class="tag soft">{{ tx(U.leak) }}</text>
        </template>
      </g>

      <!-- 坐标轴（两半比例不同，过原点处画断口） -->
      <g class="axis">
        <line :x1="m.l" :x2="W - m.r" :y1="O.y" :y2="O.y" />
        <line :x1="O.x" :x2="O.x" :y1="m.t - 8" :y2="H - m.b" />
        <path :d="`M${O.x - 18} ${O.y - 6} l5 12 M${O.x - 12} ${O.y - 6} l5 12`" class="brk" />
        <path :d="`M${O.x - 6} ${O.y + 14} l12 -5 M${O.x - 6} ${O.y + 20} l12 -5`" class="brk" />
      </g>

      <template v-for="(o, k) in ops" :key="k">
        <g v-if="!o.hidden" class="op" :transform="`translate(${o.x} ${o.y})`">
          <circle r="11" class="halo" />
          <circle r="6.5" class="dot" />
        </g>
      </template>
    </svg>

    <ul class="keys">
      <li v-if="va.fwd"><i class="sw pin" /><Bi :t="U.pin" /></li>
      <li v-if="va.ohmic"><i class="sw ohmic" /><Bi :t="U.ohmic" /></li>
      <li v-if="va.rev"><Bi :t="U.scales" /></li>
    </ul>

    <div class="controls">
      <div v-if="va.ohmic || va.fwd" class="seg" role="group">
        <button :aria-pressed="wide" @click="wide = true"><Bi :t="U.wide" /></button>
        <button :aria-pressed="!wide" @click="wide = false"><Bi :t="U.zoom" /></button>
      </div>
      <span v-if="readout" class="readout">{{ readout }}</span>
    </div>
  </section>
</template>

<style scoped>
.locked {
  opacity: 0.3;
}
.axis line,
.brk {
  stroke: var(--ink);
  stroke-width: 1.6;
  fill: none;
}
.axis-name {
  font-weight: 700;
  fill: var(--ink);
  font-size: 12px;
}
.quad {
  font-size: 12px;
  font-weight: 700;
  fill: var(--ink-soft);
}
.curve {
  fill: none;
  stroke: var(--accent);
  stroke-width: 3;
  stroke-linejoin: round;
}
.curve.ohmic {
  stroke: var(--danger);
  stroke-width: 2.4;
  stroke-dasharray: 7 5;
}
.bv {
  stroke: var(--danger);
  stroke-width: 1.4;
  stroke-dasharray: 4 4;
}
.tag {
  font-size: 11px;
  fill: var(--ink);
}
.tag.danger {
  fill: var(--danger);
}
.tag.soft {
  fill: var(--ink-soft);
}
.sw.pin {
  border-color: var(--accent);
}
.sw.ohmic {
  border-color: var(--danger);
  border-top-style: dashed;
}
.controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
}
.readout {
  font-size: 0.85rem;
  color: var(--ink-soft);
  font-variant-numeric: tabular-nums;
}
</style>
