# MES 前端升级验证工程（demoLst 分支）

React 19 + Ant Design 6 的前端骨架，用于验证"从 JSP 迁移到前后端分离"的整套方案。
**目标不是做完整功能，而是把地基和风险点一次性验证掉。**

---

## 1. 快速开始

### 前置条件

| 项 | 要求 | 说明 |
|---|---|---|
| Node | ≥ 20.19 或 ≥ 22.12 | 本机实测 v24.20.0 ✅ |
| pnpm | 任意较新版本 | 本机实测 12.3.4 ✅ |
| 后端 | Tomcat 8.5.34 跑在 `127.0.0.1:8080` | 未启动时页面会提示"网络连接失败"，属预期 |

### 启动后端

```bat
:: 位置：仓库根目录
start-tomcat-war-local.bat
```

用现有 WAR，跳过 Maven 构建。**启动后需等约 4 分钟**（Tomcat 要展开 276 MB 的 WAR 并初始化 Spring），
这期间前端会报网络错误，属正常。日志：

```powershell
Get-Content "$env:TOMCAT_HOME\logs\catalina.$(Get-Date -Format 'yyyy-MM-dd').log" -Encoding Default -Tail 40 -Wait
```

看到 `Server startup in ... ms` 就是好了。

### 启动前端

```powershell
cd demo-web
pnpm install          # 首次
pnpm dev
```

> ⚠️ **必须用 `http://127.0.0.1:5173` 访问，不要用 `http://localhost:5173`。**
> proxy target 是 `127.0.0.1`，如果页面 origin 是 `localhost`，浏览器会判定站点不一致，
> Shiro 的 `pw.session.id` 会被丢弃 → 表现为"刚登录就未登录"。详见 `vite.config.ts` 顶部注释。

### 登录

用你在老系统的工号密码。登录走的是**老系统的 Shiro 表单登录**
（`POST /console/aspanse/login`），**零后端改动**。登录后新老系统共享同一个
`pw.session.id`，在老 JSP 页面登录过的话，这里直接就是登录态。

### 生产构建

```powershell
pnpm build            # 产物在 demo-web/dist/
```

---

## 2. 目录结构与职责

```
demo-web/
├── src/
│   ├── api/                       ★ 封装核心
│   │   ├── types.ts               ApiError 分类 + PageResult 统一分页模型
│   │   ├── adapters.ts            ★ 4 种信封的识别与归一化（注册表，可扩展）
│   │   ├── adaptersDoc.ts         适配器说明（界面上展示，防误删）
│   │   ├── http.ts                axios 实例 + 拦截器（传输层）
│   │   ├── request.ts             信封解包 / Blob / 取消分组 / 便捷方法（调用层）
│   │   ├── query.ts               TanStack Query + 错误呈现决策
│   │   ├── errorReport.ts         错误上报
│   │   ├── session.ts             ★ 会话保活 + 认证（保留 session，不换 token）
│   │   └── modules/               分域接口函数（对齐后端 controller 包结构）
│   │       └── md/customer.ts     客户接口（真接口，可直接跑）
│   ├── components/
│   │   ├── PermButton.tsx         权限按钮
│   │   └── RouteErrorBoundary.tsx 渲染兜底
│   ├── layouts/AppLayout.tsx      外壳（菜单/顶栏/内容区）
│   ├── modules/                   业务页面（一个业务域一个目录）
│   ├── pages/LoginPage.tsx        登录页
│   ├── routes/                    路由表 + 守卫
│   ├── stores/permStore.ts        权限码集合
│   └── main.tsx                   入口
├── deploy/
│   └── nginx.conf.sample          ★ 反代 + 缓存策略配置样例
├── vite.config.ts                 proxy + 分包 + 哈希产物
└── .env.development / .env.production
```

**分层原则**：业务页面只 `import` 自己的 `api/modules/xxx`，
不直接碰 `axios`，也不需要知道后端有几种信封。

---

## 3. 三条改坏就是线上事故的契约

