# 🎓 TEDMaster — AI-Powered TED Study System

**TEDMaster** 是一款基于 Next.js 开发的、由 AI 驱动的 TED 演讲深度学习平台。它通过集成 Google Gemini AI 和 Whisper 转录技术，为用户提供沉浸式的双语学习体验、智能词汇解析以及深度内容分析。

---

## ✨ 核心特性

- 🤖 **AI 深度解析**：利用 Google Gemini 1.5 Flash 对演讲内容进行主题分析、难点提炼及词汇深度解析。
- 🌍 **双语字幕同步**：精准的双语字幕展示，支持实时查询单词。
- 🎙️ **智能语音转录**：集成 Whisper/Moonshine 技术，支持通过 YouTube 视频直接提取并转录。
- 🔍 **智能搜索**：内置高效的视频搜索接口，快速定位感兴趣的演讲资源。
- 💳 **积分系统**：完善的用户激励与额度管理系统，涵盖词卷查询、AI 解析及会员管理。
- 📄 **多格式导出**：支持将解析内容及字幕导出为 PDF、Markdown 等格式，方便线下学习。
- 📱 **响应式设计**：完美适配桌面端与移动端，随时随地开启学习模式。

---

## 🛠️ 技术底座

- **前端框架**: Next.js 15+ (App Router), TypeScript, Tailwind CSS
- **后端逻辑**: Next.js Server Actions & API Routes
- **数据库**: PostgreSQL (Prisma ORM)
- **AI 引擎**: Google Gemini 1.5 Flash
- **容器化**: Docker & Docker Compose
- **认证系统**: JWT (JSON Web Tokens)

---

## 🚀 快速启动 (本地开发)

### 1. 环境准备
- Node.js 18+ 或 20+
- PostgreSQL 数据库
- [Google AI Studio](https://aistudio.google.com/) 获取 Gemini API Key

### 2. 配置环境
复制并编辑 `.env.local`：
```bash
cp .env.example .env.local
```
填写 `GEMINI_API_KEY`、`JWT_SECRET` 和 `DATABASE_URL`。

### 3. 安装与运行
```bash
# 安装依赖
npm install

# 初始化数据库
npx prisma generate
npx prisma migrate dev

# 启动开发服务器
npm run dev
```
访问：`http://localhost:3000`

---

## 🏗️ 生产环境部署

我们提供了详细的生产环境部署方案：

- [VPS 原始部署指南 (Docker)](./DEPLOY.md)
- [宝塔面板 (Baota) 快速部署指南](./DEPLOY_BAOTA.md)

**默认端口**：生产环境镜像映射端口为 **3005**。

---

## 📂 项目结构

- `src/app`: 核心页面路由与 API
- `src/components`: UI 组件
- `src/lib`: 工具类 (AI 接口、i18n、限流等)
- `prisma`: 数据库建模与迁移文件
- `public`: 静态资源与本地模型权重存放处

---

## 📜 许可证

本项目基于 MIT 许可证开放。

---

> [!NOTE]
> 初次在浏览器进行语音转录时，会触发 Whisper 模型的下载（约 150MB），建议在网络良好的环境下使用。
