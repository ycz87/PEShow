<script setup lang="ts">
// 主舞台：PixiJS 画布 + 与画布同坐标的 HTML 标注 + 舞台控制条
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import Bi from './Bi.vue'
import TubeInset from './TubeInset.vue'
import TraceCard from './TraceCard.vue'
import LapPanel from './LapPanel.vue'
import HeatLegend from './HeatLegend.vue'
import StageTransport from './StageTransport.vue'
import SwitchControls from './SwitchControls.vue'
import DensitySlider from './DensitySlider.vue'
import CurrentMeter from './CurrentMeter.vue'
import { settings, fillBi, tx } from '../app/settings'
import { celsius, signedV } from '../app/format'
import { useSlider } from '../app/useSlider'
import { exposeDebug } from '../app/debug'
import { PnRenderer, type ViewMode } from '../engine/render/PnRenderer'
import type { TraceInfo } from '../engine/render/tracer'
import type { LapInfo } from '../engine/render/lap'
import { LAYER_ORDER, stageHeight, type Layers, type StageLayout } from '../engine/render/layout'
import { HIGH_INJECTION, TEMP, depletionWidth, injection, junctionAt, junctionV, psiB, stageV } from '../engine/physics/pn'
import { cB, cD } from '../engine/physics/capacitance'
import type { BiasInfo } from '../engine/render/stage'
import { AC_PERIOD, acAmplitude, type AcSignal } from '../app/acSignal'
import { Switcher, type SwitchLive } from '../app/switching'
import { UI } from '../devices/pn-junction/sections/ui'
import type { Step } from '../devices/pn-junction/sections/types'

/** V：外加电压；舞台上的粒子、耗尽层与图层按扣除体电阻压降后的等效结电压绘制（见 stageV） */
const props = defineProps<{ step: Step; V: number; T: number; vRange: [number, number]; formation: number; resetKey: number }>()
const emit = defineEmits<{ 'update:V': [number]; 'update:T': [number]; 'update:ac': [AcSignal | null]; 'update:sw': [SwitchLive | null]; replay: [] }>()
/** 结温下的结参数（U_bi、I_S、R_S、U_T 都随温度变） */
const j = computed(() => junctionAt(props.T))
const has = (t: Step['tools'][number]) => props.step.tools.includes(t)

const host = ref<HTMLDivElement>()
const r = shallowRef<PnRenderer>()
const L = shallowRef<StageLayout>()
const view = ref<ViewMode>('particles')
const layers = reactive<Layers>({ field: false, potential: false, conc: false, band: false })
const playing = ref(true)
// 慢放档位：0.05× 时可以逐个看清载流子的碰撞、复合与被电场扫过
const SPEEDS = [0.05, 0.1, 0.25, 0.5, 1, 2]
const speed = ref(1)
const tracing = ref(false)
const showDrift = ref(false)
/** 细柱小插图被收起（换步后重新显示） */
const insetHidden = ref(false)

// ───────────── 一个电子走一圈（示意演示） ─────────────
/** 舞台下方的说明面板（演示结束后保留，方便读完说明） */
const lapOpen = ref(false)
/** 演示进行中的路段；未在演示时为 null */
const lapInfo = shallowRef<LapInfo | null>(null)
/** 正偏才演示：零偏、反偏没有净电流，画一圈会误导 */
const LAP_MIN_V = 0.3
function startLap() {
  tracing.value = false
  r.value?.startLap()
  lapOpen.value = true
  lapInfo.value = r.value?.lapInfo ?? null
}
function closeLap() {
  r.value?.stopLap()
  lapOpen.value = false
  lapInfo.value = null
}

// ───────────── 控制条上的滑块 ─────────────
const vSlider = useSlider(() => props.V, (v) => emit('update:V', v))
const tSlider = useSlider(() => props.T, (t) => emit('update:T', t))

