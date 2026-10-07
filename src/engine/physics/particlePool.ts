// 粒子仿真共用的小工具：载流子槽位池、正态与泊松随机数（第 0 章 PN 结舞台与第 1 章 PiN 舞台共用）

let nextUid = 1

/** 一种载流子的槽位池：位置、速度、编号；死去的槽位可复用 */
export class Pool {
  x: Float32Array
  y: Float32Array
  vx: Float32Array
  vy: Float32Array
  uid: Uint32Array
  alive: Uint8Array
  count = 0
  constructor(public cap: number) {
    this.x = new Float32Array(cap)
    this.y = new Float32Array(cap)
    this.vx = new Float32Array(cap)
    this.vy = new Float32Array(cap)
    this.uid = new Uint32Array(cap)
    this.alive = new Uint8Array(cap)
  }
  spawn(x: number, y: number, vx: number, vy: number, uid = nextUid++): number {
    for (let i = 0; i < this.cap; i++) {
      if (!this.alive[i]) {
        this.alive[i] = 1
        this.x[i] = x
        this.y[i] = y
        this.vx[i] = vx
        this.vy[i] = vy
        this.uid[i] = uid
        this.count++
        return i
      }
    }
    return -1
  }
  kill(i: number) {
    if (this.alive[i]) {
      this.alive[i] = 0
      this.count--
    }
  }
  /** 按编号查找槽位（追踪模式用） */
  find(uid: number): number {
    for (let i = 0; i < this.cap; i++) if (this.alive[i] && this.uid[i] === uid) return i
    return -1
  }
}

let spare: number | null = null
/** 标准正态分布（Box–Muller，成对生成） */
export function gauss(): number {
  if (spare !== null) {
    const s = spare
    spare = null
    return s
  }
  let u = 0
  while (u === 0) u = Math.random()
  const v = Math.random()
  const r = Math.sqrt(-2 * Math.log(u))
  spare = r * Math.sin(2 * Math.PI * v)
  return r * Math.cos(2 * Math.PI * v)
}

/** 泊松抽样（均值很小，逐项累乘即可） */
export function poisson(mean: number): number {
  if (mean <= 0) return 0
  const L = Math.exp(-Math.min(mean, 30))
  let k = 0
  let p = Math.random()
  while (p > L) {
    k++
    p *= Math.random()
  }
  return k
}
