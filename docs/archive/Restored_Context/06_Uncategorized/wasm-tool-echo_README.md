# Echo Tool (WASM Component Example)

This example implements the Allternit Tool ABI and returns the input parameters
as JSON. It is intended as a minimal template for authoring tools.

## Build the Component

Option A (recommended):
1) Install cargo-component: `cargo install cargo-component`
2) Build the component:
   `cargo component build --release`

The build output prints the component path. Use that `.wasm` file in the next step.

Option B (manual componentization):
1) Build the core module:
   `cargo build --release --target wasm32-unknown-unknown`
2) Use `wasm-tools component new` with `wit/tool-abi.wit` and world `tool-component`
   to lift the core module into a component. (See wasm-tools docs for exact flags.)

## Package a Capsule

Use the capsule builder example to bundle the component:

```
cargo run -p allternit-capsule --example build_capsule -- \
  --id com.allternit.tools.echo \
  --version 0.1.0 \
  --wasm <path-to-component.wasm> \
  --out ./echo.capsule
```

The resulting `echo.capsule` can be loaded into the capsule store and executed
via the WASM runtime.
