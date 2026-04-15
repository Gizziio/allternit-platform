import Foundation
import AllternitVMManager
import Virtualization

/// CLI tool for managing Allternit VMs
@available(macOS 13.0, *)
@main
struct VMManagerCLI {
    @MainActor
    static func main() async {
        let args = CommandLine.arguments
        
        guard args.count > 1 else {
            printUsage()
            exit(1)
        }
        
        let command = args[1]
        
        do {
            switch command {
            case "start":
                try await startVM(args: Array(args.dropFirst(2)))
            case "stop":
                try await stopVM()
            case "status":
                try await showStatus()
            case "exec":
                try await executeCommand(args: Array(args.dropFirst(2)))
            case "setup":
                try await setupVM()
            case "help", "--help", "-h":
                printUsage()
            default:
                print("Unknown command: \(command)")
                printUsage()
                exit(1)
            }
        } catch {
            print("Error: \(error)")
            exit(1)
        }
    }
    
    static func printUsage() {
        print("""
        Allternit VM Manager - Manage Linux VMs on macOS
        
        Usage: vm-manager-cli <command> [options]
        
        Commands:
            start    Start the VM
                     Options: --kernel <path> --initrd <path> --rootfs <path>
                     --cpus <n> --memory <mb> --socket <path>
            
            stop     Stop the VM
            status   Show VM status
            exec     Execute a command in the VM
                     Usage: exec <command> [args...]
            setup    Download VM images if needed
            help     Show this help message
        
        Environment Variables:
            ALLTERNIT_VM_KERNEL    Path to kernel (default: ~/.allternit/vm-images/vmlinux-6.5.0-allternit)
            ALLTERNIT_VM_INITRD    Path to initrd (default: ~/.allternit/vm-images/initrd.img-6.5.0-allternit)
            ALLTERNIT_VM_ROOTFS    Path to rootfs (default: ~/.allternit/vm-images/ubuntu-22.04-allternit-v1.1.0.ext4)
            ALLTERNIT_VM_SOCKET    Path to socket (default: ~/.allternit/desktop-vm.sock)
        """)
    }
    
    @MainActor
    static func startVM(args: [String]) async throws {
        let config = try parseConfiguration(args: args)
        
        print("Starting Allternit VM...")
        print("  Kernel: \(config.kernelPath)")
        print("  Initrd: \(config.initrdPath)")
        print("  Rootfs: \(config.rootfsPath)")
        print("  CPUs: \(config.cpuCount)")
        print("  Memory: \(config.memorySize / 1024 / 1024) MB")
        print("  Socket: \(config.socketPath)")
        
        let manager = VMManager(configuration: config)
        
        // Set up status monitoring
        manager.onStatusChange { status in
            print("[Status] \(status.state.rawValue)")
            if let error = status.errorMessage {
                print("[Error] \(error)")
            }
        }
        
        try await manager.start()
        
        print("✅ VM started successfully")
        print("   Socket: \(config.socketPath)")
        
        // Keep running until interrupted
        print("\nPress Ctrl+C to stop...")
        
        // Set up signal handler
        signal(SIGINT, SIG_IGN)
        let sigintSource = DispatchSource.makeSignalSource(signal: SIGINT, queue: .main)
        sigintSource.setEventHandler {
            print("\nStopping VM...")
            Task {
                try? await manager.stop()
                if FileManager.default.fileExists(atPath: config.socketPath) {
                    try? FileManager.default.removeItem(atPath: config.socketPath)
                }
                exit(0)
            }
        }
        sigintSource.resume()
        
        // Start Unix socket server for client commands
        try await UnixSocketBridge.startServer(socketPath: config.socketPath, manager: manager)
    }
    
    @MainActor
    static func stopVM() async throws {
        print("Stopping Allternit VM...")
        
        let config = try loadDefaultConfiguration()
        let response = try await UnixSocketBridge.sendRequest(
            socketPath: config.socketPath,
            request: ["type": "stop"]
        )
        
        if let success = response["success"] as? Bool, success {
            print("✅ VM stopped")
        } else {
            let message = response["message"] as? String ?? "Unknown error"
            throw VMError.commandExecutionFailed(message)
        }
    }
    
