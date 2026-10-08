// 1.2-2 剖面图的数据与排版（纯函数，便于测试）。
// 两列芯片：示例 PiN（1.1 的舞台，非穿通，厚衬底工艺）与真实的 1200 V 级产品（薄片、穿通型）。
// 滑块 t：0 是真实比例（两列同一把尺，每微米的像素相同），1 是 1.1 舞台的压缩比例（半导体各层按舞台的宽度比分配）。
//
// 厚度来源（讲解稿「剖面图的数值」）：正面金属约 3 µm、N⁻ 约 85–100 µm（Lutz 等）、薄片工艺整片约 120 µm、
// 厚衬底工艺 N⁺ 衬底 220–300 µm（Infineon SIDC81D120H6 芯片手册、Semikron CAL 技术说明）。
// P 阳极、场截止层、N⁺ 阴极、背面金属的厚度各厂差别很大，这里只取量级。
import { PIN_SIM } from '../../engine/physics/pinSim'

export type LayerId = 'metalF' | 'p' | 'nm' | 'fs' | 'np' | 'metalB'
export type ColumnId = 'pin' | 'real'

export interface LayerSpec {
  id: LayerId
  /** 真实比例下的厚度（µm） */
  um: number
  /** 压缩成舞台比例时，在半导体各层中占的份额（金属层不参与，固定画成很薄的一条） */
  share: number
}

export interface ColumnSpec {
  id: ColumnId
  /** 自正面（阳极）到背面（阴极） */
  layers: LayerSpec[]
}

/** 示例 PiN 的舞台比例取自 PIN_SIM：P⁺ 占 XA，N⁻ 占 XK − XA，N⁺ 占 1 − XK */
const { XA, XK } = PIN_SIM

export const COLUMNS: ColumnSpec[] = [
  {
    id: 'pin',
    layers: [
      { id: 'metalF', um: 3, share: 0 },
      { id: 'p', um: 3, share: XA * 100 },
      { id: 'nm', um: 120, share: (XK - XA) * 100 },
      { id: 'np', um: 220, share: (1 - XK) * 100 },
      { id: 'metalB', um: 1, share: 0 },
    ],
  },
  {
    id: 'real',
    layers: [
      { id: 'metalF', um: 3, share: 0 },
      { id: 'p', um: 3, share: 14 },
      { id: 'nm', um: 95, share: 62 },
      { id: 'fs', um: 15, share: 10 },
      { id: 'np', um: 2, share: 14 },
      { id: 'metalB', um: 1, share: 0 },
    ],
  },
]

export const totalUm = (c: ColumnSpec) => c.layers.reduce((s, l) => s + l.um, 0)

/** 两列共用的真实比例尺：以示例 PiN（较厚的一列）的总厚度为准 */
export const REF_UM = totalUm(COLUMNS[0])

/** 压缩比例下金属层的高度（像素），只是薄薄的一条 */
const METAL_PX = 2

export interface Placed {
  id: LayerId
  /** 层的上沿、高度、中线（像素，自正面起算） */
  y: number
  h: number
  mid: number
}

/** 某一列在滑块位置 t（0 真实、1 压缩）时各层的位置；totalH 是真实比例下示例 PiN 那一列的总高度 */
export function place(col: ColumnSpec, t: number, totalH: number): Placed[] {
  const k = totalH / REF_UM
  const semi = col.layers.filter((l) => l.share > 0)
  const shareSum = semi.reduce((s, l) => s + l.share, 0)
  const semiH = totalH - 2 * METAL_PX
  let y = 0
  return col.layers.map((l) => {
    const real = l.um * k
    const stage = l.share > 0 ? (semiH * l.share) / shareSum : METAL_PX
    const h = (1 - t) * real + t * stage
    const p = { id: l.id, y, h, mid: y + h / 2 }
    y += h
    return p
  })
}

/**
 * 把一列标签的纵向位置摊开：标签想对齐各层的中线，太挤就往下推，推到底再往上让；每个标签占 gap 的高度。
 * 输入按自上而下排好，输出同序
 */
export function spreadLabels(want: number[], gap: number, lo: number, hi: number): number[] {
  const ys = want.map((y) => Math.max(y, lo))
  for (let i = 1; i < ys.length; i++) ys[i] = Math.max(ys[i], ys[i - 1] + gap)
  const over = (ys.at(-1) ?? 0) - hi
  if (over > 0) {
    ys[ys.length - 1] -= over
    for (let i = ys.length - 2; i >= 0; i--) ys[i] = Math.min(ys[i], ys[i + 1] - gap)
  }
  return ys
}

/**
 * 电场形状的示意轮廓（不是计算结果）：返回 (横向幅度, 纵向位置) 的多边形顶点，幅度 0 在叠层的边上，emax 是最大幅度。
 *  - 非穿通：三角形，结处最强，在 N⁻ 内部降到 0
 *  - 穿通：梯形，N⁻ 底部还有电场，由更浓的场截止层很快截住
 */
export function fieldShape(kind: 'npt' | 'pt', placed: Placed[], emax: number): [number, number][] {
  const nm = placed.find((p) => p.id === 'nm')!
  const yj = nm.y
  if (kind === 'npt') return [[0, yj], [emax, yj], [0, yj + 0.9 * nm.h]]
  const fs = placed.find((p) => p.id === 'fs')!
  return [[0, yj], [emax, yj], [0.4 * emax, nm.y + nm.h], [0, fs.y + 0.7 * fs.h]]
}