// ───────────── 开关过程（0.8） ─────────────
/** 由开关模型给出端电压与结压降，取代电压滑块 */
const ctl = new Switcher(() => (playing.value = false))
const swOn = computed(() => !!props.step.switching)
/** 开关过程中此刻的端电压与结压降（V）；结压降变化超过 2 mV 才刷新，避免每帧重算标注 */
const swNow = shallowRef<{ v: number; vj: number } | null>(null)
/** 开关过程的实时状态（给控制条，并转发给图表） */
const swLive = shallowRef<SwitchLive | null>(null)
function syncSw() {
  const vj = ctl.vj
  if (!swNow.value || Math.abs(swNow.value.vj - vj) > 2e-3) swNow.value = { v: ctl.v, vj }
  swLive.value = ctl.live()
  emit('update:sw', swLive.value)
}
/** 控制条上的操作（换流按钮、改 I_F 与 di/dt）：暂停时也立即刷新，并恢复播放 */
function onSwitch(act: () => void) {
  act()
  syncSw()
  playing.value = true
}

/** 重新开始：开关过程重新换流；"结的形成"由页面把形成进度归零、重新播放；其余只重新布置粒子 */
function replay() {
  if (swOn.value) onSwitch(() => ctl.arm(ctl.spec.auto))
  else if (props.step.formation) emit('replay')
  else r.value?.reset()
}

// ───────────── 舞台上的等效电压与体电阻压降 ─────────────
const simV = computed(() => (swNow.value ? j.value.Vbi - psiB(swNow.value.vj, j.value) : stageV(props.V, j.value)))
const bias = computed<BiasInfo>(() => {
  const v = swNow.value?.v ?? props.V
  const vj = swNow.value?.vj ?? junctionV(props.V, j.value)
  return { ir: v - vj, vRange: props.vRange, high: injection(vj, j.value) > HIGH_INJECTION }
})
/** 体电阻压降超过 5 mV 时，电势图层的灰色斜线才看得出来；这时标出两段压降的数值 */
const splitText = computed(() =>
  bias.value.ir <= 0.005 ? null : fillBi(UI.potentialSplit, { j: (j.value.Vbi - simV.value).toFixed(2), r: bias.value.ir.toFixed(2) }),
)

// ───────────── 交流小信号（0.7） ─────────────
const acOn = ref(false)
/** 交流信号的幅度（V），关闭时为 0 */
const acAmp = computed(() => (acOn.value ? acAmplitude(props.V, props.vRange) : 0))
/** 交流信号下哪种电容为主：反偏只有势垒电容 C_j，正偏时扩散电容 C_d 往往大得多 */
const capKind = computed<'B' | 'D'>(() => (cD(props.V, j.value) > cB(props.V, j.value) ? 'D' : 'B'))
/** 导线珠子随充放电来回挪的幅度（珠距） */
const CAP_BEADS = 1.6
/** 交流相位（非响应式，每帧改写）与此刻是充电还是放电（读数轮询时更新） */
let acPhase = 0
const charging = ref<boolean | null>(null)
/** 耗尽层宽度随交流信号摆动的范围（归一化） */
const acBand = computed(() => {
  const a = acAmp.value
  if (!a) return null
  const wAt = (v: number) => depletionWidth(stageV(v, j.value), props.formation, j.value)
  return { lo: wAt(props.V + a), hi: wAt(props.V - a) }
})

// ───────────── 读数：每 120 ms 从渲染器取一次 ─────────────
/** 电流计取约 5 s 的滑动平均：粒子越过结是一个个离散事件，读数本身有统计涨落（散粒噪声） */
const METER_MS = 120
const METER_N = Math.round(5000 / METER_MS)
const samples: number[] = []
const current = ref(0)
const counts = ref({ outA: 0, inK: 0 })
const trace = shallowRef<TraceInfo | null>(null)
/** 被标记电子还剩几个；未标记时为 null */
const groupCount = ref<number | null>(null)

