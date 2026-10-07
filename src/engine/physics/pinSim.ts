// 示例 PiN 的载流子粒子仿真（第 1 章舞台）：第 0 章 PnSim 的子类，P⁺、N⁻、N⁺ 三个区是同一套粒子。
//
// 运动、复合 / 产生、欧姆接触、外电路事件都沿用 PnSim（欠阻尼朗之万动力学，成对复合与产生），这里只改写：
//  - 几何：P⁺ [0, XA]、N⁻ [XA, XK]、N⁺ [XK, 1]。P⁺、N⁺ 是多子的"海洋"（示例 PiN 各 HEAVY 个），N⁻ 只有 BASE 个电子，
//    密度之比约 150 : 1（真实约 10⁵ : 1，压缩示意）。
//  - 两个界面上的台阶：空穴在 N⁻ 一侧的势能比 P⁺ 高 B_j（kT），电子在 N⁻ 一侧比 N⁺ 高 B_hl。
//    越过台阶的概率是 e^{−B}，所以台阶高度决定了界面两侧的浓度比——这正是 PN 结（和高低结）的势垒。
//    零偏、反偏时空穴台阶取上限（N⁻ 区的平衡空穴只有 N_D 的 10⁻⁸ 量级，舞台上就是 0）；
//    正偏时由反馈调到"N⁻ 区的空穴、电子个数与模型一致"，
//    台阶随电流增大而降低，就是正偏把势垒压低、空穴注入 N⁻。
//  - 理想发射极（PiN 模型的边界条件）：电子穿不过 P⁺N⁻ 结、空穴穿不过 N⁻N⁺ 界面（"墙"）。
//  - N⁻ 区的电场：
//    · 正偏（电导调制）：取 PiN 模型（pin.ts forward）的稳态双极电场 E(x)，按 qE·W/kT 换成舞台单位；
//      扩散长度与 N⁻ 区厚度之比、大注入寿命都按真实值换算，所以粒子的稳态分布就是模型的悬链线分布。
//    · 只算欧姆电阻（假想，没有空穴注入）：均匀电场把 N⁻ 区的电子推向阳极（速度示意）。
//    · 反偏 / 零偏：耗尽层里的电场把电子推向 N⁺、空穴推向 P⁺（速度示意：强场下漂移速度饱和，近似为常数）。
//      耗尽层里热产生的电子–空穴对立刻被分开扫走，就是漏电流（产生速率放大）。
//  - 正偏注入很多时，N⁻ 区的空穴、电子每个粒子代表 weight 个。weight 取到最大电流（90 A）时等离子体最浓处
//    为 P⁺ 海洋的 80 %，并且不随电流变化——这样电流越大，N⁻ 区里的粒子就越多，滑块的效果看得见。
//    N⁻ 区的施主仍画 BASE 个。
//  - 1.1-2 的"普通 PN 结"（plain）：只有 P⁺ 和 N 两区，N 区直接接阴极。N 区可换掺杂 N_D、厚度 W：
//    舞台的长度比例（像素/µm）和每个电子代表的浓度都与示例 PiN 相同，所以 N 区的长度、电子个数都按真实比例，
//    器件短的就画得短（仿真坐标 0…1 对应器件全长，长度单位换算见 span）。
//    反向电压超过击穿电压时进入雪崩（产生速率大增，示意）。
import { poisson } from './particlePool'
import { BINS, PnSim, type DopedRegion, type Kind } from './pnSim'
import { MAT_REF, NA_PLUS, PIN, builtIn, bvParallel, criticalField, forward, munDoped, reverseField } from './pin'

export type PinSimMode = 'eq' | 'reverse' | 'ohmic' | 'forward'

export interface PinSimBias {
  mode: PinSimMode
  /** 反向电压（V，正值） */
  urev: number
  /** 正向电流（A） */
  current: number
}

