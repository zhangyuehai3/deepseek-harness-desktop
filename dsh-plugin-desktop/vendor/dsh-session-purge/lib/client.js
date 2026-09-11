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
			"manage.description": "选择要删除的对话。删除后将进入 7 天倒计时缓冲期，期满后自动彻底清除，期间可随时恢复。",
			"manage.empty": "暂无可管理的对话",
			"manage.close": "关闭",
			"manage.search": "搜索对话…",
			"manage.running": "进行中",
			"manage.idle": "空闲",
			"manage.running.hint": "该对话正在进行中，请先停止后再删除",
			"manage.ungrouped": "未分组",
			"manage.count.one": "共 {n} 个对话",
			"manage.count.other": "共 {n} 个对话",
			"manage.tab.all": "全部",
			"manage.tab.pending": "待删除 ({n})",
			"manage.tab.pending.empty": "待删除 (0)",
			"manage.pending.empty": "暂无待删除对话（删除后的对话会在此保留 7 天，期满前可随时恢复）",
			"delete.session": "删除",
			"delete.confirm.title": "删除对话",
			"delete.confirm.desc": "对话「{name}」将被移入待删除列表，并启动 7 天删除倒计时。倒计时结束后将彻底清除；在 7 天内，您可以随时在此处一键恢复。",
			"delete.confirm.action": "移入待删除 (7天后清除)",
			"delete.cancel": "取消",
			"delete.pending": "正在处理…",
			"delete.done": "已移入待删除",
			"delete.failed": "操作失败：{message}",
			"delete.ok": "已移入待删除列表（保留7天，可在「待删除」中随时恢复「{name}」）",
			"delete.restore": "恢复",
			"delete.restored.ok": "已成功恢复对话「{name}」",
			"delete.countdown.days": "剩余 {d} 天后自动删除",
			"delete.countdown.hours": "剩余 {h} 小时后自动删除",
			"delete.countdown.soon": "即将自动清除",
			"row.delete.aria": "删除对话 {name}",
			"row.restore.aria": "恢复对话 {name}",
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
			"manage.description": "Choose conversations to delete. Deleting starts a 7-day countdown buffer before permanent removal, during which you can restore them anytime.",
			"manage.empty": "No conversations to manage",
			"manage.close": "Close",
			"manage.search": "Search conversations…",
			"manage.running": "Running",
			"manage.idle": "Idle",
			"manage.running.hint": "This conversation is running. Stop it before deleting.",
			"manage.ungrouped": "Ungrouped",
			"manage.count.one": "{n} conversation",
			"manage.count.other": "{n} conversations",
			"manage.tab.all": "All",
			"manage.tab.pending": "Pending ({n})",
			"manage.tab.pending.empty": "Pending (0)",
			"manage.pending.empty": "No conversations pending deletion (deleted items are kept here for 7 days and can be restored anytime)",
			"delete.session": "Delete",
			"delete.confirm.title": "Delete conversation",
			"delete.confirm.desc": "“{name}” will be moved to pending deletion and permanently deleted after a 7-day countdown. You can restore it anytime during this period.",
			"delete.confirm.action": "Delete (7-day countdown)",
			"delete.cancel": "Cancel",
			"delete.pending": "Processing…",
			"delete.done": "Moved to pending",
			"delete.failed": "Operation failed: {message}",
			"delete.ok": "Moved to pending deletion. You can restore “{name}” in Pending anytime within 7 days",
			"delete.restore": "Restore",
			"delete.restored.ok": "Successfully restored conversation “{name}”",
			"delete.countdown.days": "{d}d left until deletion",
			"delete.countdown.hours": "{h}h left until deletion",
			"delete.countdown.soon": "Deleting soon",
			"row.delete.aria": "Delete conversation {name}",
			"row.restore.aria": "Restore conversation {name}",
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

		async function rpcCall(connection, endpoint, payload) {
			let result;
			try {
				result = await connection.rpc.call(CHANNEL, endpoint, payload);
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
				: `session operation failed (${endpoint}): ${JSON.stringify(result).slice(0, 200)}`;
			const failure = new Error(message);
			failure.code = error !== null && typeof error === "object" ? error.code : undefined;
			throw failure;
		}

		/**
		 * Schedule one conversation for 7-day countdown deletion.
		 */
		async function scheduleConversation(connection, sessionId) {
			return await rpcCall(connection, "schedule", { sessionId });
		}

		/**
		 * Restore a scheduled conversation back to active.
		 */
		async function restoreConversation(connection, sessionId) {
			return await rpcCall(connection, "restore", { sessionId });
		}

		/**
		 * List all conversations currently in 7-day countdown.
		 */
		async function listPendingPurges(connection) {
			try {
				const res = await rpcCall(connection, "list-pending", {});
				return Array.isArray(res?.pending) ? res.pending : [];
			}
			catch {
				return [];
			}
		}

		/**
		 * Permanently delete one conversation immediately (fallback).
		 */
		async function deleteConversation(connection, sessionId) {
			return await rpcCall(connection, ENDPOINT, { sessionId });
		}

		/**
		 * Relative-time label reusing the sidebar's vocabulary.
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

		/**
		 * Countdown label for scheduled deletions.
		 */
		function countdownLabel(deleteAt, now, t) {
			const delta = deleteAt - now;
			if (delta <= 0) return t("delete.countdown.soon");
			const hours = Math.ceil(delta / (3600 * 1000));
			if (hours > 24) {
				const days = Math.floor(hours / 24);
				return t("delete.countdown.days", { d: String(days) });
			}
			return t("delete.countdown.hours", { h: String(hours) });
		}

		// The panel's stylesheet
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
			".dsp-row-pending{background:rgba(217,119,6,.04)}",
			".dsp-dot{flex:none;display:inline-flex;align-items:center}",
			".dsp-main{min-width:0;flex:1;display:flex;flex-direction:column;gap:2px}",
			".dsp-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;line-height:18px}",
			".dsp-meta{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#999)}",
			".dsp-state{flex:none;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#999)}",
			".dsp-countdown{flex:none;font-size:11px;line-height:16px;padding:2px 6px;border-radius:4px;color:#d97706;background:rgba(217,119,6,.1)}",
			".dsp-empty{padding:28px 20px;text-align:center;font-size:13px;color:var(--dsw-alias-label-tertiary,#999)}",
			".dsp-error{margin:0;padding:0 20px 8px;font-size:12px;line-height:18px;color:var(--dsw-alias-state-error-primary,#d92d20)}",
			".dsp-ok{margin:0;padding:8px 20px;border-radius:8px;font-size:12px;line-height:18px;color:var(--dsw-alias-state-success-primary,#067647);background:var(--dsw-alias-state-success-bg,rgba(6,118,71,.08))}",
			".dsp-status{padding:0 20px 14px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#666)}",
			".dsp-section{display:flex;flex-direction:column;gap:6px;width:100%;box-sizing:border-box;color:var(--dsw-alias-label-primary,#1a1a1a)}",
			".dsp-section-head{display:flex;flex-direction:column;gap:4px;padding-bottom:8px}",
			".dsp-section-title{margin:0;font-size:18px;font-weight:600;line-height:26px}",
			".dsp-section-desc{margin:0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary,#666)}",
			".dsp-tabs{display:flex;align-items:center;gap:6px;padding:0 20px 8px}",
			".dsp-tab{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:6px;border:none;background:transparent;color:var(--dsw-alias-label-secondary,#666);cursor:pointer;font-size:12px;font-weight:500;transition:all .15s ease}",
			".dsp-tab:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.04));color:var(--dsw-alias-label-primary,#1a1a1a)}",
			".dsp-tab-active{background:var(--dsw-alias-interactive-bg-selected,rgba(0,0,0,.08));color:var(--dsw-alias-label-primary,#1a1a1a);font-weight:600}",
			".dsp-badge{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 5px;border-radius:9px;font-size:11px;font-weight:600;color:#d97706;background:rgba(217,119,6,.14)}",
			".dsp-section .dsp-tabs{padding:4px 0 8px}",
			".dsp-section .dsp-toolbar{padding:4px 0 10px}",
			".dsp-section .dsp-list{max-height:520px;border:1px solid var(--dsw-alias-border-l1,#e5e7eb);border-radius:12px;background:var(--dsw-alias-bg-layer-1,rgba(0,0,0,.02));padding:6px 8px}",
			".dsp-section .dsp-row{padding:8px 10px;border-radius:8px}",
			".dsp-section .dsp-error,.dsp-section .dsp-ok{margin-bottom:8px}",
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
		 * The row's display name.
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
		 */
		function PurgeRow({ row, workspaceTitle, now, busy, pendingInfo, onDelete, onRestore, t }) {
			const running = row.running === true;
			const name = displayNameOf(row);
			const isPending = pendingInfo !== undefined;

			return jsxs("li", {
				className: isPending ? "dsp-row dsp-row-pending" : "dsp-row",
				children: [
					jsx("span", {
						className: "dsp-dot",
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
					isPending
						? jsx("span", {
							className: "dsp-countdown",
							children: countdownLabel(pendingInfo.deleteAt, now, t),
						})
						: jsx("span", {
							className: "dsp-state",
							children: running ? t("manage.running") : t("manage.idle"),
						}),
					isPending
						? jsx(Button, {
							variant: "outline",
							disabled: busy,
							"aria-label": t("row.restore.aria", { name }),
							onClick: onRestore,
							children: t("delete.restore"),
						})
						: jsx(Button, {
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
		 * Core conversation manager view: list + search + delete modal.
		 */
		function SessionManageView({ sessions, workspaces, connection, t, isSettingsPage, onClose }) {
			const [query, setQuery] = react.useState("");
			const [target, setTarget] = react.useState(null);
			const [busy, setBusy] = react.useState(false);
			const [error, setError] = react.useState(null);
			const [notice, setNotice] = react.useState(null);
			const [pendingList, setPendingList] = react.useState([]);
			const [activeTab, setActiveTab] = react.useState("all");

			const refreshPending = react.useCallback(async () => {
				if (!connection) return;
				const list = await listPendingPurges(connection);
				setPendingList(list);
			}, [connection]);

			react.useEffect(() => {
				setQuery("");
				setTarget(null);
				setError(null);
				setBusy(false);
				setNotice(null);
				void refreshPending();
			}, [refreshPending]);

			const pendingMap = react.useMemo(() => {
				const map = new Map();
				for (const item of pendingList) {
					if (item?.sessionId) map.set(item.sessionId, item);
				}
				return map;
			}, [pendingList]);

			const workspaceTitleOf = react.useMemo(() => {
				const bySession = new Map();
				for (const workspace of workspaces?.items ?? []) {
					if (workspace?.workspaceId === undefined) continue;
					for (const id of workspace.sessionIds ?? []) bySession.set(id, workspace.title);
				}
				return bySession;
			}, [workspaces]);

			const archived = react.useMemo(
				() => new Set(workspaces?.archivedSessionIds ?? []),
				[workspaces],
			);

			const rows = react.useMemo(() => {
				const out = [];
				const seen = new Set();
				for (const id of sessions?.ids ?? []) {
					const summary = sessions.byId?.[id];
					if (summary === undefined) continue;
					if (summary.origin === "subagent") continue;
					if (summary.blank === true) continue;
					// Keep rows visible if they are in pending purges even if archived
					if (archived.has(id) && !pendingMap.has(id)) continue;
					out.push(summary);
					seen.add(id);
				}
				// Ensure every pending purge item is present even if omitted from sessions.ids
				for (const item of pendingList) {
					if (item?.sessionId && !seen.has(item.sessionId)) {
						const fallback = sessions?.byId?.[item.sessionId] ?? {
							id: item.sessionId,
							title: item.sessionId,
							displayTitle: item.sessionId,
							updatedAt: item.scheduledAt ?? Date.now(),
							running: false,
							blank: false,
						};
						out.push(fallback);
						seen.add(item.sessionId);
					}
				}
				out.sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0));
				return out;
			}, [sessions, archived, pendingMap, pendingList]);

			const tabFiltered = react.useMemo(() => {
				if (activeTab === "pending") {
					return rows.filter((row) => pendingMap.has(row.id));
				}
				return rows;
			}, [rows, activeTab, pendingMap]);

			const filtered = react.useMemo(() => {
				const needle = query.trim().toLowerCase();
				if (needle.length === 0) return tabFiltered;
				return tabFiltered.filter((row) => {
					const title = displayNameOf(row).toLowerCase();
					const workspace = String(workspaceTitleOf.get(row.id) ?? "").toLowerCase();
					return title.includes(needle) || workspace.includes(needle);
				});
			}, [tabFiltered, query, workspaceTitleOf]);

			const confirmDelete = react.useCallback(async () => {
				if (target === null || busy) return;
				setBusy(true);
				setError(null);
				try {
					const record = await scheduleConversation(connection, target);
					const row = rows.find((candidate) => candidate.id === target);
					const rowName = row === undefined ? String(target) : displayNameOf(row);
					setNotice(t("delete.ok", { name: rowName }));
					setTarget(null);
					setPendingList((prev) => {
						const filteredPrev = prev.filter((p) => p.sessionId !== target);
						return [...filteredPrev, record];
					});
					setActiveTab("pending");
					void refreshPending();
				}
				catch (reason) {
					const message = reason instanceof Error ? reason.message : String(reason);
					console.error("[session-purge] schedule delete failed:", reason);
					setError(message);
				}
				finally {
					setBusy(false);
				}
			}, [target, busy, connection, rows, t, refreshPending]);

			const handleRestore = react.useCallback(async (sessionId) => {
				if (busy) return;
				setBusy(true);
				setError(null);
				try {
					await restoreConversation(connection, sessionId);
					const row = rows.find((candidate) => candidate.id === sessionId);
					const rowName = row === undefined ? String(sessionId) : displayNameOf(row);
					setNotice(t("delete.restored.ok", { name: rowName }));
					setPendingList((prev) => prev.filter((p) => p.sessionId !== sessionId));
					void refreshPending();
				}
				catch (reason) {
					const message = reason instanceof Error ? reason.message : String(reason);
					console.error("[session-purge] restore failed:", reason);
					setError(message);
				}
				finally {
					setBusy(false);
				}
			}, [busy, connection, rows, t, refreshPending]);

			const now = Date.now();
			const targetRow = target === null ? undefined : rows.find((row) => row.id === target);
			const targetTitle = targetRow === undefined ? String(target ?? "") : displayNameOf(targetRow);
			const countKey = filtered.length === 1 ? "manage.count.one" : "manage.count.other";

			return jsxs(react.Fragment, {
				children: [
					isSettingsPage
						? jsxs("div", {
							className: "dsp-section-head",
							children: [
								jsx("h2", { className: "dsp-section-title", children: t("manage.title") }),
								jsx("p", { className: "dsp-section-desc", children: t("manage.description") }),
							],
						})
						: jsxs("div", {
							className: "dsp-head-wrap",
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
							],
						}),
					jsxs("div", {
						className: "dsp-tabs",
						role: "tablist",
						children: [
							jsx("button", {
								type: "button",
								role: "tab",
								"aria-selected": activeTab === "all",
								className: activeTab === "all" ? "dsp-tab dsp-tab-active" : "dsp-tab",
								onClick: () => setActiveTab("all"),
								children: t("manage.tab.all"),
							}),
							jsxs("button", {
								type: "button",
								role: "tab",
								"aria-selected": activeTab === "pending",
								className: activeTab === "pending" ? "dsp-tab dsp-tab-active" : "dsp-tab",
								onClick: () => setActiveTab("pending"),
								children: [
									t(pendingList.length > 0 ? "manage.tab.pending" : "manage.tab.pending.empty", { n: String(pendingList.length) }),
									pendingList.length > 0 ? jsx("span", { className: "dsp-badge", children: String(pendingList.length) }) : null,
								],
							}),
						],
					}),
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
					notice !== null && jsx("p", {
						className: "dsp-ok",
						role: "status",
						children: notice,
					}),
					filtered.length === 0
						? jsx("div", {
							className: "dsp-empty",
							children: activeTab === "pending" ? t("manage.pending.empty") : t("manage.empty"),
						})
						: jsx("ul", {
							className: "dsp-list",
							children: filtered.map((row) => jsx(PurgeRow, {
								row,
								workspaceTitle: workspaceTitleOf.get(row.id),
								now,
								busy,
								pendingInfo: pendingMap.get(row.id),
								onDelete: () => {
									setError(null);
									setTarget(row.id);
								},
								onRestore: () => {
									void handleRestore(row.id);
								},
								t,
							}, row.id)),
						}),
					jsxs(Modal, {
						open: target !== null,
						onClose: () => {
							if (!busy) setTarget(null);
						},
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
		 * Official Settings Section for managing conversations, placed under EZAI Account.
		 */
		function SessionManageSection({ useSessions, useWorkspaces, connection, t }) {
			const sessions = useSessions((snapshot) => snapshot);
			const workspaces = useWorkspaces((snapshot) => snapshot);
			return jsx("div", {
				className: "dsp-section",
				children: jsx(SessionManageView, {
					sessions,
					workspaces,
					connection,
					t,
					isSettingsPage: true,
				}),
			});
		}

		/** Required services (cordis fiber inject). */
		exports.inject = ["slots", "sessions", "workspaces", "connection", "locale"];

		/**
		 * Register the conversation manager into Settings section "管理对话" (under EZAI Account, order: 120).
		 */
		exports.apply = function apply(ctx) {
			const connection = ctx.get("connection");
			if (connection === undefined) {
				throw new Error("dsh-session-purge: the connection service is unavailable");
			}
			const locale = ctx.get("locale");
			if (locale !== undefined && typeof locale.register === "function") {
				ctx.effect(() => locale.register(NS, { zh, en }), "dsh-session-purge: dictionaries");
			}

			// Settings dialog section: right under EZAI Account (order: 120)
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "session-purge",
				order: 120,
				label: () => {
					const t = ctx.locale?.bind?.(NS) ?? ((k) => (k === "manage.title" ? zh["manage.title"] : k));
					return t("manage.title");
				},
				locale: NS,
				inject: () => ({ connection }),
			}, SessionManageSection));
		};

		return module.exports;
	},
});

