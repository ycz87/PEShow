// 热击穿（1N4728A，U_S = 4.0 V）：电路、正反馈环、结温计与 T_j(t)。
// 负温度系数的稳压管：结温升高 → U_Z 降低 → 电流增大 → 功耗增大 → 结温更高。限流电阻让电流几乎不随 U_Z 变，环路很弱；
// 不限流时电流只受动态电阻和电源内阻约束，环路增益 G = R_θ·dP/dT_j 明显增大，散热差时稳态越过 T_j,max，视为损坏。
// 损坏后停止积分（真实器件此时多半已短路或开路，模型不再适用），重播从 25 °C 重新开始
import { THERMAL, TJ_MAX, thermalCircuit, thermalStep, thermalSteady, type Cooling } from '../../physics/breakdown'
import { hexToNum, rgba } from '../../../design/tokens'
import { clamp } from '../../math'
import { arrow, dash, roundRect, text, type BdColors, type BdCtx, type BdInput, type Scene } from './common'

/** 结温计与曲线的纵轴（°C） */
const T_TOP = 250
/** 曲线的时间窗与采样间隔（舞台秒） */
const SPAN = 20
const SAMPLE = 0.1
/** 导线上虚线流动的速度：每安培每秒多少像素 */
const FLOW = 200
const SMOKE_MAX = 30

interface Puff {
  x: number
  y: number
  age: number
}

export class ThermalScene implements Scene {
  Tj = THERMAL.Ta
  burnt = false
  private t = 0
  private sampleAt = 0
  private trace: { t: number; T: number }[] = [{ t: 0, T: THERMAL.Ta }]
  private flow = 0
  private smoke: Puff[] = []
  private puffClock = 0
  /** 稳态与"无反馈"稳态只随开关变化，缓存起来 */
  private steadyKey = ''
  private steady: { fb: number | null; noFb: number } = { fb: null, noFb: 0 }

  reset() {
    this.Tj = THERMAL.Ta
    this.burnt = false
    this.t = 0
    this.sampleAt = 0
    this.trace = [{ t: 0, T: THERMAL.Ta }]
    this.flow = 0
    this.smoke = []
    this.puffClock = 0
  }

  update(dt: number, inp: BdInput) {
    if (dt <= 0) return
    for (const p of this.smoke) p.age += dt
    this.smoke = this.smoke.filter((p) => p.age < 3)
    if (this.burnt) {
      this.puffClock += dt
      while (this.puffClock > 0.15) {
        this.puffClock -= 0.15
        if (this.smoke.length < SMOKE_MAX) this.smoke.push({ x: (Math.random() - 0.5) * 16, y: 0, age: 0 })
      }
      return
    }
    this.Tj = thermalStep(this.Tj, dt, inp.limit, inp.cooling)
    this.t += dt
    this.flow += dt * FLOW * thermalCircuit(inp.limit, this.Tj).I
    if (this.t >= this.sampleAt) {
      this.trace.push({ t: this.t, T: this.Tj })
      this.sampleAt = this.t + SAMPLE
      while (this.trace.length > 2 && this.trace[1].t < this.t - SPAN) this.trace.shift()
    }
    if (this.Tj >= TJ_MAX) this.burnt = true
  }

  private steadyOf(limit: boolean, cooling: Cooling) {
    const key = `${limit}|${cooling}`
    if (key !== this.steadyKey) {
      this.steadyKey = key
      this.steady = { fb: thermalSteady(limit, cooling), noFb: THERMAL.Ta + THERMAL.Rth[cooling] * thermalCircuit(limit, THERMAL.Ta).P }
    }
    return this.steady
  }

  draw(ctx: BdCtx, inp: BdInput) {
    const { w, h } = ctx
    const op = thermalCircuit(inp.limit, this.Tj)
    const Rth = THERMAL.Rth[inp.cooling]
    const gain = Rth * (thermalCircuit(inp.limit, this.Tj + 0.5).P - thermalCircuit(inp.limit, this.Tj - 0.5).P)
    const colW = w * 0.46
    this.circuit(ctx, inp, op, { l: 16, r: colW, t: 34, b: h * 0.5 })
    this.loop(ctx, inp, gain, { l: 16, r: colW, t: h * 0.5 + 10, b: h - 14 })
    const th = { x: colW + 52, t: 52, b: h - 52 }
    this.thermometer(ctx, inp, th)
    this.plot(ctx, { l: th.x + 90, r: w - 22, t: th.t, b: th.b })
    if (this.burnt) {
      const { g: G, c, L } = ctx
      G.fillStyle = rgba(c.danger, 0.9)
      roundRect(G, w / 2 - 190, 6, 380, 28, 6)
      G.fill()
      text(ctx, L.burnt, w / 2, 20, { size: 13, weight: 700, color: '#FFFFFF', align: 'center', max: 360 })
    }
  }

