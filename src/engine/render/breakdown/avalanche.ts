// 雪崩击穿（1N4757A，P⁺N 单边突变结）。两种画面共用同一套蒙特卡罗（见 physics/avalancheMC）：
//  - 座位视角：耗尽层里的硅晶格（座位 = 共价键上的价电子）。电子在电场中加速，头顶的能量条随飞行变长；
//    撞上晶格（声子散射）能量条清零、闪一下热；能量条攒满时撞翻一个座位：撞出一个电子，座位空了就是空穴。
//    轨迹按"第几代"上色，看得出一传二、二传四的树。
//  - 能带视角：倾斜的能带上，电子离导带底的高度就是它攒到的动能；攒到"撞出线"就撞出一对，价带的电子跳上导带。
// 默认一次只注入一个电子，等这棵树长完再注入下一个，并标出"进 1 个 → 出几个"；也可以连续注入。
import { kelvin, K_B } from '../../physics/pn'
import { ZENERS, holeRatio, multiplication } from '../../physics/breakdown'
import { calibrate, flight, gain, type AvField, type Flight, type Kind } from '../../physics/avalancheMC'
import { rgba } from '../../../design/tokens'
import { lengthText } from '../../../app/format'
import { clamp } from '../../math'
import { rippleRings, RIPPLE_LIFE } from '../ripples'
import { drawSeats, nearestAtom, nearestSeat, seatGrid, type Grid } from './seats'
import { REGION_A, arrow, biasGeom, dash, dimension, sprite, text, type BdCtx, type BdInput, type Scene } from './common'

/** 画面上的倍增因子上限：再大的树挤不下 */
export const M_CAP = 20
/** 同时最多几个载流子 */
const CAP = 600
/** 连续注入的间隔；一次一个时，上一棵树长完后停顿多久（舞台秒） */
const STREAM_GAP = 0.7
const PAUSE = 2
/** 平均自由程（示意）：25 °C 时为 U_Z 下耗尽层宽度的 1/16；随温度按 tanh(E_p/2kT) 缩短（光学声子能量 E_p ≈ 63 meV） */
const MFP_DIV = 16
const E_PHONON = 0.063
/** 一次平均长度的自由飞行用时（舞台秒），空穴慢一些 */
const FLIGHT = 0.18
const HOLE_SLOW = 1.3
/** 轨迹保留几个点（每次碰撞记两个：碰前的能量、碰后清零） */
const TRAIL = 16
/** 撞上晶格（原子抖一下）的显示时间；能量差一点没攒满时，"只变成了热"的提示显示更久（舞台秒）。碰撞电离的波纹与 PN 结舞台的复合波纹相同 */
const FLASH_LIFE = 0.55
const NEAR_LIFE = 1.1
/** 能量攒到阈值的这个比例以上却被撞停，算"差一点" */
const NEAR = 0.8
/** 撞出一对时，新电子从座位里弹出来的用时（舞台秒） */
const POP = 0.35
/** 座位视角里空穴（空座位）跟随最近座位的速率（1/秒）：越大，一格一格跳得越干脆 */
const HOP_RATE = 16
/** 一棵树的结果显示几秒 */
const RESULT_LIFE = 2
/** 输入停止变化多久后重新标定（真实毫秒）：标定要几十毫秒，拖动滑块时不每次都算 */
const CAL_DELAY = 150
/** 座位视角的原子间距（像素） */
const SEAT_PX = 26
/** 各代轨迹的颜色（第 0 代用电子色） */
const GEN = ['', '#7EE081', '#FFC44D', '#FF8FB1', '#B79CFF', '#4FD8E8', '#FF9F5A']

/** 平均自由程相对 25 °C 的倍数 */
export function mfpRatio(T: number) {
  const f = (t: number) => Math.tanh(E_PHONON / (2 * K_B * kelvin(t)))
  return f(T) / f(25)
}

interface Pt {
  x: number
  y: number
  /** 此刻攒到的能量（相对各自的撞出阈值，0…1） */
  e: number
}

