// 1.4 动态特性用到的波形：示例 PiN 的开通、关断（pinTransient.ts；电阻法电路与手册的 di_F/dt 测法），
// 以及手册测法下软恢复的示意波形。
// 计算约半秒，第一次用到时才算，之后缓存
import { terminalU } from '../../engine/physics/pin'
import {
  PIN_SW,
  forwardRecoveryOf,
  recoveryDidt,
  recoveryOf,
  sourceU1,
  turnOff,
  turnOn,
  type PinRecovery,
  type PinRecoveryDidt,
  type PinWave,
} from '../../engine/physics/pinTransient'

/** 一条 i(t)、u(t) 波形（时间 s、电流 A、电压 V） */
export interface Series {
  t: Float64Array
  i: Float64Array
  u: Float64Array
}

export const toSeries = (w: PinWave): Series => ({
  t: Float64Array.from(w.frames, (f) => f.t),
  i: Float64Array.from(w.frames, (f) => f.i),
  u: Float64Array.from(w.frames, (f) => f.u),
})

/** 两个电源与回路元件（电路图用） */
export const CIRCUIT = { U1: sourceU1(PIN_SW), UR: PIN_SW.UR, R: PIN_SW.R, L: PIN_SW.L, IF: PIN_SW.IF, IR: PIN_SW.UR / PIN_SW.R, didt: PIN_SW.didt, Ls: PIN_SW.Ls }

/** 开通、关断（电阻法）、关断（手册测法）画到多久（s） */
export const T_ON = 0.6e-6
export const T_OFF = 0.25e-6
export const T_DIDT = 0.25e-6

/** 手册测法下软恢复示意的软度（与 STTH3012 在 500 A/µs、125 °C 时的约 1.2 相当） */
export const S_SOFT = 1.3

/**
 * 软恢复二极管 B 的示意波形（手册测法）：反向电流峰值之前与 A 相同；之后按 −I_RM·(1 + s/τ)e^{−s/τ} 回零
 * （峰值处斜率为零，拖尾长），τ 取得使 t_b = S_SOFT·t_a。开关管已完全导通，电压由回路方程 u = −U_R − L_σ·di/dt 算出
 */
function softOf(a: Series, r: PinRecoveryDidt): Series {
  // (1 + x)e^{−x} = 0.1 在 x ≈ 3.890 处；t₂ = t₁ + (t_{0.1} − t₁)/0.9
  const tau = (S_SOFT * r.ta * 0.9) / 3.89
  const n = a.t.length
  const k1 = a.t.findIndex((t) => t >= r.t1)
  const t = Float64Array.from(a.t)
  const i = new Float64Array(n)
  const u = new Float64Array(n)
  for (let k = 0; k < n; k++) {
    if (k < k1) {
      i[k] = a.i[k]
      u[k] = a.u[k]
      continue
    }
    const x = (t[k] - t[k1]) / tau
    i[k] = -r.IRM * (1 + x) * Math.exp(-x)
    u[k] = -PIN_SW.UR - PIN_SW.Ls * ((r.IRM / tau) * x * Math.exp(-x))
  }
  return { t, i, u }
}

/** 电阻法下软恢复示意的拖尾时间常数（s） */
const TAU_SOFT_RES = 40e-9

/**
 * 电阻法电路里软恢复二极管 B 的示意波形：结开始阻断之前与 A 相同；之后电流按 i₀(1 + s/τ)e^{−s/τ} 慢慢回零，
 * 电压由回路方程 u = −U_R − R·i − L·di/dt 算出
 */
function softResOf(a: Series, tBlock: number): Series {
  const n = a.t.length
  const kb = a.t.findIndex((t) => t >= tBlock)
  const i0 = a.i[kb]
  const t = Float64Array.from(a.t)
  const i = new Float64Array(n)
  const u = new Float64Array(n)
  for (let k = 0; k < n; k++) {
    if (k < kb) {
      i[k] = a.i[k]
      u[k] = a.u[k]
      continue
    }
    const x = (t[k] - tBlock) / TAU_SOFT_RES
    i[k] = i0 * (1 + x) * Math.exp(-x)
    u[k] = -PIN_SW.UR - PIN_SW.R * i[k] - PIN_SW.L * ((-i0 / TAU_SOFT_RES) * x * Math.exp(-x))
  }
  return { t, i, u }
}

