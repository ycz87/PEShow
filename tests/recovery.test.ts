import { describe, it, expect } from 'vitest'
import { Base, simulate, sampleAt, duration, type SwitchParams } from '../src/engine/physics/recovery'
import { qB, cBj } from '../src/engine/physics/capacitance'
import { J_REF, TAU, diodeV } from '../src/engine/physics/pn'

const P: SwitchParams = { IF: 10e-3, didt: 1e4, VR: 2 }

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

describe('关断：反向恢复', () => {
  const w = simulate('off', P)
  const m = w.m!

  it('换流前是稳态：i = I_F，Q = τI_F = 50 nC，v = U_F', () => {
    expect(w.i[0]).toBeCloseTo(P.IF, 6)
    expect(w.q[0] / (TAU * P.IF)).toBeCloseTo(1, 2)
    expect(w.v[0]).toBeCloseTo(diodeV(P.IF), 3)
  })

  it('电流先按 di_F/dt 下降，过零时刻 t₀ ≈ I_F/(di_F/dt)', () => {
    expect(m.t0 / (P.IF / P.didt)).toBeGreaterThan(0.95)
    expect(m.t0 / (P.IF / P.didt)).toBeLessThan(1.05)
  })

  it('t₀–t₁ 之间电流已反向，电压仍为正；电压在 t₁ 附近才过零', () => {
    const mid = sampleAt(w, (m.t0 + m.t1) / 2)
    expect(mid.i).toBeLessThan(0)
    expect(mid.v).toBeGreaterThan(0.3)
    expect(Math.abs(m.tv0 - m.t1) / m.td).toBeLessThan(0.25)
  })

  it('数值量级（I_F = 10 mA，di/dt = 10 mA/µs，U_R = 2 V）', () => {
    expect(m.IRP * 1e3).toBeGreaterThan(10)
    expect(m.IRP * 1e3).toBeLessThan(13)
    expect(m.URP / P.VR).toBeGreaterThan(1.8)
    expect(m.URP / P.VR).toBeLessThan(3)
    expect(m.td / TAU).toBeGreaterThan(0.2)
    expect(m.td / TAU).toBeLessThan(0.32)
  })

  it('Q_rr < Q_F（一部分存储电荷自己复合掉），且接近三角形近似 ½I_RM·t_rr', () => {
    expect(m.Qrr).toBeLessThan(w.QF)
    expect(m.Qrr / (0.5 * m.IRP * m.trr)).toBeGreaterThan(0.7)
    expect(m.Qrr / (0.5 * m.IRP * m.trr)).toBeLessThan(1.4)
  })

  it('结束时回到反偏稳态：v ≈ −U_R，电流接近零', () => {
    const end = sampleAt(w, duration(w))
    expect(end.v).toBeCloseTo(-P.VR, 1)
    expect(Math.abs(end.i)).toBeLessThan(0.05 * m.IRP)
  })

  it('I_F 越大、di/dt 越大，I_RM 越大；di/dt 越大，t_rr 越短', () => {
    const big = simulate('off', { ...P, IF: 20e-3 }).m!
    const fast = simulate('off', { ...P, didt: 2e4 }).m!
    expect(big.IRP).toBeGreaterThan(m.IRP)
    expect(big.Qrr).toBeGreaterThan(m.Qrr)
    expect(fast.IRP).toBeGreaterThan(m.IRP)
    expect(fast.trr).toBeLessThan(m.trr)
  })
})

describe('开通', () => {
  const w = simulate('on', P)

  it('从 −U_R 开始，最后稳定在 U_F、电流 I_F、存储电荷趋近 τI_F', () => {
    expect(w.v[0]).toBeCloseTo(-P.VR, 3)
    const end = sampleAt(w, duration(w))
    expect(end.i / P.IF).toBeCloseTo(1, 2)
    expect(end.v).toBeCloseTo(diodeV(P.IF), 2)
    expect(end.q / w.QF).toBeGreaterThan(0.9)
  })

  it('存储电荷比电压慢得多：电压已到正向压降附近时，存储电荷还远没堆满', () => {
    const tI = P.IF / P.didt
    expect(sampleAt(w, tI).v).toBeGreaterThan(0.85 * diodeV(P.IF))
    expect(sampleAt(w, tI).q / w.QF).toBeLessThan(0.5)
    expect(w.t90).not.toBeNull()
    expect(w.t90!).toBeGreaterThan(tI + 0.5 * TAU)
  })
})
