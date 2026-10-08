// 1.2-5 封装形式的数据与文字：五种封装、各自的电流范围（量级）、散热方式、用途，以及实物照片的来源。
// 照片取自 Wikimedia Commons，许可与作者见 src/assets/photos/ATTRIBUTION.md；页面上每张照片下也标注。
import type { BiText } from '../../../app/settings'
import axialImg from '../../../assets/photos/axial-1n4007.jpg'
import to247Img from '../../../assets/photos/to247-stps30l40cw.jpg'
import studImg from '../../../assets/photos/stud-d355n2000.jpg'
import studCutImg from '../../../assets/photos/stud-d355n2000-cutaway.jpg'
import moduleImg from '../../../assets/photos/module-cm1400du.jpg'
import pressImg from '../../../assets/photos/presspack-n3476tc420.jpg'

export type PackageId = 'axial' | 'to247' | 'stud' | 'module' | 'press'

export interface Photo {
  src: string
  /** 照片说明（拍的是什么） */
  caption: BiText
  /** 作者、许可、Commons 文件页 */
  author: string
  license: string
  licenseUrl: string
  page: string
  /** 同一只管子的另一种视图的标签（如"外观"、"剖开"） */
  tab?: BiText
}

export interface PackageInfo {
  id: PackageId
  name: BiText
  /** 电流范围的量级（安），画在对数坐标上；只表示"哪个数量级"，不是某个型号的额定值 */
  range: [number, number]
  /** 一句话的电流范围 */
  current: BiText
  cooling: BiText
  use: BiText
  note?: BiText
  photos: Photo[]
}

const CC0 = 'https://creativecommons.org/publicdomain/zero/1.0/deed.en'
const BYSA4 = 'https://creativecommons.org/licenses/by-sa/4.0'
const BYSA3 = 'https://creativecommons.org/licenses/by-sa/3.0/'
const commons = (file: string) => `https://commons.wikimedia.org/wiki/File:${file}`

