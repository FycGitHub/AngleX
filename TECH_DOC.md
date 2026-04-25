# 角度大冒险（AngleX）技术文档

## 一、项目概述

**项目名称**：角度大冒险（AngleX）
**项目类型**：基于 Web 的交互式数学教学小游戏
**教学目标**：帮助学生建立"任意角"的概念——突破传统 [0°, 360°) 的思维定式，理解正角、负角、超过 360° 的多圈角度以及终边相同角的概念
**主题包装**：太空科幻风，玩家扮演飞船驾驶员，通过旋转飞船完成不同的角度任务

### 用户体验流程

1. **引导动画（Intro Scene）**：星空背景 + 旁白，播放完成后玩家点击"启动飞船"进入游戏
2. **主游戏界面**：三栏布局（任务面板 | Canvas 操作区 | 数据面板）
3. **任务循环**：阅读任务 → 拖动/按钮旋转飞船 → 实时观察角度数据 → 提交答案 → 获得反馈 → 解锁下一关
4. **关卡递进**：从最基础的 0°，到正角 / 负角 / 大于 360° / 小于 -360° 的多圈旋转

---

## 二、技术栈

| 类别 | 技术 |
| --- | --- |
| 结构 | HTML5（语义化 DOM） |
| 样式 | CSS3（Flex/Grid + `clamp()` 流式布局 + 关键帧动画） |
| 逻辑 | 原生 JavaScript（ES6+，无框架） |
| 渲染 | HTML5 Canvas 2D Context |
| 音效 | Web Audio API（程序化合成，非音频文件） |
| 语音旁白 | Web Speech API（`SpeechSynthesisUtterance`） |
| 构建工具 | 无（直接在浏览器打开 `index.html` 即可运行） |
| 外部依赖 | 无 CDN，仅浏览器原生 API |

> 项目零依赖、零构建步骤，完整体积仅三个文件，便于教学场景部署。

---

## 三、文件结构

```
AngleX/
├── index.html      # 110 行，页面骨架与 UI 容器
├── style.css       # 690 行，完整样式与响应式布局
└── game.js         # 1271 行，全部业务逻辑
```

### 3.1 `index.html`

| 区域 | 行号 | 作用 |
| --- | --- | --- |
| Intro Scene | 11–23 | 引导动画容器（星空、旁白、启动按钮） |
| Header | 27–30 | 标题栏（带旋转火箭 emoji） |
| Task Panel | 35–47 | 左栏：任务列表 + 当前任务详情 |
| Operation Area | 50–59 | 中栏：Canvas + ↺ ↻ 微调按钮 |
| Data Panel | 62–88 | 右栏：实时角度、终边角、圈数、历史记录 |
| Control Panel | 92–104 | 底栏：进度条 + 提交 / 重置按钮 |

### 3.2 `style.css`

主要结构：

- **基础与重置**（1–64）
- **标题动画**（34–63）：渐变文字 + emoji 旋转
- **三栏布局**（66–211）：桌面端 3 栏，<900px 自动堆叠为 1 栏
- **任务卡片状态**（75–201）：active / completed / locked 三态样式
- **Canvas 容器**（213–242）：径向渐变背景 + drag 光标态
- **数据面板**（271–323）：大字号角度展示
- **进度条与按钮**（326–414）
- **关键帧动画**：`rotate`、`twinkle`、`fadeInLine`、`fadeInUp`、`fadeInButton`、`glow`、`fadeOut`
- **响应式断点**（416–688）：1400 / 1200 / 1000 / 900 / 768 / 600 px

### 3.3 `game.js` 模块划分

