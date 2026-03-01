#[cfg(test)]
mod tests {
    use tokio::time::Duration;
    use tokio::process::Command;
    use std::process::Stdio;
    use serde_json::json;

    #[tokio::test]
    async fn test_observation_pipeline() {
        // Start the observation service as a child process
        let mut service_cmd = Command::new("cargo");
        service_cmd
            .args(["run", "--bin", "a2rchitech-observation"])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let mut service_process = service_cmd.spawn().expect("Failed to start observation service");

        // Give the service some time to start up
        tokio::time::sleep(Duration::from_secs(3)).await;

        // Test the health endpoint
        let client = reqwest::Client::new();
        
        // Wait for the server to be ready
        let proto = "http";
        let base_url = format!("{}://{}:{}", proto, std::net::Ipv4Addr::LOCALHOST, 3006);
        let health_url = format!("{}/health", base_url);
        let mut attempts = 0;
        let max_attempts = 10;
        
        loop {
            match client.get(&health_url).send().await {
                Ok(_) => break,
                Err(_) if attempts < max_attempts => {
                    attempts += 1;
                    tokio::time::sleep(Duration::from_millis(500)).await;
                }
                Err(e) => {
                    // Try to kill the process gracefully before panicking
                    let _ = service_process.kill().await;
                    panic!("Failed to connect to observation service after {} attempts: {}", max_attempts, e);
                }
            }
        }

        // Test health endpoint
        let health_resp = client.get(&health_url).send().await.unwrap();
        assert!(health_resp.status().is_success());
        let health_body = health_resp.text().await.unwrap();
        println!("Health response: {}", health_body);

        // Test the gui/observe endpoint
        let observe_req = json!({
            "session_id": "test_session_123",
            "event_type": "click",
            "element_id": "button_save",
            "element_type": "button",
            "action": "click",
            "target": "save_document",
            "metadata": {
                "x": 100,
                "y": 200,
                "timestamp": 1234567890
            }
        });
        
        let observe_resp = client
            .post(format!("{}/gui/observe", base_url))
            .json(&observe_req)
            .send()
            .await
            .unwrap();
            
        assert!(observe_resp.status().is_success());
        let observe_body = observe_resp.json::<serde_json::Value>().await.unwrap();
        println!("Observe response: {:?}", observe_body);
        
        // Verify the response structure
        assert!(observe_body["success"].as_bool().unwrap());
        assert!(observe_body["observation_id"].is_string());
        assert!(observe_body["artifact_ids"].is_array());

        // Test getting observations for the session
        let session_id = "test_session_123";
        let obs_session_resp = client
            .get(&format!("{}/observations/session/{}", base_url, session_id))
            .send()
            .await
            .unwrap();
            
        assert!(obs_session_resp.status().is_success());
        let obs_session_body = obs_session_resp.json::<serde_json::Value>().await.unwrap();
        println!("Observations for session response: {:?}", obs_session_body);
        
        // Should have at least one observation
        assert!(obs_session_body.is_array());
        assert!(obs_session_body.as_array().unwrap().len() >= 1);

        // Test getting artifacts for the session
        let art_session_resp = client
            .get(&format!("{}/artifacts/session/{}", base_url, session_id))
            .send()
            .await
            .unwrap();
            
        assert!(art_session_resp.status().is_success());
        let art_session_body = art_session_resp.json::<serde_json::Value>().await.unwrap();
        println!("Artifacts for session response: {:?}", art_session_body);
        
        // Should have at least one artifact
        assert!(art_session_body.is_array());
        assert!(art_session_body.as_array().unwrap().len() >= 1);

        // Test getting all artifacts
        let all_artifacts_resp = client
            .get(format!("{}/artifacts", base_url))
            .send()
            .await
            .unwrap();
            
        assert!(all_artifacts_resp.status().is_success());
        let all_artifacts_body = all_artifacts_resp.json::<serde_json::Value>().await.unwrap();
        println!("All artifacts response: {:?}", all_artifacts_body);
        
        // Should have at least one artifact
        assert!(all_artifacts_body.is_array());
        assert!(all_artifacts_body.as_array().unwrap().len() >= 1);
    }
}