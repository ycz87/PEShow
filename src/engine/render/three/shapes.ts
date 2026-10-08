// 3D 模型共用的几何小工具：方块、可带孔和倒角的棱柱、圆柱 / 圆台、旋转体。
// 坐标约定：y 向上；棱柱的轮廓画在 (x, z) 平面上。
import * as THREE from 'three'

/** 0→1 的平滑过渡 */
export const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x))
  return t * t * (3 - 2 * t)
}

/** 轴对齐方块，给出各方向的范围 */
export function box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0)
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
  return g
}

/**
 * (x, z) 平面上的多边形（可带圆孔）沿 y 方向拉成棱柱，底面在 y0，高 h；
 * bevel 为倒角：外形尺寸不变，顶面向内缩进 bevel（卡通的小倒角）
 */
export function prism(outline: [number, number][], y0: number, h: number, holes: [number, number, number][] = [], bevel = 0) {
  const shape = new THREE.Shape()
  outline.forEach(([x, z], i) => (i ? shape.lineTo(x, -z) : shape.moveTo(x, -z)))
  for (const [x, z, r] of holes) {
    const p = new THREE.Path()
    p.absarc(x, -z, r, 0, Math.PI * 2, true)
    shape.holes.push(p)
  }
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: h - 2 * bevel,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: -bevel,
    bevelSegments: 1,
    curveSegments: 24,
  })
  // 形状的 y 对应世界的 −z，拉伸方向对应世界的 +y
  geo.rotateX(-Math.PI / 2)
  geo.translate(0, y0 + bevel, 0)
  return geo
}

export const rect = (x0: number, x1: number, z0: number, z1: number): [number, number][] => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
]

/** 圆柱 / 圆台：底面半径 rBottom、顶面半径 rTop，底面在 y0，高 h，轴线是 y 轴 */
export function cyl(rBottom: number, rTop: number, y0: number, h: number, segments = 64) {
  const g = new THREE.CylinderGeometry(rTop, rBottom, h, segments)
  g.translate(0, y0 + h / 2, 0)
  return g
}

/**
 * 旋转体：profile 是 (半径, 高度) 折线，绕 y 轴转一圈。
 * 折线前进方向的右手边是外表面（把截面按逆时针走一圈就是外表面朝外）。
 * 每段折线单独算法线：壁面光滑，折角处是硬边（LatheGeometry 会把折角抹圆，不适合画带棱的零件）。
 */
export function revolve(profile: [number, number][], segments = 64) {
  const pos: number[] = []
  const nor: number[] = []
  const vert = (r: number, y: number, nr: number, ny: number, t: number) => {
    const c = Math.cos(t)
    const s = Math.sin(t)
    pos.push(r * c, y, r * s)
    nor.push(nr * c, ny, nr * s)
  }
  for (let k = 0; k + 1 < profile.length; k++) {
    const [r0, y0] = profile[k]
    const [r1, y1] = profile[k + 1]
    const len = Math.hypot(r1 - r0, y1 - y0)
    if (len === 0) continue
    const nr = (y1 - y0) / len
    const ny = -(r1 - r0) / len
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2
      const b = ((i + 1) / segments) * Math.PI * 2
      vert(r0, y0, nr, ny, a)
      vert(r1, y1, nr, ny, a)
      vert(r1, y1, nr, ny, b)
      vert(r0, y0, nr, ny, a)
      vert(r1, y1, nr, ny, b)
      vert(r0, y0, nr, ny, b)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  return g
}
