use a2r_openclaw_host::skills::{GetSkillRequest, ListSkillsRequest, SkillRegistryBridge};
use std::path::Path;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Get command line arguments
    let args: Vec<String> = std::env::args().collect();

    if args.len() < 3 {
        eprintln!("Usage: {} <operation> <vendor_path> [payload]", args[0]);
        std::process::exit(1);
    }

    let operation = &args[1];
    let vendor_path = &args[2];

    let payload = if args.len() > 3 { &args[3] } else { "" };

    let vendor_path = Path::new(vendor_path);

    // Create the skill registry bridge
    let bridge = SkillRegistryBridge::with_vendor_dir(vendor_path)?;

    match operation.as_str() {
        "list_skills" => {
            let request: ListSkillsRequest = if !payload.is_empty() {
                serde_json::from_str(payload)?
            } else {
                ListSkillsRequest {
                    include_unavailable: false,
                }
            };

            let response = bridge.list_skills(request)?;
            println!("{}", serde_json::to_string(&response)?);
        }

        "get_skill" => {
            let request: GetSkillRequest = serde_json::from_str(payload)?;

            let response = bridge.get_skill(request)?;
            println!("{}", serde_json::to_string(&response)?);
        }

        "is_available" => {
            let skill_id = payload;
            let available = bridge.is_skill_available(skill_id)?;
            println!("{}", serde_json::to_string(&available)?);
        }

        _ => {
            eprintln!("Unknown operation: {}", operation);
            std::process::exit(1);
        }
    }

    Ok(())
}
