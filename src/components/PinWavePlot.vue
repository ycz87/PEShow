<script setup lang="ts">
// 1.4 的波形图：电流 i(t)（上）与二极管电压 u(t)（下），随时间游标逐渐画出；
// 标注（特征时刻、水平参考线、时间段、阴影、特征点）在游标走到那一刻之后才出现
import { computed, useId } from 'vue'
import { minus } from '../app/format'
import type { Series } from '../devices/power-diode/dynWaves'

export interface Mark { t: number; label: string }
export interface HLine { y: number; ch: 'i' | 'u'; label: string; cls?: string }
/** 时间段标注：row 为第几行（从图顶往下），cls 可选 */
export interface Span { t1: number; t2: number; label: string; row: number; cls?: string }
/** 电流图上的一段直线（如 t₂ 的外推线），到 t2 才出现 */
export interface Seg { t1: number; i1: number; t2: number; i2: number }
/** 特征点：画在第 si 条波形上（默认第一条） */
export interface Dot { t: number; ch: 'i' | 'u'; label: string; below?: boolean; si?: number; cls?: string }

const props = withDefaults(
  defineProps<{
    series: { s: Series; cls?: string }[]
    /** 游标（s）；null 表示整段显示 */
    t: number | null
    tMax: number
    /** 横轴起点（s），放大某一段时用 */
    tMin?: number
    /** 电压超出这条线（V，负值）的部分涂成警示色：硬恢复的尖峰 */
    overshoot?: number | null
    iLim: [number, number]
    uLim: [number, number]
    iTicks: number[]
    uTicks: number[]
    marks?: Mark[]
    hlines?: HLine[]
    spans?: Span[]
    shade?: { t1: number; t2: number } | null
    dots?: Dot[]
    segs?: Seg[]
  }>(),
  { tMin: 0, overshoot: null, marks: () => [], hlines: () => [], spans: () => [], shade: null, dots: () => [], segs: () => [] },
)

const clipId = `wave-${useId()}`
const W = 460
const H = 320
const m = { l: 46, r: 52, t: 22, b: 28 }
const pw = W - m.l - m.r
const GAP = 26
const ph = (H - m.t - m.b - GAP) / 2
const iTop = m.t
const iBot = iTop + ph
const uTop = iBot + GAP
const uBot = uTop + ph

const X = (t: number) => m.l + ((t - props.tMin) / (props.tMax - props.tMin)) * pw
const Yi = (i: number) => iBot - ((i - props.iLim[0]) / (props.iLim[1] - props.iLim[0])) * ph
const Yu = (u: number) => uBot - ((u - props.uLim[0]) / (props.uLim[1] - props.uLim[0])) * ph
const clampI = (i: number) => Math.max(props.iLim[0], Math.min(props.iLim[1], i))
const clampU = (u: number) => Math.max(props.uLim[0], Math.min(props.uLim[1], u))

const tTicks = computed(() => {
  const ns = (props.tMax - props.tMin) * 1e9
  const step = ns > 400 ? 100 : 50
  const list: number[] = []
  for (let v = Math.ceil((props.tMin * 1e9) / step) * step; v <= props.tMax * 1e9 + 1e-6; v += step) list.push(v)
  return list
})

function path(s: Series, a: Float64Array, Y: (v: number) => number, clamp: (v: number) => number) {
  let d = ''
  for (let k = 0; k < s.t.length && s.t[k] <= props.tMax; k++) if (s.t[k] >= props.tMin) d += `${d ? 'L' : 'M'}${X(s.t[k]).toFixed(1)} ${Y(clamp(a[k])).toFixed(1)}`
  return d
}
const paths = computed(() => props.series.map((x) => ({ cls: x.cls ?? '', i: path(x.s, x.s.i, Yi, clampI), u: path(x.s, x.s.u, Yu, clampU) })))

const cur = computed(() => (props.t === null ? props.tMax : props.t))
const reached = (t: number) => cur.value >= t - 1e-12

/** 第 si 条波形在 t 处的值（线性插值） */
function at(t: number, ch: 'i' | 'u', si = 0) {
  const s = props.series[si].s
  const a = ch === 'i' ? s.i : s.u
  let k = s.t.findIndex((x) => x >= t)
  if (k <= 0) return a[Math.max(0, k)]
  const f = (t - s.t[k - 1]) / (s.t[k] - s.t[k - 1])
  return a[k - 1] + (a[k] - a[k - 1]) * f
}
const now = computed(() => (props.t === null ? null : { i: at(props.t, 'i'), u: at(props.t, 'u') }))

