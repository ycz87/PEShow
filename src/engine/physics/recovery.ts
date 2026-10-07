// 二极管的开关动态（0.8）：少子扩散方程与外电路联立数值求解，得到开通、关断（反向恢复）的 i(t)、u(t)。
//
// 器件：示例 PN 结（pn.ts），长基区、小注入，两侧少子寿命相同（τ = 5 µs）。中性区的多余少子满足
//   ∂u/∂t = ∂²u/∂ξ² − u（ξ 以扩散长度为单位，t 以 τ 为单位，u = 多余少子浓度 / 平衡少子浓度），
//   结边 u(0) = e^{U_j/U_T} − 1，远端 u = 0（长基区）。
// 两侧的归一化方程相同，合并处理：扩散电流 i = I_S·(−∂u/∂ξ)|₀，存储电荷 Q = I_S·τ·∫u dξ。
// 端电流再加上耗尽层的充放电电流 dQ_j/dt（势垒电容，大信号）。体电阻 R_S 固定、没有电导调制，
// 所以这里没有功率二极管的正向恢复电压过冲（P1 再讲）。
//
// 测试电路（典型的感性换流电路）：
//  - 负载电流 I_F 恒定（大电感负载）；二极管续流时导通 I_F。
//  - 关断：开关支路（反向电压 U_R 串换流电感 L）接通，电流从二极管换到开关支路。
//    L = (U_R + U_F)/(di_F/dt)，于是二极管电流按 di_F/dt 下降；恢复阻断时 L 上感应出电压过冲 U_RM。
//  - 开通：开关支路电流按 di_F/dt 降到零，负载电流转到二极管。
//  - 二极管两端并 RC 缓冲：C_s = 2 nF，R_s = 2ζ√(L/C_s)，ζ = 0.7，抑制 L 与结电容的振荡。
import { qB } from './capacitance'
import { J_REF, TAU, diodeV, type Junction } from './pn'

/** RC 缓冲：电容 C_s（F）与阻尼比 ζ（R_s 按换流电感匹配） */
export const SNUBBER = { Cs: 2e-9, zeta: 0.7 }

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

export interface SwitchParams {
  /** 正向电流 A */
  IF: number
  /** 换流时的电流变化率 A/s */
  didt: number
  /** 反向电压 V */
  VR: number
}

export type SwitchKind = 'on' | 'off'

/** 反向恢复参数（时间 s、电流 A、电压 V、电荷 C），定义见 metrics */
export interface RecoveryMetrics {
  t0: number
  t1: number
  t2: number
  td: number
  tf: number
  trr: number
  IRP: number
  URP: number
  Qrr: number
  /** 二极管电压过零（开始反向）的时刻 */
  tv0: number
  /** t₂ 的外推直线（IEC 60747-2）经过的两个点：反向电流降到 0.9 I_RM 与 0.25 I_RM 处 */
  fit: [[number, number], [number, number]]
}

