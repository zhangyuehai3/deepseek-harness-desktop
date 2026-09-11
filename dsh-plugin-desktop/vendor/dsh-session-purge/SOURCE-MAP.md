# 删除对话功能 —— 源码位置索引

**文档版本**：2026-09-10
**对应应用**：EZAI Desktop 2.0.4（`dsh-plugin-desktop`）
**文档性质**：纯位置索引。功能的作用、原理与踩坑记录见同目录 `README.md`。

本文所有行号均**实测核对过**，对应上表所列版本。上游包升级后行号可能偏移，
请以函数名/特征字符串为准检索。

---

## 0. 速查：三个最重要的位置

| 想改什么 | 去哪里 |
|---|---|
| **删文件的逻辑** | `lib/index.js:123` `__purge()` |
| **「未分组」→「回收站」文案** | `$A/dsh-client-ui-workspace/lib/types/client/locales.js:8,73`（由我的 `lib/client.js:563` 改写） |
| **客户端为什么拒收响应**（坑 4 根因） | `$A/dsh-client-connection/lib/client.js:4897` `rpcErrorSchema` |

下文 `$A` 一律指：

```
$A = /Applications/EZAI Desktop.app/Contents/Resources/app.asar.unpacked/node_modules/@deepseek-ai
```

---

## 1. 我写的代码（功能本体）

### 1.1 两份副本（重要）

| 用途 | 路径 |
|---|---|
| **源码**（可版本管理、编辑这份） | `<repo>/report/dsh-session-purge/` |
| **已安装**（应用实际加载这份） | `~/.dsh/profiles/dsh-session-purge/` |

> **改源码不会自动生效。** 必须重新拷贝并重启：
>
> ```bash
> cp <repo>/report/dsh-session-purge/lib/*.js ~/.dsh/profiles/dsh-session-purge/lib/
> # 然后 ⌘Q 重启 EZAI（Host 侧插件只在启动时加载）
> ```

### 1.2 文件清单

| 文件 | 行数 | 职责 |
|---|---|---|
| `lib/index.js` | 460 | **Host 侧删除逻辑**（核心） |
| `lib/rpc.js` | 174 | 私有 RPC 通道 + 错误码映射 |
| `lib/client.js` | 643 | 浏览器 UI（面板、确认框、改名） |
| `package.json` | 33 | 声明 `dsh.client` → 前端 bundle 才会被扫描 |
| `cordis.patch.yml` | 9 | 插件自带的加载器行（未使用，见 §4） |
| `README.md` | 445 | 原理、部署、回滚、五个坑 |

### 1.3 `lib/index.js` —— 删除逻辑

```
 26  SessionPurgeErrorCode        错误码枚举（内部精确码）
 40  SessionPurgeError            带 code/sessionId 的 Error 子类
 64  SessionPurgeService          cordis Service（服务名 sessionPurge）
 83    constructor
 94    delete(sessionId)          ★ 对外入口：校验 id + 按 id 串行化
123    __purge(id)                ★★ 主流程（下面展开）
232    __purgeSidecars(id)          清 feedback / projcache 两张表
272    __dropDomainRow()            经 storageDomain 删一行
311    __detachAttached(id)       ★ 持久化屏障（sessions.flush）
360    __purgeAccounting()          调 workspace.detachSession
387  sessionOwnedDirectory()      ★ 从日志路径推出"该删哪个目录"
409  purgeStep()                  单步 best-effort 包装
425  withTimeout()                 超时保护
445  describe()                    错误转字符串
455  apply(ctx)                    cordis 插件入口
```

**`__purge()` 的执行顺序**（`lib/index.js:123`）：

```
1. agents.get(id)?.status === 'running'  → 是则拒绝（SESSION_PURGE_LIVE）
2. sessionPersistence.list()             → 找不到则拒绝（NOT_FOUND）
3. __detachAttached(id)                  → flush 持久化屏障
4. sessionPersistence.locate(meta)       → 算出日志路径
5. rm -rf sessionOwnedDirectory(...)     → ★ 真正删文件
6. __purgeSidecars(id)                   → 清派生数据（best-effort）
7. __purgeAccounting()                   → 清 workspace 记账（失败则报错）
```

