# 删除对话（dsh-session-purge）

给 EZAI Desktop 增加「永久删除对话」能力。侧边栏底部新增一个 **管理对话 / Manage conversations**
入口，列出全部对话，逐条可搜索、可删除；确认后由 Host 侧真正删除磁盘上的会话日志及其所有派生数据。

本插件作为一个**用户 profile 插件**安装，**没有修改任何上游 `@deepseek-ai/*` 包**，
因此 EZAI 升级不会覆盖它。

---

## 1. 它具体删除了什么

点一次「删除对话」并确认后，Host 侧按顺序执行：

| 步骤 | 动作 | 失败行为 |
|---|---|---|
| 1 | 拒绝：会话仍在内存中（有 agent 可能在跑） | 报错 `SESSION_PURGE_LIVE`，**不删任何东西** |
| 2 | 通过 `sessionPersistence.list()` 确认会话存在 | 报错 `SESSION_PURGE_NOT_FOUND` |
| 3 | 用 `sessionPersistence.locate()` 定位真实日志路径（**不硬编码目录布局**） | — |
| 4 | `rm -rf` 该会话**独占的目录**（含 `session.jsonl.zstd`） | 报错 `SESSION_PURGE_LOG_REMOVAL_FAILED` |
| 5 | 删除附属数据（尽力而为，失败只记录不阻断） | 见下 |
| 6 | 从 workspace 记账中摘除该会话 id（`detachSession`） | 报错 `SESSION_PURGE_ACCOUNTING_FAILED` |

第 5 步覆盖三个 sidecar：

- **`message_feedback`** —— 该会话的点赞/点踩行
- **`session_projcache`** —— 投影缓存行
- **`sessionQuery`** —— 全文搜索索引（本部署配置为 `openAt: never`，索引未开启，报告 `absent`）

> **只允许删除「冷」会话。** 会话一旦在内存中（正在聊天/有 agent 活动）就拒绝删除。
> 这是刻意的安全闸门：把日志从正在写入的 writer 脚下抽走会损坏存储。

---

## 2. 目录结构与部署位置

> **找代码位置？** 见 [`SOURCE-MAP.md`](./SOURCE-MAP.md) —— 逐函数行号索引，
> 含上游依赖位置（会话存储、RPC schema、locale、插槽、启动流程），
> 所有行号均已实测核对。

### 2.1 源码与安装位置

```
report/dsh-session-purge/              ← 源码（工作区内，可版本管理）
├── README.md                          ← 原理、部署、回滚、五个坑
├── SOURCE-MAP.md                      ← 逐函数行号索引（含上游依赖）
├── package.json
├── cordis.patch.yml                   ← 插件自带的 loader 行
├── lib/
│   ├── index.js                       ← Host：SessionPurgeService（ctx.sessionPurge）
│   ├── rpc.js                         ← Host：私有 RPC 通道 /session-purge
│   └── client.js                      ← 浏览器：管理对话面板
└── tests/                             ← 9 个测试套件 + 2 个探针 + 1 个诊断脚本
```

安装后的位置：

```
~/.dsh/profiles/dsh-session-purge/                     ← 插件包（由上面的源码复制而来）
~/.dsh/profiles/node_modules/dsh-session-purge  →  ../dsh-session-purge   （软链）
~/.dsh/profiles/desktop/cordis.patch.yml               ← 启用插件的 loader 行
```

---

## 3. 为什么用私有 RPC 通道，而不是扩展 `/api`

上游 `/api` 一元路由表是一个**封闭契约**，三处必须一致：

1. `dsh-host-apiproxy` 的 `UNARY_ROUTES` 路由表；
2. 同包的请求 schema；
3. **浏览器端** `dsh-client-connection` 里按方法名索引的响应值 schema 表。

第 3 处位于一个本插件不应修改的包内，新增方法会在客户端 `callUnary` 时抛
`UNARY_VALUE_SCHEMAS[method] is undefined`。因此本插件改用
`connection.rpc.handle('/session-purge', ...)` 注册一条**自己的通道**，
仍然走同一套 `/api` 传输与浏览器信任栅栏，但完全与上游解耦。

---

## 4. 为什么 UI 没有做成「会话行右键菜单」

上游把整个侧边栏会话列表注册为一个不可分割的 `sidebar.workspaces` 槽位
（`dsh-client-ui-workspace`），而它的内部组件（行渲染、菜单、弹窗）**都没有从
包里导出** —— 包只导出 `apply` / `inject`。要在会话行的「⋯」菜单里加一项，
只能整体接管该槽位，等于重写约 1300 行上游 UI（工作区分组、拖拽排序、搜索、
悬浮卡、右键菜单），且 EZAI 升级后极易失配。

