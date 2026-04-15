import Foundation
import AllternitVMManager

/// Simple Unix domain socket bridge for VM daemon communication.
/// The daemon (start command) listens on a Unix socket and accepts JSON commands.
/// Clients (exec/stop/status commands) connect to the socket and send requests.
@available(macOS 13.0, *)
struct UnixSocketBridge {
    
    // MARK: - Server (Daemon side)
    
    @MainActor
    static func startServer(socketPath: String, manager: VMManager) async throws {
        // Remove old socket if exists
        let fm = FileManager.default
        if fm.fileExists(atPath: socketPath) {
            try fm.removeItem(atPath: socketPath)
        }
        
        // Ensure parent directory exists
        let parentDir = (socketPath as NSString).deletingLastPathComponent
        try fm.createDirectory(atPath: parentDir, withIntermediateDirectories: true, attributes: nil)
        
        // Create Unix socket
        let serverFd = socket(AF_UNIX, SOCK_STREAM, 0)
        guard serverFd >= 0 else {
            throw VMError.commandExecutionFailed("Failed to create Unix socket")
        }
        
        var addr = sockaddr_un()
        addr.sun_family = sa_family_t(AF_UNIX)
        socketPath.withCString { ptr in
            strncpy(&addr.sun_path.0, ptr, MemoryLayout.size(ofValue: addr.sun_path) - 1)
        }
        let addrLen = socklen_t(MemoryLayout<sa_family_t>.size + socketPath.utf8.count + 1)
        
        let bindResult = withUnsafePointer(to: &addr) { ptr in
            ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) { sockaddrPtr in
                bind(serverFd, sockaddrPtr, addrLen)
            }
        }
        guard bindResult == 0 else {
            close(serverFd)
            throw VMError.commandExecutionFailed("Failed to bind Unix socket at \(socketPath)")
        }
        
        guard listen(serverFd, 5) == 0 else {
            close(serverFd)
            throw VMError.commandExecutionFailed("Failed to listen on Unix socket")
        }
        
        print("[Daemon] Unix socket listening at \(socketPath)")
        
        // Set socket to non-blocking for async accept
        var flags = fcntl(serverFd, F_GETFL)
        flags |= O_NONBLOCK
        fcntl(serverFd, F_SETFL, flags)
        
        let serverHandle = FileHandle(fileDescriptor: serverFd, closeOnDealloc: true)
        
        // Server loop: accept connections while VM is running
        while manager.isRunning {
            var clientAddr = sockaddr_un()
            var clientLen = socklen_t(MemoryLayout<sockaddr_un>.size)
            let clientFd = withUnsafeMutablePointer(to: &clientAddr) { ptr in
                ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) { sockaddrPtr in
                    accept(serverFd, sockaddrPtr, &clientLen)
                }
            }
            
