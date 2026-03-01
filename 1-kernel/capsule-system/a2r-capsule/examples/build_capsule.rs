use a2r_capsule::bundle::{CapsuleBundler, ManifestBuilder};
use a2r_capsule::manifest::{Capabilities, IdempotencyBehavior, SafetyTier, ToolABISpec};
use a2r_capsule::signing::SigningKey;
use semver::Version;
use std::collections::HashMap;
use std::path::PathBuf;

struct Args {
    id: String,
    version: Version,
    wasm: PathBuf,
    out: PathBuf,
    publisher: String,
    name: String,
    description: String,
}

impl Args {
    fn parse() -> Result<Self, String> {
        let mut values = HashMap::new();
        let mut args = std::env::args().skip(1);

        while let Some(flag) = args.next() {
            if !flag.starts_with("--") {
                return Err(format!("unexpected argument: {}", flag));
            }
            let key = flag.trim_start_matches("--").to_string();
            let value = args
                .next()
                .ok_or_else(|| format!("missing value for --{}", key))?;
            values.insert(key, value);
        }

        let id = values
            .remove("id")
            .ok_or_else(|| "missing --id".to_string())?;
        let version = values
            .remove("version")
            .ok_or_else(|| "missing --version".to_string())?;
        let wasm = values
            .remove("wasm")
            .ok_or_else(|| "missing --wasm".to_string())?;
        let out = values
            .remove("out")
            .ok_or_else(|| "missing --out".to_string())?;

        let publisher = values
            .remove("publisher")
            .unwrap_or_else(|| "example-publisher".to_string());
        let name = values.remove("name").unwrap_or_else(|| id.clone());
        let description = values
            .remove("description")
            .unwrap_or_else(|| "Example capsule generated from a component".to_string());

        if !values.is_empty() {
            let extras = values.keys().cloned().collect::<Vec<_>>().join(", ");
            return Err(format!("unknown flags: {}", extras));
        }

        Ok(Self {
            id,
            version: Version::parse(&version).map_err(|err| err.to_string())?,
            wasm: wasm.into(),
            out: out.into(),
            publisher,
            name,
            description,
        })
    }
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = match Args::parse() {
        Ok(args) => args,
        Err(message) => {
            eprintln!(
                "{}\n\nUsage: build_capsule --id <id> --version <semver> --wasm <component.wasm> --out <bundle.tgz> [--publisher <id>] [--name <name>] [--description <text>]",
                message
            );
            std::process::exit(2);
        }
    };

    let tool_abi = ToolABISpec {
        name: args.id.clone(),
        description: args.description.clone(),
        input_schema: serde_json::json!({"type": "object"}),
        output_schema: serde_json::json!({"type": "object"}),
        side_effects: Vec::new(),
        safety_tier: SafetyTier::Safe,
        idempotency: IdempotencyBehavior::Idempotent,
        examples: Vec::new(),
    };

    let manifest_builder = ManifestBuilder::new(
        &args.id,
        args.version,
        args.name,
        args.description,
        tool_abi,
    )
    .capabilities(Capabilities {
        needs_clock: false,
        needs_random: false,
        ..Capabilities::default()
    });

    let signing_key = SigningKey::generate(&args.publisher);
    let bundle = CapsuleBundler::new()
        .wasm_component(&args.wasm)
        .manifest(manifest_builder)
        .build(&signing_key)?;

    bundle.save(&args.out)?;

    println!("Wrote capsule bundle to {}", args.out.display());
    Ok(())
}
