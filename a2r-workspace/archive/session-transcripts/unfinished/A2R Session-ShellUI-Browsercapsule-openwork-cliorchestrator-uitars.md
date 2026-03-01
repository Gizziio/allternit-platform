A2rchitech Session Summary — Shell UI + Browser Capsule + OpenWork + CLI Orchestrator + UI-TARS + A2UI/AG-UI

Date: 2026-01-26 (America/Chicago)
Scope: Align A2rchitech into an agentic engineering OS: windowed capsules, browser capsule, miniapp capsules, A2UI/AG-UI schema plane, and a top-level A2 CLI that orchestrates multiple external CLI “brains” via PTY subprocesses. Also: OpenWork is first-class in Shell UI (not an iframe to some random port), and UI-TARS is a computer-use tool layer.

⸻

1) Ground truth decisions (locked)

1.1 A2 CLI is the top process
	•	A2 CLI is the controlling parent process.
	•	It spawns external CLI tools as PTY subprocess “brains”:
	•	opencode, claude code, codex, amp, goose, aider, qwen, gemini, cursor, verdant (and any others we add).
	•	These brains are the “neural runtime” for coding + ops flows; A2 CLI provides:
	•	unified lifecycle (start/stop/list/attach)
	•	unified session identity + routing
	•	unified logging/telemetry hooks
	•	unified tool registry integration (A2 platform tools + vendor tools)

1.2 OpenWork is NOT “a server we point to”
	•	We already have an OpenWork codebase locally (desktop).
	•	OpenWork must be integrated as a first-class Shell UI tab/view, not an iframe pointing at the shell Vite port.
	•	The Shell UI runs on port 5713 for this context.
	•	OpenWork is an Ops Center tab inside Shell UI, not “OpenWork running on 5173”.

1.3 UI-TARS role
	•	UI-TARS is a computer-use agent tool layer (GUI automation).
	•	It is not a replacement for code-level agents; it’s a tool that enables:
	•	screenshot → propose action → execute click/type/scroll → verify → loop

1.4 A2UI + AG-UI role
	•	A2UI is the schema-driven UI composition plane (adapter → schema → renderer).
	•	AG-UI is the agent-driven patch plane (agents modify UI/schema via patches).
	•	Miniapp capsules + browser chrome should be schema-driven (A2UI), not hardcoded React-only chrome, if we want dynamic/agent-extensible surfaces.

⸻

2) What was failing / why progress felt fake

2.1 Browser capsule not matching intended windowing UX

Observed: browser still looked wrong, not draggable/snap-grid, not browsing reliably.

Root classes of failure we hit repeatedly:
	•	BrowserView attachment/bounds bugs (zero bounds, wrong origin, DPR double-normalization).
	•	IPC contract mismatches (preload send vs main handle/invoke) causing silent failures.
	•	“Initializing window” zombie state due to incomplete async error handling and state desync.

2.2 OpenWork integration misunderstanding

A wrong assumption kept appearing: “OpenWork on port 5173.”
Correct: OpenWork must be a Shell tab/view at 5713, integrated as UI, not a server pointer.

⸻

3) Required end-state UX (what “done” looks like)

3.1 Capsules behave like a real OS layer

Capsules must support:
	•	move / drag / resize
	•	snap to grid
	•	minimize
	•	tabbing (drag a window into a tab strip; reopen from tabs)
	•	reopen closed capsules (soft close / recents)

3.2 Browser capsule is a workspace container

Browser capsule must include:
	•	tab strip (browser tabs, add tab)
	•	nav controls, omnibox
	•	mode switch (Human vs Agent intent)
	•	miniapps dockable inside browser (Inspector, Agent Steps, etc.)
	•	miniapps can also float as separate capsules (windowed miniapps)

3.3 No emoji UI
	•	Capsule icons must be custom SVG assets (vendor or generated), not emojis.
	•	On capsule creation, icon should be derived from:
	•	capsule type
	•	vendor tool identity (opencode, claude code, etc.)
	•	registry mapping → SVG

⸻

4) Miniapp capsules: where they live and how they render

4.1 Creation

Miniapp capsules come from:
	•	Shell capsule registry + window manager
	•	plus optional AG-UI patches that can:
	•	add buttons/tools into chrome
	•	spawn/dock miniapps
	•	alter schemas