            if clientFd >= 0 {
                print("[Daemon] Client connected")
                Task {
                    do {
                        try await handleClientConnection(fd: clientFd, manager: manager)
                    } catch {
                        print("[Daemon] Client handler error: \(error)")
                    }
                    close(clientFd)
                }
            } else if errno == EAGAIN || errno == EWOULDBLOCK {
                try await Task.sleep(nanoseconds: 50_000_000) // 50ms
            } else {
                print("[Daemon] Accept error: \(String(cString: strerror(errno)))")
                try await Task.sleep(nanoseconds: 100_000_000) // 100ms
            }
        }
        
        // Clean up
        serverHandle.closeFile()
        if fm.fileExists(atPath: socketPath) {
            try? fm.removeItem(atPath: socketPath)
        }
        print("[Daemon] Server stopped")
    }
    
    @MainActor
    private static func handleClientConnection(fd: Int32, manager: VMManager) async throws {
        let handle = FileHandle(fileDescriptor: fd, closeOnDealloc: false)
        defer { handle.closeFile() }
        
        var buffer = Data()
        
        while true {
            let data = handle.availableData
            if data.isEmpty {
                // No more data, client might have closed connection
                // Wait a bit and check again
                try await Task.sleep(nanoseconds: 50_000_000)
                let moreData = handle.availableData
                if moreData.isEmpty {
                    break // Connection closed
                }
                buffer.append(moreData)
            } else {
                buffer.append(data)
            }
            
            // Process complete messages (length-prefixed JSON)
            while buffer.count >= 4 {
                let length = buffer.prefix(4).withUnsafeBytes { $0.load(as: UInt32.self).bigEndian }
                guard buffer.count >= 4 + Int(length) else { break }
                
                let messageData = buffer.subdata(in: 4..<(4 + Int(length)))
                buffer = buffer.dropFirst(4 + Int(length))
                
                let responseData = try await processMessage(messageData, manager: manager)
                
                // Send length-prefixed response
                let responseLength = UInt32(responseData.count).bigEndian
                var lengthBytes = withUnsafeBytes(of: responseLength) { Array($0) }
                handle.write(Data(lengthBytes))
                handle.write(responseData)
            }
        }
    }
    
    @MainActor
    private static func processMessage(_ data: Data, manager: VMManager) async throws -> Data {
        guard let message = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return try JSONSerialization.data(withJSONObject: [
                "type": "error",
                "success": false,
                "message": "Invalid JSON object"
            ])
        }
        
        let msgType = message["type"] as? String ?? "unknown"
        
        switch msgType {
        case "exec":
            let command = message["command"] as? String ?? ""
            let args = message["args"] as? [String] ?? []
            do {
                let result = try await manager.sendCommand(command, args: args)
                return try JSONSerialization.data(withJSONObject: [
                    "type": "command_response",
                    "success": result.success,
                    "stdout": result.stdout,
                    "stderr": result.stderr,
                    "exit_code": result.exitCode,
                    "execution_time_ms": Int(result.executionTime * 1000)
                ])
            } catch {
                return try JSONSerialization.data(withJSONObject: [
                    "type": "error",
                    "success": false,
                    "message": "Execution failed: \(error.localizedDescription)"
                ])
            }
            
        case "stop":
            do {
                try await manager.stop()
                return try JSONSerialization.data(withJSONObject: [
                    "type": "stopped",
                    "success": true,
                    "message": "VM stopped"
                ])
            } catch {
                return try JSONSerialization.data(withJSONObject: [
                    "type": "error",
                    "success": false,
                    "message": "Stop failed: \(error.localizedDescription)"
                ])
            }
            
        case "status":
            let status = manager.currentStatus
            return try JSONSerialization.data(withJSONObject: [
                "type": "status",
                "success": true,
                "state": status.state.rawValue,
                "vm_name": status.vmName,
                "vsock_port": status.vsockPort,
                "uptime": status.uptime ?? 0,
                "error_message": status.errorMessage as Any
            ])
            
        default:
            return try JSONSerialization.data(withJSONObject: [
                "type": "error",
                "success": false,
                "message": "Unknown command type: \(msgType)"
            ])
        }
    }
    
    // MARK: - Client
    
    static func sendRequest(socketPath: String, request: [String: Any], timeout: TimeInterval = 30) async throws -> [String: Any] {
        guard FileManager.default.fileExists(atPath: socketPath) else {
            throw VMError.commandExecutionFailed("VM daemon is not running (socket not found at \(socketPath))")
        }
        
        let fd = socket(AF_UNIX, SOCK_STREAM, 0)
        guard fd >= 0 else {
            throw VMError.commandExecutionFailed("Failed to create client socket")
        }
        defer { close(fd) }
        
        var addr = sockaddr_un()
        addr.sun_family = sa_family_t(AF_UNIX)
        socketPath.withCString { ptr in
            strncpy(&addr.sun_path.0, ptr, MemoryLayout.size(ofValue: addr.sun_path) - 1)
        }
        let addrLen = socklen_t(MemoryLayout<sa_family_t>.size + socketPath.utf8.count + 1)
        
        let connectResult = withUnsafePointer(to: &addr) { ptr in
            ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) { sockaddrPtr in
                connect(fd, sockaddrPtr, addrLen)
            }
        }
        
        guard connectResult == 0 else {
            throw VMError.commandExecutionFailed("Failed to connect to VM daemon at \(socketPath)")
        }
        
        let handle = FileHandle(fileDescriptor: fd, closeOnDealloc: false)
        
        // Send request
        let requestData = try JSONSerialization.data(withJSONObject: request)
        let lengthPrefix = UInt32(requestData.count).bigEndian
        var lengthBytes = withUnsafeBytes(of: lengthPrefix) { Array($0) }
        handle.write(Data(lengthBytes))
        handle.write(requestData)
        
        // Read response with timeout
        let deadline = Date().addingTimeInterval(timeout)
        var buffer = Data()
        
        while Date() < deadline {
            let data = handle.availableData
            if !data.isEmpty {
                buffer.append(data)
                
                while buffer.count >= 4 {
                    let length = buffer.prefix(4).withUnsafeBytes { $0.load(as: UInt32.self).bigEndian }
                    guard buffer.count >= 4 + Int(length) else { break }
                    
                    let responseData = buffer.subdata(in: 4..<(4 + Int(length)))
                    guard let response = try JSONSerialization.jsonObject(with: responseData) as? [String: Any] else {
                        throw VMError.commandExecutionFailed("Invalid response from daemon")
                    }
                    return response
                }
            }
            
            try await Task.sleep(nanoseconds: 50_000_000) // 50ms
        }
        
        throw VMError.commandExecutionFailed("Timeout waiting for VM daemon response")
    }
}