export const PIN_SIM = {
  /** P⁺N⁻ 结、N⁻N⁺ 界面的位置（舞台宽度为 1） */
  XA: 0.14,
  XK: 0.86,
  /** N⁻ 区原有电子个数（对应 N_D，也是画出的施主离子个数） */
  BASE: 12,
  /** 默认粒子数下 P⁺ 区的空穴个数；示例 PiN 的 N⁺ 区电子也是这么多（N⁺ 区更宽时按同样的密度加多）。
   *  粒子数滑块按比例缩放 P⁺、N⁺、N 区的个数（BASE 也一起缩放），比例关系不变 */
  HEAVY: 360,
  /** 舞台上的大注入寿命（秒）：真实 0.2 µs */
  TAU: 7,
  /** 电子的阻尼（碰撞频率，1/秒）：自由程要比 N⁻ 区里浓度变化的尺度小，粒子分布才符合漂移–扩散模型 */
  GAMMA: 14,
  /** 滑块最大电流（90 A）时，等离子体最浓处是重掺杂海洋密度的这个比例 */
  PLASMA: 0.8,
  /** 滑块最大电流 */
  I_MAX: 90,
  /** 界面台阶的过渡宽度 */
  RAMP: 0.024,
  /** 台阶的上限（kT）：e^{−14} ≈ 10⁻⁶，相当于完全挡住 */
  BMAX: 14,
  /** 耗尽层电场把载流子扫走的速度（舞台宽度/秒，示意） */
  VDEP: 0.9,
  /** 耗尽层热产生速率（对/秒，耗尽层占满整个 N⁻ 区时；示意放大） */
  GEN: 0.8,
  /** 只算欧姆电阻时，示例 PiN 通过 30 A 时的电子漂移速度（舞台宽度/秒，示意；其他掺杂按 J/(qn) 换算） */
  VOHM: 0.12,
  /** 雪崩击穿时的产生速率（对/秒，示意） */
  AVAL: 30,
}

/** N 区的掺杂与厚度（cm），默认是示例 PiN 的 N⁻ 区 */
export interface PinGeometry {
  ND: number
  W: number
}

/** 电场箭头的长度参照：示例 PiN 的临界场强（两种掺杂对比时用同一把尺） */
const E_REF = criticalField(PIN.ND)

/** 台阶反馈的比例、积分增益 */
const KP = 3
const KI = 0.5
/** 建立等离子体时，P⁺N⁻ 结的台阶最多可以降到 −BJ_PUSH（kT） */
const BJ_PUSH = 4
/** 模型剖面的采样点数 */
const NS = 241
const { XA, HEAVY, RAMP, BMAX } = PIN_SIM
/** 示例 PiN 的 N⁻ 区在舞台上的宽度 */
const WN0 = PIN_SIM.XK - XA

/** 各区载流子个数 */
export interface PinCensus {
  /** P⁺ 区空穴、N⁻ 区空穴、N⁻ 区电子、N⁺ 区电子 */
  hP: number
  hN: number
  eN: number
  eK: number
}

export class PinSim extends PnSim {
  bias: PinSimBias = { mode: 'eq', urev: 0, current: 30 }
  /** N 区的掺杂与厚度、击穿电压 */
  readonly geo: PinGeometry
  readonly bv: number
  /** 普通 PN 结（没有 N⁺，N 区直接接阴极） */
  readonly plain: boolean
  /** 器件全长相对示例 PiN 舞台全长的比例（PiN 为 1）：仿真坐标按器件全长归一，舞台上的长度量都要除以它 */
  readonly span: number
  /** P⁺N 结、N 区右端的位置与 N 区宽度（仿真坐标） */
  readonly xa: number
  readonly xk: number
  readonly wn: number
  /** 界面台阶的过渡宽度、耗尽层扫走载流子的速度（仿真坐标） */
  private readonly ramp: number
  private readonly vdep: number
  /** 反向电压已超过击穿电压（雪崩） */
  broken = false
  /** 正偏时 N⁻ 区每个粒子代表几个（等离子体按比例画稀；不随电流变化） */
  weight = 1
  /** 电流刚变化后的一小段时间（秒）里，N⁻ 区的等离子体直接按比例增减，跟上滑块 */
  private fast = 0
  /** 正偏模型的 p(x)/N_D 的累积分布（采样新粒子的位置） */
  private cdf = new Float64Array(NS)
  /** 各区载流子个数（每个子步开头更新） */
  census: PinCensus = { hP: 0, hN: 0, eN: 0, eK: 0 }