| 模块 | 行号 | 说明 |
| --- | --- | --- |
| 全局状态 `gameState` | 1–10 | 当前角度、关卡、拖拽状态、历史等 |
| 任务定义 `tasks[]` | 13–66 | 5 个任务的目标、校验、反馈文本 |
| DOM 引用缓存 | 69–87 | 启动时一次性查找元素 |
| 语音配置 | 100–204 | 选择中文语音、播放首关旁白 |
| 初始化 `init()` | 207–282 | 任务列表生成、事件绑定、语音预加载 |
| 任务 UI 生成 | 285–337 | 渲染任务列表、解锁逻辑、关卡切换 |
| 输入事件 | 340–458 | 鼠标 / 触摸拖拽 + 按钮微调 |
| 角度计算 | 461–480 | 圈数累计、终边角归一化 |
| Canvas 绘制 | 483–579 | 飞船、刻度、参考线、角度指示 |
| 显示与历史 | 582–693 | 实时数据更新、历史记录 |
| 反馈与校验 | 624–805 | 任务旁白、提交校验、关卡推进 |
| 重置 | 808–827 | 全状态归零 |
| 音频管理 `audioManager` | 829–1064 | Web Audio API 合成背景乐与音效 |
| Intro Scene 控制 | 1067–1261 | 开场动画播放与切换 |
| DOMContentLoaded 启动 | 1265–1271 | 入口 |

---

## 四、核心数据结构

### 4.1 全局状态

```js
gameState = {
  currentAngle: 0,            // 原始累计角度，可超过 ±360°
  currentLoop: 0,             // 完成的整圈数
  currentTask: 1,             // 当前关卡 ID
  isDragging: false,          // 拖拽状态
  lastAngle: 0,               // 上一次记录角度，用于判断越圈
  lastDragAngle: 0,           // 拖拽过程中的最近一次角度
  history: [],                // 操作历史（保留最近 5 条）
  normalizedAngleShown: false,// 是否已揭示"终边相同角"概念
  completedTasks: [],         // 已完成关卡 ID 列表
  firstTaskSpoken: false      // 首关旁白播放标记
}
```

### 4.2 任务对象

```js
{
  id: 1,
  name: '任务1：零的起点',
  description: '将飞船旋转到 0°',
  target: '旋转到 0°',
  validate: (angle) => Math.abs(normalize(angle)) <= 10,
  feedback: '完美归位！…'
}
```

校验逻辑要点：

- 任务 1–3：以归一化到 [-180°, 180°] 后与目标角的差 ≤ 10° 为通过
- 任务 4：终边角 = 90° **且** `currentAngle ≥ 360°`（强制完成至少一整圈）
- 任务 5：终边角 = -30° **且** `currentAngle ≤ -360°`（强制反向至少一整圈）

---

## 五、关卡设计

| 关卡 | 名称 | 目标 | 教学概念 |
| --- | --- | --- | --- |
| 1 | 零的起点 | 旋转到 0° | 建立角度参照系 |
| 2 | 正向探索 | 逆时针 90° | 正角的方向约定 |
| 3 | 负向规避 | 顺时针 -120° | 负角的方向约定 |
| 4 | 连续追踪 | 旋转到 450°（终边 90°，需 ≥1 圈） | 任意角：超过 360° |
| 5 | 反向盘旋 | 旋转到 -750°（终边 -30°，需 ≤ -1 圈） | 任意角：负方向多圈 |
| 6 | （预留扩展位） | — | — |

> 教学曲线：参考点 → 方向 → 多圈 → 终边相同角，循序揭示"任意角"内涵。

---

## 六、渲染机制

### 6.1 事件驱动而非帧循环

项目**未使用 `requestAnimationFrame`**，Canvas 仅在以下时机重绘：

- 拖拽过程中的 `drag()` 回调
- 按钮点击触发的 `rotateBy()`
- 关卡切换、重置、初始化

> 优点：节省 CPU；适合本项目的纯静态旋转场景。

### 6.2 `drawSpaceship()` 绘制流程（483–579）

1. `clearRect` 清空画布
2. 绘制 360° 参考圆（半径 150px，浅紫色）
3. 每 30° 绘制一根刻度线（共 12 根）
4. 绘制 0° 参考线（绿色水平向右）
5. `ctx.translate` 到画布中心，`ctx.rotate(-currentAngle)`
   - **关键**：Canvas Y 轴向下，需对角度取负，使逆时针为正方向，与数学约定一致
