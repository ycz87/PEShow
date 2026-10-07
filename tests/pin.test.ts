import { describe, it, expect } from 'vitest'
import { BV_PIN, I_SAT_OHMIC, MAT_REF, NA_PLUS, scoreboard, PIN, criticalField, depletionW, fieldAt, forward, forwardI, forwardU, genI, ohmicDrop, pinMat, oneSidedJunction, reverseField } from '../src/engine/physics/pin'
import { forwardRecoveryOf, recoveryOf, turnOff, turnOn } from '../src/engine/physics/pinTransient'

// 数值对照《第 1 章分镜与讲解稿》（v1）各节的表格；误差范围按讲解稿的有效数字给
const near = (v: number, ref: number, rel: number) => expect(Math.abs(v - ref) / Math.abs(ref)).toBeLessThan(rel)

describe('1.1 反偏：耐压靠 N⁻ 区', () => {
  it('平行平面击穿约 1390 V，临界场强约 2.3×10⁵ V/cm', () => {
    near(BV_PIN, 1387, 0.005)
    near(criticalField(), 2.33e5, 0.01)
  })
  it('1200 V 时耗尽层约 109 µm、峰值场强约 2.2×10⁵ V/cm，三角形面积等于电压', () => {
    near(depletionW(1200) * 1e4, 109, 0.01)
    const f = reverseField(1200)
    near(f.E1, 2.2e5, 0.01)
    let U = 0
    const n = 2000
    for (let k = 0; k < n; k++) U += fieldAt(((k + 0.5) / n) * f.w, 1200) * (f.w / n)
    near(U, 1200, 1e-3)
  })
  it('超过穿通电压后电场变成梯形，面积仍等于电压', () => {
    const W = 75e-4
    const f = reverseField(1300, 5e13, W)
    expect(f.E2).toBeGreaterThan(0)
    near(f.E1 * W - (f.slope * W * W) / 2, 1300, 1e-9)
  })
  it('跷跷板表：击穿电压、所需厚度、100 A/cm² 时的欧姆压降', () => {
    const rows: [number, number, number, number][] = [
      [5e16, 16, 0.65, 0.00092], // 讲解稿表中取整为 0.7 µm、0.001 V
      [1e16, 53, 2.7, 0.014],
      [1e15, 300, 20, 0.92],
      [3e14, 741, 57, 8.6],
    ]
    for (const [N, bv, w, drop] of rows) {
      const s = oneSidedJunction(N)
      near(s.BV, bv, 0.03)
      near(s.W * 1e4, w, 0.08) // 讲解稿保留两位有效数字
      near(s.drop, drop, 0.06)
    }
  })
  it('耐压翻倍，单极型电阻约变为 2^2.5 ≈ 5.7 倍', () => {
    // BV ∝ N^(−3/4)：耐压翻倍对应掺杂变为 2^(−4/3)
    const a = oneSidedJunction(1e15, 1)
    const b = oneSidedJunction(1e15 * 2 ** (-4 / 3), 1)
    near(b.BV / a.BV, 2, 1e-6)
    near(b.drop / a.drop, 5.66, 0.04) // 迁移率随掺杂略变
  })
})

describe('1.1 正偏：电导调制', () => {
  it('关掉电导调制：100 A/cm² 时 N⁻ 区压降约 41 V（34 Ω·cm）', () => {
    near(ohmicDrop(100), 40.7, 0.01)
  })
  it('打开电导调制：U_F ≈ 1.53 V，N⁻ 区 ≈ 0.76 V，浓度最低 2.4×10¹⁵、平均约 1×10¹⁶', () => {
    const s = forward(100, { n: 801 })
    near(s.U, 1.53, 0.01)
    near(s.UM, 0.76, 0.02)
    let min = Infinity
    let sum = 0
    for (const v of s.p) {
      min = Math.min(min, v)
      sum += v
    }
    near(min, 2.44e15, 0.03)
    near(sum / s.p.length, 1.04e16, 0.03)
  })
  it('分布阳极侧高、阴极侧低，两端之比约等于 b = μn/μp ≈ 3', () => {
    const s = forward(100)
    near(s.p[0], 4.9e16, 0.02)
    near(s.p[s.p.length - 1], 1.65e16, 0.02)
  })
  it('存储电荷 Q = τJ（20 µC/cm²）', () => {
    near(forward(100, { n: 2001 }).Q, PIN.tau * 100, 0.005)
  })
  it('U_F–τ 折中表（30 A，25 °C）', () => {
    const table: [number, number][] = [[0.1e-6, 3.38], [0.2e-6, 1.53], [0.5e-6, 1.01], [1e-6, 0.92], [2e-6, 0.9], [5e-6, 0.91], [20e-6, 0.97]]
    for (const [tau, U] of table) near(forward(100, { m: pinMat(25, tau) }).U, U, 0.02)
  })
  it('穿通型（5×10¹³、75 µm）同样寿命下 U_F 约 0.98 V', () => {
    near(forward(100, { W: 75e-4, ND: 5e13 }).U, 0.98, 0.02)
  })
  it('forwardU 与 forwardI 互为反函数', () => {
    for (const I of [1e-6, 0.01, 1, 30, 90]) near(forwardI(forwardU(I)), I, 1e-6)
  })
})