因此本插件改为在 `sidebar.footer.action` 这个**列表槽位**新增自己的入口，
完全不碰上游 UI 代码。

---

## 5. 部署 / 重新部署

```bash
SRC=<repo>/report/dsh-session-purge
DST=~/.dsh/profiles/dsh-session-purge

mkdir -p "$DST/lib"
cp "$SRC/package.json" "$SRC/cordis.patch.yml" "$DST/"
cp "$SRC"/lib/*.js "$DST/lib/"
ln -sfn ../dsh-session-purge ~/.dsh/profiles/node_modules/dsh-session-purge
```

然后确认 `~/.dsh/profiles/desktop/cordis.patch.yml` 含：

```yaml
- insert:
    - id: session-purge
      name: dsh-session-purge
```

**改完 Host 侧代码必须重启 EZAI**（loader 行只在启动时读取）。
只改 `lib/client.js` 时，如果 `pnpm run dev:web` 在跑，浏览器 bundle 可以热更新。

### 停用

注释掉 `cordis.patch.yml` 里那一行并重启即可，插件不会加载。
插件自身不写入任何全局状态，停用后无残留。

---

## 6. 测试

九个测试都需要在「能解析到 app 的 node_modules」的目录下运行，
并用 Electron 以 Node 模式执行（系统 PATH 里没有 `node`）：

```bash
APP="/Applications/EZAI Desktop.app"
A="$APP/Contents/Resources/app.asar.unpacked"
WORK=$(mktemp -d) && cd "$WORK"
ln -sfn "$A/node_modules" node_modules
SRC=<repo>/report/dsh-session-purge
NODE="ELECTRON_RUN_AS_NODE=1 \"$APP/Contents/MacOS/EZAI Desktop\""

eval $NODE "$SRC/tests/host.purge.test.mjs"
eval $NODE "$SRC/tests/service.proxy.test.mjs"
eval $NODE "$SRC/tests/wire.schema.test.mjs" "$A"
eval $NODE "$SRC/tests/desktop.prepare.test.mjs" "$A"
eval $NODE "$SRC/tests/boot.mount.test.mjs" "$A"
eval $NODE "$SRC/tests/upgrade.survival.test.mjs" "$A"
eval $NODE "$SRC/tests/client.bundle.test.mjs" "$SRC/lib/client.js"
eval $NODE "$SRC/tests/client.render.test.mjs" "$SRC/lib/client.js"
eval $NODE "$SRC/tests/locale.relabel.test.mjs" "$SRC/lib/client.js"
```

| 测试 | 防的是哪一类 bug |
|---|---|
| `host.purge.test.mjs` | 删除逻辑本身（9 个场景，见下） |
| `service.proxy.test.mjs` | **坑 2**：`#private` 穿不过 cordis 服务代理 |
| `wire.schema.test.mjs` | **坑 4**：自定义错误码被客户端 schema 拒收 |
| `desktop.prepare.test.mjs` | **坑 1**：loader 行写错文件（桌面版读 `$DSH_HOME/cordis.patch.yml`） |
| `boot.mount.test.mjs` | 插件是否真的挂载、服务是否可用 |
| `upgrade.survival.test.mjs` | 版本升级后是否还在（见第 8 节） |
| `client.bundle.test.mjs` | bundle 能否注册、字典中英文是否对齐、有无重复键 |
| `client.render.test.mjs` | 面板能否真的渲染出来（含归档过滤） |
| `locale.relabel.test.mjs` | 「回收站」改名（两种 apply 顺序 + 语言切换 + 降级） |

> 教训：**测试必须走应用真正走的那条路。** 坑 1、2、4 全都是
> 「单元测试直接调实例 / 读了另一个文件 / 手抄了一份 schema」导致的假通过。

### `host.purge.test.mjs` 覆盖的场景（9 个，全部通过）

在**真实的** cordis 上下文 + **真实的** jsonl 持久化后端 + 临时目录上运行：

1. 删除冷会话 → 目录与日志文件确实消失、列表里不再出现
2. 内存中的会话 → 拒绝，且**日志存活**
3. 不存在的会话 → `NOT_FOUND`
4. 空白 id → `INVALID_ID`
5. workspace 记账 → 调用 `detachSession`，兄弟会话保留槽位
6. sidecar → feedback 与 projcache 两行实际被删除
7. 未挂载 `storageDomain` → 不报错，删除照常成功
8. 删除一个会话不影响兄弟会话
9. 同一 id 并发删除 → 严格串行，恰好一次成功