interface Carrier {
  kind: Kind
  x0: number
  y0: number
  x1: number
  y1: number
  t: number
  dur: number
  fl: Flight
  /** 发射这次飞行时用的电场与阈值 */
  f: AvField
  tree: number
  gen: number
  trail: Pt[]
  /** 弹出动画剩余时间（> 0 时还没开始飞），以及弹出的起点 */
  pop: number
  px: number
  py: number
  /** 座位视角里画在哪里：空穴落在最近的座位上，一格一格跳 */
  sx: number
  sy: number
}

interface Mark {
  x: number
  y: number
  age: number
  ion: boolean
  /** 能量差一点就攒满了 */
  near: boolean
}

interface Tree {
  alive: number
  out: number
}

export interface AvalancheStats {
  /** 已长完的树（注入的电子数）与流出的电子总数 */
  trees: number
  out: number
  /** 最近一棵树流出几个，及其已显示的时间 */
  last: number | null
}

export class AvalancheScene implements Scene {
  private list: Carrier[] = []
  private marks: Mark[] = []
  private trees = new Map<number, Tree>()
  private nextTree = 1
  private clock = 0
  private lastAge = 0
  stats: AvalancheStats = { trees: 0, out: 0, last: null }
  /** 当前使用的标定，以及等待标定的输入 */
  private f: AvField | null = null
  private fKey = ''
  private cache = new Map<string, AvField>()
  private want = ''
  private wantSince = 0
  /** 座位视角上一帧的方格与横向范围（座位与模型坐标互换用；还没画过时为 null） */
  private grid: { gr: Grid; lo: number; hi: number } | null = null

  reset() {
    this.list = []
    this.marks = []
    this.trees.clear()
    this.clock = 0
    this.lastAge = 0
    this.stats = { trees: 0, out: 0, last: null }
  }

  /** 按反压、温度标定阈值（有缓存；输入还在变时先沿用旧的） */
  private field(inp: BdInput): AvField {
    const key = `${inp.device}|${inp.vr}|${inp.T}`
    if (key === this.fKey && this.f) return this.f
    const hit = this.cache.get(key)
    const now = performance.now()
    if (key !== this.want) {
      this.want = key
      this.wantSince = now
    }
    if (hit || !this.f || now - this.wantSince > CAL_DELAY) {
      this.f = hit ?? this.solve(inp)
      if (!hit) {
        this.cache.set(key, this.f)
        if (this.cache.size > 200) this.cache.delete(this.cache.keys().next().value!)
      }
      this.fKey = key
      // 换了电压或温度，之前的统计不再适用
      this.stats = { trees: 0, out: 0, last: null }
    }
    return this.f
  }

  private solve(inp: BdInput): AvField {
    const d = ZENERS[inp.device]
    const { op, g } = biasGeom(d, inp.vr, inp.T)
    const ref = biasGeom(d, d.VZ, 25).g
    const M = Math.min(multiplication(d, op.Vj, inp.T), M_CAP)
    return calibrate(g.W, g.Emax, (ref.W / MFP_DIV) * mfpRatio(inp.T), holeRatio(g.Emax), M)
  }

  private launch(p: Carrier, f: AvField) {
    p.f = f
    p.x0 = p.x1
    p.y0 = p.y1
    p.fl = flight(f, p.kind, p.x0, Math.random)
    p.x1 = p.x0 + (p.kind === 'e' ? p.fl.len : -p.fl.len)
    p.y1 = clamp(p.y0 + (Math.random() - 0.5) * 0.16, 0.04, 0.96)
    p.t = 0
    // 从静止匀加速：用时 ∝ √距离
    p.dur = Math.max(0.03, FLIGHT * Math.sqrt(p.fl.len / f.lam) * (p.kind === 'h' ? HOLE_SLOW : 1))
  }

  /** 在 (x, y) 生成；给了 from 时先从 from 弹出到 (x, y)，弹完再开始飞 */
  private spawn(kind: Kind, x: number, y: number, tree: number, gen: number, f: AvField, from?: [number, number]) {
    const p: Carrier = {
      kind, x0: x, y0: y, x1: x, y1: y, t: 0, dur: 1, fl: { len: 0, ion: false, exit: false }, f, tree, gen,
      trail: [{ x, y, e: 0 }], pop: from ? POP : 0, px: from?.[0] ?? x, py: from?.[1] ?? y, sx: x, sy: y,
    }
    if (!from) this.launch(p, f)
    this.list.push(p)
    this.trees.get(tree)!.alive++
  }

