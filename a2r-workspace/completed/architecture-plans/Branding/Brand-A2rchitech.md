Below is the one-page system identity spec you can drop straight into your repo as:

/docs/branding.md

No fluff. This is infra-grade.

⸻

A://rchitech — System Identity & Namespace Grammar

1. Core Identity

Primary Sigil

A://

Represents:
	•	protocol root
	•	execution substrate
	•	agent fabric
	•	OS-level namespace

Full System Name

A://rchitech

Used for:
	•	website header
	•	documentation landing
	•	installer
	•	launch screens
	•	investor materials

Engineering Mode

a://

Lowercase for CLI, configs, logs, and runtime surfaces.

⸻

2. Semantic Model

A://rchitech is branded as a protocol-shaped operating system.

Everything in the ecosystem is mounted beneath the root.

Canonical grammar:

A://{layer}/{component}

This mirrors:
	•	URI schemes
	•	filesystem mounts
	•	container registries
	•	service routing
	•	RPC namespaces

⸻

3. Reserved System Namespaces

These are first-class surfaces and must always follow the grammar.

A://kernel
A://agent
A://runtime
A://studio
A://browser
A://capsule
A://skill
A://pipeline
A://memory
A://graph
A://vm
A://network
A://security
A://orchestrator

CLI form:

a://kernel
a://agent


⸻

4. Logo Usage Rules

A:// (Sigil)

Used for:
	•	dock icon
	•	favicon
	•	splash screen
	•	watermark
	•	boot logo
	•	system tray

A://rchitech (Wordmark)

Used for:
	•	headers
	•	website
	•	documents
	•	installers
	•	pitch decks

Prohibited
	•	adding decorative glyphs
	•	rounded punctuation
	•	curved slashes
	•	gradients inside core sigil
	•	rewriting as “A2://”

⸻

5. Geometry Constraints

All marks must obey:
	•	45° forward slashes
	•	uniform stroke width
	•	grid-aligned geometry
	•	squared terminals
	•	optical balance at 16px
	•	monoline construction
	•	diagonal cut matches A glyph

The // must visually imply 2 without breaking URI grammar.

⸻

6. Typography System

Primary UI font:
	•	grotesk or neo-grotesk sans
	•	squared punctuation
	•	high x-height

CLI / Docs:
	•	modern monospace
	•	visible colon and slash
	•	no calligraphic terminals

Never mix serif fonts into system branding.

⸻

7. Color System

Core
	•	black
	•	white

Infra Accents
	•	electric cyan
	•	signal green
	•	kernel violet

Error / Alerts
	•	red-orange

Security / Restricted Mode
	•	amber

The sigil must always exist in monochrome first before accented versions.

⸻

8. Motion Grammar

Boot animation sequence:

A
→ :
→ //
→ mount kernel

CLI startup:

[ a://kernel ] mounted
[ a://agent ] ready
[ a://studio ] online

Studio splash:

Initializing A://rchitech…


⸻

9. Symbolic Primitive Layer (Optional UI System)

Secondary glyphs may be used across diagrams and interfaces:

Glyph	Meaning
//	transport
::	scope
>	pipeline
@	identity
*	agent
[]	capsule
{}	plan
<>	model
#	node

Example flow:

@user → A://agent[*] > A://runtime > A://browser


⸻

10. Brand Positioning Summary

A://rchitech is not framed as:
	•	an app
	•	a SaaS product
	•	a chatbot
	•	a UI toolkit

It is framed as:

a protocol-shaped operating system for agents.

The identity system must always reinforce:
	•	orchestration
	•	substrate
	•	kernel
	•	routing
	•	execution
	•	runtime surfaces

⸻

11. Lock Statement

The following are now canonical:
	•	Sigil: A://
	•	System Name: A://rchitech
	•	Grammar: A://{layer}
	•	CLI Root: a://
	•	Style: infrastructure-first

No alternative spellings.

No decorative deviations.

⸻

