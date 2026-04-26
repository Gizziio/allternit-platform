#[cfg(test)]
mod tests {
    use tokio::time::Duration;
    use tokio::process::Command;
    use std::process::Stdio;

    #[tokio::test]
    async fn test_daemon_startup_and_io_ready() {
        // Start the daemon as a child process
        let mut daemon_cmd = Command::new("cargo");
        daemon_cmd
            .args(["run", "--bin", "allternit-io-daemon"])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let mut daemon_process = daemon_cmd.spawn().expect("Failed to start daemon");

        // Give the daemon some time to start up
        tokio::time::sleep(Duration::from_secs(3)).await;

        // Test the health endpoint
        let client = reqwest::Client::new();

        // Wait for the server to be ready
        let health_url = "http://127.0.0.1:3005/health";
        let mut attempts = 0;
        let max_attempts = 10;

        loop {
            match client.get(health_url).send().await {
                Ok(_) => break,
                Err(_) if attempts < max_attempts => {
                    attempts += 1;
                    tokio::time::sleep(Duration::from_millis(500)).await;
                }
                Err(e) => {
                    // Try to kill the process gracefully before panicking
                    let _ = daemon_process.kill().await;
                    panic!("Failed to connect to daemon after {} attempts: {}", max_attempts, e);
                }
            }
        }

        // Test health endpoint
        let health_resp = client.get(health_url).send().await.unwrap();
        assert!(health_resp.status().is_success());
        let health_body = health_resp.text().await.unwrap();
        println!("Health response: {}", health_body);

        // Test IO ready endpoint
        let io_ready_resp = client.get("http://127.0.0.1:3005/io-ready").send().await.unwrap();
        assert!(io_ready_resp.status().is_success());
        let io_ready_body = io_ready_resp.text().await.unwrap();
        println!("IO Ready response: {}", io_ready_body);

        // Test starting the daemon
        let start_resp = client.post("http://127.0.0.1:3005/start").send().await.unwrap();
        assert!(start_resp.status().is_success());
        let start_body = start_resp.text().await.unwrap();
        println!("Start response: {}", start_body);

        // Test setting IO ready
        let set_io_ready_resp = client.post("http://127.0.0.1:3005/set-io-ready").send().await.unwrap();
        assert!(set_io_ready_resp.status().is_success());
        let set_io_ready_body = set_io_ready_resp.text().await.unwrap();
        println!("Set IO Ready response: {}", set_io_ready_body);

        // Test IO bridge send endpoint
        let io_bridge_req = serde_json::json!({
            "jsonrpc": "2.0",
            "id": "test",
            "method": "ping",
            "params": {}
        });
        let io_bridge_resp = client
            .post("http://127.0.0.1:3005/io-bridge/send")
            .json(&io_bridge_req)
            .send()
            .await
            .unwrap();
        assert!(io_bridge_resp.status().is_success());
        let io_bridge_body = io_bridge_resp.text().await.unwrap();
        println!("IO Bridge send response: {}", io_bridge_body);

        // Final health check
        let final_health_resp = client.get(health_url).send().await.unwrap();
        assert!(final_health_resp.status().is_success());
        let final_health_body = final_health_resp.text().await.unwrap();
        println!("Final health response: {}", final_health_body);

        // Clean up - kill the daemon process
        daemon_process.kill().await.expect("Failed to kill daemon process");
    }
}