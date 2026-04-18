import Foundation
import Virtualization
import Darwin

/// Allternit VM Manager — boots and manages Linux VMs using Apple Virtualization.framework.
@available(macOS 13.0, *)
@MainActor
public final class VMManager: NSObject, ObservableObject {

    // MARK: - Properties

    private var virtualMachine: VZVirtualMachine?
    private var configuration: AllternitVMConfiguration
    private var status: VMStatus
    private var startTime: Date?

    private var stateChangeHandlers: [(VMStatus) -> Void] = []
    private var vsockChannel: VsockChannel?

    private let statusLock = NSLock()
    
    public static let debugLogPath = "/tmp/vm-manager-debug.log"
    
    nonisolated public static func logToFile(_ message: String) {
        let line = "[\(Date())] \(message)\n"
        if let data = line.data(using: .utf8) {
            if let fh = FileHandle(forWritingAtPath: debugLogPath) {
                _ = fh.seekToEndOfFile()
                fh.write(data)
                fh.closeFile()
            } else {
                FileManager.default.createFile(atPath: debugLogPath, contents: data, attributes: nil)
            }
        }
    }

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

    public init(configuration: AllternitVMConfiguration) {
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

        DispatchQueue.main.async { [weak self] in
            self?.stateChangeHandlers.forEach { $0(newStatus) }
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
            let vzConfig = try createVZConfiguration(from: configuration)
            
            let vm = VZVirtualMachine(configuration: vzConfig)
            vm.delegate = self
            self.virtualMachine = vm

            try await vm.start()

            self.startTime = Date()
            updateStatus(VMStatus(
                state: .running,
                vmName: configuration.vmName,
                socketPath: configuration.socketPath,
                vsockPort: configuration.vsockPort,
                uptime: 0
            ))

            // Wait briefly for guest agent to start listening on VSOCK
            try await Task.sleep(nanoseconds: 3 * 1_000_000_000)
            
            // Connect to guest agent via VSOCK
            var connected = false
            for socketDevice in vm.socketDevices {
                guard let virtioSocket = socketDevice as? VZVirtioSocketDevice else { continue }
                do {
                    let connection = try await virtioSocket.connect(toPort: configuration.vsockPort)
                    let channel = VsockChannel(connection: connection)
                    self.vsockChannel = channel
                    await channel.connect()
                    VMManager.logToFile("VSOCK connected on port \(configuration.vsockPort)")
                    connected = true
                    break
                } catch {
                    VMManager.logToFile("VSOCK connection attempt failed: \(error)")
                }
            }
            
            if !connected {
                throw VMError.vsockConnectionFailed("Could not connect to guest agent on VSOCK port \(configuration.vsockPort)")
            }

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
            socketPath: configuration.socketPath,
            vsockPort: configuration.vsockPort
        ))

        // Disconnect VSOCK channel cleanly
        if let channel = vsockChannel {
            await channel.disconnect()
            self.vsockChannel = nil
        }

        try await vm.stop()

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
            socketPath: configuration.socketPath,
            vsockPort: configuration.vsockPort,
            uptime: calculateUptime()
        ))
    }

    // MARK: - Command Execution via Serial Protocol

    /// Execute a shell command inside the VM.
    /// Sends the request as a length-prefixed JSON frame over the virtio-console serial port,
    /// waits for the response, and returns the result.
    public func sendCommand(
        _ command: String,
        args: [String] = [],
        workingDir: String? = nil,
        env: [String: String]? = nil,
        timeout: TimeInterval = 60
    ) async throws -> CommandResult {
        guard isRunning else {
            throw VMError.vmNotRunning
        }

        guard let channel = vsockChannel else {
            throw VMError.invalidConfiguration("VSOCK channel not initialized")
        }

        VMManager.logToFile("Sending command over VSOCK: \(command)")
        
        return try await channel.sendCommand(
            command: command,
            args: args,
            workingDir: workingDir,
            env: env,
            timeoutMs: UInt64(timeout * 1000)
        )
    }

    // MARK: - Uptime

    private func startUptimeTimer() {
        Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                guard let self = self, self.isRunning else { return }
                let uptime = self.calculateUptime()
                let s = self.currentStatus
                self.updateStatus(VMStatus(
                    state: s.state,
                    vmName: s.vmName,
                    socketPath: s.socketPath,
                    vsockPort: s.vsockPort,
                    errorMessage: s.errorMessage,
                    uptime: uptime
                ))
            }
        }
    }

    private func calculateUptime() -> TimeInterval? {
        guard let startTime = startTime else { return nil }
        return Date().timeIntervalSince(startTime)
    }
}

// MARK: - VZVirtualMachineDelegate

@available(macOS 13.0, *)
extension VMManager: @preconcurrency VZVirtualMachineDelegate {

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



// MARK: - CommandResult

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
