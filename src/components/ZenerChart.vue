<script setup lang="ts">
// 稳压二极管的 V-A 特性（0.6）。三种画法：
//  - 认识击穿 / 雪崩 / 齐纳：示例器件的完整曲线，反向段 −60…−6 V 压缩、−6…+1 V 放大，左上角放大击穿区（含 25 °C 对照）；
//  - 对比：三款器件的反向曲线，电流按各自 I_ZT 归一化；
//  - 热击穿：结温 T_j 下的器件曲线、负载线与允许功耗双曲线，工作点随结温移动。
import { computed, useId } from 'vue'
import Bi from './Bi.vue'
import { fillBi, tx } from '../app/settings'
import { minus } from '../app/format'
import type { BreakdownLive } from '../app/breakdown'
import { THERMAL, TJ_MAX, ZENERS, ZENER_IDS, forwardI, reverseV, type ZenerId, type ZenerSpec } from '../engine/physics/breakdown'
import { UI } from '../devices/pn-junction/sections/ui'

const props = defineProps<{ live: BreakdownLive | null }>()
const U = UI.bd.chart

const clipId = `zc-plot-${useId()}`
const W = 440
const H = 300
const m = { l: 50, r: 18, t: 24, b: 34 }
const pw = W - m.l - m.r
const ph = H - m.t - m.b
/** 反向段压缩与放大的分界（V） */
const BREAK = -6

type Kind = 'full' | 'compare' | 'thermal'
const kind = computed<Kind>(() => {
  const md = props.live?.mode
  return md === 'compare' ? 'compare' : md === 'thermal' ? 'thermal' : 'full'
})
const d = computed(() => ZENERS[props.live?.device ?? '1N4757A'])
const T = computed(() => props.live?.T ?? 25)
const showGhost = computed(() => Math.abs(T.value - 25) >= 1)

/** 横轴分段线性：[v0, v1] 映射到绘图区宽度的 [f0, f1] */
interface Seg { v0: number; v1: number; f0: number; f1: number }
/** 纵轴：full、thermal 为电流（A），compare 为 I/I_ZT */
const axes = computed(() => {
  const IZT = d.value.IZT
  if (kind.value === 'thermal') return { segs: [{ v0: -4.5, v1: 0.3, f0: 0, f1: 1 }], lo: -0.3, hi: 0.03 }
  if (kind.value === 'compare') return { segs: [{ v0: -60, v1: BREAK, f0: 0, f1: 0.4 }, { v0: BREAK, v1: 0.5, f0: 0.4, f1: 1 }], lo: -1.6, hi: 0.15 }
  return { segs: [{ v0: -60, v1: BREAK, f0: 0, f1: 0.4 }, { v0: BREAK, v1: 1, f0: 0.4, f1: 1 }], lo: -1.5 * IZT, hi: 1.5 * IZT }
})
const vLo = computed(() => axes.value.segs[0].v0)
const vHi = computed(() => axes.value.segs[axes.value.segs.length - 1].v1)

/** 超出横轴范围时按端段外推（由绘图区裁剪掉），不夹到边上，免得曲线在边框处画出一条竖线 */
function X(v: number) {
  const segs: Seg[] = axes.value.segs
  const s = segs.find((q) => v <= q.v1) ?? segs[segs.length - 1]
  return m.l + (s.f0 + ((v - s.v0) / (s.v1 - s.v0)) * (s.f1 - s.f0)) * pw
}
const Y = (y: number) => m.t + ((axes.value.hi - y) / (axes.value.hi - axes.value.lo)) * ph

/** 1、2、2.5、5 × 10ⁿ 的刻度步长 */
function nice(x: number) {
  const e = 10 ** Math.floor(Math.log10(x))
  return ([1, 2, 2.5, 5, 10].find((k) => k * e >= x) ?? 10) * e
}
/** 刻度数字：去掉浮点尾数，负号写成"−" */
const num = (v: number) => minus(+v.toPrecision(6))

const vTicks = computed(() => {
  if (kind.value === 'thermal') return [-4, -3, -2, -1, 0]
  const list = [-60, -50, -40, -30, -20]
  for (let v = BREAK; v <= vHi.value + 1e-9; v += 1) list.push(v)
  return list
})
/** 纵轴刻度：值与标签 */
const yTicks = computed(() => {
  const { lo, hi } = axes.value
  if (kind.value === 'compare') return [-1.5, -1, -0.5, 0].map((y) => ({ y, s: num(y) }))
  const step = kind.value === 'thermal' ? 0.1 : nice((hi * 1e3) / 3) / 1e3
  const list = []
  for (let k = Math.ceil(lo / step - 1e-9); k * step <= hi + 1e-12; k++) list.push({ y: k * step, s: num(+(k * step * 1e3).toFixed(3)) })
  return list
})

