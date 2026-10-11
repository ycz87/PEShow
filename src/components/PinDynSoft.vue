<script setup lang="ts">
// 1.4-4 软恢复与硬恢复，分三段（同一个时间游标）：
// ① 我们的电阻法电路：A（示例 PiN，模型，实线）与 B（软恢复，示意，虚线），只看拖尾形状；
// ② 手册的测法（500 A/µs、L_σ 50 nH）：A、B 各自标出 t_a、t_b，A 超出 −U_R 的尖峰涂红，软度放大显示；
// ③ 与 STTH3012 手册对照
import { computed } from 'vue'
import Bi from './Bi.vue'
import Rich from './Rich.vue'
import PinRefNote from './PinRefNote.vue'
import PinWavePlot from './PinWavePlot.vue'
import TimeScrub from './TimeScrub.vue'
import { fillBi } from '../app/settings'
import { useTimeCursor } from '../app/useTimeCursor'
import { CIRCUIT, T_DIDT, T_OFF, dynWaves, tOfURM } from '../devices/power-diode/dynWaves'
import { UI_DYN as U } from '../devices/power-diode/sections/uiDyn'
import { UI } from '../devices/power-diode/sections/ui'

const d = dynWaves()
const A = d.rrD
const B = d.rrSoft
/** 只画恢复阶段：从电流过零前一点到 B 恢复结束之后（手册测法的波形算到 T_DIDT + 50 ns） */
const T_MIN = 40e-9
const T_END = T_DIDT + 40e-9
const c = useTimeCursor(T_END, 10)
const S = U.soft
const ns = (s: number) => Math.round(s * 1e9)
const tRes = computed(() => Math.min(c.t.value, T_OFF))

// ① 电阻法
const resLines = [
  { y: -CIRCUIT.IR, ch: 'i' as const, label: '−I_R' },
  { y: -CIRCUIT.UR, ch: 'u' as const, label: '−U_R' },
]
const resDots = [{ t: tOfURM(d.offS), ch: 'u' as const, label: `A：${d.resA.URM.toFixed(0)} V`, below: true, cls: 'danger' }]
const resNote = fillBi(S.resNote, { ua: d.resA.URM.toFixed(0), ub: d.resB.URM.toFixed(0), ta: ns(d.resA.trr), tb: ns(d.resB.trr) })

// ② 手册测法
const didtLines = [{ y: -CIRCUIT.UR, ch: 'u' as const, label: '−U_R' }]
const spans = [
  { t1: A.t0, t2: A.t1, label: 'A: t_a', row: 0, cls: 'a' },
  { t1: A.t1, t2: A.t2, label: 't_b', row: 1, cls: 'a' },
  { t1: B.t0, t2: B.t1, label: 'B: t_a', row: 2, cls: 'b' },
  { t1: B.t1, t2: B.t2, label: 'B: t_b', row: 2, cls: 'b' },
]
const didtDots = [
  { t: A.t1, ch: 'i' as const, label: `I_RM ≈ ${A.IRM.toFixed(0)} A`, below: true },
  { t: tOfURM(d.offDS), ch: 'u' as const, label: `A：${A.URM.toFixed(0)} V`, below: true, cls: 'danger' },
]

// ③ 对照手册：STTH3012 在 30 A、600 V、500 A/µs、125 °C 的曲线读数（图 5–8），25 °C 按图 9 的相对值换算
const DS125 = { IRM: 46, trr: 235, Qrr: 7.5, S: 1.2 }
const REL25 = { IRM: 0.5, trr: 0.4, Qrr: 0.28, S: 1.93 }
const rows = [
  { k: 'I_RM', a: `${A.IRM.toFixed(0)} A`, b: `${B.IRM.toFixed(0)} A`, d1: `≈ ${DS125.IRM} A`, d2: `≈ ${(DS125.IRM * REL25.IRM).toFixed(0)} A` },
  { k: 't_a / t_b', a: `${ns(A.ta)} / ${ns(A.tb)} ns`, b: `${ns(B.ta)} / ${ns(B.tb)} ns`, d1: '—', d2: '—' },
  { k: 't_rr', a: `${ns(A.trr)} ns`, b: `${ns(B.trr)} ns`, d1: `≈ ${DS125.trr} ns`, d2: `≈ ${(DS125.trr * REL25.trr).toFixed(0)} ns` },
  { k: 'Q_rr', a: `${(A.Qrr * 1e6).toFixed(1)} µC`, b: `${(B.Qrr * 1e6).toFixed(1)} µC`, d1: `≈ ${DS125.Qrr} µC`, d2: `≈ ${(DS125.Qrr * REL25.Qrr).toFixed(1)} µC` },
  { k: 'S', a: A.S.toFixed(2), b: B.S.toFixed(1), d1: `≈ ${DS125.S}`, d2: `≈ ${(DS125.S * REL25.S).toFixed(1)}`, hl: true },
  { k: 'U_RM', a: `${A.URM.toFixed(0)} V`, b: `${B.URM.toFixed(0)} V`, d1: '—', d2: '—' },
]
</script>

