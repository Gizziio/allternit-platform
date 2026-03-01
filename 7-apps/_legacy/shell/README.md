# Shell (Capsule Runtime Host)

This is a minimal host that implements:
- capsule instances (tabs)
- canvas rendering
- naive framework selection from intents
- local mock journal (events visible)

## Run
- `npm install`
- `npm run dev`

## Notes
- The shell imports the renderer from `apps/ui/src` directly for simplicity.
  In a real monorepo build, this becomes `@a2rchitech/ui` built to dist.
