// 0.6 反向击穿：三款 1 W 稳压二极管的击穿特性、结的几何估算、雪崩倍增与热模型。
// 器件数据：Diodes Inc. DS18007 Rev.20-4（1N4728A–1N4764A），T_A = 25 °C。
//
// 反向击穿段 = 结电流 I_j(U_j) 串联电阻 R_s（雪崩型的 R_s 主要是空间电荷电阻）：
//  - 1N4728A、1N4733A 用隧穿电流式（Sze），1N4757A 用雪崩倍增式 M = 1/(1 − (V/U_B)^m)；
//  - 三个条件定出三个参数：经过 (U_Z, I_ZT)；I_ZT 处动态电阻 = Z_ZT（手册上限）；测试电压下漏电流 = I_R（手册上限）。
//    整条曲线于是落在手册限值之内，Z_ZK 只作校核（不超过上限）。实际器件一般漏电更小、拐点更陡。
//  - 温度：结电压按手册温度系数（取范围中值）同比例伸缩；漏电流不随温度变（页面上有说明）。
import { EPS_SI, K_B, Q, T_REF, kelvin, niSi } from './pn'

export type ZenerId = '1N4728A' | '1N4733A' | '1N4757A'
export type Mechanism = 'tunnel' | 'mixed' | 'avalanche'

export interface ZenerSpec {
  id: ZenerId
  /** 稳压值 U_Z（V），在测试电流 I_ZT（A）下测得 */
  VZ: number
  IZT: number
  /** I_ZT、I_ZK 处的动态电阻上限（Ω） */
  ZZT: number
  IZK: number
  ZZK: number
  /** 反向漏电流上限 I_R（A）及其测试电压（V） */
  IR: number
  VRtest: number
  /** 温度系数范围（%/°C） */
  tc: [number, number]
  mech: Mechanism
  /** 掺杂估算（cm⁻³，突变结）：N_A 在 P 侧。手册不给掺杂，这是按击穿电压反推的量级 */
  NA: number
  ND: number
}

export const ZENERS: Record<ZenerId, ZenerSpec> = {
  '1N4728A': { id: '1N4728A', VZ: 3.3, IZT: 76e-3, ZZT: 10, IZK: 1e-3, ZZK: 400, IR: 100e-6, VRtest: 1, tc: [-0.08, -0.05], mech: 'tunnel', NA: 5e18, ND: 5e18 },
  '1N4733A': { id: '1N4733A', VZ: 5.1, IZT: 49e-3, ZZT: 7, IZK: 1e-3, ZZK: 550, IR: 10e-6, VRtest: 1, tc: [-0.01, 0.04], mech: 'mixed', NA: 2e18, ND: 2e18 },
  // 单边突变结：N_B 由 Sze 经验式 U_BR ≈ 60(N_B/10¹⁶)^(−3/4) 反推
  '1N4757A': { id: '1N4757A', VZ: 51, IZT: 5e-3, ZZT: 95, IZK: 0.25e-3, ZZK: 1500, IR: 5e-6, VRtest: 38.8, tc: [0.06, 0.095], mech: 'avalanche', NA: 1e19, ND: 1.25e16 },
}
export const ZENER_IDS = Object.keys(ZENERS) as ZenerId[]

/** 1 W 系列的热参数（同一手册）：R_θJA = 175 °C/W，T_j 上限 175 °C */
const RTH_JA = 175
export const TJ_MAX = 175

const VT0 = K_B * kelvin(T_REF)

/** 温度系数中值（%/°C） */
export const tcMid = (d: ZenerSpec) => (d.tc[0] + d.tc[1]) / 2
/** 温度系数中值折成 mV/°C */
export const tcMv = (d: ZenerSpec) => tcMid(d) * d.VZ * 10

// ───────────── 结的几何（突变结、耗尽层近似） ─────────────

/** 内建电势（V）：U_T ln(N_A N_D / n_i²)，不计重掺杂的简并与禁带变窄 */
export function vbi(d: ZenerSpec) {
  const ni = niSi(kelvin(T_REF))
  return VT0 * Math.log((d.NA * d.ND) / (ni * ni))
}

export interface Depletion {
  /** 耗尽层总宽、P 侧与 N 侧的宽度（cm） */
  W: number
  xp: number
  xn: number
  /** 最大电场（V/cm），在冶金结处 */
  Emax: number
  /** 结上的总电势差 U_bi + U_j（V） */
  Vtot: number
}

