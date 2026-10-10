// 示例 PiN 二极管（第 1 章）的稳态模型：1200 V 级硅 P⁺N⁻N⁺，非穿通型。参数见讲解稿 A.2。
// 坐标：x 从 P⁺N⁻ 结（x = 0）指向 N⁻N⁺ 界面（x = W），单位 cm。电流密度 J 单位 A/cm²。
//
// 模型与简化（页面「示意说明」同步）：
//  - 反偏：耗尽层近似，单边突变结，电场全部落在 N⁻ 区（P⁺ 太浓，几乎不展宽）。
//  - 击穿：Baliga 平行平面经验式；终端结构另计（1.2）。
//  - 正偏：N⁻ 区大注入、双极扩散的解析解（Hall），两端为理想发射极（可设阳极注入效率 γ），
//    迁移率取低掺杂值、不随载流子浓度变化，不计俄歇复合与载流子–载流子散射。
//    端电压 = 两个结上的压降（由 N⁻ 两端的载流子浓度决定）+ N⁻ 区压降。
//  - 温度：μ_n ∝ T^−2.42、μ_p ∝ T^−2.2，大注入寿命 τ ∝ T^1.8，n_i 同第 0 章。
//  - 漏电流：耗尽层内的产生电流，产生寿命 τ_g 简化为常数。
//  - 端电压（1.3 起）：芯片 + 串联电阻 R_s（校准量，见 RS）。
import { EPS_SI, K_B, Q, kelvin, niSi } from './pn'

export const PIN = {
  /** N⁻ 区掺杂（cm⁻³），约 34 Ω·cm */
  ND: 1.3e14,
  /** N⁻ 区厚度（cm） */
  W: 120e-4,
  /** 芯片面积（cm²）：额定 30 A 时 100 A/cm² */
  A: 0.3,
  /** 额定电流（A） */
  IF: 30,
  /** 额定电压（V） */
  URRM: 1200,
  /** 25 °C 的大注入寿命（s） */
  tau: 0.2e-6,
  /** 寿命的温度指数 τ ∝ T^tauExp（校准量：与 RS 一起把温度交点放在额定电流附近，1.3） */
  tauExp: 1.8,
  /** 产生寿命（s），只用于漏电流 */
  tauG: 100e-6,
  /** 25 °C 的低掺杂迁移率 cm²/(V·s) */
  mun: 1414,
  mup: 470.5,
  /** 饱和漂移速度（cm/s） */
  vsat: 1e7,
}

export const T_REF_PIN = 25

/** 某一结温下的材料参数 */
export interface PinMat {
  tC: number
  /** 热电压 kT/q（V） */
  UT: number
  ni: number
  mun: number
  mup: number
  Dn: number
  Dp: number
  /** 双极扩散系数 */
  Da: number
  /** μ_n/μ_p */
  b: number
  /** 大注入寿命（s） */
  tau: number
}

export function pinMat(tC = T_REF_PIN, tau25 = PIN.tau): PinMat {
  const TK = kelvin(tC)
  const r = TK / kelvin(T_REF_PIN)
  const UT = K_B * TK
  const mun = PIN.mun * r ** -2.42
  const mup = PIN.mup * r ** -2.2
  const Dn = mun * UT
  const Dp = mup * UT
  return { tC, UT, ni: niSi(TK), mun, mup, Dn, Dp, Da: (2 * Dn * Dp) / (Dn + Dp), b: mun / mup, tau: tau25 * r ** PIN.tauExp }
}

export const MAT_REF = pinMat()

// ───────────── 反偏：耐压与电场 ─────────────

/** P⁺ 区掺杂（cm⁻³），只用于内建电势 */
export const NA_PLUS = 1e19

/** P⁺N⁻ 结的内建电势（V），25 °C 约 0.79 V */
export const builtIn = (m = MAT_REF) => m.UT * Math.log((NA_PLUS * PIN.ND) / (m.ni * m.ni))

