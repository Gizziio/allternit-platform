import Foundation
import Virtualization

/// VSOCK Channel for communication with VM
@available(macOS 13.0, *)
public actor VSOCKChannel {
    
    // MARK: - Properties
    
    private let port: UInt32
    private var connection: VZVirtioSocketConnection?
    private var inputStream: InputStream?
    private var outputStream: OutputStream?
    
    private var pendingResponses: [String: CheckedContinuation<Data, Error>] = [:]
    private var requestCounter: UInt64 = 0
    
    // MARK: - Initialization
    
    public init(port: UInt32) {
        self.port = port
    }
    
    // MARK: - Connection
    
    public func connect(to connection: VZVirtioSocketConnection) async throws {
        self.connection = connection
        
        // Set up streams
        let input = connection.inputStream
        let output = connection.outputStream
        
        input.delegate = VSOCKStreamDelegate(channel: self)
        output.delegate = VSOCKStreamDelegate(channel: self)
        
        input.schedule(in: .current, forMode: .default)
        output.schedule(in: .current, forMode: .default)
        
        input.open()
        output.open()
        
        self.inputStream = input
        self.outputStream = output
        
        // Start reading
        Task {
            await readLoop()
        }
    }
    
    public func disconnect() {
        inputStream?.close()
        outputStream?.close()
        inputStream = nil
        outputStream = nil
        connection = nil
    }
    
    // MARK: - Communication
    
    public func sendRequest(_ request: VSOCKRequest, timeout: TimeInterval = 60) async throws -> VSOCKResponse {
        let requestId = generateRequestId()
        var requestWithId = request
        requestWithId.id = requestId
        
        let data = try JSONEncoder().encode(requestWithId)
        let lengthPrefix = UInt32(data.count).bigEndian
        
        // Send length prefix
        var lengthBytes = withUnsafeBytes(of: lengthPrefix) { Array($0) }
        try await write(Data(lengthBytes))
        
        // Send data
        try await write(data)
        
        // Wait for response
        return try await withTimeout(timeout) {
            await withCheckedContinuation { continuation in
                Task {
                    await self.registerPendingResponse(id: requestId, continuation: continuation)
                }
            }
        } transform: { data in
            try JSONDecoder().decode(VSOCKResponse.self, from: data)
        }
    }
    
    public func sendCommand(
        command: String,
        args: [String] = [],
        workingDir: String? = nil,
        env: [String: String]? = nil,
        timeout: TimeInterval = 60
    ) async throws -> CommandResult {
        let request = VSOCKRequest(
            type: .execute,
            command: command,
            args: args,
            workingDir: workingDir,
            env: env,
            timeout: timeout
        )
        
        let response = try await sendRequest(request, timeout: timeout)
        
        return CommandResult(
            success: response.success,
            stdout: response.stdout ?? "",
            stderr: response.stderr ?? "",
            exitCode: response.exitCode ?? -1,
            executionTime: response.executionTime ?? 0
        )
    }
    
    // MARK: - Private Methods
    
    private func generateRequestId() -> String {
        requestCounter += 1
        return "req-\(requestCounter)"
    }
    
    private func registerPendingResponse(id: String, continuation: CheckedContinuation<Data, Error>) {
        pendingResponses[id] = continuation
    }
    
    private func write(_ data: Data) async throws {
        guard let outputStream = outputStream else {
            throw VSOCKError.notConnected
        }
        
        var remaining = data
        while !remaining.isEmpty {
            let written = remaining.withUnsafeBytes { bytes in
                outputStream.write(bytes.bindMemory(to: UInt8.self).baseAddress!, maxLength: remaining.count)
            }
            
            if written < 0 {
                throw VSOCKError.writeFailed(outputStream.streamError?.localizedDescription ?? "Unknown error")
            }
            
            remaining = remaining.dropFirst(written)
        }
    }
    
    private func readLoop() async {
        guard let inputStream = inputStream else { return }
        
        var buffer = Data()
        let readBuffer = UnsafeMutablePointer<UInt8>.allocate(capacity: 4096)
        defer { readBuffer.deallocate() }
        
        while inputStream.hasBytesAvailable {
            let read = inputStream.read(readBuffer, maxLength: 4096)
            if read > 0 {
                buffer.append(readBuffer, count: read)
                
                // Process complete messages
                while buffer.count >= 4 {
                    let length = buffer.prefix(4).withUnsafeBytes { $0.load(as: UInt32.self).bigEndian }
                    
                    if buffer.count >= 4 + Int(length) {
                        // We have a complete message
                        let messageData = buffer.subdata(in: 4..<(4 + Int(length)))
                        buffer = buffer.dropFirst(4 + Int(length))
                        
                        await handleMessage(messageData)
                    } else {
                        break
                    }
                }
            } else if read < 0 {
                print("[VSOCK] Read error: \(inputStream.streamError?.localizedDescription ?? "Unknown")")
                break
            } else {
                // No data available, wait a bit
                try? await Task.sleep(nanoseconds: 10_000_000) // 10ms
            }
        }
    }
    
    private func handleMessage(_ data: Data) async {
        do {
            let response = try JSONDecoder().decode(VSOCKResponse.self, from: data)
            
            if let continuation = pendingResponses.removeValue(forKey: response.id) {
                continuation.resume(returning: data)
            } else {
                print("[VSOCK] Received unexpected response: \(response.id)")
            }
        } catch {
            print("[VSOCK] Failed to decode message: \(error)")
        }
    }
}

