import { describe, it, expect } from 'vitest'
import { PnBundle } from '../src/engine/physics/pnBundle'
import { HOLE_D, PnSim } from '../src/engine/physics/pnSim'
import { J_REF, PN, bands, depletionWidth, diodeI, diodeV, junctionAt, junctionV, potential, shockley, stageV, type Junction } from '../src/engine/physics/pn'

interface RunResult {
  I: number
  outA: number
  inK: number
  recomb: number
  gen: number
  /** P 区中性区少子电子的净复合寿命（秒） */
  tauN: number
}

function run(V: number, seconds = 30, per = 600, j: Junction = J_REF): RunResult {
  const sim = new PnSim(per, 0.5)
  sim.setJunction(j)
  sim.V = V
  sim.reset()
  // 预热到稳态
  for (let t = 0; t < 8; t += 1 / 60) { sim.step(1 / 60); sim.events.length = 0 }
  sim.resetCounters()
  const s0 = { ...sim.stats }
  const left = 0.5 - sim.w / 2 - 0.03
  let acc = 0
  let n = 0
  let nInt = 0
  let netRecomb = 0
  for (let t = 0; t < seconds; t += 1 / 60) {
    sim.step(1 / 60)
    acc += sim.current
    n++
    const E = sim.electrons
    for (let i = 0; i < E.cap; i++) if (E.alive[i] && E.x[i] < left) nInt += 1 / 60
    for (const e of sim.events) {
      if (e.kind !== 'pair' || e.x >= left) continue
      netRecomb += e.gen ? -1 : 1
    }
    sim.events.length = 0
  }
  return {
    I: acc / n,
    outA: sim.counts.outA / seconds,
    inK: sim.counts.inK / seconds,
    recomb: (sim.stats.recomb - s0.recomb) / seconds,
    gen: (sim.stats.gen - s0.gen) / seconds,
    tauN: nInt / Math.max(1, netRecomb),
  }
}

describe('PN 结解析模型', () => {
  it('平衡时能带与费米能级自洽', () => {
    const p = bands(0.02, 0, 1)
    const n = bands(0.98, 0, 1)
    expect(p.EFp).toBeCloseTo(n.EFn, 9) // 平衡时 E_F 水平
    expect(p.Ec - n.Ec).toBeCloseTo(PN.Vbi, 9) // 能带弯曲 = qU_bi
  })
  it('正偏时 E_Fn − E_Fp = qV', () => {
    const b = bands(0.5, 0.5, 1)
    expect(b.EFn - b.EFp).toBeCloseTo(0.5, 9)
  })
  it('耗尽层：反偏变宽、正偏变窄', () => {
    expect(depletionWidth(-2)).toBeGreaterThan(depletionWidth(0))
    expect(depletionWidth(0.6)).toBeLessThan(depletionWidth(0))
  })
  it('肖克利方程：约 60 mV / 十倍频', () => {
    const r = shockley(0.66) / shockley(0.6)
    expect(Math.log10(r)).toBeGreaterThan(0.95)
    expect(Math.log10(r)).toBeLessThan(1.06)
  })
  it('大电流：A 到 K 的电势差等于 U_bi − U，压降大部分在体电阻上', () => {
    const V = 1.2
    const vj = junctionV(V)
    const ir = V - vj
    const vs = stageV(V)
    expect(potential(0, vs, 1, ir)).toBe(0)
    // 端电压 = 结上台阶 ψ_B − 体电阻压降；ψ_B 与 U_bi − U_j 只差几 mV（大注入修正）
    expect(potential(1, vs, 1, ir)).toBeCloseTo(PN.Vbi - V, 1)
    expect(ir).toBeGreaterThan(PN.Vbi - vs)
    // 体区能带随电势一起倾斜：E_c 与 E_Fn 之差在 N 区处处相同
    const a = bands(0.8, vs, 1, ir)
    const b = bands(0.99, vs, 1, ir)
    expect(a.Ec - a.EFn).toBeCloseTo(b.Ec - b.EFn, 9)
    expect(b.Ec - a.Ec).toBeGreaterThan(0.05)
  })
})