/** 结电压为反偏 Vj（V，正值）时的耗尽层 */
export function depletion(d: ZenerSpec, Vj: number): Depletion {
  const Vtot = vbi(d) + Math.max(0, Vj)
  const W = Math.sqrt((2 * EPS_SI * Vtot * (d.NA + d.ND)) / (Q * d.NA * d.ND))
  return { W, xp: (W * d.ND) / (d.NA + d.ND), xn: (W * d.NA) / (d.NA + d.ND), Emax: (2 * Vtot) / W, Vtot }
}

/** 电势（V，以 P 侧中性区为零，向 N 侧升高）；x（cm）以冶金结为原点，P 侧为负 */
export function potentialAt(d: ZenerSpec, g: Depletion, x: number) {
  if (x <= -g.xp) return 0
  if (x >= g.xn) return g.Vtot
  if (x <= 0) return ((Q * d.NA) / (2 * EPS_SI)) * (x + g.xp) ** 2
  return g.Vtot - ((Q * d.ND) / (2 * EPS_SI)) * (g.xn - x) ** 2
}

/**
 * 隧穿的水平距离（cm）：能量 E（eV，以 P 侧导带底为零，向下为负）处，
 * 从 P 侧价带边 E_v(x_a) = E 横穿禁带到 N 侧导带边 E_c(x_b) = E 的距离。能带 E_c(x) = −φ(x)，E_v = E_c − E_g
 */
export function tunnelDistance(d: ZenerSpec, g: Depletion, E: number, Eg: number) {
  const solve = (f: (x: number) => number) => {
    let lo = -g.xp
    let hi = g.xn
    for (let k = 0; k < 50; k++) {
      const m = (lo + hi) / 2
      if (f(m) > 0) lo = m
      else hi = m
    }
    return (lo + hi) / 2
  }
  const xa = solve((x) => -potentialAt(d, g, x) - Eg - E)
  const xb = solve((x) => -potentialAt(d, g, x) - E)
  return xb - xa
}

// ───────────── 反向击穿段的拟合 ─────────────

interface TunnelFit {
  kind: 'tunnel'
  A: number
  b: number
  Vbi: number
  Rs: number
}

interface AvalancheFit {
  kind: 'avalanche'
  I0: number
  VB: number
  m: number
  Rs: number
}

export type BreakdownFit = TunnelFit | AvalancheFit

/** 雪崩倍增式的指数（经验值 3–6，取 3） */
const M_EXP = 3

/** 25 °C 的结电流 I_j(U_j)（A），U_j 为反偏结电压（正值） */
function junctionI(f: BreakdownFit, Vj: number) {
  if (Vj <= 0) return 0
  if (f.kind === 'tunnel') {
    // Sze：J ∝ 𝓔·V·exp(−b'/𝓔)，结区电场 𝓔 ∝ √(V + U_bi)
    const s = Math.sqrt(Vj + f.Vbi)
    return f.A * Vj * s * Math.exp(-f.b / s)
  }
  if (Vj >= f.VB) return Infinity
  return (f.I0 * (1 - Math.exp(-Vj / VT0))) / (1 - (Vj / f.VB) ** f.m)
}

/** I_j 的反函数（二分） */
function junctionV(f: BreakdownFit, I: number) {
  let lo = 0
  let hi = f.kind === 'avalanche' ? f.VB : 200
  for (let k = 0; k < 60; k++) {
    const m = (lo + hi) / 2
    if (junctionI(f, m) < I) lo = m
    else hi = m
  }
  return (lo + hi) / 2
}

/** 在 (lo, hi) 内二分求 g 的零点（g 单调，两端异号） */
function bisect(g: (x: number) => number, lo: number, hi: number, n = 80) {
  const sLo = Math.sign(g(lo))
  for (let k = 0; k < n; k++) {
    const m = (lo + hi) / 2
    if (Math.sign(g(m)) === sLo) lo = m
    else hi = m
  }
  return (lo + hi) / 2
}