  /** 模型坐标处最近的座位（模型坐标）；还没有方格时原样返回 */
  private seat(x: number, y: number): [number, number] {
    const G = this.grid
    if (!G) return [x, y]
    const [u, v] = nearestSeat(G.gr, (x - G.lo) / (G.hi - G.lo), y)
    return [G.lo + u * (G.hi - G.lo), v]
  }

  private inject(f: AvField) {
    const id = this.nextTree++
    this.trees.set(id, { alive: 0, out: 0 })
    this.spawn('e', 0, 0.12 + Math.random() * 0.76, id, 0, f)
  }

  update(dt: number, inp: BdInput) {
    if (dt <= 0) return
    const f = this.field(inp)
    this.lastAge += dt
    this.clock += dt
    if (inp.inject === 'stream') {
      while (this.clock >= STREAM_GAP) {
        this.clock -= STREAM_GAP
        if (this.list.length < CAP) this.inject(f)
      }
    } else if (!this.list.length && this.clock >= PAUSE) {
      this.clock = 0
      this.inject(f)
    }

    const born: [Kind, number, number, number, number, number, number][] = []
    const gone = new Set<Carrier>()
    for (const p of this.list) {
      if (p.pop > 0) {
        p.pop -= dt
        if (p.pop <= 0) this.launch(p, f)
        continue
      }
      p.t += dt
      while (p.t >= p.dur) {
        p.t -= p.dur
        const { x1: x, y1: y } = p
        if (p.fl.exit) {
          gone.add(p)
          break
        }
        const vth = p.kind === 'e' ? p.f.vthE : p.f.vthH
        const e = p.fl.ion ? 1 : gain(p.f, p.kind, p.x0, p.fl.len) / vth
        p.trail.push({ x, y, e }, { x, y, e: 0 })
        if (p.trail.length > TRAIL) p.trail.splice(0, p.trail.length - TRAIL)
        this.marks.push({ x, y, age: 0, ion: p.fl.ion, near: !p.fl.ion && e >= NEAR })
        if (p.fl.ion) {
          // 被撞翻的座位：新电子从座位里弹出去，空座位（空穴）留在原地
          const [hx, hy] = this.seat(x, y)
          const dy = (Math.random() < 0.5 ? -1 : 1) * 0.12
          born.push(['e', hx, clamp(hy + dy, 0.04, 0.96), p.tree, p.gen + 1, hx, hy], ['h', hx, hy, p.tree, p.gen + 1, hx, hy])
        }
        this.launch(p, f)
      }
    }
    for (const [k, x, y, tree, gen, fx, fy] of born) if (this.list.length < CAP) this.spawn(k, x, y, tree, gen, f, [fx, fy])
    // 空座位跟着最近的座位走：位置一变就快速跳过去
    const k = Math.min(1, dt * HOP_RATE)
    for (const p of this.list) {
      if (p.kind !== 'h') continue
      const q = this.now(p)
      const [tx, ty] = this.seat(q.x, q.y)
      p.sx += (tx - p.sx) * k
      p.sy += (ty - p.sy) * k
    }
    if (gone.size) {
      this.list = this.list.filter((p) => !gone.has(p))
      for (const p of gone) {
        const tr = this.trees.get(p.tree)!
        if (p.kind === 'e') tr.out++
        if (--tr.alive > 0) continue
        this.trees.delete(p.tree)
        this.stats = { trees: this.stats.trees + 1, out: this.stats.out + tr.out, last: tr.out }
        this.lastAge = 0
      }
    }
    for (const m of this.marks) m.age += dt
    this.marks = this.marks.filter((m) => m.age < (m.ion ? RIPPLE_LIFE : m.near ? NEAR_LIFE : FLASH_LIFE))
    if (this.marks.length > 160) this.marks.splice(0, this.marks.length - 160)
  }

