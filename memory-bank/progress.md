# MeetFlow 进度记录

> 记录已完成的实施步骤和当前状态。
>
> 关联文档: `implementation-plan.md`

---

## 当前状态

- **当前 Phase**: 2（Go 调度引擎）
- **当前步骤**: 18
- **总步骤数**: 60
- **已完成**: 18
- **进行中**: 0

---

## 步骤完成记录

| 编号 | 步骤名称 | 完成日期 | 验证结果 | 备注 |
|------|----------|----------|----------|------|
| 1 | 初始化 Git 仓库与 .gitignore | 2026-06-04 | ✅ | git status 干净，.env.example 含必要变量 |
| 2 | 安装基础工具链 | 2026-06-04 | ✅ | pnpm 11.5.1, Go 1.23.0, Python 3.13.13, uv 0.11.18, turbo 2.9.16, lefthook 2.1.9, biome 2.4.16 |
| 3 | 建立 Monorepo 目录结构 | 2026-06-04 | ✅ | 12 个目录 + 12 个 .gitkeep |
| 4 | 配置 pnpm Workspace 与 Turborepo | 2026-06-04 | ✅ | pnpm-workspace.yaml, package.json, turbo.json, .npmrc |
| 5 | 配置 Docker Compose 本地环境 | 2026-06-04 | ✅ 文件创建，Docker 待安装 | PostgreSQL 16 + Redis 7 |
| 6 | 初始化 Drizzle 与数据库连接 | 2026-06-04 | ✅ | 连接池 max 20, idle timeout 30s |
| 7 | 创建 Users 与 CalendarAccount 表 | 2026-06-04 | ✅ | users 6 字段, calendar_accounts 8 字段 |
| 8 | 创建 ScheduleLink 与 AvailabilityRule 表 | 2026-06-04 | ✅ | schedule_links 11 字段 + availability_rules 6 字段 |
| 9 | 创建 Booking 表（含排他约束） | 2026-06-04 | ✅ | GIST 排他约束 + CHECK 约束 |
| 10 | 创建 ScheduleRules 表 | 2026-06-04 | ✅ | 7 种规则类型 + CHECK |
| 11 | 编写数据库 Seed 脚本 | 2026-06-04 | ✅ | --clean 支持重复执行 |
| 12 | 创建数据库测试辅助工具 | 2026-06-04 | ✅ | create/drop/seed test DB |
| 13 | 初始化 Go 模块与项目结构 | 2026-06-04 | ✅ | github.com/meetflow/scheduler |
| 14 | 定义 Protobuf 接口 | 2026-06-04 | ✅ | 3 RPC: GetAvailability, CreateBooking, CancelBooking |
| 15 | 实现可用性计算引擎 | 2026-06-04 | ✅ 11/11 | CalculateAvailability 6 阶段流水线 |
| 16 | 实现时段排序引擎 | 2026-06-04 | ✅ 5/5 | cluster/spread 双策略 |
| 17 | 实现冲突检测与两阶段锁 | 2026-06-04 | ✅ 16/16 | CheckConflict + CreateBooking + 并发安全 |
| 18 | 实现 gRPC 服务端 | 2026-06-04 | ✅ 5/5 handler tests | main.go + handler + middleware + graceful shutdown |

---

## 遇到的问题

| 问题 | 步骤 | 解决方案 |
|------|------|----------|
| `corepack enable pnpm` EPERM | 2 | `npm install -g pnpm` |
| Go PATH 未刷新 | 2 | `setx` 添加 `C:\Program Files\Go\bin` |
| drizzle-orm 无 timestamptz | 7-10 | 改用 `timestamp({ withTimezone: true })` |
| go-redis/redis/v9 路径变更 | 13 | 改用 `redis/go-redis/v9` |
| pgx/v5@latest 需 Go ≥ 1.25 | 13 | 锁定 `pgx/v5@v5.5.0` |
| buf 未安装 | 14 | `npm install -g @bufbuild/buf` |
| buf lint enum 前缀 | 14 | `SLOT_RANK_*` / `BOOKING_STATUS_*` |
| Docker 未安装 | 5 | 文件已创建，验证延后 |
| MinNoticeHours=0 过滤过去时段 | 15 | 仅 MinNoticeHours > 0 时执行 filterAfter |
| InMemoryStore 仅在 test 文件 | 18 | 提取到 store_memory.go 供 main.go 使用 |

---

## 决策变更

_暂无_
