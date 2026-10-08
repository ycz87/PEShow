// 平板压接型功率二极管（"冰球"形）的 3D 卡通模型：程序化生成，不用外部模型文件。
// 结构参照常见的陶瓷管壳压接型：下铜电极 + 陶瓷环（连成"管壳底座"）、下钼片、整片硅晶圆（边缘磨出斜角）、
// 边缘保护胶圈、上钼片、上铜电极（带法兰，焊在陶瓷环上端）。
// 外形取外径约 76 mm、高约 26 mm 作示意（实际随电流等级变化）；晶圆厚度放大了数倍，斜角角度也夸大了，否则看不见。
// 坐标：y 向上，中轴是 y 轴；上电极接阳极 A（P⁺ 一侧在上），下电极接阴极 K。
import * as THREE from 'three'
import type { AnchorDef, Model3D } from './Stage3D'
import { PartSet } from './partset'
import { box, cyl, revolve, smooth } from './shapes'
import type { ColorKey, ToonKit } from './toon'

export const PRESSFIT_PARTS = ['shell', 'pole', 'moly', 'wafer', 'edge'] as const

const R_POLE = 29 // 铜电极极面半径
const R_FLANGE = 37 // 电极外缘的法兰半径
const FL_T = 1.2 // 法兰厚
const RING_IN = 32.5 // 陶瓷环内径
const RING_OUT = 35.5 // 陶瓷环外径
const RING_SHED = 38 // 裙边外径
const RING_Y0 = 5
const RING_Y1 = 21
const TOP_Y = 26 // 整体高度
const BOT_POLE_TOP = 10.5 // 下电极顶面
const TOP_POLE_BOT = 15.5 // 上电极底面
const MO_T = 1.5
const MO_BOT_R = 22
const MO_TOP_R = 25.5
const W_Y0 = 12 // 晶圆底面
// 正斜角：横截面积从重掺杂的 P⁺ 一侧向轻掺杂的 N⁻ 一侧逐渐减小（P⁺ 一侧大、N⁺ 一侧小），
// 斜面把电场沿表面"摊开"，表面场比体内低
const W_R_TOP = 28 // P⁺ 一侧（上）半径大
const W_R_BOT = 24.5 // N⁺ 一侧（下）半径小
const COAT_R = 31
/** 晶圆各层厚度（自下而上：背面金属、N⁺、N⁻、P⁺、正面铝），已放大；总厚 2.0 */
const LAYERS: { key: ColorKey; t: number }[] = [
  { key: 'solder', t: 0.1 },
  { key: 'nPlus', t: 0.35 },
  { key: 'nMinus', t: 1.15 },
  { key: 'p', t: 0.25 },
  { key: 'aluminum', t: 0.15 },
]
const W_T = LAYERS.reduce((s, L) => s + L.t, 0)
const W_MID = W_Y0 + W_T / 2
/** 各零件分解时上移的距离：下电极与陶瓷环是一体的管壳底座，不动 */
const LIFT = { moBot: 16, coat: 26, wafer: 36, moTop: 50, poleTop: 62 }
const SPREAD = 1.8 // 晶圆各层拉开的间距

const SINK_W = 42 // 散热器半宽
const SINK_BASE = 4
const SINK_FIN = 7
const FIN_T = 3
const FINS = 7

/** 夹具压力箭头：大小系数、尖端到极面的间隙、圆心到尖端的距离；沿轴线来回压的幅度 */
const FORCE_K = 3.4
const FORCE_GAP = 0.6
const FORCE_TIP = 0.85 * FORCE_K
const PRESS_AMP = 1.3

/** 陶瓷环的截面（半径, 高度）：带三圈裙边，逆时针一圈 */
function ceramicProfile(): [number, number][] {
  const pts: [number, number][] = [
    [RING_IN, RING_Y0],
    [RING_OUT, RING_Y0],
  ]
  for (const yb of [7.4, 12.2, 17.0]) {
    pts.push([RING_OUT, yb], [RING_SHED, yb], [RING_SHED, yb + 1.2], [RING_OUT, yb + 1.2])
  }
  pts.push([RING_OUT, RING_Y1], [RING_IN, RING_Y1], [RING_IN, RING_Y0])
  return pts
}

/** 法兰（圆环片）的截面：内缘贴着电极，不画内壁 */
const flange = (y0: number): [number, number][] => [
  [R_POLE, y0],
  [R_FLANGE, y0],
  [R_FLANGE, y0 + FL_T],
  [R_POLE, y0 + FL_T],
]