export const PACKAGES: PackageInfo[] = [
  {
    id: 'axial',
    name: { zh: '轴向引线', en: 'Axial lead' },
    range: [0.3, 6],
    current: { zh: '几安以下（例：1N4007，1 A、1000 V）', en: 'A few amps or less (e.g. 1N4007: 1 A, 1000 V)' },
    cooling: { zh: '热量主要沿两根引线传到电路板，没有散热器。', en: 'Heat leaves mainly along the two leads into the board; there is no heatsink.' },
    use: { zh: '小功率整流、续流、保护电路。', en: 'Low-power rectification, freewheeling and protection circuits.' },
    note: { zh: '1N4007 在 1.1 里出现过：耐压 1000 V，却只能过 1 A——难的是高电压和大电流同时满足。', en: 'The 1N4007 appeared in 1.1: it blocks 1000 V yet carries only 1 A; the hard part is high voltage and high current together.' },
    photos: [
      {
        src: axialImg,
        caption: { zh: '1N4007 实物特写', en: 'A 1N4007, close-up' },
        author: 'Zxelt',
        license: 'CC0',
        licenseUrl: CC0,
        page: commons('Diode_1N4007.jpg'),
      },
    ],
  },
  {
    id: 'to247',
    name: { zh: 'TO-220 / TO-247 单管', en: 'TO-220 / TO-247 discrete' },
    range: [1, 60],
    current: { zh: '几十安以下（例：ST STTH3012，DO-247，1200 V、30 A）', en: 'Up to a few tens of amps (e.g. ST STTH3012, DO-247: 1200 V, 30 A)' },
    cooling: {
      zh: '单面：热量经背面的金属底板传给散热器。底板通常与阴极相连，是带电的，要垫绝缘片（1.2-3）。',
      en: 'Single-sided: heat goes through the metal tab on the back into a heatsink. The tab is usually tied to the cathode, so it is live and needs an insulating pad (1.2-3).',
    },
    use: { zh: '开关电源、逆变器等中小功率电路。', en: 'Switching supplies, inverters and other low-to-medium power circuits.' },
    note: {
      zh: '这只实物是三引脚的版本；我们 1.2-3 的 3D 模型画的是两引脚的 DO-247。实物背面可以看到安装孔。',
      en: 'This part has three leads; the 3D model of 1.2-3 is the two-lead DO-247. The mounting hole is visible on the back.',
    },
    photos: [
      {
        src: to247Img,
        caption: { zh: 'TO-247 封装的整流管（ST STPS30L40CW，肖特基），取自一块电源板', en: 'A TO-247 rectifier (ST STPS30L40CW, a Schottky diode) from a power-supply board' },
        author: 'Raimond Spekking',
        license: 'CC BY-SA 4.0',
        licenseUrl: BYSA4,
        page: commons('CWT-300ATX-A_-_STMicroelectronics_STPS30L40CW-1.jpg'),
      },
    ],
  },
  {
    id: 'stud',
    name: { zh: '螺栓型', en: 'Stud type' },
    range: [20, 600],
    current: { zh: '几十到几百安（例：Vishay VS-70HF120，1200 V、70 A；照片里的 D355N2000：2000 V、355 A）', en: 'Tens to hundreds of amps (e.g. Vishay VS-70HF120: 1200 V, 70 A; the D355N2000 pictured: 2000 V, 355 A)' },
    cooling: {
      zh: '单面：螺栓拧进散热器，它既是一个电极（阳极还是阴极随型号），又把热量传出去；另一个电极用柔软的铜带或接线端子引出。',
      en: 'Single-sided: the stud screws into the heatsink and is both one electrode (anode or cathode, depending on the type) and the heat path; the other electrode leaves through a flexible copper strap or a terminal.',
    },
    use: { zh: '中等功率的整流电源等。国内教材里的功率二极管外形图多是这种。', en: 'Medium-power rectifier supplies and the like. Textbook pictures of a power diode are often this type.' },
    photos: [
      {
        src: studImg,
        tab: { zh: '外观', en: 'Outside' },
        caption: { zh: 'D355N2000 螺栓型整流管：355 A、2000 V（罗马尼亚 I.P.R.S. Băneasa 生产，1980 年代）；标尺单位 cm', en: 'D355N2000 stud rectifier: 355 A, 2000 V (made by I.P.R.S. Băneasa, Romania, 1980s); ruler in cm' },
        author: 'Mister rf',
        license: 'CC BY-SA 4.0',
        licenseUrl: BYSA4,
        page: commons('D355N2000.jpg'),
      },
      {
        src: studCutImg,
        tab: { zh: '剖开', en: 'Cut open' },
        caption: { zh: '同一型号剖开的实物：螺栓一端是铜底座，里面是叠起来的芯片与绝缘件，另一端引出铜带', en: 'The same type cut open: a copper base at the stud end, a stack of chip and insulating parts inside, and a copper strap leading out the other end' },
        author: 'Mister rf',
        license: 'CC BY-SA 4.0',
        licenseUrl: BYSA4,
        page: commons('D355N2000_cross_section.jpg'),
      },
    ],
  },
  {
    id: 'module',
    name: { zh: '模块', en: 'Module' },
    range: [30, 2000],
    current: { zh: '几十到上千安', en: 'Tens to over a thousand amps' },
    cooling: {
      zh: '单面：多只芯片并联，焊在同一块绝缘（陶瓷）衬板上，底板贴散热器；电上与散热器绝缘，所以不必再垫绝缘片。',
      en: 'Single-sided: several chips in parallel are soldered on one insulating (ceramic) substrate and the base plate sits on a heatsink; it is electrically isolated from the heatsink, so no extra pad is needed.',
    },
    use: { zh: '变频器、逆变器。二极管常与 IGBT 封装在同一个模块里，反并联在 IGBT 旁边做续流管。', en: 'Drives and inverters. Diodes are often packed with IGBTs in one module, antiparallel to each IGBT as the freewheeling diode.' },
    photos: [
      {
        src: moduleImg,
        caption: { zh: '三菱 CM1400DU-24NF（外壳标签）：双管（半桥）IGBT 模块，里面每只 IGBT 都反并联着二极管', en: 'Mitsubishi CM1400DU-24NF (per its label): a dual (half-bridge) IGBT module with a diode antiparallel to each IGBT' },
        author: 'Sthdhk',
        license: 'CC BY-SA 4.0',
        licenseUrl: BYSA4,
        page: commons('MITSUBISHI_IGBT_module.jpg'),
      },
    ],
  },
  {
    id: 'press',
    name: { zh: '平板压接型', en: 'Press-pack' },
    range: [500, 5000],
    current: { zh: '上千安，可达几千安（例：ABB 5SDD 08D5000，5000 V、1028 A）', en: 'Thousands of amps (e.g. ABB 5SDD 08D5000: 5000 V, 1028 A)' },
    cooling: { zh: '双面：上下两个极面都贴散热器，由外部夹具压紧（十到上百千牛，1.2-4）。', en: 'Double-sided: both pole faces sit against heatsinks, held by an external clamp (about ten to over a hundred kN, 1.2-4).' },
    use: { zh: '大功率整流（电解、电力机车等）。高压直流输电的换流阀用的是同样封装的压接型晶闸管。', en: 'High-power rectification (electrolysis, electric locomotives). HVDC converter valves use thyristors in the same package.' },
    note: { zh: '照片是一只压接型晶闸管（4200 V），封装形式与压接型二极管相同。', en: 'The photo shows a press-pack thyristor (4200 V); the package form is the same as for a press-pack diode.' },
    photos: [
      {
        src: pressImg,
        caption: { zh: 'Westcode（现属 IXYS）N3476TC420 平板压接型晶闸管，4200 V', en: 'Westcode (now IXYS) N3476TC420 press-pack thyristor, 4200 V' },
        author: 'Johnny.m76',
        license: 'CC BY-SA 3.0',
        licenseUrl: BYSA3,
        page: commons('Thyristor_Westcode_N3476TC420.jpg'),
      },
    ],
  },
]

export const UI_PACKAGES = {
  hint: { zh: '点一种封装，看它的实物照片、电流范围、怎么散热、用在哪里。', en: 'Pick a package to see its photo, current range, cooling and uses.' },
  chartTitle: { zh: '各种封装的电流范围（对数坐标，量级示意）', en: 'Current range by package (log axis, order of magnitude)' },
  rows: { current: { zh: '电流', en: 'Current' }, cooling: { zh: '散热', en: 'Cooling' }, use: { zh: '用途', en: 'Used for' } },
  photoBy: { zh: '照片', en: 'Photo' },
  resized: { zh: '已缩小', en: 'downsized' },
  from: { zh: '来源：Wikimedia Commons', en: 'Source: Wikimedia Commons' },
}
