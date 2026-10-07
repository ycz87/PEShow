// 第 1 章 Canvas 画布（1.1-1）共用的类型与小工具
import type { CanvasColors } from '../canvasDraw'
import type { Sprites } from '../textures'

/** 画布上的文字（由舞台按当前语言填好） */
export const PIN_LABEL_KEYS = [
  // 应用
  'appDrive', 'appDriveSub', 'appEv', 'appEvSub', 'appPv', 'appPvSub', 'mapU', 'mapI', 'everyday', 'power', 'ladder', 'mapGap', 'mapKey', 'pn0', 'vBat', 'vCar', 'vGrid', 'vBus', 'vEv',
] as const
export type PinLabels = Record<(typeof PIN_LABEL_KEYS)[number], string>

export interface PinCtx {
  g: CanvasRenderingContext2D
  w: number
  h: number
  c: CanvasColors
  img: Sprites
  L: PinLabels
  /** 鼠标在画布上的位置（CSS 像素），不在画布上时为 null */
  pointer: { x: number; y: number } | null
}

/** 一种画面：update 按舞台时间推进（暂停时 dt = 0），draw 每帧重画 */
export interface PinScene {
  update(dt: number): void
  draw(ctx: PinCtx): void
}

/** 数字的上标写法：1.3×10¹⁴ */
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹'
/** 整数指数的上标：-3 → ⁻³ */
export const sup = (e: number) => String(e).replace('-', '⁻').replace(/\d/g, (d) => SUP[+d])
export function sci(v: number, digits = 1) {
  if (v === 0) return '0'
  const e = Math.floor(Math.log10(Math.abs(v)))
  return `${(v / 10 ** e).toFixed(digits)}×10${sup(e)}`
}
