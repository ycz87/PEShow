// 一个 3D 器件模型的零件登记簿：每个零件是一个组，登记它的材质与可点选的网格，
// 免得每个模型都重写一遍同样的 part / solid / tube 样板代码。
import * as THREE from 'three'
import type { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { newMats, type ColorKey, type PartMats, type ToonKit } from './toon'

export class PartSet {
  readonly root = new THREE.Group()
  readonly mats: Record<string, PartMats> = {}
  readonly pickables: THREE.Object3D[] = []
  /** 不属于任何零件的陈设（散热器、箭头、虚线）的材质：不参与选中变暗，只在释放时一并清理 */
  private fx = newMats()

  constructor(private kit: ToonKit) {}

  /** 新建一个零件（组），挂在 root 下；parent 给定时挂在那里 */
  part(id: string, parent: THREE.Object3D = this.root) {
    const g = new THREE.Group()
    g.userData.partId = id
    this.mats[id] ??= newMats()
    parent.add(g)
    return g
  }

  /** 给零件 g 加一块带描边的实心形体，可被点选 */
  solid(g: THREE.Object3D, id: string, geo: THREE.BufferGeometry, key: ColorKey) {
    const m = this.kit.solid(geo, key, this.mats[id])
    m.userData.partId = id
    this.pickables.push(m)
    g.add(m)
    return m
  }

  /** 给零件 g 加一根沿曲线的圆管（描边用反向外壳），可被点选 */
  tube(g: THREE.Object3D, id: string, curve: THREE.Curve<THREE.Vector3>, radius: number, key: ColorKey) {
    const t = this.kit.tube(curve, radius, key, this.mats[id])
    t.children[0].userData.partId = id
    this.pickables.push(t.children[0])
    g.add(t)
    return t
  }

  /** 陈设用的实心形体（散热器、绝缘垫、箭头）：带描边，但不能点选；blocks 为 true 时会挡住后面的标注点 */
  decor(geo: THREE.BufferGeometry, key: ColorKey, blocks = false) {
    const m = this.kit.solid(geo, key, this.fx)
    if (blocks) this.pickables.push(m)
    return m
  }

  /** 虚线（"装回去的路径"） */
  guide(a: THREE.Vector3, b: THREE.Vector3) {
    const line = this.kit.guide(a, b)
    this.fx.lines.push(line.material as LineMaterial)
    return line
  }

  /** 释放几何与材质（换模型或离开页面时） */
  dispose() {
    this.root.traverse((o) => (o as THREE.Mesh).geometry?.dispose())
    this.kit.release([...Object.values(this.mats), this.fx])
  }
}
