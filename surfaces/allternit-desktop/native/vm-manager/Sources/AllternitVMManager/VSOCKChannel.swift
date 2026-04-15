import Foundation
import Virtualization

// MARK: - Protocol Types (matches allternit-guest-agent-protocol Rust crate)

/// Top-level protocol message envelope
public struct ProtocolMessage: Codable {
    public let type: String
    
    // Connection & Health
    public let version: String?
    
    // Session Management
    public let tenantId: String?
    public let spec: SpawnSpec?
    public let sessionId: SessionId?
    
    // Command Execution
    public let requestId: String?
    public let command: String?
    public let args: [String]?
    public let workingDir: String?
    public let env: [String: String]?
    public let timeoutMs: UInt64?
    
    // Response fields
    public let success: Bool?
    public let stdout: String?
    public let stderr: String?
    public let exitCode: Int32?
    public let executionTimeMs: UInt64?
    
    // Error fields
    public let error: String?
    public let message: String?
    
    public init(
        type: String,
        version: String? = nil,
        tenantId: String? = nil,
        spec: SpawnSpec? = nil,
        sessionId: SessionId? = nil,
        requestId: String? = nil,
        command: String? = nil,
        args: [String]? = nil,
        workingDir: String? = nil,
        env: [String: String]? = nil,
        timeoutMs: UInt64? = nil,
        success: Bool? = nil,
        stdout: String? = nil,
        stderr: String? = nil,
        exitCode: Int32? = nil,
        executionTimeMs: UInt64? = nil,
        error: String? = nil,
        message: String? = nil
    ) {
        self.type = type
        self.version = version
        self.tenantId = tenantId
        self.spec = spec
        self.sessionId = sessionId
        self.requestId = requestId
        self.command = command
        self.args = args
        self.workingDir = workingDir
        self.env = env
        self.timeoutMs = timeoutMs
        self.success = success
        self.stdout = stdout
        self.stderr = stderr
        self.exitCode = exitCode
        self.executionTimeMs = executionTimeMs
        self.error = error
        self.message = message
    }
    
    enum CodingKeys: String, CodingKey {
        case type
        case version
        case tenantId = "tenant_id"
        case spec
        case sessionId = "session_id"
        case requestId = "request_id"
        case command
        case args
        case workingDir = "working_dir"
        case env
        case timeoutMs = "timeout_ms"
        case success
        case stdout
        case stderr
        case exitCode = "exit_code"
        case executionTimeMs = "execution_time_ms"
        case error
        case message
    }
}

public struct SessionId: Codable, Hashable {
    public let uuid: String
    
    public init(uuid: String = UUID().uuidString.lowercased()) {
        self.uuid = uuid
    }
}

public struct SpawnSpec: Codable {
    public let workingDir: String?
    public let environment: [String: String]?
    public let mounts: [MountSpec]?
    public let limits: ResourceLimits?
    
    enum CodingKeys: String, CodingKey {
        case workingDir = "working_dir"
        case environment
        case mounts
        case limits
    }
    
    public init(
        workingDir: String? = nil,
        environment: [String: String]? = nil,
        mounts: [MountSpec]? = nil,
        limits: ResourceLimits? = nil
    ) {
        self.workingDir = workingDir
        self.environment = environment
        self.mounts = mounts
        self.limits = limits
    }
}

public struct MountSpec: Codable {
    public let source: String
    public let destination: String
    public let readOnly: Bool
    
    enum CodingKeys: String, CodingKey {
        case source
        case destination
        case readOnly = "read_only"
    }
    
    public init(source: String, destination: String, readOnly: Bool = false) {
        self.source = source
        self.destination = destination
        self.readOnly = readOnly
    }
}

public struct ResourceLimits: Codable {
    public let maxMemoryMb: UInt64?
    public let maxCpuPercent: UInt64?
    public let maxExecutionTimeSecs: UInt64?
    public let maxFileSizeMb: UInt64?
    
    enum CodingKeys: String, CodingKey {
        case maxMemoryMb = "max_memory_mb"
        case maxCpuPercent = "max_cpu_percent"
        case maxExecutionTimeSecs = "max_execution_time_secs"
        case maxFileSizeMb = "max_file_size_mb"
    }
    
    public init(
        maxMemoryMb: UInt64? = nil,
        maxCpuPercent: UInt64? = nil,
        maxExecutionTimeSecs: UInt64? = nil,
        maxFileSizeMb: UInt64? = nil
    ) {
        self.maxMemoryMb = maxMemoryMb
        self.maxCpuPercent = maxCpuPercent
        self.maxExecutionTimeSecs = maxExecutionTimeSecs
        self.maxFileSizeMb = maxFileSizeMb
    }
}

