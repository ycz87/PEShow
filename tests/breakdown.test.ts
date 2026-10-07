import { describe, it, expect } from 'vitest'
import {
  ZENERS, ZENER_IDS, FITS, reverseV, reverseI, dynamicR, opPoint, multiplication, holeRatio,
  depletion, tcMv, thermalSteady, thermalStep, THERMAL, TJ_MAX,
} from '../src/engine/physics/breakdown'

describe('击穿段拟合：落在手册限值之内', () => {
  for (const id of ZENER_IDS) {
    const d = ZENERS[id]
    it(`${id}：经过 (U_Z, I_ZT)，Z_ZT 等于上限，I_R 与 Z_ZK 不超过上限`, () => {
      expect(reverseV(d, d.IZT, 25)).toBeCloseTo(d.VZ, 4)
      expect(dynamicR(d, d.IZT, 25) / d.ZZT).toBeCloseTo(1, 3)
      expect(reverseI(d, d.VRtest, 25)).toBeLessThanOrEqual(d.IR * 1.001)
      expect(dynamicR(d, d.IZK, 25)).toBeLessThan(d.ZZK)
      expect(FITS[id].Rs).toBeGreaterThanOrEqual(0)
      expect(FITS[id].Rs).toBeLessThan(d.ZZT)
    })
  }

  it('有解时 I_R 正好等于上限（1N4728A、1N4757A）', () => {
    for (const id of ['1N4728A', '1N4757A'] as const) {
      const d = ZENERS[id]
      expect(reverseI(d, d.VRtest, 25) / d.IR).toBeCloseTo(1, 2)
    }
  })

  it('reverseI 与 reverseV 互为反函数，工作点满足 U_S = U + IR', () => {
    for (const id of ZENER_IDS) {
      const d = ZENERS[id]
      for (const I of [1e-4, d.IZT, 1.5 * d.IZT]) expect(reverseI(d, reverseV(d, I, 80), 80) / I).toBeCloseTo(1, 4)
      const op = opPoint(d, d.VZ * 1.2, 20, 25)
      expect(op.V + op.I * 20).toBeCloseTo(d.VZ * 1.2, 6)
    }
  })
})

describe('温度系数', () => {
  it('U_Z 随温度的变化等于手册温度系数中值', () => {
    for (const id of ZENER_IDS) {
      const d = ZENERS[id]
      const dV = (reverseV(d, d.IZT, 125) - reverseV(d, d.IZT, 25)) / 100
      expect(dV * 1e3).toBeCloseTo(tcMv(d), 1)
    }
    expect(tcMv(ZENERS['1N4728A'])).toBeLessThan(0)
    expect(tcMv(ZENERS['1N4757A'])).toBeGreaterThan(30)
  })
})

describe('结的几何与雪崩倍增', () => {
  it('隧穿型耗尽层只有几十 nm、电场 > 1 MV/cm；雪崩型约 2 µm、电场 < 0.5 MV/cm', () => {
    const t = depletion(ZENERS['1N4728A'], 3)
    const a = depletion(ZENERS['1N4757A'], 50)
    expect(t.W * 1e7).toBeLessThan(60)
    expect(t.Emax).toBeGreaterThan(1e6)
    expect(a.W * 1e4).toBeGreaterThan(1.5)
    expect(a.Emax).toBeLessThan(5e5)
  })

  it('M(0) = 1，随电压单调增大，温度升高时同一电压下 M 变小', () => {
    const d = ZENERS['1N4757A']
    expect(multiplication(d, 0, 25)).toBe(1)
    expect(multiplication(d, 45, 25)).toBeGreaterThan(multiplication(d, 30, 25))
    expect(multiplication(d, 50, 125)).toBeLessThan(multiplication(d, 50, 25))
  })

  it('空穴与电子的电离率之比在 0.2–0.6 之间（雪崩管 U_Z 附近的场强）', () => {
    const k = holeRatio(4.5e5)
    expect(k).toBeGreaterThan(0.2)
    expect(k).toBeLessThan(0.6)
  })
})

describe('热模型', () => {
  it('限流时稳得住；不限流时散热好勉强稳住、散热差超过 T_j 上限', () => {
    const limGood = thermalSteady(true, 'good')!
    const limPoor = thermalSteady(true, 'poor')!
    const noGood = thermalSteady(false, 'good')!
    const noPoor = thermalSteady(false, 'poor')
    expect(limGood).toBeLessThan(90)
    expect(limPoor).toBeLessThan(TJ_MAX - 30)
    expect(noGood).toBeGreaterThan(120)
    expect(noGood).toBeLessThan(TJ_MAX - 15)
    expect(noPoor === null || noPoor > TJ_MAX).toBe(true)
  })

  it('时间推进收敛到稳态', () => {
    let T = THERMAL.Ta
    for (let k = 0; k < 400; k++) T = thermalStep(T, 0.1, true, 'good')
    expect(T).toBeCloseTo(thermalSteady(true, 'good')!, 1)
  })
})