| 契约 | 位置 | 后果 |
|---|---|---|
| **`X-Requested-With: XMLHttpRequest`** | `http.ts` | 后端 `Servlets.isAjaxRequest` 依赖它决定 500 时输出纯文本还是渲染 HTML 页面。老前端靠 jQuery `$.ajax` 默认行为无意间满足；新前端不带 → 同一接口老页面调没事、React 调返回 HTML，极难排查 |
| **`baseURL` 必须同源相对路径** | `http.ts` / `.env.*` | 改成跨域绝对地址 → Shiro 1.2.6（早于 SameSite 规范）不写 SameSite → 浏览器按 Lax 处理 → `pw.session.id` 静默不发送 |
| **`withCredentials: true`** | `http.ts` | 漏了就是"登录成功但每个请求都未登录" |

---

## 4. 后端实际有 4 种响应信封

全部来自对真实代码的排查，不是推测。详见 `src/api/adapters.ts` 与界面上的
「接口封装说明」页。

| 优先级 | 适配器 | 识别条件 | 真实来源 |
|---|---|---|---|
| 10 | `retCodeAdapter` | `retCode` + (`retMsg`\|`page`\|`data`) | `BaseMdCustomerController.mdCustLookUp` ← **本 Demo 用的** |
| 20 | `restResultAdapter` | `typeof result === 'boolean'` | `entity` 模块自带的 `RestResult<T>`；`WmsInventoryController` / `PmRepairController` / `LotController` / `InvController` |
| 30 | `jqGridAdapter` | `Array.isArray(rows) && 'records' in body` | jqGrid 经典分页 |
| 1000 | `rawAdapter` | 恒 true（兜底） | 大量裸 `List`/`Map`/实体；含 `WmsInventoryController:654` 的 `return ... ? "Y" : "N"` 裸标量 |

**加第 5 种信封的做法**：在 `adapters.ts` 里加一个对象 + 一行注册，
`request.ts` 和所有业务接口代码零改动。

---

## 5. 错误处理设计

### 分类与呈现决策

| kind | 触发场景 | 谁提示 | 提示内容 |
|---|---|---|---|
| `network` | 断网 / 后端未启动 | 拦截器 | 网络连接失败 |
| `timeout` | 超时 | 拦截器 | 请求超时（**不用"失败"措辞** —— 本项目慢接口多） |
| `canceled` | 表格切页 / 重复查询 | **静默** | — |
| `unauthenticated` | 401，或被 302 到登录页 | 拦截器 | 跳登录 + 保留当前路由 |
| `forbidden` | 403 | 拦截器 | 无权限 |
| `server` | 5xx（后端返回**纯文本 Java 堆栈**） | 拦截器 + 上报 | 系统异常（**绝不把堆栈上屏**） |
| `business` | 信封 `result:false` / `retCode!=='0'` | **组件自己处理** | — |

> **铁律**：拦截器只处理框架级错误。业务错误抢过来弹全局 toast，
> 会导致"表单提交失败只飘了个 toast，用户不知道哪个字段错了"。

### 为什么 500 的处理这么重要

后端没有全局异常处理器，未捕获异常走 `web.xml` 的 `500.jsp`；
该页面对 Ajax 请求直接 `out.print(堆栈)`。也就是说**后端会把完整 Java 堆栈吐给前端** ——
既有信息泄露，又会让 `JSON.parse` 抛出毫无指向性的错误。
`request.ts` 用 `looksLikeStackTrace()` 嗅探并转成 `server` 错误。

### 错误码映射在前端

后端大量地方是 `throw new RuntimeException("操作异常！")`，`msg` 不可靠。
所以 `query.ts` 里的 `ERROR_MESSAGES` **前端映射优先，未命中才用后端 msg**，
未命中时还能据此发现后端漏定义的码。目前后端 `errors.properties` 只有 3 个码，先对齐它。

---

## 6. 认证：为什么保留 session 而不换 token

**认证与权限解析在 `SystemAuthorizingRealm` 里，而它不在工作区源码中**：

- 全仓库搜不到 `SystemAuthorizingRealm.java`
- 只在 `spring-context-shiro.xml:100` 被 `<property name="realm" ref="..."/>` 引用
- 只在 2 个文件里被 import
- 它的 sources jar 是 1 KB（空）

**安全层实现读不到、改不动。** 换 token 必然形成两套认证并行，
登录态/超时/权限缓存在两套系统间对不齐 —— 这是最坏的结果。