describe('1.3 温度', () => {
  it('30 A 时 25 °C 约 1.52 V、125 °C 约 1.54 V；小电流负温度系数，额定电流附近正温度系数', () => {
    const hot = pinMat(125)
    near(forwardU(30), 1.52, 0.01)
    near(forwardU(30, { m: hot }), 1.54, 0.01)
    expect(forwardU(0.3, { m: hot })).toBeLessThan(forwardU(0.3))
    expect(forwardU(30, { m: hot })).toBeGreaterThan(forwardU(30))
  })
  it('漏电流（1200 V）：25 °C 约 0.04 µA，125 °C 约为 600 倍', () => {
    const cold = genI(1200)
    near(cold * 1e6, 0.044, 0.05)
    near(genI(1200, pinMat(125)) / cold, 602, 0.02)
  })
  it('迁移率与寿命在 25 °C 时等于参考值', () => {
    expect(MAT_REF.mun).toBeCloseTo(1414, 6)
    expect(MAT_REF.tau).toBeCloseTo(PIN.tau, 15)
  })
})

describe('1.4 开关瞬态（双脉冲，600 V，30 A，500 A/µs，25 °C）', () => {
  it('开通：U_FRM 约 13 V，几十纳秒内出现，之后回落到稳态', () => {
    const r = forwardRecoveryOf(turnOn())
    near(r.UFRM, 12.6, 0.08)
    expect(r.tPeak).toBeGreaterThan(15e-9)
    expect(r.tPeak).toBeLessThan(45e-9)
    near(r.UF, 1.53, 0.03)
  })
  it('开通：di/dt 越大，U_FRM 越高', () => {
    const a = forwardRecoveryOf(turnOn({ didt: 200e6 })).UFRM
    const b = forwardRecoveryOf(turnOn({ didt: 1000e6 })).UFRM
    expect(b).toBeGreaterThan(a)
  })
  it('关断：I_RM 约 46 A、t_rr 约 100 ns、Q_rr 约 2.3 µC、硬恢复（软度 < 0.3）', () => {
    const w = turnOff()
    near(w.Q0, 6e-6, 0.01)
    const r = recoveryOf(w)
    near(r.IRM, 45.7, 0.1)
    near(r.trr, 100e-9, 0.15)
    near(r.Qrr, 2.34e-6, 0.12)
    expect(r.S).toBeLessThan(0.3)
    expect(r.URM).toBeGreaterThan(600)
    expect(r.URM).toBeLessThan(BV_PIN)
  })
  it('关断：结先开始阻断，几十纳秒后反向电流才达到峰值（二极管电压接近 −U_R）', () => {
    const w = turnOff()
    const r = recoveryOf(w)
    expect(r.tBlock).toBeLessThan(r.t1)
    expect(r.t1 - r.tBlock).toBeGreaterThan(15e-9)
    const atPeak = w.frames.find((f) => f.t === r.t1)!
    near(-atPeak.u, 600, 0.05)
  })
  it('关断：Q_rr 只是存储电荷的一部分（约 40 %）', () => {
    const w = turnOff()
    const k = recoveryOf(w).Qrr / w.Q0
    expect(k).toBeGreaterThan(0.3)
    expect(k).toBeLessThan(0.5)
  })
})

describe('没有空穴注入（单极型）的电流上限', () => {
  it('J ≤ q·N_D·v_sat：示例 PiN 约 62 A；30 A 时电子速度约为饱和速度的一半', () => {
    expect(I_SAT_OHMIC).toBeGreaterThan(60)
    expect(I_SAT_OHMIC).toBeLessThan(65)
    const v30 = 100 / (1.602e-19 * PIN.ND)
    expect(v30 / PIN.vsat).toBeGreaterThan(0.45)
    expect(v30 / PIN.vsat).toBeLessThan(0.52)
  })
  it('30 A 时阳极端等离子体约为 P⁺ 浓度的 0.5 %（真实）', () => {
    const p0 = forward(100).p[0]
    expect(p0 / NA_PLUS).toBeGreaterThan(0.004)
    expect(p0 / NA_PLUS).toBeLessThan(0.006)
  })
})

describe('1.1 小结的成绩单（额定 30 A）', () => {
  const [dense, light, pin] = scoreboard()
  it('浓而短：耐压只有约 300 V，端电压约 1.6 V', () => {
    expect(dense.bv).toBeGreaterThan(290)
    expect(dense.bv).toBeLessThan(310)
    expect(dense.u).toBeGreaterThan(1.5)
    expect(dense.u).toBeLessThan(1.75)
  })
  it('淡而长：耐压约 1390 V，端电压约 41 V，发热约 1240 W', () => {
    expect(light.bv).toBeCloseTo(BV_PIN, 6)
    expect(light.u).toBeGreaterThan(40)
    expect(light.u).toBeLessThan(43)
    expect(light.p).toBeGreaterThan(1200)
    expect(light.p).toBeLessThan(1280)
  })
  it('PiN：耐压同淡而长，端电压约 1.5 V，发热约 46 W；两项指标都过关的只有它', () => {
    expect(pin.bv).toBeCloseTo(BV_PIN, 6)
    expect(pin.u).toBeGreaterThan(1.4)
    expect(pin.u).toBeLessThan(1.7)
    expect(pin.p).toBeGreaterThan(42)
    expect(pin.p).toBeLessThan(52)
    const okBv = (r: { bv: number }) => r.bv > 1000
    const okU = (r: { u: number }) => r.u < 3
    expect([dense, light, pin].filter((r) => okBv(r) && okU(r)).map((r) => r.key)).toEqual(['pin'])
  })
})