### 1.4 `lib/rpc.js` —— 传输层

```
 32  PURGE_CHANNEL = '/session-purge'     私有通道名
 35  PURGE_ENDPOINT = 'delete'            唯一端点
 48  success(rpcId, value)                成功包
 61  failure(rpcId, code, message, details) 失败包
 76  wireError(error, sessionId)        ★★ 内部码 → 客户端封闭词表（坑 4 修复点）
125  dispatch(ctx, endpoint, payload)     端点分发
162  mountPurgeChannel(ctx)               注册通道（connection.rpc.handle）
```

**`wireError()` 映射表**（`lib/rpc.js:76`）：

| 内部码 | 上线码 | details 形状 |
|---|---|---|
| `SESSION_PURGE_NOT_FOUND` | `session-not-found` | `{ sessionId }` |
| `SESSION_PURGE_LIVE` | `session-conflict` | `{ sessionId, requestedCwd: '' }` |
| `SESSION_PURGE_INVALID_ID` | `bad-request` | `{ issues: [...] }` |
| `LOG_REMOVAL_FAILED` / `ACCOUNTING_FAILED` | `internal` | `{}`（精确码写进 message） |

> `details` 形状必须匹配目标码的声明，否则照样被客户端拒收。

### 1.5 `lib/client.js` —— 浏览器 UI

```
 23  const zh = {...}                    中文字典
 55  const en = {...}                    英文字典
 87  CHANNEL / ENDPOINT                  与 Host 对齐
138  timeLabel()                         相对时间（刚刚/3分钟/2小时）
201  displayNameOf(row)                  标题回退链
220  PurgeRow()                       ★ 单行：状态 + 删除按钮（running 时禁用）
273  PurgePanel()                     ★ 面板主体（列表、搜索、确认框、成功横幅）
504  PurgeFootAction()                   侧边栏底部触发器 + 挂载面板
563  relabelUngroupedBucket()         ★★「未分组」→「回收站」改写
611  exports.inject = [...]              依赖的五个服务
619  exports.apply(ctx)                  插件入口
```

**`PurgePanel()` 的三条过滤**（`lib/client.js:273` 内）：

```js
if (summary.origin === "subagent") continue;   // 子代理会话：内部子节点
if (summary.blank === true) continue;          // 空白"新会话"行：尚无日志
if (archived.has(id)) continue;                // 已归档：侧边栏也不显示
```

三者缺一，就会出现"删了没反应"的错觉（坑 3）。

---

## 2. 上游依赖：Host 侧

### 2.1 会话日志的存储与路径

| 位置 | 符号 | 作用 |
|---|---|---|
| `$A/dsh-session-persistence-jsonl/lib/index.js:803` | `locate(meta)` | 由 header 算出日志绝对路径 |
| `$A/dsh-session-persistence-jsonl/lib/index.js:1037` | `list()` | 列出磁盘上所有会话 header |
| `$A/dsh-session-persistence-jsonl/lib/index.js:133` | `projectDir(root, cwd)` | `<root>/<projectKey(cwd)>/` |
| `$A/dsh-session-persistence-jsonl/lib/index.js:145` | `sessionDir(...)` | `.../<encodeSegment(id)>/` |
| `$A/dsh-session-persistence-jsonl/lib/index.js:156` | `logPath(...)` | `.../session.jsonl[.zstd]` |

实际磁盘布局：

```
~/.dsh/sessions/--Users-<user>-Documents-EZAI--/session-<uuid>/session.jsonl.zstd
                 └── projectDir ─────────────────┘ └─ sessionDir ─┘ └─ logPath ─┘
```

`sessionOwnedDirectory()`（我的 `lib/index.js:387`）删的是 **`sessionDir`** 那一层，
即 `session-<uuid>/` 整个目录，而不是单个日志文件 —— 该目录为会话独占。