/** 平行平面单边突变结的击穿电压（V），Baliga 经验式 */
export const bvParallel = (ND: number) => 5.34e13 * ND ** -0.75
/** 击穿时的耗尽层宽度（cm） */
export const wAtBV = (ND: number) => 2.67e10 * ND ** (-7 / 8)

/** 电子迁移率随掺杂（Caughey–Thomas，25 °C），用于 1.1-2 的浓 / 淡对比 */
export const munDoped = (N: number) => 68.5 + (1414 - 68.5) / (1 + (N / 9.2e16) ** 0.711)

/**
 * 单边突变结 P⁺N（N 区掺杂 N）刚好容纳击穿时的耐压与 N 区（1.1-2 的浓 / 淡对比）：
 * 击穿电压、所需 N 区厚度、临界场强、迁移率，以及电流密度 J（A/cm²）下这一层的欧姆压降（无电导调制）
 */
export function oneSidedJunction(N: number, J = 100) {
  const BV = bvParallel(N)
  const W = wAtBV(N)
  const mu = munDoped(N)
  return { N, BV, W, Ec: criticalField(N), mu, drop: (J * W) / (Q * mu * N) }
}

/** 示例 PiN 的平行平面击穿电压（V），约 1390 V */
export const BV_PIN = bvParallel(PIN.ND)

/** 反偏电压 U（V，正值）下 N⁻ 区的耗尽层宽度（cm）；到达 N⁺ 后不再展宽（穿通） */
export function depletionW(U: number, ND = PIN.ND, W = PIN.W) {
  return Math.min(W, Math.sqrt((2 * EPS_SI * Math.max(0, U)) / (Q * ND)))
}

/**
 * 反偏电压 U 下 N⁻ 区的电场分布：返回结处峰值 E1（V/cm）与耗尽层宽度 w（cm）。
 * 未穿通时为三角形；穿通后为梯形（N⁺ 处还剩 E2）
 */
export function reverseField(U: number, ND = PIN.ND, W = PIN.W) {
  const slope = (Q * ND) / EPS_SI
  const wFree = Math.sqrt((2 * EPS_SI * Math.max(0, U)) / (Q * ND))
  if (wFree <= W) return { E1: slope * wFree, E2: 0, w: wFree, slope }
  // 梯形：U = E1·W − slope·W²/2
  const E1 = (U + (slope * W * W) / 2) / W
  return { E1, E2: E1 - slope * W, w: W, slope }
}

/** 电场分布 E(x)（V/cm），x 为距 P⁺N⁻ 结的距离（cm） */
export function fieldAt(x: number, U: number, ND = PIN.ND, W = PIN.W) {
  const f = reverseField(U, ND, W)
  return x < 0 || x > f.w ? 0 : f.E1 - f.slope * x
}

/** 临界场强（V/cm）：Baliga 经验式 E_C = 4010·N^(1/8)，示例 PiN 约 2.3×10⁵ */
export const criticalField = (ND = PIN.ND) => 4010 * ND ** 0.125

/** 耗尽层内的产生电流（A，正值）：q·n_i·w·A/τ_g */
export function genI(U: number, m = MAT_REF) {
  return (Q * m.ni * depletionW(U) * PIN.A) / PIN.tauG
}

/** Miller 倍增因子 M = 1/(1 − (U/U_BR)^6)，只用来画击穿拐点（示意） */
export function multiplication(U: number) {
  const x = Math.min(0.9999, Math.max(0, U) / BV_PIN)
  return 1 / (1 - x ** 6)
}

/** 反向电流（A，正值）：产生电流 × 倍增因子 */
export const reverseI = (U: number, m = MAT_REF) => genI(U, m) * multiplication(U)

// ───────────── 正偏：电导调制 ─────────────

export interface ForwardOpts {
  m?: PinMat
  /** 阳极空穴注入效率，1 为理想发射极 */
  gamma?: number
  /** N⁻ 区厚度（cm）与掺杂，默认示例 PiN（拓展里算穿通型时用） */
  W?: number
  ND?: number
  /** 采样点数 */
  n?: number
}