  private circuit(ctx: BdCtx, inp: BdInput, op: ReturnType<typeof thermalCircuit>, box: { l: number; r: number; t: number; b: number }) {
    const { g: G, c, L } = ctx
    const x1 = box.l + 44
    const x2 = box.r - 70
    const y1 = box.t + 34
    const y2 = box.b - 16
    const ym = (y1 + y2) / 2
    const xm = (x1 + x2) / 2
    const zc = heat(c, this.Tj)

    // 导线（两处元件留空）
    G.strokeStyle = c.ink
    G.lineWidth = 2
    const loopPath = () => {
      G.beginPath()
      G.moveTo(x1, ym - 7)
      G.lineTo(x1, y1)
      G.lineTo(x2, y1)
      G.lineTo(x2, ym - 14)
      G.moveTo(x2, ym + 14)
      G.lineTo(x2, y2)
      G.lineTo(x1, y2)
      G.lineTo(x1, ym + 7)
    }
    loopPath()
    G.stroke()
    // 电流：沿导线流动的虚线，速度 ∝ I
    if (!this.burnt) {
      G.strokeStyle = rgba(c.accent, 0.75)
      G.lineWidth = 3
      dash(G, true, [6, 14])
      G.lineDashOffset = -this.flow
      loopPath()
      G.stroke()
      dash(G, false)
      G.lineDashOffset = 0
    }

    // 电源
    G.strokeStyle = c.ink
    G.lineWidth = 2.5
    G.beginPath()
    G.moveTo(x1 - 14, ym - 6)
    G.lineTo(x1 + 14, ym - 6)
    G.stroke()
    G.lineWidth = 4
    G.beginPath()
    G.moveTo(x1 - 8, ym + 6)
    G.lineTo(x1 + 8, ym + 6)
    G.stroke()
    text(ctx, '+', x1 - 20, ym - 12, { size: 13, weight: 700 })
    text(ctx, L.src.replace('{v}', THERMAL.VS.toFixed(1)), x1 + 20, ym, { size: 12 })

    // 限流电阻或导线
    if (inp.limit) {
      G.fillStyle = c.bg
      G.fillRect(xm - 34, y1 - 9, 68, 18)
      G.strokeStyle = c.ink
      G.lineWidth = 2
      G.beginPath()
      G.moveTo(xm - 34, y1)
      for (let i = 0; i < 6; i++) G.lineTo(xm - 28 + i * 11, y1 + (i % 2 ? 8 : -8))
      G.lineTo(xm + 34, y1)
      G.stroke()
      text(ctx, L.rLim.replace('{r}', op.R.toFixed(2)), xm, y1 - 16, { size: 12, weight: 700, align: 'center', base: 'bottom' })
    } else {
      text(ctx, L.wire.replace('{r}', `${THERMAL.Rsrc}`), xm, y1 - 10, { size: 12, weight: 700, color: c.danger, align: 'center', base: 'bottom', max: x2 - x1 })
    }
    arrow(G, xm + 44, y1 + 14, xm + 84, y1 + 14, c.accent, 2, 8)
    text(ctx, `I = ${(op.I * 1000).toFixed(0)} mA`, xm + 64, y1 + 26, { size: 12, weight: 700, color: c.accent, align: 'center', base: 'top' })

    // 稳压管：阴极朝上，反向接入；颜色随结温
    G.fillStyle = this.burnt ? rgba(c.ink, 0.75) : zc
    G.strokeStyle = c.ink
    G.lineWidth = 2
    G.beginPath()
    G.moveTo(x2 - 13, ym + 12)
    G.lineTo(x2 + 13, ym + 12)
    G.lineTo(x2, ym - 12)
    G.closePath()
    G.fill()
    G.stroke()
    G.beginPath()
    G.moveTo(x2 - 18, ym - 18)
    G.lineTo(x2 - 13, ym - 12)
    G.lineTo(x2 + 13, ym - 12)
    G.lineTo(x2 + 18, ym - 6)
    G.stroke()
    text(ctx, THERMAL.device, x2 - 24, ym, { size: 11.5, weight: 700, align: 'right' })
    // 发热：波纹的强度 ∝ P（1 W 满）
    const pa = clamp(op.P, 0, 1)
    if (!this.burnt && pa > 0.02) {
      G.strokeStyle = rgba(c.warm, 0.25 + 0.75 * pa)
      G.lineWidth = 1.8
      for (let k = 0; k < 3; k++) {
        const x = x2 + 26 + k * 9
        G.beginPath()
        for (let i = 0; i <= 12; i++) {
          const y = ym - 16 + i * 2.7
          const dx = Math.sin(i * 0.9 + this.flow * 0.05 + k) * 3
          i ? G.lineTo(x + dx, y) : G.moveTo(x + dx, y)
        }
        G.stroke()
      }
    }
    text(ctx, `P = ${op.P.toFixed(2)} W`, x2 + 22, ym + 30, { size: 12, weight: 700, color: c.warm })
    for (const p of this.smoke) {
      const s = p.age / 3
      G.fillStyle = rgba(c.inkSoft, 0.35 * (1 - s))
      G.beginPath()
      G.arc(x2 + p.x + Math.sin(p.age * 3) * 6, ym - 20 - p.age * 28, 5 + 10 * s, 0, Math.PI * 2)
      G.fill()
    }
  }

