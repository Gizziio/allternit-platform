fn main() -> Result<(), Box<dyn std::error::Error>> {
    tonic_build::configure()
        .build_server(false)  // We only need client
        .build_client(true)
        .compile(
            &["proto/verification.proto"],
            &["proto"],
        )?;
    Ok(())
}
