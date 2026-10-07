// 1.1-1 双对数图的数据：器件的耐压与额定电流，以及常见电压。
// 数据手册：1N4148 Vishay 81857 Rev 1.6（I_F(AV) 150 mA）；1N4007 Vishay 88503（1 A）；1N5819 Vishay 88525（1 A）；
// STTH3012 ST DS4653 Rev 3；VS-70HF120 Vishay 93521；FF450R12KE4_E Infineon v02_00；5SDD 08D5000 ABB TS-D/061/02c；
// FZ750R65KE3 Infineon Rev 1.10（I_C nom 750 A）；5STP 45Y8500 ABB 5SYA1079-02（I_T(AV)M 4240 A，T_c = 70 °C）
import type { PinLabels } from './common'

/** 图的范围：电压 1 V…30 kV，电流 10 mA…10 kA */
export const U_RANGE: [number, number] = [1, 3e4]
export const I_RANGE: [number, number] = [1e-2, 1e4]

export interface MapDevice {
  /** 型号（画布上直接显示）；第 0 章示例 PN 结用文字标签 pn0 */
  name: string
  label?: keyof PinLabels
  group: 'small' | 'power'
  /** 耐压（V）：二极管 U_RRM，开关器件 U_CES / U_DRM */
  U: number
  /** 额定电流（A） */
  I: number
  /** 标签相对圆点的偏移（像素） */
  dx?: number
  dy?: number
}

export const DEVICES: MapDevice[] = [
  { name: '', label: 'pn0', group: 'small', U: 28, I: 0.15, dy: 12 },
  { name: '1N4148', group: 'small', U: 100, I: 0.15, dy: -12 },
  { name: '1N5819', group: 'small', U: 40, I: 1 },
  { name: '1N4007', group: 'small', U: 1000, I: 1 },
  { name: 'STTH3012', group: 'power', U: 1200, I: 30, dy: 12, dx: -8 },
  { name: 'VS-70HF120', group: 'power', U: 1200, I: 70, dy: -12, dx: -8 },
  { name: 'FF450R12KE4_E', group: 'power', U: 1200, I: 450, dy: 12 },
  { name: '5SDD 08D5000', group: 'power', U: 5000, I: 1028, dx: 9, dy: 8 },
  { name: 'FZ750R65KE3', group: 'power', U: 6500, I: 750, dx: -9, dy: -6 },
  { name: '5STP 45Y8500', group: 'power', U: 8500, I: 4240, dx: -9, dy: -10 },
]

/** 右侧的常见电压阶梯 */
export const LADDER: { U: number; key: keyof PinLabels }[] = [
  { U: 3.7, key: 'vBat' },
  { U: 12, key: 'vCar' },
  { U: 311, key: 'vGrid' },
  { U: 540, key: 'vBus' },
  { U: 800, key: 'vEv' },
]
