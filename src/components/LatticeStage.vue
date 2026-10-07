<script setup lang="ts">
// 晶格舞台（0.1–0.2）：Canvas 2D 画布 + 真实浓度读数 + 本步工具（温度、单步跳、电场、掺杂、放大镜）
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import Bi from './Bi.vue'
import HeatLegend from './HeatLegend.vue'
import StageTransport from './StageTransport.vue'
import { settings, fillBi, tx } from '../app/settings'
import { celsius, pow10, sci } from '../app/format'
import { useSlider } from '../app/useSlider'
import { exposeDebug } from '../app/debug'
import { LatticeRenderer } from '../engine/render/LatticeRenderer'
import type { Lattice, LatticeCfg } from '../engine/physics/lattice'
import { CONC, displayTarget, equilibrium, type Dopant } from '../engine/physics/doping'
import { TEMP } from '../engine/physics/pn'
import { UI } from '../devices/pn-junction/sections/ui'
import type { Step } from '../devices/pn-junction/sections/types'

/** T：温度（°C）；dopant、logN：当前杂质与浓度 log₁₀(N / cm⁻³)（由页面持有，换步时按本步设定重置） */
const props = defineProps<{ step: Step; T: number; dopant: Dopant; logN: number }>()
const emit = defineEmits<{ 'update:T': [number]; 'update:dopant': [Dopant]; 'update:logN': [number] }>()
const has = (t: Step['tools'][number]) => props.step.tools.includes(t)
const U = UI.lattice

const cfg = computed<LatticeCfg>(() => {
  const c = props.step.lattice ?? { dopant: 'none' }
  return { dopant: props.dopant, many: !!c.many, hop: !!c.hop, field: !!c.field, zoom: !!c.zoomOut }
})
const target = computed(() => displayTarget(cfg.value, props.T, props.logN))

const host = ref<HTMLDivElement>()
const r = shallowRef<LatticeRenderer>()
const playing = ref(true)
const SPEEDS = [0.25, 0.5, 1, 2, 4]
const speed = ref(1)
const hostW = ref(0)
const logNSlider = useSlider(() => props.logN, (v) => emit('update:logN', v))
const tSlider = useSlider(() => props.T, (t) => emit('update:T', t))
// 画面宽高比与晶格视图（含电极留白）一致
const hostH = computed(() => (hostW.value ? Math.round(Math.min(600, Math.max(260, hostW.value / 1.82))) : 420))

/** 读数：每 120 ms 从仿真取一次 */
const shown = ref({ e: 0, h: 0 })
const hops = ref(0)
const fieldOn = ref(false)
const meter = ref({ e: 0, h: 0, re: 0, rh: 0 })
/** 本次加电场时的仿真时刻；换了一个仿真对象（重建、重新开始）就从 0 算起 */
let since = 0
let meterSim: Lattice | null = null
let ro: ResizeObserver | undefined
let poll: number | undefined

function read(pr: LatticeRenderer) {
  const L = pr.sim
  if (L !== meterSim) {
    meterSim = L
    since = 0
  }
  shown.value = { e: L.electrons.length, h: L.holes.filter((h) => !h.bound).length }
  hops.value = L.hopLog.length
  fieldOn.value = L.fieldOn
  // 撤去电场后读数停在撤去前的值
  if (!L.fieldOn) return
  const t = L.time - since
  const { e, h } = L.exits
  meter.value = t > 1 ? { e, h, re: e / t, rh: h / t } : { e, h, re: 0, rh: 0 }
}

function lensLabels() {
  return { title: tx(U.lens), gone: tx(U.lensGone) }
}

onMounted(() => {
  const pr = new LatticeRenderer(host.value!, cfg.value, props.T, target.value)
  pr.lensEnabled = has('magnifier')
  pr.labels = lensLabels()
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
  if (r.value) r.value.labels = lensLabels()
})
const cfgKey = computed(() => JSON.stringify(cfg.value))
watch(cfgKey, () => r.value?.setScene(cfg.value, props.T, target.value))
watch(target, (t) => r.value?.retarget(props.T, t))
watch(() => props.step, (s) => {
  if (r.value) r.value.lensEnabled = s.tools.includes('magnifier')
})
watch(playing, (p) => { if (r.value) r.value.playing = p })
watch(speed, (s) => { if (r.value) r.value.speed = s })

defineExpose({ togglePlay: () => (playing.value = !playing.value) })

