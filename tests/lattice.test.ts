import { describe, it, expect } from 'vitest'
import { displayTarget, equilibrium, balance } from '../src/engine/physics/doping'
import { FIELD, GAMMA, HOLE_RATIO, HOP_START, Lattice, neighbors, type LatticeCfg } from '../src/engine/physics/lattice'

/** 可复现的伪随机数 */
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const base: LatticeCfg = { dopant: 'none', many: false, hop: false, field: false, zoom: false }
const DT = 1 / 30

function make(cfg: Partial<LatticeCfg>, tC = 25, logN = 16, seed = 1) {
  const c = { ...base, ...cfg }
  const L = new Lattice(c, mulberry32(seed))
  L.build(tC, displayTarget(c, tC, logN))
  return L
}

/** 跑 T 秒，返回 n、p 的时间平均与产生、复合次数 */
function run(L: Lattice, T: number) {
  let n = 0
  let p = 0
  let k = 0
  let gen = 0
  let recomb = 0
  for (let t = 0; t < T; t += DT) {
    L.step(DT)
    n += L.electrons.length
    p += L.holes.filter((h) => !h.bound).length
    k++
    for (const e of L.events) {
      if (e.kind === 'gen') gen++
      else if (e.kind === 'recomb') recomb++
    }
    L.events.length = 0
  }
  return { n: n / k, p: p / k, gen, recomb }
}

describe('掺杂硅的平衡浓度', () => {
  it('n·p = n_i²，多子 ≈ 杂质浓度', () => {
    const c = equilibrium(25, 'P', 16)
    expect((c.n * c.p) / c.ni ** 2).toBeCloseTo(1, 9)
    expect(c.n / 1e16).toBeCloseTo(1, 6)
    const b = equilibrium(25, 'B', 15)
    expect(b.p / 1e15).toBeCloseTo(1, 6)
  })
  it('高温下少子显著增多：175 °C 时 n_i ≈ 4×10¹³，与 10¹⁴ 的掺杂可比', () => {
    const c = equilibrium(175, 'P', 14)
    expect(c.ni).toBeGreaterThan(2e13)
    expect(c.p / c.n).toBeGreaterThan(0.1)
    expect(equilibrium(25, 'P', 14).p / 1e14).toBeLessThan(1e-7)
  })
  it('显示数量：多子 − 少子 = 杂质数，多子·少子 = Ni²', () => {
    const t = displayTarget({ dopant: 'P', many: true, zoom: false }, 25, 16)
    const b = balance(t.D, t.Ni)
    expect(b.maj - b.min).toBeCloseTo(t.D, 9)
    expect(b.maj * b.min).toBeCloseTo(t.Ni ** 2, 9)
  })
  it('显示数量随温度单调增加，−40 → 175 °C 约 20 倍', () => {
    const o = { dopant: 'none' as const, many: false, zoom: false }
    const r = displayTarget(o, 175, 16).Ni / displayTarget(o, -40, 16).Ni
    expect(r).toBeGreaterThan(15)
    expect(r).toBeLessThan(30)
  })
})

describe('晶格几何', () => {
  it('每个键有 6 个相邻键，且相邻关系是对称的', () => {
    for (const [bx, by] of [[2.5, 3], [4, 2.5]] as [number, number][]) {
      const nb = neighbors(bx, by)
      expect(nb).toHaveLength(6)
      for (const [x, y] of nb) expect(neighbors(x, y).some(([a, b]) => a === bx && b === by)).toBe(true)
    }
  })
})

describe('本征硅的产生与复合', () => {
  const L = make({}, 25, 16, 7)
  run(L, 20)
  const r = run(L, 300)
  it('平衡时产生与复合大致相等', () => {
    expect(r.gen).toBeGreaterThan(100)
    expect(r.recomb / r.gen).toBeGreaterThan(0.85)
    expect(r.recomb / r.gen).toBeLessThan(1.15)
  })
  it('平衡时 n = p ≈ Ni', () => {
    expect(r.n / L.Ni).toBeGreaterThan(0.75)
    expect(r.n / L.Ni).toBeLessThan(1.3)
    expect(Math.abs(r.n - r.p)).toBeLessThan(1e-9)
  })
  it('升温后数量逐渐变多，降温后逐渐变少', () => {
    const hot = make({}, 25, 16, 3)
    hot.retarget(150, displayTarget(base, 150, 16))
    run(hot, 30)
    const a = run(hot, 60)
    expect(a.n / hot.Ni).toBeGreaterThan(0.75)
    expect(hot.Ni).toBeGreaterThan(L.Ni * 2)
    hot.retarget(-40, displayTarget(base, -40, 16))
    run(hot, 40)
    const b = run(hot, 60)
    expect(b.n).toBeLessThan(a.n * 0.6)
  })
})

