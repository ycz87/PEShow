// 1.4 动态特性与动态参数的界面文字：电路状态、阶段提示、图上的标注与参数表
import type { ParamRow } from './uiStatic'

export const UI_DYN = {
  play: { zh: '播放', en: 'Play' },
  pause: { zh: '暂停', en: 'Pause' },
  replay: { zh: '从头播放', en: 'Replay' },
  time: { zh: '时间', en: 'Time' },
  slow: { zh: '慢放约 2000 万倍', en: 'Slowed about 20 million times' },
  circuit: { zh: '测试电路（与 0.8 相同，换成 600 V、30 A）', en: 'Test circuit (as in 0.8, now 600 V, 30 A)' },
  waveD: { zh: '手册的测法：电流按 500 A/µs 下降（回路杂散电感 50 nH）', en: 'Datasheet method: current falls at 500 A/µs (50 nH stray inductance)' },
  ringKey: { zh: 'LC 振荡', en: 'LC ringing' },
  wave: { zh: '电流、电压波形', en: 'Current and voltage' },
  waveA: { zh: 'A：示例 PiN（模型算出）', en: 'A: example PiN (computed)' },
  waveB: { zh: 'B：软恢复二极管（示意）', en: 'B: soft-recovery diode (illustrative)' },
  plasma: { zh: 'N⁻ 区里的载流子（此刻）', en: 'Carriers in N⁻ (now)' },
  plasmaHint: { zh: '电子 = 空穴（等离子体），由模型算出；虚线是 N⁻ 原有的电子 N_D ≈ 1.3×10¹⁴，在这个比例下贴着横轴', en: 'Electrons = holes (plasma), from the model; dashed: original electrons N_D ≈ 1.3×10¹⁴, on the axis at this scale' },
  scr: { zh: '空间电荷区', en: 'Space-charge region' },
  axisX: { zh: '位置 / µm（左：阳极 P⁺，右：阴极 N⁺）', en: 'Position / µm (left: anode P⁺, right: cathode N⁺)' },
  axisP: { zh: '浓度 / 10¹⁶ cm⁻³', en: 'Density / 10¹⁶ cm⁻³' },
  ro: {
    t: { zh: '时间', en: 'Time' },
    i: { zh: '电流 i', en: 'Current i' },
    u: { zh: '二极管电压 u', en: 'Diode voltage u' },
  },
  on: {
    pre: { zh: '开关在 −U_R：二极管反偏截止，N⁻ 区里几乎没有载流子。', en: 'S at −U_R: the diode blocks; N⁻ holds almost no carriers.' },
    rise: {
      zh: '开关拨到 +U₁，电流经回路电感很快上升。空穴从 P⁺ 注入 N⁻，可调制的前锋才走了一小段，N⁻ 区大部分还是高阻，电压冲高。',
      en: 'S flips to +U₁ and the current rises quickly through the loop inductance. Holes enter N⁻ from P⁺, but the modulation front has only gone a short way; most of N⁻ is still resistive and the voltage shoots up.',
    },
    fall: {
      zh: '前锋向阴极推进，被"淹"的部分越来越多，电阻越来越小，电压从峰值回落。',
      en: 'The front advances towards the cathode; more of N⁻ is flooded, its resistance falls and the voltage drops from the peak.',
    },
    done: {
      zh: '整个 N⁻ 区都被淹了，电压回落到稳态压降附近；等离子体还在慢慢涨到稳态。',
      en: 'All of N⁻ is flooded and the voltage is near its steady value; the plasma keeps growing slowly to steady state.',
    },
  },
  off: {
    pre: { zh: '开关在 +U₁：稳态导通 30 A，N⁻ 区被等离子体淹满，存储电荷约 6 µC。', en: 'S at +U₁: 30 A steady; N⁻ is flooded, about 6 µC stored.' },
    fall: { zh: '开关拨到 −U_R，回路电感让电流用约 10 ns 降到零（t₀）。', en: 'S flips to −U_R; the loop inductance makes the current take about 10 ns to reach zero (t₀).' },
    store: {
      zh: '电流反向，约 −30 A，由电阻决定：等离子体从两端被抽出（空穴回 P⁺、电子回 N⁺），同时复合。阳极一侧还有载流子，结仍正偏，电压只有约 1 V。',
      en: 'The current reverses to about −30 A, set by the resistor: the plasma is pulled out at both ends (holes to P⁺, electrons to N⁺) and recombines. The anode side still has carriers, so the junction stays forward biased at about 1 V.',
    },
    block: {
      zh: '阳极一侧抽空，P⁺N⁻ 结开始阻断：空间电荷区向阴极推进，电压从电阻移到二极管上，反向电流随之减小。二极管扛下全部 600 V 时，电阻上没有电压了，电流回零。',
      en: 'The anode side is empty and the P⁺N⁻ junction blocks: the space-charge region moves towards the cathode, the voltage moves from the resistor onto the diode and the reverse current falls. Once the diode holds the full 600 V, nothing is left across the resistor and the current reaches zero.',
    },
    ring: {
      zh: '回路电感里的电流不能突变，把电压推过 −600 V；之后电感与二极管的结电容（约 40 pF）来回交换能量，电压、电流一起振荡（LC 振荡），被电阻 R 阻尼，约 100 ns 消失。',
      en: 'The current in the loop inductance cannot stop at once and pushes the voltage past −600 V; then the inductance and the diode capacitance (about 40 pF) swap energy back and forth (LC ringing), damped by R, gone in about 100 ns.',
    },
    done: { zh: '恢复阻断：二极管承受 −600 V；N⁻ 区中间剩下的一点等离子体（约占存储电荷的 3%）自己复合掉。', en: 'Blocking: the diode holds −600 V; the little plasma left mid-N⁻ (about 3 % of the stored charge) recombines.' },
  },
  didt: {
    pre: { zh: '稳态导通 30 A，N⁻ 区被等离子体淹满，存储电荷约 6 µC。', en: '30 A steady; N⁻ is flooded, about 6 µC stored.' },
    ramp: {
      zh: '电流按规定的 500 A/µs 下降，过零（t₀）后继续变负。阳极一侧还有载流子，结仍正偏，电压只有约 1 V。',
      en: 'The current falls at the set 500 A/µs and keeps going negative after zero (t₀). The anode side still has carriers, so the junction is forward biased at about 1 V.',
    },
    block: {
      zh: '阳极一侧抽空，结开始阻断，空间电荷区向阴极推进，电压升高；电流仍按 di/dt 变负，到二极管电压接近 −U_R 时达到峰值 I_RM。',
      en: 'The anode side is empty and the junction blocks; the space-charge region advances and the voltage rises; the current keeps falling at di/dt and peaks at I_RM when the diode voltage nears −U_R.',
    },
    tail: {
      zh: '阴极一侧的载流子早就被抽空了，空间电荷区很快扫过中间剩下的一小块，反向电流约 10 ns 就回零（t_b 很短），L_σ·di/dt 把电压推到约 −900 V：这是硬恢复。',
      en: 'The cathode side was emptied long ago; the space-charge region sweeps the small remaining island quickly and the reverse current returns to zero in about 10 ns (short t_b); L_σ·di/dt drives the voltage to about −900 V: snappy recovery.',
    },
    done: { zh: '恢复阻断，电压回到 −600 V。', en: 'Blocking again at −600 V.' },
  },
  marks: {
    t0: 't₀',
    block: { zh: '结开始阻断', en: 'Junction blocks' },
    tfr: 't_fr',
  },
  lim: { zh: '虚线：0.25 I_R；t_rr 从 t₀ 量到反向电流降到这里', en: 'Dashed: 0.25 I_R; t_rr runs from t₀ to here' },
  qrr: { zh: '阴影：Q_rr', en: 'Shaded: Q_rr' },
  ufLine: { zh: '虚线：1.5 U_F，电压回落到这里为 t_fr', en: 'Dashed: 1.5 U_F; t_fr is when the voltage falls to it' },
  metrics: {
    title: { zh: '这一次的结果', en: 'Results of this run' },
    UFRM: { zh: '正向恢复电压峰值 U_FRM', en: 'Peak forward recovery voltage U_FRM' },
    tPeak: { zh: '出现在', en: 'Reached at' },
    tfr: { zh: '正向恢复时间 t_fr', en: 'Forward recovery time t_fr' },
    QF: { zh: '存储电荷 Q_F', en: 'Stored charge Q_F' },
    ts: { zh: '存储时间 t_s', en: 'Storage time t_s' },
    tf: { zh: '下降时间 t_f', en: 'Fall time t_f' },
    trr: { zh: '反向恢复时间 t_rr', en: 'Reverse recovery time t_rr' },
    Qrr: { zh: '反向恢复电荷 Q_rr', en: 'Recovered charge Q_rr' },
    URM: { zh: '反向电压峰值 U_RM', en: 'Peak reverse voltage U_RM' },
  },
  soft: {
    resTitle: { zh: '① 我们的测试电路（电阻法，600 V、20 Ω）：A 实线、B 虚线', en: '① Our test circuit (resistive, 600 V, 20 Ω): A solid, B dashed' },
    resNote: {
      zh: '电阻电路里反向电流由电阻决定，没有 $t_a$、$t_b$，只能看**拖尾的形状**：A 的电流较快回零，回路电感把电压推到约 −{ua} V 并振荡；B 慢慢拖尾，电压平稳到 −600 V（最大 {ub} V）。$t_{rr}$：A {ta} ns，B {tb} ns。',
      en: 'In the resistive circuit the resistor sets the reverse current, so there is no $t_a$ or $t_b$; only the **tail shape** differs: A returns to zero faster and the loop inductance drives the voltage to about −{ua} V with ringing; B tails off and settles at −600 V (peak {ub} V). $t_{rr}$: A {ta} ns, B {tb} ns.',
    },
    didtTitle: { zh: '② 手册的测法（500 A/µs、杂散电感 50 nH）：A 实线、B 虚线，各自标出 t_a、t_b', en: '② Datasheet method (500 A/µs, 50 nH): A solid, B dashed, with t_a and t_b' },
    cmpTitle: { zh: '③ 与 STTH3012 手册对照（手册的测法，30 A、600 V、500 A/µs）', en: '③ Against the STTH3012 datasheet (30 A, 600 V, 500 A/µs)' },
    cmpHead: [
      { zh: '', en: '' },
      { zh: 'A：示例 PiN（模型，25 °C）', en: 'A: example PiN (model, 25 °C)' },
      { zh: 'B：软恢复（示意）', en: 'B: soft (illustrative)' },
      { zh: 'STTH3012，125 °C（图 5–8 读数）', en: 'STTH3012, 125 °C (Figs 5–8)' },
      { zh: 'STTH3012 换算到 25 °C（按图 9）', en: 'STTH3012 at 25 °C (via Fig. 9)' },
    ],
    cmpNote: {
      zh: '$t_{rr}$、$Q_{rr}$ 和手册换算到 25 °C 的值同一量级；示例 A 的 $I_{RM}$ 大一倍、软度只有 0.1，因为它是没有做寿命控制和软恢复设计的"毛坯"；STTH3012 是专门做过的超快软恢复二极管，软度与示意的 B 相当（怎样做到见 1.5）。手册的 $t_{rr}$ 外推到 $0.1I_{RM}$ 为止，这里同样量法。',
      en: '$t_{rr}$ and $Q_{rr}$ are of the same order as the datasheet values scaled to 25 °C; example A has twice the $I_{RM}$ and softness only 0.1 because it is a bare PiN without lifetime control or soft-recovery design. STTH3012 is a purpose-built ultrafast soft diode, about as soft as illustrative B (how: 1.5). Datasheet $t_{rr}$ is extrapolated to $0.1I_{RM}$, as here.',
    },
    hard: { zh: '硬恢复', en: 'Snappy' },
    softW: { zh: '软恢复', en: 'Soft' },
    overKey: { zh: '红色：A 超出 −U_R 的电压尖峰', en: 'Red: A’s spike beyond −U_R' },
    why: {
      zh: '**t_a 差不多，差别全在 t_b**：$t_a$ 是电流按 $\\mathrm{d}i_F/\\mathrm{d}t$ 被"拉"到峰值的时间，两只一样；$t_b$ 是峰值之后电流回零的时间，由二极管自己决定。A 的阴极一侧载流子本来就少，关断时又被 N⁺ 抽走、自己复合，空间电荷区到达之前那里就空了，扫过中间剩下的一小块后电流没了来源，约 10 ns 就回零，$S$ 只有约 0.1，回路杂散电感上的 $L_\\sigma\\,\\mathrm{d}i/\\mathrm{d}t$ 把电压推到约 −900 V，还会振荡。B 的设计让阴极一侧多留一些载流子（怎么做到见 1.5），电流靠它慢慢拖尾，$S$ 约 1.3，电压几乎不过冲。代价：拖尾也要时间，$t_{rr}$、$Q_{rr}$ 大一些。尖峰会击穿器件、产生电磁干扰，所以功率电路要用软恢复二极管；STTH3012 在 500 A/µs、125 °C 时 $S$ 约 1.2。',
      en: '**Same t_a, all the difference is in t_b**: $t_a$ is set by the circuit pulling the current at $\\mathrm{d}i_F/\\mathrm{d}t$, the same for both; $t_b$, from the peak back to zero, is up to the diode. A has few carriers near the cathode, which are extracted by N⁺ and recombine before the space-charge region arrives; after it sweeps the small remaining island the current has no source and snaps to zero in about 10 ns, $S$ ≈ 0.1, and $L_\\sigma\\,\\mathrm{d}i/\\mathrm{d}t$ drives the voltage to about −900 V with ringing. B keeps more carriers near the cathode (how: 1.5), so the current tails off, $S$ ≈ 1.3, with almost no overshoot. The price: the tail takes time, so $t_{rr}$ and $Q_{rr}$ are larger. Spikes can break devices and cause EMI, so power circuits use soft diodes; STTH3012 has $S$ ≈ 1.2 at 500 A/µs, 125 °C.',
    },
    note: {
      zh: 'B 是示意：在 ① 里结开始阻断之前、在 ② 里反向电流峰值之前与 A 相同，之后的电流是编排的拖尾曲线（② 中软度取 1.3），电压由回路方程算出（① $u = -U_R - Ri - L\\,di/dt$，② $u = -U_R - L_\\sigma\\,di/dt$）。本模型算软恢复算不准（各种参数组合软度都只有 0.1–0.35，手册约 1–3），所以 B 不用模型。STTH3012 的数值是 125 °C 曲线的读数，25 °C 一栏按图 9 的相对值换算，都是约值。',
      en: 'B is illustrative: equal to A until blocking starts in ① and until the reverse-current peak in ②; afterwards a scripted tail (softness 1.3 in ②), with the voltage from the loop equation (① $u = -U_R - Ri - L\\,di/dt$, ② $u = -U_R - L_\\sigma\\,di/dt$). This model cannot compute soft recovery reliably (softness 0.1–0.35 against 1–3 in datasheets), so B is not from the model. STTH3012 values are readings of the 125 °C curves; the 25 °C column is scaled via Fig. 9; all approximate.',
    },
  },
  params: {
    fitKey: { zh: '虚线：过 I_RM 与 0.1 I_RM 两点外推，交零线处为 t₂（STTH3012 的量法）', en: 'Dashed: line through I_RM and 0.1 I_RM; it meets zero at t₂ (STTH3012’s method)' },
    soft: { zh: '软度 S = t_b/t_a', en: 'Softness S = t_b/t_a' },
    tableTitle: { zh: '动态参数（示例 PiN：模型，25 °C；STTH3012：手册，注意条件）', en: 'Dynamic ratings (example PiN: model, 25 °C; STTH3012: datasheet, note the conditions)' },
    why: {
      zh: '**实际电路里的开关**：斩波电路、逆变桥里，和二极管配对工作的开关是电力电子器件（如 IGBT、MOSFET，后面几章会学）。它们不像理想开关那样"一合就通"，从关断到完全导通要几十到几百纳秒；这段时间里，电流是一点一点从二极管转到开关管上的，转移的快慢就是 $\\mathrm{d}i_F/\\mathrm{d}t$，由开关器件和它的驱动电路决定（常见几百到几千 A/µs）。二极管在实际电路里就是这样关断的。\n\n**所以手册这样测**：用一只真实的开关管，按规定的 $\\mathrm{d}i_F/\\mathrm{d}t$ 把电流从二极管接走，测出的就是二极管在实际电路里的表现。这时反向电流不再由电阻决定，而是一直增大到峰值 $I_{RM}$ 才回头，于是分成 $t_a$、$t_b$ 两段，还多了软度 $S = t_b/t_a$。另外，600 V、30 A 若用电阻法测，电阻要烧掉近 20 kW，也不现实。',
      en: '**The switch in real circuits**: in choppers and inverter legs the diode works with a power semiconductor switch (IGBT, MOSFET; later chapters). Unlike an ideal switch it does not close at once: going from off to fully on takes tens to hundreds of nanoseconds, during which the current moves gradually from the diode to the switch. The rate is $\\mathrm{d}i_F/\\mathrm{d}t$, set by the switch and its gate driver (typically hundreds to thousands of A/µs). That is how a diode turns off in a real circuit.\n\n**So datasheets test it that way**: a real switch takes the current from the diode at a set $\\mathrm{d}i_F/\\mathrm{d}t$, which shows how the diode behaves in a real circuit. The reverse current is no longer set by a resistor: it grows to a peak $I_{RM}$ before turning back, which splits the time into $t_a$ and $t_b$ and adds softness $S = t_b/t_a$. Besides, a resistive test at 600 V, 30 A would burn nearly 20 kW.',
    },
    switchNote: {
      zh: '**对电路的影响**：开关管接过电流的那一刻，还要额外承受二极管的反向恢复电流，峰值约 $I_F + I_{RM}$，而此时它两端的电压还很高，所以开通损耗明显增大；二极管自己也有恢复损耗。$Q_{rr}$、$I_{RM}$ 越小越好，软度越大越好。',
      en: '**Effect on the circuit**: when the switch takes over, it also carries the diode’s reverse recovery current, peaking near $I_F + I_{RM}$, while its voltage is still high, so its turn-on loss rises; the diode has a recovery loss too. Smaller $Q_{rr}$ and $I_{RM}$ and larger softness are better.',
    },
    condTitle: { zh: '测试条件不同，数值可以差几十倍（STTH3012）', en: 'Different conditions, values tens of times apart (STTH3012)' },
    condHead: [
      { zh: '测试条件', en: 'Conditions' },
      { zh: '结果', en: 'Result' },
    ],
    conds: [
      { c: { zh: '1 A、30 V、200 A/µs、25 °C（表 4）', en: '1 A, 30 V, 200 A/µs, 25 °C (Table 4)' }, r: { zh: '$t_{rr}$ 典型 48 ns', en: '$t_{rr}$ typ 48 ns' } },
      { c: { zh: '60 A、600 V、200 A/µs、125 °C（表 4）', en: '60 A, 600 V, 200 A/µs, 125 °C (Table 4)' }, r: { zh: '$I_{RM}$ 典型 25 A，$Q_{rr}$ 典型 5.7 µC', en: '$I_{RM}$ typ 25 A, $Q_{rr}$ typ 5.7 µC' } },
      { c: { zh: '30 A、600 V、500 A/µs、125 °C（图 5–8 读数）', en: '30 A, 600 V, 500 A/µs, 125 °C (read from Figs 5–8)' }, r: { zh: '$I_{RM}$ ≈ 46 A，$t_{rr}$ ≈ 235 ns，$Q_{rr}$ ≈ 7.5 µC，$S$ ≈ 1.2', en: '$I_{RM}$ ≈ 46 A, $t_{rr}$ ≈ 235 ns, $Q_{rr}$ ≈ 7.5 µC, $S$ ≈ 1.2' } },
    ],
    condNote: {
      zh: '1 A、30 V 的小信号测试只能用来比"谁更快"，**不能**用来估算实际电路里的损耗；估算要用接近实际工况的那组数据（大电流、高电压、高结温）。温度从 25 °C 升到 125 °C，$Q_{rr}$ 约变为 3.6 倍（图 9）：高温下寿命变长，存的载流子更多。',
      en: 'The 1 A, 30 V small-signal test only ranks speed; it **cannot** estimate losses in a real circuit. Use data close to the real operating point (high current, voltage, junction temperature). From 25 °C to 125 °C, $Q_{rr}$ grows about 3.6× (Fig. 9): longer lifetime at high temperature stores more carriers.',
    },
  },
} as const