  /** 载流子此刻的位置与能量 */
  private now(p: Carrier): Pt {
    if (p.pop > 0) {
      const u = 1 - p.pop / POP
      const k = 1 - (1 - u) ** 3
      return { x: p.px + (p.x1 - p.px) * k, y: p.py + (p.y1 - p.py) * k, e: 0 }
    }
    const s = (p.t / p.dur) ** 2
    const vth = p.kind === 'e' ? p.f.vthE : p.f.vthH
    return {
      x: p.x0 + (p.x1 - p.x0) * s,
      y: p.y0 + (p.y1 - p.y0) * s,
      e: Math.min(1, gain(p.f, p.kind, p.x0, p.fl.len * s) / vth),
    }
  }

  private color(ctx: BdCtx, p: Carrier) {
    if (p.kind === 'h') return ctx.c.hole
    return p.gen === 0 ? ctx.c.electron : GEN[1 + ((p.gen - 1) % (GEN.length - 1))]
  }

  draw(ctx: BdCtx, inp: BdInput) {
    const f = this.field(inp)
    if (inp.view === 'band') this.drawBand(ctx, inp, f)
    else this.drawSpace(ctx, inp)
    // 一次一个：这棵树的结果
    const { last } = this.stats
    if (inp.inject === 'one' && last !== null && this.lastAge < RESULT_LIFE) {
      const a = Math.min(1, (RESULT_LIFE - this.lastAge) * 2)
      ctx.g.globalAlpha = a
      text(ctx, ctx.L.lastTree.replace('{n}', `${last}`), ctx.w - 26, 24, { size: 15, weight: 800, align: 'right', color: ctx.c.accent, display: true })
      ctx.g.globalAlpha = 1
    }
  }

