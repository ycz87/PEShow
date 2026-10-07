// PN 结的解析模型（突变结、对称掺杂、耗尽层近似）。
// 坐标约定：x ∈ [0, 1] 为器件横向归一化位置，冶金结位于 x = 0.5，P 区在左，N 区在右。
//
// 说明（示意性缩放，会在页面上标注）：
//  - 真实室温下 qU_bi/kT ≈ 31，载流子几乎不可能越过势垒，动画中看不到任何"过结"事件。
//    为了让微观过程可见，粒子动画把势垒的 kT 数按固定比例压缩：25 °C 平衡时为 B0 = 6 个"可视 kT"，
//    其他温度、偏压下按真实的 q·ΔV/kT 同比例换算（见 barrier）。
//  - V-A 曲线、电场与电势使用真实电压值；粒子的"过结概率"随电压的变化趋势正确，但指数斜率被缩放。

export const PN = {
  Vbi: 0.8, // 25 °C 的内建电势 V（硅、常见掺杂下约 0.6–0.85 V）
  B0: 6, // 25 °C 平衡时的势垒高度（以可视 kT 为单位）
  W0: 0.16, // 25 °C 平衡时耗尽层宽度（归一化）
  Vmin: -2.5,
  Vmax: 1.5, // 外加电压上限；超过约 0.75 V 后多加的电压主要降在体电阻上
  RS: 5, // 25 °C 的串联体电阻 Ω
  Is: 1e-14, // 25 °C 的反向饱和电流 A
  nIdeal: 1, // 理想因子
}

/** 温度滑块范围（°C）：常见器件结温规格 −40…175 °C */
export const TEMP = { min: -40, max: 175 }
/** 参考温度（°C）：PN 里的 U_bi、I_S、R_S 都是这个温度下的值 */
export const T_REF = 25

export const K_B = 8.617333e-5 // 玻尔兹曼常数 eV/K
export const kelvin = (tC: number) => tC + 273.15

/** 硅的本征载流子浓度 n_i，cm⁻³（Misiakos–Tsamakis 1993 拟合，实测范围 78–340 K，更高温度为外推） */
export function niSi(TK: number) {
  return 5.29e19 * (TK / 300) ** 2.54 * Math.exp(-6726 / TK)
}

/** 硅禁带宽度 eV（Varshni 公式，E_g(0) = 1.17 eV） */
function egSi(TK: number) {
  return 1.17 - (4.73e-4 * TK * TK) / (TK + 636)
}

/** 结两侧的掺杂浓度 N_A = N_D（对称结），由参考温度下的 U_bi = 2U_T ln(N/n_i) 反推，约 4.8×10¹⁶ cm⁻³ */
const N_DOP = niSi(kelvin(T_REF)) * Math.exp(PN.Vbi / (2 * K_B * kelvin(T_REF)))

/** 某一温度下的结参数 */
export interface Junction {
  tC: number
  /** 热电压 kT/q，V */
  VT: number
  /** 本征载流子浓度，cm⁻³ */
  ni: number
  Eg: number
  Vbi: number
  Is: number
  RS: number
}

/**
 * 结温 tC（°C）下的参数。简化假设：
 *  - U_bi = 2U_T ln(N/n_i)，掺杂全部电离；
 *  - I_S ∝ n_i²：扩散系数 D = μkT/q 与寿命 τ 视为不随温度变化（μ ∝ 1/T 的近似）；
 *  - 体电阻 R_S ∝ 1/μ ∝ T。
 */
export function junctionAt(tC: number): Junction {
  const TK = kelvin(tC)
  const VT = K_B * TK
  const ni = niSi(TK)
  const r = ni / niSi(kelvin(T_REF))
  return {
    tC,
    VT,
    ni,
    Eg: egSi(TK),
    Vbi: 2 * VT * Math.log(N_DOP / ni),
    Is: PN.Is * r * r,
    RS: (PN.RS * TK) / kelvin(T_REF),
  }
}

export const J_REF = junctionAt(T_REF)

