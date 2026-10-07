import { describe, it, expect } from 'vitest'
import { FC, cB, cB0, cD, cJ } from '../src/engine/physics/capacitance'
import { formatCap } from '../src/app/format'
import { J_REF, diodeV } from '../src/engine/physics/pn'

describe('势垒电容 C_j', () => {
  it('零偏 C_j0 ≈ 598 pF（εA/W0，W0 ≈ 0.21 µm，A = 1.2 mm²）', () => {
    expect(cB0()).toBeGreaterThan(590e-12)
    expect(cB0()).toBeLessThan(605e-12)
    expect(cB(0)).toBe(cB0())
  })

  it('反偏时 C_j = C_j0/√(1 + U_R/U_bi)', () => {
    for (const V of [-1, -2.5]) expect(cB(V) / cB0()).toBeCloseTo(Math.sqrt(J_REF.Vbi / (J_REF.Vbi - V)), 9)
    expect(cB(-2.5) * 1e12).toBeCloseTo(295, -1)
  })

  it('在 FC·U_bi 处切换到切线外推：值与斜率都连续', () => {
    const v = FC * J_REF.Vbi
    const h = 1e-4
    const below = cB(v - h)
    const above = cB(v + h)
    expect(Math.abs(above - below) / below).toBeLessThan(1e-3)
    const s1 = (cB(v - h) - cB(v - 2 * h)) / h
    const s2 = (cB(v + 2 * h) - cB(v + h)) / h
    expect(Math.abs(s2 - s1) / s1).toBeLessThan(2e-3)
  })
})

describe('扩散电容 C_d', () => {
  it('10 mA 时 τI/(2U_T) ≈ 0.97 µF（讲解稿中的数值）', () => {
    expect(cD(diodeV(10e-3)) * 1e6).toBeCloseTo(0.973, 2)
  })

  it('反偏时可以忽略', () => {
    expect(cD(-1)).toBeLessThan(1e-20)
    expect(cJ(-1)).toBe(cB(-1))
  })

  it('C_d 约在 0.53 V 超过 C_j', () => {
    expect(cD(0.5)).toBeLessThan(cB(0.5))
    expect(cD(0.56)).toBeGreaterThan(cB(0.56))
  })
})

describe('formatCap', () => {
  it('按量级选单位', () => {
    expect(formatCap(598e-12)).toBe('598 pF')
    expect(formatCap(1.5e-9)).toBe('1.50 nF')
    expect(formatCap(9.73e-7)).toBe('973 nF')
    expect(formatCap(1e-30)).toBe('≈ 0')
  })
})