  /** 正偏时 N⁻ 区的电场（qE/kT，单位 1/舞台宽度）与模型的 p/N_D，均按 ξ ∈ [0,1] 等距采样 */
  private phi = new Float64Array(NS)
  private prof = new Float64Array(NS)
  /** 耗尽层伸入 N⁻ 区的比例与峰值电场（V/cm），反偏 / 零偏时有效 */
  private wXi = 0
  private field = reverseField(builtIn())
  /** N⁻ 区空穴个数的目标（正偏） */
  private holeTarget = 0
  /** 两个台阶的前馈值与积分修正（kT） */
  private bjFF = 0
  private bhlFF = 0
  private bjI = 0
  private bhlI = 0
  /** 比例修正（kT）：个数偏离目标的相对值 × KP */
  private bjP = 0
  private bhlP = 0
  /** 只算欧姆电阻：本步向左越过结的电子数（净）、平滑后的过结电子流（个/秒）、台阶的积分修正 */
  private crossed = 0
  private crossFlux = 0
  private ohmI = 0
  /** 反偏刚加上时 N⁻ 区多出电中性所需的电子比例（存储电荷还没抽完） */
  private excess = 0
  private ready = false

  /** perType：P⁺ 区的空穴个数（粒子数滑块；其余各区按比例）；plain：普通 PN 结 */
  constructor(geo: PinGeometry = { ND: PIN.ND, W: PIN.W }, perType = HEAVY, plain = false, H = 0.5) {
    super(perType, H)
    this.geo = geo
    this.plain = plain
    this.bv = bvParallel(geo.ND)
    const wn = (WN0 * geo.W) / PIN.W
    this.span = plain ? XA + wn : 1
    this.xa = XA / this.span
    this.wn = wn / this.span
    this.xk = this.xa + this.wn
    this.ramp = RAMP / this.span
    this.vdep = PIN_SIM.VDEP / this.span
    this.ready = true
    // 双极扩散长度与 N⁻ 区厚度之比取真实值：L_a/W = √(D_a τ)/W；PnSim 的成对复合在 n ≈ p 时寿命为 2τ
    const la = ((forward(100).La / PIN.W) * WN0) / this.span
    const b = MAT_REF.b
    const Dn = ((la * la) / PIN_SIM.TAU) * ((b + 1) / 2)
    this.holeD = 1 / b
    this.tau = PIN_SIM.TAU / 2
    this.gamma = PIN_SIM.GAMMA
    this.vth = Math.sqrt(Dn * this.gamma)
    this.calibrate()
    this.setBias(this.bias)
    this.reset()
  }

