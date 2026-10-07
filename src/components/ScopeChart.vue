<script setup lang="ts">
// 动态特性（0.8）：二极管电流 i(t)（上）与端电压 u(t)（下），像示波器一样随舞台上的换流过程逐渐画出。
// 波形由扩散方程与外电路联立算出（recovery.ts）；关断时按步骤逐渐标出 t₀、t₁、t₂、I_RM、U_RM、Q_rr 等
import { computed, useId } from 'vue'
import Bi from './Bi.vue'
import { tx } from '../app/settings'
import { minus } from '../app/format'
import { endTime, type SwitchLive } from '../app/switching'
import { sampleAt, type SwitchKind, type Waveform } from '../engine/physics/recovery'
import { diodeV } from '../engine/physics/pn'
import { UI } from '../devices/pn-junction/sections/ui'

/** fixed：只画某一种过程的完整波形（开通与关断对比一步）；不给时跟着舞台的换流过程画 */
const props = defineProps<{ live: SwitchLive | null; fixed?: SwitchKind }>()
const U = UI.scope

const revealId = `scope-reveal-${useId()}`
const W = 440
const H = 340
const m = { l: 50, r: 46, t: 24, b: 30 }
const pw = W - m.l - m.r
const GAP = 24
const panelH = (H - m.t - m.b - GAP) / 2
const iTop = m.t
const iBot = iTop + panelH
const vTop = iBot + GAP
const vBot = vTop + panelH

/** 换流开始前显示 1 µs 的稳态 */
const T0 = -1e-6
const w = computed(() => (props.fixed ? props.live?.pair?.[props.fixed] : props.live?.w) ?? null)
const ghost = computed(() => (props.fixed ? props.live?.ghostPair?.[props.fixed] : props.live?.ghost) ?? null)
/** 静态显示整段波形：对比一步的两张图，以及 0.8-1 的关断预览 */
const preview = computed(() => !props.fixed && props.live?.mode === 'intro')
const whole = computed(() => !!props.fixed || preview.value)
const title = computed(() => (props.fixed === 'on' ? U.titleOn : props.fixed === 'off' ? U.titleOff : preview.value ? U.titlePreview : U.title))
const all = computed(() => [w.value, ghost.value].filter((x): x is Waveform => !!x))
const isOn = computed(() => w.value?.kind === 'on')
const T1 = computed(() => Math.max(...all.value.map(endTime)))
const X = (t: number) => m.l + ((t - T0) / (T1.value - T0)) * pw

/** 刻度间隔：取 1、2、5 × 10ⁿ 中使刻度不超过 n 个的最小者 */
function niceStep(span: number, n: number) {
  const e = 10 ** Math.floor(Math.log10(span / n))
  return [1, 2, 5, 10].map((k) => k * e).find((s) => span / s <= n)!
}
function ticks(lo: number, hi: number, n: number) {
  const s = niceStep(hi - lo, n)
  const list: number[] = []
  for (let v = Math.ceil(lo / s) * s; v <= hi + 1e-12; v += s) list.push(+v.toPrecision(6))
  return list
}

// ── 纵轴范围（mA、V）：包住本次与上一次的波形
const iR = computed(() => {
  let lo = 0
  let hi = 0
  for (const x of all.value) for (const v of x.i) { lo = Math.min(lo, v); hi = Math.max(hi, v) }
  hi *= 1e3
  lo = isOn.value ? -0.15 * hi : lo * 1e3
  return { lo: lo * 1.12, hi: hi * 1.18 }
})
const vR = computed(() => {
  let lo = 0
  let hi = 0
  for (const x of all.value) for (const v of x.v) { lo = Math.min(lo, v); hi = Math.max(hi, v) }
  return { lo: lo * 1.12, hi: Math.max(1, hi * 1.3) }
})
const Yi = (iA: number) => iBot - ((iA * 1e3 - iR.value.lo) / (iR.value.hi - iR.value.lo)) * panelH
const Yv = (v: number) => vBot - ((v - vR.value.lo) / (vR.value.hi - vR.value.lo)) * panelH
const iTicks = computed(() => ticks(iR.value.lo, iR.value.hi, 5))
const vTicks = computed(() => ticks(vR.value.lo, vR.value.hi, 4))
const tTicks = computed(() => ticks(0, T1.value * 1e6, 10))

