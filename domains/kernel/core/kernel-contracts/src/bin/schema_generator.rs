use a2rchitech_kernel_contracts::*;
use schemars::schema_for;
use std::fs;
use std::path::Path;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let schemas_dir = Path::new("schemas");
    fs::create_dir_all(schemas_dir)?;

    // Generate EventEnvelope schema
    let schema = schema_for!(EventEnvelope);
    let schema_json = serde_json::to_string_pretty(&schema)?;
    fs::write(schemas_dir.join("event_envelope.json"), schema_json)?;

    // Generate RunModel schema
    let schema = schema_for!(RunModel);
    let schema_json = serde_json::to_string_pretty(&schema)?;
    fs::write(schemas_dir.join("run_model.json"), schema_json)?;

    // Generate ToolABI schema
    let schema = schema_for!(ToolABI);
    let schema_json = serde_json::to_string_pretty(&schema)?;
    fs::write(schemas_dir.join("tool_abi.json"), schema_json)?;

    // Generate ToolRequest schema
    let schema = schema_for!(ToolRequest);
    let schema_json = serde_json::to_string_pretty(&schema)?;
    fs::write(schemas_dir.join("tool_request.json"), schema_json)?;

    // Generate ToolResponse schema
    let schema = schema_for!(ToolResponse);
    let schema_json = serde_json::to_string_pretty(&schema)?;
    fs::write(schemas_dir.join("tool_response.json"), schema_json)?;

    // Generate PolicyDecision schema
    let schema = schema_for!(PolicyDecision);
    let schema_json = serde_json::to_string_pretty(&schema)?;
    fs::write(schemas_dir.join("policy_decision.json"), schema_json)?;

    // Generate VerifyArtifact schema
    let schema = schema_for!(VerifyArtifact);
    let schema_json = serde_json::to_string_pretty(&schema)?;
    fs::write(schemas_dir.join("verify_artifact.json"), schema_json)?;

    // Generate ContextBundle schema
    let schema = schema_for!(ContextBundle);
    let schema_json = serde_json::to_string_pretty(&schema)?;
    fs::write(schemas_dir.join("context_bundle.json"), schema_json)?;

    println!("JSON schemas generated successfully in the 'schemas' directory!");
    Ok(())
}