const hostW = ref(0)
// 舞台高度由 JS 按宽度与图层计算：器件区不被挤压，打开图层时向下长高（不用 CSS 过渡，避免画布反复重建）
const hostH = computed(() => (hostW.value ? stageHeight(hostW.value, layers) : 480))
let ro: ResizeObserver | undefined
let meter: number | undefined

/** 进入新的一步：按步骤设定图层、追踪，并收起这一步用不到的工具 */
function applyStep(s: Step) {
  Object.assign(layers, { field: false, potential: false, conc: false, band: false }, s.layers)
  tracing.value = !!s.autoTrace
  insetHidden.value = false
  closeLap()
  r.value?.sim.resetCounters()
  if (!s.tools.includes('group')) clearGroup()
  if (!s.tools.includes('drift')) showDrift.value = false
  acOn.value = s.tools.includes('ac')
  if (s.switching) {
    ctl.setMode(s.switching.mode)
    swNow.value = null
    syncSw()
  } else {
    swNow.value = swLive.value = null
    emit('update:sw', null)
  }
}
applyStep(props.step)

const flowLabels = () => ({ diffusion: tx(UI.diffusion), drift: tx(UI.drift) })

onMounted(async () => {
  // hostW 必须在 pr.init() 之前设置，让 hostH 算出正确高度，否则画布按默认的 480 布局
  hostW.value = host.value!.clientWidth
  const pr = new PnRenderer(host.value!, settings.density)
  pr.sim.setJunction(j.value)
  pr.sim.V = simV.value
  pr.sim.formation = props.formation
  // 构造时粒子按已形成的结布置；"结的形成"从接触瞬间开始，要按当前进度重新布置（两区各自均匀）
  if (props.formation < 1) pr.bundle.reset()
  pr.bias = bias.value
  pr.layers = { ...layers }
  pr.view = view.value
  pr.labels = flowLabels()
  pr.acBand = acBand.value
  pr.beforeStep = () => {
    if (swOn.value) {
      pr.sim.V = j.value.Vbi - psiB(ctl.tick(pr.sim.t, pr.sim.tau), j.value)
      pr.speed = speed.value * ctl.speedFactor
      syncSw()
      return
    }
    pr.speed = speed.value
    const a = acAmp.value
    if (!a) return
    acPhase = (2 * Math.PI * pr.sim.t) / AC_PERIOD
    const s = Math.sin(acPhase)
    const v = a * s
    pr.sim.V = stageV(props.V + v, j.value)
    // 结电荷随电压单调增大（dQ/dV = C > 0）：电压升高时导线里的电子沿正向挪，降低时挪回来
    pr.capShift = CAP_BEADS * s
    pr.acHill = capKind.value === 'D' ? s : null
    emit('update:ac', { v, amp: a })
  }
  await pr.init(settings.style, settings.theme)
  if (!host.value) {
    pr.destroy()
    return
  }
  // await 期间浏览器完成了布局，重新读取真实宽度
  hostW.value = host.value.clientWidth
  r.value = pr
  pr.playing = playing.value
  L.value = pr.L
  ro = new ResizeObserver(() => {
    hostW.value = host.value!.clientWidth
    pr.resize(host.value!.clientWidth, host.value!.clientHeight)
    L.value = pr.L
  })
  ro.observe(host.value)
  pr.setTracing(tracing.value)
  markAtContact()
  meter = window.setInterval(() => {
    samples.push(pr.bundle.current)
    if (samples.length > METER_N) samples.shift()
    const c = samples.reduce((a, b) => a + b, 0) / samples.length
    current.value = Math.abs(props.V) < 0.03 && Math.abs(c) < 1 ? 0 : c
    counts.value = { ...pr.sim.counts }
    trace.value = pr.trace ? { ...pr.trace } : null
    // 充电 = 存的电荷在增多：反偏（势垒电容）是反压变大、即电压在下降时；正偏（扩散电容）是电压在上升时
    charging.value = acAmp.value ? (Math.cos(acPhase) > 0) === (capKind.value === 'D') : null
    lapInfo.value = pr.lapInfo
    groupCount.value = pr.groupCount
  }, METER_MS)
  exposeDebug({ renderer: pr })
})

