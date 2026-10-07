<script setup lang="ts">
// C-V 特性（0.7）：势垒电容 C_j 随电压的变化；扩散电容那一步再加上 C_d 与 C_T = C_j + C_d（纵轴换成对数）。
// 拖动工作点 ⇄ 改变舞台上的外加电压（联动）；舞台叠加交流信号时，标出信号在曲线上扫过的一段
import { computed } from 'vue'
import Bi from './Bi.vue'
import { tx } from '../app/settings'
import { formatCap, minus } from '../app/format'
import { useChartDrag } from '../app/useChartDrag'
import { cB, cD, cJ, cbExtrapolated } from '../engine/physics/capacitance'
import { junctionAt } from '../engine/physics/pn'
import { UI } from '../devices/pn-junction/sections/ui'
import type { Step } from '../devices/pn-junction/sections/types'
import type { AcSignal } from '../app/acSignal'

/** V：外加电压（V）；T：结温（°C）；vRange：本步电压范围（即横轴）；ac：舞台上叠加的交流信号 */
const props = defineProps<{ V: number; T: number; step: Step; vRange: [number, number]; ac: AcSignal | null }>()
const emit = defineEmits<{ 'update:V': [number] }>()
const U = UI.cv

const W = 440
const H = 300
const m = { l: 56, r: 18, t: 26, b: 40 }
const pw = W - m.l - m.r
const ph = H - m.t - m.b
const bottom = m.t + ph

const lo = computed(() => props.vRange[0])
const hi = computed(() => props.vRange[1])
// ── 纵轴：只画 C_j 时线性 0…1500 pF；加上 C_d 后对数 10 pF…10 µF（C_d 在几百毫伏内涨五六个数量级）
const log = computed(() => !!props.step.cvDiffusion)

// ── 横轴：一般按本步电压范围均匀分布；对数纵轴时 C_d 挤在 0.4 V 以上，改为左边 35% 画反偏、右边 65% 画正偏（图中标注）
const split = computed(() => (log.value && lo.value < 0 && hi.value > 0 ? 0.35 : 0))
function xOf(V: number) {
  const s = split.value
  if (!s) return m.l + ((V - lo.value) / (hi.value - lo.value)) * pw
  return V < 0 ? m.l + s * pw * (1 - V / lo.value) : m.l + s * pw + (1 - s) * pw * (V / hi.value)
}
function vOf(x: number) {
  const s = split.value
  const u = (x - m.l) / pw
  if (!s) return lo.value + u * (hi.value - lo.value)
  return u < s ? lo.value * (1 - u / s) : ((u - s) / (1 - s)) * hi.value
}
const LIN_MAX = 1500e-12
const E0 = -11
const E1 = -5
function yOf(C: number) {
  if (!log.value) return bottom - (C / LIN_MAX) * ph
  return m.t + ((E1 - Math.log10(C)) / (E1 - E0)) * ph
}
const inside = (C: number) => (log.value ? C >= 10 ** E0 && C <= 10 ** E1 : C >= 0 && C <= LIN_MAX)

const j = computed(() => junctionAt(props.T))

/** 按像素逐点采样；越出纵轴范围处断开（C_d 在反偏、小正偏时远小于 10 pF） */
function path(f: (V: number) => number, from = lo.value, to = hi.value) {
  const x0 = xOf(from)
  const x1 = xOf(to)
  const n = Math.max(1, Math.ceil(x1 - x0))
  let d = ''
  let pen = false
  for (let i = 0; i <= n; i++) {
    const V = vOf(x0 + ((x1 - x0) * i) / n)
    const C = f(V)
    if (!inside(C)) {
      pen = false
      continue
    }
    d += `${pen ? 'L' : 'M'}${xOf(V).toFixed(1)} ${yOf(C).toFixed(1)} `
    pen = true
  }
  return d
}

