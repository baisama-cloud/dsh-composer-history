window.__ModuleLoader__.load({
	id: "dsh-composer-history",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");

		/**
		 * Build the plain-text of a finalized user message from its content
		 * blocks (adjacent text blocks join with no separator, mirroring how
		 * provider adapters flatten them). Non-text blocks are skipped.
		 */
		function userMessageText(node) {
			if (!node || node.kind !== "user" || !node.content) return "";
			var text = "";
			for (var i = 0; i < node.content.length; i++) {
				var block = node.content[i];
				if (block && block.type === "text" && typeof block.text === "string") {
					text += block.text;
				}
			}
			return text;
		}

		/**
		 * Chat-store records wrap the message as `{ data: … }`; the flat legacy
		 * slices hand the message object itself. Both shapes appear across the
		 * GUI builds this plugin supports.
		 */
		function nodeData(entry) {
			if (!entry || typeof entry !== "object") return null;
			if (entry.data && typeof entry.data === "object" && (entry.data.kind !== void 0 || entry.data.content !== void 0)) {
				return entry.data;
			}
			return entry;
		}

		/** Chronological key for a node/record, when it carries a seq. */
		function nodeSeq(entry) {
			var data = nodeData(entry);
			if (data && typeof data.seq === "number") return data.seq;
			if (entry && typeof entry.seq === "number") return entry.seq;
			return 0;
		}

		/**
		 * Normalize an array / Map / plain-object node collection into
		 * chronological order. `order` is the chat store's display key list,
		 * used when the collection is a Map.
		 */
		function orderedNodes(value, order) {
			if (!value) return [];
			var out = [];
			if (Array.isArray(value)) {
				out = value.slice();
			} else if (typeof value.get === "function" && Array.isArray(order) && order.length > 0) {
				for (var i = 0; i < order.length; i++) {
					var item = value.get(order[i]);
					if (item !== void 0) out.push(item);
				}
				if (out.length === 0 && typeof value.values === "function") out = Array.from(value.values());
			} else if (typeof value.values === "function") {
				out = Array.from(value.values());
			} else if (typeof value === "object") {
				for (var key in value) {
					if (Object.prototype.hasOwnProperty.call(value, key)) out.push(value[key]);
				}
			}
			return out.sort(function (left, right) {
				return nodeSeq(left) - nodeSeq(right);
			});
		}

		/**
		 * Collect the user-command history from whichever snapshot shape the
		 * running GUI exposes: `useChat` (the official desktop app), `session.chat`
		 * (web-profile builds), and the older flat `session.nodes`.
		 */
		function collectHistory(sources) {
			var entries = [];
			var chat = sources.chat;
			if (chat) {
				entries = orderedNodes(chat.legacy && chat.legacy.nodes, chat.order);
				if (entries.length === 0) entries = orderedNodes(chat.nodes, chat.order);
				if (entries.length === 0) entries = orderedNodes(chat.messages, void 0);
			}
			if (entries.length === 0 && sources.session && sources.session.chat) {
				var sessionChat = sources.session.chat;
				entries = orderedNodes(sessionChat.legacy && sessionChat.legacy.nodes, sessionChat.order);
				if (entries.length === 0) entries = orderedNodes(sessionChat.nodes, sessionChat.order);
			}
			if (entries.length === 0 && sources.session && sources.session.nodes) {
				entries = orderedNodes(sources.session.nodes, void 0);
			}
			if (entries.length === 0 && sources.conversation && sources.conversation.nodes) {
				entries = orderedNodes(sources.conversation.nodes, void 0);
			}

			var history = [];
			for (var i = 0; i < entries.length; i++) {
				var text = userMessageText(nodeData(entries[i]));
				if (text.trim() && !text.trimStart().startsWith("<system-reminder>")) history.push(text);
			}
			return history;
		}

		/** Nearest ancestor of `node` that is a direct child of `root`. */
		function directChildOf(root, node) {
			var current = node;
			while (current && current.parentNode && current.parentNode !== root) current = current.parentNode;
			return current && current.parentNode === root ? current : null;
		}

		/** Which block line the caret sits on inside a contenteditable editor. */
		function caretLine(editor) {
			var selection = editor.ownerDocument.getSelection();
			if (!selection || selection.rangeCount === 0) return null;
			var range = selection.getRangeAt(0);
			if (!editor.contains(range.startContainer)) return null;
			var block = directChildOf(editor, range.startContainer) || editor;
			var first = editor.firstElementChild;
			var last = editor.lastElementChild;
			return {
				first: block === first || block === editor,
				last: block === last || block === editor
			};
		}

		/** Write one recalled entry through the composer's own action, when present. */
		function applyDraft(inputActions, text) {
			if (inputActions && typeof inputActions.setDraft === "function") inputActions.setDraft(text);
		}

		/**
		 * Hidden anchor rendered inside the composer's left tool row. It is only
		 * present so the mounted component locates the composer editor and
		 * installs a capture-phase keydown listener for it. The official desktop
		 * GUI uses a contenteditable editor; web-profile builds use a textarea.
		 */
		function HistoryKeys(props) {
			// The standard props differ between builds (the desktop app exposes
			// useChat/useConversation, the web profile exposes session/input owner
			// props). Each hook's presence is stable for one GUI, so the hook order
			// is stable across that GUI's renders.
			var input = props.useInput ? props.useInput(function (state) { return state; }) : props.input;
			var chat = props.useChat ? props.useChat(function (state) { return state; }) : null;
			var session = props.useSession ? props.useSession(function (state) { return state; }) : props.session;
			var conversation = props.useConversation ? props.useConversation(function (state) { return state; }) : null;
			var history = collectHistory({ chat: chat, session: session, conversation: conversation });
			var draft = input && typeof input.draft === "string" ? input.draft : "";

			var anchorState = react.useState(null);
			var anchor = anchorState[0];
			var setAnchor = anchorState[1];
			var cursorState = react.useState(null);
			var cursor = cursorState[0];
			var setCursor = cursorState[1];
			var scratchState = react.useState("");
			var scratch = scratchState[0];
			var setScratch = scratchState[1];

			// Reconcile cursor against the draft: if the draft no longer matches
			// the entry the cursor points at, the user edited — reset the cursor.
			react.useEffect(function () {
				if (cursor !== null && history[cursor] !== draft) {
					setCursor(null);
					setScratch(draft);
				}
			}, [draft, cursor, history]); // eslint-disable-line react-hooks/exhaustive-deps

			react.useEffect(function () {
				if (!anchor) return;
				var doc = anchor.ownerDocument;
				var editor = null;
				var scope = anchor.parentElement;
				while (scope && scope !== doc.body) {
					var candidate = scope.querySelector('[data-composer-input][contenteditable="true"]') ||
						scope.querySelector("textarea") ||
						scope.querySelector('[role="textbox"][contenteditable="true"]') ||
						scope.querySelector('[contenteditable="true"]');
					if (candidate) {
						editor = candidate;
						break;
					}
					scope = scope.parentElement;
				}
				if (!editor) return;
				var isTextarea = editor.tagName === "TEXTAREA";

				function onKeyDown(event) {
					if (event.target !== editor && !editor.contains(event.target)) return;
					if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
					if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;

					// In a multi-line draft, only take over at the top line for
					// ArrowUp and the bottom line for ArrowDown.
					var first = true;
					var last = true;
					if (draft.indexOf("\n") !== -1) {
						if (isTextarea) {
							if (editor.selectionStart !== editor.selectionEnd) return;
							var caret = editor.selectionStart == null ? draft.length : editor.selectionStart;
							first = draft.slice(0, caret).indexOf("\n") === -1;
							last = draft.slice(caret).indexOf("\n") === -1;
						} else {
							var lines = caretLine(editor);
							if (lines !== null) {
								first = lines.first;
								last = lines.last;
							}
						}
					}
					if (event.key === "ArrowUp" && !first) return;
					if (event.key === "ArrowDown" && !last) return;

					if (event.key === "ArrowUp") {
						if (history.length === 0) return;
						var prev = cursor === null ? history.length - 1 : Math.max(0, cursor - 1);
						event.preventDefault();
						event.stopPropagation();
						if (cursor === null) setScratch(draft);
						setCursor(prev);
						applyDraft(props.inputActions, history[prev]);
						return;
					}

					if (cursor === null) return;
					event.preventDefault();
					event.stopPropagation();
					if (cursor < history.length - 1) {
						var next = cursor + 1;
						setCursor(next);
						applyDraft(props.inputActions, history[next]);
					} else {
						setCursor(null);
						applyDraft(props.inputActions, scratch);
					}
				}

				doc.addEventListener("keydown", onKeyDown, true);
				return function () {
					doc.removeEventListener("keydown", onKeyDown, true);
				};
			}, [anchor, cursor, scratch, draft, history]); // eslint-disable-line react-hooks/exhaustive-deps

			return react.createElement("span", {
				ref: setAnchor,
				"aria-hidden": true,
				style: { display: "none" }
			});
		}

		var entry = {
			name: "dsh-composer-history",
			inject: ["slots"],
			apply(ctx) {
				ctx.slots.inject("conversation.input.left", () => ctx.slots.register({
					name: "conversation.input.left",
					id: "dsh-composer-history",
					order: 90,
					label: "Composer history"
				}, HistoryKeys));
			}
		};

		exports.apply = entry.apply;
		exports.inject = entry.inject;
		return module.exports;
	}
});
