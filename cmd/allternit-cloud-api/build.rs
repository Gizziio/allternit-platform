fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Vendored protoc keeps Docker/CI builds free of a system protobuf
    // toolchain (the Dockerfile does not install one).
    std::env::set_var("PROTOC", protoc_bin_vendored::protoc_bin_path()?);
    // Only the admin client is needed; compiling headscale.proto pulls in the
    // imported user/preauthkey/node/... messages transitively.
    tonic_build::configure()
        .build_server(false)
        .build_client(true)
        .compile_protos(&["proto/headscale/v1/headscale.proto"], &["proto"])?;
    Ok(())
}