/** 波形折线（约 500 点），前面接一段换流前的稳态 */
function trace(x: Waveform, a: Float64Array, Y: (v: number) => number, scale = 1) {
  const n = Math.min(a.length - 1, Math.round(endTime(x) / x.dt))
  const stride = Math.max(1, Math.ceil(n / 500))
  let d = `M${X(T0).toFixed(1)} ${Y(a[0] * scale).toFixed(1)}`
  for (let k = 0; k <= n; k += stride) d += `L${X(k * x.dt).toFixed(1)} ${Y(a[k] * scale).toFixed(1)}`
  return d
}
const paths = computed(() => {
  const x = w.value
  if (!x) return null
  return {
    i: trace(x, x.i, Yi),
    v: trace(x, x.v, Yv),
    // 开通时把存储电荷画在电流图上：Q_F 对应 I_F 的高度
    q: isOn.value ? trace(x, x.q, Yi, x.p.IF / x.QF) : '',
  }
})
const ghostPaths = computed(() => {
  const x = ghost.value
  return x ? { i: trace(x, x.i, Yi), v: trace(x, x.v, Yv) } : null
})

// ── 光标：换流开始后的时刻；画到光标为止
const t = computed(() => props.live?.t ?? 0)
const tShow = computed(() => {
  if (whole.value) return w.value ? endTime(w.value) : 0
  return props.live?.phase === 'settle' || props.live?.phase === 'ready' ? 0 : t.value
})
const cursorX = computed(() => X(tShow.value))
/** 光标与读数（整段显示时不要） */
const now = computed(() => (w.value && !whole.value ? sampleAt(w.value, tShow.value) : null))

// ── 标注：随步骤逐渐增加，而且光标走到那一刻才出现
const LEVEL: Record<string, number> = { intro: 0, off: 1, peak: 2, recover: 3, vi: 3 }
const level = computed(() => (props.fixed ? 3 : props.live ? LEVEL[props.live.mode] ?? 0 : 0))
const done = computed(() => whole.value || props.live?.phase === 'done')
const reached = (time: number) => done.value || tShow.value >= time - 1e-12

const mk = computed(() => w.value?.m ?? null)
/** Q_rr 阴影：t₀–t₂ 之间反向电流与零线围成的面积 */
const qrrPath = computed(() => {
  const x = w.value
  const r = mk.value
  if (!x || !r) return ''
  const k0 = Math.ceil(r.t0 / x.dt)
  const k2 = Math.min(x.i.length - 1, Math.floor(r.t2 / x.dt))
  let d = `M${X(r.t0).toFixed(1)} ${Yi(0).toFixed(1)}`
  for (let k = k0; k <= k2; k += 2) d += `L${X(k * x.dt).toFixed(1)} ${Yi(x.i[k]).toFixed(1)}`
  return `${d}L${X(k2 * x.dt).toFixed(1)} ${Yi(0).toFixed(1)}Z`
})
/** 关断的谷底：电压最负处 */
const vPeak = computed(() => {
  const x = w.value
  if (!x || !mk.value) return null
  let k = 0
  for (let q = 1; q < x.v.length; q++) if (x.v[q] < x.v[k]) k = q
  return { t: k * x.dt, v: x.v[k] }
})
const UF = computed(() => (w.value ? diodeV(w.value.p.IF) : 0))

/** 此刻处在哪个阶段（讲解提示） */
const phaseText = computed(() => {
  const x = w.value
  if (!x || !props.live || whole.value) return null
  const P = U.phase
  const before = props.live.phase === 'settle' || props.live.phase === 'ready'
  if (x.kind === 'on') {
    if (before) return P.onBefore
    return now.value!.v < 0.9 * UF.value ? P.onRise : P.onFill
  }
  const r = x.m!
  if (before) return P.offBefore
  if (tShow.value < r.t0) return P.offFall
  if (tShow.value < r.t1) return P.offRev
  if (tShow.value < r.t2) return P.offBlock
  return P.offDone
})

