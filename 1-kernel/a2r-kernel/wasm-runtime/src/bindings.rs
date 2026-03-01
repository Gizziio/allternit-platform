#![allow(clippy::all)]

wasmtime::component::bindgen!({
    path: "wit",
    world: "tool-component",
});