  /** 换偏置：粒子不重置，几秒内自行过渡（正偏时空穴注入、等离子体建立；反偏时存储电荷被扫出） */
  setBias(b: PinSimBias) {
    const modeChanged = b.mode !== this.bias.mode
    const currentChanged = b.mode === 'forward' && !modeChanged && b.current !== this.bias.current
    this.bias = { ...b }
    const { ND, W } = this.geo
    this.broken = false
    if (b.mode === 'forward') {
      const st = forward(Math.max(0.01, b.current) / PIN.A, { n: NS, ND, W })
      const k = W / MAT_REF.UT / this.wn
      for (let i = 0; i < NS; i++) {
        this.phi[i] = st.E[i] * k
        this.prof[i] = st.p[i] / ND
      }
      let mean = 0
      for (const v of this.prof) mean += v / NS
      // weight 按最大电流定，不随当前电流变化
      const top = forward(PIN_SIM.I_MAX / PIN.A, { n: 3, ND, W })
      this.weight = Math.max(1, (top.p[0] / ND * this.rhoND) / (PIN_SIM.PLASMA * this.rhoP))
      this.holeTarget = (this.base * mean) / this.weight
      for (let i = 1; i < NS; i++) this.cdf[i] = this.cdf[i - 1] + (this.prof[i - 1] + this.prof[i]) / 2
      if (currentChanged) this.fast = 2
      this.bjFF = Math.log(this.rhoP / ((this.prof[0] * this.rhoND) / this.weight))
      this.bhlFF = Math.log(this.rhoP / ((this.prof[NS - 1] / this.weight + 1) * this.rhoND))
      this.wXi = 0
    } else {
      this.weight = 1
      this.holeTarget = 0
      // 零偏只有内建电势撑起的一薄层耗尽区；只算欧姆电阻的假想情形不画耗尽层；超过击穿电压时电场停在临界值
      this.broken = b.mode === 'reverse' && b.urev >= this.bv
      const U = b.mode === 'reverse' ? Math.min(b.urev, this.bv) + builtIn() : b.mode === 'eq' ? builtIn() : 0
      this.field = reverseField(U, ND, W)
      this.wXi = b.mode === 'ohmic' ? 0 : Math.min(1, this.field.w / W)
      this.bjFF = BMAX
      this.bhlFF = Math.log(this.rhoP / this.rhoND)
    }
    // 换了偏置方式时台阶从前馈值重新开始；同一方式下拖动滑块保留积分修正，过渡更平稳
    if (modeChanged) {
      this.bjI = this.bjP = 0
      this.bhlI = this.bhlP = 0
      this.ohmI = 0
      this.crossFlux = this.flux
    }
  }

  // ───────────── 各区的粒子个数（随粒子数滑块缩放） ─────────────

  /** P⁺ 区多子的线密度（个/舞台宽度），N⁺ 区相同 */
  private get rhoP() {
    return this.target / this.xa
  }

  /** N⁺ 区的电子个数（普通 PN 结没有 N⁺） */
  private get heavyK() {
    return Math.max(0, Math.round(this.rhoP * (1 - this.xk)))
  }

  /** N 区原有电子（= 施主）的个数：示例 PiN 默认 BASE 个，其他掺杂按 N_D × 厚度换算 */
  get base() {
    return (PIN_SIM.BASE * (this.target / HEAVY) * this.geo.ND * this.geo.W) / (PIN.ND * PIN.W)
  }

  private get rhoND() {
    return this.base / this.wn
  }

  /** 换粒子数：各区按比例重新布置 */
  setCount(perType: number) {
    if (perType === this.target) return
    this.target = perType
    this.setBias(this.bias)
    this.reset()
  }

  /**
   * 正偏时阳极一端的等离子体浓度与 P⁺ 的浓度之比：舞台上画的（粒子线密度之比）与真实的（p/N_A⁺）。
   * 舞台压缩了 P⁺、N⁻ 的浓度比，这个比被放大了几十倍，读数里要写明
   */
  get plasmaRatio(): { stage: number; real: number } | null {
    if (this.bias.mode !== 'forward') return null
    const p0 = this.prof[0]
    return { stage: (p0 * this.rhoND) / this.weight / this.rhoP, real: (p0 * this.geo.ND) / NA_PLUS }
  }

  /** 空穴、电子台阶的当前高度（kT）；暂时为负表示把空穴"推"进 N⁻（等离子体建立得更快） */
  get bj() {
    return Math.min(BMAX, Math.max(-BJ_PUSH, this.bjFF + this.bjP + this.bjI))
  }

  get bhl() {
    return Math.max(0, this.bhlFF + this.bhlP + this.bhlI)
  }

  /** 耗尽层裸露的施主个数（P⁺ 一侧有同样多的受主裸露） */
  get exposed() {
    return this.base * this.wXi
  }

  /** P⁺ 区空穴的目标个数、N⁻ 区电子的目标个数（电中性） */
  private get targetP() {
    // 取整：否则个数在目标上下来回，阳极上不停地一进一出
    return Math.round(this.target - this.exposed)
  }