// ── 读数
const f = (v: number, d: number) => minus(v.toFixed(d))
const us = (s: number) => `${(s * 1e6).toFixed(2)} µs`
const metricRows = computed(() => {
  const rows: { cls: string; r: NonNullable<Waveform['m']>; QF: number }[] = []
  if (mk.value && w.value && level.value >= 3 && done.value) rows.push({ cls: 'cur', r: mk.value, QF: w.value.QF })
  if (ghost.value?.m) rows.push({ cls: 'old', r: ghost.value.m, QF: ghost.value.QF })
  return rows
})
const ifText = (x: Waveform) => `I_F = ${Math.round(x.p.IF * 1e3)} mA, di_F/dt = ${Math.round(x.p.didt / 1e3)} mA/µs`
</script>

<template>
  <section class="chart panel">
    <h3 class="panel-title">
      <Bi :t="title" />
      <span class="hint"><Bi :t="U.hint" /></span>
    </h3>
    <svg v-if="w && paths" :viewBox="`0 0 ${W} ${H}`" class="plot" role="img" :aria-label="tx(U.title)">
      <defs>
        <clipPath :id="revealId"><rect :x="0" :y="0" :width="cursorX" :height="H" /></clipPath>
      </defs>
      <!-- 网格与坐标轴 -->
      <g class="grid">
        <line v-for="v in tTicks" :key="'gt' + v" :x1="X(v * 1e-6)" :x2="X(v * 1e-6)" :y1="iTop" :y2="iBot" />
        <line v-for="v in tTicks" :key="'gu' + v" :x1="X(v * 1e-6)" :x2="X(v * 1e-6)" :y1="vTop" :y2="vBot" />
        <line v-for="v in iTicks" :key="'gi' + v" :x1="m.l" :x2="m.l + pw" :y1="Yi(v * 1e-3)" :y2="Yi(v * 1e-3)" />
        <line v-for="v in vTicks" :key="'gv' + v" :x1="m.l" :x2="m.l + pw" :y1="Yv(v)" :y2="Yv(v)" />
      </g>
      <g class="axis">
        <line :x1="m.l" :x2="m.l" :y1="iTop" :y2="iBot" />
        <line :x1="m.l" :x2="m.l" :y1="vTop" :y2="vBot" />
        <line :x1="m.l" :x2="m.l + pw" :y1="Yi(0)" :y2="Yi(0)" />
        <line :x1="m.l" :x2="m.l + pw" :y1="Yv(0)" :y2="Yv(0)" />
        <line :x1="X(0)" :x2="X(0)" :y1="iTop" :y2="vBot" class="t0" />
      </g>
      <g class="ticks">
        <text v-for="v in iTicks" :key="'ti' + v" :x="m.l - 6" :y="Yi(v * 1e-3) + 4" text-anchor="end">{{ minus(v) }}</text>
        <text v-for="v in vTicks" :key="'tv' + v" :x="m.l - 6" :y="Yv(v) + 4" text-anchor="end">{{ minus(v) }}</text>
        <text v-for="v in tTicks" :key="'tt' + v" :x="X(v * 1e-6)" :y="vBot + 16" text-anchor="middle">{{ v }}</text>
        <text :x="m.l + 6" :y="iTop - 8" class="axis-name i">i / mA</text>
        <text :x="m.l + 6" :y="vTop - 8" class="axis-name v">u / V</text>
        <text :x="m.l + pw + 12" :y="vBot + 16" class="axis-name">t / µs</text>
      </g>

      <!-- 上一次的波形（对比） -->
      <g v-if="ghostPaths" class="ghost">
        <path :d="ghostPaths.i" class="trace i" />
        <path :d="ghostPaths.v" class="trace v" />
      </g>

      <!-- 恒定的参考线：开通的 I_F（= Q_F）与 U_F；关断的 −U_R -->
      <template v-if="isOn">
        <line :x1="m.l" :x2="m.l + pw" :y1="Yi(w.p.IF)" :y2="Yi(w.p.IF)" class="level" />
        <text :x="m.l + pw + 4" :y="Yi(w.p.IF) + 4" class="lbl">I<tspan class="sub" dy="3">F</tspan><tspan dy="-3">, Q</tspan><tspan class="sub" dy="3">F</tspan></text>
        <line :x1="m.l" :x2="m.l + pw" :y1="Yv(UF)" :y2="Yv(UF)" class="level" />
        <text :x="m.l + pw + 4" :y="Yv(UF) + 4" class="lbl">U<tspan class="sub" dy="3">F</tspan></text>
        <line :x1="m.l" :x2="m.l + pw" :y1="Yv(-w.p.VR)" :y2="Yv(-w.p.VR)" class="level" />
        <text :x="m.l + pw + 4" :y="Yv(-w.p.VR) + 4" class="lbl">−U<tspan class="sub" dy="3">R</tspan></text>
      </template>
      <template v-else-if="level >= 3">
        <line :x1="m.l" :x2="m.l + pw" :y1="Yv(-w.p.VR)" :y2="Yv(-w.p.VR)" class="level" />
        <text :x="m.l + pw + 4" :y="Yv(-w.p.VR) + 4" class="lbl">−U<tspan class="sub" dy="3">R</tspan></text>
      </template>

      <!-- 本次波形：画到光标为止 -->
      <g :clip-path="`url(#${revealId})`">
        <path v-if="level >= 3 && qrrPath" :d="qrrPath" class="qrr" />
        <path v-if="paths.q" :d="paths.q" class="trace q" />
        <path :d="paths.i" class="trace i" />
        <path :d="paths.v" class="trace v" />
      </g>

      <!-- 关断的特征时刻与参数 -->
      <g v-if="mk" class="marks">
        <!-- di_F/dt 只在前几步标出；第 3 级标注的 t_rr 横线会穿过它 -->
        <text v-if="level < 3 && reached(mk.t0 / 2)" :x="X(mk.t0 / 2) + 6" :y="Yi(w.p.IF / 2) - 4" class="lbl">di<tspan class="sub" dy="3">F</tspan><tspan dy="-3">/dt</tspan></text>
        <template v-if="level >= 1 && reached(mk.t0)">
          <line :x1="X(mk.t0)" :x2="X(mk.t0)" :y1="iTop" :y2="vBot" class="tmark" />
          <text :x="X(mk.t0)" :y="iTop - 8" text-anchor="middle" class="lbl">t<tspan class="sub" dy="3">0</tspan></text>
        </template>
        <template v-if="level >= 2 && reached(mk.t1)">
          <line :x1="X(mk.t1)" :x2="X(mk.t1)" :y1="iTop" :y2="vBot" class="tmark" />
          <text :x="X(mk.t1)" :y="iTop - 8" text-anchor="middle" class="lbl">t<tspan class="sub" dy="3">1</tspan></text>
          <circle :cx="X(mk.t1)" :cy="Yi(-mk.IRP)" r="3.5" class="pt" />
          <text :x="X(mk.t1) - 6" :y="Yi(-mk.IRP) + 4" text-anchor="end" class="lbl">I<tspan class="sub" dy="3">RM</tspan></text>
        </template>
        <template v-if="level >= 3 && reached(mk.t2)">
          <line :x1="X(mk.t2)" :x2="X(mk.t2)" :y1="iTop" :y2="vBot" class="tmark" />
          <text :x="X(mk.t2)" :y="iTop - 8" text-anchor="middle" class="lbl">t<tspan class="sub" dy="3">2</tspan></text>
          <line :x1="X(mk.fit[0][0])" :y1="Yi(mk.fit[0][1])" :x2="X(mk.t2)" :y2="Yi(0)" class="fit" />
          <circle v-for="(p, k) in mk.fit" :key="'fp' + k" :cx="X(p[0])" :cy="Yi(p[1])" r="2.5" class="fit-pt" />
          <!-- t_a、t_b、t_rr 画在零线上方的空白处 -->
          <g class="span">
            <path :d="`M${X(mk.t0)} ${Yi(w.p.IF * 0.3)} H${X(mk.t1)} M${X(mk.t1)} ${Yi(w.p.IF * 0.3)} H${X(mk.t2)}`" />
            <path :d="`M${X(mk.t0)} ${Yi(w.p.IF * 0.75)} H${X(mk.t2)}`" />
            <text :x="(X(mk.t0) + X(mk.t1)) / 2" :y="Yi(w.p.IF * 0.3) - 4" text-anchor="middle">t<tspan class="sub" dy="3">a</tspan></text>
            <text :x="(X(mk.t1) + X(mk.t2)) / 2" :y="Yi(w.p.IF * 0.3) - 4" text-anchor="middle">t<tspan class="sub" dy="3">b</tspan></text>
            <text :x="(X(mk.t0) + X(mk.t2)) / 2" :y="Yi(w.p.IF * 0.75) - 4" text-anchor="middle">t<tspan class="sub" dy="3">rr</tspan></text>
          </g>
        </template>
        <template v-if="level >= 3 && vPeak && reached(vPeak.t)">
          <circle :cx="X(vPeak.t)" :cy="Yv(vPeak.v)" r="3.5" class="pt" />
          <text :x="X(vPeak.t) + 6" :y="Yv(vPeak.v) + 12" class="lbl">U<tspan class="sub" dy="3">RM</tspan></text>
        </template>
      </g>
      <!-- 开通：存储电荷堆到 90% 的时刻 -->
      <template v-if="isOn && w.t90 !== null && reached(w.t90)">
        <line :x1="X(w.t90)" :x2="X(w.t90)" :y1="iTop" :y2="vBot" class="tmark" />
        <text :x="X(w.t90) - 4" :y="iTop - 8" text-anchor="end" class="lbl q">0.9 Q<tspan class="sub" dy="3">F</tspan></text>
      </template>

      <!-- 光标 -->
      <g v-if="now" class="cursor">
        <line :x1="cursorX" :x2="cursorX" :y1="iTop" :y2="vBot" />
        <circle :cx="cursorX" :cy="Yi(now.i)" r="4.5" class="dot i" />
        <circle :cx="cursorX" :cy="Yv(now.v)" r="4.5" class="dot v" />
      </g>
    </svg>

    <p v-if="phaseText" class="phase"><Bi :t="phaseText" /></p>

    <ul v-if="w" class="keys">
      <li><i class="sw i" />i(t)</li>
      <li><i class="sw v" />u(t)</li>
      <li v-if="isOn"><i class="sw q" /><Bi :t="U.charge" /> Q(t)</li>
      <li v-if="ghost"><i class="sw ghost" /><Bi :t="U.ghost" /></li>
      <li v-if="level >= 3 && !isOn"><i class="sw qrr" /><Bi :t="U.qrr" /></li>
      <li v-if="level >= 3 && !isOn"><i class="sw fit" /><Bi :t="U.fit" /></li>
    </ul>

    <div v-if="now && w" class="readout">
      <span><b>t</b> = {{ f(tShow * 1e6, 2) }} µs</span>
      <span class="i"><b>i</b> = {{ f(now.i * 1e3, 2) }} mA</span>
      <span class="v"><b>u</b> = {{ f(now.v, 2) }} V</span>
      <span v-if="isOn" class="q"><b>Q</b> = {{ Math.round((now.q / w.QF) * 100) }}% Q<sub>F</sub></span>
      <span v-if="isOn && w.t90 !== null && done" class="q"><Bi :t="U.t90" /> {{ us(w.t90) }}</span>
    </div>
    <table v-if="metricRows.length" class="metrics">
      <thead>
        <tr>
          <th />
          <th>I<sub>RM</sub></th>
          <th>U<sub>RM</sub></th>
          <th>t<sub>a</sub></th>
          <th>t<sub>b</sub></th>
          <th>t<sub>rr</sub></th>
          <th>Q<sub>rr</sub> / Q<sub>F</sub></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in metricRows" :key="row.cls" :class="row.cls" :title="row.cls === 'cur' ? ifText(w!) : ghost ? ifText(ghost) : ''">
          <th><Bi :t="row.cls === 'cur' ? U.now : U.ghost" /></th>
          <td>{{ (row.r.IRP * 1e3).toFixed(1) }} mA</td>
          <td>{{ row.r.URP.toFixed(2) }} V</td>
          <td>{{ (row.r.td * 1e6).toFixed(2) }} µs</td>
          <td>{{ (row.r.tf * 1e6).toFixed(2) }} µs</td>
          <td>{{ (row.r.trr * 1e6).toFixed(2) }} µs</td>
          <td>{{ (row.r.Qrr * 1e9).toFixed(1) }} / {{ (row.QF * 1e9).toFixed(0) }} nC</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped>
