<script setup lang="ts">
// 1.3-4 参数与温度：一个结温滑块（虚线为 25 °C）驱动三段：
// ① 反向：漏电流猛涨；② 正向：小电流时压降变小、大电流时变大（压降之差 ΔU_F 过零处是交点）；
// ③ 交点有什么用：两只并联怎样分电流。最后是参数随温度变化的小结表与手册对照
import { computed, ref } from 'vue'
import Bi from './Bi.vue'
import Rich from './Rich.vue'
import PinRefNote from './PinRefNote.vue'
import PinFwdPlot from './PinFwdPlot.vue'
import PinRevPlot from './PinRevPlot.vue'
import PinParallel from './PinParallel.vue'
import { fillBi, tx } from '../app/settings'
import { T_REF_PIN, crossover, matAt, reverseI, terminalU } from '../engine/physics/pin'
import { UI_STATIC } from '../devices/power-diode/sections/uiStatic'
import { UI } from '../devices/power-diode/sections/ui'

const U = UI_STATIC.temp
const T = ref(125)
const T0 = T_REF_PIN
const fmtI = (i: number) => (i < 10 ? i.toPrecision(2) : i.toFixed(0))

// ───────────── ① 漏电流 ─────────────
const ir = computed(() => {
  const a = reverseI(1200, matAt(T0)) * 1e6
  const b = reverseI(1200, matAt(T.value)) * 1e6
  return { a, b, k: b / a }
})
const s1 = computed(() => fillBi(U.s1Text, { a: fmtI(ir.value.a), b: fmtI(ir.value.b), t: T.value, k: ir.value.k.toFixed(0) }))

// ───────────── ② 压降之差 ΔU_F（mV）随电流 ─────────────
const W = 520
const H = 260
const m = { l: 52, r: 14, t: 16, b: 38 }
const I_MAX = 90
const D_MAX = 200
const x = (i: number) => m.l + (i / I_MAX) * (W - m.l - m.r)
const y = (d: number) => m.t + ((D_MAX - Math.max(-D_MAX, Math.min(D_MAX, d))) / (2 * D_MAX)) * (H - m.t - m.b)
const dU = (i: number, t: number) => (terminalU(i, t) - terminalU(i, T0)) * 1000
const dPath = computed(() => {
  let d = ''
  for (let i = 1; i <= I_MAX; i += 1) d += `${d ? ' L' : 'M'}${x(i).toFixed(1)} ${y(dU(i, T.value)).toFixed(1)}`
  return d
})
const Ix = computed(() => crossover(T.value))
const s2 = computed(() => fillBi(U.s2Text, { i: Ix.value ? Ix.value.toFixed(0) : '—' }))

