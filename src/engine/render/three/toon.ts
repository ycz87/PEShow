// 3D 卡通着色：三档色阶的 MeshToonMaterial + 粗描边。
// 描边有两种做法：带棱角的形体（方块、棱柱）用 EdgesGeometry 画折痕线，再用 LineSegments2 加粗；
// 圆管（键合线）没有折痕，用"反向外壳"（放大一圈、只画背面）勾出轮廓。
// 所有颜色来自设计令牌（design/tokens.ts），换风格 / 换深浅主题时调用 setStyle 一次性重上色。
import * as THREE from 'three'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { palette, signalColors, type StyleId, type ThemeId } from '../../../design/tokens'

/** 零件的颜色槽：模型里只写槽名，具体颜色由风格与主题决定 */
export type ColorKey = 'copper' | 'plastic' | 'solder' | 'aluminum' | 'p' | 'nMinus' | 'nPlus' | 'sink' | 'pad' | 'ceramic' | 'moly' | 'coat' | 'heat' | 'force'

/** 一个零件用到的全部材质，便于整体变暗 / 高亮 */
export interface PartMats {
  fills: THREE.MeshToonMaterial[]
  lines: LineMaterial[]
  hulls: THREE.MeshBasicMaterial[]
}

export const newMats = (): PartMats => ({ fills: [], lines: [], hulls: [] })

/** 零件的显示状态：normal 正常，ghost 半透明（看里面），dim 淡出（别的零件被选中时），focus 被选中 */
export type PartState = 'normal' | 'ghost' | 'dim' | 'focus'

const OPACITY: Record<PartState, number> = { normal: 1, ghost: 0.2, dim: 0.28, focus: 1 }

let ramp: THREE.DataTexture | undefined
/** 三档色阶：暗部、中间、亮部（Nearest 过滤，色块分明） */
function toonRamp() {
  if (!ramp) {
    ramp = new THREE.DataTexture(new Uint8Array([120, 185, 255]), 3, 1, THREE.RedFormat)
    ramp.minFilter = ramp.magFilter = THREE.NearestFilter
    ramp.generateMipmaps = false
    ramp.needsUpdate = true
  }
  return ramp
}

export class ToonKit {
  /** 画布尺寸（像素），LineMaterial 需要它来把线宽换算成像素 */
  readonly resolution = new THREE.Vector2(1, 1)
  readonly colors = {} as Record<ColorKey, THREE.Color>
  readonly ink = new THREE.Color()
  readonly accent = new THREE.Color()
  private lineWidth = 2
  private fills: { mat: THREE.MeshToonMaterial; key: ColorKey }[] = []
  private lines: LineMaterial[] = []
  private hulls: THREE.MeshBasicMaterial[] = []

  constructor(style: StyleId, theme: ThemeId) {
    this.setStyle(style, theme)
  }

  /** 换风格 / 主题：所有已创建的材质一起重上色 */
  setStyle(style: StyleId, theme: ThemeId) {
    const p = palette(style, theme)
    const dark = theme === 'dark'
    const mix = (hex: string, to: string, t: number) => new THREE.Color(hex).lerp(new THREE.Color(to), t)
    Object.assign(this.colors, {
      copper: new THREE.Color(dark ? '#EBA573' : '#E08C45'),
      plastic: new THREE.Color(dark ? '#4A5273' : '#4B5472'),
      solder: new THREE.Color(dark ? '#CDD5E8' : '#B8C0D2'),
      aluminum: new THREE.Color(dark ? '#EEF2FA' : '#CDD6E6'),
      p: new THREE.Color(p.pRegion),
      nMinus: mix(p.nRegion, '#ffffff', 0.45),
      nPlus: new THREE.Color(p.nRegion),
      sink: new THREE.Color(dark ? '#8FA3C8' : '#9AAAC8'),
      pad: new THREE.Color(dark ? '#9CE3C0' : '#7CCFA6'),
      ceramic: new THREE.Color(dark ? '#F1E9D8' : '#EADFC4'),
      moly: new THREE.Color(dark ? '#9FA8BD' : '#8A93A8'),
      coat: new THREE.Color(dark ? '#EBC76A' : '#D9A93A'),
      heat: new THREE.Color(signalColors(theme).heatOut),
      force: new THREE.Color(dark ? '#A794FF' : '#7A55E0'),
    })
    // sticker 风格用深色粗描边；glow、chalk 用文字色细描边
    this.ink.set(style === 'sticker' ? p.line : p.ink)
    this.accent.set(p.accent)
    this.lineWidth = style === 'sticker' ? 3 : 2
    for (const f of this.fills) f.mat.color.copy(this.colors[f.key])
    for (const l of this.lines) {
      l.color.copy(this.ink)
      if (!l.dashed) l.linewidth = this.lineWidth
    }
    for (const h of this.hulls) h.color.copy(this.ink)
  }

