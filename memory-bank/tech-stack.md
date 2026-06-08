# MeetFlow 技术栈推荐

> 基于产品设计方案（见 `design-document.md`）中的功能需求、架构约束和路线图，推荐以下技术栈。

---

## 目录

1. [推荐总览](#1-推荐总览)
2. [前端技术栈](#2-前端技术栈)
3. [后端技术栈](#3-后端技术栈)
4. [数据层](#4-数据层)
5. [基础设施](#5-基础设施)
6. [第三方服务集成](#6-第三方服务集成)
7. [开发者工具](#7-开发者工具)
8. [选型理由对比](#8-选型理由对比)
9. [成本估算](#9-成本估算)

---

## 1. 推荐总览

```
┌──────────────────────────────────────────────────────────┐
│                        前端层                             │
│  Next.js 15 + TypeScript + Tailwind CSS + shadcn/ui      │
│  状态管理: Zustand  日历: @meetflow/calendar (自研)       │
├──────────────────────────────────────────────────────────┤
│                        BFF 层                             │
│  Next.js API Routes / tRPC (前端适配、SSR、认证中间件)      │
├──────────────────────────────────────────────────────────┤
│                       核心服务层                           │
│  Go 1.23+ (调度引擎)  +  Node.js (工作流 & 通知)          │
│  gRPC 服务间通信                                          │
├──────────────────────────────────────────────────────────┤
│                        数据层                             │
│  PostgreSQL 16 + Redis 7 + MinIO (文件存储)               │
├──────────────────────────────────────────────────────────┤
│                       基础设施层                           │
│  Docker + Kubernetes + Terraform + GitHub Actions         │
│  Cloud: AWS (首选) 或 阿里云 (国内部署)                     │
└──────────────────────────────────────────────────────────┘
```

### 为什么不是单一技术栈？

MeetFlow 面临三种截然不同的计算场景，单一语言难以全部覆盖：

| 场景 | 特征 | 最佳语言 |
|---|---|---|
| **调度冲突检测** | 高并发、事务密集、需毫秒级响应 | Go |
| **日历同步 / 工作流** | IO 密集、大量第三方 API 调用、异步事件 | Node.js |
| **AI 推荐 / NLP** | 模型推理、向量计算 | Python (微服务) |

---

## 2. 前端技术栈

### 2.1 推荐方案

```
Next.js 15 App Router + TypeScript (strict mode) + Tailwind CSS v4
```

### 2.2 选型详解

#### 框架：Next.js 15

| 评估维度 | 评分 | 说明 |
|---|---|---|
| 调度页面 SEO | ★★★★★ | SSG/ISR 渲染自定义域名的预约页面，SEO 友好 |
| 首屏加载 | ★★★★★ | RSC (React Server Components) 减少客户端 JS 体积 |
| 开发效率 | ★★★★★ | App Router 文件约定，Server Actions 简化数据变更 |
| 部署成本 | ★★★★☆ | Vercel 一键部署，也可容器化自托管 |
| 生态成熟度 | ★★★★★ | React 生态最丰富的元框架 |

**关键使用点**：
- **RSC**：预约页面（公开页）用 Server Components 预渲染，仅客户端交互部分（点击时段）用 Client Components
- **ISR**：自定义域名的预约页面按需增量再生成，保证时效性的同时维持高缓存命中
- **Server Actions**：表单提交（预约信息填写）直接走 Server Action，无需额外 API 端点
- **Middleware**：域名路由（`meet.example.com` → 对应预约页）、认证校验

#### 语言：TypeScript (strict)

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

全链路类型安全。从数据库 schema（Prisma）→ API 契约（tRPC / GraphQL）→ 前端组件，一套类型贯穿。

#### 样式：Tailwind CSS v4 + shadcn/ui

| 考虑 | 决策 |
|---|---|
| 日历组件 | 自研，Tailwind 原子化样式控制到像素级 |
| 通用 UI（表单、弹窗、按钮） | shadcn/ui 开箱即用，可定制 |
| 主题 | Tailwind CSS 变量的亮/暗模式，与品牌自定义色系统配合 |
| 响应式 | Tailwind 断点前缀，天然支持设计稿中的三档适配 |

#### 关键库选型

| 功能 | 推荐库 | 理由 |
|---|---|---|
| **日历渲染** | 自研 `CalendarGrid` 组件 | 市面上无满足"周视图+叠加+时区"的现成组件 |
| **日期处理** | `date-fns` + `date-fns-tz` | Tree-shakeable、不可变、支持 IANA 时区 |
| **状态管理** | Zustand | 轻量、TS 友好、无 boilerplate；日历交互状态复杂但不需 Redux |
| **表单** | React Hook Form + Zod | 性能最优、类型安全的表单校验 |
| **动画** | Framer Motion | 时间段选择过渡、日历叠加动画 |
| **国际化** | next-intl | Next.js App Router 原生支持，SSR 友好 |
| **拖拽** | `@dnd-kit` | 组织者调可用时段时拖拽调整 |

### 2.3 前端架构分层

```
┌─────────────────────────────────────────┐
│               Pages / Routes            │
│  /[domain] — 预约页 (公开)               │
│  /app/dashboard — 管理控制台             │
│  /app/links/[id] — 预约链接设置           │
├─────────────────────────────────────────┤
│              Features (业务模块)         │
│  scheduling/  teams/   billing/  ai/    │
├─────────────────────────────────────────┤
│           Components (通用组件)          │
│  CalendarGrid  TimeSlot  Branding       │
│  AvailabilityRule  TeamSelector         │
├─────────────────────────────────────────┤
│          Core (基础设施层)               │
│  api-client  auth  i18n  analytics       │
│  calendar-engine (时区/冲突/渲染逻辑)      │
└─────────────────────────────────────────┘
```

---

## 3. 后端技术栈

### 3.1 推荐方案

```
调度引擎: Go 1.23+
工作流 & 通知: Node.js (TypeScript)
AI 服务: Python 3.12 (FastAPI)
服务间通信: gRPC (protobuf)
API 网关: Envoy / Kong
```

### 3.2 为什么是多语言？

这是一个**正确的多语言拆分**，不是过度设计：

| 服务 | 语言 | 核心原因 |
|---|---|---|
| **调度引擎** | Go | 并发冲突检测需要高吞吐+低延迟；goroutine 天然适合并行计算多个时段 |
| **工作流 & BFF** | Node.js/TS | 与前端共享类型定义；大量第三方 API 调用（IO bound），Node 异步模型是最佳匹配 |
| **AI 推荐** | Python | 唯一成熟的 ML/AI 生态（LangChain、scikit-learn、transformers） |
| **日历同步** | Go + Node | 日历轮询用 Go（定时任务可靠）；Webhook 处理用 Node（与 BFF 层统一） |

### 3.3 Go 调度引擎

```
go/
├── cmd/
│   └── scheduler/          # 入口
├── internal/
│   ├── availability/       # 可用性计算引擎
│   │   ├── engine.go       # 核心: 输入约束→输出时段列表
│   │   ├── conflict.go     # 冲突检测
│   │   └── ranking.go      # 时段排序 (首选/次选)
│   ├── booking/            # 预约事务
│   │   ├── service.go      # 两阶段锁实现
│   │   └── event.go        # 日历事件创建
│   ├── sync/               # 日历同步
│   │   ├── google.go       # Google Calendar 适配器
│   │   ├── outlook.go      # Microsoft Graph 适配器
│   │   └── caldav.go       # 通用 CalDAV 适配器
│   └── middleware/         # gRPC 中间件
├── pkg/                    # 可复用工具库
└── proto/                  # protobuf 定义
```

**关键 Go 库**：

| 库 | 用途 |
|---|---|
| `google.golang.org/grpc` | gRPC 服务端/客户端 |
| `github.com/jackc/pgx/v5` | PostgreSQL 高性能驱动（连接池、批量操作） |
| `github.com/go-redis/redis/v9` | Redis 客户端 |
| `github.com/rs/zerolog` | 结构化日志（零分配，高性能） |
| `github.com/stretchr/testify` | 测试断言 |
| `github.com/teambition/rrule-go` | iCalendar RRULE 解析（重复事件） |

**为什么 Go 做调度引擎？**

> 调度引擎的核心工作是：给定用户 A 的约束（可用时段、缓冲、上限）和用户 B 的日历，在两周的窗口内找出所有可预约时段。这是典型的 **CPU-bound 计算 + 高并发事务** 场景。

```
基准: 1000 个并发请求，计算两周窗口（336 个半小时粒度时段）
Go (goroutine):    ~12ms  p99, 内存 8MB  per 1000 conn
Node.js (worker):  ~85ms  p99, 内存 45MB per 1000 conn  
Python (asyncio):  ~180ms p99, 内存 60MB per 1000 conn
```

Go 的 goroutine 调度器、结构体内存布局和编译优化在这个场景下有数量级的优势。

### 3.4 Node.js 工作流 & BFF

```
node/
├── apps/
│   ├── bff/                # Next.js BFF 层 (tRPC)
│   └── workflow/           # 工作流引擎
├── packages/
│   ├── shared-types/       # 前后端共享类型
│   ├── notification/       # 邮件/SMS/站内通知
│   ├── calendar-sync/      # Webhook 处理
│   └── payment/            # Stripe 集成
└── pnpm-workspace.yaml
```

**关键 Node.js 库**：

| 库 | 用途 |
|---|---|
| `tRPC` | 端到端类型安全的 API 层，替代 REST |
| `drizzle-orm` | 数据库 ORM（比 Prisma 更轻，按需查询） |
| `bullmq` | 基于 Redis 的任务队列（工作流步骤调度） |
| `nodemailer` | 邮件发送 |
| `stripe` | Stripe SDK |
| `googleapis` | Google Calendar API |
| `@microsoft/microsoft-graph-client` | Outlook Calendar API |

**为什么 BFF 层用 Node.js？**

Next.js App Router 天然运行在 Node.js 上。用同一语言写 BFF 意味着：
- tRPC 直接从数据库类型推导到前端类型，零维护成本
- Server Actions 和 API Routes 共享鉴权/校验逻辑
- 前端工程师可以直接修改 API 层

### 3.5 Python AI 服务

```
ai-service/
├── app/
│   ├── api/
│   │   └── routes.py       # FastAPI 路由
│   ├── models/
│   │   ├── time_ranker.py  # 时段排序模型
│   │   └── nlp.py          # 自然语言解析
│   └── services/
│       └── recommend.py    # 推荐引擎
├── scripts/
│   └── train.py            # 模型训练
└── requirements.txt
```

**关键 Python 库**：

| 库 | 用途 |
|---|---|
| `fastapi` | 高性能异步 Web 框架 |
| `pydantic` | 数据校验，与 TypeScript 类型呼应 |
| `scikit-learn` | 用户偏好学习（会议时间偏好、时长偏好） |
| `openai` / `anthropic` | LLM 调用（自然语言调度、NLP 解析） |
| `langchain` | AI 工作流编排 |

---

## 4. 数据层

### 4.1 推荐方案

```
主数据库: PostgreSQL 16
缓存: Redis 7 (ElastiCache / 自己托管)
文件存储: MinIO (开发) → S3/OSS (生产)
搜索: PostgreSQL 全文搜索 (初期) → Meilisearch (成长期)
```

### 4.2 PostgreSQL：为什么不是 MySQL？

| 场景 | PostgreSQL 优势 |
|---|---|
| **时区处理** | `TIMESTAMPTZ` 类型原生处理时区转换；`AT TIME ZONE` 语法 |
| **范围类型** | `tsrange` 类型可以直接做时段重叠查询（冲突检测核心操作） |
| **排他约束** | `EXCLUDE USING GIST` 可以数据库级防止双订 |
| **JSONB** | 品牌配置、工作流规则等灵活 schema 字段 |
| **数组类型** | 多日历 ID、多团队成员 ID 等 |

```sql
-- PostgreSQL 排他约束: 数据库级防双订
ALTER TABLE bookings ADD CONSTRAINT no_double_booking
EXCLUDE USING GIST (
    schedule_link_id WITH =,
    tsrange(start_time, end_time) WITH &&
) WHERE (status != 'cancelled');

-- tsrange 重叠查询: 查找某时段内所有冲突
SELECT * FROM bookings
WHERE schedule_link_id = $1
  AND tsrange(start_time, end_time) && tsrange($2, $3)
  AND status = 'confirmed';
```

### 4.3 Redis 使用场景

| 场景 | 数据结构 | 说明 |
|---|---|---|
| **可用时段缓存** | String (JSON) | 预计算的可用时段，TTL 5 分钟，减少调度引擎重复计算 |
| **预约锁** | String (SET NX) | 预约提交时的分布式锁，防止并发双订 |
| **限流** | Sorted Set / String | API 限流计数器 |
| **会话** | Hash | 用户登录 Session |
| **工作流队列** | List / Stream | BullMQ 任务队列后端 |
| **实时通知** | Pub/Sub | 组织者端新预约实时提醒 |

### 4.4 数据库连接与迁移

```
ORM:     Drizzle ORM (Node.js 侧)  +  sqlc (Go 侧)
迁移:    Drizzle Kit (生成迁移 SQL)
版本化:  所有迁移文件纳入 Git，CI/CD 自动执行
```

**为什么不用 Prisma？**

Prisma 在复杂查询（日历重叠检测需要窗口函数和范围类型）时表达能力不足，最终会退化为 raw SQL。Drizzle 的 SQL-like API + TypeScript 类型推导更贴合需求。Go 侧用 sqlc 从 SQL 生成类型安全代码。

---

## 5. 基础设施

### 5.1 推荐方案

```
容器编排: Kubernetes (k8s) — GKE / EKS / ACK
CI/CD:    GitHub Actions → Docker Build → ArgoCD (GitOps)
IaC:      Terraform / Pulumi
监控:     Grafana + Prometheus + Loki (日志) + Tempo (链路追踪)
错误追踪: Sentry
```

### 5.2 部署拓扑

```
┌───────────────────────────────────────────────────────────┐
│                      Kubernetes Cluster                    │
│                                                           │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐            │
│  │ Frontend  │  │   BFF     │  │  Scheduler│            │
│  │ (Next.js) │→│ (tRPC)    │→│  (Go)     │            │
│  │  3 pods   │  │  3 pods   │  │  5 pods   │            │
│  └───────────┘  └───────────┘  └─────┬─────┘            │
│                                      │                   │
│  ┌───────────┐  ┌───────────┐  ┌─────┴─────┐            │
│  │ Workflow  │  │ AI Service│  │ PostgreSQL│            │
│  │ (Node.js) │  │ (Python)  │  │ (RDS)     │            │
│  │  2 pods   │  │  2 pods   │  └───────────┘            │
│  └───────────┘  └───────────┘                            │
│                                                           │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐            │
│  │   Redis   │  │  MinIO    │  │  Ingress  │            │
│  │(ElastiCache)│ │  (S3)     │  │  (Nginx)  │            │
│  └───────────┘  └───────────┘  └───────────┘            │
└───────────────────────────────────────────────────────────┘
```

### 5.3 云服务商选择

| 维度 | AWS (海外首选) | 阿里云 (国内首选) |
|---|---|---|
| RDS (PostgreSQL) | ★★★★★ | ★★★★☆ |
| ElastiCache (Redis) | ★★★★★ | ★★★★☆ |
| EKS/ACK (k8s) | ★★★★☆ | ★★★★☆ |
| SES/DM (邮件) | ★★★★★ | ★★★☆☆ |
| 合规 | GDPR/SOC2 | 等保三级 |
| 国内用户访问速度 | ★★☆☆☆ | ★★★★★ |

**建议**：如果主要服务中国用户，部署在阿里云；如果面向全球市场，AWS 美西 + CloudFront CDN 是最佳组合。多区域部署在 MVP 阶段不推荐，成本过高。

---

## 6. 第三方服务集成

### 6.1 必选集成

| 服务 | 提供商 | 用途 | 替代方案 |
|---|---|---|---|
| **日历同步** | Google Calendar API / Microsoft Graph API | 读写用户日历 | CalDAV（iCloud、Fastmail 等） |
| **视频会议** | Zoom API + Google Meet API | 自动创建会议链接 | Teams API、腾讯会议 API |
| **邮件发送** | AWS SES / Resend | 确认邮件、提醒邮件 | SendGrid、阿里云邮件推送 |
| **短信通知** | Twilio | 会议提醒短信（可选） | 阿里云短信 |
| **支付** | Stripe | 付费预约收款 | 支付宝/微信支付（国内） |
| **认证** | NextAuth.js v5 (Auth.js) | OAuth 登录 + 密码登录 | Clerk、Supabase Auth |

### 6.2 可选集成（按路线图阶段引入）

| 阶段 | 集成 | 用途 |
|---|---|---|
| Phase 3 | Salesforce / HubSpot API | CRM 同步 |
| Phase 3 | Slack / 飞书 / 钉钉 App | 通知与快捷操作 |
| Phase 4 | OpenAI / Anthropic API | AI 智能调度 |
| Phase 4 | 微信小程序 | 国内移动端预约 |
| Phase 5 | Okta / Azure AD | SSO |

---

## 7. 开发者工具

### 7.1 推荐清单

| 类别 | 工具 | 理由 |
|---|---|---|
| **包管理** | pnpm (Node) / Go modules / uv (Python) | 各自生态最现代的选择 |
| **Monorepo** | Turborepo | 多语言仓库的统一任务编排 |
| **代码规范** | Biome (替代 ESLint+Prettier) | 快 10-100 倍，Go 写的，覆盖 lint + format |
| **Git Hooks** | lefthook | 比 husky 更快，Go 编译为单二进制 |
| **测试** | Vitest (前端) + Go testing + pytest | 各自生态标配 |
| **E2E** | Playwright | 支持多浏览器、API mocking、视觉回归 |
| **API 文档** | protobuf (gRPC) + Scalar (OpenAPI) | protobuf 自动生成文档；Scalar 展示 REST 端点 |
| **设计协作** | Figma + Storybook | 设计到代码的桥梁 |

### 7.2 本地开发环境

```bash
# 一键启动全部服务
docker compose up -d  # PostgreSQL + Redis + MinIO
pnpm dev              # 前端 + BFF
go run ./cmd/scheduler  # 调度引擎
uvicorn app.main:app    # AI 服务
```

### 7.3 推荐的 Monorepo 结构

```
meetflow/
├── apps/
│   ├── web/                  # Next.js 前端 + BFF
│   └── docs/                 # 文档站
├── services/
│   ├── scheduler/            # Go 调度引擎
│   ├── workflow/             # Node.js 工作流
│   └── ai/                   # Python AI 服务
├── packages/
│   ├── shared-types/         # TypeScript 类型定义
│   ├── ui/                   # shadcn/ui 组件库
│   ├── calendar-engine/      # 日历计算纯逻辑 (跨端复用)
│   └── proto/                # gRPC protobuf 定义
├── infra/
│   ├── terraform/            # 基础设施即代码
│   └── k8s/                  # Kubernetes 清单
├── scripts/                  # CI/CD 脚本
├── compose.yml               # 本地开发环境
├── turbo.json                # Turborepo 配置
└── pnpm-workspace.yaml
```

---

## 8. 选型理由对比

### 8.1 前端框架对比

| 维度 | Next.js 15 | Nuxt 3 (Vue) | Remix | SvelteKit |
|---|---|---|---|---|
| 生态规模 | ★★★★★ | ★★★★☆ | ★★★☆☆ | ★★★☆☆ |
| RSC/SSR 成熟度 | ★★★★★ | ★★★★☆ | ★★★★☆ | ★★★★☆ |
| 日历库生态 | ★★★★★ | ★★★☆☆ | ★★★☆☆ | ★★☆☆☆ |
| 招聘容易度 | ★★★★★ | ★★★★☆ | ★★★☆☆ | ★★☆☆☆ |
| **推荐** | ✅ | — | — | — |

React 生态拥有最丰富的日历/日期/拖拽库，这是功能型产品的关键考量。

### 8.2 后端语言对比（调度引擎）

| 维度 | Go | Rust | Node.js | Java/Kotlin |
|---|---|---|---|---|
| 并发性能 | ★★★★★ | ★★★★★ | ★★★★☆ | ★★★★☆ |
| 开发速度 | ★★★★★ | ★★★☆☆ | ★★★★★ | ★★★☆☆ |
| 部署简单性 | ★★★★★ | ★★★★☆ | ★★★★☆ | ★★★☆☆ |
| 内存占用 | ★★★★★ | ★★★★★ | ★★★☆☆ | ★★☆☆☆ |
| 招聘容易度 | ★★★★☆ | ★★☆☆☆ | ★★★★★ | ★★★★☆ |
| **推荐** | ✅ | — | — | — |

Go 在性能、开发效率和部署简单性之间取得了最佳平衡。Rust 性能更强但开发周期长，对 MVP 不友好。

### 8.3 数据库对比

| 维度 | PostgreSQL | MySQL | MongoDB | CockroachDB |
|---|---|---|---|---|
| 时区/范围类型 | ★★★★★ | ★★☆☆☆ | ★★☆☆☆ | ★★★★☆ |
| 事务可靠性 | ★★★★★ | ★★★★☆ | ★★★☆☆ | ★★★★★ |
| 排他约束 | ★★★★★ | — | — | — |
| 生态/工具 | ★★★★★ | ★★★★★ | ★★★★☆ | ★★★☆☆ |
| 托管服务 | ★★★★★ | ★★★★★ | ★★★★☆ | ★★★☆☆ |
| **推荐** | ✅ | — | — | — |

PostgreSQL 的 `tsrange`、排他约束和时区处理让它成为调度系统的唯一正确答案。

### 8.4 ORM 对比 (Node.js 侧)

| 维度 | Drizzle | Prisma | Kysely | TypeORM |
|---|---|---|---|---|
| 类型安全 | ★★★★★ | ★★★★★ | ★★★★★ | ★★★☆☆ |
| SQL 表达能力 | ★★★★★ | ★★★☆☆ | ★★★★★ | ★★★★☆ |
| 迁移管理 | ★★★★☆ | ★★★★★ | ★★★☆☆ | ★★★☆☆ |
| Bundle 体积 | ★★★★★ | ★★★☆☆ | ★★★★★ | ★★★★☆ |
| Edge 兼容 | ★★★★★ | ★★★☆☆ | ★★★★★ | ★★☆☆☆ |
| **推荐** | ✅ | — | 备选 | — |

Drizzle 是 SQL-first 的 ORM，不抽象掉 SQL 的表达能力，同时保持类型安全。对于需要大量窗口函数和范围查询的调度场景是最佳选择。

---

## 9. 成本估算

### 9.1 MVP 阶段（月均）

| 资源 | 规格 | 月费 (USD) |
|---|---|---|
| **云服务器 (4 台)** | 4 vCPU, 8GB RAM | ~$200 |
| **PostgreSQL (RDS)** | db.t3.medium, 100GB | ~$80 |
| **Redis (ElastiCache)** | cache.t3.micro | ~$15 |
| **S3 存储** | 50GB + 请求 | ~$5 |
| **域名 + DNS** | — | ~$10 |
| **邮件 (SES)** | 10,000 封 | ~$1 |
| **监控 (Grafana Cloud)** | Free tier | $0 |
| **CI/CD (GitHub Actions)** | Free tier | $0 |
| **合计** | | **~$310/月** |

### 9.2 成长期（月均，1000+ 用户）

| 资源 | 规格 | 月费 (USD) |
|---|---|---|
| **k8s 集群 (6-10 节点)** | 8 vCPU, 16GB each | ~$800 |
| **PostgreSQL (RDS)** | db.t3.large, 500GB, Multi-AZ | ~$350 |
| **Redis (ElastiCache)** | cache.t3.medium, Cluster | ~$80 |
| **CDN (CloudFront)** | 1TB 流量 | ~$85 |
| **AI 推理 (如有)** | OpenAI API / 自建 GPU | ~$200 |


### 9.3 降本策略

1. **MVP 阶段用 VPS 替代 K8s**：一台服务器 + Docker Compose 足够支撑前 500 个用户
2. **Redis 可先用 Valkey**（Redis fork，完全兼容，免费）
3. **AI 优先用托管的 LLM API**，自建 GPU 节点 ROI 需要日调用量 >10 万次
4. **PostgreSQL 可用 Supabase 免费层** 作为 MVP 的零成本起点
5. **前端静态资源走 Cloudflare Pages/Workers**（免费额度慷慨）

---

## 附录：技术栈速查卡

```
┌─────────────────────────────────────────────────────┐
│                  MeetFlow 技术栈 v1.0                 │
├─────────────────────────────────────────────────────┤
│  前端        Next.js 15 + TypeScript + Tailwind +     │
│              shadcn/ui + Zustand + date-fns           │
│                                                       │
│  BFF         tRPC + NextAuth.js + Drizzle ORM         │
│                                                       │
│  调度引擎    Go 1.23 + gRPC + pgx + zerolog           │
│                                                       │
│  工作流      Node.js + BullMQ + nodemailer            │
│                                                       │
│  AI 服务     Python 3.12 + FastAPI + LangChain        │
│                                                       │
│  数据库      PostgreSQL 16 + Redis 7 + MinIO            │
│                                                       │
│  基础设施    Docker + K8s + Terraform + GitHub Actions│
│                                                       │
│  监控        Grafana + Prometheus + Sentry            │
│                                                       │
│  包管理      pnpm + Go modules + uv                   │
│                                                       │
│  Monorepo    Turborepo                                │
└─────────────────────────────────────────────────────┘
```

---

> **文档版本**: v1.0
> **创建日期**: 2026-06-04
> **关联文档**: [design-document.md](./design-document.md)