同源反代下 cookie 自动携带、自动过期、自动跨标签页共享，
session 本身就是更安全的 token（`HttpOnly` 防 XSS，浏览器托管）。

### 真正要补的三个缺口（已在 `session.ts` 实现）

| 缺口 | 后果 | 方案 |
|---|---|---|
| 无心跳 | `session.sessionTimeout=1800000ms`(30min)，用户填长表单时静默过期，提交时跳登录、**数据全丢** | 5 分钟心跳（远小于 30 分钟）+ 失败指数退避 |
| 无可见性联动 | 多个标签页同时打后端 | 标签页隐藏时停跳，切回来立即验活 |
| 无草稿保护 | 同上 | 见 README 第 8 节 |

---

## 7. 权限

### 现状：两层权限，数据模型现成

- 菜单级：`Menu.permission`（`entity/main/Menu.java:21`）
- 按钮级：`AdMenuButton.buttonCode`（`entity/base/ad/AdMenuButton.java:16`），配套 Controller/Service/Dao 全在

### 设计：一次拿全量权限码，前端本地判断

不要逐个调 `Subject.isPermitted(code)` 问后端 —— 一个列表页 10+ 个按钮就是 10+ 次往返。
`/api/v1/me` 一次返回 `perms: string[]`，存进 `permStore`，`PermButton` 本地判断。

### ⚠️ 前端权限只是体验，不是安全边界

`PermButton` 控制的是"按钮显不显示"。真正的防线是后端 ——
老系统已用 Shiro 的 `perms[...]` 在跑（如 `/html/act/rest/service/editor/** = perms[act:model:edit]`）。
**新增的 `/api/v1/**` 接口必须补 `@RequiresPermissions`**，
否则会出现"前端按钮藏了，用户 F12 直接 POST 接口把数据删了"。

### ⚠️ 待确认：权限码格式（开工第一天必做）

Shiro filterChain 里是**冒号三段式**（`act:model:edit`），
但 `AdMenuButton.buttonCode` 实际存什么格式**无法从源码确定**
（`SystemAuthorizingRealm` 在 jar 里且 sources 为空）。

```sql
SELECT button_code, button_name FROM ad_menu_button WHERE ROWNUM <= 30;
SELECT permission FROM ad_menu WHERE permission IS NOT NULL AND ROWNUM <= 30;
```

拿到真实格式后替换 `src/stores/permStore.ts` 里的 `PERM` 常量。
**猜错的结果是：所有按钮永远不显示，或者永远显示。**

---

## 8. 已知待办 / 待运行时确认

| # | 事项 | 怎么确认 | 现在的兜底 |
|---|---|---|---|
| 1 | **老 `Page` 类的字段名** | Tomcat 起来后 F12 看 `/console/aspanse/md/mdCustomer/mdCustLookUp` 响应的 `page` 字段结构 | `normalizeLegacyPage` 用多候选兼容（`list/result/rows/data`、`count/total/totalCount/records`）。**猜错不崩，但可能 total 显示 0** —— 见 Demo 页底部的"调试信息"卡片 |
| 2 | **`buttonCode` 真实格式** | 上面那两条 SQL | `PERM` 常量占位 |
| 3 | **`mdCustLookUp` 的查询参数名** | F12 看老页面实际发的请求参数 | 目前透传 `custCode`/`custName`/`custType`，`Page` 从 request 取分页参数 |
| 4 | **Ant Design Charts 在 React 19 下能否渲染** | 打开「后续模块 → 图表验证」页 | `RouteErrorBoundary` 兜住不会白屏。崩了就启用 ECharts 逃生舱 |
| 5 | **心跳能否保持 session** | 闲置 10 分钟后发请求，看是否掉登录 | 5 分钟心跳 |

### 图表逃生舱

