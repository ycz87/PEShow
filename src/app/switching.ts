// 0.8 动态特性的舞台流程：先在换流前的稳态停留，让舞台上的少子小山建立起来（准备），然后换流（运行），
// 运行中按模型算出的结压降 U_j(t) 驱动粒子舞台，必要时在关键时刻自动暂停，最后停在换流后的稳态（结束）。
//
// 时间对应：舞台上的少子寿命 sim.tau（约 2.2 s）对应真实的 τ = 5 µs，所以真实时间 t = (舞台时间 − 换流时刻)·τ/sim.tau。
// 换流过程只有几微秒，对应舞台上一两秒，运行时再慢放 4 倍；准备阶段快进 2 倍，少等一会儿。
import { TAU } from '../engine/physics/pn'
import { duration, simulate, type SwitchKind, type SwitchParams, type Waveform } from '../engine/physics/recovery'
import type { SwitchCue } from '../devices/pn-junction/sections/types'

export type SwitchMode = SwitchCue['mode']
export type SwitchPhase = 'settle' | 'ready' | 'run' | 'done'

/** 默认换流条件：I_F = 10 mA，di_F/dt = 10 mA/µs，U_R = 2 V */
export const P0: SwitchParams = { IF: 10e-3, didt: 1e4, VR: 2 }
/** 对比一步里 I_F（A）与 di_F/dt（A/s）的可调范围 */
export const IF_RANGE = { min: 5e-3, max: 20e-3, step: 1e-3 }
export const DIDT_RANGE = { min: 5e3, max: 20e3, step: 1e3 }

/** 准备阶段在稳态停留的舞台时间（s）：约 2.7 个舞台寿命，小山基本建好（或基本清空） */
const SETTLE = 6
/** 准备阶段快进、运行阶段慢放的倍数（乘在用户选的速度上） */
const SETTLE_FAST = 2
const RUN_SLOW = 0.25

interface ModeSpec {
  kind: SwitchKind
  /** 这一步不换流，只停在换流前的稳态（0.8-1 静态与动态、0.8-6 开通与关断对比） */
  still?: boolean
  /** 准备好后自动换流；否则停在稳态，等用户按按钮 */
  auto: boolean
  /** 自动暂停的时刻（s，换流开始后）；不暂停为 null */
  pause: ((w: Waveform) => number) | null
}

const MODES: Record<SwitchMode, ModeSpec> = {
  intro: { kind: 'off', auto: false, pause: null, still: true },
  on: { kind: 'on', auto: true, pause: null },
  off: { kind: 'off', auto: true, pause: (w) => (w.m!.t0 + w.m!.t1) / 2 },
  peak: { kind: 'off', auto: true, pause: (w) => w.m!.t1 },
  recover: { kind: 'off', auto: true, pause: null },
  compare: { kind: 'off', auto: false, pause: null, still: true },
  vi: { kind: 'off', auto: true, pause: null },
}

/** 运行到哪一刻结束（s）：关断到 t₂ 之后再看 0.6τ（取整到 µs）；开通看完整段（存储电荷堆到约 90%） */
export function endTime(w: Waveform) {
  if (!w.m) return duration(w)
  return Math.min(duration(w), Math.ceil((w.m.t2 + 0.6 * TAU) / 1e-6) * 1e-6)
}

/** 给图表的实时状态（每帧一个新对象） */
export interface SwitchLive {
  mode: SwitchMode
  phase: SwitchPhase
  w: Waveform
  /** 对比一步：上一次的波形 */
  ghost: Waveform | null
  /** 换流开始后的真实时间 s；换流前为 0 */
  t: number
  /** 停在自动暂停点上 */
  paused: boolean
  /** 准备阶段的进度 0…1（其余阶段为 1） */
  prep: number
  /** 这一步不换流（没有按钮） */
  still: boolean
  /** 对比一步：同一组条件下的开通、关断波形，以及上一组条件的（作对照） */
  pair: Record<SwitchKind, Waveform> | null
  ghostPair: Record<SwitchKind, Waveform> | null
}

