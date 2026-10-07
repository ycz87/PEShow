<script setup lang="ts">
// 击穿舞台（0.6）：Canvas 2D 画布 + 读数 + 本步工具（示例器件、反向电压、温度、限流与散热）
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import Bi from './Bi.vue'
import StageTransport from './StageTransport.vue'
import { settings, fillBi, tx } from '../app/settings'
import { celsius, formatCurrent, lengthText } from '../app/format'
import { useSlider } from '../app/useSlider'
import { exposeDebug } from '../app/debug'
import { MODE_DEVICE, defaultVr, liveAt, vrMax, vrStep, type BreakdownLive, type BreakdownMode } from '../app/breakdown'
import { BreakdownRenderer } from '../engine/render/BreakdownRenderer'
import { LABEL_KEYS, biasGeom, type BdInput, type BdLabels, type BdView, type InjectMode } from '../engine/render/breakdown/common'
import { M_CAP, mfpRatio, type AvalancheStats } from '../engine/render/breakdown/avalanche'
import { THERMAL, ZENERS, ZENER_IDS, multiplication, reverseV, thermalCircuit, tunnelDistance, type Cooling, type ZenerId } from '../engine/physics/breakdown'
import { TEMP, junctionAt } from '../engine/physics/pn'
import { UI } from '../devices/pn-junction/sections/ui'
import type { Step } from '../devices/pn-junction/sections/types'

/** T：页面温度（°C）；bd：给图表的实时状态 */
const props = defineProps<{ step: Step; T: number }>()
const emit = defineEmits<{ 'update:T': [number]; 'update:bd': [BreakdownLive] }>()
const has = (t: Step['tools'][number]) => props.step.tools.includes(t)
const U = UI.bd

const mode = computed<BreakdownMode>(() => props.step.breakdown?.mode ?? 'intro')
const device = ref<ZenerId>(MODE_DEVICE[mode.value] ?? '1N4757A')
const vr = ref(defaultVr(mode.value, device.value))
const limit = ref(true)
const cooling = ref<Cooling>('good')
/** 雪崩、齐纳：座位视角或能带视角；雪崩：一次注入一个还是连续注入 */
const view = ref<BdView>('space')
const inject = ref<InjectMode>('one')
const input = computed<BdInput>(() => ({ device: device.value, vr: vr.value, T: props.T, limit: limit.value, cooling: cooling.value, view: view.value, inject: inject.value }))

const host = ref<HTMLDivElement>()
const r = shallowRef<BreakdownRenderer>()
const playing = ref(true)
const SPEEDS = [0.25, 0.5, 1, 2, 4]
const speed = ref(1)
const hostW = ref(0)
const hostH = computed(() => (hostW.value ? Math.round(Math.min(560, Math.max(300, hostW.value / 1.75))) : 460))

/** 每 120 ms 从渲染器取一次：雪崩的画面统计、热击穿的结温 */
const tally = ref<AvalancheStats>({ trees: 0, out: 0, last: null })
const th = ref({ Tj: THERMAL.Ta, burnt: false })
let ro: ResizeObserver | undefined
let poll: number | undefined

function labels(): BdLabels {
  return Object.fromEntries(LABEL_KEYS.map((k) => [k, tx(U.canvas[k])])) as BdLabels
}

function read(pr: BreakdownRenderer) {
  if (pr.stats) tally.value = { ...pr.stats }
  const t = pr.thermal
  if (!t) return
  th.value = t
  const op = thermalCircuit(limit.value, t.Tj)
  emit('update:bd', { mode: 'thermal', device: THERMAL.device, T: t.Tj, V: op.V, I: op.I, limit: limit.value, R: op.R, cooling: cooling.value, burnt: t.burnt })
}

onMounted(() => {
  const pr = new BreakdownRenderer(host.value!, mode.value, input.value, labels())
  hostW.value = host.value!.clientWidth
  pr.init(settings.style, settings.theme)
  r.value = pr
  ro = new ResizeObserver(() => {
    hostW.value = host.value!.clientWidth
    pr.resize(host.value!.clientWidth, host.value!.clientHeight)
  })
  ro.observe(host.value!)
  read(pr)
  poll = window.setInterval(() => read(pr), 120)
  exposeDebug({ renderer: pr })
})

