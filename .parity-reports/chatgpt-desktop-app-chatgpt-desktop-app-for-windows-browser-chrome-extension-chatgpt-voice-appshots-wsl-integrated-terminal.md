---
status: done
files_changed:
  - docs/public/parity/chatgpt-desktop-app.md
  - docs/public/parity/chatgpt-desktop-app-for-windows.md
  - docs/public/parity/browser.md
  - docs/public/parity/chrome-extension.md
  - docs/public/parity/chatgpt-voice.md
  - docs/public/parity/appshots.md
  - docs/public/parity/wsl.md
  - docs/public/parity/integrated-terminal.md
  - .parity-reports/chatgpt-desktop-app-chatgpt-desktop-app-for-windows-browser-chrome-extension-chatgpt-voice-appshots-wsl-integrated-terminal.md
items_covered:
  - See what the app can do
  - Your command center for complex work
  - Customize for your dev setup
  - Git features are unavailable
  - Git isn't detected for projects opened from `\\wsl$`
  - Local environment scripts on Windows
  - Native sandbox
  - PowerShell execution policy blocks commands
  - Preferred editor
  - Run commands with elevated permissions
  - Share config, auth, and sessions with WSL
  - Troubleshooting and FAQ
  - Useful developer tools
  - Windows Subsystem for Linux (WSL)
  - "`Cmder` isn't listed in the open dialog"
  - Browser data
  - Comment on the page
  - Keep browser tasks scoped
  - Limitations
  - Manage browsing history
  - Preview a page
  - Search from the address bar
  - Start browser work
  - Styling feedback
  - Website permissions and confirmations
  - Ask about a YouTube video
  - Bring tabs and selected text into a chat
  - Control website access
  - Data and security
  - Manage allowed and blocked websites
  - Set up the Chrome extension
  - Start a Chrome task from ChatGPT
  - Upload files
  - Use ChatGPT from Chrome
  - What OpenAI stores from browsing
  - Delegate and coordinate work
  - Have a conversation
  - Show ChatGPT what you see
  - Start talking
  - Limits and troubleshooting
  - Permissions and safety
  - Take an appshot
  - What appshots capture
  - When to use appshots
  - Confirm you're connected to WSL
  - Launch VS Code from inside WSL
  - Open VS Code from a WSL terminal
  - Work on code inside WSL
  - Create reusable actions
  - Run and validate your project
items_missing:
  - "Native Windows desktop integration: roadmap; the current runtime is Unix-first and WSL is recommended."
  - "Chrome extension integration: roadmap; the optional extension package is not bundled and its compatibility stub exposes no tools."
  - "Polished duplex voice UI and live camera/screen share: roadmap; STT/TTS and ACI exist as composable services."
notes: "Docs-only change; no build was run. Existing browser-tools, ACI, voice, upload, configuration, skill/plugin, and terminal contracts were used as implementation evidence. The handoff file was not edited."
---

# Coverage report

Created one parity page for each assigned category. Existing Allternit capabilities are mapped to concrete commands, configuration, SDK examples, or HTTP endpoints. Product-specific native Windows, Chrome extension, and live voice UI behavior is explicitly marked Not applicable / roadmap where the repository contains no production equivalent.

No Rust or application code was changed, so `cargo check -p allternit-api` was not run.
