<script setup lang="ts">
// 1.4-3 手册的测法：电流按规定的 di_F/dt（500 A/µs）下降、回路杂散电感 50 nH 时，示例 PiN 的关断（模型算出），
// 按 STTH3012 图 1 的量法标出 t₀、I_RM、t_a、t_b、t_rr、Q_rr（t₂ 由过 I_RM 与 0.1 I_RM 的直线外推）；
// 下面是此刻 N⁻ 区的载流子，以及动态参数表与"测试条件不同，数值差几十倍"的对照
import { computed } from 'vue'
import Bi from './Bi.vue'
import Rich from './Rich.vue'
import PinRefNote from './PinRefNote.vue'
import PinWavePlot from './PinWavePlot.vue'
import PinPlasmaPlot from './PinPlasmaPlot.vue'
import PinParamTable from './PinParamTable.vue'
import TimeScrub from './TimeScrub.vue'
import { useTimeCursor } from '../app/useTimeCursor'
import { CIRCUIT, T_DIDT, dynWaves, frameAt, tOfURM } from '../devices/power-diode/dynWaves'
import { DYN_ROWS, UI_DYN as U } from '../devices/power-diode/sections/uiDyn'
import { UI } from '../devices/power-diode/sections/ui'

const d = dynWaves()
const r = d.rrD
const P = U.params
const c = useTimeCursor(T_DIDT, 9)
const fr = computed(() => frameAt(d.offD, c.t.value))
const ns = (s: number) => Math.round(s * 1e9)
const tBlock = d.offD.frames.find((f) => f.xL > 0)?.t ?? r.t1

const phase = computed(() => {
  const t = c.t.value
  if (t <= 0) return U.didt.pre
  if (t < tBlock) return U.didt.ramp
  if (t < r.t1) return U.didt.block
  if (t < r.t2 + 15e-9) return U.didt.tail
  return U.didt.done
})
const marks = [{ t: r.t0, label: U.marks.t0 }]
const spans = [
  { t1: r.t0, t2: r.t1, label: 't_a', row: 0 },
  { t1: r.t1, t2: r.t2, label: 't_b', row: 0 },
  { t1: r.t0, t2: r.t2, label: 't_rr', row: 1 },
]
const hlines = [{ y: -CIRCUIT.UR, ch: 'u' as const, label: '−U_R' }]
const dots = [
  { t: r.t1, ch: 'i' as const, label: `I_RM ≈ ${r.IRM.toFixed(0)} A`, below: true },
  { t: tOfURM(d.offDS), ch: 'u' as const, label: `U_RM ≈ ${r.URM.toFixed(0)} V`, below: true, cls: 'danger' },
]
const segs = [{ t1: r.fit[0][0], i1: r.fit[0][1], t2: r.t2, i2: 0 }]
const done = computed(() => c.t.value >= r.t2)

const values = {
  UFRM: { UFRM: d.fr.UFRM.toFixed(0) },
  tfr: { tfr: ns(d.fr.tfr) },
  trr: { trr: ns(r.trr), ta: ns(r.ta), tb: ns(r.tb) },
  IRM: { IRM: r.IRM.toFixed(0) },
  Qrr: { Qrr: (r.Qrr * 1e6).toFixed(1), QF: (d.offD.Q0 * 1e6).toFixed(1) },
  S: { S: r.S.toFixed(2) },
}
</script>

