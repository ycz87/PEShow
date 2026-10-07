// 演示"一个电子走一圈"：预先编排的示意动画，不是仿真算出来的。
// N 区自由电子 → 翻过坡进入 P 区（少子）→ 扩散 → 与空穴复合，成为价电子 → 空穴每从身边经过一次，它就向 A 挪一个座位
// → 从 A 端进入导线、经过电源 → 从 K 端回到 N 区。真实情况与此不同（讲解见 LapPanel），这里只示意路线
import type { Graphics } from 'pixi.js'
import type { StageCtx } from './stage'

type Pt = [number, number]

/** 讲解面板里的路段：0 N 区 … 6 回到 N 区；7 = 一圈完成 */
export const LAP_LEGS = 7

export interface LapInfo {
  leg: number
  /** 这一段正在快进（座位挪动的后半段、导线） */
  fast: boolean
  done: boolean
}

interface Phase {
  leg: number
  dur: number
  fast?: boolean
  /** u ∈ [0,1] 时电子的像素位置 */
  at(u: number): Pt
  /** 被编排出来的空穴（像素位置与不透明度） */
  hole?(u: number): { p: Pt; a: number } | null
  /** 电子坐在座位上（价电子） */
  seat?: boolean
}

/** 座位间距（归一化宽度） */
const SEAT = 0.05
/** 前几次挪座位放慢讲清楚，之后快进 */
const SLOW_HOPS = 3
/** 一圈完成后停留几秒再结束 */
const DONE_HOLD = 3

const lerp = (a: Pt, b: Pt, u: number): Pt => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]
const ease = (u: number) => u * u * (3 - 2 * u)
/** 近似高斯的随机数（三个均匀数之和） */
const jitter = () => Math.random() + Math.random() + Math.random() - 1.5

/** 从 a 到 b 的随机游走（布朗桥）：n 段折线，终点准确落在 b；y 限制在器件内 */
function wander(a: Pt, b: Pt, n: number, amp: number, H: number): Pt[] {
  const w: Pt[] = [[0, 0]]
  for (let k = 1; k <= n; k++) w.push([w[k - 1][0] + jitter(), w[k - 1][1] + jitter()])
  const [ex, ey] = w[n]
  return w.map(([wx, wy], k) => {
    const s = k / n
    const [x, y] = lerp(a, b, s)
    return [x + (wx - ex * s) * amp, Math.min(H * 0.94, Math.max(H * 0.06, y + (wy - ey * s) * amp))]
  })
}

/** 折线上按参数 u 匀速取点（各段时间相等，像一步一步的随机游走） */
function along(pts: Pt[], u: number): Pt {
  const f = Math.min(pts.length - 1.000001, Math.max(0, u * (pts.length - 1)))
  const k = Math.floor(f)
  return lerp(pts[k], pts[k + 1], f - k)
}

/** 折线上按弧长匀速取点（导线里的电子） */
function byLength(pts: Pt[], u: number): Pt {
  const seg = pts.slice(1).map((p, k) => Math.hypot(p[0] - pts[k][0], p[1] - pts[k][1]))
  let s = u * seg.reduce((a, b) => a + b, 0)
  for (let k = 0; k < seg.length; k++) {
    if (s <= seg[k] || k === seg.length - 1) return lerp(pts[k], pts[k + 1], seg[k] ? Math.min(1, s / seg[k]) : 1)
    s -= seg[k]
  }
  return pts[pts.length - 1]
}

export class LapDemo {
  active = false
  /** 复合的那一刻（归一化坐标），由渲染器画一道暖色波纹 */
  onRecombine?: (x: number, y: number) => void
  private phases: Phase[] = []
  private k = 0
  private t = 0
  private doneT = 0
  private trail: number[] = []
  /** 复合发生在第 k 段的 u 处（归一化坐标 x、y） */
  private recombAt = { k: -1, u: 0, x: 0, y: 0 }
  private fired = false
  /** 一圈完成后电子停在 N 区的位置 */
  private last: Pt = [0.9, 0.25]

