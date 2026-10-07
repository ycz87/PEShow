// 示例 PiN 的开关瞬态（1.4）：N⁻ 区一维空穴连续性方程（漂移 + 扩散 + 复合）与外电路联立，显式差分。
// 电中性 n = p + N_D；P⁺ 端空穴电流 = γ·J（关断时为抽出的空穴电流），N⁺ 端空穴电流为 0。
//
// 开通（正向恢复）：电流按 di/dt 线性上升到 I_F 后保持（IGBT 关断，负载电流转入二极管）。
//   N⁻ 区起初只有平衡少子，空穴从阳极注入、向阴极漂移扩散，电导调制逐步建立；端电压先冲高到 U_FRM 再回落。
// 关断（反向恢复，双脉冲电路）：IGBT 按 di/dt 开通，电压降到零后为闭合开关；回路杂散电感 L_σ，不加缓冲。
//   阳极侧载流子抽空后，空间电荷区从 P⁺N⁻ 结向 N⁺ 推进（前沿 x_L），
//   前沿速度 |J|/(q(p_f + N_eff))，N_eff = N_D + |J|/(q·v_sat)（穿过空间电荷区的空穴电荷）。
// 模型局限：不计碰撞电离（尖峰超过击穿电压时由页面截取并提示）；软恢复的软度算不准，软恢复演示另用示意波形。
import { EPS_SI, Q } from './pn'
import { MAT_REF, PIN, forward, type PinMat } from './pin'

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
  /** 正向电流（A） */
  IF: number
  /** 换流速度（A/s） */
  didt: number
  /** 直流电压（V），关断用 */
  UR: number
  /** 回路杂散电感（H），关断用 */
  Ls: number
  /** 阳极注入效率 */
  gamma: number
  m: PinMat
}

export const PIN_SW: PinSwitchParams = { IF: 30, didt: 500e6, UR: 600, Ls: 50e-9, gamma: 1, m: MAT_REF }

const M = 240

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

/** 开通：正向恢复。t_end（s），每 frameDt（s）存一帧 */
export function turnOn(sp: Partial<PinSwitchParams> = {}, tEnd = 1e-6, frameDt = 2e-9): PinWave {
  const s = { ...PIN_SW, ...sp }
  const { dx, x } = grid()
  const m = s.m
  const p0 = (m.ni * m.ni) / PIN.ND
  const p = new Float64Array(M).fill(p0)
  const JF = s.IF / PIN.A
  // 显式格式的稳定条件：扩散 dt < dx²/(2D)，漂移 dt < dx/v（未调制时空穴漂移最快：v = μ_p·J/(qμ_nN_D)）
  const dt = Math.min((0.2 * dx * dx) / m.Dn, (0.3 * dx * Q * m.mun * PIN.ND) / (m.mup * JF))
  const frames: PinFrame[] = []
  let next = 0
  for (let t = 0; t <= tEnd; t += dt) {
    const I = Math.min(s.didt * t, s.IF)
    const J = I / PIN.A
    let UM = transport(p, 0, J, s.gamma * J, dt, dx, m, p0)
    if (t >= next) {
      // 两端半格按端点处的电导补上
      UM += (J * dx) / 2 / (Q * (m.mun * (p[0] + PIN.ND) + m.mup * p[0]))
      UM += (J * dx) / 2 / (Q * (m.mun * (p[M - 1] + PIN.ND) + m.mup * p[M - 1]))
      const Uj = m.UT * Math.log((Math.max(p[0], 1) * (p[M - 1] + PIN.ND)) / (m.ni * m.ni))
      frames.push({ t, i: I, u: Uj + UM, xL: 0, p: Float32Array.from(p) })
      next += frameDt
    }
  }
  return { kind: 'on', frames, x, Q0: 0 }
}

