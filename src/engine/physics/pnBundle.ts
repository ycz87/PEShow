// 并联细柱：屏幕上画的只是器件里的一根细柱（从 A 到 K），整个器件是许多根这样的细柱并联。
//
// 载流子之间没有相互作用、电场按耗尽近似给定，所以各根细柱彼此独立，
// K 根细柱一起平均就等价于一根截面大 K 倍的细柱。屏幕显示第 0 根，其余在后台运行，
// 统计量（局部浓度、各区平均定向速度、电流）都取全体，因而与屏幕上画多少粒子无关。
// 唯一的耦合是复合速率里的局部浓度 n̄、p̄ 取全体平均，这本来就是"该截面处的浓度"。

import { BINS, PnSim, type Kind, type Zone } from './pnSim'

/** 全体细柱合计的每种载流子个数（约数）：统计量都按这个规模给出 */
export const BUNDLE_TOTAL = 900

export class PnBundle {
  cols: PnSim[] = []
  /** 全体平均的浓度直方图（每根细柱每列的个数），同时作为各柱复合速率里的 n̄、p̄ */
  readonly nHist = new Float32Array(BINS)
  readonly pHist = new Float32Array(BINS)

  /**
   * make：细柱的构造（第 1 章换成器件子类）；total：全体合计的规模，null 表示只有屏幕上的一根
   */
  constructor(
    perType: number,
    private make: (perType: number) => PnSim = (n) => new PnSim(n),
    private total: number | null = BUNDLE_TOTAL,
  ) {
    this.build(perType)
  }

  /** 屏幕上显示的那一根。外加电压、结的形成进度、结温都设在它上面，其余细柱每步跟随 */
  get view() {
    return this.cols[0]
  }

  private build(perType: number) {
    const view = this.cols[0] ?? this.make(perType)
    view.setCount(perType)
    const K = this.total === null ? 1 : Math.max(1, Math.round(this.total / perType))
    // 后台细柱的高度不影响统计（浓度、发射率都按个数归一），用默认值即可
    this.cols = [view, ...Array.from({ length: K - 1 }, () => this.make(perType))]
    for (const c of this.cols) c.dens = { n: this.nHist, p: this.pHist }
    this.follow()
    for (const c of this.cols.slice(1)) c.reset()
    this.pool()
  }

  setCount(perType: number) {
    if (perType !== this.view.target) this.build(perType)
  }

  reset() {
    this.follow()
    for (const c of this.cols) c.reset()
    this.pool()
  }

  step(dt: number) {
    this.follow()
    for (const c of this.cols) c.step(dt)
    // 后台细柱的事件没人看
    for (const c of this.cols.slice(1)) c.events.length = 0
    this.pool()
  }

  /** 全体平均的阳极电流，折算成 total 个载流子的规模（个/秒）：读数不随屏幕粒子数变化。只有一根时就是它自己的 */
  get current() {
    let s = 0
    for (const c of this.cols) s += c.current
    return this.total === null ? s : (s * this.total) / (this.cols.length * this.view.target)
  }

  /** 某区某类载流子的平均 x 速度：全体的位移总和 / 全体的"粒子·秒"总和 */
  meanVx(kind: Kind, zone: Zone) {
    let f = 0
    let n = 0
    for (const c of this.cols) {
      const m = c.meanCount(kind, zone)
      f += c.meanVx(kind, zone) * m
      n += m
    }
    return n > 1e-9 ? f / n : 0
  }

  /** 全体细柱里该区该类载流子的平均个数（合计） */
  meanCount(kind: Kind, zone: Zone) {
    let n = 0
    for (const c of this.cols) n += c.meanCount(kind, zone)
    return n
  }

  get majorityPerBin() {
    return this.view.majorityPerBin
  }

  private follow() {
    const { V, formation, j } = this.view
    for (const c of this.cols) {
      c.V = V
      c.formation = formation
      c.setJunction(j)
    }
  }

  private pool() {
    const K = this.cols.length
    for (let b = 0; b < BINS; b++) {
      let n = 0
      let p = 0
      for (const c of this.cols) {
        n += c.nHist[b]
        p += c.pHist[b]
      }
      this.nHist[b] = n / K
      this.pHist[b] = p / K
    }
  }
}