### 2.2 持久化与写穿

| 位置 | 符号 | 作用 |
|---|---|---|
| `$A/dsh-session-persistence/lib/types/coordinator.js:1084` | `flush(session)` | 持久化屏障，我的 `__detachAttached` 调用它 |
| `$A/dsh-session-persistence/lib/types/coordinator.js:469` | `append(id, events)` | 追加事件（日志物化的唯一途径） |
| `$A/dsh-session-persistence/lib/types/coordinator.js:897` | `retire(session)` | 会话销毁时排空缓冲 |

> `create()` 是**惰性**的：只记录意图，不落盘。日志要等第一次 `append()` 才实体化。
> 写测试 fixture 时必须注意这点。

### 2.3 workspace 记账

| 位置 | 符号 | 作用 |
|---|---|---|
| `$A/dsh-workspace/lib/index.js:124` | `detachSession(sessionId)` | 把 id 从工作区 `sessionIds` 摘除 |
| `$A/dsh-workspace/lib/index.js:412` | `get archivedSessionIds` | 全局归档集合（侧边栏据此隐藏） |
| `$A/dsh-workspace/lib/index.js:422` | `archiveSession(sessionId)` | 归档（**本版本无取消归档**） |

### 2.4 运行状态判据（坑 5）

| 位置 | 符号 | 作用 |
|---|---|---|
| `$A/dsh-host-apiproxy/lib/types/api-proxy.js:1412` | `agent?.status === 'running'` | ★ 全应用统一的"是否在跑"判据 |
| `$A/dsh-agent/lib/index.js:688` | `agents.get(id)` | 取 live agent |

我的 `lib/index.js:123` 用的是**同一个谓词**，这样闸门与侧边栏显示的
「进行中/空闲」永远一致。

---

## 3. 上游依赖：传输协议

### 3.1 通道注册（Host 侧）

| 位置 | 符号 |
|---|---|
| `$A/dsh-client-connection/lib/index.js:219` | `get rpc()` → `{ handle, intercept }` |
| `$A/dsh-client-connection/lib/index.js:275` | `rpcFetchHandler(channel, handler)` |
| `$A/dsh-client-connection/lib/index.js:310` | `endpointFromPath(channel, pathname)` |
| `$A/dsh-client-connection/lib/index.js:259` | `registerInterceptor(...)`（我未使用） |

### 3.2 ★ 客户端封闭错误码联合（坑 4 的根因）

**这是整个功能里最反直觉的一处。**

| 位置 | 符号 |
|---|---|
| `$A/dsh-client-connection/lib/client.js:4897` | `const rpcErrorSchema = discriminatedUnion("code", [...])` |
| `$A/dsh-client-connection/lib/client.js:5147` | `rpcResultSchema(value)` |
| `$A/dsh-client-connection/lib/client.js:5164` | `serverResponseSchema` |
| `$A/dsh-client-connection/lib/client.js:10206` | `createWebConnectionRpc()` → `rpc.call()` |

`rpcErrorSchema` 是**封闭判别联合**，共 40 个合法 `code`：

```
bad-request  cancelled  session-not-found  model-unavailable  session-conflict
invalid-time-zone  workspace-attach-failed  workspace-not-found
workspace-invalid-path  workspace-name-conflict  workspace-move-invalid
directory-unreadable  directory-exists  directory-create-failed
directory-picker-unavailable  agent-preset-read-only  agent-preset-locked
agent-preset-conflict  agent-preset-not-found  agent-preset-invalid
agent-busy  attachment-error  queue-item-not-found  steer-unavailable
command-error  unknown-command  settings-rejected  settings-conflict
credential-rejected  model-discovery-failed  title-invalid  fork-unavailable
subagent-parent-unavailable  subagent-not-found  subagent-catalog-diagnostic
corrupt  unsupported  unavailable  subagent-not-resumable  subagent-unauthorized
subagent-delivery-unavailable  internal
```