  private get targetEN() {
    return this.base - this.exposed + this.census.hN
  }

  // ───────────── 几何 ─────────────

  get regions(): DopedRegion[] {
    return [
      { x0: 0, x1: this.xa, kind: 'p', level: 4 },
      { x0: this.xa, x1: this.xk, kind: 'n', level: this.geo.ND / PIN.ND / 16, ions: Math.round(this.base) },
      { x0: this.xk, x1: 1, kind: 'n', level: 4 },
    ].filter((r) => r.x1 - r.x0 > 1e-6) as DopedRegion[]
  }

  get depletion(): [number, number] {
    if (this.wXi <= 0) return [this.xa, this.xa]
    // P⁺ 一侧裸露同样多的受主：按 P⁺ 的密度只有很薄一层
    return [this.xa - this.exposed / this.rhoP, this.xa + this.wXi * this.wn]
  }

  get w() {
    const [l, r] = this.depletion
    return r - l
  }

  get biasSign() {
    const m = this.bias.mode
    return m === 'forward' || m === 'ohmic' ? 1 : m === 'reverse' ? -1 : 0
  }

  get fieldSpan(): [number, number] {
    return this.bias.mode === 'ohmic' ? [this.xa, this.xk] : this.depletion
  }

  /**
   * 反偏 / 零偏：E 除以示例 PiN 的临界场强（负值指向 −x，由 N 指向 P⁺），不同掺杂用同一把尺。
   * 只算欧姆电阻：均匀的场 E = J/(qμN_D)，示例 PiN 画中等长度，其他掺杂按比例
   */
  fieldRel(x: number) {
    if (this.bias.mode === 'ohmic') return x > this.xa && x < this.xk ? 0.6 * this.ohmicRatio * (this.bias.current / 30) : 0
    return -this.depField(x) / E_REF
  }

  /** 同样电流密度下，本 N 区的欧姆电场与示例 PiN 之比 = (μN_D)₀/(μN_D) */
  private get ohmicRatio() {
    const { ND } = this.geo
    return (munDoped(PIN.ND) * PIN.ND) / (munDoped(ND) * ND)
  }

  /** 耗尽层里的电场大小（V/cm） */
  private depField(x: number) {
    const [dl, dr] = this.depletion
    const f = this.field
    if (x <= dl || x >= dr) return 0
    if (x < this.xa) return (f.E1 * (x - dl)) / (this.xa - dl)
    return f.E1 - f.slope * ((x - this.xa) / this.wn) * this.geo.W
  }

  get drawTarget() {
    // 粒子半径按密度定：与第 0 章（900 个铺满半个舞台）相比的密度。
    // 渲染器的半径 ∝ 器件像素宽 × (900/drawTarget)^0.4，器件画短了（span < 1）要按 span^2.5 补回，半径才与 PiN 舞台一样
    return ((900 * this.target) / XA / 1800) * this.span ** 2.5
  }

  get majorityPerBin() {
    return this.rhoP / BINS
  }

  // ───────────── 初始布置与 n_i ─────────────

  protected get capacity() {
    // P⁺ 与最宽的 N⁺，加上等离子体（最多约 1500 个，按粒子数缩放）。构造时 xa 还没算出，按示例 PiN 的比例取
    return Math.round(this.target / XA + (1600 * this.target) / HEAVY)
  }

  protected populate() {
    if (!this.ready) return
    const [dl, dr] = this.depletion
    for (let i = 0; i < this.targetP; i++) this.spawnAt(1, Math.random() * dl)
    for (let i = 0; i < this.heavyK; i++) this.spawnAt(0, this.xk + Math.random() * (1 - this.xk))
    for (let i = 0; i < Math.round(this.base - this.exposed); i++) this.spawnAt(0, dr + Math.random() * (this.xk - dr))
  }

