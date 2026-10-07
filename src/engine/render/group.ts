// 电子群标记：在 N 区靠近结处标记一群电子，画出它们的重心（带短轨迹）和分布范围（按位置协方差画 1σ 椭圆）。
// 被标记的电子复合或离开器件后不补充
import type { Graphics } from 'pixi.js'
import type { StageCtx } from './stage'

const SIZE = 20
/** 重心轨迹保留的时长（可视秒） */
const TRAIL_T = 3

export class ElectronGroup {
  /** 是否处于标记状态（人全走光了也保持，等用户重新标记） */
  marked = false
  private uids: number[] = []
  /** 当前每个成员的位置（仿真坐标），每帧更新 */
  private xs: number[] = []
  private ys: number[] = []
  /** 重心轨迹：x, y, t 三个一组 */
  private trail: number[] = []

  constructor(private ctx: StageCtx) {}

  get count() {
    return this.uids.length
  }

  /** 在 N 区紧挨耗尽层的一条带里随机标记约 20 个电子；那里人不够就把带子加宽 */
  mark() {
    const sim = this.ctx.sim
    const E = sim.electrons
    const edge = 0.5 + sim.w / 2
    let cand: number[] = []
    for (const band of [0.06, 0.12, 0.25]) {
      cand = []
      for (let i = 0; i < E.cap; i++) if (E.alive[i] && E.x[i] > edge && E.x[i] < edge + band) cand.push(i)
      if (cand.length >= SIZE) break
    }
    for (let k = cand.length - 1; k > 0; k--) {
      const j = Math.floor(Math.random() * (k + 1))
      ;[cand[k], cand[j]] = [cand[j], cand[k]]
    }
    this.uids = cand.slice(0, SIZE).map((i) => E.uid[i])
    this.trail.length = 0
    this.marked = true
    this.update()
  }

  clear() {
    this.marked = false
    this.uids.length = 0
    this.xs.length = 0
    this.ys.length = 0
    this.trail.length = 0
  }

  /** 舞台高宽比改变时，轨迹点随粒子一起按比例缩放 */
  scaleY(k: number) {
    for (let i = 1; i < this.trail.length; i += 3) this.trail[i] *= k
  }

  /** 每帧：找到还在的成员，去掉已复合或离开的，记录重心轨迹 */
  update() {
    if (!this.marked) return
    const sim = this.ctx.sim
    const E = sim.electrons
    const alive: number[] = []
    this.xs.length = 0
    this.ys.length = 0
    for (const uid of this.uids) {
      const i = E.find(uid)
      if (i < 0) continue
      alive.push(uid)
      this.xs.push(E.x[i])
      this.ys.push(E.y[i])
    }
    this.uids = alive
    const n = alive.length
    if (!n) return
    const mx = this.xs.reduce((a, b) => a + b, 0) / n
    const my = this.ys.reduce((a, b) => a + b, 0) / n
    const tr = this.trail
    const last = tr.length - 3
    if (last < 0 || (mx - tr[last]) ** 2 + (my - tr[last + 1]) ** 2 > 1e-6) tr.push(mx, my, sim.t)
    while (tr.length > 3 && sim.t - tr[2] > TRAIL_T) tr.splice(0, 3)
  }

  /** x、y 都以器件宽度为单位，画到屏幕上是等比例的，协方差可以直接换算成像素 */
  draw(g: Graphics) {
    const n = this.xs.length
    if (!this.marked || !n) return
    const { ctx } = this
    const c = ctx.c
    const s = ctx.L.devW
    const xs = this.xs.map((x) => ctx.X(x))
    const ys = this.ys.map((y) => ctx.Y(y))
    const mx = xs.reduce((a, b) => a + b, 0) / n
    const my = ys.reduce((a, b) => a + b, 0) / n
    // 分布范围：协方差矩阵的特征值是椭圆两个半轴的平方
    if (n >= 3) {
      let sxx = 0
      let syy = 0
      let sxy = 0
      for (let k = 0; k < n; k++) {
        const dx = xs[k] - mx
        const dy = ys[k] - my
        sxx += dx * dx
        syy += dy * dy
        sxy += dx * dy
      }
      sxx /= n
      syy /= n
      sxy /= n
      const m = (sxx + syy) / 2
      const d = Math.sqrt(((sxx - syy) / 2) ** 2 + sxy * sxy)
      const a = Math.sqrt(m + d)
      const b = Math.sqrt(Math.max(0, m - d))
      const th = 0.5 * Math.atan2(2 * sxy, sxx - syy)
      const pts: number[] = []
      for (let k = 0; k < 48; k++) {
        const u = (k / 48) * 2 * Math.PI
        const ex = a * Math.cos(u)
        const ey = b * Math.sin(u)
        pts.push(mx + ex * Math.cos(th) - ey * Math.sin(th), my + ex * Math.sin(th) + ey * Math.cos(th))
      }
      g.poly(pts).fill({ color: c.e, alpha: 0.12 }).stroke({ width: 2, color: c.e, alpha: 0.7 })
    }
    // 每个成员套一个小圈，看得出是"这一群"
    for (let k = 0; k < n; k++) g.circle(xs[k], ys[k], Math.max(6, s * 0.009)).stroke({ width: 1.5, color: c.ink, alpha: 0.55 })
    // 重心的短轨迹：越早越淡
    const tr = this.trail
    for (let k = 3; k < tr.length; k += 3) {
      g.moveTo(ctx.X(tr[k - 3]), ctx.Y(tr[k - 2])).lineTo(ctx.X(tr[k]), ctx.Y(tr[k + 1]))
      g.stroke({ width: 3, color: c.ink, alpha: 0.15 + 0.6 * (k / tr.length), cap: 'round' })
    }
    g.circle(mx, my, 6.5).fill({ color: c.ink }).stroke({ width: 2.5, color: c.e })
  }
}