<template>
  <section class="stage panel">
    <PinRefNote :extra="false" />
    <TimeScrub :c="c" />
    <div class="pst-grid even">
      <figure class="chart sp">
        <h3 class="panel-title"><Bi :t="S.resTitle" /></h3>
        <PinWavePlot
          :series="[{ s: d.offS }, { s: d.softResS, cls: 'alt' }]"
          :t="tRes"
          :t-min="T_MIN"
          :t-max="T_OFF"
          :i-lim="[-40, 10]"
          :u-lim="[-800, 50]"
          :i-ticks="[-30, -20, -10, 0]"
          :u-ticks="[-800, -600, -400, -200, 0]"
          :hlines="resLines"
          :overshoot="-CIRCUIT.UR"
          :dots="resDots"
        />
        <div class="pst-note"><Rich :t="resNote" /></div>
      </figure>
      <figure class="chart sp">
        <h3 class="panel-title"><Bi :t="S.didtTitle" /></h3>
        <PinWavePlot
          :series="[{ s: d.offDS }, { s: d.softS, cls: 'alt' }]"
          :t="c.t.value"
          :t-min="T_MIN"
          :t-max="T_END"
          :i-lim="[-50, 35]"
          :u-lim="[-1000, 100]"
          :i-ticks="[-40, -20, 0, 20]"
          :u-ticks="[-1000, -800, -600, -400, -200, 0]"
          :spans="spans"
          :hlines="didtLines"
          :overshoot="-CIRCUIT.UR"
          :dots="didtDots"
        />
        <div class="sbox">
          <div class="sv a"><small>A</small><b>S = {{ A.S.toFixed(2) }}</b><Bi :t="S.hard" /></div>
          <div class="sv b"><small>B</small><b>S = {{ B.S.toFixed(1) }}</b><Bi :t="S.softW" /></div>
        </div>
      </figure>
    </div>
    <ul class="keys">
      <li><i class="sw a" /><Bi :t="U.waveA" /></li>
      <li><i class="sw b" /><Bi :t="U.waveB" /></li>
      <li><i class="sw over" /><Bi :t="S.overKey" /></li>
    </ul>
    <div class="pst-note"><Rich :t="S.why" /></div>

    <h3 class="panel-title"><Bi :t="S.cmpTitle" /></h3>
    <div class="cmp-scroll">
      <table class="cmp">
        <thead>
          <tr><th v-for="(h, k) in S.cmpHead" :key="k"><Bi :t="h" /></th></tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.k" :class="{ hl: r.hl }">
            <th>{{ r.k }}</th>
            <td>{{ r.a }}</td>
            <td>{{ r.b }}</td>
            <td>{{ r.d1 }}</td>
            <td>{{ r.d2 }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="pst-note"><Rich :t="S.cmpNote" /></div>
    <div class="scaled"><Rich :t="S.note" /></div>
    <p class="scaled"><Bi :t="UI.scaled.dynSoft" /></p>
  </section>
</template>

<style scoped>
.keys {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  font-size: 0.78rem;
  color: var(--ink-soft);
}
.keys li { display: inline-flex; align-items: center; gap: 6px; }
.sw { width: 20px; height: 0; border-top: 3px solid; }
.sw.a { border-color: var(--electron); }
.sw.b { border-color: var(--electron); border-top-style: dashed; }
.sw.over { height: 10px; border: none; background: color-mix(in srgb, var(--danger) 45%, transparent); }
.sbox { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.sv {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px;
  border-radius: 12px;
  font-size: 0.8rem;
  text-align: center;
}
.sv b { font-family: var(--font-display); font-size: 1.4rem; font-variant-numeric: tabular-nums; }
.sv small { font-weight: 700; color: var(--ink-soft); }
.sv.a { background: color-mix(in srgb, var(--danger) 16%, transparent); }
.sv.a b { color: var(--danger); }
.sv.b { background: color-mix(in srgb, var(--accent) 16%, transparent); }
.sv.b b { color: var(--accent); }
.cmp-scroll { overflow-x: auto; }
.cmp { border-collapse: collapse; font-size: 0.86rem; width: 100%; min-width: 640px; }
.cmp th,
.cmp td {
  padding: 5px 12px 5px 0;
  text-align: left;
  border-top: 1px solid color-mix(in srgb, var(--ink) 12%, transparent);
  font-variant-numeric: tabular-nums;
}
.cmp thead th { border-top: 0; color: var(--ink-soft); font-weight: 600; }
.cmp tbody th { font-style: italic; }
.cmp tr.hl td { font-weight: 700; }
.cmp tr.hl td:nth-child(2) { color: var(--danger); }
.cmp tr.hl td:nth-child(3),
.cmp tr.hl td:nth-child(4),
.cmp tr.hl td:nth-child(5) { color: var(--accent); }
</style>