**任何不在此列的 `code` 都会导致客户端抛 `invalid_union / No matching discriminator`，
响应根本到不了插件代码。** 且每个 `code` 的 `details` 形状也有固定要求。

> **私有通道只绕开了出站（请求侧）的方法表；入站（响应侧）的包校验是共用的。**
> 这一点在实现时极易误判。

---

## 4. 上游依赖：UI 与启动

### 4.1 插槽系统

| 位置 | 符号 | 作用 |
|---|---|---|
| `$A/dsh-client-ui-sidebar/lib/types/client/index.js:27` | `sidebar.workspaces` | 会话列表（single 槽，上游 UI 独占） |
| `$A/dsh-client-ui-sidebar/lib/types/client/index.js:29` | `sidebar.footer.action` | ★ 我注册的槽（list 槽） |
| `$A/dsh-client-ui-slots/lib/index.js:64` | `register(options, component)` | 槽位注册（同 id 同优先级会抛错） |
| `$A/dsh-client-ui-slots/lib/index.js:179` | `entriesOfSlot(key)` | 影子选举：每个 cell 只留首个 |
| `$A/dsh-client-ui-renderer/lib/types/client/scoped-slots.js:583` | list 槽渲染 | 每 id 一行 |
| `$A/dsh-client-ui-renderer/lib/types/client/scoped-slots.js:347` | `kit['t'] = localeSeat(...)` | `t` 座位的来源 |

**`sidebar.workspaces` 为什么不能复用**：上游把整个会话列表注册成一个
single 槽，而其内部组件（行渲染、菜单、弹窗）**都没有从包里导出**
（`lib/client.js` 只导出 `apply` / `inject`）。要往会话行菜单加一项，
只能整体接管该槽 —— 等于重写约 1300 行上游 UI。

### 4.2 ★「未分组」文案

| 位置 | 内容 |
|---|---|
| `$A/dsh-client-ui-workspace/lib/types/client/locales.js:8` | `'group.ungrouped': '未分组'` |
| `$A/dsh-client-ui-workspace/lib/types/client/locales.js:73` | `'group.ungrouped': 'Ungrouped'` |
| `$A/dsh-client-ui-workspace/lib/types/client/rows/Rows.js:65` | 渲染处 `t('group.ungrouped')` |

**为什么不能正常覆盖**：

| 位置 | 符号 | 限制 |
|---|---|---|
| `$A/dsh-client-locale/lib/types/client/index.js:57` | `dicts = new Map()` | 结构：`Map<命名空间, Map<语言, 字典>>` |
| `$A/dsh-client-locale/lib/types/client/index.js:141` | `register(ns, dicts)` | ★ **同命名空间+语言重复注册直接抛错** |
| `$A/dsh-client-locale/lib/types/client/index.js:192` | `lookup(ns, key)` | 查找链：`当前语言 ?? en 兜底 ?? key` |
| `$A/dsh-client-locale/lib/types/client/index.js:184` | `translate(ns, key, params)` | 参数插值 |

所以我的方案（`lib/client.js:563`）是**替换 `dicts` 里已存储的字典对象**，
并订阅 locale revision 反复补齐（因为应用顺序不保证）。

> **必须改写该命名空间下的每一种语言**，只补当前语言会留下过期字符串，
> 且切换语言时标题会回退。

### 4.3 启动与加载器