/// VSOCK Channel for communication with VM
@available(macOS 13.0, *)
public actor VSOCKChannel {
    
    // MARK: - Properties
    
    private let port: UInt32
    private var connection: VZVirtioSocketConnection?
    private var fileHandle: FileHandle?
    
    private var readBuffer = Data()
    private var pendingResponses: [String: CheckedContinuation<Data, Error>] = [:]
    private var requestCounter: UInt64 = 0
    
    // MARK: - Initialization
    
    public init(port: UInt32) {
        self.port = port
    }
    
    // MARK: - Connection
    
    public func connect(to connection: VZVirtioSocketConnection) async throws {
        self.connection = connection
        
        let fd = connection.fileDescriptor
        guard fd >= 0 else {
            throw VSOCKError.notConnected
        }
        
        self.fileHandle = FileHandle(fileDescriptor: fd, closeOnDealloc: false)
        startReading()
    }
    
    public func disconnect() {
        fileHandle?.readabilityHandler = nil
        fileHandle = nil
        connection?.close()
        connection = nil
    }
    
    // MARK: - Communication
    
    public func sendHeartbeat() async throws -> ProtocolMessage {
        let requestId = generateRequestId()
        let message = ProtocolMessage(type: "heartbeat")
        return try await sendMessage(message, expectingResponseFor: requestId, timeout: 10)
    }
    
    public func sendCommand(
        command: String,
        args: [String] = [],
        workingDir: String? = nil,
        env: [String: String]? = nil,
        timeoutMs: UInt64 = 60000
    ) async throws -> CommandResult {
        let requestId = generateRequestId()
        
        let message = ProtocolMessage(
            type: "command_request",
            requestId: requestId,
            command: command,
            args: args,
            workingDir: workingDir,
            env: env,
            timeoutMs: timeoutMs
        )
        
        let response = try await sendMessage(message, expectingResponseFor: requestId, timeout: TimeInterval(timeoutMs) / 1000.0)
        
        guard response.type == "command_response" else {
            if response.type == "error" {
                throw VSOCKError.commandFailed(response.message ?? "Unknown error")
            }
            throw VSOCKError.invalidResponse
        }
        
        return CommandResult(
            success: response.success ?? false,
            stdout: response.stdout ?? "",
            stderr: response.stderr ?? "",
            exitCode: response.exitCode ?? -1,
            executionTime: TimeInterval(response.executionTimeMs ?? 0) / 1000.0
        )
    }
    
    // MARK: - Private Methods
    
    private func generateRequestId() -> String {
        requestCounter += 1
        return UUID().uuidString.lowercased()
    }
    
    @discardableResult
    private func sendMessage(_ message: ProtocolMessage, expectingResponseFor requestId: String, timeout: TimeInterval) async throws -> ProtocolMessage {
        let data = try JSONEncoder().encode(message)
        let lengthPrefix = UInt32(data.count).bigEndian
        
        // Send length prefix
        var lengthBytes = withUnsafeBytes(of: lengthPrefix) { Array($0) }
        try await write(Data(lengthBytes))
        
        // Send data
        try await write(data)
        
        // Wait for response
        let responseData = try await withTimeout(timeout) {
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Data, Error>) in
                Task {
                    await self.registerPendingResponse(id: requestId, continuation: continuation)
                }
            }
        }
        
        let response = try JSONDecoder().decode(ProtocolMessage.self, from: responseData)
        
        // Validate response request_id matches
        guard response.requestId == requestId else {
            throw VSOCKError.invalidResponse
        }
        
        return response
    }
    
    private func registerPendingResponse(id: String, continuation: CheckedContinuation<Data, Error>) {
        pendingResponses[id] = continuation
    }
    
    private func write(_ data: Data) async throws {
        guard let fileHandle = fileHandle else {
            throw VSOCKError.notConnected
        }
        fileHandle.write(data)
    }
    
    private func startReading() {
        guard let fileHandle = fileHandle else { return }
        
        fileHandle.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            guard !data.isEmpty else { return }
            Task {
                guard let self = self else { return }
                await self.processIncomingData(data)
            }
        }
    }
    
    private func processIncomingData(_ data: Data) async {
        readBuffer.append(data)
        
        // Process complete messages
        while readBuffer.count >= 4 {
            let length = readBuffer.prefix(4).withUnsafeBytes { $0.load(as: UInt32.self).bigEndian }
            
            if readBuffer.count >= 4 + Int(length) {
                // We have a complete message
                let messageData = readBuffer.subdata(in: 4..<(4 + Int(length)))
                readBuffer = readBuffer.dropFirst(4 + Int(length))
                
                await handleMessage(messageData)
            } else {
                break
            }
        }
    }
    
    private func handleMessage(_ data: Data) async {
        do {
            let response = try JSONDecoder().decode(ProtocolMessage.self, from: data)
            
            if let requestId = response.requestId,
               let continuation = pendingResponses.removeValue(forKey: requestId) {
                continuation.resume(returning: data)
            } else if response.type == "heartbeat_response" {
                // Handle heartbeat responses that might not have a registered continuation
                // (future enhancement: track heartbeats separately)
                print("[VSOCK] Received heartbeat response")
            } else {
                print("[VSOCK] Received unexpected response: \(response.type)")
            }
        } catch {
            print("[VSOCK] Failed to decode message: \(error)")
        }
    }
}

// MARK: - Errors

public enum VSOCKError: Error {
    case notConnected
    case writeFailed(String)
    case timeout
    case invalidResponse
    case commandFailed(String)
}

// MARK: - Helpers

private func withTimeout<T: Sendable>(
    _ timeout: TimeInterval,
    operation: @escaping () async throws -> T
) async throws -> T {
    try await withThrowingTaskGroup(of: T.self) { group in
        group.addTask {
            try await operation()
        }
        
        group.addTask {
            try await Task.sleep(nanoseconds: UInt64(timeout * 1_000_000_000))
            throw VSOCKError.timeout
        }
        
        let result = try await group.next()!
        group.cancelAll()
        return result
    }
}