describe('结温', () => {
  const cold = junctionAt(-40)
  const hot = junctionAt(175)
  it('参考温度 25 °C 下与 PN 常量一致', () => {
    expect(J_REF.Vbi).toBeCloseTo(PN.Vbi, 9)
    expect(J_REF.Is).toBeCloseTo(PN.Is, 20)
    expect(J_REF.RS).toBeCloseTo(PN.RS, 9)
  })
  it('温度升高：U_bi 与 E_g 下降，n_i 与 I_S 上升', () => {
    expect(cold.Vbi).toBeGreaterThan(J_REF.Vbi)
    expect(hot.Vbi).toBeLessThan(J_REF.Vbi)
    expect(hot.Eg).toBeLessThan(J_REF.Eg)
    expect(hot.ni).toBeGreaterThan(1000 * J_REF.ni)
    expect(hot.Is).toBeGreaterThan(J_REF.Is)
  })
  it('I_S 大约每升高 4 °C 翻一倍', () => {
    const r = junctionAt(29).Is / J_REF.Is
    expect(r).toBeGreaterThan(1.8)
    expect(r).toBeLessThan(2.2)
  })
  it('端电流含体电阻：diodeV 是 diodeI 的反函数', () => {
    for (const j of [cold, J_REF, hot]) {
      for (const I of [1e-6, 1e-3, 0.1]) expect(diodeI(diodeV(I, j), j) / I).toBeCloseTo(1, 6)
    }
    // 175 °C、0.65 V：I_S 大但体电阻限流，电流只有几十 mA 量级
    expect(diodeI(0.65, hot)).toBeLessThan(0.65 / hot.RS)
  })
  it('小电流下正向压降的温度系数约 −2 mV/°C', () => {
    const k = (diodeV(1e-3, junctionAt(30)) - diodeV(1e-3, junctionAt(20))) / 10
    expect(k).toBeLessThan(-1.8e-3)
    expect(k).toBeGreaterThan(-2.5e-3)
  })
  it('能带弯曲等于该温度的 qU_bi', () => {
    const p = bands(0.02, 0, 1, 0, hot)
    const n = bands(0.98, 0, 1, 0, hot)
    expect(p.Ec - n.Ec).toBeCloseTo(hot.Vbi, 9)
    expect(p.EFp).toBeCloseTo(n.EFn, 9)
  })
  it('换温度时扩散系数 D = v_th²/γ 不变', () => {
    const sim = new PnSim(100, 0.5)
    const D0 = [sim.diffusivity(0), sim.diffusivity(1)]
    sim.setJunction(hot)
    expect(sim.diffusivity(0)).toBeCloseTo(D0[0], 12)
    expect(sim.diffusivity(1)).toBeCloseTo(D0[1], 12)
    expect(sim.w).toBeLessThan(depletionWidth(0))
  })

  const h0 = run(0, 60, 600, hot)
  const hr = run(-2, 30, 600, hot)
  const cr = run(-2, 30, 600)
  console.log({ h0, hr, cr })
  it('175 °C 零偏：净电流仍接近 0，复合与产生相互抵消', () => {
    // 高温下产生、复合事件多，计数涨落也大（单次 60 s 的标准差约 0.5），所以和同温度的反向电流比
    expect(Math.abs(h0.I)).toBeLessThan(0.15 * -hr.I)
    expect(Math.abs(h0.recomb - h0.gen)).toBeLessThan(0.3 * (h0.recomb + h0.gen) / 2 + 0.3)
  })
  it('175 °C 反偏电流比 25 °C 大', () => {
    expect(-hr.I).toBeGreaterThan(-cr.I * 1.5)
  })
})

describe('粒子仿真与理论趋势一致', () => {
  const r0 = run(0)
  const rf = run(0.6)
  const rr = run(-2)
  // 反向电流很小，计数噪声大，跑久一点再比
  const rr1 = run(-0.8, 90)
  const rr3 = run(-2.5, 90)
  console.log({ r0, rf, rr, rr1, rr3 })

  it('平衡、正偏、反偏的电流方向与大小关系', () => {
    expect(rf.I).toBeGreaterThan(8) // 明显正向电流
    expect(Math.abs(r0.I)).toBeLessThan(rf.I * 0.05) // 平衡时净电流接近 0
    expect(rr.I).toBeLessThan(0) // 反向电流为负
    expect(-rr.I).toBeLessThan(rf.I * 0.35) // 且远小于正向电流
  })
  it('外电路接力：A 端流出的电子数 = K 端流入的电子数', () => {
    expect(Math.abs(rf.outA - rf.inK)).toBeLessThan(0.1 * rf.outA + 0.2)
    expect(Math.abs(rr.outA - rr.inK)).toBeLessThan(0.2 * Math.abs(rr.outA) + 0.2)
  })
  it('平衡时复合与产生相互抵消（细致平衡）', () => {
    expect(Math.abs(r0.recomb - r0.gen)).toBeLessThan(0.3 * (r0.recomb + r0.gen) / 2 + 0.3)
  })
  it('正偏时以净复合为主，反偏时以产生为主', () => {
    expect(rf.recomb).toBeGreaterThan(rf.gen * 3)
    expect(rr.gen).toBeGreaterThan(rr.recomb * 1.5)
  })
  it('少子寿命与设定值同量级', () => {
    // 低注入下应 ≈ sim.tau（2.2 s）；注入较强时分母里的 n 变大，净复合率略降，寿命略长
    expect(rf.tauN).toBeGreaterThan(1.5)
    expect(rf.tauN).toBeLessThan(4)
  })
  it('反向电流基本饱和：反压从 0.8 V 增到 2.5 V，电流只随耗尽层宽度缓慢增大', () => {
    // 理论上产生电流 ∝ W，W 之比 = √((U_bi+2.5)/(U_bi+0.8)) ≈ 1.44。
    // 舞台势垒只有 6 kT，耗尽层两侧"尚未完全耗尽"的过渡带占比偏大，
    // 有效产生宽度随反压增长得比真实器件快，实测约 1.5–2.0。这是已知的模型局限。
    const ratio = rr3.I / rr1.I
    expect(ratio).toBeGreaterThan(1.1)
    expect(ratio).toBeLessThan(2.6)
  })
})

