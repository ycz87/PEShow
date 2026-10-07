// Canvas 2D 舞台（晶格、击穿）的公共外壳：画布与设备像素比、requestAnimationFrame 循环、播放与倍速、销毁
import type { StyleId, ThemeId } from '../../design/tokens'

export abstract class CanvasStage {
  playing = true
  speed = 1

  protected readonly canvas = document.createElement('canvas')
  protected readonly g = this.canvas.getContext('2d')!
  /** 画布的 CSS 像素尺寸 */
  protected w = 0
  protected h = 0
  private dpr = 1
  private raf = 0
  private last = 0

  constructor(protected readonly host: HTMLElement) {
    host.appendChild(this.canvas)
  }

  abstract setStyle(style: StyleId, theme: ThemeId): void

  /** 推进 dt（真实秒，暂停时由子类自己忽略）并重画 */
  protected abstract frame(dt: number): void

  /** 设好配色与尺寸，开始逐帧循环 */
  init(style: StyleId, theme: ThemeId) {
    this.setStyle(style, theme)
    this.resize(this.host.clientWidth, this.host.clientHeight)
    const loop = (now: number) => {
      const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0
      this.last = now
      this.frame(dt)
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  resize(w: number, h: number) {
    this.dpr = Math.min(2, window.devicePixelRatio || 1)
    this.w = w
    this.h = h
    this.canvas.width = Math.round(w * this.dpr)
    this.canvas.height = Math.round(h * this.dpr)
    this.canvas.style.width = `${w}px`
    this.canvas.style.height = `${h}px`
  }

  /** 调试：在后台标签页（requestAnimationFrame 暂停）里手动推进 */
  advance(seconds: number, fps = 30) {
    for (let i = 0; i < Math.round(seconds * fps); i++) this.frame(1 / fps)
  }

  /** 每帧开头：清屏，坐标换成 CSS 像素 */
  protected clear() {
    this.g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    this.g.clearRect(0, 0, this.w, this.h)
  }

  destroy() {
    cancelAnimationFrame(this.raf)
    this.canvas.remove()
  }
}
