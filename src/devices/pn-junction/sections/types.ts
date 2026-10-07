// 第 0 章（PN 结）的步骤设定：在各章共用的 StepBase / SectionBase 上加舞台、工具与图表。
import type { Layers } from '../../../engine/render/layout'
import type { SectionBase, StepBase } from '../../common/content'

export type { Formula, Line, Mood } from '../../common/content'

/** 舞台场景：晶格（0.1–0.2）、PN 结粒子舞台（0.3–0.8）、击穿示意（0.6） */
export type SceneId = 'lattice' | 'junction' | 'breakdown'

/**
 * 某一步在舞台工具栏里提供的工具（只在需要它的步骤出现，避免一开始就把所有按钮摆出来）
 * - temp：温度滑块
 * - group：标记一群电子（扩散演示）
 * - drift：各区平均定向速度
 * - lap：示意演示"一个电子走一圈"（预先编排，不是仿真结果）
 * - yzoom：V-A 曲线纵轴放大
 * - logI：V-A 曲线线性 / 对数纵轴切换（进入这一步时用哪种见 Step.viLog）
 * - ac：叠加交流小信号
 * - magnifier：空穴放大镜
 * - hop / efield / dope：晶格场景的单步跳、电场开关、掺杂开关与浓度
 * - device / limit：击穿场景的示例器件切换、限流与散热
 * 动态特性（0.8）的换流按钮与 I_F、di/dt 滑块由 Step.switching 决定，不在这里列
 */
export type ToolId =
  | 'temp'
  | 'group'
  | 'drift'
  | 'lap'
  | 'yzoom'
  | 'logI'
  | 'ac'
  | 'magnifier'
  | 'hop'
  | 'efield'
  | 'dope'
  | 'device'
  | 'limit'

/** 舞台下方的图表 */
/** scope 跟着舞台的换流过程画；scopeOn、scopeOff 画同一组条件下开通、关断的完整波形（0.8-6 对比） */
export type ChartId = 'ni' | 'vi' | 'cv' | 'scope' | 'scopeOn' | 'scopeOff' | 'circuit' | 'trajectory' | 'zener'

/** 晶格场景（0.1–0.2）这一步的画面设定 */
export interface LatticeCue {
  /** 掺杂：无 / 磷 / 硼 */
  dopant: 'none' | 'P' | 'B'
  /** 多个杂质原子（0.2-3 起）；否则只替换中央一个 */
  many?: boolean
  /** 进入这一步时的掺杂浓度 log₁₀(N / cm⁻³)，默认 16 */
  conc?: number
  /** 加左右电极与电场 */
  field?: boolean
  /** 只看一个空穴，单步演示价电子跳进空位 */
  hop?: boolean
  /** 镜头拉远，晶格淡出成粒子视图 */
  zoomOut?: boolean
}

/** 击穿场景（0.6）这一步的画面设定 */
export interface BreakdownCue {
  mode: 'intro' | 'avalanche' | 'zener' | 'compare' | 'thermal'
}

/** 动态特性（0.8）这一步的画面设定 */
export interface SwitchCue {
  mode: 'intro' | 'on' | 'off' | 'peak' | 'recover' | 'compare' | 'vi'
}

export interface Step extends StepBase {
  scene: SceneId
  /** 进入这一步时的默认电压（V）；不写则保持当前电压 */
  bias?: number
  /** 是否播放"结的形成"过程 */
  formation?: boolean
  /** 电压滑块范围（V） */
  vRange?: [number, number]
  /** 进入这一步时的温度（°C），默认 25 */
  T?: number
  tools: ToolId[]
  charts: ChartId[]
  /** 进入这一步时打开的图层（未列出的保持关闭） */
  layers?: Partial<Layers>
  /** 进入时自动开启追踪（反偏时追踪器优先挑耗尽层边缘的少子） */
  autoTrace?: boolean
  /** 进入时 V-A 曲线用对数纵轴 |I|（默认线性） */
  viLog?: boolean
  /** C-V 曲线加上扩散电容 C_d 与结电容 C_T（纵轴改为对数）；默认只画势垒电容 C_j（线性纵轴） */
  cvDiffusion?: boolean
  /** 舞台角落的小插图：tube = 细柱示意（0.3、0.4 开头） */
  inset?: 'tube'
  lattice?: LatticeCue
  breakdown?: BreakdownCue
  switching?: SwitchCue
}

export interface Section extends SectionBase<Step> {
  /** V-A 曲线已解锁到哪一段（0.3 起常驻） */
  vi?: 'axes' | 'fwd' | 'rev' | 'full'
}