`@ant-design/charts@2.6.7` 的 peer 声明是 `react >=16.8.4`，
所以**安装不会报错**；但它的依赖链是 `@ant-design/plots` + `@ant-design/graphs`，
历史上出现过 React 19 运行时问题（[issue #2809](https://github.com/ant-design/ant-design-charts/issues/2809)）。
**peer 没问题 ≠ 运行时没问题**，所以单独做了验证页。

真出问题时：常规图表继续用 Ant Design Charts，
**SPC 控制图 / 晶圆图（wafer map）这类复杂可视化直接用 ECharts** ——
老系统本来就有 ECharts 3.3.2 / 5.5.1 资源和 26 个 `EchartsController` 接口。

---

## 9. 后端待办（纯新增，不改任何现有逻辑）

前端已按下列接口约定编码，未就绪时会优雅退化（见 `session.ts` 的 `checkSession`）：

| 接口 | 用途 | 前端调用点 |
|---|---|---|
| `GET ${adminPath}/api/v1/me` | 当前用户 + 权限码集合 | `session.ts`（未实现时退化为探活老接口） |
| `POST ${adminPath}/api/v1/login` | JSON 登录（替代表单登录） | `session.ts` 的 `login()`，未实现时用 Shiro 表单登录 |
| `POST ${adminPath}/api/v1/error-report` | 前端错误上报 | `errorReport.ts`（未实现时只打 console） |

必需的一处新增（否则 500 会把堆栈吐给前端）：

```java
// ★ basePackages 必须严格限定，绝不能扫到老 Controller ——
//   老 JSP 页面依赖 500.jsp 渲染 HTML，全局改异常处理会废掉 2594 个页面
@ControllerAdvice(basePackages = "com.pwsmart.console.web.api")
public class ApiExceptionAdvice { /* ... */ }
```

---

## 10. 验证清单（Phase 0 验收项）

### 前端渲染

- [ ] `pnpm dev` 起来，登录页正常显示
- [ ] 用工号登录成功，进入外壳，顶栏显示用户名
- [ ] 「客户查询」页拉到真实数据（**证明信封适配器工作**）
- [ ] 底部"调试信息"卡片里 `total` / `list 长度` 合理（**验证 `page` 字段名猜对没有**）
- [ ] 翻页、改查询条件不闪白（`keepPreviousData` 生效）
- [ ] 「图表验证」页三个图能渲染（**最高风险项**）

### 错误处理（逐条触发，见「错误处理验证」页）

- [ ] 后端 500 → 提示"系统异常"，**界面无 Java 堆栈**
- [ ] 停掉 Tomcat → 提示"网络连接失败"，不白屏
- [ ] 1ms 超时 → 提示"请求超时"
- [ ] 触发取消 → **无任何提示**
- [ ] 清掉 `pw.session.id` 再请求 → 自动跳登录

### 权限

- [ ] `/api/v1/me` 未实现时，`PermButton` 不会卡在 loading
- [ ] 接入后按钮按权限码正确显隐

### 缓存（生产部署后）

```bash
# 哈希产物：强缓存，第二次应命中磁盘缓存
curl -I https://<host>/assets/vendor-antd-xxxx.js
#   → Cache-Control: public, max-age=31536000, immutable

# index.html：协商缓存，不改则 304
curl -I https://<host>/index.html
#   → Cache-Control: no-cache + ETag

# ★ 发版后必须确认：index.html 拿到了新的哈希文件名
curl -s https://<host>/index.html | grep -o 'assets/[^"]*'
```

### 会话保活

- [ ] 闲置 10 分钟后操作，不掉登录（心跳生效）
- [ ] 标签页切到后台再切回，请求正常

---

## 11. 部署

见 [`deploy/nginx.conf.sample`](deploy/nginx.conf.sample)。

**核心思路**：前端静态文件与后端 Tomcat **物理独立部署**，
但通过 Nginx 反代保持**同源** —— 这样"前端独立发版"的收益拿到了，
而跨域带来的 cookie / HTTPS / CORS 代价一个都不用付。

**缓存策略一句话**：`index.html` 走协商缓存，哈希产物走强缓存 1 年 + `immutable`。
`index.html` 一旦被强缓存，用户就永远拿不到新的哈希文件名 → 发的版永远不生效。

---

## 12. 下一步

1. 跑完第 10 节验证清单
2. 把第 8 节 5 个待确认项落实到具体值
3. 后端新增 `/api/v1/me` + `ApiExceptionAdvice`（纯新增）
4. 选试点切片：建议 `base/sm`（系统管理 56 页，无生产风险，且 `base/lookup` 那 60 个共享选择器是后续必经之路）
