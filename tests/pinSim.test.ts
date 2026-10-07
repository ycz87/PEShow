import { describe, it, expect } from 'vitest'
import { PinSim, PIN_SIM } from '../src/engine/physics/pinSim'
import { PIN, builtIn, forward, reverseField, wAtBV } from '../src/engine/physics/pin'

/** 推进 seconds 并返回各区个数的时间平均 */
function mean(sim: PinSim, seconds: number) {
  const m = { hP: 0, hN: 0, eN: 0, eK: 0 }
  let n = 0
  run(sim, seconds, () => {
    for (const k of ['hP', 'hN', 'eN', 'eK'] as const) m[k] += sim.census[k]
    n++
  })
  for (const k of ['hP', 'hN', 'eN', 'eK'] as const) m[k] /= n
  return m
}

/** 推进 seconds（舞台秒），每步 1/30 s */
function run(sim: PinSim, seconds: number, each?: () => void) {
  for (let k = 0; k < Math.round(seconds * 30); k++) {
    sim.step(1 / 30)
    each?.()
  }
}

describe('PiN 粒子仿真（第 0 章 PnSim 的子类）', { timeout: 30000 }, () => {
  it('零偏：三个区的多子个数保持，N⁻ 区几乎没有空穴，A、K 两端净电流 ≈ 0', () => {
    const sim = new PinSim()
    run(sim, 10)
    sim.resetCounters()
    const m = mean(sim, 30)
    expect(Math.abs(m.eK - PIN_SIM.HEAVY)).toBeLessThan(3)
    expect(Math.abs(m.hP - PIN_SIM.HEAVY)).toBeLessThan(3)
    expect(Math.abs(m.eN - PIN_SIM.BASE)).toBeLessThan(1.5)
    expect(m.hN).toBeLessThan(0.1)
    expect(Math.abs(sim.counts.outA)).toBeLessThan(8)
  })

  it('正偏 30 A：N⁻ 区空穴的稳态分布与模型的悬链线一致', () => {
    const sim = new PinSim()
    sim.setBias({ mode: 'forward', urev: 0, current: 30 })
    sim.reset()
    run(sim, 20)
    const BINS = 8
    const acc = new Float64Array(BINS)
    const tmp = new Float64Array(BINS)
    let n = 0
    run(sim, 120, () => {
      sim.holeProfile(BINS, tmp)
      for (let k = 0; k < BINS; k++) acc[k] += tmp[k]
      n++
    })
    const st = forward(30 / PIN.A, { n: 801 })
    // 每列只有十几个粒子，统计涨落可达 ±15 %（相关时间很长），所以看各列误差的平均与最大值
    let sum = 0
    for (let k = 0; k < BINS; k++) {
      let m = 0
      let c = 0
      for (let i = 0; i < st.p.length; i++) {
        const xi = st.x[i] / PIN.W
        if (xi >= k / BINS && xi < (k + 1) / BINS) { m += st.p[i] / PIN.ND; c++ }
      }
      m /= c
      const err = Math.abs(acc[k] / n - m) / m
      sum += err / BINS
      expect(err).toBeLessThan(0.3)
    }
    expect(sum).toBeLessThan(0.1)
  })

  it('正偏：从零偏开始空穴越过压低的结注入 N⁻；电中性（N⁻ 电子 ≈ 施主 + 空穴），A 端流出与 K 端流入相等', () => {
    const sim = new PinSim()
    const bj0 = sim.bj
    sim.setBias({ mode: 'forward', urev: 0, current: 30 })
    run(sim, 20)
    expect(sim.bj).toBeLessThan(bj0 - 3)
    expect(sim.census.hN).toBeGreaterThan(60)
    sim.resetCounters()
    const m = mean(sim, 30)
    expect(Math.abs(m.eN - m.hN - PIN_SIM.BASE)).toBeLessThan(4)
    const { outA, inK } = sim.counts
    expect(outA).toBeGreaterThan(100)
    expect(Math.abs(outA - inK)).toBeLessThan(0.08 * outA)
  })

  it('电流越大，N⁻ 区里的粒子越多（weight 不随电流变）；拖动电流后 2 s 内就跟上', () => {
    const sim = new PinSim()
    sim.setBias({ mode: 'forward', urev: 0, current: 10 })
    run(sim, 10)
    const w = sim.weight
    const n10 = sim.census.hN
    sim.setBias({ mode: 'forward', urev: 0, current: 90 })
    expect(sim.weight).toBe(w)
    run(sim, 2)
    const n90 = sim.census.hN
    expect(n90).toBeGreaterThan(n10 * 5)
    sim.setBias({ mode: 'forward', urev: 0, current: 10 })
    run(sim, 2)
    expect(sim.census.hN).toBeLessThan(n10 * 1.5)
  })

  it('等离子体与 P⁺ 的浓度比：舞台上画的比真实的大几十倍，只在正偏时有值', () => {
    const sim = new PinSim()
    expect(sim.plasmaRatio).toBeNull()
    sim.setBias({ mode: 'forward', urev: 0, current: 30 })
    const r = sim.plasmaRatio!
    expect(r.real).toBeGreaterThan(0.004)
    expect(r.real).toBeLessThan(0.006)
    expect(r.stage / r.real).toBeGreaterThan(20)
    expect(r.stage / r.real).toBeLessThan(100)
  })

  it('反偏 600 V：耗尽层里的电子被扫走，裸露的施主由 P⁺ 一侧同样多的受主平衡；漏电流使 A、K 两端都有少量反向电流', () => {
    const sim = new PinSim()
    sim.setBias({ mode: 'reverse', urev: 600, current: 30 })
    run(sim, 15)
    const w = reverseField(600 + builtIn()).w / PIN.W
    const [, dr] = sim.depletion
    expect(dr).toBeCloseTo(PIN_SIM.XA + w * (PIN_SIM.XK - PIN_SIM.XA), 6)
    let inside = 0
    const E = sim.electrons
    for (let i = 0; i < E.cap; i++) if (E.alive[i] && E.x[i] > PIN_SIM.XA && E.x[i] < dr - 0.05) inside++
    expect(inside).toBeLessThanOrEqual(3)
    expect(Math.abs(sim.census.hP - (PIN_SIM.HEAVY - PIN_SIM.BASE * w))).toBeLessThan(5)
    sim.resetCounters()
    run(sim, 40)
    expect(sim.counts.outA).toBeLessThan(0)
    expect(sim.counts.inK).toBeLessThan(0)
  })

  it('从正偏切到反偏：存储的载流子被扫出（反向电流），之后 N⁻ 区只剩耗尽层外的少量电子', () => {
    const sim = new PinSim()
    sim.setBias({ mode: 'forward', urev: 0, current: 30 })
    sim.reset()
    run(sim, 5)
    expect(sim.census.hN).toBeGreaterThan(60)
    sim.setBias({ mode: 'reverse', urev: 600, current: 30 })
    sim.resetCounters()
    run(sim, 20)
    expect(sim.counts.outA).toBeLessThan(-100)
    expect(sim.census.hN).toBeLessThan(5)
    expect(sim.census.eN).toBeLessThan(PIN_SIM.BASE + 4)
  })

  it('只算欧姆电阻（假想）：没有空穴注入，N⁻ 区电子流向阳极，在 P⁺ 里复合或从阳极流出', () => {
    const sim = new PinSim()
    sim.setBias({ mode: 'ohmic', urev: 0, current: 30 })
    run(sim, 10)
    sim.resetCounters()
    expect(mean(sim, 30).hN).toBeLessThan(0.1)
    expect(sim.counts.outA).toBeGreaterThan(5)
    expect(sim.counts.inK).toBeGreaterThan(5)
  })
})

