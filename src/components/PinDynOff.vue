<script setup lang="ts">
// 1.4-2 关断：反向恢复。左：测试电路；右：i(t)、u(t)，标出 t₀、结开始阻断、t_s、t_f、t_rr、Q_rr、U_RM；
// 下：此刻 N⁻ 区的等离子体与空间电荷区。都来自 pinTransient.ts 的模型
import { computed } from 'vue'
import Bi from './Bi.vue'
import CircuitSvg from './CircuitSvg.vue'
import PinRefNote from './PinRefNote.vue'
import PinWavePlot from './PinWavePlot.vue'
import PinPlasmaPlot from './PinPlasmaPlot.vue'
import TimeScrub from './TimeScrub.vue'
import { tx } from '../app/settings'
import { useTimeCursor } from '../app/useTimeCursor'
import { CIRCUIT, T_OFF, dynWaves, frameAt, tOfURM } from '../devices/power-diode/dynWaves'
import { UI_DYN as U } from '../devices/power-diode/sections/uiDyn'
import { UI } from '../devices/power-diode/sections/ui'

const d = dynWaves()
const r = d.rr
const c = useTimeCursor(T_OFF, 9)
const fr = computed(() => frameAt(d.off, c.t.value))
const ns = (s: number) => Math.round(s * 1e9)

const phase = computed(() => {
  const t = c.t.value
  if (t <= 0) return U.off.pre
  if (t < r.t0) return U.off.fall
  if (t < r.tBlock) return U.off.store
  if (t < r.tEnd) return U.off.block
  if (t < r.tEnd + 110e-9) return U.off.ring
  return U.off.done
})
const marks = [{ t: r.t0, label: U.marks.t0 }, { t: r.tBlock, label: tx(U.marks.block) }]
const spans = [
  { t1: r.t0, t2: r.tBlock, label: 't_s', row: 0 },
  { t1: r.tBlock, t2: r.tEnd, label: 't_f', row: 0 },
  { t1: r.t0, t2: r.tEnd, label: 't_rr', row: 1 },
]
const hlines = [
  { y: -CIRCUIT.IR, ch: 'i' as const, label: '−I_R' },
  { y: -0.25 * CIRCUIT.IR, ch: 'i' as const, label: '0.25 I_R', cls: 'acc' },
  { y: -CIRCUIT.UR, ch: 'u' as const, label: '−U_R' },
]
const tU = tOfURM(d.offS)
const dots = [
  { t: tU, ch: 'u' as const, label: `U_RM ≈ ${r.URM.toFixed(0)} V`, below: true },
  { t: tU + 22e-9, ch: 'u' as const, label: tx(U.ringKey) },
]
const done = computed(() => c.t.value >= r.tEnd)
</script>

<template>
  <section class="stage panel">
    <PinRefNote :extra="false" />
    <TimeScrub :c="c" />
    <div class="pst-grid">
      <figure class="chart sp">
        <h3 class="panel-title"><Bi :t="U.wave" /></h3>
        <PinWavePlot
          :series="[{ s: d.offS }]"
          :t="c.t.value"
          :t-max="T_OFF"
          :i-lim="[-40, 40]"
          :u-lim="[-800, 100]"
          :i-ticks="[-30, -15, 0, 15, 30]"
          :u-ticks="[-800, -600, -400, -200, 0]"
          :marks="marks"
          :spans="spans"
          :hlines="hlines"
          :shade="{ t1: r.t0, t2: r.tEnd }"
          :dots="dots"
        />
        <ul class="keys">
          <li><i class="sw i" />i(t)</li>
          <li><i class="sw u" />u(t)</li>
          <li><i class="sw qrr" /><Bi :t="U.qrr" /></li>
          <li><i class="sw acc" /><Bi :t="U.lim" /></li>
        </ul>
      </figure>
      <figure class="chart sp circ">
        <h3 class="panel-title"><Bi :t="U.circuit" /></h3>
        <CircuitSvg :to-u1="c.t.value <= 0" :i="fr.i" :u="fr.u" :i-ref="CIRCUIT.IF" unit="A" :U1="CIRCUIT.U1" :UR="CIRCUIT.UR" :R="`${CIRCUIT.R} Ω`" :L="`${CIRCUIT.L * 1e6} µH`" />
        <p class="pst-state"><Bi :t="phase" /></p>
      </figure>
    </div>
    <div class="pst-grid">
      <figure class="chart sp">
        <h3 class="panel-title"><Bi :t="U.plasma" /><span class="hint"><Bi :t="U.plasmaHint" /></span></h3>
        <PinPlasmaPlot :frame="fr" :x="d.off.x" :p-max="d.pMax" />
      </figure>
      <div class="pst-side">
        <dl class="pst-ro">
          <dt><Bi :t="U.ro.t" /></dt>
          <dd><b>{{ ns(c.t.value) }}</b> ns</dd>
          <dt><Bi :t="U.ro.i" /></dt>
          <dd><b class="acc">{{ fr.i.toFixed(1) }}</b> A</dd>
          <dt><Bi :t="U.ro.u" /></dt>
          <dd><b class="pot">{{ fr.u.toFixed(0) }}</b> V</dd>
          <dt><Bi :t="U.metrics.QF" /></dt>
          <dd><b>{{ (d.off.Q0 * 1e6).toFixed(1) }}</b> µC</dd>
          <template v-if="done">
            <dt><Bi :t="U.metrics.ts" /></dt>
            <dd><b>{{ ns(r.ts) }}</b> ns</dd>
            <dt><Bi :t="U.metrics.tf" /></dt>
            <dd><b>{{ ns(r.tf) }}</b> ns</dd>
            <dt><Bi :t="U.metrics.trr" /></dt>
            <dd><b>{{ ns(r.trr) }}</b> ns</dd>
            <dt><Bi :t="U.metrics.Qrr" /></dt>
            <dd><b>{{ (r.Qrr * 1e6).toFixed(1) }}</b> µC</dd>
            <dt><Bi :t="U.metrics.URM" /></dt>
            <dd><b class="danger">{{ r.URM.toFixed(0) }}</b> V</dd>
          </template>
        </dl>
      </div>
    </div>
    <p class="scaled"><Bi :t="UI.scaled.dynOff" /></p>
  </section>
</template>

<style scoped>
.circ { border: 2px solid var(--accent); border-radius: 12px; }
.sw.i { border-color: var(--electron); }
.sw.u { border-color: var(--potential); }
.sw.acc { border-color: var(--accent); border-top-style: dashed; }
.sw.qrr { height: 10px; border: none; background: color-mix(in srgb, var(--accent) 30%, transparent); }
</style>
