// 示例 PiN 的开关瞬态（1.4）：N⁻ 区一维空穴连续性方程（漂移 + 扩散 + 复合）与外电路联立，显式差分。
// 电中性 n = p + N_D；P⁺ 端空穴电流 = γ·J（关断时为抽出的空穴电流），N⁺ 端空穴电流为 0。
//
// 测试电路与 0.8 相同（电阻法）：正向电源 U₁、反向电源 U_R 经单刀双掷开关 S、电阻 R、回路电感 L 接二极管，
//   L·di/dt = U_s − u − R·i（U_s = U₁ 或 −U_R）。默认 U_R = 600 V、R = 20 Ω，I_F = I_R = 30 A，L = 0.3 µH（约 30 cm 导线的量级，L/R = 15 ns）。
// 开通（正向恢复）：开关拨到 +U₁，电流经 L 上升（L/R = 15 ns）。N⁻ 区起初只有平衡少子，空穴从阳极注入、
//   向阴极漂移扩散，电导调制逐步建立；端电压先冲高到 U_FRM 再回落。反偏时势垒电容上的电荷（约 50 nC）
//   在开头约 2 ns 内放完，不计。
// 关断（反向恢复）有两种外电路：
//   - 电阻法（res，同 0.8）：开关拨到 −U_R，电流经 L 过零后反向，约为 (U_R + u)/R；
//   - 手册的测法（didt）：电流按规定的 di_F/dt 下降，直到二极管电压接近 −U_R，之后只剩回路杂散电感 L_σ 与 U_R
//     （实际由电感负载加一只开关管实现，学了开关器件再讲）。I_RM、t_a、t_b、软度都在这种波形上定义。
//   阳极侧载流子抽空后，
//   空间电荷区从 P⁺N⁻ 结向 N⁺ 推进（前沿 x_L），前沿速度 |J|/(q(p_f + N_eff))，N_eff = N_D + |J|/(q·v_sat)
//   （穿过空间电荷区的空穴电荷）。
// 端电压计入串联电阻 R_s（1.3），与 1.3 的端电压一致。
// 模型局限：不计碰撞电离；软恢复的软度算不准，软恢复演示另用示意波形（softWave）。
import { EPS_SI, Q } from './pn'
import { MAT_REF, PIN, forward, seriesR, type PinMat } from './pin'

/** 一个时刻的快照：给舞台和时间游标用 */
export interface PinFrame {
  t: number
  /** 二极管电流（A，正向为正） */
  i: number
  /** 二极管端电压（V） */
  u: number
  /** 空间电荷区前沿（cm，0 表示还没开始阻断） */
  xL: number
  /** N⁻ 区等离子体浓度（cm⁻³），cell 中心 */
  p: Float32Array
}

export interface PinWave {
  kind: 'on' | 'off'
  frames: PinFrame[]
  /** cell 中心位置（cm） */
  x: Float32Array
  /** 稳态存储电荷（C），关断时为初始值 */
  Q0: number
}

export interface PinSwitchParams {
  /** 正向电流（A），U₁ = U_F + I_F·R */
  IF: number
  /** 反向电源电压（V） */
  UR: number
  /** 电阻（Ω），I_R = U_R/R */
  R: number
  /** 回路电感（H） */
  L: number
  /** 手册测法的电流下降率（A/s）与回路杂散电感（H） */
  didt: number
  Ls: number
  /** 阳极注入效率 */
  gamma: number
  m: PinMat
}

export const PIN_SW: PinSwitchParams = { IF: 30, UR: 600, R: 20, L: 0.3e-6, didt: 500e6, Ls: 50e-9, gamma: 1, m: MAT_REF }

/** 二极管上的串联电阻（Ω），与 1.3 的端电压一致 */
const RS = seriesR()

/** N⁻ 区的格数（120 格时与 240 格的结果相差 5 % 以内，计算快 8 倍） */
const M = 120

function grid() {
  const dx = PIN.W / M
  const x = new Float32Array(M)
  for (let k = 0; k < M; k++) x[k] = (k + 0.5) * dx
  return { dx, x }
}

