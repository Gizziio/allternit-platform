import Foundation
import Virtualization
import Darwin

/// A2R VM Manager - Manages Linux VMs using Apple Virtualization.framework
@available(macOS 13.0, *)
@MainActor
public final class VMManager: NSObject, ObservableObject {
    
    // MARK: - Properties
    
    private var virtualMachine: VZVirtualMachine?
    private var configuration: A2RVMConfiguration
    private var status: VMStatus
    private var startTime: Date?
    
    private var stateChangeHandlers: [(VMStatus) -> Void] = []
    private var vsockListener: VZVirtioSocketListener?
    private var activeConnections: [VZVirtioSocketConnection] = []
    
    private let statusLock = NSLock()
    
    // MARK: - Public Properties
    
    public var currentStatus: VMStatus {
        statusLock.lock()
        defer { statusLock.unlock() }
        return status
    }
    
    public var isRunning: Bool {
        virtualMachine?.state == .running
    }
    
    // MARK: - Initialization
    
    public init(configuration: A2RVMConfiguration) {
        self.configuration = configuration
        self.status = VMStatus(
            state: .stopped,
            vmName: configuration.vmName,
            socketPath: configuration.socketPath,
            vsockPort: configuration.vsockPort
        )
        super.init()
    }
    
    // MARK: - Status Management
    
    private func updateStatus(_ newStatus: VMStatus) {
        statusLock.lock()
        status = newStatus
        statusLock.unlock()
        
        // Notify handlers
        DispatchQueue.main.async { [weak self] in
            self?.stateChangeHandlers.forEach { handler in
                handler(newStatus)
            }
        }
    }
    
    public func onStatusChange(_ handler: @escaping (VMStatus) -> Void) {
        stateChangeHandlers.append(handler)
    }
    
    // MARK: - VM Lifecycle
    
    public func start() async throws {
        guard virtualMachine?.state != .running else {
            throw VMError.vmAlreadyRunning
        }
        
        updateStatus(VMStatus(
            state: .starting,
            vmName: configuration.vmName,
            socketPath: configuration.socketPath,
            vsockPort: configuration.vsockPort
        ))
        
        do {
            // Create VM configuration
            let vzConfig = try createVZConfiguration(from: configuration)
            
            // Create virtual machine
            let vm = VZVirtualMachine(configuration: vzConfig)
            vm.delegate = self
            self.virtualMachine = vm
            
            // Set up VSOCK listener before starting
            setupVSOCKListener()
            
            // Start the VM
            try await vm.start()
            
            self.startTime = Date()
            updateStatus(VMStatus(
                state: .running,
                vmName: configuration.vmName,
                pid: Int(vm.processIdentifier),
                socketPath: configuration.socketPath,
                vsockPort: configuration.vsockPort,
                uptime: 0
            ))
            
            // Start uptime timer
            startUptimeTimer()
            
        } catch {
            updateStatus(VMStatus(
                state: .error,
                vmName: configuration.vmName,
                socketPath: configuration.socketPath,
                vsockPort: configuration.vsockPort,
                errorMessage: error.localizedDescription
            ))
            throw error
        }
    }
    
    public func stop() async throws {
        guard let vm = virtualMachine, vm.state == .running else {
            throw VMError.vmNotRunning
        }
        
        updateStatus(VMStatus(
            state: .stopping,
            vmName: configuration.vmName,
            pid: Int(vm.processIdentifier),
            socketPath: configuration.socketPath,
            vsockPort: configuration.vsockPort
        ))
        
        // Stop VSOCK listener
        vsockListener?.stop()
        vsockListener = nil
        
        // Stop the VM
        await vm.stop()
        
        self.startTime = nil
        updateStatus(VMStatus(
            state: .stopped,
            vmName: configuration.vmName,
            socketPath: configuration.socketPath,
            vsockPort: configuration.vsockPort
        ))
    }
    
    public func pause() async throws {
        guard let vm = virtualMachine, vm.state == .running else {
            throw VMError.vmNotRunning
        }
        
        try await vm.pause()
        updateStatus(VMStatus(
            state: .paused,
            vmName: configuration.vmName,
            pid: Int(vm.processIdentifier),
            socketPath: configuration.socketPath,
            vsockPort: configuration.vsockPort,
            uptime: calculateUptime()
        ))
    }
    
    public func resume() async throws {
        guard let vm = virtualMachine, vm.state == .paused else {
            throw VMError.vmNotRunning
        }
        
        try await vm.resume()
        updateStatus(VMStatus(
            state: .running,
            vmName: configuration.vmName,
            pid: Int(vm.processIdentifier),
            socketPath: configuration.socketPath,
            vsockPort: configuration.vsockPort,
            uptime: calculateUptime()
        ))
    }
    