onBeforeUnmount(() => {
  ro?.disconnect()
  clearInterval(meter)
  r.value?.destroy()
  emit('update:ac', null)
  emit('update:sw', null)
})

watch(() => [settings.style, settings.theme] as const, ([s, t]) => r.value?.setStyle(s, t))
watch(() => settings.density, (d) => r.value?.setCount(d))
watch(() => settings.lang, () => {
  if (r.value) r.value.labels = flowLabels()
})
// 同步刷新：调试用的 __pdvl.advance 在同一个任务里改电压并推进仿真
watch(j, (v) => r.value?.sim.setJunction(v), { flush: 'sync' })
watch(simV, (v) => { if (r.value) r.value.sim.V = v }, { flush: 'sync' })
watch(() => props.V, (v) => { if (v < LAP_MIN_V && lapInfo.value) closeLap() })
watch(bias, (b) => { if (r.value) r.value.bias = b })
watch(() => props.formation, (f) => { if (r.value) r.value.sim.formation = f }, { flush: 'sync' })
watch(() => props.step, applyStep)
watch(() => props.resetKey, () => {
  r.value?.reset()
  markAtContact()
})
watch(view, (v) => { if (r.value) r.value.view = v })
watch(layers, async (l) => {
  if (!r.value) return
  await nextTick() // 等新的舞台高度生效
  r.value.setLayers(l)
  L.value = r.value.L
})
watch(playing, (p) => { if (r.value) r.value.playing = p })
watch(tracing, (t) => {
  r.value?.setTracing(t)
  if (t) closeLap()
})
watch(showDrift, (s) => { if (r.value) r.value.showDrift = s })
watch(speed, (s) => { if (r.value) r.value.speed = s })
watch(acBand, (b) => { if (r.value) r.value.acBand = b })
// 关掉交流信号：粒子仿真回到直流电压
watch(acAmp, (a) => {
  if (a) return
  if (r.value) {
    r.value.sim.V = simV.value
    r.value.capShift = 0
    r.value.acHill = null
  }
  charging.value = null
  emit('update:ac', null)
})

defineExpose({ togglePlay: () => (playing.value = !playing.value), cycleView })

function cycleView() {
  const order: ViewMode[] = ['particles', 'flow', 'both']
  view.value = order[(order.indexOf(view.value) + 1) % order.length]
}

// ───────────── 电子群 ─────────────
function markGroup() {
  r.value?.markGroup()
  groupCount.value = r.value?.groupCount ?? null
}
function clearGroup() {
  r.value?.clearGroup()
  groupCount.value = null
}
/** "结的形成"在接触瞬间就标记结旁的一群电子：势垒建立只要几秒，等用户读完说明再点就错过了 */
function markAtContact() {
  if (props.step.formation && has('group')) markGroup()
}
const fewText = computed(() => fillBi(UI.group.few, { n: groupCount.value ?? 0 }))

// ───────────── 标注 ─────────────
const w = computed(() => depletionWidth(simV.value, props.formation, j.value))
/** 交流信号下耗尽层两侧电荷增减的位置（P 侧、N 侧摆动区的中点）；扩散电容为主时摆动区太窄，改标少子小山 */
const dqX = computed(() => {
  const b = acBand.value
  if (!b || capKind.value === 'D') return null
  const m = (b.lo + b.hi) / 4
  return { p: 0.5 - m, n: 0.5 + m }
})