  // ───────────── 座位视角 ─────────────
  private drawSpace(ctx: BdCtx, inp: BdInput) {
    const { w, h, c, L, g: G, img } = ctx
    const d = ZENERS[inp.device]
    const { g } = biasGeom(d, inp.vr, inp.T)
    const ref = biasGeom(d, d.VZ, 25).g
    const span = { lo: -0.1 * ref.W, hi: 1.1 * ref.W }
    const left = 30
    const right = w - 20
    const X = (x: number) => left + ((x - span.lo) / (span.hi - span.lo)) * (right - left)
    const band = { t: 44, b: h - 150 }
    const Yb = (y: number) => band.t + y * (band.b - band.t)
    const a = X(-g.xp)
    const b = X(g.xn)

    G.fillStyle = rgba(c.pRegion, REGION_A)
    G.fillRect(left, band.t, a - left, band.b - band.t)
    G.fillStyle = rgba(c.nRegion, REGION_A)
    G.fillRect(b, band.t, right - b, band.b - band.t)
    // 电场越强底色越深（电离主要发生在强场区）
    for (let px = a; px < b; px += 3) {
      const x = span.lo + ((px - left) / (right - left)) * (span.hi - span.lo)
      G.fillStyle = rgba(c.accent, 0.16 * Math.max(0, 1 - x / g.W) ** 2)
      G.fillRect(px, band.t, 3, band.b - band.t)
    }
    const box = { l: left, t: band.t, r: right, b: band.b }
    const gr = seatGrid(box, SEAT_PX)
    this.grid = { gr, lo: span.lo, hi: span.hi }
    drawSeats(ctx, box, SEAT_PX)
    G.strokeStyle = rgba(c.ink, 0.45)
    G.lineWidth = 1.2
    G.strokeRect(left, band.t, right - left, band.b - band.t)
    text(ctx, 'P⁺', (left + a) / 2, band.t + 16, { size: 13, weight: 700, align: 'center', color: c.pRegion })
    text(ctx, 'N', Math.min(right - 14, (b + right) / 2), band.t + 16, { size: 13, weight: 700, align: 'center', color: c.nRegion })
    dimension(ctx, a, b, band.t - 10, L.scr.replace('{w}', lengthText(g.W)), c.potential)

    // 轨迹（电子按代上色；空穴一格一格跳，不画轨迹）
    for (const p of this.list) {
      if (p.kind === 'h') continue
      const col = this.color(ctx, p)
      const pts = [...p.trail, this.now(p)]
      G.lineWidth = 2
      for (let i = 1; i < pts.length; i++) {
        G.strokeStyle = rgba(col, 0.12 + 0.6 * (i / pts.length))
        G.beginPath()
        G.moveTo(X(pts[i - 1].x), Yb(pts[i - 1].y))
        G.lineTo(X(pts[i].x), Yb(pts[i].y))
        G.stroke()
      }
    }
    // 撞上晶格：最近的原子抖一下、冒一点热气；碰撞电离：被撞翻的座位
    for (const m of this.marks) {
      if (m.ion) {
        this.impact(ctx, X(m.x), Yb(m.y), m.age)
        continue
      }
      const [u, v] = nearestAtom(gr, (m.x - span.lo) / (span.hi - span.lo), m.y)
      this.shake(ctx, left + u * (right - left), Yb(v), m)
    }
    // 先画电子，空穴（空心圆环）画在上层，刚产生的一对重叠时是"圈里套着一个点"
    for (const kind of ['e', 'h'] as const) {
      for (const p of this.list) {
        if (p.kind !== kind) continue
        const q = this.now(p)
        const x = X(kind === 'h' ? p.sx : q.x)
        const y = Yb(kind === 'h' ? p.sy : q.y)
        sprite(ctx, img[kind], x, y, 6.5)
        if (p.pop <= 0) this.energyBar(ctx, x + 11, y - 3, q.e, kind === 'e' ? c.electron : c.hole)
      }
    }
    if (inp.inject === 'one' && !this.list.length) text(ctx, L.waitNext, left + 8, band.b - 12, { size: 11.5, color: c.inkSoft })

    // 𝓔(x)
    const strip = { t: band.b + 46, b: h - 34 }
    const eTop = ref.Emax * 1.12
    const Ye = (E: number) => strip.b - (E / eTop) * (strip.b - strip.t)
    G.strokeStyle = c.ink
    G.lineWidth = 1.2
    G.beginPath()
    G.moveTo(left, strip.b)
    G.lineTo(right, strip.b)
    G.stroke()
    G.beginPath()
    G.moveTo(a, Ye(0))
    G.lineTo(X(0), Ye(g.Emax))
    G.lineTo(b, Ye(0))
    G.closePath()
    G.fillStyle = rgba(c.field, 0.22)
    G.fill()
    G.strokeStyle = c.field
    G.lineWidth = 2.2
    G.stroke()
    text(ctx, `${L.field}  𝓔max = ${(g.Emax / 1e6).toFixed(2)} MV/cm`, X(0) + 10, Ye(g.Emax) - 4, { size: 12, weight: 700, color: c.field, base: 'bottom' })
    const ay = strip.t - 14
    arrow(G, right - 20, ay, right - 120, ay, c.field, 2, 9)
    text(ctx, L.fieldDir, right - 128, ay, { size: 11.5, color: c.field, align: 'right' })
    text(ctx, L.inject, left + 4, strip.b + 16, { size: 11, color: c.electron })
  }

  /** 撞翻一个座位：星形冲击 + 向外扩散的波纹 */
  private impact(ctx: BdCtx, x: number, y: number, age: number) {
    const { g: G, c } = ctx
    G.lineWidth = 2.4
    for (const ring of rippleRings(age, false, 22)) {
      G.strokeStyle = rgba(c.accent, ring.alpha)
      G.beginPath()
      G.arc(x, y, ring.r, 0, Math.PI * 2)
      G.stroke()
    }
    const t = age / RIPPLE_LIFE
    if (t > 0.5) return
    const r0 = 5 + 10 * t
    G.strokeStyle = rgba(c.accent, 1 - 2 * t)
    G.lineWidth = 2
    G.beginPath()
    for (let k = 0; k < 8; k++) {
      const an = (k * Math.PI) / 4 + 0.3
      G.moveTo(x + Math.cos(an) * r0, y + Math.sin(an) * r0)
      G.lineTo(x + Math.cos(an) * (r0 + 6), y + Math.sin(an) * (r0 + 6))
    }
    G.stroke()
  }

