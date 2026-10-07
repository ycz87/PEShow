// PN 结载流子粒子仿真（欠阻尼朗之万动力学）。
//
// 每个载流子：随机热运动 + 势垒力（漂移）+ 欧姆接触。空穴的阻尼更大，扩散系数约为电子的 0.4 倍。
// 复合与产生按"成对消失 / 成对出现"处理：把器件沿 x 分成 BINS 列，每列按局部浓度计算速率
//   R = n·p / [τ(n + p + 2n_i)]，G = n_i² / [τ(n + p + 2n_i)]（与 SRH 公式取禁带中央能级时相同），
// 每次复合挑同一列里相距最近的一个电子和一个空穴一起删去，每次产生在同一点放出一对。
// 碰面不等于复合：速率只取决于浓度，平均要等一个寿命 τ。
// 欧姆接触：多子由外电路补足；到达电极的少子被吸收，电极也按平衡少子浓度向半导体热发射少子，
// 零偏时吸收与发射相抵（缺了发射，电极就成了少子的"漏斗"，零偏时也有少子不断流向电极）。
// 零偏时 np = n_i² 处处成立，R = G，净电流 ≈ 0。由此自然得到：
//  - 正偏：势垒降低，注入少子在中性区逐渐复合 → 正向电流（外电路两端"接力"）
//  - 反偏：耗尽层内 n、p ≪ n_i，产生远多于复合 → 产生电流；加上中性区少子滑下势垒 → 很小的饱和漏电流

import { J_REF, PN, barrier, depletionWidth, fieldMag, profile, type Junction } from './pn'
import { Pool, gauss, poisson } from './particlePool'

export type Kind = 0 | 1 // 0 = 电子，1 = 空穴

/** 一次复合（成对消失）或产生（成对出现） */
export interface PairEvent {
  kind: 'pair'
  gen: boolean
  /** 两者的中点 */
  x: number
  y: number
  eUid: number
  hUid: number
}

/** 外电路事件：out = true 表示一个电子从器件进入导线 */
export interface ContactEvent {
  kind: 'contact'
  side: 'A' | 'K'
  /** 在接触处出现 / 消失的是哪种载流子 */
  who: Kind
  /**
   * 导线里那个电子的方向：true = 从器件流出到导线（电子离开；或导线抽走价电子、留下空穴），
   * false = 从导线流入器件（电子进入；或导线送来电子填掉到达的空穴）
   */
  out: boolean
  y: number
  uid: number
}

export type SimEvent = PairEvent | ContactEvent

/** 一段掺杂区：渲染器据此画底色、离子与区间分界 */
export interface DopedRegion {
  x0: number
  x1: number
  kind: 'p' | 'n'
  /** 掺杂相对水平：1 为普通（第 0 章的 P、N 区），> 1 为重掺杂，< 1 为淡掺杂（只影响底色深浅） */
  level: number
  /** 淡掺杂区只画这么多个离子（与该区的多子个数相同）；不给则按晶格铺满 */
  ions?: number
}

export const BINS = 64

/** 平均定向速度按区域统计：0 = P 区，1 = 耗尽层，2 = N 区 */
export type Zone = 0 | 1 | 2
/** 平均定向速度的滑动平均时间常数（可视秒） */
const DRIFT_TAU = 5
/** 参考温度（25 °C）下的热速度与阻尼（可视单位） */
const VTH_REF = 0.22
const GAMMA_REF = 6
/** 空穴与电子扩散系数之比 D_p/D_n = μ_p/μ_n（示例掺杂下约 362/885，见讲解稿参数表） */
export const HOLE_D = 362 / 885

export class PnSim {
  /** 归一化高度（宽为 1） */
  H = 0.5
  V = 0
  /** 结的形成进度 0→1（"接触瞬间"演示用） */
  formation = 1
  /** 结温下的参数（见 junctionAt），用 setJunction 修改 */
  j: Junction = J_REF
  /** 热运动速度（可视单位），v_th ∝ √T */
  vth = VTH_REF
  /** 电子的阻尼系数（碰撞频率），γ ∝ T：扩散系数 D = v_th²/γ 不随温度变化，对应 μ ∝ 1/T。空穴为 γ/HOLE_D */
  gamma = GAMMA_REF
  /** 空穴与电子扩散系数之比 D_p/D_n（器件可改写） */
  holeD = HOLE_D
  /** 少子寿命 τ_n = τ_p（可视时间，秒）。小注入时中性区少子的寿命就等于它 */
  tau = 2.2
  /** 两种载流子的槽位池（reset 时按 target 重建） */
  electrons!: Pool
  holes!: Pool
  target: number

