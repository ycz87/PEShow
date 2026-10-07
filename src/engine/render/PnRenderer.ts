// PN 结主舞台渲染器（PixiJS 8）
import { Application, Container, Graphics, Particle, ParticleContainer, Text, type Texture } from 'pixi.js'
import { STYLES, colorAlpha, hexToNum, palette, type Palette, type StyleId, type ThemeId } from '../../design/tokens'
import { PN, barrier } from '../physics/pn'
import { PnBundle } from '../physics/pnBundle'
import { BINS, type SimEvent } from '../physics/pnSim'
import { carrierTexture, ionTexture, CORE } from './textures'
import { stageLayout, type Layers, type StageLayout } from './layout'
import { Circuit } from './circuit'
import { drawDrift } from './drift'
import { ElectronGroup } from './group'
import { LapDemo } from './lap'
import { Ripples } from './ripples'
import { logLevel, stageColors, type BiasInfo, type StageColors, type StageCtx } from './stage'
import { drawStrip } from './strip'
import { Tracer } from './tracer'

export type ViewMode = 'particles' | 'flow' | 'both'

export interface FlowLabels {
  diffusion: string
  drift: string
}

const ION_SPACING = 30

export class PnRenderer implements StageCtx {
  app = new Application()
  /** 并联细柱：屏幕画第 0 根（sim），统计取全体 */
  bundle: PnBundle
  playing = true
  speed = 1
  view: ViewMode = 'particles'
  layers: Layers = { field: true, potential: true, conc: false, band: false }
  /** 器件画多长（占舞台全宽的比例）：第 1 章用同一把尺对比两个结时，短的那个画得短 */
  devSpan = 1
  /** 不开电场图层时也在器件里画电场箭头（第 1 章：电场图另由舞台组件画在下方） */
  fieldArrows = false
  /** 是否显示各区平均定向速度 */
  showDrift = false
  labels: FlowLabels = { diffusion: '扩散', drift: '漂移' }
  bias: BiasInfo = { ir: 0, vRange: [PN.Vmin, PN.Vmax], high: false }
  /** 每个仿真步之前调用（暂停时不调用）：叠加交流信号时由舞台组件在这里改写 sim.V */
  beforeStep?: () => void
  /** 叠加交流信号时耗尽层宽度的摆动范围（归一化）：两侧这一段里的离子一会儿裸露、一会儿被盖住，就是 ΔQ */
  acBand: { lo: number; hi: number } | null = null
  /** 正偏叠加交流信号（扩散电容为主）时，少子小山随电压涨落：s ∈ [−1, 1] 为交流相位 sin，null 为不画 */
  acHill: number | null = null
  /** 交流小信号的电容电流：导线珠子的额外位移（珠距） */
  set capShift(v: number) {
    this.circuit.capShift = v
  }
  L!: StageLayout

  private styleId: StyleId = 'glow'
  private theme: ThemeId = 'dark'
  p!: Palette
  c!: StageColors
  private bg = new Graphics()
  private heat = new Graphics()
  private field = new Graphics()
  private fx = new Graphics()
  private strip = new Graphics()
  private flowArrows = new Graphics()
  /** 电子群与平均定向速度（画在最上层） */
  private marks = new Graphics()
  private flowText: Text[] = []
  private ionMinus!: ParticleContainer
  private ionPlus!: ParticleContainer
  private eLayer!: ParticleContainer
  private hLayer!: ParticleContainer
  private ePs: Particle[] = []
  private hPs: Particle[] = []
  private ionPs: { p: Particle; x: number; a: number }[] = []
  private ionScale = 0.5
  private ready = false
  /** 渲染时钟（真实秒） */
  time = 0

  // 追踪轨迹（画在载流子下方）与各子模块
  private trail = new Graphics()
  private ripples = new Ripples()
  private circuit = new Circuit(this)
  private tracer = new Tracer(this)
  private group = new ElectronGroup(this)
  /** "一个电子走一圈"的示意演示，画在导线之上 */
  private lap = new LapDemo(this)
  private lapG = new Graphics()

  /** perType：每种载流子的个数（第 0 章）；也可直接传入器件的 bundle（第 1 章起） */
  constructor(private host: HTMLElement, perType: number | PnBundle = 900) {
    this.bundle = typeof perType === 'number' ? new PnBundle(perType) : perType
    this.lap.onRecombine = (x, y) => this.ripples.add({ kind: 'pair', gen: false, x, y, eUid: 0, hUid: 0 }, true)
  }

