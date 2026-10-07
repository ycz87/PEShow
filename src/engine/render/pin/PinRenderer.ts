// 1.1-1 的画布（Canvas 2D）：应用卡片 + 耐压–电流双对数图，统一处理配色与鼠标位置。
// 其余各步（普通 PN 结的两难、器件本身）用第 0 章的粒子舞台，见 PinDilemmaStage.vue、PinDeviceStage.vue
import type { StyleId, ThemeId } from '../../../design/tokens'
import { CanvasStage } from '../canvasStage'
import { canvasColors, type CanvasColors } from '../canvasDraw'
import { spriteSheet, type Sprites } from '../textures'
import { AppsScene } from './apps'
import type { PinLabels } from './common'

export class PinRenderer extends CanvasStage {
  private c!: CanvasColors
  private img!: Sprites
  private scene = new AppsScene()
  private pointer: { x: number; y: number } | null = null

  constructor(host: HTMLElement, public labels: PinLabels) {
    super(host)
    this.canvas.addEventListener('pointermove', this.onMove)
    this.canvas.addEventListener('pointerleave', this.onLeave)
  }

  private onMove = (e: PointerEvent) => {
    const r = this.canvas.getBoundingClientRect()
    this.pointer = { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  private onLeave = () => (this.pointer = null)

  setStyle(style: StyleId, theme: ThemeId) {
    this.c = canvasColors(style, theme)
    this.img = spriteSheet(style, theme)
  }

  /** 重新开始：入场动画从头播放 */
  reset() {
    this.scene = new AppsScene()
  }

  protected frame(dt: number) {
    this.scene.update(this.playing ? dt * this.speed : 0)
    this.clear()
    this.scene.draw({ g: this.g, w: this.w, h: this.h, c: this.c, img: this.img, L: this.labels, pointer: this.pointer })
  }

  destroy() {
    this.canvas.removeEventListener('pointermove', this.onMove)
    this.canvas.removeEventListener('pointerleave', this.onLeave)
    super.destroy()
  }
}