/** 电阻法波形的 t_rr（从 t₀ 量到反向电流降到 0.25 I_R）、Q_rr 与反向电压峰值 */
function resRecovery(s: Series, t0: number) {
  const lim = 0.25 * CIRCUIT.IR
  const n = s.t.length
  let k1 = 0
  for (let k = 1; k < n; k++) if (s.i[k] < s.i[k1]) k1 = k
  let ke = n - 1
  for (let k = k1; k < n; k++)
    if (-s.i[k] <= lim) {
      ke = k
      break
    }
  const tEnd = s.t[ke - 1] + ((-s.i[ke - 1] - lim) / (s.i[ke] - s.i[ke - 1])) * (s.t[ke] - s.t[ke - 1])
  let Qrr = 0
  let URM = 0
  for (let k = 1; k <= ke; k++) if (s.t[k] > t0) Qrr -= ((Math.min(0, s.i[k]) + Math.min(0, s.i[k - 1])) / 2) * (s.t[k] - s.t[k - 1])
  for (const v of s.u) URM = Math.max(URM, -v)
  return { tEnd, trr: tEnd - t0, Qrr, URM }
}

/** 开通后回落到 1.5 倍稳态压降的时刻（t_fr，与 STTH3012 的定义 V_FR = 1.5 × V_F 相同） */
export const TFR_FRAC = 1.5

export interface DynWaves {
  on: PinWave
  off: PinWave
  /** 手册测法（di_F/dt = 500 A/µs，L_σ = 50 nH）的关断 */
  offD: PinWave
  onS: Series
  offS: Series
  offDS: Series
  softS: Series
  fr: { UFRM: number; tPeak: number; tfr: number; UF: number }
  rr: PinRecovery
  rrD: PinRecoveryDidt
  rrSoft: PinRecoveryDidt
  /** 电阻法电路里软恢复 B 的示意波形，以及 A、B 的 t_rr、Q_rr、U_RM（t_rr 从 A 的 t₀ 量起） */
  softResS: Series
  resA: { tEnd: number; trr: number; Qrr: number; URM: number }
  resB: { tEnd: number; trr: number; Qrr: number; URM: number }
  /** 稳态 N⁻ 区等离子体的最大浓度（cm⁻³），浓度图的纵轴 */
  pMax: number
}

let cache: DynWaves | null = null

export function dynWaves(): DynWaves {
  if (cache) return cache
  const on = turnOn({}, T_ON, 3e-9)
  const off = turnOff({}, T_OFF + 0.05e-6, 1e-9)
  const offD = turnOff({}, T_DIDT + 0.05e-6, 1e-9, 'didt')
  const onS = toSeries(on)
  const offS = toSeries(off)
  const offDS = toSeries(offD)
  const UF = terminalU(PIN_SW.IF)
  const f = forwardRecoveryOf(on)
  let kfr = on.frames.length - 1
  for (let k = on.frames.findIndex((a) => a.t >= f.tPeak); k < on.frames.length; k++)
    if (on.frames[k].u <= TFR_FRAC * UF) {
      kfr = k
      break
    }
  const rr = recoveryOf(off)
  const softResS = softResOf(offS, rr.tBlock)
  const rrD = recoveryDidt(offDS.t, offDS.i, offDS.u)
  const softS = softOf(offDS, rrD)
  let pMax = 0
  for (const v of off.frames[0].p) pMax = Math.max(pMax, v)
  cache = {
    on,
    off,
    offD,
    onS,
    offS,
    offDS,
    softS,
    fr: { ...f, UF, tfr: on.frames[kfr].t },
    rr,
    rrD,
    rrSoft: recoveryDidt(softS.t, softS.i, softS.u),
    softResS,
    resA: resRecovery(offS, rr.t0),
    resB: resRecovery(softResS, rr.t0),
    pMax,
  }
  return cache
}

/** t 时刻（s）最近的一帧 */
export function frameAt(w: PinWave, t: number) {
  const f = w.frames
  const dt = f.length > 1 ? f[1].t - f[0].t : 1
  return f[Math.max(0, Math.min(f.length - 1, Math.round(t / dt)))]
}

/** 关断波形上电压最负的时刻（U_RM 出现处） */
export function tOfURM(s: Series) {
  let k = 0
  for (let q = 1; q < s.u.length; q++) if (s.u[q] < s.u[k]) k = q
  return s.t[k]
}