function toggleField() {
  const L = r.value?.sim
  if (!L) return
  L.fieldOn = !L.fieldOn
  if (L.fieldOn) {
    L.exits = { e: 0, h: 0 }
    since = L.time
    meter.value = { e: 0, h: 0, re: 0, rh: 0 }
  }
  fieldOn.value = L.fieldOn
}

/** 真实浓度（单个杂质、单步跳时不显示：画面不是平衡态的统计） */
const real = computed(() => {
  const c = cfg.value
  if (c.hop || (c.dopant !== 'none' && !c.many)) return null
  return equilibrium(props.T, c.dopant, props.logN)
})
const shownText = computed(() => fillBi(U.shown, shown.value))
const hopsText = computed(() => fillBi(U.hops, { n: hops.value }))
const exitText = computed(() => ({ e: fillBi(U.exitE, { n: meter.value.e }), h: fillBi(U.exitH, { n: meter.value.h }) }))
const share = computed(() => {
  const { re, rh } = meter.value
  const s = Math.max(0, re) + Math.max(0, rh)
  return s > 0 ? { e: Math.max(0, re) / s, h: Math.max(0, rh) / s } : { e: 0, h: 0 }
})

/** 本征硅可以一直降到 0 K（0.1 节第一步的画面）；掺杂后滑块范围与器件工作温度一致 */
const tMin = computed(() => (cfg.value.dopant === 'none' ? -273 : TEMP.min))

const zoomed = computed(() => cfg.value.zoom)
const doped = computed(() => cfg.value.dopant !== 'none')
</script>