/** 反向曲线上的点（反向量为正）：I 按 (k/N)⁴ 取样，同时照顾 µA 级的漏电段与 mA 级的击穿段 */
function reversePts(dev: ZenerSpec, Imax: number, Tc: number, N = 140) {
  const pts: [number, number][] = [[0, 0]]
  for (let k = 1; k <= N; k++) {
    const I = Imax * (k / N) ** 4
    pts.push([reverseV(dev, I, Tc), I])
  }
  return pts
}
const path = (pts: [number, number][], fx: (v: number) => number, fy: (y: number) => number) =>
  pts.map(([v, y], k) => `${k ? 'L' : 'M'}${fx(v).toFixed(1)} ${fy(y).toFixed(1)}`).join('')
/** 反向点画在第三象限 */
const rev = (pts: [number, number][], norm = 1) => path(pts, (v) => X(-v), (I) => Y(-I / norm))

const curve = computed(() => rev(reversePts(d.value, -axes.value.lo, T.value)))
const ghost = computed(() => (showGhost.value ? rev(reversePts(d.value, -axes.value.lo, 25)) : ''))
/** 正向段：只作示意，电流超出纵轴处截断 */
const fwd = computed(() => {
  const pts: [number, number][] = []
  for (let v = 0; v <= vHi.value + 1e-9; v += 0.01) {
    const I = forwardI(v)
    pts.push([v, Math.min(I, axes.value.hi)])
    if (I > axes.value.hi) break
  }
  return path(pts, X, Y)
})

const op = computed(() => (props.live ? { x: X(-props.live.V), y: Y(-props.live.I) } : null))
const brk = computed(() => X(BREAK))

// ───────────── 击穿区放大（full）：左上角空着的象限 ─────────────
const box = computed(() => ({ x: m.l + 10, y: m.t + 8, w: (X(0) - m.l) * 0.6, h: Y(0) - m.t - 32 }))
const inset = computed(() => {
  const dev = d.value
  const IZT = dev.IZT
  const at = (I: number) => [reverseV(dev, I, 25), reverseV(dev, I, T.value)]
  const lo = Math.min(...at(0.02 * IZT))
  const hi = Math.max(...at(1.5 * IZT))
  const pad = (hi - lo) * 0.08
  const v0 = lo - pad
  const v1 = hi + pad
  const b = box.value
  const ix = (v: number) => b.x + ((v1 - v) / (v1 - v0)) * b.w
  const iy = (I: number) => b.y + 14 + (I / (1.6 * IZT)) * (b.h - 14)
  const pts = (Tc: number) => {
    const list: [number, number][] = []
    for (let k = 0; k <= 80; k++) {
      const I = IZT * (0.02 + (1.48 * k) / 80)
      list.push([reverseV(dev, I, Tc), I])
    }
    return list
  }
  const step = nice((v1 - v0) / 3)
  const ticks: number[] = []
  for (let v = Math.ceil(v0 / step) * step; v <= v1; v += step) ticks.push(v)
  const live = props.live
  return {
    curve: path(pts(T.value), ix, iy),
    ghost: showGhost.value ? path(pts(25), ix, iy) : '',
    izt: iy(IZT),
    ticks: ticks.map((v) => ({ x: ix(v), s: num(-+v.toFixed(2)) })),
    op: live && live.I >= 0.02 * IZT && live.I <= 1.5 * IZT && live.V >= v0 && live.V <= v1 ? { x: ix(live.V), y: iy(live.I) } : null,
  }
})

// ───────────── 对比 ─────────────
const DEV_COLOR: Record<ZenerId, string> = { '1N4728A': 'var(--heat-in)', '1N4733A': 'var(--potential)', '1N4757A': 'var(--heat-out)' }
const compareCurves = computed(() =>
  ZENER_IDS.map((id) => {
    const dev = ZENERS[id]
    return { id, color: DEV_COLOR[id], d: rev(reversePts(dev, 1.5 * dev.IZT, T.value), dev.IZT) }
  }),
)