/** 动态参数表（符号按 IEC 60747-2 与数据手册的通行写法，电压写作 U）。示例 PiN：开通用电阻法电路，关断用手册测法
 *  （30 A、600 V、500 A/µs、L_σ 50 nH、25 °C）；STTH3012 一栏注明条件 */
export const DYN_ROWS: ParamRow[] = [
  {
    key: 'UFRM',
    kind: 'char',
    sym: 'U_{FRM}',
    name: { zh: '正向恢复电压峰值', en: 'Peak forward recovery voltage' },
    means: { zh: '开通时正向电压的峰值（手册写作 $V_{FP}$ 或 $V_{FRM}$）。$\\mathrm{d}i_F/\\mathrm{d}t$ 越大、N⁻ 区越厚越淡、温度越高，越大。', en: 'Peak forward voltage at turn-on ($V_{FP}$ or $V_{FRM}$ in datasheets); higher for faster $\\mathrm{d}i_F/\\mathrm{d}t$, thicker and lighter N⁻ and higher temperature.' },
    ex: { zh: '约 {UFRM} V（25 °C）', en: 'about {UFRM} V (25 °C)' },
    ds: { zh: '约 24 V（30 A、500 A/µs、125 °C，图 10 读数）', en: 'about 24 V (30 A, 500 A/µs, 125 °C, read from Fig. 10)' },
  },
  {
    key: 'tfr',
    kind: 'char',
    sym: 't_{fr}',
    name: { zh: '正向恢复时间', en: 'Forward recovery time' },
    means: { zh: '开通后电压回落到规定值的时间（STTH3012 规定为 1.5 倍 $U_F$）。', en: 'Time for the voltage to fall back to a stated level after turn-on (1.5 × $U_F$ for STTH3012).' },
    ex: { zh: '约 {tfr} ns', en: 'about {tfr} ns' },
    ds: { zh: '约 455 ns（30 A、500 A/µs、125 °C，图 11 读数）', en: 'about 455 ns (30 A, 500 A/µs, 125 °C, read from Fig. 11)' },
  },
  {
    key: 'trr',
    kind: 'char',
    sym: 't_{rr} = t_a + t_b',
    name: { zh: '反向恢复时间', en: 'Reverse recovery time' },
    means: { zh: '电流过零到反向电流恢复结束。$t_a$：过零到峰值 $I_{RM}$；$t_b$：峰值到结束（过 $I_{RM}$ 与 $0.1I_{RM}$ 两点的直线外推到零，STTH3012 的量法）。', en: 'From the zero crossing to the end of recovery. $t_a$: zero to peak $I_{RM}$; $t_b$: peak to end (line through $I_{RM}$ and $0.1I_{RM}$ extrapolated to zero, as in STTH3012).' },
    ex: { zh: '约 {trr} ns（$t_a$ {ta} + $t_b$ {tb}）', en: 'about {trr} ns ($t_a$ {ta} + $t_b$ {tb})' },
    ds: { zh: '典型 48 ns（1 A、30 V、200 A/µs、25 °C）；约 235 ns（30 A、600 V、500 A/µs、125 °C，图 6）', en: 'typ 48 ns (1 A, 30 V, 200 A/µs, 25 °C); about 235 ns (30 A, 600 V, 500 A/µs, 125 °C, Fig. 6)' },
  },
  {
    key: 'IRM',
    kind: 'char',
    sym: 'I_{RM}',
    name: { zh: '反向恢复电流峰值', en: 'Peak reverse recovery current' },
    means: { zh: '反向电流的最大值（也写作 $I_{RRM}$）。$\\mathrm{d}i_F/\\mathrm{d}t$ 越大越大，会叠加到开关管上。', en: 'Maximum reverse current (also $I_{RRM}$); grows with $\\mathrm{d}i_F/\\mathrm{d}t$ and adds to the switch current.' },
    ex: { zh: '约 {IRM} A', en: 'about {IRM} A' },
    ds: { zh: '典型 25 A / 最大 35 A（60 A、600 V、200 A/µs、125 °C）；约 46 A（30 A、500 A/µs，图 5）', en: 'typ 25 A / max 35 A (60 A, 600 V, 200 A/µs, 125 °C); about 46 A (30 A, 500 A/µs, Fig. 5)' },
  },
  {
    key: 'Qrr',
    kind: 'char',
    sym: 'Q_{rr}',
    name: { zh: '反向恢复电荷', en: 'Reverse recovery charge' },
    means: { zh: '$t_{rr}$ 期间反向电流的面积，只是存储电荷的一部分（其余自己复合掉）。$I_F$、温度越高越大。', en: 'Area of the reverse current over $t_{rr}$, only part of the stored charge (the rest recombines); larger at higher $I_F$ and temperature.' },
    ex: { zh: '约 {Qrr} µC（存储 {QF} µC）', en: 'about {Qrr} µC (stored {QF} µC)' },
    ds: { zh: '典型 5.7 µC（60 A、600 V、200 A/µs、125 °C）；约 7.5 µC（30 A、500 A/µs，图 7）', en: 'typ 5.7 µC (60 A, 600 V, 200 A/µs, 125 °C); about 7.5 µC (30 A, 500 A/µs, Fig. 7)' },
  },
  {
    key: 'S',
    kind: 'char',
    sym: 'S = t_b / t_a',
    name: { zh: '软度', en: 'Softness factor' },
    means: { zh: '越大越"软"，电流回落越平缓，电压尖峰和振荡越小。$\\mathrm{d}i_F/\\mathrm{d}t$ 越大往往越硬。', en: 'Larger is softer: the current returns more gently, with less spike and ringing; usually harder at faster $\\mathrm{d}i_F/\\mathrm{d}t$.' },
    ex: { zh: '约 {S}（很硬）', en: 'about {S} (very snappy)' },
    ds: { zh: '约 1.2（500 A/µs）、约 2.7（20 A/µs）；600 V、125 °C，图 8', en: 'about 1.2 (500 A/µs), about 2.7 (20 A/µs); 600 V, 125 °C, Fig. 8' },
  },
  {
    key: 'cond',
    kind: 'cond',
    sym: 'I_F,\\ U_R,\\ \\mathrm{d}i_F/\\mathrm{d}t,\\ T_j',
    name: { zh: '测试条件', en: 'Test conditions' },
    means: { zh: '上面每个数都只在它的测试条件下成立，四个条件缺一不可。比较两只器件，要看条件是否相同。', en: 'Each value above holds only under its conditions, all four of them. Compare parts only under the same conditions.' },
    ex: { zh: '关断：30 A、600 V、500 A/µs、25 °C；开通：电阻法', en: 'Turn-off: 30 A, 600 V, 500 A/µs, 25 °C; turn-on: resistive' },
    ds: { zh: '见每一行的括号', en: 'See the brackets in each row' },
  },
]
