// TO-247 功率二极管（两引脚，DO-247）的 3D 卡通模型：程序化生成，不用外部模型文件。
// 外形尺寸参照 TO-247（宽约 15.9、塑封厚约 5、带安装孔的底板总长约 20.9、引脚长约 19，单位 mm）；
// 芯片内部各层的厚度放大了约 5 倍，否则 0.1–0.3 mm 的硅片在画面上只是一条线。
// 坐标：x 为宽度，y 为厚度方向（向上是正面），z 为长度（引脚在 −z 端，带孔的底板在 +z 端）；背面（y = 0）是裸露的铜。
import * as THREE from 'three'
import type { AnchorDef, Model3D } from './Stage3D'
import { PartSet } from './partset'
import { box, prism, rect, smooth } from './shapes'
import type { PartState, ToonKit } from './toon'

const W = 15.9
const BODY_L = 15.6
const TAB_L = 20.9
const LEAD_END = -19
const PITCH = 5.45
const HOLE_Z = 18.2
const PLATE_T = 1.5
const CHIP = 5.5
const CHIP_Z = 10.25
/** 芯片各层厚度（自下而上：背面金属、N⁺、N⁻、P⁺、正面铝），已放大 */
const LAYERS: { id: string; key: 'solder' | 'nPlus' | 'nMinus' | 'p' | 'aluminum'; t: number }[] = [
  { id: 'back', key: 'solder', t: 0.06 },
  { id: 'np', key: 'nPlus', t: 0.2 },
  { id: 'nm', key: 'nMinus', t: 0.38 },
  { id: 'pp', key: 'p', t: 0.08 },
  { id: 'al', key: 'aluminum', t: 0.08 },
]
const SOLDER_Y = PLATE_T
const SOLDER_T = 0.12
const CHIP_Y = SOLDER_Y + SOLDER_T
/** 各零件分解时上移的距离 */
const LIFT = { frame: 0, solder: 6, chip: 11.5, wire: 18, shell: 27 }

export const TO247_PARTS = ['shell', 'wire', 'chip', 'solder', 'frame'] as const