    @MainActor
    static func showStatus() async throws {
        let config = try loadDefaultConfiguration()
        
        let response = try await UnixSocketBridge.sendRequest(
            socketPath: config.socketPath,
            request: ["type": "status"]
        )
        
        print("Allternit VM Status:")
        print("  State: \(response["state"] as? String ?? "unknown")")
        print("  Name: \(response["vm_name"] as? String ?? "unknown")")
        print("  Socket: \(config.socketPath)")
        print("  VSOCK Port: \(response["vsock_port"] as? UInt32 ?? 0)")
        if let uptime = response["uptime"] as? TimeInterval, uptime > 0 {
            print("  Uptime: \(formatUptime(uptime))")
        }
        if let error = response["error_message"] as? String {
            print("  Error: \(error)")
        }
    }
    
    @MainActor
    static func executeCommand(args: [String]) async throws {
        guard !args.isEmpty else {
            print("Usage: exec <command> [args...]")
            exit(1)
        }
        
        let command = args[0]
        let commandArgs = Array(args.dropFirst())
        
        print("Executing: \(command) \(commandArgs.joined(separator: " "))")
        
        let config = try loadDefaultConfiguration()
        let response = try await UnixSocketBridge.sendRequest(
            socketPath: config.socketPath,
            request: [
                "type": "exec",
                "command": command + " " + commandArgs.joined(separator: " "),
                "args": commandArgs
            ]
        )
        
        guard let success = response["success"] as? Bool else {
            print("Error: Invalid response from VM daemon")
            exit(1)
        }
        
        if let stdout = response["stdout"] as? String, !stdout.isEmpty {
            print(stdout)
        }
        if let stderr = response["stderr"] as? String, !stderr.isEmpty {
            writeToStderr(stderr)
        }
        
        exit(Int32(response["exit_code"] as? Int ?? (success ? 0 : 1)))
    }
    
    @MainActor
    static func setupVM() async throws {
        print("Setting up Allternit VM...")
        
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        let vmImagesDir = "\(home)/.allternit/vm-images"
        
        // Determine architecture suffix
        let arch: String
        #if arch(x86_64)
        arch = "amd64"
        #elseif arch(arm64)
        arch = "arm64"
        #else
        arch = String(cString: __uname().machine)
        #endif
        let archSuffix = arch == "amd64" ? "" : "-\(arch)"
        
        // Check architecture-specific names first, then legacy fallback
        let candidates = [
            (
                "vmlinux-6.5.0-allternit\(archSuffix)",
                "vmlinux-6.5.0-allternit"
            ),
            (
                "initrd.img-6.5.0-allternit\(archSuffix)",
                "initrd.img-6.5.0-allternit"
            ),
            (
                "ubuntu-22.04-allternit-v1.1.0\(archSuffix).ext4",
                "ubuntu-22.04-allternit-v1.1.0.ext4"
            )
        ]
        
        var foundFiles: [String] = []
        var missingFiles: [String] = []
        
        for (archSpecific, legacy) in candidates {
            let archPath = "\(vmImagesDir)/\(archSpecific)"
            let legacyPath = "\(vmImagesDir)/\(legacy)"
            
            if FileManager.default.fileExists(atPath: archPath) {
                print("  ✅ \(archSpecific)")
                foundFiles.append(archSpecific)
            } else if FileManager.default.fileExists(atPath: legacyPath) {
                print("  ✅ \(legacy)")
                foundFiles.append(legacy)
            } else {
                print("  ❌ \(archSpecific) - NOT FOUND")
                missingFiles.append(archSpecific)
            }
        }
        
        if missingFiles.isEmpty {
            print("\n✅ All VM images are present")
        } else {
            print("\n⚠️  Some VM images are missing")
            print("   Run 'allternit-vm-image-builder download' to download them")
            exit(1)
        }
    }
    
    // MARK: - Helpers
    