// ───────────── 热击穿 ─────────────
const load = computed(() => {
  const R = props.live?.R ?? THERMAL.Rsrc
  const Imax = -axes.value.lo
  return path([[THERMAL.VS, 0], [THERMAL.VS - Imax * R, Imax]], (v) => X(-v), (I) => Y(-I))
})
/** 允许功耗：稳态下 T_j = T_a + R_θ·P，工作点在这条双曲线以外 ⇔ 稳态结温超过 T_j,max */
const pAllow = computed(() => (TJ_MAX - THERMAL.Ta) / THERMAL.Rth[props.live?.cooling ?? 'good'])
const pmaxPath = computed(() => {
  const P = pAllow.value
  const pts: [number, number][] = []
  for (let v = P / -axes.value.lo; v <= -vLo.value + 1e-9; v += 0.02) pts.push([v, P / v])
  return path(pts, (v) => X(-v), (I) => Y(-I))
})
const pmaxText = computed(() => fillBi(U.pmax, { p: pAllow.value.toFixed(2) }))

const hint = computed(() => (kind.value === 'compare' ? U.hintCompare : kind.value === 'thermal' ? U.hintThermal : U.hint))
const nowText = computed(() => (kind.value === 'thermal' ? U.nowTj : U.now))
</script>

<template>
  <section class="chart panel">
    <h3 class="panel-title">
      <Bi :t="U.title" />
      <span class="hint"><Bi :t="hint" /></span>
    </h3>
    <svg v-if="live" :viewBox="`0 0 ${W} ${H}`" class="plot" role="img" :aria-label="tx(U.title)">
      <defs>
        <clipPath :id="clipId"><rect :x="m.l" :y="m.t" :width="pw" :height="ph" /></clipPath>
      </defs>
      <g class="grid">
        <line v-for="v in vTicks" :key="'gv' + v" :x1="X(v)" :x2="X(v)" :y1="m.t" :y2="m.t + ph" />
        <line v-for="t in yTicks" :key="'gy' + t.y" :x1="m.l" :x2="m.l + pw" :y1="Y(t.y)" :y2="Y(t.y)" />
      </g>
      <line v-if="kind !== 'thermal'" class="brk-line" :x1="brk" :x2="brk" :y1="m.t" :y2="m.t + ph" />
      <g class="axis">
        <line :x1="m.l" :x2="m.l + pw" :y1="Y(0)" :y2="Y(0)" />
        <line :x1="X(0)" :x2="X(0)" :y1="m.t" :y2="m.t + ph" />
      </g>
      <g v-if="kind !== 'thermal'" class="brk" :transform="`translate(${brk} ${Y(0)})`">
        <rect x="-4" y="-7" width="8" height="14" />
        <path d="M-6 6 L-2 -6 M2 6 L6 -6" />
      </g>
      <g class="ticks">
        <text v-for="v in vTicks" :key="'tv' + v" :x="X(v)" :y="m.t + ph + 16" text-anchor="middle">{{ num(v) }}</text>
        <text v-for="t in yTicks" :key="'ty' + t.y" :x="m.l - 6" :y="Y(t.y) + 4" text-anchor="end">{{ t.s }}</text>
        <text :x="m.l + pw" :y="m.t + ph + 30" text-anchor="end" class="axis-name">U / V</text>
        <text :x="X(0) + 6" :y="m.t - 8" class="axis-name" :text-anchor="kind === 'full' ? 'start' : 'end'">{{ kind === 'compare' ? 'I / I_ZT' : 'I / mA' }}</text>
      </g>

      <template v-if="kind === 'full'">
        <line class="izt" :x1="m.l" :x2="X(0)" :y1="Y(-d.IZT)" :y2="Y(-d.IZT)" />
        <text class="note" :x="X(0) - 4" :y="Y(-d.IZT) - 4" text-anchor="end">−I_ZT</text>
        <path v-if="ghost" :d="ghost" class="curve ghost" />
        <path :d="fwd" class="curve main" />
        <path :d="curve" class="curve main" />
        <g class="inset">
          <rect class="frame" :x="box.x" :y="box.y" :width="box.w" :height="box.h" rx="6" />
          <text class="inset-title" :x="box.x + 6" :y="box.y + 11">{{ tx(U.inset) }}</text>
          <line class="izt" :x1="box.x" :x2="box.x + box.w" :y1="inset.izt" :y2="inset.izt" />
          <text v-for="t in inset.ticks" :key="'it' + t.s" class="note" :x="t.x" :y="box.y + box.h + 11" text-anchor="middle">{{ t.s }}</text>
          <path v-if="inset.ghost" :d="inset.ghost" class="curve ghost" />
          <path :d="inset.curve" class="curve main" />
          <circle v-if="inset.op" class="op-small" :cx="inset.op.x" :cy="inset.op.y" r="3.5" />
        </g>
      </template>

      <template v-else-if="kind === 'compare'">
        <line class="izt" :x1="m.l" :x2="X(0)" :y1="Y(-1)" :y2="Y(-1)" />
        <path v-for="c in compareCurves" :key="c.id" :d="c.d" class="curve dev" :style="{ stroke: c.color }" />
      </template>

      <g v-else :clip-path="`url(#${clipId})`">
        <path :d="pmaxPath" class="curve pmax" />
        <path :d="load" class="curve load" />
        <path v-if="ghost" :d="ghost" class="curve ghost" />
        <path :d="curve" class="curve main" />
      </g>

      <g v-if="op && kind !== 'compare'" class="op" :transform="`translate(${op.x} ${op.y})`">
        <template v-if="live.burnt">
          <path d="M-7 -7 L7 7 M7 -7 L-7 7" class="burnt" />
        </template>
        <template v-else>
          <circle r="11" class="halo" />
          <circle r="6" class="dot" />
        </template>
      </g>
    </svg>
    <ul class="keys">
      <template v-if="kind === 'compare'">
        <li v-for="c in compareCurves" :key="c.id"><i class="sw" :style="{ borderColor: c.color }" />{{ c.id }}（{{ ZENERS[c.id].VZ }} V）</li>
      </template>
      <template v-else>
        <li><i class="sw main" /><Bi :t="nowText" /></li>
        <li v-if="showGhost"><i class="sw ghost" /><Bi :t="U.ghost" /></li>
        <template v-if="kind === 'thermal'">
          <li><i class="sw load" /><Bi :t="U.load" /></li>
          <li><i class="sw pmax" /><Bi :t="pmaxText" /></li>
        </template>
        <li><i class="dot-key" /><Bi :t="U.op" /></li>
      </template>
    </ul>
    <p v-if="kind === 'full'" class="foot"><Bi :t="U.leak" /></p>
  </section>
