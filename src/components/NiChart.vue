<script setup lang="ts">
// 载流子浓度–温度曲线（对数纵轴）：本征 nᵢ；掺杂时再画多子、少子与掺杂浓度。拖动可改温度（与舞台联动）
import { computed } from 'vue'
import Bi from './Bi.vue'
import { tx } from '../app/settings'
import { minus, pow10, sci } from '../app/format'
import { useChartDrag } from '../app/useChartDrag'
import { equilibrium, type Dopant } from '../engine/physics/doping'
import { TEMP } from '../engine/physics/pn'
import { UI } from '../devices/pn-junction/sections/ui'

const props = defineProps<{ T: number; dopant: Dopant; logN: number }>()
const emit = defineEmits<{ 'update:T': [number] }>()
const U = UI.lattice.ni

const W = 440
const H = 300
const m = { l: 50, r: 18, t: 18, b: 38 }
const pw = W - m.l - m.r
const ph = H - m.t - m.b
const T0 = -50
const T1 = 200
/** 纵轴 10² … 10¹⁸ cm⁻³ */
const E0 = 2
const E1 = 18
/** 硅器件常见的最高结温范围（°C） */
const TJ = [150, 175]

const xOf = (t: number) => m.l + ((t - T0) / (T1 - T0)) * pw
const tOf = (x: number) => T0 + ((x - m.l) / pw) * (T1 - T0)
const yOfE = (e: number) => m.t + ((E1 - e) / (E1 - E0)) * ph
const yOf = (v: number) => yOfE(Math.log10(v))

/** 只画在纵轴范围内的部分：越界处断开（少子在低温、高浓度时远低于 10²） */
function path(f: (t: number) => number) {
  let d = ''
  let pen = false
  for (let t = T0; t <= T1 + 1e-9; t += 2.5) {
    const v = f(t)
    const e = v > 0 ? Math.log10(v) : -Infinity
    if (e < E0 || e > E1) {
      pen = false
      continue
    }
    d += `${pen ? 'L' : 'M'}${xOf(t).toFixed(1)} ${yOfE(e).toFixed(1)} `
    pen = true
  }
  return d
}

const doped = computed(() => props.dopant !== 'none')
const eq = (t: number) => equilibrium(t, props.dopant, props.logN)
const curves = computed(() => {
  const ni = path((t) => eq(t).ni)
  if (!doped.value) return { ni }
  const P = props.dopant === 'P'
  return {
    ni,
    maj: path((t) => (P ? eq(t).n : eq(t).p)),
    min: path((t) => (P ? eq(t).p : eq(t).n)),
  }
})
/** 多子是电子（N 型）还是空穴（P 型），决定颜色 */
const majK = computed(() => (props.dopant === 'B' ? 'h' : 'e'))
const minK = computed(() => (props.dopant === 'B' ? 'e' : 'h'))

const now = computed(() => eq(props.T))
const inRange = computed(() => props.T >= T0 && props.T <= T1)
const dots = computed(() => {
  if (!inRange.value) return []
  const c = now.value
  const x = xOf(props.T)
  const P = props.dopant === 'P'
  const list: { k: string; v: number }[] = [{ k: 'ni', v: c.ni }]
  if (doped.value) list.push({ k: majK.value, v: P ? c.n : c.p }, { k: minK.value, v: P ? c.p : c.n })
  return list.filter((d) => d.v > 0 && Math.log10(d.v) >= E0 && Math.log10(d.v) <= E1).map((d) => ({ ...d, x, y: yOf(d.v) }))
})

const ticksT = [-50, 0, 50, 100, 150, 200]
const ticksE = [2, 4, 6, 8, 10, 12, 14, 16, 18]

