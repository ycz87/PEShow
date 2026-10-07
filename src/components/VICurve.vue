<script setup lang="ts">
// 静态 V-A 特性：按小节逐段解锁（0.3 坐标轴、0.4 正向、0.5 反向）。拖动工作点 ⇄ 改变舞台上的外加电压（联动）。
// 曲线都画模型的真实数值：正向含体电阻 R_S，反向含耗尽层产生电流；线性坐标下反向电流不做放大
import { computed, ref, useId, watch } from 'vue'
import Bi from './Bi.vue'
import { tx } from '../app/settings'
import { PN, diodeV, genI, junctionAt, shockley, totalI, type Junction } from '../engine/physics/pn'
import { formatCurrent, minus } from '../app/format'
import { useChartDrag } from '../app/useChartDrag'
import { UI } from '../devices/pn-junction/sections/ui'
import type { Section, Step } from '../devices/pn-junction/sections/types'
import type { AcSignal } from '../app/acSignal'

/** V：外加电压（V）；T：结温（°C）；unlock：本节已解锁到哪一段；step：当前步（工具与默认纵轴）；ac：舞台上叠加的交流信号 */
const props = defineProps<{ V: number; T: number; unlock: NonNullable<Section['vi']>; step: Step; ac: AcSignal | null }>()
const emit = defineEmits<{ 'update:V': [number] }>()
const U = UI.vi
const has = (t: Step['tools'][number]) => props.step.tools.includes(t)

const W = 440
const H = 300
const m = { l: 50, r: 18, t: 26, b: 40 }
const pw = W - m.l - m.r
const ph = H - m.t - m.b
const bottom = m.t + ph

// ── 横轴：0.3–0.4 只有正向段，0…1.5 V 占满宽度；解锁反向段后，左边 35% 画 −2.5…0 V（两段比例不同，图中标注）
const split = computed(() => (props.unlock === 'rev' || props.unlock === 'full' ? 0.35 : 0))
const vLo = computed(() => (split.value ? PN.Vmin : 0))
function xOf(V: number) {
  const s = split.value
  return V < 0 ? m.l + s * pw * (1 - V / PN.Vmin) : m.l + s * pw + (1 - s) * pw * (V / PN.Vmax)
}
function vOf(x: number) {
  const s = split.value
  const u = (x - m.l) / pw
  return u < s ? PN.Vmin * (1 - u / s) : ((u - s) / (1 - s)) * PN.Vmax
}

// ── 纵轴：线性（mA，可放大）或对数 |I|（10⁻¹⁵…1 A）
const log = ref(false)
const zoom = ref(1)
const ZOOM_MAX = 100
/** 线性纵轴的基础满量程：一般 20 mA；电流超过 20 mA 时自动换到 200 mA 挡（回落到 15 mA 以下再换回，放大时不换挡） */
const base = ref(20e-3)
const fs = computed(() => base.value / zoom.value)
const zeroY = m.t + ph * 0.88
const LOG0 = -15
const LOG1 = 0
const axisY = computed(() => (log.value ? bottom : zeroY))

const yLin = (I: number, full = fs.value) => zeroY - (I / full) * (zeroY - m.t)
function yLog(I: number) {
  const e = Math.max(LOG0 - 1, Math.log10(Math.abs(I) || 1e-30))
  return m.t + ((LOG1 - e) / (LOG1 - LOG0)) * ph
}
const yOf = (I: number) => (log.value ? yLog(I) : yLin(I))

watch(
  () => props.step,
  (s) => {
    log.value = !!s.viLog && s.tools.includes('logI')
    zoom.value = 1
  },
  { immediate: true },
)

const j = computed(() => junctionAt(props.T))
const I = computed(() => totalI(props.V, j.value))
watch(
  I,
  (i) => {
    if (zoom.value > 1) return
    if (i > 20e-3) base.value = 200e-3
    else if (i < 15e-3) base.value = 20e-3
  },
  { immediate: true },
)

/** 按像素逐点采样（另加 V = 0，使对数坐标在原点处的凹口画到底）；越界的点由裁剪框截掉 */
function curve(f: (V: number) => number, y: (I: number) => number = yOf, from = vLo.value, to = PN.Vmax) {
  const x0 = xOf(from)
  const x1 = xOf(to)
  const n = Math.max(1, Math.ceil(x1 - x0))
  const vs: number[] = []
  for (let i = 0; i <= n; i++) vs.push(vOf(x0 + ((x1 - x0) * i) / n))
  if (from < 0 && to > 0) vs.push(0)
  vs.sort((a, b) => a - b)
  const pts = vs.map((V) => `${xOf(V).toFixed(1)},${Math.max(m.t - 40, Math.min(bottom + 40, y(f(V)))).toFixed(1)}`)
  return 'M' + pts.join(' L')
}