4.2 Display pipeline (must be consistent everywhere)
	•	CapsuleWindowFrame provides window affordances (drag/resize/min/max/tab/close).
	•	Inside the frame:
	•	A2UISurface mounts
	•	A2UISurface feeds A2UIRenderer with schema
	•	Browser capsule:
	•	BrowserAdapter → schema for chrome/tabs/buttons/miniapp dock toggles
	•	optional AG-UI patches modify that schema live

Docking targets:
	•	Docked miniapps: inside browser right rail / sidebar
	•	Floating miniapps: own CapsuleWindowFrame as separate capsule

⸻

5) CLI “brains” PTY coverage (must include MORE than prior list)

The target list explicitly includes:
	•	opencode
	•	claude code
	•	codex
	•	amp
	•	goose
	•	aider
	•	qwen
	•	gemini
	•	cursor
	•	verdant

Each must be supported as:
	•	detectable (a2 which)
	•	spawnable as PTY subprocess (a2 brain start --tool <name>)
	•	attachable (view streaming output)
	•	stoppable
	•	session-managed (IDs, workspace binding, logs)

⸻

6) Key deliverables that were discussed/produced in this session

6.1 Audit + plans (uploaded)
	•	A2_AUDIT_MAP.md
	•	A2_IMPLEMENTATION_PLAN.md
	•	A2_REUSE_VS_BUILD.md
	•	AGENT_HANDOFF_PACKAGE.md
	•	MASTER_AGENT_AUDIT_AND_EXECUTION_PROMPT.md
	•	CORRECTED_AGENT_PROMPT.md
	•	CLI_PTY_OPENWORK_UITARS_REAUDIT.md
	•	CLI_PTY_OPENWORK_UITARS_DEMO.md

6.2 Visual artifacts (generated for clarity)
	•	Architecture diagram image: A2_architecture_diagram.png
	•	Shell UI mock image: A2_shell_ui_mock.png

(These visuals are meant to “show the system” so implementation can align to a concrete target.)

⸻

7) Corrective directives that must be reflected in the agent’s execution

7.1 OpenWork integration (non-negotiable)
	•	Do not iframe localhost:5173.
	•	Do not treat OpenWork as “some external dev server”.
	•	Use the local OpenWork codebase and integrate as a first-class Shell tab at the Shell UI layer (port 5713 context).

7.2 Windowing OS behaviors must be real, not stubbed

Implement actual:
	•	minimize → dock
	•	drag to tab strip → tab
	•	click tab → restore
	•	close → soft close → reopen
	•	snap-to-grid

7.3 Icons must be SVG assets (no emojis)
	•	Add/expand an icon registry that maps:
	•	capsule types + vendor tool IDs → SVG component/asset
	•	Generate/ingest vendor icons for all listed tools, not just 2–3.

7.4 UI-TARS must be executable loop, not “primitives only”
	•	Tools are not enough; need an execution loop:
	•	screenshot → propose → act → verify → iterate

⸻

8) What “next agent” must do (high-level, ordered)
	1.	Re-ground OpenWork: integrate local OpenWork code as Shell tab (no server pointer confusion).
	2.	Finish OS windowing: minimize/tabbing/reopen/snap + state machine in window manager.
	3.	Complete A2 CLI PTY brains: add PTY spawn/attach/stop/list for all target tools.
	4.	UI-TARS loop: connect GUI tool execution to a propose/verify cycle.
	5.	A2UI/AG-UI integration: schema-driven browser chrome + miniapp docking, with agent patch capability.
	6.	Replace emojis: vendor SVG pipeline + capsule icon registry across shell UI.

⸻

9) Definition of Done (testable)
	•	Browser capsule is a real draggable/resizable/snappable window.
	•	Minimize sends capsule to Dock; restore works.
	•	Dragging a capsule to TabStrip tabs it; clicking tab restores it.
	•	OpenWork appears as a true Shell tab (not iframe to 5173).
	•	a2 brain start --tool opencode (etc.) spawns PTY subprocess; output streams; attach works.
	•	UI-TARS can execute at least a 3-step GUI automation loop.
	•	No emojis for capsule/tool icons; all SVG-based and registry-driven.

⸻
