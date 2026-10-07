// 主舞台布局：Vue（HTML 标注）和 PixiJS（画布）共用同一套坐标，保证文字标注与图形对齐。

export type LayerKey = 'field' | 'potential' | 'conc' | 'band'
export type Layers = Record<LayerKey, boolean>
export const LAYER_ORDER: LayerKey[] = ['field', 'potential', 'conc', 'band']

export interface StageLayout {
  width: number
  height: number
  devX0: number
  devW: number
  devY0: number
  devH: number
  /** 外电路导线（顶边）的 y 坐标 */
  wireY: number
  rows: { key: LayerKey; y0: number; h: number }[]
}

const WEIGHT: Record<LayerKey, number> = { field: 1, potential: 1, conc: 1.15, band: 2 }

/** 区域标签所需的上边距 */
function labelMargin(width: number) {
  return Math.round(Math.max(44, Math.min(56, width * 0.06)))
}
/** 外电路（导线 + 电池 + 计数器）所占的高度 */
const CIRCUIT_H = 50
function topMargin(width: number) {
  return labelMargin(width) + CIRCUIT_H
}
function stripUnit(width: number) {
  return Math.min(84, Math.max(58, width * 0.085))
}
function stripTotal(width: number, layers: Layers) {
  const enabled = LAYER_ORDER.filter((k) => layers[k])
  return enabled.length ? enabled.reduce((a, k) => a + WEIGHT[k], 0) * stripUnit(width) + 14 : 0
}

/** 由宽度与图层决定舞台高度：器件区高度只随宽度变化，打开图层时舞台向下长高，器件区不被挤压 */
export function stageHeight(width: number, layers: Layers) {
  const devH = Math.min(440, Math.max(260, width * 0.44))
  return Math.round(topMargin(width) + devH + stripTotal(width, layers) + 18)
}

export function stageLayout(width: number, height: number, layers: Layers): StageLayout {
  const padX = Math.round(Math.max(26, width * 0.035))
  const top = topMargin(width)
  const unit = stripUnit(width)
  const stripH = stripTotal(width, layers)
  const devY0 = top
  const devH = Math.max(120, height - top - stripH - 18)
  const rows: StageLayout['rows'] = []
  let y = devY0 + devH + 14
  for (const k of LAYER_ORDER) {
    if (!layers[k]) continue
    const h = WEIGHT[k] * unit
    rows.push({ key: k, y0: y, h: h - 8 })
    y += h
  }
  return { width, height, devX0: padX, devW: width - 2 * padX, devY0, devH, wireY: 30, rows }
}