/** 关断：反向恢复（双脉冲电路） */
export function turnOff(sp: Partial<PinSwitchParams> = {}, tEnd = 0.4e-6, frameDt = 1e-9): PinWave {
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
  let iS = 0
  let ramp = true
  let xL = 0
  let E1 = 0
  let blocking = false
  let u = st.U
  let next = 0
  for (let t = 0; t <= tEnd; t += dt) {
    const iD = s.IF - iS
    const J = iD / PIN.A
    const k0 = Math.min(Math.floor(xL / dx), M - 1)
    let JpL = s.gamma * J
    if (blocking) {
      const pf = Math.max(p[k0], 0)
      const Neff = ND + Math.abs(J) / (Q * PIN.vsat)
      JpL = J < 0 ? (J * pf) / (pf + Neff) : 0
      // 反向电流给空间电荷区充电；电流回正时放电（前沿后退，不再造出等离子体）
      if (E1 > 0 || (xL >= PIN.W && J < 0)) E1 = Math.max(0, E1 - (J / EPS_SI) * dt)
      else xL = Math.min(PIN.W, Math.max(0, xL - (J / (Q * (pf + Neff))) * dt))
    }
    const UM = transport(p, k0, J, JpL, dt, dx, m, 0)
    if (blocking) p.fill(0, 0, Math.min(Math.floor(xL / dx), M))
    else if (p[0] <= 1e10) blocking = true
    if (!blocking) {
      u = m.UT * Math.log((Math.max(p[0], 1e6) * (p[M - 1] + ND)) / (m.ni * m.ni)) + UM
    } else {
      const Neff = ND + Math.abs(Math.min(J, 0)) / (Q * PIN.vsat)
      u = -((Q * Neff * xL * xL) / (2 * EPS_SI) + E1 * PIN.W) + (xL < PIN.W ? UM : 0)
    }
    if (t >= next) {
      frames.push({ t, i: iD, u, xL, p: Float32Array.from(p) })
      next += frameDt
    }
    // 外电路：IGBT 电压 U_R + u − L_σ·di/dt 降到零之前按 di/dt 接过电流，之后为闭合开关
    if (ramp && s.UR + u - s.Ls * s.didt > 0) iS += s.didt * dt
    else {
      ramp = false
      iS += (dt * (s.UR + u)) / s.Ls
    }
  }
  return { kind: 'off', frames, x, Q0 }
}

export interface PinRecovery {
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
  /** 结开始阻断的时刻 */
  tBlock: number
}

/** 关断波形的反向恢复参数：t₂ 按 IEC 60747-2，过 0.9 I_RM 与 0.25 I_RM 两点外推到零 */
export function recoveryOf(w: PinWave): PinRecovery {
  const f = w.frames
  let k0 = f.findIndex((a) => a.i < 0)
  if (k0 < 0) k0 = f.length - 1
  let kr = k0
  for (let k = k0; k < f.length; k++) if (f[k].i < f[kr].i) kr = k
  const IRM = -f[kr].i
  const after = (frac: number) => {
    for (let k = kr; k < f.length; k++) if (-f[k].i <= frac * IRM) return k
    return f.length - 1
  }
  const k9 = after(0.9)
  const k25 = after(0.25)
  const slope = (f[k25].i - f[k9].i) / (f[k25].t - f[k9].t || 1e-12)
  const t2 = f[k25].t - f[k25].i / slope
  let Qrr = 0
  for (let k = k0 + 1; k < f.length && f[k].t <= t2; k++) Qrr -= ((f[k].i + f[k - 1].i) / 2) * (f[k].t - f[k - 1].t)
  const t0 = f[k0].t
  const t1 = f[kr].t
  const kb = f.findIndex((a) => a.xL > 0)
  let URM = 0
  for (const a of f) URM = Math.max(URM, -a.u)
  return { t0, t1, t2, IRM, ta: t1 - t0, tb: t2 - t1, trr: t2 - t0, Qrr, S: (t2 - t1) / (t1 - t0), URM, tBlock: kb < 0 ? NaN : f[kb].t }
}

/** 开通波形的正向恢复：峰值 U_FRM、出现时刻，以及回落到 1.1 倍稳态电压的时刻 t_fr */
export function forwardRecoveryOf(w: PinWave) {
  const f = w.frames
  let kp = 0
  for (let k = 0; k < f.length; k++) if (f[k].u > f[kp].u) kp = k
  const uEnd = f[f.length - 1].u
  let kfr = f.length - 1
  for (let k = kp; k < f.length; k++)
    if (f[k].u <= 1.1 * uEnd) {
      kfr = k
      break
    }
  return { UFRM: f[kp].u, tPeak: f[kp].t, tfr: f[kfr].t, UF: uEnd }
}