  /** 每列的本征载流子数 n_i（零偏、结已形成时 n·p = n_i²），reset 时标定 */
  protected niBin = 1
  /** 按列分桶的载流子槽位（每帧重建，复合与直方图共用） */
  protected eBins: number[][] = Array.from({ length: BINS }, () => [])
  protected hBins: number[][] = Array.from({ length: BINS }, () => [])

  /** 仿真时钟（可视秒） */
  t = 0
  /** 本帧以来的事件，由渲染器取走；无人取走时只保留最近一批 */
  events: SimEvent[] = []
  /** 外电路计数：A 端流出到导线的电子数、从导线流入 K 端的电子数（可清零） */
  counts = { outA: 0, inK: 0 }
  /** 累计统计（测试用） */
  stats = { recomb: 0, gen: 0 }

  /** 阳极流入的正电荷速率（= A 端流出的电子速率），指数平滑，单位：个/秒 */
  current = 0
  /** 浓度直方图（指数平滑） */
  nHist = new Float32Array(BINS)
  pHist = new Float32Array(BINS)
  /**
   * 复合 / 产生速率里用的局部浓度 n̄、p̄（每列个数）。默认取本柱的平滑直方图；
   * 并联细柱时由 PnBundle 换成全体平均（粒子少时单柱直方图涨落太大，见 pairs）
   */
  dens = { n: this.nHist, p: this.pHist }
  private chargeIn = 0
  /**
   * 平均定向速度的统计，下标 kind·3 + zone。本步的 x 位移总和与"粒子·秒"总和，
   * 以及二者的滑动平均；比值就是该区该类载流子的平均 x 速度（= 粒子流 / 粒子数）
   */
  private dxNow = new Float64Array(6)
  private occNow = new Float64Array(6)
  private dxAvg = new Float64Array(6)
  private occAvg = new Float64Array(6)
  private tAvg = 0

  constructor(perType = 900, H = 0.5) {
    this.target = perType
    this.H = H
    this.reset()
  }

  reset() {
    this.electrons = new Pool(this.capacity)
    this.holes = new Pool(this.capacity)
    this.populate()
    this.calibrate()
    this.events = []
    this.counts.outA = 0
    this.counts.inK = 0
    this.current = 0
    this.dxAvg.fill(0)
    this.occAvg.fill(0)
    this.tAvg = 0
    this.bin()
    for (let b = 0; b < BINS; b++) {
      this.nHist[b] = this.eBins[b].length
      this.pHist[b] = this.hBins[b].length
    }
  }

  /** 每种载流子的槽位数：预留空间给注入与产生的额外载流子 */
  protected get capacity() {
    return Math.ceil(this.target * 1.6)
  }

  /** 初始布置：多子按耗尽层外的中性区均匀分布（形成过程演示时 w = 0，即两区各自均匀） */
  protected populate() {
    const w = this.w
    for (let i = 0; i < this.target; i++) {
      this.spawnAt(1, Math.random() * (0.5 - w / 2))
      this.spawnAt(0, 0.5 + w / 2 + Math.random() * (0.5 - w / 2))
    }
  }

  /** 在 x 处放一个热运动速度随机的载流子（y 随机），返回槽位，满了返回 −1 */
  protected spawnAt(kind: Kind, x: number) {
    const P = kind === 0 ? this.electrons : this.holes
    return P.spawn(x, Math.random() * this.H, gauss() * this.vth, gauss() * this.vth)
  }

  /** 换结温：热速度、阻尼与 n_i 随之改变；粒子不重置，几秒内自行趋于新的平衡 */
  setJunction(j: Junction) {
    if (j === this.j) return
    this.j = j
    const r = j.VT / J_REF.VT
    this.vth = VTH_REF * Math.sqrt(r)
    this.gamma = GAMMA_REF * r
    this.calibrate()
  }

