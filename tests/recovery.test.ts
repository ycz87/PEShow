import { describe, it, expect } from 'vitest'
import { Base, IRR_FRAC, L_LOOP, R_LIM, simulate, sampleAt, sources, duration, type SwitchParams } from '../src/engine/physics/recovery'
import { qB, cBj } from '../src/engine/physics/capacitance'
import { J_REF, TAU, diodeV } from '../src/engine/physics/pn'

const P: SwitchParams = { IF: 10e-3, IR: 10e-3 }

/** erf（Abramowitz–Stegun 7.1.26，误差 < 1.5e-7） */
function erf(x: number) {
  const t = 1 / (1 + 0.3275911 * x)
  const y = ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t
  return 1 - y * Math.exp(-x * x)
}

describe('扩散方程求解器', () => {
  it('恒流抽取的存储时间与解析解 erf√(t_s/τ) = I_F/(I_F + I_R) 一致', () => {
    for (const ratio of [0.5, 1, 2]) {
      // 归一化：I_S = 1，稳态 u₀ = 1，然后电流突变为 −ratio
      const b = new Base(1 / Base.steadyGain(), 1e-3)
      let t = 0
      while (b.u0 > 0) {
        const { a, b: k } = b.prepare()
        b.commit((-ratio - a) / k)
        t += 1e-3
      }
      // 解析解：erf√x = 1/(1 + ratio)，二分求 x
      let lo = 0
      let hi = 4
      for (let n = 0; n < 60; n++) {
        const m = (lo + hi) / 2
        if (erf(Math.sqrt(m)) < 1 / (1 + ratio)) lo = m
        else hi = m
      }
      expect(Math.abs(t - lo) / lo).toBeLessThan(0.03)
    }
  })

  // 远端（6 个扩散长度处）u = 0，有约 e⁻⁶ 量级的少子流出，所以只要求 1% 以内
  it('电荷守恒：dQ/dt = i_diff − Q/τ', () => {
    const w = simulate('off', P)
    const dt = w.dt
    for (const k of [50, 200, 260, 400]) {
      // 扩散电流 = 端电流 − 耗尽层充放电电流
      const iDiff = w.i[k] - (qB(w.vj[k]) - qB(w.vj[k - 1])) / dt
      const lhs = (w.q[k] - w.q[k - 1]) / dt
      const rhs = iDiff - w.q[k] / TAU
      expect(Math.abs(lhs - rhs)).toBeLessThan(1e-2 * P.IF)
    }
  })
})

describe('Q_j(U_j)', () => {
  it('dQ_j/dU_j = C_j，在 FC·U_bi 两侧都成立', () => {
    for (const V of [-5, -1, 0, 0.3, 0.5, 0.65]) {
      const h = 1e-5
      expect((qB(V + h) - qB(V - h)) / (2 * h) / cBj(V)).toBeCloseTo(1, 4)
    }
    expect(cBj(-1)).toBeCloseTo(cBj(-1, J_REF), 20)
  })
})