  /** 屏幕上显示的那一根细柱 */
  get sim() {
    return this.bundle.view
  }

  async init(style: StyleId, theme: ThemeId, initialHeight?: number) {
    await this.app.init({
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(2, window.devicePixelRatio || 1),
      autoDensity: true,
      width: this.host.clientWidth || 800,
      height: initialHeight || this.host.clientHeight || 500,
      preference: 'webgl',
    })
    this.host.appendChild(this.app.canvas)
    this.app.stage.addChild(this.bg)
    this.ionMinus = this.makePC(true)
    this.ionPlus = this.makePC(true)
    this.eLayer = this.makePC(false)
    this.hLayer = this.makePC(false)
    const world = new Container()
    world.addChild(this.ionMinus, this.ionPlus, this.heat, this.trail, this.eLayer, this.hLayer, this.field, this.flowArrows, this.fx, this.marks)
    this.app.stage.addChild(world, this.circuit.g, this.lapG, this.strip)
    for (let i = 0; i < 4; i++) {
      const t = new Text({ text: '', style: { fontSize: 14, fontWeight: '700', fill: 0xffffff } })
      t.anchor.set(0.5)
      this.flowText.push(t)
      this.app.stage.addChild(t)
    }
    this.app.stage.addChild(...this.circuit.texts)
    this.ready = true
    this.setStyle(style, theme)
    // 临时暂停，防止 resize() 里的 frame(0) 触发 bundle.step()，
    // 此时 setJunction() 可能还没被调用，粒子坐标可能是 NaN
    const wasPlaying = this.playing
    this.playing = false
    this.resize(this.host.clientWidth, this.host.clientHeight)
    this.playing = wasPlaying
    this.app.ticker.add((tk) => this.frame(Math.min(0.05, tk.deltaMS / 1000)))
  }

  private makePC(scaleDynamic: boolean) {
    return new ParticleContainer({
      dynamicProperties: { position: true, color: true, vertex: scaleDynamic, rotation: false, uvs: false },
    })
  }

  setStyle(style: StyleId, theme: ThemeId) {
    this.styleId = style
    this.theme = theme
    this.p = palette(style, theme)
    this.c = stageColors(this.p, theme)
    if (!this.ready) return
    const def = STYLES[style]
    const dark = theme === 'dark'
    this.rebuildCarriers(carrierTexture('e', def, this.p, dark), carrierTexture('h', def, this.p, dark))
    this.rebuildIons(ionTexture('-', def, this.p), ionTexture('+', def, this.p))
    const additive = def.particle === 'glow' && dark
    this.eLayer.blendMode = additive ? 'add' : 'normal'
    this.hLayer.blendMode = additive ? 'add' : 'normal'
    for (const t of this.flowText) {
      t.style.fontFamily = def.fontBody
      t.style.fill = hexToNum(this.p.ink)
    }
    this.circuit.setFont(def.fontBody, hexToNum(this.p.ink))
  }

  setCount(perType: number) {
    this.bundle.setCount(perType)
    this.onReset()
    if (this.ready) this.setStyle(this.styleId, this.theme)
  }

  /** 重新开始演示（粒子全部重新布置） */
  reset() {
    this.bundle.reset()
    this.onReset()
  }

  private onReset() {
    this.ripples.clear()
    this.circuit.clear()
    this.tracer.reset()
    this.group.clear()
  }

  // ───────────────────────── 追踪模式 ─────────────────────────
  get trace() {
    return this.tracer.info
  }

  setTracing(on: boolean) {
    this.tracer.set(on)
  }

  /** 换一个载流子来追踪 */
  nextTrace() {
    this.tracer.pick()
  }

  // ───────────────────────── 一圈演示 ─────────────────────────
  get lapInfo() {
    return this.lap.info
  }

  startLap() {
    this.lap.start()
  }

  stopLap() {
    this.lap.stop()
  }

  // ───────────────────────── 电子群 ─────────────────────────
  /** 被标记电子还剩几个；未标记时为 null */
  get groupCount() {
    return this.group.marked ? this.group.count : null
  }

  markGroup() {
    this.group.mark()
  }

  clearGroup() {
    this.group.clear()
  }

  /** 把仿真事件分发给外电路、波纹与追踪 */
  private consume(events: SimEvent[]) {
    for (const e of events) {
      if (e.kind === 'contact') {
        this.circuit.onContact(e)
        this.tracer.onContact(e)
      } else {
        // 先问是不是被追踪者，再让追踪结束
        this.ripples.add(e, this.tracer.isTraced(e))
        this.tracer.onPair(e)
      }
    }
  }