export interface ForwardState {
  J: number
  /** 端电压（V） */
  U: number
  /** 两个结上的压降之和（V） */
  Uj: number
  /** N⁻ 区压降（V） */
  UM: number
  /** 采样位置（cm，0…W）与载流子浓度 p ≈ n − N_D（cm⁻³） */
  x: Float64Array
  p: Float64Array
  /** 各采样点的电场（V/cm，正值指向阴极） */
  E: Float64Array
  /** 存储电荷（C/cm²） */
  Q: number
  /** 双极扩散长度（cm） */
  La: number
}

/**
 * 电流密度 J（A/cm²，> 0）下的稳态：N⁻ 区内 p'' = p/L_a²，
 * 阳极端空穴电流 γJ、阴极端空穴电流为 0（理想 N⁺ 发射极）
 */
export function forward(J: number, o: ForwardOpts = {}): ForwardState {
  const m = o.m ?? MAT_REF
  const gamma = o.gamma ?? 1
  const W = o.W ?? PIN.W
  const ND = o.ND ?? PIN.ND
  const n = o.n ?? 241
  const { b, Da, Dn, Dp, mun, mup, UT, ni, tau } = m
  const La = Math.sqrt(Da * tau)
  const d = W / 2
  const g1 = ((1 / (b + 1) - gamma) * J) / (Q * Da)
  const g2 = ((1 / (b + 1)) * J) / (Q * Da)
  const A = ((g2 - g1) * La) / (2 * Math.sinh(d / La))
  const B = ((g2 + g1) * La) / (2 * Math.cosh(d / La))
  const x = new Float64Array(n)
  const p = new Float64Array(n)
  const E = new Float64Array(n)
  for (let k = 0; k < n; k++) {
    const xx = -d + (W * k) / (n - 1)
    const s = Math.sinh(xx / La)
    const c = Math.cosh(xx / La)
    x[k] = xx + d
    p[k] = Math.max(0, A * c + B * s)
    const dp = (A * s + B * c) / La
    E[k] = (J - Q * (Dn - Dp) * dp) / (Q * (mun * (ND + p[k]) + mup * p[k]))
  }
  let UM = 0
  let Qs = 0
  const h = W / (n - 1)
  for (let k = 1; k < n; k++) {
    UM += ((E[k] + E[k - 1]) / 2) * h
    Qs += ((p[k] + p[k - 1]) / 2) * h
  }
  const Uj = UT * Math.log((Math.max(p[0], 1) * (p[n - 1] + ND)) / (ni * ni))
  return { J, U: Uj + UM, Uj, UM, x, p, E, Q: Q * Qs, La }
}

/** 关掉电导调制（只算欧姆电阻）时 N⁻ 区的压降（V） */
export const ohmicDrop = (J: number, m = MAT_REF, W = PIN.W, ND = PIN.ND) => (J * W) / (Q * m.mun * ND)

/** 关掉电导调制时端电压的结压降部分（V，约 0.7 V）与 N⁻ 区的电阻（Ω） */
export const UJ_OHMIC = 0.7
export const R_OHMIC = ohmicDrop(1 / PIN.A)
/** 关掉电导调制：端电流 I（A）→ 端电压（V）= 结压降 + N⁻ 区欧姆压降 */
export const ohmicU = (I: number) => UJ_OHMIC + I * R_OHMIC

/**
 * 没有空穴注入时（只靠 N⁻ 自己的电子导电，单极型）电流的上限（A）：电子的速度不会超过饱和速度，
 * J ≤ q·N_D·v_sat。示例 PiN 约 62 A，低场迁移率的直线（ohmicDrop）只在这之前有意义
 */
export const I_SAT_OHMIC = Q * PIN.ND * PIN.vsat * PIN.A

/** 端电流 I（A）→ 端电压（V），可另加串联电阻 R（Ω，封装与接触） */
export function forwardU(I: number, o: ForwardOpts & { R?: number } = {}) {
  if (I <= 0) return 0
  return forward(I / PIN.A, { ...o, n: 121 }).U + I * (o.R ?? 0)
}