  /** 新建一个卡通填充材质（登记后随风格变色） */
  fill(key: ColorKey, mats?: PartMats): THREE.MeshToonMaterial {
    const mat = new THREE.MeshToonMaterial({ color: this.colors[key], gradientMap: toonRamp() })
    // 把面稍微往后推，免得描边线被自己的面压住
    mat.polygonOffset = true
    mat.polygonOffsetFactor = 1
    mat.polygonOffsetUnits = 1
    this.fills.push({ mat, key })
    mats?.fills.push(mat)
    return mat
  }

  private line(mats?: PartMats): LineMaterial {
    const mat = new LineMaterial({ color: this.ink.getHex(), linewidth: this.lineWidth, worldUnits: false })
    mat.resolution = this.resolution
    this.lines.push(mat)
    mats?.lines.push(mat)
    return mat
  }

  /** 带棱角的实心形体：填充面 + 折痕描边。angle 为折痕角度阈值（度） */
  solid(geo: THREE.BufferGeometry, key: ColorKey, mats?: PartMats, angle = 30): THREE.Mesh {
    const mesh = new THREE.Mesh(geo, this.fill(key, mats))
    const edges = new LineSegmentsGeometry().fromEdgesGeometry(new THREE.EdgesGeometry(geo, angle))
    mesh.add(new LineSegments2(edges, this.line(mats)))
    return mesh
  }

  /** 一条虚线（爆炸图里表示"装回去的路径"），随风格变色 */
  guide(a: THREE.Vector3, b: THREE.Vector3): LineSegments2 {
    const geo = new LineSegmentsGeometry().setPositions([a.x, a.y, a.z, b.x, b.y, b.z])
    const mat = this.line()
    mat.linewidth = 1.2
    mat.dashed = true
    mat.dashSize = 0.9
    mat.gapSize = 0.9
    mat.transparent = true
    mat.opacity = 0.55
    const line = new LineSegments2(geo, mat)
    line.computeLineDistances()
    return line
  }

  /** 圆管（沿曲线）：卡通填充 + 反向外壳描边 */
  tube(curve: THREE.Curve<THREE.Vector3>, radius: number, key: ColorKey, mats?: PartMats): THREE.Group {
    const g = new THREE.Group()
    const geo = new THREE.TubeGeometry(curve, 40, radius, 10, false)
    const hullMat = new THREE.MeshBasicMaterial({ color: this.ink, side: THREE.BackSide })
    this.hulls.push(hullMat)
    mats?.hulls.push(hullMat)
    g.add(new THREE.Mesh(geo, this.fill(key, mats)), new THREE.Mesh(new THREE.TubeGeometry(curve, 40, radius + 0.12, 10, false), hullMat))
    return g
  }

  /** 透视画法：关掉深度测试，让物体穿过别的零件也看得见（箭头）；描边一起处理 */
  xray(mesh: THREE.Mesh): THREE.Mesh {
    mesh.renderOrder = 10
    ;(mesh.material as THREE.Material).depthTest = false
    for (const c of mesh.children) {
      c.renderOrder = 11
      ;((c as THREE.Mesh).material as THREE.Material).depthTest = false
    }
    return mesh
  }

  /** 释放一批零件的材质（模型被换掉时），并不再为它们重上色 */
  release(list: PartMats[]) {
    const fills = new Set(list.flatMap((m) => m.fills))
    const lines = new Set(list.flatMap((m) => m.lines))
    const hulls = new Set(list.flatMap((m) => m.hulls))
    this.fills = this.fills.filter((f) => !fills.has(f.mat))
    this.lines = this.lines.filter((l) => !lines.has(l))
    this.hulls = this.hulls.filter((h) => !hulls.has(h))
    for (const m of [...fills, ...lines, ...hulls]) m.dispose()
  }

  /** 设置一个零件的显示状态 */
  setState(mats: PartMats, state: PartState) {
    const a = OPACITY[state]
    const transparent = a < 1
    for (const m of mats.fills) {
      m.opacity = a
      m.transparent = transparent
      m.depthWrite = !transparent
      m.needsUpdate = true
    }
    for (const m of mats.hulls) {
      m.opacity = a
      m.transparent = transparent
      m.depthWrite = !transparent
    }
    for (const m of mats.lines) {
      m.opacity = a
      m.transparent = transparent
      m.color.copy(state === 'focus' ? this.accent : this.ink)
      m.linewidth = state === 'focus' ? this.lineWidth + 1.5 : this.lineWidth
    }
    for (const m of mats.hulls) m.color.copy(state === 'focus' ? this.accent : this.ink)
  }
}
