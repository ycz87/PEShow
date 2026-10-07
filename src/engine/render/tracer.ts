// 追踪模式：跟住一个载流子，记录它的来历、轨迹与结局，供界面上的"它的一生"卡片显示
import type { Graphics } from 'pixi.js'
import type { ContactEvent, Kind, PairEvent } from '../physics/pnSim'
import type { StageCtx } from './stage'

/** 载流子的来历 */
export type Origin = 'wireK' | 'wireA' | 'gen' | 'initial'
export type TraceStatus = 'free' | 'recombined' | 'exited'
type Region = 'P' | 'N' | 'SCR'

export interface TraceInfo {
  kind: Kind
  origin: Origin
  /** 开始追踪时所在区域 */
  startRegion: Region
  /** 当前所在区域 */
  region: Region
  /** 从出生（或开始追踪）起经过的可视秒 */
  age: number
  /** 来历是否确知（开始追踪前就已存在的初始载流子不知道出生时间） */
  ageFromBirth: boolean
  crossings: number
  status: TraceStatus
  exitSide: 'A' | 'K' | null
  /** 在器件中的归一化横坐标（卡片放在另一侧，不挡住它） */
  x: number
}

/** 结局展示几秒（真实时间）后自动换下一个 */
const END_HOLD = 4.5

export class Tracer {
  on = false
  info: TraceInfo | null = null
  private uid = 0
  private t0 = 0
  private endAt = 0
  private pts: number[] = []
  private side = 0
  /** 载流子出生记录：uid → 来历与出生时刻（有上限，旧的自动丢弃） */
  private births = new Map<number, { origin: Origin; t: number }>()

  constructor(private ctx: StageCtx) {}

  set(on: boolean) {
    this.on = on
    if (on) this.pick()
    else {
      this.info = null
      this.uid = 0
      this.pts.length = 0
    }
  }

  /** 仿真重新布置后调用 */
  reset() {
    this.births.clear()
    if (this.on) this.pick()
  }

  /** 舞台高宽比改变时，轨迹点随粒子一起按比例缩放 */
  scaleY(k: number) {
    for (let i = 1; i < this.pts.length; i += 2) this.pts[i] *= k
  }

  private regionOf(x: number): Region {
    const [eL, eR] = this.ctx.sim.depletion
    // 耗尽层几乎为零（如 PiN 正偏）时按掺杂区分
    if (eR - eL < 1e-3) return x < eL ? 'P' : 'N'
    return x < eL ? 'P' : x > eR ? 'N' : 'SCR'
  }

  /**
   * 选一个载流子来追踪。正偏：优先选刚越过结、成为少子的载流子；
   * 反偏：优先选靠近耗尽层边缘的少子（它们会顺着"滑梯"被扫过结）；
   * 结正在形成：优先选紧挨结的 N 区电子（势垒还低，它可能越过结、成为少子并复合）
   */
  pick() {
    const sim = this.ctx.sim
    const [eL, eR] = sim.depletion
    const cand: [Kind, number][] = []
    const scan = (kind: Kind, ok: (x: number) => boolean) => {
      const P = kind === 0 ? sim.electrons : sim.holes
      for (let i = 0; i < P.cap; i++) if (P.alive[i] && ok(P.x[i])) cand.push([kind, i])
    }
    if (sim.biasSign > 0) {
      scan(0, (x) => x < eL && x > eL - 0.06)
      scan(1, (x) => x > eR && x < eR + 0.06)
    } else if (sim.biasSign < 0) {
      scan(0, (x) => x < eL && x > eL - 0.15)
      scan(1, (x) => x > eR && x < eR + 0.15)
    } else if (sim.formation < 1) {
      scan(0, (x) => x > eR && x < eR + 0.06)
    }
    if (!cand.length) scan(0, (x) => x > eR)
    if (!cand.length) { this.info = null; this.uid = 0; return }
    const [kind, i] = cand[Math.floor(Math.random() * cand.length)]
    const P = kind === 0 ? sim.electrons : sim.holes
    const birth = this.births.get(P.uid[i])
    const region = this.regionOf(P.x[i])
    this.uid = P.uid[i]
    this.t0 = birth ? birth.t : sim.t
    this.endAt = 0
    this.side = P.x[i] < (eL + eR) / 2 ? -1 : 1
    this.pts = [P.x[i], P.y[i]]
    this.info = {
      kind,
      origin: birth ? birth.origin : 'initial',
      startRegion: region,
      region,
      age: sim.t - this.t0,
      ageFromBirth: !!birth,
      crossings: 0,
      status: 'free',
      exitSide: null,
      x: P.x[i],
    }
  }