const fB = (V: number) => cB(V, j.value)
const fD = (V: number) => cD(V, j.value)
const fJ = (V: number) => cJ(V, j.value)
/** 当前纵轴上工作点所在的那条曲线：线性时 C_j，对数时 C_T */
const fMain = (V: number) => (log.value ? fJ(V) : fB(V))

/** C_j 分两段：耗尽层近似成立的实线段，与 FC·U_bi 以上的切线外推（虚线）。两段在边界处共用一点，不留缝 */
const fcV = computed(() => {
  let a = lo.value
  let b = hi.value
  if (!cbExtrapolated(b, j.value)) return null
  for (let k = 0; k < 40; k++) {
    const c = (a + b) / 2
    if (cbExtrapolated(c, j.value)) b = c
    else a = c
  }
  return b
})
const curves = computed(() => {
  const f = fcV.value
  const cb = path(fB, lo.value, f ?? hi.value)
  const cbExt = f === null ? '' : path(fB, f, hi.value)
  if (!log.value) return { cb, cbExt, cd: '', cj: '' }
  return { cb, cbExt, cd: path(fD), cj: path(fJ) }
})

/** 曲线旁的名称：C_j 在左端；C_d 在它升到 10 nF 处（对数坐标） */
const tags = computed(() => {
  const list = [{ k: 'cb', t: 'j', x: xOf(lo.value) + 6, y: yOf(fB(lo.value)) - 8, anchor: 'start' }]
  if (log.value) {
    let a = 0
    let b = hi.value
    for (let k = 0; k < 40; k++) {
      const c = (a + b) / 2
      if (fD(c) < 1e-8) a = c
      else b = c
    }
    if (b < hi.value - 0.01) list.push({ k: 'cd', t: 'd', x: xOf(b) - 8, y: yOf(1e-8) + 4, anchor: 'end' })
  }
  return list
})

const clampY = (y: number) => Math.max(m.t - 2, Math.min(bottom, y))
const pt = computed(() => ({ x: xOf(props.V), y: clampY(yOf(fMain(props.V))) }))

/** 交流小信号：曲线上被扫过的一段（只随幅度重算），以及此刻的瞬时工作点 */
const acAmp = computed(() => props.ac?.amp ?? 0)
const acPath = computed(() => {
  const a = acAmp.value
  return a ? path(fMain, Math.max(lo.value, props.V - a), Math.min(hi.value, props.V + a)) : ''
})
const acPt = computed(() => {
  if (!props.ac) return null
  const v = props.V + props.ac.v
  return { x: xOf(v), y: clampY(yOf(fMain(v))) }
})

// ── 刻度
const ticksV = computed(() => {
  if (split.value) return [-2, -1, 0, 0.2, 0.4, 0.6].filter((v) => v >= lo.value && v <= hi.value)
  const list: number[] = []
  for (let v = Math.ceil(lo.value * 2) / 2; v <= hi.value + 1e-9; v += 0.5) list.push(+v.toFixed(1))
  return list
})
const LIN_TICKS = [300, 600, 900, 1200, 1500]
const DECADES = Array.from({ length: E1 - E0 + 1 }, (_, i) => E0 + i)
const LOG_LABEL: Record<number, string> = { [-11]: '10 pF', [-10]: '100 pF', [-9]: '1 nF', [-8]: '10 nF', [-7]: '100 nF', [-6]: '1 µF', [-5]: '10 µF' }

const now = computed(() => ({ cb: fB(props.V), cd: fD(props.V), cj: fJ(props.V) }))

// ── 拖动
const listeners = useChartDrag({
  width: W,
  toValue: vOf,
  range: () => [lo.value, hi.value],
  current: () => props.V,
  step: 0.01,
  commit: (v) => emit('update:V', v),
})
</script>

