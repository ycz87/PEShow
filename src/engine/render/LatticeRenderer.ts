// 晶格舞台渲染器（Canvas 2D）：相机拉远、载流子贴图、产生 / 复合波纹、空穴放大镜。
// 原子只有几百个，不需要 WebGL；Canvas 2D 画虚线、文字和裁剪更方便。
import { STYLES, palette, signalColors, type SignalColors, type StyleId, type ThemeId } from '../../design/tokens'
import { clamp, smoothstep } from '../math'
import { kelvin } from '../physics/pn'
import type { DisplayTarget } from '../physics/doping'
import { Lattice, VIEW, ZOOM, type LatticeCfg } from '../physics/lattice'
import { CanvasStage } from './canvasStage'
import { RIPPLE_LIFE, RIPPLE_MAX, rippleRings } from './ripples'
import { drawSprite, spriteSheet, type Sprites } from './textures'
import { drawElectrodes, drawHops, drawLattice, holePos, type Box, type LatticeColors, type View } from './latticeDraw'

/** 拉远动画时长（真实秒）；拉远后视野边长是原来的 3 倍 */
const ZOOM_T = 2.5
const ZOOM_K = ZOOM.W / VIEW.W
/** 晶格视图四周留白（格）：左右要放电极 */
const PAD = { x: 0.9, y: 0.3 }
/** 放大镜：半径（像素）、放大后每格像素数、跟随死区（格）、目标消失后多久关闭（秒）、点选半径（像素） */
const LENS_R = 115
const LENS_S = 35
const LENS_DEAD = 1.2
const LENS_CLOSE = 1.5
const PICK_PX = 20
/** 热振动振幅（格）：∝ √T，25 °C 时 0.035 */
const VIB = 0.035
/** 每个仿真子步最长（舞台秒） */
const SUB_DT = 1 / 30

interface Ripple {
  x: number
  y: number
  age: number
  color: string
  /** 产生：向内收缩（吸热）；复合、电离：向外扩散 */
  inward: boolean
}

export interface LensLabels {
  title: string
  gone: string
}

export class LatticeRenderer extends CanvasStage {
  sim: Lattice
  /** 允许点选空穴，打开放大镜 */
  lensEnabled = false
  labels: LensLabels = { title: '', gone: '' }

  /** 拉远进度（线性 0→1） */
  private zp = 0
  private c!: LatticeColors
  private sig!: SignalColors
  private img!: Sprites
  private ripples: Ripple[] = []
  private lens: { id: number; cx: number; cy: number; gone: number; right: boolean; bottom: boolean } | null = null
  private target: { tC: number; t: DisplayTarget }

  constructor(host: HTMLElement, cfg: LatticeCfg, tC: number, t: DisplayTarget) {
    super(host)
    this.target = { tC, t }
    this.sim = this.fresh(cfg)
    this.canvas.addEventListener('pointerdown', this.onPointer)
  }

  setStyle(style: StyleId, theme: ThemeId) {
    const p = palette(style, theme)
    const st = STYLES[style]
    this.c = {
      ink: p.ink, inkSoft: p.inkSoft, line: p.line, bg: p.bg, electron: p.electron, hole: p.hole, field: p.field,
      potential: p.potential, ionPlus: p.ionPlus, ionMinus: p.ionMinus, sticker: st.particle === 'sticker', font: st.fontBody,
    }
    this.sig = signalColors(theme)
    this.img = spriteSheet(style, theme)
  }

  /**
   * 换一步：画面设定没变只更新温度、浓度；从晶格视图进入拉远视图时就地扩展晶格并播放拉远动画；
   * 其他情况重建（已经拉远时直接停在拉远视图，例如拉远后切换杂质种类）
   */
  setScene(cfg: LatticeCfg, tC: number, t: DisplayTarget) {
    this.target = { tC, t }
    const o = this.sim.cfg
    const same = o.dopant === cfg.dopant && o.many === cfg.many && o.hop === cfg.hop && o.field === cfg.field
    if (same && o.zoom === cfg.zoom) {
      this.sim.retarget(tC, t)
      return
    }
    if (same && !o.zoom && cfg.zoom) {
      this.sim.expand()
      this.sim.retarget(tC, t)
      this.sim.fill()
      this.zp = 0
      return
    }
    const stayZoomed = o.zoom && cfg.zoom
    this.sim = this.fresh(cfg)
    if (stayZoomed) this.zp = 1
  }

  /** 温度、浓度变化 */
  retarget(tC: number, t: DisplayTarget) {
    this.target = { tC, t }
    this.sim.retarget(tC, t)
  }

  reset() {
    this.sim = this.fresh(this.sim.cfg)
  }

  private fresh(cfg: LatticeCfg) {
    const L = new Lattice(cfg)
    L.build(this.target.tC, this.target.t)
    this.zp = 0
    this.ripples = []
    this.lens = null
    return L
  }