  /** 撞上晶格：原子抖一下，冒三缕热气；能量差一点就攒满时，提示"只变成了热" */
  private shake(ctx: BdCtx, x: number, y: number, m: Mark) {
    const { g: G, c, L } = ctx
    const t = Math.min(1, m.age / FLASH_LIFE)
    if (t < 1) {
      const dx = Math.sin(m.age * 80) * 3.2 * (1 - t)
      G.fillStyle = rgba(c.warm, 0.85 * (1 - t))
      G.beginPath()
      G.arc(x + dx, y, 4.6, 0, Math.PI * 2)
      G.fill()
      for (let k = -1; k <= 1; k++) {
        G.fillStyle = rgba(c.warm, 0.6 * (1 - t))
        G.beginPath()
        G.arc(x + k * 5 + Math.sin(m.age * 9 + k) * 1.5, y - 7 - t * 14 - Math.abs(k) * 2, 2.2 - t, 0, Math.PI * 2)
        G.fill()
      }
    }
    if (m.near) {
      G.globalAlpha = Math.min(1, (NEAR_LIFE - m.age) * 3)
      text(ctx, L.nearMiss, x + 8, y - 16, { size: 11, weight: 700, color: c.warm })
      G.globalAlpha = 1
    }
  }

  /** 头顶的能量条：满格 = 撞出阈值，真正满格才变成强调色 */
  private energyBar(ctx: BdCtx, x: number, y: number, e: number, col: string) {
    const { g: G, c } = ctx
    const H = 16
    const W = 5
    G.fillStyle = rgba(c.bg, 0.75)
    G.fillRect(x - 1, y - H - 1, W + 2, H + 2)
    G.fillStyle = e >= 0.999 ? c.accent : col
    G.fillRect(x, y - H * e, W, H * e)
    G.strokeStyle = rgba(c.ink, 0.55)
    G.lineWidth = 1
    G.strokeRect(x - 0.5, y - H - 0.5, W + 1, H + 1)
  }