/** 扩散电容为主时，两侧少子小山的标注位置（离耗尽层边缘约一个扩散长度） */
const hillX = computed(() => {
  const sim = r.value?.sim
  if (!acAmp.value || capKind.value !== 'D' || !sim) return null
  return { p: 0.5 - w.value / 2 - sim.diffusionLength(0), n: 0.5 + w.value / 2 + sim.diffusionLength(1) }
})

const narrow = computed(() => hostW.value > 0 && hostW.value < 560)
const regionText = computed(() => (narrow.value ? UI.regionsShort : UI.regions))

/** 标注位置（像素，来自与画布共用的布局） */
const marks = computed(() => {
  const l = L.value
  if (!l) return null
  const X = (x: number) => l.devX0 + x * l.devW
  return {
    X,
    pX: X(0.25 - w.value / 4),
    nX: X(0.75 + w.value / 4),
    cX: X(0.5),
    labelY: l.devY0 - 10,
    aX: l.devX0 - 7.5,
    kX: l.devX0 + l.devW + 7.5,
    wireY: l.wireY,
    rows: l.rows,
    devX0: l.devX0,
    devY0: l.devY0,
    devH: l.devH,
    width: l.width,
    // 大注入时结区很窄，但标签要换成"结区"并保留
    showScr: bias.value.high || w.value * l.devW > (narrow.value ? 54 : 70),
  }
})

const biasDir = computed(() => (props.V > 0.02 ? 'fwd' : props.V < -0.02 ? 'rev' : 'zero'))
// 计数器拖动电压时照常累计（A 端流出与 K 端流入始终相等），正偏、反偏切换时清零：净流向反过来了
watch(biasDir, () => r.value?.sim.resetCounters())
</script>

