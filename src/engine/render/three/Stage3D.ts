// 通用 3D 舞台（Three.js）：渲染器、相机、拖动旋转、点选零件、把标注点投影成屏幕坐标。
// 具体的器件模型实现 Model3D（见 to247.ts），舞台只管显示与交互；颜色与描边由 ToonKit 统一管理。
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { PartMats, PartState, ToonKit } from './toon'

/** 画在模型上的标注点：编号点（零件）或小标签（层、引脚） */
export interface AnchorDef {
  id: string
  /** 挂在哪个物体上，local 是它的局部坐标 */
  owner: THREE.Object3D
  local: THREE.Vector3
  /** 分解程度超过这个值才显示（0 表示一直显示） */
  reveal: number
  /** 被别的零件挡住时隐藏（用于贴在圆柱面、斜面上的标注，转到背面时不该透过零件显示） */
  occlude?: boolean
}

export interface Model3D {
  root: THREE.Group
  /** 可被点选的网格，userData.partId 标明属于哪个零件 */
  pickables: THREE.Object3D[]
  /** 各零件的材质（用来变暗、高亮） */
  mats: Record<string, PartMats>
  anchors: AnchorDef[]
  /** 相机初始位置与观察点、可缩放范围 */
  home: { pos: THREE.Vector3; target: THREE.Vector3; min: number; max: number }
  /** 可以开关的"视图"（热流、压力…），界面按这个清单生成按钮 */
  views: readonly string[]
  setExplode(t: number): void
  setView(id: string, on: boolean): void
  tick(dt: number, speed: number): void
  /** 分解程度 t 时相机观察点的高度、与初始距离之比 */
  focus(t: number): { y: number; dist: number }
  /** 没有零件被选中时某零件的基础状态（如看热流时外壳变透明） */
  baseState(id: string): PartState
  dispose(): void
}

export interface ProjectedAnchor {
  id: string
  x: number
  y: number
  visible: boolean
}

export class Stage3D {
  readonly scene = new THREE.Scene()
  readonly camera = new THREE.PerspectiveCamera(35, 1, 0.5, 600)
  private renderer: THREE.WebGLRenderer
  private controls: OrbitControls
  private model?: Model3D
  private raf = 0
  private last = 0
  private ro: ResizeObserver
  private w = 1
  private h = 1
  private selected: string | null = null
  private explode = 0
  private focusY = 0
  private distF = 1
  private interacting = false
  private resumeTimer = 0
  playing = true
  speed = 1
  /** 每帧把标注点的屏幕坐标交给界面（界面直接改元素位置，不走响应式） */
  onFrame?: (list: ProjectedAnchor[]) => void
  /** 点选了零件（点到空白处为 null） */
  onPick?: (id: string | null) => void

  constructor(private host: HTMLElement, private kit: ToonKit) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
    this.renderer.setClearColor(0x000000, 0)
    host.appendChild(this.renderer.domElement)