  private loop(ctx: BdCtx, inp: BdInput, gain: number, box: { l: number; r: number; t: number; b: number }) {
    const { g: G, c, L } = ctx
    const cx = (box.l + box.r) / 2
    const cy = box.t + (box.b - box.t) * 0.4
    const rx = Math.min(130, (box.r - box.l) * 0.36)
    const ry = Math.min(62, (box.b - box.t) * 0.3)
    const nodes: [number, number, string][] = [
      [cx, cy - ry, L.loopP],
      [cx + rx, cy, L.loopT],
      [cx, cy + ry, L.loopV],
      [cx - rx, cy, L.loopI],
    ]
    // 箭头的粗细与浓淡 ∝ 环路增益
    const s = clamp(gain, 0, 1)
    const col = rgba(c.danger, 0.3 + 0.7 * s)
    for (let i = 0; i < 4; i++) {
      const [ax, ay] = nodes[i]
      const [bx, by] = nodes[(i + 1) % 4]
      const ux = bx - ax
      const uy = by - ay
      const pad = 0.3
      arrow(G, ax + ux * pad, ay + uy * pad, ax + ux * (1 - pad), ay + uy * (1 - pad), col, 1.5 + 3 * s, 10)
    }
    for (const [x, y, s0] of nodes) {
      G.font = `700 12px ${c.font}`
      const tw = G.measureText(s0).width + 16
      G.fillStyle = c.bg
      G.strokeStyle = rgba(c.ink, 0.5)
      G.lineWidth = 1.2
      roundRect(G, x - tw / 2, y - 12, tw, 24, 12)
      G.fill()
      G.stroke()
      text(ctx, s0, x, y, { size: 12, weight: 700, align: 'center' })
    }
    text(ctx, L.gain.replace('{g}', gain.toFixed(2)), cx, cy, { size: 12.5, weight: 700, color: col, align: 'center' })
    const st = this.steadyOf(inp.limit, inp.cooling)
    const fb = st.fb === null ? L.steadyOff : L.steady.replace('{t}', `${Math.round(st.fb)}`)
    text(ctx, `${fb}    ${L.noFb.replace('{t}', `${Math.round(st.noFb)}`)}`, cx, box.b - 30, { size: 11.5, color: c.inkSoft, align: 'center', max: box.r - box.l })
    if (inp.limit) text(ctx, L.brake, cx, box.b - 10, { size: 11.5, color: c.inkSoft, align: 'center', max: box.r - box.l })
  }

