# MeetFlow 文件架构说明

> 记录项目中每个文件的作用和依赖关系。
>
> 关联文档: `tech-stack.md` §7.3（Monorepo 结构）、`implementation-plan.md`

---

## 项目根目录

| 文件 | 作用 | 状态 |
|------|------|------|
| `.gitignore` | 排除 .venv/、node_modules/、.next/、.env*、*.log 等无关文件 | ✅ |
| `.env.example` | 列出全部所需环境变量及空占位符（12 个变量） | ✅ |
| `.env` | 本地开发环境变量（DATABASE_URL、REDIS_URL），Git 排除 | ✅ |
| `.npmrc` | pnpm 配置：shamefully-hoist=false, strict-peer-dependencies=true | ✅ |
| `package.json` | 根 monorepo 包，含 dev/build/lint/test/format/db:migrate 脚本 | ✅ |
| `pnpm-workspace.yaml` | 声明 workspace 成员 apps/* 和 packages/* | ✅ |
| `pnpm-lock.yaml` | pnpm 依赖锁文件 | ✅ |
| `turbo.json` | Turborepo pipeline 定义（build 依赖 ^build） | ✅ |
| `docker-compose.yml` | 本地 PostgreSQL 16 + Redis 7 容器，含健康检查 | ✅ |
| `lefthook.yml` | Git hooks 配置（lefthook 自动生成，待配置） | ⏳ |
| `memory-bank/CLAUDE.md` | 项目规则文件，10 类 32 条规则，引导 AI 正确开发 | ✅ |
| `memory-bank/design-document.md` | 产品设计方案 | ✅ |
| `memory-bank/tech-stack.md` | 技术栈推荐 | ✅ |
| `memory-bank/implementation-plan.md` | 60 步实施计划 | ✅ |
| `memory-bank/progress.md` | 实施进度记录 | ✅ |
| `memory-bank/architecture.md` | 本文件：记录每个文件的作用 | ✅ |

---

## apps/web/（Next.js 前端 + BFF）

_尚未创建任何文件_

---

## apps/docs/（文档站）

_尚未创建任何文件_

---

## services/scheduler/（Go 调度引擎）✅ Phase 2

| 文件 | 作用 | 状态 |
|------|------|------|
| `go.mod` | Go 模块定义：github.com/meetflow/scheduler（go 1.25.0） | ✅ |
| `go.sum` | Go 依赖锁文件 | ✅ |
| `Makefile` | build / test / lint / run 四个 target | ✅ |
| `proto/scheduler.pb.go` | Protobuf 消息定义生成代码（根级回退） | ✅ |
| `proto/scheduler_grpc.pb.go` | gRPC 服务端/客户端生成代码（根级回退） | ✅ |
| `proto/scheduler/v1/scheduler.pb.go` | Protobuf 消息定义生成代码 | ✅ |
| `proto/scheduler/v1/scheduler_grpc.pb.go` | gRPC 服务端/客户端生成代码 | ✅ |
| `cmd/scheduler/main.go` | gRPC 服务器入口：:9090 + interceptors + grace shutdown | ✅ |
| `internal/handler.go` | `SchedulerHandler` — gRPC service 实现，连接 proto ↔ 业务逻辑 | ✅ |
| `internal/handler_test.go` | Handler 5 个单元测试（GetAvailability/CreateBooking/CancelBooking） | ✅ |
| `internal/middleware/logging.go` | gRPC 拦截器：请求日志 + panic recovery | ✅ |
| `internal/booking/store_memory.go` | `InMemoryStore` — BookingStore 的内存实现（开发/MVP 用） | ✅ |
| `internal/availability/engine.go` | `CalculateAvailability` — 6 阶段可用性计算纯函数 | ✅ |
| `internal/availability/engine_test.go` | 可用性计算 11 个单元测试 | ✅ |
| `internal/availability/ranking.go` | `RankTimeSlots` — cluster/spread 双策略排序 | ✅ |
| `internal/availability/ranking_test.go` | 排序引擎 5 个单元测试 | ✅ |
| `internal/booking/conflict.go` | `CheckConflict` 纯函数 + `BusySlotsFromBookings` 转换 | ✅ |
| `internal/booking/service.go` | `BookingService` — 两阶段锁 CreateBooking + CancelBooking | ✅ |
| `internal/booking/service_test.go` | 冲突检测 + 预约事务 16 个单元测试（含并发安全验证） | ✅ |
| `internal/sync/` | 日历同步适配器（待创建） | ⏳ |
| `pkg/cache/` | Redis 缓存工具（待创建） | ⏳ |

---

## services/workflow/（Node.js 工作流引擎）

_尚未创建任何文件_

---

## services/ai/（Python AI 服务）

_尚未创建任何文件_

---

## packages/shared-types/（共享类型与数据库层）✅ Phase 1

| 文件 | 作用 | 状态 |
|------|------|------|
| `package.json` | @meetflow/shared-types 包定义，含 db:migrate/seed 脚本 | ✅ |
| `tsconfig.json` | TypeScript strict 配置 + noUncheckedIndexedAccess + exactOptionalPropertyTypes | ✅ |
| `drizzle.config.ts` | Drizzle Kit 配置：PostgreSQL 方言，schema 路径 | ✅ |
| `src/index.ts` | 包入口：导出 db 连接 + 所有 schema | ✅ |
| `src/db/connection.ts` | PostgreSQL 连接池（max 20, idle timeout 30s） | ✅ |
| `src/db/schema/index.ts` | 统一导出 6 张表定义 | ✅ |
| `src/db/schema/users.ts` | users 表：id, email, name, timezone, avatar_url, created_at | ✅ |
| `src/db/schema/calendar_accounts.ts` | calendar_accounts 表：id, user_id(FK), provider, tokens, sync_enabled | ✅ |
| `src/db/schema/schedule_links.ts` | schedule_links 表：id, user_id(FK), slug(unique), branding(jsonb), 等 | ✅ |
| `src/db/schema/availability_rules.ts` | availability_rules 表：id, user_id(FK), day_of_week, start/end_time | ✅ |
| `src/db/schema/bookings.ts` | bookings 表：id, schedule_link_id(FK), organizer_id(FK), start/end(timestamptz), status, attendee 信息 | ✅ |
| `src/db/schema/schedule_rules.ts` | schedule_rules 表：id, schedule_link_id(FK), rule_type, rule_value | ✅ |
| `src/db/migrations/0000_custom_constraints.sql` | 自定义约束：GIST 排他约束 + 5 个 CHECK 约束（btree_gist 扩展） | ✅ |
| `src/db/seed.ts` | 种子数据：测试用户 + 预约链接 + 5 天可用时段 + 6 条规则 | ✅ |
| `src/db/test-utils.ts` | 测试工具：create/drop/seed test database | ✅ |

---

## packages/ui/（shadcn/ui 组件库）

_尚未创建任何文件_

---

## packages/calendar-engine/（日历纯逻辑）

_尚未创建任何文件_

---

## packages/proto/（Protobuf 定义）✅ Step 14

| 文件 | 作用 | 状态 |
|------|------|------|
| `buf.yaml` | buf 配置 v2：STANDARD lint + FILE breaking | ✅ |
| `buf.gen.yaml` | 代码生成：protocolbuffers/go + grpc/go 远程插件 | ✅ |
| `scheduler/v1/scheduler.proto` | SchedulerService 定义：3 RPC + 共用 message + enum | ✅ |

---

## infra/（基础设施）

_尚未创建任何文件_

---

## scripts/（CI/CD 脚本）

_尚未创建任何文件_
