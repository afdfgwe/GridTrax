<div align="center">

# 🎬 GridTrax

<img src="./public/icon.png" alt="GridTrax Banner" width="200" />

**GridTrax** 是一个现代、精美且纯粹的前端私有影视剧集进度追踪应用。<br/>
不仅能像传统的看剧记录工具一样管理您的观影状态，还能以“网格化”（Grid）视图直观展示每一集的观看进度。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-19-61dafb.svg?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF.svg?logo=vite&logoColor=white)](https://vitejs.dev/)

</div>

---

## 🌟 项目动机

**GridTrax** 的核心灵感来源于广受好评的动漫二次元社区 [**Bangumi (番组计划)**](https://bgm.tv/)。

本项目作为一个轻量级的个人练习与自用工具，旨在探索一种不同的 UI 呈现方式与数据存储模式：

1. 🔲 **网格系统**：对于包含多季内容或数十集的剧集/动漫，尝试用直观的方块网格来分别呈现每一集的独立状态，像打卡一样记录单集看番进度。
2. 🚀 **纯前端架构**：由于仅作为个人记录工具，项目完全移除了后端服务依赖。所有的观影数据均保存在本地浏览器中。
3. 💾 **本地备份**：支持 JSON 文件导入导出，通过手动备份在不同浏览器或设备间迁移观影记录。

---

## ✨ 核心特性

- **Base46 动态主题**：内置多种精调的高级色彩主题（如 Ocean, Dracula, TokyoNight 等），随心切换。
- **海量数据源支持**：集成 [TMDB API](https://www.themoviedb.org/)，提供极其丰富的全球影视/动漫元数据。
- **集数网格**：为每一季的每一个单集生成独立网格，长按/点击即可轻松打卡。
- **数据备份**：仅保留 JSON 导入导出，导入前校验文件并确认覆盖，不包含账号信息或 API Token。
- **响应式设计**：流畅支持桌面端和移动端浏览的操作体验。

---

## 🛠️ 技术栈

| 类别       | 技术 / 框架 |
| ---------- | :--- |
| **框架**   | [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) |
| **构建**   | [Vite](https://vitejs.dev/) |
| **UI 组件** | [Material UI (MUI)](https://mui.com/) v7 |
| **状态管理**| [Zustand](https://zustand-demo.pmnd.rs/) (带 `persist` 持久化) |
| **网络请求**| `Axios` (TMDB) |
| **色彩提取**| `colorthief` (智能提取海报主色调) |

---

## 🚀 部署与使用教程

这是一个纯前端 SPA 项目，构建产物为静态文件。可部署在任何静态托管服务（Vercel, Cloudflare Pages）、Docker 或 Node.js 环境中。

### 🔑 准备工作：获取 TMDB API Key

1. 注册并登录 [TMDB](https://www.themoviedb.org/)。
2. 进入 Account Settings → API，申请一个 API Key (v4 auth - API Read Access Token)。
3. 在项目根目录创建 `.env.local` 文件：
   ```env
   VITE_TMDB_BEARER=您的BearerToken
   ```

Token 填写 API Read Access Token，不要添加 `Bearer ` 前缀。网页中不再提供 Token 设置，也不再读取旧的浏览器 Token 配置。本地修改 `.env.local` 后需重启开发服务；Cloudflare Pages 则在构建环境变量中填写，不需要提交 `.env.local`。

> `VITE_` 变量会被嵌入浏览器可下载的前端代码，并非服务端秘密。请勿把 `.env.local` 或真实 Token 提交到公开仓库。

---

### 方式一：Cloudflare Pages 免费零代码部署

[![Deploy to Cloudflare Pages](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/aronnaxlin/GridTrax)

#### 1. 连接 GitHub 仓库
1. 登录 [Cloudflare 控制台](https://dash.cloudflare.com/)。
2. 在左侧菜单中前往 **Workers & Pages**。
3. 点击 **Create application** -> **Pages** -> **Connect to Git**。
4. 选中您的 `GridTrax` Fork 仓库并点击继续。

#### 2. 配置构建参数
在“Set up builds and deployments”页面填写如下参数：
- **Framework preset**: `Vite` (若列表中没有，请选择 `None`)
- **Build command**: `npm run build`
- **Build output directory**: `dist`

#### 3. 部署并设置环境变量
1. 展开下方的 **Environment variables (advanced)**。
2. 添加变量：变量名为 `VITE_TMDB_BEARER`，值为您的 TMDB v4 Token。
3. 点击 **Save and Deploy**。如果修改环境变量，需重新构建部署才能生效；需要预览部署时，也应为对应环境配置变量。

---

### 方式二：Docker 部署 (适合服务器/NAS 用户)

项目已针对 Docker 进行优化，支持一键部署到云服务器、群晖 NAS 等。镜像中**不包含**任何私密 Token，所有配置均在运行时动态注入。

#### 1. 使用 Docker Compose (最简单)

下载或创建 `docker-compose.yml` 并运行：

```yaml
services:
  gridtrax:
    image: aronnaxlin/gridtrax:latest
    container_name: gridtrax
    ports:
      - "721:721"
    environment:
      # 方式 A：直接指定环境变量 (推荐)
      - VITE_TMDB_BEARER=您的_TMDB_V4_TOKEN
    volumes:
      # 方式 B：通过挂载读取本地 .env.local 文件
      - ./.env.local:/app/.env.local:ro
    restart: always
```

直接启动：
```bash
docker compose up -d
```

运行容器前必须通过环境变量或挂载配置提供 Token，网页中不再提供填写入口。

#### 2. 手动构建镜像或推送到 Docker Hub

```bash
# 构建镜像
docker build -t <your-username>/gridtrax:latest .

# 手动运行
docker run -d --name gridtrax -p 721:721 -e VITE_TMDB_BEARER=您的_TMDB_V4_TOKEN --restart unless-stopped <your-username>/gridtrax:latest
```

> [!NOTE]
> **关于安全性**：项目构建时，Token 会被置为安全占位符。容器启动时 `entrypoint.sh` 脚本则会自动将占位符替换为运行时环境变量中的真实值，因此您可以把镜像放心地推入 Docker Hub 等公共镜像仓库使用。

---

### 方式三：一键脚本部署 (Linux 环境)

```bash
chmod +x deploy.sh

./deploy.sh                  # HTTP 模式部署
./deploy.sh --ssl            # HTTPS 模式部署 (需要本机已配置前置条件)
./deploy.sh --port 8080      # 自定义端口
./deploy.sh --ssl --port 443 # HTTPS + 自定义端口
```

---

### 方式四：NPM 直接本地启动部署

无需 Docker，直接使用 Node.js（≥ 18）环境：

```bash
# 克隆并安装依赖
git clone https://github.com/yourusername/GridTrax.git
cd GridTrax
npm install

# 配置 .env.local (见上方准备工作)

# 开发模式运行
npm run dev

# 构建并启动静态服务 (端口运行于 721)
npm run serve
```

> ⚠️ 生成的 `dist/` 目录也可以直接托付给 Nginx / Apache / Caddy 等传统 Web 服务器静态代理。使用 Nginx 时请务必配置路由回退：`try_files $uri $uri/ /index.html;` 以兼容前端 SPA 动态路由。

---

## JSON 数据备份

观影数据保存在当前浏览器的 LocalStorage 中。清除站点数据会删除记录，请定期导出备份。

1. 点击导航栏的 **数据备份** 图标（手机端在更多菜单中）。
2. 点击 **导出 JSON**，下载包含观影状态、评分、评论、单集进度及影片元数据的备份。
3. 点击 **导入 JSON**，选择文件并确认覆盖。导入会替换当前全部记录，不进行合并；取消或文件校验失败不会更改现有记录。
4. 支持旧版原始记录以及 v2/v3 备份，新备份格式为 v4。旧备份中的账号、Token 和第三方关联配置不会恢复，也不会进入新备份。

项目不再包含 Bangumi 集成、WebDAV 或后台自动同步。既有浏览器观影记录仍会保留，旧的独立配置缓存不再使用。

---

## 🗺️ 发展计划

- [ ] **拓展数据源支持**：计划新增对豆瓣（Douban）等网站的数据抓取与支持。
- [ ] **条目元数据管理**：支持手动校对条目的 TMDB ID 等核心元数据。
- [ ] **可视化观影档案**：支持导出美观、结构化的个人追剧足迹与可视化数据图表。

---

## 使用限制

- 搜索、详情和海报仍由浏览器直接请求 TMDB，静态部署不会自动代理这些请求。
- 不同设备和浏览器的本地记录互不共享，需要使用 JSON 文件手动迁移。

---

## 🤝 参与项目

欢迎任何形式的贡献！无论是一个小 Bug 的修复，还是全新特性的建议：

1. **Fork** 本仓库。
2. 创建您的 Feature 分支: `git checkout -b feature/AmazingFeature`。
3. 提交变更: `git commit -m 'Add some AmazingFeature'`。
4. 推送到分支: `git push origin feature/AmazingFeature`。
5. 提交一个 Pull Request。

建议在提大型 PR 前，先在 Issues 提出您的想法以供讨论。

---

## 🤖 AI声明

本项目几乎**全部**由 AI 进行辅助完成，使用到的模型包含 Google Gemini 3.1 系列与 Anthropic Claude 4.6 系列。

---

## 📄 开源协议

GridTrax 基于 [MIT License](LICENSE) 协议开源。请自由享受并改造它！
