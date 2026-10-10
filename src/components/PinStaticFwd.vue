<script setup lang="ts">
// 1.3-2 正向特性与参数：25 °C 的正向曲线和手册的直线近似（在额定电流附近 15–60 A 贴合）。
// 拖动电流，比较实际压降与直线估算的压降。下方是正向参数表，以及几个正向电流的区别与联系（示意波形）
import { computed, ref } from 'vue'
import Bi from './Bi.vue'
import Rich from './Rich.vue'
import PinRefNote from './PinRefNote.vue'
import PinFwdPlot from './PinFwdPlot.vue'
import PinFwdCurrents from './PinFwdCurrents.vue'
import PinParamTable from './PinParamTable.vue'
import { lineFit, terminalU } from '../engine/physics/pin'
import { FWD_ROWS, UI_STATIC } from '../devices/power-diode/sections/uiStatic'
import { UI } from '../devices/power-diode/sections/ui'

const U = UI_STATIC.fwd
/** 直线近似取额定电流的 0.5–2 倍 */
const FIT = { i1: 15, i2: 60 }
const cur = ref(30)
const active = ref<string | null>(null)

const fit = lineFit(FIT.i1, FIT.i2)
const uf = computed(() => terminalU(cur.value))
const est = computed(() => fit.UTO + fit.rT * cur.value)
const err = computed(() => (est.value - uf.value) * 1000)

const values = computed(() => ({
  UF: { i: cur.value, u: uf.value.toFixed(2) },
  line: { u: fit.UTO.toFixed(2), r: (fit.rT * 1000).toFixed(1) },
  IF: { i: cur.value },
}))
</script>

<template>
  <section class="stage panel">
    <PinRefNote />
    <div class="pst-grid">
      <figure class="chart sp">
        <h3 class="panel-title"><Bi :t="U.title" /></h3>
        <PinFwdPlot :fit="FIT" :op="cur" :hl="active" />
        <ul class="keys">
          <li><i class="sw cur" />U_F</li>
          <li><i class="sw fit" /><Bi :t="U.lineKey" /></li>
        </ul>
      </figure>

      <div class="pst-side">
        <dl class="pst-ro">
          <dt>U_TO、r_T</dt>
          <dd><b class="pot">{{ fit.UTO.toFixed(2) }}</b> V、<b class="pot">{{ (fit.rT * 1000).toFixed(1) }}</b> mΩ</dd>
          <dt><Bi :t="U.roUf" /></dt>
          <dd><b class="acc">{{ uf.toFixed(2) }}</b> V</dd>
          <dt><Bi :t="U.roLine" /></dt>
          <dd><b class="pot">{{ est.toFixed(2) }}</b> V</dd>
          <dt><Bi :t="U.roErr" /></dt>
          <dd><b :class="{ danger: Math.abs(err) > 50 }">{{ err >= 0 ? '+' : '' }}{{ err.toFixed(0) }}</b> mV</dd>
        </dl>
        <label class="bias fwd">
          <span class="bias-name"><Bi :t="U.current" /></span>
          <input v-model.number="cur" type="range" min="1" max="90" step="1" />
          <output class="bias-val">{{ cur }}<small> A</small></output>
        </label>
        <div class="pst-note"><Rich :t="U.lineWhy" /></div>
      </div>
    </div>

    <h3 class="panel-title"><Bi :t="U.rowsTitle" /></h3>
    <PinParamTable :rows="FWD_ROWS" :values="values" :active="active" @select="active = $event" />

    <h3 class="panel-title"><Bi :t="U.curTitle" /></h3>
    <div class="pst-note"><Rich :t="U.curRel" /></div>
    <PinFwdCurrents :active="active" />

    <p class="scaled"><Bi :t="UI.scaled.staticFwd" /></p>
  </section>
</template>

<style scoped>
.sw.cur { border-color: var(--accent); }
.sw.fit { border-color: var(--potential); border-top-style: dashed; }
</style>
