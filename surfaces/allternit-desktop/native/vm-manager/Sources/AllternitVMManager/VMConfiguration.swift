import Foundation
import Virtualization

/// Configuration for Allternit VM
public struct AllternitVMConfiguration: Codable, Sendable {
    public let vmName: String
    public let kernelPath: String
    public let initrdPath: String
    public let rootfsPath: String
    public let cpuCount: Int
    public let memorySize: UInt64
    public let vsockPort: UInt32
    public let socketPath: String
    
    public init(
        vmName: String = "allternit-vm",
        kernelPath: String,
        initrdPath: String,
        rootfsPath: String,
        cpuCount: Int = 4,
        memorySize: UInt64 = 4 * 1024 * 1024 * 1024, // 4 GB
        vsockPort: UInt32 = 8080,
        socketPath: String
    ) {
        self.vmName = vmName
        self.kernelPath = kernelPath
        self.initrdPath = initrdPath
        self.rootfsPath = rootfsPath
        self.cpuCount = cpuCount
        self.memorySize = memorySize
        self.vsockPort = vsockPort
        self.socketPath = socketPath
    }
}

/// VM State
public enum VMState: String, Codable, Sendable {
    case stopped
    case starting
    case running
    case stopping
    case error
    case paused
}

/// VM Status information
public struct VMStatus: Codable, Sendable {
    public let state: VMState
    public let vmName: String
    public let socketPath: String
    public let vsockPort: UInt32
    public let errorMessage: String?
    public let uptime: TimeInterval?
    
    public init(
        state: VMState,
        vmName: String,
        socketPath: String,
        vsockPort: UInt32,
        errorMessage: String? = nil,
        uptime: TimeInterval? = nil
    ) {
        self.state = state
        self.vmName = vmName
        self.socketPath = socketPath
        self.vsockPort = vsockPort
        self.errorMessage = errorMessage
        self.uptime = uptime
    }
}

/// Create VZVirtualMachineConfiguration from AllternitVMConfiguration
@available(macOS 13.0, *)
func createVZConfiguration(from config: AllternitVMConfiguration) throws -> VZVirtualMachineConfiguration {
    let vmConfig = VZVirtualMachineConfiguration()
    
    // CPU
    vmConfig.cpuCount = config.cpuCount
    
    // Memory
    vmConfig.memorySize = config.memorySize
    
    // Boot loader (Linux)
    guard FileManager.default.fileExists(atPath: config.kernelPath) else {
        throw VMError.kernelNotFound(config.kernelPath)
    }
    
    guard FileManager.default.fileExists(atPath: config.initrdPath) else {
        throw VMError.initrdNotFound(config.initrdPath)
    }
    
    let bootLoader = VZLinuxBootLoader(kernelURL: URL(fileURLWithPath: config.kernelPath))
    bootLoader.initialRamdiskURL = URL(fileURLWithPath: config.initrdPath)
    bootLoader.commandLine = "console=hvc0 root=/dev/vda rw quiet"
    vmConfig.bootLoader = bootLoader
    
    // Storage - Root filesystem
    guard FileManager.default.fileExists(atPath: config.rootfsPath) else {
        throw VMError.rootfsNotFound(config.rootfsPath)
    }
    
    let rootfsAttachment = try VZDiskImageStorageDeviceAttachment(
        url: URL(fileURLWithPath: config.rootfsPath),
        readOnly: false
    )
    let rootfsDevice = VZVirtioBlockDeviceConfiguration(attachment: rootfsAttachment)
    vmConfig.storageDevices = [rootfsDevice]
    
    // Network
    let networkDevice = VZVirtioNetworkDeviceConfiguration()
    networkDevice.attachment = VZNATNetworkDeviceAttachment()
    vmConfig.networkDevices = [networkDevice]
    
    // Serial console
    let serialConfig = VZVirtioConsoleDeviceSerialPortConfiguration()
    guard let serialRead = FileHandle(forReadingAtPath: "/dev/null"),
          let serialWrite = FileHandle(forWritingAtPath: "/dev/null") else {
        throw VMError.kernelNotFound("Unable to open /dev/null for serial console")
    }
    let serialInput = VZFileHandleSerialPortAttachment(
        fileHandleForReading: serialRead,
        fileHandleForWriting: serialWrite
    )
    serialConfig.attachment = serialInput
    vmConfig.serialPorts = [serialConfig]
    
    // VSOCK for communication
    let vsockConfig = VZVirtioSocketDeviceConfiguration()
    vmConfig.socketDevices = [vsockConfig]
    
    // Entropy
    vmConfig.entropyDevices = [VZVirtioEntropyDeviceConfiguration()]
    
    // Validate
    try vmConfig.validate()
    
    return vmConfig
}

/// VM Errors
public enum VMError: Error, CustomStringConvertible {
    case kernelNotFound(String)
    case initrdNotFound(String)
    case rootfsNotFound(String)
    case invalidConfiguration(String)
    case vmAlreadyRunning
    case vmNotRunning
    case vsockConnectionFailed(String)
    case commandExecutionFailed(String)
    
    public var description: String {
        switch self {
        case .kernelNotFound(let path):
            return "Kernel not found at: \(path)"
        case .initrdNotFound(let path):
            return "Initrd not found at: \(path)"
        case .rootfsNotFound(let path):
            return "Rootfs not found at: \(path)"
        case .invalidConfiguration(let reason):
            return "Invalid VM configuration: \(reason)"
        case .vmAlreadyRunning:
            return "VM is already running"
        case .vmNotRunning:
            return "VM is not running"
        case .vsockConnectionFailed(let reason):
            return "VSOCK connection failed: \(reason)"
        case .commandExecutionFailed(let reason):
            return "Command execution failed: \(reason)"
        }
    }
}
