use a2r_openclaw_host::skills::parser::load_skills_dir;
use std::path::Path;

fn main() {
    let skills_dir = Path::new("3-adapters/vendor/openclaw/skills");
    println!("Loading skills from: {:?}", skills_dir);

    let results = load_skills_dir(skills_dir);
    println!("Found {} skill results", results.len());

    for (i, result) in results.iter().enumerate() {
        match result {
            Ok(skill) => {
                println!(
                    "Skill {}: {} - {}",
                    i + 1,
                    skill.manifest.name,
                    skill.manifest.description
                );
            }
            Err(e) => {
                println!("Error in skill {}: {:?}", i + 1, e);
            }
        }
    }
}