/** 舞台势垒的压缩系数：参考温度下真实势垒 qU_bi/kT ≈ 31，画成 B0 = 6 个"可视 kT" */
const VIS = (PN.B0 * J_REF.VT) / PN.Vbi

/** 结压降 U_j：解 V = U_j + I(U_j)·R_S（左边随 U_j 单调增，用二分法）。反偏时 |I|R_S < I_S R_S，可忽略 */
export function junctionV(V: number, j = J_REF) {
  if (V <= 0) return V
  let lo = 0
  let hi = V
  for (let i = 0; i < 50; i++) {
    const m = (lo + hi) / 2
    if (m + shockley(m, j) * j.RS > V) hi = m
    else lo = m
  }
  return (lo + hi) / 2
}

/** 注入水平超过这个值就算大注入：低注入模型不再成立，结区不再"耗尽" */
export const HIGH_INJECTION = 0.1

/** 注入水平 p_n(0)/N_D = e^{−(U_bi−U_j)/U_T}（低注入估算），超过约 0.1 后低注入模型不再成立 */
export function injection(Vj: number, j = J_REF) {
  return Math.exp(-(j.Vbi - Vj) / j.VT)
}

/** 静电势垒 ψ_B ≈ U_T ln(1 + N_D/Δ)：低注入时等于 U_bi − U_j；在任何有限电流下都为正 */
export function psiB(Vj: number, j = J_REF) {
  return j.VT * Math.log1p(1 / injection(Vj, j))
}

/**
 * 舞台（粒子仿真、耗尽层、电势与能带图层）使用的等效电压：使结上的电势台阶等于 ψ_B。
 * 低注入时就是 U_j；25 °C、外加 1.5 V 时约 0.77 V（势垒约 0.03 V）
 */
export function stageV(V: number, j = J_REF) {
  return j.Vbi - psiB(junctionV(V, j), j)
}

/** 结上实际承受的电势差（含形成过程比例 s ∈ [0,1]） */
export function junctionDrop(V: number, s = 1, j = J_REF) {
  return s * (j.Vbi - V)
}

/** 势垒高度，单位：可视 kT（真实的 q·ΔV/kT 乘以压缩系数，温度越高势垒的 kT 数越少） */
export function barrier(V: number, s = 1, j = J_REF) {
  return (VIS * junctionDrop(V, s, j)) / j.VT
}

/** 耗尽层总宽度 W ∝ √(U_bi − V)，以参考温度的平衡宽度 W0 为基准 */
export function depletionWidth(V: number, s = 1, j = J_REF) {
  return PN.W0 * Math.sqrt(Math.max(0, junctionDrop(V, s, j)) / PN.Vbi)
}

/**
 * 归一化电势分布 f(x) ∈ [0,1]（P 区中性区为 0，N 区中性区为 1）及其导数。
 * 对称突变结（x_p = x_n = w/2）：两侧各为抛物线，在冶金结处 f = 0.5。
 */
export function profile(x: number, w: number): { f: number; df: number } {
  const half = w / 2
  const u = x - 0.5
  if (w <= 1e-6) return { f: u < 0 ? 0 : 1, df: 0 }
  if (u <= -half) return { f: 0, df: 0 }
  if (u >= half) return { f: 1, df: 0 }
  if (u < 0) {
    const t = (u + half) / half
    return { f: 0.5 * t * t, df: (u + half) / (half * half) }
  }
  const t = (half - u) / half
  return { f: 1 - 0.5 * t * t, df: (half - u) / (half * half) }
}

/**
 * 体电阻压降 IR_S 产生的电势（以 A 端为 0）：两侧中性区按长度分摊，沿电流方向线性下降，耗尽层内不变。
 * ir：体电阻压降（V），w：耗尽层宽度
 */
export function bulkPhi(x: number, w: number, ir: number) {
  if (ir === 0) return 0
  const covered = Math.min(x, 0.5 - w / 2) + Math.max(0, x - (0.5 + w / 2))
  return (-ir * covered) / (1 - w)
}