### 现场诊断

重启应用后运行，会并排打印「应用日志时间 vs 插件部署时间」并抓取 purge 诊断日志：

```bash
bash report/dsh-session-purge/tests/verify-live.sh
```

### 已知的测试 fixture 注意点

- `sessionPersistence.create()` 是**惰性**的（只记录意图，不落盘）；
  日志要等第一次 `append()` 才实体化。fixture 因此必须 append 一个事件。
- 根 `Context` 的销毁方法是 `ctx.fiber.dispose()`，不是 `ctx.stop()`。
- 真实的 `@deepseek-ai/dsh-client-ui-primitives` 会 import `.css`，只有打包器能解析；
  渲染测试因此用同名哑组件替换它。
- `AbstractApiClient.callUnary` 解析完响应包后还会查一张「按方法名索引的值 schema 表」，
  该表只含共享 `/api` 方法。测试私有方法时会在那一步抛错 —— 那恰好证明响应包已被接受。

---

## 7. 回滚

改动前的配置备份在：

```
report/backup-dsh-<时间戳>/
├── workspace.json
├── settings.yaml
└── profiles-desktop/{cordis.patch.yml,cordis.yml,package.json,settings.json}
```

完整回滚：

```bash
rm -rf ~/.dsh/profiles/dsh-session-purge
rm -f  ~/.dsh/profiles/node_modules/dsh-session-purge
# 然后把 backup 里的 profiles-desktop/cordis.patch.yml 还原回去
```

再重启 EZAI。

---

## 8. 版本升级后会不会丢？

**不会。** 这一点对着 EZAI 2.0.4 的**实际启动代码**逐条验证过，不是推测。

关键在于：本插件的三个组成部分**全部位于 `~/.dsh/`（用户数据目录）**，
而 EZAI 应用本体位于 `/Applications/EZAI Desktop.app/`。
覆盖安装只替换 app bundle，**不触碰 `~/.dsh/`**。

启动序列里唯一会写 `~/.dsh/profiles/` 的是 `healProfilesModuleFallback()`
（`dsh-app-boot`，每次启动都跑）。它的实现只对「app 自身依赖闭包」里的包做
`mkdirSync` + `ensureSymlink`，**没有任何删除或清理无关条目的逻辑**，
所以不会碰到 `dsh-session-purge` 这个软链。

另外三条已验证的写入路径同样安全：

| 写入者 | 行为 | 影响本插件？ |
|---|---|---|
| `healProfilesModuleFallback` | 只补 app 依赖闭包的软链，从不删除 | 否 |
| `initProfile` | 仅在 `cordis.patch.yml` **不存在时**才创建 | 否（文件已存在） |
| `normalizeShippedProfile` | 只重写 `dsh.profile.bundles`，`...manifest` 原样保留 | 否 |
| `dsh-community-market` 装/卸插件 | 只跑 `pnpm add <包名>` / `pnpm remove <包名>`，单包粒度，无全局 prune | 否 |

### 实测证据

`tests/upgrade.survival.test.mjs` 直接调用**新版 app 自己的启动代码**
（`healProfilesModuleFallback` + `loadProfile` + `composeEntries`），
对真实的 `~/.dsh/profiles/desktop` 跑一遍模拟升级启动，再比对前后状态：

```
BEFORE:  link:             symlink -> ../dsh-session-purge
         patch md5:        c34cbdab...
         package.json md5: 3f510696...

AFTER:   link:             symlink -> ../dsh-session-purge
         patch md5:        c34cbdab...  (UNCHANGED)
         package.json md5: 3f510696...  (UNCHANGED)
         session-purge row: {"id":"session-purge","name":"dsh-session-purge"}
```

全部断言通过 —— **能活过升级的启动序列**。

### 升级后唯一可能出现的情况

上游若发布**破坏性变更**（例如改掉 `sessionPersistence.locate()` 的返回结构、
`detachSession` 改名、或 `sidebar.footer.action` 槽位契约变化），插件会
**加载失败或功能失效** —— 但这是「需要跟着适配」，不是「被升级覆盖删除」。

处理方式：

1. 临时注释掉 `cordis.patch.yml` 里那一行并重启，即恢复干净状态；
2. 按上游新契约更新 `lib/` 源码，按第 5 节重新部署。

因为插件**完全不修改上游包**，停用它不会连带破坏 EZAI 本身。

### 真正会丢的情况（都不是「升级」本身）