/** 临时数组：每步重用，避免几万步里反复分配 */
const E_BUF = new Float64Array(M)
const FLUX = new Float64Array(M + 1)

/** 一步空穴输运：p 原地更新，返回 k0 之后各界面电场之和 × dx（N⁻ 等离子体区的压降，V） */
function transport(p: Float64Array, k0: number, J: number, JpL: number, dt: number, dx: number, m: PinMat, pFloor: number) {
  const { mun, mup, Dn, Dp, tau } = m
  const ND = PIN.ND
  const n = M - k0
  const E = E_BUF
  const flux = FLUX
  flux[0] = JpL
  for (let k = 0; k < n - 1; k++) {
    const a = p[k0 + k]
    const b = p[k0 + k + 1]
    const pf = (a + b) / 2
    const dpf = (b - a) / dx
    const e = (J - Q * (Dn - Dp) * dpf) / (Q * (mun * (pf + ND) + mup * pf))
    E[k] = e
    flux[k + 1] = Q * mup * (e > 0 ? a : b) * e - Q * Dp * dpf
  }
  flux[n] = 0
  for (let k = 0; k < n; k++) {
    const i = k0 + k
    const v = p[i] - (dt / Q) * ((flux[k + 1] - flux[k]) / dx) - (dt * (p[i] - pFloor)) / tau
    p[i] = Math.max(pFloor, v)
  }
  let UM = 0
  for (let k = 0; k < n - 1; k++) UM += E[k] * dx
  return UM
}

/** 正向电源电压 U₁ = U_F + I_F·R（V），U_F 为稳态端电压 */
export function sourceU1(s: PinSwitchParams) {
  return forward(s.IF / PIN.A, { m: s.m, gamma: s.gamma }).U + RS * s.IF + s.IF * s.R
}

/** 回路电流一步（隐式处理 R）：L·di/dt = U_s − u − R·i */
const stepI = (i: number, Us: number, u: number, s: PinSwitchParams, dt: number) => (i + (dt / s.L) * (Us - u)) / (1 + (dt * s.R) / s.L)

/** 开通：正向恢复。t_end（s），每 frameDt（s）存一帧 */
export function turnOn(sp: Partial<PinSwitchParams> = {}, tEnd = 0.4e-6, frameDt = 2e-9): PinWave {
  const s = { ...PIN_SW, ...sp }
  const { dx, x } = grid()
  const m = s.m
  const p0 = (m.ni * m.ni) / PIN.ND
  const p = new Float64Array(M).fill(p0)
  const JF = s.IF / PIN.A
  const U1 = sourceU1(s)
  // 显式格式的稳定条件：扩散 dt < dx²/(2D)，漂移 dt < dx/v（未调制时空穴漂移最快：v = μ_p·J/(qμ_nN_D)）；J 最大约 1.05 J_F
  const dt = Math.min((0.2 * dx * dx) / m.Dn, (0.28 * dx * Q * m.mun * PIN.ND) / (m.mup * JF))
  const frames: PinFrame[] = []
  let next = 0
  let i = 0
  for (let t = 0; t <= tEnd; t += dt) {
    const J = i / PIN.A
    let UM = transport(p, 0, J, s.gamma * J, dt, dx, m, p0)
    // 两端半格按端点处的电导补上
    UM += (J * dx) / 2 / (Q * (m.mun * (p[0] + PIN.ND) + m.mup * p[0]))
    UM += (J * dx) / 2 / (Q * (m.mun * (p[M - 1] + PIN.ND) + m.mup * p[M - 1]))
    const Uj = m.UT * Math.log((Math.max(p[0], 1) * (p[M - 1] + PIN.ND)) / (m.ni * m.ni))
    const u = Uj + UM + RS * i
    if (t >= next) {
      frames.push({ t, i, u, xL: 0, p: Float32Array.from(p) })
      next += frameDt
    }
    i = stepI(i, U1, u, s, dt)
  }
  return { kind: 'on', frames, x, Q0: 0 }
}

