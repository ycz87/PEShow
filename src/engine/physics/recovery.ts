// 二极管的开关动态（0.8）：少子扩散方程与外电路联立数值求解，得到开通、关断（反向恢复）的 i(t)、u(t)。
//
// 器件：示例 PN 结（pn.ts），长基区、小注入，两侧少子寿命相同（τ = 5 µs）。中性区的多余少子满足
//   ∂u/∂t = ∂²u/∂ξ² − u（ξ 以扩散长度为单位，t 以 τ 为单位，u = 多余少子浓度 / 平衡少子浓度），
//   结边 u(0) = e^{U_j/U_T} − 1，远端 u = 0（长基区）。
// 两侧的归一化方程相同，合并处理：扩散电流 i = I_S·(−∂u/∂ξ)|₀，存储电荷 Q = I_S·τ·∫u dξ。
// 端电流再加上耗尽层的充放电电流 dQ_j/dt（势垒电容，大信号）。体电阻 R_S 固定、没有电导调制，
// 所以这里没有功率二极管的正向恢复电压过冲（P1 再讲）。
//
// 测试电路（电阻法，小功率二极管手册常用的 I_F / I_R 切换测法）：
//  正向电源 U₁、反向电源 U_R 经单刀双掷开关 S、限流电阻 R、回路电感 L 接二极管。
//  - S 拨到 U₁：正向导通，I_F = (U₁ − U_F)/R。
//  - S 拨到 −U_R：关断。结边还有多余少子时结仍正偏，反向电流约为 (U_R + u)/R，由电阻决定（存储时间 t_s）；
//    结边少子抽空后结开始阻断，反向电流衰减，电压趋于 −U_R。
//  R 固定，U₁、U_R 按设定的 I_F、I_R = U_R/R 反推。开关切换是理想的。
//  L 代表导线等回路电感：真实回路总有电感，电流不会瞬间反向。真实导线的电感在这里的时间常数 L/R 只有几纳秒、看不出来，
//  所以按比例放大到 50 µH（L/R = 0.1 µs，约为 t_rr 的 4%）。R 把它阻尼掉了，没有电压过冲。
import { qB } from './capacitance'
import { J_REF, TAU, diodeV, type Junction } from './pn'

/** 空间步长（扩散长度）、计算区长度（扩散长度，远大于 1 即为长基区）、时间步长（τ） */
const DX = 0.02
const XI_MAX = 6
const DS = 0.002

/**
 * 中性区少子分布（两侧合并）。隐式欧拉 + 三对角追赶；结边用半格守恒，保证 dQ/dt = i − Q/τ 离散意义下成立。
 * 每一步：prepare() 给出扩散电流与结边值的线性关系 i/I_S = a + b·u₀，外电路确定 u₀ 后 commit(u₀)
 */
export class Base {
  /** 内部格点 ξ = DX, 2DX, …（远端 u = 0 不存） */
  u: Float64Array
  /** 结边 u(0) */
  u0: number
  private readonly m = Math.round(XI_MAX / DX) - 1
  private readonly r: number
  private readonly cp: Float64Array
  private readonly den: Float64Array
  /** 结边 u₀ = 1、其余为零时一步后的分布 */
  private readonly rho: Float64Array
  private uh: Float64Array

  constructor(u0: number, readonly ds = DS) {
    const m = this.m
    this.r = ds / (DX * DX)
    this.cp = new Float64Array(m)
    this.den = new Float64Array(m)
    const b = 1 + 2 * this.r + ds
    for (let k = 0; k < m; k++) {
      this.den[k] = b + (k ? this.r * this.cp[k - 1] : 0)
      this.cp[k] = -this.r / this.den[k]
    }
    const e1 = new Float64Array(m)
    e1[0] = this.r
    this.rho = this.solve(e1)
    this.uh = new Float64Array(m)
    // 稳态分布 u = u₀·sinh(ξ_max − ξ)/sinh(ξ_max)
    this.u = new Float64Array(m)
    for (let k = 0; k < m; k++) this.u[k] = (u0 * Math.sinh(XI_MAX - (k + 1) * DX)) / Math.sinh(XI_MAX)
    this.u0 = u0
  }

  /** 稳态下扩散电流与结边值之比 i/(I_S·u₀)（离散格式下略大于 1） */
  static steadyGain() {
    return (1 - Math.sinh(XI_MAX - DX) / Math.sinh(XI_MAX)) / DX + DX / 2
  }