<template>
  <section class="chart panel">
    <h3 class="panel-title">
      <Bi :t="U.title" />
      <span class="hint"><Bi :t="U.hint" /></span>
    </h3>
    <svg
      ref="plot"
      :viewBox="`0 0 ${W} ${H}`"
      class="plot drag"
      role="slider"
      tabindex="0"
      :aria-label="tx(U.title)"
      :aria-valuemin="vRange[0]"
      :aria-valuemax="vRange[1]"
      :aria-valuenow="V"
      v-on="listeners"
    >
      <g class="grid">
        <line v-for="v in ticksV" :key="'gv' + v" :x1="xOf(v)" :x2="xOf(v)" :y1="m.t" :y2="bottom" />
        <template v-if="log">
          <line v-for="e in DECADES" :key="'ge' + e" :x1="m.l" :x2="m.l + pw" :y1="yOf(10 ** e)" :y2="yOf(10 ** e)" />
        </template>
        <template v-else>
          <line v-for="c in LIN_TICKS" :key="'gc' + c" :x1="m.l" :x2="m.l + pw" :y1="yOf(c * 1e-12)" :y2="yOf(c * 1e-12)" />
        </template>
      </g>
      <g class="axis">
        <line :x1="m.l" :x2="m.l + pw + 8" :y1="bottom" :y2="bottom" />
        <path :d="`M${m.l + pw + 8} ${bottom} l-8 -4 v8 z`" class="head" />
        <line :x1="m.l" :x2="m.l" :y1="bottom" :y2="m.t - 10" />
        <path :d="`M${m.l} ${m.t - 10} l-4 8 h8 z`" class="head" />
        <line v-if="vRange[0] < 0 && vRange[1] > 0" :x1="xOf(0)" :x2="xOf(0)" :y1="bottom" :y2="m.t" class="v0" />
        <path v-if="split" :d="`M${xOf(0) - 22} ${bottom - 6} l5 12 M${xOf(0) - 16} ${bottom - 6} l5 12`" class="brk" />
      </g>
      <g class="ticks">
        <text v-for="v in ticksV" :key="'tv' + v" :x="xOf(v)" :y="bottom + 16" text-anchor="middle">{{ minus(v) }}</text>
        <template v-if="log">
          <text v-for="(s, e) in LOG_LABEL" :key="'te' + e" :x="m.l - 6" :y="yOf(10 ** +e) + 4" text-anchor="end">{{ s }}</text>
          <text :x="m.l + 8" :y="m.t - 6" class="axis-name">C</text>
        </template>
        <template v-else>
          <text v-for="c in LIN_TICKS" :key="'tc' + c" :x="m.l - 6" :y="yOf(c * 1e-12) + 4" text-anchor="end">{{ c }}</text>
          <text :x="m.l - 6" :y="bottom + 4" text-anchor="end">0</text>
          <text :x="m.l + 8" :y="m.t - 6" class="axis-name">C / pF</text>
        </template>
        <text :x="m.l + pw + 6" :y="bottom - 8" text-anchor="end" class="axis-name">U / V</text>
      </g>
      <text v-if="split" :x="xOf(0) - 8" :y="m.t + 14" class="note" text-anchor="end">{{ tx(UI.vi.axisBreak) }}</text>

      <path v-if="curves.cj" :d="curves.cj" class="curve cj" />
      <path :d="curves.cb" class="curve cb" />
      <path v-if="curves.cbExt" :d="curves.cbExt" class="curve cb ext" />
      <path v-if="curves.cd" :d="curves.cd" class="curve cd" />
      <text v-for="g in tags" :key="g.k" :x="g.x" :y="g.y" class="tag" :class="g.k" :text-anchor="g.anchor">C<tspan class="sub" dy="3">{{ g.t }}</tspan></text>
      <path v-if="acPath" :d="acPath" class="curve swing" />

      <!-- 工作点 -->
      <line :x1="pt.x" :x2="pt.x" :y1="bottom" :y2="pt.y" class="guide" />
      <circle v-if="acPt" :cx="acPt.x" :cy="acPt.y" r="4.5" class="ac-dot" />
      <g class="op" :transform="`translate(${pt.x} ${pt.y})`">
        <circle r="13" class="halo" />
        <circle r="7.5" class="dot" />
      </g>
    </svg>

    <ul class="keys">
      <li><i class="sw cb" /><Bi :t="U.cb" /><i class="sym">C<sub>j</sub></i></li>
      <template v-if="log">
        <li><i class="sw cd" /><Bi :t="U.cd" /><i class="sym">C<sub>d</sub></i></li>
        <li><i class="sw cj" /><Bi :t="U.cj" /><i class="sym">C<sub>T</sub> = C<sub>j</sub> + C<sub>d</sub></i></li>
      </template>
      <li v-if="curves.cbExt"><i class="sw cb dash" /><Bi :t="U.extrap" /></li>
      <li v-if="acPath"><i class="sw swing" /><Bi :t="U.swing" /></li>
    </ul>
    <p v-if="!log && vRange[1] > 0.3" class="cv-note"><Bi :t="U.noCd" /></p>

    <div class="readout">
      <span><b>U</b> = {{ minus(+V.toFixed(2)) }} V</span>
      <span class="cb"><b>C<sub>j</sub></b> = {{ formatCap(now.cb) }}</span>
      <template v-if="log">
        <span class="cd"><b>C<sub>d</sub></b> = {{ formatCap(now.cd) }}</span>
        <span class="cj"><b>C<sub>T</sub></b> = {{ formatCap(now.cj) }}</span>
      </template>
    </div>
  </section>