  protected frame(dt: number) {
    const L = this.sim
    if (this.playing) {
      const total = dt * this.speed
      const n = Math.ceil(total / SUB_DT)
      for (let k = 0; k < n; k++) L.step(total / n)
    }
    for (const e of L.events) {
      if (e.kind === 'ionize') {
        this.ripples.push({ x: e.x, y: e.y, age: 0, color: L.cfg.dopant === 'B' ? this.c.ionMinus : this.c.ionPlus, inward: false })
      } else if (this.ripples.length < RIPPLE_MAX) {
        const gen = e.kind === 'gen'
        this.ripples.push({ x: e.x, y: e.y, age: 0, color: gen ? this.sig.heatIn : this.sig.heatOut, inward: gen })
      }
    }
    L.events.length = 0
    // 波纹与放大镜按真实时间变化，暂停时冻结
    const fdt = this.playing ? dt : 0
    for (const r of this.ripples) r.age += fdt
    this.ripples = this.ripples.filter((r) => r.age < RIPPLE_LIFE)
    if (L.cfg.zoom) this.zp = Math.min(1, this.zp + dt / ZOOM_T)
    this.updateLens(fdt)
    this.canvas.style.cursor = this.lensReady() ? 'pointer' : ''
    this.draw()
  }

  /** 当前相机：视野中心固定，边长按拉远进度在 1 倍与 3 倍之间按几何比例插值 */
  private camera(): View {
    const zoomed = this.sim.cfg.zoom
    const k = ZOOM_K ** (zoomed ? smoothstep(this.zp) : 0)
    const cx = (VIEW.W - 1) / 2 + (zoomed ? ZOOM.ox : 0)
    const cy = (VIEW.H - 1) / 2 + (zoomed ? ZOOM.oy : 0)
    const s = Math.min(this.w / ((VIEW.W + 2 * PAD.x) * k), this.h / ((VIEW.H + 2 * PAD.y) * k))
    return { s, ox: this.w / 2 - cx * s, oy: this.h / 2 - cy * s }
  }

  /** 原子、键淡出的程度：0 = 晶格视图，1 = 粒子视图 */
  private fade() {
    return this.sim.cfg.zoom ? smoothstep(clamp(this.zp * 1.25, 0, 1)) : 0
  }

  private lensReady() {
    return this.lensEnabled && this.sim.cfg.zoom && this.zp >= 1
  }

  private amp() {
    return VIB * Math.sqrt(Math.max(0, kelvin(this.sim.tC)) / 298)
  }

  /** 载流子贴图：本体半径 rc（像素） */
  private sprite(img: HTMLCanvasElement, x: number, y: number, rc: number) {
    drawSprite(this.g, img, x, y, rc)
  }

  private draw() {
    const { g, c } = this
    const L = this.sim
    this.clear()
    const v = this.camera()
    const X = (x: number) => v.ox + x * v.s
    const Y = (y: number) => v.oy + y * v.s
    const box: Box = {
      i0: Math.floor(-v.ox / v.s),
      i1: Math.ceil((this.w - v.ox) / v.s),
      j0: Math.floor(-v.oy / v.s),
      j1: Math.ceil((this.h - v.oy) / v.s),
    }
    const f = this.fade()
    if (L.cfg.field) drawElectrodes(g, L, v, c, L.fieldOn)
    if (f < 0.99) {
      g.globalAlpha = 1 - f
      drawLattice(g, L, v, box, c, L.time, this.amp())
      g.globalAlpha = 1
    }
    if (L.cfg.hop) drawHops(g, L, v, c)

    const rc = Math.max(5, 0.16 * v.s)
    for (const e of L.electrons) this.sprite(this.img.e, X(e.x), Y(e.y), rc)
    // 空穴画在电子上层（空心圆环套住重叠的电子）
    if (f > 0.01) {
      // 粒子视图：空穴画成和 PN 结舞台一样的小圆点，电离杂质画成 ⊕ / ⊖
      g.globalAlpha = f
      for (const d of L.dopants) if (d.ionized) this.sprite(this.img[d.kind === 'P' ? '+' : '-'], X(d.i), Y(d.j), rc)
      for (const h of L.holes) {
        if (h.bound) continue
        const [x, y] = holePos(h)
        this.sprite(this.img.h, X(x), Y(y), rc)
      }
      g.globalAlpha = 1
    }

    const R = Math.max(12, Math.min(30, 0.5 * v.s))
    g.lineWidth = 2.4
    for (const r of this.ripples) {
      g.strokeStyle = r.color
      for (const ring of rippleRings(r.age, r.inward, R)) {
        g.globalAlpha = ring.alpha
        g.beginPath()
        g.arc(X(r.x), Y(r.y), ring.r, 0, Math.PI * 2)
        g.stroke()
      }
    }
    g.globalAlpha = 1
    this.drawLens(v)
  }

  // ───────────── 空穴放大镜 ─────────────

