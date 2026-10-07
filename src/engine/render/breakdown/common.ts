// 击穿舞台（0.6）各模式共用的类型与小工具：颜色、画布文字标签、贴图、箭头与文字。
import { depletion, opPoint, type Cooling, type ZenerId, type ZenerSpec } from '../../physics/breakdown'
import { drawSprite, type Sprites } from '../textures'
import type { CanvasColors } from '../canvasDraw'

export { arrow, dash, dimension, roundRect, text } from '../canvasDraw'

/** 击穿舞台的配色即 Canvas 舞台的通用配色 */
export type BdColors = CanvasColors

/** 画布上的文字（由舞台按当前语言填好） */
export const LABEL_KEYS = [
  'scr', 'eAxis', 'xAxis', 'atVZ', 'zoom',
  'field', 'fieldDir', 'inject',
  'Ec', 'Ev', 'EF', 'window', 'tunnelD', 'qV', 'eg25', 'energy',
  'tcAxis', 'vzAxis', 'tunnelZone', 'mixedZone', 'avZone', 'colDev', 'colVZ', 'colMech', 'colTC', 'mechT', 'mechM', 'mechA',
  'lastTree', 'waitNext', 'nearMiss', 'thrE', 'thrH', 'bandNote', 'wall', 'wallNote', 'closed', 'noAccel', 'scaleCmp',
  'src', 'rLim', 'wire', 'loopP', 'loopT', 'loopV', 'loopI', 'gain', 'tjMax', 'steady', 'steadyOff', 'noFb', 'brake', 'trace', 'tAxis', 'burnt',
] as const
export type BdLabels = Record<(typeof LABEL_KEYS)[number], string>

/** 雪崩、齐纳的画面：座位视角（实际空间）或能带视角 */
export type BdView = 'space' | 'band'
/** 雪崩的注入方式：一次一个（树长完再注入下一个）或连续 */
export type InjectMode = 'one' | 'stream'

/** 舞台控件给渲染器的输入 */
export interface BdInput {
  device: ZenerId
  /** 反向电压（V，正值） */
  vr: number
  /** 页面温度（°C） */
  T: number
  limit: boolean
  cooling: Cooling
  view: BdView
  inject: InjectMode
}

export interface BdCtx {
  g: CanvasRenderingContext2D
  w: number
  h: number
  c: BdColors
  img: Sprites
  L: BdLabels
}

/** 一种画面：update 按舞台时间推进（暂停时 dt = 0），draw 每帧重画 */
export interface Scene {
  update(dt: number, inp: BdInput): void
  draw(ctx: BdCtx, inp: BdInput): void
  reset(): void
}

/** 贴图：本体半径 rc（像素） */
export function sprite(ctx: BdCtx, img: HTMLCanvasElement, x: number, y: number, rc: number) {
  drawSprite(ctx.g, img, x, y, rc)
}

/** 中性区底色的透明度 */
export const REGION_A = 0.13

/** 加反向电压 vr（V）、结温 T 时的工作点与耗尽层 */
export function biasGeom(d: ZenerSpec, vr: number, T: number) {
  const op = opPoint(d, vr, 0, T)
  return { op, g: depletion(d, op.Vj) }
}

