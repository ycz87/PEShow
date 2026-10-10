// 1.3 静态特性与静态参数的界面文字：图上的标注、滑块、读数与参数表
import type { BiText } from '../../../app/settings'

/** 参数表的一行：额定值（限速牌，不能超过）、特性值（体检报告，规定条件下测得）或测试条件 */
export interface ParamRow {
  key: string
  kind: 'rating' | 'char' | 'cond'
  /** 符号（KaTeX） */
  sym: string
  name: BiText
  /** 含义（支持行内公式） */
  means: BiText
  /** 示例 PiN 的数值（{…} 由舞台填入） */
  ex: BiText
  /** 真实器件 STTH3012 的数值（手册没有给出时注明，并给出同类器件的例子） */
  ds: BiText
}

const NONE: BiText = { zh: '—', en: '—' }

/** 正向参数：两个特性值 + 一个测试条件 + 三个电流额定值 */
export const FWD_ROWS: ParamRow[] = [
  {
    key: 'UF',
    kind: 'char',
    sym: 'U_F',
    name: { zh: '正向压降', en: 'Forward voltage' },
    means: { zh: '指定电流、指定结温下的正向电压。手册给典型值和最大值，设计按最大值。', en: 'Forward voltage at a stated current and junction temperature; typical and maximum values are given, designs use the maximum.' },
    ex: { zh: '{i} A、25 °C：{u} V', en: '{i} A, 25 °C: {u} V' },
    ds: { zh: '30 A：25 °C 最大 2.25 V；125 °C 典型 1.35 V / 最大 2.05 V', en: '30 A: 25 °C max 2.25 V; 125 °C typ 1.35 V / max 2.05 V' },
  },
  {
    key: 'line',
    kind: 'char',
    sym: 'U_{TO},\\ r_T',
    name: { zh: '门槛电压、斜率电阻', en: 'Threshold voltage, slope resistance' },
    means: {
      zh: '在额定电流附近贴合正向曲线的一条直线 $u_F = U_{TO} + r_T i_F$ 的截距和斜率，用来算导通损耗 $P = U_{TO}I_{F(AV)} + r_T I_{F(RMS)}^2$。',
      en: 'Intercept and slope of a straight line $u_F = U_{TO} + r_T i_F$ fitted near rated current, used for conduction loss $P = U_{TO}I_{F(AV)} + r_T I_{F(RMS)}^2$.',
    },
    ex: { zh: '{u} V、{r} mΩ（取 15–60 A）', en: '{u} V, {r} mΩ (15–60 A)' },
    ds: { zh: '损耗公式：1.60 V、12 mΩ（与 150 °C 的最大压降相符）', en: 'Loss formula: 1.60 V, 12 mΩ (matches the 150 °C maximum)' },
  },
  {
    key: 'IF',
    kind: 'cond',
    sym: 'I_F',
    name: { zh: '正向电流', en: 'Forward current' },
    means: { zh: '测 $U_F$ 时规定的电流，只是**测试条件**，不是额定值。', en: 'The current at which $U_F$ is measured: a **test condition**, not a rating.' },
    ex: { zh: '随滑块：{i} A', en: 'Slider: {i} A' },
    ds: { zh: '30 A（测 $U_F$ 用）', en: '30 A (for $U_F$)' },
  },
  {
    key: 'IAV',
    kind: 'rating',
    sym: 'I_{F(AV)}',
    name: { zh: '正向平均电流', en: 'Average forward current' },
    means: {
      zh: '长期工作时允许的最大**平均值**，要指明波形和壳温。它由**发热**决定：电流越大损耗越大，结温升到最高结温 $T_{JM}$ 就到头了。器件说的"30 A"就是它。',
      en: 'Largest **average** current in continuous use, for a stated waveform and case temperature. A **heating** limit: the junction must stay below $T_{JM}$. The "30 A" in the part name is this.',
    },
    ex: { zh: '30 A（芯片 0.3 cm²）', en: '30 A (0.3 cm² chip)' },
    ds: { zh: '30 A（壳温 140 °C、占空比 0.5 的方波）；$T_{JM}$ = 175 °C', en: '30 A (case 140 °C, square wave, duty 0.5); $T_{JM}$ = 175 °C' },
  },
  {
    key: 'IRMS',
    kind: 'rating',
    sym: 'I_{F(RMS)}',
    name: { zh: '正向有效值电流', en: 'RMS forward current' },
    means: {
      zh: '长期工作时允许的最大**有效值**，不论什么波形都不能超过（常由引脚、键合线决定）。正弦半波的有效值是平均值的 1.57 倍，所以 $I_{F(AV)}$、$I_{F(RMS)}$ 两条要同时满足。',
      en: 'Largest **rms** current in continuous use, whatever the waveform (often set by leads and bond wires). A half sine has rms = 1.57 × average, so both limits must hold.',
    },
    ex: NONE,
    ds: { zh: '50 A', en: '50 A' },
  },
  {
    key: 'IFSM',
    kind: 'rating',
    sym: 'I_{FSM}',
    name: { zh: '浪涌电流', en: 'Surge current' },
    means: {
      zh: '偶尔一次的 10 ms 正弦半波过电流（给出峰值），如上电时给电容充电。热量来不及散走，靠芯片自身的热容扛住，**不能重复**。配熔断器用 $I^2t$。',
      en: 'An occasional 10 ms half-sine overcurrent (peak value), e.g. charging capacitors at power-up. The heat has no time to escape and is absorbed by the chip; **not repetitive**. Fuses are matched by $I^2t$.',
    },
    ex: NONE,
    ds: { zh: '210 A（约为 $I_{F(AV)}$ 的 7 倍）', en: '210 A (about 7 × $I_{F(AV)}$)' },
  },
]