  /** n_i 按零偏、结已形成时的平衡标定：n_i = n0·e^{−B_eq/2}，换算成每列的个数。温度越高 B_eq 越低，n_i 越大 */
  protected calibrate() {
    const Beq = barrier(0, 1, this.j)
    this.niBin = (this.majorityDensity(Beq, depletionWidth(0, 1, this.j)) * Math.exp(-Beq / 2) * this.H) / BINS
  }

  /** 扩散系数 D = v_th²/γ（可视单位） */
  diffusivity(kind: Kind) {
    return ((this.vth * this.vth) / this.gamma) * (kind === 0 ? 1 : this.holeD)
  }

  /** 少子扩散长度 L = √(Dτ)（归一化宽度） */
  diffusionLength(kind: Kind) {
    return Math.sqrt(this.diffusivity(kind) * this.tau)
  }

  /** 当前耗尽层宽度（归一化） */
  get w() {
    return depletionWidth(this.V, this.formation, this.j)
  }

  // ───────────── 器件的几何（渲染器、追踪、外电路据此作图；PN 结的冶金结在 x = 0.5） ─────────────

  /** 掺杂分区，从左（阳极）到右（阴极） */
  get regions(): DopedRegion[] {
    return [
      { x0: 0, x1: 0.5, kind: 'p', level: 1 },
      { x0: 0.5, x1: 1, kind: 'n', level: 1 },
    ]
  }

  /** 耗尽层（空间电荷区）的两端 */
  get depletion(): [number, number] {
    const w = this.w
    return [0.5 - w / 2, 0.5 + w / 2]
  }

  /** 偏置方向：+1 正偏、−1 反偏、0 零偏（电池极性、追踪时挑哪个载流子） */
  get biasSign() {
    return this.V > 0.02 ? 1 : this.V < -0.02 ? -1 : 0
  }

  /** x 处电场的相对大小（以 −2.5 V 时的结中央为 1），负值指向 −x（由 N 指向 P） */
  fieldRel(x: number) {
    return -fieldMag(x, this.V, this.formation, this.j) / fieldMag(0.5, PN.Vmin, 1)
  }

  /** 画电场箭头的区间（默认是耗尽层） */
  get fieldSpan(): [number, number] {
    return this.depletion
  }

  /** 粒子半径参照的个数（越多画得越小） */
  get drawTarget() {
    return this.target
  }

  setCount(perType: number) {
    if (perType === this.target) return
    this.target = perType
    this.reset()
  }

  resetCounters() {
    this.counts.outA = 0
    this.counts.inK = 0
  }

  /** 多子在中性区的面密度：总数 = n0 · H · ∫ e^{-U} dx */
  protected majorityDensity(B: number, w: number) {
    let I = 0
    const M = 200
    for (let k = 0; k < M; k++) I += Math.exp(-B * (1 - profile((k + 0.5) / M, w).f)) / M
    return this.target / (this.H * I)
  }

  /**
   * 每个电极向内热发射少子的速率（个/秒）：电极处少子保持平衡浓度 n_c = n_i² / 多子浓度，
   * 单向热流 = n_c · H · v_th / √(2π)（一维麦克斯韦分布向一侧的通量）
   */
  protected minorityEmission(B: number, w: number) {
    const ni = (this.niBin * BINS) / this.H
    const nc = (ni * ni) / this.majorityDensity(B, w)
    return (nc * this.H * this.vth) / Math.sqrt(2 * Math.PI)
  }

  /** 推进 dtTotal（可视秒）。单步最长 1/20 s（卡顿时仿真变慢，不跳步），分 3 个子步积分运动 */
  step(dtTotal: number) {
    const SUB = 3
    const dt = Math.min(dtTotal, 1 / 20)
    this.t += dt
    for (let k = 0; k < SUB; k++) this.substep(dt / SUB)
    this.bin()
    this.pairs(dt)
    // 平滑电流（个/秒）
    const inst = this.chargeIn / Math.max(1e-6, dt)
    this.chargeIn = 0
    this.current += (inst - this.current) * Math.min(1, dtTotal * 1.2)
    this.histogram(dtTotal)
    const a = 1 - Math.exp(-dt / DRIFT_TAU)
    for (let k = 0; k < 6; k++) {
      this.dxAvg[k] += this.dxNow[k] - a * this.dxAvg[k]
      this.occAvg[k] += this.occNow[k] - a * this.occAvg[k]
    }
    this.tAvg += dt - a * this.tAvg
    this.dxNow.fill(0)
    this.occNow.fill(0)
    if (this.events.length > 3000) this.events = this.events.slice(-1000)
  }