/** 关断：反向恢复。circuit = 'res'（电阻法）或 'didt'（手册的测法） */
export function turnOff(sp: Partial<PinSwitchParams> = {}, tEnd = 0.5e-6, frameDt = 1e-9, circuit: 'res' | 'didt' = 'res'): PinWave {
  const s = { ...PIN_SW, ...sp }
  const { dx, x } = grid()
  const m = s.m
  const ND = PIN.ND
  const JF = s.IF / PIN.A
  const st = forward(JF, { m, gamma: s.gamma, n: M + 1 })
  const p = new Float64Array(M)
  for (let k = 0; k < M; k++) p[k] = (st.p[k] + st.p[k + 1]) / 2
  let Q0 = 0
  for (const v of p) Q0 += v
  Q0 *= Q * dx * PIN.A
  const dt = (0.2 * dx * dx) / m.Dn
  const frames: PinFrame[] = []
  let i = s.IF
  let ramp = true
  let xL = 0
  let E1 = 0
  let blocking = false
  let next = 0
  for (let t = 0; t <= tEnd; t += dt) {
    const J = i / PIN.A
    const k0 = Math.min(Math.floor(xL / dx), M - 1)
    let JpL = s.gamma * J
    if (blocking) {
      // 前沿向阴极推进时要扫走前面的等离子体，并有穿过空间电荷区的空穴；后退时只需把施主重新盖上
      const pf = J < 0 ? Math.max(p[k0], 0) : 0
      const Neff = ND + Math.abs(Math.min(J, 0)) / (Q * PIN.vsat)
      JpL = J < 0 ? (J * pf) / (pf + Neff) : 0
      // 反向电流给空间电荷区充电；电流回正时放电（前沿后退，不再造出等离子体）
      if (E1 > 0 || (xL >= PIN.W && J < 0)) E1 = Math.max(0, E1 - (J / EPS_SI) * dt)
      else xL = Math.min(PIN.W, Math.max(0, xL - (J / (Q * (pf + Neff))) * dt))
    }
    const UM = transport(p, k0, J, JpL, dt, dx, m, 0)
    if (blocking) p.fill(0, 0, Math.min(Math.floor(xL / dx), M))
    else if (p[0] <= 1e10) blocking = true
    let u: number
    if (!blocking) {
      u = m.UT * Math.log((Math.max(p[0], 1e6) * (p[M - 1] + ND)) / (m.ni * m.ni)) + UM
    } else {
      const Neff = ND + Math.abs(Math.min(J, 0)) / (Q * PIN.vsat)
      u = -((Q * Neff * xL * xL) / (2 * EPS_SI) + E1 * PIN.W) + (xL < PIN.W ? UM : 0)
    }
    u += RS * i
    if (t >= next) {
      frames.push({ t, i, u, xL, p: Float32Array.from(p) })
      next += frameDt
    }
    if (circuit === 'res') i = stepI(i, -s.UR, u, s, dt)
    // 手册的测法：二极管电压接近 −U_R 之前电流按 di/dt 下降，之后回路里只剩 U_R 与 L_σ
    else if (ramp && s.UR + u - s.Ls * s.didt > 0) i -= s.didt * dt
    else {
      ramp = false
      i -= (dt * (s.UR + u)) / s.Ls
    }
  }
  return { kind: 'off', frames, x, Q0 }
}

/** 测 t_rr 时反向电流降到 I_R 的几分之几为止（与 0.8 相同） */
export const IRR_FRAC_PIN = 0.25

/** 反向恢复参数（电阻法，与 0.8 相同；时间从电流过零 t₀ 算起） */
export interface PinRecovery {
  /** 电流过零、结开始阻断、恢复结束（反向电流降到 0.25 I_R）的时刻（s，开关切换后） */
  t0: number
  tBlock: number
  tEnd: number
  /** 存储时间、下降时间、反向恢复时间（s） */
  ts: number
  tf: number
  trr: number
  /** 反向电流最大值（A，正值） */
  IRmax: number
  /** t₀ 到恢复结束之间反向电流的面积（C） */
  Qrr: number
  /** 反向电压峰值（V，正值） */
  URM: number
}