    // MARK: - VSOCK Communication
    
    private func setupVSOCKListener() {
        guard let vm = virtualMachine else { return }
        
        // Get the VSOCK device
        guard let vsockDevice = vm.socketDevices.first as? VZVirtioSocketDevice else {
            print("[VMManager] No VSOCK device found")
            return
        }
        
        let listener = VZVirtioSocketListener()
        listener.delegate = self
        
        // Listen on the configured port
        listener.listen(onPort: configuration.vsockPort, socketDevice: vsockDevice)
        self.vsockListener = listener
        
        print("[VMManager] VSOCK listening on port \(configuration.vsockPort)")
    }
    
    public func sendCommand(_ command: String, timeout: TimeInterval = 60) async throws -> CommandResult {
        guard isRunning else {
            throw VMError.vmNotRunning
        }
        
        // This will be implemented with the VSOCK connection
        // For now, return a placeholder
        return CommandResult(
            success: true,
            stdout: "Command: \(command)",
            stderr: "",
            exitCode: 0,
            executionTime: 0
        )
    }
    
    // MARK: - Utility
    
    private func startUptimeTimer() {
        Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            guard let self = self, self.isRunning else { return }
            
            let uptime = self.calculateUptime()
            let currentStatus = self.currentStatus
            
            self.updateStatus(VMStatus(
                state: currentStatus.state,
                vmName: currentStatus.vmName,
                pid: currentStatus.pid,
                socketPath: currentStatus.socketPath,
                vsockPort: currentStatus.vsockPort,
                errorMessage: currentStatus.errorMessage,
                uptime: uptime
            ))
        }
    }
    
    private func calculateUptime() -> TimeInterval? {
        guard let startTime = startTime else { return nil }
        return Date().timeIntervalSince(startTime)
    }
}

// MARK: - VZVirtualMachineDelegate

@available(macOS 13.0, *)
extension VMManager: VZVirtualMachineDelegate {
    
    public func virtualMachine(_ virtualMachine: VZVirtualMachine, didStopWithError error: Error) {
        print("[VMManager] VM stopped with error: \(error)")
        
        updateStatus(VMStatus(
            state: .error,
            vmName: configuration.vmName,
            socketPath: configuration.socketPath,
            vsockPort: configuration.vsockPort,
            errorMessage: error.localizedDescription,
            uptime: calculateUptime()
        ))
        
        self.virtualMachine = nil
        self.startTime = nil
    }
    
    public func guestDidStop(_ virtualMachine: VZVirtualMachine) {
        print("[VMManager] Guest stopped")
        
        updateStatus(VMStatus(
            state: .stopped,
            vmName: configuration.vmName,
            socketPath: configuration.socketPath,
            vsockPort: configuration.vsockPort,
            uptime: calculateUptime()
        ))
        
        self.virtualMachine = nil
        self.startTime = nil
    }
}

// MARK: - VZVirtioSocketListenerDelegate

@available(macOS 13.0, *)
extension VMManager: VZVirtioSocketListenerDelegate {
    
    public func listener(_ listener: VZVirtioSocketListener, shouldAcceptConnectionFrom connection: VZVirtioSocketConnection, socketDevice: VZVirtioSocketDevice) -> Bool {
        print("[VMManager] New VSOCK connection from port \(connection.destinationPort)")
        
        activeConnections.append(connection)
        
        // Handle the connection
        handleVSOCKConnection(connection)
        
        return true
    }
    
    private func handleVSOCKConnection(_ connection: VZVirtioSocketConnection) {
        // Set up input/output streams for the connection
        // This will be used for command execution
        
        DispatchQueue.global(qos: .utility).async { [weak self] in
            // Handle the connection in the background
            self?.processVSOCKConnection(connection)
        }
    }
    
    private func processVSOCKConnection(_ connection: VZVirtioSocketConnection) {
        // Read data from the connection
        // Implement the protocol for command execution
        
        // For now, just log the connection
        print("[VMManager] Processing VSOCK connection")
        
        // The actual implementation would:
        // 1. Read command from connection
        // 2. Execute in VM
        // 3. Return results
    }
}

// MARK: - Command Result

public struct CommandResult: Codable, Sendable {
    public let success: Bool
    public let stdout: String
    public let stderr: String
    public let exitCode: Int32
    public let executionTime: TimeInterval
    
    public init(
        success: Bool,
        stdout: String,
        stderr: String,
        exitCode: Int32,
        executionTime: TimeInterval
    ) {
        self.success = success
        self.stdout = stdout
        self.stderr = stderr
        self.exitCode = exitCode
        self.executionTime = executionTime
    }
}
