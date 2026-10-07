// PN 结电容（0.7）：势垒电容 C_j（耗尽层两侧裸露的离子电荷随电压变化）与扩散电容 C_d（中性区存储的少子随电压变化）。
// 都是小信号、低频的 C = dQ/dV，在结压降 U_j（外加电压扣除体电阻压降）处取值。示例结的参数见 pn.ts
import { AREA, EPS_SI, J_REF, PN, TAU, depletionCm, junctionV, shockley, type Junction } from './pn'

/** 突变结的梯度因子：C_j ∝ (U_bi − U_j)^{−m}，m = 1/2 */
const M = 0.5
/**
 * 正偏超过 FC·U_bi 后，耗尽层近似失效（公式在 U_j → U_bi 时发散，实际上耗尽层里已有大量注入的载流子），
 * 按 SPICE 的做法改用 FC·U_bi 处的切线外推
 */
export const FC = 0.5

/** 耗尽层近似：C_j = εA/W */
function cbDepletion(Vj: number, j: Junction) {
  return (EPS_SI * AREA) / depletionCm(Vj, j)
}

/** 零偏势垒电容 C_j0（F），25 °C 时约 600 pF */
export function cB0(j = J_REF) {
  return cbDepletion(0, j)
}

/** 外加电压 V 下是否已进入 C_j 的外推段（U_j > FC·U_bi，图上画虚线） */
export function cbExtrapolated(V: number, j = J_REF) {
  return junctionV(V, j) > FC * j.Vbi
}

/** 势垒电容 C_j（F），Vj 为结压降 */
export function cBj(Vj: number, j = J_REF) {
  if (Vj <= FC * j.Vbi) return cbDepletion(Vj, j)
  return (cB0(j) / (1 - FC) ** (1 + M)) * (1 - FC * (1 + M) + (M * Vj) / j.Vbi)
}

/** 势垒电容 C_j（F），V 为外加电压 */
export function cB(V: number, j = J_REF) {
  return cBj(junctionV(V, j), j)
}

/**
 * 耗尽层一侧的电荷 Q_j(U_j)（C，相差一个常数），dQ_j/dU_j = C_j。大信号动态（0.8）用它算耗尽层充放电的电流：
 * U_j ≤ FC·U_bi 时 Q_j = −2C_j0·U_bi·√(1 − U_j/U_bi)（m = 1/2），以上为外推段的积分
 */
export function qB(Vj: number, j = J_REF) {
  const c0 = cB0(j)
  const v1 = FC * j.Vbi
  if (Vj <= v1) return -2 * c0 * j.Vbi * Math.sqrt(1 - Vj / j.Vbi)
  const k = c0 / (1 - FC) ** (1 + M)
  const f = (v: number) => k * ((1 - FC * (1 + M)) * v + (M * v * v) / (2 * j.Vbi))
  return -2 * c0 * j.Vbi * Math.sqrt(1 - FC) + f(Vj) - f(v1)
}

/**
 * 扩散电容 C_d = τ·g/2 = τ(I + I_S)/(2nU_T)（F）：长基区二极管的低频小信号电容，g = dI/dU_j 为结的小信号电导。
 * 存储电荷是 Q = τI，但交流扩散方程给出的低频电容只有 τg/2（见 0.7 的「更多」）。反偏时 I + I_S → 0，C_d 随之消失
 */
export function cD(V: number, j = J_REF) {
  const Vj = junctionV(V, j)
  return (TAU * (shockley(Vj, j) + j.Is)) / (2 * PN.nIdeal * j.VT)
}

/** 结电容 C_T = C_j + C_d（F） */
export function cJ(V: number, j = J_REF) {
  return cB(V, j) + cD(V, j)
}