</template>

<style scoped>
.axis line {
  stroke: var(--ink);
  stroke-width: 1.5;
}
.brk-line {
  stroke: var(--ink-soft);
  stroke-opacity: 0.5;
  stroke-dasharray: 2 4;
}
.brk rect { fill: var(--bg); }
.brk path {
  stroke: var(--ink);
  stroke-width: 1.5;
  fill: none;
}
.note {
  font-size: 10px;
  fill: var(--ink-soft);
  font-variant-numeric: tabular-nums;
}
.izt {
  stroke: var(--ink-soft);
  stroke-dasharray: 3 3;
  stroke-opacity: 0.7;
}
.curve {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.curve.main { stroke: var(--potential); stroke-width: 2.6; }
.curve.ghost { stroke: var(--ink-soft); stroke-width: 1.8; stroke-dasharray: 5 4; }
.curve.dev { stroke-width: 2.6; }
.curve.load { stroke: var(--accent); stroke-width: 2; stroke-dasharray: 7 4; }
.curve.pmax { stroke: var(--danger); stroke-width: 1.8; stroke-opacity: 0.85; }
[data-style='glow'] .curve.main,
[data-style='glow'] .curve.dev { filter: drop-shadow(0 0 3px currentColor); }
.inset .frame {
  fill: var(--bg);
  fill-opacity: 0.85;
  stroke: var(--line);
  stroke-width: 1.2;
}
.inset-title {
  font-size: 10.5px;
  font-weight: 700;
  fill: var(--ink);
}
.inset .curve.main { stroke-width: 2.2; }
.op-small {
  fill: var(--accent);
  stroke: var(--line);
  stroke-width: 1.5;
}
.op .burnt {
  stroke: var(--danger);
  stroke-width: 3.2;
  stroke-linecap: round;
}

.sw.main { border-color: var(--potential); }
.sw.ghost { border-color: var(--ink-soft); border-top-style: dashed; border-top-width: 2px; }
.sw.load { border-color: var(--accent); border-top-style: dashed; border-top-width: 2px; }
.sw.pmax { border-color: var(--danger); border-top-width: 2px; }
.dot-key {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--accent);
}
.foot {
  margin: 0;
  font-size: 0.74rem;
  color: var(--ink-soft);
}
</style>
