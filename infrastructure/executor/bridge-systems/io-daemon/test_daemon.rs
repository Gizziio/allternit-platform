use std::process::Command;
use std::thread;
use std::time::Duration;

fn main() {
    println!("Testing IO Daemon functionality...");
    
    // Start the daemon in the background
    let mut daemon_process = Command::new("cargo")
        .args(["run", "--bin", "a2rchitech-io-daemon"])
        .spawn()
        .expect("Failed to start daemon");
    
    // Give the daemon some time to start up
    thread::sleep(Duration::from_secs(2));
    
    // Test the health endpoint
    let output = Command::new("curl")
        .args(["-s", "http://127.0.0.1:3005/health"])
        .output()
        .expect("Failed to execute health check");
    
    if output.status.success() {
        let response = String::from_utf8_lossy(&output.stdout);
        println!("✓ Health check response: {}", response);
    } else {
        println!("✗ Health check failed");
    }
    
    // Test the IO ready endpoint
    let output = Command::new("curl")
        .args(["-s", "http://127.0.0.1:3005/io-ready"])
        .output()
        .expect("Failed to execute IO ready check");
    
    if output.status.success() {
        let response = String::from_utf8_lossy(&output.stdout);
        println!("✓ IO Ready check response: {}", response);
    } else {
        println!("✗ IO Ready check failed");
    }
    
    // Test starting the daemon
    let output = Command::new("curl")
        .args(["-s", "-X", "POST", "http://127.0.0.1:3005/start"])
        .output()
        .expect("Failed to execute start command");
    
    if output.status.success() {
        let response = String::from_utf8_lossy(&output.stdout);
        println!("✓ Start daemon response: {}", response);
    } else {
        println!("✗ Start daemon failed");
    }
    
    // Test setting IO ready
    let output = Command::new("curl")
        .args(["-s", "-X", "POST", "http://127.0.0.1:3005/set-io-ready"])
        .output()
        .expect("Failed to execute set IO ready command");
    
    if output.status.success() {
        let response = String::from_utf8_lossy(&output.stdout);
        println!("✓ Set IO ready response: {}", response);
    } else {
        println!("✗ Set IO ready failed");
    }
    
    // Final health check after operations
    let output = Command::new("curl")
        .args(["-s", "http://127.0.0.1:3005/health"])
        .output()
        .expect("Failed to execute final health check");
    
    if output.status.success() {
        let response = String::from_utf8_lossy(&output.stdout);
        println!("✓ Final health check response: {}", response);
    } else {
        println!("✗ Final health check failed");
    }
    
    // Terminate the daemon process
    daemon_process.kill().expect("Failed to kill daemon process");
    
    println!("Testing completed!");
}