/** 给定 R_s 时，用 (U_Z, I_ZT) 与 Z_ZT 定出隧穿式的 A、b */
function tunnelWith(d: ZenerSpec, Rs: number): TunnelFit {
  const Vbi = vbi(d)
  const Vj = d.VZ - d.IZT * Rs
  const s = Math.sqrt(Vj + Vbi)
  // d ln I / dV = 1/V + 1/(2(V + U_bi)) + b/(2s³) = 1/(I_ZT r_j)
  const b = 2 * s ** 3 * (1 / (d.IZT * (d.ZZT - Rs)) - 1 / Vj - 1 / (2 * (Vj + Vbi)))
  return { kind: 'tunnel', A: d.IZT / (Vj * s * Math.exp(-b / s)), b, Vbi, Rs }
}

/** 给定 R_s 时，用 (U_Z, I_ZT) 与 Z_ZT 定出雪崩式的 U_B、I₀ */
function avalancheWith(d: ZenerSpec, Rs: number): AvalancheFit {
  const Vj = d.VZ - d.IZT * Rs
  const target = 1 / (d.IZT * (d.ZZT - Rs))
  const m = M_EXP
  // d ln M / dV = m x^(m−1) / (U_B (1 − x^m))，x = V/U_B；随 U_B 增大单调减小
  const dlnM = (VB: number) => {
    const x = Vj / VB
    return (m * x ** (m - 1)) / (VB * (1 - x ** m))
  }
  const VB = bisect((VB) => dlnM(VB) - target, Vj * (1 + 1e-9), Vj * 3)
  const M = 1 / (1 - (Vj / VB) ** m)
  return { kind: 'avalanche', I0: d.IZT / M, VB, m, Rs }
}

/**
 * 第三个条件：测试电压下的漏电流 = I_R 上限，二分求 R_s（R_s 越大拐点越陡、漏电越小）。
 * 1N4733A 的 I_R 上限很宽松：R_s = 0、拐点最软时模型漏电也远小于上限，这时就取 R_s = 0
 */
function fit(d: ZenerSpec): BreakdownFit {
  const make = (Rs: number) => (d.mech === 'avalanche' ? avalancheWith(d, Rs) : tunnelWith(d, Rs))
  // 测试电压下电流很小，R_s 上的压降可以忽略
  const err = (Rs: number) => Math.log(junctionI(make(Rs), d.VRtest) / d.IR)
  const lo = 1e-6 * d.ZZT
  if (err(lo) < 0) return make(0)
  return make(bisect(err, lo, (1 - 1e-6) * d.ZZT))
}

export const FITS: Record<ZenerId, BreakdownFit> = Object.fromEntries(ZENER_IDS.map((id) => [id, fit(ZENERS[id])])) as Record<ZenerId, BreakdownFit>

/** 结温 T 时结电压相对 25 °C 的伸缩倍数：使 I_ZT 处的 U_Z（含 R_s 压降）按手册温度系数中值变化 */
function scale(d: ZenerSpec, T: number) {
  const VjT = d.VZ - d.IZT * FITS[d.id].Rs
  return 1 + (tcMv(d) / 1000 / VjT) * (T - T_REF)
}

// ───────────── 对外的 V-A 关系（反偏量都用正值） ─────────────

/** 结温 T（°C）下，反向电流为 I（A）时的反向电压（V） */
export function reverseV(d: ZenerSpec, I: number, T: number) {
  const f = FITS[d.id]
  return scale(d, T) * junctionV(f, I) + f.Rs * I
}

/** 反向电压 Vr（V）下的反向电流（A） */
export function reverseI(d: ZenerSpec, Vr: number, T: number) {
  return opPoint(d, Vr, 0, T).I
}

/** 结温 T 下的动态电阻 dV/dI（Ω） */
export function dynamicR(d: ZenerSpec, I: number, T: number) {
  const h = I * 1e-4
  return (reverseV(d, I + h, T) - reverseV(d, I - h, T)) / (2 * h)
}

/**
 * 电源 VS 串联电阻 R 反向接在稳压管上的工作点：VS = V + IR。返回反向电压 V、电流 I 和结电压 Vj（V，R_s 之前）。
 * R = 0 即直接加电压 VS
 */