<template>
  <section class="stage panel">
    <div class="stage-top">
      <div class="seg" role="group" :aria-label="tx(UI.view)">
        <button v-for="m in (['particles', 'flow', 'both'] as const)" :key="m" :aria-pressed="view === m" @click="view = m">
          <Bi :t="UI.views[m]" />
        </button>
      </div>
      <div class="layer-chips" role="group" :aria-label="tx(UI.layers)">
        <button v-for="k in LAYER_ORDER" :key="k" class="chip" :class="`chip-${k}`" :aria-pressed="layers[k]" @click="layers[k] = !layers[k]">
          <i class="dot" aria-hidden="true" />
          <Bi :t="UI.layerNames[k]" />
        </button>
      </div>
    </div>

    <div ref="host" class="canvas-host" :style="{ height: `${hostH}px` }">
      <div v-if="marks" class="overlay" aria-hidden="true">
        <span class="region p" :style="{ left: `${marks.pX}px`, top: `${marks.labelY}px` }"><Bi :t="regionText.p" /></span>
        <span class="region n" :style="{ left: `${marks.nX}px`, top: `${marks.labelY}px` }"><Bi :t="regionText.n" /></span>
        <Transition name="fade">
          <span v-if="marks.showScr" class="region scr" :style="{ left: `${marks.cX}px`, top: `${marks.labelY}px` }"><Bi :t="bias.high ? regionText.scrHigh : regionText.scr" /></span>
        </Transition>
        <Transition name="fade">
          <span v-if="bias.high" class="high-note" :style="{ left: `${marks.cX}px`, top: `${marks.devY0 + 8}px` }"><Bi :t="UI.highInjection" /></span>
        </Transition>
        <Transition name="fade">
          <TubeInset
            v-if="step.inset === 'tube' && !insetHidden && !tracing && !lapInfo"
            class="inset"
            :w="w"
            :style="{ right: `${marks.devX0 + 8}px`, top: `${marks.devY0 + 8}px` }"
            @close="insetHidden = true"
          />
        </Transition>
        <template v-if="hillX">
          <span class="hill e" :style="{ left: `${marks.X(hillX.p)}px`, top: `${marks.devY0 + 8}px` }"><Bi :t="UI.cap.hillP" /></span>
          <span class="hill h" :style="{ left: `${marks.X(hillX.n)}px`, top: `${marks.devY0 + 8}px` }"><Bi :t="UI.cap.hillN" /></span>
        </template>
        <Transition name="fade">
          <div v-if="charging !== null" class="cap-badge" :class="{ on: charging }" :style="{ left: `${marks.cX}px`, top: `${marks.devY0 + marks.devH - 12}px` }">
            <b><Bi :t="charging ? UI.cap.charge : UI.cap.discharge" /></b>
            <span><Bi :t="(charging ? UI.cap.chargeWhy : UI.cap.dischargeWhy)[capKind]" /></span>
          </div>
        </Transition>
        <template v-if="dqX">
          <span class="dq minus" :style="{ left: `${marks.X(dqX.p)}px`, top: `${marks.devY0 + 8}px` }">−ΔQ</span>
          <span class="dq plus" :style="{ left: `${marks.X(dqX.n)}px`, top: `${marks.devY0 + 8}px` }">+ΔQ</span>
        </template>
        <span class="term" :style="{ left: `${marks.aX}px`, top: `${marks.wireY - 5}px` }">A</span>
        <span class="term" :style="{ left: `${marks.kX}px`, top: `${marks.wireY - 5}px` }">K</span>
        <template v-if="!acAmp">
        <span class="counter a" :title="tx(UI.counters.hint)" :style="{ left: `${marks.aX + 12}px`, top: `${marks.wireY + 6}px` }">
          <Bi :t="counts.outA < 0 ? UI.counters.inA : UI.counters.outA" /> <b>{{ Math.abs(counts.outA) }}</b>
        </span>
        <span class="counter k" :title="tx(UI.counters.hint)" :style="{ left: `${marks.kX - 12}px`, top: `${marks.wireY + 6}px` }">
          <Bi :t="counts.inK < 0 ? UI.counters.outK : UI.counters.inK" /> <b>{{ Math.abs(counts.inK) }}</b>
        </span>
        </template>
        <TraceCard
          v-if="tracing && trace && view !== 'flow'"
          :trace="trace"
          :style="{ left: `${trace.x < 0.5 ? marks.width - marks.devX0 - 10 : marks.devX0 + 10}px`, top: `${marks.devY0 + 10}px` }"
        />
        <div v-for="row in marks.rows" :key="row.key" class="row-label" :class="`rl-${row.key}`" :style="{ left: `${marks.devX0 + 10}px`, top: `${row.y0 + 5}px` }">
          <b><Bi :t="UI.layerNames[row.key]" /></b>
          <small><Bi :t="UI.rowNotes[row.key]" /></small>
          <small v-if="row.key === 'potential' && splitText"><Bi :t="splitText" /></small>
        </div>
        <div v-if="view !== 'particles'" class="lane-tags" :style="{ left: `${marks.width - marks.devX0 - 10}px`, top: `${marks.devY0 + 8}px`, height: `${marks.devH - 16}px` }">
          <span class="lt e"><Bi :t="UI.lanes.e" /></span>
          <span class="lt h"><Bi :t="UI.lanes.h" /></span>
        </div>
      </div>
    </div>

    <LapPanel v-if="lapOpen" :info="lapInfo" @again="startLap" @close="closeLap" />

    <ul class="legend">
      <li><i class="lg-dot e" /><Bi :t="UI.legend.electron" /></li>
      <li><i class="lg-dot h" /><Bi :t="UI.legend.hole" /></li>
      <HeatLegend />
      <li><span class="beads" aria-hidden="true"><i class="lg-dot e small" /><i class="lg-dot e small" /><i class="lg-dot e small" /></span><Bi :t="UI.legend.bead" /></li>
      <template v-if="groupCount !== null">
        <li><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M1 13 Q5 12 9 9" fill="none" stroke="var(--ink)" stroke-width="2" opacity="0.5" /><circle cx="10" cy="8.5" r="4" fill="var(--ink)" stroke="var(--electron)" stroke-width="1.8" /></svg><Bi :t="UI.legend.groupCenter" /></li>
        <li><svg width="22" height="18" viewBox="0 0 22 18" aria-hidden="true"><ellipse cx="11" cy="9" rx="9.5" ry="6" transform="rotate(-15 11 9)" fill="var(--electron)" fill-opacity="0.15" stroke="var(--electron)" stroke-width="1.6" /></svg><Bi :t="UI.legend.groupSpread" /></li>
      </template>
      <template v-if="showDrift">
        <li><svg width="22" height="18" viewBox="0 0 22 18" aria-hidden="true"><path d="M20 6 H7" stroke="var(--electron)" stroke-width="2.6" stroke-linecap="round" /><path d="M2 6 L8 2.5 V9.5 Z" fill="var(--electron)" /><path d="M2 13 H15" stroke="var(--hole)" stroke-width="2.6" stroke-linecap="round" /><path d="M20 13 L14 9.5 V16.5 Z" fill="var(--hole)" /></svg><Bi :t="UI.legend.drift" /></li>
        <li><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="4" fill="none" stroke="var(--ink-soft)" stroke-width="1.6" /></svg><Bi :t="UI.legend.driftFew" /></li>
      </template>
    </ul>

    <div class="stage-bottom">
      <StageTransport v-model:playing="playing" v-model:speed="speed" :speeds="SPEEDS" @replay="replay">
        <button class="btn" :aria-pressed="tracing" @click="tracing = !tracing"><Bi :t="tracing ? UI.trace.stop : UI.trace.start" /></button>
        <button v-if="tracing" class="btn" @click="r?.nextTrace()"><Bi :t="UI.trace.next" /></button>
        <template v-if="has('group')">
          <button class="btn" :aria-pressed="groupCount !== null" @click="groupCount === null ? markGroup() : clearGroup()">
            <Bi :t="groupCount === null ? UI.group.mark : UI.group.clear" />
          </button>
          <button v-if="groupCount !== null && groupCount < 5" class="btn hint" @click="markGroup()"><Bi :t="fewText" /></button>
        </template>
        <button v-if="has('ac')" class="btn" :aria-pressed="acOn" @click="acOn = !acOn"><Bi :t="UI.ac.toggle" /></button>
        <button v-if="has('drift')" class="btn" :aria-pressed="showDrift" @click="showDrift = !showDrift"><Bi :t="UI.driftToggle" /></button>
        <button
          v-if="has('lap')"
          class="btn"
          :aria-pressed="!!lapInfo"
          :disabled="!lapInfo && V < LAP_MIN_V"
          :title="!lapInfo && V < LAP_MIN_V ? tx(UI.lap.needFwd) : undefined"
          @click="lapInfo ? closeLap() : startLap()"
        >
          <Bi :t="lapInfo ? UI.lap.stop : UI.lap.start" />
        </button>
        <template #end>
          <DensitySlider :hint="UI.densityHint" />
        </template>
      </StageTransport>

      <SwitchControls
        v-if="swOn && swLive"
        :live="swLive"
        @press="onSwitch(() => ctl.press())"
        @params="(p) => onSwitch(() => ctl.setParams(p))"
      />
      <label v-else-if="vRange[0] !== vRange[1]" class="bias" :class="biasDir">
        <span class="bias-name"><Bi :t="UI.bias" /></span>
        <input type="range" :min="vRange[0]" :max="vRange[1]" step="0.01" :value="vSlider.shown" @input="vSlider.input" @change="vSlider.release" />
        <output class="bias-val">{{ signedV(V) }}<small v-if="acAmp" class="ac-amp"> ± {{ acAmp.toFixed(2) }}</small></output>
      </label>
      <div v-else class="bias bias-fixed">
        <span class="bias-name"><Bi :t="UI.bias" /></span>
        <span class="bias-val">{{ signedV(V) }}</span>
        <span class="bias-lock"><Bi :t="UI.biasFixed" /></span>
      </div>

      <label v-if="has('temp')" class="bias temp">
        <span class="bias-name"><Bi :t="UI.temp" /></span>
        <input type="range" :min="TEMP.min" :max="TEMP.max" step="1" :value="tSlider.shown" @input="tSlider.input" @change="tSlider.release" />
        <output class="bias-val">{{ celsius(T) }}</output>
      </label>

      <CurrentMeter :value="current" :name="UI.current" />
    </div>
    <p class="scaled"><Bi :t="UI.scaled" /></p>
  </section>