/** 反向参数：四个电压额定值 + 两个特性值 */
export const REV_ROWS: ParamRow[] = [
  {
    key: 'UR',
    kind: 'rating',
    sym: 'U_R',
    name: { zh: '反向直流电压（直流阻断电压）', en: 'DC reverse (blocking) voltage' },
    means: { zh: '能长期加的直流反向电压。', en: 'DC reverse voltage that may be applied continuously.' },
    ex: NONE,
    ds: { zh: '未给出（1N4007：1000 V，与 $U_{RRM}$ 相同）', en: 'Not given (1N4007: 1000 V, same as $U_{RRM}$)' },
  },
  {
    key: 'URWM',
    kind: 'rating',
    sym: 'U_{RWM}',
    name: { zh: '反向工作峰值电压', en: 'Crest working reverse voltage' },
    means: { zh: '正常工作时反向电压波形的峰值，**不含**尖峰。', en: 'Peak of the normal reverse voltage waveform, **excluding** spikes.' },
    ex: NONE,
    ds: { zh: '未给出（1N4007：1000 V）', en: 'Not given (1N4007: 1000 V)' },
  },
  {
    key: 'URRM',
    kind: 'rating',
    sym: 'U_{RRM}',
    name: { zh: '反向重复峰值电压', en: 'Repetitive peak reverse voltage' },
    means: { zh: '**包括**每个周期都会出现的尖峰在内，能反复承受的最高反向电压。器件的电压等级就按它标（"1200 V 二极管"）。', en: 'Highest reverse voltage, **including** spikes that recur every cycle, that may be applied repeatedly. The voltage class of the part ("1200 V diode") is this.' },
    ex: { zh: '1200 V', en: '1200 V' },
    ds: { zh: '1200 V', en: '1200 V' },
  },
  {
    key: 'URSM',
    kind: 'rating',
    sym: 'U_{RSM}',
    name: { zh: '反向不重复峰值电压', en: 'Non-repetitive peak reverse voltage' },
    means: { zh: '只允许**偶尔一次**的尖峰（如合闸、雷击浪涌），比 $U_{RRM}$ 高。', en: 'A spike allowed only **occasionally** (switching or lightning surges); above $U_{RRM}$.' },
    ex: NONE,
    ds: { zh: '未给出（STBR3012：1500 V；1N4007：1200 V）', en: 'Not given (STBR3012: 1500 V; 1N4007: 1200 V)' },
  },
  {
    key: 'UBR',
    kind: 'char',
    sym: 'U_{(BR)}',
    name: { zh: '击穿电压', en: 'Breakdown voltage' },
    means: { zh: '反向电流开始陡增的电压，是器件本身的**特性值**（手册一般给最小值）。雪崩击穿电压随温度升高而升高，低温时最低；上面各额定值都要低于它，留出裕量。', en: 'Voltage where the reverse current shoots up: a **characteristic** of the device (datasheets give a minimum). Avalanche breakdown rises with temperature, so it is lowest when cold; all the ratings above sit below it with a margin.' },
    ex: { zh: '约 {bv} V（25 °C）', en: '≈ {bv} V (25 °C)' },
    ds: { zh: '未给出', en: 'Not given' },
  },
  {
    key: 'IR',
    kind: 'char',
    sym: 'I_R',
    name: { zh: '反向漏电流', en: 'Reverse leakage current' },
    means: { zh: '加 $U_{RRM}$ 时的反向电流，随温度猛涨（第 4 步）。', en: 'Reverse current at $U_{RRM}$; rises steeply with temperature (step 4).' },
    ex: { zh: '1200 V、25 °C：{i} µA', en: '1200 V, 25 °C: {i} µA' },
    ds: { zh: '25 °C 最大 20 µA；125 °C 典型 15 µA / 最大 150 µA', en: '25 °C max 20 µA; 125 °C typ 15 µA / max 150 µA' },
  },
]

