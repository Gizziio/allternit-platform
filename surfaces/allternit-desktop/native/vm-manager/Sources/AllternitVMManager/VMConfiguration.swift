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

/// Holds the file descriptors for the host side of a serial-port pipe pair.
/// The framework end is attached to the VM's virtio-console device.
public struct SerialPipePair {
    /// Host writes to this fd; guest reads from its serial port
    public let hostWriteFD: Int32
    /// Host reads from this fd; guest writes to its serial port
    public let hostReadFD: Int32
    
    public init(hostWriteFD: Int32, hostReadFD: Int32) {
        self.hostWriteFD = hostWriteFD
        self.hostReadFD = hostReadFD
    }
}

/// Create VZVirtualMachineConfiguration from AllternitVMConfiguration
@available(macOS 13.0, *)
func createVZConfiguration(from config: AllternitVMConfiguration) throws -> (VZVirtualMachineConfiguration, SerialPipePair) {
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
    // console=hvc0 → first virtio-console port (console output)
    bootLoader.commandLine = "console=hvc0 root=/dev/vda rw debug systemd.log_level=debug"
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
    
    // Serial ports
    var serialPorts: [VZVirtioConsoleDeviceSerialPortConfiguration] = []
    
    // Serial 0: console output → log file
    let consoleSerial = VZVirtioConsoleDeviceSerialPortConfiguration()
    let serialLogPath = "/tmp/allternit-vm-serial.log"
    FileManager.default.createFile(atPath: serialLogPath, contents: nil, attributes: nil)
    guard let serialRead = FileHandle(forReadingAtPath: "/dev/null"),
          let serialWrite = FileHandle(forWritingAtPath: serialLogPath) else {
        throw VMError.invalidConfiguration("Unable to open serial console files")
    }
    consoleSerial.attachment = VZFileHandleSerialPortAttachment(
        fileHandleForReading: serialRead,
        fileHandleForWriting: serialWrite
    )
    serialPorts.append(consoleSerial)
    
    // Serial 1: bidirectional protocol channel (host ↔ guest agent)
    // We use two pipes:
    //   - hostToVM: host writes → framework reads → guest serial port
    //   - vmToHost: guest serial port → framework writes → host reads
    var hostToVM: [Int32] = [-1, -1]
    var vmToHost: [Int32] = [-1, -1]
    
    guard pipe(&hostToVM) == 0 else {
        throw VMError.invalidConfiguration("Failed to create host→VM pipe: \(errno)")
    }
    guard pipe(&vmToHost) == 0 else {
        Darwin.close(hostToVM[0]); Darwin.close(hostToVM[1])
        throw VMError.invalidConfiguration("Failed to create VM→host pipe: \(errno)")
    }
    
    let protocolSerial = VZVirtioConsoleDeviceSerialPortConfiguration()
    // fileHandleForReading: framework reads FROM this to send data TO the VM
    let protocolReadFH = FileHandle(fileDescriptor: hostToVM[0], closeOnDealloc: true)
    // fileHandleForWriting: framework writes TO this with data FROM the VM
    let protocolWriteFH = FileHandle(fileDescriptor: vmToHost[1], closeOnDealloc: true)
    protocolSerial.attachment = VZFileHandleSerialPortAttachment(
        fileHandleForReading: protocolReadFH,
        fileHandleForWriting: protocolWriteFH
    )
    serialPorts.append(protocolSerial)
    
    vmConfig.serialPorts = serialPorts
    
    // VSOCK (kept for compatibility, but we use serial for communication)
    let vsockConfig = VZVirtioSocketDeviceConfiguration()
    vmConfig.socketDevices = [vsockConfig]
    
    // Entropy
    vmConfig.entropyDevices = [VZVirtioEntropyDeviceConfiguration()]
    
    // Validate
    try vmConfig.validate()
    
    let pipePair = SerialPipePair(
        hostWriteFD: hostToVM[1],   // host writes here
        hostReadFD: vmToHost[0]     // host reads from here
    )
    
    return (vmConfig, pipePair)
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