onBeforeUnmount(() => {
  ro?.disconnect()
  clearInterval(poll)
  r.value?.destroy()
})

watch(() => [settings.style, settings.theme] as const, ([s, t]) => r.value?.setStyle(s, t))
watch(() => settings.lang, () => {
  if (r.value) r.value.labels = labels()
})
// 换步：按本步设定重置器件与反向电压；同一模式（例如雪崩 → 雪崩的温度系数）不重建画面
watch(mode, (m) => {
  device.value = MODE_DEVICE[m] ?? device.value
  vr.value = defaultVr(m, device.value)
  r.value?.setMode(m)
})
watch(input, (p) => r.value?.setInput(p))
watch(playing, (p) => { if (r.value) r.value.playing = p })
watch(speed, (s) => { if (r.value) r.value.speed = s })

/** 热击穿以外的模式：工作点随控件变化发给图表（热击穿由轮询发） */
watch(
  () => [mode.value, device.value, vr.value, props.T] as const,
  ([m, d, v, T]) => { if (m !== 'thermal') emit('update:bd', liveAt(m, d, v, T)) },
  { immediate: true },
)

defineExpose({ togglePlay: () => (playing.value = !playing.value) })

function pick(id: ZenerId) {
  device.value = id
  vr.value = defaultVr(mode.value, id)
}

const vrSlider = useSlider(() => vr.value, (v) => (vr.value = v))
const tSlider = useSlider(() => props.T, (t) => emit('update:T', t))

const d = computed(() => ZENERS[device.value])
const geo = computed(() => biasGeom(d.value, vr.value, props.T))
const vDigits = computed(() => (vrStep(device.value) < 0.1 ? 2 : 1))
const showVr = computed(() => mode.value === 'intro' || mode.value === 'avalanche' || mode.value === 'zener')
const vzT = computed(() => reverseV(d.value, d.value.IZT, props.T))
const M = computed(() => multiplication(d.value, geo.value.op.Vj, props.T))
const Eg = computed(() => junctionAt(props.T).Eg)
/** 隧穿窗口中部的隧穿距离（nm）；窗口未打开时为 null */
const dTun = computed(() => {
  const g = geo.value.g
  if (g.Vtot <= Eg.value) return null
  return tunnelDistance(d.value, g, -(g.Vtot + Eg.value) / 2, Eg.value) * 1e7
})
const thermalOp = computed(() => thermalCircuit(limit.value, th.value.Tj))

const tallyText = computed(() => {
  const { trees, out } = tally.value
  return fillBi(U.ro.tally, { i: trees, o: out, m: trees ? (out / trees).toFixed(2) : '—' })
})
const hasView = computed(() => mode.value === 'avalanche' || mode.value === 'zener')
const mfpText = computed(() => fillBi(U.ro.mfp, { k: mfpRatio(props.T).toFixed(2) }))
const capText = computed(() => fillBi(U.ro.mCap, { n: M_CAP }))
</script>