/** 硬恢复的尖峰：电压低于 overshoot 线的部分 */
const overPath = computed(() => {
  const lim = props.overshoot
  if (lim === null) return ''
  const s = props.series[0].s
  let d = ''
  let open = false
  for (let k = 0; k < s.t.length && s.t[k] <= props.tMax; k++) {
    if (s.t[k] < props.tMin) continue
    if (s.u[k] < lim) {
      d += `${open ? 'L' : `M${X(s.t[k]).toFixed(1)} ${Yu(lim).toFixed(1)}L`}${X(s.t[k]).toFixed(1)} ${Yu(clampU(s.u[k])).toFixed(1)}`
      open = true
    } else if (open) {
      d += `L${X(s.t[k]).toFixed(1)} ${Yu(lim).toFixed(1)}Z`
      open = false
    }
  }
  return d
})

const shadePath = computed(() => {
  const sh = props.shade
  if (!sh) return ''
  const s = props.series[0].s
  let d = `M${X(sh.t1)} ${Yi(0)}`
  for (let k = 0; k < s.t.length; k++) if (s.t[k] >= sh.t1 && s.t[k] <= sh.t2) d += `L${X(s.t[k]).toFixed(1)} ${Yi(clampI(Math.min(0, s.i[k]))).toFixed(1)}`
  return `${d}L${X(sh.t2)} ${Yi(0)}Z`
})
</script>

<template>
  <svg class="plot" :viewBox="`0 0 ${W} ${H}`" role="img" aria-label="i(t), u(t)">
    <defs>
      <clipPath :id="clipId"><rect x="0" y="0" :width="Math.max(0, X(cur) + 0.5)" :height="H" /></clipPath>
    </defs>
    <g class="grid">
      <template v-for="v in tTicks" :key="'gt' + v">
        <line :x1="X(v * 1e-9)" :x2="X(v * 1e-9)" :y1="iTop" :y2="iBot" />
        <line :x1="X(v * 1e-9)" :x2="X(v * 1e-9)" :y1="uTop" :y2="uBot" />
      </template>
      <line v-for="v in iTicks" :key="'gi' + v" :x1="m.l" :x2="m.l + pw" :y1="Yi(v)" :y2="Yi(v)" />
      <line v-for="v in uTicks" :key="'gu' + v" :x1="m.l" :x2="m.l + pw" :y1="Yu(v)" :y2="Yu(v)" />
    </g>
    <g class="axis">
      <line :x1="m.l" :x2="m.l" :y1="iTop" :y2="iBot" />
      <line :x1="m.l" :x2="m.l" :y1="uTop" :y2="uBot" />
      <line :x1="m.l" :x2="m.l + pw" :y1="Yi(0)" :y2="Yi(0)" />
      <line :x1="m.l" :x2="m.l + pw" :y1="Yu(0)" :y2="Yu(0)" />
    </g>
    <g class="ticks">
      <text v-for="v in iTicks" :key="'ti' + v" :x="m.l - 6" :y="Yi(v) + 4" text-anchor="end">{{ minus(v) }}</text>
      <text v-for="v in uTicks" :key="'tu' + v" :x="m.l - 6" :y="Yu(v) + 4" text-anchor="end">{{ minus(v) }}</text>
      <text v-for="v in tTicks" :key="'tt' + v" :x="X(v * 1e-9)" :y="uBot + 15" text-anchor="middle">{{ v }}</text>
      <text x="2" :y="iTop - 8" class="axis-name i">i / A</text>
      <text x="2" :y="uTop - 8" class="axis-name u">u / V</text>
      <text :x="m.l + pw + 6" :y="uBot + 15" class="axis-name">t / ns</text>
    </g>

    <g v-for="(h, k) in hlines" :key="'h' + k" class="hline" :class="h.cls">
      <line :x1="m.l" :x2="m.l + pw" :y1="h.ch === 'i' ? Yi(h.y) : Yu(h.y)" :y2="h.ch === 'i' ? Yi(h.y) : Yu(h.y)" />
      <text :x="m.l + pw + 4" :y="(h.ch === 'i' ? Yi(h.y) : Yu(h.y)) + 4">{{ h.label }}</text>
    </g>

    <g :clip-path="`url(#${clipId})`">
      <path v-if="shade && reached(shade.t2)" :d="shadePath" class="shade" />
      <path v-if="overPath" :d="overPath" class="over" />
      <g v-for="(p, k) in paths" :key="'p' + k" :class="p.cls">
        <path :d="p.i" class="trace i" />
        <path :d="p.u" class="trace u" />
      </g>
    </g>

    <template v-for="(mk, k) in marks" :key="'m' + k">
      <g v-if="reached(mk.t)" class="mark">
        <line :x1="X(mk.t)" :x2="X(mk.t)" :y1="iTop" :y2="uBot" />
        <text :x="X(mk.t)" :y="iTop - 8" text-anchor="middle">{{ mk.label }}</text>
      </g>
    </template>
    <template v-for="(sp, k) in spans" :key="'s' + k">
      <g v-if="reached(sp.t2)" class="span" :class="sp.cls">
        <path :d="`M${X(sp.t1)} ${Yi(iLim[1]) + 12 + sp.row * 18} H${X(sp.t2)}`" />
        <text :x="(X(sp.t1) + X(sp.t2)) / 2" :y="Yi(iLim[1]) + 8 + sp.row * 18" text-anchor="middle">{{ sp.label }}</text>
      </g>
    </template>
    <template v-for="(g, k) in segs" :key="'g' + k">
      <line v-if="reached(g.t2)" :x1="X(g.t1)" :y1="Yi(g.i1)" :x2="X(g.t2)" :y2="Yi(g.i2)" class="seg" />
    </template>
    <template v-for="(d, k) in dots" :key="'d' + k">
      <g v-if="reached(d.t)" class="fdot" :class="d.cls">
        <circle :cx="X(d.t)" :cy="d.ch === 'i' ? Yi(clampI(at(d.t, 'i', d.si))) : Yu(clampU(at(d.t, 'u', d.si)))" r="4" />
        <text :x="X(d.t) + 7" :y="(d.ch === 'i' ? Yi(clampI(at(d.t, 'i', d.si))) : Yu(clampU(at(d.t, 'u', d.si)))) + (d.below ? 14 : -6)">{{ d.label }}</text>
      </g>
    </template>

    <g v-if="now && t !== null && t >= tMin" class="cursor">
      <line :x1="X(t)" :x2="X(t)" :y1="iTop" :y2="uBot" />
      <circle :cx="X(t)" :cy="Yi(clampI(now.i))" r="4.5" class="dot i" />
      <circle :cx="X(t)" :cy="Yu(clampU(now.u))" r="4.5" class="dot u" />
    </g>
  </svg>