  private thermometer(ctx: BdCtx, inp: BdInput, th: { x: number; t: number; b: number }) {
    const { g: G, c, L } = ctx
    const Y = (T: number) => th.b - ((T - THERMAL.Ta) / (T_TOP - THERMAL.Ta)) * (th.b - th.t)
    const tw = 18
    G.fillStyle = rgba(c.ink, 0.06)
    G.strokeStyle = rgba(c.ink, 0.5)
    G.lineWidth = 1.5
    roundRect(G, th.x - tw / 2, th.t - 8, tw, th.b - th.t + 8, tw / 2)
    G.fill()
    G.stroke()
    const yT = Math.max(th.t - 8, Y(this.Tj))
    G.fillStyle = heat(c, this.Tj)
    roundRect(G, th.x - tw / 2 + 3, yT, tw - 6, th.b - yT, (tw - 6) / 2)
    G.fill()
    G.beginPath()
    G.arc(th.x, th.b + 12, 15, 0, Math.PI * 2)
    G.fill()
    G.strokeStyle = rgba(c.ink, 0.5)
    G.stroke()
    for (let T = 50; T <= T_TOP; T += 50) {
      G.strokeStyle = rgba(c.ink, 0.5)
      G.lineWidth = 1
      G.beginPath()
      G.moveTo(th.x - tw / 2 - 6, Y(T))
      G.lineTo(th.x - tw / 2, Y(T))
      G.stroke()
      text(ctx, `${T}`, th.x - tw / 2 - 9, Y(T), { size: 10.5, color: c.inkSoft, align: 'right', weight: 500 })
    }
    // T_j,max
    G.strokeStyle = c.danger
    G.lineWidth = 2
    G.beginPath()
    G.moveTo(th.x - tw / 2 - 4, Y(TJ_MAX))
    G.lineTo(th.x + tw / 2 + 8, Y(TJ_MAX))
    G.stroke()
    text(ctx, L.tjMax, th.x + tw / 2 + 10, Y(TJ_MAX), { size: 11, weight: 700, color: c.danger })
    // 稳态结温的刻度（超出量程时画在顶端）
    const st = this.steadyOf(inp.limit, inp.cooling).fb
    if (st !== null) {
      const ys = Math.max(th.t - 8, Y(st))
      G.fillStyle = c.ink
      G.beginPath()
      G.moveTo(th.x + tw / 2 + 2, ys)
      G.lineTo(th.x + tw / 2 + 10, ys - 5)
      G.lineTo(th.x + tw / 2 + 10, ys + 5)
      G.closePath()
      G.fill()
      text(ctx, `${Math.round(st)} °C${st > T_TOP ? ' ↑' : ''}`, th.x + tw / 2 + 13, ys + (Math.abs(ys - Y(TJ_MAX)) < 14 ? 13 : 0), { size: 11, weight: 700 })
    }
    text(ctx, `T_j = ${this.Tj.toFixed(0)} °C`, th.x, th.b + 38, { size: 13, weight: 700, align: 'center', color: heat(c, this.Tj) })
  }

  private plot(ctx: BdCtx, p: { l: number; r: number; t: number; b: number }) {
    const { g: G, c, L } = ctx
    const t0 = Math.max(0, this.t - SPAN)
    const X = (t: number) => p.l + ((t - t0) / SPAN) * (p.r - p.l)
    const Y = (T: number) => p.b - ((Math.min(T, T_TOP) - THERMAL.Ta) / (T_TOP - THERMAL.Ta)) * (p.b - p.t)
    G.strokeStyle = rgba(c.ink, 0.08)
    G.lineWidth = 1
    for (let T = 50; T <= T_TOP; T += 50) {
      G.beginPath()
      G.moveTo(p.l, Y(T))
      G.lineTo(p.r, Y(T))
      G.stroke()
    }
    G.strokeStyle = c.ink
    G.lineWidth = 1.5
    G.beginPath()
    G.moveTo(p.l, p.t - 8)
    G.lineTo(p.l, p.b)
    G.lineTo(p.r, p.b)
    G.stroke()
    for (let k = Math.ceil(t0 / 5) * 5; k <= t0 + SPAN; k += 5) {
      text(ctx, `${k}`, X(k), p.b + 12, { size: 10.5, color: c.inkSoft, align: 'center', weight: 500 })
    }
    text(ctx, L.trace, p.l + 6, p.t - 14, { size: 12, weight: 700 })
    text(ctx, L.tAxis, p.r, p.b + 28, { size: 11, color: c.inkSoft, align: 'right' })
    G.strokeStyle = c.danger
    G.lineWidth = 1.4
    dash(G, true, [6, 4])
    G.beginPath()
    G.moveTo(p.l, Y(TJ_MAX))
    G.lineTo(p.r, Y(TJ_MAX))
    G.stroke()
    dash(G, false)
    G.strokeStyle = heat(c, this.Tj)
    G.lineWidth = 2.5
    G.beginPath()
    this.trace.forEach((s, i) => (i ? G.lineTo(X(s.t), Y(s.T)) : G.moveTo(X(s.t), Y(s.T))))
    G.stroke()
    const last = this.trace[this.trace.length - 1]
    if (this.burnt) text(ctx, '✕', X(last.t), Y(last.T), { size: 18, weight: 700, color: c.danger, align: 'center' })
  }
}

/** 结温的颜色：25 °C 冷色 → 100 °C 暖色 → T_j,max 警示色 */
function heat(c: BdColors, T: number) {
  return T < 100 ? mix(c.cool, c.warm, (T - THERMAL.Ta) / (100 - THERMAL.Ta)) : mix(c.warm, c.danger, (T - 100) / (TJ_MAX - 100))
}

function mix(a: string, b: string, t: number) {
  const s = clamp(t, 0, 1)
  const p = hexToNum(a)
  const q = hexToNum(b)
  const ch = (k: number) => Math.round(((p >> k) & 255) * (1 - s) + ((q >> k) & 255) * s)
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`
}