  /** 按模型分布取一个位置（u ∈ [0,1)） */
  private samplePlasma(u: number) {
    const { cdf } = this
    const t = u * cdf[NS - 1]
    let i = 1
    while (i < NS - 1 && cdf[i] < t) i++
    const f = (t - cdf[i - 1]) / Math.max(1e-12, cdf[i] - cdf[i - 1])
    return this.xa + ((i - 1 + f) / (NS - 1)) * this.wn
  }

  /** 按比例增减 N⁻ 区的等离子体（电子、空穴成对，电中性不变，外电路不动）：fraction 为缺口补上的比例 */
  private adjustPlasma(fraction: number) {
    const gap = this.holeTarget - this.census.hN
    let n = Math.round(Math.abs(gap) * fraction)
    if (gap > 0) {
      for (; n > 0; n--) {
        const x = this.samplePlasma(Math.random())
        const ie = this.spawnAt(0, x)
        if (ie < 0) break
        const ih = this.spawnAt(1, x)
        if (ih < 0) { this.electrons.kill(ie); break }
      }
      return
    }
    const E = this.electrons
    const Hh = this.holes
    const inN = (P: typeof E, i: number) => P.alive[i] && P.x[i] > this.xa && P.x[i] < this.xk
    for (let tries = 0; n > 0 && tries < 4000; tries++) {
      const ih = Math.floor(Math.random() * Hh.cap)
      const ie = Math.floor(Math.random() * E.cap)
      if (!inN(Hh, ih) || !inN(E, ie)) continue
      Hh.kill(ih)
      E.kill(ie)
      n--
    }
  }

  /**
   * 平衡少子几乎为零（N⁻ 区 n_i²/N_D 只有 N_D 的 10⁻⁸ 量级），PnSim.pairs 的热产生取得很小；
   * 反偏时耗尽层里的热产生另在 sources 里按 GEN 放大示意
   */
  protected calibrate() {
    this.niBin = 1e-3
  }

  /**
   * κ 分母的下限：n_i 取得很小，若按 2n_i 算，耗尽层里刚产生的一对会立刻复合。
   * 取每列 0.3 个：一对在被电场分开、离开这一列之前复合的概率约 2 %；正偏时各列远多于此，不受影响
   */
  protected get pairFloor() {
    return 0.3
  }

  // ───────────── 每步 ─────────────

  step(dtTotal: number) {
    const dt = Math.min(dtTotal, 1 / 20)
    this.count()
    const c = this.census
    // 台阶的比例–积分修正：个数多了就加高台阶
    const eT = this.targetEN
    const errH = this.bias.mode === 'forward' ? (c.hN - this.holeTarget) / Math.max(3, this.holeTarget) : 0
    const errE = (c.eN - eT) / Math.max(3, eT)
    this.bjP = KP * errH
    this.bhlP = KP * errE
    this.bjI = Math.max(-3, Math.min(3, this.bjI + KI * dt * errH))
    this.bhlI = Math.max(-3, Math.min(3, this.bhlI + KI * dt * errE))
    this.excess = c.eN > 0 && this.bias.mode === 'reverse' ? Math.max(0, c.eN - eT) / c.eN : 0
    if (this.fast > 0 && this.bias.mode === 'forward') {
      this.fast -= dt
      this.adjustPlasma(Math.min(1, dt * 4))
    }
    super.step(dtTotal)
    if (this.bias.mode === 'ohmic') {
      // 过结电子流按 3 s 平滑；比漂移流多就加高台阶
      this.crossFlux += (this.crossed / dt - this.crossFlux) * (dt / 3)
      this.ohmI = Math.max(-3, Math.min(4, this.ohmI + (0.4 * dt * (this.crossFlux - this.flux)) / this.flux))
    }
    this.crossed = 0
  }

  protected substep(dt: number) {
    this.count()
    super.substep(dt)
  }

  private count() {
    const c = this.census
    c.hP = c.hN = c.eN = c.eK = 0
    const E = this.electrons
    const Hh = this.holes
    for (let i = 0; i < Hh.cap; i++) {
      if (!Hh.alive[i]) continue
      if (Hh.x[i] < this.xa) c.hP++
      else if (Hh.x[i] < this.xk) c.hN++
    }
    for (let i = 0; i < E.cap; i++) {
      if (!E.alive[i]) continue
      if (E.x[i] > this.xk) c.eK++
      else if (E.x[i] >= this.xa) c.eN++
    }
  }