- 手动删除 `~/.dsh/profiles/dsh-session-purge/`（或点了 EZAI 的 profile 重置）；
- 卸载 EZAI 时勾选了「删除用户数据 / `~/.dsh`」；
- 用 `pnpm` 在 profile 里做了全局重装且未保留该依赖。

这三类都属于**显式的用户数据清理**。由于源码同时保留在
`report/dsh-session-purge/`，任何时候都能按第 5 节一键重新部署。

---

## 9. 踩过的五个坑（都曾导致「功能不生效」）

排查过程中出现的问题，记录在此以免重犯：

### 坑 1：loader 行写错了文件 —— 插件根本没加载

桌面版读的是 **`$DSH_HOME/cordis.patch.yml`**（`prepareDesktopProfile` 里的
`loadOptionalPatches(BIN_NAME, join(home, PROFILE_PATCH_FILENAME))`），
而 CLI 读的是 `$DSH_HOME/profiles/<name>/cordis.patch.yml`。

我一开始写进了后者，并且用 CLI 的 `loadProfile()` 写测试 —— **测试全绿，应用啥也没加载**。
典型的假通过。现在有 `desktop.prepare.test.mjs` 专门走 `prepareDesktopProfile()`。

### 坑 2：`#private` 字段穿不过 cordis 服务代理 —— 一删就抛异常

cordis 交出去的 **不是**构造出来的实例：

```
new SessionPurgeService(ctx)  ->  实例
ctx.get('sessionPurge')       ->  代理，且 !== 实例
```

ECMAScript 私有字段（`#inflight`）无法透过代理读取，所以
`ctx.get('sessionPurge').delete()` 一进去就抛
`Cannot read private member #inflight from an object whose class did not declare it`。

> **规则：cordis Service 子类里不要用 `#` 私有字段或私有方法，一律用普通属性/方法。**

单元测试当初直接调实例，所以全过；现在 `service.proxy.test.mjs` **故意走 `ctx.get()`**，
并且会断言「代理 !== 实例」，防止这类 bug 再次静默复发。

### 坑 3：面板列出了已归档会话 —— 看起来像「删了没反应」

侧边栏会隐藏 `workspaces.archivedSessionIds` 里的会话，我最初的面板**没有**隐藏它们。
那些已归档会话的日志通常早就没了，点删除只会返回 `SESSION_PURGE_NOT_FOUND`、
行还在原地 —— 于是「删除成功」和「什么都没发生」在观感上完全一样。

修复：面板现在读取同一份归档集合并跳过归档项（`archived` 已加入 `useMemo` 依赖），
删除成功后还会显示绿色横幅
「已永久删除「XXX」及其磁盘记录」，让成功明确可见。

### 坑 4（真正的拦路虎）：自定义错误码被客户端 schema 拒收

这是「点了删除没反应」的**最终根因**，也是四个坑里最隐蔽的一个。

我以为「用私有通道」就绕开了上游的封闭契约 —— 但那只绕开了**出站**（请求侧）的表。
**入站**（响应侧）的校验仍然共用同一个 schema：

浏览器端 `connection.rpc.call` 会用共享的 `serverResponseSchema` 解析**每一个**响应，
而它的 `error.code` 是一个**封闭的判别联合**：

```
bad-request | cancelled | session-not-found | session-conflict | ... | internal
```

我原本直接回传自己的 `SESSION_PURGE_NOT_FOUND` / `SESSION_PURGE_LIVE` —— **不在这个联合里**。
于是客户端在插件代码看到响应之前就把它判为非法：

```
transport: [{"code":"invalid_union", ...
  "note":"No matching discriminator","discriminator":"code", ...
  "path":["result"]}]
```

表现就是：Host 明明正确回答了，前端却只看到一句 transport 报错，删除「毫无反应」。

**修复**：在 `lib/rpc.js` 里把自己的精确码**映射**到那个封闭词表，
精确原因保留在 message 与（词表有空间时）details 里：

| 内部码 | 上线码 | details |
|---|---|---|
| `SESSION_PURGE_NOT_FOUND` | `session-not-found` | `{ sessionId }` |
| `SESSION_PURGE_LIVE` | `session-conflict` | `{ sessionId, requestedCwd: '' }` |
| `SESSION_PURGE_INVALID_ID` | `bad-request` | `{ issues: [...] }` |
| `LOG_REMOVAL_FAILED` / `ACCOUNTING_FAILED` | `internal` | `{}`（`internal` 要求 details 为空，精确码写进 message）|

**每个 details 形状也必须匹配**：`session-not-found` 要求 `details.sessionId`、
`internal` 要求 `details` 为空对象 —— 形状不对一样会被拒。