  private end(status: TraceStatus, side: 'A' | 'K' | null = null) {
    if (!this.info) return
    this.info.status = status
    this.info.exitSide = side
    this.endAt = this.ctx.time
  }

  private birth(uid: number, origin: Origin) {
    this.births.set(uid, { origin, t: this.ctx.sim.t })
    if (this.births.size > 4000) {
      const first = this.births.keys().next().value
      if (first !== undefined) this.births.delete(first)
    }
  }

  /** 接触事件：记下从导线来的载流子（导线送进电子，或抽走价电子留下空穴）；被追踪者到达电极则结束 */
  onContact(e: ContactEvent) {
    if (e.out === (e.who === 1)) this.birth(e.uid, e.side === 'A' ? 'wireA' : 'wireK')
    const tr = this.info
    if (tr && tr.status === 'free' && e.uid === this.uid && e.who === tr.kind) this.end('exited', e.side)
  }

  /** 这次复合是否带走了被追踪的载流子 */
  isTraced(e: PairEvent) {
    const tr = this.info
    return !!tr && tr.status === 'free' && !e.gen && (tr.kind === 0 ? e.eUid : e.hUid) === this.uid
  }

  /** 电子-空穴对事件：记下热产生的载流子；被追踪者复合则结束 */
  onPair(e: PairEvent) {
    if (e.gen) {
      this.birth(e.eUid, 'gen')
      this.birth(e.hUid, 'gen')
    } else if (this.isTraced(e)) {
      this.pts.push(e.x, e.y)
      this.end('recombined')
    }
  }

  /** 每帧更新被追踪载流子的位置、轨迹与区域 */
  update() {
    const tr = this.info
    if (!this.on) return
    if (!tr) {
      this.pick()
      return
    }
    if (tr.status !== 'free') {
      if (this.ctx.time - this.endAt > END_HOLD) this.pick()
      return
    }
    const sim = this.ctx.sim
    tr.age = sim.t - this.t0
    const P = tr.kind === 0 ? sim.electrons : sim.holes
    const i = P.find(this.uid)
    if (i < 0) { this.end('exited'); return }
    const x = P.x[i]
    const y = P.y[i]
    const side = x < 0.5 ? -1 : 1
    if (side !== this.side) { tr.crossings++; this.side = side }
    tr.region = this.regionOf(x)
    tr.x = x
    const n = this.pts.length
    const lx = this.pts[n - 2]
    const ly = this.pts[n - 1]
    if ((x - lx) ** 2 + (y - ly) ** 2 > 2.5e-5) {
      this.pts.push(x, y)
      if (this.pts.length > 1600) this.pts.splice(0, 2)
    }
  }

  /** 轨迹画在 trail 层（载流子下方），标记圈画在 fx 层 */
  draw(trail: Graphics, fx: Graphics) {
    const tr = this.info
    if (!this.on || !tr) return
    const ctx = this.ctx
    const c = ctx.c
    const X = (x: number) => ctx.X(x)
    const Y = (y: number) => ctx.Y(y)
    const col = tr.kind === 0 ? c.e : c.h
    // 轨迹：越早越淡
    const pts = this.pts
    const n = pts.length / 2
    const seg = 24
    for (let s0 = 0; s0 < n - 1; s0 += seg) {
      const s1 = Math.min(n - 1, s0 + seg)
      trail.moveTo(X(pts[2 * s0]), Y(pts[2 * s0 + 1]))
      for (let k = s0 + 1; k <= s1; k++) trail.lineTo(X(pts[2 * k]), Y(pts[2 * k + 1]))
      trail.stroke({ width: 2, color: col, alpha: 0.25 + 0.6 * (s1 / n), join: 'round', cap: 'round' })
    }
    const lx = X(pts[pts.length - 2])
    const ly = Y(pts[pts.length - 1])
    if (tr.status === 'free') {
      const pulse = 0.5 + 0.5 * Math.sin(this.ctx.time * 6)
      fx.circle(lx, ly, 9 + 2 * pulse).stroke({ width: 2.4, color: col, alpha: 0.95 })
    } else {
      const a = Math.max(0, 1 - (this.ctx.time - this.endAt) / END_HOLD)
      fx.circle(lx, ly, 10).stroke({ width: 2, color: c.ink, alpha: 0.6 * a })
      fx.moveTo(lx - 6, ly - 6).lineTo(lx + 6, ly + 6).moveTo(lx + 6, ly - 6).lineTo(lx - 6, ly + 6).stroke({ width: 2, color: c.ink, alpha: 0.6 * a })
    }
  }
}