// MARK: - VSOCK Types

public struct VSOCKRequest: Codable {
    public var id: String = ""
    public let type: RequestType
    public let command: String?
    public let args: [String]?
    public let workingDir: String?
    public let env: [String: String]?
    public let timeout: TimeInterval?
    
    public init(
        type: RequestType,
        command: String? = nil,
        args: [String]? = nil,
        workingDir: String? = nil,
        env: [String: String]? = nil,
        timeout: TimeInterval? = nil
    ) {
        self.type = type
        self.command = command
        self.args = args
        self.workingDir = workingDir
        self.env = env
        self.timeout = timeout
    }
    
    public enum RequestType: String, Codable {
        case execute
        case status
        case ping
    }
}

public struct VSOCKResponse: Codable {
    public let id: String
    public let success: Bool
    public let stdout: String?
    public let stderr: String?
    public let exitCode: Int32?
    public let executionTime: TimeInterval?
    public let error: String?
    
    public init(
        id: String,
        success: Bool,
        stdout: String? = nil,
        stderr: String? = nil,
        exitCode: Int32? = nil,
        executionTime: TimeInterval? = nil,
        error: String? = nil
    ) {
        self.id = id
        self.success = success
        self.stdout = stdout
        self.stderr = stderr
        self.exitCode = exitCode
        self.executionTime = executionTime
        self.error = error
    }
}

// MARK: - Errors

public enum VSOCKError: Error {
    case notConnected
    case writeFailed(String)
    case timeout
    case invalidResponse
}

// MARK: - Helpers

private func withTimeout<T, R>(
    _ timeout: TimeInterval,
    operation: @escaping () async throws -> T,
    transform: (T) throws -> R
) async throws -> R {
    try await withThrowingTaskGroup(of: R.self) { group in
        // Add the main operation
        group.addTask {
            let result = try await operation()
            return try transform(result)
        }
        
        // Add timeout
        group.addTask {
            try await Task.sleep(nanoseconds: UInt64(timeout * 1_000_000_000))
            throw VSOCKError.timeout
        }
        
        // Return the first to complete
        let result = try await group.next()!
        group.cancelAll()
        return result
    }
}

// MARK: - Stream Delegate

@available(macOS 13.0, *)
private class VSOCKStreamDelegate: NSObject, StreamDelegate {
    weak var channel: VSOCKChannel?
    
    init(channel: VSOCKChannel) {
        self.channel = channel
    }
    
    func stream(_ aStream: Stream, handle eventCode: Stream.Event) {
        switch eventCode {
        case .openCompleted:
            print("[VSOCK] Stream opened")
        case .hasBytesAvailable:
            // Handled in readLoop
            break
        case .hasSpaceAvailable:
            // Can write
            break
        case .errorOccurred:
            print("[VSOCK] Stream error: \(aStream.streamError?.localizedDescription ?? "Unknown")")
        case .endEncountered:
            print("[VSOCK] Stream ended")
        default:
            break
        }
    }
}