describe('欧姆接触与平均定向速度', () => {
  function settle(V: number, seconds: number) {
    const sim = new PnSim(900, 0.45)
    sim.V = V
    sim.reset()
    for (let t = 0; t < seconds; t += 1 / 30) { sim.step(1 / 30); sim.events.length = 0 }
    return sim
  }

  it('空穴扩散慢（D_p ≈ 0.4 D_n），但电子、空穴的热速度相同（同一温度）', () => {
    const sim = settle(0, 10)
    expect(sim.diffusivity(1) / sim.diffusivity(0)).toBeCloseTo(HOLE_D, 12)
    expect(HOLE_D).toBeGreaterThan(0.3)
    expect(HOLE_D).toBeLessThan(0.45)
    const v2 = (P: typeof sim.electrons) => {
      let s = 0
      let n = 0
      for (let i = 0; i < P.cap; i++) if (P.alive[i]) { s += P.vy[i] ** 2; n++ }
      return s / n
    }
    // y 方向不受势垒力，速度方差就是 v_th²（每种约 900 个，单次快照的统计误差约 5%）
    for (const P of [sim.electrons, sim.holes]) {
      expect(v2(P) / sim.vth ** 2).toBeGreaterThan(0.85)
      expect(v2(P) / sim.vth ** 2).toBeLessThan(1.15)
    }
  })

  it('零偏时电极吸收的少子与它发射的少子大致相等', () => {
    const sim = settle(0, 10)
    let absorbed = 0
    let emitted = 0
    for (let t = 0; t < 150; t += 1 / 30) {
      sim.step(1 / 30)
      for (const e of sim.events) {
        if (e.kind !== 'contact') continue
        // A 端的电子、K 端的空穴是少子
        const minority = (e.side === 'A') === (e.who === 0)
        if (!minority) continue
        // 电子离开 / 空穴被填掉 = 吸收；电子进入 / 空穴出现 = 发射
        if (e.out === (e.who === 0)) absorbed++
        else emitted++
      }
      sim.events.length = 0
    }
    expect(absorbed).toBeGreaterThan(50)
    expect(emitted / absorbed).toBeGreaterThan(0.6)
    expect(emitted / absorbed).toBeLessThan(1.4)
  })

  it('零偏时各区多子和耗尽层里的平均定向速度≈0；正偏时电子向 P、空穴向 N', () => {
    const s0 = settle(0, 25)
    for (const [k, z] of [[0, 1], [0, 2], [1, 0], [1, 1]] as const) expect(Math.abs(s0.meanVx(k, z))).toBeLessThan(0.004)
    const sf = settle(0.6, 25)
    for (const z of [0, 1, 2] as const) {
      expect(sf.meanVx(0, z)).toBeLessThan(-0.005)
      expect(sf.meanVx(1, z)).toBeGreaterThan(0.005)
    }
    // 同一股电流：人少的少子平均跑得比人多的多子快
    expect(-sf.meanVx(0, 0)).toBeGreaterThan(-sf.meanVx(0, 2) * 2)
  })
})

describe('并联细柱', () => {
  /** 零偏下全体细柱的产生 / 复合次数（预热后 T 秒） */
  function balance(per: number, T: number) {
    const b = new PnBundle(per)
    for (let t = 0; t < 15; t += 1 / 20) b.step(1 / 20)
    const g0 = b.cols.reduce((a, c) => a + c.stats.gen, 0)
    const r0 = b.cols.reduce((a, c) => a + c.stats.recomb, 0)
    for (let t = 0; t < T; t += 1 / 20) b.step(1 / 20)
    return {
      gen: b.cols.reduce((a, c) => a + c.stats.gen, 0) - g0,
      recomb: b.cols.reduce((a, c) => a + c.stats.recomb, 0) - r0,
    }
  }

  it('每根只有 40 个载流子时，零偏仍满足细致平衡（复合率里的浓度取全体平均）', () => {
    const { gen, recomb } = balance(40, 400)
    // 单柱直方图当浓度时 G/R ≈ 1.21–1.27；全体平均后 ≈ 1.00–1.05
    expect(gen / recomb).toBeGreaterThan(0.9)
    expect(gen / recomb).toBeLessThan(1.12)
  }, 60000)

  it('电流读数按全体折算，与屏幕上画多少粒子无关', () => {
    const I = (per: number) => {
      const b = new PnBundle(per)
      b.view.V = 0.6
      b.reset()
      for (let t = 0; t < 15; t += 1 / 20) b.step(1 / 20)
      let acc = 0
      let n = 0
      for (let t = 0; t < 100; t += 1 / 20) { b.step(1 / 20); acc += b.current; n++ }
      return acc / n
    }
    const lo = I(40)
    const hi = I(900)
    expect(lo / hi).toBeGreaterThan(0.92)
    expect(lo / hi).toBeLessThan(1.08)
  }, 60000)
})