const drawn = computed(() => props.unlock !== 'axes')
const main = computed(() => (drawn.value ? curve((V) => totalI(V, j.value)) : ''))
/** 对数坐标下的虚线：只计理想扩散电流（反向段；正向段与实线重合，不再画） */
const ideal = computed(() => (log.value && split.value ? curve((V) => shockley(V, j.value), yOf, vLo.value, 0) : ''))

/** 曲线标签放在哪：线性坐标放在曲线升到 80% 满量程（或横轴尽头）处；对数坐标放在反向平台上 */
function labelAt(jt: Junction, full = fs.value) {
  if (log.value && split.value) return { x: m.l + 4, y: yLog(totalI(PN.Vmin, jt)) - 5 }
  const Ilab = Math.min(0.8 * full, totalI(PN.Vmax, jt))
  return { x: xOf(diodeV(Ilab, jt)) + 5, y: yLin(Ilab, full) + 4 }
}

/** 温度工具：淡色画出 −40 / 25 / 125 °C 的曲线作参照（与当前温度相同的那条省略） */
const REF_T = [-40, 25, 125]
const refs = computed(() => {
  if (!drawn.value || !has('temp')) return []
  return REF_T.filter((t) => Math.abs(t - props.T) > 2).map((t) => {
    const jt = junctionAt(t)
    return { t, d: curve((V) => totalI(V, jt)), at: labelAt(jt) }
  })
})

/** 纵轴放大后，淡色保留放大前的画面，看"拐点"怎样左移 */
const ghosts = computed(() => {
  if (!drawn.value || log.value) return []
  const list = []
  for (let k = 1; k < zoom.value; k *= 10) {
    const full = base.value / k
    const Ilab = 0.8 * full
    list.push({
      k,
      d: curve((V) => totalI(V, j.value), (i) => yLin(i, full)),
      at: { x: xOf(diodeV(Ilab, j.value)) - 5, y: yLin(Ilab, full) + 4 },
    })
  }
  return list
})

const clampY = (y: number) => Math.max(m.t - 2, Math.min(bottom, y))
const pt = computed(() => ({ x: xOf(props.V), y: clampY(yOf(I.value)) }))

/** 交流小信号：曲线上被扫过的一段，以及此刻的瞬时工作点（ac 每帧更新，曲线段只随幅度重算） */
const acAmp = computed(() => props.ac?.amp ?? 0)
const acPath = computed(() => {
  const a = acAmp.value
  return a && drawn.value ? curve((V) => totalI(V, j.value), yOf, Math.max(vLo.value, props.V - a), props.V + a) : ''
})
const acPt = computed(() => {
  if (!props.ac || !drawn.value) return null
  const v = props.V + props.ac.v
  return { x: xOf(v), y: clampY(yOf(totalI(v, j.value))) }
})

/** 反向时的两个分量（对数坐标下显示） */
const parts = computed(() => {
  if (!log.value || props.V >= 0) return null
  const v = props.V
  return { diff: -shockley(v, j.value), gen: genI(v, j.value) * (1 - Math.exp(v / (2 * j.value.VT))) }
})

// ── 刻度
const ticksV = computed(() => [...(split.value ? [-2, -1] : []), 0.2, 0.4, 0.6, 0.8, 1, 1.2, 1.4])
const ticksI = computed(() => [1, 2, 3, 4].map((i) => (fs.value * i) / 4))
const mA = (i: number) => String(+(i * 1e3).toPrecision(3))
const DECADES = Array.from({ length: LOG1 - LOG0 + 1 }, (_, i) => LOG0 + i)
const LOG_LABEL: Record<number, string> = { [-15]: '1 fA', [-12]: '1 pA', [-9]: '1 nA', [-6]: '1 µA', [-3]: '1 mA', 0: '1 A' }

const keys = computed(() => ({
  log: drawn.value && log.value,
  ref: refs.value.length > 0,
  ghost: ghosts.value.length > 0,
}))

// ── 拖动
const clipId = `vi-clip-${useId()}`
/** 开关过程（0.8）里电压由换流决定，静态曲线只作对照，不能拖 */
const locked = computed(() => !!props.step.switching)
const listeners = useChartDrag({
  width: W,
  toValue: vOf,
  range: () => [vLo.value, PN.Vmax],
  current: () => props.V,
  step: 0.01,
  commit: (v) => {
    if (!locked.value) emit('update:V', v)
  },
})