</template>

<style scoped>
.axis line,
.brk {
  stroke: var(--ink);
  stroke-width: 1.8;
  fill: none;
}
.note {
  font-size: 10.5px;
  fill: var(--ink-soft);
}
.axis line.v0 {
  stroke-width: 1;
  stroke-opacity: 0.5;
  stroke-dasharray: 3 3;
}
.head {
  fill: var(--ink);
}
.curve {
  fill: none;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.curve.cb { stroke: var(--potential); }
.curve.cb.ext { stroke-dasharray: 7 5; stroke-width: 2.4; }
.curve.cd { stroke: var(--hole); stroke-width: 2.4; }
/* C_T 画在最底下、最粗：反偏时与 C_j 重合，正偏后半段与 C_d 重合 */
.curve.cj { stroke: var(--electron); stroke-width: 7; stroke-opacity: 0.4; }
.curve.swing { stroke: var(--accent); stroke-width: 7; stroke-opacity: 0.45; }
[data-style='sticker'] .curve.cb:not(.ext) { stroke-width: 4; }
[data-style='glow'] .curve.cb:not(.ext) { filter: drop-shadow(0 0 5px var(--potential)); }
.tag {
  font-size: 11px;
  font-weight: 700;
  font-style: italic;
}
.tag.cb { fill: var(--potential); }
.tag.cd { fill: var(--hole); }
.guide {
  stroke: var(--accent);
  stroke-dasharray: 4 4;
  stroke-width: 1.5;
}
.ac-dot {
  fill: var(--surface);
  stroke: var(--accent);
  stroke-width: 2.5;
}

.sw.cb { border-color: var(--potential); }
.sw.cd { border-color: var(--hole); }
.sw.cj { border-top-width: 6px; border-color: color-mix(in srgb, var(--electron) 40%, transparent); }
.sw.swing { border-top-width: 6px; border-color: color-mix(in srgb, var(--accent) 45%, transparent); }
.sw.dash { border-top-style: dashed; }
.sym {
  font-family: var(--font-display);
  color: var(--ink);
  margin-left: -2px;
}
.cv-note {
  margin: 0;
  font-size: 0.76rem;
  color: var(--ink-soft);
}

.readout .cb b { color: var(--potential); }
.readout .cd b { color: var(--hole); }
.readout .cj b { color: var(--electron); }
</style>
