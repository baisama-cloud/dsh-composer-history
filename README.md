# dsh-composer-history

Command history for the DeepSeek Harness (DSH) web GUI composer — press **↑ / ↓** to cycle through your previously sent instructions, then restore the draft you were editing when you reach the end of the history.

DSH Web 界面输入框的命令历史插件：**↑ / ↓** 上下方向键逐一浏览此前发送的指令，回到历史末尾时恢复你编辑前的草稿。

## Features / 功能

- **↑** switches to an older sent instruction, **↓** to a newer one — the current draft is preserved underneath.
- When you reach the newest entry and press **↓** again, the draft you were editing is restored.
- Only finished **user** messages count; system-injected reminders are skipped.
- Multi-line drafts are safe: ↑ is taken over only on the first line, ↓ only on the last line.
- Never triggers during IME composition, with text selected, or with Ctrl / Cmd / Alt / Shift held.
- Works in both the official desktop app (Lexical `contenteditable` composer) and web-profile builds (`textarea` composer).

## Install / 安装

```sh
dsh plugin --profile web add github:<owner>/dsh-composer-history
```

or in DSH settings → Plugins market, add the repository. 或在 DSH 设置 → 插件市场中添加本仓库安装。

## Usage / 使用

1. Click into the composer in any session.
2. Press **↑** to step back through previously sent commands; press **↓** to move forward, and once past the newest entry your original draft returns.
3. Edit a recalled command and send it as usual.

## Development / 开发

This is a standard DSH bundle:

- `lib/index.js` — host half (intentionally empty; all behavior is client-side)
- `lib/client.js` — browser half, a Cordis plugin registered via `window.__ModuleLoader__.load`; it hooks the `conversation.input.left` slot, locates the composer editor (a `textarea` in web-profile builds, the official desktop app's `[data-composer-input]` contenteditable), reads the draft through `useInput`/`inputActions`, and collects user messages from `useChat` (desktop), `session.chat` (web profile), or the older flat `session.nodes` shape
- `cordis.patch.yml` — loader row inserting the plugin

Build the npm tarball with:

```sh
npm pack
```

Requires `react` and `@deepseek-ai/cordis` as peer dependencies (provided by the DSH installation).

## License / 许可证

MIT