function setLog(on: boolean) {
  log.value = on
  zoom.value = 1
}
</script>

<template>
  <section class="chart panel">
    <h3 class="panel-title">
      <Bi :t="U.title" />
      <span class="hint"><Bi :t="locked ? U.hintLocked : U.hint" /></span>
    </h3>
    <svg
      ref="plot"
      :viewBox="`0 0 ${W} ${H}`"
      class="plot"
      :class="{ drag: !locked }"
      role="slider"
      tabindex="0"
      :aria-label="tx(U.title)"
      :aria-valuemin="vLo"
      :aria-valuemax="PN.Vmax"
      :aria-valuenow="V"
      v-on="listeners"
    >
      <defs>
        <clipPath :id="clipId"><rect :x="m.l" :y="m.t - 4" :width="pw + 4" :height="ph + 4" /></clipPath>
      </defs>

      <rect v-if="split" :x="m.l" :y="m.t" :width="xOf(0) - m.l" :height="ph" class="zone" />

      <!-- 网格 -->
      <g class="grid">
        <line v-for="v in ticksV" :key="'gv' + v" :x1="xOf(v)" :x2="xOf(v)" :y1="m.t" :y2="bottom" />
        <template v-if="log">
          <line v-for="e in DECADES" :key="'ge' + e" :x1="m.l" :x2="m.l + pw" :y1="yLog(10 ** e)" :y2="yLog(10 ** e)" :class="{ major: e % 3 === 0 }" />
        </template>
        <template v-else>
          <line v-for="i in ticksI" :key="'gi' + i" :x1="m.l" :x2="m.l + pw" :y1="yLin(i)" :y2="yLin(i)" />
        </template>
      </g>

      <!-- 坐标轴：线性时纵轴在 V = 0 处；对数时纵轴在左边，V = 0 处画一条细线 -->
      <g class="axis">
        <line :x1="m.l" :x2="m.l + pw + 8" :y1="axisY" :y2="axisY" />
        <path :d="`M${m.l + pw + 8} ${axisY} l-8 -4 v8 z`" class="head" />
        <template v-if="log">
          <line :x1="m.l" :x2="m.l" :y1="bottom" :y2="m.t - 10" />
          <path :d="`M${m.l} ${m.t - 10} l-4 8 h8 z`" class="head" />
          <line v-if="split" :x1="xOf(0)" :x2="xOf(0)" :y1="bottom" :y2="m.t" class="v0" />
        </template>
        <template v-else>
          <line :x1="xOf(0)" :x2="xOf(0)" :y1="bottom" :y2="m.t - 10" />
          <path :d="`M${xOf(0)} ${m.t - 10} l-4 8 h8 z`" class="head" />
        </template>
        <path v-if="split" :d="`M${xOf(0) - 22} ${axisY - 6} l5 12 M${xOf(0) - 16} ${axisY - 6} l5 12`" class="brk" />
      </g>
      <g class="ticks">
        <text v-for="v in ticksV" :key="'tv' + v" :x="xOf(v)" :y="axisY + 16" text-anchor="middle">{{ minus(v) }}</text>
        <template v-if="log">
          <text v-for="(s, e) in LOG_LABEL" :key="'te' + e" :x="m.l - 6" :y="yLog(10 ** +e) + 4" text-anchor="end">{{ s }}</text>
          <text :x="m.l + 8" :y="m.t - 6" class="axis-name">|I|</text>
        </template>
        <template v-else>
          <text v-for="i in ticksI" :key="'ti' + i" :x="xOf(0) - 7" :y="yLin(i) + 4" text-anchor="end">{{ mA(i) }}</text>
          <text :x="xOf(0) + 8" :y="m.t - 6" class="axis-name">I / mA</text>
        </template>
        <text :x="m.l + pw + 6" :y="axisY - 8" text-anchor="end" class="axis-name">U / V</text>
      </g>
      <text v-if="split" :x="m.l + 6" :y="m.t + 14" class="note">{{ tx(U.axisBreak) }}</text>
      <text v-if="unlock === 'full'" :x="m.l" :y="Math.min(H - 6, axisY + 32)" class="note">← {{ tx(U.bv) }}</text>

      <g :clip-path="`url(#${clipId})`">
        <g v-for="g in ghosts" :key="'g' + g.k">
          <path :d="g.d" class="curve ghost" />
          <text :x="g.at.x" :y="g.at.y" class="tag" text-anchor="end">×{{ g.k }}</text>
        </g>
        <g v-for="r in refs" :key="'r' + r.t">
          <path :d="r.d" class="curve ref" />
          <text :x="r.at.x" :y="r.at.y" class="tag">{{ minus(r.t) }} °C</text>
        </g>
        <path v-if="ideal" :d="ideal" class="curve ideal" />
        <path v-if="main" :d="main" class="curve" />
        <path v-if="acPath" :d="acPath" class="curve swing" />
      </g>
      <circle v-if="acPt" :cx="acPt.x" :cy="acPt.y" r="4.5" class="ac-dot" />

      <!-- 工作点 -->
      <line :x1="pt.x" :x2="pt.x" :y1="axisY" :y2="pt.y" class="guide" />
      <g class="op" :transform="`translate(${pt.x} ${pt.y})`">
        <circle r="13" class="halo" />
        <circle r="7.5" class="dot" />
      </g>
    </svg>

    <ul v-if="keys.log || keys.ref || keys.ghost" class="keys">
      <template v-if="keys.log">
        <li><i class="sw" /><Bi :t="U.total" /></li>
        <li><i class="sw dash" /><Bi :t="U.ideal" /></li>
      </template>
      <li v-if="keys.ref"><i class="sw faint" /><Bi :t="U.ref" /></li>
      <li v-if="keys.ghost"><i class="sw faint dash" /><Bi :t="U.ghost" /></li>
    </ul>
    <p v-if="split && !log" class="vi-note"><Bi :t="U.revFlat" /></p>

    <div v-if="has('yzoom') || has('logI')" class="controls">
      <template v-if="has('yzoom')">
        <button class="btn" :disabled="zoom >= ZOOM_MAX" @click="zoom *= 10"><Bi :t="U.zoomIn" /></button>
        <button class="btn" :disabled="zoom === 1" @click="zoom = 1"><Bi :t="U.zoomReset" /></button>
        <span class="zoom-val">×{{ zoom }}</span>
      </template>
      <div v-if="has('logI')" class="seg" role="group" :aria-label="tx(U.scale)">
        <button :aria-pressed="!log" @click="setLog(false)"><Bi :t="U.lin" /></button>
        <button :aria-pressed="log" @click="setLog(true)"><Bi :t="U.log" /></button>
      </div>
    </div>

    <div class="readout">
      <span><b>U</b> = {{ minus(+V.toFixed(2)) }} V</span>
      <span><b>I</b> = {{ formatCurrent(I) }}</span>
      <template v-if="parts">
        <span class="part"><Bi :t="U.diff" /> {{ formatCurrent(parts.diff) }}</span>
        <span class="part"><Bi :t="U.gen" /> {{ formatCurrent(parts.gen) }}</span>
      </template>
    </div>
  </section>