describe('1.1-2 普通 PN 结的两难：浓而短（10¹⁵、20 µm）与淡而长（1.3×10¹⁴、120 µm）', { timeout: 30000 }, () => {
  const DENSE = { ND: 1e15, W: wAtBV(1e15) }
  const LIGHT = { ND: PIN.ND, W: PIN.W }
  const plain = (geo: { ND: number; W: number }) => new PinSim(geo, PIN_SIM.HEAVY, true)
  /** 舞台上的长度（以示例 PiN 舞台全长为 1）：仿真坐标 × span */
  const stageLen = (s: PinSim, x: number) => x * s.span

  it('同一把尺：N 区长度与电子个数都按真实比例（浓度 ×7.7，长度 ÷6），N 区一直到阴极', () => {
    const d = plain(DENSE)
    const l = plain(LIGHT)
    expect(d.xk).toBeCloseTo(1, 9)
    expect(l.xk).toBeCloseTo(1, 9)
    expect(stageLen(d, d.wn) / stageLen(l, l.wn)).toBeCloseTo(DENSE.W / PIN.W, 6)
    expect(stageLen(d, d.xa)).toBeCloseTo(PIN_SIM.XA, 9)
    expect(d.base / l.base).toBeCloseTo((1e15 * DENSE.W) / (1.3e14 * PIN.W), 6)
    expect(d.bv).toBeGreaterThan(290)
    expect(d.bv).toBeLessThan(310)
  })

  it('零偏：N 区的电子个数保持在施主个数（阴极直接补电子），没有 N⁺', () => {
    const d = plain(DENSE)
    run(d, 10)
    const m = mean(d, 20)
    expect(m.eK).toBe(0)
    expect(Math.abs(m.eN - d.base)).toBeLessThan(2)
  })

  it('击穿时两者裸露的施主差不多（∝ E_C，只差约 1.3 倍），淡的展得长得多', () => {
    const d = plain(DENSE)
    const l = plain(LIGHT)
    d.setBias({ mode: 'reverse', urev: d.bv * 0.999, current: 0 })
    l.setBias({ mode: 'reverse', urev: l.bv * 0.999, current: 0 })
    const r = d.exposed / l.exposed
    expect(r).toBeGreaterThan(1.1)
    expect(r).toBeLessThan(1.5)
    const len = (s: PinSim) => stageLen(s, s.depletion[1] - s.xa)
    expect(len(l) / len(d)).toBeGreaterThan(4)
  })

  it('超过击穿电压：雪崩，大量电子–空穴对被扫向两端', () => {
    const d = plain(DENSE)
    d.setBias({ mode: 'reverse', urev: 400, current: 0 })
    expect(d.broken).toBe(true)
    run(d, 5)
    d.resetCounters()
    run(d, 10)
    expect(d.counts.outA).toBeLessThan(-100)
    expect(d.counts.inK).toBeLessThan(-100)
  })

  it('同样的电流：浓的电子多、跑得慢，淡的电子少、跑得快，两端计数一样快', () => {
    const d = plain(DENSE)
    const l = plain(LIGHT)
    for (const s of [d, l]) {
      s.setBias({ mode: 'ohmic', urev: 0, current: 30 })
      run(s, 10)
      s.resetCounters()
      run(s, 60)
    }
    const r = d.counts.inK / l.counts.inK
    expect(r).toBeGreaterThan(0.75)
    expect(r).toBeLessThan(1.33)
  })
})