| 位置 | 符号 | 作用 |
|---|---|---|
| `/Applications/EZAI Desktop.app/Contents/Resources/app.asar.unpacked/lib/profile-H8bCsCsN.js:649` | `loadOptionalPatches(BIN_NAME, join(home, PROFILE_PATCH_FILENAME))` | ★ **桌面版读 `$DSH_HOME/cordis.patch.yml`** |
| 同上 `:621` | `prepareDesktopProfile(...)` | 桌面版完整的 patch 组装流程 |
| `$A/dsh-app-boot/lib/index.js:793` | `loadOptionalPatches(binName, file)` | 读 patch 文件（ENOENT → undefined） |
| `$A/dsh-app-boot/lib/index.js:409` | `healProfilesModuleFallback(...)` | 每次启动维护 `profiles/node_modules` 软链 |
| `$A/dsh-app-boot/lib/index.js:353` | `initProfile(dir, bundles)` | 仅当文件不存在时才创建 |
| `$A/dsh-client-modules/lib/index.js:276` | `resolvePkgJson` | 由 `ctx.baseUrl` 解析插件包 |
| `$A/dsh-client-modules/lib/index.js:421` | `processOne(entryName)` | 扫描 `dsh.client` 决定是否出 bundle |
| `$A/dsh-client-modules/lib/index.js:459` | `serveBundle` | 服务 `/plugins/<id>/client.js` |

**关键区别**（坑 1 的根因）：

| 启动方式 | 用户 patch 层位置 |
|---|---|
| **桌面版**（EZAI Desktop） | `$DSH_HOME/cordis.patch.yml` ← **实际生效的是这个** |
| CLI（`dsh --profile X`） | `$DSH_HOME/profiles/X/cordis.patch.yml` |

---

## 5. 启用 / 停用位置

```bash
# ★ 唯一让插件生效的配置
~/.dsh/cordis.patch.yml
# 内容需包含：
#   - insert:
#       - id: session-purge
#         name: dsh-session-purge

# 插件包（应用从这里加载）
~/.dsh/profiles/dsh-session-purge/

# 使其可从 profile 解析的软链
~/.dsh/profiles/node_modules/dsh-session-purge -> ../dsh-session-purge
```

### 停用

```bash
# 1) 注释掉 ~/.dsh/cordis.patch.yml 里的 - insert: 三行
#    或彻底删除该文件
# 2) ⌘Q 重启 EZAI
```

### 完全卸载

```bash
rm -f  ~/.dsh/cordis.patch.yml
rm -rf ~/.dsh/profiles/dsh-session-purge
rm -f  ~/.dsh/profiles/node_modules/dsh-session-purge
```

### 配置备份

```
<repo>/report/backup-dsh-20260910-191920/
├── workspace.json
├── settings.yaml
└── profiles-desktop/{cordis.patch.yml,cordis.yml,package.json,settings.json}
```

---

## 6. 测试文件索引

| 文件 | 覆盖 | 防的坑 |
|---|---|---|
| `tests/host.purge.test.mjs` | 删除逻辑 10 个场景（真实 cordis + 真实 jsonl 后端） | 逻辑本身 |
| `tests/service.proxy.test.mjs` | 经 `ctx.get()` 代理调用 | 坑 2 |
| `tests/wire.schema.test.mjs` | 响应包过客户端真实 `serverResponseSchema` | 坑 4 |
| `tests/desktop.prepare.test.mjs` | 走桌面版真实 `prepareDesktopProfile()` | 坑 1 |
| `tests/boot.mount.test.mjs` | 插件是否真的挂载 + 服务是否可用 | 挂载 |
| `tests/upgrade.survival.test.mjs` | 版本升级后是否还在 | 升级 |
| `tests/client.bundle.test.mjs` | bundle 注册、字典对齐、无重复键 | 前端 |
| `tests/client.render.test.mjs` | 组件能否真的渲染（含归档过滤、禁用态） | 坑 3/5 |
| `tests/locale.relabel.test.mjs` | 改名（两种 apply 顺序 + 语言切换 + 降级） | 改名 |
| `tests/attached.idle.probe.mjs` | 探针：删附加会话日志是否会被重建 | 坑 5 决策依据 |
| `tests/locale.override.probe.mjs` | 探针：locale 覆盖哪条路可行 | 改名决策依据 |
| `tests/verify-live.sh` | 现场诊断（重启时间对比 + 抓 purge 日志） | 运维 |

**运行方式**（系统 PATH 无 `node`，须用 Electron 的 Node 模式）：