</template>

<style scoped>
.grid line.major {
  stroke-opacity: 0.16;
}
.axis line,
.brk {
  stroke: var(--ink);
  stroke-width: 1.8;
  fill: none;
}
.axis line.v0 {
  stroke-width: 1;
  stroke-opacity: 0.5;
  stroke-dasharray: 3 3;
}
.head {
  fill: var(--ink);
}
.zone {
  fill: var(--potential);
  opacity: 0.06;
}
.curve {
  fill: none;
  stroke: var(--electron);
  stroke-width: 3.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.curve.ideal {
  stroke-width: 2.2;
  stroke-dasharray: 7 5;
}
.curve.ref,
.curve.ghost {
  stroke: var(--ink-soft);
  stroke-width: 1.8;
  stroke-opacity: 0.55;
}
.curve.ghost {
  stroke-dasharray: 6 4;
}
[data-style='sticker'] .curve:not(.ref, .ghost, .ideal) {
  stroke-width: 4.5;
}
[data-style='glow'] .curve:not(.ref, .ghost) {
  filter: drop-shadow(0 0 6px var(--electron));
}
.curve.swing {
  stroke: var(--accent);
  stroke-width: 7;
  stroke-opacity: 0.45;
  filter: none;
}
.ac-dot {
  fill: var(--surface);
  stroke: var(--accent);
  stroke-width: 2.5;
}
.note,
.tag {
  font-size: 10.5px;
  fill: var(--ink-soft);
}
.tag {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.guide {
  stroke: var(--accent);
  stroke-dasharray: 4 4;
  stroke-width: 1.5;
}

.keys .sw { border-color: var(--electron); }
.sw.dash { border-top-style: dashed; }
.sw.faint { border-top-width: 2px; border-color: var(--ink-soft); opacity: 0.7; }
.vi-note {
  margin: 0;
  font-size: 0.76rem;
  color: var(--ink-soft);
}

.controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}
.zoom-val {
  font-family: var(--font-display);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--accent);
}

.readout .part {
  font-size: 0.85rem;
  color: var(--ink-soft);
}
</style>