  /** 舞台单位的加速度：终端速度 = 加速度 / 阻尼 */
  protected accel(kind: Kind, x: number) {
    const vth2 = this.vth * this.vth
    const g = kind === 0 ? this.gamma : this.gamma / this.holeD
    const sign = kind === 0 ? 1 : -1
    let a = 0
    // 界面台阶：空穴在 N⁻ 一侧势能高 B_j，被推回 P⁺；电子在 N⁻ 一侧势能高 B_hl，被推向 N⁺
    if (kind === 1 && x > this.xa - this.ramp && x < this.xa) a -= (vth2 * this.bj) / this.ramp
    if (kind === 0 && x > this.xk && x < this.xk + this.ramp) a += (vth2 * this.bhl) / this.ramp
    const m = this.bias.mode
    // 只算欧姆电阻：电子越过 P⁺N 结进入 P⁺ 也要爬一级台阶，否则 P⁺ 像个"漏斗"，靠扩散吸走的电子比漂移送来的还多
    if (m === 'ohmic' && kind === 0 && x > this.xa - this.ramp && x < this.xa) a += (vth2 * this.bjOhm) / this.ramp
    // 重掺杂区：多子在微弱的电场下整体漂移，把电流送到界面（P⁺ 的空穴向右、N⁺ 的电子向左）。
    // 只靠扩散送不够：多子海洋要有比自身密度还大的浓度差才行
    if (kind === 1 && x < this.xa - this.ramp) a += g * (this.flux / this.rhoP)
    if (kind === 0 && x > this.xk + this.ramp) a -= g * (this.flux / this.rhoP)
    if (m === 'forward') {
      if (x > this.xa && x < this.xk) {
        const f = ((x - this.xa) / this.wn) * (NS - 1)
        const i = Math.min(NS - 2, Math.floor(f))
        // 电场为正指向 +x：空穴顺着走，电子逆着走
        a -= sign * vth2 * (this.phi[i] + (this.phi[i + 1] - this.phi[i]) * (f - i))
      }
    } else if (m === 'ohmic') {
      if (kind === 0 && x > this.xa && x < this.xk) a -= g * this.vOhm
    } else {
      const [dl, dr] = this.depletion
      const E1 = this.field.E1
      // 耗尽层：电子推向 N⁺、空穴推向 P⁺，结处最快（速度示意）
      if (x > dl && x < dr && E1 > 0) a += sign * g * this.vdep * (0.15 + 0.85 * (this.depField(x) / E1))
      // 中性区：存储电荷还没抽完时，抽取它的反向电流也流过这里
      else if (x >= dr && x < this.xk) a += sign * g * this.vdep * 0.5 * this.excess
    }
    return a
  }

  /**
   * 只算欧姆电阻时电子进入 P⁺ 的台阶：P⁺ 一侧是"吸收壁"（电子很快复合），越过台阶的流量约为
   * n·e^{−B}·v_th/√(2π)。前馈取 B 使它等于漂移送来的 n·v，再按实测的过结电子流做积分修正
   */
  private get bjOhm() {
    const ff = Math.log(this.vth / (Math.sqrt(2 * Math.PI) * this.vOhm))
    return Math.max(0, ff + this.ohmI)
  }

  /** 只算欧姆电阻时电子的漂移速度：v = J/(qn)，电子越少跑得越快（示例 PiN 30 A 时为 VOHM，示意） */
  private get vOhm() {
    return (PIN_SIM.VOHM * (this.bias.current / 30) * (PIN.ND / this.geo.ND)) / this.span
  }

  /** 流过器件的粒子流（个/秒）：正偏时等于 N⁻ 区的复合速率，只算欧姆电阻时等于电子的漂移流 */
  private get flux() {
    const m = this.bias.mode
    if (m === 'forward') return this.holeTarget / PIN_SIM.TAU
    if (m === 'ohmic') return this.rhoND * this.vOhm
    return 0
  }