export function recoveryOf(w: PinWave, IR = PIN_SW.UR / PIN_SW.R): PinRecovery {
  const f = w.frames
  const cross = (k: number) => f[k - 1].t + (f[k - 1].i / (f[k - 1].i - f[k].i)) * (f[k].t - f[k - 1].t)
  let k0 = f.findIndex((a) => a.i <= 0)
  if (k0 < 1) k0 = 1
  const t0 = cross(k0)
  const kb = f.findIndex((a) => a.xL > 0)
  const tBlock = kb < 0 ? NaN : f[kb].t
  const lim = IRR_FRAC_PIN * IR
  let ke = f.length - 1
  for (let k = Math.max(kb, k0); k < f.length; k++)
    if (-f[k].i <= lim) {
      ke = k
      break
    }
  const tEnd = f[ke - 1].t + ((-f[ke - 1].i - lim) / (f[ke].i - f[ke - 1].i)) * (f[ke].t - f[ke - 1].t)
  let Qrr = 0
  let IRmax = 0
  let URM = 0
  for (let k = k0; k <= ke; k++) Qrr -= ((Math.min(0, f[k].i) + Math.min(0, f[k - 1].i)) / 2) * (f[k].t - f[k - 1].t)
  for (const a of f) {
    IRmax = Math.max(IRmax, -a.i)
    URM = Math.max(URM, -a.u)
  }
  return { t0, tBlock, tEnd, ts: tBlock - t0, tf: tEnd - tBlock, trr: tEnd - t0, IRmax, Qrr, URM }
}

/** 手册测法的反向恢复参数（STTH3012 图 1 的量法）：t_a = t₀ 到峰值 I_RM；t_b = 峰值到 t₂，
 *  t₂ 由过 I_RM 与衰减段 0.1 I_RM 两点的直线外推到零；Q_rr 为 t₀–t₂ 间反向电流的面积 */
export interface PinRecoveryDidt {
  t0: number
  t1: number
  t2: number
  IRM: number
  ta: number
  tb: number
  trr: number
  Qrr: number
  /** 软度 t_b/t_a */
  S: number
  /** 反向电压峰值（V，正值） */
  URM: number
  /** 外推线经过的两个点 [t, i] */
  fit: [[number, number], [number, number]]
}

export function recoveryDidt(t: ArrayLike<number>, i: ArrayLike<number>, u: ArrayLike<number>): PinRecoveryDidt {
  const n = t.length
  let k0 = 1
  while (k0 < n && i[k0] > 0) k0++
  const t0 = t[k0 - 1] + (i[k0 - 1] / (i[k0 - 1] - i[k0])) * (t[k0] - t[k0 - 1])
  let k1 = k0
  for (let k = k0; k < n; k++) if (i[k] < i[k1]) k1 = k
  const IRM = -i[k1]
  let k10 = n - 1
  for (let k = k1; k < n; k++)
    if (-i[k] <= 0.1 * IRM) {
      k10 = k
      break
    }
  const t10 = t[k10 - 1] + ((-i[k10 - 1] - 0.1 * IRM) / (i[k10] - i[k10 - 1])) * (t[k10] - t[k10 - 1])
  const t1 = t[k1]
  const t2 = t1 + (t10 - t1) / 0.9
  let Qrr = 0
  for (let k = k0; k < n && t[k] <= t2; k++) Qrr -= ((Math.min(0, i[k]) + Math.min(0, i[k - 1])) / 2) * (t[k] - t[k - 1])
  let URM = 0
  for (let k = 0; k < n; k++) URM = Math.max(URM, -u[k])
  return { t0, t1, t2, IRM, ta: t1 - t0, tb: t2 - t1, trr: t2 - t0, Qrr, S: (t2 - t1) / (t1 - t0), URM, fit: [[t1, -IRM], [t10, -0.1 * IRM]] }
}

/** 开通波形的正向恢复：峰值 U_FRM、出现时刻与最后一帧的电压（t_fr 的定义随手册而异，由调用方按需要算） */
export function forwardRecoveryOf(w: PinWave) {
  const f = w.frames
  let kp = 0
  for (let k = 0; k < f.length; k++) if (f[k].u > f[kp].u) kp = k
  return { UFRM: f[kp].u, tPeak: f[kp].t, UF: f[f.length - 1].u }
}