.axis line {
  stroke: var(--ink);
  stroke-width: 1.5;
}
.axis line.t0 {
  stroke-width: 1;
  stroke-opacity: 0.35;
}
.ticks .axis-name.i { fill: var(--electron); }
.ticks .axis-name.v { fill: var(--potential); }
.trace {
  fill: none;
  stroke-width: 2.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.trace.i { stroke: var(--electron); }
.trace.v { stroke: var(--potential); }
.trace.q { stroke: var(--hole); stroke-width: 2; stroke-dasharray: 2 4; }
.ghost .trace {
  stroke-width: 1.8;
  stroke-dasharray: 5 4;
  opacity: 0.45;
}
[data-style='glow'] .trace.i { filter: drop-shadow(0 0 4px var(--electron)); }
[data-style='glow'] .trace.v { filter: drop-shadow(0 0 4px var(--potential)); }
.qrr {
  fill: var(--accent);
  fill-opacity: 0.22;
}
.level {
  stroke: var(--ink-soft);
  stroke-width: 1;
  stroke-dasharray: 3 4;
}
.lbl {
  font-size: 11px;
  font-weight: 700;
  font-style: italic;
  fill: var(--ink);
}
.lbl.q { fill: var(--hole); }
.tmark {
  stroke: var(--ink);
  stroke-opacity: 0.4;
  stroke-width: 1;
  stroke-dasharray: 2 3;
}
.pt {
  fill: var(--surface);
  stroke: var(--ink);
  stroke-width: 1.8;
}
.fit {
  stroke: var(--accent);
  stroke-width: 1.5;
  stroke-dasharray: 6 4;
}
.fit-pt { fill: var(--accent); }
.span path {
  stroke: var(--ink-soft);
  stroke-width: 1.2;
  marker-start: none;
}
.span text {
  font-size: 11px;
  font-style: italic;
  font-weight: 700;
  fill: var(--ink-soft);
}
.cursor line {
  stroke: var(--accent);
  stroke-width: 1.2;
  stroke-opacity: 0.6;
}
.cursor .dot {
  stroke: var(--line);
  stroke-width: 2;
}
.cursor .dot.i { fill: var(--electron); }
.cursor .dot.v { fill: var(--potential); }

.phase {
  margin: 0;
  padding: 6px 10px;
  border-left: 3px solid var(--accent);
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  border-radius: 0 8px 8px 0;
  font-size: 0.82rem;
  line-height: 1.45;
}

.sw.i { border-color: var(--electron); }
.sw.v { border-color: var(--potential); }
.sw.q { border-color: var(--hole); border-top-style: dotted; }
.sw.ghost { border-color: var(--ink-soft); border-top-style: dashed; opacity: 0.6; }
.sw.qrr { height: 10px; border: none; background: color-mix(in srgb, var(--accent) 30%, transparent); }
.sw.fit { border-color: var(--accent); border-top-width: 2px; border-top-style: dashed; }

.readout .i b { color: var(--electron); }
.readout .v b { color: var(--potential); }
.readout .q { color: var(--hole); }
.readout .q b { color: var(--hole); }

.metrics {
  border-collapse: collapse;
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
}
.metrics th,
.metrics td {
  padding: 2px 8px 2px 0;
  text-align: right;
  white-space: nowrap;
}
.metrics thead th {
  font-family: var(--font-display);
  font-style: italic;
  color: var(--ink-soft);
}
.metrics tbody th {
  text-align: left;
  font-weight: 700;
}
.metrics tr.old { color: var(--ink-soft); }
</style>
