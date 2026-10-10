<script setup lang="ts">
// 1.3-3 反向特性与参数：25 °C 的反向特性画在第三象限（与完整的 V-A 曲线一致），漏电流用对数坐标。
// 拖动反向电压：耗尽层展宽（右边的条）→ 漏电流缓慢增大 → 接近击穿时倍增因子 M 陡增。
// 下方是反向参数表，以及几个反向电压的区别与联系（示意波形）
import { computed, ref } from 'vue'
import Bi from './Bi.vue'
import Rich from './Rich.vue'
import PinRefNote from './PinRefNote.vue'
import PinRevPlot from './PinRevPlot.vue'
import PinRevVoltages from './PinRevVoltages.vue'
import PinParamTable from './PinParamTable.vue'
import { fillBi } from '../app/settings'
import { BV_PIN, PIN, depletionW, multiplication, reverseI } from '../engine/physics/pin'
import { REV_ROWS, UI_STATIC } from '../devices/power-diode/sections/uiStatic'
import { BV_SHOWN } from '../devices/power-diode/staticCurves'
import { UI } from '../devices/power-diode/sections/ui'

const U = UI_STATIC.rev
const URRM = 1200
const urev = ref(600)
const active = ref<string | null>(null)

const ir = computed(() => reverseI(urev.value) * 1e6)
const w = computed(() => depletionW(urev.value) * 1e4)
const M = computed(() => multiplication(urev.value))
const fmtI = (i: number) => (i < 10 ? i.toPrecision(2) : i.toFixed(0))

const state = computed(() => {
  const S = U.state
  if (urev.value >= BV_PIN - 20) return { t: S.bd, cls: 'danger' }
  if (urev.value > URRM) return { t: S.over, cls: 'warn' }
  if (M.value >= 1.1) return { t: fillBi(S.knee, { m: M.value.toFixed(1) }), cls: 'warn' }
  return { t: S.ok, cls: '' }
})

const values = computed(() => ({
  UBR: { bv: BV_SHOWN },
  IR: { i: fmtI(reverseI(URRM) * 1e6) },
}))
</script>

<template>
  <section class="stage panel">
    <PinRefNote />
    <div class="pst-grid">
      <figure class="chart sp">
        <h3 class="panel-title"><Bi :t="U.title" /></h3>
        <PinRevPlot :op="urev" :hl="active" />
      </figure>

      <div class="pst-side">
        <dl class="pst-ro">
          <dt>U</dt>
          <dd><b>−{{ urev }}</b> V</dd>
          <dt><Bi :t="U.roIr" /></dt>
          <dd><b class="pot">−{{ fmtI(ir) }}</b> µA</dd>
          <dt><Bi :t="U.roW" /></dt>
          <dd><b>{{ w.toFixed(0) }}</b> µm</dd>
          <dt><Bi :t="U.roM" /></dt>
          <dd><b :class="{ danger: M >= 1.1 }">{{ M.toFixed(2) }}</b></dd>
        </dl>
        <div class="depl">
          <span class="depl-name"><Bi :t="U.bar" /></span>
          <span class="depl-bar"><i :style="{ width: `${(w / (PIN.W * 1e4)) * 100}%` }" /></span>
        </div>
        <label class="bias rev">
          <span class="bias-name"><Bi :t="U.urev" /></span>
          <input v-model.number="urev" type="range" min="0" :max="Math.floor(BV_PIN) - 2" step="5" />
          <output class="bias-val">{{ urev }}<small> V</small></output>
        </label>
        <p class="pst-state" :class="state.cls"><Bi :t="state.t" /></p>
      </div>
    </div>

    <h3 class="panel-title"><Bi :t="U.rowsTitle" /></h3>
    <PinParamTable :rows="REV_ROWS" :values="values" :active="active" @select="active = $event" />

    <h3 class="panel-title"><Bi :t="U.volTitle" /></h3>
    <div class="pst-note"><Rich :t="U.volRel" /></div>
    <PinRevVoltages :active="active" />

    <p class="scaled"><Bi :t="UI.scaled.staticRev" /></p>
  </section>
</template>

<style scoped>
.depl { display: flex; flex-direction: column; gap: 4px; font-size: 0.8rem; color: var(--ink-soft); }
.depl-bar {
  display: block;
  height: 14px;
  border-radius: 7px;
  border: 1.5px solid var(--line);
  background: color-mix(in srgb, var(--n-region) 14%, transparent);
  overflow: hidden;
}
.depl-bar i { display: block; height: 100%; background: color-mix(in srgb, var(--field) 55%, transparent); transition: width 0.15s; }
</style>