  constructor(private ctx: StageCtx) {}

  get info(): LapInfo | null {
    if (!this.active) return null
    const ph = this.phases[this.k]
    return ph ? { leg: ph.leg, fast: !!ph.fast, done: false } : { leg: LAP_LEGS, fast: false, done: true }
  }

  start() {
    this.phases = this.build()
    this.k = 0
    this.t = 0
    this.doneT = 0
    this.trail.length = 0
    this.fired = false
    this.active = true
  }

  stop() {
    this.active = false
    this.trail.length = 0
  }

  /** 画布尺寸改变：像素轨迹作废 */
  resized() {
    this.trail.length = 0
  }

  private build(): Phase[] {
    const { ctx } = this
    const H = ctx.sim.H
    const w = ctx.sim.w
    const eL = 0.5 - w / 2
    const eR = 0.5 + w / 2
    const px = (p: Pt): Pt => [ctx.X(p[0]), ctx.Y(p[1])]
    const ry = () => H * (0.3 + 0.4 * Math.random())
    const dev = (leg: number, dur: number, pts: Pt[]): Phase => ({ leg, dur, at: (u) => px(along(pts, u)) })

    // ① N 区里乱跑，走到耗尽层边上
    const nPath = wander([Math.min(0.9, eR + 0.24), ry()], [eR + 0.004, ry()], 30, 0.03, H)
    // ② 翻过坡：穿过耗尽层
    const cross = wander(nPath[nPath.length - 1], [eL - 0.008, ry()], 8, 0.008, H)
    // ③ P 区里扩散，到复合的地方
    const xr = Math.max(0.2, eL * 0.55)
    const pPath = wander(cross[cross.length - 1], [xr, ry()], 30, 0.035, H)
    const meet = pPath[pPath.length - 1]
    const holeAt: Pt = [meet[0] - 0.028, Math.min(H * 0.92, meet[1] + 0.02)]

    const phases: Phase[] = [
      dev(0, 3.2, nPath),
      dev(1, 1.3, cross),
      {
        ...dev(2, 3.2, pPath),
        hole: (u) => (u < 0.55 ? null : { p: px(holeAt), a: (u - 0.55) / 0.45 }),
      },
      // ④ 复合：落进空座位，成为价电子
      {
        leg: 3,
        dur: 1.6,
        at: (u) => px(lerp(meet, holeAt, ease(Math.min(1, u / 0.4)))),
        hole: (u) => (u < 0.4 ? { p: px(holeAt), a: 1 } : null),
        seat: true,
      },
    ]
    // 电子落进空穴的那一刻画复合波纹
    this.recombAt = { k: 3, u: 0.4, x: holeAt[0], y: holeAt[1] }

    // ⑤ 空穴从左边过来、经过它：它向 A 挪一个座位，空穴到了它原来的座位上，继续向结走
    const y = holeAt[1]
    let x = holeAt[0]
    for (let n = 0; x - SEAT > 0.02; n++) {
      const x0 = x
      const x1 = x - SEAT
      const slow = n < SLOW_HOPS
      phases.push({
        leg: 4,
        dur: slow ? 1.5 : 0.34,
        fast: !slow,
        seat: true,
        at: (u) => {
          const s = ease(Math.min(1, Math.max(0, (u - 0.55) / 0.25)))
          const [hx, hy] = px([x0 + (x1 - x0) * s, y])
          return [hx, hy - Math.sin(Math.PI * s) * 7]
        },
        hole: (u) => {
          if (u < 0.55) return slow ? { p: px([x1 - 0.09 * (1 - ease(u / 0.55)), y]), a: Math.min(1, u / 0.2) } : { p: px([x1, y]), a: 1 }
          if (u < 0.8) return { p: px([x1 + (x0 - x1) * ease((u - 0.55) / 0.25), y]), a: 1 }
          return { p: px([x0 + 0.06 * (u - 0.8) / 0.2, y]), a: 1 - (u - 0.8) / 0.2 }
        },
      })
      x = x1
    }

    // ⑥ 进入 A 端电极，沿导线经过电源，到 K 端电极
    const yA = y
    const yK = ry()
    const wire = (): Pt[] => {
      const { devX0, devW, wireY } = ctx.L
      const ax = devX0 - 7.5
      const kx = devX0 + devW + 7.5
      return [[ax, ctx.Y(yA)], [ax, wireY], [kx, wireY], [kx, ctx.Y(yK)]]
    }
    phases.push(
      { leg: 5, dur: 0.7, seat: true, at: (u) => lerp(px([x, yA]), wire()[0], ease(u)) },
      { leg: 5, dur: 3.2, fast: true, at: (u) => byLength(wire(), u) },
    )
    // ⑦ 从 K 端回到 N 区
    const back = wander([1.004, yK], [0.88, ry()], 12, 0.02, H)
    phases.push({ leg: 6, dur: 1.4, at: (u) => (u < 0.15 ? lerp(wire()[3], px(back[0]), u / 0.15) : px(along(back, (u - 0.15) / 0.85))) })
    this.last = back[back.length - 1]
    return phases
  }