<template>
  <section class="stage panel">
    <div class="stage-top">
      <p v-if="mode !== 'compare'" class="ro">
        <template v-if="mode === 'thermal'">
          <span><Bi :t="U.ro.Tj" /> <b class="warm">{{ th.Tj.toFixed(0) }} °C</b></span>
          <span>U <b>{{ thermalOp.V.toFixed(2) }} V</b></span>
          <span>I <b class="acc">{{ (thermalOp.I * 1e3).toFixed(0) }} mA</b></span>
          <span><Bi :t="U.ro.P" /> <b class="warm">{{ thermalOp.P.toFixed(2) }} W</b></span>
          <span v-if="th.burnt" class="danger"><Bi :t="U.ro.burnt" /></span>
        </template>
        <template v-else>
          <span>U <b>{{ geo.op.V.toFixed(vDigits) }} V</b></span>
          <!-- 雪崩的温度一步不显示电流：模型里漏电流 I₀ 固定取 25 °C 的值，电流随温度的变化不可信 -->
          <span v-if="!(mode === 'avalanche' && has('temp'))">I <b class="acc">{{ formatCurrent(geo.op.I) }}</b></span>
          <template v-if="mode === 'intro'">
            <span><Bi :t="U.ro.W" /> <b class="pot">{{ lengthText(geo.g.W) }}</b></span>
            <span><Bi :t="U.ro.Emax" /> <b class="fld">{{ (geo.g.Emax / 1e6).toFixed(2) }} MV/cm</b></span>
          </template>
          <template v-else-if="mode === 'avalanche'">
            <span><Bi :t="U.ro.M" /> <b>{{ Number.isFinite(M) ? M.toFixed(M < 10 ? 2 : 0) : '∞' }}</b><small v-if="M > M_CAP"><Bi :t="capText" /></small></span>
            <span><Bi :t="U.ro.vzT" /> <b class="pot">{{ vzT.toFixed(2) }} V</b></span>
            <span v-if="has('temp')" class="soft"><Bi :t="mfpText" /></span>
          </template>
          <template v-else>
            <span><Bi :t="U.ro.Eg" /> <b>{{ Eg.toFixed(3) }} eV</b></span>
            <span><Bi :t="U.ro.d" /> <b class="pot">{{ dTun === null ? '—' : `${dTun.toFixed(1)} nm` }}</b></span>
            <span v-if="has('temp')"><Bi :t="U.ro.vzT" /> <b class="pot">{{ vzT.toFixed(3) }} V</b></span>
          </template>
        </template>
      </p>
      <p v-if="mode === 'avalanche'" class="ro soft"><Bi :t="tallyText" /></p>
    </div>

    <div ref="host" class="canvas-host" :style="{ height: `${hostH}px` }" />

    <ul class="legend">
      <template v-if="mode === 'intro'">
        <li><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="6" fill="none" stroke="var(--ion-minus)" stroke-width="1.6" /><path d="M5.5 9 H12.5" stroke="var(--ion-minus)" stroke-width="1.6" /></svg><Bi :t="U.legend.ionA" /></li>
        <li><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="6" fill="none" stroke="var(--ion-plus)" stroke-width="1.6" /><path d="M5.5 9 H12.5 M9 5.5 V12.5" stroke="var(--ion-plus)" stroke-width="1.6" /></svg><Bi :t="U.legend.ionD" /></li>
        <li><svg width="22" height="18" viewBox="0 0 22 18" aria-hidden="true"><path d="M2 15 L11 3 L20 15 Z" fill="var(--field)" fill-opacity="0.22" stroke="var(--field)" stroke-width="1.8" /></svg><Bi :t="U.legend.field" /></li>
        <li><svg width="22" height="18" viewBox="0 0 22 18" aria-hidden="true"><path d="M2 15 L11 3 L20 15" fill="none" stroke="var(--ink-soft)" stroke-width="1.4" stroke-dasharray="3 2.5" /></svg><Bi :t="U.legend.other" /></li>
      </template>
      <template v-else-if="hasView">
        <li><i class="lg-dot e" /><Bi :t="UI.legend.electron" /></li>
        <li><i class="lg-dot h" /><Bi :t="UI.legend.hole" /></li>
        <li v-if="view === 'space'"><svg width="26" height="18" viewBox="0 0 26 18" aria-hidden="true"><circle cx="4" cy="9" r="3" fill="var(--ink-soft)" opacity="0.4" /><circle cx="22" cy="9" r="3" fill="var(--ink-soft)" opacity="0.4" /><path d="M8 7.5 H18 M8 10.5 H18" stroke="var(--ink-soft)" stroke-width="1" opacity="0.6" /><circle cx="11" cy="9" r="1.6" fill="var(--electron)" /><circle cx="15" cy="9" r="1.6" fill="var(--electron)" /></svg><Bi :t="U.legend.seat" /></li>
        <template v-if="mode === 'avalanche'">
          <li><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="12" r="4" fill="var(--heat-out)" /><circle cx="4.5" cy="4.5" r="1.6" fill="var(--heat-out)" opacity="0.7" /><circle cx="9" cy="3" r="1.6" fill="var(--heat-out)" opacity="0.7" /><circle cx="13.5" cy="4.5" r="1.6" fill="var(--heat-out)" opacity="0.7" /></svg><Bi :t="U.legend.phonon" /></li>
          <li><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="3.5" fill="none" stroke="var(--accent)" stroke-width="2" /><circle cx="9" cy="9" r="7.5" fill="none" stroke="var(--accent)" stroke-width="1.6" opacity="0.5" /></svg><Bi :t="U.legend.ionize" /></li>
          <template v-if="view === 'space'">
            <li><svg width="12" height="20" viewBox="0 0 12 20" aria-hidden="true"><rect x="3" y="2" width="6" height="16" fill="none" stroke="var(--ink)" stroke-width="1" opacity="0.6" /><rect x="3.5" y="9" width="5" height="8.5" fill="var(--electron)" /></svg><Bi :t="U.legend.bar" /></li>
            <li><span class="gens" aria-hidden="true"><i style="background: var(--electron)" /><i style="background: #7ee081" /><i style="background: #ffc44d" /><i style="background: #ff8fb1" /></span><Bi :t="U.legend.gens" /></li>
            <li><i class="sq acc" /><Bi :t="U.legend.ionZone" /></li>
          </template>
          <template v-else>
            <li><svg width="24" height="18" viewBox="0 0 24 18" aria-hidden="true"><path d="M2 6 H22 M2 12 H22" stroke="var(--ink)" stroke-width="2" /></svg><Bi :t="U.legend.bandEdge" /></li>
            <li><svg width="24" height="18" viewBox="0 0 24 18" aria-hidden="true"><path d="M2 9 H22" stroke="var(--accent)" stroke-width="1.6" stroke-dasharray="5 3" /></svg><Bi :t="U.legend.thr" /></li>
          </template>
        </template>
        <template v-else-if="view === 'space'">
          <li><svg width="24" height="18" viewBox="0 0 24 18" aria-hidden="true"><path d="M2 9 Q12 2 22 9" fill="none" stroke="var(--electron)" stroke-width="1.6" stroke-dasharray="3 3" /></svg><Bi :t="U.legend.tunnel" /></li>
          <li><i class="sq wall" /><Bi :t="U.legend.wall" /></li>
        </template>
        <template v-else>
          <li><svg width="24" height="18" viewBox="0 0 24 18" aria-hidden="true"><path d="M2 9 H22" stroke="var(--electron)" stroke-width="1.6" stroke-dasharray="3 3" /></svg><Bi :t="U.legend.tunnel" /></li>
          <li><i class="sq acc" /><Bi :t="U.legend.window" /></li>
          <li><i class="sq val" /><Bi :t="U.legend.valence" /></li>
          <li><svg width="24" height="18" viewBox="0 0 24 18" aria-hidden="true"><path d="M2 9 H22" stroke="var(--potential)" stroke-width="1.6" stroke-dasharray="3 4" /></svg><Bi :t="U.legend.ef" /></li>
        </template>
      </template>
      <template v-else-if="mode === 'compare'">
        <li><svg width="14" height="20" viewBox="0 0 14 20" aria-hidden="true"><path d="M7 3 V17" stroke="var(--ink-soft)" stroke-width="5" stroke-linecap="round" /></svg><Bi :t="U.legend.range" /></li>
        <li><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="5" fill="var(--bg)" stroke="var(--ink-soft)" stroke-width="2" /></svg><Bi :t="U.legend.mid" /></li>
      </template>
      <template v-else>
        <li><svg width="26" height="18" viewBox="0 0 26 18" aria-hidden="true"><path d="M2 9 H24" stroke="var(--accent)" stroke-width="3" stroke-dasharray="5 6" /></svg><Bi :t="U.legend.current" /></li>
        <li><svg width="22" height="18" viewBox="0 0 22 18" aria-hidden="true"><path d="M2 9 H14" stroke="var(--danger)" stroke-width="3" /><path d="M20 9 L13 4.5 V13.5 Z" fill="var(--danger)" /></svg><Bi :t="U.legend.loop" /></li>
      </template>
    </ul>

    <div class="stage-bottom">
      <!-- 对比是静止的图表，不需要播放控制 -->
      <StageTransport v-if="mode !== 'compare'" v-model:playing="playing" v-model:speed="speed" :speeds="SPEEDS" @replay="r?.reset()" />

      <div v-if="has('device')" class="opt">
        <span class="opt-name"><Bi :t="U.device" /></span>
        <div class="seg" role="group" :aria-label="tx(U.device)">
          <button v-for="id in ZENER_IDS" :key="id" :aria-pressed="device === id" @click="pick(id)">{{ id }}</button>
        </div>
      </div>

      <div v-if="hasView" class="opt">
        <span class="opt-name"><Bi :t="U.view" /></span>
        <div class="seg" role="group" :aria-label="tx(U.view)">
          <button v-for="k in (['space', 'band'] as const)" :key="k" :aria-pressed="view === k" @click="view = k"><Bi :t="U.views[k]" /></button>
        </div>
      </div>
      <div v-if="mode === 'avalanche'" class="opt">
        <span class="opt-name"><Bi :t="U.inject" /></span>
        <div class="seg" role="group" :aria-label="tx(U.inject)">
          <button v-for="k in (['one', 'stream'] as const)" :key="k" :aria-pressed="inject === k" @click="inject = k"><Bi :t="U.injects[k]" /></button>
        </div>
      </div>

      <label v-if="showVr" class="bias rev">
        <span class="bias-name"><Bi :t="U.vr" /></span>
        <input type="range" min="0" :max="vrMax(device)" :step="vrStep(device)" :value="vrSlider.shown" @input="vrSlider.input" @change="vrSlider.release" />
        <output class="bias-val">{{ vr.toFixed(vDigits) }}<small> V</small></output>
      </label>

      <label v-if="has('temp')" class="bias temp">
        <span class="bias-name"><Bi :t="UI.temp" /></span>
        <input type="range" :min="TEMP.min" :max="TEMP.max" step="1" :value="tSlider.shown" @input="tSlider.input" @change="tSlider.release" />
        <output class="bias-val">{{ celsius(T) }}</output>
      </label>

      <template v-if="has('limit')">
        <div class="opt">
          <span class="opt-name"><Bi :t="U.limit" /></span>
          <div class="seg" role="group" :aria-label="tx(U.limit)">
            <button v-for="k in ([true, false] as const)" :key="`${k}`" :aria-pressed="limit === k" @click="limit = k"><Bi :t="k ? U.limits.on : U.limits.off" /></button>
          </div>
        </div>
        <div class="opt">
          <span class="opt-name"><Bi :t="U.cooling" /></span>
          <div class="seg" role="group" :aria-label="tx(U.cooling)">
            <button v-for="k in (['good', 'poor'] as const)" :key="k" :aria-pressed="cooling === k" @click="cooling = k"><Bi :t="U.coolings[k]" /></button>
          </div>
        </div>
      </template>
    </div>

    <p class="scaled"><Bi :t="U.scaled[mode]" /></p>
  </section>
