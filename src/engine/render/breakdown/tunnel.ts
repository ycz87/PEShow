// 齐纳击穿（1N4728A，两侧重掺杂）。两种画面共用同一批隧穿事件：
//  - 座位视角：极薄的耗尽层里，价电子要变成自由电子，得横穿一段"禁带之墙"（宽 d ≈ E_g/q𝓔，只有几纳米）。
//    电子不加速、不碰撞，从 P 侧的座位直接出现在墙的另一边，座位上留下空穴；每次都是独立的，不会一传二。
//  - 能带视角：P 区价带顶高过 N 区导带底时出现"隧穿窗口"，窗口里的价带电子在同一能量上横穿禁带到达 N 区导带。
// 隧穿画成虚线的"消失—出现"：真实电子在禁带里没有确定的轨迹
import { junctionAt } from '../../physics/pn'
import { ZENERS, potentialAt, vbi, type Depletion, type ZenerSpec } from '../../physics/breakdown'
import { rgba } from '../../../design/tokens'
import { lengthText } from '../../../app/format'
import { clamp } from '../../math'
import { drawSeats } from './seats'
import { REGION_A, biasGeom, dash, dimension, sprite, text, type BdCtx, type BdInput, type Scene } from './common'

/** 隧穿事件：每秒 RATE·I/I_ZT 个（舞台秒） */
const RATE = 4
/** 一次隧穿的三段用时：走到禁带边、穿过、在 N 区导带里离开（舞台秒） */
const T_IN = 0.7
const T_CROSS = 0.45
const T_OUT = 1.4
/** 空穴向左离开的用时 */
const T_HOLE = 1.8
const MAX_EVENTS = 24

interface Tunnel {
  E: number
  /** 座位视角里的高度（0…1） */
  y: number
  /** 出发点（cm）与已用时间 */
  xs: number
  t: number
}

interface Geo {
  d: ZenerSpec
  g: Depletion
  Eg: number
  Vtot: number
  /** 中性区里 E_F 离带边的距离（eV） */
  delta: number
  I: number
}

export class TunnelScene implements Scene {
  private events: Tunnel[] = []
  private acc = 0

  reset() {
    this.events = []
    this.acc = 0
  }

  private geo(inp: BdInput): Geo {
    const d = ZENERS[inp.device]
    const { op, g } = biasGeom(d, inp.vr, inp.T)
    const Eg = junctionAt(inp.T).Eg
    return { d, g, Eg, Vtot: g.Vtot, delta: (Eg - vbi(d)) / 2, I: op.I }
  }

  update(dt: number, inp: BdInput) {
    if (dt <= 0) return
    const q = this.geo(inp)
    for (const e of this.events) e.t += dt
    this.events = this.events.filter((e) => e.t < T_IN + T_CROSS + Math.max(T_OUT, T_HOLE))
    const open = q.Vtot - q.Eg
    if (open <= 0.02) return
    this.acc += dt * RATE * (q.I / q.d.IZT)
    while (this.acc >= 1) {
      this.acc -= 1
      if (this.events.length >= MAX_EVENTS) continue
      // 能量取在窗口中部附近（三角分布）：那里禁带的水平宽度最小，隧穿最容易
      const u = (Math.random() + Math.random()) / 2
      const E = -q.Eg - open * (0.1 + 0.8 * u)
      this.events.push({ E, y: 0.08 + Math.random() * 0.84, xs: -q.g.xp - (6 + Math.random() * 10) * 1e-7, t: 0 })
    }
  }

  draw(ctx: BdCtx, inp: BdInput) {
    if (inp.view === 'band') this.drawBand(ctx, inp)
    else this.drawSpace(ctx, inp)
  }

