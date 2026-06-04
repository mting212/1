# MeetFlow 实施计划 — AI 开发者分步指令

> 每步小而具体，必须包含验证测试。聚焦 MVP 基础功能。
>
> 关联文档: `design-document.md` · `tech-stack.md` · `CLAUDE.md`

---

## 目录

- [Phase 0: 开发环境准备](#phase-0-开发环境准备) — 步骤 1–5
- [Phase 1: 数据库 Schema](#phase-1-数据库-schema) — 步骤 6–12
- [Phase 2: Go 调度引擎](#phase-2-go-调度引擎) — 步骤 13–20
- [Phase 3: Next.js 基础框架](#phase-3-nextjs-基础框架) — 步骤 21–28
- [Phase 4: 日历 OAuth 集成](#phase-4-日历-oauth-集成) — 步骤 29–35
- [Phase 5: 预约链接 UI](#phase-5-预约链接-ui) — 步骤 36–45
- [Phase 6: 预约流程端到端](#phase-6-预约流程端到端) — 步骤 46–55
- [Phase 7: MVP 集成验收](#phase-7-mvp-集成验收) — 步骤 56–60

---

## Phase 0: 开发环境准备

### 步骤 1 — 初始化 Git 仓库与 .gitignore

**目标**: 在本项目根目录建立版本控制，排除无关文件。

**具体操作**:
1. 在项目根目录执行 `git init`
2. 创建 `.gitignore` 文件，添加以下忽略规则：
   - `.venv/`（Python 虚拟环境）
   - `node_modules/`
   - `.next/`（Next.js 构建输出）
   - `dist/`、`build/`
   - `.env`、`.env.local`、`.env.*.local`（环境变量文件，含密钥）
   - `*.log`
   - `.DS_Store`
   - `Thumbs.db`
   - `.turbo/`（Turborepo 缓存）
   - `*.tsbuildinfo`
3. 创建 `.env.example` 文件，列出所需环境变量名及空值占位符（不填真实值），包括：
   - `DATABASE_URL`
   - `REDIS_URL`
   - `GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`
   - `OUTLOOK_CLIENT_ID`、`OUTLOOK_CLIENT_SECRET`
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL`
   - `DEEPSEEK_API_KEY`
   - `ZOOM_CLIENT_ID`、`ZOOM_CLIENT_SECRET`
   - `SMTP_HOST`、`SMTP_PORT`、`SMTP_USER`、`SMTP_PASS`
4. 将现有设计文档（`design-document.md`、`tech-stack.md`、`CLAUDE.md`、`implementation-plan.md`）纳入 Git 追踪并提交

**验证测试**:
- 运行 `git status`，确认仅显示项目文件，`.venv/` 和临时文件不在其中
- 确认 `git log` 有且仅有一条提交记录
- 确认 `.env.example` 文件存在且包含 DATABASE_URL、GOOGLE_CLIENT_ID、NEXTAUTH_SECRET 三个必要变量

---

### 步骤 2 — 安装基础工具链

**目标**: 确保 pnpm、Go、Python 三个运行时及其包管理器可用。

**具体操作**:
1. 检查 `pnpm --version`，若无则安装 Node.js LTS 并执行 `corepack enable pnpm`
2. 检查 `go version`，确认版本 ≥ 1.23，若无则安装
3. 检查 `python --version`，确认版本 ≥ 3.12
4. 安装 `uv`（Python 包管理器）：按官方文档安装
5. 全局安装 `turbo`：`pnpm add -g turbo`
6. 全局安装 `lefthook`：按官方文档安装
7. 全局安装 `biome`：按官方文档安装（用于后续 lint/format）

**验证测试**:
- `pnpm --version` 正常输出版本号
- `go version` 输出 ≥ 1.23
- `python --version` 输出 ≥ 3.12
- `uv --version` 正常输出
- `turbo --version` 正常输出
- `lefthook --version` 正常输出
- `biome --version` 正常输出

---

### 步骤 3 — 建立 Monorepo 目录结构

**目标**: 按照 `tech-stack.md` §7.3 的布局创建所有目录（暂不创建代码文件）。

**具体操作**:
1. 在项目根目录创建以下空目录结构：

```
apps/
  web/
  docs/
services/
  scheduler/
  workflow/
  ai/
packages/
  shared-types/
  ui/
  calendar-engine/
  proto/
infra/
  terraform/
  k8s/
scripts/
```

2. 每个目录下放置一个 `.gitkeep` 文件，确保空目录被 Git 追踪
3. 提交此目录结构

**验证测试**:
- 执行 `find . -type d | sort`（或 PowerShell 等效命令），输出清单与上述结构完全一致
- `git log` 有且仅有两次提交（步骤 1 + 步骤 3）

---

### 步骤 4 — 配置 pnpm Workspace 与 Turborepo

**目标**: 让 monorepo 识别所有包，turbo 能够编排任务。

**具体操作**:
1. 在根目录创建 `pnpm-workspace.yaml`，声明 `apps/*` 和 `packages/*` 为 workspace 成员
2. 在根目录创建 `package.json`，设置 `"private": true`，添加 `dev`、`build`、`lint`、`test`、`format`、`db:migrate` 六个基础脚本（脚本内容先调用 `turbo run <script>`）
3. 在根目录创建 `turbo.json`，定义 pipeline：
   - `dev`: 依赖无（并行），不缓存
   - `build`: 依赖 `^build`（先构建依赖包），输出到 `dist/**` 和 `.next/**`
   - `lint`: 依赖无（并行）
   - `test`: 依赖无（并行）
   - `format`: 依赖无（并行）
   - `db:migrate`: 依赖无
4. 在根目录创建 `pnpm-lock.yaml` 占位（执行一次空的 `pnpm install`）
5. 创建 `.npmrc` 文件，设置 `shamefully-hoist=false` 和 `strict-peer-dependencies=true`
6. 提交

**验证测试**:
- `pnpm install` 无报错
- `turbo run lint --dry` 输出 pipeline 计划，无报错
- `turbo run build --dry` 输出 pipeline 计划，显示 `^build` 依赖关系
- 确认 `pnpm-workspace.yaml` 中存在 `apps/*` 和 `packages/*`

---

### 步骤 5 — 配置 Docker Compose 本地开发环境

**目标**: 一键启动 PostgreSQL 和 Redis 的本地实例。

**具体操作**:
1. 在根目录创建 `docker-compose.yml`
2. 定义两个 service：
   - `postgres`: 镜像 `postgres:16-alpine`，端口映射 `5432:5432`，设置 `POSTGRES_USER=meetflow`、`POSTGRES_PASSWORD=meetflow_dev`、`POSTGRES_DB=meetflow`，挂载 volume `pgdata:/var/lib/postgresql/data`，添加健康检查 `pg_isready -U meetflow`
   - `redis`: 镜像 `redis:7-alpine`，端口映射 `6379:6379`，添加健康检查 `redis-cli ping`
3. 创建 `.env` 文件（注意已在 `.gitignore` 中），填入 `DATABASE_URL=postgresql://meetflow:meetflow_dev@localhost:5432/meetflow` 和 `REDIS_URL=redis://localhost:6379`
4. 提交 `docker-compose.yml`（不提交 `.env`）

**验证测试**:
- 执行 `docker compose up -d`，两个容器均启动
- 执行 `docker compose ps`，两个容器状态为 `healthy`
- 执行 `docker compose down`，容器停止并清理
- 执行 `docker compose up -d` 再次启动，确认 volume 持久化数据不丢失
- 确认 `.env` 文件不在 `git status` 中

---

## Phase 1: 数据库 Schema

### 步骤 6 — 初始化 Drizzle 与创建数据库连接

**目标**: 在 `packages/shared-types` 中搭建 Drizzle ORM 基础设施。

**具体操作**:
1. 在 `packages/shared-types/` 下创建 `package.json`，包名设为 `@meetflow/shared-types`，版本 `0.0.1`
2. 添加依赖：`drizzle-orm`、`drizzle-kit`（dev）、`pg`（`node-postgres`）、`dotenv`
3. 创建 `packages/shared-types/src/db/` 目录
4. 在该目录下创建 `connection.ts`：从环境变量 `DATABASE_URL` 读取连接字符串，创建并导出 PostgreSQL 连接池（最大连接数 20，空闲超时 30 秒）
5. 在根目录创建 `drizzle.config.ts`，指向 `packages/shared-types/src/db/schema/` 为 schema 目录，`packages/shared-types/src/db/migrations/` 为迁移输出目录
6. 将根 `package.json` 的 `db:migrate` 脚本绑定为 `drizzle-kit generate`；添加 `db:push` 脚本为 `drizzle-kit push`
7. 执行 `pnpm install`

**验证测试**:
- `pnpm install` 成功，无依赖解析错误
- `tsc --noEmit` 在 `packages/shared-types` 目录下通过（需先创建最小 tsconfig）
- `turbo run db:migrate --dry` 显示该任务可执行
- 能够从 `connection.ts` 导入连接对象而不抛出运行时错误（数据库未启动时应在实际连接时才报错，导入时不报错）

---

### 步骤 7 — 创建 Users 与 CalendarAccount 表 Schema

**目标**: 在 Drizzle 中定义用户和日历账户两张表的 schema 并生成迁移。

**具体操作**:
1. 在 `packages/shared-types/src/db/schema/` 下创建 `users.ts`
2. 定义 `users` 表，字段严格参照 `design-document.md` §6.2：
   - `id`: UUID 主键，默认值 `gen_random_uuid()`
   - `email`: `varchar(255)`，唯一，非空
   - `name`: `varchar(255)`，非空
   - `timezone`: `varchar(64)`，默认 `'Asia/Shanghai'`
   - `avatar_url`: `text`，可空
   - `created_at`: `timestamptz`，默认 `now()`
3. 在同一目录创建 `calendar_accounts.ts`
4. 定义 `calendar_accounts` 表，字段参照设计文档：
   - `id`: UUID 主键
   - `user_id`: UUID，外键 → `users.id`
   - `provider`: `varchar(32)`，非空（约束值只能在 `'google'`、`'outlook'`、`'icloud'` 中）
   - `access_token`: `text`，可空
   - `refresh_token`: `text`，可空
   - `calendar_id`: `varchar(255)`，可空
   - `sync_enabled`: `boolean`，默认 `true`
   - `last_synced_at`: `timestamptz`，可空
5. 创建 `index.ts`，导出所有 table 定义
6. 运行 `pnpm db:migrate` 生成迁移 SQL 文件

**验证测试**:
- 迁移 SQL 文件生成在 `migrations/` 目录下
- SQL 文件中包含 `CREATE TABLE users` 和 `CREATE TABLE calendar_accounts` 语句
- `calendar_accounts` 的 `user_id` 有 REFERENCES `users(id)` 外键
- `users.email` 有 UNIQUE 约束
- `calendar_accounts.provider` 有 CHECK 约束限制为三个值之一

---

### 步骤 8 — 创建 ScheduleLink 与 AvailabilityRule 表 Schema

**目标**: 定义预约链接和可用性规则两张表。

**具体操作**:
1. 创建 `packages/shared-types/src/db/schema/schedule_links.ts`
2. 定义 `schedule_links` 表：
   - `id`: UUID 主键
   - `user_id`: UUID，外键 → `users.id`
   - `slug`: `varchar(100)`，唯一，非空
   - `name`: `varchar(255)`，非空
   - `description`: `text`，可空
   - `duration_minutes`: `integer`，非空，默认 30
   - `custom_domain`: `varchar(255)`，可空
   - `branding`: `jsonb`，默认 `'{}'`
   - `is_active`: `boolean`，默认 `true`
   - `meeting_provider`: `varchar(32)`，默认 `'zoom'`
   - `created_at`: `timestamptz`，默认 `now()`
3. 创建 `availability_rules.ts`
4. 定义 `availability_rules` 表：
   - `id`: UUID 主键
   - `user_id`: UUID，外键 → `users.id`
   - `schedule_link_id`: UUID，外键 → `schedule_links.id`，可空（NULL 表示全局规则）
   - `day_of_week`: `smallint`，非空（0=Sun，6=Sat，添加 CHECK 约束 0-6）
   - `start_time`: `time`，非空
   - `end_time`: `time`，非空
   - 添加 CHECK 约束确保 `end_time > start_time`
5. 更新 `index.ts` 导出新表
6. 运行 `pnpm db:migrate`

**验证测试**:
- 迁移文件包含四张表的建表语句
- `schedule_links.slug` 有 UNIQUE 约束
- `availability_rules` 有 `day_of_week BETWEEN 0 AND 6` 的 CHECK
- `availability_rules` 有 `end_time > start_time` 的 CHECK
- `schedule_links.user_id` 有 REFERENCES 外键

---

### 步骤 9 — 创建 Booking 表 Schema（含排他约束）

**目标**: 定义预订表，这是整个系统的核心表。必须以 PostgreSQL 排他约束防双订。

**具体操作**:
1. 创建 `packages/shared-types/src/db/schema/bookings.ts`
2. 定义 `bookings` 表：
   - `id`: UUID 主键
   - `schedule_link_id`: UUID，外键 → `schedule_links.id`
   - `organizer_id`: UUID，外键 → `users.id`
   - `start_time`: `timestamptz`，非空
   - `end_time`: `timestamptz`，非空
   - `status`: `varchar(32)`，默认 `'confirmed'`（约束值：`'confirmed'`、`'cancelled'`、`'rescheduled'`）
   - `attendee_name`: `varchar(255)`，非空
   - `attendee_email`: `varchar(255)`，非空
   - `attendee_timezone`: `varchar(64)`，可空
   - `notes`: `text`，可空
   - `meeting_url`: `text`，可空
   - `calendar_event_id`: `varchar(255)`，可空
   - `created_at`: `timestamptz`，默认 `now()`
3. 在迁移中必须添加排他约束：
   - 使用 GIST 索引，条件为 `schedule_link_id WITH =` 和 `tsrange(start_time, end_time) WITH &&`
   - 仅当 `status != 'cancelled'` 时生效
4. 更新 `index.ts`
5. 运行 `pnpm db:migrate`

**验证测试**:
- 迁移 SQL 包含 `CREATE EXTENSION IF NOT EXISTS btree_gist`（GIST 需要此扩展）
- 迁移 SQL 包含 `EXCLUDE USING GIST` 语句
- 排他约束中 `tsrange(start_time, end_time) WITH &&` 正确出现
- 排他约束中 WHERE 条件为 `(status != 'cancelled')`

---

### 步骤 10 — 创建 ScheduleRules 表（缓冲与限制）

**目标**: 定义预约链接的缓冲时间、数量限制等策略规则表。

**具体操作**:
1. 创建 `packages/shared-types/src/db/schema/schedule_rules.ts`
2. 定义 `schedule_rules` 表：
   - `id`: UUID 主键
   - `schedule_link_id`: UUID，外键 → `schedule_links.id`，非空
   - `rule_type`: `varchar(32)`，非空（约束值：`'buffer_before'`、`'buffer_after'`、`'daily_limit'`、`'weekly_limit'`、`'monthly_limit'`、`'min_notice_hours'`、`'max_future_days'`）
   - `rule_value`: `integer`，非空（缓冲为分钟数，限制为次数，通知为小时数，未来天数为天数）
3. 更新 `index.ts`
4. 运行 `pnpm db:migrate`

**验证测试**:
- 迁移文件包含 `schedule_rules` 建表语句
- `rule_type` 有 CHECK 约束限制为 7 种值
- `schedule_link_id` 有 REFERENCES 外键
- `rule_value` 有 CHECK 约束确保值 > 0

---

### 步骤 11 — 编写数据库 Seed 脚本

**目标**: 创建种子数据脚本，用于本地开发和测试。

**具体操作**:
1. 在 `packages/shared-types/src/db/` 下创建 `seed.ts`
2. 脚本功能（不写具体代码，只描述逻辑）：
   - 接受 `--clean` 参数时，先按外键依赖逆序 TRUNCATE 全部表
   - 创建 1 个测试用户（email: `test@meetflow.dev`, name: `Test User`, timezone: `Asia/Shanghai`）
   - 为该用户创建 1 个预约链接（slug: `test/30min`, name: `30 Minute Meeting`, duration_minutes: 30）
   - 为该预约链接创建 5 条周一至周五的可用时段规则（9:00-17:00）
   - 为该预约链接创建 2 条默认规则（buffer_before=15, buffer_after=10）
3. 在 `packages/shared-types/package.json` 中添加 `seed` 脚本调用此文件
4. 执行 seed 脚本

**验证测试**:
- 执行 `pnpm --filter @meetflow/shared-types run seed`（或等效命令）
- 直接查询 PostgreSQL：`SELECT * FROM users WHERE email='test@meetflow.dev'` 返回 1 行
- `SELECT * FROM availability_rules WHERE user_id = '<test-user-uuid>'` 返回 5 行
- `SELECT * FROM schedule_rules WHERE schedule_link_id = '<test-link-uuid>'` 返回 最少 2 行
- 执行 `--clean` 参数后再次 seed，数据 ID 变化但行数一致（无重复）

---

### 步骤 12 — 创建数据库测试辅助工具

**目标**: 搭建测试专用的数据库创建/清理工具，后续所有集成测试依赖此工具。

**具体操作**:
1. 在 `packages/shared-types/src/db/` 下创建 `test-utils.ts`
2. 实现三个导出函数：
   - `createTestDatabase()`: 创建独立的测试用 PostgreSQL 数据库（命名 `meetflow_test`），运行所有迁移
   - `seedTestData()`: 调用步骤 11 的 seed 逻辑
   - `dropTestDatabase()`: 断开所有连接后删除测试数据库
3. 在 `drizzle.config.ts` 同级创建 `drizzle.test.config.ts`，指向测试数据库
4. 更新根 `package.json`，添加 `test:db:setup` 和 `test:db:teardown` 脚本

**验证测试**:
- 手动执行 `pnpm test:db:setup`，确认 `meetflow_test` 数据库被创建且包含全部表
- 查询 `information_schema.tables`，确认所有 5 张表存在
- 查询 `pg_constraint`，确认排他约束存在
- 执行 `pnpm test:db:teardown`，确认测试数据库被删除
- 再次执行 `pnpm test:db:setup`，确认可以重复创建（幂等性）

---

## Phase 2: Go 调度引擎

### 步骤 13 — 初始化 Go 模块与项目结构

**目标**: 在 `services/scheduler/` 下建立 Go 模块和基础目录结构。

**具体操作**:
1. 在 `services/scheduler/` 下执行 `go mod init github.com/meetflow/scheduler`
2. 创建目录结构：
   - `cmd/scheduler/`（入口）
   - `internal/availability/`（可用性计算）
   - `internal/booking/`（预约事务）
   - `internal/sync/`（日历同步适配器）
   - `pkg/`（可复用工具）
   - `proto/`（gRPC 定义）
3. 安装核心依赖：
   - `google.golang.org/grpc`
   - `github.com/jackc/pgx/v5`
   - `github.com/go-redis/redis/v9`
   - `github.com/rs/zerolog`
   - `github.com/teambition/rrule-go`
4. 创建 `.env` 文件模板（仅用于本地开发，不提交）
5. 创建 `Makefile`，定义 target：`build`、`test`、`lint`、`run`
6. 提交

**验证测试**:
- `go mod tidy` 无报错
- `go build ./...` 所有包编译通过（即使空包）
- `make build` 返回成功
- `go vet ./...` 无警告

---

### 步骤 14 — 定义 Protobuf 接口

**目标**: 用 protobuf 定义调度引擎对外的 gRPC 接口契约。

**具体操作**:
1. 在 `packages/proto/scheduler/v1/` 下创建 `scheduler.proto`
2. 定义 `SchedulerService`，包含三个 RPC：

   **RPC 1 — GetAvailability**:
   - Request: `schedule_link_id`（string）、`window_start`（RFC3339 string）、`window_end`（RFC3339 string）、`invitee_timezone`（string）、`invitee_calendar_events`（可选的 repeated CalendarEvent，用于叠加显示）
   - Response: `repeated TimeSlot`，每个 TimeSlot 包含 `start_time`（RFC3339 string）、`end_time`（RFC3339 string）、`rank`（enum: PREFERRED / AVAILABLE）

   **RPC 2 — CreateBooking**:
   - Request: `schedule_link_id`（string）、`start_time`（RFC3339 string）、`end_time`（RFC3339 string）、`attendee_name`（string）、`attendee_email`（string）、`attendee_timezone`（string）、`notes`（optional string）
   - Response: `booking_id`（string）、`status`（enum）、`meeting_url`（optional string）

   **RPC 3 — CancelBooking**:
   - Request: `booking_id`（string）
   - Response: `success`（bool）、`message`（string）

3. 定义共用 message：`CalendarEvent`（含 `start`、`end`、`summary`）、`TimeSlot`（含 `start`、`end`、`rank`）
4. 创建 buf 配置文件 `buf.yaml` 和 `buf.gen.yaml`，生成 Go 代码到 `services/scheduler/proto/gen/`
5. 在 `packages/proto/` 下也生成 TypeScript 端的 gRPC 存根

**验证测试**:
- `buf lint` 无错误
- `buf generate` 成功生成 Go 代码（`.pb.go` 和 `_grpc.pb.go` 文件）
- TypeScript 端也生成对应类型文件
- 生成的 Go 代码可通过 `go build` 编译

---

### 步骤 15 — 实现可用性计算引擎（纯逻辑，无网络/数据库）

**目标**: 在 Go 中实现核心的可用性计算函数，输入约束规则和已占用时段，输出可用时段列表。

**具体操作**:
1. 在 `internal/availability/` 下创建 `engine.go`
2. 实现一个纯函数 `CalculateAvailability`，接收以下输入参数：
   - `availabilityRules`: 每周重复规则列表（每条规则含 day_of_week、start_time、end_time）
   - `busySlots`: 已占用的时段列表（从日历事件和已有预订合并得到）
   - `windowStart` / `windowEnd`: 查询时间窗口（UTC）
   - `bufferBeforeMinutes` / `bufferAfterMinutes`: 缓冲时间
   - `dailyLimit` / `weeklyLimit`: 数量上限（超出后返回空或截断）
   - `minNoticeHours`: 最短提前期
   - `existingBookingCounts`: 当日/当周已有预订计数
3. 函数内部逻辑流程：
   - a. 按 RRULE 规则展开时间窗口内所有"理论可用"时段
   - b. 从中扣除已占用时段（busySlots），处理部分重叠
   - c. 应用缓冲时间（每个真实预约前后扩展锁定）
   - d. 从结果中移除短于 `minNoticeHours` 内的时段
   - e. 按日/周上限截断时段
   - f. 将结果按周视图分组返回
4. 在 `internal/availability/engine_test.go` 中编写单元测试

**验证测试**（至少覆盖以下场景，每个场景一个测试函数）:
- **空日历全可用**: 给定 9:00-17:00 周一至周五规则，无占用，窗口覆盖整周 → 返回 5 天每天 8 小时的理论时段
- **单占用扣减**: 在周三 10:00-11:00 有一个占用 → 周三返回的时段在该区间断开
- **缓冲时间**: 配置 buffer_before=15min、buffer_after=10min，放置一个 10:00 预约 → 9:45-10:00 和 10:00-10:10 两段从可用中消失
- **最低提前期**: 配置 min_notice_hours=2，窗口起始为 now+1hour → 返回的空时段起始时间全部 ≥ now+2hours
- **日上限**: 配置 daily_limit=3，已有 3 个预订 → 当日返回空
- **周上限**: 配置 weekly_limit=10，已有 10 个预订 → 整周返回空
- **无规则日**: 仅有周一至周三规则 → 周四、周五返回空
- **时区转换**: 规则定义在 Asia/Shanghai，窗口以 UTC 传入 → 返回的时段在 DST 和非 DST 边界处偏移正确

---

### 步骤 16 — 实现时段排序引擎

**目标**: 对可用时段进行排名，输出"首选时段"和"一般时段"两级。

**具体操作**:
1. 在 `internal/availability/` 下创建 `ranking.go`
2. 实现函数 `RankTimeSlots`，输入：
   - `slots`: 步骤 15 产出的未排序时段列表
   - `preferredTimeRanges`: 组织者标记的首选时段（如"每天 10:00-12:00 为第一优先"）
   - `goal`: 排序目标（`cluster`—聚集模式，或 `spread`—分散模式）
3. 排序逻辑：
   - cluster 模式：优先选已有预订附近的时间，减少碎片
   - spread 模式：优先选与其他时段间隔最大的时间
   - 与首选时段重叠的时段 rank=PREFERRED，其余 rank=AVAILABLE
4. 在 `internal/availability/ranking_test.go` 中编写测试

**验证测试**:
- 输入全为普通时段且无 preferredTimeRanges → 全部 rank=AVAILABLE
- 10:00-11:00 标记为首选 → 该时段 rank=PREFERRED，其余不变
- cluster 模式 + 已有 10:00 预订 → 9:30 和 10:30 时段排在 15:00 前面
- 空列表输入 → 返回空列表，不 panic

---

### 步骤 17 — 实现冲突检测与两阶段锁

**目标**: 实现预约提交时的冲突检测逻辑。

**具体操作**:
1. 在 `internal/booking/` 下创建 `conflict.go`
2. 实现 `CheckConflict` 函数，接收参数：
   - `scheduleLinkID`: 预约链接 ID
   - `startTime` / `endTime`: 候选时段（UTC）
   - `db`: 数据库连接
3. 函数内部：
   - 使用 PostgreSQL 的 `tsrange` 重叠操作符 `&&` 查询 `bookings` 表中 `status != 'cancelled'` 且与候选时段重叠的记录
   - 如果有任何记录，返回冲突详情（冲突时间、冲突预订 ID）
   - 如果无记录，返回无冲突
4. 在 `internal/booking/` 下创建 `service.go`
5. 实现 `CreateBooking` 函数，执行两阶段锁：
   - 阶段 1：从 Redis 缓存读取预计算的可用时段，粗略判断是否可用（允许短暂不一致）
   - 阶段 2：开启数据库事务（隔离级别 SERIALIZABLE），执行 `SELECT ... FOR UPDATE` 锁定相关行，调用 `CheckConflict` 二次确认，无冲突则 INSERT，COMMIT
   - 冲突时回滚事务并返回冲突错误（含具体冲突预订 ID）
6. 在 `internal/booking/service_test.go` 中编写测试

**验证测试**:
- 无冲突场景：时段完全空闲 → `CheckConflict` 返回无冲突，`CreateBooking` 成功创建预订
- 精确重叠：已有 10:00-10:30 预订，尝试创建 10:00-10:30 → 冲突
- 部分重叠（前）：已有 10:00-10:30，尝试 10:15-10:45 → 冲突
- 部分重叠（后）：已有 10:00-10:30，尝试 9:45-10:15 → 冲突
- 包含关系：已有 10:00-11:00，尝试 10:15-10:45 → 冲突
- 边界接触不冲突：已有 10:00-10:30，尝试 10:30-11:00 → 不冲突（`&&` 操作符边界不相交）
- 已取消预订不冲突：已有 10:00-10:30 status=cancelled，尝试 10:00-10:30 → 不冲突
- **并发安全测试（关键）**：启动 10 个 goroutine 同时用相同参数调用 `CreateBooking` → 仅 1 个成功，其余 9 个返回冲突错误
- **并发安全测试（排他约束兜底）**：移除应用层锁，仅靠数据库排他约束 → 同样只有 1 条记录写入成功

---

### 步骤 18 — 实现 gRPC 服务端

**目标**: 将步骤 15-17 的纯逻辑封装为 gRPC 服务。

**具体操作**:
1. 在 `services/scheduler/cmd/scheduler/` 下创建 `main.go`
2. 实现 gRPC 服务器的启动逻辑：
   - 监听端口 `:9090`
   - 注册 `SchedulerService` 服务
   - 添加请求日志和 panic recovery 中间件
   - 优雅关闭（SIGINT/SIGTERM 信号处理，最多等待 30 秒）
3. 在 `internal/` 下创建 gRPC handler，将三个 RPC 方法连接到 `availability` 和 `booking` 包的函数
4. gRPC handler 负责：
   - 将 protobuf 消息转换为内部类型
   - 调用核心逻辑函数
   - 将结果转换回 protobuf 消息
   - 错误映射（冲突错误 → gRPC `AlreadyExists`，参数错误 → `InvalidArgument`）
5. 创建 `internal/middleware/logging.go`：记录每个 RPC 调用的方法名、耗时、状态
6. 更新 Makefile，添加 `run` target 启动服务

**验证测试**:
- 启动服务器，使用 `grpcurl` 列出服务：`grpcurl -plaintext localhost:9090 list` 输出 `scheduler.v1.SchedulerService`
- `grpcurl -plaintext localhost:9090 describe scheduler.v1.SchedulerService` 显示三个方法
- 调用 `GetAvailability`（需数据库有 seed 数据），返回非空时段列表
- 调用 `CreateBooking` 成功创建预约
- 用相同参数再次调用 `CreateBooking`，返回 `AlreadyExists` 错误
- 发送 SIGTERM，服务器在 30 秒内优雅停止（日志中有 shutdown 记录）

---

### 步骤 19 — 编写 Go 调度引擎集成测试

**目标**: 用真实 PostgreSQL（测试库）验证调度引擎端到端。

**具体操作**:
1. 在 `services/scheduler/` 下创建 `test/integration/` 目录
2. 编写集成测试文件 `scheduler_integration_test.go`
3. 测试函数：
   - `TestGetAvailability_WithSeedData`: 用 seed 数据调用 GetAvailability，验证返回 5 天 * 约 8 小时的时段
   - `TestCreateBooking_FullFlow`: 创建预约 → 再次 GetAvailability 确认该时段已不可用
   - `TestCreateBooking_Concurrent`: 用 20 个 goroutine 同时预约同一个时段，确认只有 1 个成功
   - `TestCancelBooking_ReleasesSlot`: 创建 → 取消 → GetAvailability 确认时段恢复
4. 使用 `testcontainers-go` 库在测试中自动启动 PostgreSQL 容器（无需预配数据库）
5. 每个测试函数独立：setup 创建 schema + seed → 执行测试 → teardown 删除数据

**验证测试**（这些测试自身就是验证）:
- 全部测试通过（`go test ./test/integration/... -v`）
- 无测试间数据泄漏（改变执行顺序结果不变）
- `-race` flag 下无 data race 报告
- 集成测试耗时 < 30 秒

---

### 步骤 20 — 添加 Redis 可用时段缓存

**目标**: 用 Redis 缓存预计算的可用时段，减少 GetAvailability 重复计算。

**具体操作**:
1. 在 `pkg/` 下创建 `cache/redis.go`
2. 实现 `AvailabilityCache` 结构体，提供三个方法：
   - `Get(ctx, scheduleLinkID, windowStart, windowEnd)` → 返回缓存的时段列表（JSON 反序列化），缓存未命中返回 nil
   - `Set(ctx, scheduleLinkID, windowStart, windowEnd, slots, ttl)` → 写入缓存，TTL 默认 5 分钟
   - `Invalidate(ctx, scheduleLinkID)` → 该链路有预订变更时，清除相关所有缓存
3. 在 `GetAvailability` gRPC handler 中集成缓存：
   - 先查 Redis 缓存，命中直接返回
   - 未命中则计算，计算结果写入 Redis 后返回
4. 在 `CreateBooking` 和 `CancelBooking` 成功后调用 `Invalidate`

**验证测试**:
- 首次 `GetAvailability` 从 DB 计算（验证日志中有"cache miss"记录）
- 第二次相同参数 `GetAvailability` 从 Redis 命中（验证日志中有"cache hit"）
- `CreateBooking` 后再次 `GetAvailability`，缓存已失效，重新计算
- Redis 不可用时（关闭 Redis），服务仍正常返回（降级到直接计算，不报错）
- TTL 过期后（等待 5 分钟或手动修改 TTL 为 2 秒），缓存重新计算

---

## Phase 3: Next.js 基础框架

### 步骤 21 — 初始化 Next.js 应用

**目标**: 在 `apps/web/` 下创建 Next.js 15 项目。

**具体操作**:
1. 在 `apps/web/` 下执行 `pnpm create next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"`（或等效的 `create-next-app` 命令）
2. 创建 `apps/web/package.json`，包名设为 `@meetflow/web`
3. 安装额外依赖：
   - `@t3-oss/env-nextjs`（环境变量校验）
   - `next-auth@beta`（Auth.js v5）
   - `@meetflow/shared-types`（workspace 内部依赖，用 `workspace:*` 协议）
   - `@meetflow/ui`（workspace 内部依赖）
   - `zod`、`zustand`、`date-fns`、`date-fns-tz`
   - `@tanstack/react-query`
4. 在 `tsconfig.json` 中启用 `strict: true`、`noUncheckedIndexedAccess: true`、`exactOptionalPropertyTypes: true`
5. 创建 `apps/web/.env.local`（不提交），填入必要环境变量
6. 在 `apps/web/next.config.ts` 中配置 images（允许组织者 avatar 和 logo 的远程来源）、配置 `transpilePackages` 包含内部 workspace 包

**验证测试**:
- `pnpm install` 成功
- `pnpm --filter @meetflow/web run dev` 启动 Next.js 开发服务器
- 浏览器访问 `http://localhost:3000` 显示 Next.js 默认页面
- `tsc --noEmit` 无错误
- 确认 `next.config.ts` 已配置 `transpilePackages`

---

### 步骤 22 — 搭建 shadcn/ui 组件库包

**目标**: 在 `packages/ui/` 下初始化共享 UI 组件库。

**具体操作**:
1. 在 `packages/ui/` 下创建 `package.json`，包名 `@meetflow/ui`，版本 `0.0.1`
2. 使用 `pnpm dlx shadcn@latest init` 在 `packages/ui/` 中初始化（选择 TypeScript、Tailwind CSS、CSS variables for theming、不生成 components.json 在根目录）
3. 安装以下 shadcn/ui 组件（通过 `pnpm dlx shadcn@latest add`）：
   - `button`、`input`、`label`、`form`（基础表单）
   - `card`、`dialog`、`dropdown-menu`、`avatar`（布局与展示）
   - `toast`、`sonner`（通知提示）
   - `select`、`switch`、`checkbox`（表单控件）
   - `tabs`、`separator`、`badge`（导航与标识）
4. 创建 `packages/ui/src/index.ts`，统一导出所有组件
5. 配置 Tailwind CSS 变量：在 `globals.css` 中定义亮/暗模式的 CSS 变量，预留品牌色覆盖入口（`--brand-primary`、`--brand-secondary` 等）

**验证测试**:
- 所有 shadcn 组件文件生成在 `packages/ui/src/components/ui/` 下
- `packages/ui/src/index.ts` 导出至少 Button、Input、Card 三个组件
- 在 `apps/web` 中 `import { Button } from '@meetflow/ui'` 成功
- 浏览器中渲染一个 `<Button>Test</Button>` 组件，样式正确

---

### 步骤 23 — 创建共享类型包的基础结构

**目标**: 将数据库 schema 导出的 Drizzle 类型和 Zod 校验 schema 统一在 `@meetflow/shared-types` 中。

**具体操作**:
1. 在 `packages/shared-types/src/` 下创建 `validators/` 目录
2. 创建以下 Zod schema 文件（不写具体代码，只描述功能）：
   - `user.ts`: 用户注册/更新校验（email 格式、name 非空且 2-100 字符、timezone 必须在 IANA 列表中）
   - `scheduling.ts`: 预约链接创建/更新校验（name 非空、duration_minutes 为 15/30/45/60 之一、slug 仅含小写字母数字和连字符）
   - `booking.ts`: 预约提交校验（attendee_name 非空、attendee_email 有效格式、start/end 为有效 ISO8601 且 end > start）
   - `availability.ts`: 可用时段规则校验（day_of_week 0-6、start_time < end_time）
3. 从 Drizzle schema 导出 TypeScript 类型（`SelectUser`、`InsertUser`、`SelectBooking`、`InsertBooking` 等）
4. 更新 `packages/shared-types/src/index.ts`，统一导出所有类型和校验器

**验证测试**:
- `user.ts` 的 Zod schema 拒绝无效 email（`"notanemail"` 抛出 ZodError）
- `scheduling.ts` 的 Zod schema 拒绝 duration_minutes=10（不在允许值内）
- `booking.ts` 的 Zod schema 拒绝 end_time 早于 start_time 的预订
- `availability.ts` 的 Zod schema 拒绝 day_of_week=7
- TypeScript 类型导入检查：`import type { SelectUser } from '@meetflow/shared-types'` 无错误

---

### 步骤 24 — 配置 NextAuth.js 认证系统

**目标**: 在 Next.js 中集成本地凭据登录和 OAuth 基础架构。

**具体操作**:
1. 在 `apps/web/src/` 下创建 `auth.ts`（NextAuth.js v5 配置）
2. 配置 auth provider：
   - `CredentialsProvider`: 邮箱 + 密码登录（MVP 阶段先用 bcrypt 哈希 + JWT session）
   - 预留 `GoogleProvider` 和 `AzureADProvider` 的配置入口（注释掉，Phase 4 启用）
3. 配置 JWT session strategy，token 中包含 `userId` 和 `timezone`
4. 创建 `apps/web/src/middleware.ts`：
   - 从 `auth.ts` 导出 `auth` 作为 middleware
   - 配置路由匹配规则：`/app/:path*` 需要登录，公开路由（`/[domain]`）不需要
5. 创建 `apps/web/src/app/api/auth/[...nextauth]/route.ts` 导出 handler
6. 在 `apps/web/.env.local` 中设置 `AUTH_SECRET`（执行 `npx auth secret` 生成）

**验证测试**:
- 启动开发服务器，访问 `/app/dashboard` → 重定向到登录页
- 访问 `http://localhost:3000/test-user/30min`（公开预约页）→ 不重定向，直接显示（即使页面内容为空）
- 创建测试用户（通过 seed 脚本或 API）后使用邮箱密码登录成功
- 登录后访问 `/app/dashboard` → 不重定向，正常显示
- 检查浏览器 cookie 中有 `authjs.session-token`

---

### 步骤 25 — 创建 tRPC 基础架构

**目标**: 在 Next.js 中搭建 tRPC，连接前端和 BFF 层。

**具体操作**:
1. 在 `apps/web/src/` 下创建 `server/` 目录
2. 安装 tRPC 依赖：`@trpc/server`、`@trpc/client`、`@trpc/react-query`、`@trpc/next`、`superjson`
3. 创建 tRPC 初始化文件 `server/trpc.ts`：
   - 定义 context：从 NextAuth session 提取 `userId` 和 `timezone`
   - 启用 `superjson` transformer
   - 导出 `router`、`publicProcedure`、`protectedProcedure`（需认证）
4. 创建 `server/routers/` 目录，创建占位 router `server/routers/index.ts`：
   - 包含一个 `health` query（public procedure），返回 `{ status: "ok", timestamp: new Date() }`
5. 创建 `apps/web/src/app/api/trpc/[trpc]/route.ts`，挂载 tRPC handler
6. 创建 `apps/web/src/trpc/` 目录，创建前端 client 和 React Query provider
7. 在 root layout 中包裹 `TRPCProvider`

**验证测试**:
- `pnpm --filter @meetflow/web run dev` 启动无报错
- 使用 tRPC playground（或 curl）调用 `health` query → 返回 `{ status: "ok" }`
- TypeScript 编译通过：`import { api } from '@/trpc/react'` 无类型错误
- `api.health.useQuery()` 在前端组件中正常调用并返回数据

---

### 步骤 26 — 创建认证相关 tRPC Router

**目标**: 实现用户注册和登录的 tRPC 接口。

**具体操作**:
1. 在 `server/routers/` 下创建 `auth.ts`
2. 定义两个 procedure：
   - `register`: public procedure，接收 email + password + name + timezone（使用步骤 23 的 Zod schema），创建用户并返回 session（bcrypt 哈希密码，密码最小 8 位）
   - `getMe`: protected procedure，返回当前登录用户的 profile（id、email、name、timezone、avatar_url）
   - `updateProfile`: protected procedure，允许更新 name、timezone、avatar_url
3. 注册到 root router
4. 在前端创建 `src/app/(auth)/register/page.tsx` 注册页面

**验证测试**:
- 通过 tRPC 调用 `register`，传入有效数据 → 返回 session token，数据库 users 表新增一行
- 重复 email 注册 → 返回错误（email already exists）
- 密码长度 < 8 → 返回 Zod 校验错误
- `getMe` 在已登录状态下返回用户信息
- `getMe` 在未登录状态下返回 401 错误

---

### 步骤 27 — 创建预约链接管理 tRPC Router

**目标**: 实现预约链接的 CRUD 接口。

**具体操作**:
1. 在 `server/routers/` 下创建 `schedule-links.ts`
2. 定义 procedure：
   - `create`: protected，输入 name + duration_minutes（slug 自动生成：从 name 转小写 + 空格替换为连字符 + 随机 4 位后缀），创建 schedule_link
   - `list`: protected，返回当前用户的所有预约链接（含预约数量统计）
   - `getBySlug`: public（公开页面用），按 slug 查询单个链接详情（含组织者名称和品牌配置）
   - `update`: protected，更新 name、description、duration_minutes、branding
   - `delete`: protected，软删除（设置 is_active=false）
3. 注册到 root router

**验证测试**:
- 创建预约链接 → 返回包含 slug 的记录，数据库中 schedule_links 表有新行
- 创建相同 name 的链接两次 → slug 不同（随机后缀生效）
- `getBySlug` 传入有效 slug → 返回链接信息，包含 organizer name
- `getBySlug` 传入不存在的 slug → 返回 404
- `delete` 后 → `list` 不再包含该链接，但数据库记录仍存在（is_active=false）
- `getBySlug` 查询 is_active=false 的链接 → 返回 404

---

### 步骤 28 — 创建可用时段管理 tRPC Router

**目标**: 实现可用时段规则和缓冲策略的 CRUD 接口。

**具体操作**:
1. 在 `server/routers/` 下创建 `availability.ts`
2. 定义 procedure：
   - `setRules`: protected，接收 schedule_link_id + rules 数组（每条含 day_of_week、start_time、end_time），先删除该链接旧规则再批量插入新规则
   - `getRules`: protected，按 schedule_link_id 查询所有可用时段规则
   - `setScheduleRule`: protected，设置单条 schedule_rule（buffer/daily_limit 等），upsert 逻辑（按 schedule_link_id + rule_type 唯一）
   - `getScheduleRules`: protected，查询某链接的所有 schedule_rules
   - `getAvailability`: public，接收 schedule_link_id + window_start + window_end，代理调用 Go 调度引擎的 gRPC GetAvailability
3. 注册到 root router

**验证测试**:
- `setRules` 写入周一至周五 9:00-17:00 → 数据库有 5 行
- 再次 `setRules` 写入周一至周三 10:00-15:00 → 旧 5 行删除，新 3 行写入（共 3 行）
- `setScheduleRule` 设置 buffer_before=15 → upsert 成功
- 再次设置 buffer_before=20 → 同一条记录更新而非新增
- `getAvailability` 调用成功，返回时段列表（依赖 Go 引擎已运行）

---

## Phase 4: 日历 OAuth 集成

### 步骤 29 — 配置 Google Cloud Console OAuth 应用

**目标**: 在 Google Cloud Console 中创建 OAuth 2.0 客户端，获取凭据。

**具体操作**:
1. 前往 Google Cloud Console，创建新项目或选择现有项目
2. 启用 Google Calendar API
3. 在 OAuth consent screen 中配置：
   - 应用名称：MeetFlow（或开发用名称）
   - 授权域：`auth.meetflow.dev`（或本地 `localhost`）
   - 范围：`https://www.googleapis.com/auth/calendar.events`（读写日历事件）、`https://www.googleapis.com/auth/calendar.readonly`（只读）、`openid`、`profile`、`email`
4. 创建 OAuth 2.0 Client ID（Web application 类型）
5. 添加 Authorized redirect URIs：
   - `http://localhost:3000/api/auth/callback/google`（本地开发）
   - 生产地址后续追加
6. 将 `GOOGLE_CLIENT_ID` 和 `GOOGLE_CLIENT_SECRET` 写入 `apps/web/.env.local`

**验证测试**:
- 使用 Google OAuth 2.0 Playground 或手动构造授权 URL 进行授权流程
- 授权后能获取到 access_token 和 refresh_token
- 使用获取的 token 调用 Google Calendar API `events.list` 测试端点 → 返回事件列表
- 确认 redirect URI 与代码中配置的一致

---

### 步骤 30 — 配置 Microsoft Entra ID (Azure AD) OAuth 应用

**目标**: 获取 Outlook / Microsoft 365 日历的 OAuth 凭据。

**具体操作**:
1. 前往 Azure Portal → Microsoft Entra ID（原 Azure AD）→ App registrations → New registration
2. 配置应用：
   - 名称：MeetFlow
   - 支持的账户类型：任何组织目录中的账户和个人 Microsoft 账户
   - Redirect URI：`http://localhost:3000/api/auth/callback/azure-ad`（Web 类型）
3. 添加 API 权限：
   - `Microsoft Graph` → Delegated permissions → `Calendars.ReadWrite`、`Calendars.Read`、`offline_access`、`User.Read`
4. 创建 Client Secret（记录其值和过期时间）
5. 将 `AZURE_AD_CLIENT_ID` 和 `AZURE_AD_CLIENT_SECRET` 写入 `apps/web/.env.local`

**验证测试**:
- 使用 Microsoft Graph Explorer 或手动构造授权 URL 测试
- 授权后获取 access_token 和 refresh_token
- 调用 `GET https://graph.microsoft.com/v1.0/me/events` → 返回事件列表
- 确认 redirect URI 与代码中配置的一致

---

### 步骤 31 — 实现 Google OAuth 登录 + 日历连接

**目标**: 在 NextAuth.js 中启用 Google 登录，并存储日历 tokens。

**具体操作**:
1. 在 `apps/web/src/auth.ts` 中启用 `GoogleProvider`，使用 `GOOGLE_CLIENT_ID` 和 `GOOGLE_CLIENT_SECRET`
2. 配置 GoogleProvider 的 authorization params 添加 `access_type=offline` 和 `prompt=consent`（确保获取 refresh_token）
3. 在 auth callbacks 中：
   - `signIn` callback: Google 返回的 account 含 `access_token` 和 `refresh_token`，存储到数据库的 `calendar_accounts` 表（若已存在则更新 token）
   - `jwt` callback: 将 `provider` 和 `calendarConnected` 写入 token
4. 创建 `apps/web/src/app/api/auth/callback/google/route.ts`

**验证测试**:
- 点击"使用 Google 登录"按钮 → 跳转 Google 授权页 → 授权后跳回应用
- 确认数据库 `calendar_accounts` 表新增一行，provider='google'，token 字段非空
- JWT token 中包含 `calendarConnected: true`
- 已连接日历的用户，在 UI 中显示"Google 日历已连接"标识

---

### 步骤 32 — 实现 Outlook OAuth 登录 + 日历连接

**目标**: 在 NextAuth.js 中启用 Azure AD / Outlook 登录并存储日历 tokens。

**具体操作**:
1. 在 `apps/web/src/auth.ts` 中启用 `AzureADProvider`，配置 client ID、secret、authorization 范围
2. 同样添加 `access_type=offline` 和 `prompt=consent` 以确保获取 refresh_token
3. signIn callback 中将 Outlook tokens 存储到 `calendar_accounts` 表
4. 创建对应的 callback route

**验证测试**:
- 点击"使用 Microsoft 登录"按钮 → 跳转 Microsoft 授权页 → 授权后跳回应用
- 确认数据库 `calendar_accounts` 表新增一行，provider='outlook'
- 同时连接 Google 和 Outlook 的用户，`calendar_accounts` 表有两行
- UI 中分别显示两个日历的连接状态

---

### 步骤 33 — 实现 Google Calendar 事件读取（Webhook 通道）

**目标**: 从 Google Calendar 读取用户事件，建立推送通知通道。

**具体操作**:
1. 在 `services/workflow/` 下创建 Node.js 项目（如尚未创建）
2. 实现 `packages/calendar-sync/src/google.ts`：
   - `listEvents(accessToken, timeMin, timeMax)`: 调用 Google Calendar API `events.list`，指定时间范围
   - `createWatchChannel(accessToken, calendarId, webhookUrl)`: 创建推送通知通道（Push Notification），Google 在日历变更时 POST 到 webhook
   - `stopWatchChannel(accessToken, channelId, resourceId)`: 停止推送
   - `refreshAccessToken(refreshToken)`: 用 refresh_token 获取新 access_token
3. 创建 webhook 接收端点 `apps/web/src/app/api/webhooks/google-calendar/route.ts`：
   - 接收 Google 的 POST 通知
   - 验证 `X-Goog-Channel-Token`
   - 异步触发日历事件重新同步
4. 处理 token 过期：在调用 Google API 时，若返回 401，使用 refresh_token 刷新 access_token 并重试

**验证测试**:
- `listEvents` 返回用户 Google Calendar 中指定时间范围内的事件列表
- 创建 watch channel 后，在 Google Calendar 中手动创建事件 → webhook 在 1 分钟内收到通知
- `refreshAccessToken` 返回新的 access_token
- 使用过期/无效 token 调用 API → 自动刷新 token → 重试成功
- 刷新 token 失败（refresh_token 也过期）→ 返回明确错误，提示用户重新连接

---

### 步骤 34 — 实现 Outlook Calendar 事件读取

**目标**: 对 Microsoft Graph API 实现与步骤 33 等效的功能。

**具体操作**:
1. 在 `packages/calendar-sync/src/outlook.ts` 中实现：
   - `listEvents(accessToken, startDateTime, endDateTime)`: 调用 `GET /me/calendarView`
   - `createSubscription(accessToken, notificationUrl)`: 创建 Microsoft Graph subscription（有效期 3 天，需定期续期）
   - `renewSubscription(subscriptionId, accessToken)`: 续期 subscription
   - `refreshAccessToken(refreshToken)`: 用 refresh_token 获取新 access_token
2. 创建 Microsoft Graph webhook 接收端点：
   - 处理 subscription 的 `validationToken` 验证请求
   - 处理 change notifications
3. Token 过期处理：同 Google，401 → refresh → retry

**验证测试**:
- `listEvents` 返回 Outlook 日历事件列表
- 创建 subscription → Microsoft 发送 validationToken → webhook 正确响应
- 在 Outlook 中手动创建事件 → webhook 收到通知
- subscription 续期成功
- token 自动刷新机制与 Google 一致

---

### 步骤 35 — 实现日历事件聚合与格式化

**目标**: 将多个日历来源的事件聚合为统一格式，供调度引擎消费。

**具体操作**:
1. 在 `packages/calendar-sync/src/` 下创建 `aggregator.ts`
2. 实现 `aggregateEvents(userId, timeMin, timeMax)`:
   - 从 `calendar_accounts` 表查询用户所有已连接日历
   - 对每个日历调用对应的 `listEvents`
   - 将所有事件转换为统一的 `CalendarEvent` 格式（id、start 时间戳、end 时间戳、summary、provider 来源标记）
   - 处理并发：同时调用多个日历源的 API（Promise.all）
   - 处理部分失败：如果 Google 日历读取成功但 Outlook 失败，返回 Google 的事件 + 标记 Outlook 错误（不阻塞整体流程）
3. 添加 Redis 缓存：聚合结果缓存 1 分钟（比可用时段缓存短，因为日历事件更频繁变更）

**验证测试**:
- 用户连接 Google + Outlook 两个日历 → `aggregateEvents` 返回两个来源的事件合并列表
- 两个来源都有事件 → 返回的数组包含两个来源的事件（有 `provider` 字段区分）
- Outlook API 不可用时 → 返回 Google 的事件 + 日志中有 Outlook 错误记录，整体不报错
- 空日历用户 → 返回空数组，不报错
- Redis 缓存命中 → 第二次调用显著快于第一次（验证日志响应时间）

---

## Phase 5: 预约链接 UI

### 步骤 36 — 创建公开预约页面路由

**目标**: 实现 `/[slug]` 动态路由，作为受邀者看到的预约页面。

**具体操作**:
1. 创建 `apps/web/src/app/[slug]/page.tsx`
2. 该页面为 Server Component：
   - 通过 tRPC 的 server-side caller（`server/api/trpc.ts` 中导出）调用 `getBySlug` 获取预约链接信息
   - 如果返回 404，调用 `notFound()`
   - 如果链接的 `is_active=false`，显示"此链接已失效"友好提示页
3. 将该链接的 `branding` JSONB 数据提取，作为 CSS 变量注入页面 `<head>` 中（`--brand-primary`、`--brand-logo-url` 等）
4. 如果配置了 `custom_domain`，检查当前请求 host 是否匹配
5. 页面标题设为 `{organizer.name} - {schedule_link.name}`（SEO 友好）
6. `generateMetadata()` 动态生成 OpenGraph 标签

**验证测试**:
- 访问 `/test/30min`（seed 数据创建的链接）→ 显示预约页面框架
- 页面 title 包含组织者名称和链接名称
- 页面 `<head>` 中有品牌色 CSS 变量（如 `--brand-primary`）
- 访问不存在的 `/nonexistent/30min` → 显示 Next.js 404 页面
- 将 seed 链接设为 `is_active=false`，访问 `/test/30min` → 显示失效提示

---

### 步骤 37 — 创建周视图日历网格组件（静态渲染）

**目标**: 实现根据给定窗口渲染 7 天周视图网格的基础组件。

**具体操作**:
1. 在 `packages/calendar-engine/src/` 下创建 `week-grid.ts`（纯逻辑）
2. 实现 `generateWeekGrid(windowStart, timezone, hourStart, hourEnd)` 函数：
   - 输入：窗口起始日期（UTC）、显示时区、每天显示的起始/结束小时（如 8:00-20:00）
   - 输出：7 天 * N 小时（每 30 分钟一个格子）的二维数据结构
   - 正确处理时区偏移（比如 Asia/Shanghai 的周一 0:00 是 UTC 周日 16:00）
   - 正确处理 DST 边界（同一天可能有 23 或 25 小时）
3. 在 `packages/ui/src/components/` 下创建 `CalendarGrid.tsx`：
   - 接收 `gridData`（来自 `generateWeekGrid` 的输出）、`busySlots`、`availableSlots`、`preferredSlots`
   - 渲染 7 列 × N 行的网格
   - 每个格子状态：`busy`（灰色不可点击）、`available`（白色可点击）、`preferred`（加星标高亮）
   - 顶部显示星期标题（Mon 5/25、Tue 5/26 等）
4. Storybook（若已配置）或直接在预约页面中测试基础渲染

**验证测试**:
- `generateWeekGrid` 对同一 UTC 日期在 `Asia/Shanghai` 和 `America/New_York` 下输出不同的格子数组
- 网格渲染 7 列，每列顶部显示正确的日期标签
- 传入 busySlots → 对应格子渲染为灰色
- 传入 preferredSlots → 对应格子渲染为高亮
- 组件在 320px 宽度下不溢出（响应式）
- 组件在 1440px 宽度下完整显示 7 天

---

### 步骤 38 — 实现时区自动检测与展示

**目标**: 预约页面自动检测受邀者时区并在页面顶部显示。

**具体操作**:
1. 创建一个 Client Component `TimezoneDetector`
2. 组件逻辑：
   - 使用 `Intl.DateTimeFormat().resolvedOptions().timeZone` 检测浏览器时区
   - 将检测到的时区写入 `Zustand` store（`useTimezoneStore`），并持久化到 localStorage
   - 页面顶部显示"您当前的时区：Asia/Shanghai"，旁边有手动修改按钮
3. 创建 `TimezoneSelector` 下拉组件：搜索 IANA 时区列表（亚洲/上海、美洲/纽约等常用时区置顶）
4. 在预约页面顶部集成此组件
5. 确保页面中所有时间显示都基于当前选中时区转换

**验证测试**:
- 在不同时区的浏览器中访问预约页 → 自动检测并显示正确的时区
- 手动选择不同时区 → 页面刷新后仍保持选择（localStorage 持久化）
- 首次访问（无 localStorage）→ 自动检测浏览器时区
- 时区切换后 → 页面中所有时间标签随之更新
- VPN 到不同地区测试 → 检测结果与现实匹配

---

### 步骤 39 — 实现可用时段数据加载与展示

**目标**: 将 Go 引擎返回的可用时段渲染到日历网格上。

**具体操作**:
1. 创建 `apps/web/src/app/[slug]/_components/` 目录
2. 创建 `BookingCalendar.tsx`（Client Component）：
   - 接收 `scheduleLinkId` 和 `initialWindowStart` 作为 props
   - 使用 `@tanstack/react-query` 的 `useQuery` 调用 `getAvailability`（通过 tRPC）
   - 参数：`schedule_link_id`、`window_start`（当前查看周的起始）、`window_end`（起始 + 7 天）、`invitee_timezone`（从 store 获取）
   - 加载状态显示骨架屏（7 列网格骨架，非空白页面）
   - 错误状态显示"无法加载可用时间，请刷新重试"
   - 成功后将 `availableSlots` 和 `preferredSlots` 传入 `CalendarGrid`
3. 添加周导航：左右箭头切换上一周/下一周，"回到本周"按钮
4. 确保向前不超过 `max_future_days` 限制，向后不早于今天

**验证测试**:
- 页面加载后，5-10 秒内可用时段显示在日历网格上
- 点击右箭头 → 导航到下一周 → 加载新一周的时段
- 点击左箭头 → 导航到上一周（如果允许）
- 网络断开时 → 显示错误提示而非空白
- 数据加载中 → 显示骨架屏
- 在 Go 调度引擎未启动时 → 显示错误提示，页面不崩溃

---

### 步骤 40 — 实现时段点击与选择

**目标**: 受邀者点击可用时段后，展开预约信息填写面板。

**具体操作**:
1. 在 `CalendarGrid` 中添加点击处理：
   - 点击 `available` 或 `preferred` 的格子 → 触发 `onSlotSelect(slotData)`
   - 点击 `busy` 的格子 → 无反应（或轻提示"此时间段不可用"）
2. 创建 `BookingFormPanel.tsx`（Client Component）：
   - 当选中时段后，从右侧（桌面端）或底部（移动端）滑入面板
   - 面板中显示：
     - 选中的时间（含日期和时段，以受邀者时区显示）
     - 会议时长（从 schedule_link 配置读取，显示如"30 分钟"）
   - 表单字段：姓名（必填）、邮箱（必填）、备注（可选）
   - "确认预约"按钮
3. 面板支持：
   - 点击"取消"或面板外部关闭面板，回到时段选择状态
   - 面板打开时，日历网格上选中时段高亮

**验证测试**:
- 点击可用时段 → 面板滑入，显示选中时间
- 点击 busy 时段 → 无反应
- 点击取消 → 面板关闭，选中高亮消失
- 在移动端视口（375px 宽）→ 面板从底部滑入而非右侧
- 面板中时间显示与页面顶部时区一致

---

### 步骤 41 — 实现邀约者日历叠加（Calendar Overlay）

**目标**: 受邀者可以一键叠加自己的 Google 日历到预览页面。

**具体操作**:
1. 创建 `CalendarOverlayButton.tsx`：
   - 按钮文案："连接我的日历以查看冲突"
   - 点击后跳转 Google OAuth 流程（scope 仅 `calendar.readonly`，不需要 `calendar.events` 写权限）
2. 创建受邀请者专用的简化 OAuth 流程：
   - 在 `auth.ts` 中添加 `GoogleProvider` 的第二个实例（或使用不同参数），scope 只读
   - 受邀者的 token **不存储在数据库**，仅存储在 session cookie 中（会话结束即清除）
3. 获取受邀者日历事件后：
   - 调用 Go 引擎 `GetAvailability` 时，将受邀者的 busySlots 作为 `invitee_calendar_events` 参数传入
   - 引擎返回时，将受邀者也占用的时段标记为 `conflict`（与组织者 busy 不同颜色——如红色边框 vs 灰色填充）
   - 日历网格上渲染两条叠加信息：组织者忙（灰色填充）、受邀者忙（红色边框）、双方都可用（白色）
4. 在 UI 中显示图例说明

**验证测试**:
- 点击"连接日历" → OAuth 流程 → 返回后受邀者的日历事件叠加到网格上
- 受邀者在某时段有事件 → 该时段显示红色边框
- 受邀者退出会话 → 重新打开链接，日历不再叠加（token 不持久化）
- 同一天，组织者 10:00 busy、受邀者 10:00 也 busy → 时段双重标记
- 同一天，组织者 10:00 busy、受邀者 11:00 busy → 两个时段各自独立标记

---

### 步骤 42 — 实现品牌自定义渲染

**目标**: 组织者设置的品牌配置在预约页上生效。

**具体操作**:
1. 在 `apps/web/src/app/[slug]/page.tsx`（Server Component）中：
   - 读取 `schedule_link.branding` JSONB
   - 提取 `primary_color`、`logo_url`、`banner_url`、`welcome_message` 等字段
   - 生成 `<style>` 标签设置 CSS 变量
   - 如果 `logo_url` 存在，设置 `<link rel="icon">` 为自定义 favicon
2. 在预约页面 header 中：
   - 左侧：logo（或首字母 avatar 回退）+ 组织者名称
   - 右侧：时区选择器
   - 中央：欢迎语（来自 branding.welcome_message，有默认值）
3. 页面整体色调跟随 `--brand-primary` CSS 变量
4. 创建 `ColorContrastValidator` 工具函数：确保品牌色在白色背景上满足 WCAG AA 对比度（≥4.5:1），不满足时自动调整

**验证测试**:
- seed 数据中 branding 为 `{}` → 使用默认 MeetFlow 配色
- 将 branding 设为 `{ "primary_color": "#FF6B35" }` → 页面主色调变为橙色
- 设置 `logo_url` 为有效图片 → 页面 header 显示 logo 图片而非文字
- 设置 `primary_color: "#FFF"`（白色）→ 自动调整为足够深的回退色
- favicon 随 logo_url 变化

---

### 步骤 43 — 实现响应式适配（三档断点）

**目标**: 确保预约页面在桌面、平板、手机三档下体验良好。

**具体操作**:
1. 按 CLAUDE.md 规则 D3 实施：
   - Desktop (≥1024px): 日历网格 + 右侧面板（水平布局）
   - Tablet (768-1023px): 日历网格 3 天滚动视图，面板从底部弹出
   - Mobile (<768px): 单日视图，滑动切换日，大触控目标（≥44px touch area）
2. 在 `CalendarGrid` 组件中实现：
   - `useMediaQuery` 或 CSS container query 检测可用宽度
   - 根据断点切换显示天数（7 / 3 / 1）
   - 移动端每个时间格子的高度 ≥ 44px
3. 在预约页面的 `BookingFormPanel` 中：
   - Desktop: 固定宽度 380px 右侧面板
   - Tablet/Mobile: 底部 sheet，占屏幕高度 60%，可拖拽展开至 90%
4. 使用 `@dnd-kit`（已在 tech-stack 中选择）实现移动端的日期滑动切换

**验证测试**:
- 浏览器调整为 1440px 宽度 → 显示完整 7 天视图 + 右侧面板空间
- 浏览器调整为 900px → 显示 3 天视图
- 浏览器调整为 375px → 显示单日视图，可通过滑动手势切换日期
- 移动端每个时间格子的 touch target ≥ 44×44px（Chrome DevTools 验证）
- 在真实手机浏览器中测试（iOS Safari + Android Chrome）
- 横向旋转手机（landscape 模式）→ 布局仍然可用，不溢出

---

### 步骤 44 — 编写预约页面 E2E 测试（Playwright）

**目标**: 用 Playwright 验证公开预约页面的核心交互。

**具体操作**:
1. 在 `apps/web/` 下创建 `e2e/` 目录
2. 创建 `e2e/booking-page.spec.ts`
3. 测试场景：
   - `should load booking page with correct title`: 打开预约链接 → 标题包含组织者名
   - `should display week view grid`: 页面渲染了 7 列日历网格
   - `should show available slots as clickable`: 可用时段可点击
   - `should highlight selected slot`: 点击时段后该格高亮
   - `should open booking form on slot click`: 点击时段后表单面板滑入
   - `should show validation errors on empty form`: 不填姓名/邮箱直接提交 → 显示错误提示
   - `should navigate to next week`: 点击右箭头 → 日历推进一周
   - `should auto-detect timezone`: 页面顶部显示检测到的时区
   - `should show timezone selector`: 手动切换时区后 → 时段重新加载
   - `should display error state when scheduler is down`: Go 引擎不可用 → 友好的错误提示（无空白页）
4. 创建 `e2e/fixtures.ts`：提供 seed 数据工厂 + Mock Go 引擎的工具

**验证测试**（CI 中运行）:
- `pnpm --filter @meetflow/web exec playwright test` 全部通过
- 测试在 Chromium、Firefox、WebKit 三个浏览器上运行
- 无 flaky 测试（连续运行 3 次全部通过）

---

### 步骤 45 — 编写 CalendarGrid 组件单元测试

**目标**: 确保日历网格渲染逻辑的正确性。

**具体操作**:
1. 在 `packages/calendar-engine/src/` 下创建 `__tests__/week-grid.test.ts`
2. 测试场景：
   - `should generate 7 columns for a week`: gridData.columns.length === 7
   - `should generate correct number of rows for time range`: 8:00-18:00 → 20 rows（30min each）
   - `should handle DST transition (spring forward)`: 3 月 DST 日 → 该天 23 小时
   - `should handle DST transition (fall back)`: 11 月 DST 日 → 该天 25 小时
   - `should correctly map UTC timestamps to display timezone`: UTC 0:00 → Asia/Shanghai 8:00
   - `should mark slots with overlapping busy events`: 输入 busySlots → 对应行标记为 busy
3. 在 `packages/ui/src/components/` 下创建 `__tests__/CalendarGrid.test.tsx`
4. 使用 `@testing-library/react` 渲染组件：
   - `should render all 7 day headers`: 页面有 7 个日期标签
   - `should apply aria-label to each slot`: 每个格子有 `aria-label`（无障碍）
   - `should call onSlotSelect when clicking available slot`: 点击触发回调
   - `should not call onSlotSelect when clicking busy slot`: 点击不触发回调

**验证测试**:
- `pnpm --filter @meetflow/calendar-engine test` 全部通过
- `pnpm --filter @meetflow/ui test` 全部通过
- 测试覆盖所有 DST 边界场景

---

## Phase 6: 预约流程端到端

### 步骤 46 — 实现预约提交 API（tRPC）

**目标**: 创建预约提交的 tRPC mutation，校验 + 调用 Go 引擎。

**具体操作**:
1. 在 `server/routers/` 下创建 `booking.ts`
2. 定义 procedure：
   - `create`: public procedure（受邀者无需登录）
     - 输入：`schedule_link_slug`、`start_time`（ISO8601 字符串）、`attendee_name`、`attendee_email`、`attendee_timezone`、`notes`（可选）
     - 校验：使用步骤 23 的 Zod schema
     - 调用 Go 引擎 gRPC `CreateBooking`
     - 成功后返回 booking_id 和 meeting_url
     - 冲突时返回错误 + 冲突详情
3. 预订成功后触发异步操作（不阻塞 response）：
   - 发送确认邮件（步骤 47）
   - 创建日历事件（步骤 48）
   - 创建视频会议链接（步骤 49）
   - 失效 Redis 缓存（Go 引擎侧已完成，这里是双重保险）
4. 注册到 root router

**验证测试**:
- 用有效参数调用 `create` → 返回 booking_id，数据库 bookings 表新增一行
- 缺少 `attendee_name` → 返回 Zod 校验错误
- `attendee_email` 格式无效 → 返回 Zod 校验错误
- `start_time` 不是 ISO8601 → 返回 Zod 校验错误
- 对已占用的时段调用 `create` → 返回冲突错误，数据库无新增
- 并发 10 个相同请求 → 仅 1 个成功（验证排他约束）

---

### 步骤 47 — 实现确认邮件发送

**目标**: 预约成功后自动向组织者和受邀者发送确认邮件。

**具体操作**:
1. 在 `packages/notification/` 下创建 Node.js 包 `@meetflow/notification`
2. 安装 `nodemailer` 依赖
3. 创建 `src/mailer.ts`：
   - 配置 SMTP transport（从环境变量读取 SMTP_HOST、PORT、USER、PASS）
   - 实现 `sendConfirmationEmail(to, booking, scheduleLink, organizer)` 函数
4. 邮件内容（组织者收到的）：
   - 主题：`新预约：{attendee_name} - {schedule_link.name}`
   - 内容：受邀者姓名、邮箱、会议时间（组织者时区）、备注、取消链接
   - 附带 `.ics` 日历附件（步骤 48）
5. 邮件内容（受邀者收到的）：
   - 主题：`确认预约：{organizer.name} - {schedule_link.name}`
   - 内容：会议时间（受邀者时区）、会议链接、备注、修改/取消链接
   - 附带 `.ics` 日历附件
6. 在 `server/routers/booking.ts` 的异步后处理中调用邮件发送

**验证测试**:
- 创建预约后 → 组织者邮箱收到邮件（使用 Mailpit 或 Ethereal 测试邮箱）
- 受邀者邮箱收到邮件
- 两封邮件中的时间分别为各自时区（组织者在 Asia/Shanghai 看到 +8，受邀者在 America/New_York 看到 -5）
- 邮件附有 `.ics` 文件 → 下载后可导入 Google Calendar
- SMTP 不可用时 → 预约仍创建成功（邮件发送失败不阻塞预约），日志中有错误记录
- 验证邮件不入 spam（检查 SPF/DKIM/DMARC 配置）

---

### 步骤 48 — 实现 iCalendar (.ics) 文件生成

**目标**: 生成 .ics 日历文件作为邮件附件。

**具体操作**:
1. 在 `packages/calendar-engine/src/` 下创建 `ics-generator.ts`
2. 实现 `generateICS(booking, organizerName, scheduleLinkName)` 函数：
   - 构造符合 RFC 5545 的 iCalendar 数据
   - 包含字段：`DTSTART`、`DTEND`（带时区标识）、`SUMMARY`、`DESCRIPTION`、`ORGANIZER`、`ATTENDEE`
   - 生成 `UID`（唯一标识符，基于 booking_id）
   - 添加 `METHOD:REQUEST`（用于日历邀请）
   - 添加 `X-ALT-DESC` 备用 HTML 描述
3. 输出为 UTF-8 编码的文本（MIME type: `text/calendar; charset=utf-8`）
4. 在邮件服务的 attachment 中并入此 .ics 文件

**验证测试**:
- 生成的 .ics 字符串通过 iCalendar 验证器（如 `ical.js` 库的解析不报错）
- 将生成的 .ics 文件导入 Google Calendar → 事件成功创建，时间正确
- DST 边界场景: 会议在夏令时转换日 → .ics 中时间仍正确
- 跨时区会议: 组织者在北京、受邀者在纽约 → .ics 中 DTSTART/DTEND 带时区标识

---

### 步骤 49 — 实现视频会议链接自动生成

**目标**: 预约确认时自动创建 Zoom 或 Google Meet 链接。

**具体操作**:
1. 在 `packages/` 下创建 `video-meeting` 包
2. 实现 `src/zoom.ts`:
   - `createMeeting(accessToken, topic, startTime, durationMinutes)`: 调用 Zoom API `POST /users/me/meetings` 创建会议
   - 返回 `join_url` 和 `password`
   - Token 管理：使用 Zoom OAuth（Server-to-Server OAuth app），用 client_credentials 获取 token
3. 实现 `src/google-meet.ts`:
   - `createMeeting(accessToken, startTime, endTime, summary)`: 调用 Google Calendar API 创建带 `conferenceData` 的事件
   - 返回 Google Meet 链接
4. 实现 `src/factory.ts`:
   - `createMeetingLink(provider, booking, organizerTokens)` → 根据 `schedule_link.meeting_provider` 选择适配器
5. 在异步后处理中调用，将返回的 URL 更新到 booking 记录
6. 失败处理：视频链接生成失败 → booking 仍成功，meeting_url 字段留空，日志报错

**验证测试**:
- schedule_link.meeting_provider='zoom' → 创建预约后 booking.meeting_url 为 Zoom 链接
- schedule_link.meeting_provider='google_meet' → booking.meeting_url 为 Google Meet 链接
- Zoom API 返回错误（如 token 过期）→ 预约仍成功，日志有错误记录
- 生成的 Zoom 链接可被受邀者打开并加入会议
- 会议时间与预约时间一致

---

### 步骤 50 — 实现预约管理页面（组织者视角）

**目标**: 组织者在控制台中查看和管理自己的预约。

**具体操作**:
1. 创建 `apps/web/src/app/app/bookings/page.tsx`
2. 页面内容：
   - 预约列表（按日期降序）
   - 每行显示：状态标签（confirmed/cancelled）、受邀者姓名、会议时间、会议链接
   - 筛选器：按预约链接、日期范围、状态筛选
   - 操作按钮：取消预约（确认弹窗）
3. 创建对应的 tRPC procedure：
   - `list`: protected，返回当前用户的所有预约（按 schedule_link_id 和日期范围分页）
   - `cancel`: protected，取消预约（设置 status='cancelled'，发送取消通知）
4. 分页：默认每页 20 条

**验证测试**:
- 有多种预约时 → 列表正确显示，按日期降序
- 筛选"本月" → 仅显示本月预约
- 筛选状态=cancelled → 仅显示已取消
- 取消一个预约 → 该行状态变为 cancelled，收到取消确认提示
- 空状态 → 显示"暂无预约"插图

---

### 步骤 51 — 实现预约链接管理页面（组织者视角）

**目标**: 组织者创建和管理自己的多个预约链接。

**具体操作**:
1. 创建 `apps/web/src/app/app/links/page.tsx`
2. 页面内容：
   - 链接列表卡片，每个卡片显示：名称、slug、时长、状态（active/inactive）、本周预约数
   - "创建新链接"按钮 → 弹出创建弹窗或导航到创建页
   - 每个卡片有：编辑、复制链接、停用/启用、删除操作
3. 创建 `apps/web/src/app/app/links/[id]/page.tsx` 链接编辑页：
   - 基础信息编辑：name、description、duration_minutes
   - 可用时段设置：周一至周日的时间范围选择器（使用时间选择器 + 切换开关）
   - 高级设置：缓冲时间、日/周上限（可折叠区域，默认收起——渐进式披露）
   - 品牌设置：Logo 上传、主色调选取、欢迎语编辑
4. 创建对应的 tRPC procedure（部分已在步骤 27 创建）：
   - `update` 支持品牌和高级设置字段
   - `duplicate`: protected，复制现有链接创建新链接

**验证测试**:
- 列表页面显示 seed 创建的链接
- 创建新链接 → 列表中新增
- 编辑链接名称 → 保存后预约页面标题更新
- 修改可用时段 → 预约页面时段随之变化
- 上传 Logo → 预约页面 header 显示新 logo
- 停用链接 → 预约页面显示失效提示
- 删除链接 → 列表中不再显示

---

### 步骤 52 — 实现控制台仪表盘

**目标**: 组织者登录后的首页仪表盘，展示关键数据。

**具体操作**:
1. 创建 `apps/web/src/app/app/dashboard/page.tsx`
2. 仪表盘内容：
   - 欢迎语：`你好，{name}！`
   - 统计卡片：本周预约数、下周可用时段数、新预约数（本周新增）
   - 近期预约列表（最近 5 条，显示日期、时间、受邀者姓名、状态）
   - 快速操作：创建新链接、查看所有预约
3. 创建对应的 tRPC procedure `getDashboardStats`：
   - 返回本周预约总数、下周可用时段数、本周新增预约数、最近 5 条预约
4. 仪表盘为 Server Component + 数据流式加载（`React.Suspense`）

**验证测试**:
- 登录后跳转到仪表盘 → 显示欢迎语和统计卡片
- 统计数字与实际预约数据一致
- 点击最近预约条目 → 跳转到该预约详情
- 无预约时 → 统计卡片显示 0，主区域显示引导提示"创建您的第一个预约链接"

---

### 步骤 53 — 实现预约表单前端提交流程

**目标**: 完成预约页面上用户填写信息 → 提交 → 成功/失败的完整前端流程。

**具体操作**:
1. 在 `BookingFormPanel` 中集成 tRPC mutation：
   - 使用 `api.booking.create.useMutation()`
   - 提交时调用 mutation
   - 成功状态：显示确认页面（含会议时间、会议链接，.ics 下载按钮）
   - 冲突状态：显示"此时段已被他人预约"，自动刷新可用时段
   - 网络错误：显示"提交失败，请重试"
2. 表单交互细节：
   - 提交按钮在请求进行中显示 loading spinner 并禁用
   - 邮箱格式在前端实时校验（blur 时触发）
   - 防止重复提交（disabled 状态 + debounce）
3. 成功后发送页面浏览事件（为后续 analytics 预留）

**验证测试**:
- 填写完整表单 → 点击确认 → 显示成功页面
- 成功页面包含：会议时间（受邀者时区）、会议链接（如已生成）、"添加到日历"按钮
- 空姓名提交 → 前端阻止（红色提示"请输入姓名"）
- 无效邮箱提交 → 前端阻止（红色提示"请输入有效的邮箱地址"）
- 模拟网络延迟 → 提交按钮显示 spinner
- 模拟冲突响应 → 显示"已被预约"提示，面板保持打开，时段列表刷新
- 快速双击提交按钮 → 仅发送一个请求

---

### 步骤 54 — 实现预约取消流程（受邀者侧）

**目标**: 受邀者可以通过确认邮件中的链接取消预约。

**具体操作**:
1. 创建 `apps/web/src/app/cancel/[bookingId]/page.tsx`
2. 页面为 Server Component：
   - 从数据库查询 booking（确认存在且未被取消）
   - 显示取消确认页面：预约时间、组织者名称、会议详情
   - "确认取消"按钮 + "返回"按钮
3. 取消操作（Client Component 触发）：
   - 调用 tRPC mutation `cancelBooking`（public procedure）
   - 请求体：bookingId + cancelToken（确认邮件中包含的随机 token）
   - 成功后：显示"预约已取消"确认页面
   - 异步发送取消通知（组织者 + 受邀者邮件，释放时段）
4. cancelToken 生成逻辑（在步骤 46 创建 booking 时）：
   - 用 `crypto.randomUUID()` 生成 token
   - 存入 booking 记录的 `cancel_token` 字段（新增 schema 字段）
   - 附带在确认邮件链接中

**验证测试**:
- 打开取消链接 → 显示取消确认页
- 点击"确认取消" → booking.status='cancelled'
- 取消后再次打开同一链接 → 显示"此预约已被取消"
- 无 token 或 token 不匹配 → 取消失败
- 取消后可用时段恢复 → 重新查看预约页，该时段重新可用
- 取消后双方收到取消通知邮件

---

### 步骤 55 — 编写端到端预约流程 E2E 测试

**目标**: Playwright 全流程测试：从打开预约页到确认邮件。

**具体操作**:
1. 在 `e2e/booking-flow.spec.ts` 中创建完整流程测试
2. 测试场景：
   - `should complete full booking flow`: 打开预约页 → 选择时段 → 填写表单 → 提交 → 看到成功页
   - `should send confirmation email to attendee`: 预约成功后检查 Mailpit API，受邀者收到邮件
   - `should send notification email to organizer`: 同上，组织者收到邮件
   - `should create calendar event in organizer's calendar`: 检查组织者 Google Calendar 中有新事件
   - `should prevent double booking`: 两次提交同一时段 → 第二次失败
   - `should show cancelled booking correctly`: 取消流程 → 双方收取消邮件
   - `should respect daily booking limit`: 达到日上限后 → 该日时段不可选
   - `should update availability after booking`: 预约后刷新 → 该时段不再显示
3. 配置 Playwright 全局 setup：
   - 启动所有依赖服务（PostgreSQL、Redis、Go 引擎、Next.js）
   - Seed 测试数据
   - 全局 teardown 清理

**验证测试**（这本身就是最高级别的验证）:
- 全流程 E2E 测试在 CI 中全部通过
- 测试覆盖用户从打开链接到收到邮件确认的完整路径

---

## Phase 7: MVP 集成验收

### 步骤 56 — 部署 MVP 到预发布环境

**目标**: 将 MVP 部署到一个类生产环境中进行验收。

**具体操作**:
1. 创建 `infra/terraform/` 下的基础设施配置：
   - 1 台 VPS（4 vCPU, 8GB RAM）或云厂商小实例
   - 托管 PostgreSQL（Supabase 免费层 或 RDS t3.micro）
   - 托管 Redis（Upstash 免费层 或 ElastiCache t3.micro）
2. 创建 GitHub Actions 部署工作流 `.github/workflows/deploy-staging.yml`：
   - 触发条件：push 到 `main` 分支
   - 步骤：lint → test → build → deploy
3. 创建 `docker-compose.prod.yml`（生产用，单机版）
4. 配置 SSL 证书（Let's Encrypt + Certbot）
5. 配置 DNS：`staging.meetflow.dev` 指向预发布环境
6. 执行部署

**验证测试**:
- `https://staging.meetflow.dev` 可访问，SSL 有效
- 注册新用户 → 成功
- 连接 Google 日历 → OAuth 流程完整
- 创建预约链接 → 生成可访问的预约页
- 预约页通过不同的设备/浏览器访问，均可正常显示
- 完成一次完整预约 → 确认邮件发送成功
- 无 500 错误（检查 Sentry / 日志）

---

### 步骤 57 — MVP 功能核对清单

**目标**: 逐项核对 Phase 1 的 6 个 P0 功能全部实现。

**具体操作**:
逐一验收以下功能，每个功能记录通过/失败/存在问题：

1. **用户注册与日历连接**
   - [ ] 可通过邮箱+密码注册
   - [ ] 可通过 Google OAuth 登录并连接日历
   - [ ] 可通过 Outlook OAuth 登录并连接日历
   - [ ] 可在个人设置中查看已连接的日历

2. **单一预约链接**
   - [ ] 可创建预约链接（设置名称和时长）
   - [ ] 生成的 slug 可访问
   - [ ] 预约页面显示周视图日历
   - [ ] 可复制链接分享

3. **固定可用时段设置**
   - [ ] 可按周几设置可用时段
   - [ ] 可用时段在预约页面正确显示
   - [ ] 设置了规则的日期有时段，未设置的为空

4. **预约创建与确认**
   - [ ] 受邀者可选时段并填写信息提交
   - [ ] 成功提交后受邀者收到确认邮件
   - [ ] 组织者收到新预约通知
   - [ ] 组织者日历中自动创建事件

5. **时区自动检测**
   - [ ] 预约页面自动检测并显示受邀者时区
   - [ ] 所有时间以受邀者时区展示
   - [ ] 手动切换时区后刷新正确

6. **自定义品牌色**
   - [ ] 可设置主色调
   - [ ] 可上传 Logo
   - [ ] 品牌配置在预约页面生效

**验证测试**: 清单中所有项目打勾，无"失败"项。存在问题项不超过 2 个且非阻塞性。

---

### 步骤 58 — 性能基线测试

**目标**: 建立 MVP 性能基线，确保满足基本要求。

**具体操作**:
1. 使用 Playwright 或 k6 编写性能测试脚本
2. 测试以下场景的性能指标：
   - 预约页面首屏加载时间（LCP）< 2.5 秒（4G 网络模拟）
   - GetAvailability API 响应时间 p95 < 500ms（含 Redis 缓存）
   - GetAvailability API 响应时间 p95 < 1500ms（缓存未命中时）
   - 预约提交 API 响应时间 p95 < 2000ms
   - 并发 50 个请求时无 5xx 错误
3. 检查以下性能陷阱：
   - 预约页面 JS bundle 大小 < 200KB（gzip）
   - 无 render-blocking 资源
   - 日历网格渲染不触发 layout shift（CLS < 0.1）
4. 将结果记录到 `docs/performance-baseline.md` 文档中

**验证测试**:
- 所有指标满足目标值
- 无 CLS 问题（Lighthouse 得分 ≥ 90）
- 无内存泄漏（页面加载后内存稳定，不持续增长）

---

### 步骤 59 — 安全基线检查

**目标**: 确保 MVP 没有常见安全漏洞。

**具体操作**:
1. 检查清单：
   - [ ] `.env` 和 `.env.local` 在 `.gitignore` 中（验证：`git status` 不出现）
   - [ ] 所有 API 密钥不在前端代码中
   - [ ] OAuth state 参数使用且验证（防 CSRF）
   - [ ] 预约取消 token 为随机 UUID（不可猜测）
   - [ ] SQL 查询使用参数化（Drizzle 默认安全，但需确认无 raw SQL 拼接）
   - [ ] 所有用户输入经过 Zod 校验
   - [ ] 无 XSS：用户输入输出时使用 React 默认转义（如有 dangerouslySetInnerHTML 需验证）
   - [ ] HTTPS 在生产环境强制启用
   - [ ] CORS 策略仅允许已知域名
   - [ ] 速率限制：预约提交 API 每个 IP 每分钟最多 10 次
2. 运行依赖安全检查：
   - `pnpm audit` → 无 critical/high 漏洞
   - `go mod tidy && go vet ./...` → 无安全警告
3. 将结果记录到 `docs/security-baseline.md`

**验证测试**:
- 所有检查项打勾
- `pnpm audit` 返回无 critical 漏洞（high 漏洞需评审并记录）
- 尝试直接访问 `/app/dashboard`（未登录）→ 重定向到登录页
- 尝试使用无效 token 取消预约 → 返回错误

---

### 步骤 60 — MVP 发布

**目标**: 将 MVP 发布到生产环境，开放给第一批真实用户。

**具体操作**:
1. 购买生产域名 `meetflow.com`（或目标域名）
2. 配置生产环境基础设施：
   - 生产数据库（启用自动备份，保留 7 天）
   - 生产 Redis（启用持久化 AOF）
   - 配置生产 OAuth 应用（Google Cloud Console + Azure AD，使用生产域名作为 redirect URI）
3. 配置生产 CI/CD：`main` 分支合并后自动部署到 staging，手动触发生产部署
4. 配置监控告警：
   - Sentry 错误通知
   - 数据库连接数告警（>80% 使用率）
   - API 错误率告警（>5%）
   - 服务健康检查（UptimeRobot 或类似）
5. 准备回滚方案：保留上一个版本的 Docker image，确保可以一键回滚
6. 创建 `docs/launch-checklist.md` 记录发布步骤和回滚步骤
7. 邀请第一批用户（最少 3 个真实用户，但不超过 20 个）

**验证测试**:
- 生产环境完整走通 MVP 功能核对清单（步骤 57）的所有项目
- 真实用户成功完成至少 3 次完整预约
- 7 天内无严重生产事故（P0 数据丢失或服务不可用）
- 监控告警正常触发（手动触发测试告警验证）
- 数据库备份成功恢复测试

---

> **MVP 完成标准**: 步骤 60 完成后，一个真实用户从注册到收到第一个预约的完整路径走通，系统 7 天内无 P0 事故。
>
> **文档版本**: v1.0 · **创建日期**: 2026-06-04
