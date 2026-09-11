window.__ModuleLoader__.load({
	id: "dsh-session-purge",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const react = require("react");
		const primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		const { jsx, jsxs } = require("react/jsx-runtime");
		const {
			Button,
			IconListPenOutline16,
			IconTrashOutline16,
			Modal,
			StateDot,
		} = primitives;

		/** Dictionary namespace owned by this plugin. */
		const NS = "session-purge";

		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"manage.open": "管理对话",
			"manage.title": "管理对话",
			"manage.description": "选择要永久删除的对话。删除会同时移除磁盘上的对话记录，无法恢复。",
			"manage.empty": "暂无可管理的对话",
			"manage.close": "关闭",
			"manage.search": "搜索对话…",
			"manage.running": "进行中",
			"manage.idle": "空闲",
			"manage.running.hint": "该对话正在进行中，请先停止后再删除",
			"manage.ungrouped": "未分组",
			"manage.count.one": "共 {n} 个对话",
			"manage.count.other": "共 {n} 个对话",
			"delete.session": "删除",
			"delete.confirm.title": "删除对话",
			"delete.confirm.desc": "将永久删除「{name}」及其全部对话记录与磁盘日志，此操作无法撤销。",
			"delete.confirm.action": "删除对话",
			"delete.cancel": "取消",
			"delete.pending": "正在删除对话…",
			"delete.done": "已删除",
			"delete.failed": "删除失败：{message}",
			"delete.ok": "已永久删除「{name}」及其磁盘记录",
			"row.delete.aria": "删除对话 {name}",
			"date.ymd": "{y}年{m}月{d}日",
			"time.now": "刚刚",
			"time.minutes": "{n}分钟",
			"time.hours": "{n}小时",
			"time.days": "{n}天",
			"time.ago": "{t}前",
		};

		/** English dictionary, checked complete against the zh key set. */
		const en = {
			"manage.open": "Manage conversations",
			"manage.title": "Manage conversations",
			"manage.description": "Choose a conversation to delete permanently. Deleting also removes its transcript on disk and cannot be undone.",
			"manage.empty": "No conversations to manage",
			"manage.close": "Close",
			"manage.search": "Search conversations…",
			"manage.running": "Running",
			"manage.idle": "Idle",
			"manage.running.hint": "This conversation is running. Stop it before deleting.",
			"manage.ungrouped": "Ungrouped",
			"manage.count.one": "{n} conversation",
			"manage.count.other": "{n} conversations",
			"delete.session": "Delete",
			"delete.confirm.title": "Delete conversation",
			"delete.confirm.desc": "This permanently deletes “{name}”, its entire transcript, and its stored log on disk. This cannot be undone.",
			"delete.confirm.action": "Delete conversation",
			"delete.cancel": "Cancel",
			"delete.pending": "Deleting conversation…",
			"delete.done": "Deleted",
			"delete.failed": "Delete failed: {message}",
			"delete.ok": "Permanently deleted “{name}” and its stored log",
			"row.delete.aria": "Delete conversation {name}",
			"date.ymd": "{y}-{m}-{d}",
			"time.now": "now",
			"time.minutes": "{n}min",
			"time.hours": "{n}h",
			"time.days": "{n}d",
			"time.ago": "{t} ago",
		};

		// The private RPC channel the Host half owns (see lib/rpc.js).
		const CHANNEL = "/session-purge";
		const ENDPOINT = "delete";

		/**
		 * Delete one conversation through the private RPC channel.
		 *
		 * The channel speaks the standard DSH envelope, so this is an ordinary
		 * `connection.rpc.call` — no per-method schema table is involved (which is
		 * exactly why a private channel was chosen over extending the shared `/api`
		 * unary table).
		 *
		 * @param connection - the connection service.
		 * @param sessionId - the conversation to delete.
		 * @returns the Host's purge report.
		 * @throws {Error} carrying the Host's failure message.
		 */
		async function deleteConversation(connection, sessionId) {
			// A transport-level failure (unknown endpoint, 404, the 403 trust fence,
			// a channel whose registration never happened) THROWS out of `call`
			// instead of returning a business error. Report it verbatim rather than
			// letting a generic message hide the cause: that distinction is what
			// separates "the channel is broken" from "the Host rejected this id".
			let result;
			try {
				result = await connection.rpc.call(CHANNEL, ENDPOINT, { sessionId });
			}
			catch (reason) {
				const detail = reason instanceof Error ? reason.message : String(reason);
				const failure = new Error(`transport: ${detail}`);
				failure.code = "PURGE_TRANSPORT";
				throw failure;
			}
			if (result !== null && typeof result === "object" && result.ok === true) return result.value;
			const error = result !== null && typeof result === "object" ? result.error : undefined;
			const message = error !== null && typeof error === "object" && typeof error.message === "string"
				? error.message
				: `session delete failed (unrecognized response: ${JSON.stringify(result).slice(0, 200)})`;
			const failure = new Error(message);
			failure.code = error !== null && typeof error === "object" ? error.code : undefined;
			throw failure;
		}

		/**
		 * Relative-time label reusing the sidebar's vocabulary so the panel reads
		 * like the rest of the shell.
		 *
		 * @param epochMs - the row's updatedAt.
		 * @param now - current epoch ms.
		 * @param t - locale seat.
		 * @returns the label.
		 */
		function timeLabel(epochMs, now, t) {
			const delta = Math.max(0, now - epochMs);
			const minutes = Math.floor(delta / 60000);
			if (minutes < 1) return t("time.now");
			if (minutes < 60) return t("time.ago", { t: t("time.minutes", { n: String(minutes) }) });
			const hours = Math.floor(minutes / 60);
			if (hours < 24) return t("time.ago", { t: t("time.hours", { n: String(hours) }) });
			const days = Math.floor(hours / 24);
			if (days < 30) return t("time.ago", { t: t("time.days", { n: String(days) }) });
			const date = new Date(epochMs);
			return t("date.ymd", {
				y: String(date.getFullYear()),
				m: String(date.getMonth() + 1),
				d: String(date.getDate()),
			});
		}

		// The panel's stylesheet, tagged like every other plugin sheet so a reload
		// replaces rather than stacks it.
		const CSS = [
			".dsp-layer{position:relative;display:flex;align-items:center}",
			".dsp-layer.dsp-rail{justify-content:center;width:auto}",
			".dsp-trigger{display:inline-flex;align-items:center;gap:6px;height:32px;max-width:100%;padding:0 10px;border:none;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,#666);cursor:pointer;font-size:13px;white-space:nowrap;overflow:hidden}",
			".dsp-trigger:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.04));color:var(--dsw-alias-label-primary,#1a1a1a)}",
			".dsp-rail .dsp-trigger{width:36px;height:36px;justify-content:center;padding:0;color:var(--dsw-alias-label-primary,#1a1a1a)}",
			".dsp-overlay{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.32)}",
			".dsp-panel{width:min(600px,92vw);max-height:min(74vh,700px);display:flex;flex-direction:column;overflow:hidden;border-radius:16px;background:var(--dsw-alias-button-elevated-fill,#fff);color:var(--dsw-alias-label-primary,#1a1a1a);box-shadow:0 12px 48px rgba(0,0,0,.24);text-align:left}",
			".dsp-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:18px 20px 6px}",
			".dsp-title{margin:0;font-size:16px;font-weight:600;line-height:24px}",
			".dsp-desc{margin:0;padding:0 20px 10px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#666)}",
			".dsp-toolbar{display:flex;align-items:center;gap:8px;padding:0 20px 10px}",
			".dsp-search{flex:1;min-width:0;height:32px;box-sizing:border-box;padding:0 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,#ddd);background:transparent;color:inherit;font-size:13px;outline:none}",
			".dsp-count{flex:none;font-size:12px;color:var(--dsw-alias-label-tertiary,#999)}",
			".dsp-list{min-height:0;flex:1;overflow-y:auto;margin:0;padding:2px 12px 12px;list-style:none}",
			".dsp-row{display:flex;align-items:center;gap:10px;padding:7px 8px;border-radius:10px}",
			".dsp-row:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.04))}",
			".dsp-dot{flex:none;display:inline-flex;align-items:center}",
			".dsp-main{min-width:0;flex:1;display:flex;flex-direction:column;gap:2px}",
			".dsp-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;line-height:18px}",
			".dsp-meta{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#999)}",
			".dsp-state{flex:none;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#999)}",
			".dsp-empty{padding:28px 20px;text-align:center;font-size:13px;color:var(--dsw-alias-label-tertiary,#999)}",
			".dsp-error{margin:0;padding:0 20px 8px;font-size:12px;line-height:18px;color:var(--dsw-alias-state-error-primary,#d92d20)}",
			".dsp-error{margin:0;padding:0 20px 8px;font-size:12px;line-height:18px;color:var(--dsw-alias-state-error-primary,#d92d20)}",
			".dsp-ok{margin:0;padding:8px 20px;border-radius:8px;font-size:12px;line-height:18px;color:var(--dsw-alias-state-success-primary,#067647);background:var(--dsw-alias-state-success-bg,rgba(6,118,71,.08))}",
			".dsp-status{padding:0 20px 14px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#666)}",
		].join("");

		const CSS_TAG_ID = "dsh-session-purge/Panel.css";
		if (typeof document !== "undefined" && document.querySelector('style[data-plugin-css="' + CSS_TAG_ID + '"]') === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-session-purge";
			tag.dataset.pluginCss = CSS_TAG_ID;
			tag.textContent = CSS;
			document.head.appendChild(tag);
		}

		/**
		 * The row's display name, falling back the way the sidebar does.
		 *
		 * @param row - the session summary.
		 * @returns the name to show.
		 */
		function displayNameOf(row) {
			const display = row.displayTitle;
			if (typeof display === "string" && display.trim().length > 0) return display;
			const title = row.title;
			if (typeof title === "string" && title.trim().length > 0) return title;
			return row.id;
		}

		/**
		 * One conversation row.
		 *
		 * @param props.row - the session summary.
		 * @param props.workspaceTitle - owning workspace, when it has one.
		 * @param props.now - epoch ms for relative time.
		 * @param props.busy - whether a delete is in flight.
		 * @param props.onDelete - requests deletion of this row.
		 * @param props.t - locale seat.
		 * @returns the list item.
		 */
		function PurgeRow({ row, workspaceTitle, now, busy, onDelete, t }) {
			const running = row.running === true;
			const name = displayNameOf(row);
			return jsxs("li", {
				className: "dsp-row",
				children: [
					jsx("span", {
						className: "dsp-dot",
						// StateDot's vocabulary is upstream's: 'ongoing' while a turn is
						// live, 'done' once it is idle or finished.
						children: jsx(StateDot, { state: running ? "ongoing" : "done" }),
					}),
					jsxs("span", {
						className: "dsp-main",
						children: [
							jsx("span", { className: "dsp-name", title: name, children: name }),
							jsx("span", {
								className: "dsp-meta",
								children: [workspaceTitle ?? t("manage.ungrouped"), timeLabel(row.updatedAt ?? now, now, t)].join(" · "),
							}),
						],
					}),
					// The state word mirrors the Host gate exactly (`agent.status ===
					// 'running'`), so a row the user cannot delete is always the one
					// labelled 进行中/Running, and its button is disabled below. That
					// correspondence is the whole point: an earlier build gated on
					// "attached in memory" while labelling idle rows 空闲, so a delete
					// could be refused for a reason the UI never showed.
					jsx("span", { className: "dsp-state", children: running ? t("manage.running") : t("manage.idle") }),
					jsx(Button, {
						variant: "outline",
						className: "dsp-danger",
						disabled: busy || running,
						"aria-label": t("row.delete.aria", { name }),
						title: running ? t("manage.running.hint") : undefined,
						onClick: onDelete,
						children: t("delete.session"),
					}),
				],
			});
		}

		/**
		 * The conversation manager panel.
		 *
		 * @param props.open - whether the panel is showing.
		 * @param props.onClose - closes the panel.
		 * @param props.sessions - the sessions-list snapshot (`{ids, byId, current}`).
		 * @param props.workspaces - the workspaces snapshot (`{items, ...}`).
		 * @param props.connection - the connection service (private RPC channel).
		 * @param props.t - locale seat.
		 * @returns the overlay tree, or null while closed.
		 */
		function PurgePanel({ open, onClose, sessions, workspaces, connection, t }) {
			const [query, setQuery] = react.useState("");
			const [target, setTarget] = react.useState(null);
			const [busy, setBusy] = react.useState(false);
			const [error, setError] = react.useState(null);
			// The just-deleted conversation's name, shown as a success banner so the
			// user gets explicit confirmation that the log was removed.
			const [deleted, setDeleted] = react.useState(null);

			// Reset transient state on open so a previous failure never greets a new
			// visit, and never leaves the panel pinned open on a stale target.
			react.useEffect(() => {
				if (!open) return;
				setQuery("");
				setTarget(null);
				setError(null);
				setBusy(false);
				setDeleted(null);
			}, [open]);

			// Escape closes the panel; the confirm dialog renders its own Modal and
			// handles Escape itself, so it is left alone while a target is set.
			react.useEffect(() => {
				if (!open) return undefined;
				const onKeyDown = (event) => {
					if (event.key !== "Escape") return;
					if (target !== null || busy) return;
					onClose();
				};
				document.addEventListener("keydown", onKeyDown);
				return () => document.removeEventListener("keydown", onKeyDown);
			}, [open, target, busy, onClose]);

			const workspaceTitleOf = react.useMemo(() => {
				const bySession = new Map();
				for (const workspace of workspaces?.items ?? []) {
					if (workspace?.workspaceId === undefined) continue;
					for (const id of workspace.sessionIds ?? []) bySession.set(id, workspace.title);
				}
				return bySession;
			}, [workspaces]);

			// Archived ids: the sidebar hides these, and so must this panel. An
			// archived session has usually already lost its log, so offering a delete
			// button for it produces a confusing "no such conversation" and makes a
			// working delete look broken. Reading the same archive set the sidebar
			// uses keeps both surfaces consistent.
			const archived = react.useMemo(
				() => new Set(workspaces?.archivedSessionIds ?? []),
				[workspaces],
			);

			// Visible conversations: never a subagent's session (an internal child),
			// never the blank provisional New Session row (no durable log yet), and
			// never an archived session (already hidden from the sidebar).
			const rows = react.useMemo(() => {
				const out = [];
				for (const id of sessions?.ids ?? []) {
					const summary = sessions.byId?.[id];
					if (summary === undefined) continue;
					if (summary.origin === "subagent") continue;
					if (summary.blank === true) continue;
					if (archived.has(id)) continue;
					out.push(summary);
				}
				out.sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0));
				return out;
			}, [sessions, archived]);

			const filtered = react.useMemo(() => {
				const needle = query.trim().toLowerCase();
				if (needle.length === 0) return rows;
				return rows.filter((row) => {
					const title = displayNameOf(row).toLowerCase();
					const workspace = String(workspaceTitleOf.get(row.id) ?? "").toLowerCase();
					return title.includes(needle) || workspace.includes(needle);
				});
			}, [rows, query, workspaceTitleOf]);

			const confirmDelete = react.useCallback(async () => {
				if (target === null || busy) return;
				setBusy(true);
				setError(null);
				try {
					// The Host report is the proof the log is gone; surface it so a
					// completed delete is unmistakable rather than a silent row vanish.
					const report = await deleteConversation(connection, target);
					const row = rows.find((candidate) => candidate.id === target);
					setDeleted(row === undefined ? String(target) : displayNameOf(row));
					setTarget(null);
					void report;
				}
				catch (reason) {
					// Show the user what happened AND leave a diagnostic in the console
					// (the desktop host pipes renderer console output into its log file),
					// so a failure is diagnosable without reproducing it interactively.
					const message = reason instanceof Error ? reason.message : String(reason);
					console.error("[session-purge] delete failed:", reason);
					setError(message);
				}
				finally {
					setBusy(false);
				}
			}, [target, busy, connection, rows]);

			if (!open) return null;

			const now = Date.now();
			const targetRow = target === null ? undefined : rows.find((row) => row.id === target);
			const targetTitle = targetRow === undefined ? String(target ?? "") : displayNameOf(targetRow);
			const countKey = filtered.length === 1 ? "manage.count.one" : "manage.count.other";

			return jsxs(react.Fragment, {
				children: [
					jsx("div", {
						className: "dsp-overlay",
						onClick: (event) => {
							if (event.target === event.currentTarget && !busy) onClose();
						},
						children: jsxs("div", {
							className: "dsp-panel",
							role: "dialog",
							"aria-modal": "true",
							"aria-label": t("manage.title"),
							children: [
								jsxs("div", {
									className: "dsp-head",
									children: [
										jsx("h2", { className: "dsp-title", children: t("manage.title") }),
										jsx(Button, {
											variant: "outline",
											disabled: busy,
											onClick: onClose,
											children: t("manage.close"),
										}),
									],
								}),
								jsx("p", { className: "dsp-desc", children: t("manage.description") }),
								jsxs("div", {
									className: "dsp-toolbar",
									children: [
										jsx("input", {
											className: "dsp-search",
											type: "search",
											value: query,
											placeholder: t("manage.search"),
											"aria-label": t("manage.search"),
											onChange: (event) => setQuery(event.target.value),
										}),
										jsx("span", {
											className: "dsp-count",
											children: t(countKey, { n: String(filtered.length) }),
										}),
									],
								}),
								error !== null && jsx("p", {
									className: "dsp-error",
									role: "alert",
									children: t("delete.failed", { message: error }),
								}),
								deleted !== null && jsx("p", {
									className: "dsp-ok",
									role: "status",
									children: t("delete.ok", { name: deleted }),
								}),
								filtered.length === 0
									? jsx("div", { className: "dsp-empty", children: t("manage.empty") })
									: jsx("ul", {
										className: "dsp-list",
										children: filtered.map((row) => jsx(PurgeRow, {
											row,
											workspaceTitle: workspaceTitleOf.get(row.id),
											now,
											busy,
											onDelete: () => {
												setError(null);
												setTarget(row.id);
											},
											t,
										}, row.id)),
									}),
							],
						}),
					}),
					jsxs(Modal, {
						open: target !== null,
						onClose: () => {
							if (!busy) setTarget(null);
						},
						closeLabel: t("manage.close"),
						title: t("delete.confirm.title"),
						description: t("delete.confirm.desc", { name: targetTitle }),
						footer: jsxs(react.Fragment, {
							children: [
								jsx(Button, {
									variant: "outline",
									disabled: busy,
									onClick: () => setTarget(null),
									children: t("delete.cancel"),
								}),
								jsx(Button, {
									variant: "outline",
									className: "dsp-danger",
									disabled: busy,
									onClick: () => {
										void confirmDelete();
									},
									children: t("delete.confirm.action"),
								}),
							],
						}),
						children: busy ? jsx("div", { role: "status", children: t("delete.pending") }) : null,
					}),
				],
			});
		}

		/**
		 * The sidebar foot entry: a rail/wide trigger plus the manager panel.
		 *
		 * `sidebar.footer.action` is a LIST slot, so this component IS the slot
		 * cell. Keeping the trigger and the panel in one component makes the
		 * open/closed state ordinary React state with no cross-slot handshake.
		 *
		 * Injected props arrive merged over the standard kit: `wide` and `t` come
		 * from the shell, `useSessions`/`useWorkspaces` are synthesized from the
		 * `hooks` face, and `connection` comes from the entry's own inject.
		 *
		 * @param props - the merged slot kit.
		 * @returns the trigger and, while open, the manager panel.
		 */
		function PurgeFootAction({ wide, useSessions, useWorkspaces, connection, t }) {
			const [open, setOpen] = react.useState(false);
			const close = react.useCallback(() => setOpen(false), []);
			// Selector-style reads (the framework's observable-hook contract): the
			// snapshot is only re-read when its identity actually changes.
			const sessions = useSessions((snapshot) => snapshot);
			const workspaces = useWorkspaces((snapshot) => snapshot);
			return jsxs("div", {
				className: wide ? "dsp-layer" : "dsp-layer dsp-rail",
				children: [
					jsxs("button", {
						type: "button",
						className: "dsp-trigger",
						"aria-label": t("manage.open"),
						title: wide ? undefined : t("manage.open"),
						"aria-expanded": open,
						onClick: () => setOpen(true),
						children: [
							jsx(IconListPenOutline16, { size: wide ? 16 : 18 }),
							wide ? jsx("span", { children: t("manage.open") }) : null,
						],
					}),
					jsx(PurgePanel, {
						open,
						onClose: close,
						sessions,
						workspaces,
						connection,
						t,
					}),
				],
			});
		}

		/**
		 * Relabel the sidebar's "Ungrouped" bucket.
		 *
		 * The bucket heading comes from the UPSTREAM `workspace` locale namespace
		 * (`WorkspaceBrowser` renders `t('group.ungrouped')` through its own
		 * `locale: 'workspace'` seat), so it cannot be changed by registering our own
		 * namespace. `locale.register()` also REFUSES a namespace+locale pair that
		 * already exists ("locale namespace ... already has locale ..."), so a second
		 * registration is not an option either.
		 *
		 * What DOES work is replacing the stored dictionary objects in place. The
		 * lookup chain is `active-locale entry ?? en-fallback entry`, so EVERY
		 * registered locale of the namespace must be rewritten: patching only the
		 * active one leaves a stale string in the other slot, and a language switch
		 * would silently revert the label.
		 *
		 * This depends on `LocaleRuntime#dicts` (a Map<namespace, Map<locale, dict>>)
		 * remaining reachable. If a future build renames or hides it, the feature
		 * degrades to the stock label rather than throwing — see the guards below.
		 *
		 * @param ctx - client root context.
		 * @param labelZh - the Simplified Chinese label.
		 * @param labelEn - the English label.
		 * @returns a disposer restoring the original dictionaries, or a no-op.
		 */
		function relabelUngroupedBucket(ctx, labelZh, labelEn) {
			const locale = ctx.get("locale");
			const table = locale?.dicts;
			if (!(table instanceof Map)) return () => {};

			const replacements = { zh: labelZh, en: labelEn };

			/**
			 * Patch every locale currently registered under `workspace`.
			 *
			 * Application order is NOT guaranteed: the upstream workspace plugin may
			 * register its dictionaries before or after this plugin's apply(). Calling
			 * this once at apply time and again on every locale revision covers both
			 * orders (and a later HMR reload of either plugin).
			 */
			const patch = () => {
				const locales = table.get("workspace");
				if (!(locales instanceof Map)) return false;
				let changed = false;
				for (const [localeId, dict] of locales) {
					if (dict === null || typeof dict !== "object") continue;
					const wanted = replacements[localeId] ?? labelEn;
					// Skip a dict we already patched, and anything already showing the
					// wanted label (idempotent across the many revisions a boot emits).
					if (dict["group.ungrouped"] === wanted) continue;
					locales.set(localeId, { ...dict, "group.ungrouped": wanted });
					changed = true;
				}
				return changed;
			};

			const first = patch();
			if (first) locale.publish?.(locale.snapshot?.active, false);

			// Re-patch on every later revision: covers the upstream namespace being
			// registered after this plugin, and a locale switch that re-resolves.
			const unsubscribe = typeof locale.subscribe === "function"
				? locale.subscribe(() => {
					if (patch()) locale.publish?.(locale.snapshot?.active, false);
				})
				: undefined;

			return () => {
				if (typeof unsubscribe === "function") unsubscribe();
			};
		}

		/** Required services (cordis fiber inject). */
		exports.inject = ["slots", "sessions", "workspaces", "connection", "locale"];

		/**
		 * Register the conversation manager into the sidebar foot and relabel the
		 * sidebar's ungrouped bucket.
		 *
		 * @param ctx - client root context.
		 */
		exports.apply = function apply(ctx) {
			const connection = ctx.get("connection");
			if (connection === undefined) {
				throw new Error("dsh-session-purge: the connection service is unavailable");
			}
			// Dictionary registration is optional: the panel's own copy is nice to have,
			// but losing it must never stop the delete action working, so a missing
			// locale service degrades instead of aborting activation.
			const locale = ctx.get("locale");
			if (locale !== undefined && typeof locale.register === "function") {
				ctx.effect(() => locale.register(NS, { zh, en }), "dsh-session-purge: dictionaries");
			}
			ctx.effect(() => relabelUngroupedBucket(ctx, "回收站", "Recycle Bin"), "dsh-session-purge: ungrouped relabel");
			ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
				name: "sidebar.footer.action",
				id: "session-purge",
				order: 10,
				locale: NS,
				inject: () => ({ connection }),
			}, PurgeFootAction));
		};

		return module.exports;
	},
});