6. 绘制飞船：主三角机身 + 黄色舷窗 + 两侧尾翼
7. `ctx.restore` 后绘制红色终边指示线

### 6.3 拖拽角度算法（385–434）

```js
const dx = x - centerX;
const dy = y - centerY;
const rawAngle = -Math.atan2(dy, dx) * 180 / Math.PI;
```

通过对比 `lastDragAngle` 与 `rawAngle` 处理 ±180° 跨越的"越界跳变"，从而支持连续多圈累计。

---

## 七、音频与语音

### 7.1 `audioManager`（829–1064）

- 使用 Web Audio API **程序化合成**背景乐（无音频文件）
- 多振荡器叠加：sine 55Hz + triangle 110Hz + sawtooth 220Hz + LFO 调制
- 音效：点击（800Hz 下扫）、whoosh 切换音
- 兼容 Safari：`window.AudioContext || window.webkitAudioContext`
- 浏览器自动播放限制：首次用户交互后才能 `resume()`

### 7.2 语音旁白

- API：`SpeechSynthesisUtterance`，语言 `zh-CN`
- 优选音色：
  - Windows：Microsoft Yaoyao → Kangkang
  - macOS：Ting-Ting → Sinji
  - Chrome：普通话（中国大陆）
- 旁白时机：进入关卡、提交反馈、Intro Scene
- 浏览器若拦截自动播放，则在用户首次点击时补播

---

## 八、响应式设计

- **桌面端**（≥900px）：左中右三栏
- **移动端**（<900px）：单列堆叠，Canvas 自适应宽度
- 大量使用 CSS `clamp(min, vw, max)` 实现无级缩放
- Canvas 始终保持正方形比例（min(width, height)）
- 按钮触摸目标 ≥44px，满足移动端可点击区域要求
- Touch 事件使用 passive listener，避免阻塞滚动

---

## 九、已知限制 & 可改进点

| 类别 | 现状 | 建议 |
| --- | --- | --- |
| 持久化 | 无 localStorage，刷新即重置 | 持久化 `completedTasks`，便于课堂分次教学 |
| 关卡数 | `tasks[]` 仅 5 个，UI 提示有 6 关 | 补全任务 6（可设计"自由探索"模式） |
| 可访问性 | Canvas 无替代文本，无 ARIA | 增加 `aria-label`、键盘快捷键（左右方向键旋转） |
| i18n | 仅中文 | 抽离文案为字典，支持多语言切换 |
| 校验容差 | 固定 ±10°，对低龄用户偏严 | 按关卡分级容差，或显示偏差提示 |
| 单元测试 | 无 | 至少为 `normalizeAngle` / 关卡 `validate` 增加纯函数测试 |
| 模块化 | `game.js` 单文件 1271 行 | 拆分为 `state.js / render.js / audio.js / tasks.js` |
| 帧循环 | 事件驱动，拖拽时若浏览器卡顿可能掉帧 | 必要时改为 `requestAnimationFrame` 节流 |

---

## 十、本地运行

```bash
# 任选其一
open index.html                              # macOS 直接用浏览器打开
python3 -m http.server 8000                  # 启动静态服务（推荐，避免某些 API 受限）
npx serve .                                  # 同上
```

> 推荐通过 HTTP 服务器访问，部分浏览器对 `file://` 协议下的 Web Audio / Speech API 有限制。

---

## 十一、入口与执行顺序

```
DOMContentLoaded
  └── initIntroScene()                # 1067–1261
       ├── 播放星空动画 + 旁白
       └── 用户点击"启动飞船"
            └── 淡出 intro，显示 #gameContainer
                 └── init()           # 207–282
                      ├── createTaskList()
                      ├── setupEventListeners()
                      ├── drawSpaceship()
                      ├── updateDisplay()
                      └── playFirstTaskSpeech()
```

后续所有交互均由用户事件驱动（拖拽 / 点击按钮 / 提交 / 切换关卡）。