<template>
  <section class="stage panel">
    <div class="stage-top">
      <p v-if="real" class="real">
        <span class="real-name"><Bi :t="U.real" /></span>
        <span class="n"><i>n</i> = {{ sci(real.n) }}</span>
        <span class="p"><i>p</i> = {{ sci(real.p) }}</span>
      </p>
      <p v-if="real" class="shown"><Bi :t="shownText" /></p>
    </div>

    <div ref="host" class="canvas-host" :style="{ height: `${hostH}px` }" />

    <ul class="legend">
      <template v-if="!zoomed">
        <li><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="6.5" fill="var(--ink-soft)" fill-opacity="0.25" stroke="var(--ink-soft)" stroke-width="1.4" /></svg><Bi :t="U.legend.atom" /></li>
        <li><svg width="20" height="18" viewBox="0 0 20 18" aria-hidden="true"><path d="M2 6.5 H18 M2 11.5 H18" stroke="var(--ink-soft)" stroke-opacity="0.6" stroke-width="1.3" /><circle cx="8" cy="6.5" r="1.9" fill="var(--electron)" /><circle cx="12" cy="11.5" r="1.9" fill="var(--electron)" /></svg><Bi :t="U.legend.bond" /></li>
        <li><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="5" fill="none" stroke="var(--hole)" stroke-width="1.6" stroke-dasharray="2.5 2" /></svg><Bi :t="U.legend.vacancy" /></li>
      </template>
      <template v-if="cfg.hop">
        <li><svg width="24" height="18" viewBox="0 0 24 18" aria-hidden="true"><path d="M20 12 Q12 2 6 11" fill="none" stroke="var(--electron)" stroke-width="1.8" /><path d="M3 14 L5 8 L9 12 Z" fill="var(--electron)" /></svg><Bi :t="U.legend.hopE" /></li>
        <li><svg width="24" height="18" viewBox="0 0 24 18" aria-hidden="true"><path d="M2 9 H16" stroke="var(--hole)" stroke-width="2.6" /><path d="M22 9 L15 5 V13 Z" fill="var(--hole)" /></svg><Bi :t="U.legend.hopH" /></li>
      </template>
      <li v-else><i class="lg-dot e" /><Bi :t="UI.legend.electron" /></li>
      <li v-if="zoomed"><i class="lg-dot h" /><Bi :t="UI.legend.hole" /></li>
      <li v-if="doped && !zoomed">
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="6.5" :fill="dopant === 'P' ? 'var(--potential)' : 'var(--field)'" /></svg>
        <Bi :t="dopant === 'P' ? U.legend.P : U.legend.B" />
      </li>
      <li v-if="doped">
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <circle cx="9" cy="9" r="6" fill="none" :stroke="dopant === 'P' ? 'var(--ion-plus)' : 'var(--ion-minus)'" stroke-width="1.6" />
          <path :d="dopant === 'P' ? 'M5.5 9 H12.5 M9 5.5 V12.5' : 'M5.5 9 H12.5'" :stroke="dopant === 'P' ? 'var(--ion-plus)' : 'var(--ion-minus)'" stroke-width="1.6" />
        </svg>
        <Bi :t="dopant === 'P' ? U.legend.ionP : U.legend.ionB" />
      </li>
      <li v-if="cfg.field"><svg width="22" height="18" viewBox="0 0 22 18" aria-hidden="true"><path d="M2 9 H15" stroke="var(--field)" stroke-width="2.2" /><path d="M20 9 L14 5.5 V12.5 Z" fill="var(--field)" /></svg><Bi :t="U.legend.field" /></li>
      <HeatLegend v-if="!cfg.hop" />
    </ul>

    <div class="stage-bottom">
      <StageTransport v-model:playing="playing" v-model:speed="speed" :speeds="SPEEDS" @replay="r?.reset()" />

      <div v-if="has('dope')" class="dope">
        <div class="seg" role="group" :aria-label="tx(U.dopant)">
          <button v-for="k in (['P', 'B'] as const)" :key="k" :aria-pressed="dopant === k" @click="emit('update:dopant', k)"><Bi :t="U.dopants[k]" /></button>
        </div>
        <label v-if="cfg.many" class="bias conc">
          <span class="bias-name"><Bi :t="U.conc" /></span>
          <input type="range" :min="CONC.min" :max="CONC.max" step="1" :value="logNSlider.shown" @input="logNSlider.input" @change="logNSlider.release" />
          <output class="bias-val">{{ pow10(logN) }}<small> cm⁻³</small></output>
        </label>
      </div>

      <label v-if="has('temp')" class="bias temp">
        <span class="bias-name"><Bi :t="UI.temp" /></span>
        <input type="range" :min="tMin" :max="TEMP.max" step="1" :value="tSlider.shown" @input="tSlider.input" @change="tSlider.release" />
        <output class="bias-val">{{ celsius(T) }}<small v-if="T <= -273">{{ tx(U.zeroK) }}</small></output>
      </label>

      <div v-if="has('hop')" class="hop">
        <button class="btn primary" @click="r?.sim.hopOnce()"><Bi :t="U.hop" /></button>
        <span class="tally"><Bi :t="hopsText" /></span>
      </div>

      <div v-if="has('efield')" class="efield">
        <button class="btn" :aria-pressed="fieldOn" @click="toggleField"><Bi :t="fieldOn ? U.fieldOff : U.fieldOn" /></button>
        <div class="meter" :class="{ off: !fieldOn }">
          <span class="meter-name"><Bi :t="U.current" /></span>
          <div class="meter-bar">
            <i class="fill e" :style="{ left: 0, width: `${share.e * 100}%` }" />
            <i class="fill h" :style="{ left: `${share.e * 100}%`, width: `${share.h * 100}%` }" />
          </div>
          <output class="meter-val"><span class="e">{{ meter.re.toFixed(2) }}</span> + <span class="h">{{ meter.rh.toFixed(2) }}</span> /s</output>
        </div>
        <p class="exits"><span class="e"><Bi :t="exitText.e" /></span><span class="h"><Bi :t="exitText.h" /></span></p>
      </div>
    </div>

    <p v-if="has('hop')" class="scaled"><Bi :t="U.hopNote" /></p>
    <p v-if="has('magnifier')" class="scaled"><Bi :t="U.lensHint" /></p>
    <p v-if="has('efield')" class="scaled"><Bi :t="U.currentHint" /></p>
    <p class="scaled"><Bi :t="U.scaled" /></p>
  </section>
</template>

<style scoped>
.stage-top { min-height: 1.6em; }
.real,
.shown {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 14px;
  font-size: 0.85rem;
}
.real-name,
.shown { color: var(--ink-soft); }
.real .n,
.real .p {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.02rem;
  font-variant-numeric: tabular-nums;
}
.real .n { color: var(--electron); }
.real .p { color: var(--hole); }

.dope,
.hop,
.efield {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
}
.bias-val small {
  font-size: 0.7em;
  font-weight: 600;
  color: var(--ink-soft);
}
.bias.conc .bias-val { color: var(--potential); }
.tally {
  font-size: 0.85rem;
  color: var(--ink-soft);
  font-variant-numeric: tabular-nums;
}

.meter.off { opacity: 0.5; }
.meter-bar .fill.e { background: var(--electron); }
.meter-bar .fill.h { background: var(--hole); }
.meter-val { min-width: 7em; }
.meter-val .e,
.exits .e { color: var(--electron); }
.meter-val .h,
.exits .h { color: var(--hole); }
.exits {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 2px 14px;
  font-size: 0.78rem;
}
</style>