</template>

<style scoped>
.stage-top { min-height: 1.6em; }
.ro {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 16px;
  font-size: 0.85rem;
  color: var(--ink-soft);
}
.ro b {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.02rem;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}
.ro small { font-size: 0.78rem; }
.ro .acc { color: var(--accent); }
.ro .pot { color: var(--potential); }
.ro .fld { color: var(--field); }
.ro .warm { color: var(--heat-out); }
.ro .danger {
  color: var(--danger);
  font-weight: 700;
}
.soft { color: var(--ink-soft); }
.opt {
  display: flex;
  align-items: center;
  gap: 8px;
}
.opt-name {
  font-weight: 700;
  font-size: 0.88rem;
  white-space: nowrap;
}
.legend .sq {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  display: inline-block;
}
.legend .sq.acc { background: color-mix(in srgb, var(--accent) 30%, transparent); }
.legend .sq.val { background: color-mix(in srgb, var(--ink-soft) 30%, transparent); }
.legend .sq.wall {
  background: repeating-linear-gradient(135deg, color-mix(in srgb, var(--ink-soft) 45%, transparent) 0 2px, color-mix(in srgb, var(--ink-soft) 22%, transparent) 2px 5px);
  border: 1px dashed var(--ink-soft);
}
.legend .gens { display: inline-flex; gap: 2px; }
.legend .gens i { width: 6px; height: 12px; border-radius: 2px; }
</style>
