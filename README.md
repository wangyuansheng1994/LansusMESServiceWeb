# LansusMESServiceWeb

LansusMES 前后端分离的前端工程（React 19 + antd 6 + Vite 7）：老 JSP 逐页迁移的新外壳与迁移期页面容器。

- **服务端仓库**：`D:\项目\LansusMESService`（Tomcat/WAR，老 JSP + 老接口 + 新增 `${adminPath}/api/v1` 适配层）
- **远端**：`git@github.com:wangyuansheng1994/LansusMESServiceWeb.git`
- **总体方案**：服务端仓库 `docs/development/frontend-migration-plan-v3.1.md`（桌面工作副本由负责人维护同步）；执行层约束 `.agents/skills/mes-page-migration/`（在服务端仓库）

---

## 1. 快速开始

### 前置条件

| 项   | 要求                                                                   | 说明                               |
| ---- | ---------------------------------------------------------------------- | ---------------------------------- |
| Node | `^20.19.0 \|\| >=22.12.0`（engines + `.nvmrc`）                        | 本机实测 v24.20.0                  |
| pnpm | ≥ 12，**经 corepack 调用**：`corepack pnpm ...`（本机 pnpm 不在 PATH） | 也可先 `corepack enable` 注册 shim |
| 后端 | Tomcat 8.5.34 跑在 `127.0.0.1:8080`                                    | 未启动时页面提示网络错误，属预期   |

```bash
corepack pnpm install   # 首次
corepack pnpm dev       # 开发，访问 http://127.0.0.1:5173（不要用 localhost，见 vite.config.ts 注释三铁律）
```

后端本地启动（服务端仓库根目录）：`start-tomcat-war-local.bat`（用现成 WAR 跳过 Maven 构建，启动约 4 分钟属正常）。

### 常用命令

| 命令                                    | 用途                                                             |
| --------------------------------------- | ---------------------------------------------------------------- |
| `corepack pnpm dev`                     | Vite dev server（`/console/**` 代理到 127.0.0.1:8080）           |
| `corepack pnpm build`                   | `tsc --noEmit` + `vite build`，产物 `dist/`（含 `version.json`） |
| `corepack pnpm typecheck`               | TS 检查                                                          |
| `corepack pnpm lint` / `lint:fix`       | ESLint（含两条项目自定义规则，见 `eslint.config.js`）            |
| `corepack pnpm format` / `format:check` | Prettier                                                         |

提交卡点：husky `pre-commit` = `lint-staged`（eslint --fix + prettier）+ `tsc --noEmit`。

## 2. 工程结构

```
src/
├── api/        # 请求分层：config（adminPath 常量）→ http（三契约）→ request（信封/取消/防重）
│               # → adapters（4 种老信封归一化）→ query（错误策略）→ session（会话/心跳）
│               # → modules/（业务接口，与后端包结构对齐）
├── stores/     # zustand：permStore（权限码）、tabStore（多标签，sessionStorage 持久化）
├── routes/     # AppRoutes + RequireAuth + pageRegistry（路由与 keep-alive 共用登记表）
├── layouts/    # AppLayout（外壳容器）+ AppHeader + AppSiderMenu + AppTabsBar
├── pages/      # 外壳页（LoginPage / HomePage / LegacyPage）+ 业务域页面（{域}/...，
│               # 与老 JSP views/{域}/ 路径对应，方案 v3.1 §7.4）；devtools 为框架验证页（P0-c 验收后删）
├── components/ # PermButton / RouteErrorBoundary / NotifyHolder（App.useApp 桥）
├── utils/      # storage.ts（localStorage/sessionStorage 统一入口，mes: 前缀 + 版本号）
└── styles/     # global.css
```

**新增 React 页面**：在 `src/routes/pageRegistry.tsx` 登记一行即可（路由与多标签行为自动生效）。

## 3. 不可动的红线（详见服务端 skill）

- 三条契约：`X-Requested-With` 头、baseURL 同源相对路径、`withCredentials: true`
- 页面禁止直接 `import axios`；禁止裸 `window.open`/`top.location`（ESLint 强制）
- TS 锁 5.9.x，**绝不升 TS 7**（断 typescript-eslint 链）；依赖精确版本 + 提交 `pnpm-lock.yaml`
- 图表默认 ECharts 6 + echarts-for-react；`@ant-design/charts` 聚合包已移除（修订 7 收口）
- 前端先构建、后端后打包（形态 B：dist 打进 war `/app/`）

## 4. 环境配置

- `.env.development` / `.env.production`：`VITE_API_BASE=/console`（同源相对路径，禁止绝对跨域地址）
- 运行时注入：`public/env.js`（`window.__ENV__`，部署期可改 `CONTEXT_PATH`/`ADMIN_PATH`/`APP_BASE`，不打包不 hash；优先级高于 `.env`，单一来源见 `src/api/config.ts`）
- 开发代理：`vite.config.ts` 把 `/console/**` 代理到 `127.0.0.1:8080`（`changeOrigin: false` 勿改）
- 契约版本号单一来源：`vite.config.ts` 的 `API_CONTRACT_VERSION`（经 `define` 注入 `import.meta.env.VITE_API_CONTRACT_VERSION`）