describe('掺杂硅', () => {
  it('N 型：电子是多子，n − p = 电离杂质数，n·p 与 Ni² 同量级', () => {
    const L = make({ dopant: 'P', many: true }, 25, 16, 11)
    run(L, 20)
    const r = run(L, 200)
    expect(r.n - r.p).toBeCloseTo(L.dopants.length, 9)
    expect(r.n).toBeGreaterThan(r.p * 2)
    // 已配对、正在奔向空穴的电子不再参与配对，少子只有 1 个左右时 n·p 的时间平均偏高约一半
    const np = (r.n * r.p) / L.Ni ** 2
    expect(np).toBeGreaterThan(0.6)
    expect(np).toBeLessThan(2)
  })
  it('单个磷原子：25 °C 时会电离出一个自由电子，0 K 时不电离', () => {
    const L = make({ dopant: 'P' }, 25)
    run(L, 30)
    expect(L.dopants[0].ionized).toBe(true)
    expect(L.electrons).toHaveLength(1)
    const C = make({ dopant: 'P' }, -273)
    run(C, 30)
    expect(C.dopants[0].ionized).toBe(false)
    expect(C.electrons).toHaveLength(0)
  })
  it('单个硼原子：电离后空位离开硼，成为可移动的空穴', () => {
    const L = make({ dopant: 'B' }, 25)
    expect(L.holes[0].bound).toBe(true)
    run(L, 30)
    expect(L.dopants[0].ionized).toBe(true)
    expect(L.holes).toHaveLength(1)
    expect(L.holes[0].bound).toBe(false)
  })
})

describe('价电子跳跃与漂移', () => {
  it('单步演示：电子从右边跳进空位，空位向右移', () => {
    const L = make({ hop: true })
    L.hopOnce()
    expect(L.holes[0].bx).toBe(HOP_START.bx + 1)
    expect(L.hopLog).toEqual([HOP_START.bx])
    for (let t = 0; t < 1; t += DT) L.step(DT)
    L.hopOnce()
    expect(L.holes[0].bx).toBe(HOP_START.bx + 2)
  })

  /** 电极 + 电场下，每个载流子每秒从电极离开的净次数 = 平均漂移速度 / W */
  function drift(seed: number) {
    const c: LatticeCfg = { ...base, dopant: 'none', field: true }
    const L = new Lattice(c, mulberry32(seed))
    L.build(25, { D: 0, Ni: 8 })
    const T = 200
    let ne = 0
    let nh = 0
    for (let t = 0; t < T; t += DT) {
      L.step(DT)
      ne += L.electrons.filter((e) => !e.doom).length * DT
      nh += L.holes.filter((h) => !h.doom).length * DT
    }
    return { e: L.exits.e / ne, h: L.exits.h / nh }
  }

  it('电场下电子向左、空穴向右，两者对电流的贡献同号；空穴迁移率约为电子的 1/3', () => {
    let e = 0
    let h = 0
    for (const s of [1, 2, 3]) {
      const d = drift(s)
      e += d.e
      h += d.h
    }
    expect(e).toBeGreaterThan(0)
    expect(h).toBeGreaterThan(0)
    // 每个载流子每秒穿过的次数 = v / W；电子 v = FIELD/GAMMA
    const ve = (e / 3) * 12
    expect(ve / (FIELD / GAMMA)).toBeGreaterThan(0.8)
    expect(ve / (FIELD / GAMMA)).toBeLessThan(1.2)
    const ratio = h / e
    expect(ratio).toBeGreaterThan(HOLE_RATIO * 0.75)
    expect(ratio).toBeLessThan(HOLE_RATIO * 1.3)
  }, 30000)
})
