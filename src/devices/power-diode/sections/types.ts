// 第 1 章（功率二极管）的步骤设定：在各章共用的 StepBase / SectionBase 上加舞台画面、工具与图表
import type { SectionBase, StepBase } from '../../common/content'

export type { Formula, Line, Mood } from '../../common/content'

/**
 * PiN 舞台的画面
 * - apps：电力电子要什么（应用卡片 + 电压–电流对数图，Canvas）
 * - dilemma：普通 PN 结的两难（浓而短、淡而长两个结，比耐压 / 比压降，粒子舞台）
 * - result：结果，同样电流下"没有 / 有电导调制"上下并排（粒子舞台）
 * - structure：P⁺N⁻N⁺ 三层结构
 * - ohmic：正偏，假想 P⁺ 不注入空穴、只有 N⁻ 自己的电子导电（单极型的情形）
 * - reverse：反偏，N⁻ 区的电场三角形
 * - forward：正偏，P⁺ 注入空穴，电导调制
 *
 * 1.2 的各步：
 * - symbol：电气符号，与 1.1 的 P⁺N⁻N⁺ 对应
 * - section：纵向剖面图（真实比例 ↔ 舞台压缩，终端结构）
 * - to247：TO-247 单管的 3D 模型（Three.js）
 * - pressfit：平板压接型的 3D 模型（Three.js）
 * - packages：其他封装形式（实物照片 + 简图）
 */
export type PinMode =
  | 'apps' | 'dilemma' | 'structure' | 'reverse' | 'ohmic' | 'forward' | 'result'
  | 'symbol' | 'section' | 'to247' | 'pressfit' | 'packages'

/**
 * 舞台工具
 * - urev：反向电压滑块
 * - current：正向电流滑块
 * - trace：追踪一个空穴
 */
export type ToolId = 'urev' | 'current' | 'trace'

/** 舞台下方的图表：va = V-A 曲线；drop = N⁻ 区压降随电流的变化（无 / 有空穴注入） */
export type ChartId = 'va' | 'drop'

export interface Step extends StepBase {
  mode: PinMode
  tools: ToolId[]
  charts: ChartId[]
  /** 进入这一步时的反向电压（V，正值） */
  urev?: number
  /** 进入这一步时的正向电流（A） */
  current?: number
  /** V-A 曲线这一步显示哪些部分：反向段、无电导调制的欧姆直线、正向段 */
  va?: { rev?: boolean; ohmic?: boolean; fwd?: boolean }
}

export type Section = SectionBase<Step>

/** 舞台状态由章节页面持有（舞台与 V-A 曲线用同一组值） */
export interface PinState {
  /** 反向电压（V，正值） */
  urev: number
  /** 正向电流（A） */
  current: number
}