  private onPointer = (ev: PointerEvent) => {
    if (!this.lensReady()) return
    const box = this.canvas.getBoundingClientRect()
    const px = ev.clientX - box.left
    const py = ev.clientY - box.top
    const v = this.camera()
    let best: { id: number; x: number; y: number } | null = null
    let bd = PICK_PX
    for (const h of this.sim.holes) {
      if (h.bound) continue
      const [x, y] = holePos(h)
      const d = Math.hypot(v.ox + x * v.s - px, v.oy + y * v.s - py)
      if (d < bd) {
        bd = d
        best = { id: h.id, x, y }
      }
    }
    if (best) {
      const hx = v.ox + best.x * v.s
      const hy = v.oy + best.y * v.s
      // 放大镜放在与空穴相对的角上
      this.lens = { id: best.id, cx: best.x, cy: best.y, gone: -1, right: hx < this.w / 2, bottom: hy < this.h / 2 }
    } else if (this.lens) {
      const [lx, ly] = this.lensCenter()
      if (Math.hypot(px - lx, py - ly) < this.lensR()) this.lens = null
    }
  }

  private lensR() {
    return Math.min(LENS_R, this.h * 0.32)
  }

  private lensCenter(): [number, number] {
    const l = this.lens!
    const R = this.lensR() + 12
    return [l.right ? this.w - R : R, l.bottom ? this.h - R : R]
  }

  private updateLens(dt: number) {
    const l = this.lens
    if (!l) return
    if (!this.lensReady()) {
      this.lens = null
      return
    }
    const h = this.sim.holes.find((o) => o.id === l.id)
    if (!h) {
      l.gone = Math.max(0, l.gone) + dt
      if (l.gone > LENS_CLOSE) this.lens = null
      return
    }
    // 镜头跟随空穴，但留一个死区，免得画面随每一跳晃动
    const [x, y] = holePos(h)
    l.cx = Math.min(x + LENS_DEAD, Math.max(x - LENS_DEAD, l.cx))
    l.cy = Math.min(y + LENS_DEAD, Math.max(y - LENS_DEAD, l.cy))
    // 空穴走进放大镜后面时，把放大镜换到另一侧
    const v = this.camera()
    const [lx, ly] = this.lensCenter()
    if (Math.hypot(v.ox + x * v.s - lx, v.oy + y * v.s - ly) < this.lensR() + 20) {
      l.right = !l.right
      l.bottom = !l.bottom
    }
  }

  private drawLens(v: View) {
    const l = this.lens
    if (!l) return
    const { g, c } = this
    const L = this.sim
    const R = this.lensR()
    const [lx, ly] = this.lensCenter()
    const h = L.holes.find((o) => o.id === l.id)
    const [hx, hy] = h ? holePos(h) : [l.cx, l.cy]
    const sx = v.ox + hx * v.s
    const sy = v.oy + hy * v.s

    // 引线：从空穴指向放大镜边缘
    const a = Math.atan2(sy - ly, sx - lx)
    g.strokeStyle = c.hole
    g.lineWidth = 1.6
    g.globalAlpha = 0.7
    g.beginPath()
    g.moveTo(lx + R * Math.cos(a), ly + R * Math.sin(a))
    g.lineTo(sx, sy)
    g.stroke()
    g.globalAlpha = 1
    g.beginPath()
    g.arc(sx, sy, Math.max(7, 0.25 * v.s), 0, Math.PI * 2)
    g.stroke()

    g.save()
    g.beginPath()
    g.arc(lx, ly, R, 0, Math.PI * 2)
    g.fillStyle = c.bg
    g.fill()
    g.clip()
    const lv: View = { s: LENS_S, ox: lx - l.cx * LENS_S, oy: ly - l.cy * LENS_S }
    const n = R / LENS_S + 1
    drawLattice(g, L, lv, { i0: Math.floor(l.cx - n), i1: Math.ceil(l.cx + n), j0: Math.floor(l.cy - n), j1: Math.ceil(l.cy + n) }, c, L.time, this.amp())
    for (const e of L.electrons) {
      const ex = lv.ox + e.x * LENS_S
      const ey = lv.oy + e.y * LENS_S
      if (Math.hypot(ex - lx, ey - ly) < R + 10) this.sprite(this.img.e, ex, ey, 0.16 * LENS_S)
    }
    if (l.gone >= 0) {
      g.fillStyle = c.bg
      g.globalAlpha = 0.85
      g.fillRect(lx - R, ly + R * 0.35, 2 * R, R * 0.4)
      g.globalAlpha = 1
      g.fillStyle = this.sig.heatOut
      g.font = `700 13px ${c.font}`
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(this.labels.gone, lx, ly + R * 0.55, 2 * R - 16)
    }
    g.restore()

    g.strokeStyle = c.hole
    g.lineWidth = 3
    g.beginPath()
    g.arc(lx, ly, R, 0, Math.PI * 2)
    g.stroke()
    g.fillStyle = c.inkSoft
    g.font = `600 12px ${c.font}`
    g.textAlign = 'center'
    g.textBaseline = l.bottom ? 'bottom' : 'top'
    g.fillText(this.labels.title, lx, l.bottom ? ly - R - 4 : ly + R + 4)
  }

  destroy() {
    this.canvas.removeEventListener('pointerdown', this.onPointer)
    super.destroy()
  }
}
