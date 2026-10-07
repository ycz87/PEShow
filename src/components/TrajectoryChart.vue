<script setup lang="ts">
// 开关轨迹（0.8 最后一步）：把关断过程的工作点 (u(t), i(t)) 画回线性的 V-A 平面，与静态 V-A 曲线对照。
// 横纵轴都是线性、单一比例（不做分段缩放），所以静态曲线的反向漏电流在图上贴着零线
import { computed } from 'vue'
import Bi from './Bi.vue'
import { tx } from '../app/settings'
import { minus } from '../app/format'
import { endTime, type SwitchLive } from '../app/switching'
import { sampleAt } from '../engine/physics/recovery'
import { totalI } from '../engine/physics/pn'
import { UI } from '../devices/pn-junction/sections/ui'

const props = defineProps<{ live: SwitchLive | null }>()
const U = UI.traj

const W = 440
const H = 300
const m = { l: 50, r: 18, t: 24, b: 34 }
const pw = W - m.l - m.r
const ph = H - m.t - m.b

const w = computed(() => props.live?.w ?? null)
const r = computed(() => w.value?.m ?? null)
/** 横轴 V，纵轴 mA */
const vR = computed(() => {
  let lo = 0
  for (const v of w.value?.v ?? []) lo = Math.min(lo, v)
  return { lo: Math.floor(lo * 1.1), hi: 1.2 }
})
const iR = computed(() => {
  const x = w.value
  if (!x) return { lo: -1, hi: 1 }
  return { lo: -(r.value?.IRP ?? 0) * 1e3 * 1.2, hi: x.p.IF * 1e3 * 1.3 }
})
const X = (v: number) => m.l + ((v - vR.value.lo) / (vR.value.hi - vR.value.lo)) * pw
const Y = (iA: number) => m.t + ((iR.value.hi - iA * 1e3) / (iR.value.hi - iR.value.lo)) * ph

const vTicks = computed(() => {
  const list: number[] = []
  for (let v = vR.value.lo; v <= 1 + 1e-9; v += 1) list.push(v)
  return list
})
const iTicks = computed(() => {
  const s = iR.value.hi - iR.value.lo > 30 ? 10 : 5
  const list: number[] = []
  for (let i = Math.ceil(iR.value.lo / s) * s; i <= iR.value.hi; i += s) list.push(i)
  return list
})

/** 静态 V-A 曲线（按像素采样，正向电流超出纵轴处截断） */
const staticPath = computed(() => {
  let d = ''
  for (let x = 0; x <= pw; x += 1) {
    const v = vR.value.lo + (x / pw) * (vR.value.hi - vR.value.lo)
    const i = totalI(v)
    if (i * 1e3 > iR.value.hi) break
    d += `${d ? 'L' : 'M'}${(m.l + x).toFixed(1)} ${Y(i).toFixed(1)}`
  }
  return d
})

/** 光标（换流开始后的时刻）及之前的轨迹 */
const t = computed(() => {
  const p = props.live?.phase
  return p === 'settle' || p === 'ready' ? 0 : props.live?.t ?? 0
})
const pathTo = computed(() => {
  const x = w.value
  if (!x) return ''
  const n = Math.min(x.i.length - 1, Math.round(Math.min(t.value, endTime(x)) / x.dt))
  let d = `M${X(x.v[0]).toFixed(1)} ${Y(x.i[0]).toFixed(1)}`
  for (let k = 1; k <= n; k += 2) d += `L${X(x.v[k]).toFixed(1)} ${Y(x.i[k]).toFixed(1)}`
  return d
})
const now = computed(() => (w.value ? sampleAt(w.value, t.value) : null))
/** t₀、t₁、t₂ 处的工作点（光标走到才出现） */
const dots = computed(() => {
  const x = w.value
  const q = r.value
  if (!x || !q) return []
  return ([['0', q.t0], ['1', q.t1], ['2', q.t2]] as const)
    .filter(([, tt]) => t.value >= tt)
    .map(([k, tt]) => ({ k, ...sampleAt(x, tt) }))
})
</script>