  // ───────────── 座位视角 ─────────────
  private drawSpace(ctx: BdCtx, inp: BdInput) {
    const { w, h, c, L, g: G, img } = ctx
    const q = this.geo(inp)
    const { d, g, Eg, Vtot } = q
    // 比例尺与能带视角相同：按 1.1 U_Z、25 °C 固定，拖动滑块时画面不跳
    const ref = biasGeom(d, 1.1 * d.VZ, 25).g
    const half = ref.W / 2 + 20e-7
    const left = 30
    const right = w - 20
    const X = (x: number) => left + ((x + half) / (2 * half)) * (right - left)
    const band = { t: 48, b: h - 84 }
    const Yb = (y: number) => band.t + y * (band.b - band.t)
    const a = X(-g.xp)
    const b = X(g.xn)

    G.fillStyle = rgba(c.pRegion, REGION_A)
    G.fillRect(left, band.t, a - left, band.b - band.t)
    G.fillStyle = rgba(c.nRegion, REGION_A)
    G.fillRect(b, band.t, right - b, band.b - band.t)
    G.fillStyle = rgba(c.field, 0.08)
    G.fillRect(a, band.t, b - a, band.b - band.t)
    drawSeats(ctx, { l: left, t: band.t, r: right, b: band.b }, 24)
    G.strokeStyle = rgba(c.ink, 0.45)
    G.lineWidth = 1.2
    G.strokeRect(left, band.t, right - left, band.b - band.t)
    text(ctx, 'P⁺', (left + a) / 2, band.t + 16, { size: 13, weight: 700, align: 'center', color: c.pRegion })
    text(ctx, 'N⁺', (b + right) / 2, band.t + 16, { size: 13, weight: 700, align: 'center', color: c.nRegion })
    dimension(ctx, a, b, band.t - 10, L.scr.replace('{w}', lengthText(g.W)), c.potential)

    // 禁带之墙：窗口中部那个能量上，从 P 侧价带边到 N 侧导带边的水平距离
    const open = Vtot - Eg > 0.02
    if (open) {
      const Em = -(Vtot + Eg) / 2
      const xa = X(xAt(d, g, -Em - Eg))
      const xb = X(xAt(d, g, -Em))
      G.save()
      G.beginPath()
      G.rect(xa, band.t, xb - xa, band.b - band.t)
      G.clip()
      G.fillStyle = rgba(c.inkSoft, 0.3)
      G.fillRect(xa, band.t, xb - xa, band.b - band.t)
      G.strokeStyle = rgba(c.ink, 0.25)
      G.lineWidth = 1.2
      G.beginPath()
      for (let k = band.t - (xb - xa); k < band.b; k += 9) {
        G.moveTo(xa, k + (xb - xa))
        G.lineTo(xb, k)
      }
      G.stroke()
      G.restore()
      G.strokeStyle = rgba(c.ink, 0.6)
      G.lineWidth = 1.4
      dash(G, true, [4, 3])
      G.beginPath()
      G.moveTo(xa, band.t)
      G.lineTo(xa, band.b)
      G.moveTo(xb, band.t)
      G.lineTo(xb, band.b)
      G.stroke()
      dash(G, false)
      const dn = Math.abs(xAt(d, g, -Em) - xAt(d, g, -Em - Eg)) * 1e7
      text(ctx, L.wall.replace('{d}', dn.toFixed(1)), (xa + xb) / 2, band.b + 16, { size: 12.5, weight: 800, align: 'center', color: c.ink })
      text(ctx, L.wallNote, (xa + xb) / 2, band.b + 34, { size: 11.5, align: 'center', color: c.inkSoft })
    } else {
      G.fillStyle = rgba(c.bg, 0.8)
      G.fillRect((left + right) / 2 - 190, (band.t + band.b) / 2 - 16, 380, 32)
      text(ctx, L.closed, (left + right) / 2, (band.t + band.b) / 2, { size: 12.5, weight: 700, align: 'center', color: c.ink, max: 370 })
    }

    // 隧穿事件：座位上的电子被强电场"拽住"→ 穿过墙出现在另一边 → 电子向 N 区、空穴向 P 区离开
    // 空穴（空心圆环）最后画，盖在电子上层
    const holes: [number, number, number][] = []
    for (const e of this.events) {
      const xa = X(xAt(d, g, -e.E - Eg))
      const xb = X(xAt(d, g, -e.E))
      const y = Yb(e.y)
      if (e.t < T_IN) {
        const s = e.t / T_IN
        G.strokeStyle = rgba(c.accent, 0.9 * s)
        G.lineWidth = 2
        G.beginPath()
        G.arc(xa, y, 9 + 3 * Math.sin(s * Math.PI * 3), 0, Math.PI * 2)
        G.stroke()
        sprite(ctx, img.e, xa, y, 6)
        continue
      }
      const tc = e.t - T_IN
      const sh = clamp((tc - T_CROSS) / T_HOLE, 0, 1)
      if (sh < 1) holes.push([xa + (left - xa) * sh, y, 1 - Math.max(0, sh - 0.8) * 5])
      if (tc < T_CROSS) {
        const s = tc / T_CROSS
        G.strokeStyle = rgba(c.electron, 0.85)
        G.lineWidth = 1.8
        dash(G, true, [3, 3])
        G.beginPath()
        G.moveTo(xa, y)
        G.quadraticCurveTo((xa + xb) / 2, y - 16, xb, y)
        G.stroke()
        dash(G, false)
        G.globalAlpha = 1 - s
        sprite(ctx, img.e, xa, y, 6)
        G.globalAlpha = s
        sprite(ctx, img.e, xb, y, 6)
        G.globalAlpha = 1
        continue
      }
      const so = (tc - T_CROSS) / T_OUT
      if (so >= 1) continue
      G.globalAlpha = 1 - Math.max(0, so - 0.8) * 5
      sprite(ctx, img.e, xb + (right - xb) * so, y, 6)
      G.globalAlpha = 1
    }
    for (const [x, y, a] of holes) {
      G.globalAlpha = a
      sprite(ctx, img.h, x, y, 6)
    }
    G.globalAlpha = 1
    text(ctx, L.noAccel, left + 8, band.b - 12, { size: 11.5, color: c.inkSoft })
    // 与雪崩管对比耗尽层宽度（同一画宽）
    const av = ZENERS['1N4757A']
    const wAv = biasGeom(av, av.VZ, 25).g.W
    text(ctx, L.scaleCmp.replace('{w}', lengthText(wAv)).replace('{k}', `${Math.round(wAv / g.W)}`), left, h - 14, { size: 11, color: c.inkSoft, max: right - left })
  }