export interface Waveform {
  kind: SwitchKind
  p: SwitchParams
  /** 采样间隔 s；下标 0 为换流开始（t = 0）前的稳态 */
  dt: number
  /** 二极管电流（A，阳极流入为正）、端电压（V）、结压降（V）、存储电荷（C）；
   *  开关支路（S、L、U_R）的电流 iS（A，从上母线流向下母线为正）。缓冲支路电流 = I_F − i − iS */
  i: Float64Array
  iS: Float64Array
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

/** 换流电感 L = (U_R + U_F)/(di_F/dt)（H） */
export function commutationL(p: SwitchParams, j = J_REF) {
  return (p.VR + diodeV(p.IF, j)) / p.didt
}

/**
 * 一次开通或关断：从稳态开始，算到换流结束后 1.6τ（关断）或 2.5τ（开通）。
 * 开通时存储电荷按 dQ/dt = I_F − Q/τ 增长，到 0.9Q_F 约需 2.3τ；结电压由结边浓度决定，涨得比 Q 快
 */
export function simulate(kind: SwitchKind, p: SwitchParams, j: Junction = J_REF): Waveform {
  const { VT, Is, RS } = j
  const dt = DS * TAU
  const L = commutationL(p, j)
  const { Cs } = SNUBBER
  const Rs = 2 * SNUBBER.zeta * Math.sqrt(L / Cs)
  const n = Math.ceil((p.IF / p.didt + (kind === 'off' ? 1.6 : 2.5) * TAU) / dt)

  let base: Base
  let vj: number
  let iL: number
  if (kind === 'off') {
    const u0 = p.IF / Is / Base.steadyGain()
    base = new Base(u0)
    vj = VT * Math.log1p(u0)
    iL = 0
  } else {
    base = new Base(Math.expm1(-p.VR / VT))
    vj = -p.VR
    iL = p.IF
  }
  let iD = kind === 'off' ? p.IF : Is * base.u0 * Base.steadyGain()
  let vD = vj + RS * iD
  let vCs = vD

  const out = {
    i: new Float64Array(n + 1),
    iS: new Float64Array(n + 1),
    v: new Float64Array(n + 1),
    vj: new Float64Array(n + 1),
    q: new Float64Array(n + 1),
  }
  const record = (k: number) => {
    out.i[k] = iD
    out.iS[k] = iL
    out.v[k] = vD
    out.vj[k] = vj
    out.q[k] = Is * TAU * base.integral()
  }
  record(0)

  for (let k = 1; k <= n; k++) {
    const { a, b } = base.prepare()
    const qOld = qB(vj, j)
    const iLon = Math.max(0, p.IF - p.didt * k * dt)
    // 节点电流平衡 h(U_j) = i_D + i_snub + i_L − I_F，随 U_j 单调增加，二分求解
    const solveAt = (V: number) => {
      const id = Is * (a + b * Math.expm1(V / VT)) + (qB(V, j) - qOld) / dt
      const v = V + RS * id
      const isn = (v - vCs) / (Rs + dt / Cs)
      const il = kind === 'off' ? iL + (dt * (p.VR + v)) / L : iLon
      return { h: id + isn + il - p.IF, id, v, isn, il }
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
    iL = s.il
    vCs += (dt * s.isn) / Cs
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
 * 反向恢复参数（IEC 60747-2 与数据手册的通行符号）：
 *  - t₀：电流过零；t₁：反向电流达到峰值 I_RM；
 *  - t₂：过 0.9 I_RM 与 0.25 I_RM 两点的直线外推到零（IEC 60747-2 的做法，教材图中 t₂ 是电流"接近零"的时刻）；
 *  - t_a = t₁ − t₀，t_b = t₂ − t₁，t_rr = t₂ − t₀；
 *  - U_RM：反向电压峰值；Q_rr：t₀–t₂ 之间反向电流的面积。
 */
function metrics(w: Waveform): RecoveryMetrics {
  const { i, v, dt } = w
  const n = i.length
  const k0 = i.findIndex((x) => x < 0)
  let k1 = k0
  for (let k = k0; k < n; k++) if (i[k] < i[k1]) k1 = k
  const IRP = -i[k1]
  /** k1 之后反向电流第一次降到 f·I_RM 的时刻（线性插值） */
  const fall = (f: number) => {
    for (let k = k1 + 1; k < n; k++) {
      if (-i[k] <= f * IRP) return (k - 1 + (-i[k - 1] - f * IRP) / (i[k] - i[k - 1])) * dt
    }
    return (n - 1) * dt
  }
  const ta = fall(0.9)
  const tb = fall(0.25)
  const t2 = ta + ((tb - ta) * 0.9) / (0.9 - 0.25)
  // 过零时刻按线性插值
  const t0 = (k0 - 1 + i[k0 - 1] / (i[k0 - 1] - i[k0])) * dt
  const t1 = k1 * dt
  let URP = 0
  for (let k = 0; k < n; k++) URP = Math.max(URP, -v[k])
  let Qrr = 0
  const k2 = Math.min(n - 1, Math.floor(t2 / dt))
  for (let k = k0; k <= k2; k++) Qrr -= i[k] * dt
  const kv = v.findIndex((x) => x < 0)
  return {
    t0,
    t1,
    t2,
    td: t1 - t0,
    tf: t2 - t1,
    trr: t2 - t0,
    IRP,
    URP,
    Qrr,
    tv0: kv * dt,
    fit: [[ta, -0.9 * IRP], [tb, -0.25 * IRP]],
  }
}

/** 换流开始后 t 秒（t < 0 为开始前的稳态）的瞬时值，线性插值 */
export function sampleAt(w: Waveform, t: number) {
  const n = w.i.length - 1
  const x = Math.max(0, Math.min(n, t / w.dt))
  const k = Math.min(n - 1, Math.floor(x))
  const f = x - k
  const at = (a: Float64Array) => a[k] + (a[k + 1] - a[k]) * f
  return { i: at(w.i), iS: at(w.iS), v: at(w.v), vj: at(w.vj), q: at(w.q) }
}

/** 波形总时长 s */
export function duration(w: Waveform) {
  return (w.i.length - 1) * w.dt
}
