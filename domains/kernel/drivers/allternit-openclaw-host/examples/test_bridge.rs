use a2r_openclaw_host::skills::{SkillRegistry, SkillRegistryBridge};
use std::path::Path;

fn main() {
    let vendor_dir = Path::new("3-adapters/vendor/openclaw");
    println!("Loading skills from vendor dir: {:?}", vendor_dir);

    match SkillRegistryBridge::with_vendor_dir(vendor_dir) {
        Ok(bridge) => {
            println!("Successfully created bridge");
            let stats = bridge.registry().stats();
            println!("Registry stats: {:?}", stats);

            let request = a2r_openclaw_host::skills::ListSkillsRequest {
                include_unavailable: false,
            };

            match bridge.list_skills(request) {
                Ok(response) => {
                    println!(
                        "List skills response: {} skills found",
                        response.skills.len()
                    );
                    for (i, skill) in response.skills.iter().enumerate() {
                        println!(
                            "  {}: {} - {} (available: {})",
                            i + 1,
                            skill.id,
                            skill.name,
                            skill.available
                        );
                    }
                }
                Err(e) => {
                    println!("Error listing skills: {:?}", e);
                }
            }
        }
        Err(e) => {
            println!("Error creating bridge: {:?}", e);
        }
    }
}
