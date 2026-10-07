// 第 1 章的粒子舞台：在一个 HTML 容器里建第 0 章的 PnRenderer，跑 PinSim（P⁺ / N / N⁺），
// 负责创建与销毁、尺寸跟随、偏置同步、配色、播放控制，并定时把计数器等状态读给 Vue
import { onBeforeUnmount, onMounted, ref, shallowRef, watch, type Ref } from 'vue'
import { DENSITY, settings } from './settings'
import { exposeDebug } from './debug'
import { PnRenderer } from '../engine/render/PnRenderer'
import { PnBundle } from '../engine/physics/pnBundle'
import { PIN_SIM, PinSim, type PinGeometry, type PinSimBias } from '../engine/physics/pinSim'
import type { Layers, StageLayout } from '../engine/render/layout'
import type { TraceInfo } from '../engine/render/tracer'

const NO_LAYERS: Layers = { field: false, potential: false, conc: false, band: false }
const POLL_MS = 120

/**
 * 粒子数滑块（与第 0 章共用，默认 200）→ P⁺ 区的空穴个数：默认 360，其余各区按比例。
 * 缩放限制在 0.25–2 倍：再少 N⁻ 区就只剩一两个电子，再多两个对比舞台会卡
 */
const pinCount = (density: number) => Math.round(PIN_SIM.HEAVY * Math.min(2, Math.max(0.25, density / DENSITY.def)))

export interface PinStageOpts {
  host: Ref<HTMLDivElement | undefined>
  bias: () => PinSimBias
  playing: Ref<boolean>
  speed: Ref<number>
  geo?: PinGeometry
  /** 普通 PN 结（没有 N⁺）：器件按同一把尺画得短 */
  plain?: boolean
  tracing?: Ref<boolean>
  /** 调试时挂到 window.__pdvl 上的名字（默认 renderer） */
  debugKey?: string
  /** 每次轮询时调用（读额外的统计量） */
  onPoll?: (sim: PinSim) => void
  /** 点"重新开始"、粒子重新布置之后调用（清掉舞台组件自己的累计统计） */
  onReset?: () => void
}

export function usePinStage(o: PinStageOpts) {
  const r = shallowRef<PnRenderer>()
  const L = shallowRef<StageLayout>()
  const hostW = ref(0)
  /** 外电路计数、追踪信息、N 区粒子权重、耗尽层两端 */
  const counts = ref({ outA: 0, inK: 0 })
  const trace = ref<TraceInfo | null>(null)
  const weight = ref(1)
  /** 正偏时阳极端等离子体与 P⁺ 的浓度比（舞台上的 / 真实的） */
  const ratio = ref<{ stage: number; real: number } | null>(null)
  /** A 端的净电流（粒子/秒，约 1 s 平滑；示意，真实电流以 V-A 曲线为准） */
  const current = ref(0)
  const depl = ref<[number, number]>([PIN_SIM.XA, PIN_SIM.XA])
  /** P⁺N 结与 N 区右端的位置（仿真坐标，建好后不变） */
  const xa = ref(PIN_SIM.XA)
  const xk = ref(PIN_SIM.XK)
  const sim = () => r.value?.sim as PinSim | undefined
  let ro: ResizeObserver | undefined
  let meter = 0

  function poll(pr: PnRenderer) {
    const s = pr.sim as PinSim
    counts.value = { ...s.counts }
    trace.value = pr.trace ? { ...pr.trace } : null
    weight.value = s.weight
    ratio.value = s.plasmaRatio
    current.value = Math.abs(s.current) < 0.05 ? 0 : s.current
    depl.value = s.depletion
    o.onPoll?.(s)
  }

  onMounted(async () => {
    const host = o.host.value!
    hostW.value = host.clientWidth
    const pr = new PnRenderer(host, new PnBundle(pinCount(settings.density), (n) => new PinSim(o.geo, n, o.plain), null))
    const s = pr.sim as PinSim
    s.setBias(o.bias())
    s.reset()
    pr.devSpan = s.span
    xa.value = s.xa
    xk.value = s.xk
    pr.layers = { ...NO_LAYERS }
    // 电场箭头画在器件里；电场图另由舞台组件画在下方
    pr.fieldArrows = true
    await pr.init(settings.style, settings.theme)
    if (!o.host.value) {
      pr.destroy()
      return
    }
    hostW.value = host.clientWidth
    r.value = pr
    pr.playing = o.playing.value
    pr.speed = o.speed.value
    pr.setTracing(!!o.tracing?.value)
    L.value = pr.L
    ro = new ResizeObserver(() => {
      hostW.value = host.clientWidth
      pr.resize(host.clientWidth, host.clientHeight)
      L.value = pr.L
    })
    ro.observe(host)
    poll(pr)
    meter = window.setInterval(() => poll(pr), POLL_MS)
    exposeDebug({ [o.debugKey ?? 'renderer']: pr })
  })

  onBeforeUnmount(() => {
    ro?.disconnect()
    clearInterval(meter)
    r.value?.destroy()
  })

  watch(o.bias, (b, old) => {
    sim()?.setBias(b)
    // 正偏、反偏切换时计数器清零：净流向反过来了
    if (old && b.mode !== old.mode) sim()?.resetCounters()
  })
  watch(() => [settings.style, settings.theme] as const, ([s, t]) => r.value?.setStyle(s, t))
  watch(() => settings.density, (d) => {
    const pr = r.value
    if (!pr) return
    pr.setCount(pinCount(d))
    poll(pr)
  })
  watch(o.playing, (p) => { if (r.value) r.value.playing = p })
  watch(o.speed, (s) => { if (r.value) r.value.speed = s })
  if (o.tracing) watch(o.tracing, (t) => r.value?.setTracing(t))

  /** 重新开始：粒子按当前偏置重新布置，计数器清零 */
  function replay() {
    const pr = r.value
    if (!pr) return
    pr.reset()
    o.onReset?.()
    poll(pr)
  }

  return { r, L, hostW, counts, trace, weight, ratio, current, depl, xa, xk, sim, replay }
}
