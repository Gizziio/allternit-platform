//! Example: provision an Incus desktop and capture a screenshot via the driver.
//!
//! Usage:
//!   INCUS_URL=https://mail:8443 \
//!   INCUS_VNC_HOST=mail \
//!   INCUS_CLIENT_CERT=$HOME/.config/allternit/incus/client.crt \
//!   INCUS_CLIENT_KEY=$HOME/.config/allternit/incus/client.key \
//!   INCUS_INSECURE_SKIP_VERIFY=true \
//!   cargo run -p allternit-computer-cloud --example provision_desktop

use std::sync::Arc;

use allternit_computer_cloud::IncusDriver;
use allternit_driver_interface::{
    CommandSpec, EnvironmentSpec, ExecutionDriver, PolicySpec, ResourceSpec, SpawnSpec, TenantId,
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let incus_url = std::env::var("INCUS_URL")?;
    let vnc_host = std::env::var("INCUS_VNC_HOST").unwrap_or_else(|_| "localhost".to_string());

    let driver = Arc::new(IncusDriver::from_url(incus_url, vnc_host)?);

    let tenant = TenantId::new("bot-example")?;
    let spec = SpawnSpec {
        tenant,
        project: None,
        workspace: None,
        run_id: None,
        env: EnvironmentSpec {
            spec_type: Default::default(),
            image: "allternit-desktop".to_string(),
            version: None,
            packages: vec![],
            env_vars: Default::default(),
            working_dir: None,
            mounts: vec![],
        },
        policy: PolicySpec::default_permissive(),
        resources: ResourceSpec {
            cpu_millis: 2000,
            memory_mib: 4096,
            disk_mib: Some(20_480),
            network_egress_kib: None,
            gpu_count: None,
        },
        envelope: None,
        prewarm_pool: None,
    };

    println!("Provisioning desktop...");
    let handle = driver.spawn(spec).await?;
    let native_id = handle
        .driver_info
        .get("native_id")
        .cloned()
        .unwrap_or_default();
    println!("Spawned native_id: {}", native_id);

    if let Ok(Some(ep)) = driver.get_desktop_endpoint(&handle).await {
        println!("Desktop endpoint: {} (password: {:?})", ep.url, ep.token);
    }

    // Wait for the desktop services to come up in the golden image.
    println!("Waiting for desktop services...");
    for attempt in 0..30 {
        let result = driver
            .exec(
                &handle,
                CommandSpec {
                    command: vec!["pgrep".to_string(), "x11vnc".to_string()],
                    env_vars: Default::default(),
                    working_dir: None,
                    stdin_data: None,
                    capture_stdout: true,
                    capture_stderr: true,
                },
            )
            .await?;
        if result.exit_code == 0 {
            println!("x11vnc ready after {} attempts", attempt + 1);
            break;
        }
        tokio::time::sleep(std::time::Duration::from_secs(5)).await;
    }

    println!("Taking screenshot...");
    let proof_path = "/tmp/proof-driver.png";
    driver
        .exec(
            &handle,
            CommandSpec {
                command: vec![
                    "env".to_string(),
                    "DISPLAY=:0".to_string(),
                    "scrot".to_string(),
                    proof_path.to_string(),
                ],
                env_vars: Default::default(),
                working_dir: None,
                stdin_data: None,
                capture_stdout: true,
                capture_stderr: true,
            },
        )
        .await?;

    let png = driver.substrate().pull_file(&native_id, proof_path).await?;

    let out_path = std::env::var("DESKTOP_PROOF_PATH")
        .unwrap_or_else(|_| "/tmp/proof-driver-local.png".to_string());
    std::fs::write(&out_path, &png)?;
    println!("Screenshot written to {} ({} bytes)", out_path, png.len());

    driver.destroy(&handle).await?;
    println!("Destroyed {}", native_id);

    Ok(())
}
