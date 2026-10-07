// 舞台各绘制模块共享的上下文：坐标映射、配色与仿真（由 PnRenderer 提供）
import { hexToNum, signalColors, type Palette, type ThemeId } from '../../design/tokens'
import type { PnBundle } from '../physics/pnBundle'
import type { PnSim } from '../physics/pnSim'
import type { StageLayout } from './layout'

export interface StageColors {
  /** 复合放热 */
  warm: number
  /** 产生吸热 */
  cool: number
  e: number
  h: number
  ink: number
  /** 舞台上小面板的底色 */
  panel: number
}

export function stageColors(p: Palette, theme: ThemeId): StageColors {
  const sig = signalColors(theme)
  return {
    warm: hexToNum(sig.heatOut),
    cool: hexToNum(sig.heatIn),
    e: hexToNum(p.electron),
    h: hexToNum(p.hole),
    ink: hexToNum(p.ink),
    panel: hexToNum(p.bg),
  }
}

/** 舞台之外、由外加电压决定的量（粒子仿真只用扣除体电阻压降后的等效结电压） */
export interface BiasInfo {
  /** 体电阻压降 IR_S（V） */
  ir: number
  /** 本步的电压范围，用来定电势图层的纵轴 */
  vRange: [number, number]
  /** 大注入：结区不再耗尽 */
  high: boolean
}

export interface StageCtx {
  /** 屏幕上显示的那一根细柱 */
  readonly sim: PnSim
  /** 全体并联细柱（统计量从这里取） */
  readonly bundle: PnBundle
  readonly L: StageLayout
  readonly p: Palette
  readonly c: StageColors
  readonly bias: BiasInfo
  /** 渲染时钟（真实秒，不随慢放变化） */
  readonly time: number
  /** 器件归一化坐标 → 画布像素 */
  X(x: number): number
  Y(y: number): number
}

/** 相对浓度 → [0,1] 的对数色阶（覆盖 3 个数量级） */
export function logLevel(rel: number) {
  if (rel <= 0) return 0
  return Math.max(0, Math.min(1, (Math.log10(rel) + 3) / 3))
}