<template>
  <section class="chart panel">
    <h3 class="panel-title">
      <Bi :t="U.title" />
      <span class="hint"><Bi :t="U.hint" /></span>
    </h3>
    <svg v-if="w" :viewBox="`0 0 ${W} ${H}`" class="plot" role="img" :aria-label="tx(U.title)">
      <!-- 第四象限：v > 0、i < 0，静态曲线从不经过 -->
      <rect :x="X(0)" :y="Y(0)" :width="X(vR.hi) - X(0)" :height="Y(iR.lo * 1e-3) - Y(0)" class="q4" />
      <g class="grid">
        <line v-for="v in vTicks" :key="'gv' + v" :x1="X(v)" :x2="X(v)" :y1="m.t" :y2="m.t + ph" />
        <line v-for="i in iTicks" :key="'gi' + i" :x1="m.l" :x2="m.l + pw" :y1="Y(i * 1e-3)" :y2="Y(i * 1e-3)" />
      </g>
      <g class="axis">
        <line :x1="m.l" :x2="m.l + pw" :y1="Y(0)" :y2="Y(0)" />
        <line :x1="X(0)" :x2="X(0)" :y1="m.t" :y2="m.t + ph" />
      </g>
      <g class="ticks">
        <text v-for="v in vTicks" :key="'tv' + v" :x="X(v)" :y="m.t + ph + 16" text-anchor="middle">{{ minus(v) }}</text>
        <text v-for="i in iTicks" :key="'ti' + i" :x="m.l - 6" :y="Y(i * 1e-3) + 4" text-anchor="end">{{ minus(i) }}</text>
        <text :x="m.l + pw" :y="m.t + ph + 30" text-anchor="end" class="axis-name">u / V</text>
        <text :x="X(0) + 6" :y="m.t - 8" class="axis-name">i / mA</text>
      </g>
      <text :x="X(vR.hi) - 4" :y="Y(iR.lo * 1e-3) - 6" text-anchor="end" class="note q4t">{{ tx(U.q4) }}</text>
      <text v-if="r" :x="m.l + 6" :y="Y(iR.lo * 1e-3) - 6" class="note">{{ tx(U.q3) }}</text>

      <path :d="staticPath" class="curve static" />
      <path :d="pathTo" class="curve path" />
      <g v-for="d in dots" :key="d.k" class="tdot">
        <circle :cx="X(d.v)" :cy="Y(d.i)" r="3.5" />
        <text :x="X(d.v) + 6" :y="Y(d.i) - 6">t<tspan class="sub" dy="3">{{ d.k }}</tspan></text>
      </g>
      <g v-if="now" class="op" :transform="`translate(${X(now.v)} ${Y(now.i)})`">
        <circle r="11" class="halo" />
        <circle r="6" class="dot" />
      </g>
    </svg>
    <ul class="keys">
      <li><i class="sw static" /><Bi :t="U.static" /></li>
      <li><i class="sw path" /><Bi :t="U.path" /></li>
    </ul>
  </section>
</template>

<style scoped>
.q4 { fill: var(--accent); fill-opacity: 0.08; }
.axis line {
  stroke: var(--ink);
  stroke-width: 1.5;
}
.note {
  font-size: 10.5px;
  fill: var(--ink-soft);
}
.note.q4t { fill: var(--accent); }
.curve {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.curve.static { stroke: var(--ink-soft); stroke-width: 2; stroke-dasharray: 6 4; }
.curve.path { stroke: var(--electron); stroke-width: 2.8; }
[data-style='glow'] .curve.path { filter: drop-shadow(0 0 4px var(--electron)); }
.tdot circle {
  fill: var(--surface);
  stroke: var(--ink);
  stroke-width: 1.8;
}
.tdot text {
  font-size: 11px;
  font-weight: 700;
  font-style: italic;
  fill: var(--ink);
}

.sw.static { border-color: var(--ink-soft); border-top-style: dashed; border-top-width: 2px; }
.sw.path { border-color: var(--electron); }
</style>
