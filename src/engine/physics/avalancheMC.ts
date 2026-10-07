// 雪崩倍增的蒙特卡罗（舞台与测试共用，不涉及绘制），按"幸运电子"模型：
// 载流子每次碰撞后从静止开始加速，自由程服从均值 λ 的指数分布；一次自由飞行中从电场获得的能量达到阈值时，
// 撞出一对电子–空穴（碰撞电离），三者都从静止重新开始。这样得到的电离系数 α ∝ exp(−E_th/(qλ𝓔))，与 Chynoweth 式同形。
// 舞台上的 λ 是放大后的示意值，所以阈值不取真实的 ≈1.5E_g，而按模型的倍增因子 M 标定（二分法，期望值确定性求解）。
//
// 几何：P⁺N 单边突变结，P⁺ 侧的耗尽宽度可以忽略（1N4757A 约为 W 的 0.1 %）。坐标 x ∈ [0, W]，冶金结在 0，
// 电场 𝓔(x) = 𝓔max(1 − x/W) 向 N 侧线性降到零。电子从 x = 0 注入、向 +x 飞；空穴向 −x 飞。

export interface AvField {
  /** 耗尽层宽度（cm） */
  W: number
  /** 最大电场（V/cm） */
  Emax: number
  /** 平均自由程（cm，示意值） */
  lam: number
  /** 电子、空穴的电离阈值（V，即一次自由飞行要"落下"的电势差） */
  vthE: number
  vthH: number
}

export type Kind = 'e' | 'h'

/** 从 x0 出发、沿各自方向飞 s 获得的能量（V） */
export function gain(f: AvField, kind: Kind, x0: number, s: number) {
  const { W, Emax } = f
  return kind === 'e' ? Emax * (s - (2 * x0 * s + s * s) / (2 * W)) : Emax * (s * (1 - x0 / W) + (s * s) / (2 * W))
}

/** 从 x0 出发、能量攒到阈值所需的飞行距离；电场到头之前攒不够时为 Infinity */
export function thresholdDistance(f: AvField, kind: Kind, x0: number) {
  const { W, Emax } = f
  const b = 1 - x0 / W
  if (kind === 'e') {
    const disc = b * b - (2 * f.vthE) / (Emax * W)
    return disc < 0 ? Infinity : W * (b - Math.sqrt(disc))
  }
  const s = W * (-b + Math.sqrt(b * b + (2 * f.vthH) / (Emax * W)))
  return s > x0 ? Infinity : s
}

/** 一次自由飞行的结局：飞行距离、是否以碰撞电离结束、是否飞出耗尽层 */
export interface Flight {
  len: number
  ion: boolean
  exit: boolean
}

export function flight(f: AvField, kind: Kind, x0: number, rand: () => number): Flight {
  const free = -f.lam * Math.log(1 - rand())
  const sth = thresholdDistance(f, kind, x0)
  const room = kind === 'e' ? f.W - x0 : x0
  if (sth < free && sth < room) return { len: sth, ion: true, exit: false }
  if (free >= room) return { len: room, ion: false, exit: true }
  return { len: free, ion: false, exit: false }
}