describe('关断：反向恢复（电阻法）', () => {
  const w = simulate('off', P)
  const m = w.m!
  const { UR } = sources(P)

  it('切换前是稳态：i = I_F，Q = τI_F = 50 nC，v = U_F；两个电源 U₁ = U_F + I_F·R、U_R = I_R·R', () => {
    expect(w.i[0]).toBeCloseTo(P.IF, 6)
    expect(w.q[0] / (TAU * P.IF)).toBeCloseTo(1, 2)
    expect(w.v[0]).toBeCloseTo(diodeV(P.IF), 3)
    expect(sources(P).U1).toBeCloseTo(diodeV(P.IF) + P.IF * R_LIM, 9)
    expect(UR).toBeCloseTo(5, 9)
  })

  it('回路电感让电流约 L/R 量级的时间才过零；反向电流最大约 (U_R + U_F)/R；存储阶段电压仍为正、反向电流几乎不变', () => {
    expect(m.t0 / (L_LOOP / R_LIM)).toBeGreaterThan(0.4)
    expect(m.t0 / (L_LOOP / R_LIM)).toBeLessThan(1)
    expect(m.IRmax / ((UR + diodeV(P.IF)) / R_LIM)).toBeGreaterThan(0.95)
    expect(m.IRmax / ((UR + diodeV(P.IF)) / R_LIM)).toBeLessThan(1.02)
    const mid = sampleAt(w, m.t0 + m.ts / 2)
    expect(mid.v).toBeGreaterThan(0.3)
    expect(-mid.i / P.IR).toBeGreaterThan(1)
    expect(-mid.i / m.IRmax).toBeGreaterThan(0.95)
  })

  it('不计回路电感时电流一步之内反向，参数与有电感时只差几个百分点', () => {
    const m0 = simulate('off', P, undefined, 0).m!
    expect(m0.t0).toBeLessThan(2 * w.dt)
    expect(Math.abs(m.trr / m0.trr - 1)).toBeLessThan(0.06)
  })

  it('存储时间与解析解 erf√(t_s/τ) = I_F/(I_F + I_R) 同一量级（I_R = I_F 时约 0.23τ）', () => {
    expect(m.ts / TAU).toBeGreaterThan(0.2)
    expect(m.ts / TAU).toBeLessThan(0.27)
    expect(Math.abs(m.tv0 - m.tBlock) / m.ts).toBeLessThan(0.05)
  })

  it('t_rr = t_s + t_f，从 t₀ 量到 0.25 I_R；Q_rr < Q_F（一部分存储电荷自己复合掉）', () => {
    expect(m.trr).toBeCloseTo(m.ts + m.tf, 12)
    expect(m.tEnd).toBeCloseTo(m.t0 + m.trr, 12)
    expect(-sampleAt(w, m.tEnd).i / P.IR).toBeCloseTo(IRR_FRAC, 2)
    expect(m.Qrr).toBeLessThan(w.QF)
    expect(m.Qrr / w.QF).toBeGreaterThan(0.25)
  })

  it('电阻把回路电感阻尼掉，电压不过冲；结束时回到反偏稳态：v ≈ −U_R，电流接近零', () => {
    let vmin = 0
    for (const v of w.v) vmin = Math.min(vmin, v)
    expect(vmin).toBeGreaterThan(-UR - 1e-6)
    const end = sampleAt(w, duration(w))
    expect(end.v).toBeCloseTo(-UR, 0)
    expect(Math.abs(end.i)).toBeLessThan(0.05 * P.IR)
  })

  it('I_F 越大，t_s、t_rr、Q_rr 越大；I_R 越大，t_s 越短', () => {
    const big = simulate('off', { ...P, IF: 20e-3 }).m!
    const hard = simulate('off', { ...P, IR: 11e-3 }).m!
    const soft = simulate('off', { ...P, IR: 5e-3 }).m!
    expect(big.ts).toBeGreaterThan(m.ts)
    expect(big.trr).toBeGreaterThan(m.trr)
    expect(big.Qrr).toBeGreaterThan(m.Qrr)
    expect(hard.ts).toBeLessThan(m.ts)
    expect(soft.ts).toBeGreaterThan(m.ts)
  })
})

describe('开通', () => {
  const w = simulate('on', P)
  const { UR } = sources(P)

  it('从 −U_R 开始，最后稳定在 U_F、电流 I_F、存储电荷趋近 τI_F', () => {
    expect(w.v[0]).toBeCloseTo(-UR, 3)
    const end = sampleAt(w, duration(w))
    expect(end.i / P.IF).toBeCloseTo(1, 2)
    expect(end.v).toBeCloseTo(diodeV(P.IF), 2)
    expect(end.q / w.QF).toBeGreaterThan(0.9)
  })

  it('存储电荷比电压慢得多：电压 1 µs 就到正向压降附近，存储电荷还远没堆满', () => {
    expect(sampleAt(w, 1e-6).v).toBeGreaterThan(0.85 * diodeV(P.IF))
    expect(sampleAt(w, 1e-6).q / w.QF).toBeLessThan(0.5)
    expect(w.t90).not.toBeNull()
    expect(w.t90!).toBeGreaterThan(1e-6 + 0.5 * TAU)
  })
})