<template>
  <section class="stage panel">
    <PinRefNote :extra="false" />
    <TimeScrub :c="c" />
    <div class="pst-grid">
      <figure class="chart sp">
        <h3 class="panel-title"><Bi :t="U.waveD" /></h3>
        <PinWavePlot
          :series="[{ s: d.offDS }]"
          :t="c.t.value"
          :t-max="T_DIDT"
          :i-lim="[-50, 35]"
          :u-lim="[-1000, 100]"
          :i-ticks="[-40, -20, 0, 20]"
          :u-ticks="[-1000, -800, -600, -400, -200, 0]"
          :marks="marks"
          :spans="spans"
          :hlines="hlines"
          :shade="{ t1: r.t0, t2: r.t2 }"
          :overshoot="-CIRCUIT.UR"
          :dots="dots"
          :segs="segs"
        />
        <ul class="keys">
          <li><i class="sw i" />i(t)</li>
          <li><i class="sw u" />u(t)</li>
          <li><i class="sw qrr" /><Bi :t="U.qrr" /></li>
          <li><i class="sw fit" /><Bi :t="P.fitKey" /></li>
        </ul>
      </figure>
      <div class="pst-side">
        <p class="pst-state"><Bi :t="phase" /></p>
        <dl class="pst-ro">
          <dt><Bi :t="U.ro.t" /></dt>
          <dd><b>{{ ns(c.t.value) }}</b> ns</dd>
          <dt><Bi :t="U.ro.i" /></dt>
          <dd><b class="acc">{{ fr.i.toFixed(1) }}</b> A</dd>
          <dt><Bi :t="U.ro.u" /></dt>
          <dd><b class="pot">{{ fr.u.toFixed(0) }}</b> V</dd>
          <template v-if="done">
            <dt>I_RM</dt>
            <dd><b>{{ r.IRM.toFixed(1) }}</b> A</dd>
            <dt>t_a、t_b</dt>
            <dd><b>{{ ns(r.ta) }}</b> ns、<b>{{ ns(r.tb) }}</b> ns</dd>
            <dt><Bi :t="P.soft" /></dt>
            <dd><b class="danger">{{ r.S.toFixed(2) }}</b></dd>
            <dt>t_rr、Q_rr</dt>
            <dd><b>{{ ns(r.trr) }}</b> ns、<b>{{ (r.Qrr * 1e6).toFixed(1) }}</b> µC</dd>
          </template>
        </dl>
      </div>
    </div>
    <div class="pst-grid">
      <figure class="chart sp">
        <h3 class="panel-title"><Bi :t="U.plasma" /><span class="hint"><Bi :t="U.plasmaHint" /></span></h3>
        <PinPlasmaPlot :frame="fr" :x="d.offD.x" :p-max="d.pMax" />
      </figure>
      <div class="pst-side">
        <div class="pst-note"><Rich :t="P.why" /></div>
        <div class="pst-note"><Rich :t="P.switchNote" /></div>
      </div>
    </div>

    <h3 class="panel-title"><Bi :t="P.tableTitle" /></h3>
    <PinParamTable :rows="DYN_ROWS" :values="values" :active="null" :linked="false" />

    <h3 class="panel-title"><Bi :t="P.condTitle" /></h3>
    <div class="cond-scroll">
      <table class="cond">
        <thead>
          <tr><th v-for="(h, k) in P.condHead" :key="k"><Bi :t="h" /></th></tr>
        </thead>
        <tbody>
          <tr v-for="(row, k) in P.conds" :key="k">
            <td><Bi :t="row.c" /></td>
            <td><Rich :t="row.r" /></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="pst-note"><Rich :t="P.condNote" /></div>
    <p class="scaled"><Bi :t="UI.scaled.dynDidt" /></p>
  </section>
</template>

<style scoped>
.sw.i { border-color: var(--electron); }
.sw.u { border-color: var(--potential); }
.sw.qrr { height: 10px; border: none; background: color-mix(in srgb, var(--accent) 30%, transparent); }
.sw.fit { border-color: var(--hole); border-top-style: dashed; }
.cond-scroll { overflow-x: auto; }
.cond { border-collapse: collapse; font-size: 0.86rem; min-width: 480px; }
.cond th,
.cond td { padding: 5px 16px 5px 0; text-align: left; border-top: 1px solid color-mix(in srgb, var(--ink) 12%, transparent); }
.cond thead th { border-top: 0; color: var(--ink-soft); }
</style>