```bash
APP="/Applications/EZAI Desktop.app"
A="$APP/Contents/Resources/app.asar.unpacked"
WORK=$(mktemp -d) && cd "$WORK"
ln -sfn "$A/node_modules" node_modules
SRC=<repo>/report/dsh-session-purge

ELECTRON_RUN_AS_NODE=1 "$APP/Contents/MacOS/EZAI Desktop" "$SRC/tests/host.purge.test.mjs"
ELECTRON_RUN_AS_NODE=1 "$APP/Contents/MacOS/EZAI Desktop" "$SRC/tests/desktop.prepare.test.mjs" "$A"
ELECTRON_RUN_AS_NODE=1 "$APP/Contents/MacOS/EZAI Desktop" "$SRC/tests/client.render.test.mjs" "$SRC/lib/client.js"
```

---

## 7. 运行时诊断位置

| 内容 | 路径 |
|---|---|
| 应用日志（含 purge 诊断） | `~/Library/Application Support/EZAI Desktop/logs/dsh-YYYY-MM-DD.log` |
| 应用错误日志 | `~/Library/Application Support/EZAI Desktop/logs/dsh-YYYY-MM-DD.error.log` |
| 会话日志本体 | `~/.dsh/sessions/<projectKey>/<sessionId>/session.jsonl.zstd` |
| 工作区记账 | `~/.dsh/storages/workspace.json` |
| 投影缓存 / 反馈 | `~/.dsh/storages/session_projcache.json` 等 |

**Host 侧每次删除尝试都会记录**（`lib/rpc.js:125` dispatch 内）：

```
[session-purge] deleted "<id>": {removedPaths, sidecars, accounting}
[session-purge] delete refused for "<id>": <原因>
```

抓取：

```bash
grep -i "session-purge" ~/Library/Application\ Support/EZAI\ Desktop/logs/dsh-$(date +%Y-%m-%d).log
```

---

## 8. 五个坑 → 精确位置

| # | 症状 | 根因位置 | 我的修复位置 |
|---|---|---|---|
| **1** | 测试全绿但插件没加载 | `profile-H8bCsCsN.js:649`（桌面版读 `$DSH_HOME/cordis.patch.yml`，非 profile 目录） | `~/.dsh/cordis.patch.yml` |
| **2** | 一删就抛 `Cannot read private member` | cordis 服务代理 ≠ 构造实例，`#private` 穿不过 | `lib/index.js`（全改 `__` 前缀） |
| **3** | 点删除"没反应" | 我的面板未过滤已归档会话 | `lib/client.js:273`（`archived` 过滤） |
| **4** | 红色 `invalid_union` 报错 | `dsh-client-connection/lib/client.js:4897` 封闭错误码联合 | `lib/rpc.js:76` `wireError()` 映射 |
| **5** | 空闲会话也删不掉 | 我的闸门用"在内存中"，UI 标签用"agent 在跑" | `lib/index.js:123`（改用 `agent.status`） |

坑 4 与坑 5 最值得先读：前者是纯集成陷阱（不查源码想不到），
后者是设计不一致（判据与用户所见不符）。

---

## 9. 改动前的须知

1. **两份副本**：改 `<repo>/report/dsh-session-purge/` 后必须拷到
   `~/.dsh/profiles/dsh-session-purge/` 才生效。
2. **Host 侧改动必须重启**（⌘Q）；纯 `lib/client.js` 改动在
   `pnpm run dev:web` 运行时可能热更新，否则同样要重启。
3. **不要引入 `#private` 类字段/方法**（坑 2）。
4. **不要回传自定义错误码**（坑 4），必须经 `wireError()` 映射。
5. **不要用"在内存中"当安全闸门**（坑 5），用 `agents.get(id)?.status`。
6. **上游包一律不改**：全部依赖通过公开 API 或已核实的字段访问，
   升级 EZAI 不会覆盖本插件。详见 `README.md` 第 8 节。
