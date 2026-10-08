// 1.2 三维舞台（Diode3DStage）的界面文字：公用按钮、各模型的操作提示、"视图"说明与零件说明
import type { BiText } from '../../../app/settings'

export interface PartText {
  name: BiText
  what: BiText
  real: BiText
}

/** 舞台上可以开关的视图 */
export type ViewId = 'heat' | 'force'

export interface ModelText {
  hint: BiText
  /** 视图打开时，说明卡里多出的一段 */
  notes: Partial<Record<ViewId, BiText>>
  parts: Record<string, PartText>
}

export const UI3D = {
  stage: {
    explode: { zh: '爆炸分解', en: 'Explode' },
    assemble: { zh: '合拢', en: 'Assemble' },
    slider: { zh: '分解程度', en: 'Explode' },
    zoomIn: { zh: '放大', en: 'Zoom in' },
    zoomOut: { zh: '缩小', en: 'Zoom out' },
    views: {
      heat: { zh: '显示热流', en: 'Heat flow' },
      force: { zh: '显示压力', en: 'Clamping force' },
    } satisfies Record<ViewId, BiText>,
  },
  to247: {
    hint: {
      zh: '拖动旋转；＋／－ 或 Ctrl + 滚轮缩放；点编号看每个零件的作用。把"分解程度"拉到底，芯片还会一层层拉开。',
      en: 'Drag to rotate; ＋／－ or Ctrl + wheel to zoom; click a number to learn what each part does. Drag the slider to the end and the chip opens up layer by layer.',
    },
    notes: {
      heat: {
        zh: '热量从芯片经焊料、铜底板传给散热器，只有背面这一个方向（单面散热）。底板通常与某个电极相连（多数二极管是阴极 K），是带电的，装到散热器上要垫绝缘片。',
        en: 'Heat flows from the chip through the solder and copper base into the heatsink: one direction only (single-sided cooling). The base is usually tied to one electrode (the cathode K in most diodes), so it is live and needs an insulating pad on the heatsink.',
      },
    },
    parts: {
      shell: {
        name: { zh: '塑封外壳', en: 'Moulded body' },
        what: { zh: '环氧树脂塑封料把芯片、键合线和引线框架包起来：绝缘、防潮、防机械损伤。它导热很差，热量主要不是从它散走的。', en: 'Epoxy moulding compound wraps the chip, wires and lead frame: insulation, moisture and mechanical protection. It conducts heat poorly, so little heat leaves through it.' },
        real: { zh: '外形：宽约 16 mm、厚约 5 mm（TO-247）。', en: 'Outline: about 16 mm wide, 5 mm thick (TO-247).' },
      },
      wire: {
        name: { zh: '铝键合线', en: 'Aluminium bond wires' },
        what: { zh: '把芯片正面（阳极 P⁺）接到阳极引脚。一根线能载的电流有限，所以几根并联；电流大的模块里常有几十根。', en: 'They connect the chip front (anode, P⁺) to the anode lead. One wire carries limited current, so several run in parallel; high-current modules often have dozens.' },
        real: { zh: '本图画了 3 根，线径放大了；功率器件常用直径约 0.1–0.5 mm 的粗铝线（也有铜线、铝带）。', en: 'Three are drawn, with exaggerated diameter; power devices typically use thick aluminium wire of about 0.1–0.5 mm (copper wire and ribbon also exist).' },
      },
      chip: {
        name: { zh: '芯片（硅）', en: 'Chip (silicon)' },
        what: { zh: '就是 1.1 的 P⁺N⁻N⁺：正面铺铝（阳极），背面镀金属（阴极），电流从正面垂直流到背面。分解到最后，各层会一层层拉开。', en: 'The P⁺N⁻N⁺ of 1.1: aluminium on the front (anode), metal on the back (cathode); current flows vertically from front to back. At full explosion the layers open up.' },
        real: { zh: '示例 PiN（30 A、100 A/cm²）的芯片面积 0.3 cm²，约 5.5 mm 见方；真实硅片厚 0.1–0.3 mm，本图放大了约 5 倍。', en: 'The example PiN (30 A at 100 A/cm²) has 0.3 cm² of area, about 5.5 mm square; real silicon is 0.1–0.3 mm thick, drawn here ~5× thicker.' },
      },
      solder: {
        name: { zh: '焊料层', en: 'Solder layer' },
        what: { zh: '把芯片背面（N⁺ 阴极）焊在铜板上：既导电又导热。焊料层要薄、没有空洞，否则热量散不出去。', en: 'It solders the chip back (N⁺ cathode) onto the copper: it conducts both current and heat. The layer must be thin and void-free, or the heat cannot escape.' },
        real: { zh: '真实厚度只有几十到一百微米量级，本图放大了。', en: 'Really only tens to about a hundred micrometres; enlarged here.' },
      },
      frame: {
        name: { zh: '铜引线框架（含底板）', en: 'Copper lead frame (with base)' },
        what: { zh: '底板加引脚：电流经它进出芯片，热量经它的背面传给散热器。阴极 K 引脚与底板连成一体，阳极 A 引脚单独引出，末端有接键合线的焊盘。底板上的孔用来拧螺钉。', en: 'Base plus leads: current enters and leaves the chip through it, and heat leaves through its back. The cathode K lead is one piece with the base; the anode A lead is separate and ends in a pad for the bond wires. The hole takes a mounting screw.' },
        real: { zh: '底板厚约 1.5 mm，背面裸露在塑封外、贴着散热器。', en: 'The base is about 1.5 mm thick; its back is exposed outside the moulding, against the heatsink.' },
      },
    },
  },
  pressfit: {
    hint: {
      zh: '拖动旋转；＋／－ 或 Ctrl + 滚轮缩放；点编号看每个零件的作用。点"爆炸分解"：上电极、钼片、晶圆依次升起，下电极和陶瓷环是连在一起的"管壳底座"，留在原处；拉到底，晶圆还会一层层拉开。',
      en: 'Drag to rotate; ＋／－ or Ctrl + wheel to zoom; click a number to learn what each part does. Explode: the top pole, moly discs and wafer rise in turn while the bottom pole and ceramic ring stay together as the housing base; at the end the wafer opens up layer by layer.',
    },
    notes: {
      heat: {
        zh: '热量从晶圆经钼片、铜电极，同时向上和向下传给两个散热器：双面散热，同一只器件的结到壳热阻约为单面散热的一半（具体见数据手册）。两个极面同时也是电流的通路，散热器带着电位，水冷时常用去离子水。',
        en: 'Heat leaves the wafer through the moly discs and copper poles into two heatsinks at once: double-sided cooling, with a junction-to-case thermal resistance of about half the single-sided value (see the datasheet). The pole faces also carry the current, so the heatsinks sit at electrical potential; water cooling usually uses deionised water.',
      },
      force: {
        zh: '没有焊料，全靠外部夹具从上下两面压紧，压力要均匀。压力不够，接触电阻和热阻变大、局部发热；压得过大会压坏晶圆。压力的量级是十到上百千牛，随晶圆直径增大（例如 ABB 5SDD 08D5000 为 10 ± 2 kN），以数据手册为准。',
        en: 'With no solder, an external clamp presses on both faces and the pressure must be even. Too little force raises the contact and thermal resistance and causes hot spots; too much can crack the wafer. The force ranges from about ten to over a hundred kN, growing with wafer diameter (the ABB 5SDD 08D5000, for example, takes 10 ± 2 kN); follow the datasheet.',
      },
    },
    parts: {
      shell: {
        name: { zh: '陶瓷管壳', en: 'Ceramic housing' },
        what: { zh: '氧化铝陶瓷环，上下焊上金属法兰，和两块铜电极一起把晶圆密封起来（可以气密封装）。陶瓷绝缘、耐高温、不老化；外面一圈圈裙边是为了拉长表面的爬电距离，耐受高电压。', en: 'An alumina ceramic ring with metal flanges welded top and bottom; with the two copper poles it seals the wafer (hermetic packaging is possible). Ceramic is insulating, heat-resistant and does not age; the rings of sheds on the outside lengthen the surface creepage path for high voltage.' },
        real: { zh: '外形随电流等级变化，晶圆越大外壳越大。本图取外径约 76 mm、高约 26 mm 作示意。', en: 'The size grows with the current rating (bigger wafer, bigger housing). Drawn here at about 76 mm across and 26 mm high, as an illustration.' },
      },
      pole: {
        name: { zh: '铜电极（极面）', en: 'Copper poles' },
        what: { zh: '上下各一块铜电极，既是电的出口也是热的出口：电流由它进出晶圆，热量由它传给外面的散热器。图中上面一块接阳极 A，下面一块接阴极 K（上下哪个是阳极，随型号而定）。极面平整，直接贴在散热器上。', en: 'One copper pole on each side, both the electrical and the thermal exit: current enters and leaves the wafer through them and heat goes on to the heatsinks. Here the top one is the anode A and the bottom one the cathode K (which side is the anode depends on the part). The faces are flat and press directly against the heatsinks.' },
        real: { zh: '极面的平整度和平行度要求很高，否则压力不均匀，局部接触不好就会过热。', en: 'Flatness and parallelism of the faces are demanding: uneven pressure means poor contact and local overheating.' },
      },
      moly: {
        name: { zh: '钼片', en: 'Molybdenum discs' },
        what: { zh: '硅和铜的热膨胀系数差得很多（硅约 2.6×10⁻⁶/K，铜约 17×10⁻⁶/K），钼约 5×10⁻⁶/K，介于两者之间，又能导电导热。垫在硅片两侧，温度反复变化时硅片不会被铜拉裂。', en: 'Silicon and copper expand very differently (about 2.6×10⁻⁶/K versus 17×10⁻⁶/K). Molybdenum, at about 5×10⁻⁶/K, lies in between and conducts both current and heat. Placed either side of the wafer, it keeps the silicon from being torn by the copper as the temperature cycles.' },
        real: { zh: '本图两侧都是"干压"接触（硅片可以在里面自由浮动）；也有产品把硅片与其中一片钼片合金连在一起，以厂家资料为准。', en: 'Both sides are dry-pressed here (the wafer floats freely); some products instead alloy the wafer to one moly disc. Follow the manufacturer.' },
      },
      wafer: {
        name: { zh: '硅晶圆', en: 'Silicon wafer' },
        what: { zh: '一整片晶圆就是一只二极管：还是 1.1 的 P⁺N⁻N⁺ 三层，只是直径做到几十到一百多毫米。电流大靠面积大，耐压高靠 N⁻ 厚。分解到最后，各层会一层层拉开。', en: 'One whole wafer is one diode: the same P⁺N⁻N⁺ of 1.1, only tens of millimetres up to over a hundred across. Large current comes from large area, high blocking voltage from a thick N⁻ layer. At full explosion the layers open up.' },
        real: { zh: '真实的晶圆厚度约零点几毫米到一毫米量级（耐压越高越厚）；本图放大了数倍。', en: 'Real wafers are roughly a few tenths of a millimetre to about a millimetre thick (thicker for higher voltage); drawn several times thicker here.' },
      },
      edge: {
        name: { zh: '边缘斜角与保护胶', en: 'Bevel and edge coating' },
        what: { zh: '晶圆边缘磨出斜面（斜角），再涂硅橡胶或聚酰亚胺保护。结的边缘暴露在表面，电场容易挤在一起、先于中间击穿；斜面让 P⁺ 一侧大、N⁻ 一侧小（正斜角），电场沿斜面"摊开"，表面场比体内低；保护胶防止污染和表面放电。这是 1.2-2 讲的终端结构的另一种做法。', en: 'The wafer rim is ground to a slope (the bevel) and coated with silicone rubber or polyimide. The junction edge reaches the surface, where the field crowds and breaks down before the middle. The slope is wider on the P⁺ side and narrower on the N⁻ side (a positive bevel), so the field spreads along it and the surface field stays below the bulk value; the coating guards against contamination and surface discharge. This is the other termination structure from 1.2-2.' },
        real: { zh: '真实的斜角很小，只有几度，斜面又长又平缓；本图夸大成约 30° 才看得清。保护胶圈单独拿开，才露出斜面。', en: 'The real bevel angle is small, only a few degrees, a long gentle slope; drawn at about 30° to be visible. Lift the coating ring away to see the slope.' },
      },
    },
  },
} satisfies { stage: unknown; to247: ModelText; pressfit: ModelText }