  /** 某区某类载流子的平均 x 方向速度（宽度/可视秒，约 5 s 滑动平均）；该区没有这类载流子时为 0 */
  meanVx(kind: Kind, zone: Zone) {
    const occ = this.occAvg[kind * 3 + zone]
    return occ > 1e-9 ? this.dxAvg[kind * 3 + zone] / occ : 0
  }

  /** 一步位移按各区边界切开，各区只记落在本区内的那一段（跨界的一步不全算给出发的区） */
  private drift(kind: Kind, x0: number, x1: number, eL: number, eR: number) {
    const dP = Math.min(x1, eL) - Math.min(x0, eL)
    const dN = Math.max(x1, eR) - Math.max(x0, eR)
    const k = kind * 3
    this.dxNow[k] += dP
    this.dxNow[k + 1] += x1 - x0 - dP - dN
    this.dxNow[k + 2] += dN
  }

  /** 同一时段内该区该类载流子的平均个数（判断平均速度是否有统计意义） */
  meanCount(kind: Kind, zone: Zone) {
    return this.tAvg > 0 ? this.occAvg[kind * 3 + zone] / this.tAvg : 0
  }

  protected contact(side: 'A' | 'K', who: Kind, out: boolean, y: number, uid: number) {
    if (side === 'A') {
      this.counts.outA += out ? 1 : -1
      this.chargeIn += out ? 1 : -1
    } else {
      this.counts.inK += out ? -1 : 1
    }
    this.events.push({ kind: 'contact', side, who, out, y, uid })
  }

  /** 按列分桶 */
  protected bin() {
    for (const [P, bins] of [[this.electrons, this.eBins], [this.holes, this.hBins]] as const) {
      for (const b of bins) b.length = 0
      for (let i = 0; i < P.cap; i++) {
        if (!P.alive[i]) continue
        const bIdx = Math.floor(P.x[i] * BINS)
        // NaN 坐标跳过（不能 clamp）；越界坐标 clamp 到边界桶，物理边界会在下一 substep 处理
        if (Number.isNaN(bIdx)) continue
        bins[Math.min(BINS - 1, Math.max(0, bIdx))].push(i)
      }
    }
  }

  /**
   * 复合与产生。每对"同列的电子–空穴"的复合速率 κ = 1/[τ·max(n̄ + p̄, 2n_i)]，期望复合数 = N·P·κ ≈ n̄p̄κ；
   * 产生数 = n_i²κ（κ 共用，所以平衡时 G = R）。
   *  - 中性区 κ·N_多 = 1/τ，少子寿命正好是 τ；耗尽层中心 G = n_i/(2τ)，与 SRH 中能级复合一致。
   *  - 不用 SRH 原式的 n̄ + p̄ + 2n_i：舞台的 n_i/N 被放大（25 °C 约 0.05，175 °C 约 0.26，真实为 10⁻⁷…10⁻³），
   *    原式会让高温时中性区的少子寿命虚增约 1.5 倍、正向电流反而随温度下降。
   * N、P 是瞬时个数，分母里的 n̄、p̄ 必须是平稳的"局部浓度"（dens）：
   * 若用粒子很少的单柱直方图，耗尽层里它在粒子路过时才升高，κ 恰在能复合时变小、空着时变大，
   * 零偏也会复合偏少、产生偏多（每种 40 个时耗尽层 G/R ≈ 1.5）
   */
  /** κ 分母里局部浓度的下限（每列个数）：取 2n_i 时耗尽层中心的产生正好是 SRH 的 n_i/(2τ) */
  protected get pairFloor() {
    return 2 * this.niBin
  }