  private solve(d: Float64Array) {
    const m = this.m
    const x = new Float64Array(m)
    let prev = 0
    for (let k = 0; k < m; k++) prev = x[k] = (d[k] + this.r * prev) / this.den[k]
    for (let k = m - 2; k >= 0; k--) x[k] -= this.cp[k] * x[k + 1]
    return x
  }

  /** 这一步的扩散电流 i/I_S = a + b·u₀（u₀ 为步末结边值） */
  prepare() {
    this.uh = this.solve(this.u)
    return {
      a: -this.uh[0] / DX - (DX / 2) * (this.u0 / this.ds),
      b: (1 - this.rho[0]) / DX + (DX / 2) * (1 / this.ds + 1),
    }
  }

  commit(u0: number) {
    for (let k = 0; k < this.m; k++) this.u[k] = this.uh[k] + this.rho[k] * u0
    this.u0 = u0
  }

  /** ∫u dξ（梯形公式） */
  integral() {
    let s = this.u0 / 2
    for (let k = 0; k < this.m; k++) s += this.u[k]
    return s * DX
  }
}

/** 限流电阻 R（Ω） */
export const R_LIM = 500
/** 回路电感 L（H），见文件开头的说明 */
export const L_LOOP = 50e-6

export interface SwitchParams {
  /** 正向电流 A */
  IF: number
  /** 反向电流 I_R = U_R/R（A），关断时电阻限定的反向电流 */
  IR: number
}

export type SwitchKind = 'on' | 'off'

/** 两个电源的电压（V）：U₁ = U_F + I_F·R，U_R = I_R·R */
export function sources(p: SwitchParams, j = J_REF) {
  return { U1: diodeV(p.IF, j) + p.IF * R_LIM, UR: p.IR * R_LIM }
}

/** 反向恢复参数（时间 s、电流 A、电荷 C），定义见 metrics */
export interface RecoveryMetrics {
  /** 电流过零的时刻 t₀（开关切换后） */
  t0: number
  /** 存储时间：t₀ 到结电压过零（结开始阻断） */
  ts: number
  /** 下降时间：结开始阻断到反向电流降到 0.25 I_R */
  tf: number
  /** 反向恢复时间 t_rr = t_s + t_f（从 t₀ 算起） */
  trr: number
  /** 结开始阻断、恢复结束的时刻（开关切换后），即 t₀ + t_s、t₀ + t_rr */
  tBlock: number
  tEnd: number
  /** 反向电流的最大值（A） */
  IRmax: number
  /** t₀–t₀ + t_rr 之间反向电流的面积 */
  Qrr: number
  /** 二极管端电压过零（开始反向）的时刻 */
  tv0: number
}

/** 测 t_rr 时反向电流降到 I_R 的几分之几为止（与 UF4007、STTH8R06 等手册的 I_rr = 0.25 I_R 相同） */
export const IRR_FRAC = 0.25

export interface Waveform {
  kind: SwitchKind
  p: SwitchParams
  /** 采样间隔 s；下标 0 为开关切换（t = 0）前的稳态 */
  dt: number
  /** 二极管电流（A，阳极流入为正，也是回路电流）、端电压（V）、结压降（V）、存储电荷（C） */
  i: Float64Array
  v: Float64Array
  vj: Float64Array
  q: Float64Array
  /** 稳态正向导通时的存储电荷 Q_F = τI_F */
  QF: number
  /** 关断时的反向恢复参数；开通时为 null */
  m: RecoveryMetrics | null
  /** 开通时存储电荷达到 0.9 Q_F 的时刻（s）；关断时为 null */
  t90: number | null
}

/**
 * 一次开通或关断：从稳态开始，算到切换后 1.6τ（关断）或 2.5τ（开通）。
 * 开通时存储电荷按 dQ/dt = I_F − Q/τ 增长，到 0.9Q_F 约需 2.3τ；结电压由结边浓度决定，涨得比 Q 快
 */