</template>

<style scoped>
.layer-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.chip .dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.35;
}
.chip[aria-pressed='true'] .dot {
  opacity: 1;
}
.chip-field .dot { background: var(--field); }
.chip-potential .dot { background: var(--potential); }
.chip-conc .dot { background: linear-gradient(90deg, var(--hole) 50%, var(--electron) 50%); }
.chip-band .dot { background: var(--ink-soft); }

.overlay > .inset {
  position: absolute;
}
.high-note {
  position: absolute;
  transform: translateX(-50%);
  max-width: 46%;
  padding: 0.3em 0.8em;
  border-radius: 10px;
  font-size: 0.78rem;
  line-height: 1.4;
  text-align: center;
  background: color-mix(in srgb, var(--surface) 86%, transparent);
  border: 1.5px dashed var(--ink-soft);
}

.dq {
  position: absolute;
  transform: translateX(-50%);
  padding: 0 0.5em;
  border-radius: 999px;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 0.8rem;
  line-height: 1.5;
  color: #fff;
  white-space: nowrap;
}
.dq.minus { background: var(--ion-minus); }
.dq.plus { background: var(--ion-plus); }
.hill {
  position: absolute;
  transform: translateX(-50%);
  padding: 0 0.6em;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1.6;
  color: #fff;
  white-space: nowrap;
}
.hill.e { background: var(--electron); }
.hill.h { background: var(--hole); }
.cap-badge {
  position: absolute;
  transform: translate(-50%, -100%);
  max-width: min(420px, 62%);
  padding: 0.3em 0.9em;
  border-radius: 12px;
  text-align: center;
  font-size: 0.8rem;
  line-height: 1.4;
  background: color-mix(in srgb, var(--surface) 88%, transparent);
  border: 2px solid var(--ink-soft);
  transition: border-color 0.2s;
}
.cap-badge.on { border-color: var(--accent); }
.cap-badge b {
  display: block;
  font-family: var(--font-display);
  font-size: 0.95rem;
}
.cap-badge.on b { color: var(--accent); }
.ac-amp {
  font-size: 0.75em;
  color: var(--accent);
}


.btn.hint {
  border-color: var(--accent);
  color: var(--accent);
}
.beads { display: inline-flex; gap: 2px; }

.row-label {
  position: absolute;
  font-size: 0.78rem;
  line-height: 1.25;
  display: flex;
  gap: 8px;
  align-items: baseline;
}
.row-label b { font-weight: 700; }
.row-label small { color: var(--ink-soft); font-size: 0.72rem; }
.rl-field b { color: var(--field); }
.rl-potential b { color: var(--potential); }
.rl-band b { color: var(--ink); }
.rl-conc b { color: var(--electron); }
[data-theme='light'] .rl-field b { filter: brightness(0.75); }

.lane-tags {
  position: absolute;
  transform: translateX(-100%);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-end;
}
.lt {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.1em 0.6em;
  border-radius: 999px;
  color: #fff;
  white-space: nowrap;
}
.lt.e { background: var(--electron); }
.lt.h { background: var(--hole); }

.bias-fixed {
  display: flex;
  align-items: center;
  gap: 8px;
}
.bias-lock {
  font-size: 0.8rem;
  color: var(--ink-soft);
  font-style: italic;
}
</style>
