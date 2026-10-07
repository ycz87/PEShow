# PEShow · 功率器件可视化实验室

**Power Device Visual Lab** — 用可交互的动画讲清楚功率半导体器件的工作原理。

由 B 站 UP 主「西瓜粥」制作，面向电力电子技术课堂与自学。

---

## 这是什么

一个在浏览器里运行的交互式教学网页。每一章按"承上 → 舞台演示 → 通俗讲解 → 深入一步（公式）→ 示意说明"的顺序展开：

- **粒子舞台**：电子、空穴、离子是一个个会动的粒子。它们做随机热运动、在电场里漂移、扩散、复合与产生，外电路两端的计数器显示电流是一场"接力"。粒子仿真是独立的物理模拟（欠阻尼朗之万动力学 + 成对复合 / 产生），稳态结果用单元测试与解析模型核对。
- **与舞台对齐的图表**：电场、电势、浓度、能带、V-A 曲线、开关波形等，与器件逐点对齐、随滑块实时变化。
- **讲究严谨**：画面里凡是做了夸张或压缩的地方（比例、浓度、时间），都在"示意说明"里写明真实数值与模型的适用范围。
- **三种画风**：夜光晶圆、贴纸绘本、黑板方格，各有亮色与暗色。
- **中 / 英 / 中英对照** 三种界面语言。

## 章节进度

| 章 | 内容 | 状态 |
|---|---|---|
| 0 半导体基础 | 本征半导体、掺杂、PN 结的形成、正向导通、反向截止与漏电流、反向击穿、结电容、开通与反向恢复 | ✅ 完成 |
| 1 功率二极管 | 1.1 从 PN 结到 PiN（普通 PN 结的两难、P⁺N⁻N⁺ 结构、耐压、电导调制、小结） | ✅ 1.1 完成 |
| | 1.2 功率二极管简介（符号、剖面图、3D 封装）· 1.3 静态特性 · 1.4 动态特性 · 1.5 快恢复 · 1.6 肖特基 · 1.7 SiC 肖特基 · 1.8 数据手册与选型 | 🚧 制作中 |
| 2–8 | 功率 BJT、晶闸管家族、功率 MOSFET、IGBT、IGCT、SiC 器件、GaN 器件 | 📋 计划中 |

## 本地运行

需要 [Node.js](https://nodejs.org/) 20 或更新版本。

```bash
npm install
npm run dev        # 开发服务器，默认 http://localhost:5173
```

其他命令：

```bash
npm run build      # 类型检查 + 生产构建，输出到 dist/
npm run preview    # 预览生产构建
npm test           # 运行单元测试（物理模型与粒子仿真的核对）
npm run typecheck  # 只做类型检查
```

地址栏里的 `#ch0`、`#ch1` 切换章节。

## 技术栈

- [Vue 3](https://vuejs.org/) + TypeScript + [Vite](https://vitejs.dev/)
- [PixiJS 8](https://pixijs.com/)：粒子舞台（WebGL）
- Canvas 2D / SVG：图表与示意图
- [KaTeX](https://katex.org/)：公式
- [GSAP](https://gsap.com/)：过渡动画
- [Vitest](https://vitest.dev/)：单元测试

## 目录结构

```
src/
  app/            设置、步骤导航、滑块等通用逻辑
  components/     舞台、图表、讲解面板等 Vue 组件
  design/         三种画风的配色与字体
  devices/        各章内容（讲解文字、步骤设定、界面文字）
    pn-junction/    第 0 章
    power-diode/    第 1 章
  engine/
    physics/      物理模型与粒子仿真（PN 结、PiN、击穿、反向恢复……）
    render/       渲染器（PixiJS 粒子舞台、Canvas 画面）
tests/            物理模型与仿真的单元测试
docs/             各章分镜与讲解稿、实施计划
```

## 文档

`docs/` 里是各章的分镜与讲解稿，包括每一步的画面设计、讲解文字、数值核算与严谨性自查记录。

---

## English

**PEShow — Power Device Visual Lab** is an interactive web course on how power semiconductor devices work, made by Bilibili creator 西瓜粥 (Xiguazhou) for power-electronics teaching and self-study.

- **Particle stage**: electrons, holes and ions are individual particles. They wander thermally, drift in fields, diffuse, recombine and are generated, and counters in the external circuit show current as a relay. The particle model is an independent simulation (underdamped Langevin dynamics with pairwise recombination and generation); its steady states are checked against analytical models in unit tests.
- **Charts aligned with the device**: field, potential, carrier density, band diagram, V-A curve and switching waveforms, updated live.
- **Rigour**: every exaggeration on screen (scale, density, time) is listed, with the real values and the model's limits.
- Three visual styles (Wafer Glow, Sticker Book, Chalk & Grid), light and dark themes, and Chinese / English / bilingual UI.

**Status**: Chapter 0 (semiconductor basics) and Section 1.1 (from PN junction to PiN) are complete; the rest of Chapter 1 and later chapters (BJT, thyristors, MOSFET, IGBT, IGCT, SiC, GaN) are in progress.

**Run locally** (Node.js 20+): `npm install`, then `npm run dev`. `npm test` runs the physics tests.
