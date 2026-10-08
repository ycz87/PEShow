// 1.2-2 剖面图（PinSectionStage）的界面文字：列标题、各层的名称与说明、终端结构三种状态的说明
import type { BiText } from '../../../app/settings'
import type { ColumnId, LayerId } from '../sectionLayers'

export interface LayerText {
  name: BiText
  /** 各列里这一层的厚度、浓度（没有的列不写） */
  spec: Partial<Record<ColumnId, { um: BiText; dop: BiText }>>
  what: BiText
}

export type TermId = 'none' | 'rings' | 'bevel'

export const UI_SECTION = {
  col: {
    pin: { title: { zh: '示例 PiN', en: 'Example PiN' }, sub: { zh: '1.1 的舞台 · 非穿通 · 厚衬底', en: 'the 1.1 stage · non-punch-through · thick substrate' } },
    real: { title: { zh: '真实 1200 V 产品', en: 'A real 1200 V part' }, sub: { zh: '薄片工艺 · 穿通型（带场截止层）', en: 'thin wafer · punch-through (field stop)' } },
  } satisfies Record<ColumnId, { title: BiText; sub: BiText }>,
  front: { zh: '正面 · 阳极 A', en: 'Front · anode A' },
  back: { zh: '背面 · 阴极 K', en: 'Back · cathode K' },
  current: { zh: '电流', en: 'Current' },
  cut: {
    title: { zh: '这个剖面是从哪里切的？', en: 'Where is this section cut?' },
    text: {
      zh: '把芯片沿中线竖直切开、移走前半块，露出的切面就是剖面。电流从正面垂直穿到背面，沿厚度方向切最能看清各层。下面两列画的是切面中间的一小条（黄框）；红圈是芯片的边缘，最下面的终端结构图就是把它放大。',
      en: 'Cut the chip straight down through its middle and remove the front half: the face that appears is the section. Current runs through the thickness from front to back, so cutting along the thickness shows the layers best. The two columns below draw a narrow strip from the middle of the cut face (yellow frame); the red ring is the chip edge, which the termination drawing at the bottom enlarges.',
    },
    note: {
      zh: 'TO-247 里是几毫米见方的小芯片，平板压接型里是整片圆晶圆，切法相同。图里的厚度画得比真实（约 0.1–0.3 mm）厚得多。',
      en: 'A TO-247 holds a small chip a few millimetres square and a press-pack a whole round wafer, cut the same way. The thickness is drawn far thicker than real (about 0.1–0.3 mm).',
    },
    face: { zh: '剖切面', en: 'Cut face' },
    removed: { zh: '切掉的前半块', en: 'Removed front half' },
    strip: { zh: '下面两列画的这一条', en: 'The strip drawn below' },
    edge: { zh: '边缘（见最下方放大）', en: 'Edge (enlarged at the bottom)' },
    front: { zh: '正面（A）', en: 'Front (A)' },
    back: { zh: '背面（K）', en: 'Back (K)' },
  },
  field: { zh: '电场', en: 'Field' },
  triangle: { zh: '三角形', en: 'Triangle' },
  trapezoid: { zh: '梯形', en: 'Trapezoid' },
  scaleBar: { zh: '100 µm', en: '100 µm' },
  hair: { zh: '头发丝 ≈ 70 µm', en: 'Hair ≈ 70 µm' },
  slider: { zh: '真实比例', en: 'True scale' },
  sliderEnd: { zh: '1.1 的舞台', en: 'The 1.1 stage' },
  toStage: { zh: '压缩成 1.1 的比例', en: 'Squash to the 1.1 stage' },
  toReal: { zh: '回到真实比例', en: 'Back to true scale' },
  hint: {
    zh: '点一层看说明。拖动下面的滑块：从真实比例一点点压缩成 1.1 里的舞台——1.1 画的是压缩版，P⁺ 和 N⁺ 被画得比真实宽得多。两列用同一把尺，所以真实的薄片只有示例 PiN 的三分之一高。',
    en: 'Click a layer for details. Drag the slider from true scale to the squashed stage of 1.1: that stage is a compressed picture, with P⁺ and N⁺ drawn far wider than they are. Both columns share one ruler, so the real thin wafer is only a third as tall as the example.',
  },
  eqTitle: { zh: '为什么多一层场截止层', en: 'Why add a field-stop layer' },
  eq: {
    zh: '非穿通：电场是三角形，N⁻ 必须厚到把整个三角形装下，电场才不会碰到 N⁺。穿通：N⁻ 底部允许还有电场，由更浓的场截止层很快截住，同样的耐压，N⁻ 可以更薄（面积 = 电压，1.1「深入一步」）。N⁻ 薄了，导通压降更低、关断时要清掉的存储电荷也更少。',
    en: 'Non-punch-through: the field is a triangle, and N⁻ must be thick enough to hold all of it before it touches N⁺. Punch-through: some field may remain at the bottom of N⁻ and a denser field-stop layer cuts it off quickly, so the same blocking voltage needs a thinner N⁻ (area = voltage, the 1.1 deep-dive). A thinner N⁻ means lower on-state drop and less stored charge to clear at turn-off.',
  },
  layers: {
    metalF: {
      name: { zh: '正面金属', en: 'Front metal' },
      spec: { pin: { um: { zh: '约 3 µm', en: '~3 µm' }, dop: { zh: '铝', en: 'Al' } }, real: { um: { zh: '约 3 µm', en: '~3 µm' }, dop: { zh: '铝合金（AlSiCu）', en: 'Al alloy (AlSiCu)' } } },
      what: { zh: '把电流均匀地引到整个 P 区表面，上面再接键合线（1.2-3）或压接钼片（1.2-4）。真实约 3 µm（Infineon 芯片手册），比头发丝细二十几倍。', en: 'It spreads the current over the whole P surface, with bond wires (1.2-3) or a pressed moly disc (1.2-4) on top. About 3 µm in reality (Infineon chip datasheet), over twenty times thinner than a hair.' },
    },
    p: {
      name: { zh: 'P⁺ 阳极', en: 'P⁺ anode' },
      spec: { pin: { um: { zh: '数 µm', en: 'a few µm' }, dop: { zh: '约 10¹⁹ cm⁻³', en: '~10¹⁹ cm⁻³' } }, real: { um: { zh: '数 µm', en: 'a few µm' }, dop: { zh: '较低（弱阳极）', en: 'lower (weak anode)' } } },
      what: { zh: '向 N⁻ 注入空穴，就是 1.1 的电导调制。示例 PiN 约 10¹⁹ cm⁻³、厚度只有几微米。现代快恢复二极管常把阳极做得淡一些（弱阳极），少注入一点空穴，换来更软、更快的反向恢复（见 1.5）。', en: 'It injects holes into N⁻: the conductivity modulation of 1.1. The example PiN has about 10¹⁹ cm⁻³ and only a few micrometres. Modern fast-recovery diodes often use a lighter anode (weak anode) that injects fewer holes, for a softer and faster recovery (see 1.5).' },
    },
    nm: {
      name: { zh: 'N⁻ 漂移区', en: 'N⁻ drift region' },
      spec: { pin: { um: { zh: '120 µm', en: '120 µm' }, dop: { zh: '1.3×10¹⁴ cm⁻³', en: '1.3×10¹⁴ cm⁻³' } }, real: { um: { zh: '约 95 µm', en: '~95 µm' }, dop: { zh: '约 10¹⁴ cm⁻³ 量级', en: 'order of 10¹⁴ cm⁻³' } } },
      what: { zh: '承受电压的地方，也是电导调制发生的地方。示例取 120 µm；1200 V 级真实产品约 85–100 µm（Lutz 等），和一根头发丝（约 70 µm）差不多粗。电压越高，它越厚、越淡。', en: 'It blocks the voltage and is where the conductivity modulation happens. The example uses 120 µm; real 1200 V parts have about 85–100 µm (Lutz et al.), about as thick as a human hair (≈70 µm). Higher voltage means thicker and lighter.' },
    },
    fs: {
      name: { zh: '场截止层', en: 'Field stop' },
      spec: { real: { um: { zh: '十几 µm（量级）', en: 'a dozen µm (order)' }, dop: { zh: '介于 N⁻、N⁺ 之间', en: 'between N⁻ and N⁺' } } },
      what: { zh: '只有穿通型有：一层浓度介于 N⁻ 和 N⁺ 之间的 N 型层，把穿到 N⁻ 底部的电场截住（1.1「深入一步」）。有了它，N⁻ 可以做得更薄，导通压降更低、关断时的存储电荷更少。', en: 'Only punch-through parts have it: an N layer between N⁻ and N⁺ in doping that stops the field reaching the bottom of N⁻ (1.1 deep-dive). It lets N⁻ be thinner, with lower on-state drop and less stored charge at turn-off.' },
    },
    np: {
      name: { zh: 'N⁺ 阴极', en: 'N⁺ cathode' },
      spec: {
        pin: { um: { zh: '约 220 µm', en: '~220 µm' }, dop: { zh: '约 10¹⁹ cm⁻³', en: '~10¹⁹ cm⁻³' } },
        real: { um: { zh: '约 2 µm（量级）', en: '~2 µm (order)' }, dop: { zh: '高', en: 'high' } },
      },
      what: { zh: '高浓度，与背面金属形成欧姆接触（1.1 的 N⁺）。厚衬底工艺的 N⁺ 衬底有 220–300 µm，占整片厚度的大头，只起机械支撑和导电的作用，还要多串一段电阻；薄片工艺把它磨得很薄，整片芯片只有约 120 µm，导通压降更小。', en: 'Heavily doped, making an ohmic contact with the back metal (the N⁺ of 1.1). A thick-substrate process uses 220–300 µm of it, most of the chip thickness, serving only as support and conductor, with extra series resistance. A thin-wafer process grinds it very thin, leaving about 120 µm for the whole chip and a lower on-state drop.' },
    },
    metalB: {
      name: { zh: '背面金属', en: 'Back metal' },
      spec: { pin: { um: { zh: '约 1 µm（量级）', en: '~1 µm (order)' }, dop: { zh: '镍–银多层', en: 'Ni–Ag stack' } }, real: { um: { zh: '约 1 µm（量级）', en: '~1 µm (order)' }, dop: { zh: '镍–银多层', en: 'Ni–Ag stack' } } },
      what: { zh: '镍–银多层金属，用来把芯片背面焊到铜引线框架上（1.2-3 的焊料层）。', en: 'A nickel–silver multilayer that lets the chip back be soldered to the copper lead frame (the solder layer of 1.2-3).' },
    },
  } as Record<LayerId, LayerText>,
  term: {
    title: { zh: '芯片边缘：终端结构', en: 'The chip edge: termination' },
    sketch: { zh: '示意图：不按比例，也不是电场计算结果', en: 'Sketch: not to scale and not a field calculation' },
    where: { zh: '放大的是上面剖面的右边缘一角（剖切示意图里红圈的位置）。', en: 'This enlarges the right-hand edge of the section above (the red ring in the cut sketch).' },
    tabs: {
      none: { zh: '没有终端', en: 'No termination' },
      rings: { zh: '场限环（平面芯片）', en: 'Guard rings (planar chip)' },
      bevel: { zh: '斜角（整片晶圆）', en: 'Bevel (whole wafer)' },
    } satisfies Record<TermId, BiText>,
    text: {
      none: {
        zh: '结在芯片中间是平的，到了边缘向表面弯曲。弯曲处电场线向拐角汇拢，电场最强（红色），比平的部分先击穿，实际耐压会明显低于 1.1 算出的平行平面击穿电压。',
        en: 'The junction is flat in the middle and bends up to the surface at the edge. Field lines converge on the corner, where the field is strongest (red) and breaks down before the flat part, so the real blocking voltage falls well below the parallel-plane value of 1.1.',
      },
      rings: {
        zh: '在主结外面再扩散几圈浮空的 P 环（与主结同时扩散，不多一道工序）。耗尽层从主结铺开，碰到第一个环，再从环往外铺……电压被一环环分担，每个拐角的电场都降下来。电压越高，环越多、边缘占得越宽；也可以盖上金属场板。',
        en: 'A few floating P rings are diffused outside the main junction (in the same step as the main junction). The depletion layer spreads from the junction to the first ring, then on from that ring, and so on: the voltage is shared ring by ring and every corner sees less field. Higher voltage needs more rings and a wider edge; a metal field plate is another option.',
      },
      bevel: {
        zh: '整片晶圆的大功率器件把边缘磨成斜面（正斜角：P⁺ 一侧大、N⁻ 一侧小），再涂硅橡胶或聚酰亚胺。耗尽层沿斜面铺得很长，表面电场比体内低，击穿发生在体内而不是边缘。真实的斜角只有几度，图里夸大了。',
        en: 'Whole-wafer high-power devices grind the edge to a slope (a positive bevel: larger on the P⁺ side, smaller on the N⁻ side) and coat it with silicone rubber or polyimide. The depletion layer stretches along the slope, so the surface field stays below the bulk field and breakdown happens inside, not at the edge. Real bevels are only a few degrees; exaggerated here.',
      },
    } satisfies Record<TermId, BiText>,
    legend: {
      depl: { zh: '耗尽层', en: 'Depletion layer' },
      line: { zh: '电场线（反向电压下，从 N⁻ 指向 P⁺）', en: 'Field lines (reverse bias, N⁻ to P⁺)' },
      hot: { zh: '电场最强处', en: 'Strongest field' },
      coat: { zh: '保护胶', en: 'Coating' },
    },
    marks: {
      front: { zh: '正面', en: 'Front' },
      pplus: { zh: 'P⁺', en: 'P⁺' },
      nminus: { zh: 'N⁻', en: 'N⁻' },
      nplus: { zh: 'N⁺', en: 'N⁺' },
      hotHere: { zh: '先击穿', en: 'breaks down first' },
      ring: { zh: '场限环', en: 'ring' },
      surface: { zh: '表面电场较小', en: 'low surface field' },
      cut: { zh: '芯片中间（省略）', en: 'chip centre (omitted)' },
    },
  },
}