export function opPoint(d: ZenerSpec, VS: number, R: number, T: number) {
  const f = FITS[d.id]
  const k = scale(d, T)
  if (VS <= 0) return { V: 0, I: 0, Vj: 0 }
  const top = Math.min(VS / k, f.kind === 'avalanche' ? f.VB : Infinity)
  // 以 25 °C 的结电压 u 为未知数：k·u + I_j(u)(R_s + R) = VS，左边单调增
  const u = bisect((u) => Math.min(1e6, k * u + junctionI(f, u) * (f.Rs + R)) - VS, 0, top)
  const I = junctionI(f, u)
  return { V: VS - I * R, I, Vj: k * u }
}

/** 雪崩倍增因子 M（只对雪崩型有意义）：结电压 Vj、结温 T */
export function multiplication(d: ZenerSpec, Vj: number, T: number) {
  const f = FITS[d.id]
  if (f.kind !== 'avalanche') return 1
  const x = Vj / scale(d, T) / f.VB
  return x >= 1 ? Infinity : 1 / (1 - x ** f.m)
}

/** 正向段（只作示意）：I = I_S(e^{V/2U_T} − 1)，取 1.0 V 时 200 mA（手册上限 U_F ≤ 1.2 V @ 200 mA） */
const ISF = 0.2 / Math.expm1(1 / (2 * VT0))
export const forwardI = (V: number) => ISF * Math.expm1(V / (2 * VT0))

// ───────────── 碰撞电离（舞台的雪崩蒙特卡罗用，见 avalancheMC） ─────────────

/** 硅的碰撞电离系数 α = a·exp(−b/𝓔)（cm⁻¹，van Overstraeten–de Man 高场段） */
const IONIZE = { e: { a: 7.03e5, b: 1.231e6 }, h: { a: 1.582e6, b: 2.036e6 } }

/** 空穴与电子电离系数之比 k = β/α（在最大电场处取值，示意中当作常数） */
export function holeRatio(Emax: number) {
  const { e, h } = IONIZE
  return (h.a * Math.exp(-h.b / Emax)) / (e.a * Math.exp(-e.b / Emax))
}

// ───────────── 热模型（单阶 RC） ─────────────

export type Cooling = 'good' | 'poor'

/**
 * 热击穿演示的电路与散热：
 *  - 电源 VS 反向接 1N4728A；限流时串联 R_lim（25 °C 时工作在 I_ZT），不限流时只剩电源内阻与导线 R_src；
 *  - 散热好：R_θJA = 175 °C/W（手册值）；散热差：350 °C/W（示意，例如引线很短又装在密闭盒里）；
 *  - 热容按"散热好时舞台上的热时间常数 3 s"取，只是示意的时间尺度。
 */
export const THERMAL = {
  device: '1N4728A' as ZenerId,
  Ta: 25,
  VS: 4.0,
  Rsrc: 1,
  Rth: { good: RTH_JA, poor: 350 } as Record<Cooling, number>,
  tau: 3,
}
const TD = ZENERS[THERMAL.device]
const R_LIM = (THERMAL.VS - TD.VZ) / TD.IZT

export function thermalCircuit(limit: boolean, Tj: number) {
  const R = limit ? R_LIM : THERMAL.Rsrc
  const op = opPoint(TD, THERMAL.VS, R, Tj)
  return { ...op, R, P: op.V * op.I }
}

/** 结温推进 dt（舞台秒）：C_th dT_j/dt = P − (T_j − T_a)/R_θ */
export function thermalStep(Tj: number, dt: number, limit: boolean, cooling: Cooling) {
  const Rth = THERMAL.Rth[cooling]
  const Cth = THERMAL.tau / THERMAL.Rth.good
  const n = Math.max(1, Math.ceil(dt / 0.02))
  for (let i = 0; i < n; i++) {
    const { P } = thermalCircuit(limit, Tj)
    Tj += ((P - (Tj - THERMAL.Ta) / Rth) / Cth) * (dt / n)
  }
  return Tj
}

/** 稳态结温：T_j = T_a + R_θ·P(T_j) 的解；无解（热失控）时返回 null */
export function thermalSteady(limit: boolean, cooling: Cooling) {
  const Rth = THERMAL.Rth[cooling]
  const g = (Tj: number) => THERMAL.Ta + Rth * thermalCircuit(limit, Tj).P - Tj
  // 从环境温度往上找第一个 g 变号处
  let a = THERMAL.Ta
  for (let Tj = THERMAL.Ta + 1; Tj <= 400; Tj += 1) {
    if (g(Tj) <= 0) return bisect(g, a, Tj, 40)
    a = Tj
  }
  return null
}