export function buildPressfit(kit: ToonKit): Model3D {
  const ps = new PartSet(kit)
  const { root } = ps
  const anchors: AnchorDef[] = []
  const on = { force: false, heat: false }
  let explode = 0
  /** 箭头的相位 0…1 */
  let phase = 0
  const sub = (parent: THREE.Object3D) => {
    const g = new THREE.Group()
    parent.add(g)
    return g
  }

  // ─────── 陶瓷管壳：带裙边的陶瓷环（裙边拉长表面爬电距离） ───────
  const shell = ps.part('shell')
  ps.solid(shell, 'shell', revolve(ceramicProfile()), 'ceramic')

  // ─────── 铜电极：下电极（连在陶瓷环上）、上电极（分解时升起），各带一圈法兰 ───────
  const pole = ps.part('pole')
  const poleBot = sub(pole)
  const poleTop = sub(pole)
  ps.solid(poleBot, 'pole', cyl(R_POLE, R_POLE, 0, BOT_POLE_TOP), 'copper')
  ps.solid(poleBot, 'pole', revolve(flange(RING_Y0 - FL_T)), 'copper')
  ps.solid(poleTop, 'pole', cyl(R_POLE, R_POLE, TOP_POLE_BOT, TOP_Y - TOP_POLE_BOT), 'copper')
  ps.solid(poleTop, 'pole', revolve(flange(RING_Y1)), 'copper')

  // ─────── 钼片：晶圆上下各一片，半径比晶圆小 ───────
  const moly = ps.part('moly')
  const moBot = sub(moly)
  const moTop = sub(moly)
  ps.solid(moBot, 'moly', cyl(MO_BOT_R, MO_BOT_R, W_Y0 - MO_T, MO_T), 'moly')
  ps.solid(moTop, 'moly', cyl(MO_TOP_R, MO_TOP_R, W_Y0 + W_T, MO_T), 'moly')

  // ─────── 硅晶圆：五层叠成一个圆台（边缘斜角：P⁺ 一侧窄、N⁺ 一侧宽），分解到底各层拉开 ───────
  const wafer = ps.part('wafer')
  const rAt = (y: number) => W_R_BOT + ((W_R_TOP - W_R_BOT) * (y - W_Y0)) / W_T
  const layers: THREE.Mesh[] = []
  const layerBase: number[] = []
  let y = W_Y0
  for (const L of LAYERS) {
    layers.push(ps.solid(wafer, 'wafer', cyl(rAt(y), rAt(y + L.t), 0, L.t), L.key))
    layerBase.push(y)
    y += L.t
  }

  // ─────── 边缘保护胶圈：内壁贴着晶圆的斜面（底部抬高 0.05，免得与晶圆底面重合而闪烁） ───────
  const edge = ps.part('edge')
  const yb = W_Y0 + 0.05
  const yt = W_Y0 + W_T
  ps.solid(edge, 'edge', revolve([[rAt(yb), yb], [COAT_R, yb], [COAT_R, yt], [W_R_TOP, yt], [rAt(yb), yb]]), 'coat')

  // ─────── "显示热流"：上下两个散热器 + 从晶圆同时向上、向下的箭头（只在合拢时显示） ───────
  const heatG = new THREE.Group()
  const heatsink = (dir: 1 | -1, y0: number) => {
    const g = new THREE.Group()
    const yBase = y0 + dir * SINK_BASE
    const yFin = yBase + dir * SINK_FIN
    const [b0, b1] = dir > 0 ? [y0, yBase] : [yBase, y0]
    const [f0, f1] = dir > 0 ? [yBase, yFin] : [yFin, yBase]
    // 散热器会挡住后面的标注点，所以算作遮挡物
    g.add(ps.decor(box(-SINK_W, SINK_W, b0, b1, -SINK_W, SINK_W), 'sink', true))
    const pitch = (2 * SINK_W - 6 - FIN_T) / (FINS - 1)
    for (let i = 0; i < FINS; i++) {
      const x0 = -SINK_W + 3 + i * pitch
      g.add(ps.decor(box(x0, x0 + FIN_T, f0, f1, -SINK_W, SINK_W), 'sink', true))
    }
    return g
  }
  heatG.add(heatsink(-1, -0.05), heatsink(1, TOP_Y + 0.05))

  /** 箭头：圆锥 + 杆。尖朝 −y，杆在上方；dir = −1 朝下，dir = 1 把它翻过来朝上 */
  const arrow = (key: ColorKey, k: number, dir: 1 | -1) => {
    const cone = new THREE.ConeGeometry(1.0 * k, 1.7 * k, 20)
    cone.rotateX(Math.PI)
    const shaft = new THREE.CylinderGeometry(0.5 * k, 0.5 * k, 3.2 * k, 12)
    shaft.translate(0, 2.55 * k, 0)
    const a = new THREE.Group()
    // 箭头要穿过不透明的铜、陶瓷和散热器，所以用透视画法（见 ToonKit.xray）
    a.add(kit.xray(ps.decor(cone, key)), kit.xray(ps.decor(shaft, key)))
    if (dir > 0) a.rotation.x = Math.PI
    return a
  }
  const heatUp: THREE.Group[] = []
  const heatDown: THREE.Group[] = []
  for (let i = 0; i < 3; i++) {
    for (const [list, dir, phi] of [[heatUp, 1, 0], [heatDown, -1, 60]] as const) {
      const a = arrow('heat', 3.0, dir)
      const t = ((phi + i * 120) * Math.PI) / 180
      a.position.set(12 * Math.cos(t), W_MID, 12 * Math.sin(t))
      heatG.add(a)
      list.push(a)
    }
  }
  heatG.visible = false
  root.add(heatG)

  // ─────── "显示压力"：夹具从上下两面把器件压紧（紫色大箭头，沿轴线轻轻"压"） ───────
  const forceG = new THREE.Group()
  const forceTop = arrow('force', FORCE_K, -1)
  const forceBot = arrow('force', FORCE_K, 1)
  forceG.add(forceTop, forceBot)
  forceG.visible = false
  root.add(forceG)

  const guide = ps.guide(new THREE.Vector3(0, -2, 0), new THREE.Vector3(0, 100, 0))
  guide.visible = false
  root.add(guide)

  // ─────── 标注点：贴在圆柱面、斜面上的都开 occlude，转到背面时不会透过零件显示 ───────
  const c = Math.PI * 0.75 // 初始相机所在的方位角（−x、+z 一侧）
  const ring = (r: number) => [r * Math.cos(c), r * Math.sin(c)] as const
  const at = (id: string, owner: THREE.Object3D, x: number, yy: number, z: number, reveal = 0) =>
    anchors.push({ id, owner, local: new THREE.Vector3(x, yy, z), reveal, occlude: true })
  const onWall = (id: string, owner: THREE.Object3D, r: number, yy: number, reveal = 0) => {
    const [x, z] = ring(r)
    at(id, owner, x, yy, z, reveal)
  }
  onWall('shell', shell, RING_SHED, 12.8)
  at('pole', poleTop, -8, TOP_Y, 8)
  onWall('moly', moBot, MO_BOT_R + 0.1, W_Y0 - MO_T / 2, 0.12)
  const [wx, wz] = ring(21)
  at('wafer', layers[4], wx, LAYERS[4].t, wz, 0.12)
  onWall('edge', edge, COAT_R + 0.1, (yb + yt) / 2, 0.12)
  at('tag:A', poleTop, 11, TOP_Y, -9)
  onWall('tag:K', poleBot, R_POLE + 0.1, 1.9)
  for (const [tag, i] of [['Pp', 3], ['Nm', 2], ['Np', 1]] as const) {
    const [x, z] = ring(rAt(layerBase[i] + LAYERS[i].t / 2) + 0.3)
    at(`tag:${tag}`, layers[i], x, LAYERS[i].t / 2, z, 0.8)
  }

  const lift = (g: THREE.Object3D, d: number, e: number) => (g.position.y = d * e)
  const refreshFx = () => {
    // 分解后散热器、箭头都收起来（它们只在合拢状态下有意义）
    const show = explode < 0.15
    heatG.visible = on.heat && show
    forceG.visible = on.force && show
  }

  return {
    root,
    pickables: ps.pickables,
    mats: ps.mats,
    anchors,
    home: { pos: new THREE.Vector3(-86, 56, 86), target: new THREE.Vector3(0, 13, 0), min: 40, max: 360 },
    views: ['force', 'heat'],
    setExplode(t: number) {
      explode = t
      const e = smooth(t)
      lift(moBot, LIFT.moBot, e)
      lift(edge, LIFT.coat, e)
      lift(wafer, LIFT.wafer, e)
      lift(moTop, LIFT.moTop, e)
      lift(poleTop, LIFT.poleTop, e)
      // 分解到后半段，晶圆的五层再各自拉开
      const spread = SPREAD * smooth((t - 0.55) / 0.45)
      layers.forEach((m, i) => (m.position.y = layerBase[i] + spread * i))
      guide.visible = t > 0.03
      refreshFx()
    },
    setView(id: string, v: boolean) {
      if (id === 'heat' || id === 'force') on[id] = v
      refreshFx()
    },
    tick(dt: number, speed: number) {
      if (!heatG.visible && !forceG.visible) return
      phase = (phase + dt * speed * 0.5) % 1
      const rise = (list: THREE.Group[], dir: 1 | -1, off: number) =>
        list.forEach((a, i) => {
          const u = (phase + off + i / 3) % 1
          a.position.y = W_MID + dir * u * 24
          a.scale.setScalar(Math.max(0.01, Math.sin(u * Math.PI) ** 0.6))
        })
      rise(heatUp, 1, 0)
      rise(heatDown, -1, 0.5)
      const press = PRESS_AMP * Math.sin(phase * Math.PI * 2)
      forceTop.position.y = TOP_Y + FORCE_GAP + FORCE_TIP + press
      forceBot.position.y = -FORCE_GAP - FORCE_TIP - press
    },
    focus(t: number) {
      const e = smooth(t)
      return { y: 13 + 31 * e, dist: 1 + 0.95 * e }
    },
    baseState: () => 'normal',
    dispose: () => ps.dispose(),
  }
}