/** 端电压 U（V）→ 端电流（A）：在 log I 上二分 */
export function forwardI(U: number, o: ForwardOpts & { R?: number } = {}) {
  if (U <= 0) return 0
  let lo = -20
  let hi = Math.log10(1e4)
  if (forwardU(10 ** lo, o) > U) return 0
  for (let k = 0; k < 50; k++) {
    const mid = (lo + hi) / 2
    if (forwardU(10 ** mid, o) < U) lo = mid
    else hi = mid
  }
  return 10 ** ((lo + hi) / 2)
}

// ───────────── 端电压、直线近似与温度（1.3） ─────────────

/**
 * 串联电阻 R_s（Ω，25 °C）与温度系数（1/°C）。校准量，不是测量值：代表芯片模型没算进去、
 * 使大电流压降上升的部分（俄歇复合、载流子散射、端区复合）和衬底、焊层、键合线、引脚的电阻，
 * 使斜率电阻落进真实 30 A 级器件的范围（约 8–17 mΩ）
 */
export const RS = { R25: 0.008, tc: 0.003 }
export const seriesR = (tC = T_REF_PIN) => RS.R25 * (1 + RS.tc * (tC - T_REF_PIN))

const matCache = new Map<number, PinMat>()
/** 某一结温的材料参数（按温度缓存，滑块拖动时不必重算） */
export function matAt(tC: number) {
  let m = matCache.get(tC)
  if (!m) {
    m = pinMat(tC)
    matCache.set(tC, m)
  }
  return m
}

/** 端电压（V）：芯片（两个结 + N⁻ 区）+ 串联电阻 */
export const terminalU = (I: number, tC = T_REF_PIN) => (I <= 0 ? 0 : forwardU(I, { m: matAt(tC), R: seriesR(tC) }))

/** 正向特性的直线近似 u = U_TO + r_T·i：过 I1、I2 两点的直线 */
export function lineFit(I1: number, I2: number, tC = T_REF_PIN) {
  const u1 = terminalU(I1, tC)
  const r = (terminalU(I2, tC) - u1) / (I2 - I1)
  return { UTO: u1 - r * I1, rT: r }
}

/** 温度 tC 与 25 °C 两条正向曲线的交点电流（A）；温差太小或范围内没有交点时为 null */
export function crossover(tC: number, lo = 1, hi = 300) {
  if (Math.abs(tC - T_REF_PIN) < 5) return null
  const d = (I: number) => terminalU(I, tC) - terminalU(I, T_REF_PIN)
  if (Math.sign(d(lo)) === Math.sign(d(hi))) return null
  let a = Math.log(lo)
  let b = Math.log(hi)
  const sa = Math.sign(d(lo))
  for (let k = 0; k < 40; k++) {
    const mid = (a + b) / 2
    if (Math.sign(d(Math.exp(mid))) === sa) a = mid
    else b = mid
  }
  return Math.exp((a + b) / 2)
}

/**
 * 1.1 小结的成绩单：浓而短 / 淡而长的普通 PN 结与 PiN，在电流 I（A，默认额定 30 A）下的耐压、端电压与发热。
 * 普通 PN 结没有空穴注入，端电压 = 结压降（粗估 0.7 V）+ N 区欧姆压降；PiN 取模型的端电压。
 * 浓而短、淡而长的 N 区厚度取刚好容纳击穿时的耗尽层（oneSidedJunction）
 */
export function scoreboard(I = PIN.IF) {
  const J = I / PIN.A
  const dense = oneSidedJunction(1e15, J)
  const row = (key: 'dense' | 'light' | 'pin', bv: number, u: number) => ({ key, bv, u, p: u * I })
  return [
    row('dense', dense.BV, UJ_OHMIC + dense.drop),
    row('light', BV_PIN, ohmicU(I)),
    row('pin', BV_PIN, forwardU(I)),
  ]
}