  /** 理想发射极：空穴穿不过 N⁻N⁺ 界面；电子穿不过 P⁺N⁻ 结（只算欧姆电阻的假想情形除外） */
  protected wall(kind: Kind, x0: number, x: number) {
    if (kind === 0 && x0 >= this.xa !== x >= this.xa) this.crossed += x < this.xa ? 1 : -1
    if (kind === 1 && x0 < this.xk !== x < this.xk) return 2 * this.xk - x
    if (kind === 0 && this.bias.mode !== 'ohmic' && x0 < this.xa !== x < this.xa) return 2 * this.xa - x
    return null
  }

  protected keepAtA(kind: Kind) {
    return kind === 1 && this.census.hP <= this.targetP
  }

  /** 阴极：N⁺ 区的电子没超过个数时反射；普通 PN 结没有 N⁺，N 区的电子不超过电中性所需时反射 */
  protected keepAtK(kind: Kind) {
    if (kind !== 0) return false
    return this.plain ? this.census.eN <= Math.round(this.targetEN) : this.census.eK <= this.heavyK
  }

  /** 外电路补足两端的多子：A 端导线抽走价电子 = 留下一个空穴；K 端导线送进一个电子（重掺杂区的少子发射可忽略） */
  protected sources(dt: number) {
    // 反偏：耗尽层里热产生电子–空穴对（零偏时产生与复合相抵，不画）。
    // 雪崩时碰撞电离大量产生，集中在电场最强的结附近（示意）
    if (this.bias.mode === 'reverse') {
      const [, dr] = this.depletion
      const rate = this.broken ? PIN_SIM.AVAL : PIN_SIM.GEN * this.wXi * (this.geo.W / PIN.W)
      for (let n = poisson(rate * dt); n > 0; n--) {
        const u = Math.random()
        const x = this.xa + (this.broken ? u * u * u : u) * (dr - this.xa)
        const ie = this.spawnAt(0, x)
        if (ie < 0) break
        const ih = this.spawnAt(1, x)
        if (ih < 0) { this.electrons.kill(ie); break }
        const y = (this.holes.y[ih] = this.electrons.y[ie])
        this.events.push({ kind: 'pair', gen: true, x, y, eUid: this.electrons.uid[ie], hUid: this.holes.uid[ih] })
        this.stats.gen++
      }
    }
    this.count()
    const c = this.census
    for (; c.hP < this.targetP; c.hP++) {
      const i = this.spawnAt(1, 0.002)
      if (i < 0) break
      this.holes.vx[i] = Math.abs(this.holes.vx[i])
      this.contact('A', 1, true, this.holes.y[i], this.holes.uid[i])
    }
    // 阴极送进电子：补满 N⁺ 区；普通 PN 结直接补 N 区到电中性
    const short = () => (this.plain ? c.eN < Math.round(this.targetEN) : c.eK < this.heavyK)
    for (; short(); this.plain ? c.eN++ : c.eK++) {
      const i = this.spawnAt(0, 0.998)
      if (i < 0) break
      this.electrons.vx[i] = -Math.abs(this.electrons.vx[i])
      this.contact('K', 0, false, this.electrons.y[i], this.electrons.uid[i])
    }
  }

  /** N⁻ 区空穴沿 ξ 的直方图：每列个数 × weight / 每列对应 N_D 的个数 = p/N_D */
  holeProfile(bins: number, out = new Float64Array(bins)) {
    out.fill(0)
    const Hh = this.holes
    for (let i = 0; i < Hh.cap; i++) {
      if (!Hh.alive[i] || Hh.x[i] < this.xa || Hh.x[i] >= this.xk) continue
      out[Math.min(bins - 1, Math.floor(((Hh.x[i] - this.xa) / this.wn) * bins))] += 1
    }
    for (let k = 0; k < bins; k++) out[k] = (out[k] * this.weight) / (this.base / bins)
    return out
  }
}
