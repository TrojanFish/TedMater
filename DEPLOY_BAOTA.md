# TEDMaster — 宝塔面板 (Baota) 部署指南

本指南旨在帮助您在已安装**宝塔面板**的 Linux 服务器上快速部署 TEDMaster。

---

## 方式一：Docker 部署 (强烈推荐 ⭐)

宝塔面板自带 **Docker 运行环境**，使用 Docker 部署最简单、最稳定，不会污染宿主机环境。

### 1. 安装 Docker 管理器
- 在宝塔面板：**软件商店** -> 搜索 `Docker` -> 安装 **Docker 管理器**。

### 2. 克隆仓库与配置
- 在宝塔面板左侧：**终端**（或通过 SSH 工具登录服务器）。
- 进入 `/www/wwwroot` 目录。
- `git clone https://github.com/TrojanFish/TedMater.git`
- `cd TedMater`
- `cp .env.example .env`
- **编辑配置**：在宝塔面板 **文件** 管理器中双击并编辑 `.env` 文件，填写以下 **3 个关键字段**：
  - `GEMINI_API_KEY`：您的 Google AI 秘钥。
  - `JWT_SECRET`：生成的长随机字符串（用户 Token 加密）。
  - `POSTGRES_PASSWORD`：设置一个复杂的数据库密码（系统会自动基于此密码建立连接）。

### 3. 一键部署
- 在项目根目录运行：
  ```bash
  docker compose up -d
  ```
- 宝塔 Docker 管理器中会自动出现 `tedmaster-app` 和 `tedmaster-postgres` 容器。

### 4. 设置域名与 HTTPS
- 宝塔面板左侧：**网站** -> **PHP项目** (或通用项目) -> **添加站点**。
  - **域名**：填写您的域名 (如 `ted.yourdomain.com`)。
  - **站点根目录**：`/www/wwwroot/TedMater` (选填)。
  - **数据库**：不创建。
- 进入站点设置：
  - **反向代理**：添加反代。
    - 代理名称：`ted_proxy`
    - 目标URL：`http://127.0.0.1:3005`
  - **SSL**：开启证书申请 (Let's Encrypt)。

---

## 方式二：手动部署 (Node.js 项目管理器)

如果您不想使用 Docker，可以按照以下步骤手动部署。

### 1. 环境准备 (软件商店安装)
- **Node.js 版本管理器**：安装并选择 Node.js `v18.x` 或 `v20.x`。
- **Postgres 管理器** (如果使用 PostgreSQL)：安装并创建一个数据库 (例如 `tedmaster`)。

### 2. 获取源码
- `cd /www/wwwroot`
- `git clone https://github.com/TrojanFish/TedMater.git`
- `cd TedMater`

### 3. 配置数据库
- 在 **Postgres 管理器** 中创建数据库后，获取连接字符串。
- 编辑 `.env` 文件：
  ```dotenv
  DATABASE_URL="postgresql://用户名:密码@127.0.0.1:5432/tedmaster"
  GEMINI_API_KEY=您的Gemini秘钥
  JWT_SECRET=生成的随机字符串
  ```

### 4. 安装依赖与构建
```bash
# 安装依赖
npm install

# 生成 Prisma 客户端并同步数据库结构
npx prisma generate
npx prisma migrate deploy

# 构建 Next.js 项目
npm run build
```

### 5. 在宝塔中添加项目
- 宝塔面板：**网站** -> **Node项目** -> **添加Node项目**。
  - **项目目录**：`/www/wwwroot/TedMater`
  - **项目名称**：`TEDMaster`
  - **启动选项**：`npm`
  - **启动脚本**：`start`
  - **端口**：`3005`
  - **运行用户**：`www`
- 开启 **项目守护 (PM2)**。

### 6. 反向代理
- 同样在站点设置中，添加反向代理到 `http://127.0.0.1:3005`。

---

## 核心配置参数说明 (.env)

项目目录下必须存在 `.env` 文件。如果不存在，请先执行 `cp .env.example .env`。

### 1. `GEMINI_API_KEY` (AI 秘钥)
- **作用**：用于视频解析、翻译及学习建议生成。
- **获取地址**：[Google AI Studio](https://aistudio.google.com/app/apikey)

### 2. `JWT_SECRET` (身份验证密钥)
- **作用**：用于加密用户登录 Token。
- **获取方法**：执行以下命令生成随机 64 位字符并粘帖：
  ```bash
  openssl rand -hex 32
  ```
- **填写示例**：`JWT_SECRET=8b74... (填入你生成的长字符串)`

### 3. `DATABASE_URL` (数据库连接地址)
> **注意**：如果您使用的是 **方式一 (Docker)**，通常只需在 `.env` 中设置 `POSTGRES_PASSWORD` 即可。如果是 **方式二 (手动部署)**，则必须填写此项：
- **组合格式**：`postgresql://用户名:密码@127.0.0.1:5432/数据库名`
- **操作步骤**：
  1. 在宝塔面板 **PostgreSQL管理器** 插件中添加数据库。
  2. 获取刚才设置的 **用户名**、**密码** 及 **数据库名**。
  3. **注意特殊字符**：如果密码包含 `@`, `:`, `/` 等符号，必须进行 URL 编码（例如 `@` 编码为 `%40`）。建议使用纯数字+字母的密码。

---

## 常见问题 (FAQ)

### 1. 访问 502 / 504 错误
- 请检查 Node 项目是否已启动。
- 请检查 Nginx 配置中的 `proxy_read_timeout` 是否足够长（建议设为 60s），因为 AI 处理可能需要较长时间。

### 2. 数据库连接失败
- 请确保宝塔的 PostgreSQL 服务已开启。
- 请确保防火墙放行了 5432 端口（如为本地连接，则无需公网放行，但需内部可通）。

### 3. Whisper 模型下载缓慢
- 应用初次进行语音转录时，浏览器会下载约 150MB 的 Whisper 模型。这是正常现象。
- 建议确保服务器带宽充足，或将特定 CDN 地址加入白名单。

---

## 更新维护

### 1. Docker 全量更新 (方式一)
当您在本地开发完成后通过 `git push` 推送到 GitHub，可以在服务器上执行：
```bash
cd /www/wwwroot/TedMater

# 1. 拉取最新代码
git pull origin main

# 2. 重新构建镜像 (如 Dockerfile 或代码有改动)
docker compose build
docker compose build --no-cache tedmaster (不使用缓存)

# 3. 运行数据库迁移 (应用表结构改动)
docker compose run --rm migrate

# 4. 后台启动/热重启容器
docker compose up -d tedmaster
```

---

### 2. 手动部署更新 (方式二)
```bash
cd /www/wwwroot/TedMater
git pull
npm install
npx prisma migrate deploy
npm run build
# 在宝塔 Node 项目管理器中点击“重启”
```