  update(dt: number) {
    if (!this.active || dt <= 0) return
    const ph = this.phases[this.k]
    if (!ph) {
      this.doneT += dt
      if (this.doneT > DONE_HOLD) this.stop()
      return
    }
    this.t += dt
    if (this.k === this.recombAt.k && !this.fired && this.t / ph.dur >= this.recombAt.u) {
      this.fired = true
      this.onRecombine?.(this.recombAt.x, this.recombAt.y)
    }
    if (this.t >= ph.dur) {
      this.t = 0
      this.k++
    }
    const [x, y] = this.pos()
    const n = this.trail.length
    if (!n || (x - this.trail[n - 2]) ** 2 + (y - this.trail[n - 1]) ** 2 > 9) {
      this.trail.push(x, y)
      if (this.trail.length > 1200) this.trail.splice(0, 2)
    }
  }

  private pos(): Pt {
    const ph = this.phases[this.k]
    if (ph) return ph.at(Math.min(1, this.t / ph.dur))
    return [this.ctx.X(this.last[0]), this.ctx.Y(this.last[1])]
  }

  /** 画在最上层（导线之上） */
  draw(g: Graphics) {
    g.clear()
    if (!this.active) return
    const { c, time } = this.ctx
    // 轨迹：越早越淡
    const tr = this.trail
    const n = tr.length / 2
    const seg = 20
    for (let s0 = 0; s0 < n - 1; s0 += seg) {
      const s1 = Math.min(n - 1, s0 + seg)
      g.moveTo(tr[2 * s0], tr[2 * s0 + 1])
      for (let k = s0 + 1; k <= s1; k++) g.lineTo(tr[2 * k], tr[2 * k + 1])
      g.stroke({ width: 2, color: c.e, alpha: 0.15 + 0.55 * (s1 / n), join: 'round', cap: 'round' })
    }
    const ph = this.phases[this.k]
    const u = ph ? Math.min(1, this.t / ph.dur) : 1
    const hole = ph?.hole?.(u)
    if (hole && hole.a > 0) {
      g.circle(hole.p[0], hole.p[1], 7).fill({ color: c.panel, alpha: 0.9 * hole.a }).stroke({ width: 2.6, color: c.h, alpha: hole.a })
    }
    const [x, y] = this.pos()
    if (ph?.seat && (this.k !== this.recombAt.k || u >= this.recombAt.u)) {
      // 价电子坐在"座位"（共价键）上
      g.roundRect(x - 11, y - 11, 22, 22, 5).stroke({ width: 2, color: c.ink, alpha: 0.6 })
    }
    const pulse = 0.5 + 0.5 * Math.sin(time * 6)
    g.circle(x, y, 6).fill({ color: c.e })
    g.circle(x, y, 10 + 2 * pulse).stroke({ width: 2.4, color: c.e, alpha: 0.95 })
  }
}