export class Switcher {
  mode: SwitchMode = 'intro'
  phase: SwitchPhase = 'settle'
  params: SwitchParams = { ...P0 }
  w: Waveform = simulate('off', P0)
  ghost: Waveform | null = null
  pair: Record<SwitchKind, Waveform> | null = null
  ghostPair: Record<SwitchKind, Waveform> | null = null
  paused = false
  private auto = true
  private settleFrom = NaN
  private trigAt = 0
  private t = 0
  /** 一次运行中已经自动暂停过（继续播放后不再停） */
  private pauseDone = false
  private prep = 0
  /** 用户在"已准备好"时按了按钮，下一步换流 */
  private trigger = false

  /** onPause：到达自动暂停点时调用（舞台据此停止播放） */
  constructor(private readonly onPause: () => void) {}

  get spec() {
    return MODES[this.mode]
  }

  /** 进入某一步：恢复默认条件，重新准备 */
  setMode(mode: SwitchMode) {
    this.mode = mode
    this.params = { ...P0 }
    this.ghost = null
    this.ghostPair = null
    this.w = simulate(this.spec.kind, this.params)
    this.pair = mode === 'compare' ? this.both() : null
    this.arm(this.spec.auto)
  }

  private both(): Record<SwitchKind, Waveform> {
    return { on: simulate('on', this.params), off: this.w }
  }

  /** 改换流条件（对比一步）：保留上一次完整运行的波形作对照，然后重新准备 */
  setParams(p: Partial<SwitchParams>) {
    const next = { ...this.params, ...p }
    if (next.IF === this.params.IF && next.didt === this.params.didt) return
    if (this.pair) {
      // 对比一步不换流：两张图直接换成新条件下的波形，上一组留作虚线
      this.ghostPair = this.pair
      this.params = next
      this.w = simulate(this.spec.kind, next)
      this.pair = this.both()
      return
    }
    if (this.phase === 'done') this.ghost = this.w
    this.params = next
    this.w = simulate(this.spec.kind, next)
    this.arm(true)
  }

  /** 回到换流前的稳态重新准备；auto = 准备好后自动换流 */
  arm(auto: boolean) {
    this.phase = 'settle'
    this.auto = auto
    this.settleFrom = NaN
    this.t = 0
    this.paused = false
    this.pauseDone = false
    this.prep = 0
  }

  /** 按钮：已准备好就立即换流，否则重新准备并在准备好后自动换流 */
  press() {
    if (this.phase === 'ready') this.trigger = true
    else this.arm(true)
  }

  /** 舞台每步之前调用（simT 为舞台时钟、tau 为舞台寿命），返回此刻应加在舞台上的结压降 U_j */
  tick(simT: number, tau: number): number {
    const w = this.w
    if (this.phase === 'settle') {
      if (Number.isNaN(this.settleFrom)) this.settleFrom = simT
      this.prep = Math.min(1, (simT - this.settleFrom) / SETTLE)
      if (simT - this.settleFrom >= SETTLE) this.phase = this.auto ? 'run' : 'ready'
      if (this.phase === 'run') this.trigAt = simT
    }
    if (this.phase === 'ready' && this.trigger) {
      this.phase = 'run'
      this.trigAt = simT
    }
    this.trigger = false
    if (this.phase === 'run') {
      this.paused = false
      this.t = ((simT - this.trigAt) * TAU) / tau
      const tp = this.spec.pause?.(w)
      if (tp !== undefined && !this.pauseDone && this.t >= tp) {
        this.t = tp
        this.pauseDone = true
        this.paused = true
        this.onPause()
      }
      const tEnd = endTime(w)
      if (this.t >= tEnd) {
        this.t = tEnd
        this.phase = 'done'
      }
    }
    return this.vj
  }

  private get k() {
    return Math.min(this.w.vj.length - 1, Math.round(this.t / this.w.dt))
  }

  /** 此刻的端电压、结压降（V） */
  get v() {
    return this.w.v[this.k]
  }

  get vj() {
    return this.w.vj[this.k]
  }

  /** 舞台速度的倍数 */
  get speedFactor() {
    return this.phase === 'settle' ? SETTLE_FAST : this.phase === 'run' ? RUN_SLOW : 1
  }

  live(): SwitchLive {
    return { mode: this.mode, phase: this.phase, w: this.w, ghost: this.ghost, t: this.t, paused: this.paused, prep: this.phase === 'settle' ? this.prep : 1, still: !!this.spec.still, pair: this.pair, ghostPair: this.ghostPair }
  }
}