/** 电势 φ(x)，单位 V，以 A 端为 0；ir 为体电阻压降 */
export function potential(x: number, V: number, s = 1, ir = 0, j = J_REF) {
  const w = depletionWidth(V, s, j)
  return junctionDrop(V, s, j) * profile(x, w).f + bulkPhi(x, w, ir)
}

/** 电场大小 |E(x)|（方向由 N 指向 P），单位 V/归一化长度 */
export function fieldMag(x: number, V: number, s = 1, j = J_REF) {
  return junctionDrop(V, s, j) * profile(x, depletionWidth(V, s, j)).df
}

/** 肖克利方程 I = I_S (e^{V/(n U_T)} − 1)，单位 A */
export function shockley(V: number, j = J_REF) {
  return j.Is * (Math.exp(V / (PN.nIdeal * j.VT)) - 1)
}

/** 外加电压 V 下的端电流（含体电阻 R_S）：I = I_S(e^{U_j/(nU_T)} − 1)，V = U_j + IR_S */
export function diodeI(V: number, j = J_REF) {
  return shockley(junctionV(V, j), j)
}

/** 端电流为 I（> 0）时所需的外加电压，diodeI 的反函数 */
export function diodeV(I: number, j = J_REF) {
  return PN.nIdeal * j.VT * Math.log(I / j.Is + 1) + I * j.RS
}

// ───────────── 耗尽层产生电流（只用于反偏） ─────────────

export const Q = 1.602177e-19 // 元电荷 C
export const EPS_SI = 11.7 * 8.854188e-14 // 硅的介电常数 F/cm
/** 少子寿命 s（τ_n = τ_p，不随温度变化）：结面积由它反推；扩散电容、存储电荷也用它 */
export const TAU = 5e-6
/** 结面积 cm²：由 I_S = 1e-14 A、少子寿命 TAU 反推，约 1.2 mm² */
export const AREA = 0.012
/** 产生寿命 s：按常用简化取 τ_g = 2τ */
const TAU_G = 2 * TAU

/** 耗尽层真实宽度（cm）：对称突变结 W = √(2ε(U_bi − V)/q · 2/N) */
export function depletionCm(V: number, j = J_REF) {
  return Math.sqrt((2 * EPS_SI * Math.max(0, j.Vbi - V) * 2) / (Q * N_DOP))
}

/** 耗尽层产生电流大小 I_gen = qA·n_i·W/τ_g（A），反偏时才有意义 */
export function genI(V: number, j = J_REF) {
  return (Q * AREA * j.ni * depletionCm(V, j)) / TAU_G
}

/**
 * 含产生电流的端电流：反偏时 I = −I_S(1 − e^{V/U_T}) − I_gen(1 − e^{V/2U_T})，在 V = 0 处连续为零；
 * 正偏时只用理想二极管 diodeI（不计复合电流，见页面上的模型说明）
 */
export function totalI(V: number, j = J_REF) {
  if (V > 0) return diodeI(V, j)
  return shockley(V, j) - genI(V, j) * (1 - Math.exp(V / (2 * j.VT)))
}

/** 能带（无电流时以 N 区中性区导带底为能量零点，单位 eV）；ir 为体电阻压降，体区能带随之倾斜 */
export function bands(x: number, V: number, s = 1, ir = 0, j = J_REF) {
  const w = depletionWidth(V, s, j)
  const drop = junctionDrop(V, s, j)
  // 电子能量 = −qφ，P 区导带高出 N 区 q(U_bi − V)；体电阻压降使能带和准费米能级一起倾斜
  const tilt = -bulkPhi(x, w, ir)
  const Ec = drop - drop * profile(x, w).f + tilt
  const Ev = Ec - j.Eg
  const off = (j.Eg - j.Vbi) / 2 // 平衡时 E_F 距最近能带边的距离
  const EFn = -off + tilt // N 区电子准费米能级
  // P 区空穴准费米能级随 P 区能带一起移动：E_Fn − E_Fp = qV（正偏时 E_Fp 低于 E_Fn）
  const EFp = EFn - V * s
  return { Ec, Ev, EFn, EFp }
}

