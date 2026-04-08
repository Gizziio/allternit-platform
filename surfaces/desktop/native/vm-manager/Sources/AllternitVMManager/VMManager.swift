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
    private var vsockListener: VZVirtioSocketListener?
    private var activeChannels: [VSOCKChannel] = []

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

            setupVSOCKListener()

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

        vsockListener?.stop()
        vsockListener = nil

        // Disconnect all open channels cleanly
        for channel in activeChannels {
            await channel.disconnect()
        }
        activeChannels.removeAll()

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

    // MARK: - Command Execution via VSOCK

    /// Execute a shell command inside the VM.
    /// Opens a dedicated VSOCK channel, sends the request as a length-prefixed JSON frame,
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

        guard let vm = virtualMachine,
              let vsockDevice = vm.socketDevices.first as? VZVirtioSocketDevice else {
            throw VMError.vsockConnectionFailed("No VSOCK device found on running VM")
        }

        // Open a new connection on the command port
        let connection = try await withCheckedThrowingContinuation { (cont: CheckedContinuation<VZVirtioSocketConnection, Error>) in
            vsockDevice.connect(toPort: configuration.vsockPort) { result in
                switch result {
                case .success(let conn):
                    cont.resume(returning: conn)
                case .failure(let err):
                    cont.resume(throwing: VMError.vsockConnectionFailed(err.localizedDescription))
                }
            }
        }

        let channel = VSOCKChannel(port: configuration.vsockPort)
        try await channel.connect(to: connection)
        activeChannels.append(channel)

        defer {
            Task { [weak self, channel] in
                await channel.disconnect()
                await MainActor.run {
                    self?.activeChannels.removeAll { $0 === channel }
                }
            }
        }

        return try await channel.sendCommand(
            command: command,
            args: args,
            workingDir: workingDir,
            env: env,
            timeout: timeout
        )
    }

    // MARK: - VSOCK Listener (inbound connections from VM guest)

    private func setupVSOCKListener() {
        guard let vm = virtualMachine,
              let vsockDevice = vm.socketDevices.first as? VZVirtioSocketDevice else {
            print("[VMManager] No VSOCK device found")
            return
        }

        let listener = VZVirtioSocketListener()
        listener.delegate = self
        listener.listen(onPort: configuration.vsockPort, socketDevice: vsockDevice)
        self.vsockListener = listener

        print("[VMManager] VSOCK listening on port \(configuration.vsockPort)")
    }

    // MARK: - Uptime

    private func startUptimeTimer() {
        Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            guard let self = self, self.isRunning else { return }
            let uptime = self.calculateUptime()
            let s = self.currentStatus
            self.updateStatus(VMStatus(
                state: s.state,
                vmName: s.vmName,
                pid: s.pid,
                socketPath: s.socketPath,
                vsockPort: s.vsockPort,
                errorMessage: s.errorMessage,
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

// MARK: - VZVirtioSocketListenerDelegate (inbound from guest)

@available(macOS 13.0, *)
extension VMManager: VZVirtioSocketListenerDelegate {

    public func listener(
        _ listener: VZVirtioSocketListener,
        shouldAcceptConnectionFrom connection: VZVirtioSocketConnection,
        socketDevice: VZVirtioSocketDevice
    ) -> Bool {
        print("[VMManager] Inbound VSOCK connection from guest port \(connection.destinationPort)")
        // Accept inbound connections from the guest (e.g. event push)
        Task { [weak self] in
            guard let self = self else { return }
            let channel = VSOCKChannel(port: connection.destinationPort)
            try? await channel.connect(to: connection)
            await MainActor.run {
                self.activeChannels.append(channel)
            }
        }
        return true
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