const listeners = useChartDrag({
  width: W,
  toValue: tOf,
  range: () => [T0, TEMP.max],
  current: () => props.T,
  step: 1,
  commit: (t) => emit('update:T', t),
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
      :aria-valuemin="T0"
      :aria-valuemax="TEMP.max"
      :aria-valuenow="Math.round(T)"
      v-on="listeners"
    >
      <rect :x="xOf(TJ[0])" :y="m.t" :width="xOf(TJ[1]) - xOf(TJ[0])" :height="ph" class="zone" />
      <text :x="xOf(TJ[1]) - 4" :y="m.t + ph - 6" class="note" text-anchor="end">{{ tx(U.tMax) }}</text>

      <g class="grid">
        <line v-for="t in ticksT" :key="'gt' + t" :x1="xOf(t)" :x2="xOf(t)" :y1="m.t" :y2="m.t + ph" />
        <line v-for="e in ticksE" :key="'ge' + e" :x1="m.l" :x2="m.l + pw" :y1="yOfE(e)" :y2="yOfE(e)" />
      </g>
      <g class="axis">
        <line :x1="m.l" :x2="m.l + pw" :y1="m.t + ph" :y2="m.t + ph" />
        <line :x1="m.l" :x2="m.l" :y1="m.t + ph" :y2="m.t" />
      </g>
      <g class="ticks">
        <text v-for="t in ticksT" :key="'tt' + t" :x="xOf(t)" :y="m.t + ph + 15" text-anchor="middle">{{ minus(t) }}</text>
        <text v-for="e in ticksE" :key="'te' + e" :x="m.l - 6" :y="yOfE(e) + 4" text-anchor="end">{{ pow10(e) }}</text>
        <text :x="m.l + pw" :y="m.t + ph + 32" text-anchor="end" class="axis-name">T / °C</text>
        <text :x="m.l + 6" :y="m.t + 12" class="axis-name">cm⁻³</text>
      </g>

      <template v-if="doped">
        <line :x1="m.l" :x2="m.l + pw" :y1="yOfE(logN)" :y2="yOfE(logN)" class="dop" />
        <path :d="curves.min" class="curve min" :class="minK" />
        <path :d="curves.maj" class="curve" :class="majK" />
      </template>
      <path :d="curves.ni" class="curve ni" />

      <template v-if="inRange">
        <line :x1="xOf(T)" :x2="xOf(T)" :y1="m.t" :y2="m.t + ph" class="guide" />
        <circle v-for="d in dots" :key="d.k" :cx="d.x" :cy="d.y" r="5.5" class="dot" :class="d.k" />
      </template>
      <text v-else :x="m.l + 8" :y="m.t + ph - 22" class="note warn">{{ tx(U.offChart) }}</text>
    </svg>

    <ul class="keys">
      <li><i class="sw ni" /><Bi :t="U.ni" /></li>
      <template v-if="doped">
        <li><i class="sw" :class="majK" /><Bi :t="U.maj" /></li>
        <li><i class="sw dash" :class="minK" /><Bi :t="U.min" /></li>
        <li><i class="sw dash dop" /><Bi :t="U.N" /></li>
      </template>
    </ul>
    <div class="readout">
      <span><b>T</b> = {{ minus(Math.round(T)) }} °C</span>
      <span><b>n<sub>i</sub></b> = {{ sci(now.ni) }}</span>
      <template v-if="doped">
        <span class="e"><b>n</b> = {{ sci(now.n) }}</span>
        <span class="h"><b>p</b> = {{ sci(now.p) }}</span>
      </template>
    </div>
  </section>
</template>

<style scoped>
.axis line {
  stroke: var(--ink);
  stroke-width: 1.8;
}
.zone {
  fill: var(--ink);
  opacity: 0.06;
}
.note {
  font-size: 10.5px;
  fill: var(--ink-soft);
}
.note.warn {
  fill: var(--accent);
  font-weight: 700;
  font-size: 12px;
}
.curve {
  fill: none;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.curve.ni { stroke: var(--accent); }
.curve.e { stroke: var(--electron); }
.curve.h { stroke: var(--hole); }
.curve.min { stroke-dasharray: 7 5; stroke-width: 2.4; }
[data-style='sticker'] .curve { stroke-width: 4; }
[data-style='glow'] .curve.ni { filter: drop-shadow(0 0 5px var(--accent)); }
.dop {
  stroke: var(--ink-soft);
  stroke-width: 1.4;
  stroke-dasharray: 3 4;
}
.guide {
  stroke: var(--ink-soft);
  stroke-dasharray: 4 4;
  stroke-width: 1.2;
}
.dot {
  stroke: var(--line);
  stroke-width: 2;
}
.dot.ni { fill: var(--accent); }
.dot.e { fill: var(--electron); }
.dot.h { fill: var(--hole); }

.sw.ni { border-color: var(--accent); }
.sw.e { border-color: var(--electron); }
.sw.h { border-color: var(--hole); }
.sw.dash { border-top-style: dashed; }
.sw.dop { border-color: var(--ink-soft); border-top-width: 2px; }

.readout .e b { color: var(--electron); }
.readout .h b { color: var(--hole); }
</style>