    @MainActor
    static func parseConfiguration(args: [String]) throws -> AllternitVMConfiguration {
        var kernelPath: String?
        var initrdPath: String?
        var rootfsPath: String?
        var cpuCount = 4
        var memorySize: UInt64 = 4 * 1024 * 1024 * 1024
        var socketPath: String?
        
        var i = 0
        while i < args.count {
            switch args[i] {
            case "--kernel":
                i += 1
                kernelPath = args[i]
            case "--initrd":
                i += 1
                initrdPath = args[i]
            case "--rootfs":
                i += 1
                rootfsPath = args[i]
            case "--cpus":
                i += 1
                if let count = Int(args[i]) {
                    cpuCount = count
                }
            case "--memory":
                i += 1
                if let mb = UInt64(args[i]) {
                    memorySize = mb * 1024 * 1024
                }
            case "--socket":
                i += 1
                socketPath = args[i]
            default:
                break
            }
            i += 1
        }
        
        // Use environment variables or defaults
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        
        // Determine architecture suffix for default image paths
        let arch: String
        #if arch(x86_64)
        arch = "amd64"
        #elseif arch(arm64)
        arch = "arm64"
        #else
        arch = String(cString: __uname().machine)
        #endif
        let archSuffix = arch == "amd64" ? "" : "-\(arch)"
        
        let vmImagesDir = "\(home)/.allternit/vm-images"
        
        // Resolve default kernel path (arch-specific first, then legacy)
        let defaultKernelPath: String = {
            let archPath = "\(vmImagesDir)/vmlinux-6.5.0-allternit\(archSuffix)"
            let legacyPath = "\(vmImagesDir)/vmlinux-6.5.0-allternit"
            if FileManager.default.fileExists(atPath: archPath) { return archPath }
            if FileManager.default.fileExists(atPath: legacyPath) { return legacyPath }
            return archPath // prefer arch-specific as default even if not present yet
        }()
        
        let defaultInitrdPath: String = {
            let archPath = "\(vmImagesDir)/initrd.img-6.5.0-allternit\(archSuffix)"
            let legacyPath = "\(vmImagesDir)/initrd.img-6.5.0-allternit"
            if FileManager.default.fileExists(atPath: archPath) { return archPath }
            if FileManager.default.fileExists(atPath: legacyPath) { return legacyPath }
            return archPath
        }()
        
        let defaultRootfsPath: String = {
            let archPath = "\(vmImagesDir)/ubuntu-22.04-allternit-v1.1.0\(archSuffix).ext4"
            let legacyPath = "\(vmImagesDir)/ubuntu-22.04-allternit-v1.1.0.ext4"
            if FileManager.default.fileExists(atPath: archPath) { return archPath }
            if FileManager.default.fileExists(atPath: legacyPath) { return legacyPath }
            return archPath
        }()
        
        let finalKernelPath = kernelPath
            ?? ProcessInfo.processInfo.environment["ALLTERNIT_VM_KERNEL"]
            ?? defaultKernelPath
        
        let finalInitrdPath = initrdPath
            ?? ProcessInfo.processInfo.environment["ALLTERNIT_VM_INITRD"]
            ?? defaultInitrdPath
        
        let finalRootfsPath = rootfsPath
            ?? ProcessInfo.processInfo.environment["ALLTERNIT_VM_ROOTFS"]
            ?? defaultRootfsPath
        
        let finalSocketPath = socketPath
            ?? ProcessInfo.processInfo.environment["ALLTERNIT_VM_SOCKET"]
            ?? "\(home)/.allternit/desktop-vm.sock"
        
        return AllternitVMConfiguration(
            kernelPath: finalKernelPath,
            initrdPath: finalInitrdPath,
            rootfsPath: finalRootfsPath,
            cpuCount: cpuCount,
            memorySize: memorySize,
            socketPath: finalSocketPath
        )
    }
    
    @MainActor
    static func loadDefaultConfiguration() throws -> AllternitVMConfiguration {
        try parseConfiguration(args: [])
    }
    
    @MainActor
    static func formatUptime(_ uptime: TimeInterval) -> String {
        let hours = Int(uptime) / 3600
        let minutes = (Int(uptime) % 3600) / 60
        let seconds = Int(uptime) % 60
        
        if hours > 0 {
            return String(format: "%d:%02d:%02d", hours, minutes, seconds)
        } else {
            return String(format: "%d:%02d", minutes, seconds)
        }
    }
}

// MARK: - Standard Error Output

func writeToStderr(_ string: String) {
    if let data = string.data(using: .utf8) {
        FileHandle.standardError.write(data)
    }
}
