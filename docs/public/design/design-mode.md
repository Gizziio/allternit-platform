# Design mode

Design mode is where you build web artifacts with the agent: landing pages, decks, prototypes, mockups — anything self-contained HTML. You describe the goal, the agent generates, and you refine by pointing at what you want changed.

Available in the platform web app and the Allternit Desktop app (identical surface), and seedable from the terminal with `/design [prompt]`.

## Generating

- **Skills with inputs** — design skills declare structured inputs (audience, tone, sections, palette…). Fill the form; the agent gets a complete brief instead of a one-line guess.
- **Model picker** — choose the generation model per turn from the composer.
- **Aspect pills** — preview target ratios (desktop / tablet / phone) without leaving the session.
- **Templates** — artifacts are built from self-contained templates (plain HTML, SVG, Mermaid, React), so results render offline and sandbox cleanly.

## Surgical editing

Two ways to change one specific thing without regenerating everything:

### Click-to-target

Turn on the crosshair, click any element in the preview. The element gets a stable `data-aio-id`, and the surgical panel is seeded with a description (tag, text snippet). Type the change — "make this headline an H2 in brand color" — and the agent edits just that element. Click targeting works through the sandbox boundary via a validated `postMessage` channel; stored artifacts never carry the targeting markup.

### Edit in place (two-way binding)

For mechanical edits you don't need the agent at all. With an element targeted, the **Edit in place** box can:

| Edit | Effect |
|------|--------|
| Text | Replace the element's text content |
| Attribute | Set or remove an attribute (`href`, `src`, `class`, …) |
| Inner HTML | Replace the element's children |

Edits are written back into the artifact source by a position-tracking parser: everything outside the target element is preserved byte-for-byte, and re-applying the same edit is a no-op. The agent-prompt path stays available for anything structural.

## Critique

The critique panel reviews the current artifact against your goal. Images the agent produced in the latest turn are attached automatically (latest first, up to 6), and when the reviewing brain supports vision input the images are sent as real multimodal parts — otherwise they ride as referenced attachments.

## Self-verification (render and compare)

After an edit pass the agent can render the result and compare it against the request — catching unstyled sections, missing content, or layout breakage before you have to. Bounded to at most two passes per turn.

## Gallery

Everything you save lands in the gallery:

- **Capture on save** — a PNG snapshot is taken when an artifact is saved.
- **Thumbnails** — cards render lazy thumbnails from the stored artifact HTML; entries without a snapshot get an on-the-fly render.
- **Click-to-remix** — open any saved artifact as a new design session starting from that source.
- **Version history** — up to 10 file versions per project; restore any version (a restore is itself stored as a new version, so nothing is lost).
- **Publish actions** — publish/unpublish/status per artifact (see [Artifacts](artifacts.md#publish)).
- **Relay provenance** — artifacts received from another gateway show where they came from.

## From the terminal

```
/design                     # open the studio
/design a landing page for # open with the prompt pre-loaded
                              a bakery, warm palette
```

`/design` prints the deep link and then waits for the studio to actually consume the prompt — you'll see `A:// Studio picked up your prompt.` once it's live in the composer. The receipt is local-only (`~/.allternit/design-prompt-ack.json`); nothing leaves the machine.

## Sandbox

The preview iframe runs with `sandbox="allow-scripts allow-forms allow-modals"` (no `allow-same-origin`) and a strict CSP injected into every srcdoc:

```
default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline';
img-src data: blob:; media-src blob:; font-src data:; connect-src 'none';
form-action 'none'; base-uri 'none'
```

Inline artifact JS and data-/blob-embedded media work; network fetches, external scripts/images/fonts, form submission, and base-tag redirects don't. Storage is shimmed to be session-only. This is what makes "run generated code on your machine" a reasonable thing to do, and it's why network-dependent pages can't be published.