export const UI_STATIC = {
  kind: {
    rating: { zh: '额定值', en: 'Rating' },
    char: { zh: '特性值', en: 'Characteristic' },
    cond: { zh: '测试条件', en: 'Test condition' },
  },
  kindHint: {
    zh: '额定值是"限速牌"：任何时候都不能超过；特性值是"体检报告"：在规定条件下测得，换了条件就会变。点一行，在图上看它的位置。',
    en: 'Ratings are speed limits: never exceed them. Characteristics are a health check: measured under stated conditions. Click a row to see it on the plots.',
  },
  head: [
    { zh: '参数', en: 'Parameter' },
    { zh: '类别', en: 'Type' },
    { zh: '含义', en: 'Meaning' },
    { zh: '示例 PiN', en: 'Example PiN' },
    { zh: 'STTH3012 手册', en: 'STTH3012 datasheet' },
  ],
  ref: {
    title: { zh: '本节用到的器件', en: 'Devices in this section' },
    model: {
      zh: '**曲线**来自**示例 PiN**：一个理想化的 1200 V / 30 A 模型（结构见 1.1），不是某个真实型号。',
      en: '**Curves** come from the **example PiN**, an idealised 1200 V / 30 A model (structure in 1.1), not a real part.',
    },
    real: { zh: '**手册数值**取自真实器件 ST **STTH3012**（1200 V / 30 A 超快恢复二极管）：', en: '**Datasheet values** come from the real ST **STTH3012** (1200 V / 30 A ultrafast diode):' },
    extra: { zh: '它没有给出的个别参数，用同厂同级的整流二极管 **STBR3012** 和常见的 **1N4007** 举例：', en: 'Where it gives no value, the same-class ST rectifier **STBR3012** and the common **1N4007** are quoted:' },
  },
  axis: {
    uf: { zh: '正向电压 U / V', en: 'Forward voltage U / V' },
    if: { zh: 'I / A', en: 'I / A' },
    ur: { zh: 'U / V', en: 'U / V' },
    ir: { zh: 'I / µA（对数）', en: 'I / µA (log)' },
  },
  plot: {
    rated: { zh: '额定 30 A', en: 'Rated 30 A' },
    urrm: { zh: 'U_RRM −1200 V', en: 'U_RRM −1200 V' },
    bv: { zh: '击穿 ≈ −{v} V', en: 'Breakdown ≈ −{v} V' },
    margin: { zh: '裕量', en: 'Margin' },
    blockZone: { zh: '阻断区（正常工作）', en: 'Blocking (normal use)' },
    bdZone: { zh: '击穿区', en: 'Breakdown' },
    cross: { zh: '交点 ≈ {i} A', en: 'Crossover ≈ {i} A' },
    ref: { zh: '虚线：25 °C', en: 'Dashed: 25 °C' },
    uto: { zh: 'U_TO', en: 'U_TO' },
  },
  all: {
    title: { zh: '示例 PiN 的 V-A 曲线（25 °C）', en: 'V-A curve of the example PiN (25 °C)' },
    fwdQuad: { zh: '正向：V、A', en: 'Forward: V, A' },
    revQuad: { zh: '反向：V、µA', en: 'Reverse: V, µA' },
    regions: {
      dead: { zh: '死区', en: 'Dead zone' },
      fwd: { zh: '正向导通区', en: 'Forward conduction' },
      block: { zh: '反向阻断区', en: 'Reverse blocking' },
      bd: { zh: '反向击穿区', en: 'Reverse breakdown' },
    },
    pick: { zh: '点一个区看说明。', en: 'Pick a region.' },
    info: {
      dead: {
        zh: '**死区**：正向电压还小，势垒只被压低了一点，电流很小。在 0–90 A 的刻度上，0.8 V 时才约 0.3 A，看上去几乎为零。死区和导通区之间**没有明确的分界**：拐点（第 0 章的开启电压，也叫死区电压）是人为约定的，取决于多大的电流算"看得见"（0.4）。',
        en: '**Dead zone**: the forward voltage is still small and the barrier only slightly lowered, so the current is tiny: about 0.3 A at 0.8 V, invisible on a 0–90 A scale. There is **no sharp boundary**: the knee (the turn-on voltage of chapter 0) is a convention that depends on what current counts as visible (0.4).',
      },
      fwd: {
        zh: '**正向导通区**：电流明显上升，N⁻ 区被电导调制，曲线变得很陡，30 A 时约 {u} V。手册里的门槛电压 $U_{TO}$（约 1.44 V）是第 2 步那条直线的截距，**不是**这里的分界：在 $U_{TO}$ 以下已有几安的电流。对应的参数见第 2 步。',
        en: '**Forward conduction**: the current rises clearly, N⁻ is modulated and the curve turns steep, about {u} V at 30 A. The datasheet threshold $U_{TO}$ (≈ 1.44 V) is the intercept of the step-2 line, **not** this boundary: several amps already flow below it. Parameters in step 2.',
      },
      block: {
        zh: '**反向阻断区**：阴极接正。只有很小的漏电流（1200 V 时约 {i} µA，反向电流放大成 µA 才看得见），电压可以加到上千伏。对应的参数见第 3 步。',
        en: '**Reverse blocking**: cathode positive. Only a tiny leakage current (about {i} µA at 1200 V, drawn in µA to be visible) while blocking over a kilovolt. Parameters in step 3.',
      },
      bd: {
        zh: '**反向击穿区**：反压到约 {v} V，N⁻ 区的峰值场强达到临界值，雪崩击穿，电流陡增。功率二极管**不能**长期工作在这里：上千伏 × 1 A 就是上千瓦，很快烧毁。所以手册规定一个比击穿电压低的额定电压 $U_{RRM}$（第 3 步）。',
        en: '**Reverse breakdown**: near {v} V the peak field reaches the critical value, avalanche sets in and the current shoots up. A power diode **cannot** stay here: a kilovolt × 1 A is a kilowatt. Hence the lower rating $U_{RRM}$ (step 3).',
      },
    },
    cmpTitle: { zh: '和第 0 章的示例 PN 结比一比', en: 'Compared with the chapter-0 junction' },
    cmpHead: [
      { zh: '', en: '' },
      { zh: '第 0 章示例 PN 结', en: 'Chapter-0 junction' },
      { zh: '示例 PiN', en: 'Example PiN' },
    ],
    cmpRows: [
      [{ zh: '击穿电压', en: 'Breakdown' }, { zh: '约 28 V（经验式估算）', en: '≈ 28 V (empirical estimate)' }, { zh: '约 {v} V（额定 1200 V）', en: '≈ {v} V (rated 1200 V)' }],
      [{ zh: '工作电流', en: 'Working current' }, { zh: '毫安到百毫安', en: 'mA to 100s of mA' }, { zh: '额定 30 A', en: 'Rated 30 A' }],
      [{ zh: '正向压降', en: 'Forward drop' }, { zh: '约 0.7 V（3.5 mA）', en: '≈ 0.7 V (3.5 mA)' }, { zh: '约 {u} V（30 A）', en: '≈ {u} V (30 A)' }],
    ] as BiText[][],
    cmpNote: { zh: '曲线形状相同，尺度差了几个数量级：功率二极管靠又淡又厚的 N⁻ 区耐压，靠电导调制过大电流（1.1）。', en: 'Same shape, orders of magnitude apart: the thick light N⁻ layer blocks, conductivity modulation carries the current (1.1).' },
  },
  fwd: {
    title: { zh: '正向特性（25 °C）', en: 'Forward characteristic (25 °C)' },
    current: { zh: '正向电流', en: 'Forward current' },
    roUf: { zh: '实际压降 U_F', en: 'Actual U_F' },
    roLine: { zh: '用直线估算', en: 'Line estimate' },
    roErr: { zh: '误差', en: 'Error' },
    lineKey: { zh: '直线 u = U_TO + r_T·i（在 15–60 A 贴合曲线）', en: 'Line u = U_TO + r_T·i (fitted over 15–60 A)' },
    lineWhy: {
      zh: '这条直线只在额定电流附近贴得准（拖动电流看误差），所以手册给的 $U_{TO}$、$r_T$ 只用来**估算导通损耗**。注意：第 0 章的开启电压有时也叫"门槛电压"，那是看上去的拐点；这里的门槛电压 $U_{TO}$ 是直线的截距，两者不是一回事。',
      en: 'The line fits only near rated current (drag the current to see the error), so the datasheet $U_{TO}$ and $r_T$ are only for **estimating conduction loss**. Note: the chapter-0 turn-on voltage is sometimes also called a threshold, but that is a visual knee; $U_{TO}$ here is the line intercept.',
    },
    rowsTitle: { zh: '正向参数', en: 'Forward parameters' },
    curTitle: { zh: '几个正向电流的区别与联系', en: 'How the forward currents relate' },
    curRel: {
      zh: '$I_F$ 只是测 $U_F$ 的条件；长期工作看 $I_{F(AV)}$（平均值）和 $I_{F(RMS)}$（有效值），两条都要满足，都是发热限制；$I_{FSM}$ 只管偶尔的一次冲击，比它们大得多。',
      en: '$I_F$ is just the $U_F$ test condition; continuous use is limited by $I_{F(AV)}$ (average) and $I_{F(RMS)}$ (rms), both heating limits that must both hold; $I_{FSM}$ covers a rare single surge, far larger.',
    },
    wave: {
      normal: { zh: '正常工作：每个周期都有（示意：50 Hz 正弦半波，平均 30 A）', en: 'Normal use, every cycle (sketch: 50 Hz half sine, 30 A average)' },
      surge: { zh: '偶尔一次', en: 'Once in a while' },
      peak: { zh: '峰值 94 A', en: 'Peak 94 A' },
      rms: { zh: '有效值 47 A（≤ I_F(RMS) 50 A）', en: 'RMS 47 A (≤ I_F(RMS) 50 A)' },
      avg: { zh: '平均值 30 A = I_F(AV)', en: 'Average 30 A = I_F(AV)' },
      fsm: { zh: 'I_FSM 210 A（10 ms）', en: 'I_FSM 210 A (10 ms)' },
      t: { zh: 't', en: 't' },
    },
  },
  rev: {
    title: { zh: '反向特性（25 °C）', en: 'Reverse characteristic (25 °C)' },
    urev: { zh: '反向电压', en: 'Reverse voltage' },
    roIr: { zh: '漏电流', en: 'Leakage' },
    roW: { zh: '耗尽层', en: 'Depletion' },
    roM: { zh: '倍增因子 M', en: 'Multiplication M' },
    bar: { zh: 'N⁻ 区（120 µm）里耗尽层的宽度', en: 'Depletion width within N⁻ (120 µm)' },
    state: {
      ok: { zh: '正常阻断：漏电流来自耗尽层里的热产生，随耗尽层展宽缓慢增大', en: 'Normal blocking: leakage from thermal generation grows slowly as the depletion widens' },
      knee: { zh: '雪崩倍增开始起作用，漏电流被放大 {m} 倍', en: 'Avalanche multiplication kicks in: leakage × {m}' },
      over: { zh: '已超过 U_RRM：只能偶尔出现，不能重复施加', en: 'Above U_RRM: allowed only occasionally, never repeatedly' },
      bd: { zh: '接近击穿：电流陡增，不能长期工作在这里', en: 'Near breakdown: current soars; cannot stay here' },
    },
    rowsTitle: { zh: '反向参数', en: 'Reverse parameters' },
    volTitle: { zh: '几个反向电压的区别与联系', en: 'How the reverse voltages relate' },
    volRel: {
      zh: '$U_R \\le U_{RWM} \\le U_{RRM} < U_{RSM} < U_{(BR)}$：前四个是额定值，越往右越"偶尔"（直流 → 正常峰值 → 每周期的尖峰 → 偶尔一次的尖峰）；击穿电压是器件本身的特性值，额定值都要低于它并留出裕量。',
      en: '$U_R \\le U_{RWM} \\le U_{RRM} < U_{RSM} < U_{(BR)}$: the first four are ratings, rarer to the right (DC → normal crest → spikes every cycle → a rare spike); breakdown is a property of the device, and all ratings sit below it with a margin.',
    },
    wave: {
      dc: { zh: '直流', en: 'DC' },
      ac: { zh: '交流（整流电路里二极管上的电压）', en: 'AC (diode voltage in a rectifier)' },
      spike: { zh: '每周期的尖峰', en: 'Spike every cycle' },
      once: { zh: '偶尔一次', en: 'Once' },
      u: { zh: 'u', en: 'u' },
      t: { zh: 't', en: 't' },
    },
  },
  temp: {
    tj: { zh: '结温', en: 'Junction temperature' },
    s1: { zh: '① 反向：漏电流猛涨', en: '① Reverse: leakage soars' },
    s1Text: {
      zh: '1200 V 时，25 °C 约 {a} µA，{t} °C 约 {b} µA，涨了约 **{k} 倍**。热产生的电子–空穴对与本征浓度 $n_i$ 同比增加，$n_i$ 随温度按指数增大。',
      en: 'At 1200 V: about {a} µA at 25 °C and {b} µA at {t} °C, about **{k}×** more. Thermal generation scales with $n_i$, which grows exponentially with temperature.',
    },
    s2: { zh: '② 正向：小电流时压降变小，大电流时压降变大', en: '② Forward: lower drop at small current, higher at large current' },
    s2Text: {
      zh: '两条曲线几乎重合，所以右边单独画出压降之差。温度升高，结压降下降、载流子寿命变长（压降变小），同时迁移率下降、电阻变大（压降变大）。小电流时前者为主，大电流时后者为主，过零的地方就是**交点**，示例约 {i} A。',
      en: 'The two curves nearly coincide, so the difference is plotted on the right. Heating lowers the junction drop and lengthens the lifetime (lower drop) but cuts mobility (higher resistance). The first wins at small current, the second at large current; the zero crossing is the **crossover**, about {i} A here.',
    },
    s3: { zh: '③ 交点有什么用：两只并联', en: '③ Why the crossover matters: two in parallel' },
    s3Text: {
      zh: '两只同型号的二极管并联，散热不一样，一只 25 °C、一只 {t} °C，两端电压相同。拖动总电流看它们怎样分。',
      en: 'Two identical diodes in parallel, one at 25 °C and one at {t} °C (different cooling), share the same voltage. Drag the total current.',
    },
    total: { zh: '总电流', en: 'Total current' },
    cold: { zh: '25 °C', en: '25 °C' },
    hot: { zh: '{t} °C', en: '{t} °C' },
    hog: { zh: '低于交点：热的那只分得更多 → 更热 → 分得更多，可能热失控', en: 'Below the crossover: the hot one takes more → hotter → takes more, possible runaway' },
    share: { zh: '高于交点：热的那只分得更少，并联的几只自动均流', en: 'Above the crossover: the hot one takes less, so the currents even out' },
    same: { zh: '温度相同，平均分配', en: 'Same temperature, equal split' },
    each: { zh: '交点约 {x} A，现在每只平均 {i} A', en: 'crossover ≈ {x} A; now {i} A each on average' },
    fwdTitle: { zh: '正向（实线：{t} °C）', en: 'Forward (solid: {t} °C)' },
    revTitle: { zh: '反向（实线：{t} °C）', en: 'Reverse (solid: {t} °C)' },
    dTitle: { zh: '压降之差 ΔU_F = U_F({t} °C) − U_F(25 °C)', en: 'ΔU_F = U_F({t} °C) − U_F(25 °C)' },
    dAxis: { zh: 'ΔU_F / mV', en: 'ΔU_F / mV' },
    neg: { zh: '热的压降低', en: 'Hot drops less' },
    pos: { zh: '热的压降高', en: 'Hot drops more' },
    tableTitle: { zh: '小结：参数随温度的变化', en: 'Summary: how the parameters move' },
    head: [
      { zh: '参数', en: 'Parameter' },
      { zh: '25 °C', en: '25 °C' },
      { zh: '{t} °C', en: '{t} °C' },
      { zh: '变化', en: 'Change' },
    ],
    rows: {
      uf5: { zh: 'U_F（5 A）', en: 'U_F (5 A)' },
      uf30: { zh: 'U_F（30 A）', en: 'U_F (30 A)' },
      uf60: { zh: 'U_F（60 A）', en: 'U_F (60 A)' },
      ir: { zh: 'I_R（1200 V）', en: 'I_R (1200 V)' },
      bv: { zh: '击穿电压', en: 'Breakdown voltage' },
    },
    bvUp: { zh: '随温度升高（雪崩，0.6），所以低温时耐压最低（模型没有算这一项，上面的图里击穿电压不随温度变）', en: 'Rises with temperature (avalanche, 0.6), so it is lowest when cold (not modelled: the plot above keeps it fixed)' },
    times: { zh: '× {k}', en: '× {k}' },
    dsTitle: { zh: '手册对照（STTH3012，最大值）', en: 'Datasheet check (STTH3012, max)' },
    ds: {
      zh: '$U_F$（30 A）：25 °C 2.25 V → 125 °C 2.05 V，额定电流下仍是"热的压降低"，说明它的交点在 30 A 以上（交点位置因工艺而异）。$I_R$（1200 V）：25 °C 20 µA → 125 °C 150 µA，只差 7.5 倍，因为常温下手册的漏电流由表面、终端漏电和测试分辨率决定，到高温体内的热产生才占主导。',
      en: '$U_F$ (30 A): 2.25 V at 25 °C → 2.05 V at 125 °C, still "hot drops less" at rated current, so its crossover lies above 30 A (it depends on the process). $I_R$ (1200 V): 20 µA → 150 µA, only 7.5×, because at room temperature datasheet leakage is set by surface and edge leakage and test resolution; bulk generation dominates only when hot.',
    },
  },
}