  protected pairs(dt: number) {
    const E = this.electrons
    const Hh = this.holes
    const ni = this.niBin
    const floor = this.pairFloor
    for (let b = 0; b < BINS; b++) {
      const kappa = 1 / (this.tau * Math.max(this.dens.n[b] + this.dens.p[b], floor))
      const eb = this.eBins[b]
      const hb = this.hBins[b]
      let nR = poisson(eb.length * hb.length * kappa * dt)
      while (nR-- > 0 && eb.length && hb.length) {
        // 随机挑少的一方的一个，与同列中离它最近的另一方配对（只决定"谁和谁"，不影响速率）
        const eFew = eb.length <= hb.length
        const few = eFew ? eb : hb
        const many = eFew ? hb : eb
        const PF = eFew ? E : Hh
        const PM = eFew ? Hh : E
        const fi = Math.floor(Math.random() * few.length)
        const a = few[fi]
        let mi = 0
        let best = Infinity
        for (let k = 0; k < many.length; k++) {
          const j = many[k]
          const d = (PM.x[j] - PF.x[a]) ** 2 + (PM.y[j] - PF.y[a]) ** 2
          if (d < best) { best = d; mi = k }
        }
        const m = many[mi]
        const ie = eFew ? a : m
        const ih = eFew ? m : a
        this.events.push({
          kind: 'pair', gen: false,
          x: (E.x[ie] + Hh.x[ih]) / 2, y: (E.y[ie] + Hh.y[ih]) / 2,
          eUid: E.uid[ie], hUid: Hh.uid[ih],
        })
        E.kill(ie)
        Hh.kill(ih)
        few[fi] = few[few.length - 1]; few.pop()
        many[mi] = many[many.length - 1]; many.pop()
        this.stats.recomb++
      }
      let nG = poisson(ni * ni * kappa * dt)
      while (nG-- > 0) {
        const x = (b + Math.random()) / BINS
        const y = Math.random() * this.H
        const ie = E.spawn(x, y, gauss() * this.vth, gauss() * this.vth)
        if (ie < 0) break
        const ih = Hh.spawn(x, y, gauss() * this.vth, gauss() * this.vth)
        if (ih < 0) { E.kill(ie); break }
        eb.push(ie)
        hb.push(ih)
        this.events.push({ kind: 'pair', gen: true, x, y, eUid: E.uid[ie], hUid: Hh.uid[ih] })
        this.stats.gen++
      }
    }
  }

  protected substep(dt: number) {
    const B = barrier(this.V, this.formation, this.j)
    const w = this.w
    const vth2 = this.vth * this.vth
    const H = this.H
    const [eL, eR] = this.depletion

    for (let kind = 0 as Kind; kind <= 1; kind = (kind + 1) as Kind) {
      const P = kind === 0 ? this.electrons : this.holes
      const sign = kind === 0 ? 1 : -1 // 电子被势垒推向 N（+x），空穴推向 P（−x）
      // 速度按 Ornstein–Uhlenbeck 过程精确积分：任意 γdt 下速度方差都正好是 v_th²，
      // 电子、空穴阻尼不同也处在同一温度（欧拉法会让阻尼大的一方"偏热"几个百分点，零偏时 np ≠ n_i²）
      const g = kind === 0 ? this.gamma : this.gamma / this.holeD
      const c = Math.exp(-g * dt)
      const sigma = this.vth * Math.sqrt(1 - c * c)
      for (let i = 0; i < P.cap; i++) {
        if (!P.alive[i]) continue
        const x0 = P.x[i]
        this.occNow[kind * 3 + (x0 < eL ? 0 : x0 > eR ? 2 : 1)] += dt
        let x = x0
        let y = P.y[i]
        const ax = this.accel(kind, x, sign, vth2, B, w)
        let vx = ax / g + (P.vx[i] - ax / g) * c + sigma * gauss()
        let vy = P.vy[i] * c + sigma * gauss()
        x += vx * dt
        y += vy * dt
        if (y < 0) { y = -y; vy = -vy }
        if (y > H) { y = 2 * H - y; vy = -vy }
        // 器件内部的"墙"（PN 结没有；PiN 的理想发射极界面有）
        const wx = this.wall(kind, x0, x)
        if (wx !== null) { x = wx; vx = -vx }

        // 欧姆接触：左侧为 P 区接触（阳极 A），右侧为 N 区接触（阴极 K）
        if (x < 0) {
          if (this.keepAtA(kind)) { x = -x; vx = -vx }
          else {
            P.kill(i)
            this.drift(kind, x0, x, eL, eR)
            // 电子从 A 离开 → 电子进入导线；空穴到达 A → 导线送来一个电子把它填掉
            this.contact('A', kind, kind === 0, y, P.uid[i])
            continue
          }
        } else if (x > 1) {
          if (this.keepAtK(kind)) { x = 2 - x; vx = -vx }
          else {
            P.kill(i)
            this.drift(kind, x0, x, eL, eR)
            // 电子从 K 离开 → 进入导线；空穴到达 K → 导线送来一个电子把它填掉
            this.contact('K', kind, kind === 0, y, P.uid[i])
            continue
          }
        }

        this.drift(kind, x0, x, eL, eR)
        P.x[i] = x
        P.y[i] = y
        P.vx[i] = vx
        P.vy[i] = vy
      }
    }

    this.sources(dt, B, w)
  }