export function simulate(kind: SwitchKind, p: SwitchParams, j: Junction = J_REF, L = L_LOOP): Waveform {
  const { VT, Is, RS } = j
  const dt = DS * TAU
  const { U1, UR } = sources(p, j)
  const n = Math.ceil(((kind === 'off' ? 1.6 : 2.5) * TAU) / dt)

  let base: Base
  let vj: number
  if (kind === 'off') {
    const u0 = p.IF / Is / Base.steadyGain()
    base = new Base(u0)
    vj = VT * Math.log1p(u0)
  } else {
    base = new Base(Math.expm1(-UR / VT))
    vj = -UR
  }
  let iD = kind === 'off' ? p.IF : Is * base.u0 * Base.steadyGain()
  let vD = vj + RS * iD
  /** 切换后的电源电压 */
  const Us = kind === 'off' ? -UR : U1

  const out = {
    i: new Float64Array(n + 1),
    v: new Float64Array(n + 1),
    vj: new Float64Array(n + 1),
    q: new Float64Array(n + 1),
  }
  const record = (k: number) => {
    out.i[k] = iD
    out.v[k] = vD
    out.vj[k] = vj
    out.q[k] = Is * TAU * base.integral()
  }
  record(0)

  for (let k = 1; k <= n; k++) {
    const { a, b } = base.prepare()
    const qOld = qB(vj, j)
    // 回路方程 L·di/dt = U_s − u_D − R·i（隐式欧拉）；h(U_j) = i_D − i_回路，随 U_j 单调增加，二分求解
    const iOld = iD
    const solveAt = (V: number) => {
      const id = Is * (a + b * Math.expm1(V / VT)) + (qB(V, j) - qOld) / dt
      const v = V + RS * id
      const il = L > 0 ? (iOld + (dt / L) * (Us - v)) / (1 + (dt * R_LIM) / L) : (Us - v) / R_LIM
      return { h: id - il, id, v }
    }
    let lo = -60
    let hi = 1.2
    for (let it = 0; it < 56; it++) {
      const mid = (lo + hi) / 2
      if (solveAt(mid).h > 0) hi = mid
      else lo = mid
    }
    vj = (lo + hi) / 2
    const s = solveAt(vj)
    iD = s.id
    vD = s.v
    base.commit(Math.expm1(vj / VT))
    record(k)
  }

  const w: Waveform = { kind, p, dt, ...out, QF: TAU * p.IF, m: null, t90: null }
  if (kind === 'off') w.m = metrics(w)
  else {
    const k = out.q.findIndex((q) => q >= 0.9 * w.QF)
    w.t90 = k < 0 ? null : k * dt
  }
  return w
}

/**
 * 反向恢复参数（电阻法，时间从电流过零 t₀ 算起，与数据手册的量法相同）：
 *  - t₀：开关切换后电流过零（回路电感使它略晚于切换）；
 *  - 存储时间 t_s：t₀ 到结电压过零，此前结边仍有多余少子、结仍正偏，反向电流由电阻限定；
 *  - t_rr：t₀ 到反向电流衰减到 0.25 I_R（I_R = U_R/R），t_f = t_rr − t_s；
 *  - Q_rr：t₀–t₀ + t_rr 之间反向电流的面积。
 */
function metrics(w: Waveform): RecoveryMetrics {
  const { i, v, vj, dt } = w
  const n = i.length
  /** 数组 a 第一次从正变为非正的时刻（线性插值） */
  const cross = (a: Float64Array) => {
    for (let k = 1; k < n; k++) if (a[k] <= 0 && a[k - 1] > 0) return (k - 1 + a[k - 1] / (a[k - 1] - a[k])) * dt
    return (n - 1) * dt
  }
  const t0 = cross(i)
  const tBlock = cross(vj)
  const lim = IRR_FRAC * w.p.IR
  let tEnd = (n - 1) * dt
  for (let k = Math.ceil(tBlock / dt); k < n; k++) {
    if (-i[k] <= lim) {
      tEnd = (k - 1 + (-i[k - 1] - lim) / (i[k] - i[k - 1])) * dt
      break
    }
  }
  let Qrr = 0
  let IRmax = 0
  const k2 = Math.min(n - 1, Math.floor(tEnd / dt))
  for (let k = 1; k <= k2; k++) Qrr -= Math.min(0, i[k]) * dt
  for (let k = 0; k < n; k++) IRmax = Math.max(IRmax, -i[k])
  return { t0, ts: tBlock - t0, tf: tEnd - tBlock, trr: tEnd - t0, tBlock, tEnd, IRmax, Qrr, tv0: cross(v) }
}

/** 切换后 t 秒（t < 0 为切换前的稳态）的瞬时值，线性插值 */
export function sampleAt(w: Waveform, t: number) {
  const n = w.i.length - 1
  const x = Math.max(0, Math.min(n, t / w.dt))
  const k = Math.min(n - 1, Math.floor(x))
  const f = x - k
  const at = (a: Float64Array) => a[k] + (a[k + 1] - a[k]) * f
  return { i: at(w.i), v: at(w.v), vj: at(w.vj), q: at(w.q) }
}

/** 波形总时长 s */
export function duration(w: Waveform) {
  return (w.i.length - 1) * w.dt
}