新增 `wire.schema.test.mjs`：拿 Host 真会发出的**每一种**响应包，
喂给**真实的** `AbstractApiClient.callUnary` 走完 `serverResponseSchema` 解析，
断言客户端**接受**它并保住错误码。这个测试如果早写，坑 4 根本不会发生。

---

### 坑 5：安全闸门判定过宽 —— 空闲的对话也删不掉

最初我用 **「会话在内存中」** 作为拒绝条件。但桌面版每次启动都会
**重新附加上次打开的会话**，所以用户最想删的那条对话恰好永远在内存里：

```
删除失败：cannot delete conversation "..." while it is open: close it first
```

而面板同时把它标成 **「空闲」** —— 因为那个标签指的是「没有 agent 在跑」。
**两套判据不一致**，于是出现「看起来空闲、却告诉我它开着」的矛盾提示。

**正确判据**是 `ctx.agents.get(id)?.status === 'running'` ——
这正是侧边栏渲染「进行中/空闲」用的同一个谓词，改成它之后闸门与用户所见一致。

**放宽前先验证了安全性**（`tests/attached.idle.probe.mjs`）：
删掉一个「已附加但空闲」会话的日志后，

- 目录立即消失，300ms 后仍在（write-behind 窗口内不会重建）
- 后续 `append` 因游标过期而失败，**不会重建文件**
- `list()` 报告该会话已消失

结论：空闲的附加状态是安全的，不需要拒绝。
删除前仍会 `sessions.flush()` 建立持久化屏障，
并尽力释放后端缓存的冷读源，避免删除后又被复活。

**同时修了 UI 侧的误导**：现在「进行中」的行会**禁用删除按钮**并给出提示
（该行状态与 Host 闸门用的是同一个判据）。
`host.purge.test.mjs` 拆成 scenario 2（进行中 → 拒绝）
与 scenario 2b（已附加但空闲 → **可以删**）两个场景。

---

## 10. 「未分组」改名为「回收站」

侧边栏那个「未分组」分组标题来自**上游** `dsh-client-ui-workspace` 的 locale 字典
（`WorkspaceBrowser` 通过自己的 `locale: 'workspace'` 座位渲染 `t('group.ungrouped')`）。
本插件把它改写为 **回收站 / Recycle Bin**。

### 为什么不能"正常"覆盖

两条直觉上的做法都行不通：

1. **注册自己的命名空间** —— 座位绑定的是上游的 `'workspace'`，只认那个命名空间；
2. **再次 `register('workspace', ...)`** —— 官方实现会**直接抛错**：
   `locale namespace "workspace" already has locale "zh"`。

### 实际做法（`relabelUngroupedBucket`）

替换 `LocaleRuntime#dicts`（`Map<命名空间, Map<语言, 字典>>`）里**已存储的字典对象**，
然后 `publish()` 提升 revision 让所有已挂载的 `t` 座位重新求值。

三个必须注意的点：

- **要改写该命名空间下注册的每一种语言**，而不只是当前语言。查找链是
  `当前语言 ??.en 兜底`，只补一个槽位会留下过期字符串，
  而且**切换语言时标题会回退**。
- **应用顺序不保证**：上游可能在本插件 `apply()` 之后才注册字典。
  所以除了 apply 时补一次，还订阅了 locale revision，每次变化都重新补
  （同时也覆盖了 HMR 重载）。
- **降级必须安静**：locale 服务不存在、命名空间不存在、`dicts` 结构变了 ——
  一律**不抛异常**，保持原样。字典注册本身也改成可选的，
  这样"拿不到翻译"绝不会连带让**删除功能失效**。

### 代价（诚实说明）

这依赖 `LocaleRuntime#dicts` 这个**非公开字段**。若上游某版本改名或隐藏它，
效果是**标题退回「未分组」**，删除功能不受影响。
`locale.relabel.test.mjs` 会覆盖两种 apply 顺序、语言切换、以及缺服务时的降级。

---

## 11. 已知限制

- **不能删除正在运行的会话**（刻意的安全设计）。
- **`archivedSessionIds` 中的 id 不会一并清除。** 该集合在本版本只有
  `archiveSession`、没有公开的「取消归档」动词。留着它是**无害的**：
  该集合只用于隐藏「仍然存在」的会话，而被删掉的会话已经解析不到任何东西。
- **全文搜索索引**在当前部署未开启（`openAt: never`），报告为 `absent`。
  若某部署开启了索引，且该版本的 `sessionQuery` 提供 `forget()`，则会调用它；
  否则报告 `unsupported`，但由于索引是从持久化重建的，会话已不存在，不会复活。