</template>

<style scoped>
.axis line { stroke: var(--ink); stroke-width: 1.4; }
.ticks .axis-name.i { fill: var(--electron); }
.ticks .axis-name.u { fill: var(--potential); }
.trace { fill: none; stroke-width: 2.6; stroke-linejoin: round; stroke-linecap: round; }
.trace.i { stroke: var(--electron); }
.trace.u { stroke: var(--potential); }
.alt .trace { stroke-width: 2.4; stroke-dasharray: 8 5; }
.over { fill: var(--danger); fill-opacity: 0.35; }
.fdot.danger circle { stroke: var(--danger); }
.fdot.danger text { fill: var(--danger); }
.shade { fill: var(--accent); fill-opacity: 0.22; }
.hline line { stroke: var(--ink-soft); stroke-width: 1; stroke-dasharray: 3 4; }
.hline text { font-size: 11px; font-weight: 700; font-style: italic; fill: var(--ink-soft); }
.hline.acc line { stroke: var(--accent); stroke-dasharray: 6 4; stroke-width: 1.4; }
.hline.acc text { fill: var(--accent); }
.mark line { stroke: var(--ink); stroke-opacity: 0.4; stroke-dasharray: 2 3; }
.mark text { font-size: 11px; font-weight: 700; fill: var(--ink); }
.span path { stroke: var(--ink-soft); stroke-width: 1.2; }
.span text { font-size: 11px; font-weight: 700; font-style: italic; fill: var(--ink-soft); }
.span.a path { stroke: var(--danger); stroke-width: 2; }
.span.a text { fill: var(--danger); font-size: 12px; }
.span.b path { stroke: var(--accent); stroke-width: 2; stroke-dasharray: 6 3; }
.span.b text { fill: var(--accent); font-size: 12px; }
.seg { stroke: var(--hole); stroke-width: 1.6; stroke-dasharray: 5 4; }
.fdot circle { fill: var(--surface); stroke: var(--ink); stroke-width: 1.8; }
.fdot text { font-size: 11.5px; font-weight: 700; fill: var(--ink); }
.cursor line { stroke: var(--accent); stroke-width: 1.2; stroke-opacity: 0.6; }
.cursor .dot { stroke: var(--line); stroke-width: 2; }
.cursor .dot.i { fill: var(--electron); }
.cursor .dot.u { fill: var(--potential); }
</style>