  /**
   * 载流子受的力（可视单位的加速度）：sign·v_th²·dU/dx，U 为以 kT 为单位的势能。
   * PN 结：势垒 B 乘耗尽层形状 profile 的斜率
   */
  protected accel(kind: Kind, x: number, sign: number, vth2: number, B: number, w: number) {
    void kind
    return sign * vth2 * B * profile(x, w).df
  }

  /** 从 x0 走到 x 时是否撞上器件内部的墙：撞上时返回反射后的位置，否则 null */
  protected wall(kind: Kind, x0: number, x: number): number | null {
    void kind
    void x0
    void x
    return null
  }

  /** 到达阳极（x < 0）时是否反射回来（否则被电极吸收）：空穴是 P 区多子，个数没超时反射 */
  protected keepAtA(kind: Kind) {
    return kind === 1 && this.holes.count <= this.target
  }

  /** 到达阴极（x > 1）时是否反射回来：电子是 N 区多子，个数没超时反射 */
  protected keepAtK(kind: Kind) {
    return kind === 0 && this.electrons.count <= this.target
  }

  /** 每个子步之后：电极热发射少子、外电路补充多子 */
  protected sources(dt: number, B: number, w: number) {
    const H = this.H
    // 电极向半导体热发射少子：A 端导线送进一个电子；K 端导线抽走一个价电子 = 留下一个空穴
    const emit = this.minorityEmission(B, w) * dt
    for (let n = poisson(emit); n > 0; n--) {
      const y = Math.random() * H
      const i = this.electrons.spawn(0.002, y, Math.abs(gauss()) * this.vth, gauss() * this.vth)
      if (i < 0) break
      this.contact('A', 0, false, y, this.electrons.uid[i])
    }
    for (let n = poisson(emit); n > 0; n--) {
      const y = Math.random() * H
      const i = this.holes.spawn(0.998, y, -Math.abs(gauss()) * this.vth, gauss() * this.vth)
      if (i < 0) break
      this.contact('K', 1, true, y, this.holes.uid[i])
    }

    // 外电路补充多子：A 端导线抽走一个价电子 = 留下一个空穴；K 端导线送进一个电子
    while (this.holes.count < this.target) {
      const y = Math.random() * H
      const i = this.holes.spawn(0.002, y, Math.abs(gauss()) * this.vth, gauss() * this.vth)
      if (i < 0) break
      this.contact('A', 1, true, y, this.holes.uid[i])
    }
    while (this.electrons.count < this.target) {
      const y = Math.random() * H
      const i = this.electrons.spawn(0.998, y, -Math.abs(gauss()) * this.vth, gauss() * this.vth)
      if (i < 0) break
      this.contact('K', 0, false, y, this.electrons.uid[i])
    }
  }

  protected histogram(dt: number) {
    const a = Math.min(1, dt * 2.5)
    for (let b = 0; b < BINS; b++) {
      this.nHist[b] += (this.eBins[b].length - this.nHist[b]) * a
      this.pHist[b] += (this.hBins[b].length - this.pHist[b]) * a
    }
  }

  /** 中性区单个 bin 的多子期望数，用于把直方图归一化成相对浓度 */
  get majorityPerBin() {
    return this.target / (BINS / 2)
  }
}
