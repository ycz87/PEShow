<script setup lang="ts">
// 1.4-1 开通：正向恢复。左：测试电路（与 0.8 相同，600 V、30 A）；右：i(t)、u(t)；下：此刻 N⁻ 区的等离子体分布。
// 波形与分布都来自 pinTransient.ts 的模型
import { computed } from 'vue'
import Bi from './Bi.vue'
import CircuitSvg from './CircuitSvg.vue'
import PinRefNote from './PinRefNote.vue'
import PinWavePlot from './PinWavePlot.vue'
import PinPlasmaPlot from './PinPlasmaPlot.vue'
import TimeScrub from './TimeScrub.vue'
import { useTimeCursor } from '../app/useTimeCursor'
import { CIRCUIT, T_ON, TFR_FRAC, dynWaves, frameAt } from '../devices/power-diode/dynWaves'
import { UI_DYN as U } from '../devices/power-diode/sections/uiDyn'
import { UI } from '../devices/power-diode/sections/ui'

const d = dynWaves()
const c = useTimeCursor(T_ON, 9)
const fr = computed(() => frameAt(d.on, c.t.value))
const ns = (s: number) => Math.round(s * 1e9)

const phase = computed(() => {
  const t = c.t.value
  if (t <= 0) return U.on.pre
  if (t < d.fr.tPeak) return U.on.rise
  if (t < d.fr.tfr) return U.on.fall
  return U.on.done
})
const marks = [{ t: d.fr.tfr, label: U.marks.tfr }]
const hlines = [{ y: TFR_FRAC * d.fr.UF, ch: 'u' as const, label: '1.5 U_F', cls: 'acc' }, { y: CIRCUIT.IF, ch: 'i' as const, label: 'I_F' }]
const dots = [{ t: d.fr.tPeak, ch: 'u' as const, label: `U_FRM ≈ ${d.fr.UFRM.toFixed(0)} V` }]
const done = computed(() => c.t.value >= d.fr.tfr)
</script>

<template>
  <section class="stage panel">
    <PinRefNote :extra="false" />
    <TimeScrub :c="c" />
    <div class="pst-grid">
      <figure class="chart sp">
        <h3 class="panel-title"><Bi :t="U.wave" /></h3>
        <PinWavePlot :series="[{ s: d.onS }]" :t="c.t.value" :t-max="T_ON" :i-lim="[0, 40]" :u-lim="[0, 20]" :i-ticks="[0, 10, 20, 30, 40]" :u-ticks="[0, 5, 10, 15, 20]" :marks="marks" :hlines="hlines" :dots="dots" />
        <ul class="keys">
          <li><i class="sw i" />i(t)</li>
          <li><i class="sw u" />u(t)</li>
          <li><i class="sw acc" /><Bi :t="U.ufLine" /></li>
        </ul>
      </figure>
      <figure class="chart sp circ">
        <h3 class="panel-title"><Bi :t="U.circuit" /></h3>
        <CircuitSvg :to-u1="c.t.value > 0" :i="fr.i" :u="fr.u" :i-ref="CIRCUIT.IF" unit="A" :U1="CIRCUIT.U1" :UR="CIRCUIT.UR" :R="`${CIRCUIT.R} Ω`" :L="`${CIRCUIT.L * 1e6} µH`" />
        <p class="pst-state"><Bi :t="phase" /></p>
      </figure>
    </div>
    <div class="pst-grid">
      <figure class="chart sp">
        <h3 class="panel-title"><Bi :t="U.plasma" /><span class="hint"><Bi :t="U.plasmaHint" /></span></h3>
        <PinPlasmaPlot :frame="fr" :x="d.on.x" :p-max="d.pMax" />
      </figure>
      <div class="pst-side">
        <dl class="pst-ro">
          <dt><Bi :t="U.ro.t" /></dt>
          <dd><b>{{ ns(c.t.value) }}</b> ns</dd>
          <dt><Bi :t="U.ro.i" /></dt>
          <dd><b class="acc">{{ fr.i.toFixed(1) }}</b> A</dd>
          <dt><Bi :t="U.ro.u" /></dt>
          <dd><b class="pot">{{ fr.u.toFixed(1) }}</b> V</dd>
          <template v-if="c.t.value >= d.fr.tPeak">
            <dt><Bi :t="U.metrics.UFRM" /></dt>
            <dd><b class="danger">{{ d.fr.UFRM.toFixed(1) }}</b> V <small>（{{ ns(d.fr.tPeak) }} ns）</small></dd>
          </template>
          <template v-if="done">
            <dt><Bi :t="U.metrics.tfr" /></dt>
            <dd><b>{{ ns(d.fr.tfr) }}</b> ns</dd>
          </template>
        </dl>
      </div>
    </div>
    <p class="scaled"><Bi :t="UI.scaled.dynOn" /></p>
  </section>
</template>

<style scoped>
.circ { border: 2px solid var(--accent); border-radius: 12px; }
.sw.i { border-color: var(--electron); }
.sw.u { border-color: var(--potential); }
.sw.acc { border-color: var(--accent); border-top-style: dashed; }
</style>
