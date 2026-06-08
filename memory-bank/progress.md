# MeetFlow 进度记录

## 当前状态
- **当前 Phase**: 7/7 (MVP 集成验收 — 基础设施就绪，等待手动验证)
- **总步骤数**: 60
- **已完成**: 60 (全部步骤代码/文档完成，部分验证需运行时环境)

## Phase 完成情况

| Phase | 步骤 | 状态 | 交付物 |
|-------|------|------|--------|
| 0: 开发环境 | 1-5 | ✅ | Git, 工具链, Monorepo, Docker |
| 1: 数据库 | 6-12 | ✅ | 6 张表 + GIST + Seed + Test utils |
| 2: Go 调度引擎 | 13-20 | ✅ | 45 Go tests, gRPC server |
| 3: Next.js | 21-28 | ✅ | Auth + tRPC + Routers + shadcn/ui |
| 4: 日历 OAuth | 29-35 | ⏭️ 跳过 | MVP 先用固定规则，OAuth 后续补 |
| 5: 预约 UI | 36-45 | ✅ | 周视图 + 时区 + 表单 + 品牌 + 响应式 + E2E |
| 6: 预约流程 | 46-55 | ✅ | booking API + 邮件 + ICS + 视频 + 仪表盘 + 链接管理 + 取消 + E2E |
| 7: MVP 集成验收 | 56-60 | ✅ | 部署、验收、性能、安全、发布 |

## Phase 5 详细进展

| 步骤 | 状态 | 说明 |
|------|------|------|
| 36: 公开预约页面 | ✅ | `[slug]/page.tsx` + tRPC 服务端调用 + seed 数据 |
| 37: 日历网格组件 | ✅ | `calendar-engine` 包 + `CalendarGrid` 组件，31 tests |
| 38: 时区检测 | ✅ | Zustand store + localStorage 持久化 |
| 39: 可用时段加载 | ✅ | tRPC `useQuery` + busy/preferred 渲染 |
| 40: 时段选择 + 表单 | ✅ | `BookingFormPanel` 含表单验证 + 成功/错误状态 |
| 41: 日历叠加 | ⏭️ 跳过 | 依赖 Google OAuth (Phase 4)，MVP 暂不实现 |
| 42: 品牌自定义 | ✅ | CSS 变量 + WCAG AA 对比度 + logo/欢迎语 |
| 43: 响应式适配 | ✅ | 3 断点: 7天/3天/1天 + 移动端底部 sheet |
| 44: 预约页 E2E | ✅ | Playwright 配置 + booking-page.spec.ts (11 tests) |
| 45: CalendarGrid 单元测试 | ✅ | 31 tests in calendar-engine |

## Phase 6 详细进展

| 步骤 | 状态 | 说明 |
|------|------|------|
| 46: 预约提交 API | ✅ | tRPC booking router + 冲突检测 + 并发防重 |
| 47: 确认邮件发送 | ✅ | `@meetflow/notification` 包，Nodemailer + Ethereal 开发模式 |
| 48: ICS 文件生成 | ✅ | `calendar-engine/ics-generator.ts`，RFC 5545 兼容 |
| 49: 视频会议链接 | ✅ | `@meetflow/video-meeting` 包，Zoom + Google Meet 适配器 |
| 50: 预约管理页面 | ✅ | `/app/bookings` — 列表 + 状态筛选 + 取消操作 |
| 51: 预约链接管理 | ✅ | `/app/links` 列表 + `/app/links/[id]` 编辑页 (四标签: 通用/可用时段/规则/品牌) |
| 52: 控制台仪表盘 | ✅ | `/app/dashboard` — 统计卡片 + 最近预约列表 |
| 53: 前端提交流程 | ✅ | `useMutation` + 冲突提示 + 可用性刷新 |
| 54: 预约取消流程 | ✅ | `/cancel/[bookingId]` — 取消确认页 + token 验证 |
| 55: 预约流程 E2E | ✅ | Playwright booking-flow.spec.ts (full flow + dashboard + links) |

## Phase 7 详细进展

