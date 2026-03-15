fn main() {
    // On macOS, we need to allow undefined symbols for NAPI
    // These will be resolved at runtime by Node.js
    #[cfg(target_os = "macos")]
    {
        println!("cargo:rustc-cdylib-link-arg=-undefined");
        println!("cargo:rustc-cdylib-link-arg=dynamic_lookup");
    }

    // On Linux, similar setup
    #[cfg(target_os = "linux")]
    {
        println!("cargo:rustc-cdylib-link-arg=-Wl,--unresolved-symbols=ignore-all");
    }
}