/** 可复现的随机数（mulberry32） */
export function seeded(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 一棵树里载流子超过这个数就当作"失控"（M 远大于要标定的范围） */
const RUNAWAY = 4000

/** 从 x = 0 注入 n 个电子，平均每个从 N 侧流出几个电子；有一棵树失控时返回 Infinity */
export function simulateM(f: AvField, n: number, rand: () => number) {
  let out = 0
  const stack: [Kind, number][] = []
  for (let i = 0; i < n; i++) {
    stack.push(['e', 0])
    let made = 1
    while (stack.length) {
      const [kind, x0] = stack.pop()!
      let x = x0
      for (;;) {
        const fl = flight(f, kind, x, rand)
        x += kind === 'e' ? fl.len : -fl.len
        if (fl.exit) {
          if (kind === 'e') out++
          break
        }
        if (fl.ion) {
          stack.push(['e', x], ['h', x])
          if ((made += 2) > RUNAWAY) return Infinity
        }
      }
    }
  }
  return out / n
}

/** 空穴阈值：使两者的局部电离率之比在 𝓔max 处等于 k（局部电离率 1/[λ(e^{d/λ} − 1)]，d = 阈值/𝓔） */
function holeThreshold(Emax: number, lam: number, vthE: number, k: number) {
  return Emax * lam * Math.log1p(Math.expm1(vthE / (Emax * lam)) / k)
}

/** 期望倍增的网格点数 */
const GRID = 320

/**
 * 同一模型下倍增因子的期望值（确定性求解，标定用；蒙特卡罗只在测试里作对照）。
 * E(x)：x 处静止的电子最终带出几个电子；H(x)：x 处静止的空穴最终带出几个电子。一次自由飞行：
 *   E(x) = ∫₀^L e^{−ℓ/λ}E(x+ℓ)dℓ/λ + [s<余程] e^{−s/λ}·[2E(x+s) + H(x+s)] + [s≥余程] e^{−余程/λ}，L = min(s, 余程)
 * （第一项：飞行中途碰撞后从静止重来；第二项：攒够能量撞出一对，三者都从 x+s 重来；第三项：一路飞出耗尽层）。
 * H 同理（向 −x 飞，飞出时带出 0 个电子）。从零开始迭代，第 n 次迭代相当于数到第 n 代，收敛到最小解；发散时 M = ∞。
 * M 大时收敛很慢（每次迭代的增量按固定比例 ρ 缩小），增量比稳定后按等比级数外推剩余部分
 */
export function expectedM(f: AvField) {
  const N = GRID
  const h = f.W / N
  const q = Math.exp(-h / f.lam)
  const xs = Array.from({ length: N + 1 }, (_, i) => i * h)
  // 每个网格点上与迭代无关的量：截止距离 L、指数因子、撞出点位置
  const pre = (kind: Kind) =>
    xs.map((x) => {
      const room = kind === 'e' ? f.W - x : x
      const s = thresholdDistance(f, kind, x)
      const L = Math.min(s, room)
      const dir = kind === 'e' ? 1 : -1
      return { cut: x + dir * L, eL: Math.exp(-L / f.lam), ion: s < room, at: x + dir * s, eS: Math.exp(-s / f.lam), eR: Math.exp(-room / f.lam) }
    })
  const pE = pre('e')
  const pH = pre('h')
  let E = new Float64Array(N + 1)
  let H = new Float64Array(N + 1)
  let nE = new Float64Array(N + 1)
  let nH = new Float64Array(N + 1)
  const S = new Float64Array(N + 1)
  const T = new Float64Array(N + 1)
  const at = (a: Float64Array, x: number) => {
    const u = Math.min(N, Math.max(0, x / h))
    const i = Math.min(N - 1, Math.floor(u))
    return a[i] + (a[i + 1] - a[i]) * (u - i)
  }
  let dPrev = 0
  let rPrev = 0
  for (let it = 0; it < 6000; it++) {
    const m0 = E[0]
    // S(x) = ∫₀^{W−x} e^{−ℓ/λ}E(x+ℓ)dℓ/λ，T(x) = ∫₀^x e^{−ℓ/λ}H(x−ℓ)dℓ/λ（梯形，递推）
    S[N] = 0
    for (let i = N - 1; i >= 0; i--) S[i] = ((1 - q) * (E[i] + E[i + 1])) / 2 + q * S[i + 1]
    T[0] = 0
    for (let i = 1; i <= N; i++) T[i] = ((1 - q) * (H[i] + H[i - 1])) / 2 + q * T[i - 1]
    let diff = 0
    for (let i = 0; i <= N; i++) {
      const e = pE[i]
      nE[i] = S[i] - e.eL * at(S, e.cut) + (e.ion ? e.eS * (2 * at(E, e.at) + at(H, e.at)) : e.eR)
      const o = pH[i]
      nH[i] = T[i] - o.eL * at(T, o.cut) + (o.ion ? o.eS * (2 * at(H, o.at) + at(E, o.at)) : 0)
      diff = Math.max(diff, Math.abs(nE[i] - E[i]), Math.abs(nH[i] - H[i]))
    }
    ;[E, nE] = [nE, E]
    ;[H, nH] = [nH, H]
    if (E[0] > 1e5) return Infinity
    if (diff < 1e-7 * Math.max(1, E[0])) break
    const d = E[0] - m0
    const r = dPrev > 0 ? d / dPrev : 0
    if (it > 30 && r > 0 && Math.abs(r - rPrev) < 1e-5) return r < 1 ? E[0] + (d * r) / (1 - r) : Infinity
    dPrev = d
    rPrev = r
  }
  return E[0]
}

/**
 * 标定阈值，使期望倍增因子等于目标 Mt（k 为空穴与电子电离率之比）。
 * u = 阈值/(𝓔max·λ) 越大越难电离，M 单调下降，用二分法
 */
export function calibrate(W: number, Emax: number, lam: number, k: number, Mt: number): AvField {
  const make = (u: number): AvField => {
    const vthE = u * Emax * lam
    return { W, Emax, lam, vthE, vthH: holeThreshold(Emax, lam, vthE, k) }
  }
  if (Mt <= 1.005) return make(80)
  // 舞台用到的范围（M 从约 1.01 到封顶 20）u 约在 1.2…3.5 之间；14 次二分后 u 的相对误差约 0.02 %，M 约 0.3 %
  let lo = Math.log(0.5)
  let hi = Math.log(8)
  for (let it = 0; it < 14; it++) {
    const mid = (lo + hi) / 2
    if (expectedM(make(Math.exp(mid))) > Mt) lo = mid
    else hi = mid
  }
  return make(Math.exp((lo + hi) / 2))
}
