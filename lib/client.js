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
		 * Collect the user-command history for this session: every finalized
		 * user message's text, oldest first. Messages that merely wrap a system
		 * reminder are skipped.
		 */
		function collectHistory(session) {
			var history = [];
			var nodes = session && session.nodes ? session.nodes : [];
			for (var i = 0; i < nodes.length; i++) {
				var text = userMessageText(nodes[i]);
				if (text.trim() && !text.trimStart().startsWith("<system-reminder>")) {
					history.push(text);
				}
			}
			return history;
		}

		/**
		 * Hidden anchor rendered inside the composer's left tool row. It is only
		 * present so the mounted component locates the composer textarea a few
		 * DOM levels up; it installs a capture-phase keydown listener on the
		 * document for that textarea.
		 */
		function HistoryKeys(props) {
			var history = collectHistory(props.session);
			var anchorState = react.useState(null);
			var anchor = anchorState[0];
			var setAnchor = anchorState[1];
			var cursorState = react.useState(null);
			var cursor = cursorState[0];
			var setCursor = cursorState[1];
			var scratchState = react.useState("");
			var scratch = scratchState[0];
			var setScratch = scratchState[1];
			var draft = props.input && typeof props.input.draft === "string" ? props.input.draft : "";

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
				var scope = anchor.parentElement;
				var textarea = null;
				while (scope && scope !== doc.body) {
					var candidate = scope.querySelector("textarea");
					if (candidate) {
						textarea = candidate;
						break;
					}
					scope = scope.parentElement;
				}
				if (!textarea) return;

				function onKeyDown(event) {
					if (event.target !== textarea) return;
					if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
					if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
					if (textarea.selectionStart !== textarea.selectionEnd) return;

					var caret = textarea.selectionStart == null ? draft.length : textarea.selectionStart;
					// In a multi-line draft, only take over at the top line for ArrowUp
					// and the bottom line for ArrowDown.
					if (event.key === "ArrowUp" && draft.slice(0, caret).indexOf("\n") !== -1) return;
					if (event.key === "ArrowDown" && draft.slice(caret).indexOf("\n") !== -1) return;

					if (event.key === "ArrowUp") {
						if (history.length === 0) return;
						var prev = cursor === null ? history.length - 1 : Math.max(0, cursor - 1);
						event.preventDefault();
						if (cursor === null) setScratch(draft);
						setCursor(prev);
						props.inputActions.setDraft(history[prev]);
						return;
					}

					if (cursor === null) return;
					event.preventDefault();
					if (cursor < history.length - 1) {
						var next = cursor + 1;
						setCursor(next);
						props.inputActions.setDraft(history[next]);
					} else {
						setCursor(null);
						props.inputActions.setDraft(scratch);
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
