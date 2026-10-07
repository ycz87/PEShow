import { describe, it, expect } from 'vitest'
import { J_REF, depletionCm, diodeI, diodeV, genI, junctionAt, totalI } from '../src/engine/physics/pn'

describe('反向电流：理想扩散 + 耗尽层产生', () => {
  it('−2 V 时 W ≈ 0.39 µm，I_gen ≈ 6×10⁻¹¹ A', () => {
    expect(depletionCm(-2) * 1e4).toBeCloseTo(0.39, 2)
    const g = genI(-2)
    expect(g).toBeGreaterThan(5.5e-11)
    expect(g).toBeLessThan(6.5e-11)
    expect(totalI(-2)).toBeCloseTo(-(g + J_REF.Is), 20)
  })

  it('产生电流随反压略增（∝ √(U_bi + U_R)）', () => {
    expect(genI(-2.5) / genI(-1)).toBeCloseTo(Math.sqrt((J_REF.Vbi + 2.5) / (J_REF.Vbi + 1)), 6)
  })

  it('在 V = 0 处连续为零', () => {
    expect(totalI(0)).toBe(0)
    expect(Math.abs(totalI(-1e-4))).toBeLessThan(1e-12)
    expect(totalI(1e-4)).toBeGreaterThan(0)
  })

  it('I_S 与 I_gen 约在 180 °C 相等', () => {
    const ratio = (t: number) => {
      const j = junctionAt(t)
      return j.Is / genI(-2, j)
    }
    expect(ratio(170)).toBeLessThan(1)
    expect(ratio(190)).toBeGreaterThan(1)
  })
})

describe('正向特性（讲解稿中的数值）', () => {
  it('U_F(1 mA)：−40 / 25 / 125 / 175 °C 约 0.79 / 0.66 / 0.44 / 0.32 V', () => {
    const vf = [-40, 25, 125, 175].map((t) => diodeV(1e-3, junctionAt(t)))
    expect(vf[0]).toBeCloseTo(0.79, 1)
    expect(vf[1]).toBeCloseTo(0.66, 1)
    expect(vf[2]).toBeCloseTo(0.44, 1)
    expect(vf[3]).toBeCloseTo(0.32, 1)
  })

  it('0.4 V 下 −40 °C 约 4 pA，175 °C 约 4 mA', () => {
    const lo = diodeI(0.4, junctionAt(-40))
    const hi = diodeI(0.4, junctionAt(175))
    expect(lo).toBeGreaterThan(2e-12)
    expect(lo).toBeLessThan(8e-12)
    expect(hi).toBeGreaterThan(2e-3)
    expect(hi).toBeLessThan(8e-3)
  })

  it('满量程 20 mA 起纵轴放大 10 倍，同一相对高度对应的电压低约 60 mV（含 R_S）', () => {
    for (const I of [1e-3, 1e-4]) {
      const d = diodeV(I) - diodeV(I / 10)
      expect(d).toBeGreaterThan(0.058)
      expect(d).toBeLessThan(0.066)
    }
  })
})