  // ───────────── 能带视角 ─────────────
  private drawBand(ctx: BdCtx, inp: BdInput, f: AvField) {
    const { w, h, c, L, g: G, img } = ctx
    const d = ZENERS[inp.device]
    const { g } = biasGeom(d, inp.vr, inp.T)
    const ref = biasGeom(d, d.VZ, 25).g
    const span = { lo: -0.1 * ref.W, hi: 1.1 * ref.W }
    const left = 70
    const right = w - 30
    const X = (x: number) => left + ((x - span.lo) / (span.hi - span.lo)) * (right - left)
    // 纵向示意：禁带画成固定像素，电势差压缩到画面里
    const gap = 30
    const thrE = 1.5 * gap
    const thrH = thrE * (f.vthH / f.vthE)
    const top = 52 + thrE
    const bot = h - 40 - gap - thrH
    const total = gain(f, 'e', 0, f.W)
    const Ec = (x: number) => top + (x <= 0 ? 0 : x >= g.W ? 1 : gain(f, 'e', 0, x) / total) * (bot - top)
    const Ev = (x: number) => Ec(x) + gap
    const a = X(0)
    const b = X(g.W)

    G.fillStyle = rgba(c.pRegion, REGION_A)
    G.fillRect(left, 40, a - left, h - 70)
    G.fillStyle = rgba(c.nRegion, REGION_A)
    G.fillRect(b, 40, right - b, h - 70)
    text(ctx, 'P⁺', (left + a) / 2, 54, { size: 13, weight: 700, align: 'center', color: c.pRegion })
    text(ctx, 'N', Math.min(right - 14, (b + right) / 2), 54, { size: 13, weight: 700, align: 'center', color: c.nRegion })
    dimension(ctx, a, b, 30, L.scr.replace('{w}', lengthText(g.W)), c.potential)

    const xs = Array.from({ length: 121 }, (_, i) => span.lo + (i / 120) * (span.hi - span.lo))
    const line = (fy: (x: number) => number, col: string, width: number, dashed = false) => {
      G.beginPath()
      xs.forEach((x, i) => (i ? G.lineTo(X(x), fy(x)) : G.moveTo(X(x), fy(x))))
      G.strokeStyle = col
      G.lineWidth = width
      dash(G, dashed, [6, 4])
      G.stroke()
      dash(G, false)
    }
    // 价带填满电子（淡色），禁带留白
    G.beginPath()
    xs.forEach((x, i) => (i ? G.lineTo(X(x), Ev(x)) : G.moveTo(X(x), Ev(x))))
    G.lineTo(right, h - 30)
    G.lineTo(left, h - 30)
    G.closePath()
    G.fillStyle = rgba(c.inkSoft, 0.14)
    G.fill()
    line((x) => Ec(x) - thrE, rgba(c.accent, 0.7), 1.4, true)
    line((x) => Ev(x) + thrH, rgba(c.accent, 0.45), 1.2, true)
    line(Ec, c.ink, 2.2)
    line(Ev, c.ink, 2.2)
    text(ctx, L.Ec, left - 8, Ec(span.lo), { size: 12, weight: 700, align: 'right' })
    text(ctx, L.Ev, left - 8, Ev(span.lo), { size: 12, weight: 700, align: 'right' })
    const xl = 0.45 * g.W
    text(ctx, L.thrE, X(xl) + 6, Ec(xl) - thrE - 6, { size: 11.5, weight: 700, color: c.accent, base: 'bottom', max: right - X(xl) - 10 })
    text(ctx, L.thrH, b - 8, Ev(g.W) + thrH + 14, { size: 11, color: c.accent, align: 'right' })

    // 载流子的高度 = 能带边 ∓ 攒到的能量
    const yOf = (k: Kind, x: number, e: number) => (k === 'e' ? Ec(x) - e * thrE : Ev(x) + e * thrH)
    for (const p of this.list) {
      const col = this.color(ctx, p)
      const pts = [...p.trail, this.now(p)]
      G.lineWidth = 1.8
      for (let i = 1; i < pts.length; i++) {
        G.strokeStyle = rgba(col, 0.12 + 0.6 * (i / pts.length))
        G.beginPath()
        G.moveTo(X(pts[i - 1].x), yOf(p.kind, pts[i - 1].x, pts[i - 1].e))
        G.lineTo(X(pts[i].x), yOf(p.kind, pts[i].x, pts[i].e))
        G.stroke()
      }
    }
    for (const m of this.marks) {
      const x = X(m.x)
      if (!m.ion) {
        const t = Math.min(1, m.age / FLASH_LIFE)
        G.strokeStyle = rgba(c.warm, 0.7 * (1 - t))
        G.lineWidth = 1.5
        G.beginPath()
        G.arc(x, Ec(m.x), 3 + 6 * t, 0, Math.PI * 2)
        G.stroke()
        if (m.near) {
          G.globalAlpha = Math.min(1, (NEAR_LIFE - m.age) * 3)
          text(ctx, L.nearMiss, x + 6, Ec(m.x) - thrE - 10, { size: 11, weight: 700, color: c.warm })
          G.globalAlpha = 1
        }
        continue
      }
      // 碰撞电离：价带的一个电子跳上导带（留下空穴），撞人的电子落回导带底
      const t = m.age / RIPPLE_LIFE
      G.globalAlpha = 1 - t
      arrow(G, x, Ev(m.x) - 2, x, Ec(m.x) + 4, c.accent, 2.2, 8)
      G.globalAlpha = 1
      this.impact(ctx, x, Ec(m.x) - thrE, m.age)
    }
    for (const kind of ['e', 'h'] as const) {
      for (const p of this.list) {
        if (p.kind !== kind) continue
        const q = this.now(p)
        sprite(ctx, img[kind], X(q.x), yOf(kind, q.x, q.e), 6)
      }
    }
    text(ctx, L.bandNote, left, h - 14, { size: 11, color: c.inkSoft, max: right - left })
  }
}