export function buildTO247(kit: ToonKit): Model3D {
  const ps = new PartSet(kit)
  const { root, pickables, mats } = ps
  const anchors: AnchorDef[] = []
  let heatOn = false
  let explode = 0
  /** 热流箭头的相位 0…1 */
  let phase = 0

  const part = (id: string) => ps.part(id)
  const solid = ps.solid.bind(ps)

  // ─────── 引线框架（铜）：带安装孔的底板 + 阴极引脚（与底板连成一体）+ 阳极引脚与焊盘 ───────
  const frame = part('frame')
  solid(frame, 'frame', prism(rect(-W / 2, W / 2, 5.4, TAB_L), 0, PLATE_T, [[0, HOLE_Z, 1.8]], 0.2), 'copper')
  // 阴极 K 在 −x 一侧，与底板相连；阳极 A 在 +x 一侧，末端是接键合线的焊盘
  solid(frame, 'frame', box(-PITCH - 1, -PITCH + 1, 0.35, 1.05, LEAD_END, 5.8), 'copper')
  solid(frame, 'frame', box(PITCH - 1, PITCH + 1, 0.35, 1.05, LEAD_END, 4.0), 'copper')
  solid(frame, 'frame', box(3.5, 7.4, 0.35, 1.05, 0.8, 4.6), 'copper')

  // ─────── 焊料层 ───────
  const solder = part('solder')
  solid(solder, 'solder', box(-CHIP / 2 - 0.3, CHIP / 2 + 0.3, SOLDER_Y, SOLDER_Y + SOLDER_T, CHIP_Z - CHIP / 2 - 0.3, CHIP_Z + CHIP / 2 + 0.3), 'solder')

  // ─────── 芯片：五层叠在一起，分解到一定程度后各层再拉开 ───────
  const chip = part('chip')
  const layers: THREE.Mesh[] = []
  let cum = 0
  const layerBase: number[] = []
  for (const L of LAYERS) {
    const geo = box(-CHIP / 2, CHIP / 2, 0, L.t, CHIP_Z - CHIP / 2, CHIP_Z + CHIP / 2)
    layers.push(solid(chip, 'chip', geo, L.key))
    layerBase.push(CHIP_Y + cum)
    cum += L.t
  }
  const chipTop = CHIP_Y + cum

  // ─────── 铝键合线：三根并联，从芯片正面拱到阳极焊盘 ───────
  const wire = part('wire')
  const wireXs: [number, number][] = [
    [-0.9, 3.9],
    [0.4, 5.2],
    [1.7, 6.5],
  ]
  let apex = new THREE.Vector3()
  for (const [xs, xe] of wireXs) {
    const pts = [
      new THREE.Vector3(xs, chipTop + 0.05, 8.3),
      new THREE.Vector3(xs + (xe - xs) * 0.12, 3.5, 7.0),
      new THREE.Vector3((xs + xe) / 2, 3.95, 5.6),
      new THREE.Vector3(xe - (xe - xs) * 0.12, 2.7, 3.9),
      new THREE.Vector3(xe, 1.15, 3.0),
    ]
    ps.tube(wire, 'wire', new THREE.CatmullRomCurve3(pts), 0.22, 'aluminum')
    if (xs === 0.4) apex = pts[2].clone()
  }

  // ─────── 塑封外壳：一整块（内部看不见，分解时整体抬起） ───────
  const shell = part('shell')
  // 塑封比铜底板每侧宽 0.1：两者侧面若在同一平面上，深度缓冲分不出谁在前，转动时会闪烁（z-fighting）；
  // 底面也比铜背面高 0.08，铜背面略凸出来，正是真实器件"背面裸铜、贴散热器"的样子
  solid(shell, 'shell', prism(rect(-W / 2 - 0.1, W / 2 + 0.1, 0, BODY_L), 0.08, 4.92, [], 0.45), 'plastic')

  // ─────── 散热器与绝缘垫（只在"显示热流"时出现） ───────
  const sinkG = new THREE.Group()
  sinkG.add(ps.decor(box(-16, 16, -4.6, -0.5, -3, 25), 'sink'))
  for (let i = 0; i < 8; i++) {
    const x0 = -15.2 + i * 4.1
    sinkG.add(ps.decor(box(x0, x0 + 1.5, -15, -4.6, -3, 25), 'sink'))
  }
  sinkG.add(ps.decor(box(-9, 9, -0.5, -0.03, 4, 22.5), 'pad'))
  sinkG.visible = false
  root.add(sinkG)

  // ─────── 热流箭头：从芯片向下穿过焊料、铜底板，进入散热器 ───────
  // 箭头要穿过不透明的铜，所以用透视画法（关掉深度测试），并加描边免得和铜板混成一片
  const arrows = new THREE.Group()
  const arrowList: THREE.Group[] = []
  const coneGeo = new THREE.ConeGeometry(1.0, 1.7, 14)
  coneGeo.rotateX(Math.PI)
  const shaftGeo = new THREE.CylinderGeometry(0.4, 0.4, 3.2, 12)
  shaftGeo.translate(0, 2.55, 0)
  for (let i = 0; i < 6; i++) {
    const a = new THREE.Group()
    a.add(kit.xray(ps.decor(coneGeo, 'heat')), kit.xray(ps.decor(shaftGeo, 'heat')))
    a.position.set((i % 3 - 1) * 1.9, 0, CHIP_Z)
    arrows.add(a)
    arrowList.push(a)
  }
  arrows.visible = false
  root.add(arrows)

  // ─────── 爆炸图里"装回去的路径"的虚线 ───────
  const guide = ps.guide(new THREE.Vector3(0, -1, CHIP_Z), new THREE.Vector3(0, 33, CHIP_Z))
  guide.visible = false
  root.add(guide)

  // ─────── 标注点 ───────
  const at = (id: string, owner: THREE.Object3D, x: number, y: number, z: number, reveal = 0) =>
    anchors.push({ id, owner, local: new THREE.Vector3(x, y, z), reveal })
  at('shell', shell, 0, 5.0, 8)
  at('frame', frame, -4.5, PLATE_T, 18.9)
  at('solder', solder, 0, SOLDER_Y + SOLDER_T / 2, CHIP_Z - CHIP / 2 - 0.3, 0.12)
  at('chip', layers[4], 0, LAYERS[4].t, CHIP_Z, 0.12)
  at('wire', wire, apex.x, apex.y + 0.25, apex.z, 0.12)
  at('tag:K', frame, -PITCH, 0.7, -17.5)
  at('tag:A', frame, PITCH, 0.7, -17.5)
  at('tag:Pp', layers[3], CHIP / 2, LAYERS[3].t / 2, CHIP_Z, 0.8)
  at('tag:Nm', layers[2], CHIP / 2, LAYERS[2].t / 2, CHIP_Z, 0.8)
  at('tag:Np', layers[1], CHIP / 2, LAYERS[1].t / 2, CHIP_Z, 0.8)

  const lift = (id: keyof typeof LIFT, g: THREE.Object3D, e: number) => (g.position.y = LIFT[id] * e)

  return {
    root,
    pickables,
    mats,
    anchors,
    home: { pos: new THREE.Vector3(-36, 24, 30), target: new THREE.Vector3(0, 1.8, 3), min: 20, max: 150 },
    views: ['heat'],
    setExplode(t: number) {
      explode = t
      const e = smooth(t)
      lift('frame', frame, e)
      lift('solder', solder, e)
      lift('chip', chip, e)
      lift('wire', wire, e)
      lift('shell', shell, e)
      // 分解到后半段，芯片的五层再各自拉开
      const spread = 1.6 * smooth((t - 0.55) / 0.45)
      layers.forEach((m, i) => (m.position.y = layerBase[i] + spread * i))
      guide.visible = t > 0.03
      arrows.visible = heatOn && t < 0.15
    },
    setView(id: string, on: boolean) {
      if (id !== 'heat') return
      heatOn = on
      sinkG.visible = on
      arrows.visible = on && explode < 0.15
    },
    tick(dt: number, speed: number) {
      if (!arrows.visible) return
      phase = (phase + dt * speed * 0.5) % 1
      arrowList.forEach((a, i) => {
        const u = (phase + (i < 3 ? 0 : 0.5)) % 1
        a.position.y = chipTop - u * 13
        a.scale.setScalar(Math.max(0.01, Math.sin(u * Math.PI) ** 0.6))
      })
    },
    focus(t: number) {
      const e = smooth(t)
      return { y: 1.8 + 12 * e, dist: 1 + 0.4 * e }
    },
    baseState(id: string): PartState {
      return heatOn && id === 'shell' ? 'ghost' : 'normal'
    },
    dispose: () => ps.dispose(),
  }
}
