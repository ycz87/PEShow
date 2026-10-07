// 击穿舞台渲染器（Canvas 2D）：按模式切换画面（认识击穿 / 雪崩 / 齐纳 / 对比 / 热击穿），统一处理配色与输入
import type { StyleId, ThemeId } from '../../design/tokens'
import { canvasColors } from './canvasDraw'
import type { BreakdownMode } from '../../app/breakdown'
import { CanvasStage } from './canvasStage'
import { spriteSheet, type Sprites } from './textures'
import { AvalancheScene } from './breakdown/avalanche'
import { CompareScene } from './breakdown/compare'
import { IntroScene } from './breakdown/intro'
import { ThermalScene } from './breakdown/thermal'
import { TunnelScene } from './breakdown/tunnel'
import type { BdColors, BdInput, BdLabels, Scene } from './breakdown/common'

const SCENES: Record<BreakdownMode, () => Scene> = {
  intro: () => new IntroScene(),
  avalanche: () => new AvalancheScene(),
  zener: () => new TunnelScene(),
  compare: () => new CompareScene(),
  thermal: () => new ThermalScene(),
}

export class BreakdownRenderer extends CanvasStage {
  private c!: BdColors
  private img!: Sprites
  private scene: Scene

  constructor(host: HTMLElement, private mode: BreakdownMode, private input: BdInput, public labels: BdLabels) {
    super(host)
    this.scene = SCENES[mode]()
  }

  setStyle(style: StyleId, theme: ThemeId) {
    this.c = canvasColors(style, theme)
    this.img = spriteSheet(style, theme)
  }

  setMode(mode: BreakdownMode) {
    if (mode === this.mode) return
    this.mode = mode
    this.scene = SCENES[mode]()
  }

  setInput(p: Partial<BdInput>) {
    this.input = { ...this.input, ...p }
  }

  reset() {
    this.scene.reset()
  }

  /** 雪崩画面的统计（注入 → 流出） */
  get stats() {
    return this.scene instanceof AvalancheScene ? this.scene.stats : null
  }

  /** 热击穿画面的结温与是否损坏 */
  get thermal() {
    return this.scene instanceof ThermalScene ? { Tj: this.scene.Tj, burnt: this.scene.burnt } : null
  }

  protected frame(dt: number) {
    this.scene.update(this.playing ? dt * this.speed : 0, this.input)
    this.clear()
    this.scene.draw({ g: this.g, w: this.w, h: this.h, c: this.c, img: this.img, L: this.labels }, this.input)
  }
}