// ───────────── 小结表 ─────────────
const sign = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(0)}`
const rows = computed(() => {
  const t = T.value
  const R = U.rows
  const uRow = (name: typeof R.uf5, I: number) => {
    const a = terminalU(I, T0)
    const b = terminalU(I, t)
    return { name, a: `${a.toFixed(2)} V`, b: `${b.toFixed(2)} V`, d: `${sign((b - a) * 1000)} mV`, cls: b < a ? 'down' : 'up' }
  }
  return [
    uRow(R.uf5, 5),
    uRow(R.uf30, 30),
    uRow(R.uf60, 60),
    { name: R.ir, a: `${fmtI(ir.value.a)} µA`, b: `${fmtI(ir.value.b)} µA`, d: tx(fillBi(U.times, { k: ir.value.k.toFixed(0) })), cls: 'up' },
  ]
})
const head = computed(() => U.head.map((h) => fillBi(h, { t: T.value })))
</script>

<template>
  <section class="stage panel">
    <PinRefNote />
    <label class="bias temp">
      <span class="bias-name"><Bi :t="U.tj" /></span>
      <input v-model.number="T" type="range" min="25" max="150" step="5" />
      <output class="bias-val">{{ T }}<small> °C</small></output>
    </label>

    <h3 class="panel-title"><Bi :t="U.s1" /></h3>
    <div class="pst-grid">
      <figure class="chart sp">
        <PinRevPlot :t="T" ref25 :op="1200" />
        <ul class="keys"><li><i class="sw ref" /><Bi :t="UI_STATIC.plot.ref" /></li></ul>
      </figure>
      <div class="pst-note"><Rich :t="s1" /></div>
    </div>

    <h3 class="panel-title"><Bi :t="U.s2" /></h3>
    <div class="pst-note"><Rich :t="s2" /></div>
    <div class="pst-grid even">
      <figure class="chart sp">
        <h4 class="sub-title"><Bi :t="fillBi(U.fwdTitle, { t: T })" /></h4>
        <PinFwdPlot :t="T" ref25 cross />
        <ul class="keys"><li><i class="sw ref" /><Bi :t="UI_STATIC.plot.ref" /></li></ul>
      </figure>
      <figure class="chart sp">
        <h4 class="sub-title"><Bi :t="fillBi(U.dTitle, { t: T })" /></h4>
        <svg class="plot" :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="tx(U.dAxis)">
          <rect :x="m.l" :y="y(0)" :width="W - m.l - m.r" :height="y(-D_MAX) - y(0)" class="neg" />
          <rect :x="m.l" :y="m.t" :width="W - m.l - m.r" :height="y(0) - m.t" class="pos" />
          <g class="grid">
            <line v-for="i in [30, 60, 90]" :key="'gx' + i" :x1="x(i)" :x2="x(i)" :y1="m.t" :y2="H - m.b" />
            <line v-for="d in [-200, -100, 100, 200]" :key="'gy' + d" :x1="m.l" :x2="W - m.r" :y1="y(d)" :y2="y(d)" />
          </g>
          <g class="ticks">
            <text v-for="i in [0, 30, 60, 90]" :key="'tx' + i" :x="x(i)" :y="H - m.b + 15" text-anchor="middle">{{ i }}</text>
            <text v-for="d in [-200, -100, 0, 100, 200]" :key="'ty' + d" :x="m.l - 6" :y="y(d) + 4" text-anchor="end">{{ d > 0 ? '+' + d : d }}</text>
            <text :x="W - m.r" :y="H - 6" text-anchor="end" class="axis-name">I / A</text>
            <text :x="m.l + 6" :y="m.t + 12" class="axis-name">{{ tx(U.dAxis) }}</text>
          </g>
          <line :x1="m.l" :x2="W - m.r" :y1="y(0)" :y2="y(0)" class="zero" />
          <line :x1="m.l" :x2="m.l" :y1="m.t" :y2="H - m.b" class="zero" />
          <text :x="W - m.r - 6" :y="y(186)" text-anchor="end" class="zlab pos">{{ tx(U.pos) }}</text>
          <text :x="m.l + 8" :y="y(-160)" class="zlab neg">{{ tx(U.neg) }}</text>
          <path :d="dPath" class="dcurve" />
          <g v-if="Ix" class="cross">
            <line :x1="x(Ix)" :x2="x(Ix)" :y1="m.t" :y2="H - m.b" />
            <circle :cx="x(Ix)" :cy="y(0)" r="7" />
            <text :x="x(Ix) + 8" :y="H - m.b - 8">{{ tx(fillBi(UI_STATIC.plot.cross, { i: Ix.toFixed(0) })) }}</text>
          </g>
        </svg>
      </figure>
    </div>

    <h3 class="panel-title"><Bi :t="U.s3" /></h3>
    <div class="pst-grid">
      <PinParallel :t="T" />
      <div class="pst-note"><Rich :t="fillBi(U.s3Text, { t: T })" /></div>
    </div>

    <h3 class="panel-title"><Bi :t="U.tableTitle" /></h3>
    <div class="pst-grid">
      <table class="ptab">
        <thead>
          <tr><th v-for="(h, k) in head" :key="k"><Bi :t="h" /></th></tr>
        </thead>
        <tbody>
          <tr v-for="(r, k) in rows" :key="k">
            <th><Bi :t="r.name" /></th>
            <td>{{ r.a }}</td>
            <td>{{ r.b }}</td>
            <td :class="r.cls">{{ r.d }}</td>
          </tr>
          <tr>
            <th><Bi :t="U.rows.bv" /></th>
            <td colspan="3" class="up"><Bi :t="U.bvUp" /></td>
          </tr>
        </tbody>
      </table>
      <div class="pst-note">
        <b><Bi :t="U.dsTitle" /></b>
        <Rich :t="U.ds" />
      </div>
    </div>

    <p class="scaled"><Bi :t="UI.scaled.staticTemp" /></p>
  </section>
</template>

<style scoped>
.bias.temp { flex: 0 0 auto; max-width: 520px; }
.sub-title { margin: 0 0 4px; font-size: 0.86rem; }
.sw.ref { border-color: var(--ink-soft); border-top-style: dashed; }
.neg { fill: color-mix(in srgb, var(--danger) 8%, transparent); }
.pos { fill: color-mix(in srgb, var(--accent) 8%, transparent); }
.zero { stroke: var(--ink); stroke-width: 1.6; }
.zlab { font-size: 12px; font-weight: 700; }
.zlab.neg { fill: var(--danger); }
.zlab.pos { fill: var(--accent); }
.dcurve { fill: none; stroke: var(--heat-out); stroke-width: 3; }
.cross line { stroke: var(--danger); stroke-width: 1.4; stroke-dasharray: 4 4; }
.cross circle { fill: none; stroke: var(--danger); stroke-width: 2.4; }
.cross text { font-size: 12px; font-weight: 700; fill: var(--danger); }
.ptab { border-collapse: collapse; font-size: 0.85rem; width: 100%; font-variant-numeric: tabular-nums; }
.ptab th, .ptab td { padding: 4px 6px; border-bottom: 1px solid color-mix(in srgb, var(--ink) 12%, transparent); text-align: right; }
.ptab th:first-child, .ptab tbody th { text-align: left; font-weight: 700; }
.ptab thead th { color: var(--ink-soft); font-weight: 700; }
.ptab td.down { color: var(--potential); font-weight: 700; }
.ptab td.up { color: var(--danger); font-weight: 700; }
.ptab td[colspan] { text-align: left; }
</style>
