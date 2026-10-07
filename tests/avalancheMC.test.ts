import { describe, it, expect } from 'vitest'
import { ZENERS, depletion, holeRatio, multiplication, opPoint } from '../src/engine/physics/breakdown'
import { calibrate, gain, seeded, simulateM, thresholdDistance } from '../src/engine/physics/avalancheMC'

const d = ZENERS['1N4757A']
const ref = depletion(d, opPoint(d, d.VZ, 0, 25).Vj)

function setup(vr: number, T = 25, cap = 20) {
  const op = opPoint(d, vr, 0, T)
  const g = depletion(d, op.Vj)
  const M = multiplication(d, op.Vj, T)
  const Mt = Math.min(M, cap)
  const f = calibrate(g.W, g.Emax, ref.W / 16, holeRatio(g.Emax), Mt)
  return { f, Mt }
}

describe('雪崩蒙特卡罗（幸运电子模型）', () => {
  it('阈值距离与能量增益互逆', () => {
    const { f } = setup(48)
    for (const kind of ['e', 'h'] as const) {
      const x0 = kind === 'e' ? 0.1 * f.W : 0.6 * f.W
      const s = thresholdDistance(f, kind, x0)
      expect(Number.isFinite(s)).toBe(true)
      expect(gain(f, kind, x0, s)).toBeCloseTo(kind === 'e' ? f.vthE : f.vthH, 6)
    }
  })

  it('标定后，换一组随机数统计的平均倍增因子与模型 M 一致（±8 %）', () => {
    for (const vr of [30, 42, 48, 50]) {
      const { f, Mt } = setup(vr)
      const M = simulateM(f, 6000, seeded(vr * 977))
      expect(Math.abs(M / Mt - 1)).toBeLessThan(0.08)
    }
  })

  it('温度升高（平均自由程变短）时同一电压下 M 变小，标定仍然成立', () => {
    const a = setup(48, 25)
    const b = setup(48, 125)
    expect(b.Mt).toBeLessThan(a.Mt)
    const M = simulateM(b.f, 6000, seeded(4242))
    expect(Math.abs(M / b.Mt - 1)).toBeLessThan(0.08)
  })
})
