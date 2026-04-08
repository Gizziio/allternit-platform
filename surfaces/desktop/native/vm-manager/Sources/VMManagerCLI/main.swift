import Foundation
import AllternitVMManager
import Virtualization

/// CLI tool for managing Allternit VMs
@available(macOS 13.0, *)
@main
struct VMManagerCLI {
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
        print("   PID: \(manager.currentStatus.pid ?? 0)")
        print("   Socket: \(config.socketPath)")
        
        // Keep running until interrupted
        print("\nPress Ctrl+C to stop...")
        
        // Set up signal handler
        signal(SIGINT) { _ in
            print("\nStopping VM...")
            Task {
                try? await manager.stop()
                exit(0)
            }
        }
        
        // Run indefinitely
        while manager.isRunning {
            try await Task.sleep(nanoseconds: 1_000_000_000)
        }
    }
    
    static func stopVM() async throws {
        print("Stopping Allternit VM...")
        
        // Load existing configuration
        let config = try loadDefaultConfiguration()
        let manager = VMManager(configuration: config)
        
        try await manager.stop()
        print("✅ VM stopped")
    }
    
    static func showStatus() async throws {
        let config = try loadDefaultConfiguration()
        let manager = VMManager(configuration: config)
        
        let status = manager.currentStatus
        
        print("Allternit VM Status:")
        print("  State: \(status.state.rawValue)")
        print("  Name: \(status.vmName)")
        if let pid = status.pid {
            print("  PID: \(pid)")
        }
        print("  Socket: \(status.socketPath)")
        print("  VSOCK Port: \(status.vsockPort)")
        if let uptime = status.uptime {
            print("  Uptime: \(formatUptime(uptime))")
        }
        if let error = status.errorMessage {
            print("  Error: \(error)")
        }
    }
    
    static func executeCommand(args: [String]) async throws {
        guard !args.isEmpty else {
            print("Usage: exec <command> [args...]")
            exit(1)
        }
        
        let command = args[0]
        let commandArgs = Array(args.dropFirst())
        
        print("Executing: \(command) \(commandArgs.joined(separator: " "))")
        
        let config = try loadDefaultConfiguration()
        let manager = VMManager(configuration: config)
        
        guard manager.isRunning else {
            print("Error: VM is not running")
            exit(1)
        }
        
        let result = try await manager.sendCommand(
            command + " " + commandArgs.joined(separator: " ")
        )
        
        if !result.stdout.isEmpty {
            print(result.stdout)
        }
        if !result.stderr.isEmpty {
            print(result.stderr, to: &standardError)
        }
        
        exit(Int32(result.exitCode))
    }
    
    static func setupVM() async throws {
        print("Setting up Allternit VM...")
        
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        let vmImagesDir = "\(home)/.allternit/vm-images"
        
        // Check if images exist
        let requiredFiles = [
            "vmlinux-6.5.0-allternit",
            "initrd.img-6.5.0-allternit",
            "ubuntu-22.04-allternit-v1.1.0.ext4"
        ]
        
        var allExist = true
        for file in requiredFiles {
            let path = "\(vmImagesDir)/\(file)"
            if FileManager.default.fileExists(atPath: path) {
                print("  ✅ \(file)")
            } else {
                print("  ❌ \(file) - NOT FOUND")
                allExist = false
            }
        }
        
        if allExist {
            print("\n✅ All VM images are present")
        } else {
            print("\n⚠️  Some VM images are missing")
            print("   Run 'allternit-vm-image-builder download' to download them")
            exit(1)
        }
    }
    
    // MARK: - Helpers
    
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
        
        let finalKernelPath = kernelPath
            ?? ProcessInfo.processInfo.environment["ALLTERNIT_VM_KERNEL"]
            ?? "\(home)/.allternit/vm-images/vmlinux-6.5.0-allternit"
        
        let finalInitrdPath = initrdPath
            ?? ProcessInfo.processInfo.environment["ALLTERNIT_VM_INITRD"]
            ?? "\(home)/.allternit/vm-images/initrd.img-6.5.0-allternit"
        
        let finalRootfsPath = rootfsPath
            ?? ProcessInfo.processInfo.environment["ALLTERNIT_VM_ROOTFS"]
            ?? "\(home)/.allternit/vm-images/ubuntu-22.04-allternit-v1.1.0.ext4"
        
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
    
    static func loadDefaultConfiguration() throws -> AllternitVMConfiguration {
        try parseConfiguration(args: [])
    }
    
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

var standardError = FileHandleOutputStream(FileHandle.standardError)

struct FileHandleOutputStream: TextOutputStream {
    let fileHandle: FileHandle
    
    init(_ fileHandle: FileHandle) {
        self.fileHandle = fileHandle
    }
    
    mutating func write(_ string: String) {
        if let data = string.data(using: .utf8) {
            fileHandle.write(data)
        }
    }
}