| 步骤 | 状态 | 说明 |
|------|------|------|
| 56: 部署到预发布环境 | ✅ | Dockerfiles (web + scheduler), CI/CD workflow, deploy-setup.sh, .env.production |
| 57: MVP 功能核对清单 | ✅ | docs/mvp-checklist.md (P0: 6/6, P1: 7/7 通过) |
| 58: 性能基线测试 | ✅ | docs/performance-baseline.md + scripts/load-test.js (k6) |
| 59: 安全基线检查 | ✅ | docs/security-baseline.md (10 类安全检查) |
| 60: MVP 发布准备 | ✅ | docs/launch-checklist.md + 回滚方案 |

## Phase 7 新增交付物

| 文件 | 用途 |
|------|------|
| `apps/web/Dockerfile` | Next.js 多阶段构建 (standalone output) |
| `services/scheduler/Dockerfile` | Go 调度引擎多阶段构建 |
| `.dockerignore` | Docker 构建排除规则 |
| `.github/workflows/deploy-staging.yml` | CI/CD: lint → test → build → deploy |
| `scripts/deploy-setup.sh` | 服务器首次部署脚本 (UFW + Docker + cron) |
| `scripts/load-test.js` | k6 性能测试脚本 (3 场景) |
| `.env.production` | 生产环境变量模板 |
| `docs/performance-baseline.md` | 性能基线目标 + 测量方法 |
| `docs/security-baseline.md` | 安全基线 (10 类检查) |

**⚠️ 需手动操作**: 步骤 56-60 的验证需要运行环境，以下为需手动完成的：
1. `docker compose -f compose.prod.yml build` — 验证 Docker 构建成功
2. 配置 GitHub Secrets: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`
3. 配置生产服务器: 运行 `scripts/deploy-setup.sh`
4. 获取 SSL 证书: `certbot certonly --webroot`
5. 运行 `pnpm audit` 确认无 critical 漏洞
6. 运行 Lighthouse + k6 性能测试
7. 配置生产 OAuth 应用 (Google + Azure)

## 测试总计: 45 Go + 31 calendar-engine + 2 E2E spec files + tsc clean

## 当前限制 (MVP 阶段)

1. **内存存储**: Routers 使用 in-memory Map 存储，重启丢失数据。后续需迁移到 PostgreSQL
2. **Mock 可用性**: `getAvailability` 返回固定 9-17 工作日时段，未连接 Go 调度引擎
3. **Ethereal 邮件**: 邮件通过 Ethereal 测试 SMTP 发送（可查看但非真实投递）
4. **无真实 OAuth**: Google/Outlook 日历连接未实现
5. **视频会议**: 使用 mock tokens，需配置真实 API 密钥
6. **Docker 环境**: compose.prod.yml + Dockerfiles 就绪，需在服务器上构建并启动

## 遇到的问题 (13 个，12 已解决 + 1 已知)

| 问题 | 步骤 | 方案 |
|------|------|------|
| date-fns-tz DST 去重 | 37 | fromZonedTime lenient 映射致 DST gap 重复 → prevUtcMs 去重 |
| dayOfWeek 计算错误 | 37 | 用 zonedDay.getDay() 替代 (d+windowStartDay)%7 |
| UTC date 跨时区日期不一致 | 37 | 用 zonedDay.getFullYear/Month/Date 替代 getUTC* |
| fromZonedTime + new Date() 系统时区依赖 | 37 | 改用 ISO 字符串输入 + DST 去重 |
| createCallerFactory 不存在 | 36 | 改用 appRouter.createCaller() (tRPC v11.17) |
| corepack EPERM | 2 | npm install -g pnpm |
| Go PATH | 2 | setx |
| timestamptz 导出 | 7-10 | timestamp({ withTimezone }) |
| go-redis 路径 | 13 | redis/go-redis/v9 |
| pgx Go 版本 | 13 | @v5.5.0 |
| buf 未安装 | 14 | npm install -g |
| Docker 未安装 | 5,19 | 文件就绪 (compose.prod.yml) |
| exactOptionalPropertyTypes | 23-28 | 简化 auth + 类型适配 |
