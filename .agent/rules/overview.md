这份规划书非常适合作为 Cursor、GitHub Copilot 等 AI 编程工具的上下文提示词（Prompt / PRD）。为了让 AI 能“秒懂”并生成高质量的架构与代码，我将这份规划书重构为**系统需求说明与架构设计文档（PRD & Architecture Design）**。

文档采用了模块化、结构化的描述，重点明确了状态机逻辑、数据结构、API 联动和 UI 规范。你可以直接复制以下内容喂给你的 Vibe Coding 工具。

---

# 📺 项目代号：GridTrax (影视格子追踪器) - Vibe Coding 规划书

## 1. 项目概述 (Project Overview)

本项目旨在开发一款纯前端的影视进度追踪 Web 应用。核心体验复刻 Bangumi (番组计划) 的“点格子”追番功能，但将数据源扩展至全量影视作品（依托 TMDB），并引入 Material You 现代设计语言。

这是一款高度追求个人数据主权、UI 交互爽感和强逻辑条理性的硬核工具。

## 2. 核心功能需求 (Core Features)

### 2.1 剧集/多集作品管理（Season-based Management）

* **层级结构**：严格以 TMDB 的 `Season` 为管理单元。例如《间谍过家家》S1、S2、S3 分别作为独立区块进行格子渲染，S1 渲染 12 个格子。
* **全局状态**：每部 Season 包含总体状态标记：`想看 (Wish)` / `看过 (Collect)` / `在看 (Do)` / `搁置 (On Hold)` / `抛弃 (Dropped)`，并支持 1-10 星（或 1-5 颗完整星）评分。
* **「点格子」交互逻辑（核心）**：
* 每个 Episode 对应一个格子。
* **操作 1 -「看过」 (Watched)**：点击单个空格子，仅标记该集为已看（状态翻转）。
* **操作 2 -「看到」 (Watched Up To)**：长按/右键/特定按钮点击某集格子，将该集及**之前所有的集数**一并标记为已看（批量更新状态）。
* **视觉反馈**：未看（空心/浅色）、已看（实心/主题色）。



### 2.2 电影/单集作品管理（Movie Management）

* 无格子阵列。
* 仅保留全局状态标记：`想看` / `看过` / `在看` / `搁置` / `抛弃`，以及评分功能。

### 2.3 数据源 (Data Source)

* **元数据抓取 (TMDB)**：所有影视（动画、剧集、电影）的标题、集数、海报、简介等元数据均通过 TMDB API 实时获取。



## 3. UI/UX 与交互规范 (Design Specifications)

* **设计语言**：严格遵循 **Google Material You (Material Design 3)** 规范。
* 使用动态配色（Dynamic Color），根据影视海报的主色调自动提取主题色，渲染该剧集的格子和背景卡片。
* 组件使用大圆角、充裕的留白以及平滑的微动效（如点下格子的水波纹和填色动画）。


* **响应式适配 (Responsive Design)**：
* **Desktop (桌面)**：多列网格布局，左侧海报与全局信息，右侧大面积展示格子阵列。
* **Tablet (平板)**：优化触摸响应，长按触发「看到这里」的批量操作。
* **Mobile (移动端)**：单列瀑布流，格子阵列自动换行以适配窄屏，保证点击区域（Touch Target）不小于 48x48dp。



## 4. 给 AI 的架构与技术栈建议 (Tech Stack for AI Implementation)

*建议使用现代前端框架构建，以纯静态 SPA (单页应用) 形式运行，最大化降低部署门槛。*

* **核心框架**：React / Vue 3 (推荐使用 Vite 构建)
* **UI 组件库**：Material Web Components (MWC) 或类似 Vuetify 3 / MUI v5 (需配置为 Material You 风格)。
* **状态管理**：Zustand (React) 或 Pinia (Vue)，用于管理复杂的剧集观看进度缓存。
* **持久化**：
* 使用 `localStorage` 作为缓存层，实现本地优先 (Local-first)、离线可用的架构。


* **API 交互**：Axios / Fetch，需处理跨域问题 (CORS)。

## 5. 数据结构设计参考 (Data Models)

*AI 请参考以下数据结构进行 Store 和 本地 JSON 文件的设计：*

```json
// 本地存储的用户进度文件示例
{
  "user_id": "aronnax_local",
  "last_sync": 1718293847,
  "records": {
    "tmdb_tv_12345_s1": {
      "type": "tv_season",
      "tmdb_id": 12345,
      "season_number": 1,
      "global_status": "Do", // Wish, Collect, Do, OnHold, Dropped
      "rating": 8,
      "episodes": {
        "1": { "watched": true },
        "2": { "watched": true },
        "3": { "watched": false }
      }
    },
    "tmdb_movie_67890": {
      "type": "movie",
      "tmdb_id": 67890,
      "global_status": "Collect",
      "rating": 9
    }
  }
}

```

## 6. 开发步骤规划 (Implementation Phases for Vibe Coding)

1. **Phase 1: 基础框架与 TMDB 对接**
* 初始化前端项目，引入 Material You UI 库。
* 实现搜索页面，调用 TMDB API 获取搜索结果，展示影视列表。
* 实现详情页，根据 TMDB 数据渲染季数 (Seasons) 和每季的集数信息。


2. **Phase 2: 核心组件「格子系统」开发**
* 设计并实现格子组件。实现单点「看过」和长按/特定交互「看到这里」的业务逻辑。
* 引入本地状态管理，将点击格子的状态持久化到浏览器的 LocalStorage 中。


3. **Phase 3: 状态与评分系统**
* 实现全局状态选择器（想看/在看/等）和打分组件。