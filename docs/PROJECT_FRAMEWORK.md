# TEDMaster (TED 精读大师) - 项目开发全景规划书

## 1. 项目愿景 (Project Vision)
**定位：** 全球顶尖的 AI 驱动型 TED 演讲精读学习平台。
**核心理念：** 模糊“娱乐”与“学习”的界限，利用 AI 技术将 TED 演讲转化为可交互、可评估、可习得的深度学习素材。

*   **视觉风格：** **学术极简 (Academic Minimalist) + 玻璃拟态 (Glassmorphism)**。主色调采用 TED 标志性的红（TED Red）配合深邃的背景灰与柔和的毛玻璃面板。
*   **交互逻辑：** “沉浸感”优先。所有的学习工具（语法拆解、单词查询、影子练习）均以非侵入式的悬浮组件形式存在。

---

## 2. 核心功能规格 (Functional Specifications)

### 2.1 智能互动播放引擎 (AI Interaction Engine)
*   **双语全屏交互：**
    *   **动态对齐：** 左右或上下排列的中英双语字幕，配合当前句高亮。
    *   **即点即查：** 点击字幕中的单词，AI 即刻基于**当前语境**给出最切实的定义、例句及同反义词。
    *   **一键重听：** 支持快捷键或点击句子快速循环播放当前段落，直到听清为止。
*   **AI 语法导师：**
    *   **长难句分析：** 一键开启“透视模式”，AI 动态标注句子的主谓宾、从句结构，并解释复杂的修辞或俚语。
    *   **上下文联想：** AI 自动提取该演讲中出现的同类用法或表达。

### 2.2 深度精读工作区 (Intensive Reading Workspace)
*   **影子练习 (Shadowing)：**
    *   利用 Whisper/Moonshine 对用户的录音进行音波比对。
    *   **AI 评分：** 针对发音、重音、停顿给出可视化反馈建议。
*   **逐句拼写 (Dictation)：**
    *   遮盖原文字幕，用户通过听音补全句子，实时检查准确性。
*   **智能摘要系统：** 读后自动生成关键观点（Takeaways）的可交互式导图。

### 2.3 学习资产管理 (Learning Asset Management)
*   **上下文生词本：** 收藏的单词不仅记录定义，还会自动捕捉演讲原声切片，实现“听觉记忆”。
*   **热力学习图谱：** 记录用户的精读时长、词汇习得曲线及口语进步趋势。

---

## 3. 技术架构 (Technical Architecture)

### 3.1 前端：极致体验
*   **框架：** Next.js 14+ (App Router) 用于首屏加载优化。
*   **UI 库：** Vanilla CSS (采用 CSS Variables) 确保动画的极致丝滑与设计的统一。
*   **播放器：** 基于 Video.js 或 Plyr 进行深度定制，集成 Canvas 字幕层。

### 3.2 后端：高性能 AI 调度
*   **核心：** Node.js / Python (FastAPI) 处理爬虫与数据流水线。
*   **数据流：**
    1.  **Crawler Service:** 自动抓取 TED 官网 metadata / Subtitles / MP4。
    2.  **Transcription Engine:** 针对无中文字幕的视频，利用 Gemini 1.5 Pro 生成中英对照。
    3.  **NLP Pipeline:** 对文稿进行句法树切分与关键词提取。

### 3.3 数据库
*   **PostgreSQL:** 存储用户进度、生词本及演讲元数据。
*   **Redis:** 缓存 AI 生成的常规模板（如常见词汇的语境解说）。

---

## 4. UI 变量定义 (Design Tokens)

| 变量名称 | 属性 | 值 | 用途 |
| :--- | :--- | :--- | :--- |
| `--color-ted-red` | Hex | `#E62B1E` | 品牌色，交互反馈 |
| `--color-bg-deep` | HSL | `#121212` | 主体深色背景 |
| `--color-text-primary`| Hex | `#FFFFFF` | 正文主色 |
| `--glass-panel` | Filter | `backdrop-filter: blur(20px) saturate(200%)` | 悬浮学习层 |
| `--font-heading` | Family | `"Inter", sans-serif` | 标题字体 |

---

## 5. 阶段性开发路线图 (Implementation Roadmap)

### Phase 1: 基础设施与解析 (Week 1-2)
*   [ ] 实现 TED 演讲爬虫引擎（支持全语言字幕抓取）。
*   [ ] 搭建基于 Next.js 的高颜值 Landing Page 与列表页。

### Phase 2: 沉浸式播放器核心 (Week 3-4)
*   [ ] 完成具备中英对齐、即点即查功能的播放引擎。
*   [ ] 集成 Gemini API 实现长难句自动化分析模式。

### Phase 3: 口语与复习闭环 (Week 5-6)
*   [ ] 集成录音功能与音波波形组件。
*   [ ] 开发生词本同步与导出功能。

---

## 6. 下一步行动 (Action Items)
1. [ ] 初始化独立 Git 仓库 `TEDMaster`。
2. [ ] 调研 TED 字幕 JSON 数据结构稳定性。
3. [ ] 编写首个 TED 视频的 AI 精读示范 Demo。