  // ───────────── 能带视角 ─────────────
  private drawBand(ctx: BdCtx, inp: BdInput) {
    const { w, h, c, L, g: G, img } = ctx
    const q = this.geo(inp)
    const { d, g, Eg, Vtot, delta } = q
    // 比例尺按 1.1 U_Z、25 °C 固定，拖动滑块时画面不跳
    const ref = biasGeom(d, 1.1 * d.VZ, 25).g
    const Eg25 = junctionAt(25).Eg
    const half = ref.W / 2 + 20e-7
    const left = 74
    const right = w - 110
    const top = 56
    const bot = h - 48
    const E_HI = 0.6
    const E_LO = -(ref.Vtot + Eg25) - 0.5
    const X = (x: number) => left + ((x + half) / (2 * half)) * (right - left)
    const Y = (E: number) => top + ((E_HI - E) / (E_HI - E_LO)) * (bot - top)
    const Ec = (x: number) => -potentialAt(d, g, x)
    const a = X(-g.xp)
    const b = X(g.xn)

    // 区域底色
    G.fillStyle = rgba(c.pRegion, REGION_A)
    G.fillRect(left, top, a - left, bot - top)
    G.fillStyle = rgba(c.nRegion, REGION_A)
    G.fillRect(b, top, right - b, bot - top)
    text(ctx, 'P⁺', (left + a) / 2, top + 14, { size: 13, weight: 700, align: 'center', color: c.pRegion })
    text(ctx, 'N⁺', (b + right) / 2, top + 14, { size: 13, weight: 700, align: 'center', color: c.nRegion })
    dimension(ctx, a, b, top - 12, L.scr.replace('{w}', lengthText(g.W)), c.potential)

    // 能带：导带底以上、价带顶以下着色（价带填满电子）
    const N = 160
    const xsamp = Array.from({ length: N + 1 }, (_, i) => -half + (i / N) * 2 * half)
    G.beginPath()
    G.moveTo(left, top)
    for (const x of xsamp) G.lineTo(X(x), Y(Ec(x)))
    G.lineTo(right, top)
    G.closePath()
    G.fillStyle = rgba(c.electron, 0.07)
    G.fill()
    G.beginPath()
    G.moveTo(left, bot)
    for (const x of xsamp) G.lineTo(X(x), Y(Ec(x) - Eg))
    G.lineTo(right, bot)
    G.closePath()
    G.fillStyle = rgba(c.inkSoft, 0.2)
    G.fill()

    // 隧穿窗口：−U_tot < E < −E_g 的能量范围内，价带边与导带边之间的禁带
    const open = Vtot - Eg > 0.02
    if (open) {
      const K = 24
      const lo: [number, number][] = []
      const hi: [number, number][] = []
      for (let i = 0; i <= K; i++) {
        const E = -Eg - (i / K) * (Vtot - Eg)
        lo.push([X(xAt(d, g, -E - Eg)), Y(E)])
        hi.push([X(xAt(d, g, -E)), Y(E)])
      }
      G.beginPath()
      lo.forEach(([x, y], i) => (i ? G.lineTo(x, y) : G.moveTo(x, y)))
      for (const [x, y] of hi.reverse()) G.lineTo(x, y)
      G.closePath()
      G.fillStyle = rgba(c.accent, 0.2)
      G.fill()
      // 窗口的能量范围（右侧括号）
      const bx = right + 14
      G.strokeStyle = c.accent
      G.lineWidth = 1.6
      G.beginPath()
      G.moveTo(bx - 5, Y(-Eg))
      G.lineTo(bx, Y(-Eg))
      G.lineTo(bx, Y(-Vtot))
      G.lineTo(bx - 5, Y(-Vtot))
      G.stroke()
      text(ctx, L.window, bx + 6, (Y(-Eg) + Y(-Vtot)) / 2, { size: 11.5, weight: 700, color: c.accent, max: w - bx - 10 })
      // 窗口中部的隧穿距离 d
      const Em = -(Vtot + Eg) / 2
      const xa = xAt(d, g, -Em - Eg)
      const xb = xAt(d, g, -Em)
      dimension(ctx, X(xa), X(xb), Y(Em) - 2, L.tunnelD.replace('{d}', ((xb - xa) * 1e7).toFixed(1)), c.ink)
    }

    // 带边
    const edge = (f: (x: number) => number, col: string, width: number, dashed = false) => {
      G.beginPath()
      xsamp.forEach((x, i) => (i ? G.lineTo(X(x), Y(f(x))) : G.moveTo(X(x), Y(f(x)))))
      G.strokeStyle = col
      G.lineWidth = width
      dash(G, dashed, [6, 4])
      G.stroke()
      dash(G, false)
    }
    if (Math.abs(inp.T - 25) >= 1) {
      edge((x) => Ec(x) - Eg25, rgba(c.ink, 0.45), 1.4, true)
      text(ctx, L.eg25, left + 6, Y(-Eg25) + 14, { size: 11, color: c.inkSoft })
    }
    edge(Ec, c.ink, 2.2)
    edge((x) => Ec(x) - Eg, c.ink, 2.2)
    text(ctx, L.Ec, left - 8, Y(0), { size: 12, weight: 700, align: 'right' })
    text(ctx, L.Ev, left - 8, Y(-Eg), { size: 12, weight: 700, align: 'right' })
    text(ctx, L.Ec, right + 8, Y(-Vtot), { size: 12, weight: 700 })
    text(ctx, L.Ev, right + 8, Y(-Vtot - Eg), { size: 12, weight: 700 })

    // 费米能级：两侧相差 qU_j
    const EFp = -Eg + delta
    const EFn = -Vtot - delta
    G.strokeStyle = c.potential
    G.lineWidth = 1.6
    dash(G, true, [3, 4])
    G.beginPath()
    G.moveTo(left, Y(EFp))
    G.lineTo(X(0), Y(EFp))
    G.moveTo(X(0), Y(EFn))
    G.lineTo(right, Y(EFn))
    G.stroke()
    dash(G, false)
    text(ctx, L.EF, left + 4, Y(EFp) - 8, { size: 11, color: c.potential, base: 'bottom' })
    const vx = X(0) + (right - X(0)) * 0.55
    G.strokeStyle = rgba(c.potential, 0.6)
    G.lineWidth = 1.2
    G.beginPath()
    G.moveTo(vx - 30, Y(EFp))
    G.lineTo(vx + 4, Y(EFp))
    G.stroke()
    G.beginPath()
    G.moveTo(vx, Y(EFp))
    G.lineTo(vx, Y(EFn))
    G.stroke()
    text(ctx, L.qV.replace('{v}', (Vtot - vbi(d)).toFixed(2)), vx + 6, (Y(EFp) + Y(EFn)) / 2 + 14, { size: 11.5, color: c.potential, weight: 700 })

    // P 区价带里的电子（满带，只画几排示意）
    const sea = Math.max(0, Math.floor((a - left - 10) / 22))
    for (let i = 0; i < sea; i++) for (let j = 0; j < 3; j++) {
      G.globalAlpha = 0.55
      sprite(ctx, img.e, left + 14 + i * 22 + (j % 2) * 11, Y(-Eg - 0.12 - j * 0.22), 4.5)
    }
    G.globalAlpha = 1

    // 隧穿事件
    const holes: [number, number, number][] = []
    for (const e of this.events) {
      const xa = xAt(d, g, -e.E - Eg)
      const xb = xAt(d, g, -e.E)
      const y = Y(e.E)
      if (e.t < T_IN) {
        const s = e.t / T_IN
        sprite(ctx, img.e, X(e.xs + (xa - e.xs) * s), y, 6)
        continue
      }
      const tc = e.t - T_IN
      // 空穴：留在原处，随后向左离开、浮到价带顶附近
      const sh = clamp((tc - T_CROSS) / T_HOLE, 0, 1)
      const hx = X(xa + (-half - xa) * sh)
      const hy = y + (Y(-Eg - 0.05) - y) * Math.min(1, sh * 2.5)
      if (sh < 1) holes.push([hx, hy, 1 - Math.max(0, sh - 0.8) * 5])
      if (tc < T_CROSS) {
        const s = tc / T_CROSS
        G.strokeStyle = rgba(c.electron, 0.8)
        G.lineWidth = 1.6
        dash(G, true, [3, 3])
        G.beginPath()
        G.moveTo(X(xa), y)
        G.lineTo(X(xb), y)
        G.stroke()
        dash(G, false)
        G.globalAlpha = 1 - s
        sprite(ctx, img.e, X(xa), y, 6)
        G.globalAlpha = s
        sprite(ctx, img.e, X(xb), y, 6)
        G.globalAlpha = 1
        continue
      }
      const so = (tc - T_CROSS) / T_OUT
      if (so >= 1) continue
      // N 区导带里：向右离开，同时弛豫到导带底附近
      const ex = X(xb + (half - xb) * so)
      const ey = y + (Y(-Vtot + 0.06) - y) * Math.min(1, so * 2)
      G.globalAlpha = 1 - Math.max(0, so - 0.8) * 5
      sprite(ctx, img.e, ex, ey, 6)
      G.globalAlpha = 1
    }

    for (const [x, y, a] of holes) {
      G.globalAlpha = a
      sprite(ctx, img.h, x, y, 6)
    }
    G.globalAlpha = 1
    // 能量轴、比例尺
    G.strokeStyle = c.ink
    G.lineWidth = 1.5
    G.beginPath()
    G.moveTo(26, bot - 10)
    G.lineTo(26, top + 30)
    G.stroke()
    G.beginPath()
    G.moveTo(26, top + 22)
    G.lineTo(21, top + 32)
    G.lineTo(31, top + 32)
    G.closePath()
    G.fillStyle = c.ink
    G.fill()
    G.save()
    G.translate(16, (top + bot) / 2)
    G.rotate(-Math.PI / 2)
    text(ctx, L.energy, 0, 0, { size: 11.5, color: c.inkSoft, align: 'center' })
    G.restore()
    const rl = X(10e-7) - X(0)
    G.strokeStyle = c.ink
    G.lineWidth = 2
    G.beginPath()
    G.moveTo(right - rl, bot + 22)
    G.lineTo(right, bot + 22)
    G.stroke()
    text(ctx, '10 nm', right - rl / 2, bot + 34, { size: 11, align: 'center' })
  }
}

/** 电势 φ(x) = phi 处的位置（cm）：φ 在耗尽层内单调上升 */
function xAt(d: ZenerSpec, g: Depletion, phi: number) {
  let lo = -g.xp
  let hi = g.xn
  for (let k = 0; k < 40; k++) {
    const m = (lo + hi) / 2
    if (potentialAt(d, g, m) < phi) lo = m
    else hi = m
  }
  return (lo + hi) / 2
}