    this.scene.add(new THREE.AmbientLight(0xffffff, 1.15))
    const sun = new THREE.DirectionalLight(0xffffff, 2.2)
    sun.position.set(30, 60, 40)
    this.scene.add(sun)
    const fill = new THREE.DirectionalLight(0xffffff, 0.7)
    fill.position.set(-40, 10, -30)
    this.scene.add(fill)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.09
    this.controls.enablePan = false
    // 滚轮留给页面滚动；缩放用按钮或 Ctrl + 滚轮
    this.controls.enableZoom = false
    this.controls.addEventListener('start', () => {
      this.interacting = true
      clearTimeout(this.resumeTimer)
    })
    this.controls.addEventListener('end', () => {
      clearTimeout(this.resumeTimer)
      this.resumeTimer = window.setTimeout(() => (this.interacting = false), 2500)
    })
    const el = this.renderer.domElement
    el.addEventListener('wheel', this.onWheel, { passive: false })
    el.addEventListener('pointerdown', this.onDown)
    el.addEventListener('pointerup', this.onUp)

    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(host)
    this.resize()
    this.loop(0)
  }

  /** 换模型：旧模型从场景里拆掉并释放，选中状态清空 */
  setModel(m: Model3D) {
    if (this.model) {
      this.scene.remove(this.model.root)
      this.model.dispose()
    }
    this.model = m
    this.selected = null
    this.scene.add(m.root)
    this.controls.minDistance = m.home.min
    this.controls.maxDistance = m.home.max
    this.reset()
    this.refreshStates()
  }

  /** 回到初始视角与合拢状态 */
  reset() {
    const m = this.model
    if (!m) return
    this.camera.position.copy(m.home.pos)
    this.controls.target.copy(m.home.target)
    this.focusY = m.home.target.y
    this.distF = 1
    this.setExplode(0)
    this.controls.update()
  }

  setExplode(t: number) {
    const m = this.model
    if (!m) return
    this.explode = t
    m.setExplode(t)
    // 分解后整体变高：观察点上移、相机拉远，让所有零件留在画面里
    const f = m.focus(t)
    const off = this.camera.position.clone().sub(this.controls.target)
    off.multiplyScalar(f.dist / this.distF)
    this.controls.target.y += f.y - this.focusY
    this.camera.position.copy(this.controls.target).add(off)
    this.focusY = f.y
    this.distF = f.dist
  }

  setView(id: string, on: boolean) {
    this.model?.setView(id, on)
    this.refreshStates()
  }

  setSelected(id: string | null) {
    this.selected = id
    this.refreshStates()
  }

  /** 换风格 / 主题后重新套用零件状态（颜色已由 kit 重上） */
  refreshStates() {
    const m = this.model
    if (!m) return
    for (const id of Object.keys(m.mats)) {
      const s: PartState = this.selected ? (id === this.selected ? 'focus' : 'dim') : m.baseState(id)
      this.kit.setState(m.mats[id], s)
    }
  }

  zoom(factor: number) {
    const off = this.camera.position.clone().sub(this.controls.target)
    const d = THREE.MathUtils.clamp(off.length() * factor, this.controls.minDistance, this.controls.maxDistance)
    this.camera.position.copy(this.controls.target).add(off.setLength(d))
  }

  private onWheel = (e: WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return
    e.preventDefault()
    this.zoom(Math.exp(e.deltaY * 0.0015))
  }

  private downAt: { x: number; y: number } | null = null
  private onDown = (e: PointerEvent) => (this.downAt = { x: e.clientX, y: e.clientY })
  private onUp = (e: PointerEvent) => {
    const d = this.downAt
    this.downAt = null
    // 拖动超过几个像素就是旋转，不算点选
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) return
    this.onPick?.(this.pick(e.clientX, e.clientY))
  }

  /** 射线上第一个"挡得住视线"的零件：不可见的（如没打开的散热器）和透明（变暗）的不算 */
  private blockers(ray: THREE.Raycaster): THREE.Intersection[] {
    const m = this.model
    if (!m) return []
    return ray.intersectObjects(m.pickables, false).filter((h) => {
      for (let o: THREE.Object3D | null = h.object; o; o = o.parent) if (!o.visible) return false
      return ((h.object as THREE.Mesh).material as THREE.Material).opacity >= 0.5
    })
  }

  private pick(cx: number, cy: number): string | null {
    const r = this.renderer.domElement.getBoundingClientRect()
    const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1)
    this.ray.setFromCamera(ndc, this.camera)
    this.ray.far = Infinity
    return this.blockers(this.ray)[0]?.object.userData.partId ?? null
  }

  private resize() {
    const w = Math.max(10, this.host.clientWidth)
    const h = Math.max(10, this.host.clientHeight)
    this.w = w
    this.h = h
    this.renderer.setSize(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.kit.resolution.set(w * this.renderer.getPixelRatio(), h * this.renderer.getPixelRatio())
  }

  private tmp = new THREE.Vector3()
  private world = new THREE.Vector3()
  private ray = new THREE.Raycaster()

  /** 从相机看向 world 点，中间有没有被零件挡住；留 0.8 的余量，贴在表面上的点不算被挡 */
  private occluded(world: THREE.Vector3): boolean {
    const dir = this.tmp.copy(world).sub(this.camera.position)
    const dist = dir.length()
    this.ray.set(this.camera.position, dir.divideScalar(dist))
    this.ray.far = dist - 0.8
    return this.blockers(this.ray).length > 0
  }

  private loop = (now: number) => {
    this.raf = requestAnimationFrame(this.loop)
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0
    this.last = now
    this.controls.autoRotate = this.playing && !this.interacting
    this.controls.autoRotateSpeed = 1.1 * this.speed
    this.controls.update(dt)
    this.model?.tick(this.playing ? dt : 0, this.speed)
    this.renderer.render(this.scene, this.camera)
    if (this.model && this.onFrame) {
      const list: ProjectedAnchor[] = []
      for (const a of this.model.anchors) {
        a.owner.localToWorld(this.world.copy(a.local))
        const shown = this.explode >= a.reveal && !(a.occlude && this.occluded(this.world))
        this.tmp.copy(this.world).project(this.camera)
        list.push({
          id: a.id,
          x: ((this.tmp.x + 1) / 2) * this.w,
          y: ((1 - this.tmp.y) / 2) * this.h,
          visible: this.tmp.z < 1 && shown,
        })
      }
      this.onFrame(list)
    }
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    clearTimeout(this.resumeTimer)
    this.ro.disconnect()
    const el = this.renderer.domElement
    el.removeEventListener('wheel', this.onWheel)
    el.removeEventListener('pointerdown', this.onDown)
    el.removeEventListener('pointerup', this.onUp)
    this.controls.dispose()
    this.model?.dispose()
    this.renderer.dispose()
    el.remove()
  }
}