  private rebuildCarriers(te: Texture, th: Texture) {
    for (const [pc, list, tex, cap] of [
      [this.eLayer, this.ePs, te, this.sim.electrons.cap],
      [this.hLayer, this.hPs, th, this.sim.holes.cap],
    ] as const) {
      pc.removeParticles()
      list.length = 0
      pc.texture = tex
      for (let i = 0; i < cap; i++) {
        const pt = new Particle({ texture: tex, anchorX: 0.5, anchorY: 0.5, alpha: 0 })
        list.push(pt)
        pc.addParticle(pt)
      }
    }
    this.applyScale()
  }

  private rebuildIons(tm: Texture, tp: Texture) {
    this.ionMinus.removeParticles()
    this.ionPlus.removeParticles()
    this.ionMinus.texture = tm
    this.ionPlus.texture = tp
    this.ionPs = []
    if (!this.L) return
    const { devX0, devW, devY0, devH } = this.L
    const cols = Math.max(8, Math.round(devW / ION_SPACING))
    const rows = Math.max(3, Math.round(devH / ION_SPACING))
    const [dl, dr] = this.sim.depletion
    const sites: { x: number; y: number; minus: boolean }[] = []
    for (const g of this.sim.regions) {
      const minus = g.kind === 'p'
      if (g.ions !== undefined) {
        // 淡掺杂区：只画与多子个数相同的几个离子，沿 x 均匀、y 按黄金分割错开
        for (let i = 0; i < g.ions; i++) sites.push({ x: g.x0 + ((i + 0.5) / g.ions) * (g.x1 - g.x0), y: (i * 0.618034 + 0.31) % 1, minus })
        continue
      }
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          // 隔行错位排布，像晶格一样
          const xx = Math.min(0.999, (c + 0.5 + (r % 2) * 0.25) / cols)
          if (xx >= g.x0 && (xx < g.x1 || g.x1 >= 1)) sites.push({ x: xx, y: (r + 0.5) / rows, minus })
        }
      }
    }
    for (const { x, y, minus } of sites) {
      const pt = new Particle({
        texture: minus ? tm : tp,
        x: devX0 + x * devW,
        y: devY0 + y * devH,
        anchorX: 0.5,
        anchorY: 0.5,
        alpha: 0.2,
      })
      ;(minus ? this.ionMinus : this.ionPlus).addParticle(pt)
      // 重建（换风格 / 改尺寸）时直接取当前状态，不要从头淡入
      this.ionPs.push({ p: pt, x, a: x > dl && x < dr ? 1 : 0.2 })
    }
    this.applyScale()
  }

  private applyScale() {
    if (!this.L) return
    // 粒子少 → 画大，便于看清每一个；粒子多 → 画小，避免挤成一片
    const R = Math.max(2.8, Math.min(12, (this.L.devW / 230) * Math.pow(900 / this.sim.drawTarget, 0.4)))
    const s = R / CORE
    for (const pt of this.ePs) { pt.scaleX = pt.scaleY = s }
    for (const pt of this.hPs) { pt.scaleX = pt.scaleY = s }
    this.ionScale = Math.max(0.46, Math.min(0.6, this.L.devW / 1900))
    for (const ion of this.ionPs) this.styleIon(ion)
    this.eLayer.update()
    this.hLayer.update()
    this.ionMinus.update()
    this.ionPlus.update()
  }

  resize(w: number, h: number) {
    if (!this.ready || w < 10 || h < 10) return
    this.app.renderer.resize(w, h)
    const L = stageLayout(w, h, this.layers)
    this.L = { ...L, devW: L.devW * this.devSpan }
    const H = this.L.devH / this.L.devW
    const old = this.sim.H
    if (Math.abs(old - H) > 1e-4) {
      const k = H / old
      for (const P of [this.sim.electrons, this.sim.holes]) for (let i = 0; i < P.cap; i++) P.y[i] *= k
      this.tracer.scaleY(k)
      this.group.scaleY(k)
      this.sim.H = H
    }
    this.lap.resized()
    this.setStyle(this.styleId, this.theme)
    this.frame(0)
    this.app.render()
  }

  setLayers(l: Layers) {
    this.layers = { ...l }
    this.resize(this.host.clientWidth, this.host.clientHeight)
  }

  /** 手动推进若干秒并立即渲染（调试 / 录制模式逐帧导出用） */
  advance(seconds: number, fps = 30) {
    const n = Math.max(1, Math.round(seconds * fps))
    for (let i = 0; i < n; i++) this.frame(1 / fps)
    this.app.render()
  }

  // ───────────────────────── 每帧 ─────────────────────────
  private frame(dt: number) {
    if (!this.L) return
    this.time += dt
    if (this.playing && dt > 0) {
      this.beforeStep?.()
      this.bundle.step(dt * this.speed)
    }
    const events = this.sim.events
    this.sim.events = []
    this.consume(events)
    this.tracer.update()
    this.group.update()
    // 特效按真实时间衰减（慢放时也保持可读的节奏），暂停时冻结
    const fdt = this.playing ? dt : 0
    this.ripples.update(fdt)
    this.circuit.update(dt, fdt)
    this.lap.update(fdt)
    const showP = this.view !== 'flow'
    const showF = this.view !== 'particles'
    this.drawBackground()
    this.drawIons(dt)
    this.drawCarriers(showP)
    this.heat.clear()
    this.flowArrows.clear()
    for (const t of this.flowText) t.visible = false
    if (showF) this.drawFlow(this.view === 'both')
    this.drawField()
    this.drawFx(showP)
    this.marks.clear()
    if (showP) this.group.draw(this.marks)
    if (this.showDrift) drawDrift(this.marks, this)
    this.circuit.draw()
    this.lap.draw(this.lapG)
    drawStrip(this.strip, this)
  }

  X(x: number) { return this.L.devX0 + x * this.L.devW }

  private drawBackground() {
    const { devY0, devH, devW, devX0 } = this.L
    const g = this.bg
    const p = this.p
    const def = STYLES[this.styleId]
    const dark = this.theme === 'dark'
    const [dl, dr] = this.sim.depletion
    g.clear()
    const regionA = def.particle === 'sticker' ? (dark ? 0.24 : 0.55) : dark ? 0.13 : 0.16
    // 各掺杂区的底色：重掺杂更深、淡掺杂更浅（按掺杂水平的对数）
    for (const r of this.sim.regions) {
      const a = regionA * Math.min(2, Math.max(0.3, 1 + 0.35 * Math.log2(r.level)))
      g.rect(this.X(r.x0), devY0, (r.x1 - r.x0) * devW, devH).fill({ color: hexToNum(r.kind === 'p' ? p.pRegion : p.nRegion), alpha: a })
    }
    // 耗尽层：载流子被"抽空"的区域，用更浅的底色 + 边界虚线表示；大注入时结区里充满载流子，只留虚线
    const xl = this.X(dl)
    const xr = this.X(dr)
    if (!this.bias.high) g.rect(xl, devY0, xr - xl, devH).fill({ color: hexToNum(dark ? '#000000' : '#FFFFFF'), alpha: dark ? 0.22 : 0.45 })
    if (this.acBand) this.drawPlates(g, xl, xr)
    if (this.acHill !== null) this.drawHills(g, xl, xr, this.acHill)
    this.dashedV(g, xl, devY0, devY0 + devH, hexToNum(p.inkSoft), 0.8)
    this.dashedV(g, xr, devY0, devY0 + devH, hexToNum(p.inkSoft), 0.8)
    // 掺杂区之间的分界（冶金结）
    const rs = this.sim.regions
    for (let k = 1; k < rs.length; k++) g.moveTo(this.X(rs[k].x0), devY0).lineTo(this.X(rs[k].x0), devY0 + devH)
    g.stroke({ width: 1.5, color: hexToNum(p.ink), alpha: 0.35 })
    // 外框与金属电极
    const bw = def.borderWidth
    g.rect(devX0, devY0, devW, devH).stroke({ width: Math.max(1.5, bw), color: hexToNum(p.line), alpha: Math.min(1, colorAlpha(p.line) * 2.5) })
    const cw = 9
    const metal = hexToNum(dark ? '#C9D3E6' : '#8C98AE')
    g.roundRect(devX0 - cw - 3, devY0 - 4, cw, devH + 8, 3).fill({ color: metal }).stroke({ width: bw > 1 ? 2 : 1, color: hexToNum(p.line) })
    g.roundRect(devX0 + devW + 3, devY0 - 4, cw, devH + 8, 3).fill({ color: metal }).stroke({ width: bw > 1 ? 2 : 1, color: hexToNum(p.line) })
  }

  /** 势垒电容的两块"极板"：边界摆动的范围淡淡铺色（P 侧为受主负离子、N 侧为施主正离子），当前边界画成半透明的板 */
  private drawPlates(g: Graphics, xl: number, xr: number) {
    const { devY0, devH } = this.L
    const { lo, hi } = this.acBand!
    const neg = hexToNum(this.p.ionMinus)
    const pos = hexToNum(this.p.ionPlus)
    g.rect(this.X(0.5 - hi / 2), devY0, ((hi - lo) / 2) * this.L.devW, devH).fill({ color: neg, alpha: 0.16 })
    g.rect(this.X(0.5 + lo / 2), devY0, ((hi - lo) / 2) * this.L.devW, devH).fill({ color: pos, alpha: 0.16 })
    const t = 7
    g.roundRect(xl - t, devY0 + 2, t, devH - 4, 3).fill({ color: neg, alpha: 0.45 })
    g.roundRect(xr, devY0 + 2, t, devH - 4, 3).fill({ color: pos, alpha: 0.45 })
  }

  /**
   * 扩散电容的"蓄水池"（示意）：结两侧的少子小山按扩散长度向外衰减，高度随交流相位涨落。
   * P 侧是注入的电子、N 侧是注入的空穴；按列画半透明的竖条，越靠近结越浓
   */
  private drawHills(g: Graphics, xl: number, xr: number, s: number) {
    const { devY0, devH, devW } = this.L
    const k = 1 + 0.55 * s
    const step = 4
    for (const [kind, edge, dir] of [[0, xl, -1], [1, xr, 1]] as const) {
      const Lpx = this.sim.diffusionLength(kind) * devW
      const color = hexToNum(kind === 0 ? this.p.electron : this.p.hole)
      for (let d = 0; d < 3 * Lpx; d += step) {
        const a = 0.42 * k * Math.exp(-d / Lpx)
        const h = devH * Math.min(1, 0.7 * k * Math.exp(-d / Lpx))
        const x = edge + dir * d - (dir < 0 ? step : 0)
        if (x < this.L.devX0 || x > this.L.devX0 + devW) break
        g.rect(x, devY0 + devH - h, step, h).fill({ color, alpha: a })
      }
    }
  }

  private dashedV(g: Graphics, x: number, y0: number, y1: number, color: number, alpha: number) {
    for (let y = y0; y < y1; y += 10) g.moveTo(x, y).lineTo(x, Math.min(y1, y + 5))
    g.stroke({ width: 1.5, color, alpha })
  }

  private drawIons(dt: number) {
    const [dl, dr] = this.sim.depletion
    const k = Math.min(1, dt * 6)
    for (const ion of this.ionPs) {
      const exposed = ion.x > dl && ion.x < dr
      const target = exposed ? 1 : 0.2
      ion.a += (target - ion.a) * k
      this.styleIon(ion)
    }
  }

  /** 中性区的离子被载流子"中和"，淡而小；裸露在耗尽层里时变大变亮，像一堵电荷墙 */
  private styleIon(ion: { p: Particle; a: number }) {
    ion.p.alpha = ion.a
    ion.p.scaleX = ion.p.scaleY = this.ionScale * (0.78 + 0.32 * ion.a)
  }

  private drawCarriers(show: boolean) {
    const { devY0, devH, devX0, devW } = this.L
    const H = this.sim.H
    const base = this.view === 'both' ? 0.75 : 1
    // 追踪模式与一圈演示：其余载流子降为 25 % 不透明度，被追踪的那个另画高亮
    const dim = (this.tracer.on && this.tracer.info) || this.lap.active ? 0.25 : 1
    for (const [P, list] of [[this.sim.electrons, this.ePs], [this.sim.holes, this.hPs]] as const) {
      for (let i = 0; i < list.length; i++) {
        const pt = list[i]
        if (show && P.alive[i]) {
          pt.alpha = base * dim
          pt.x = devX0 + P.x[i] * devW
          pt.y = devY0 + (P.y[i] / H) * devH
        } else pt.alpha = 0
      }
    }
  }

  Y(y: number) { return this.L.devY0 + (y / this.sim.H) * this.L.devH }

  private drawFx(show: boolean) {
    this.fx.clear()
    this.trail.clear()
    if (!show) return
    this.ripples.draw(this.fx, this)
    this.tracer.draw(this.trail, this.fx)
  }

  private drawField() {
    const g = this.field
    g.clear()
    if (!this.layers.field && !this.fieldArrows) return
    const { devY0, devH } = this.L
    const [f0, f1] = this.sim.fieldSpan
    const w = f1 - f0
    if (w < 0.01) return
    const color = hexToNum(this.p.field)
    const rows = Math.max(3, Math.round(devH / 46))
    const cols = Math.max(2, Math.round((w * this.L.devW) / 26))
    const maxLen = 30
    const pulse = 0.75 + 0.25 * Math.sin(this.time * 3)
    for (let r = 0; r < rows; r++) {
      const y = devY0 + ((r + 0.5) / rows) * devH
      for (let c = 0; c < cols; c++) {
        const x = f0 + ((c + 0.5) / cols) * w
        const E = this.sim.fieldRel(x)
        // 箭头方向随场的正负：PN 结里由 N 指向 P（−x 方向）
        const d = E < 0 ? -1 : 1
        const len = Math.max(5, Math.abs(E) * maxLen * 1.6)
        const cx = this.X(x)
        const x0 = cx - (d * len) / 2
        const x1 = cx + (d * len) / 2
        g.moveTo(x0, y).lineTo(x1 - d * 4, y).stroke({ width: 2.4, color, alpha: 0.9 * pulse, cap: 'round' })
        g.poly([x1, y, x1 - d * 7, y - 4.2, x1 - d * 7, y + 4.2]).fill({ color, alpha: 0.95 * pulse })
      }
    }
  }

  /** 箭头 + 浓度模式：上半为电子浓度，下半为空穴浓度；结区画扩散流与漂移流箭头 */
  private drawFlow(overlay: boolean) {
    const g = this.heat
    const { devY0, devH, devW } = this.L
    const maj = this.bundle.majorityPerBin
    const bw = devW / BINS
    const lane = devH / 2
    const aMax = overlay ? 0.35 : 0.85
    const ce = hexToNum(this.p.electron)
    const ch = hexToNum(this.p.hole)
    for (let b = 0; b < BINS; b++) {
      const x = this.X(b / BINS)
      const vn = logLevel(this.bundle.nHist[b] / maj)
      const vp = logLevel(this.bundle.pHist[b] / maj)
      g.rect(x, devY0, bw + 0.5, lane).fill({ color: ce, alpha: 0.04 + aMax * vn })
      g.rect(x, devY0 + lane, bw + 0.5, lane).fill({ color: ch, alpha: 0.04 + aMax * vp })
    }
    // 扩散流 ∝ e^{−B}；漂移流（热产生的少子被扫过）∝ 少子浓度 ∝ e^{−B_eq}，不随偏压变化、随温度升高而增大。
    // 平衡时二者相等；长度按相对 25 °C 平衡值的对数画
    const { V, formation, j } = this.sim
    const base = Math.min(110, devW * 0.09)
    const len = (B: number) => base * Math.min(2.6, Math.max(0.12, 1 + 0.32 * Math.log2(Math.exp(PN.B0 - B))))
    const lenDiff = len(barrier(V, formation, j))
    const lenDrift = formation < 0.05 ? 0 : len(barrier(0, 1, j))
    const cx = this.X(0.5)
    const fg = this.flowArrows
    const ink = hexToNum(this.p.line)
    const arrow = (y: number, dir: 1 | -1, len: number, color: number, idx: number, label: string) => {
      if (len < 2) return
      const x0 = cx - (dir * len) / 2
      const x1 = cx + (dir * len) / 2
      const t = 9
      const head = 16
      const pts = [
        x0, y - t / 2, x1 - dir * head, y - t / 2, x1 - dir * head, y - t, x1, y,
        x1 - dir * head, y + t, x1 - dir * head, y + t / 2, x0, y + t / 2,
      ]
      fg.poly(pts).fill({ color, alpha: 0.95 }).stroke({ width: 2, color: ink, alpha: 0.85, join: 'round' })
      const tx = this.flowText[idx]
      tx.visible = true
      tx.text = label
      tx.x = cx
      tx.y = y - 19
    }
    // 电子：扩散 N→P（向左），漂移 P→N（向右）；空穴相反
    arrow(devY0 + lane * 0.38, -1, lenDiff, ce, 0, this.labels.diffusion)
    arrow(devY0 + lane * 0.78, 1, lenDrift, ce, 1, this.labels.drift)
    arrow(devY0 + lane * 1.32, 1, lenDiff, ch, 2, this.labels.diffusion)
    arrow(devY0 + lane * 1.72, -1, lenDrift, ch, 3, this.labels.drift)
  }

  destroy() {
    this.app.destroy(true, { children: true, texture: true })
  }
}
